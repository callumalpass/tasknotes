import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { launchObsidian, closeObsidian, setObsidianViewport, openTaskNotesSettings, closeObsidianSettings, expectTouchTarget, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
let originalSettings: Record<string, unknown>;
let originalDailyFolder: string;
const folder = `Secondary-${Date.now()}`;
let today: string;

test.beforeAll(async () => {
  instance = await launchObsidian();
  await setObsidianViewport(instance.page, { width: 1180, height: 800 });
  const state = await instance.page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const settings = JSON.parse(JSON.stringify(plugin.settings));
    const daily = app.internalPlugins.getEnabledPluginById('daily-notes');
    const dailyFolder = daily.options.folder;
    daily.options.folder = folder;
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    await plugin.saveSettings();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    await app.vault.createFolder(folder);
    await app.vault.create(`${folder}/${today}.md`, `---\ntimeblocks:\n  - id: secondary-focus\n    title: Review secondary surfaces\n    startTime: '13:00'\n    endTime: '14:00'\n    color: 'var(--color-blue)'\n    description: Keep the details close to the work.\n    attachments: ['[[${folder}/Review]]']\n---\n`);
    await app.vault.create(`${folder}/Review.md`, `---\ntitle: Review secondary surfaces\ntags: [task]\nstatus: open\npriority: high\nscheduled: ${today}T10:00\ndue: ${today}\ntimeEstimate: 60\ntimeEntries:\n  - startTime: '${new Date(`${today}T09:00`).toISOString()}'\n    endTime: '${new Date(`${today}T09:30`).toISOString()}'\n---\n`);
    await app.vault.create(`${folder}/Prose.md`, `# Working notes\n\nBefore [[${folder}/Review|Review]] and after.\n\n- A longer task reference: [[${folder}/Review]], with punctuation.\n\nKeep the cursor here.\n`);
    for (const [name, type, view] of [['Calendar', 'tasknotesCalendar', 'timeGridDay'], ['Empty', 'tasknotesCalendar', 'listWeek'], ['Mini', 'tasknotesMiniCalendar', '']]) {
      await app.vault.create(`${folder}/${name}.base`, `filters:\n  and:\n    - file.inFolder("${folder}${name === 'Empty' ? '/missing' : ''}")\nviews:\n  - type: ${type}\n    name: ${name}\n    calendarView: ${view}\n    dateProperty: note.scheduled\n    titleProperty: title\n    showTimeblocks: ${name === 'Calendar'}\n    showTimeEntries: false\n    showPropertyBasedEvents: false\n    slotMinTime: '08:00:00'\n    slotMaxTime: '18:00:00'\n    order: [status, priority, scheduled, due]\n`);
    }
    (window as any).secondaryLeaf = app.workspace.getLeaf(true);
    return { settings, dailyFolder, today };
  }, folder);
  originalSettings = state.settings;
  originalDailyFolder = state.dailyFolder;
  today = state.today;
  await expect.poll(() => instance.page.evaluate(async path => Boolean(await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(path)), `${folder}/Review.md`)).toBe(true);
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await instance.page.evaluate(async ({ folder, settings, dailyFolder }) => {
      const app = (window as any).app;
      app.setting.close();
      Object.assign(app.plugins.plugins.tasknotes.settings, settings);
      await app.plugins.plugins.tasknotes.saveSettings();
      app.internalPlugins.getEnabledPluginById('daily-notes').options.folder = dailyFolder;
      (window as any).secondaryLeaf.detach();
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, { folder, settings: originalSettings, dailyFolder: originalDailyFolder });
  } finally { await closeObsidian(instance); }
});

async function appearance(page: Page, theme: string, width: number, mobile: boolean) {
  await setObsidianViewport(page, { width, height: 800 });
  await page.evaluate(({ theme, mobile }) => {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(theme);
    document.body.classList.toggle('is-mobile', mobile);
    const app = (window as any).app;
    app?.workspace?.leftSplit?.collapse();
    app?.workspace?.rightSplit?.collapse();
  }, { theme, mobile });
}

async function openFile(name: string, mode = 'preview') {
  await instance.page.evaluate(async ({ path, mode }) => {
    const app = (window as any).app;
    await (window as any).secondaryLeaf.openFile(app.vault.getAbstractFileByPath(path), { state: { mode, source: false } });
    app.workspace.setActiveLeaf((window as any).secondaryLeaf, { focus: true });
    if (app.workspace.activeLeaf.view.editor) app.workspace.activeLeaf.view.editor.setCursor({ line: 6, ch: 0 });
  }, { path: `${folder}/${name}`, mode });
}

