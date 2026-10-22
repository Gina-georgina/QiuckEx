import { Router, Request, Response } from 'express';
import axios from 'axios';
import { StrKey, TransactionBuilder, Networks, Transaction } from '@stellar/stellar-sdk';
import { stellarConfig } from '../config/stellar.config';

const router = Router();

const HORIZON_URL = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE =
  process.env.STELLAR_NETWORK === 'public' ? Networks.PUBLIC : Networks.TESTNET;

const DEFAULT_SLIPPAGE_BPS = 200; // 2%
const MAX_SLIPPAGE_BPS = 200; // hard cap at 2%

function isSwapEnabled(): boolean {
  return process.env.FEATURE_MULTI_ASSET_SWAP === 'true';
}

function resolveSlippageBps(): number {
  const raw = process.env.SWAP_SLIPPAGE_BPS;
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_SLIPPAGE_BPS;
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_SLIPPAGE_BPS;
  }
  return Math.min(parsed, MAX_SLIPPAGE_BPS);
}

function resolveAsset(code: string): { code: string; issuer?: string } | null {
  if (!code) return null;
  const normalized = code.toUpperCase();
  if (normalized === 'XLM' || normalized === 'NATIVE') {
    return { code: 'XLM' };
  }
  const supported = stellarConfig.SUPPORTED_ASSETS.find(
    (a) => a.code.toUpperCase() === normalized,
  );
  if (!supported) return null;
  return { code: supported.code, issuer: supported.issuer };
}

function assetQueryParam(asset: { code: string; issuer?: string }): string {
  return asset.issuer ? `${asset.code}:${asset.issuer}` : 'native';
}

function featureGate(_req: Request, res: Response, next: () => void): void {
  if (!isSwapEnabled()) {
    res.status(404).json({ error: 'Multi-asset swap is not enabled' });
    return;
  }
  next();
}

// GET /swap/paths?source_asset=XLM&dest_asset=USDC&amount=10
router.get('/paths', featureGate, async (req: Request, res: Response) => {
  try {
    const { source_asset, dest_asset, amount } = req.query as Record<string, string>;

    if (!source_asset || !dest_asset || !amount) {
      return res.status(400).json({
        error: 'source_asset, dest_asset and amount are required',
      });
    }

    const source = resolveAsset(source_asset);
    const dest = resolveAsset(dest_asset);
    if (!source || !dest) {
      return res.status(400).json({ error: 'Unsupported asset' });
    }

    const parsedAmount = Number.parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const slippageBps = resolveSlippageBps();
    const destAmount = parsedAmount.toFixed(7);

    const { data } = await axios.get(`${HORIZON_URL}/paths/strict-receive`, {
      params: {
        source_asset: assetQueryParam(source),
        destination_asset: assetQueryParam(dest),
        destination_amount: destAmount,
      },
      timeout: 10_000,
    });

    const records = Array.isArray(data?._embedded?.records) ? data._embedded.records : [];

    const paths = records.map((record: any) => {
      const sourceAmount = Number.parseFloat(record.source_amount);
      const minSourceAmount = sourceAmount * (1 + slippageBps / 10_000);
      return {
        source_asset: record.source_asset_type === 'native' ? 'XLM' : record.source_asset_code,
        source_amount: record.source_amount,
        destination_asset:
          record.destination_asset_type === 'native' ? 'XLM' : record.destination_asset_code,
        destination_amount: record.destination_amount,
        path: (record.path || []).map((p: any) =>
          p.asset_type === 'native' ? 'XLM' : `${p.asset_code}:${p.asset_issuer}`,
        ),
        max_source_amount: minSourceAmount.toFixed(7),
      };
    });

    paths.sort((a: any, b: any) => Number(a.source_amount) - Number(b.source_amount));

    return res.json({
      source_asset: source.code,
      dest_asset: dest.code,
      amount: destAmount,
      slippage_bps: slippageBps,
      paths,
    });
  } catch (err: any) {
    const status = err?.response?.status === 400 ? 400 : 502;
    return res.status(status).json({ error: 'Failed to resolve swap paths' });
  }
});

// POST /swap/execute — client submits a signed path-payment envelope.
// Backend holds no keys: it only validates and relays to Horizon (INV-01).
router.post('/execute', featureGate, async (req: Request, res: Response) => {
  try {
    const { envelope_xdr } = req.body as { envelope_xdr?: string };
    if (!envelope_xdr || typeof envelope_xdr !== 'string') {
      return res.status(400).json({ error: 'envelope_xdr is required' });
    }

    let tx: Transaction;
    try {
      tx = TransactionBuilder.fromXDR(envelope_xdr, NETWORK_PASSPHRASE) as Transaction;
    } catch {
      return res.status(400).json({ error: 'Invalid transaction envelope' });
    }

    if (!tx || !tx.operations || tx.operations.length === 0) {
      return res.status(400).json({ error: 'Transaction has no operations' });
    }

    const hasPathPayment = tx.operations.some(
      (op: any) =>
        op.type === 'pathPaymentStrictReceive' || op.type === 'pathPaymentStrictSend',
    );
    if (!hasPathPayment) {
      return res.status(400).json({ error: 'Transaction must contain a path payment operation' });
    }

    const sourceAccount = tx.source;
    if (!sourceAccount || !StrKey.isValidEd25519PublicKey(sourceAccount)) {
      return res.status(400).json({ error: 'Invalid source account' });
    }

    // Envelope must already be signed by the client; backend never signs.
    if (!tx.signatures || tx.signatures.length === 0) {
      return res.status(400).json({ error: 'Transaction envelope is not signed' });
    }

    const { data } = await axios.post(
      `${HORIZON_URL}/transactions`,
      new URLSearchParams({ tx: envelope_xdr }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15_000,
      },
    );

    return res.status(202).json({
      hash: data.hash,
      ledger: data.ledger,
      successful: data.successful,
    });
  } catch (err: any) {
    const horizonStatus = err?.response?.status;
    if (horizonStatus === 400) {
      return res.status(400).json({
        error: 'Horizon rejected the transaction',
        detail: err?.response?.data,
      });
    }
    return res.status(502).json({ error: 'Failed to submit transaction to Horizon' });
  }
});

export default router;
