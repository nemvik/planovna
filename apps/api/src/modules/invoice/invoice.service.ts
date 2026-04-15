import { Injectable } from '@nestjs/common';
import { assertVersion } from '../../common/optimistic-lock/assert-version';
import { PrismaService } from '../../prisma/prisma.service';
import { CashflowService } from '../cashflow/cashflow.service';
import { CreateInvoiceDto, MarkPaidDto } from './dto/invoice.dto';

type Invoice = CreateInvoiceDto & {
  id: string;
  tenantId: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID';
  amountVat: number;
  amountGross: number;
  hasBreakdown: boolean;
  paidAt?: string;
  pdfPath: string;
  version: number;
};

type InvoicePdfExport = {
  fileName: string;
  content: Buffer;
};

type PrismaInvoiceRow = {
  id: string;
  tenantId: string;
  orderId: string;
  number: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID';
  currency: string;
  amountNet: {
    toNumber(): number;
  };
  amountVat: {
    toNumber(): number;
  };
  amountGross: {
    toNumber(): number;
  };
  issuedAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  version: number;
};

@Injectable()
export class InvoiceService {
  constructor(
    private readonly cashflow: CashflowService,
    private readonly prisma: PrismaService,
  ) {}

  async list(actorTenantId: string) {
    const persisted = await this.prisma.invoice.findMany({
      where: { tenantId: actorTenantId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        tenantId: true,
        orderId: true,
        number: true,
        status: true,
        currency: true,
        amountNet: true,
        amountVat: true,
        amountGross: true,
        issuedAt: true,
        dueAt: true,
        paidAt: true,
        version: true,
      },
    });

    return persisted.map((invoice) => this.toInvoiceRecord(invoice));
  }

  async issue(actorTenantId: string, input: CreateInvoiceDto) {
    const computed = this.computeInvoiceBreakdown(input.amountNet, input.vatRatePercent);
    const created = await this.prisma.invoice.create({
      data: {
        tenantId: actorTenantId,
        orderId: input.orderId,
        number: input.number,
        status: 'ISSUED',
        currency: input.currency,
        amountNet: computed.amountNet,
        amountVat: computed.amountVat,
        amountGross: computed.amountGross,
        issuedAt: input.issuedAt,
        dueAt: input.dueAt,
      },
      select: {
        id: true,
        tenantId: true,
        orderId: true,
        number: true,
        status: true,
        currency: true,
        amountNet: true,
        amountVat: true,
        amountGross: true,
        issuedAt: true,
        dueAt: true,
        paidAt: true,
        version: true,
      },
    });

    const row = this.toInvoiceRecord(created);

    await this.cashflow.upsertPlannedIn({
      tenantId: row.tenantId,
      invoiceId: row.id,
      amount: row.amountGross,
      currency: row.currency,
      date: row.dueAt ?? row.issuedAt ?? new Date().toISOString(),
    });

    return row;
  }

  async markPaid(actorTenantId: string, input: MarkPaidDto) {
    const existing = await this.prisma.invoice.findUnique({
      where: { id: input.invoiceId },
      select: {
        id: true,
        tenantId: true,
        version: true,
      },
    });

    if (!existing || existing.tenantId !== actorTenantId) {
      return null;
    }

    assertVersion('Invoice', existing.id, input.version, existing.version);

    const updated = await this.prisma.invoice.updateMany({
      where: {
        id: existing.id,
        tenantId: existing.tenantId,
        version: existing.version,
      },
      data: {
        status: 'PAID',
        paidAt: input.paidAt,
        version: {
          increment: 1,
        },
      },
    });

    if (updated.count === 0) {
      const latest = await this.prisma.invoice.findUnique({
        where: { id: input.invoiceId },
        select: {
          id: true,
          tenantId: true,
          version: true,
        },
      });

      if (!latest || latest.tenantId !== actorTenantId) {
        return null;
      }

      assertVersion('Invoice', latest.id, input.version, latest.version);
    }

    const row = await this.prisma.invoice.findUnique({
      where: { id: input.invoiceId },
      select: {
        id: true,
        tenantId: true,
        orderId: true,
        number: true,
        status: true,
        currency: true,
        amountNet: true,
        amountVat: true,
        amountGross: true,
        issuedAt: true,
        dueAt: true,
        paidAt: true,
        version: true,
      },
    });

    if (!row) {
      return null;
    }

    const next = this.toInvoiceRecord(row);

    await this.cashflow.upsertActualIn({
      tenantId: next.tenantId,
      invoiceId: next.id,
      amount: next.amountGross,
      currency: next.currency,
      date: next.paidAt ?? input.paidAt,
    });

    return next;
  }

