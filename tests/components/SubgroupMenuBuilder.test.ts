import { SubgroupMenuBuilder } from '../../src/components/SubgroupMenuBuilder';
import { FilterOptions, TaskGroupKey } from '../../src/types';

describe('SubgroupMenuBuilder', () => {
  const baseOptions: FilterOptions = {
    statuses: [] as any,
    priorities: [] as any,
    contexts: [],
    projects: [],
    tags: [],
    folders: [],
    userProperties: [
      { id: 'user:assignee', label: 'Assignee', valueInputType: 'text', supportedOperators: [] } as any,
      { id: 'user:effort', label: 'Effort', valueInputType: 'number', supportedOperators: [] } as any,
    ],
  };

  it('builds options including None and excluding the primary key (built-ins)', () => {
    const options = SubgroupMenuBuilder.buildOptions('status', baseOptions);
    expect(options['none']).toBe('None');
    expect(options['status']).toBeUndefined();
    expect(options['priority']).toBe('Priority');
    expect(options['context']).toBe('Context');
    expect(options['project']).toBe('Project');
    expect(options['due']).toBe('Due Date');
    expect(options['scheduled']).toBe('Scheduled Date');
    expect(options['tags']).toBe('Tags');
  });

  it('includes user properties except when equal to primary', () => {
    const options = SubgroupMenuBuilder.buildOptions('user:assignee' as TaskGroupKey, baseOptions);
    expect(options['user:assignee']).toBeUndefined();
    expect(options['user:effort']).toBe('Effort');
  });
});