async function capture(name: string, page = instance.page) {
  await page.locator('.notice-container .notice').evaluateAll(elements => elements.forEach(element => element.remove()));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: `test-results/secondary-r2/${name}.png`, animations: 'disabled', clip: { x: 0, y: 0, ...page.viewportSize()! } });
}

test('sentence references preserve prose flow and grouped controls in reading and live preview', async () => {
  const page = instance.page;
  for (const theme of ['theme-light', 'theme-dark']) for (const [width, mobile] of [[1180, false], [400, false], [400, true]] as const) {
    await appearance(page, theme, width, mobile);
    for (const mode of ['preview', 'source']) {
      await openFile('Prose.md', mode);
      const cards = page.locator('.workspace-leaf.mod-active .task-card--layout-inline:visible');
      await expect(cards).toHaveCount(2);
      await capture(`inline-layout-${theme}-${width}-${mobile}-${mode}`);
      await expect(async () => {
        const geometries = await cards.evaluateAll(elements => elements.map(element => {
          const card = element.getBoundingClientRect();
          const status = element.querySelector('.task-card__status-dot')!.getBoundingClientRect();
          const menu = element.querySelector('.task-card__context-menu')!.getBoundingClientRect();
          const title = element.querySelector('.task-card__title-text')!;
          const range = document.createRange();
          range.selectNodeContents(title);
          const titleLines = Array.from(range.getClientRects()).filter(bounds => bounds.width > 0);
          const controls = element.querySelector('.task-card__inline-controls')!;
          return { connected: element.isConnected, width: card.width, parentWidth: element.closest('.cm-line, p, li')!.getBoundingClientRect().width, controlLineGap: Math.min(...titleLines.map(bounds => Math.abs(bounds.top - status.top))), proseLineHeight: Math.max(parseFloat(getComputedStyle(title).lineHeight), controls.getBoundingClientRect().height), controlsAligned: Math.abs(status.top + status.height / 2 - menu.top - menu.height / 2) < 1, controlsBeforeTitle: Boolean(controls.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING), sentence: element.closest('.tasknotes-inline-widget--sentence') !== null, display: getComputedStyle(element).display, dateAlignment: getComputedStyle(element.querySelector('.task-card__metadata')!).justifyContent };
        }));
        expect(geometries).toHaveLength(2);
        for (const geometry of geometries) {
          expect(geometry.connected).toBe(true);
          expect(geometry.dateAlignment).toBe('flex-start');
          expect(geometry.display).toBe(geometry.sentence ? 'inline' : 'inline-flex');
          expect(geometry.width).toBeLessThanOrEqual(geometry.parentWidth + 1);
          expect(geometry.controlLineGap).toBeLessThanOrEqual(geometry.proseLineHeight);
          expect(geometry.controlsAligned).toBe(true);
          expect(geometry.controlsBeforeTitle).toBe(true);
        }
      }).toPass({ timeout: 5000 });
      for (const card of await cards.all()) {
        await expect(card.locator('.task-card__metadata')).toBeHidden();
        await expect(card.locator('.task-card__priority-dot')).toBeHidden();
        await card.hover();
        await expect(card.locator('.task-card__context-menu')).toBeVisible();
        if (mobile) {
          expect((await card.locator('.task-card__status-dot').boundingBox())!.height).toBeLessThanOrEqual(24);
          await expectTouchTarget(card.locator('.task-card__status-dot'));
          await expectTouchTarget(card.locator('.task-card__context-menu'));
        }
      }
      await capture(`inline-${theme}-${width}-${mobile}-${mode}`);
    }
  }
});

