import { FilterService } from '../../../src/services/FilterService';
import { MinimalNativeCache } from '../../../src/utils/MinimalNativeCache';
import { StatusManager } from '../../../src/services/StatusManager';
import { PriorityManager } from '../../../src/services/PriorityManager';
import { MockObsidian, App } from '../../__mocks__/obsidian';
import { DEFAULT_SETTINGS, DEFAULT_FIELD_MAPPING } from '../../../src/settings/defaults';
import { FieldMapper } from '../../../src/services/FieldMapper';

// Helpers
function makeApp(): App {
  return MockObsidian.createMockApp();
}

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

describe('FilterService - group by custom user fields', () => {
  beforeEach(() => {
    MockObsidian.reset();
  });

  test('groups by text user field with fallback bucket for missing values', async () => {
    const app = makeApp();
    const cache = makeCache(app, { taskIdentificationMethod: 'property', taskPropertyName: 'isTask', taskPropertyValue: 'true' } as any);
    const plugin = { settings: { ...DEFAULT_SETTINGS, userFields: [
      { id: 'assignee', key: 'assignee', displayName: 'Assignee', type: 'text' as const }
    ] } };
    const fs = makeFilterService(cache, plugin);

    // Create task files
    await createTaskFile(app, 'Tasks/t1.md', { isTask: true, title: 'T1', status: 'open', assignee: 'Alice' });
    await createTaskFile(app, 'Tasks/t2.md', { isTask: true, title: 'T2', status: 'open', assignee: 'Bob' });
    await createTaskFile(app, 'Tasks/t3.md', { isTask: true, title: 'T3', status: 'open' }); // no assignee

    // Ensure metadata cache is populated (explicitly, to avoid timing issues)
    app.metadataCache.setCache('Tasks/t1.md', { frontmatter: { isTask: true, title: 'T1', status: 'open', assignee: 'Alice' } });
    app.metadataCache.setCache('Tasks/t2.md', { frontmatter: { isTask: true, title: 'T2', status: 'open', assignee: 'Bob' } });
    app.metadataCache.setCache('Tasks/t3.md', { frontmatter: { isTask: true, title: 'T3', status: 'open' } });

    // Sanity: ensure cache detects tasks
    const paths = cache.getAllTaskPaths();
    expect(paths.has('Tasks/t1.md')).toBe(true);
    expect(paths.has('Tasks/t2.md')).toBe(true);
    expect(paths.has('Tasks/t3.md')).toBe(true);

    const query = fs.createDefaultQuery();
    (query as any).groupKey = 'user:assignee';

    const grouped = await fs.getGroupedTasks(query);
    const keys = Array.from(grouped.keys());

    expect(keys).toContain('Alice');
    expect(keys).toContain('Bob');
    expect(keys).toContain('no-value');

    expect(grouped.get('Alice')!.map(t => t.path)).toEqual(expect.arrayContaining(['Tasks/t1.md']));
    expect(grouped.get('Bob')!.map(t => t.path)).toEqual(expect.arrayContaining(['Tasks/t2.md']));
    expect(grouped.get('no-value')!.map(t => t.path)).toEqual(expect.arrayContaining(['Tasks/t3.md']));
  });

  test('groups by number user field and sorts numeric groups descending', async () => {
    const app = makeApp();
    const cache = makeCache(app, { taskIdentificationMethod: 'property', taskPropertyName: 'isTask', taskPropertyValue: 'true' } as any);
    const plugin = { settings: { ...DEFAULT_SETTINGS, userFields: [
      { id: 'effort', key: 'effort', displayName: 'Effort', type: 'number' as const }
    ] } };
    const fs = makeFilterService(cache, plugin);

    await createTaskFile(app, 'Tasks/a.md', { isTask: true, title: 'A', status: 'open', effort: 2 });
    await createTaskFile(app, 'Tasks/b.md', { isTask: true, title: 'B', status: 'open', effort: '10-High' });
    await createTaskFile(app, 'Tasks/c.md', { isTask: true, title: 'C', status: 'open' });

    // Ensure metadata cache is populated explicitly
    app.metadataCache.setCache('Tasks/a.md', { frontmatter: { isTask: true, title: 'A', status: 'open', effort: 2 } });
    app.metadataCache.setCache('Tasks/b.md', { frontmatter: { isTask: true, title: 'B', status: 'open', effort: '10-High' } });
    app.metadataCache.setCache('Tasks/c.md', { frontmatter: { isTask: true, title: 'C', status: 'open' } });

    // Sanity: ensure cache detects tasks
    const paths = cache.getAllTaskPaths();
    expect(paths.has('Tasks/a.md')).toBe(true);
    expect(paths.has('Tasks/b.md')).toBe(true);
    expect(paths.has('Tasks/c.md')).toBe(true);

    const query = fs.createDefaultQuery();
    (query as any).groupKey = 'user:effort';

    const grouped = await fs.getGroupedTasks(query);
    const keys = Array.from(grouped.keys());

    // Expect numeric descending, then buckets
    const idx10 = keys.indexOf('10');
    const idx2 = keys.indexOf('2');
    expect(idx10).toBeGreaterThanOrEqual(0);
    expect(idx2).toBeGreaterThanOrEqual(0);
    expect(idx10).toBeLessThan(idx2);

    expect(grouped.get('10')!.map(t => t.path)).toEqual(expect.arrayContaining(['Tasks/b.md']));
    expect(grouped.get('2')!.map(t => t.path)).toEqual(expect.arrayContaining(['Tasks/a.md']));
    expect(grouped.get('no-value')!.map(t => t.path)).toEqual(expect.arrayContaining(['Tasks/c.md']));
  });
});

