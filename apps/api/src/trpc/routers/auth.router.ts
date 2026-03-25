import { TRPCError } from '@trpc/server';
import {
  LoginSchema,
  MagicLinkConsumeSchema,
  MagicLinkRequestSchema,
  RegisterSchema,
} from '../../modules/auth/dto/auth.dto';
import { AuthService } from '../../modules/auth/auth.service';
import { publicProcedure, router } from '../trpc';

export const createAuthRouter = (authService: AuthService) =>
  router({
    register: publicProcedure
      .input(RegisterSchema)
      .mutation(async ({ ctx, input }) => {
        const clientIp = ctx.req.ip || ctx.req.socket.remoteAddress;

        if (authService.isRegisterRateLimited(input.email, clientIp)) {
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many registration attempts. Please try again later.',
          });
        }

        const result = await authService.register(input);
        if (!result) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Email already exists',
          });
        }

        return result;
      }),
    login: publicProcedure
      .input(LoginSchema)
      .mutation(async ({ input }) => {
        const result = await authService.login(input);
        if (!result) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid credentials',
          });
        }

        return result;
      }),
    requestMagicLink: publicProcedure
      .input(MagicLinkRequestSchema)
      .mutation(async ({ input }) => {
        const result = await authService.requestMagicLink(input);
        if (!result) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Unknown user',
          });
        }

        return result;
      }),
    consumeMagicLink: publicProcedure
      .input(MagicLinkConsumeSchema)
      .mutation(async ({ input }) => {
        const result = await authService.consumeMagicLink(input);
        if (!result) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired magic link token',
          });
        }

        return result;
      }),
  });
