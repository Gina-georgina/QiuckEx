# Contributor onboarding

This guide gets a new contributor from a clean checkout to a local QuickEx development environment. Start with the JavaScript workspace; the mobile app and Soroban contract are optional tracks.

## Prerequisites

- Node.js 20 or newer
- pnpm 10 or newer (`corepack enable pnpm`)
- Git
- A Supabase project for backend development
- A Freighter wallet and a Stellar testnet account for payment flows
- Rust and the `wasm32-unknown-unknown` target only if you work on `app/contract`
- Android Studio/Xcode only if you work on the mobile app

Do not use a mainnet secret key in a local checkout. Local development should use Stellar testnet.

## Clone and install

```bash
git clone https://github.com/Viky207/QiuckEx.git
cd QiuckEx
corepack enable pnpm
pnpm install
```

The workspace contains `app/frontend`, `app/backend`, and `app/mobile`. The Rust contract under `app/contract` is outside the pnpm workspace.

## Configure the backend

Copy the example configuration into the backend package:

```bash
cp .env.example app/backend/.env
```

Set at least these values in `app/backend/.env`:

```dotenv
PORT=4000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
STELLAR_NETWORK=testnet
```

The backend schema also documents optional database, Redis, JWT, and Stripe variables. They are not required for the core local flow. Keep the backend on port 4000 so it does not conflict with the frontend on port 3000.

For the frontend, create `app/frontend/.env.local` when the API is not using its default:

```dotenv
NEXT_PUBLIC_QUICKEX_API_URL=http://localhost:4000
```

## Run the applications

From the repository root:

```bash
pnpm dev
```

To run one package at a time:

```bash
pnpm --filter frontend dev
pnpm --filter @quickex/backend dev
cd app/mobile && npx expo start
```

The frontend runs on `http://localhost:3000`; the backend runs on `http://localhost:4000`. Check the backend with:

```bash
curl http://localhost:4000/health
```

For mobile, press `a` or `i` in the Expo terminal after an emulator or simulator is available.

## Make a first test payment

1. Create or import a wallet in Freighter.
2. Switch Freighter and the app to Stellar testnet.
3. Fund the testnet account using the [Stellar laboratory friendbot](https://laboratory.stellar.org/#account-creator?network=test).
4. Start the frontend and backend, connect the wallet, and claim a testnet username.
5. Create a small payment link and open it in a second browser profile or wallet.
6. Confirm the transaction on testnet before testing another flow.

Never paste a mainnet secret key into `.env`, an issue, or a pull request.

## Run checks before a pull request

```bash
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

For focused work, use the package filters:

```bash
pnpm --filter @quickex/backend lint
pnpm --filter @quickex/backend type-check
pnpm --filter @quickex/backend test:unit
```

Contract changes use Cargo instead:

```bash
cd app/contract
cargo test
```

## Troubleshooting

### Port 3000 or 4000 is already in use

Stop the process using the port, or set a different backend `PORT` and matching `NEXT_PUBLIC_QUICKEX_API_URL`.

### The backend exits with missing environment variables

Confirm that the file is `app/backend/.env`, not only the repository-root `.env`, and compare it with `app/backend/src/config/env.schema.ts`.

### The frontend cannot reach the API

Check that the backend is healthy on port 4000 and that `NEXT_PUBLIC_QUICKEX_API_URL` points to it. Restart Next.js after changing `.env.local`.

### Wallet transactions fail immediately

Confirm that both the wallet and the app use Stellar testnet, that the account is funded, and that the requested asset is supported by the backend configuration.

### Expo cannot start the mobile app

Install the Expo prerequisites for your platform, start an emulator or simulator, then run `npx expo start` from `app/mobile`. Web development can continue without the mobile track.

### Contract commands fail

Install Rust, select the stable toolchain, and add the WebAssembly target before running Cargo commands in `app/contract`.

## Submit a change

1. Create a branch such as `docs/onboarding-guide` or `fix/backend-validation`.
2. Keep the change focused and avoid committing `.env` files or generated build output.
3. Run the relevant checks above.
4. Open a pull request against `main`, explain what changed, and link the issue with `Closes #<number>`.

See [`CONTRIBUTING.md`](../CONTRIBUTING.md), [`docs/CAPABILITY-MAP.md`](CAPABILITY-MAP.md), and [`docs/RUNTIME-CONFIG-MATRIX.md`](RUNTIME-CONFIG-MATRIX.md) for project-specific details.
