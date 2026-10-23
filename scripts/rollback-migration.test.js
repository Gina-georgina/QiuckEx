const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  runMigration,
  rollbackMigration,
  discoverMigrations,
  validateSqlSyntax,
} = require('../app/backend/run-migration-supabase.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const ROLLBACK_SCRIPT = path.join(REPO_ROOT, 'scripts', 'rollback-migration.sh');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'app', 'backend', 'supabase', 'migrations');

async function withTempDir(fn) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quickex-migration-test-'));
  try {
    return await fn(tmpDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

test('discoverMigrations loads all repository migrations in monotonic order with paired rollback files', () => {
  const migrations = discoverMigrations(MIGRATIONS_DIR);
  assert.ok(migrations.length >= 63, `expected at least 63 migrations, got ${migrations.length}`);

  for (let i = 0; i < migrations.length; i++) {
    const m = migrations[i];
    assert.ok(m.hasRollbackFile, `missing rollback file for ${m.filename}: ${m.rollbackPath}`);
    assert.doesNotThrow(() => validateSqlSyntax(m.sql, m.filename));
    const rollbackSql = fs.readFileSync(m.rollbackPath, 'utf8');
    assert.doesNotThrow(() =>
      validateSqlSyntax(rollbackSql, m.rollbackFilename, { allowCommentOnly: true })
    );
    if (i > 0) {
      assert.ok(
        migrations[i - 1].version <= m.version,
        `non-monotonic version order: ${migrations[i - 1].filename} -> ${m.filename}`
      );
    }
  }
});

test('run-migration-supabase.js applies all migrations cleanly to a fresh test DB and asserts final schema', async () => {
  await withTempDir(async (tmpDir) => {
    const stateFile = path.join(tmpDir, 'test-db-state.json');
    const report = await runMigration({
      smokeTest: true,
      freshSchema: true,
      schema: 'migration_smoke_test',
      migrationsDir: MIGRATIONS_DIR,
      stateFile,
      rollback: false,
      steps: 1,
      target: null,
      dryRun: false,
      json: false,
      quiet: true,
      help: false,
    });

    assert.equal(report.ok, true);
    assert.equal(report.schema, 'migration_smoke_test');
    assert.equal(report.appliedCount, report.totalMigrations);
    assert.ok(report.tables.includes('usernames'));
    assert.ok(report.tables.includes('payment_links'));
    assert.ok(report.tables.includes('merchant_payment_preferences'));
    assert.ok(report.tables.includes('api_compatibility_reports'));
    assert.ok(report.functions.includes('save_merchant_payment_preferences'));
    assert.ok(fs.existsSync(stateFile));

    // Re-running without freshSchema is idempotent (0 newly applied migrations)
    const secondRun = await runMigration({
      smokeTest: false,
      freshSchema: false,
      schema: 'migration_smoke_test',
      migrationsDir: MIGRATIONS_DIR,
      stateFile,
      rollback: false,
      steps: 1,
      target: null,
      dryRun: false,
      json: false,
      quiet: true,
      help: false,
    });
    assert.equal(secondRun.ok, true);
    assert.equal(secondRun.appliedCount, 0);
    assert.deepEqual(secondRun.tables, report.tables);
  });
});

test('scripts/rollback-migration.sh reverts the most recent migration and allows clean re-application', async () => {
  await withTempDir(async (tmpDir) => {
    const stateFile = path.join(tmpDir, 'state.json');

    const initial = await runMigration({
      smokeTest: true,
      freshSchema: true,
      schema: 'public',
      migrationsDir: MIGRATIONS_DIR,
      stateFile,
      rollback: false,
      steps: 1,
      target: null,
      dryRun: false,
      json: false,
      quiet: true,
      help: false,
    });

    assert.ok(initial.tables.includes('merchant_payment_preferences'));
    assert.ok(initial.tables.includes('merchant_payment_preference_idempotency'));

    // Execute rollback-migration.sh against the state file
    const res = spawnSync(
      'bash',
      [ROLLBACK_SCRIPT, '--state-file', stateFile, '--json'],
      { encoding: 'utf8' }
    );
    assert.equal(res.status, 0, `rollback-migration.sh failed: ${res.stderr}`);

    const payload = JSON.parse(res.stdout);
    assert.equal(payload.ok, true);
    assert.equal(payload.rolledBackCount, 1);
    assert.equal(
      payload.rolledBack[0].filename,
      '20261017000000_merchant_payment_preferences.sql'
    );
    assert.equal(
      payload.currentHead,
      '20260930000000_create_api_compatibility_reports.sql'
    );

    const stateAfterRollback = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    assert.ok(!('merchant_payment_preferences' in stateAfterRollback.tables));
    assert.ok(!('merchant_payment_preference_idempotency' in stateAfterRollback.tables));
    assert.ok(!stateAfterRollback.functions.includes('save_merchant_payment_preferences'));

    // Re-apply forward migrations and verify the reverted migration is applied again
    const reapplied = await runMigration({
      smokeTest: false,
      freshSchema: false,
      schema: 'public',
      migrationsDir: MIGRATIONS_DIR,
      stateFile,
      rollback: false,
      steps: 1,
      target: null,
      dryRun: false,
      json: false,
      quiet: true,
      help: false,
    });
    assert.equal(reapplied.appliedCount, 1);
    assert.ok(reapplied.tables.includes('merchant_payment_preferences'));
  });
});

test('scripts/rollback-migration.sh supports --steps, --target, and --dry-run', async () => {
  await withTempDir(async (tmpDir) => {
    const stateFile = path.join(tmpDir, 'state.json');
    await runMigration({
      smokeTest: true,
      freshSchema: true,
      schema: 'public',
      migrationsDir: MIGRATIONS_DIR,
      stateFile,
      rollback: false,
      steps: 1,
      target: null,
      dryRun: false,
      json: false,
      quiet: true,
      help: false,
    });

    const beforeContent = fs.readFileSync(stateFile, 'utf8');

    // Dry-run must not modify stateFile
    const dryRes = spawnSync(
      'bash',
      [ROLLBACK_SCRIPT, '--state-file', stateFile, '--steps', '2', '--dry-run', '--json'],
      { encoding: 'utf8' }
    );
    assert.equal(dryRes.status, 0);
    const dryPayload = JSON.parse(dryRes.stdout);
    assert.equal(dryPayload.dryRun, true);
    assert.equal(dryPayload.rolledBackCount, 2);
    assert.equal(fs.readFileSync(stateFile, 'utf8'), beforeContent);

    // Multi-step rollback (--steps 2)
    const stepRes = spawnSync(
      'bash',
      [ROLLBACK_SCRIPT, '--state-file', stateFile, '--steps', '2', '--json'],
      { encoding: 'utf8' }
    );
    assert.equal(stepRes.status, 0);
    const stepPayload = JSON.parse(stepRes.stdout);
    assert.equal(stepPayload.rolledBackCount, 2);
    assert.equal(
      stepPayload.currentHead,
      '20260930000000_add_profile_visibility_and_key_rotation.sql'
    );

    // Targeted rollback (--target)
    const targetRes = spawnSync(
      'bash',
      [
        ROLLBACK_SCRIPT,
        '--state-file',
        stateFile,
        '--target',
        '20260930000000_add_profile_visibility_and_key_rotation.sql',
        '--json',
      ],
      { encoding: 'utf8' }
    );
    assert.equal(targetRes.status, 0);
    const targetPayload = JSON.parse(targetRes.stdout);
    assert.equal(targetPayload.rolledBackCount, 1);
    assert.equal(
      targetPayload.rolledBack[0].filename,
      '20260930000000_add_profile_visibility_and_key_rotation.sql'
    );
  });
});

test('scripts/rollback-migration.sh enforces production/mainnet confirmation guard and validates CLI flags', () => {
  // Refuses unconfirmed rollback in production
  const blocked = spawnSync('bash', [ROLLBACK_SCRIPT], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ENVIRONMENT_NAME: 'production',
      CONFIRM_ROLLBACK: '0',
    },
  });
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /Refusing unconfirmed rollback in production\/mainnet/);

  // Allows dry-run in production without confirmation
  const dryAllowed = spawnSync('bash', [ROLLBACK_SCRIPT, '--dry-run'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ENVIRONMENT_NAME: 'production',
    },
  });
  assert.equal(dryAllowed.status, 0);

  // Allows confirmed rollback with --yes
  const confirmed = spawnSync('bash', [ROLLBACK_SCRIPT, '--yes', '--json'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ENVIRONMENT_NAME: 'production',
    },
  });
  assert.equal(confirmed.status, 0);

  // Rejects invalid --steps value
  const badSteps = spawnSync('bash', [ROLLBACK_SCRIPT, '--steps', '0'], {
    encoding: 'utf8',
  });
  assert.equal(badSteps.status, 2);
});

