import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import {
  CreateOperationDto,
  CreateOperationSchema,
  UpdateOperationDto,
  UpdateOperationSchema,
} from './dto/operation.dto';
import { OperationService } from './operation.service';

@Controller('operations')
export class OperationController {
  constructor(private readonly service: OperationService) {}

  @Post()
  create(@Body() body: CreateOperationDto) {
    return this.service.create(CreateOperationSchema.parse(body));
  }

  @Get(':tenantId')
  list(@Param('tenantId') tenantId: string) {
    return this.service.list(tenantId);
  }

  @Put()
  update(@Body() body: UpdateOperationDto) {
    return this.service.update(UpdateOperationSchema.parse(body));
  }
}
