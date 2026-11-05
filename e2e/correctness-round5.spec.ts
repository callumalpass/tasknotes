import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, closeObsidianSettings, setObsidianViewport, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
let page: Page;
const folder = `CorrectnessR5-${Date.now()}`;
const taskPath = `${folder}/Task-0.md`;
const longStatus = 'Awaiting external approval from the operations and accessibility review team';

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await page.evaluate(async ({ folder, taskPath, longStatus }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    (window as any).correctnessSettings = JSON.parse(JSON.stringify(plugin.settings));
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    plugin.settings.customStatuses = Array.from({ length: 8 }, (_, index) => ({ id: `custom-${index}`, value: index === 7 ? longStatus : `stage-${index}`, label: index === 7 ? longStatus : `Stage ${index}`, color: '#4385be', isCompleted: false }));
    plugin.settings.customPriorities = [{ id: 'legacy', value: 'legacy-high', label: 'Legacy high', color: '#4385be', weight: 3 }];
    plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
    plugin.priorityManager.updatePriorities(plugin.settings.customPriorities);
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    await app.vault.createFolder(folder);
    const today = (window as any).moment().format('YYYY-MM-DD');
    await app.vault.create(taskPath, `---\ntitle: Review the supplier onboarding plan\ntags: [task, operations, accessibility]\nstatus: stage-0\npriority: legacy-high\nscheduled: ${today}T10:00\ndue: ${today}T14:00\n---\n`);
    await app.vault.create(`${folder}/List.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\nviews:\n  - type: tasknotesTaskList\n    name: List\n    order: [status, priority, scheduled, due, tags]\n`);
    await app.workspace.getLeaf(true).openFile(app.vault.getAbstractFileByPath(`${folder}/List.base`));
  }, { folder, taskPath, longStatus });
  await expect(page.locator(`.task-card[data-task-path="${taskPath}"]`)).toBeVisible();
  await page.evaluate(() => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    plugin.settings.customPriorities = [];
    plugin.priorityManager.updatePriorities([]);
  });
});

test.afterAll(async () => {
  try {
    if (page) await page.evaluate(async folder => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      Object.assign(plugin.settings, (window as any).correctnessSettings);
      plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
      plugin.priorityManager.updatePriorities(plugin.settings.customPriorities);
      await plugin.saveSettings();
      for (const leaf of app.workspace.getLeavesOfType('bases')) if (leaf.view.file?.path.startsWith(folder)) leaf.detach();
      const directory = app.vault.getAbstractFileByPath(folder);
      if (directory) await app.vault.delete(directory, true);
    }, folder);
  } finally { if (instance) await closeObsidian(instance); }
});

test.afterEach(async () => {
  for (const candidate of page.context().pages()) {
    if (await candidate.locator('.vertical-tab-content').first().isVisible().catch(() => false)) await closeObsidianSettings(page, candidate);
  }
  for (let index = 0; index < 3; index++) await page.keyboard.press('Escape');
});

async function recoverySettings() {
  let target: Page | undefined;
  await expect.poll(async () => {
    for (const candidate of page.context().pages()) {
      if (await candidate.locator('.tasknotes-settings').isVisible().catch(() => false)) { target = candidate; return true; }
    }
    return false;
  }).toBe(true);
  await target!.bringToFront();
  return target!;
}

test('configured status edits preserve unrelated unknown priorities', async () => {
  const card = page.locator(`.task-card[data-task-path="${taskPath}"]`);
  await card.locator('.task-card__status-dot').press('s');
  await page.getByRole('option', { name: longStatus, exact: true }).click();
  await expect.poll(() => page.evaluate(async taskPath => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    const task = await plugin.cacheManager.getTaskInfo(taskPath);
    return { status: task?.status, priority: task?.priority };
  }, taskPath)).toEqual({ status: longStatus, priority: 'legacy-high' });
  await page.screenshot({ path: '/tmp/slice-r-status.png' });
});

