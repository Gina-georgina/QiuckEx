# Database Migration & Rollback Runbook

Operational runbook for authoring, validating, applying, and rolling back Supabase / PostgreSQL database migrations in QuickEx.

---

## 1. Migration Architecture & Layout

All backend schema changes live in `app/backend/supabase/migrations/` and follow a strict monotonic timestamp naming convention:

```text
app/backend/supabase/migrations/
├── YYYYMMDDHHMMSS_<migration_name>.sql               # Forward (up) migration
└── rollback/
    └── YYYYMMDDHHMMSS_down_<migration_name>.sql      # Paired rollback (down) migration
```

- **Forward Runner (`app/backend/run-migration-supabase.js`)**: Applies all pending migrations in lexicographical order, records applied versions and SHA-256 checksums in the `schema_migrations` table, and verifies that the resulting schema matches the expected tables, views, functions, and indexes.
- **Rollback Script (`scripts/rollback-migration.sh`)**: Reverts the most recent applied migration (or a specified count/target) using its paired `_down_` script in `app/backend/supabase/migrations/rollback/` inside an atomic transaction and removes the reverted entry from `schema_migrations`.
- **Static & Paired Verification (`app/backend/scripts/verify-migrations.js`)**: Verifies monotonic version sequencing, forward-to-rollback pairing, reverse-order rollback cleanup, and forward re-application idempotency.

---

## 2. Automated CI & CD Gates

### CI Migration Smoke Test (`.github/workflows/ci.yml`)

The `migration-smoke-test` job runs on every pull request (including every PR that touches `supabase/migrations/`) and push to `main`:

1. Spins up a fresh temporary test schema (`migration_smoke_test`).
2. Runs `node app/backend/run-migration-supabase.js --smoke-test` to apply all migrations in sequential order and assert that the final schema matches the expected state.
3. Executes `./scripts/rollback-migration.sh` against the temporary test database to verify the most recent migration reverts cleanly, then re-applies `run-migration-supabase.js` to confirm idempotency.
4. Runs `node app/backend/scripts/verify-migrations.js` and `node --test scripts/rollback-migration.test.js`.

### CD Deployment Gate (`.github/workflows/cd.yml`)

In `.github/workflows/cd.yml`:

- The `release` job depends on `[build-and-push-image, rc-validate, migration-smoke-test]`. If `migration-smoke-test` fails, the CD pipeline blocks deployment before touching any production slot.
- During the `release` job, `pnpm turbo run db:migrate --continue` executes before deploying the inactive blue/green slot or switching traffic. Any migration error halts the rollout immediately while production traffic remains on the active slot.

---

## 3. Rollback Procedure

When a migration must be reverted in local development, staging, or production after a failed or degraded rollout:

### Step 1: Preview the Rollback (Dry Run)

Always inspect which migration will be reverted before modifying a live schema:

```bash
./scripts/rollback-migration.sh --dry-run
```

For machine-readable output (including the exact SQL that will execute):

```bash
./scripts/rollback-migration.sh --dry-run --json
```

### Step 2: Revert the Most Recent Migration

Against a local or staging database (with `DATABASE_URL` or `SUPABASE_DB_URL` configured):

```bash
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
./scripts/rollback-migration.sh
```

Or via pnpm from the repository root:

```bash
pnpm run db:rollback
```

### Step 3: Production Rollback (Explicit Confirmation Required)

When `ENVIRONMENT_NAME=production` or `STELLAR_NETWORK=mainnet` is set, `scripts/rollback-migration.sh` refuses unconfirmed execution (exiting with code `2`) to prevent accidental data loss.

1. Confirm that traffic is pinned to the previous healthy blue/green slot (see [DEPLOYMENT-RUNBOOK.md](./DEPLOYMENT-RUNBOOK.md)).
2. Run a dry-run first to confirm the target version:
   ```bash
   ENVIRONMENT_NAME=production DATABASE_URL="$PRODUCTION_DATABASE_URL" \
     ./scripts/rollback-migration.sh --dry-run
   ```
3. Execute the confirmed rollback:
   ```bash
   ENVIRONMENT_NAME=production DATABASE_URL="$PRODUCTION_DATABASE_URL" \
     ./scripts/rollback-migration.sh --yes
   ```
   *(Alternatively, set `CONFIRM_ROLLBACK=1` in non-interactive automation.)*

### Step 4: Multi-Step or Targeted Rollbacks

- **Revert the last `N` migrations in reverse chronological order:**
  ```bash
  ./scripts/rollback-migration.sh --steps 2 --yes
  ```
- **Revert a specific migration version or filename:**
  ```bash
  ./scripts/rollback-migration.sh --target 20261017000000_merchant_payment_preferences.sql --yes
  ```

### Step 5: Post-Rollback Verification

1. Verify schema health and migration pairing:
   ```bash
   node app/backend/scripts/verify-migrations.js
   ```
2. Verify backend readiness on the active deployment slot:
   ```bash
   curl --fail --silent https://api.quickex.to/health/ready
   ```

---

## 4. Authoring New Migrations

Every pull request that adds `app/backend/supabase/migrations/YYYYMMDDHHMMSS_<name>.sql` **must**:

1. Use `IF NOT EXISTS` / `IF EXISTS` guards so forward and rollback scripts are idempotent.
2. Include the corresponding rollback file at `app/backend/supabase/migrations/rollback/YYYYMMDDHHMMSS_down_<name>.sql` that cleanly drops or reverts all objects introduced by the forward migration in reverse dependency order (triggers → functions → views → indexes → columns/tables).
3. Pass local smoke testing before opening a PR:
   ```bash
   node app/backend/run-migration-supabase.js --smoke-test
   ./scripts/rollback-migration.sh --dry-run
   node --test scripts/rollback-migration.test.js
   ```
