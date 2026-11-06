import { test, expect, type Locator, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, openTaskNotesSettings, closeObsidianSettings, expectTouchTarget, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
let page: Page;
let settings: any;
let dailyFolder: string;
const folder = `FinishR5-${Date.now()}`;
const path = `${folder}/Review.md`;
const title = 'Review supplier onboarding before delivery';
const statusLabel = 'Awaiting detailed accessibility and stakeholder review before the next scheduled delivery window';

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  const original = await page.evaluate(async ({ folder, path, title, statusLabel }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const settings = JSON.parse(JSON.stringify(plugin.settings));
    const daily = app.internalPlugins.getEnabledPluginById('daily-notes');
    const dailyFolder = daily.options.folder;
    daily.options.folder = folder;
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    plugin.settings.enableModalSplitLayout = true;
    plugin.settings.customStatuses = Array.from({ length: 32 }, (_, index) => ({ id: `finish-${index}`, value: `finish-${index}`, label: index === 0 ? statusLabel : `Stage ${index}`, color: 'var(--color-blue)', icon: 'circle', isCompleted: false }));
    plugin.settings.customPriorities = Array.from({ length: 32 }, (_, index) => ({ id: `finish-${index}`, value: `finish-${index}`, label: `Priority ${index}`, color: 'var(--color-orange)', weight: index }));
    plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
    plugin.priorityManager.updatePriorities(plugin.settings.customPriorities);
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    const today = (window as any).moment().format('YYYY-MM-DD');
    await app.vault.createFolder(folder);
    await app.vault.create(path, `---\ntitle: ${title}\ntags: [task, supplier, onboarding, compliance]\nstatus: finish-0\npriority: finish-1\nscheduled: ${today}T10:00\ndue: ${today}\n---\n`);
    for (const index of [1, 2]) await app.vault.create(`${folder}/Extra-${index}.md`, `---\ntitle: Extra ${index}\ntags: [task]\nstatus: finish-0\npriority: finish-1\n---\n`);
    await app.vault.create(`${folder}/Prose.md`, `Before [[${folder}/Review|supplier plan]], after.\n\nA longer sentence with **[[${folder}/Review|the complete plan]]**!\n\n[[${folder}/Review]]\n`);
    await app.vault.create(`${folder}/${today}.md`, `---\ntimeblocks:\n  - id: finish-block\n    title: Review the entire supplier onboarding plan including accessibility and stakeholder acceptance\n    startTime: '13:00'\n    endTime: '14:00'\n    description: Keep the supporting context available.\n---\n`);
    for (const [name, type, extra] of [['List', 'tasknotesTaskList', '    order: [status, tags, scheduled, due]\n'], ['Board', 'tasknotesKanban', '    groupBy:\n      property: status\n      direction: ASC\n'], ['Month', 'tasknotesCalendar', '    calendarView: dayGridMonth\n    showDue: true\n'], ['Day', 'tasknotesCalendar', '    calendarView: timeGridDay\n'], ['Empty', 'tasknotesTaskList', '']]) {
      await app.vault.create(`${folder}/${name}.base`, `filters:\n  and:\n    - file.inFolder("${folder}${name === 'Empty' ? '/missing' : ''}")\nviews:\n  - type: ${type}\n    name: ${name}\n${extra}`);
    }
    (window as any).finishLeaf = app.workspace.getLeaf(true);
    return { settings, dailyFolder };
  }, { folder, path, title, statusLabel });
  settings = original.settings;
  dailyFolder = original.dailyFolder;
  await expect.poll(() => page.evaluate(async path => Boolean(await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(path)), path)).toBe(true);
});

