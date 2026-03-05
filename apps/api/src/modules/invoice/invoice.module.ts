import { Module } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { AuthModule } from '../auth/auth.module';
import { CashflowModule } from '../cashflow/cashflow.module';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';

@Module({
  imports: [CashflowModule, AuthModule],
  controllers: [InvoiceController],
  providers: [InvoiceService, AuthGuard, RolesGuard],
  exports: [InvoiceService],
})
export class InvoiceModule {}
