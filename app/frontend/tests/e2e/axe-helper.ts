import { Page, TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as fs from 'fs';
import * as path from 'path';

export interface AxeScanOptions {
  /** Optional include selectors to scope the scan. */
  include?: string[];
  /** Optional exclude selectors to skip parts of the page. */
  exclude?: string[];
  /** Optional axe tags to run (e.g. ['wcag2a', 'wcag2aa']). */
  tags?: string[];
  /** Context label used in logs and the JSON report. */
  context?: string;
}

export interface AxeViolationSummary {
  id: string;
  impact: string | null;
  description: string;
  help: string;
  helpUrl: string;
  nodes: number;
  targets: string[];
}

export interface AxeReportEntry {
  context: string;
  url: string;
  timestamp: string;
  violations: AxeViolationSummary[];
  passes: number;
  incomplete: number;
  inapplicable: number;
}

const REPORT_DIR = path.resolve(process.cwd(), 'test-results');
const REPORT_FILE = path.join(REPORT_DIR, 'axe-report.json');

function readExistingReport(): AxeReportEntry[] {
  try {
    if (fs.existsSync(REPORT_FILE)) {
      const raw = fs.readFileSync(REPORT_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as AxeReportEntry[];
      }
    }
  } catch {
    // Ignore malformed report and start fresh.
  }
  return [];
}

function writeReport(entries: AxeReportEntry[]): void {
  try {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(REPORT_FILE, JSON.stringify(entries, null, 2), 'utf-8');
  } catch (err) {
    // Never fail a test because of report writing issues.
    // eslint-disable-next-line no-console
    console.warn(`[axe-helper] Failed to write axe report: ${String(err)}`);
  }
}

function summarizeViolations(
  violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations'],
): AxeViolationSummary[] {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact ?? null,
    description: violation.description,
    help: violation.help,
    helpUrl: violation.helpUrl,
    nodes: violation.nodes.length,
    targets: violation.nodes.flatMap((node) => node.target.map((t) => String(t))),
  }));
}

function emitViolationAnnotation(violation: AxeViolationSummary): void {
  const level = violation.impact === 'critical' || violation.impact === 'serious'
    ? 'error'
    : 'warning';
  const details = `[${violation.impact ?? 'unknown'}] ${violation.help}. Elements: ${violation.targets.join(', ')}. Remediation: ${violation.helpUrl}`;
  const escaped = details
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');

  console.log(`::${level} title=Axe ${violation.id}::${escaped}`);
}

/**
 * Run an axe accessibility scan against the current page.
 *
 * - Critical and serious violations cause the test to fail.
 * - Moderate and minor violations are logged as warnings.
 * - A JSON report is appended to test-results/axe-report.json for CI artifacts.
 */
export async function runAxeScan(
  page: Page,
  testInfo?: TestInfo,
  options: AxeScanOptions = {},
): Promise<AxeViolationSummary[]> {
  const context = options.context ?? (testInfo ? testInfo.title : 'axe-scan');

  let builder = new AxeBuilder({ page });

  if (options.include && options.include.length > 0) {
    builder = builder.include(options.include);
  }
  if (options.exclude && options.exclude.length > 0) {
    builder = builder.exclude(options.exclude);
  }
  if (options.tags && options.tags.length > 0) {
    builder = builder.withTags(options.tags);
  }

  const results = await builder.analyze();

  const violations = summarizeViolations(results.violations);

  for (const violation of violations) {
    emitViolationAnnotation(violation);
  }

  const critical = violations.filter((v) => v.impact === 'critical');
  const serious = violations.filter((v) => v.impact === 'serious');
  const moderate = violations.filter((v) => v.impact === 'moderate');
  const minor = violations.filter((v) => v.impact === 'minor');

  // Append to the shared JSON report for CI artifact upload.
  const entry: AxeReportEntry = {
    context,
    url: page.url(),
    timestamp: new Date().toISOString(),
    violations,
    passes: results.passes.length,
    incomplete: results.incomplete.length,
    inapplicable: results.inapplicable.length,
  };
  const report = readExistingReport();
  report.push(entry);
  writeReport(report);

  if (moderate.length > 0 || minor.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[axe-helper] ${context}: ${moderate.length} moderate and ${minor.length} minor accessibility violation(s) detected.`,
    );
    for (const v of [...moderate, ...minor]) {
      // eslint-disable-next-line no-console
      console.warn(
        `[axe-helper]   [${v.impact}] ${v.id}: ${v.help} (${v.nodes} node(s)) -> ${v.helpUrl}`,
      );
    }
  }

  if (critical.length > 0 || serious.length > 0) {
    const details = [...critical, ...serious]
      .map(
        (v) =>
          `  [${v.impact}] ${v.id}: ${v.help} (${v.nodes} node(s))\n    ${v.helpUrl}\n    targets: ${v.targets.join(', ')}`,
      )
      .join('\n');

    const message = `[axe-helper] ${context}: ${critical.length} critical and ${serious.length} serious accessibility violation(s) detected:\n${details}`;

    if (testInfo) {
      testInfo.attach('axe-violations', {
        body: JSON.stringify(violations, null, 2),
        contentType: 'application/json',
      });
    }

    throw new Error(message);
  }

  return violations;
}

export default runAxeScan;