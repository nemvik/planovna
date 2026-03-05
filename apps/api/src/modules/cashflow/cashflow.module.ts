import { Module } from '@nestjs/common';
import { CashflowService } from './cashflow.service';

@Module({
  providers: [CashflowService],
  exports: [CashflowService],
})
export class CashflowModule {}