test('timeblock composer retains fields and pins the actions in both clock formats', async () => {
  const page = instance.page;
  for (const format of ['24', '12']) {
    await appearance(page, 'theme-light', 1180, false);
    await page.evaluate(format => { (window as any).app.plugins.plugins.tasknotes.settings.calendarViewSettings.timeFormat = format; }, format);
    await openFile('Calendar.base');
    const event = page.locator('.workspace-leaf.mod-active .tnc-item[data-event-type="timeblock"]').first();
    await expect(event).toBeVisible();
    await event.click();
    const modal = page.locator('.tn-modal--composer');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.tn-modal__title')).toHaveValue('Review secondary surfaces');
    await expect(modal.locator('.timeblock-attachment-name')).toContainText('Review.md');
    await expect(modal.locator('.tn-modal__time select')).toHaveCount(format === '12' ? 6 : 4);
    for (const theme of ['theme-light', 'theme-dark']) for (const [width, mobile] of [[1180, false], [400, false], [400, true]] as const) {
      await appearance(page, theme, width, mobile);
      const footer = await modal.locator('.tn-modal__footer').boundingBox();
      expect(footer!.y + footer!.height).toBeLessThanOrEqual(800);
      expect(footer!.width).toBeLessThanOrEqual(width);
      await capture(`timeblock-edit-${format}-${theme}-${width}-${mobile}`);
    }
    await page.keyboard.press('Escape');
  }
  await appearance(page, 'theme-light', 1180, false);
  await openFile('Calendar.base');
  const point = await page.locator(`.tnc-col[data-date="${today}"]`).evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 10 };
  });
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x, point.y + 50, { steps: 8 });
  await page.mouse.up();
  await page.getByText('Create timeblock', { exact: true }).click();
  const modal = page.locator('.tn-modal--composer');
  await modal.locator('.tn-modal__title').fill('A bounded focus session');
  await modal.locator('.tn-modal__description').fill('Work with all of the original fields.');
  await modal.locator('.tn-modal__color summary').click();
  await modal.locator('.tn-modal__palette button').nth(3).click();
  await expect(modal.locator('.tn-modal__color-value')).toHaveValue('green');
  await modal.locator('.tn-modal__color summary').click();
  for (const theme of ['theme-light', 'theme-dark']) for (const [width, mobile] of [[1180, false], [400, false], [400, true]] as const) {
    await appearance(page, theme, width, mobile);
    await expect(modal.getByRole('button', { name: 'Create timeblock' })).toBeEnabled();
    await capture(`timeblock-create-${theme}-${width}-${mobile}`);
  }
  const start = modal.locator('.tn-modal__time').nth(0).locator('select');
  const end = modal.locator('.tn-modal__time').nth(1).locator('select');
  await start.nth(0).selectOption('11');
  await start.nth(1).selectOption('30');
  await start.nth(2).selectOption('1');
  await end.nth(0).selectOption('10');
  await end.nth(1).selectOption('0');
  await end.nth(2).selectOption('1');
  await expect(modal.getByRole('button', { name: 'Create timeblock' })).toBeDisabled();
  await end.nth(0).selectOption('12');
  await end.nth(2).selectOption('0');
  await modal.getByRole('button', { name: 'Create timeblock' }).click();
  await expect(modal).toBeHidden();
  await expect.poll(() => page.evaluate(({ folder, today }) => {
    const app = (window as any).app;
    const blocks = app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(`${folder}/${today}.md`))?.frontmatter?.timeblocks;
    return blocks?.find((block: any) => block.title === 'A bounded focus session');
  }, { folder, today })).toEqual(expect.objectContaining({ startTime: '23:30', endTime: '00:00', color: 'var(--color-green)', description: 'Work with all of the original fields.' }));
});

test('reports disclose filters and use the pane width', async () => {
  const page = instance.page;
  for (const type of ['tasknotes-stats-view', 'tasknotes-pomodoro-stats-view', 'tasknotes-pomodoro-view', 'tasknotes-release-notes']) {
    await page.evaluate(async type => { await (window as any).secondaryLeaf.setViewState({ type, active: true }); }, type);
    for (const theme of ['theme-light', 'theme-dark']) for (const [width, mobile] of [[1180, false], [400, false], [400, true]] as const) {
      await appearance(page, theme, width, mobile);
      if (type === 'tasknotes-stats-view') {
        await expect(page.locator('.stats-view__filter-disclosure')).not.toHaveAttribute('open');
        await expect(page.locator('.stats-view__overview-grid')).toBeVisible();
        const container = await page.locator('.tn-report-horizons').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
        expect(container).toBe(width === 1180 ? 3 : 1);
      }
      await capture(`${type}-${theme}-${width}-${mobile}`);
    }
    if (type === 'tasknotes-stats-view') {
      await page.locator('.stats-view__filter-disclosure summary').click();
      await page.getByRole('combobox', { name: 'Date range' }).selectOption('custom');
      await expect(page.locator('.stats-view__custom-dates input')).toHaveCount(2);
    }
  }
});

