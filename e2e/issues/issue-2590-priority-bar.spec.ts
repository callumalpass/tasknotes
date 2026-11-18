/**
 * Issue #2590: in 5.0 Bases views, priority was only a small dot at the far end of the card, and
 * nothing for tasks with no priority. Cards with a ranked priority now also get a bar in the
 * priority's colour along their left edge.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2590
 */
import { test, expect, type Page } from '@playwright/test';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from '../obsidian';

const folder = `Issue2590-${Date.now()}`;
let instance: ObsidianApp;
let page: Page;

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await page.evaluate(async folder => {
    const app = (window as any).app;
    await app.vault.createFolder(folder);
    for (const priority of ['high', 'none', '']) {
      const name = priority || 'missing';
      await app.vault.create(`${folder}/Priority ${name}.md`,
        `---\ntags: [task]\ntitle: Priority ${name}\nstatus: open\n${priority ? `priority: ${priority}\n` : ''}---\n`);
    }
  }, folder);
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await page.evaluate(async folder => {
      const app = (window as any).app;
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally {
    await closeObsidian(instance);
  }
});

async function openView(name: string, order: string[]) {
  const content = stringify({
    filters: { and: [`file.inFolder("${folder}")`, 'file.ext == "md"'] },
    views: [{ type: 'tasknotesTaskList', name, order }],
  });
  await page.evaluate(async ({ path, content }) => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).openFile(await app.vault.create(path, content));
  }, { path: `${folder}/${name}.base`, content });
  return page.locator('.workspace-leaf.mod-active');
}

function bar(page: Page, card: ReturnType<Page['locator']>) {
  return card.evaluate(element => {
    const style = getComputedStyle(element, '::after');
    return style.content === 'none' ? null : { color: style.backgroundColor, width: parseFloat(style.width) };
  });
}

test('cards with a ranked priority get a priority-coloured bar when the view shows priority', async () => {
  const leaf = await openView('With priority', ['status', 'priority']);
  const card = (title: string) => leaf.locator('.task-card').filter({ hasText: title }).first();
  await expect(card('Priority high')).toBeVisible();

  const high = await bar(page, card('Priority high'));
  expect(high).toEqual({ color: 'rgb(255, 0, 0)', width: 3 });
  expect(await bar(page, card('Priority none'))).toBeNull();
  expect(await bar(page, card('Priority missing'))).toBeNull();

  // The bar follows priority edits on a card that is already rendered.
  await page.evaluate(async folder => {
    const app = (window as any).app;
    const file = app.vault.getAbstractFileByPath(`${folder}/Priority none.md`);
    await app.fileManager.processFrontMatter(file, (fm: any) => { fm.priority = 'low'; });
  }, folder);
  await expect.poll(() => bar(page, card('Priority none'))).toEqual({ color: 'rgb(0, 170, 0)', width: 3 });
});

test('cards get no priority bar when the view does not show priority', async () => {
  const leaf = await openView('Without priority', ['status']);
  const card = leaf.locator('.task-card').filter({ hasText: 'Priority high' }).first();
  await expect(card).toBeVisible();
  expect(await bar(page, card)).toBeNull();
});

// Second report on #2590: views embedded in Markdown table cells, one per column. Table columns
// size to their content, so the cells shrank until each card was only its status and priority
// icons, and centred columns centred the titles.
for (const mode of ['preview', 'source'] as const) {
  test(`task list embedded in a table cell keeps readable cards (${mode === 'preview' ? 'Reading view' : 'Live Preview'})`, async () => {
    const base = stringify({
      filters: { and: [`file.inFolder("${folder}")`, 'file.ext == "md"', 'file.hasTag("task")'] },
      views: ['1', '2', '3'].map(name => ({ type: 'tasknotesTaskList', name, order: ['status', 'priority'] })),
    });
    const note = `| Today | This Week | On-Hold |\n| :---: | :---: | :---: |\n` +
      `| ![[${folder}/Columns.base#1]] | ![[${folder}/Columns.base#2]] | ![[${folder}/Columns.base#3]] |\n`;
    await page.evaluate(async ({ folder, base, note, mode }) => {
      const app = (window as any).app;
      if (!app.vault.getAbstractFileByPath(`${folder}/Columns.base`)) await app.vault.create(`${folder}/Columns.base`, base);
      const path = `${folder}/Table ${mode}.md`;
      const file = app.vault.getAbstractFileByPath(path) ?? await app.vault.create(path, note);
      await app.workspace.getLeaf(false).setViewState({ type: 'markdown', state: { file: file.path, mode, source: false } });
    }, { folder, base, note, mode });

    const cards = page.locator('.workspace-leaf.mod-active table .task-card').filter({ hasText: 'Priority high' });
    await expect(cards).toHaveCount(3);
    for (const card of await cards.all()) {
      const layout = await card.evaluate(element => {
        const title = element.querySelector<HTMLElement>('.task-card__title-text')!;
        return {
          card: element.getBoundingClientRect().width,
          title: title.getBoundingClientRect().width,
          align: getComputedStyle(title).textAlign,
          glyph: element.querySelector('.task-card__priority-dot')!.getBoundingClientRect().height,
        };
      });
      expect(layout.card).toBeGreaterThan(200);
      expect(layout.title).toBeGreaterThan(50);
      expect(layout.align).toBe('start');
      expect(layout.glyph).toBeLessThanOrEqual(24);
      expect(await bar(page, card)).toEqual({ color: 'rgb(255, 0, 0)', width: 3 });
    }
  });
}