test.afterEach(async () => { for (let index = 0; index < 3; index++) await page.keyboard.press('Escape'); });
test.afterAll(async () => {
  try {
    if (page) await page.evaluate(async ({ folder, settings, dailyFolder }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      Object.assign(plugin.settings, settings);
      plugin.statusManager.updateStatuses(settings.customStatuses);
      plugin.priorityManager.updatePriorities(settings.customPriorities);
      await plugin.saveSettings();
      app.internalPlugins.getEnabledPluginById('daily-notes').options.folder = dailyFolder;
      (window as any).finishLeaf?.detach();
      const directory = app.vault.getAbstractFileByPath(folder);
      if (directory) await app.vault.delete(directory, true);
    }, { folder, settings, dailyFolder });
  } finally { if (instance) await closeObsidian(instance); }
});

async function open(name: string) {
  await page.evaluate(async ({ folder, name }) => {
    const app = (window as any).app;
    await (window as any).finishLeaf.openFile(app.vault.getAbstractFileByPath(`${folder}/${name}`), { state: { mode: 'preview' } });
    app.workspace.setActiveLeaf((window as any).finishLeaf, { focus: true });
  }, { folder, name });
}

async function appearance(width: number, theme = 'light') {
  await setObsidianViewport(page, { width, height: 800 });
  await page.evaluate(({ width, theme }) => {
    document.body.classList.toggle('is-mobile', width === 400);
    document.body.classList.toggle('theme-light', theme === 'light');
    document.body.classList.toggle('theme-dark', theme === 'dark');
  }, { width, theme });
}

async function capture(name: string) {
  await page.screenshot({ path: `/tmp/tasknotes-r5-finish/${name}.png` });
}

async function metadataContrast(metadata: Locator): Promise<{ color: string; background: string; ratio: number }> {
  let sample: { color: string; background: string; ratio: number } | null = null;
  await expect.poll(async () => {
    sample = await metadata.evaluate(element => {
      const style = getComputedStyle(element);
      if (!element.isConnected || !element.getClientRects().length || !style.color || !style.getPropertyValue('--background-primary')) return null;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      const luminance = (color: string) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        const channels = Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3).map(value => {
          const channel = value / 255;
          return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
        });
        return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
      };
      const color = style.color;
      const background = style.getPropertyValue('--background-primary');
      const foregroundLuminance = luminance(color);
      const backgroundLuminance = luminance(background);
      return { color, background, ratio: (Math.max(foregroundLuminance, backgroundLuminance) + .05) / (Math.min(foregroundLuminance, backgroundLuminance) + .05) };
    });
    return sample !== null;
  }).toBe(true);
  return sample!;
}

for (const width of [1180, 400]) for (const theme of ['light', 'dark']) test(`sentence references preserve line flow: ${width} ${theme}`, async () => {
  await appearance(width, theme);
  await open('Prose.md');
  const sentence = page.locator('.workspace-leaf.mod-active .tasknotes-inline-widget--sentence:visible').first();
  const menu = sentence.locator('.task-card__context-menu');
  await expect(sentence).toBeVisible();
  await expect(menu).toHaveCSS('position', width === 400 ? 'relative' : 'absolute');
  if (width === 400) await expectTouchTarget(menu);
  await page.mouse.move(5, 5);
  await expect(menu).toHaveCSS('opacity', width === 400 ? '1' : '0');
  const before = await sentence.boundingBox();
  await sentence.hover();
  await expect(menu).toHaveCSS('opacity', '1');
  expect(await sentence.boundingBox()).toEqual(before);
  expect(before!.width).toBeLessThan(190);
  const punctuation = await sentence.evaluate(element => {
    const following = element.nextSibling;
    if (!following) return null;
    const range = document.createRange();
    range.setStart(following, 0);
    range.setEnd(following, 1);
    return { next: range.getBoundingClientRect().top, widget: element.getBoundingClientRect().top };
  });
  expect(punctuation).not.toBeNull();
  expect(Math.abs(punctuation!.next - punctuation!.widget)).toBeLessThan(8);
  await menu.focus();
  await expect(menu).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await capture(`sentence-${width}-${theme}`);
});

