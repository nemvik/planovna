import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import type { ReadinessResponse } from './app.service';

@Controller('health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('ready')
  getReadiness(): ReadinessResponse {
    return this.appService.getReadiness();
  }

  @Get()
  getHealth(): ReadinessResponse {
    return this.getReadiness();
  }
}
