import type { Request } from 'express';
import { AuthService, type AuthTokenPayload } from '../modules/auth/auth.service';

type TrpcContextOptions = {
  req: Request;
  authService: AuthService;
};

export type TrpcContext = {
  req: Request;
  auth: AuthTokenPayload | null;
};

export const createTrpcContext = ({ req, authService }: TrpcContextOptions): TrpcContext => {
  const authorization = req.headers.authorization ?? '';
  const accessToken = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : null;

  if (!accessToken) {
    return { req, auth: null };
  }

  return {
    req,
    auth: authService.verify(accessToken),
  };
};
