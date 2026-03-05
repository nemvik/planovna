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
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { CreateInvoiceSchema, MarkPaidSchema } from './dto/invoice.dto';
import type { CreateInvoiceDto, MarkPaidDto } from './dto/invoice.dto';
import { InvoiceService } from './invoice.service';

@Controller('invoices')
export class InvoiceController {
  constructor(private readonly service: InvoiceService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'FINANCE')
  @Post('issue')
  issue(@Req() request: AuthenticatedRequest, @Body() body: CreateInvoiceDto) {
    const input = CreateInvoiceSchema.parse(body);
    return this.service.issue(request.auth.tenantId, input);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'FINANCE')
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