for (const key of ['s', 'p', 'd', 't']) test(`shared picker Home/End reveal: ${key}`, async () => {
  await appearance(1180);
  await open('List.base');
  await page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${path}"] .task-card__status-dot`).focus();
  await page.keyboard.press(key);
  const input = page.locator('.tn-picker__input');
  await expect(input).toBeFocused();
  await input.press('End');
  const rows = page.locator('.tn-picker__row');
  await expect(rows.last()).toHaveClass(/is-active/);
  const active = await rows.last().boundingBox();
  const list = await page.locator('.tn-picker__list').boundingBox();
  expect(active!.y + active!.height).toBeLessThanOrEqual(list!.y + list!.height + 1);
  await input.press('Home');
  await expect(rows.first()).toHaveClass(/is-active/);
  await capture(`picker-${key}`);
});

for (const [key, label] of [['d', 'Due date'], ['Shift+H', 'Scheduled date']]) test(`precise modal names ${label}`, async () => {
  await open('List.base');
  await page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${path}"] .task-card__status-dot`).focus();
  await page.keyboard.press(key);
  await page.locator('.tn-picker__row').filter({ hasText: 'Pick date & time' }).click();
  await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: label, exact: true })).toBeVisible();
  await capture(`precise-${key.replace('+', '-')}`);
});

test('filtered empty views put Filters first and New second', async () => {
  await open('Empty.base');
  const buttons = page.locator('.workspace-leaf.mod-active .tn-empty button');
  await expect(buttons.first()).toHaveText('Filters');
  await expect(buttons.first()).toHaveClass(/mod-cta/);
  await expect(buttons.nth(1)).toHaveText('New');
  await buttons.first().click();
  await capture('filtered-empty');
});

test('long Kanban headings reveal the complete name by keyboard and touch-sized control', async () => {
  await appearance(400);
  await open('Board.base');
  const heading = page.locator('.workspace-leaf.mod-active .kanban-view__column[data-group="finish-0"] .kanban-view__column-title');
  await expect(heading).toBeVisible();
  await expect(heading).toHaveAttribute('tabindex', '0');
  expect((await heading.boundingBox())!.height).toBeGreaterThanOrEqual(40);
  await heading.focus();
  await heading.press('Enter');
  await expect(page.locator('.tn-popover__title')).toHaveText(statusLabel);
  const disclosure = await page.locator('.tn-popover').boundingBox();
  const anchor = await heading.boundingBox();
  expect(disclosure!.x).toBeGreaterThanOrEqual(8);
  expect(disclosure!.x + disclosure!.width).toBeLessThanOrEqual(392);
  expect(disclosure!.y).toBeGreaterThanOrEqual(anchor!.y + anchor!.height);
  await capture('heading-keyboard');
  await page.keyboard.press('Escape');
  await heading.click();
  await expect(page.locator('.tn-popover__title')).toHaveText(statusLabel);
});

test('typing details keeps the editor stable until leaving it', async ({}, testInfo) => {
  for (const theme of ['light', 'dark']) for (const width of [1180, 700, 400]) {
    await appearance(width, theme);
    await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.openTaskCreationModal());
    const modal = page.locator('.modal.mod-tasknotes');
    await modal.locator('.tn-task-modal__details-toggle').click();
    const editor = modal.locator('.tn-task-modal__markdown-editor--details .cm-content');
    await editor.focus();
    const before = await editor.boundingBox();
    await editor.fill('Details that deserve their own pane');
    await testInfo.attach(`details-${theme}-${width}`, { body: JSON.stringify({ beforeTyping: before, afterTyping: await editor.boundingBox() }), contentType: 'application/json' });
    expect(await editor.boundingBox()).toEqual(before);
    expect(await editor.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      const pane = element.closest('.modal-split-right')!.getBoundingClientRect();
      return bounds.top >= pane.top && bounds.bottom <= pane.bottom;
    })).toBe(true);
    await modal.locator('.title-input').first().focus();
    await expect(modal.locator('.modal-split-content')).not.toHaveClass(/modal-split-content--details-empty/);
    await capture(`details-after-blur-${theme}-${width}`);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(modal).toBeHidden();
  }
});

