import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { CashflowModule } from '../cashflow/cashflow.module';
import { CashflowService } from '../cashflow/cashflow.service';
import { InvoicePdfController } from './invoice-pdf.controller';
import { InvoiceService } from './invoice.service';

@Module({
  imports: [PrismaModule, CashflowModule, AuthModule],
  controllers: [InvoicePdfController],
  providers: [
    {
      provide: InvoiceService,
      inject: [CashflowService, PrismaService],
      useFactory: (cashflow: CashflowService, prisma: PrismaService) =>
        new InvoiceService(cashflow, prisma),
    },
  ],
  exports: [InvoiceService],
})
export class InvoiceModule {}
