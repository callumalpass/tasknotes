import { getBasesSortComparator } from '../../../src/bases/sorting';
import type { TaskInfo } from '../../../src/types';

describe('Bases sorting comparator', () => {
  const makeTask = (path: string, title: string, due?: string): TaskInfo => ({
    path, title, status: 'open', priority: 'normal', archived: false, tags: [],
    due, scheduled: undefined, contexts: [], projects: []
  } as any);

  const pathToProps = new Map<string, any>();
  const basesContainer = (sort: any, props: Record<string, any>) => ({
    controller: { getViewConfig: () => ({ sort }) },
    query: { getViewConfig: (k: string) => (k === 'sort' ? sort : undefined), properties: props }
  });

  it('sorts by file.basename DESC then title ASC as tiebreaker', () => {
    const tasks = [
      makeTask('b/Two.md', 'Two'),
      makeTask('a/One.md', 'One'),
      makeTask('a/Alpha.md', 'Alpha')
    ];
    const cmp = getBasesSortComparator(basesContainer([
      { property: 'file.basename', direction: 'DESC' },
      { property: 'title', direction: 'ASC' }
    ], {}) as any, pathToProps)!;

    const sorted = [...tasks].sort(cmp);
    expect(sorted.map(t => t.title)).toEqual(['Two', 'One', 'Alpha']);
  });

  it('sorts by note.in ASC using properties map', () => {
    const tasks = [
      makeTask('x/1.md', 'T1'),
      makeTask('x/2.md', 'T2'),
      makeTask('x/3.md', 'T3')
    ];
    const p2 = new Map([['x/1.md', { 'note.in': 'B' }], ['x/2.md', { 'note.in': 'A' }], ['x/3.md', { 'note.in': 'B' }]]);
    const cmp = getBasesSortComparator(basesContainer([
      { property: 'note.in', direction: 'ASC' }
    ], { 'note.in': { getDisplayName: () => 'Project' } }) as any, p2 as any)!;

    const sorted = [...tasks].sort(cmp);
    expect(sorted.map(t => t.path)).toEqual(['x/2.md', 'x/1.md', 'x/3.md']);
  });
});

