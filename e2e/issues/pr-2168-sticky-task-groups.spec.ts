import { test, expect, type Page } from '@playwright/test';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from '../obsidian';

test.describe.configure({ mode: 'serial' });
let instance: ObsidianApp;
let page: Page;
const folder = `Sticky2168-${Date.now()}`;
test.beforeAll(async () => {
  test.setTimeout(120_000);
  instance = await launchObsidian();
  page = instance.page;
  await page.evaluate(async folder => {
    const app = (window as any).app;
    await app.vault.createFolder(folder);
    for (let i = 0; i < 160; i++) {
      await app.vault.create(`${folder}/Task ${String(i).padStart(3, '0')}.md`,
        `---\ntags: [task]\nstatus: ${i < 120 ? 'open' : 'done'}\npriority: ${i % 2 ? 'normal' : 'high'}\n---\n`);
    }
  }, folder);
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

for (const count of [40, 160]) {
  for (const theme of ['theme-light', 'theme-dark']) {
    test(`${count} tasks, ${theme}: nested context, mobile width and collapse`, async () => {
      await page.evaluate(theme => {
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(theme);
      }, theme);
      await setObsidianViewport(page, { width: theme === 'theme-dark' ? 430 : 1400, height: 900 });
      const content = stringify({
        filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")', `file.name < "Task ${String(count).padStart(3, '0')}"`] },
        views: [{ type: 'tasknotesTaskList', name: 'Sticky', groupBy: { property: 'status', direction: 'ASC' },
          subGroup: 'note.priority', enableSearch: false }],
      });
      await page.evaluate(async ({ path, content }) => {
        const app = (window as any).app;
        let file = app.vault.getAbstractFileByPath(path);
        if (file) await app.vault.modify(file, content);
        else file = await app.vault.create(path, content);
        await app.workspace.getLeaf(false).openFile(file);
      }, { path: `${folder}/${count}-${theme}.base`, content });
      const items = page.locator('.tn-tasknotesTaskList .tn-bases-items-container');
      await expect(items.locator('.task-card').first()).toBeVisible();
      if (count === 160) await expect(items.locator('.virtual-scroller__content')).toHaveCount(1);
      await expect(async () => {
        await items.evaluate(el => { el.scrollTop = 600; });
        await expect.poll(() => items.evaluate(el => el.scrollTop)).toBe(600);
        if (count === 160) await expect(items.locator('.task-list-virtual-sticky-header .task-group')).toHaveCount(2);
      }).toPass({ timeout: 15_000 });
      if (count === 160) {
        const pin = items.locator('.task-list-virtual-sticky-header');
        await expect(pin.locator('.task-group')).toHaveCount(2);
        await expect(pin).toHaveAttribute('aria-hidden', 'true');
        await expect(pin.locator('button').first()).toHaveAttribute('tabindex', '-1');
        const key = await pin.locator('button').last().getAttribute('data-group-key');
        await pin.locator('button').last().click();
        await expect.poll(() => page.evaluate(() => (window as any).app.workspace.activeLeaf.view.controller.view.getEphemeralState().collapsedSubGroups)).toContain(key);
      } else {
        const parent = items.locator('.task-list-group > .task-group').first();
        const sub = items.locator('.task-list-subgroup > .task-group').first();
        await expect.poll(async () => {
          const p = await parent.boundingBox(), s = await sub.boundingBox();
          return s!.y >= p!.y + p!.height - 1;
        }).toBe(true);
        await sub.locator('button').click();
        await expect(items.locator('.task-group.is-collapsed').first()).toBeVisible();
      }
      await page.screenshot({ path: `test-results/pr-2168-${count}-${theme}.png` });
    });
  }
}

test('grouped card drag still writes the target status', async () => {
  await setObsidianViewport(page, { width: 1400, height: 900 });
  const content = stringify({
    filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")',
      'file.name == "Task 000" || file.name == "Task 121"'] },
    views: [{ type: 'tasknotesTaskList', name: 'Drag', groupBy: { property: 'status', direction: 'ASC' },
      subGroup: 'note.priority', enableSearch: false }],
  });
  await page.evaluate(async ({ path, content }) => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).openFile(await app.vault.create(path, content));
  }, { path: `${folder}/Drag.base`, content });
  const card = page.locator(`.task-card[data-task-path="${folder}/Task 000.md"]`);
  const target = page.locator('.task-list-group > .task-group[data-group-key="done"]');
  await expect(card).toBeVisible();
  await card.locator('.task-card__title').dragTo(target);
  await expect.poll(() => page.evaluate(async path => {
    const app = (window as any).app;
    return app.vault.read(app.vault.getAbstractFileByPath(path));
  }, `${folder}/Task 000.md`)).toMatch(/status: done/);
});

test('sidebar embed keeps both virtual headers visible deep in the parent note scroller', async () => {
  await setObsidianViewport(page, { width: 1400, height: 900 });
  await page.evaluate(async folder => {
    const app = (window as any).app;
    const file = await app.vault.create(`${folder}/Embed.md`,
      '# Before the list\n\n' + 'Preamble paragraph.\n\n'.repeat(12) + `![[${folder}/160-theme-light.base]]\n`);
    const leaf = app.workspace.getLeftLeaf(false);
    await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode: 'preview' }, active: true });
    app.workspace.leftSplit.expand();
    await app.workspace.revealLeaf(leaf);
  }, folder);
  const preview = page.locator('.mod-left-split .markdown-preview-view');
  await expect(preview).toBeVisible();
  await preview.evaluate(el => { el.scrollTop = 650; });
  const items = page.locator('.mod-left-split .tn-bases-items-container').filter({ has: page.locator('.virtual-scroller__content') });
  await expect(items.locator('.virtual-scroller__content')).toHaveCount(1);
  const pin = items.locator('.task-list-virtual-sticky-header');
  await expect(async () => {
    await items.evaluate(el => {
      let scroller = el.parentElement!;
      while (!['auto', 'scroll'].includes(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement!;
      scroller.scrollTop += el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + 2400;
    });
    await expect(pin.locator('.task-group')).toHaveCount(2);
    await expect.poll(() => pin.evaluate(el => {
      let scroller = el.parentElement!.parentElement!;
      while (!['auto', 'scroll'].includes(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement!;
      return Math.abs(el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - parseFloat(getComputedStyle(scroller).paddingTop));
    })).toBeLessThan(5);
  }).toPass({ timeout: 20_000 });
  await page.screenshot({ path: 'test-results/pr-2168-sidebar-embed.png' });
});
