import { FilterService } from '../../../src/services/FilterService';
import { MinimalNativeCache } from '../../../src/utils/MinimalNativeCache';
import { StatusManager } from '../../../src/services/StatusManager';
import { PriorityManager } from '../../../src/services/PriorityManager';
import { MockObsidian, App } from '../../__mocks__/obsidian';
import { DEFAULT_SETTINGS, DEFAULT_FIELD_MAPPING } from '../../../src/settings/defaults';
import { FieldMapper } from '../../../src/services/FieldMapper';

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
  const status = new StatusManager(plugin.settings.customStatuses);
  const priority = new PriorityManager(plugin.settings.customPriorities);
  return new FilterService(cache, status, priority, plugin);
}

function createTaskFile(app: App, path: string, fm: Record<string, any>) {
  const yamlLines = Object.entries(fm)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : v}`);
  const content = `---\n${yamlLines.join('\n')}\n---\n`;
  return (app.vault as any).create(path, content);
}

describe('FilterService - group by status', () => {
  beforeEach(() => MockObsidian.reset());

  test('groups tasks by status values and sorts by status order', async () => {
    const app = makeApp();
    const cache = makeCache(app, { taskIdentificationMethod: 'property', taskPropertyName: 'isTask', taskPropertyValue: 'true' } as any);
    const plugin = { settings: DEFAULT_SETTINGS } as any;
    const fs = makeFilterService(cache, plugin);

    await createTaskFile(app, 'Tasks/a.md', { isTask: true, title: 'A', status: 'open' });
    await createTaskFile(app, 'Tasks/b.md', { isTask: true, title: 'B', status: 'in-progress' });
    await createTaskFile(app, 'Tasks/c.md', { isTask: true, title: 'C', status: 'done' });

    // Ensure metadata present (explicit set avoids timing issues)
    app.metadataCache.setCache('Tasks/a.md', { frontmatter: { isTask: true, title: 'A', status: 'open' } });
    app.metadataCache.setCache('Tasks/b.md', { frontmatter: { isTask: true, title: 'B', status: 'in-progress' } });
    app.metadataCache.setCache('Tasks/c.md', { frontmatter: { isTask: true, title: 'C', status: 'done' } });

    const query = fs.createDefaultQuery();
    (query as any).groupKey = 'status';

    const grouped = await fs.getGroupedTasks(query);
    const keys = Array.from(grouped.keys());

    expect(keys).toEqual(['open', 'in-progress', 'done']);
    expect(grouped.get('open')!.map(t => t.path)).toEqual(expect.arrayContaining(['Tasks/a.md']));
    expect(grouped.get('in-progress')!.map(t => t.path)).toEqual(expect.arrayContaining(['Tasks/b.md']));
    expect(grouped.get('done')!.map(t => t.path)).toEqual(expect.arrayContaining(['Tasks/c.md']))
  });
});

