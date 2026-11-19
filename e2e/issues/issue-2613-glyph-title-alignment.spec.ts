/**
 * Issue #2613: status and priority icons did not line up with the task title. In the wide Task
 * List the priority dot sat about 2px high, and cards whose only content was a wrapping title
 * centred both icons on the whole title, about 10px below its first line.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2613
 */
import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from '../obsidian';

const folder = `Issue2613-${Date.now()}`;
let instance: ObsidianApp;
let page: Page;

const views: Record<string, string> = {
  list: '  - type: tasknotesTaskList\n    name: List\n    order:\n      - status\n      - priority\n      - due\n      - contexts\n',
  kanban: '  - type: tasknotesKanban\n    name: Board\n    groupBy:\n      property: status\n      direction: ASC\n    order:\n      - status\n      - priority\n      - due\n      - contexts\n',
};

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await page.evaluate(async ({ folder, views }) => {
    const app = (window as any).app;
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    const today = (window as any).moment().format('YYYY-MM-DD');
    await app.vault.createFolder(folder);
    // With metadata, and with nothing under the title (scheduled is not shown) and a title that wraps.
    await app.vault.create(`${folder}/Short task.md`, `---\ntags: [task]\ntitle: Short task\nstatus: open\npriority: high\ndue: ${today}\ncontexts: [desk]\n---\n`);
    await app.vault.create(`${folder}/Long task.md`, `---\ntags: [task]\ntitle: A much longer task title that will wrap onto a second line when the column is narrow enough to force it\nstatus: in-progress\npriority: low\nscheduled: ${today}\n---\n`);
    for (const [name, view] of Object.entries(views)) {
      await app.vault.create(`${folder}/${name}.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\nviews:\n${view}`);
    }
  }, { folder, views });
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await page.evaluate(async folder => {
      const app = (window as any).app;
      app.workspace.getLeavesOfType('bases').forEach((leaf: any) => leaf.detach());
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally {
    await closeObsidian(instance);
  }
});

for (const width of [1300, 520]) {
  for (const name of Object.keys(views)) {
    test(`${name} at ${width}px: status and priority centre on the title's first line`, async () => {
      await setObsidianViewport(page, { width, height: 900 });
      await page.evaluate(async path => {
        const app = (window as any).app;
        await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(path));
      }, `${folder}/${name}.base`);
      const cards = page.locator('.workspace-leaf.mod-active .task-card:not(.task-card--layout-inline)');
      await expect(cards).toHaveCount(2, { timeout: 15000 });
      const offsets = await cards.evaluateAll(elements => elements.map(card => {
        const range = document.createRange();
        range.selectNodeContents(card.querySelector('.task-card__title-text')!);
        const line = range.getClientRects()[0];
        const lineMid = (line.top + line.bottom) / 2;
        const offset = (selector: string) => {
          const glyph = card.querySelector(`.task-card__main-row > ${selector} svg`);
          if (!glyph) return 0;
          const box = glyph.getBoundingClientRect();
          // Narrow cards move priority under the status; only the first row is compared.
          if (box.top > line.bottom) return 0;
          return Math.round(Math.abs((box.top + box.bottom) / 2 - lineMid) * 10) / 10;
        };
        return { title: card.querySelector('.task-card__title-text')!.textContent!.slice(0, 10), status: offset('.task-card__status-dot'), priority: offset('.task-card__priority-dot'), lines: range.getClientRects().length };
      }));
      // The long title must actually wrap at the narrow width for the check to mean anything.
      if (width === 520) expect(offsets.some(card => card.lines > 1)).toBe(true);
      for (const card of offsets) {
        expect(card.status, `${card.title} status`).toBeLessThanOrEqual(1);
        expect(card.priority, `${card.title} priority`).toBeLessThanOrEqual(1);
      }
    });
  }
}