test('failed property changes identify the task and explain recovery', async () => {
  await page.evaluate(() => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    (window as any).correctnessUpdateProperty = plugin.updateTaskProperty;
    plugin.updateTaskProperty = async () => { throw new Error('Note is read-only'); };
  });
  try {
    await page.locator(`.task-card[data-task-path="${taskPath}"] .task-card__status-dot`).press('s');
    await page.getByRole('option', { name: 'Stage 0', exact: true }).click();
    const toast = page.locator('.tn-toast').last();
    await expect(toast).toContainText('Check that the notes are writable, then try again.');
    await expect(toast).toContainText('Status');
    await expect(toast).toContainText('Review the supplier onboarding plan');
    await expect.poll(() => page.evaluate(async taskPath => (await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(taskPath))?.priority, taskPath)).toBe('legacy-high');
  } finally {
    await page.evaluate(() => { (window as any).app.plugins.plugins.tasknotes.updateTaskProperty = (window as any).correctnessUpdateProperty; });
  }
});

test('mobile time values never clip or paint over another date', async () => {
  await page.evaluate(() => document.body.classList.add('is-mobile'));
  const dates = page.locator(`.task-card[data-task-path="${taskPath}"] .task-card__metadata-date`);
  await expect(dates).toHaveCount(2);
  for (const width of [400, 430]) {
    await setObsidianViewport(page, { width, height: 800 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => {
        const app = (window as any).app;
        app.changeTheme(theme === 'dark' ? 'obsidian' : 'moonstone');
        app.updateTheme();
      }, theme);
      await expect(page.locator('body')).toHaveClass(new RegExp(`theme-${theme}`));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.locator('.notice-container .notice').evaluateAll(elements => elements.forEach(element => element.remove()));
      await page.screenshot({ path: `/tmp/slice-r-mobile-dates-${width}-${theme}.png` });
      const visibleDates = page.locator(`.task-card[data-task-path="${taskPath}"] .task-card__metadata-date:visible`);
      const bounds = await visibleDates.evaluateAll(elements => elements.map(element => {
        const text = element as HTMLElement;
        const rect = element.getBoundingClientRect();
        return { width: text.clientWidth, content: text.scrollWidth, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      }));
      for (const date of bounds) expect(date.content).toBeLessThanOrEqual(date.width + 1);
      if (bounds.length === 2) expect(bounds[0].right <= bounds[1].left || bounds[0].bottom <= bounds[1].top || bounds[1].bottom <= bounds[0].top).toBe(true);
      await expect(page.locator(`.task-card[data-task-path="${taskPath}"] .task-card__metadata-date--due`)).toBeInViewport();
      if (width === 430) for (const date of await dates.all()) await expect(date).toBeInViewport();
    }
  }
});

test('unknown priority recovery expands and focuses its settings section', async () => {
  await page.locator(`.task-card[data-task-path="${taskPath}"] .task-card__priority-dot`).click();
  await page.getByRole('option', { name: 'Task settings', exact: true }).click();
  const settingsPage = await recoverySettings();
  const section = settingsPage.locator('[data-card-id="property-priority"]');
  await expect(section).toBeVisible();
  await expect.poll(() => section.evaluate(element => element.getBoundingClientRect().top < innerHeight / 2)).toBe(true);
  await expect(section.locator('input').first()).toBeInViewport();
  await expect(section).not.toHaveClass(/--collapsed/);
  await expect.poll(() => section.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await settingsPage.screenshot({ path: '/tmp/slice-r-priority-recovery.png' });
});

test('mini calendar resolves task titles before filenames', async () => {
  await page.evaluate(async folder => {
    const app = (window as any).app;
    const today = (window as any).moment().format('YYYY-MM-DD');
    await app.vault.create(`${folder}/General note.md`, `---\ntitle: This is not a task title\nscheduled: ${today}\n---\n`);
    await app.vault.create(`${folder}/Mini.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\nviews:\n  - type: tasknotesMiniCalendar\n    name: Mini\n    dateProperty: note.scheduled\n`);
    await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(`${folder}/Mini.base`));
  }, folder);
  await page.locator('.mini-calendar-view__day[aria-current="date"]').click();
  await expect(page.locator('.suggestion-item').filter({ hasText: 'Review the supplier onboarding plan' })).toBeVisible();
  await expect(page.locator('.suggestion-item').filter({ hasText: 'General note' })).toBeVisible();
  await expect(page.locator('.suggestion-item').filter({ hasText: 'This is not a task title' })).toHaveCount(0);
  await page.keyboard.press('Escape');
});

for (const property of ['status', 'priority']) test(`unknown board ${property} keeps its identity and links to its settings`, async () => {
  await page.evaluate(async ({ folder, taskPath, property }) => {
    const app = (window as any).app;
    await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(taskPath), (frontmatter: any) => { frontmatter[property] = 'legacy-review'; });
    await app.vault.create(`${folder}/Board-${property}.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\nviews:\n  - type: tasknotesKanban\n    name: Board\n    groupBy:\n      property: ${property}\n      direction: ASC\n`);
    await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(`${folder}/Board-${property}.base`));
  }, { folder, taskPath, property });
  const column = page.locator('.kanban-view__column[data-group="legacy-review"]');
  await expect(column.locator('.kanban-view__column-title')).toHaveText('legacy-review');
  await column.getByRole('button', { name: 'Task settings', exact: true }).click();
  const settingsPage = await recoverySettings();
  const section = settingsPage.locator(`[data-card-id="property-${property}"]`);
  await expect(section).toBeVisible();
  await expect.poll(() => section.evaluate(element => element.getBoundingClientRect().top < innerHeight / 2)).toBe(true);
  await expect(section.locator('input').first()).toBeInViewport();
  await expect(section).not.toHaveClass(/--collapsed/);
  await expect.poll(() => section.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await settingsPage.screenshot({ path: `/tmp/slice-r-board-${property}-recovery.png` });
});

