# QuickEx Frontend

The web dashboard and payment link generator for the QuickEx platform. Built with Next.js 15, Tailwind CSS, and the App Router.

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm

### Installation

From the root of the monorepo:

```bash
pnpm install
```

### Development

Run the development server:

```bash
pnpm turbo run dev --filter=app/frontend
```

Open [http://localhost:3000](http://localhost:3000) to see the result.

### Environment Variables

Create a `.env.local` file in this directory:

```env
NEXT_PUBLIC_STELLAR_NETWORK=testnet  # 'testnet' or 'mainnet'
```

## Structure

- `src/app`: App Router pages (Landing, Dashboard, Generator)
- `src/components`: Shared React components (NetworkBadge, QRPreview)
- `src/styles`: Global CSS and Tailwind configuration

## Scripts

- `dev`: Start development server
- `build`: Build production bundle
- `lint`: Run ESLint
- `type-check`: Run TypeScript compilation check

## Performance notes

- Added route-based skeleton loaders for `/dashboard` and `/marketplace`.
- Prefetched likely next routes and mock data from the landing page to improve time-to-interactive.
- Added memoized mock caches for analytics and marketplace calls to reduce repeated client work during navigation.

## Component library (Storybook)

Shared UI components (Button, Input, Modal, Toast, Badge, Avatar, QRCode,
TransactionRow) and the design tokens are documented in Storybook.

- **Live:** https://viky207.github.io/QiuckEx/ (deployed from `main` by `.github/workflows/storybook.yml`)
- **Local:** `pnpm --filter frontend storybook` → http://localhost:6006
- **Static build:** `pnpm --filter frontend build-storybook`

Stories live in `src/stories/`. Design tokens are exported from
`src/design-tokens.ts`, which reads `packages/design-tokens/tokens.json` — the
same source as `tailwind.config.ts` — so tokens and Tailwind classes stay in sync.
When you add a shared component under `src/components/ui/`, add a story for it.
