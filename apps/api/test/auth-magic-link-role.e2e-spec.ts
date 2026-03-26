import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { randomUUID } from 'node:crypto';
import { AuthService } from '../src/modules/auth/auth.service';
import { CashflowService } from '../src/modules/cashflow/cashflow.service';
import { CustomerService } from '../src/modules/customer/customer.service';
import { InvoiceService } from '../src/modules/invoice/invoice.service';
import { OperationService } from '../src/modules/operation/operation.service';
import { OrderService } from '../src/modules/order/order.service';
import { createTrpcContext } from '../src/trpc/context';
import { createAppRouter, type AppRouter } from '../src/trpc/routers/app.router';

describe('Auth onboarding + removed REST auth endpoints (e2e)', () => {
  let app: INestApplication<App>;
  let baseUrl: string;

  const createClient = () =>
    createTRPCProxyClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${baseUrl}/trpc`,
        }),
      ],
    });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    const authService = app.get(AuthService);
    const customerService = app.get(CustomerService);
    const invoiceService = app.get(InvoiceService);
    const orderService = app.get(OrderService);
    const operationService = app.get(OperationService);
    const cashflowService = app.get(CashflowService);
    const appRouter = createAppRouter(
      authService,
      customerService,
      invoiceService,
      orderService,
      operationService,
      cashflowService,
    );

    app.use(
      '/trpc',
      createExpressMiddleware({
        router: appRouter,
        createContext: ({ req }) => createTrpcContext({ req, authService }),
      }),
    );

    await app.init();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterEach(async () => {
    await app.close();
  });

  it('registers a tenant-owner via tRPC and rejects duplicate email', async () => {
    const trpc = createClient();
    const payload = {
      email: `founder-${randomUUID().slice(0, 8)}@example.test`,
      password: 'welcome',
      companyName: `Foundry ${randomUUID().slice(0, 8)}`,
    };

    const created = await trpc.auth.register.mutate(payload);

    expect(created.tokenType).toBe('Bearer');
    expect(created.accessToken).toBeTruthy();
    expect(created.expiresAt).toBeTruthy();

    await expect(trpc.auth.register.mutate(payload)).rejects.toMatchObject({
      data: { code: 'CONFLICT' },
    });
  });

  it('rate limits repeated registration attempts from same email/ip identity window', async () => {
    const trpc = createClient();
    const email = `rate-limit-${randomUUID().slice(0, 8)}@example.test`;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const mutation = trpc.auth.register.mutate({
        email,
        password: `welcome-${attempt}`,
        companyName: `Foundry ${randomUUID().slice(0, 8)}`,
      });

      if (attempt === 0) {
        const created = await mutation;
        expect(created.tokenType).toBe('Bearer');
      } else {
        await expect(mutation).rejects.toMatchObject({
          data: { code: 'CONFLICT' },
        });
      }
    }

    await expect(
      trpc.auth.register.mutate({
        email,
        password: 'welcome-final',
        companyName: `Foundry ${randomUUID().slice(0, 8)}`,
      }),
    ).rejects.toMatchObject({
      data: { code: 'TOO_MANY_REQUESTS' },
    });
  });

  it('allows registration attempts again after rate-limit cooldown window elapses', async () => {
    const trpc = createClient();
    const email = `rate-limit-reset-${randomUUID().slice(0, 8)}@example.test`;
    const fixedNow = new Date('2026-03-19T08:04:00.000Z').getTime();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const mutation = trpc.auth.register.mutate({
        email,
        password: `welcome-${attempt}`,
        companyName: `Foundry ${randomUUID().slice(0, 8)}`,
      });

      if (attempt === 0) {
        const created = await mutation;
        expect(created.tokenType).toBe('Bearer');
      } else {
        await expect(mutation).rejects.toMatchObject({
          data: { code: 'CONFLICT' },
        });
      }
    }

    await expect(
      trpc.auth.register.mutate({
        email,
        password: 'welcome-limited',
        companyName: `Foundry ${randomUUID().slice(0, 8)}`,
      }),
    ).rejects.toMatchObject({
      data: { code: 'TOO_MANY_REQUESTS' },
    });

    nowSpy.mockReturnValue(fixedNow + 61_000);

    await expect(
      trpc.auth.register.mutate({
        email,
        password: 'welcome-after-cooldown',
        companyName: `Foundry ${randomUUID().slice(0, 8)}`,
      }),
    ).rejects.toMatchObject({
      data: { code: 'CONFLICT' },
    });
  });

  it('returns 404 on removed auth REST endpoints', async () => {
    const appServer = app.getHttpServer();

    await request(appServer)
      .post('/auth/register')
      .send({ email: 'owner@tenant-a.local', password: 'tenant-a-pass', companyName: 'Tenant A' })
      .expect(404);

    await request(appServer)
      .post('/auth/login')
      .send({ email: 'owner@tenant-a.local', password: 'tenant-a-pass' })
      .expect(404);

    await request(appServer)
      .post('/auth/magic-link/request')
      .send({ email: 'owner@tenant-a.local' })
      .expect(404);

    await request(appServer)
      .post('/auth/magic-link/consume')
      .send({ token: 'any-token' })
      .expect(404);
  });
});
