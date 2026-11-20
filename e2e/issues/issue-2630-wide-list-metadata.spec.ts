/**
 * Issue #2630: from 640px a Task List row goes on one line with its dates and properties in a
 * right-hand column. That column could be narrower than the two date slots, so the start of the
 * line (the scheduled date, the +N count) was clipped. With "Show all properties on task cards"
 * the project shrank to 0px and broke after every letter (a 230px row). With the setting off,
 * widening the list again never brought the hidden project back.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2630
 */
import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from '../obsidian';

const folder = `Issue2630-${Date.now()}`;
let instance: ObsidianApp;
let page: Page;
let originalWrap: unknown;

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await setObsidianViewport(page, { width: 1400, height: 900 });
  originalWrap = await page.evaluate(async folder => {
    const app = (window as any).app;
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    await app.vault.createFolder(folder);
    await app.vault.create(`${folder}/Paint the garden fence.md`, '---\ntitle: Paint the garden fence\nstatus: open\npriority: normal\nscheduled: 2026-11-24\ndue: 2026-11-28\nprojects:\n  - "[[Garden makeover]]"\ntags:\n  - task\n---\n');
    await app.vault.create(`${folder}/Tasks.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\nviews:\n  - type: tasknotesTaskList\n    name: Tasks\n    order:\n      - note.status\n      - note.priority\n      - note.due\n      - note.scheduled\n      - note.projects\n`);
    return app.plugins.plugins.tasknotes.settings.wrapTaskCardProperties;
  }, folder);
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await page.evaluate(async ({ folder, originalWrap }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      plugin.settings.wrapTaskCardProperties = originalWrap;
      await plugin.saveSettings();
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, { folder, originalWrap });
  } finally {
    await closeObsidian(instance);
  }
});

async function open(wrap: boolean) {
  await page.evaluate(async ({ folder, wrap }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    plugin.settings.wrapTaskCardProperties = wrap;
    await plugin.saveSettings();
    const leaf = app.workspace.getMostRecentLeaf();
    await leaf.openFile(app.vault.getAbstractFileByPath(`${folder}/Paint the garden fence.md`));
    await leaf.openFile(app.vault.getAbstractFileByPath(`${folder}/Tasks.base`));
  }, { folder, wrap });
  await expect(page.locator('.workspace-leaf.mod-active .tn-tasknotesTaskList .task-card')).toHaveCount(1, { timeout: 15000 });
}

/** Resizes the window until the Task List is `width` pixels wide, then measures the row. */
async function measureAt(width: number) {
  const list = page.locator('.workspace-leaf.mod-active .tn-tasknotesTaskList');
  for (let i = 0; i < 4; i++) {
    const current = await list.evaluate(element => element.getBoundingClientRect().width);
    if (Math.abs(current - width) < 0.5) break;
    await setObsidianViewport(page, { width: Math.round(page.viewportSize()!.width + width - current), height: 900 });
  }
  await page.waitForTimeout(300);
  return list.locator('.task-card').evaluate(card => {
    const line = card.querySelector('.task-card__metadata')!.getBoundingClientRect();
    const shown = (selector: string) => {
      const element = card.querySelector<HTMLElement>(selector);
      return !!element && !element.closest('[hidden]');
    };
    // Every visible item on the metadata line starts inside it and has some width.
    const clipped = Array.from(card.querySelectorAll<HTMLElement>('.task-card__metadata > *, .task-card__metadata-values > *'))
      .filter(element => element.offsetParent)
      .filter(element => {
        const box = element.getBoundingClientRect();
        return box.left < line.left - 0.5 || box.width < 1;
      })
      .map(element => element.className);
    return {
      list: Math.round(card.closest('.tn-tasknotesTaskList')!.getBoundingClientRect().width),
      height: Math.round(card.getBoundingClientRect().height),
      clipped,
      project: shown('.task-card__project-link'),
      count: shown('.task-card__metadata-overflow'),
    };
  });
}

test('"Show all properties" rows stay readable from 640px', async () => {
  await open(true);
  for (const width of [640, 700, 900]) {
    const row = await measureAt(width);
    expect(row.list, 'list width').toBe(width);
    expect(row.clipped, `${width}px`).toEqual([]);
    expect(row.project, `${width}px`).toBe(true);
    // Was 230px from 640 to 700px. The project now wraps between words: at most two lines.
    expect(row.height, `${width}px`).toBeLessThanOrEqual(width >= 900 ? 32 : 56);
  }
});

test('the +N count stays visible and hidden properties return when the list widens', async () => {
  await open(false);
  const narrow = await measureAt(640);
  expect(narrow.clipped).toEqual([]);
  expect(narrow).toMatchObject({ project: false, count: true, height: 32 });
  const wide = await measureAt(1000);
  expect(wide).toMatchObject({ clipped: [], project: true, count: false });
});
