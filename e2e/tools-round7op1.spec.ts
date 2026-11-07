import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchObsidian, closeObsidian, setObsidianViewport, openTaskNotesSettings, closeObsidianSettings, selectTaskNotesSettingsTab } from './obsidian';

const phase = process.env.TASKNOTES_R7_PHASE ?? 'after';
const evidence = `/tmp/tasknotes-r7/tools/${phase}`;

test('tools: mini selection, date grid, compact pickers, settings and metrics', async () => {
  test.setTimeout(300000);
  mkdirSync(evidence, { recursive: true });
  const instance = await launchObsidian();
  const page = instance.page;
  const folder = `ToolsR7-${Date.now()}`;
  const measurements: Record<string, unknown> = {};
  const original = await page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const settings = JSON.parse(JSON.stringify(plugin.settings));
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    plugin.settings.enableModalSplitLayout = false;
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    await app.vault.createFolder(folder);
    const today = (window as any).moment().format('YYYY-MM-DD');
    for (const [index, title] of ['Review the launch plan with accessibility and localization reviewers', 'Confirm the release checklist'].entries()) {
      await app.vault.create(`${folder}/${index}.md`, `---\ntags: [task]\ntitle: ${title}\nstatus: open\npriority: normal\ndue: ${today}\n---\n`);
    }
    await app.vault.create(`${folder}/Mini.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\nviews:\n  - type: tasknotesMiniCalendar\n    name: Mini\n    dateProperty: note.due\n`);
    (window as any).toolsLeaf = app.workspace.getLeaf(true);
    return settings;
  }, folder);
  const appearance = async (target: Page, width: number, theme: string, mobile: boolean) => {
    await setObsidianViewport(target, { width, height: 800 });
    await target.evaluate(({ theme, mobile }) => {
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(`theme-${theme}`);
      document.body.classList.toggle('is-mobile', mobile);
      document.querySelectorAll('.notice').forEach(element => element.remove());
    }, { theme, mobile });
  };
  const capture = async (target: Page, name: string) => {
    await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await target.screenshot({ path: `${evidence}/${name}.png` });
  };
  try {
    await expect.poll(() => page.evaluate(async folder => !!await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(`${folder}/0.md`), folder)).toBe(true);
    for (const theme of ['light', 'dark']) for (const [width, mobile] of [[1180, false], [720, false], [400, false], [400, true]] as const) {
      const variant = `${theme}-${width}${mobile ? '-mobile' : ''}`;
      await appearance(page, width, theme, mobile);
      await page.evaluate(async folder => {
        const app = (window as any).app;
        await (window as any).toolsLeaf.openFile(app.vault.getAbstractFileByPath(`${folder}/Mini.base`));
        app.workspace.setActiveLeaf((window as any).toolsLeaf, { focus: true });
      }, folder);
      const grid = page.locator('.mini-calendar-view__grid');
      await expect(grid).toBeVisible();
      await grid.focus();
      await page.keyboard.press('t');
      await capture(page, `mini-${variant}`);
      await page.keyboard.press('ArrowRight');
      if (phase !== 'before') {
        await expect(page.locator('.mini-calendar-view__selected-day .tn-picker__empty')).toBeVisible();
        const marker = await page.locator('.mini-calendar-view__day--today').evaluate(element => {
          const style = getComputedStyle(element, '::before');
          return { opacity: Number(style.opacity), width: parseFloat(style.width), height: parseFloat(style.height) };
        });
        expect(marker.opacity).toBeGreaterThanOrEqual(0.65);
        expect(marker.width).toBeGreaterThanOrEqual(4);
        expect(marker.height).toBeGreaterThanOrEqual(4);
        await capture(page, `mini-empty-${variant}`);
      }
      await page.keyboard.press('Escape');
      measurements[`mini-escape-${variant}`] = await page.locator('.mini-calendar-view__day--selected').count();
      if (phase !== 'before') await expect(page.locator('.mini-calendar-view__day--selected')).toHaveCount(0);
      await grid.focus();
      await page.keyboard.press('t');
      if (phase !== 'before') {
        const geometry = await page.locator('.mini-calendar-bases-view').evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth }));
        measurements[`mini-geometry-${variant}`] = geometry;
        expect(geometry.scroll).toBeLessThanOrEqual(geometry.width);
        if (mobile) {
          const day = await page.locator('.mini-calendar-view__day').first().boundingBox();
          expect(day!.width).toBeGreaterThanOrEqual(40);
          expect(day!.height).toBeGreaterThanOrEqual(40);
        }
        await expect(page.locator('.mini-calendar-view__entry')).toHaveCount(2);
        const before = await page.locator('.mini-calendar-view__entry').first().boundingBox();
        await page.locator('.mini-calendar-view__entry').first().hover();
        expect(await page.locator('.mini-calendar-view__entry').first().boundingBox()).toEqual(before);
        await capture(page, `mini-hover-${variant}`);
        await page.locator('.mini-calendar-view__entry').first().focus();
        await page.evaluate(async () => (window as any).toolsLeaf.view.controller.view.render());
        await expect(page.locator('.mini-calendar-view__entry').first()).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(page.locator('.mini-calendar-view__entry')).toHaveCount(0);
        await expect(grid).toBeFocused();
        await page.keyboard.press('t');
        await expect(page.locator('.mini-calendar-view__entry')).toHaveCount(2);
      }
      await page.locator('.mini-calendar-view__day--today').click();
      await expect(page.locator('.mini-calendar-view__entry')).toHaveCount(2);
      await expect(page.locator('.note-selector-modal')).toHaveCount(0);
      await page.locator('.mini-calendar-view__entry').first().focus();
      await page.keyboard.press('Escape');
      await expect(grid).toBeFocused();
      await page.evaluate(async folder => {
        const plugin = (window as any).app.plugins.plugins.tasknotes;
        plugin.openTaskEditModal(await plugin.cacheManager.getTaskInfo(`${folder}/0.md`));
      }, folder);
      const modal = page.locator('.minimalist-task-modal');
      await capture(page, `modal-${variant}`);
      if (phase !== 'before') {
        const cancelBounds = await modal.getByRole('button', { name: 'Cancel', exact: true }).boundingBox();
        const saveBounds = await modal.getByRole('button', { name: 'Save', exact: true }).boundingBox();
        expect(Math.abs(cancelBounds!.y - saveBounds!.y)).toBeLessThan(2);
        const actionBar = await modal.locator('.tn-task-modal__action-bar').boundingBox();
        const disclosure = await modal.locator('.tn-task-modal__details-toggle').boundingBox();
        expect(disclosure!.x).toBeGreaterThanOrEqual(actionBar!.x);
        expect(disclosure!.x + disclosure!.width).toBeLessThanOrEqual(actionBar!.x + actionBar!.width);
        expect(disclosure!.height).toBeGreaterThanOrEqual(28);
      }
      await modal.locator('[data-type="priority"]').click();
      await page.locator('.tn-picker__input').press('Home');
      measurements[`picker-${variant}`] = await page.locator('.tn-picker__row.is-active').evaluate(element => ({ height: element.getBoundingClientRect().height, outline: getComputedStyle(element).outlineStyle }));
      if (phase !== 'before') await expect(page.locator('.tn-picker__row.is-active')).toHaveCSS('outline-style', 'none');
      await capture(page, `picker-${variant}`);
      await page.keyboard.press('Escape');
      await modal.locator('[data-type="due-date"]').click();
      await page.locator('[data-picker-id="custom"]').click();
      await capture(page, `date-${variant}`);
      if (phase !== 'before') {
        const calendar = page.locator('.date-time-picker-modal .tn-month-calendar');
        await expect(calendar).toBeVisible();
        const select = page.locator('.date-time-picker-modal__action-button.mod-cta');
        const actionBounds = await select.boundingBox();
        const modalBounds = await page.locator('.modal').last().boundingBox();
        expect(actionBounds!.y + actionBounds!.height).toBeLessThanOrEqual(modalBounds!.y + modalBounds!.height);
        measurements[`date-target-${variant}`] = await calendar.locator('.tn-month-calendar__day').first().evaluate(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }));
        if (mobile) {
          const target = await calendar.locator('.tn-month-calendar__day').first().boundingBox();
          expect(target!.width).toBeGreaterThanOrEqual(40);
          expect(target!.height).toBeGreaterThanOrEqual(40);
        }
        await calendar.locator('[aria-pressed="true"]').focus();
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Enter');
        await expect(calendar.locator('[aria-pressed="true"]')).toBeFocused();
        expect(await page.locator('.date-time-picker-modal__date-input').inputValue()).not.toBe('');
      }
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      const settings = await openTaskNotesSettings(page, 'Task properties');
      try {
        await appearance(settings, width, theme, mobile);
        await capture(settings, `settings-${variant}`);
        measurements[`settings-${variant}`] = await settings.locator('.settings-view__tab-content--active').evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth, padding: getComputedStyle(element).paddingInline }));
        await selectTaskNotesSettingsTab(settings, 'Modal fields');
        await capture(settings, `settings-modal-fields-${variant}`);
        if (phase !== 'before') {
          const reset = settings.getByRole('button', { name: 'Reset to defaults', exact: true });
          await expect(reset).not.toHaveClass(/mod-warning/);
          await expect(settings.locator('.settings-view__tab-content--active')).toHaveCSS('padding-inline', '16px');
        }
      } finally { await closeObsidianSettings(page, settings); }
      await page.evaluate(async () => (window as any).toolsLeaf.setViewState({ type: 'tasknotes-pomodoro-stats-view', active: true }));
      await expect(page.locator('.pomodoro-stats-view')).toBeVisible();
      await capture(page, `pomodoro-${variant}`);
      if (phase !== 'before') {
        const overview = await page.locator('.pomodoro-stats-view__overview-value').evaluateAll(elements => elements.map(element => ({ font: getComputedStyle(element).fontSize, top: element.getBoundingClientRect().top })));
        expect(new Set(overview.map(value => value.font)).size).toBe(1);
        const columns = width > 768 ? 4 : 2;
        expect(overview).toHaveLength(4);
        for (let index = 0; index < overview.length; index += columns) {
          const row = overview.slice(index, index + columns);
          expect(Math.max(...row.map(value => value.top)) - Math.min(...row.map(value => value.top))).toBeLessThan(2);
        }
        if (columns === 2) expect(overview[2].top).toBeGreaterThan(overview[0].top);
      }
    }
  } finally {
    writeFileSync(`${evidence}/measurements.json`, JSON.stringify(measurements, null, 2));
    await page.evaluate(async ({ folder, original }) => {
      const app = (window as any).app;
      Object.assign(app.plugins.plugins.tasknotes.settings, original);
      await app.plugins.plugins.tasknotes.saveSettings();
      (window as any).toolsLeaf?.detach();
      const directory = app.vault.getAbstractFileByPath(folder);
      if (directory) await app.vault.delete(directory, true);
    }, { folder, original });
    await closeObsidian(instance);
  }
});

