import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { StrKey, TransactionBuilder, Transaction } from '@stellar/stellar-sdk';

/**
 * Multi-asset swap service (issue #364).
 *
 * Resolves best swap paths on the Stellar DEX via Horizon's
 * `/paths/strict-receive` and relays client-signed path-payment
 * transactions to Horizon.
 *
 * INV-01 (self-custody): this service NEVER holds, derives, or signs with
 * any secret key. It only validates and relays already-signed envelopes.
 */

const DEFAULT_SLIPPAGE_BPS = 200; // 2%
const MAX_SLIPPAGE_BPS = 200; // hard cap: 2%
const DEFAULT_HORIZON_URL = 'https://horizon-testnet.stellar.org';
const DEFAULT_NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

export interface SwapPath {
  source_asset: string;
  dest_asset: string;
  source_amount: string;
  destination_amount: string;
  path: Array<{ asset_type: string; asset_code?: string; asset_issuer?: string }>;
}

export interface SwapPathsResult {
  source_asset: string;
  dest_asset: string;
  amount: string;
  slippage_bps: number;
  min_destination_amount: string;
  paths: SwapPath[];
}

export interface SwapExecuteResult {
  hash: string;
  ledger?: number;
  successful: boolean;
  envelope_xdr: string;
}

@Injectable()
export class SwapService {
  private readonly logger = new Logger(SwapService.name);
  private readonly horizon: AxiosInstance;
  private readonly networkPassphrase: string;

  constructor(private readonly configService: ConfigService) {
    const horizonUrl =
      this.configService.get<string>('HORIZON_URL') || DEFAULT_HORIZON_URL;
    this.networkPassphrase =
      this.configService.get<string>('STELLAR_NETWORK_PASSPHRASE') ||
      DEFAULT_NETWORK_PASSPHRASE;
    this.horizon = axios.create({ baseURL: horizonUrl, timeout: 10_000 });
  }

  /** Feature gate: disabled unless FEATURE_MULTI_ASSET_SWAP=true. */
  isEnabled(): boolean {
    return (
      String(this.configService.get<string>('FEATURE_MULTI_ASSET_SWAP')).toLowerCase() ===
      'true'
    );
  }

  assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new ForbiddenException('Multi-asset swap feature is disabled');
    }
  }

  /** Slippage tolerance in bps, capped at 2% (200 bps). */
  getSlippageBps(): number {
    const raw = this.configService.get<string>('SWAP_SLIPPAGE_BPS');
    const parsed = raw !== undefined ? Number(raw) : DEFAULT_SLIPPAGE_BPS;
    if (!Number.isFinite(parsed) || parsed < 0) {
      return DEFAULT_SLIPPAGE_BPS;
    }
    return Math.min(Math.floor(parsed), MAX_SLIPPAGE_BPS);
  }

  /**
   * Resolve best swap path(s) from Horizon `/paths/strict-receive`.
   * The payer specifies how much of `source_asset` they will send; Horizon
   * returns the destination amounts they would receive.
   */
  async findPaths(
    sourceAsset: string,
    destAsset: string,
    amount: string,
  ): Promise<SwapPathsResult> {
    this.assertEnabled();

    if (!sourceAsset || !destAsset) {
      throw new BadRequestException('source_asset and dest_asset are required');
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new BadRequestException('amount must be a positive number');
    }

    const params: Record<string, string> = {
      source_amount: amount,
      source_asset_type: this.assetType(sourceAsset),
      destination_asset_type: this.assetType(destAsset),
    };
    this.applyAssetParams(params, 'source', sourceAsset);
    this.applyAssetParams(params, 'destination', destAsset);

    let records: any[];
    try {
      const response = await this.horizon.get('/paths/strict-receive', { params });
      records = response.data?._embedded?.records ?? [];
    } catch (error) {
      this.logger.error(`Horizon path lookup failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException('Unable to resolve swap paths');
    }

    const slippageBps = this.getSlippageBps();
    const paths: SwapPath[] = records.map((record) => ({
      source_asset: sourceAsset,
      dest_asset: destAsset,
      source_amount: record.source_amount,
      destination_amount: record.destination_amount,
      path: record.path ?? [],
    }));

    const best = paths.reduce<SwapPath | undefined>((acc, current) => {
      if (!acc) return current;
      return Number(current.destination_amount) > Number(acc.destination_amount)
        ? current
        : acc;
    }, undefined);

    const minDestinationAmount = best
      ? this.applySlippage(best.destination_amount, slippageBps)
      : '0';

    return {
      source_asset: sourceAsset,
      dest_asset: destAsset,
      amount,
      slippage_bps: slippageBps,
      min_destination_amount: minDestinationAmount,
      paths,
    };
  }

  /**
   * Validate and relay a client-signed path-payment transaction envelope.
   * The backend never signs; it only checks the envelope is well-formed and
   * already signed, then submits it to Horizon.
   */
  async executeSwap(envelopeXdr: string): Promise<SwapExecuteResult> {
    this.assertEnabled();

    if (!envelopeXdr || typeof envelopeXdr !== 'string') {
      throw new BadRequestException('envelope_xdr is required');
    }

    let transaction: Transaction;
    try {
      transaction = TransactionBuilder.fromXDR(
        envelopeXdr,
        this.networkPassphrase,
      ) as Transaction;
    } catch {
      throw new BadRequestException('Invalid transaction envelope');
    }

    if (!(transaction instanceof Transaction)) {
      throw new BadRequestException('Envelope must be a transaction, not a fee-bump');
    }

    const operations = transaction.operations ?? [];
    const hasPathPayment = operations.some(
      (op) =>
        op.type === 'pathPaymentStrictReceive' ||
        op.type === 'pathPaymentStrictSend',
    );
    if (!hasPathPayment) {
      throw new BadRequestException(
        'Transaction must contain a path payment operation',
      );
    }

    const signatures = transaction.signatures ?? [];
    if (signatures.length === 0) {
      throw new BadRequestException('Transaction envelope is not signed');
    }

    const sourceAccount = transaction.source;
    if (!sourceAccount || !StrKey.isValidEd25519PublicKey(sourceAccount)) {
      throw new BadRequestException('Invalid transaction source account');
    }

    try {
      const response = await this.horizon.post(
        '/transactions',
        new URLSearchParams({ tx: envelopeXdr }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      return {
        hash: response.data.hash,
        ledger: response.data.ledger,
        successful: response.data.successful,
        envelope_xdr: response.data.envelope_xdr,
      };
    } catch (error) {
      const detail =
        (error as any)?.response?.data?.extras?.result_codes ??
        (error as Error).message;
      this.logger.error(`Horizon swap submission failed: ${JSON.stringify(detail)}`);
      throw new BadRequestException({
        message: 'Swap transaction rejected by Horizon',
        result_codes: detail,
      });
    }
  }

  private assetType(asset: string): string {
    return asset.toUpperCase() === 'XLM' ? 'native' : 'credit_alphanum4';
  }

  private applyAssetParams(
    params: Record<string, string>,
    prefix: 'source' | 'destination',
    asset: string,
  ): void {
    if (asset.toUpperCase() === 'XLM') return;
    const [code, issuer] = asset.split(':');
    if (!code || !issuer) {
      throw new BadRequestException(
        `Asset "${asset}" must be formatted as CODE:ISSUER`,
      );
    }
    params[`${prefix}_asset_code`] = code;
    params[`${prefix}_asset_issuer`] = issuer;
  }

  private applySlippage(destinationAmount: string, slippageBps: number): string {
    const amount = Number(destinationAmount);
    if (!Number.isFinite(amount)) return '0';
    const min = amount * (1 - slippageBps / 10_000);
    return min.toFixed(7);
  }
}
