import { test, expect, type Page, type Locator } from '@playwright/test';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
let page: Page;
const folder = `Bugs-round3-${Date.now()}`;

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await setObsidianViewport(page, { width: 1180, height: 800 });
  const dismiss = page.locator('.notice').getByText("Don't show again", { exact: true });
  if (await dismiss.isVisible()) await dismiss.click();
  await page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    (window as any).bugsOriginalSettings = structuredClone(plugin.settings);
    const daily = app.internalPlugins.getEnabledPluginById('daily-notes');
    (window as any).bugsDailyFolder = daily.options.folder;
    daily.options.folder = folder;
    plugin.settings.calendarViewSettings.enableTimeblocking = true;
    plugin.settings.calendarViewSettings.timeFormat = '24';
    plugin.settings.enableNaturalLanguageInput = false;
    await app.vault.createFolder(folder);
    for (let index = 0; index < 3; index++) {
      await app.vault.create(`${folder}/Task ${index}.md`,
        `---\ntags: [task, bugs-round3]\ntitle: Bugs task ${index}\nstatus: open\npriority: normal\ndue: 2026-11-13\nscheduled: 2026-11-13\n---\n`);
    }
    await app.vault.create(`${folder}/2026-11-13.md`, `---\ntimeblocks:\n  - id: bugs-block\n    title: Fresh timeblock\n    startTime: '13:00'\n    endTime: '14:00'\n---\n`);
    await app.vault.create(`${folder}/Inline.md`, `Before [[${folder}/Task 0]] after.\n`);
  }, folder);
});

test.afterAll(async () => {
  try {
    if (page && !page.isClosed()) await page.evaluate(async folder => {
      const app = (window as any).app;
      app.plugins.plugins.tasknotes.settings = (window as any).bugsOriginalSettings;
      app.internalPlugins.getEnabledPluginById('daily-notes').options.folder = (window as any).bugsDailyFolder;
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally { if (instance) await closeObsidian(instance); }
});

async function openView(type: string): Promise<Locator> {
  const content = stringify({ filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("bugs-round3")'] },
    views: [{ type, name: 'Bugs', order: ['status', 'priority', 'due'],
      sort: [{ property: 'file.name', direction: 'ASC' }], enableSearch: true,
      initialDate: '2026-11-13', calendarView: 'timeGridDay', showTimeblocks: true,
      slotMinTime: '08:00:00', slotMaxTime: '18:00:00',
      groupBy: { property: 'status', direction: 'ASC' } }] });
  await page.evaluate(async ({ path, content }) => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).openFile(await app.vault.create(path, content));
  }, { path: `${folder}/${type}-${Date.now()}.base`, content });
  const root = page.locator(`.workspace-leaf.mod-active ${type === 'tasknotesCalendar' ? '.advanced-calendar-view' : `.tn-${type}`}`);
  await expect(root).toBeVisible();
  if (type !== 'tasknotesMiniCalendar') await expect(root.locator('[data-task-path]').first()).toBeVisible();
  await root.focus();
  return root;
}

async function resetTimeblock(): Promise<void> {
  await page.evaluate(async folder => {
    const app = (window as any).app;
    await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(`${folder}/2026-11-13.md`), (frontmatter: any) => {
      frontmatter.timeblocks = [{ id: 'bugs-block', title: 'Fresh timeblock', startTime: '13:00', endTime: '14:00' }];
    });
  }, folder);
  await expect.poll(() => page.evaluate(folder => {
    const app = (window as any).app;
    return app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(`${folder}/2026-11-13.md`))?.frontmatter?.timeblocks?.[0];
  }, folder)).toMatchObject({ startTime: '13:00', endTime: '14:00' });
}

