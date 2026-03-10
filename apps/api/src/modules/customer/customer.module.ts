import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomerService } from './customer.service';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: CustomerService,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new CustomerService(prisma),
    },
  ],
  exports: [CustomerService],
})
export class CustomerModule {}
