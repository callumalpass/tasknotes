import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { parse } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

test.use({ trace: 'on' });

let instance: ObsidianApp;
let page: Page;
let settings: any;
let today: string;
const folder = `PolishR3-${Date.now()}`;
const taskPath = `${folder}/Review.md`;

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await setObsidianViewport(page, { width: 1180, height: 800 });
  const state = await page.evaluate(async ({ folder, taskPath }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const settings = JSON.parse(JSON.stringify(plugin.settings));
    plugin.settings.enableNaturalLanguageInput = true;
    plugin.settings.enableModalSplitLayout = false;
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    await app.vault.createFolder(folder);
    await app.vault.create(taskPath, `---\ntags: [task, polish]\ntitle: Review the launch plan\nstatus: custom-unconfigured\npriority: custom-priority\nscheduled: ${today}T10:00\ndue: ${today}\ntimeEstimate: 60\nprojects: ['[[Missing project]]']\n---\n`);
    await app.vault.create(`${folder}/Prose.md`, `Before [[${folder}/Review|Review the launch plan]] and after.\n`);
    for (const [name, type] of [['Mini', 'tasknotesMiniCalendar'], ['Calendar', 'tasknotesCalendar']]) {
      await app.vault.create(`${folder}/${name}.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\nviews:\n  - type: ${type}\n    name: ${name}\n    dateProperty: note.scheduled\n    titleProperty: title\n    calendarView: timeGridDay\n    showTimeblocks: false\n    showTimeEntries: false\n    showPropertyBasedEvents: false\n    order: [status, priority, scheduled, due]\n`);
    }
    (window as any).polishLeaf = app.workspace.getLeaf(true);
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    return { settings, today };
  }, { folder, taskPath });
  settings = state.settings;
  today = state.today;
  await expect.poll(() => page.evaluate(async path => Boolean(await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(path)), taskPath)).toBe(true);
});

test.afterEach(async () => {
  for (let count = 0; count < 3; count++) await page.keyboard.press('Escape');
});

test.afterAll(async () => {
  try {
    if (page) await page.evaluate(async ({ folder, settings }) => {
      const app = (window as any).app;
      Object.assign(app.plugins.plugins.tasknotes.settings, settings);
      await app.plugins.plugins.tasknotes.saveSettings();
      for (const file of app.vault.getMarkdownFiles()) {
        if (file.basename.startsWith(folder)) await app.vault.delete(file, true);
      }
      const directory = app.vault.getAbstractFileByPath(folder);
      if (directory) await app.vault.delete(directory, true);
    }, { folder, settings });
  } finally { if (instance) await closeObsidian(instance); }
});

async function capture(name: string) {
  mkdirSync('test-results/polish-r3', { recursive: true });
  await page.locator('.notice-container .notice').evaluateAll(elements => elements.forEach(element => element.remove()));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: `test-results/polish-r3/${name}.png`, animations: 'disabled', clip: { x: 0, y: 0, ...page.viewportSize()! } });
}

async function openTask() {
  await page.evaluate(async path => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    await plugin.openTaskEditModal(await plugin.cacheManager.getTaskInfo(path));
  }, taskPath);
  return page.locator('.modal.mod-tasknotes');
}

async function openFile(name: string) {
  await page.evaluate(async path => {
    const app = (window as any).app;
    await (window as any).polishLeaf.openFile(app.vault.getAbstractFileByPath(path), { state: { mode: 'preview' } });
    app.workspace.setActiveLeaf((window as any).polishLeaf, { focus: true });
  }, `${folder}/${name}`);
}