for (const kind of ['drop', 'resize']) {
  test(`timeblock ${kind}: opening stale item reads current times before title-only save`, async () => {
    await resetTimeblock();
    await openView('tasknotesCalendar');
    await page.evaluate(async kind => {
      const app = (window as any).app;
      const view = app.workspace.activeLeaf.view.controller.view;
      await view.refetchEvents();
      const item = view.calendarItems.find((item: any) => item.data?.timeblock?.id === 'bugs-block');
      if (!item) throw new Error('Missing timeblock fixture');
      (window as any).bugsStaleItem = structuredClone(item);
      const oldEvent = { id: item.id, title: item.title, start: new Date(item.start), end: new Date(item.end), allDay: false, extendedProps: item.data };
      await view[kind === 'resize' ? 'handleEventResize' : 'handleEventDrop']({ oldEvent,
        event: { ...oldEvent, start: new Date('2026-11-13T14:00'), end: new Date('2026-11-13T16:00') },
        isPointer: true, jsEvent: null, revert: () => { throw new Error('Unexpected revert'); } });
      const stale = (window as any).bugsStaleItem;
      stale.start = '2026-11-13T14:00';
      stale.end = '2026-11-13T16:00';
      await view.handleEventClick({ item: stale, el: view.containerEl, jsEvent: new MouseEvent('click') });
    }, kind);
    const modal = page.locator('.timeblock-info-modal');
    await expect(modal).toBeVisible();
    await page.screenshot({ path: `test-results/r3-timeblock-${kind}.png`, animations: 'disabled' });
    const times = await modal.locator('select').evaluateAll(elements => elements.map(element => (element as HTMLSelectElement).value));
    expect(times).toEqual(['14', '0', '16', '0']);
    await modal.locator('input[type=text]').first().fill(`Fresh title ${kind}`);
    await modal.getByRole('button', { name: /Save/ }).click();
    await expect.poll(() => page.evaluate(async folder => {
      const app = (window as any).app;
      return app.vault.read(app.vault.getAbstractFileByPath(`${folder}/2026-11-13.md`));
    }, folder)).toMatch(/startTime: ['"]?14:00[\s\S]*endTime: ['"]?16:00/);
  });
}

test('native timeblock drag and resize keep event payload and writable editor fresh', async () => {
  await resetTimeblock();
  const root = await openView('tasknotesCalendar');
  const block = root.locator('.tnc-item[data-event-type="timeblock"]');
  await expect(block).toBeVisible();
  const box = (await block.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 10 + box.height, { steps: 12 });
  await page.mouse.up();
  const payload = () => page.evaluate(() => (window as any).app.workspace.activeLeaf.view.controller.view.calendarItems.find((item: any) => item.data?.timeblock?.id === 'bugs-block')?.data.timeblock);
  await expect.poll(payload).toMatchObject({ startTime: '14:00', endTime: '15:00' });
  await block.click();
  await expect(page.locator('.timeblock-info-modal')).toBeVisible();
  expect(await page.locator('.timeblock-info-modal select').evaluateAll(elements => elements.map(element => (element as HTMLSelectElement).value))).toEqual(['14', '0', '15', '0']);
  await page.keyboard.press('Escape');
  const handle = block.locator('.tnc-resize-end');
  await handle.hover();
  const resize = (await handle.boundingBox())!;
  await page.mouse.move(resize.x + resize.width / 2, resize.y + resize.height / 2);
  await page.mouse.down();
  await page.mouse.move(resize.x + resize.width / 2, resize.y + resize.height / 2 + box.height, { steps: 12 });
  await page.mouse.up();
  await expect.poll(payload).toMatchObject({ startTime: '14:00', endTime: '16:00' });
  await block.click();
  const modal = page.locator('.timeblock-info-modal');
  await expect(modal).toBeVisible();
  expect(await modal.locator('select').evaluateAll(elements => elements.map(element => (element as HTMLSelectElement).value))).toEqual(['14', '0', '16', '0']);
  await modal.locator('input[type=text]').first().fill('Native drag kept');
  await modal.getByRole('button', { name: /Save/ }).click();
  await expect.poll(payload).toMatchObject({ startTime: '14:00', endTime: '16:00' });
});

test('adjacent month click updates the displayed grid and month state together', async () => {
  const root = await openView('tasknotesMiniCalendar');
  const adjacent = root.locator('.mini-calendar-view__day--outside-month').last();
  await expect(adjacent).toBeVisible();
  await adjacent.click();
  await page.screenshot({ path: 'test-results/r3-mini-month.png' });
  await expect(root.locator('.mini-calendar-view__day--selected')).not.toHaveClass(/outside-month/);
  await expect.poll(() => page.evaluate(() => {
    const view = (window as any).app.workspace.activeLeaf.view.controller.view;
    return view.displayedYear === view.selectedDate.getUTCFullYear() && view.displayedMonth === view.selectedDate.getUTCMonth();
  })).toBe(true);
});

for (const mode of ['preview', 'source']) test(`inline status click and reverse click each offer working Undo in ${mode}`, async () => {
  await page.evaluate(async ({ path, mode }) => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(path), { state: { mode, source: false } });
  }, { path: `${folder}/Inline.md`, mode });
  const glyph = page.locator('.workspace-leaf.mod-active .task-card--layout-inline:visible .task-card__status-dot').first();
  await expect(glyph).toBeVisible();
  const status = () => page.evaluate(async path => (await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(path)).status, `${folder}/Task 0.md`);
  for (const reverse of [false, true]) {
    const before = await status();
    await glyph.click({ modifiers: reverse ? ['Shift'] : [] });
    await expect.poll(status).not.toBe(before);
    await expect(page.locator('.tn-toast__action')).toBeVisible();
    if (reverse) await page.keyboard.press('Control+z');
    else await page.locator('.tn-toast__action').click();
    await expect.poll(status).toBe(before);
  }
});

test('current-task cycle commands and legacy status toggle offer shared Undo', async () => {
  await page.evaluate(async path => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(path), { state: { mode: 'preview' } });
  }, `${folder}/Task 0.md`);
  for (const action of ['status', 'priority', 'toggle']) {
    const property = action === 'toggle' ? 'status' : action;
    const value = () => page.evaluate(async ({ path, property }) => {
      const task = await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(path);
      return task[property];
    }, { path: `${folder}/Task 0.md`, property });
    const before = await value();
    await page.evaluate(async ({ path, action }) => {
      const app = (window as any).app;
      if (action === 'toggle') {
        const plugin = app.plugins.plugins.tasknotes;
        await plugin.toggleTaskStatus(await plugin.cacheManager.getTaskInfo(path));
      } else app.commands.executeCommandById(`tasknotes:cycle-current-task-${action}`);
    }, { path: `${folder}/Task 0.md`, action });
    await expect.poll(value).not.toBe(before);
    await page.locator('.tn-toast__action').click();
    await expect.poll(value).toBe(before);
  }
});

