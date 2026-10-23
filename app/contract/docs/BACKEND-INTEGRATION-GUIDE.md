# Soroban Contract Backend Integration Guide

This guide is for backend developers who need to call the Handsoff Soroban
contract from a NestJS service using the Stellar JS SDK. It covers contract
invocation, transaction construction, result/error handling, event
subscription, and testnet vs mainnet configuration.

> The contract's own `README.md` documents the Rust implementation. This guide
> documents how to *call* it from TypeScript.

## 1. Prerequisites

```bash
npm install @stellar/stellar-sdk
```

All examples below use `@stellar/stellar-sdk` (v12+). The Soroban RPC client
lives at `rpc.Server`.

## 2. Configuration (testnet vs mainnet)

| Setting            | Testnet                                              | Mainnet (Pubnet)                                    |
| ------------------ | ---------------------------------------------------- | --------------------------------------------------- |
| RPC URL            | `https://soroban-testnet.stellar.org`                | `https://soroban.stellar.org` (or your provider)    |
| Network passphrase | `Test SDF Network ; September 2015`                  | `Public Global Stellar Network ; September 2015`    |
| Friendbot funding  | `https://friendbot.stellar.org`                      | n/a                                                 |
| Contract ID        | deploy per environment                               | deploy per environment                              |

```ts
import { Networks, rpc } from '@stellar/stellar-sdk';

export interface SorobanConfig {
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string;
}

export const TESTNET: SorobanConfig = {
  rpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: Networks.TESTNET,
  contractId: process.env.CONTRACT_ID_TESTNET!,
};

export const MAINNET: SorobanConfig = {
  rpcUrl: 'https://soroban.stellar.org',
  networkPassphrase: Networks.PUBLIC,
  contractId: process.env.CONTRACT_ID_MAINNET!,
};

export function makeServer(cfg: SorobanConfig): rpc.Server {
  return new rpc.Server(cfg.rpcUrl, { allowHttp: false });
}
```

Keep contract IDs and signing keys in environment variables / a secrets
manager. Never commit them.

## 3. Contract functions

The contract exposes four entry points relevant to the backend:

| Function       | Purpose                                              |
| -------------- | ---------------------------------------------------- |
| `deposit`      | Lock funds for a deal and record the depositor.      |
| `release`      | Release locked funds to the recipient.               |
| `cancel`       | Cancel a deal and refund the depositor.              |
| `verify_proof` | Verify a proof payload and return a boolean result.  |

### 3.1 Building an invocation

Use `Contract.call` to build the operation, then assemble a transaction.

```ts
import {
  Address,
  Contract,
  Keypair,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';

function buildInvocation(
  cfg: SorobanConfig,
  method: string,
  args: xdr.ScVal[],
) {
  const contract = new Contract(cfg.contractId);
  return contract.call(method, ...args);
}
```

### 3.2 `deposit`

```ts
async function deposit(
  server: rpc.Server,
  cfg: SorobanConfig,
  signer: Keypair,
  dealId: string,
  amountStroops: bigint,
) {
  const op = buildInvocation(cfg, 'deposit', [
    nativeToScVal(dealId, { type: 'string' }),
    new Address(signer.publicKey()).toScVal(),
    nativeToScVal(amountStroops, { type: 'i128' }),
  ]);

  return submit(server, cfg, signer, op);
}
```

### 3.3 `release`

```ts
async function release(
  server: rpc.Server,
  cfg: SorobanConfig,
  signer: Keypair,
  dealId: string,
  recipient: string,
) {
  const op = buildInvocation(cfg, 'release', [
    nativeToScVal(dealId, { type: 'string' }),
    new Address(recipient).toScVal(),
  ]);

  return submit(server, cfg, signer, op);
}
```

### 3.4 `cancel`

```ts
async function cancel(
  server: rpc.Server,
  cfg: SorobanConfig,
  signer: Keypair,
  dealId: string,
) {
  const op = buildInvocation(cfg, 'cancel', [
    nativeToScVal(dealId, { type: 'string' }),
  ]);

  return submit(server, cfg, signer, op);
}
```

### 3.5 `verify_proof`

`verify_proof` is a read-style call. Prefer simulation for reads so you do not
pay fees or wait for ledger close.

```ts
async function verifyProof(
  server: rpc.Server,
  cfg: SorobanConfig,
  signer: Keypair,
  dealId: string,
  proof: Buffer,
): Promise<boolean> {
  const op = buildInvocation(cfg, 'verify_proof', [
    nativeToScVal(dealId, { type: 'string' }),
    nativeToScVal(proof, { type: 'bytes' }),
  ]);

  const account = await server.getAccount(signer.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: cfg.networkPassphrase,
  })
    .addOperation(op)
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new SorobanCallError(sim.error);
  }
  const retval = sim.result?.retval;
  return retval ? Boolean(scValToNative(retval)) : false;
}
```

## 4. Transaction construction

### 4.1 Fee

Soroban fees have two parts: the classic inclusion fee and the resource fee
returned by simulation. Always simulate first, then set the fee from the
simulation result.

```ts
const sim = await server.simulateTransaction(tx);
if (rpc.Api.isSimulationError(sim)) throw new SorobanCallError(sim.error);

const prepared = rpc.assembleTransaction(tx, sim).build();
// prepared already has the correct resource fee + footprint
```

### 4.2 Memo

Memos are optional for contract calls. If you attach one, keep it under 28
bytes and use it only for correlation (e.g. an internal deal reference).

```ts
import { Memo } from '@stellar/stellar-sdk';

builder.addMemo(Memo.text(dealId.slice(0, 28)));
```

