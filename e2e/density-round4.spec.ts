import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, closeObsidianSettings, setObsidianViewport, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
let page: Page;
let settings: any;
const folder = `DensityR4-${Date.now()}`;
const title = 'Review the supplier onboarding plan';
const path = `${folder}/Task.md`;

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await page.evaluate(async ({ folder, path, title }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    (window as any).densitySettings = JSON.parse(JSON.stringify(plugin.settings));
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    await app.vault.createFolder(folder);
    await app.vault.create(path, `---\ntitle: ${title}\ntags: [task]\nstatus: ${plugin.settings.defaultTaskStatus}\n---\n`);
    await app.vault.create(`${folder}/Prose.md`, `Before [[${folder}/Task|supplier plan]] and after.\n\nBefore **[[${folder}/Task|emphasised plan]]** and after.\n\n[[${folder}/Task]]\n`);
    await app.vault.create(`${folder}/List.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\nviews:\n  - type: tasknotesTaskList\n    name: List\n    order: [status, priority, scheduled, due]\n`);
    await app.vault.create(`${folder}/Empty.base`, `filters:\n  and:\n    - file.inFolder("${folder}/missing")\nviews:\n  - type: tasknotesTaskList\n    name: Empty\n`);
    (window as any).densityLeaf = app.workspace.getLeaf(true);
  }, { folder, path, title });
  settings = await page.evaluate(() => (window as any).densitySettings);
  await expect.poll(() => page.evaluate(async path => Boolean(await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(path)), path)).toBe(true);
});

test.beforeEach(async () => {
  await expect(page.locator('.modal-container')).toHaveCount(0);
});
test.afterEach(async () => {
  for (const candidate of page.context().pages()) {
    if (await candidate.locator('.vertical-tab-content').first().isVisible()) {
      await closeObsidianSettings(page, candidate);
    }
  }
  while (await page.locator('.modal-container').count()) {
    const modal = page.locator('.modal-container').last();
    const previousCount = await page.locator('.modal-container').count();
    const cancel = modal.getByRole('button', { name: 'Cancel', exact: true });
    if (await cancel.isVisible()) await cancel.click();
    else {
      await modal.locator('.modal').evaluate(element => {
        (element as HTMLElement).tabIndex = -1;
        (element as HTMLElement).focus();
      });
      await page.keyboard.press('Escape');
    }
    const discard = page.getByRole('button', { name: 'Discard changes', exact: true });
    if (await discard.isVisible()) await discard.click();
    await expect(page.locator('.modal-container')).toHaveCount(previousCount - 1);
  }
  await page.keyboard.press('Escape');
});
test.afterAll(async () => {
  try {
    if (page) await page.evaluate(async ({ folder, settings }) => {
      const app = (window as any).app;
      Object.assign(app.plugins.plugins.tasknotes.settings, settings);
      app.plugins.plugins.tasknotes.statusManager.updateStatuses(settings.customStatuses);
      (window as any).densityLeaf?.detach();
      const directory = app.vault.getAbstractFileByPath(folder);
      if (directory) await app.vault.delete(directory, true);
    }, { folder, settings });
  } finally { if (instance) await closeObsidian(instance); }
});

async function open(name: string) {
  await page.evaluate(async ({ folder, name }) => {
    const app = (window as any).app;
    await (window as any).densityLeaf.openFile(app.vault.getAbstractFileByPath(`${folder}/${name}`), { state: { mode: 'preview' } });
    app.workspace.setActiveLeaf((window as any).densityLeaf, { focus: true });
  }, { folder, name });
}

async function addDates() {
  await page.evaluate(async path => {
    const app = (window as any).app;
    await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(path), (frontmatter: any) => {
      frontmatter.due = '2099-01-01';
      frontmatter.scheduled = '2099-01-01T10:00';
    });
  }, path);
  await expect.poll(() => page.evaluate(async path => (await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(path))?.due, path)).toBe('2099-01-01');
}

