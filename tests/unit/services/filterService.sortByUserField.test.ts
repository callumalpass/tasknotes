import { FilterService } from '../../../src/services/FilterService';
import { MinimalNativeCache } from '../../../src/utils/MinimalNativeCache';
import { StatusManager } from '../../../src/services/StatusManager';
import { PriorityManager } from '../../../src/services/PriorityManager';
import { MockObsidian, App } from '../../__mocks__/obsidian';
import { DEFAULT_SETTINGS, DEFAULT_FIELD_MAPPING } from '../../../src/settings/defaults';
import { FieldMapper } from '../../../src/services/FieldMapper';

function makeApp(): App { return MockObsidian.createMockApp(); }
function makeCache(app: App) {
  const mapper = new FieldMapper(DEFAULT_FIELD_MAPPING);
  const settings = { ...DEFAULT_SETTINGS, taskIdentificationMethod: 'property', taskPropertyName: 'isTask', taskPropertyValue: 'true' } as any;
  const cache = new MinimalNativeCache(app as any, settings, mapper);
  cache.initialize();
  return cache;
}
function makeFilterService(cache: MinimalNativeCache, plugin: any) {
  const status = new StatusManager([]);
  const priority = new PriorityManager([]);
  return new FilterService(cache, status, priority, plugin);
}
function createTaskFile(app: App, path: string, frontmatter: Record<string, any>) {
  const yamlLines = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.map((x) => typeof x === 'string' ? `'${x.replace(/'/g, "''")}'` : x).join(', ')}]` : v}`);
  const content = `---\n${yamlLines.join('\n')}\n---\n`;
  return (app.vault as any).create(path, content);
}

