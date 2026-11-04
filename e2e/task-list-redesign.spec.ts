import { test, expect, type Page } from '@playwright/test';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
let page: Page;
const folder = `ListRedesign-${Date.now()}`;
const longTag = 'a-tag-with-a-very-long-unbroken-segment-' + 'x'.repeat(90);

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await page.evaluate(async ({ folder, longTag }) => {
    const app = (window as any).app;
    await app.vault.createFolder(folder);
    for (let index = 0; index < 6; index++) {
      await app.vault.create(`${folder}/Task ${index}.md`,
        `---\ntags: [task, ${index === 3 ? longTag : 'design'}]\ntitle: ${index === 3 ? 'A long task title '.repeat(12) : `Task ${index}`}\nstatus: ${index < 4 ? 'open' : 'done'}\npriority: high\ndue: 2027-02-27\nscheduled: 2027-02-25\n${index % 2 ? 'recurrence: FREQ=DAILY\n' : ''}${index === 2 ? `blockedBy: [\"[[${folder}/Task 0]]\"]\n` : ''}${index === 5 ? `projects: [\"[[${folder}/Task 1]]\"]\n` : ''}---\n${index % 2 ? 'Task details to make indicator widths differ.' : ''}`);
    }
  }, { folder, longTag });
});

test.afterAll(async () => {
  try {
    if (page && !page.isClosed()) await page.evaluate(async folder => {
      const app = (window as any).app;
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally {
    if (instance) await closeObsidian(instance);
  }
});

for (const theme of ['theme-light', 'theme-dark']) {
  test(`${theme}: aligned dates, chips, group actions and narrow wrapping`, async () => {
    await setObsidianViewport(page, { width: 1180, height: 800 });
    await page.evaluate(theme => {
      document.body.classList.remove('theme-light', 'theme-dark', 'is-mobile');
      document.body.classList.add(theme);
    }, theme);
    const content = stringify({
      filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
      views: [{ type: 'tasknotesTaskList', name: 'List', groupBy: { property: 'status', direction: 'DESC' },
        order: ['status', 'priority', 'tags', 'scheduled', 'due'], enableSearch: false }],
    });
    await page.evaluate(async ({ path, content }) => {
      const app = (window as any).app;
      await app.workspace.getLeaf(false).openFile(await app.vault.create(path, content));
      app.workspace.leftSplit.collapse();
      app.workspace.rightSplit.collapse();
    }, { path: `${folder}/${theme}.base`, content });
    const items = page.locator('.workspace-leaf.mod-active .tn-bases-items-container');
    await expect(items.locator('.task-card')).toHaveCount(6);
    const dates = items.locator('.task-card__metadata-date--due');
    await expect(dates).toHaveCount(6);
    const positions = await dates.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().x));
    expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(1);
    await expect(items.locator('.task-card__title .task-card__badges').first()).toHaveCount(1);
    const tag = items.locator('.task-card__metadata-property--tags .tag').first();
    expect(await tag.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    const desktopLongTag = items.locator('.tag').filter({ hasText: longTag });
    expect(await desktopLongTag.evaluate(element => {
      const nextDate = element.closest('.task-card__metadata')!.querySelector('.task-card__metadata-date')!;
      return element.getBoundingClientRect().right <= nextDate.getBoundingClientRect().left;
    })).toBe(true);
    for (const [path, toggle, expansion] of [
      ['Task 1', '.task-card__chevron', '.task-card__subtasks'],
      ['Task 0', '.task-card__blocking-toggle', '.task-card__blocking'],
      ['Task 2', '.task-card__blocked-toggle', '.task-card__blocked-by'],
    ]) {
      const card = items.locator(`.task-card[data-task-path="${folder}/${path}.md"]`).first();
      await card.locator(toggle).first().click();
      await expect(card.locator(expansion).first()).toBeVisible();
      await card.locator(toggle).first().click();
      await expect(card.locator(expansion)).toHaveCount(0);
    }
    await expect(items.locator('.task-group-glyph[data-tn-glyph]').first()).toBeVisible();
    const group = items.locator('.task-list-group > .task-group').first();
    await group.hover();
    await expect(group.locator('.task-group-add')).toHaveCSS('opacity', '1');
    await group.locator('.task-group-add').click();
    await expect(page.locator('.modal.mod-tasknotes')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(group.locator('.task-group-toggle')).toHaveAttribute('aria-expanded', 'true');
    await group.locator('.task-group-toggle').click();
    await expect(group.locator('.task-group-toggle')).toHaveAttribute('aria-expanded', 'false');
    await group.locator('.task-group-toggle').click();
    await page.screenshot({ path: `test-results/list-redesign-${theme}-wide.png` });
    await setObsidianViewport(page, { width: 430, height: 800 });
    await page.evaluate(() => {
      document.body.classList.add('is-mobile');
      document.body.style.setProperty('--font-text-size', '20px');
    });
    const longCard = items.locator(`.task-card[data-task-path="${folder}/Task 3.md"]`);
    await longCard.scrollIntoViewIfNeeded();
    await expect(longCard.locator('.task-card__title')).toHaveCSS('font-size', '20px');
    const longTagElement = longCard.locator('.tag').filter({ hasText: longTag });
    await expect(longTagElement).toHaveCSS('white-space', 'normal');
    expect(await longTagElement.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    expect(await items.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-results/list-redesign-${theme}-narrow.png` });
    await page.evaluate(() => {
      document.body.classList.remove('is-mobile');
      document.body.style.removeProperty('--font-text-size');
    });
  });
}