async function capture(name: string) {
  await page.locator('.notice-container .notice').evaluateAll(elements => elements.forEach(element => element.remove()));
  await page.screenshot({ path: `test-results/density-r4/${name}.png`, clip: { x: 0, y: 0, ...page.viewportSize()! } });
}

test('unset dates open at the top without losing the Clear selection', async () => {
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await open('List.base');
  const card = page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${path}"]`);
  await expect(card).toBeVisible();
  await card.locator('.task-card__status-dot').focus();
  await page.keyboard.press('d');
  const list = page.locator('.tn-picker__list');
  await expect(list).toBeVisible();
  await capture('date-picker');
  expect(await list.evaluate(element => element.scrollTop)).toBe(0);
  await expect(list.locator('[data-picker-id="clear"]')).toHaveAttribute('aria-selected', 'true');
});

for (const theme of ['light', 'dark']) test(`${theme}: mobile rows keep status beside titles in two rows`, async () => {
  await addDates();
  await setObsidianViewport(page, { width: 430, height: 800 });
  await page.evaluate(theme => {
    document.body.classList.add('is-mobile');
    document.body.classList.toggle('theme-dark', theme === 'dark');
    document.body.classList.toggle('theme-light', theme === 'light');
  }, theme);
  await open('List.base');
  const card = page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${path}"]`);
  await expect(card).toBeVisible();
  const status = await card.locator('.task-card__status-dot').boundingBox();
  const titleBox = await card.locator('.task-card__title-text').boundingBox();
  expect(Math.abs(status!.y - titleBox!.y)).toBeLessThan(20);
  expect((await card.boundingBox())!.height).toBeLessThan(110);
  await expect(card.locator('.task-card__metadata-date--due')).toBeVisible();
  await expect(card.locator('.task-card__metadata-date--scheduled')).toBeVisible();
  const toolbar = page.locator('.workspace-leaf.mod-active .bases-toolbar');
  const newButton = toolbar.locator('.tn-bases-new-task-btn');
  const toolbarBox = await toolbar.boundingBox();
  const newBox = await newButton.boundingBox();
  expect(newBox!.x + newBox!.width).toBeLessThanOrEqual(toolbarBox!.x + toolbarBox!.width + 1);
  expect(newBox!.y).toBeLessThan(toolbarBox!.y + 10);
  await capture(`${theme}-mobile-list`);
});

test('sentence references remain inline while standalone references keep metadata', async () => {
  await addDates();
  await setObsidianViewport(page, { width: 430, height: 800 });
  await page.evaluate(() => document.body.classList.add('is-mobile'));
  await open('Prose.md');
  const sentence = page.locator('.workspace-leaf.mod-active .tasknotes-inline-widget--sentence:visible').first();
  await expect(page.locator('.workspace-leaf.mod-active .tasknotes-inline-widget--sentence:visible')).toHaveCount(2);
  await expect(sentence).toBeVisible();
  expect((await sentence.locator('.task-card').boundingBox())!.width).toBeLessThan(300);
  const standalone = page.locator('.workspace-leaf.mod-active .tasknotes-inline-widget:not(.tasknotes-inline-widget--sentence):visible').first();
  await expect(standalone.locator('.task-card__metadata')).toBeVisible();
  await expect(sentence.locator('.task-card__context-menu')).toBeVisible();
  await capture('mobile-inline');
});

test('phone shortcut help displays actual keys', async () => {
  await setObsidianViewport(page, { width: 430, height: 800 });
  await page.evaluate(() => document.body.classList.add('is-mobile'));
  await open('List.base');
  await page.locator('.workspace-leaf.mod-active .tn-shortcut-help').click();
  const rows = page.locator('.tn-shortcut-row');
  await expect(rows.first().locator('kbd').first()).toBeVisible();
  expect(await rows.evaluateAll(elements => elements.every(element => !!element.querySelector('kbd')?.textContent))).toBe(true);
  await capture('mobile-shortcuts');
});