test('one title editor preserves raw parsing, explicit overrides and draft-only changes', async () => {
  await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.openTaskCreationModal());
  const modal = page.locator('.modal.mod-tasknotes');
  const raw = modal.locator('.tn-task-modal__markdown-editor--nlp .cm-content');
  await raw.fill(`${folder} draft tomorrow`);
  await modal.locator('.tn-task-modal__details-toggle').click();
  await capture('title-expanded');
  await expect(modal.locator('.tn-task-modal__markdown-editor--nlp:visible, textarea.title-input:visible, textarea.title-input-detailed:visible')).toHaveCount(1);
  const title = modal.locator('textarea.title-input-detailed');
  await expect(title).toHaveValue(`${folder} draft`);
  await title.fill(`${folder} explicit title`);
  await modal.locator('.tn-task-modal__details-toggle').click();
  await expect(raw).toBeVisible();
  await raw.fill(`${folder} changed raw next week`);
  await modal.locator('.tn-task-modal__details-toggle').click();
  await expect(title).toHaveValue(`${folder} explicit title`);
  expect(await page.evaluate(title => (window as any).app.vault.getMarkdownFiles().some((file: any) => file.basename === title), `${folder} explicit title`)).toBe(false);
  await title.press('Control+Enter');
  await expect(modal).toHaveCount(0);
  await expect.poll(() => page.evaluate(async title => {
    const tasks = await (window as any).app.plugins.plugins.tasknotes.cacheManager.getAllTasks();
    return tasks.some((task: any) => task.title === title && Boolean(task.due || task.scheduled));
  }, `${folder} explicit title`)).toBe(true);
});

test('unknown values have one warning and unresolved projects stay quiet and removable', async () => {
  const modal = await openTask();
  const project = modal.locator('.task-project-item--unresolved');
  await expect(project).toContainText('Missing project');
  await capture('project');
  expect(await project.evaluate(element => getComputedStyle(element).borderTopStyle)).not.toBe('dashed');
  for (const type of ['status', 'priority']) {
    await modal.locator(`[data-type="${type}"]`).click();
    const row = page.locator('.tn-picker__row').filter({ hasText: type === 'status' ? 'custom-unconfigured' : 'custom-priority' });
    await capture(`unknown-${type}`);
    expect((await row.innerText()).match(/not configured/g)).toHaveLength(1);
    await page.keyboard.press('Escape');
  }
  await project.locator('.task-project-remove').click();
  await expect(project).toHaveCount(0);
  expect(await page.evaluate(async path => (window as any).app.vault.read((window as any).app.vault.getAbstractFileByPath(path)), taskPath)).toContain('Missing project');
});

test('precise date entry comes first and weekdays remain grouped and searchable', async () => {
  const modal = await openTask();
  await modal.locator('[data-type="due-date"]').click();
  await capture('date-picker');
  await expect(page.locator('.tn-picker__row').first()).toContainText('Pick date & time');
  await expect(page.locator('.tn-picker__group')).toHaveText('Weekdays');
  const weekday = page.locator('.tn-picker__row').filter({ hasText: 'Monday' });
  await expect(weekday).toHaveCount(1);
  await page.locator('.tn-picker__input').fill('Monday');
  await expect(weekday).toBeVisible();
  await page.locator('.tn-picker__input').fill('');
  await page.locator('[data-picker-id="custom"]').click();
  await expect(page.locator('.date-time-picker-modal')).toBeVisible();
});

