import { VersionConflictError } from '../errors/conflict.error';

export function assertVersion(
  entity: string,
  id: string,
  expectedVersion: number,
  actualVersion: number,
) {
  if (expectedVersion !== actualVersion) {
    throw new VersionConflictError(entity, id, expectedVersion, actualVersion);
  }
}