### 4.3 Authorization

If the contract requires the caller's authorization, the simulation returns
`auth` entries. `assembleTransaction` attaches them, but they must be signed by
the relevant keypair(s) before submission.

```ts
const prepared = rpc.assembleTransaction(tx, sim).build();
prepared.sign(signer); // signs the envelope + any auth entries for this key
```

For multi-party auth (e.g. a deal requiring both depositor and recipient),
collect signatures from each party before submitting.

### 4.4 Submit and poll

```ts
async function submit(
  server: rpc.Server,
  cfg: SorobanConfig,
  signer: Keypair,
  op: xdr.Operation,
) {
  const account = await server.getAccount(signer.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: cfg.networkPassphrase,
  })
    .addOperation(op)
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new SorobanCallError(sim.error);

  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(signer);

  const sent = await server.sendTransaction(prepared);
  if (sent.status === 'ERROR') throw new SorobanCallError(sent.errorResult?.toXDR('base64'));

  // Poll until the transaction is final.
  let result = await server.getTransaction(sent.hash);
  while (result.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
    await new Promise((r) => setTimeout(r, 1000));
    result = await server.getTransaction(sent.hash);
  }

  if (result.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new SorobanCallError(`transaction ${sent.hash} failed: ${result.status}`);
  }
  return result;
}
```

## 5. Handling results and error codes

Wrap failures in a typed error so NestJS exception filters can map them to
HTTP responses.

```ts
export class SorobanCallError extends Error {
  constructor(public readonly raw: string) {
    super(SorobanCallError.humanize(raw));
    this.name = 'SorobanCallError';
  }

  static humanize(raw: string): string {
    for (const [code, message] of Object.entries(ERROR_MESSAGES)) {
      if (raw.includes(code)) return message;
    }
    return `Contract call failed: ${raw}`;
  }
}
```

### Error code → message mapping

| Code / variant        | Human-readable message                                        |
| --------------------- | ------------------------------------------------------------- |
| `DealNotFound`        | The referenced deal does not exist.                           |
| `DealAlreadyExists`   | A deal with this ID already exists.                           |
| `InvalidAmount`       | The amount is invalid (must be positive).                     |
| `InsufficientFunds`   | The depositor does not have enough funds.                     |
| `Unauthorized`        | The caller is not authorized for this operation.              |
| `InvalidState`        | The deal is not in a state that allows this operation.        |
| `ProofVerificationFailed` | The supplied proof could not be verified.                 |
| `AlreadyReleased`     | Funds for this deal have already been released.               |
| `AlreadyCancelled`    | This deal has already been cancelled.                         |

```ts
export const ERROR_MESSAGES: Record<string, string> = {
  DealNotFound: 'The referenced deal does not exist.',
  DealAlreadyExists: 'A deal with this ID already exists.',
  InvalidAmount: 'The amount is invalid (must be positive).',
  InsufficientFunds: 'The depositor does not have enough funds.',
  Unauthorized: 'The caller is not authorized for this operation.',
  InvalidState: 'The deal is not in a state that allows this operation.',
  ProofVerificationFailed: 'The supplied proof could not be verified.',
  AlreadyReleased: 'Funds for this deal have already been released.',
  AlreadyCancelled: 'This deal has already been cancelled.',
};
```

> Keep this table in sync with the contract's error enum. If the contract adds
> a variant, add it here.

## 6. Subscribing to contract events

Poll `getEvents` from the last-seen ledger. Persist the cursor so restarts do
not miss events.

```ts
async function pollEvents(
  server: rpc.Server,
  cfg: SorobanConfig,
  startLedger: number,
) {
  const res = await server.getEvents({
    startLedger,
    filters: [{ type: 'contract', contractIds: [cfg.contractId] }],
    limit: 100,
  });

  for (const event of res.events) {
    // event.topic is an array of ScVal; event.value is the payload.
    const topics = event.topic.map((t) => scValToNative(t));
    const value = scValToNative(event.value);
    console.log('contract event', topics, value, 'ledger', event.ledger);
  }

  return res.latestLedger; // use as next startLedger
}
```

Run this on an interval (e.g. every 5s) in a NestJS scheduled task, and store
`latestLedger` in your database so you can resume after downtime.

## 7. NestJS wiring sketch

```ts
import { Injectable } from '@nestjs/common';
import { Keypair } from '@stellar/stellar-sdk';
import { makeServer, MAINNET, SorobanConfig } from './soroban.config';

@Injectable()
export class SorobanService {
  private readonly cfg: SorobanConfig = MAINNET;
  private readonly server = makeServer(this.cfg);
  private readonly signer = Keypair.fromSecret(process.env.STELLAR_SECRET!);

  deposit(dealId: string, amountStroops: bigint) {
    return deposit(this.server, this.cfg, this.signer, dealId, amountStroops);
  }

  release(dealId: string, recipient: string) {
    return release(this.server, this.cfg, this.signer, dealId, recipient);
  }

  cancel(dealId: string) {
    return cancel(this.server, this.cfg, this.signer, dealId);
  }

  verifyProof(dealId: string, proof: Buffer) {
    return verifyProof(this.server, this.cfg, this.signer, dealId, proof);
  }
}
```

## 8. Checklist

- [ ] Simulate before every write; never hardcode resource fees.
- [ ] Sign the assembled transaction (and auth entries) before sending.
- [ ] Poll `getTransaction` until final; do not assume success on send.
- [ ] Map contract errors to human-readable messages via `ERROR_MESSAGES`.
- [ ] Persist the event cursor to avoid missed events.
- [ ] Use testnet config in CI and mainnet config only in production.
