import { test, expect } from '@playwright/test';

test.describe('Payment landing page', () => {
  test('renders headline, wallet CTAs, trust signals, and explainer modal for a valid amount', async ({
    page,
  }) => {
    await page.route('**/api/payment/landing**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          amount: '25.00',
          currency: 'USD',
          recipient: 'Acme Supplies',
          scamAlert: false,
        }),
      });
    });

    await page.goto('/pay?amount=25.00&currency=USD&recipient=Acme%20Supplies');

    // Headline
    await expect(
      page.getByRole('heading', { name: /pay acme supplies/i })
    ).toBeVisible();
    await expect(page.getByText(/\$25\.00/)).toBeVisible();

    // Wallet CTAs
    await expect(
      page.getByRole('button', { name: /connect wallet/i })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /pay with card/i })
    ).toBeVisible();

    // Trust signals
    await expect(page.getByText(/secure/i)).toBeVisible();
    await expect(page.getByText(/non-custodial/i)).toBeVisible();

    // Explainer modal
    await page.getByRole('button', { name: /how it works/i }).click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/how it works/i)).toBeVisible();
    await expect(modal.getByText(/step 1/i)).toBeVisible();
    await page.getByRole('button', { name: /close/i }).click();
    await expect(modal).toBeHidden();
  });

  test('shows an error/fallback when the amount parameter is missing', async ({
    page,
  }) => {
    await page.route('**/api/payment/landing**', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Missing amount parameter' }),
      });
    });

    await page.goto('/pay');

    await expect(
      page.getByRole('heading', { name: /invalid|missing|error/i })
    ).toBeVisible();
    await expect(
      page.getByText(/amount is required|missing amount/i)
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /connect wallet/i })
    ).toBeHidden();
  });

  test('renders the scam alert banner when the backend signals a scam', async ({
    page,
  }) => {
    await page.route('**/api/payment/landing**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          amount: '25.00',
          currency: 'USD',
          recipient: 'Acme Supplies',
          scamAlert: true,
          scamReason: 'This address has been reported for fraud.',
        }),
      });
    });

    await page.goto('/pay?amount=25.00&currency=USD&recipient=Acme%20Supplies');

    const banner = page.getByRole('alert');
    await expect(banner).toBeVisible();
    await expect(banner.getByText(/scam|fraud|reported/i)).toBeVisible();
    await expect(
      banner.getByText(/this address has been reported for fraud/i)
    ).toBeVisible();
  });
});