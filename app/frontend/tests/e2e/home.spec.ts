import { test, expect } from '@playwright/test';
import { checkA11y } from './utils/axe-helper';

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('has no accessibility violations', async ({ page }) => {
    await checkA11y(page);
  });

  test('displays the main heading', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('has a navigation landmark', async ({ page }) => {
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('has a main landmark', async ({ page }) => {
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('has a footer landmark', async ({ page }) => {
    await expect(page.getByRole('contentinfo')).toBeVisible();
  });
});