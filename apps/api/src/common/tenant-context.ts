import { BadRequestException } from '@nestjs/common';

export function requireTenantId(tenantId?: string): string {
  if (!tenantId || tenantId.trim().length === 0) {
    throw new BadRequestException('tenantId is required');
  }
  return tenantId;
}
