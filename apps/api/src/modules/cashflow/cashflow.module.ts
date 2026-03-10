import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { CashflowService } from './cashflow.service';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: CashflowService,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new CashflowService(prisma),
    },
  ],
  exports: [CashflowService],
})
export class CashflowModule {}
