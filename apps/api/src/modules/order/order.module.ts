import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderService } from './order.service';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: OrderService,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new OrderService(prisma),
    },
  ],
  exports: [OrderService],
})
export class OrderModule {}
