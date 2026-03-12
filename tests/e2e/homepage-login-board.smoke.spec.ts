import { expect, test } from '@playwright/test';

test('logs in from the homepage and renders the first board bucket', async ({ page }) => {
  let loginRequestCount = 0;
  let boardLoadRequestCount = 0;
  let operationUpdateRequestCount = 0;
  let boardOperation = {
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
  };

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
              data: [boardOperation],
            },
          },
        ]),
      });
      return;
    }

    if (url.pathname.includes('operation.update')) {
      operationUpdateRequestCount += 1;
      await expect(request.headerValue('authorization')).resolves.toBe('Bearer token-owner');

      const requestBody = request.postData() ?? '';
      expect(requestBody).toContain('op-100');
      expect(requestBody).toContain('tenant-a');
      expect(requestBody).toContain('Existing board item renamed');

      boardOperation = {
        ...boardOperation,
        title: 'Existing board item renamed',
        version: 2,
      };

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: boardOperation } }]),
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

  const firstBoardBucket = page.getByRole('region', { name: '2026-03-12' });
  await firstBoardBucket.getByLabel('Title').fill('Existing board item renamed');
  await firstBoardBucket.getByRole('button', { name: 'Save title' }).click();

  await expect(firstBoardBucket).toContainText('OP-100 — Existing board item renamed');

  expect(loginRequestCount).toBe(1);
  expect(boardLoadRequestCount).toBe(1);
  expect(operationUpdateRequestCount).toBe(1);

  await page.reload();

  await expect(page.getByText('Logged in')).toBeVisible();
  await expect(page.getByRole('region', { name: '2026-03-12' })).toContainText(
    'OP-100 — Existing board item renamed',
  );

  expect(loginRequestCount).toBe(1);
  expect(boardLoadRequestCount).toBe(2);
  expect(operationUpdateRequestCount).toBe(1);
});

test.describe('mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('logs in from the homepage and keeps the board usable in a narrow viewport', async ({ page }) => {
    let loginRequestCount = 0;
    let boardLoadRequestCount = 0;
    let operationUpdateRequestCount = 0;
    let boardOperation = {
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
    };

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
                data: [boardOperation],
              },
            },
          ]),
        });
        return;
      }

      if (url.pathname.includes('operation.update')) {
        operationUpdateRequestCount += 1;
        await expect(request.headerValue('authorization')).resolves.toBe('Bearer token-owner');

        const requestBody = request.postData() ?? '';
        expect(requestBody).toContain('op-100');
        expect(requestBody).toContain('tenant-a');
        expect(requestBody).toContain('Existing board item renamed on mobile');

        boardOperation = {
          ...boardOperation,
          title: 'Existing board item renamed on mobile',
          version: 2,
        };

        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify([{ result: { data: boardOperation } }]),
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

    const firstBoardBucket = page.getByRole('region', { name: '2026-03-12' });
    const titleInput = firstBoardBucket.getByLabel('Title');
    const saveTitleButton = firstBoardBucket.getByRole('button', { name: 'Save title' });

    await expect(page.getByText('Logged in')).toBeVisible();
    await expect(page.getByLabel('Code or title')).toBeVisible();
    await expect(firstBoardBucket).toBeVisible();
    await expect(firstBoardBucket).toContainText('OP-100 — Existing board item');
    await expect(titleInput).toBeVisible();
    await expect(saveTitleButton).toBeVisible();
    await expect(
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).resolves.toBe(true);

    await titleInput.fill('Existing board item renamed on mobile');
    await saveTitleButton.click();

    await expect(firstBoardBucket).toContainText('OP-100 — Existing board item renamed on mobile');

    expect(loginRequestCount).toBe(1);
    expect(boardLoadRequestCount).toBe(1);
    expect(operationUpdateRequestCount).toBe(1);
  });
});

test('logs in from the homepage and shows the empty board state when no operations exist', async ({ page }) => {
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
              data: [],
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
  await expect(page.getByText('No operations found.')).toBeVisible();
  await expect(page.evaluate(() => window.localStorage.getItem('planovna.homepage.accessToken'))).resolves.toBe(
    'token-owner',
  );

  expect(loginRequestCount).toBe(1);
  expect(boardLoadRequestCount).toBe(1);
});

test('logs in from the homepage and shows the board loading state while operations are still loading', async ({ page }) => {
  let loginRequestCount = 0;
  let boardLoadRequestCount = 0;
  let releaseBoardLoad: (() => void) | null = null;
  let notifyBoardLoadStarted: (() => void) | null = null;

  const boardLoadPending = new Promise<void>((resolve) => {
    releaseBoardLoad = resolve;
  });
  const boardLoadStarted = new Promise<void>((resolve) => {
    notifyBoardLoadStarted = resolve;
  });

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
      notifyBoardLoadStarted?.();
      await expect(request.headerValue('authorization')).resolves.toBe('Bearer token-owner');
      await boardLoadPending;

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

  await boardLoadStarted;

  await expect(page.getByText('Logged in')).toBeVisible();
  await expect(page.getByText('Loading operations…').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Loading operations…' })).toBeDisabled();
  await expect(page.evaluate(() => window.localStorage.getItem('planovna.homepage.accessToken'))).resolves.toBe(
    'token-owner',
  );

  releaseBoardLoad?.();

  await expect(page.getByRole('region', { name: '2026-03-12' })).toContainText(
    'OP-100 — Existing board item',
  );

  expect(loginRequestCount).toBe(1);
  expect(boardLoadRequestCount).toBe(1);
});

test('logs in from the homepage and shows the board error state when operations fail to load', async ({ page }) => {
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
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            error: {
              message: 'boom',
              code: -32603,
              data: {
                code: 'INTERNAL_SERVER_ERROR',
                httpStatus: 500,
                path: 'operation.list',
              },
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
  await expect(page.getByText('Failed to load operations.')).toBeVisible();
  await expect(page.evaluate(() => window.localStorage.getItem('planovna.homepage.accessToken'))).resolves.toBe(
    'token-owner',
  );

  expect(loginRequestCount).toBe(1);
  expect(boardLoadRequestCount).toBe(1);
});
