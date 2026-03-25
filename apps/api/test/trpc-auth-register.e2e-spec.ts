import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { randomUUID } from 'crypto';
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

describe('tRPC auth register durability (e2e)', () => {
  let app: INestApplication<App> | null = null;
  let baseUrl: string;

  const createClient = () =>
    createTRPCProxyClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${baseUrl}/trpc`,
        }),
      ],
    });

  const bootstrapApp = async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const nextApp = moduleFixture.createNestApplication();

    const authService = nextApp.get(AuthService);
    const customerService = nextApp.get(CustomerService);
    const invoiceService = nextApp.get(InvoiceService);
    const orderService = nextApp.get(OrderService);
    const operationService = nextApp.get(OperationService);
    const cashflowService = nextApp.get(CashflowService);
    const appRouter = createAppRouter(
      authService,
      customerService,
      invoiceService,
      orderService,
      operationService,
      cashflowService,
    );

    nextApp.use(
      '/trpc',
      createExpressMiddleware({
        router: appRouter,
        createContext: ({ req }) => createTrpcContext({ req, authService }),
      }),
    );

    await nextApp.init();
    await nextApp.listen(0);
    app = nextApp;
    baseUrl = await nextApp.getUrl();
  };

  const closeApp = async () => {
    if (!app) {
      return;
    }

    await app.close();
    app = null;
  };

  beforeEach(async () => {
    await bootstrapApp();
  });

  afterEach(async () => {
    await closeApp();
  });

  it('registers an owner via tRPC and allows login again after app restart', async () => {
    const trpc = createClient();
    const suffix = randomUUID().slice(0, 8);
    const email = `owner-${suffix}@example.test`;
    const password = `welcome-${suffix}`;

    const registered = await trpc.auth.register.mutate({
      email,
      password,
      companyName: `Foundry ${suffix}`,
    });

    expect(registered.tokenType).toBe('Bearer');
    expect(registered.accessToken).toBeTruthy();

    await closeApp();
    await bootstrapApp();

    const restartedClient = createClient();
    const loggedIn = await restartedClient.auth.login.mutate({
      email,
      password,
    });

    expect(loggedIn.tokenType).toBe('Bearer');
    expect(loggedIn.accessToken).toBeTruthy();
  });
});
