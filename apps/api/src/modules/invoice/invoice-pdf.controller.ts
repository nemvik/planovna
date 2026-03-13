import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../../common/auth.guard';
import type { AuthenticatedRequest } from '../../common/auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { InvoiceService } from './invoice.service';

@Controller('invoices')
export class InvoicePdfController {
  constructor(private readonly service: InvoiceService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'FINANCE')
  @Get(':invoiceId/pdf')
  async downloadPdf(
    @Req() request: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const exported = await this.service.exportPdf(request.auth.tenantId, invoiceId);
    if (!exported) {
      throw new NotFoundException('Invoice not found');
    }

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${exported.fileName}"`,
    );

    return new StreamableFile(exported.content);
  }
}
