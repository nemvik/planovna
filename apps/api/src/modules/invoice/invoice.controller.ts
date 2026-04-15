import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../../common/auth.guard';
import type { AuthenticatedRequest } from '../../common/auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { MarkPaidSchema } from './dto/invoice.dto';
import type { MarkPaidDto } from './dto/invoice.dto';
import { InvoiceService } from './invoice.service';

const issueInvoiceSchema = z.object({
  orderId: z.string().min(1),
  number: z.string().min(1),
  currency: z.enum(['CZK', 'EUR']),
  amountNet: z.number().positive(),
  vatRatePercent: z.number().min(0).max(100),
  issuedAt: z.string().datetime().optional(),
  dueAt: z.string().datetime().optional(),
});

type CreateInvoiceDto = z.infer<typeof issueInvoiceSchema>;

@Controller('invoices')
export class InvoiceController {
  constructor(private readonly service: InvoiceService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'FINANCE')
  @Post('issue')
  issue(@Req() request: AuthenticatedRequest, @Body() body: CreateInvoiceDto) {
    const input = issueInvoiceSchema.parse(body);
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
