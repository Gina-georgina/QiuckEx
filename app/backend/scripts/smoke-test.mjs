#!/usr/bin/env node
/**
 * Automated smoke test script for the backend API.
 *
 * Reads configuration from environment variables:
 *   SMOKE_TEST_BASE_URL      - Base URL of the API (default: http://localhost:3000)
 *   SMOKE_TEST_USERNAME      - Username to use for search checks (default: "stellar")
 *   SMOKE_TEST_WEBHOOK_URL   - Optional webhook URL to notify on failure
 *   SMOKE_TEST_TIMEOUT_MS    - Overall timeout in ms (default: 30000)
 *
 * Exits 0 on success, 1 on any failure.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_URL = (process.env.SMOKE_TEST_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const TEST_USERNAME = process.env.SMOKE_TEST_USERNAME || 'stellar';
const WEBHOOK_URL = process.env.SMOKE_TEST_WEBHOOK_URL || '';
const TIMEOUT_MS = Number.parseInt(process.env.SMOKE_TEST_TIMEOUT_MS || '30000', 10);

const REPORT_PATH = resolve(__dirname, '..', 'reports', 'smoke', 'smoke-report.json');

const results = [];
const controller = new AbortController();
let timedOut = false;

const overallTimer = setTimeout(() => {
  timedOut = true;
  controller.abort();
}, Number.isFinite(TIMEOUT_MS) && TIMEOUT_MS > 0 ? TIMEOUT_MS : 30000);

function log(message) {
  process.stdout.write(`${message}\n`);
}

async function runCheck(name, fn) {
  const start = Date.now();
  const result = { name, status: 'fail', durationMs: 0, error: null };
  try {
    await fn();
    result.status = 'pass';
  } catch (err) {
    result.status = 'fail';
    result.error = err && err.message ? err.message : String(err);
  } finally {
    result.durationMs = Date.now() - start;
    results.push(result);
    const icon = result.status === 'pass' ? 'PASS' : 'FAIL';
    log(`  [${icon}] ${name} (${result.durationMs}ms)${result.error ? ` - ${result.error}` : ''}`);
  }
  return result;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchWithTimeout(url, options = {}) {
  const response = await fetch(url, { ...options, signal: controller.signal });
  return response;
}

async function checkHealth() {
  const res = await fetchWithTimeout(`${BASE_URL}/health`);
  assert(res.status === 200, `expected status 200, got ${res.status}`);
  const body = await res.json();
  assert(typeof body.status === 'string', 'missing "status" field');
  assert(typeof body.version === 'string', 'missing "version" field');
  assert(typeof body.uptime === 'number', 'missing "uptime" field');
}

async function checkReady() {
  const res = await fetchWithTimeout(`${BASE_URL}/ready`);
  assert(res.status === 200 || res.status === 503, `expected status 200 or 503, got ${res.status}`);
  const body = await res.json();
  assert(typeof body.ready === 'boolean', 'missing "ready" boolean field');
  assert(body.checks !== undefined && body.checks !== null, 'missing "checks" field');
}

async function checkMetrics() {
  const res = await fetchWithTimeout(`${BASE_URL}/metrics`);
  assert(res.status === 200, `expected status 200, got ${res.status}`);
  const contentType = res.headers.get('content-type') || '';
  assert(contentType.includes('text/plain'), `expected text/plain content-type, got "${contentType}"`);
  await res.text();
}

async function checkUsernameSearch() {
  const url = `${BASE_URL}/username/search?query=${encodeURIComponent(TEST_USERNAME)}`;
  const res = await fetchWithTimeout(url);
  assert(res.status === 200, `expected status 200, got ${res.status}`);
  const body = await res.json();
  assert(Array.isArray(body.profiles), 'missing "profiles" array');
}

async function checkUsernameTrending() {
  const res = await fetchWithTimeout(`${BASE_URL}/username/trending`);
  assert(res.status === 200, `expected status 200, got ${res.status}`);
  const body = await res.json();
  assert(Array.isArray(body), 'expected response body to be an array');
}

async function checkUsernameRecentlyActive() {
  const res = await fetchWithTimeout(`${BASE_URL}/username/recently-active`);
  assert(res.status === 200, `expected status 200, got ${res.status}`);
  const body = await res.json();
  assert(Array.isArray(body), 'expected response body to be an array');
}

async function checkLinksMetadata() {
  const payload = {
    url: 'https://example.com',
    asset: 'XLM',
    amount: '1.0000000',
  };
  const res = await fetchWithTimeout(`${BASE_URL}/links/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert(res.status === 200, `expected status 200, got ${res.status}`);
  const body = await res.json();
  assert(body.success === true, 'expected "success" to be true');
  assert(body.data !== undefined && body.data !== null, 'missing "data" field');
  assert(body.data.amount !== undefined && body.data.amount !== null, 'missing "data.amount" field');
}

function buildReport() {
  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  return {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    timeoutMs: TIMEOUT_MS,
    timedOut,
    summary: {
      total: results.length,
      passed,
      failed,
      success: failed === 0 && !timedOut,
    },
    checks: results,
  };
}

async function writeReport(report) {
  try {
    await mkdir(dirname(REPORT_PATH), { recursive: true });
    await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    log(`\nReport written to ${REPORT_PATH}`);
  } catch (err) {
    log(`\nFailed to write report: ${err && err.message ? err.message : err}`);
  }
}

async function notifyWebhook(report) {
  if (!WEBHOOK_URL) {
    return;
  }
  const failedChecks = report.checks.filter((c) => c.status === 'fail');
  const lines = failedChecks.map((c) => `- ${c.name}: ${c.error || 'failed'}`);
  const text = [
    ':rotating_light: Smoke test FAILED',
    `Base URL: ${report.baseUrl}`,
    `Passed: ${report.summary.passed}/${report.summary.total}`,
    report.timedOut ? 'Overall timeout exceeded.' : '',
    lines.length ? `Failures:\n${lines.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, content: text, report }),
    });
    log('Failure notification sent to webhook.');
  } catch (err) {
    log(`Failed to send webhook notification: ${err && err.message ? err.message : err}`);
  }
}

async function main() {
  log('Running smoke tests...');
  log(`Base URL: ${BASE_URL}`);
  log(`Timeout: ${TIMEOUT_MS}ms\n`);

  await runCheck('GET /health', checkHealth);
  await runCheck('GET /ready', checkReady);
  await runCheck('GET /metrics', checkMetrics);
  await runCheck('GET /username/search', checkUsernameSearch);
  await runCheck('GET /username/trending', checkUsernameTrending);
  await runCheck('GET /username/recently-active', checkUsernameRecentlyActive);
  await runCheck('POST /links/metadata', checkLinksMetadata);

  clearTimeout(overallTimer);

  const report = buildReport();

  log('\n--- Smoke Test Summary ---');
  log(`Total:  ${report.summary.total}`);
  log(`Passed: ${report.summary.passed}`);
  log(`Failed: ${report.summary.failed}`);
  if (report.timedOut) {
    log('Overall timeout exceeded.');
  }
  log(`Result: ${report.summary.success ? 'SUCCESS' : 'FAILURE'}`);

  await writeReport(report);

  if (!report.summary.success) {
    await notifyWebhook(report);
    process.exit(1);
  }

  process.exit(0);
}

main().catch(async (err) => {
  clearTimeout(overallTimer);
  log(`Unexpected error: ${err && err.message ? err.message : err}`);
  const report = buildReport();
  report.summary.success = false;
  await writeReport(report);
  await notifyWebhook(report);
  process.exit(1);
});