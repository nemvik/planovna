import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { CustomerService } from '../src/modules/customer/customer.service';
import { InvoiceService } from '../src/modules/invoice/invoice.service';
import { OrderService } from '../src/modules/order/order.service';

const binaryParser = (
  response: NodeJS.ReadableStream,
  callback: (error: Error | null, body: Buffer) => void,
) => {
  const chunks: Buffer[] = [];

  response.on('data', (chunk) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });
  response.on('end', () => callback(null, Buffer.concat(chunks)));
  response.on('error', (error) => callback(error, Buffer.alloc(0)));
};

describe('Invoice PDF export (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('requires auth and returns a downloadable invoice pdf', async () => {
    const authService = app.get(AuthService);
    const customerService = app.get(CustomerService);
    const orderService = app.get(OrderService);
    const invoiceService = app.get(InvoiceService);
    const login = await authService.login({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });

    expect(login).not.toBeNull();

    const suffix = randomUUID().slice(0, 8);
    const customer = await customerService.create({
      tenantId: 'tenant-a',
      name: `Invoice PDF Customer ${suffix}`,
      email: `invoice-pdf-${suffix}@example.test`,
    });
    const order = await orderService.create({
      tenantId: 'tenant-a',
      customerId: customer.id,
      code: `INV-PDF-${suffix}`,
      title: `Invoice PDF Order ${suffix}`,
      status: 'OPEN',
    });
    const invoice = await invoiceService.issue('tenant-a', {
      tenantId: 'tenant-a',
      orderId: order.id,
      number: `INV-PDF-${suffix}`,
      currency: 'CZK',
      amountGross: 1234,
      issuedAt: new Date('2026-04-01').toISOString(),
      dueAt: new Date('2026-04-15').toISOString(),
    });

    const appServer = app.getHttpServer();

    await request(appServer).get(`/invoices/${invoice.id}/pdf`).expect(401);

    const response = await request(appServer)
      .get(`/invoices/${invoice.id}/pdf`)
      .set('authorization', `Bearer ${login!.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toContain(
      `attachment; filename="invoice-${invoice.number}.pdf"`,
    );
    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect((response.body as Buffer).toString('utf8')).toContain('%PDF-1.4');
    expect((response.body as Buffer).toString('utf8')).toContain(invoice.number);
  });
});
