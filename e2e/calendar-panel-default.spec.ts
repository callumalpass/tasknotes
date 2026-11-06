import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
const folder = `PanelDefault-${Date.now()}`;
const root = '.workspace-leaf.mod-active #bases-calendar';

test.beforeAll(async () => {
  instance = await launchObsidian();
  await instance.page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    (window as any).panelDefaultSettings = structuredClone(plugin.settings);
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    await app.vault.createFolder(folder);
    for (const day of [9, 10, 11, 12, 13]) {
      for (let index = 0; index < 12; index++) {
        await app.vault.create(`${folder}/Task-${day}-${index}.md`, `---\ntitle: Review ${day} proposal ${index} with the product team\ntags: [task]\nstatus: open\npriority: normal\nscheduled: 2026-11-${day.toString().padStart(2, '0')}\n---\n`);
      }
    }
    for (const [name, option] of [['Default', undefined], ['Enabled', true], ['Disabled', false]]) {
      await app.vault.create(`${folder}/${name}.base`, JSON.stringify({
        filters: { and: [`file.inFolder("${folder}")`] },
        views: [{ type: 'tasknotesCalendar', name, calendarView: 'dayGridMonth', showMonthDayPanel: option, showDue: false, showOverdueOnToday: false }],
      }));
    }
  }, folder);
  const notice = instance.page.locator('.notice').filter({ hasText: 'Secrets are stored without encryption' });
  if (await notice.count()) await notice.click({ position: { x: 8, y: 8 } });
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await instance.page.evaluate(async folder => {
      const app = (window as any).app;
      app.plugins.plugins.tasknotes.settings = (window as any).panelDefaultSettings;
      (window as any).panelDefaultLeaf?.detach();
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally {
    await closeObsidian(instance);
  }
});

async function openMonth(name: string) {
  await instance.page.evaluate(async ({ folder, name }) => {
    const app = (window as any).app;
    const leaf = app.workspace.getLeaf(false);
    (window as any).panelDefaultLeaf = leaf;
    await leaf.openFile(app.vault.getAbstractFileByPath(`${folder}/${name}.base`));
    app.workspace.setActiveLeaf(leaf, { focus: true });
  }, { folder, name });
  await expect(instance.page.locator(`${root} .tnc-dg-day`).first()).toBeVisible();
  await instance.page.evaluate(() => (window as any).panelDefaultLeaf.view.controller.view.calendar.gotoDate('2026-11-10'));
  await expect(instance.page.locator(`${root} > .tnc .tnc-item`).first()).toBeVisible();
}

test('month defaults to a full-height grid and preserves explicit panel settings and day actions', async () => {
  const page = instance.page;
  for (const width of [1180, 700, 400]) {
    await setObsidianViewport(page, { width, height: 820 });
    for (const name of ['Default', 'Enabled', 'Disabled']) {
      await openMonth(name);
      const enabled = name === 'Enabled';
      await expect.poll(() => page.evaluate(() => (window as any).panelDefaultLeaf.view.controller.view.viewOptions.showMonthDayPanel)).toBe(enabled);
      await expect(page.locator(`${root} .tn-calendar-day-panel`)).toHaveCount(enabled ? 1 : 0);
      if (enabled) {
        await page.locator(`${root} > .tnc .tnc-dg-day[data-date="2026-11-10"] .tnc-dg-num`).click();
        await expect(page.locator(`${root} .tn-calendar-day-panel .task-card`)).toHaveCount(12);
        await expect(page.locator(`${root} .tn-calendar-day-panel-add`)).toBeVisible();
        if (width < 1180) expect((await page.locator(`${root} .tn-calendar-day-panel`).boundingBox())!.y).toBeLessThan(700);
      } else {
        const geometry = await page.locator(root).evaluate(element => {
          const host = element.getBoundingClientRect();
          const grid = element.querySelector(':scope > .tnc')!.getBoundingClientRect();
          const style = getComputedStyle(element);
          return { widthGap: element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - grid.width, bottomGap: host.bottom - parseFloat(style.paddingBottom) - grid.bottom, display: style.display };
        });
        expect(geometry.display).toBe('flex');
        expect(Math.abs(geometry.widthGap)).toBeLessThanOrEqual(2);
        expect(Math.abs(geometry.bottomGap)).toBeLessThanOrEqual(2);
        const day = page.locator(`${root} .tnc-dg-day[data-date="2026-11-15"]`);
        await day.click({ position: { x: 8, y: (await day.boundingBox())!.height - 5 } });
        await expect(page.locator('.menu-item-title:visible').filter({ hasText: /^Create task$/ }).last()).toBeVisible();
        await page.keyboard.press('Escape');
      }
    }
  }
  await openMonth('Default');
  const dailyPath = await page.evaluate(async folder => {
    const app = (window as any).app;
    const daily = app.internalPlugins.plugins['daily-notes'].instance;
    (window as any).panelDefaultDailyOptions = { ...daily.options };
    daily.options.folder = folder;
    daily.options.format = 'YYYY-MM-DD';
    const path = `${folder}/2026-11-15.md`;
    await app.vault.create(path, '# Daily note control\n');
    return path;
  }, folder);
  try {
    await page.locator(`${root} .tnc-dg-day[data-date="2026-11-15"] .tnc-dg-num`).click();
    await expect.poll(() => page.evaluate(() => (window as any).app.workspace.getActiveFile()?.path)).toBe(dailyPath);
  } finally {
    await page.evaluate(() => {
      (window as any).app.internalPlugins.plugins['daily-notes'].instance.options = (window as any).panelDefaultDailyOptions;
    });
  }
});

