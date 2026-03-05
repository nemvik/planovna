export type ConflictErrorContract = {
  code: 'VERSION_CONFLICT';
  message: string;
  entity: string;
  id: string;
  expectedVersion: number;
  actualVersion: number;
};

export class VersionConflictError extends Error {
  constructor(public readonly payload: ConflictErrorContract) {
    super(payload.message);
  }
}
