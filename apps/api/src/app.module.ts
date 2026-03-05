import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CustomerModule } from './modules/customer/customer.module';
import { OrderModule } from './modules/order/order.module';
import { OperationModule } from './modules/operation/operation.module';

@Module({
  imports: [CustomerModule, OrderModule, OperationModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
