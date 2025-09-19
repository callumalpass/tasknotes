import { TaskInfo } from '../../src/types';
import { HierarchicalGroupingService } from '../../src/services/HierarchicalGroupingService';

const t = (overrides: Partial<TaskInfo>): TaskInfo => ({
  title: 'x', status: 'open', priority: 'normal', path: '/x', archived: false, ...overrides
});

describe('HierarchicalGroupingService', () => {
  test('groups by primary then subgroups (status → priority)', () => {
    const tasks: TaskInfo[] = [
      t({ title: 'A', status: 'open', priority: 'high' }),
      t({ title: 'B', status: 'open', priority: 'low' }),
      t({ title: 'C', status: 'done', priority: 'high' }),
    ];

    const svc = new HierarchicalGroupingService();
    const result = svc.group(tasks, 'status', 'priority');

    // Primary groups
    expect(result.size).toBe(2);
    expect(result.has('open')).toBe(true);
    expect(result.has('done')).toBe(true);

    // Subgroups
    const openSub = result.get('open');
    const doneSub = result.get('done');
    expect(openSub).toBeDefined();
    expect(doneSub).toBeDefined();

    expect(openSub!.get('high')!.map(t => t.title)).toEqual(['A']);
    expect(openSub!.get('low')!.map(t => t.title)).toEqual(['B']);
    expect(doneSub!.get('high')!.map(t => t.title)).toEqual(['C']);
  });

  test('ignores empty subgroups and keeps only those with tasks', () => {
    const tasks: TaskInfo[] = [
      t({ title: 'A', status: 'open', priority: 'high' })
    ];

    const svc = new HierarchicalGroupingService();
    const result = svc.group(tasks, 'status', 'priority');

    const openSub = result.get('open');
    expect(openSub).toBeDefined();
    expect([...openSub!.keys()]).toEqual(['high']);
  });

  test('sorts subgroups with "No <field>" positioning for ascending order', () => {
    const resolver = (task: TaskInfo, fieldId: string) => {
      if (fieldId === 'assignee') {
        const assignee = (task as any).assignee;
        return assignee ? [assignee] : ['No Assignee'];
      }
      return ['Unknown'];
    };

    const tasks: TaskInfo[] = [
      t({ title: 'A', status: 'open', assignee: 'Bob' } as any),
      t({ title: 'B', status: 'open', assignee: 'Alice' } as any),
      t({ title: 'C', status: 'open' } as any), // No assignee
    ];

    const userFields = [{ id: 'assignee', key: 'assignee', type: 'text' }];
    const svc = new HierarchicalGroupingService(resolver);
    const result = svc.group(tasks, 'status', 'user:assignee', 'asc', userFields);

    const openSub = result.get('open');
    const subgroupKeys = Array.from(openSub!.keys());

    // "No Assignee" should be first in ascending order
    expect(subgroupKeys).toEqual(['No Assignee', 'Alice', 'Bob']);
  });

  test('sorts subgroups with "No <field>" positioning for descending order', () => {
    const resolver = (task: TaskInfo, fieldId: string) => {
      if (fieldId === 'assignee') {
        const assignee = (task as any).assignee;
        return assignee ? [assignee] : ['No Assignee'];
      }
      return ['Unknown'];
    };

    const tasks: TaskInfo[] = [
      t({ title: 'A', status: 'open', assignee: 'Bob' } as any),
      t({ title: 'B', status: 'open', assignee: 'Alice' } as any),
      t({ title: 'C', status: 'open' } as any), // No assignee
    ];

    const userFields = [{ id: 'assignee', key: 'assignee', type: 'text' }];
    const svc = new HierarchicalGroupingService(resolver);
    const result = svc.group(tasks, 'status', 'user:assignee', 'desc', userFields);

    const openSub = result.get('open');
    const subgroupKeys = Array.from(openSub!.keys());

    // "No Assignee" should be last in descending order
    expect(subgroupKeys).toEqual(['Bob', 'Alice', 'No Assignee']);
  });
});

