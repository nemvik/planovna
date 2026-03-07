import { Injectable } from '@nestjs/common';

export type ReadinessResponse = {
  status: 'ready';
  service: 'api';
};

@Injectable()
export class AppService {
  getReadiness(): ReadinessResponse {
    return {
      status: 'ready',
      service: 'api',
    };
  }
}