test('collision drilldown contains only that group and first entry reveals today', async () => {
  await setObsidianViewport(page, { width: 400, height: 800 });
  await page.evaluate(() => document.body.classList.add('is-mobile'));
  await page.evaluate(async folder => {
    const app = (window as any).app;
    const today = (window as any).moment().format('YYYY-MM-DD');
    for (let index = 0; index < 8; index++) await app.vault.create(`${folder}/Appointment-${index}.md`, `---\ntitle: Collision appointment ${index + 1}\ntags: [task]\nstatus: stage-0\nscheduled: ${today}T11:00\ntimeEstimate: 60\n---\n`);
    await app.vault.create(`${folder}/Morning.md`, `---\ntitle: Unrelated morning appointment\ntags: [task]\nstatus: stage-0\nscheduled: ${today}T08:00\ntimeEstimate: 30\n---\n`);
    await app.vault.create(`${folder}/Calendar.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\nviews:\n  - type: tasknotesCalendar\n    name: Calendar\n    calendarView: timeGridWeek\n    showDue: true\n    showTimeblocks: false\n    showTimeEntries: false\n`);
    await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(`${folder}/Calendar.base`));
  }, folder);
  await expect(page.locator('.tnc-item').filter({ hasText: 'Collision appointment 1' }).first()).toBeVisible();
  await page.locator('.tnc-toolbar-view-select').selectOption('week');
  await expect(page.locator('.tnc-dh.is-today')).toBeInViewport();
  const stack = page.locator('.tnc-more--collision').filter({ hasText: '8' }).first();
  await expect(stack.locator('.tnc-collision-count')).toHaveText('8');
  await expect(stack).toHaveAttribute('aria-label', /^8 appointments,/);
  await expect(stack.locator('.tnc-collision-title')).not.toBeEmpty();
  await stack.click();
  await expect(page.locator('.tnc-popover .tnc-item')).toHaveCount(8);
  await expect(page.locator('.tnc-popover')).not.toContainText('Unrelated morning');
  await page.screenshot({ path: '/tmp/slice-r-collision.png' });
});
