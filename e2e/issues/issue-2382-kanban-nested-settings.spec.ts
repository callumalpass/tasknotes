import { test, expect } from '@playwright/test';
import { parse, stringify } from 'yaml';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

const statuses = ['ready', 'in-progress', 'done', 'inbox', 'blocked', 'next', 'waiting', 'ordered', 'shipped', 'received', 'returned'];
const shopping = ['ordered', 'shipped', 'received', 'returned'];
const folder = `Issue2382-${Date.now()}`;
let instance: ObsidianApp;
let originalSettings: any;

const settings = {
  columnWidth: 300,
  hideEmptyColumns: true,
  pinnedColumns: shopping.join(', '),
};

function filteredView(swimlanes = false) {
  return {
    type: 'tasknotesKanban',
    name: 'Purchase Board',
    filters: {
      and: [
        `file.inFolder("${folder}")`,
        `file.hasLink("${folder}/Purchase.md")`,
        { or: shopping.map(status => `status == "${status}"`) },
      ],
    },
    groupBy: { property: 'status', direction: 'ASC' },
    ...(swimlanes ? { swimLane: 'priority' } : {}),
  };
}

async function renderBase(name: string, content: string, swimlanes = false) {
  const path = `${folder}/${name}.base`;
  await instance.page.evaluate(async ({ path, content }) => {
    const app = (window as any).app;
    const file = await app.vault.create(path, content);
    await app.workspace.getLeaf(false).openFile(file);
  }, { path, content });
  const selector = swimlanes
    ? '.workspace-leaf.mod-active .kanban-view__column-header-cell[data-column-key]'
    : '.workspace-leaf.mod-active .kanban-view__column[data-group]';
  const columns = instance.page.locator(selector);
  await expect(columns).toHaveCount(4);
  expect(await columns.evaluateAll((elements, attribute) => elements.map(el => el.getAttribute(attribute)),
    swimlanes ? 'data-column-key' : 'data-group')).toEqual(shopping);
  await expect(instance.page.locator('.workspace-leaf.mod-active .kanban-view__column-count').filter({ hasText: '(2)' })).toHaveCount(1);
  // Reading/rendering must not migrate or rewrite the existing YAML.
  expect(await instance.page.evaluate(async path => {
    const app = (window as any).app;
    return app.vault.read(app.vault.getAbstractFileByPath(path));
  }, path)).toBe(content);
}

test.beforeAll(async () => {
  instance = await launchObsidian();
  originalSettings = await instance.page.evaluate(async ({ statuses, folder }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const original = {
      customStatuses: plugin.settings.customStatuses,
      taskIdentificationMethod: plugin.settings.taskIdentificationMethod,
      taskTag: plugin.settings.taskTag,
      commandFileMapping: plugin.settings.commandFileMapping,
    };
    plugin.settings.customStatuses = statuses.map((value, order) => ({
      id: value, value, label: value, color: '#808080', isCompleted: value === 'done', order,
      autoArchive: false, autoArchiveDelay: 0,
    }));
    plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    plugin.settings.commandFileMapping = {
      ...plugin.settings.commandFileMapping,
      'open-kanban-view': `${folder}/generated.base`,
    };
    await plugin.saveSettings();
    await app.vault.createFolder(folder);
    await app.vault.create(`${folder}/Purchase.md`, '# Purchase\n');
    const statusField = plugin.fieldMapper.toUserField('status');
    const priorityField = plugin.fieldMapper.toUserField('priority');
    for (const [name, status] of [['Amazon', 'received'], ['Newegg', 'received'], ['GTD', 'ready']]) {
      await app.vault.create(`${folder}/${name}.md`, `---\n${statusField}: ${status}\n${priorityField}: normal\ntags: [task]\ntype: "[[${folder}/Purchase]]"\n---\n`);
    }
    return original;
  }, { statuses, folder });
  await expect.poll(() => instance.page.evaluate(async folder => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    const tasks = await Promise.all(['Amazon', 'Newegg', 'GTD'].map(name => plugin.cacheManager.getTaskInfo(`${folder}/${name}.md`)));
    return tasks.filter(Boolean).length;
  }, folder)).toBe(3);
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    if (originalSettings) {
      await instance.page.evaluate(async ({ originalSettings, folder }) => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins.tasknotes;
        Object.assign(plugin.settings, originalSettings);
        plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
        await plugin.saveSettings();
        const fixture = app.vault.getAbstractFileByPath(folder);
        if (fixture) await app.vault.delete(fixture, true);
      }, { originalSettings, folder });
    }
  } finally { await closeObsidian(instance); }
});

for (const placement of ['direct', 'config', 'options']) {
  for (const swimlanes of [false, true]) {
    test(`${placement} settings keep only shopping columns (${swimlanes ? 'swimlanes' : 'flat'})`, async () => {
      const options = { ...settings, ...(swimlanes ? { swimLane: 'priority' } : {}) };
      const view = { ...filteredView(), ...(placement === 'direct' ? options : { [placement]: options }) };
      await renderBase(`${placement}-${swimlanes}`, stringify({ views: [view] }), swimlanes);
    });
  }
}

test('generated default Kanban settings are flat and load through native Bases', async () => {
  const content = await instance.page.evaluate(async folder => {
    const app = (window as any).app;
    await app.plugins.plugins.tasknotes.ensureBasesViewFiles();
    return app.vault.read(app.vault.getAbstractFileByPath(`${folder}/generated.base`));
  }, folder);
  const base = parse(content);
  expect(base.views[0].config).toBeUndefined();
  expect(base.views[0].options).toBeUndefined();
  expect(base.views[0]).toMatchObject({ columnWidth: 280, hideEmptyColumns: false });
  Object.assign(base.views[0], filteredView(), settings);
  await renderBase('generated-filtered', stringify(base));
});

test('exported v3 Kanban settings load through native Bases', async () => {
  const content = await instance.page.evaluate(settings => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    return plugin.basesFilterConverter.convertAllSavedViewsToBasesFile([{
      id: 'issue-2382', name: 'Purchase Board',
      query: { type: 'group', conjunction: 'and', children: [], groupKey: 'status' },
      viewOptions: settings,
    }]);
  }, settings);
  const base = parse(content);
  expect(base.views[0].config).toBeUndefined();
  expect(base.views[0].options).toBeUndefined();
  expect(base.views[0]).toMatchObject(settings);
  Object.assign(base.views[0], filteredView());
  await renderBase('exported', stringify(base));
});