test('run-migration-supabase.js and rollbackMigration reject broken migrations in a fixture directory', async () => {
  await withTempDir(async (tmpDir) => {
    const migrationsDir = path.join(tmpDir, 'migrations');
    const rollbackDir = path.join(migrationsDir, 'rollback');
    fs.mkdirSync(rollbackDir, { recursive: true });

    // 1. Altering a table that was never created must fail
    fs.writeFileSync(
      path.join(migrationsDir, '20260101000000_broken_alter.sql'),
      'ALTER TABLE missing_widget_table ADD COLUMN note TEXT;\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(rollbackDir, '20260101000000_down_broken_alter.sql'),
      'ALTER TABLE missing_widget_table DROP COLUMN IF EXISTS note;\n',
      'utf8'
    );

    await assert.rejects(
      () =>
        runMigration({
          smokeTest: true,
          freshSchema: true,
          schema: 'public',
          migrationsDir,
          stateFile: path.join(tmpDir, 'state.json'),
          rollback: false,
          steps: 1,
          target: null,
          dryRun: false,
          json: false,
          quiet: true,
          help: false,
        }),
      /alters non-existent table "missing_widget_table"/
    );

    // 2. Valid forward migration but missing rollback file must fail rollback
    fs.unlinkSync(path.join(migrationsDir, '20260101000000_broken_alter.sql'));
    fs.unlinkSync(path.join(rollbackDir, '20260101000000_down_broken_alter.sql'));

    fs.writeFileSync(
      path.join(migrationsDir, '20260102000000_create_widgets.sql'),
      'CREATE TABLE IF NOT EXISTS widgets (\n  id UUID PRIMARY KEY\n);\n',
      'utf8'
    );

    assert.throws(
      () =>
        rollbackMigration({
          migrationsDir,
          schema: 'public',
          steps: 1,
          dryRun: false,
        }),
      /Rollback file missing for 20260102000000_create_widgets\.sql/
    );
  });
});

