import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { AuthService } from '../../modules/auth/auth.service';
import { publicProcedure, router } from '../trpc';

const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createAuthRouter = (authService: AuthService) =>
  router({
    login: publicProcedure
      .input(LoginInputSchema)
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
  });
