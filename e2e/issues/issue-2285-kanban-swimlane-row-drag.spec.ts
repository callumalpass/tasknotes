/**
 * Issue #2285 (superseded PR #1862): drag Kanban swimlane labels to reorder rows.
 * The new order is saved as the view's swimLaneOrder and survives reopening the base.
 */
import { test, expect } from '@playwright/test';
import { parse, stringify } from 'yaml';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

const folder = `Issue2285-${Date.now()}`;
const basePath = `${folder}/Rows.base`;
const labels = '.workspace-leaf.mod-active .kanban-view__swimlane-label[data-swimlane-key]';
let instance: ObsidianApp;

async function rowOrder(): Promise<string[]> {
  return instance.page.locator(labels).evaluateAll(elements =>
    elements.map(el => el.getAttribute('data-swimlane-key') ?? ''));
}

async function openBase(): Promise<void> {
  await instance.page.evaluate(async path => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(path));
  }, basePath);
}

test.beforeAll(async () => {
  instance = await launchObsidian();
  await instance.page.evaluate(async ({ folder, basePath, content }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    await app.vault.createFolder(folder);
    for (const [name, area] of [['One', 'alpha'], ['Two', 'beta'], ['Three', 'gamma']]) {
      await app.vault.create(
        `${folder}/${name}.md`,
        `---\n${plugin.fieldMapper.toUserField('status')}: open\narea: ${area}\ntags: [${plugin.settings.taskTag}]\n---\n`
      );
    }
    await app.vault.create(basePath, content);
  }, {
    folder,
    basePath,
    content: stringify({
      views: [{
        type: 'tasknotesKanban',
        name: 'Rows',
        filters: { and: [`file.inFolder("${folder}")`, 'file.ext == "md"'] },
        groupBy: { property: 'status', direction: 'ASC' },
        swimLane: 'note.area',
      }],
    }),
  });
  await openBase();
  await expect.poll(async () => [...await rowOrder()].sort()).toEqual(['alpha', 'beta', 'gamma']);
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await instance.page.evaluate(async folder => {
      const app = (window as any).app;
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally {
    await closeObsidian(instance);
  }
});

test('dragging a swimlane label reorders rows and saves the order', async () => {
  const page = instance.page;
  const [first, second, last] = await rowOrder();
  const expected = [last, first, second];
  await page.locator(`${labels}[data-swimlane-key="${last}"]`)
    .dragTo(page.locator(`${labels}[data-swimlane-key="${first}"]`));

  await expect.poll(rowOrder).toEqual(expected);
  await expect.poll(async () => {
    const content = await page.evaluate(async path => {
      const app = (window as any).app;
      return app.vault.read(app.vault.getAbstractFileByPath(path));
    }, basePath);
    const saved = parse(content).views[0].swimLaneOrder ?? '{}';
    return (typeof saved === 'string' ? JSON.parse(saved) : saved)['note.area'];
  }).toEqual(expected);

  // Cards stay in their rows: dropping a row is not a card move.
  const areas = await page.evaluate(async folder => {
    const app = (window as any).app;
    return ['One', 'Two', 'Three'].map(name =>
      app.metadataCache.getCache(`${folder}/${name}.md`)?.frontmatter?.area);
  }, folder);
  expect(areas).toEqual(['alpha', 'beta', 'gamma']);

  await page.evaluate(() => (window as any).app.workspace.getLeaf(false).detach());
  await openBase();
  await expect.poll(rowOrder).toEqual(expected);
});
