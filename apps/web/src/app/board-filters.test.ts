import {
  applyBoardFilters,
  BACKLOG_BUCKET,
  getAvailableBucketFilters,
  parseBoardFilters,
  serializeBoardFilters,
} from './board-filters';

describe('board-filters', () => {
  it('defaults missing and invalid search params to All', () => {
    expect(parseBoardFilters(new URLSearchParams())).toEqual({
      status: 'ALL',
      bucket: 'ALL',
    });

    expect(parseBoardFilters(new URLSearchParams('status=NOPE&bucket=tomorrow'))).toEqual({
      status: 'ALL',
      bucket: 'ALL',
    });
  });

  it('parses and serializes supported filter values', () => {
    const filters = parseBoardFilters(
      new URLSearchParams(`status=BLOCKED&bucket=${encodeURIComponent(BACKLOG_BUCKET)}`),
    );

    expect(filters).toEqual({
      status: 'BLOCKED',
      bucket: BACKLOG_BUCKET,
    });

    expect(serializeBoardFilters(filters).toString()).toBe('status=BLOCKED&bucket=Backlog');
    expect(serializeBoardFilters({ status: 'ALL', bucket: 'ALL' }).toString()).toBe('');
  });

  it('returns bucket filter options as All plus loaded bucket labels', () => {
    const operations = [
      { status: 'READY' as const, startDate: '2026-03-07T08:00:00.000Z' },
      { status: 'DONE' as const },
      { status: 'BLOCKED' as const, startDate: '2026-03-06T08:00:00.000Z' },
      { status: 'IN_PROGRESS' as const, startDate: '2026-03-06T12:00:00.000Z' },
    ];

    expect(getAvailableBucketFilters(operations)).toEqual([
      'ALL',
      BACKLOG_BUCKET,
      '2026-03-06',
      '2026-03-07',
    ]);
  });

  it('applies status and bucket filtering while leaving All unchanged', () => {
    const operations = [
      { status: 'READY' as const, startDate: '2026-03-06T08:00:00.000Z' },
      { status: 'DONE' as const },
    ];

    expect(applyBoardFilters(operations, { status: 'ALL', bucket: 'ALL' })).toHaveLength(2);
    expect(applyBoardFilters(operations, { status: 'DONE', bucket: 'ALL' })).toEqual([
      operations[1],
    ]);
    expect(applyBoardFilters(operations, { status: 'READY', bucket: '2026-03-06' })).toEqual([
      operations[0],
    ]);
  });
});