test('report metrics remain compact in light and dark, desktop and phone layouts', async () => {
  for (const type of ['tasknotes-stats-view', 'tasknotes-pomodoro-stats-view']) {
    await page.evaluate(async type => (window as any).polishLeaf.setViewState({ type, active: true }), type);
    for (const theme of ['theme-light', 'theme-dark']) for (const width of [1180, 400]) {
      await setObsidianViewport(page, { width, height: 800 });
      await page.evaluate(({ theme, width }) => {
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(theme);
        document.body.classList.toggle('is-mobile', width === 400);
      }, { theme, width });
      await capture(`${type}-${theme}-${width}`);
      const metrics = page.locator(type === 'tasknotes-stats-view' ? '.stats-view__overview-grid' : '.pomodoro-stats-view__overview-grid');
      await expect(metrics).toHaveClass(/tn-metrics/);
      expect(await metrics.evaluate(element => getComputedStyle(element).display)).toBe('grid');
      const card = metrics.locator(':scope > div').first();
      expect(await card.evaluate(element => getComputedStyle(element).flexDirection)).toBe('column');
      expect(await page.locator('.workspace-leaf.mod-active .view-content').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    }
  }
});

test('release changes precede notices and promotion', async () => {
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await page.evaluate(async () => {
    document.body.classList.remove('is-mobile');
    await (window as any).polishLeaf.setViewState({ type: 'tasknotes-release-notes', active: true });
  });
  await expect(page.locator('.release-notes-versions')).toBeVisible();
  await capture('release-notes');
  expect(await page.locator('.release-notes-versions').evaluate(element => Boolean(element.compareDocumentPosition(document.querySelector('.release-notes-announcement')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  const current = page.locator('.release-notes-version-content').first();
  expect(await current.evaluate(element => element.firstElementChild?.classList.contains('callout'))).toBe(false);
});

test('Pomodoro selection and clearing retain shared button treatment', async () => {
  await page.evaluate(async () => (window as any).polishLeaf.setViewState({ type: 'tasknotes-pomodoro-view', active: true }));
  const button = page.locator('.pomodoro-view__task-select-button');
  await capture('pomodoro');
  await expect(button).toHaveClass(/tn-btn--sm/);
  await expect(button.locator('.lucide-chevron-down')).toBeVisible();
  await button.click();
  await expect(page.locator('.prompt')).toBeVisible();
  await page.locator('.prompt-input').fill('Review the launch plan');
  await page.locator('.suggestion-item').filter({ hasText: 'Review the launch plan' }).first().click();
  await expect(button).toContainText('Change task');
  await expect(button.locator('.lucide-chevron-down')).toBeVisible();
  await page.locator('.pomodoro-view__task-clear-button').click();
  await expect(button).toContainText('Choose task');
});

test('mini calendar day drilldown carries the selected civil date', async () => {
  await openFile('Mini.base');
  const day = page.locator('.workspace-leaf.mod-active .mini-calendar-view__day[aria-current="date"]');
  await expect(day).toHaveAttribute('aria-description', /Review the launch plan/);
  await day.click();
  await expect(page.locator('.prompt')).toBeVisible();
  await capture('mini-drilldown');
  await expect(page.locator('.prompt .modal-title')).toContainText(String(new Date(`${today}T12:00`).getFullYear()));
  await expect(page.locator('.suggestion-item').filter({ hasText: 'Review the launch plan' })).toHaveCount(1);
});

test('inline references keep list metadata order and trailing task actions', async () => {
  await openFile('Prose.md');
  const card = page.locator('.workspace-leaf.mod-active .task-card--layout-inline:visible').first();
  await expect(card).toBeVisible();
  await capture('inline');
  expect(await card.locator('.task-card__metadata').evaluate(element => element.parentElement?.classList.contains('task-card__main-row'))).toBe(true);
  expect(await card.locator('.task-card__main-row').evaluate(element => element.lastElementChild?.classList.contains('task-card__context-menu'))).toBe(true);
  await card.hover();
  await card.locator('.task-card__context-menu').click();
  await expect(page.locator('.menu')).toBeVisible();
});

test('task resize reports duration and Undo restores all properties and note body', async () => {
  await openFile('Calendar.base');
  await expect.poll(() => page.evaluate(async path => {
    const view = (window as any).polishLeaf.view.controller.view;
    await view.refetchEvents();
    return view.calendarItems.some((item: any) => item.data?.taskInfo?.path === path);
  }, taskPath)).toBe(true);
  const note = (content: string) => {
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(content)!;
    const properties = parse(match[1]);
    delete properties.dateModified;
    return { properties, body: match[2] };
  };
  const before = note(await page.evaluate(async path => {
    const app = (window as any).app;
    return app.vault.read(app.vault.getAbstractFileByPath(path));
  }, taskPath));
  await page.evaluate(async ({ path, today }) => {
    const view = (window as any).polishLeaf.view.controller.view;
    const item = view.calendarItems.find((item: any) => item.data?.taskInfo?.path === path);
    const parse = (value: string) => new Date(value.length === 10 ? `${value}T00:00` : value);
    const oldEvent = { id: item.id, title: item.title, start: parse(item.start), end: parse(item.end), allDay: false, extendedProps: item.data };
    await view.handleEventResize({ oldEvent, event: { ...oldEvent, start: new Date(`${today}T10:00`), end: new Date(`${today}T12:00`) }, isPointer: true, revert: () => { throw new Error('Resize reverted'); } });
  }, { path: taskPath, today });
  await capture('resize');
  await expect(page.locator('.tn-toast__message')).toContainText('Review the launch plan');
  await expect(page.locator('.tn-toast__message')).toContainText('Duration → 2 hr');
  await page.locator('.tn-toast__action').click();
  await expect.poll(async () => note(await page.evaluate(async path => {
    const app = (window as any).app;
    return app.vault.read(app.vault.getAbstractFileByPath(path));
  }, taskPath))).toEqual(before);
});
