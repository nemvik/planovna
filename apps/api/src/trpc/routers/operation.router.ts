import { TRPCError } from '@trpc/server';
import { OperationService } from '../../modules/operation/operation.service';
import {
  CreateOperationDependencySchema,
  CreateOperationSchema,
  RemoveOperationDependencySchema,
  UpdateOperationSchema,
} from '../../modules/operation/dto/operation.dto';
import {
  OperationDependencyValidationError,
} from '../../modules/operation/operation.service';
import { throwTrpcVersionConflict } from '../errors/version-conflict';
import { protectedProcedure, router } from '../trpc';

const throwDependencyError = (error: unknown): never => {
  if (error instanceof OperationDependencyValidationError) {
    const code =
      error.code === 'DEPENDENCY_DUPLICATE'
        ? 'CONFLICT'
        : error.code === 'DEPENDENCY_NOT_FOUND' || error.code === 'DEPENDENCY_INVALID_TARGET'
          ? 'BAD_REQUEST'
          : 'BAD_REQUEST';

    throw new TRPCError({
      code,
      message: error.message,
      cause: {
        code: error.code,
      },
    });
  }

  throw error;
};

export const createOperationRouter = (operationService: OperationService) =>
  router({
    list: protectedProcedure.query(({ ctx }) => {
      return operationService.list(ctx.auth.tenantId);
    }),
    auditLog: protectedProcedure.query(({ ctx }) => {
      return operationService.listAudit(ctx.auth.tenantId);
    }),
    create: protectedProcedure
      .input(CreateOperationSchema)
      .mutation(({ ctx, input }) => {
        return operationService.create({
          ...input,
          tenantId: ctx.auth.tenantId,
          actorUserId: ctx.auth.userId,
        });
      }),
    update: protectedProcedure
      .input(UpdateOperationSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await operationService.update({
            ...input,
            tenantId: ctx.auth.tenantId,
            actorUserId: ctx.auth.userId,
          });

          if (!result) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Operation access denied',
            });
          }

          return result;
        } catch (error) {
          throwTrpcVersionConflict(error);
        }
      }),
    addDependency: protectedProcedure
      .input(CreateOperationDependencySchema)
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await operationService.addDependency(ctx.auth.tenantId, {
            ...input,
            actorUserId: ctx.auth.userId,
          });
          if (!result) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Operation access denied' });
          }
          return result;
        } catch (error) {
          throwDependencyError(error);
        }
      }),
    removeDependency: protectedProcedure
      .input(RemoveOperationDependencySchema)
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await operationService.removeDependency(ctx.auth.tenantId, {
            ...input,
            actorUserId: ctx.auth.userId,
          });
          if (!result) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Operation access denied' });
          }
          return result;
        } catch (error) {
          throwDependencyError(error);
        }
      }),
  });