test('panel-off dense months keep readable chips and reachable overflow in both themes', async ({}, testInfo) => {
  const page = instance.page;
  await openMonth('Default');
  for (const width of [1180, 700, 400]) {
    await setObsidianViewport(page, { width, height: 820 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => {
        document.body.classList.toggle('theme-light', theme === 'light');
        document.body.classList.toggle('theme-dark', theme === 'dark');
        (window as any).app.workspace.trigger('css-change');
      }, theme);
      const month = page.locator(`${root} .tnc-dg`);
      if (width < 1180) await expect(month).toHaveClass(/tnc-dg--chips/);
      else await expect(month).not.toHaveClass(/tnc-dg--chips/);
      await expect(page.locator(`${root} .tn-calendar-day-panel`)).toHaveCount(0);
      if (width === 1180) {
        await page.screenshot({ path: testInfo.outputPath(`month-panel-off-${width}-${theme}.png`) });
        continue;
      }
      const day = page.locator(`${root} .tnc-dg-day[data-date="2026-11-10"]`);
      const chip = day.locator('.tnc-item--indicator').first();
      await expect(chip).toContainText('Review');
      await expect(chip.locator('.tnc-item-title')).toBeVisible();
      await expect.poll(() => chip.evaluate(element => {
        const context = document.createElement('canvas').getContext('2d')!;
        const luminance = (color: string) => {
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          const channels = Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3).map(value => {
            const channel = value / 255;
            return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
          });
          return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
        };
        const style = getComputedStyle(element);
        const foreground = luminance(style.color);
        const background = luminance(style.backgroundColor);
        return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
      })).toBeGreaterThanOrEqual(4.5);
      await page.screenshot({ path: testInfo.outputPath(`month-panel-off-${width}-${theme}.png`) });
      const more = day.locator('.tnc-dg-dots-more');
      await expect(more).toBeVisible();
      expect(await day.locator('.tnc-item--indicator').count() + Number((await more.innerText()).slice(1))).toBe(12);
      await more.click();
      const popover = page.locator('.tnc-popover');
      await expect(popover).toBeVisible();
      await expect(popover).toContainText('Review 10 proposal 11 with the product team');
      const bounds = (await popover.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      await popover.locator('.tnc-popover-close').click();
      await more.focus();
      await page.keyboard.press('Enter');
      await expect(popover).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(more).toBeFocused();
    }
  }
  await setObsidianViewport(page, { width: 400, height: 820 });
  await page.locator('.workspace-leaf.mod-active .advanced-calendar-view').evaluate(element => { element.style.width = '240px'; });
  await expect(page.locator(`${root} .tnc-dg`)).toHaveClass(/tnc-dg--chips/);
  await expect(page.locator(`${root} .tnc-dg-day[data-date="2026-11-10"] .tnc-item-title`).first()).toBeVisible();
  await page.locator(`${root} .tnc-dg-day[data-date="2026-11-10"] .tnc-dg-dots-more`).click();
  await expect(page.locator('.tnc-popover')).toContainText('Review 10 proposal 11 with the product team');
  await page.locator('.tnc-popover-close').click();
});
