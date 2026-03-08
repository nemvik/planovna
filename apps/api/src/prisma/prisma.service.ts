import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async isReady(): Promise<boolean> {
    await this.$queryRawUnsafe('SELECT 1');
    return true;
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