test('unknown statuses offer settings and empty search removes the selection hint', async () => {
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await page.evaluate(async path => {
    document.body.classList.remove('is-mobile');
    const app = (window as any).app;
    await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(path), (frontmatter: any) => {
      frontmatter.status = 'unknown-custom-value';
    });
  }, path);
  await expect.poll(() => page.evaluate(async path => (await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(path))?.status, path)).toBe('unknown-custom-value');
  await page.evaluate(async path => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    const task = await plugin.cacheManager.getTaskInfo(path);
    await plugin.openTaskEditModal(task);
  }, path);
  await page.locator('.modal.mod-tasknotes [data-type="status"]').click();
  const settings = page.locator('.tn-picker__row').filter({ hasText: 'Task settings' });
  await expect(settings).toBeVisible();
  await page.locator('.tn-picker__input').fill('no-matching-option-for-this-query');
  await expect(page.locator('.tn-picker__select-hint')).toBeHidden();
  await page.locator('.tn-picker__input').fill('');
  await settings.click();
  await expect.poll(() => page.evaluate(() => (window as any).app.setting.activeTab?.id)).toBe('tasknotes');
  await capture('settings-recovery');
});

test('precise time input uses the shared boundary and focus treatment', async () => {
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await page.evaluate(() => document.body.classList.remove('is-mobile'));
  await open('List.base');
  const card = page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${path}"]`);
  await card.locator('.task-card__status-dot').focus();
  await page.keyboard.press('d');
  await page.locator('.tn-picker__row').filter({ hasText: 'Pick date & time' }).click();
  const input = page.locator('.date-time-picker-modal__time-input');
  await expect(input).toBeVisible();
  await input.focus();
  expect(await input.evaluate(element => {
    const style = getComputedStyle(element);
    return { border: style.borderTopWidth, shadow: style.boxShadow, outline: style.outlineWidth };
  })).toEqual({ border: '1px', shadow: 'none', outline: '2px' });
  await capture('precise-time-focus');
});

test('empty views offer the native filter controls', async () => {
  await open('Empty.base');
  const empty = page.locator('.workspace-leaf.mod-active .tn-empty');
  await expect(empty).toContainText('No tasks match this view. Review its filters.');
  await expect(empty.getByRole('button', { name: 'Filters', exact: true })).toBeVisible();
  await empty.getByRole('button', { name: 'Filters', exact: true }).click();
  await capture('filter-recovery');
});

test('an empty task index offers creation rather than filter recovery', async () => {
  await page.evaluate(() => {
    const cache = (window as any).app.plugins.plugins.tasknotes.cacheManager;
    (window as any).densityOriginalTaskPaths = cache.getAllTaskPaths;
    cache.getAllTaskPaths = () => new Set();
  });
  try {
    await open('List.base');
    await open('Empty.base');
    const empty = page.locator('.workspace-leaf.mod-active .tn-empty');
    await expect(empty).toContainText('No tasks yet.');
    await expect(empty.getByRole('button', { name: 'Filters', exact: true })).toHaveCount(0);
    await empty.getByRole('button', { name: 'New', exact: true }).click();
    await expect(page.locator('.modal.mod-tasknotes')).toBeVisible();
  } finally {
    await page.evaluate(() => {
      (window as any).app.plugins.plugins.tasknotes.cacheManager.getAllTaskPaths = (window as any).densityOriginalTaskPaths;
    });
  }
});

test('overview groups are balanced and phone periods remain adjacent', async () => {
  await page.evaluate(async () => (window as any).densityLeaf.setViewState({ type: 'tasknotes-stats-view', active: true }));
  for (const width of [1180, 430]) {
    await setObsidianViewport(page, { width, height: 800 });
    await page.evaluate(width => document.body.classList.toggle('is-mobile', width === 430), width);
    const grid = page.locator('.workspace-leaf.mod-active .stats-view__overview-grid');
    await expect(grid).toBeVisible();
    const columns = await grid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(width === 430 ? 2 : 4);
    const first = await grid.locator(':scope > div').first().boundingBox();
    expect(first!.width).toBeGreaterThan((await grid.boundingBox())!.width * .9);
    const periods = page.locator('.workspace-leaf.mod-active .tn-report-horizons > div');
    const boxes = await periods.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top));
    expect(Math.max(...boxes) - Math.min(...boxes)).toBeLessThan(2);
    await capture(`statistics-${width}`);
  }
});

