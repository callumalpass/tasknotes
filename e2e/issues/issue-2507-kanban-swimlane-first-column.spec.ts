/**
 * Issue #2507: in windows 769-1200px wide, the sticky swimlane label grew past its
 * grid track and covered the left edge of the first column. Scrolling could not reveal it.
 */
import { test, expect } from '@playwright/test';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from '../obsidian';

const folder = `Issue2507-${Date.now()}`;
const basePath = `${folder}/Board.base`;
let instance: ObsidianApp;

test.beforeAll(async () => {
  instance = await launchObsidian();
  await instance.page.evaluate(async ({ folder, basePath, content }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    await app.vault.createFolder(folder);
    await app.vault.create(
      `${folder}/One.md`,
      `---\n${plugin.fieldMapper.toUserField('status')}: open\narea: alpha\ntags: [${plugin.settings.taskTag}]\n---\n`
    );
    await app.vault.create(basePath, content);
    await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(basePath));
  }, {
    folder,
    basePath,
    content: stringify({
      views: [{
        type: 'tasknotesKanban',
        name: 'Board',
        filters: { and: [`file.inFolder("${folder}")`, 'file.ext == "md"'] },
        groupBy: { property: 'status', direction: 'ASC' },
        swimLane: 'note.area',
      }],
    }),
  });
  await instance.page.locator('.workspace-leaf.mod-active .kanban-view__swimlane-column').first().waitFor();
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await instance.page.evaluate(async folder => {
      await (window as any).app.vault.adapter.rmdir(folder, true);
    }, folder);
  } finally {
    await closeObsidian(instance);
  }
});

test('the swimlane label does not cover the first column at narrow widths', async () => {
  for (const width of [1200, 1080, 769]) {
    await setObsidianViewport(instance.page, { width, height: 1400 });
    await expect.poll(() => instance.page.evaluate(() => window.innerWidth)).toBe(width);

    const coveredRows = await instance.page
      .locator('.workspace-leaf.mod-active .kanban-view__swimlane-label')
      .evaluateAll(labels => labels.flatMap(label => {
        const cell = label.nextElementSibling as HTMLElement;
        const { left, top } = cell.getBoundingClientRect();
        return cell.contains(document.elementFromPoint(left + 2, top + 2)) ? [] : [label.outerHTML];
      }));
    expect(coveredRows, `width ${width}`).toEqual([]);
  }
});
