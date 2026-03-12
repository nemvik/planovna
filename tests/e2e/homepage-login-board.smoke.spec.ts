import { expect, test } from '@playwright/test';

test('logs in from the homepage and renders the first board bucket', async ({ page }) => {
  let loginRequestCount = 0;
  let boardLoadRequestCount = 0;

  await page.route('**/trpc/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.includes('auth.login')) {
      loginRequestCount += 1;

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { accessToken: 'token-owner' } } }]),
      });
      return;
    }

    if (url.pathname.includes('operation.list')) {
      boardLoadRequestCount += 1;
      await expect(request.headerValue('authorization')).resolves.toBe('Bearer token-owner');

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            result: {
              data: [
                {
                  id: 'op-100',
                  tenantId: 'tenant-a',
                  orderId: 'order-100',
                  code: 'OP-100',
                  title: 'Existing board item',
                  status: 'READY',
                  startDate: '2026-03-12T00:00:00.000Z',
                  sortIndex: 10,
                  version: 1,
                  dependencyCount: 0,
                },
              ],
            },
          },
        ]),
      });
      return;
    }

    await route.abort();
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Planovna operations board' })).toBeVisible();
  await page.getByLabel('Email').fill('owner@tenant-a.local');
  await page.getByLabel('Password').fill('tenant-a-pass');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByText('Logged in')).toBeVisible();
  await expect(page.getByRole('region', { name: '2026-03-12' })).toContainText(
    'OP-100 — Existing board item',
  );
  await expect(page.evaluate(() => window.localStorage.getItem('planovna.homepage.accessToken'))).resolves.toBe(
    'token-owner',
  );

  expect(loginRequestCount).toBe(1);
  expect(boardLoadRequestCount).toBe(1);

  await page.reload();

  await expect(page.getByText('Logged in')).toBeVisible();
  await expect(page.getByRole('region', { name: '2026-03-12' })).toContainText(
    'OP-100 — Existing board item',
  );

  expect(loginRequestCount).toBe(1);
  expect(boardLoadRequestCount).toBe(2);
});