test('timeblock title wraps like the task editor on mobile', async () => {
  await appearance(1180);
  await open('Day.base');
  await page.locator('.workspace-leaf.mod-active .tnc-item[data-event-type="timeblock"]').first().click();
  await appearance(400);
  const title = page.locator('.tn-modal--composer .tn-modal__title');
  await expect(title).toHaveJSProperty('tagName', 'TEXTAREA');
  await title.fill('Review the entire supplier onboarding plan including accessibility and stakeholder acceptance');
  expect((await title.boundingBox())!.height).toBeGreaterThan(50);
  const footer = await page.locator('.tn-modal__footer').boundingBox();
  expect(footer!.y + footer!.height).toBeLessThan(800);
  await capture('timeblock-400');
});

test('month bars spend their width on identity rather than duplicate status glyphs', async () => {
  await appearance(1180);
  await page.evaluate(async path => {
    const app = (window as any).app;
    await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(path), (frontmatter: any) => {
      frontmatter.scheduled = (window as any).moment().format('YYYY-MM-DD');
    });
  }, path);
  await expect.poll(() => page.evaluate(async path => (await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(path))?.scheduled, path)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await open('Month.base');
  const bar = page.locator(`.workspace-leaf.mod-active .tnc-dg .tnc-item--bar[data-task-path="${path}"]`).first();
  await expect(bar).toBeVisible();
  await expect(bar.locator('.tn-task-glyphs__status')).toBeHidden();
  await expect(bar.locator('.tn-calendar-event-title')).toHaveText(title);
  await expect(bar.locator('.tn-calendar-event-title')).toHaveCSS('white-space', 'nowrap');
  await capture('month-1180');
});

test('batch Undo confirms the property and count without resurfacing older actions', async () => {
  await appearance(1180);
  await open('List.base');
  await page.evaluate(({ folder, path }) => {
    const selection = (window as any).app.plugins.plugins.tasknotes.taskSelectionService;
    selection.clearSelection();
    for (const candidate of [path, `${folder}/Extra-1.md`, `${folder}/Extra-2.md`]) selection.addToSelection(candidate);
  }, { folder, path });
  const status = page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${path}"] .task-card__status-dot`);
  for (const priority of ['finish-2', 'finish-3']) {
    await status.focus();
    await page.keyboard.press('p');
    await page.locator(`.tn-picker__row[data-picker-id="${priority}"]`).click();
    await expect(page.locator('.tn-toast__message')).toHaveText(`3 tasks updated: Priority → Priority ${priority.split('-')[1]}`);
  }
  await page.locator('.tn-toast__action').click();
  await expect(page.locator('.tn-toast__message')).toHaveText('Undid Priority change for 3 tasks');
  await expect(page.locator('.tn-toast')).toHaveCount(1);
  await expect(page.locator('.tn-toast__action')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect.poll(() => page.evaluate(async ({ folder, path }) => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    return Promise.all([path, `${folder}/Extra-1.md`, `${folder}/Extra-2.md`].map(async candidate => (await plugin.cacheManager.getTaskInfo(candidate))?.priority));
  }, { folder, path })).toEqual(['finish-1', 'finish-1', 'finish-1']);
});

