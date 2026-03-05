import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { CreateOrderSchema, UpdateOrderSchema } from './dto/order.dto';
import type { CreateOrderDto, UpdateOrderDto } from './dto/order.dto';
import { OrderService } from './order.service';

@Controller('orders')
export class OrderController {
  constructor(private readonly service: OrderService) {}

  @Post()
  create(@Body() body: CreateOrderDto) {
    return this.service.create(CreateOrderSchema.parse(body));
  }

  @Get(':tenantId')
  list(@Param('tenantId') tenantId: string) {
    return this.service.list(tenantId);
  }

  @Put()
  update(@Body() body: UpdateOrderDto) {
    return this.service.update(UpdateOrderSchema.parse(body));
  }
}