  async exportPdf(
    actorTenantId: string,
    invoiceId: string,
  ): Promise<InvoicePdfExport | null> {
    const row = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        tenantId: true,
        orderId: true,
        number: true,
        status: true,
        currency: true,
        amountNet: true,
        amountVat: true,
        amountGross: true,
        issuedAt: true,
        dueAt: true,
        paidAt: true,
        version: true,
      },
    });

    if (!row || row.tenantId !== actorTenantId) {
      return null;
    }

    const invoice = this.toInvoiceRecord(row);

    return {
      fileName: `invoice-${this.toSafeFileToken(invoice.number)}.pdf`,
      content: this.buildInvoicePdf(invoice),
    };
  }

  private toInvoiceRecord(row: PrismaInvoiceRow): Invoice {
    const amountNet = row.amountNet.toNumber();
    const amountVat = row.amountVat.toNumber();
    const amountGross = row.amountGross.toNumber();
    const hasBreakdown = amountNet > 0 || amountVat > 0;
    const effectiveAmountNet = hasBreakdown ? amountNet : amountGross;
    const effectiveAmountVat = hasBreakdown ? amountVat : 0;
    const vatRatePercent = effectiveAmountNet > 0 ? (effectiveAmountVat / effectiveAmountNet) * 100 : 0;

    return {
      id: row.id,
      tenantId: row.tenantId,
      orderId: row.orderId,
      number: row.number,
      status: row.status,
      currency: row.currency as 'CZK' | 'EUR',
      amountNet: Number(effectiveAmountNet.toFixed(2)),
      amountVat: Number(effectiveAmountVat.toFixed(2)),
      amountGross: Number(amountGross.toFixed(2)),
      vatRatePercent: Number(vatRatePercent.toFixed(2)),
      hasBreakdown,
      issuedAt: row.issuedAt?.toISOString(),
      dueAt: row.dueAt?.toISOString(),
      paidAt: row.paidAt?.toISOString(),
      pdfPath: this.toInvoicePdfPath(row.id),
      version: row.version,
    };
  }

  private toInvoicePdfPath(invoiceId: string): string {
    return `/invoices/${encodeURIComponent(invoiceId)}/pdf`;
  }

  private computeInvoiceBreakdown(amountNet: number, vatRatePercent: number) {
    const roundedNet = Number(amountNet.toFixed(2));
    const roundedVatRatePercent = Number(vatRatePercent.toFixed(2));
    const amountVat = Number(((roundedNet * roundedVatRatePercent) / 100).toFixed(2));
    const amountGross = Number((roundedNet + amountVat).toFixed(2));

    return {
      amountNet: roundedNet,
      vatRatePercent: roundedVatRatePercent,
      amountVat,
      amountGross,
    };
  }

  private buildInvoicePdf(invoice: Invoice): Buffer {
    const lines = [
      `Invoice ${invoice.number}`,
      `Status: ${invoice.status}`,
      `Order: ${invoice.orderId}`,
      `Amount net: ${invoice.amountNet.toFixed(2)} ${invoice.currency}`,
      `VAT ${invoice.vatRatePercent.toFixed(2)}%: ${invoice.amountVat.toFixed(2)} ${invoice.currency}`,
      `Amount gross: ${invoice.amountGross.toFixed(2)} ${invoice.currency}`,
      `Issued at: ${invoice.issuedAt ?? '-'}`,
      `Due at: ${invoice.dueAt ?? '-'}`,
      `Paid at: ${invoice.paidAt ?? '-'}`,
    ];

    const contentStream = [
      'BT',
      '/F1 18 Tf',
      '48 780 Td',
      `(${this.escapePdfText(lines[0])}) Tj`,
      '/F1 12 Tf',
      ...lines.slice(1).map((line) => `0 -22 Td (${this.escapePdfText(line)}) Tj`),
      'ET',
    ].join('\n');

    const objects = [
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
      '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
      `5 0 obj\n<< /Length ${Buffer.byteLength(contentStream, 'utf8')} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [0];

    for (const object of objects) {
      offsets.push(Buffer.byteLength(pdf, 'utf8'));
      pdf += object;
    }

    const xrefOffset = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';

    for (let index = 1; index < offsets.length; index += 1) {
      pdf += `${offsets[index].toString().padStart(10, '0')} 00000 n \n`;
    }

    pdf += 'trailer\n';
    pdf += `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
    pdf += `startxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, 'utf8');
  }

  private escapePdfText(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  private toSafeFileToken(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]+/g, '-');
  }
}
