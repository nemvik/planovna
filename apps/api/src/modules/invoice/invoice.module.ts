import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CashflowModule } from '../cashflow/cashflow.module';
import { InvoiceService } from './invoice.service';

@Module({
  imports: [CashflowModule, AuthModule],
  providers: [InvoiceService],
  exports: [InvoiceService],
})
export class InvoiceModule {}
