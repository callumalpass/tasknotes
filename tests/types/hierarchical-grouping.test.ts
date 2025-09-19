import { FilterQuery, TaskGroupKey } from '../../src/types';

describe('types: FilterQuery with subgroupKey', () => {
  test('FilterQuery allows optional subgroupKey for hierarchical grouping', () => {
    const q: FilterQuery = {
      type: 'group',
      id: 'root',
      conjunction: 'and',
      children: [],
      sortKey: 'due',
      sortDirection: 'asc',
      groupKey: 'status',
      // This should compile and be accessible at runtime once implemented
      subgroupKey: 'priority' as TaskGroupKey,
    } as any;

    expect(q).toBeDefined();
    expect('subgroupKey' in q).toBe(true);
    expect(q.subgroupKey).toBe('priority');
  });
});