test('postgres psql execution path executes forward migrations and rollback against DATABASE_URL', async () => {
  await withTempDir(async (tmpDir) => {
    const migrationsDir = path.join(tmpDir, 'migrations');
    const rollbackDir = path.join(migrationsDir, 'rollback');
    const binDir = path.join(tmpDir, 'bin');
    const logFile = path.join(tmpDir, 'psql-log.txt');
    fs.mkdirSync(rollbackDir, { recursive: true });
    fs.mkdirSync(binDir, { recursive: true });

    fs.writeFileSync(
      path.join(migrationsDir, '20260101000000_create_widgets.sql'),
      'CREATE TABLE IF NOT EXISTS widgets (\n  id UUID PRIMARY KEY,\n  label TEXT NOT NULL\n);\nCREATE OR REPLACE FUNCTION get_widget_count() RETURNS INTEGER LANGUAGE sql AS $$ SELECT 1; $$;',
      'utf8'
    );
    fs.writeFileSync(
      path.join(rollbackDir, '20260101000000_down_create_widgets.sql'),
      'DROP FUNCTION IF EXISTS get_widget_count();\nDROP TABLE IF EXISTS widgets;\n',
      'utf8'
    );

    // Create a simulated psql executable that records SQL and returns catalog queries
    const mockPsql = path.join(binDir, 'psql');
    fs.writeFileSync(
      mockPsql,
      `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
if (args.includes('--version')) {
  process.stdout.write('psql (PostgreSQL) 15.6\\n');
  process.exit(0);
}
const input = fs.readFileSync(0, 'utf8');
fs.appendFileSync(${JSON.stringify(logFile)}, input + '\\n---\\n', 'utf8');
if (input.includes('FROM information_schema.tables')) {
  process.stdout.write('stellar_ingestion\\npublic_profiles\\npayment_records\\nin_app_notifications\\nwidgets\\n');
} else if (input.includes('FROM information_schema.routines')) {
  process.stdout.write('get_widget_count\\n');
} else if (input.includes('SELECT version')) {
  process.stdout.write('20260101000000|create_widgets|20260101000000_create_widgets.sql|abc123\\n');
}
process.exit(0);
`,
      { mode: 0o755 }
    );

    const env = {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/quickex_test',
      SUPABASE_MIGRATIONS_DIR: migrationsDir,
    };

    const fwdRes = spawnSync(
      'node',
      [
        path.join(REPO_ROOT, 'app', 'backend', 'run-migration-supabase.js'),
        '--smoke-test',
        '--migrations-dir',
        migrationsDir,
        '--json',
      ],
      { encoding: 'utf8', env }
    );
    assert.equal(fwdRes.status, 0, `forward migration failed: ${fwdRes.stderr}`);
    const fwdJson = JSON.parse(fwdRes.stdout);
    assert.equal(fwdJson.mode, 'postgres');
    assert.equal(fwdJson.appliedCount, 1);
    assert.ok(fwdJson.tables.includes('widgets'));

    const rbRes = spawnSync(
      'bash',
      [ROLLBACK_SCRIPT, '--migrations-dir', migrationsDir, '--json'],
      { encoding: 'utf8', env }
    );
    assert.equal(rbRes.status, 0, `rollback failed: ${rbRes.stderr}`);
    const rbJson = JSON.parse(rbRes.stdout);
    assert.equal(rbJson.rolledBackCount, 1);

    const executedSql = fs.readFileSync(logFile, 'utf8');
    assert.match(executedSql, /DROP SCHEMA IF EXISTS public CASCADE/);
    assert.match(executedSql, /CREATE TABLE IF NOT EXISTS widgets/);
    assert.match(executedSql, /DROP TABLE IF EXISTS widgets/);
  });
});