test('empty details use one column without hiding the editor', async () => {
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await page.evaluate(() => {
    document.body.classList.remove('is-mobile');
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    plugin.settings.enableModalSplitLayout = true;
    plugin.openTaskCreationModal();
  });
  const modal = page.locator('.modal.mod-tasknotes');
  await modal.locator('.tn-task-modal__details-toggle').click();
  const wrapper = modal.locator('.modal-split-content');
  await expect(wrapper).toHaveClass(/modal-split-content--details-empty/);
  const editor = modal.locator('.tn-task-modal__markdown-editor--details');
  await expect(editor).toBeVisible();
  const left = await modal.locator('.modal-split-left').boundingBox();
  const right = await modal.locator('.modal-split-right').boundingBox();
  expect(right!.width).toBeGreaterThan(left!.width * .9);
  await capture('empty-details');
  await editor.locator('.cm-content').fill('Details that deserve their own pane');
  await expect(wrapper).toHaveClass(/modal-split-content--details-empty/);
  await modal.locator('.title-input').first().focus();
  await expect(wrapper).not.toHaveClass(/modal-split-content--details-empty/);
  await capture('populated-details');
});

test('long custom labels wrap with padding and board titles remain readable', async () => {
  const label = 'Awaiting detailed accessibility and stakeholder review before the next scheduled delivery window';
  const longTitle = 'Review the supplier onboarding plan including every outstanding accessibility, compliance, delivery and stakeholder acceptance requirement';
  await setObsidianViewport(page, { width: 430, height: 800 });
  await page.evaluate(async ({ folder, path, label, longTitle }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    document.body.classList.add('is-mobile');
    plugin.settings.customStatuses = [...plugin.settings.customStatuses, {
      id: 'density-long', value: 'density-long', label, color: 'var(--color-blue)',
      isCompleted: false, order: 999,
    }];
    plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
    await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(path), (frontmatter: any) => {
      frontmatter.status = 'density-long';
      frontmatter.title = longTitle;
    });
    await app.vault.create(`${folder}/Board.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\nviews:\n  - type: tasknotesKanban\n    name: Board\n    groupBy:\n      property: status\n      direction: ASC\n`);
  }, { folder, path, label, longTitle });
  await expect.poll(() => page.evaluate(async path => (await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(path))?.status, path)).toBe('density-long');
  await open('List.base');
  const card = page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${path}"]`);
  await card.locator('.task-card__status-dot').focus();
  await page.keyboard.press('s');
  const option = page.locator('.tn-picker__row').filter({ hasText: label });
  await expect(option).toBeVisible();
  expect(await option.evaluate(element => parseFloat(getComputedStyle(element).paddingTop))).toBeGreaterThanOrEqual(8);
  await capture('wrapped-status-picker');
  await page.keyboard.press('Escape');
  await open('Board.base');
  const column = page.locator('.workspace-leaf.mod-active .kanban-view__column[data-group="density-long"]');
  await expect(column).toBeVisible();
  const heading = column.locator('.kanban-view__column-title');
  await expect(heading).toHaveAttribute('title', label);
  expect(await heading.evaluate(element => getComputedStyle(element).webkitLineClamp)).toBe('2');
  const boardTitle = column.locator('.task-card__title-text');
  await expect(boardTitle).toHaveText(longTitle);
  expect(await boardTitle.evaluate(element => ({ clamp: getComputedStyle(element).webkitLineClamp, clipped: element.scrollHeight > element.clientHeight }))).toEqual({ clamp: 'none', clipped: false });
  await column.locator('.kanban-view__column-header').hover();
  await expect(column.locator('.kanban-view__column-count')).toBeVisible();
  await capture('mobile-long-board');
});
