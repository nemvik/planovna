import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

export type LivenessResponse = {
  status: 'ready';
  service: 'api';
};

export type DatabaseReadyDependency = {
  status: 'up';
};

export type DatabaseNotReadyDependency = {
  status: 'down';
  code: 'DATABASE_URL_MISSING' | 'DATABASE_UNAVAILABLE';
  reason: 'database configuration missing' | 'database unreachable';
};

export type ReadinessResponse =
  | {
      status: 'ready';
      service: 'api';
      dependencies: {
        database: DatabaseReadyDependency;
      };
    }
  | {
      status: 'not_ready';
      service: 'api';
      dependencies: {
        database: DatabaseNotReadyDependency;
      };
    };

@Injectable()
export class AppService {
  constructor(private readonly prismaService: PrismaService) {}

  getHealth(): LivenessResponse {
    return {
      status: 'ready',
      service: 'api',
    };
  }

  async getReadiness(): Promise<ReadinessResponse> {
    const database = await this.getDatabaseDependencyStatus();

    if (database.status === 'down') {
      return {
        status: 'not_ready',
        service: 'api',
        dependencies: {
          database,
        },
      };
    }

    return {
      status: 'ready',
      service: 'api',
      dependencies: {
        database,
      },
    };
  }

  private async getDatabaseDependencyStatus(): Promise<
    DatabaseReadyDependency | DatabaseNotReadyDependency
  > {
    if (!process.env.DATABASE_URL?.trim()) {
      return {
        status: 'down',
        code: 'DATABASE_URL_MISSING',
        reason: 'database configuration missing',
      };
    }

    try {
      await this.prismaService.isReady();

      return {
        status: 'up',
      };
    } catch {
      return {
        status: 'down',
        code: 'DATABASE_UNAVAILABLE',
        reason: 'database unreachable',
      };
    }
  }
}