for (const theme of ['light', 'dark']) test(`desktop title allocation and small metadata contrast: ${theme}`, async ({}, testInfo) => {
  await appearance(1180, theme);
  await open('List.base');
  const card = page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${path}"]`);
  await expect(card).toBeVisible();
  await expect.poll(() => card.locator('.task-card__title-text').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  const contrast = await metadataContrast(card.locator('.task-card__metadata'));
  await testInfo.attach('metadata-contrast', { body: JSON.stringify(contrast), contentType: 'application/json' });
  expect(contrast.ratio).toBeGreaterThanOrEqual(4.5);
  await capture(`list-${theme}-contrast-${contrast.ratio.toFixed(2)}`);
});

test('metadata contrast distinguishes a replaced row from low-contrast ink', async ({}, testInfo) => {
  await appearance(1180);
  await open('List.base');
  const card = page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${path}"]`);
  const metadata = card.locator('.task-card__metadata');
  const previous = await metadata.elementHandle();
  const refreshedTitle = `${title} after background refresh`;
  try {
    await page.evaluate(async ({ path, refreshedTitle }) => {
      const app = (window as any).app;
      await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(path), (frontmatter: any) => { frontmatter.title = refreshedTitle; });
    }, { path, refreshedTitle });
    await expect(card.locator('.task-card__title-text')).toHaveText(refreshedTitle);
    await expect.poll(() => previous!.evaluate(element => element.isConnected)).toBe(false);
    const detached = await previous!.evaluate(element => {
      const style = getComputedStyle(element);
      const context = document.createElement('canvas').getContext('2d')!;
      const pixel = (color: string) => {
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return Array.from(context.getImageData(0, 0, 1, 1).data);
      };
      return { color: style.color, background: style.getPropertyValue('--background-primary'), foregroundPixel: pixel(style.color), backgroundPixel: pixel(style.getPropertyValue('--background-primary')) };
    });
    await testInfo.attach('detached-metadata-measurement', { body: JSON.stringify(detached), contentType: 'application/json' });
    expect(detached.color).toBe('');
    expect(detached.background).toBe('');
    expect(detached.foregroundPixel).toEqual([0, 0, 0, 255]);
    expect(detached.backgroundPixel).toEqual(detached.foregroundPixel);
    const live = await metadataContrast(metadata);
    await testInfo.attach('live-metadata-contrast', { body: JSON.stringify(live), contentType: 'application/json' });
    expect(live.ratio).toBeGreaterThanOrEqual(4.5);
  } finally {
    await page.evaluate(async ({ path, title }) => {
      const app = (window as any).app;
      await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(path), (frontmatter: any) => { frontmatter.title = title; });
    }, { path, title });
    await expect(card.locator('.task-card__title-text')).toHaveText(title);
  }
});

test('shortcut help and empty statistics keep a compact rhythm', async () => {
  await appearance(1180);
  await open('List.base');
  await page.locator('.notice-container .notice').evaluateAll(elements => elements.forEach(element => element.remove()));
  await page.getByRole('button', { name: 'Keyboard shortcuts', exact: true }).click();
  const row = page.locator('.tn-shortcut-row').first();
  await expect(row).toBeVisible();
  expect((await row.boundingBox())!.height).toBe(40);
  await capture('help-1180');
  await page.keyboard.press('Escape');
  await page.evaluate(async () => {
    const app = (window as any).app;
    const cache = app.plugins.plugins.tasknotes.cacheManager;
    (window as any).finishTaskPaths = cache.getAllTaskPaths;
    cache.getAllTaskPaths = () => new Set();
    await (window as any).finishLeaf.setViewState({ type: 'tasknotes-stats-view', active: true });
  });
  try {
    const empty = page.locator('.workspace-leaf.mod-active .stats-view__period-summary');
    await expect(empty).toHaveCount(3);
    for (const width of [1180, 400]) {
      await appearance(width);
      await expect(empty.first()).toHaveText('—');
      await expect(empty.first()).toHaveAttribute('aria-label', 'No activity in this period.');
      await capture(`statistics-${width}`);
    }
  } finally {
    await page.evaluate(() => {
      (window as any).app.plugins.plugins.tasknotes.cacheManager.getAllTaskPaths = (window as any).finishTaskPaths;
    });
  }
});

test('settings cards keep readable headers without excess vertical spacing', async () => {
  await appearance(1180);
  const settingsPage = await openTaskNotesSettings(page, 'Task properties');
  try {
    const header = settingsPage.locator('.tasknotes-settings__card-header').first();
    await expect(header).toBeVisible();
    expect(await header.evaluate(element => parseFloat(getComputedStyle(element).paddingTop))).toBe(8);
    await settingsPage.screenshot({ path: '/tmp/tasknotes-r5-finish/settings-1180.png' });
  } finally { await closeObsidianSettings(page, settingsPage); }
});
