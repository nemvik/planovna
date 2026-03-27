import { Module } from '@nestjs/common';
import { OperationModule } from '../operation/operation.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { BoardAuditService } from '../operation/board-audit.service';
import { OrderService } from './order.service';

@Module({
  imports: [PrismaModule, OperationModule],
  providers: [
    {
      provide: OrderService,
      inject: [PrismaService, BoardAuditService],
      useFactory: (prisma: PrismaService, boardAuditService: BoardAuditService) =>
        new OrderService(prisma, boardAuditService),
    },
  ],
  exports: [OrderService],
})
export class OrderModule {}
