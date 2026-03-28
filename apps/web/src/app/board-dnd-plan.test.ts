import { buildDragPlan } from './board-dnd-plan';

describe('buildDragPlan', () => {
  it('moves an operation across columns without duplicating or losing cards', () => {
    const plan = buildDragPlan(
      [
        { id: 'op-a', code: 'OP-A', sortIndex: 1000 },
        { id: 'op-b', code: 'OP-B', sortIndex: 1000, startDate: '2026-03-28T00:00:00.000Z' },
        { id: 'op-c', code: 'OP-C', sortIndex: 2000, startDate: '2026-03-28T00:00:00.000Z' },
      ],
      'op-a',
      { kind: 'operation', operationId: 'op-c' },
    );

    expect(plan).not.toBeNull();
    expect(plan?.changedOperationIds.sort()).toEqual(['op-a', 'op-c'].sort());
    expect(plan?.nextOperations).toHaveLength(3);

    const moved = plan?.nextOperations.find((operation) => operation.id === 'op-a');
    expect(moved?.startDate).toBe('2026-03-28T00:00:00.000Z');
    expect(plan?.nextOperations.map((operation) => operation.id).sort()).toEqual(['op-a', 'op-b', 'op-c']);
  });
});
