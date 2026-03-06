import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createTRPCProxyClient, httpBatchLink, TRPCClientError } from '@trpc/client';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { CustomerService } from '../src/modules/customer/customer.service';
import { InvoiceService } from '../src/modules/invoice/invoice.service';
import { OrderService } from '../src/modules/order/order.service';
import { createTrpcContext } from '../src/trpc/context';
import { createAppRouter, type AppRouter } from '../src/trpc/routers/app.router';

describe('tRPC auth + customer (e2e)', () => {
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
    const appRouter = createAppRouter(
      authService,
      customerService,
      invoiceService,
      orderService,
    );

    app.use(
      '/trpc',
      createExpressMiddleware({
        router: appRouter,
        createContext: ({ req }) =>
          createTrpcContext({ req, authService }),
      }),
    );

    await app.init();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns token on valid login and rejects invalid credentials', async () => {
    const trpc = createTRPCProxyClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${baseUrl}/trpc`,
        }),
      ],
    });

    const valid = await trpc.auth.login.mutate({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });

    expect(valid.tokenType).toBe('Bearer');
    expect(valid.accessToken).toBeTruthy();

    await expect(
      trpc.auth.login.mutate({
        email: 'owner@tenant-a.local',
        password: 'wrong-pass',
      }),
    ).rejects.toBeInstanceOf(TRPCClientError);
  });

  it('requires auth for customer.list and resolves tenant from token only', async () => {
    const loginClient = createTRPCProxyClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${baseUrl}/trpc`,
        }),
      ],
    });

    const tenantA = await loginClient.auth.login.mutate({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });

    const tenantB = await loginClient.auth.login.mutate({
      email: 'owner@tenant-b.local',
      password: 'tenant-b-pass',
    });

    const tenantAClient = createTRPCProxyClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${baseUrl}/trpc`,
          headers: {
            authorization: `Bearer ${tenantA.accessToken}`,
          },
        }),
      ],
    });

    const tenantBClient = createTRPCProxyClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${baseUrl}/trpc`,
          headers: {
            authorization: `Bearer ${tenantB.accessToken}`,
          },
        }),
      ],
    });

    await expect(loginClient.customer.list.query()).rejects.toBeInstanceOf(
      TRPCClientError,
    );

    const createdByTenantA = await tenantAClient.customer.create.mutate({
      name: 'Tenant A customer',
      email: 'a@example.com',
    });

    const createdByTenantB = await tenantBClient.customer.create.mutate({
      name: 'Tenant B customer',
      email: 'b@example.com',
    });

    expect(createdByTenantA.tenantId).toBe('tenant-a');
    expect(createdByTenantB.tenantId).toBe('tenant-b');

    const listA = await tenantAClient.customer.list.query();
    const listB = await tenantBClient.customer.list.query();

    expect(listA.every((customer) => customer.tenantId === 'tenant-a')).toBe(
      true,
    );
    expect(listB.every((customer) => customer.tenantId === 'tenant-b')).toBe(
      true,
    );
  });
});