test('semantic date text meets contrast in both themes and inherits theme overrides', async () => {
  await page.evaluate(async folder => {
    const app = (window as any).app;
    for (const [index, offset] of [[0, 0], [1, -1]]) {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      const due = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(`${folder}/Task ${index}.md`), (frontmatter: any) => { frontmatter.due = due; });
    }
  }, folder);
  const root = await openView('tasknotesTaskList');
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => {
      if (!document.body.classList.contains(`theme-${theme}`)) (window as any).app.commands.executeCommandById('theme:toggle-light-dark');
    }, theme);
    for (const state of ['today', 'overdue']) {
      const date = root.locator(`.task-card__metadata-date--${state}.task-card__metadata-date--due`).first();
      await expect(date).toBeVisible();
      const ratios = await date.evaluate(element => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d')!;
        const luminance = (color: string) => {
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          const values = Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3).map(channel => {
            const value = channel / 255;
            return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
          });
          return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
        };
        const styles = getComputedStyle(element);
        const foreground = luminance(styles.color);
        return ['--tn-bg-primary', '--tn-bg-secondary'].map(token => {
          const background = luminance(styles.getPropertyValue(token));
          return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
        });
      });
      console.log(`${theme} ${state}: ${ratios.join(', ')}`);
      for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    const today = root.locator('.task-card__metadata-date--today.task-card__metadata-date--due').first();
    const originalColor = await today.evaluate(element => getComputedStyle(element).color);
    await root.evaluate(element => element.style.setProperty('--tn-warning', 'rgb(8, 80, 140)'));
    expect(await today.evaluate(element => getComputedStyle(element).color)).not.toBe(originalColor);
    await root.evaluate(element => element.style.setProperty('--tn-warning-text', 'rgb(20, 90, 150)'));
    expect(await today.evaluate(element => getComputedStyle(element).color)).toBe('rgb(20, 90, 150)');
    await root.evaluate(element => { element.style.removeProperty('--tn-warning'); element.style.removeProperty('--tn-warning-text'); });
    await expect(page.locator('.notice:not(.tn-toast)')).toHaveCount(0, { timeout: 12000 });
    await page.screenshot({ path: `test-results/r3-contrast-${theme}.png` });
  }
});

for (const type of ['tasknotesTaskList', 'tasknotesKanban']) {
  test(`${type}: tab focus reconciles every property action to the focused card`, async () => {
    const root = await openView(type);
    const first = root.locator(`.task-card[data-task-path="${folder}/Task 0.md"]`);
    const second = root.locator(`.task-card[data-task-path="${folder}/Task 1.md"]`);
    await second.locator('.task-card__priority-dot').click();
    await expect(page.locator('.tn-picker')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.tn-picker')).toHaveCount(0);
    const statusControl = first.locator('.task-card__status-dot');
    for (let index = 0; index < 50 && !(await statusControl.evaluate(element => element === document.activeElement)); index++) {
      await page.keyboard.press('Tab');
    }
    await expect(statusControl).toBeFocused();
    await expect(first).toHaveClass(/tn-task-focused/);
    await page.screenshot({ path: `test-results/r3-focus-${type}.png`, animations: 'disabled' });
    await page.keyboard.press('s');
    await page.locator('.tn-picker__row[data-picker-id="in-progress"]').click();
    await expect.poll(() => page.evaluate(async path =>
      (await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(path)).status,
    `${folder}/Task 0.md`)).toBe('in-progress');
    await expect.poll(() => page.evaluate(async path =>
      (await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(path)).status,
    `${folder}/Task 1.md`)).toBe('open');
    await page.locator('.tn-toast__action').click();
    await expect(first.locator('.task-card__status-dot')).toHaveAttribute('aria-label', 'Open');
    for (const key of ['p', 'd', 'Shift+H', 't', 'Control+k']) {
      await second.locator('.task-card__priority-dot').click();
      await expect(page.locator('.tn-picker')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.tn-picker')).toHaveCount(0);
      await first.locator('.task-card__status-dot').focus();
      await expect(first).toHaveClass(/tn-task-focused/);
      await page.keyboard.press(key);
      await expect(page.locator('.tn-picker')).toBeVisible();
      await page.keyboard.press('Escape');
    }
    await first.locator('.task-card__status-dot').focus();
    await page.keyboard.press('x');
    expect(await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.taskSelectionService.getSelectedPaths())).toEqual([`${folder}/Task 0.md`]);
    await page.keyboard.press('Escape');
    await first.locator('.task-card__status-dot').focus();
    await page.keyboard.press('e');
    await expect(page.locator('.minimalist-task-modal').getByRole('textbox', { name: 'What needs to be done?', exact: true })).toHaveValue('Bugs task 0');
    await page.keyboard.press('Escape');
  });
}
