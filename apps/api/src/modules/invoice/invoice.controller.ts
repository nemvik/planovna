import { Body, Controller, Post } from '@nestjs/common';
import {
  CreateInvoiceDto,
  CreateInvoiceSchema,
  MarkPaidDto,
  MarkPaidSchema,
} from './dto/invoice.dto';
import { InvoiceService } from './invoice.service';

@Controller('invoices')
export class InvoiceController {
  constructor(private readonly service: InvoiceService) {}

  @Post('issue')
  issue(@Body() body: CreateInvoiceDto) {
    return this.service.issue(CreateInvoiceSchema.parse(body));
  }

  @Post('paid')
  paid(@Body() body: MarkPaidDto) {
    return this.service.markPaid(MarkPaidSchema.parse(body));
  }
}
