import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchObsidian, closeObsidian, setObsidianViewport } from './obsidian';

test('calendar cards without status controls keep the title in the flexible track', async ({}, testInfo) => {
  test.setTimeout(120000);
  const instance = await launchObsidian();
  const page = instance.page;
  const folder = `Gate8-${Date.now()}`;
  const output = process.env.TASKNOTES_TRACK_EVIDENCE ?? testInfo.outputPath('geometry');
  mkdirSync(output, { recursive: true });
  const properties = await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.settings.defaultVisibleProperties);
  try {
    await page.evaluate(async folder => {
      const host = (window as any).app;
      host.plugins.plugins.tasknotes.settings.defaultVisibleProperties = ['scheduled'];
      host.workspace.leftSplit.collapse();
      host.workspace.rightSplit.collapse();
      await host.vault.createFolder(folder);
      const day = (window as any).moment().format('YYYY-MM-DD');
      await host.vault.create(`${folder}/Task.md`, `---\ntitle: Recurring project check with a readable title\ntags: [task]\nstatus: open\npriority: high\nscheduled: ${day}\nrecurrence: FREQ=DAILY\n---\n`);
      const file = await host.vault.create(`${folder}/Calendar.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\nviews:\n  - type: tasknotesCalendar\n    name: Gate eight\n    calendarView: dayGridMonth\n`);
      const leaf = host.workspace.getLeaf(false);
      await leaf.openFile(file);
      host.workspace.setActiveLeaf(leaf, { focus: true });
    }, folder);
    for (const width of [1180, 700, 400]) for (const theme of ['light', 'dark']) {
      await setObsidianViewport(page, { width, height: 820 });
      await page.evaluate(({ width, theme }) => {
        document.body.classList.remove('theme-light', 'theme-dark', 'is-mobile');
        document.body.classList.add(`theme-${theme}`);
        document.body.classList.toggle('is-mobile', width === 400);
      }, { width, theme });
      const card = page.locator('.tn-calendar-day-panel .task-card').first();
      await expect(card).toBeVisible();
      const geometry = await card.evaluate(card => [card, ...card.querySelectorAll('.task-card__main-row,.task-card__content,.task-card__title,.task-card__title-text,.task-card__status-dot,.task-card__priority-dot,.task-card__metadata,.task-card__context-menu')].map(element => {
        const css = getComputedStyle(element);
        return { className: element.className, bounds: element.getBoundingClientRect().toJSON(), gridArea: css.gridArea, gridTemplateColumns: css.gridTemplateColumns, display: css.display, flex: css.flex, container: css.container };
      }));
      const title = geometry.find(element => element.className === 'task-card__title-text')!;
      const content = geometry.find(element => element.className === 'task-card__content')!;
      const menu = geometry.find(element => element.className === 'task-card__context-menu')!;
      await expect(card.locator('.task-card__status-dot')).toHaveCount(0);
      expect(content.bounds.width).toBeGreaterThanOrEqual(geometry[0].bounds.width - menu.bounds.width - 1);
      expect(content.bounds.left).toBe(geometry[0].bounds.left);
      expect(title.bounds.width).toBeGreaterThanOrEqual(Math.min(160, content.bounds.width / 2));
      expect(geometry[0].bounds.height).toBeLessThanOrEqual(120);
      writeFileSync(`${output}/${theme}-${width}.json`, JSON.stringify(geometry, null, 2));
      await page.screenshot({ path: `${output}/${theme}-${width}.png` });
    }
  } finally {
    await page.evaluate(properties => { (window as any).app.plugins.plugins.tasknotes.settings.defaultVisibleProperties = properties; }, properties);
    await page.evaluate(async folder => {
      const host = (window as any).app;
      for (const leaf of host.workspace.getLeavesOfType('bases')) if (leaf.view.file?.path.startsWith(folder)) leaf.detach();
      const fixture = host.vault.getAbstractFileByPath(folder);
      if (fixture) await host.vault.delete(fixture, true);
    }, folder);
    await closeObsidian(instance);
  }
});
