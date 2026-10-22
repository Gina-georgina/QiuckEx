import { expect, test } from "@playwright/test";
import runAxeScan from "../tests/e2e/axe-helper";

const paymentStatus = {
  state: "PAID",
  username: "axe-audit",
  amount: "1.00",
  asset: "XLM",
  memo: null,
  destinationPublicKey: "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
  expiresAt: null,
  transactionHash: "test-transaction-hash",
  paidAt: "2026-01-01T00:00:00.000Z",
  acceptsMultipleAssets: false,
  acceptedAssets: ["XLM"],
  userMessage: "Payment completed successfully.",
  availableActions: ["view_transaction"],
};

test.describe("Accessibility audit @axe", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await page.route("http://127.0.0.1:4001/**", async (route) => {
      const url = new URL(route.request().url());

      if (url.pathname === "/payment-links/status") {
        await route.fulfill({ json: paymentStatus });
        return;
      }

      if (url.pathname === "/username/axe-audit") {
        await route.fulfill({
          json: {
            username: "axe-audit",
            publicKey: "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
            isPublic: true,
          },
        });
        return;
      }

      await route.fulfill({ status: 503, json: { message: "API unavailable in accessibility audit" } });
    });
  });

  test("landing page has no serious or critical WCAG 2.1 AA violations", async ({ page }, testInfo) => {
    await page.goto("/");
    const violations = await runAxeScan(page, testInfo, {
      context: "landing page",
      tags: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    });
    expect(violations.filter((item) => ["critical", "serious"].includes(item.impact ?? ""))).toEqual([]);
  });

  test("dashboard has no serious or critical WCAG 2.1 AA violations", async ({ page }, testInfo) => {
    await page.goto("/dashboard");
    const violations = await runAxeScan(page, testInfo, {
      context: "dashboard",
      tags: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    });
    expect(violations.filter((item) => ["critical", "serious"].includes(item.impact ?? ""))).toEqual([]);
  });

  test("link generator has no serious or critical WCAG 2.1 AA violations", async ({ page }, testInfo) => {
    await page.goto("/generator");
    const violations = await runAxeScan(page, testInfo, {
      context: "link generator",
      tags: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    });
    expect(violations.filter((item) => ["critical", "serious"].includes(item.impact ?? ""))).toEqual([]);
  });

  test("payment confirmation has no serious or critical WCAG 2.1 AA violations", async ({ page }, testInfo) => {
    await page.goto("/pay?username=axe-audit&amount=1");
    await expect(page.getByRole("heading", { name: "Payment Complete!" })).toBeVisible();
    const violations = await runAxeScan(page, testInfo, {
      context: "payment confirmation",
      tags: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    });
    expect(violations.filter((item) => ["critical", "serious"].includes(item.impact ?? ""))).toEqual([]);
  });

  test("QR page has no serious or critical WCAG 2.1 AA violations", async ({ page }, testInfo) => {
    await page.goto("/axe-audit");
    await expect(page.getByRole("main")).toBeVisible();
    const violations = await runAxeScan(page, testInfo, {
      context: "QR page",
      tags: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    });
    expect(violations.filter((item) => ["critical", "serious"].includes(item.impact ?? ""))).toEqual([]);
  });
});