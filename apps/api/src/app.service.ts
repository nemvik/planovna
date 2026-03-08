import { Injectable } from '@nestjs/common';
import { Socket } from 'node:net';

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
    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (!databaseUrl) {
      return {
        status: 'down',
        code: 'DATABASE_URL_MISSING',
        reason: 'database configuration missing',
      };
    }

    try {
      const { hostname, port } = new URL(databaseUrl);
      await this.assertTcpReachable(hostname, Number(port || 5432));

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

  private assertTcpReachable(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      const cleanup = () => socket.removeAllListeners();

      socket.setTimeout(1000);

      socket.once('connect', () => {
        cleanup();
        socket.end();
        socket.destroy();
        resolve();
      });

      socket.once('timeout', () => {
        cleanup();
        socket.destroy();
        reject(new Error('timeout'));
      });

      socket.once('error', (error) => {
        cleanup();
        socket.destroy();
        reject(error);
      });

      socket.connect(port, host);
    });
  }
}
