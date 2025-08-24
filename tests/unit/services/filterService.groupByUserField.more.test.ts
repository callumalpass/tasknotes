import { FilterService } from '../../../src/services/FilterService';
import { MinimalNativeCache } from '../../../src/utils/MinimalNativeCache';
import { StatusManager } from '../../../src/services/StatusManager';
import { PriorityManager } from '../../../src/services/PriorityManager';
import { MockObsidian, App } from '../../__mocks__/obsidian';
import { DEFAULT_SETTINGS, DEFAULT_FIELD_MAPPING } from '../../../src/settings/defaults';
import { FieldMapper } from '../../../src/services/FieldMapper';

function makeApp(): App { return MockObsidian.createMockApp(); }
function makeCache(app: App, settingsOverride: Partial<typeof DEFAULT_SETTINGS> = {}) {
  const mapper = new FieldMapper(DEFAULT_FIELD_MAPPING);
  const settings = { ...DEFAULT_SETTINGS, ...settingsOverride } as any;
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

describe('FilterService - group by custom user fields (more cases)', () => {
  beforeEach(() => { MockObsidian.reset(); });

  test('boolean user field: true/false buckets, true before false', async () => {
    const app = makeApp();
    const cache = makeCache(app, { taskIdentificationMethod: 'property', taskPropertyName: 'isTask', taskPropertyValue: 'true' } as any);
    const plugin = { settings: { ...DEFAULT_SETTINGS, userFields: [
      { id: 'flag', key: 'flag', displayName: 'Flag', type: 'boolean' as const }
    ] } };
    const fs = makeFilterService(cache, plugin);

    await createTaskFile(app, 'Tasks/t1.md', { isTask: true, title: 'T1', flag: true });
    await createTaskFile(app, 'Tasks/t2.md', { isTask: true, title: 'T2', flag: false });
    await createTaskFile(app, 'Tasks/t3.md', { isTask: true, title: 'T3' });
    app.metadataCache.setCache('Tasks/t1.md', { frontmatter: { isTask: true, title: 'T1', flag: true } });
    app.metadataCache.setCache('Tasks/t2.md', { frontmatter: { isTask: true, title: 'T2', flag: false } });
    app.metadataCache.setCache('Tasks/t3.md', { frontmatter: { isTask: true, title: 'T3' } });

    const query = fs.createDefaultQuery();
    (query as any).groupKey = 'user:flag';
    const grouped = await fs.getGroupedTasks(query);
    const keys = Array.from(grouped.keys());
    expect(keys.indexOf('true')).toBeLessThan(keys.indexOf('false'));
    expect(grouped.get('true')!.length).toBe(1);
    expect(grouped.get('false')!.length).toBe(1);
    expect(grouped.get('no-value')!.length).toBe(1);
  });

  test('list user field: array and string forms; first token; empty vs no-value', async () => {
    const app = makeApp();
    const cache = makeCache(app, { taskIdentificationMethod: 'property', taskPropertyName: 'isTask', taskPropertyValue: 'true' } as any);
    const plugin = { settings: { ...DEFAULT_SETTINGS, userFields: [
      { id: 'labels', key: 'labels', displayName: 'Labels', type: 'list' as const }
    ] } };
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
    (query as any).groupKey = 'user:labels';
    const grouped = await fs.getGroupedTasks(query);

    // 'a' picks first token normalized from [[People/Chuck Norris]] -> 'Chuck Norris'
    expect(grouped.get('Chuck Norris')!.map(t => t.path)).toEqual(expect.arrayContaining(['Tasks/a.md']));
    // 'b' picks first token 'one'
    expect(grouped.get('one')!.map(t => t.path)).toEqual(expect.arrayContaining(['Tasks/b.md']));
    // 'c' empty present -> 'empty'
    expect(grouped.get('empty')!.map(t => t.path)).toEqual(expect.arrayContaining(['Tasks/c.md']));
    // 'd' missing -> 'no-value'
    expect(grouped.get('no-value')!.map(t => t.path)).toEqual(expect.arrayContaining(['Tasks/d.md']));
  });

  test('date user field: chronological sort, no-date fallback', async () => {
    const app = makeApp();
    const cache = makeCache(app, { taskIdentificationMethod: 'property', taskPropertyName: 'isTask', taskPropertyValue: 'true' } as any);
    const plugin = { settings: { ...DEFAULT_SETTINGS, userFields: [
      { id: 'review', key: 'review', displayName: 'Review', type: 'date' as const }
    ] } };
    const fs = makeFilterService(cache, plugin);

    await createTaskFile(app, 'Tasks/x.md', { isTask: true, title: 'X', review: '2025-01-02' });
    await createTaskFile(app, 'Tasks/y.md', { isTask: true, title: 'Y', review: '2025-01-01' });
    await createTaskFile(app, 'Tasks/z.md', { isTask: true, title: 'Z' });
    app.metadataCache.setCache('Tasks/x.md', { frontmatter: { isTask: true, title: 'X', review: '2025-01-02' } });
    app.metadataCache.setCache('Tasks/y.md', { frontmatter: { isTask: true, title: 'Y', review: '2025-01-01' } });
    app.metadataCache.setCache('Tasks/z.md', { frontmatter: { isTask: true, title: 'Z' } });

    const query = fs.createDefaultQuery();
    (query as any).groupKey = 'user:review';
    const grouped = await fs.getGroupedTasks(query);
    const keys = Array.from(grouped.keys());
    expect(keys.indexOf('2025-01-01')).toBeLessThan(keys.indexOf('2025-01-02'));
    expect(keys).toContain('no-date');
  });

  test('unknown field id yields unknown-field bucket', async () => {
    const app = makeApp();
    const cache = makeCache(app, { taskIdentificationMethod: 'property', taskPropertyName: 'isTask', taskPropertyValue: 'true' } as any);
    const plugin = { settings: { ...DEFAULT_SETTINGS, userFields: [
      { id: 'known', key: 'known', displayName: 'Known', type: 'text' as const }
    ] } };
    const fs = makeFilterService(cache, plugin);

    await createTaskFile(app, 'Tasks/u.md', { isTask: true, title: 'U', known: 'exists' });
    app.metadataCache.setCache('Tasks/u.md', { frontmatter: { isTask: true, title: 'U', known: 'exists' } });

    const query = fs.createDefaultQuery();
    (query as any).groupKey = 'user:unknown';
    const grouped = await fs.getGroupedTasks(query);
    expect(grouped.has('unknown-field')).toBe(true);
  });
});