describe('FilterService - sort by custom user fields', () => {
  beforeEach(() => { MockObsidian.reset(); });

  test('number: ascending within asc direction; non-numeric last', async () => {
    const app = makeApp();
    const cache = makeCache(app);
    const plugin = { settings: { ...DEFAULT_SETTINGS, userFields: [ { id: 'effort', key: 'effort', displayName: 'Effort', type: 'number' as const } ] } };
    const fs = makeFilterService(cache, plugin);

    await createTaskFile(app, 'Tasks/a.md', { isTask: true, title: 'A', effort: '10-High' });
    await createTaskFile(app, 'Tasks/b.md', { isTask: true, title: 'B', effort: 5 });
    await createTaskFile(app, 'Tasks/c.md', { isTask: true, title: 'C', effort: 'x' });
    app.metadataCache.setCache('Tasks/a.md', { frontmatter: { isTask: true, title: 'A', effort: '10-High' } });
    app.metadataCache.setCache('Tasks/b.md', { frontmatter: { isTask: true, title: 'B', effort: 5 } });
    app.metadataCache.setCache('Tasks/c.md', { frontmatter: { isTask: true, title: 'C', effort: 'x' } });

    const query = fs.createDefaultQuery();
    (query as any).groupKey = 'none';
    (query as any).sortKey = 'user:effort';
    (query as any).sortDirection = 'asc';
    const groups = await fs.getGroupedTasks(query);
    const all = groups.get('all')!;
    expect(all.map(t=>t.path)).toEqual(['Tasks/b.md','Tasks/a.md','Tasks/c.md']);
  });

  test('boolean: true before false in asc direction', async () => {
    const app = makeApp();
    const cache = makeCache(app);
    const plugin = { settings: { ...DEFAULT_SETTINGS, userFields: [ { id: 'flag', key: 'flag', displayName: 'Flag', type: 'boolean' as const } ] } };
    const fs = makeFilterService(cache, plugin);

    await createTaskFile(app, 'Tasks/t1.md', { isTask: true, title: 'T1', flag: true });
    await createTaskFile(app, 'Tasks/t2.md', { isTask: true, title: 'T2', flag: false });
    await createTaskFile(app, 'Tasks/t3.md', { isTask: true, title: 'T3' });
    app.metadataCache.setCache('Tasks/t1.md', { frontmatter: { isTask: true, title: 'T1', flag: true } });
    app.metadataCache.setCache('Tasks/t2.md', { frontmatter: { isTask: true, title: 'T2', flag: false } });
    app.metadataCache.setCache('Tasks/t3.md', { frontmatter: { isTask: true, title: 'T3' } });

    const query = fs.createDefaultQuery();
    (query as any).groupKey = 'none';
    (query as any).sortKey = 'user:flag';
    (query as any).sortDirection = 'asc';
    const groups = await fs.getGroupedTasks(query);
    const all = groups.get('all')!;
    expect(all.map(t=>t.path)).toEqual(['Tasks/t1.md','Tasks/t2.md','Tasks/t3.md']);
  });

  test('date: chronological asc', async () => {
    const app = makeApp();
    const cache = makeCache(app);
    const plugin = { settings: { ...DEFAULT_SETTINGS, userFields: [ { id: 'review', key: 'review', displayName: 'Review', type: 'date' as const } ] } };
    const fs = makeFilterService(cache, plugin);

    await createTaskFile(app, 'Tasks/x.md', { isTask: true, title: 'X', review: '2025-01-02' });
    await createTaskFile(app, 'Tasks/y.md', { isTask: true, title: 'Y', review: '2025-01-01' });
    await createTaskFile(app, 'Tasks/z.md', { isTask: true, title: 'Z' });
    app.metadataCache.setCache('Tasks/x.md', { frontmatter: { isTask: true, title: 'X', review: '2025-01-02' } });
    app.metadataCache.setCache('Tasks/y.md', { frontmatter: { isTask: true, title: 'Y', review: '2025-01-01' } });
    app.metadataCache.setCache('Tasks/z.md', { frontmatter: { isTask: true, title: 'Z' } });

    const query = fs.createDefaultQuery();
    (query as any).groupKey = 'none';
    (query as any).sortKey = 'user:review';
    (query as any).sortDirection = 'asc';
    const groups = await fs.getGroupedTasks(query);
    const all = groups.get('all')!;
    expect(all.map(t=>t.path)).toEqual(['Tasks/y.md','Tasks/x.md','Tasks/z.md']);
  });

  test('list: alphabetical by first token', async () => {
    const app = makeApp();
    const cache = makeCache(app);
    const plugin = { settings: { ...DEFAULT_SETTINGS, userFields: [ { id: 'labels', key: 'labels', displayName: 'Labels', type: 'list' as const } ] } };
    const fs = makeFilterService(cache, plugin);

    await createTaskFile(app, 'Tasks/a.md', { isTask: true, title: 'A', labels: ['[[People/Chuck Norris]]', 'second'] });
    await createTaskFile(app, 'Tasks/b.md', { isTask: true, title: 'B', labels: 'one, two' });
    await createTaskFile(app, 'Tasks/c.md', { isTask: true, title: 'C', labels: '' });
    await createTaskFile(app, 'Tasks/d.md', { isTask: true, title: 'D' });
    app.metadataCache.setCache('Tasks/a.md', { frontmatter: { isTask: true, title: 'A', labels: ['[[People/Chuck Norris]]', 'second'] } });
    app.metadataCache.setCache('Tasks/b.md', { frontmatter: { isTask: true, title: 'B', labels: 'one, two' } });
    app.metadataCache.setCache('Tasks/c.md', { frontmatter: { isTask: true, title: 'C', labels: '' } });
    app.metadataCache.setCache('Tasks/d.md', { frontmatter: { isTask: true, title: 'D' } });

    const query = fs.createDefaultQuery();
    (query as any).groupKey = 'none';
    (query as any).sortKey = 'user:labels';
    (query as any).sortDirection = 'asc';
    const groups = await fs.getGroupedTasks(query);
    const all = groups.get('all')!;
    expect(all.map(t=>t.path)).toEqual(['Tasks/a.md','Tasks/b.md','Tasks/c.md','Tasks/d.md']);
  });
});

