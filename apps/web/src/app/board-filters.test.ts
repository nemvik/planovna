import {
  applyBoardFilters,
  BACKLOG_BUCKET,
  getActiveBoardFilters,
  getAvailableBucketFilters,
  parseBoardFilters,
  serializeBoardFilters,
} from './board-filters';

describe('board-filters', () => {
  it('defaults missing and invalid search params to All', () => {
    expect(parseBoardFilters(new URLSearchParams())).toEqual({
      status: 'ALL',
      bucket: 'ALL',
      query: '',
    });

    expect(parseBoardFilters(new URLSearchParams('status=NOPE&bucket=tomorrow'))).toEqual({
      status: 'ALL',
      bucket: 'ALL',
      query: '',
    });
  });

  it('parses and serializes supported filter values', () => {
    const filters = parseBoardFilters(
      new URLSearchParams(
        `status=BLOCKED&bucket=${encodeURIComponent(BACKLOG_BUCKET)}&query=${encodeURIComponent('  OP-200  ')}`,
      ),
    );

    expect(filters).toEqual({
      status: 'BLOCKED',
      bucket: BACKLOG_BUCKET,
      query: 'OP-200',
    });

    expect(serializeBoardFilters(filters).toString()).toBe('status=BLOCKED&bucket=Backlog&query=OP-200');
    expect(serializeBoardFilters({ status: 'ALL', bucket: 'ALL', query: '' }).toString()).toBe('');
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
      {
        status: 'READY' as const,
        startDate: '2026-03-06T08:00:00.000Z',
        code: 'OP-100',
        title: 'Ready dated item',
      },
      { status: 'DONE' as const, code: 'OP-200', title: 'Finished backlog item' },
    ];

    expect(applyBoardFilters(operations, { status: 'ALL', bucket: 'ALL', query: '' })).toHaveLength(2);
    expect(applyBoardFilters(operations, { status: 'DONE', bucket: 'ALL', query: '' })).toEqual([
      operations[1],
    ]);
    expect(
      applyBoardFilters(operations, { status: 'READY', bucket: '2026-03-06', query: '' }),
    ).toEqual([operations[0]]);
  });

  it('applies query filtering across operation code and title', () => {
    const operations = [
      {
        status: 'READY' as const,
        startDate: '2026-03-06T08:00:00.000Z',
        code: 'OP-100',
        title: 'Ready dated item',
      },
      {
        status: 'DONE' as const,
        code: 'OP-200',
        title: 'Finished backlog item',
      },
    ];

    expect(applyBoardFilters(operations, { status: 'ALL', bucket: 'ALL', query: 'op-100' })).toEqual([
      operations[0],
    ]);
    expect(applyBoardFilters(operations, { status: 'ALL', bucket: 'ALL', query: 'backlog' })).toEqual([
      operations[1],
    ]);
    expect(applyBoardFilters(operations, { status: 'ALL', bucket: 'ALL', query: '  READY  ' })).toEqual([
      operations[0],
    ]);
  });

  it('returns only non-default active filters with trimmed query values', () => {
    expect(getActiveBoardFilters({ status: 'ALL', bucket: 'ALL', query: '   ' })).toEqual([]);

    expect(
      getActiveBoardFilters({
        status: 'BLOCKED',
        bucket: BACKLOG_BUCKET,
        query: '  OP-200  ',
      }),
    ).toEqual([
      { key: 'status', label: 'Status', value: 'BLOCKED' },
      { key: 'bucket', label: 'Bucket', value: BACKLOG_BUCKET },
      { key: 'query', label: 'Query', value: 'OP-200' },
    ]);
  });
});
