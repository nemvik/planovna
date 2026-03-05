import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CashflowModule } from './modules/cashflow/cashflow.module';
import { CustomerModule } from './modules/customer/customer.module';
import { AuthModule } from './modules/auth/auth.module';
import { InvoiceModule } from './modules/invoice/invoice.module';
import { OperationModule } from './modules/operation/operation.module';
import { OrderModule } from './modules/order/order.module';

@Module({
  imports: [
    AuthModule,
    CustomerModule,
    OrderModule,
    OperationModule,
    CashflowModule,
    InvoiceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