test('tools: calendar move clock preference, one toast and persisted Undo', async () => {
  test.setTimeout(90000);
  mkdirSync(evidence, { recursive: true });
  const instance = await launchObsidian();
  const page = instance.page;
  await setObsidianViewport(page, { width: 1180, height: 800 });
  const folder = `ToolsClock-${Date.now()}`;
  const original = await page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const settings = JSON.parse(JSON.stringify(plugin.settings));
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    const today = (window as any).moment().format('YYYY-MM-DD');
    await app.vault.createFolder(folder);
    await app.vault.create(`${folder}/Review.md`, `---\ntags: [task]\ntitle: Review the clock preference\nstatus: open\nscheduled: ${today}T14:00\ntimeEstimate: 30\n---\n`);
    await app.vault.create(`${folder}/Calendar.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\nviews:\n  - type: tasknotesCalendar\n    name: Calendar\n    calendarView: timeGridDay\n`);
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    (window as any).toolsClockLeaf = app.workspace.getLeaf(true);
    await (window as any).toolsClockLeaf.openFile(app.vault.getAbstractFileByPath(`${folder}/Calendar.base`));
    return settings;
  }, folder);
  try {
    await expect.poll(() => page.evaluate(folder => (window as any).toolsClockLeaf.view.controller?.view.calendarItems?.some((item: any) => item.data?.taskInfo?.path === `${folder}/Review.md`), folder)).toBe(true);
    for (const timeFormat of ['24', '12']) {
      const before = await page.evaluate(async ({ folder, timeFormat }) => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins.tasknotes;
        plugin.settings.calendarViewSettings.timeFormat = timeFormat;
        const path = `${folder}/Review.md`;
        const text = await app.vault.read(app.vault.getAbstractFileByPath(path));
        const view = (window as any).toolsClockLeaf.view.controller.view;
        view.viewOptions.timeFormat = timeFormat;
        await view.refetchEvents();
        const item = view.calendarItems.find((item: any) => item.data?.taskInfo?.path === path);
        const oldEvent = { id: item.id, title: item.title, start: new Date(item.start), end: new Date(item.end), allDay: false, extendedProps: item.data };
        const start = new Date(oldEvent.start);
        start.setHours(13, 5, 0, 0);
        const end = new Date(start.getTime() + 30 * 60000);
        await view.handleEventDrop({ oldEvent, event: { ...oldEvent, start, end }, isPointer: true, jsEvent: null, revert: () => { throw new Error('Unexpected revert'); } });
        return text.match(/^scheduled: (.+)$/m)?.[1];
      }, { folder, timeFormat });
      await expect(page.locator('.tn-toast')).toHaveCount(1);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      writeFileSync(`${evidence}/calendar-clock-${timeFormat}.json`, JSON.stringify({ timeFormat, notice: await page.locator('.tn-toast').innerText() }, null, 2));
      await page.screenshot({ path: `${evidence}/calendar-clock-${timeFormat}.png` });
      if (phase !== 'before') await expect(page.locator('.tn-toast')).toContainText(timeFormat === '24' ? '13:05' : '1:05 PM');
      await expect.poll(() => page.evaluate(async folder => {
        const app = (window as any).app;
        const text = await app.vault.read(app.vault.getAbstractFileByPath(`${folder}/Review.md`));
        return text.match(/^scheduled: (.+)$/m)?.[1];
      }, folder)).toContain('T13:05');
      await page.locator('.tn-toast').getByRole('button', { name: 'Undo', exact: true }).click();
      await expect.poll(() => page.evaluate(async folder => {
        const app = (window as any).app;
        const text = await app.vault.read(app.vault.getAbstractFileByPath(`${folder}/Review.md`));
        return text.match(/^scheduled: (.+)$/m)?.[1];
      }, folder)).toBe(before);
    }
  } finally {
    await page.evaluate(async ({ folder, original }) => {
      const app = (window as any).app;
      Object.assign(app.plugins.plugins.tasknotes.settings, original);
      await app.plugins.plugins.tasknotes.saveSettings();
      (window as any).toolsClockLeaf?.detach();
      const directory = app.vault.getAbstractFileByPath(folder);
      if (directory) await app.vault.delete(directory, true);
    }, { folder, original });
    await closeObsidian(instance);
  }
});
