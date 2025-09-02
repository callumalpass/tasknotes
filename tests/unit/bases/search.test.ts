import { buildSearchIndex, filterTasksBySearch } from '../../../src/bases/search';
import type { TaskInfo } from '../../../src/types';

describe('Bases in-memory search', () => {
  const makeTask = (path: string, title: string): TaskInfo => ({
    path, title, status: 'open', priority: 'normal', archived: false
  } as any);

  const deps = (aliasesMap: Record<string, string | string[]>) => ({
    getAliases: (p: string) => {
      const v = aliasesMap[p];
      if (!v) return [];
      if (Array.isArray(v)) return v;
      return [v];
    }
  });

  it('returns all when query empty', () => {
    const tasks = [makeTask('a.md', 'Alpha'), makeTask('b.md', 'Beta')];
    const idx = buildSearchIndex(tasks, deps({}));
    const res = filterTasksBySearch(tasks, idx, '');
    expect(res.length).toBe(2);
  });

  it('matches by title', () => {
    const tasks = [makeTask('a.md', 'Alpha'), makeTask('b.md', 'Beta')];
    const idx = buildSearchIndex(tasks, deps({}));
    const res = filterTasksBySearch(tasks, idx, 'alp');
    expect(res.map(t=>t.title)).toEqual(['Alpha']);
  });

  it('matches by path', () => {
    const tasks = [makeTask('Projects/A.md', 'Task'), makeTask('Notes/B.md', 'Task')];
    const idx = buildSearchIndex(tasks, deps({}));
    const res = filterTasksBySearch(tasks, idx, 'projects/');
    expect(res.map(t=>t.path)).toEqual(['Projects/A.md']);
  });

  it('matches by aliases (string and array)', () => {
    const tasks = [makeTask('a.md', 'Task A'), makeTask('b.md', 'Task B')];
    const idx = buildSearchIndex(tasks, deps({ 'a.md': 'Foo', 'b.md': ['Bar', 'Baz'] }));
    const r1 = filterTasksBySearch(tasks, idx, 'foo');
    expect(r1.map(t=>t.path)).toEqual(['a.md']);
    const r2 = filterTasksBySearch(tasks, idx, 'baz');
    expect(r2.map(t=>t.path)).toEqual(['b.md']);
  });

  it('AND semantics across tokens', () => {
    const tasks = [makeTask('x.md', 'Alpha Beta'), makeTask('y.md', 'Alpha Gamma')];
    const idx = buildSearchIndex(tasks, deps({}));
    const r = filterTasksBySearch(tasks, idx, 'alpha gamma');
    expect(r.map(t=>t.path)).toEqual(['y.md']);
  });

  it('case-insensitive', () => {
    const tasks = [makeTask('x.md', 'MiXeD CaSe')];
    const idx = buildSearchIndex(tasks, deps({ 'x.md': ['AliAs'] }));
    const r = filterTasksBySearch(tasks, idx, 'mixed alias');
    expect(r.map(t=>t.path)).toEqual(['x.md']);
  });
});

