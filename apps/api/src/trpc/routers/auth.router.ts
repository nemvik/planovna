import { TRPCError } from '@trpc/server';
import {
  LoginSchema,
  MagicLinkConsumeSchema,
  MagicLinkRequestSchema,
} from '../../modules/auth/dto/auth.dto';
import { AuthService } from '../../modules/auth/auth.service';
import { publicProcedure, router } from '../trpc';

export const createAuthRouter = (authService: AuthService) =>
  router({
    login: publicProcedure
      .input(LoginSchema)
      .mutation(({ input }) => {
        const result = authService.login(input);
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
      .mutation(({ input }) => {
        const result = authService.requestMagicLink(input);
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
      .mutation(({ input }) => {
        const result = authService.consumeMagicLink(input);
        if (!result) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired magic link token',
          });
        }

        return result;
      }),
  });
