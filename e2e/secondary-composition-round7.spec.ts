import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { parse, stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport, openTaskNotesSettings, closeObsidianSettings } from './obsidian';

const phase = process.env.TASKNOTES_R7_PHASE ?? 'after';
const evidence = `/tmp/tasknotes-r7/sec/${phase}`;
const folder = `SecondaryR7-${Date.now()}`;

test('secondary composition: chooser, settings, reports and editor anatomy', async () => {
  test.setTimeout(300000);
  mkdirSync(evidence, { recursive: true });
  const instance = await launchObsidian();
  const page = instance.page;
  page.setDefaultTimeout(10000);
  const measurements: Record<string, unknown> = {};
  const appearance = async (target: Page, width: number, theme: string) => {
    await target.evaluate(({ width, theme }) => {
      const native = (window as any).require('electron').remote.getCurrentWindow();
      native.setMinimumSize(320, 500);
      if (native.isMaximized()) native.unmaximize();
      document.body.classList.toggle('is-mobile', width === 400);
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(`theme-${theme}`);
    }, { width, theme });
    await setObsidianViewport(target, { width, height: 820 });
    await expect.poll(() => target.evaluate(() => [innerWidth, innerHeight])).toEqual([width, 820]);
  };
  const capture = async (target: Page, name: string) => {
    await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await target.screenshot({ path: `${evidence}/${name}.png` });
  };
  const open = async (name: string) => {
    await page.evaluate(async ({ folder, name }) => {
      const app = (window as any).app;
      await (window as any).secLeaf.openFile(app.vault.getAbstractFileByPath(`${folder}/${name}.base`));
      app.workspace.setActiveLeaf((window as any).secLeaf, { focus: true });
    }, { folder, name });
  };
  const original = await page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const settings = JSON.parse(JSON.stringify(plugin.settings));
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    plugin.settings.enableModalSplitLayout = false;
    plugin.settings.calendarViewSettings.enableTimeblocking = true;
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    (window as any).secLeaf = app.workspace.getLeaf(true);
    await app.vault.createFolder(folder);
    const date = (window as any).moment().format('YYYY-MM-DD');
    const daily = app.internalPlugins.getEnabledPluginById('daily-notes');
    (window as any).secDailyFolder = daily.options.folder;
    daily.options.folder = folder;
    for (const day of [date, (window as any).moment().subtract(1, 'day').format('YYYY-MM-DD')]) {
      await app.vault.create(`${folder}/${day}.md`, '---\ntimeblocks: []\n---\nDaily notes stay intact.\n');
    }
    for (const [index, title] of ['A short task', 'Review the accessibility and localization delivery plan with the whole release team before announcing the next milestone'].entries()) {
      await app.vault.create(`${folder}/${index}.md`, `---\ntags: [task]\ntitle: ${title}\nstatus: open\npriority: normal\nscheduled: ${date}T09:00\n---\n`);
    }
    return settings;
  }, folder);
  try {
    for (const [name, type] of [['Mini', 'tasknotesMiniCalendar'], ['List', 'tasknotesTaskList']]) {
      await page.evaluate(async ({ folder, name, content }) => {
        await (window as any).app.vault.create(`${folder}/${name}.base`, content);
      }, { folder, name, content: stringify({ filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] }, views: [{ type, name }] }) });
    }
    await expect.poll(() => page.evaluate(async folder => !!await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(`${folder}/0.md`), folder)).toBe(true);
    for (const theme of ['light', 'dark']) for (const width of [1180, 720, 400]) {
      const variant = `${theme}-${width}`;
      await appearance(page, width, theme);
      await open('Mini');
      await page.locator('.mini-calendar-view__day--today').click();
      await expect(page.locator('.mini-calendar-view__entry')).toHaveCount(2);
      await expect(page.locator('.note-selector-modal')).toHaveCount(0);
      measurements[`chooser-${variant}`] = await page.locator('.mini-calendar-view__entry').evaluateAll(elements => elements.map(element => ({ height: element.getBoundingClientRect().height, width: element.getBoundingClientRect().width, pathColor: getComputedStyle(element.querySelector('.note-selector-modal__path')!).color })));
      await capture(page, `chooser-${variant}`);
      if (phase !== 'before') {
        const rows = page.locator('.mini-calendar-view__entry');
        const sizes = await rows.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
        expect(Math.abs(sizes[0] - sizes[1])).toBeLessThan(2);
        expect(sizes[0]).toBeGreaterThanOrEqual(40);
        expect(await rows.first().locator('.tn-picker__detail').evaluate(element => getComputedStyle(element).color)).not.toBe(await rows.first().locator('.tn-picker__label').evaluate(element => getComputedStyle(element).color));
        await expect(rows.last().locator('.tn-picker__label')).toHaveAttribute('title', /Review the accessibility/);
      }
      await page.locator('.mini-calendar-view__entry').last().focus();
      await capture(page, `chooser-keyboard-${variant}`);
      await page.keyboard.press('Escape');
      await expect(page.locator('.mini-calendar-view__grid')).toBeFocused();
      if (phase !== 'before') {
        for (const method of ['pointer', 'keyboard']) {
          await page.locator('.mini-calendar-view__day--today').click();
          const last = page.locator('.mini-calendar-view__entry').last();
          if (method === 'keyboard') {
            await last.focus();
            await capture(page, `chooser-open-keyboard-${variant}`);
            await page.keyboard.press('Enter');
          } else {
            await last.hover();
            await capture(page, `chooser-hover-${variant}`);
            await last.click();
          }
          await expect.poll(() => page.evaluate(() => (window as any).app.workspace.getActiveFile()?.path)).toBe(`${folder}/1.md`);
          await open('Mini');
        }
      }
      for (const [type, selector] of [['tasknotes-pomodoro-view', '.pomodoro-view'], ['tasknotes-stats-view', '.stats-view'], ['tasknotes-pomodoro-stats-view', '.pomodoro-stats-view']]) {
        await page.evaluate(async type => {
          await (window as any).secLeaf.setViewState({ type, active: true });
          (window as any).app.workspace.setActiveLeaf((window as any).secLeaf, { focus: true });
        }, type);
        await expect(page.locator(`.workspace-leaf.mod-active ${selector}`)).toBeVisible();
        await capture(page, `${type}-${variant}`);
        const metrics = page.locator(`.workspace-leaf.mod-active ${selector} .tn-metrics`).first();
        measurements[`${type}-${variant}`] = await metrics.count() ? await metrics.evaluate(element => ({ height: element.getBoundingClientRect().height, columns: getComputedStyle(element).gridTemplateColumns })) : null;
        if (phase !== 'before' && type === 'tasknotes-pomodoro-stats-view') {
          const columns = await metrics.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
          expect(columns).toBe(width === 1180 ? 4 : 2);
          const recent = page.locator('.workspace-leaf.mod-active .pomodoro-stats-view__recent-sessions');
          expect(await recent.evaluate(element => element.closest('.pomodoro-stats-view__section')!.nextElementSibling!.classList.contains('tn-report-horizons'))).toBe(true);
        }
      }
      await open('List');
      await page.evaluate(async folder => {
        const plugin = (window as any).app.plugins.plugins.tasknotes;
        plugin.openTaskEditModal(await plugin.cacheManager.getTaskInfo(`${folder}/0.md`));
      }, folder);
      await expect(page.locator('.title-input')).toBeVisible();
      await capture(page, `task-editor-${variant}`);
      measurements[`task-title-${variant}`] = await page.locator('.title-input').evaluate(element => ({ size: getComputedStyle(element).fontSize, height: element.getBoundingClientRect().height }));
      if (phase !== 'before') {
        await page.locator('.title-input').fill('Review the accessibility and localization delivery plan with the whole release team before announcing the next milestone');
        await capture(page, `task-long-title-${variant}`);
        await page.locator('.title-input').fill('A short task edited');
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.locator('.tn-toast__message')).toHaveText('Task saved');
        await expect(page.locator('.tn-toast')).toHaveCount(1);
        await capture(page, `task-saved-${variant}`);
        await page.locator('.tn-toast__action').click();
        await expect.poll(() => page.evaluate(async folder => (await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(`${folder}/0.md`))?.title, folder)).toBe('A short task');
      } else await page.keyboard.press('Escape');
      const card = page.locator(`.task-card[data-task-path="${folder}/0.md"]`).first();
      await card.click({ button: 'right' });
      await page.locator('.menu-item').filter({ has: page.locator('.menu-item-title', { hasText: /^Time tracking$/ }) }).hover();
      await page.locator('.menu-item').filter({ has: page.locator('.menu-item-title', { hasText: /^Create timeblock$/ }) }).click();
      await expect(page.locator('.timeblock-creation-modal')).toBeVisible();
      expect(await page.locator('.timeblock-creation-modal select').first().evaluate(element => parseFloat(getComputedStyle(element).minHeight))).toBe(width === 400 ? 40 : 28);
      await capture(page, `timeblock-editor-${variant}`);
      measurements[`timeblock-title-${variant}`] = await page.locator('.tn-modal__title').evaluate(element => ({ size: getComputedStyle(element).fontSize, height: element.getBoundingClientRect().height }));
      if (phase !== 'before') {
        const taskTitle = measurements[`task-title-${variant}`] as { size: string };
        const blockTitle = measurements[`timeblock-title-${variant}`] as { size: string };
        expect(blockTitle.size).toBe(taskTitle.size);
        expect(await page.locator('.tn-modal__description').evaluate(element => element.getBoundingClientRect().height)).toBeLessThan(65);
        const create = page.getByRole('button', { name: 'Create timeblock', exact: true });
        await page.locator('.tn-modal__title').fill('Review the accessibility and localization delivery plan with the whole release team before announcing the next milestone');
        await capture(page, `timeblock-long-title-${variant}`);
        const footer = page.locator('.tn-modal__footer');
        expect(await footer.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
        const footerBounds = await footer.boundingBox();
        expect(footerBounds!.y + footerBounds!.height).toBeLessThanOrEqual(820);
        await page.locator('.tn-modal__title').fill('');
        await expect(create).toBeDisabled();
        await capture(page, `timeblock-invalid-${variant}`);
        await page.locator('.tn-modal__title').fill('A short task');
        await expect(create).toBeEnabled();
        await create.focus();
        await capture(page, `timeblock-focus-${variant}`);
        await page.keyboard.press('Control+Enter');
        await expect(page.locator('.tn-toast__message')).toHaveText('Timeblock created');
        await expect(page.locator('.tn-toast')).toHaveCount(1);
        await capture(page, `timeblock-created-${variant}`);
        let writtenDaily = '';
        await expect.poll(async () => {
          const notes = await page.evaluate(async folder => {
            const app = (window as any).app;
            return Promise.all(app.vault.getMarkdownFiles().filter((file: any) => file.path.startsWith(`${folder}/`)).map(async (file: any) => ({ path: file.path, content: await app.vault.adapter.read(file.path) })));
          }, folder);
          const written = notes.find(note => parse(note.content.split('---')[1])?.timeblocks?.some((block: any) => block.title === 'A short task'));
          writtenDaily = written?.path ?? '';
          return writtenDaily;
        }).not.toBe('');
        await page.locator('.tn-toast__action').click();
        await expect(page.locator('.tn-toast__message')).toHaveText('Change undone.');
        await expect.poll(async () => {
          const content = await page.evaluate(async path => (window as any).app.vault.adapter.read(path), writtenDaily);
          expect(content).toContain('Daily notes stay intact.');
          return parse(content.split('---')[1]).timeblocks;
        }).toEqual([]);
        await page.evaluate(() => document.querySelector('.tn-toast')?.dispatchEvent(new Event('tn-dismiss')));
      } else await page.keyboard.press('Escape');
      const settings = await openTaskNotesSettings(page, 'Task properties');
      settings.setDefaultTimeout(10000);
      try {
        await appearance(settings, width, theme);
        const status = settings.locator('[data-card-id="property-status"]');
        if (await status.evaluate(element => element.classList.contains('tasknotes-settings__card--collapsed'))) await status.locator(':scope > .tasknotes-settings__card-header button').first().click();
        const child = status.locator('.tasknotes-settings__card--draggable').first();
        if (await child.evaluate(element => element.classList.contains('tasknotes-settings__card--collapsed'))) await child.locator(':scope > .tasknotes-settings__card-header button').first().click();
        await capture(settings, `settings-${variant}`);
        measurements[`settings-${variant}`] = await status.evaluate(element => ({ width: element.getBoundingClientRect().width, parent: element.parentElement!.getBoundingClientRect().width, scroll: element.scrollWidth, client: element.clientWidth }));
        if (phase !== 'before') {
          const ratio = await status.locator('.tasknotes-settings__nested-cards').evaluate(element => element.getBoundingClientRect().width / element.closest('[data-card-id="property-status"]')!.getBoundingClientRect().width);
          expect(ratio).toBeGreaterThan(0.9);
          const toggles = await child.locator('.checkbox-container').evaluateAll(elements => elements.map(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })));
          expect(toggles.length).toBeGreaterThan(0);
          for (const toggle of toggles) {
            expect(toggle.width).toBeGreaterThanOrEqual(40);
            expect(toggle.height).toBeGreaterThan(0);
            if (width === 400) expect(toggle.height).toBeGreaterThanOrEqual(40);
          }
          const nav = settings.locator('.settings-view__tab-nav');
          if (await nav.isVisible()) expect(await nav.evaluate(element => getComputedStyle(element).flexWrap)).toBe('nowrap');
          else await expect(settings.locator('.settings-view__tab-select')).toBeVisible();
        }
      } finally { await closeObsidianSettings(page, settings); }
    }
  } finally {
    writeFileSync(`${evidence}/measurements.json`, JSON.stringify(measurements, null, 2));
    try {
      await page.evaluate(async ({ folder, original }) => {
        const app = (window as any).app;
        Object.assign(app.plugins.plugins.tasknotes.settings, original);
        app.internalPlugins.getEnabledPluginById('daily-notes').options.folder = (window as any).secDailyFolder;
        await app.plugins.plugins.tasknotes.saveSettings();
        (window as any).secLeaf?.detach();
        const directory = app.vault.getAbstractFileByPath(folder);
        if (directory) await app.vault.delete(directory, true);
      }, { folder, original });
    } finally { await closeObsidian(instance); }
  }
});
