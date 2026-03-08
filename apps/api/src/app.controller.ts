import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AppService } from './app.service';
import type { LivenessResponse, ReadinessResponse } from './app.service';

@Controller('health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('ready')
  async getReadiness(@Res({ passthrough: true }) response: Response): Promise<ReadinessResponse> {
    const readiness = await this.appService.getReadiness();

    if (readiness.status === 'not_ready') {
      response.status(503);
    }

    return readiness;
  }

  @Get()
  getHealth(): LivenessResponse {
    return this.appService.getHealth();
  }
}
