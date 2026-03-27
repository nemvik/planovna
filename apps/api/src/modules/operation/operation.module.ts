import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { BoardAuditService } from './board-audit.service';
import { OperationService } from './operation.service';

@Module({
  imports: [PrismaModule],
  providers: [
    BoardAuditService,
    {
      provide: OperationService,
      inject: [PrismaService, BoardAuditService],
      useFactory: (prisma: PrismaService, boardAuditService: BoardAuditService) =>
        new OperationService(prisma, boardAuditService),
    },
  ],
  exports: [OperationService, BoardAuditService],
})
export class OperationModule {}
