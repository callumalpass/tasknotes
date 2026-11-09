import { test, expect, type Page } from '@playwright/test';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

// Issue #2531: after scrolling a Kanban board sideways, saving a change to a card
// re-rendered the board and reset its horizontal scroll to the left.
let instance: ObsidianApp;
let page: Page;
const folder = `Scroll2531-${Date.now()}`;
const basePath = `${folder}/Board.base`;
const lanes = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8'];
const lastLane = lanes[lanes.length - 1];
const lastLaneCards = 25;

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  const content = stringify({
    filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
    views: [{
      type: 'tasknotesKanban',
      name: 'Board',
      groupBy: { property: 'note.lane', direction: 'ASC' },
      columnWidth: 320,
    }],
  });
  await page.waitForFunction(() => (window as any).app?.plugins?.plugins?.tasknotes?.taskService);
  await page.evaluate(async ({ folder, basePath, content, lanes, lastLaneCards }) => {
    const app = (window as any).app;
    await app.vault.createFolder(folder);
    for (const lane of lanes) {
      const count = lane === lanes[lanes.length - 1] ? lastLaneCards : 1;
      for (let i = 0; i < count; i++) {
        await app.vault.create(
          `${folder}/${lane}-${i}.md`,
          `---\ntitle: ${lane} card ${i}\ntags: [task]\nstatus: open\nlane: ${lane}\n---\n`
        );
      }
    }
    await app.vault.create(basePath, content);
    await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(basePath));
  }, { folder, basePath, content, lanes, lastLaneCards });
  await expect(page.locator('.kanban-view__column')).toHaveCount(lanes.length);
});

test.afterAll(async () => {
  try {
    if (page && !page.isClosed()) await page.evaluate(async folder => {
      const app = (window as any).app;
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally { if (instance) await closeObsidian(instance); }
});

test('saving a card keeps the board and column scroll positions', async () => {
  test.setTimeout(120_000);
  const lastColumn = `.kanban-view__column[data-group="${lastLane}"]`;
  const scrollState = () => page.evaluate(lastColumn => {
    const board = document.querySelector('.kanban-view__board') as HTMLElement;
    const column = document.querySelector(lastColumn);
    const cards = column?.querySelector('.kanban-view__cards') as HTMLElement | null;
    return { left: Math.round(board.scrollLeft), columnTop: Math.round(cards?.scrollTop ?? 0) };
  }, lastColumn);

  const before = await page.evaluate(lastColumn => {
    const board = document.querySelector('.kanban-view__board') as HTMLElement;
    board.scrollLeft = board.scrollWidth;
    const cards = document.querySelector(`${lastColumn} .kanban-view__cards`) as HTMLElement;
    cards.scrollTop = 300;
    // Mark the current DOM so the test can tell when the board has re-rendered.
    (window as any).__kanban2531Column = document.querySelector(lastColumn);
    // Columns are added across several async steps. In a large vault the browser lays
    // the board out between them; force that layout here so the test does not depend
    // on render speed. Layout of a half-built board clamps its scrollLeft.
    new MutationObserver(() => void board.scrollWidth).observe(board, { childList: true });
    return {
      left: Math.round(board.scrollLeft),
      maxLeft: board.scrollWidth - board.clientWidth,
      columnTop: Math.round(cards.scrollTop),
    };
  }, lastColumn);
  expect(before.maxLeft).toBeGreaterThan(200);
  expect(before.left).toBeGreaterThan(200);
  expect(before.columnTop).toBeGreaterThan(100);

  // Open a card in the far column, edit its title in the modal and save,
  // without moving it to another column.
  await page.evaluate(async ({ folder, lastLane }) => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    const task = await plugin.cacheManager.getTaskInfo(`${folder}/${lastLane}-3.md`);
    await plugin.openTaskEditModal(task);
  }, { folder, lastLane });
  const modal = page.locator('.modal.mod-tasknotes').last();
  const title = modal.locator('textarea.title-input');
  await expect(title).toBeVisible();
  await title.fill(`${await title.inputValue()} edited`);
  await modal.locator('.mod-cta').click();
  await expect(modal).toBeHidden();

  await page.waitForFunction(() => !(window as any).__kanban2531Column?.isConnected);
  // Let any trailing data-update render and its restore frame settle.
  await page.waitForTimeout(1_000);
  expect(await scrollState()).toEqual({ left: before.left, columnTop: before.columnTop });
});
