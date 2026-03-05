export class VersionConflictError extends Error {
  readonly code = 'VERSION_CONFLICT';
  readonly statusCode = 409;

  constructor(
    public readonly entity: string,
    public readonly id: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number,
  ) {
    super(
      `${entity} ${id} version conflict: expected ${expectedVersion}, actual ${actualVersion}`,
    );
  }

  toHttp() {
    return {
      statusCode: this.statusCode,
      code: this.code,
      message: this.message,
      details: {
        entity: this.entity,
        id: this.id,
        expectedVersion: this.expectedVersion,
        actualVersion: this.actualVersion,
      },
    };
  }
}
