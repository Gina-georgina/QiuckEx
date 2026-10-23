# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@9

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN npm install -g pnpm@9

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist

RUN addgroup -S nodejs && adduser -S nestjs -G nodejs \
    && chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 4000

HEALTHCHECK CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/main"]