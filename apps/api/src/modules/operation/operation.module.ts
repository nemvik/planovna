import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { OperationService } from './operation.service';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: OperationService,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new OperationService(prisma),
    },
  ],
  exports: [OperationService],
})
export class OperationModule {}
