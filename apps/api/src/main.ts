import { NestFactory } from '@nestjs/core';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { AppModule } from './app.module';
import { AuthService } from './modules/auth/auth.service';
import { CustomerService } from './modules/customer/customer.service';
import { InvoiceService } from './modules/invoice/invoice.service';
import { createTrpcContext } from './trpc/context';
import { createAppRouter } from './trpc/routers/app.router';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const authService = app.get(AuthService);
  const customerService = app.get(CustomerService);
  const invoiceService = app.get(InvoiceService);
  const appRouter = createAppRouter(authService, customerService, invoiceService);

  app.use(
    '/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext: ({ req }) =>
        createTrpcContext({ req, authService }),
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
