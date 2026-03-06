import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { CashflowService } from '../src/modules/cashflow/cashflow.service';
import { CustomerService } from '../src/modules/customer/customer.service';
import { InvoiceService } from '../src/modules/invoice/invoice.service';
import { OperationService } from '../src/modules/operation/operation.service';
import { OrderService } from '../src/modules/order/order.service';
import { createTrpcContext } from '../src/trpc/context';
import { createAppRouter, type AppRouter } from '../src/trpc/routers/app.router';

describe('tRPC auth magic-link (e2e)', () => {
  let app: INestApplication<App>;
  let baseUrl: string;

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
    jest.restoreAllMocks();
    await app.close();
  });

  it('returns magic link for known user and UNAUTHORIZED for unknown user', async () => {
    const trpc = createTRPCProxyClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${baseUrl}/trpc`,
        }),
      ],
    });

    const result = await trpc.auth.requestMagicLink.mutate({
      email: 'owner@tenant-a.local',
    });

    expect(result.token).toBeTruthy();
    expect(result.expiresAt).toBeTruthy();

    await expect(
      trpc.auth.requestMagicLink.mutate({
        email: 'unknown@tenant-a.local',
      }),
    ).rejects.toMatchObject({
      data: { code: 'UNAUTHORIZED' },
    });
  });

  it('consumes a valid token once and rejects reuse', async () => {
    const trpc = createTRPCProxyClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${baseUrl}/trpc`,
        }),
      ],
    });

    const request = await trpc.auth.requestMagicLink.mutate({
      email: 'owner@tenant-a.local',
    });

    const firstConsume = await trpc.auth.consumeMagicLink.mutate({
      token: request.token,
    });

    expect(firstConsume.tokenType).toBe('Bearer');
    expect(firstConsume.accessToken).toBeTruthy();

    await expect(
      trpc.auth.consumeMagicLink.mutate({
        token: request.token,
      }),
    ).rejects.toMatchObject({
      data: { code: 'UNAUTHORIZED' },
    });
  });

  it('rejects invalid and expired magic link tokens', async () => {
    const trpc = createTRPCProxyClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${baseUrl}/trpc`,
        }),
      ],
    });

    await expect(
      trpc.auth.consumeMagicLink.mutate({
        token: 'not-a-real-token',
      }),
    ).rejects.toMatchObject({
      data: { code: 'UNAUTHORIZED' },
    });

    const fixedNow = new Date('2026-03-06T00:00:00.000Z').getTime();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

    const request = await trpc.auth.requestMagicLink.mutate({
      email: 'owner@tenant-a.local',
    });

    nowSpy.mockReturnValue(fixedNow + 16 * 60 * 1000);

    await expect(
      trpc.auth.consumeMagicLink.mutate({
        token: request.token,
      }),
    ).rejects.toMatchObject({
      data: { code: 'UNAUTHORIZED' },
    });
  });
});
