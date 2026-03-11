export const BOARD_STATUS_VALUES = ['READY', 'IN_PROGRESS', 'DONE', 'BLOCKED'] as const;

export type BoardStatus = (typeof BOARD_STATUS_VALUES)[number];
export type StatusFilter = BoardStatus | 'ALL';
export type BucketFilter = 'ALL' | 'Backlog' | `${number}-${number}-${number}`;

export type BoardFilters = {
  status: StatusFilter;
  bucket: BucketFilter;
};

type FilterableOperation = {
  status: BoardStatus;
  startDate?: string;
};

export const BACKLOG_BUCKET = 'Backlog';

const ALL_FILTER = 'ALL';
const DATE_BUCKET_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const compareBucketLabels = (leftLabel: string, rightLabel: string) => {
  if (leftLabel === BACKLOG_BUCKET) {
    return -1;
  }

  if (rightLabel === BACKLOG_BUCKET) {
    return 1;
  }

  return leftLabel.localeCompare(rightLabel);
};

export const parseStatusFilter = (value: string | null | undefined): StatusFilter => {
  if (!value) {
    return ALL_FILTER;
  }

  return BOARD_STATUS_VALUES.includes(value as BoardStatus) ? (value as BoardStatus) : ALL_FILTER;
};

export const parseBucketFilter = (value: string | null | undefined): BucketFilter => {
  if (!value) {
    return ALL_FILTER;
  }

  if (value === BACKLOG_BUCKET || DATE_BUCKET_PATTERN.test(value)) {
    return value as BucketFilter;
  }

  return ALL_FILTER;
};

export const parseBoardFilters = (searchParams: URLSearchParams): BoardFilters => ({
  status: parseStatusFilter(searchParams.get('status')),
  bucket: parseBucketFilter(searchParams.get('bucket')),
});

export const serializeBoardFilters = (
  filters: BoardFilters,
  searchParams = new URLSearchParams(),
): URLSearchParams => {
  const nextSearchParams = new URLSearchParams(searchParams);

  if (filters.status === ALL_FILTER) {
    nextSearchParams.delete('status');
  } else {
    nextSearchParams.set('status', filters.status);
  }

  if (filters.bucket === ALL_FILTER) {
    nextSearchParams.delete('bucket');
  } else {
    nextSearchParams.set('bucket', filters.bucket);
  }

  return nextSearchParams;
};

export const getOperationBucketLabel = (startDate?: string) =>
  startDate?.slice(0, 10) || BACKLOG_BUCKET;

export const getAvailableBucketFilters = <T extends Pick<FilterableOperation, 'startDate'>>(
  operations: T[],
): BucketFilter[] => {
  const bucketLabels = Array.from(
    new Set(operations.map((operation) => getOperationBucketLabel(operation.startDate))),
  ) as BucketFilter[];

  return [ALL_FILTER, ...bucketLabels.sort(compareBucketLabels)];
};

export const applyBoardFilters = <T extends FilterableOperation>(
  operations: T[],
  filters: BoardFilters,
): T[] =>
  operations.filter((operation) => {
    if (filters.status !== ALL_FILTER && operation.status !== filters.status) {
      return false;
    }

    if (filters.bucket !== ALL_FILTER && getOperationBucketLabel(operation.startDate) !== filters.bucket) {
      return false;
    }

    return true;
  });
