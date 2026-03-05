import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../../api/src/trpc/routers/app.router';

export const createTrpcClient = (accessToken?: string) =>
  createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: process.env.NEXT_PUBLIC_API_TRPC_URL ?? 'http://localhost:3000/trpc',
        headers: () => {
          if (!accessToken) {
            return {};
          }

          return {
            authorization: `Bearer ${accessToken}`,
          };
        },
      }),
    ],
  });
