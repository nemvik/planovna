import { compareBucketLabels, getOperationBucketLabel } from './board-filters';

export type BoardOperationForDrag = {
  id: string;
  code: string;
  startDate?: string;
  sortIndex: number;
};

export type DragTarget =
  | { kind: 'bucket'; bucketLabel: string }
  | { kind: 'operation'; operationId: string };

const compareOperations = (left: BoardOperationForDrag, right: BoardOperationForDrag) => {
  if (left.sortIndex !== right.sortIndex) {
    return left.sortIndex - right.sortIndex;
  }

  const leftFallback = left.code || left.id;
  const rightFallback = right.code || right.id;

  return leftFallback.localeCompare(rightFallback);
};

const toStartDate = (bucketLabel: string) =>
  bucketLabel === 'Backlog' ? undefined : `${bucketLabel}T00:00:00.000Z`;

export type DragPlan = {
  nextOperations: BoardOperationForDrag[];
  changedOperationIds: string[];
};

export function buildDragPlan(
  operations: BoardOperationForDrag[],
  activeOperationId: string,
  target: DragTarget,
): DragPlan | null {
  const operationMap = new Map(operations.map((operation) => [operation.id, operation]));
  const activeOperation = operationMap.get(activeOperationId);

  if (!activeOperation) {
    return null;
  }

  const bucketMap = new Map<string, BoardOperationForDrag[]>();
  for (const operation of operations) {
    const bucketLabel = getOperationBucketLabel(operation.startDate);
    const bucketOperations = bucketMap.get(bucketLabel) ?? [];
    bucketOperations.push(operation);
    bucketMap.set(bucketLabel, bucketOperations);
  }

  for (const [bucketLabel, bucketOperations] of bucketMap.entries()) {
    bucketMap.set(bucketLabel, [...bucketOperations].sort(compareOperations));
  }

  const sourceBucketLabel = getOperationBucketLabel(activeOperation.startDate);
  const sourceOperations = [...(bucketMap.get(sourceBucketLabel) ?? [])];
  const sourceIndex = sourceOperations.findIndex((operation) => operation.id === activeOperationId);

  if (sourceIndex < 0) {
    return null;
  }

  sourceOperations.splice(sourceIndex, 1);

  let targetBucketLabel = sourceBucketLabel;
  let targetOperations = sourceOperations;
  let targetIndex = sourceOperations.length;

  if (target.kind === 'bucket') {
    targetBucketLabel = target.bucketLabel;
    targetOperations =
      targetBucketLabel === sourceBucketLabel
        ? sourceOperations
        : [...(bucketMap.get(targetBucketLabel) ?? [])].sort(compareOperations);
    targetIndex = targetOperations.length;
  } else {
    const targetOperation = operationMap.get(target.operationId);
    if (!targetOperation) {
      return null;
    }

    targetBucketLabel = getOperationBucketLabel(targetOperation.startDate);
    targetOperations =
      targetBucketLabel === sourceBucketLabel
        ? sourceOperations
        : [...(bucketMap.get(targetBucketLabel) ?? [])].sort(compareOperations);
    targetIndex = targetOperations.findIndex((operation) => operation.id === target.operationId);

    if (targetIndex < 0) {
      targetIndex = targetOperations.length;
    }
  }

  const movedOperation: BoardOperationForDrag = {
    ...activeOperation,
    startDate: toStartDate(targetBucketLabel),
  };

  targetOperations.splice(targetIndex, 0, movedOperation);

  bucketMap.set(sourceBucketLabel, sourceOperations);
  bucketMap.set(targetBucketLabel, targetOperations);

  const changedOperationIds: string[] = [];
  const nextOperationMap = new Map<string, BoardOperationForDrag>();

  const affectedBucketLabels = [...new Set([sourceBucketLabel, targetBucketLabel])].sort(compareBucketLabels);
  for (const bucketLabel of affectedBucketLabels) {
    const bucketOperations = bucketMap.get(bucketLabel) ?? [];
    bucketOperations.forEach((operation, index) => {
      const nextOperation = {
        ...operation,
        startDate: toStartDate(bucketLabel),
        sortIndex: (index + 1) * 1000,
      };
      nextOperationMap.set(nextOperation.id, nextOperation);

      const previousOperation = operationMap.get(nextOperation.id);
      if (
        previousOperation &&
        (previousOperation.startDate !== nextOperation.startDate ||
          previousOperation.sortIndex !== nextOperation.sortIndex)
      ) {
        changedOperationIds.push(nextOperation.id);
      }
    });
  }

  const nextOperations = operations.map((operation) => nextOperationMap.get(operation.id) ?? operation);

  if (changedOperationIds.length === 0) {
    return null;
  }

  return {
    nextOperations,
    changedOperationIds,
  };
}
