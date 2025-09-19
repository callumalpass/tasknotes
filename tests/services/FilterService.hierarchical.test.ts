import { FilterQuery, PriorityConfig, StatusConfig, TaskInfo } from '../../src/types';
import { FilterService } from '../../src/services/FilterService';
import { StatusManager } from '../../src/services/StatusManager';
import { PriorityManager } from '../../src/services/PriorityManager';

// Minimal fake cache implementing only the methods used in this test path
class FakeCache {
  private map = new Map<string, TaskInfo>();
  constructor(entries: [string, TaskInfo][]) {
    for (const [k, v] of entries) this.map.set(k, v);
  }
  getAllTaskPaths(): Set<string> {
    return new Set(this.map.keys());
  }
  async getCachedTaskInfo(path: string): Promise<TaskInfo | null> {
    return this.map.get(path) || null;
  }
}

describe('FilterService.getHierarchicalGroupedTasks (additive API)', () => {
  test('returns groups and hierarchicalGroups when subgroupKey is set', async () => {
    const tasks: Record<string, TaskInfo> = {
      a: { title: 'A', status: 'open', priority: 'high', path: 'a', archived: false },
      b: { title: 'B', status: 'open', priority: 'low', path: 'b', archived: false },
      c: { title: 'C', status: 'done', priority: 'high', path: 'c', archived: false },
    };
    const cache = new FakeCache(Object.entries(tasks));

    // Simple configs
    const statuses: StatusConfig[] = [
      { id: 's1', value: 'open', label: 'Open', color: '#00f', isCompleted: false, order: 1, autoArchive: false, autoArchiveDelay: 5 },
      { id: 's2', value: 'done', label: 'Done', color: '#0a0', isCompleted: true, order: 2, autoArchive: false, autoArchiveDelay: 5 },
    ];
    const priorities: PriorityConfig[] = [
      { id: 'p1', value: 'low', label: 'Low', color: '#ccc', weight: 1 },
      { id: 'p2', value: 'high', label: 'High', color: '#f00', weight: 10 },
    ];

    const service = new FilterService(
      cache as any,
      new StatusManager(statuses),
      new PriorityManager(priorities),
      undefined
    );

    const query: FilterQuery = {
      type: 'group', id: 'root', conjunction: 'and', children: [],
      sortKey: 'title', sortDirection: 'asc',
      groupKey: 'status',
      subgroupKey: 'priority',
    } as any;

    const { groups, hierarchicalGroups } = await (service as any).getHierarchicalGroupedTasks(query);

    // Validate primary groups exist
    expect(groups.has('open')).toBe(true);
    expect(groups.has('done')).toBe(true);

    // Validate hierarchical structure
    expect(hierarchicalGroups).toBeDefined();
    const openSub = hierarchicalGroups!.get('open');
    const doneSub = hierarchicalGroups!.get('done');
    expect(openSub?.get('high')?.map(t => t.title)).toEqual(['A']);
    expect(openSub?.get('low')?.map(t => t.title)).toEqual(['B']);
    expect(doneSub?.get('high')?.map(t => t.title)).toEqual(['C']);
  });
});

