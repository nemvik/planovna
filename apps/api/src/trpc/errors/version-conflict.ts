import { TRPCError } from '@trpc/server';
import { VersionConflictError } from '../../common/errors/conflict.error';

type ConflictData = {
  code: VersionConflictError['code'];
  entity: string;
  id: string;
  expectedVersion: number;
  actualVersion: number;
};

const hasConflictShape = (value: unknown): value is ConflictData => {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<ConflictData>;

  return (
    candidate.code === 'VERSION_CONFLICT' &&
    typeof candidate.entity === 'string' &&
    typeof candidate.id === 'string' &&
    typeof candidate.expectedVersion === 'number' &&
    typeof candidate.actualVersion === 'number'
  );
};

export const toConflictData = (error: VersionConflictError): ConflictData => ({
  code: error.code,
  entity: error.entity,
  id: error.id,
  expectedVersion: error.expectedVersion,
  actualVersion: error.actualVersion,
});

export const extractConflictData = (cause: unknown): ConflictData | null => {
  if (cause instanceof VersionConflictError) {
    return toConflictData(cause);
  }

  if (hasConflictShape(cause)) {
    return cause;
  }

  return null;
};

export const throwTrpcVersionConflict = (error: unknown): never => {
  if (error instanceof VersionConflictError) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: error.message,
      cause: toConflictData(error),
    });
  }

  throw error;
};
