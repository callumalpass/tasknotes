import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { launchObsidian, closeObsidian, setObsidianViewport } from './obsidian';

test('Year activity shading survives at desktop and phone widths in both themes', async () => {
  test.setTimeout(120000);
  const evidence = process.env.TASKNOTES_E2E_EVIDENCE_DIR ?? join(tmpdir(), 'tasknotes-year-activity');
  mkdirSync(evidence, { recursive: true });
  const instance = await launchObsidian();
  const page = instance.page;
  const folder = `YearActivity-${Date.now()}`;
  const observations = [];
  try {
    await page.evaluate(async folder => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      plugin.settings.taskIdentificationMethod = 'tag';
      plugin.settings.taskTag = 'task';
      await app.vault.createFolder(folder);
      const today = (window as any).moment().format('YYYY-MM-DD');
      for (let index = 0; index < 8; index++) {
        await app.vault.create(`${folder}/Task ${index}.md`, `---\ntags: [task]\nstatus: open\nscheduled: ${today}\n---\n`);
      }
      const file = await app.vault.create(`${folder}/Year.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\nviews:\n  - type: tasknotesCalendar\n    name: Year\n    calendarView: multiMonthYear\n`);
      const leaf = app.workspace.getLeaf(true);
      await leaf.openFile(file);
      app.workspace.setActiveLeaf(leaf, { focus: true });
      app.workspace.leftSplit.collapse();
      app.workspace.rightSplit.collapse();
    }, folder);
    const year = page.locator('.workspace-leaf.mod-active .tnc-year');
    await expect(year).toBeVisible();
    await expect(year.locator('.tnc-ym-day.has-items').first()).toBeAttached();
    await expect.poll(() => year.locator('.tnc-ym-day.has-items').evaluateAll(days =>
      Math.max(...days.map(day => Number((day as HTMLElement).style.getPropertyValue('--tnc-heat'))))
    )).toBe(1);
    for (const width of [1180, 400]) for (const theme of ['light', 'dark']) {
      await setObsidianViewport(page, { width, height: 800 });
      await page.evaluate(({ width, theme }) => {
        document.body.classList.toggle('is-mobile', width === 400);
        document.body.classList.toggle('theme-light', theme === 'light');
        document.body.classList.toggle('theme-dark', theme === 'dark');
      }, { width, theme });
      const activity = year.locator('.tnc-ym-day.has-items[style*="--tnc-heat: 1;"]').first();
      await activity.scrollIntoViewIfNeeded();
      const colors = await year.evaluate(element => {
        const active = [...element.querySelectorAll<HTMLElement>('.tnc-ym-day.has-items')].find(day => Number(day.style.getPropertyValue('--tnc-heat')) === 1)!;
        const empty = element.querySelector<HTMLElement>('.tnc-ym-day:not(.has-items)')!;
        return {
          activity: getComputedStyle(active).backgroundColor,
          empty: getComputedStyle(empty).backgroundColor,
          heat: active.style.getPropertyValue('--tnc-heat'),
        };
      });
      expect(colors.activity).not.toBe(colors.empty);
      expect(colors.activity).not.toMatch(/^(?:transparent|rgba\(0, 0, 0, 0\))$|\/ 0\)$/);
      expect(Number(colors.heat)).toBe(1);
      observations.push({ width, theme, ...colors });
      await page.screenshot({ path: join(evidence, `year-${width}-${theme}.png`) });
    }
  } finally {
    writeFileSync(join(evidence, 'year-activity.json'), JSON.stringify(observations, null, 2));
    if (!page.isClosed()) await page.evaluate(async folder => {
      const app = (window as any).app;
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
    await closeObsidian(instance);
  }
});
