import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import type { AuthenticatedRequest } from '../../common/auth.guard';
import { CreateInvoiceSchema, MarkPaidSchema } from './dto/invoice.dto';
import type { CreateInvoiceDto, MarkPaidDto } from './dto/invoice.dto';
import { InvoiceService } from './invoice.service';

@Controller('invoices')
export class InvoiceController {
  constructor(private readonly service: InvoiceService) {}

  @Post('issue')
  issue(@Body() body: CreateInvoiceDto) {
    return this.service.issue(CreateInvoiceSchema.parse(body));
  }

  @UseGuards(AuthGuard)
  @Post('paid')
  paid(@Req() request: AuthenticatedRequest, @Body() body: MarkPaidDto) {
    const result = this.service.markPaid(
      request.auth.tenantId,
      MarkPaidSchema.parse(body),
    );
    if (!result) {
      throw new ForbiddenException('Invoice access denied');
    }
    return result;
  }
}
