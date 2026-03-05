import { SetMetadata } from '@nestjs/common';
import type { AuthRole } from '../modules/auth/auth.service';

export const ROLE_METADATA_KEY = 'roles';

export const Roles = (...roles: AuthRole[]) =>
  SetMetadata(ROLE_METADATA_KEY, roles);