test('settings navigation keeps every section reachable inside the host pane', async () => {
  const page = await openTaskNotesSettings(instance.page);
  try {
    for (const theme of ['theme-light', 'theme-dark']) for (const [width, mobile] of [[1180, false], [400, false], [400, true]] as const) {
      await appearance(page, theme, width, mobile);
      const select = page.locator('.settings-view__tab-select');
      if (await select.isVisible()) {
        const sections = await select.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value));
        for (const section of sections) {
          await select.selectOption(section);
          await expect(page.locator(`#settings-tab-${section}`)).toBeVisible();
        }
        await select.selectOption('general');
      } else {
        const tabs = page.getByRole('tab');
        for (const tab of await tabs.all()) {
          await tab.click();
          await expect(tab).toHaveAttribute('aria-selected', 'true');
        }
      }
      await expect(page.locator('.settings-view__tab-content--active')).toHaveCSS('opacity', '1');
      await capture(`settings-${theme}-${width}-${mobile}`, page);
      expect(await page.locator('.settings-view__toolbar').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    }
  } finally { await closeObsidianSettings(instance.page, page); }
});

test('populated mini calendar keeps the date name and describes its notes', async () => {
  const page = instance.page;
  await appearance(page, 'theme-light', 1180, false);
  await openFile('Mini.base');
  const day = page.locator('.workspace-leaf.mod-active .mini-calendar-view__day[aria-current="date"]');
  await expect(day).toHaveAttribute('aria-description', /Review secondary surfaces/);
  await expect(day).toHaveAccessibleName(/2026/);
  await expect(day).not.toHaveAccessibleName(/Review secondary surfaces/);
  await page.mouse.move(0, 0);
  await day.hover();
  await day.dispatchEvent('pointerover', { pointerType: 'mouse' });
  await expect(page.locator('.tooltip')).toContainText('Review secondary surfaces');
  await page.mouse.move(0, 0);
  for (const theme of ['theme-light', 'theme-dark']) for (const [width, mobile] of [[1180, false], [400, false], [400, true]] as const) {
    await appearance(page, theme, width, mobile);
    await capture(`mini-${theme}-${width}-${mobile}`);
  }
});

test('empty agenda offers task creation and narrow views use full names', async () => {
  const page = instance.page;
  const publishedFallback = !readFileSync('node_modules/@tasknotes/calendar/dist/types/dom/options.d.ts', 'utf8').includes('listEmptyContent');
  await openFile('Empty.base');
  for (const theme of ['theme-light', 'theme-dark']) for (const [width, mobile] of [[1180, false], [400, false], [400, true]] as const) {
    await appearance(page, theme, width, mobile);
    if (publishedFallback) {
      await expect(page.locator('.tnc-list-empty')).toHaveText('Nothing scheduled');
      await expect(page.locator('.tnc-toolbar-view-select')).toHaveCount(0);
      await expect(page.locator('.tnc-toolbar-views .tnc-btn-view')).toHaveText(['Year', 'Month', 'Week', '3 days', 'Day', 'List']);
      await page.locator('.tnc-btn-view-week').click();
      await expect(page.locator('.tnc-btn-view-week')).toHaveAttribute('aria-pressed', 'true');
      await page.locator('.tnc-btn-view-list').click();
      await expect(page.locator('.tnc-list-empty')).toHaveText('Nothing scheduled');
    } else {
      await expect(page.locator('.tnc-list-empty .tn-empty')).toBeVisible();
      await expect(page.locator('.tnc-list-empty .tn-empty__message')).toHaveText('No tasks match this view. Review its filters.');
    }
    if (width === 400 && !publishedFallback) {
      const select = page.locator('.tnc-toolbar-view-select');
      await expect(select).toBeVisible();
      await expect(page.locator('.tnc-toolbar-views')).toBeHidden();
      await expect(select.locator('option[value="week"]')).toHaveText('Week');
    } else {
      await expect(page.locator('.tnc-toolbar-views')).toBeVisible();
    }
    await capture(`agenda-${theme}-${width}-${mobile}`);
  }
  if (publishedFallback) {
    await page.locator('.workspace-leaf.mod-active .advanced-calendar-view').focus();
    await page.keyboard.press('c');
  } else {
    await page.locator('.tnc-list-empty').getByRole('button', { name: 'New' }).click();
  }
  await expect(page.locator('.modal.mod-tasknotes')).toBeVisible();
  await page.keyboard.press('Escape');
});
