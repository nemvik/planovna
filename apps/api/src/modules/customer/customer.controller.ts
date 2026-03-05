import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import {
  CreateCustomerDto,
  CreateCustomerSchema,
  UpdateCustomerDto,
  UpdateCustomerSchema,
} from './dto/customer.dto';
import { CustomerService } from './customer.service';

@Controller('customers')
export class CustomerController {
  constructor(private readonly service: CustomerService) {}

  @Post()
  create(@Body() body: CreateCustomerDto) {
    return this.service.create(CreateCustomerSchema.parse(body));
  }

  @Get(':tenantId')
  list(@Param('tenantId') tenantId: string) {
    return this.service.list(tenantId);
  }

  @Put()
  update(@Body() body: UpdateCustomerDto) {
    return this.service.update(UpdateCustomerSchema.parse(body));
  }
}
