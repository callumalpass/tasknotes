import { test, expect, type Page } from '@playwright/test';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport, openTaskNotesSettings, closeObsidianSettings, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
let page: Page;
const folder = `Interactions-${Date.now()}`;

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await setObsidianViewport(page, { width: 1180, height: 800 });
  const dismissStartupNotice = page.locator('.notice').getByText("Don't show again", { exact: true });
  if (await dismissStartupNotice.isVisible()) await dismissStartupNotice.click();
  await page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    (window as any).interactionSettings = structuredClone(plugin.settings);
    plugin.settings.customStatuses = plugin.settings.customStatuses.filter((status: any) => ['none', 'open', 'in-progress', 'done'].includes(status.value));
    plugin.settings.customPriorities = plugin.settings.customPriorities.filter((priority: any) => ['none', 'low', 'normal', 'high'].includes(priority.value));
    plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
    plugin.priorityManager.updatePriorities(plugin.settings.customPriorities);
    await app.vault.createFolder(folder);
    for (let index = 0; index < 260; index++) {
      await app.vault.create(`${folder}/Task ${String(index).padStart(3, '0')}.md`,
        `---\ntags: [task]\ntitle: Task ${String(index).padStart(3, '0')}\nstatus: open\npriority: ${index % 2 ? 'low' : 'high'}\ndue: 2027-02-${index % 2 ? '21' : '22'}\n---\n`);
    }
  }, folder);
});

test.afterAll(async () => {
  try {
    if (page && !page.isClosed()) await page.evaluate(async folder => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      plugin.settings = (window as any).interactionSettings;
      plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
      plugin.priorityManager.updatePriorities(plugin.settings.customPriorities);
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally { if (instance) await closeObsidian(instance); }
});

async function openView(type: string, name: string, enableSearch = true, groupProperty?: string, extraFilter?: string) {
  const content = stringify({ filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")', ...(extraFilter ? [extraFilter] : [])] },
    views: [{ type, name, order: ['status', 'priority', 'due'], sort: [{ property: 'file.name', direction: 'ASC' }], enableSearch,
      ...(type === 'tasknotesKanban' || groupProperty ? { groupBy: { property: groupProperty ?? 'status', direction: 'ASC' } } : {}) }] });
  await page.evaluate(async ({ path, content }) => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).openFile(await app.vault.create(path, content));
  }, { path: `${folder}/${name}.base`, content });
  const root = page.locator(`.workspace-leaf.mod-active .tn-${type}`);
  await expect(root.locator('.task-card').first()).toBeVisible();
  await root.focus();
  return root;
}

async function taskValues(property: string, archived = false) {
  return page.evaluate(async ({ folder, property, archived }) => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    return Promise.all([0, 1].map(async index => (await plugin.cacheManager.getTaskInfo(`${folder}/${archived ? 'Archive/' : ''}Task 00${index}.md`))?.[property]));
  }, { folder, property, archived });
}

test('scheduled date uses Shift+H in both task views without stealing list h', async () => {
  for (const type of ['tasknotesTaskList', 'tasknotesKanban']) {
    const root = await openView(type, `Scheduled key ${type}`);
    await page.keyboard.press('j');
    if (type === 'tasknotesTaskList') {
      await page.keyboard.press('h');
      await expect(page.locator('.tn-picker')).toHaveCount(0);
    }
    await page.keyboard.press('Shift+H');
    await expect(page.locator('.tn-picker')).toBeVisible();
    await expect(page.locator('.tn-picker__input')).toHaveAttribute('placeholder', 'Scheduled date');
    await page.keyboard.press('Escape');
    await root.focus();
    await page.keyboard.press('Control+k');
    await page.locator('.tn-picker__input').fill('Scheduled date');
    await expect(page.locator('[data-picker-id="picker-scheduled"] .tn-key')).toHaveText(['Shift', 'H']);
    await page.keyboard.press('Escape');
    await root.focus();
    await page.keyboard.press('?');
    const scheduled = page.locator('.tn-shortcut-row').filter({ hasText: 'Scheduled date' });
    await expect(scheduled.locator('.tn-key-hint')).toContainText('Shift');
    await page.keyboard.press('Escape');
  }
});

test('round one: shortcut help stays inside viewport and slash search retains focus', async () => {
  const root = await openView('tasknotesTaskList', 'Round one search', false);
  await page.keyboard.press('?');
  await expect(page.locator('.tn-shortcut-row .tn-key-hint').first()).toBeVisible();
  const bounds = await page.locator('.tn-popover').boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(792);
  await page.keyboard.press('Escape');
  await root.focus();
  await page.keyboard.press('/');
  const search = root.locator('.tn-search-box input');
  await expect(page.locator('.workspace-leaf.mod-active .bases-toolbar-search')).toBeHidden();
  await search.fill('zzzznonexistent');
  await expect(search).toBeFocused();
  await expect(root.locator('.task-card')).toHaveCount(0);
  await expect(search).toBeFocused();
  await search.fill('');
});

test('round one: current values, palette order, viewport bounds and theme parity', async () => {
  const root = await openView('tasknotesTaskList', 'Interaction review');
  await page.evaluate(() => (window as any).app.workspace.leftSplit.collapse());
  await page.keyboard.press('j');
  for (const width of [1180, 400]) {
    await setObsidianViewport(page, { width, height: 800 });
    for (const theme of ['theme-light', 'theme-dark']) {
      await page.evaluate(theme => {
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(theme);
      }, theme);
      for (const [key, surface] of [['s', 'status'], ['p', 'priority'], ['d', 'date'], ['Control+k', 'palette'], ['?', 'help']]) {
        await root.focus();
        await page.keyboard.press(key);
        const overlay = page.locator('.tn-popover');
        await expect(overlay).toBeVisible();
        await overlay.evaluate(async element => {
          await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished));
        });
        const bounds = await overlay.boundingBox();
        expect(bounds!.y).toBeGreaterThanOrEqual(8);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(792);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width - 8);
        if (['status', 'priority', 'date'].includes(surface)) {
          await expect(overlay.locator('.tn-picker__row.is-active.is-selected')).toHaveCount(1);
          await expect(overlay.locator('.tn-picker__row.is-active .tn-picker__check svg')).toHaveCount(1);
        }
        if (surface === 'palette') {
          await expect(overlay.locator('.tn-picker__row').first()).toHaveAttribute('data-picker-id', 'edit-task');
          await expect(overlay.locator('.tn-picker__row').nth(1)).toHaveAttribute('data-picker-id', 'open-task-file');
          await expect(overlay.locator('.tn-picker__row').nth(2)).toHaveAttribute('data-picker-id', 'picker-status');
        }
        await page.screenshot({ path: `/tmp/tasknotes-slice-a-r1/${surface}-${theme}-${width}.png`, clip: { x: 0, y: 0, width, height: 800 } });
        await page.keyboard.press('Escape');
      }
    }
  }
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await root.focus();
  await page.keyboard.press('s');
  await page.keyboard.press('Enter');
  await expect.poll(() => taskValues('status')).toEqual(['open', 'open']);
  await page.evaluate(() => document.body.classList.add('is-mobile'));
  await root.focus();
  await page.keyboard.press('p');
  await expect(page.locator('.tn-picker .tn-key-hint:visible')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.body.classList.remove('is-mobile'));
});

test('grouped triage keeps queue focus, highlights arrival and emits one Undo result', async () => {
  const root = await openView('tasknotesTaskList', 'Grouped movement', true, 'status', 'file.name.contains("Task 00")');
  await expect(root.locator('.task-card')).toHaveCount(10);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('j');
  const path = `${folder}/Task 000.md`;
  await page.keyboard.press('s');
  await page.locator('.tn-picker__row[data-picker-id="done"]').click();
  const destination = root.locator(`.task-card[data-task-path="${path}"]`);
  await expect(root.locator('.tn-task-focused')).toHaveAttribute('data-task-path', `${folder}/Task 001.md`);
  await expect(root.locator('.tn-task-focused')).toBeInViewport();
  await expect(destination).toHaveClass(/tn-task-arrived/);
  await expect.poll(() => destination.evaluate(element => element.isConnected && getComputedStyle(element).transitionDuration.split(',').every(value => value.trim() === '0s'))).toBe(true);
  await expect(page.locator('.tn-toast')).toHaveCount(1);
  await expect(page.locator('.tn-toast__message')).toHaveText('Status → Done');
  await expect(page.locator('.notice:visible')).toHaveCount(0);
  await page.locator('.tn-toast__action').click();
  await expect.poll(() => taskValues('status')).toEqual(['open', 'open']);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
});

test('round one: settings edits refresh glyphs in already-open views', async () => {
  const configs = await page.evaluate(() => {
    const settings = (window as any).app.plugins.plugins.tasknotes.settings;
    return { status: settings.customStatuses.find((item: any) => item.value === 'open'), priority: settings.customPriorities.find((item: any) => item.value === 'high') };
  });
  for (const type of ['tasknotesTaskList', 'tasknotesKanban']) {
    const root = await openView(type, `Settings ${type}`);
    const settings = await openTaskNotesSettings(page, 'Task properties');
    for (const [config, icon, placeholder] of [[configs.status, 'sun', 'check, circle, clock'], [configs.priority, 'moon', 'alert-circle']] as const) {
      const card = settings.locator(`.tasknotes-settings__card[data-card-id="${config.id}"]`);
      const input = card.getByPlaceholder(placeholder, { exact: true });
      if (!(await input.isVisible())) {
        const ancestors = card.locator('xpath=ancestor::*[contains(@class,"tasknotes-settings__card--collapsed")]');
        for (const ancestor of await ancestors.all()) await ancestor.locator(':scope > .tasknotes-settings__card-header').click();
        await card.locator(':scope > .tasknotes-settings__card-header').click();
      }
      await input.fill(icon);
      await input.dispatchEvent('change');
    }
    await closeObsidianSettings(page, settings);
    await expect(root.locator('.task-card').first().locator('.task-card__status-dot .lucide-sun')).toBeVisible();
    await expect(root.locator('.task-card').first().locator('.lucide-moon')).toBeVisible();
  }
});

test('round one: one search entry filters titles and property values', async () => {
  const root = await openView('tasknotesTaskList', 'Native search', false);
  await expect(root.locator('.tn-search-box')).toHaveCount(0);
  const native = page.locator('.workspace-leaf.mod-active .bases-toolbar-search');
  await native.getByText('Search', { exact: true }).click();
  const input = root.locator('.tn-search-box input');
  await expect(native).toBeHidden();
  await input.fill('002');
  await expect(root.locator('.task-card')).toHaveCount(1);
  await input.fill('high');
  await expect(root.locator('.task-card').first()).toBeVisible();
  await expect(root.locator('.task-card').first()).toHaveAttribute('data-task-path', `${folder}/Task 000.md`);
  await input.fill('zzzznonexistent');
  await expect(root.locator('.task-card')).toHaveCount(0);
  await input.fill('');
});

test('round one: unconfigured, unmatched and empty priority states remain distinct', async () => {
  const root = await openView('tasknotesTaskList', 'Priority states');
  const priorities = await page.evaluate(() => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    const previous = plugin.settings.customPriorities;
    plugin.settings.customPriorities = [];
    plugin.priorityManager.updatePriorities([]);
    return previous;
  });
  await page.keyboard.press('j');
  await page.keyboard.press('p');
  const picker = page.locator('.tn-picker');
  await expect(picker.locator('.is-selected.is-active')).toContainText('high');
  await expect(picker.getByRole('option', { name: 'high (not configured)', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(picker.locator('.tn-picker__empty')).toHaveText('No priorities configured');
  await picker.locator('input').fill('zzzznonexistent');
  await expect(picker.locator('.tn-picker__empty')).toHaveText('No matching priorities');
  await page.keyboard.press('Escape');
  await page.evaluate(async folder => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    await plugin.updateTaskProperty(await plugin.cacheManager.getTaskInfo(`${folder}/Task 000.md`), 'priority', undefined, { suppressNotice: true });
  }, folder);
  await root.focus();
  await page.keyboard.press('p');
  await expect(picker.locator('.tn-picker__empty')).toHaveText('No priorities configured');
  await page.keyboard.press('Escape');
  await page.evaluate(async ({ priorities, folder }) => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    plugin.settings.customPriorities = priorities;
    plugin.priorityManager.updatePriorities(priorities);
    await plugin.updateTaskProperty(await plugin.cacheManager.getTaskInfo(`${folder}/Task 000.md`), 'priority', 'high', { suppressNotice: true });
  }, { priorities, folder });
});

test('round one: create-modal pickers stay within a short narrow viewport', async () => {
  await setObsidianViewport(page, { width: 400, height: 500 });
  await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.openTaskCreationModal());
  const modal = page.locator('.modal.mod-tasknotes');
  await modal.locator('[data-type="status"]').click();
  const picker = page.locator('.tn-picker');
  const bounds = await picker.boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(8);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(492);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(392);
  await page.keyboard.press('Escape');
  await expect(modal).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await setObsidianViewport(page, { width: 1180, height: 800 });
});

for (const type of ['tasknotesTaskList', 'tasknotesKanban']) {
  test(`${type}: real keys, batch dates and undo, picker typing and palette`, async () => {
    const root = await openView(type, type);
    await page.keyboard.press('j');
    await expect(root.locator('.tn-task-focused')).toHaveAttribute('data-task-path', `${folder}/Task 000.md`);
    await page.keyboard.press('Shift+J');
    await expect(root.locator('.task-card--selected')).toHaveCount(2);
    await page.keyboard.press('Shift+K');
    await expect(root.locator('.task-card--selected')).toHaveCount(1);
    await page.keyboard.press('Shift+J');
    await expect(root.locator('.task-card--selected')).toHaveCount(2);
    const before = await taskValues('due');
    await page.keyboard.press('d');
    const picker = page.locator('.tn-picker');
    await expect(picker).toBeVisible();
    await picker.locator('input').fill('2027-05-17');
    await page.keyboard.press('Enter');
    await expect.poll(() => taskValues('due')).toEqual(['2027-05-17', '2027-05-17']);
    await page.locator('.tn-toast__action').click();
    await expect.poll(() => taskValues('due')).toEqual(before);
    const priorities = await taskValues('priority');
    await root.focus();
    await page.keyboard.press('p');
    await page.locator('.tn-picker__row[data-picker-id="low"]').click();
    await expect.poll(() => taskValues('priority')).toEqual(['low', 'low']);
    await page.locator('.tn-toast__action').click();
    await expect.poll(() => taskValues('priority')).toEqual(priorities);
    await root.focus();
    await page.keyboard.press('s');
    await page.locator('.tn-picker__row[data-picker-id="in-progress"]').click();
    await expect.poll(() => taskValues('status')).toEqual(['in-progress', 'in-progress']);
    await page.locator('.tn-toast__action').click();
    await expect.poll(() => taskValues('status')).toEqual(['open', 'open']);
    await page.evaluate(async ({ folder, move }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      plugin.settings.moveArchivedTasks = move;
      plugin.settings.archiveFolder = `${folder}/Archive`;
      if (!app.vault.getAbstractFileByPath(`${folder}/Archive`)) await app.vault.createFolder(`${folder}/Archive`);
    }, { folder, move: type === 'tasknotesTaskList' });
    await root.focus();
    await page.keyboard.press('Control+k');
    await page.locator('.task-action-palette-modal input').fill('Archive');
    await page.keyboard.press('Enter');
    await expect.poll(() => taskValues('archived', type === 'tasknotesTaskList')).toEqual([true, true]);
    await page.locator('.tn-toast__action').click();
    await expect.poll(() => taskValues('archived')).toEqual([false, false]);
    await page.evaluate(() => { (window as any).app.plugins.plugins.tasknotes.settings.moveArchivedTasks = false; });
    await root.focus();
    await page.keyboard.press('Escape');
    await expect(root.locator('.task-card--selected')).toHaveCount(0);
    const first = root.locator(`.task-card[data-task-path="${folder}/Task 000.md"]`).first();
    await first.locator('.task-card__priority-dot').click();
    await expect(picker).toBeVisible();
    await page.keyboard.press('Escape');
    await first.locator('.task-card__status-dot').click();
    await expect(picker).toBeHidden();
    await expect.poll(() => taskValues('status')).toEqual(['in-progress', 'open']);
    await page.locator('.tn-toast__action').click();
    await expect.poll(() => taskValues('status')).toEqual(['open', 'open']);
    await root.focus();
    await page.keyboard.press('s');
    await expect(picker).toBeVisible();
    await picker.locator('input').fill('jkespt');
    await expect(picker.locator('input')).toHaveValue('jkespt');
    await expect(root.locator('.task-card--selected')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await root.focus();
    await page.keyboard.press('Control+k');
    await expect(page.locator('.task-action-palette-modal')).toBeVisible();
    await expect(page.locator('.task-action-palette-modal .tn-key-hint').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await root.focus();
    await page.keyboard.press('?');
    await expect(page.locator('.tn-shortcut-row')).toHaveCount(type === 'tasknotesKanban' ? 16 : 15);
    await expect(page.locator('.tn-shortcut-row').filter({ hasText: 'Scheduled date' }).locator('.tn-key-hint')).toContainText('Shift');
    if (type === 'tasknotesKanban') await expect(page.locator('.tn-shortcut-row').filter({ hasText: 'Move between columns' })).toBeVisible();
    await page.keyboard.press('Escape');
  });
}

test('scheduled picker undo restores recurring history and refuses stale receipts', async () => {
  const path = `${folder}/AAA recurring.md`;
  await page.evaluate(async path => {
    const app = (window as any).app;
    await app.vault.create(path, '---\ntags: [task]\ntitle: Recurring undo\nstatus: open\nrecurrence: FREQ=DAILY\nscheduled: 2027-05-20T10:30\ncomplete_instances: [2027-05-21]\nskipped_instances: [2027-05-22]\n---\nKeep this body\n');
  }, path);
  const root = await openView('tasknotesTaskList', 'Recurring undo');
  const values = () => page.evaluate(async path => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    const task = await plugin.cacheManager.getTaskInfo(path);
    return { scheduled: task?.scheduled, complete: task?.complete_instances ?? [], skipped: task?.skipped_instances ?? [], original: task?.recurrence_original_date };
  }, path);
  const before = await values();
  await page.keyboard.press('j');
  await expect(root.locator('.tn-task-focused')).toHaveAttribute('data-task-path', path);
  await page.keyboard.press('Shift+H');
  await page.locator('.tn-picker input').fill('2027-05-18');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Reschedule and clear', exact: true }).click();
  await expect.poll(values).toMatchObject({ scheduled: '2027-05-18', complete: [], skipped: [] });
  await page.locator('.tn-toast__action').click();
  await expect.poll(values).toEqual(before);
  await root.focus();
  await page.keyboard.press('p');
  await page.locator('.tn-picker__row[data-picker-id="high"]').click();
  await page.evaluate(async path => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    await plugin.updateTaskProperty(await plugin.cacheManager.getTaskInfo(path), 'priority', 'low');
  }, path);
  await page.locator('.tn-toast__action').click();
  await expect.poll(() => page.evaluate(async path => (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(path).then((task: any) => task.priority), path)).toBe('low');
  const occurrencePath = `${folder}/AAA occurrence.md`;
  await page.evaluate(async ({ path, occurrencePath }) => {
    const app = (window as any).app;
    await app.vault.create(occurrencePath, `---\ntags: [task]\ntitle: Occurrence undo\nstatus: open\nscheduled: 2027-05-20T10:30\nrecurrence_parent: "[[${path.replace(/\.md$/, '')}]]"\noccurrence_date: 2027-05-20\n---\n`);
  }, { path, occurrencePath });
  const occurrenceView = await openView('tasknotesTaskList', 'Occurrence undo');
  await page.keyboard.press('j');
  await expect(occurrenceView.locator('.tn-task-focused')).toHaveAttribute('data-task-path', occurrencePath);
  const parentBefore = await values();
  await page.keyboard.press('s');
  await page.locator('.tn-picker__row[data-picker-id="done"]').click();
  await expect.poll(() => page.evaluate(async path => (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(path).then((task: any) => task.status), occurrencePath)).toBe('done');
  await page.locator('.tn-toast__action').click();
  await expect.poll(values).toEqual(parentBefore);
  await expect.poll(() => page.evaluate(async path => (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(path).then((task: any) => ({ status: task.status, completedDate: task.completedDate })), occurrencePath)).toEqual({ status: 'open', completedDate: undefined });
  await page.evaluate(async path => { const app = (window as any).app; await app.vault.delete(app.vault.getAbstractFileByPath(path)); }, occurrencePath);
  await page.evaluate(async path => { const app = (window as any).app; await app.vault.delete(app.vault.getAbstractFileByPath(path)); }, path);
});

test('virtual list focus survives scrolling, eight custom statuses and empty priorities', async () => {
  await page.evaluate(() => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    plugin.settings.customStatuses = Array.from({ length: 8 }, (_, order) => ({ id: `custom-${order}`,
      value: order === 0 ? 'open' : `custom-${order}`, label: `Custom workflow status ${order} with a very long name`,
      icon: order % 2 ? 'moon' : 'sun', color: 'var(--text-accent)', order, isCompleted: order === 7, excludeFromCycle: false }));
    plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
    plugin.settings.customPriorities = [];
    plugin.priorityManager.updatePriorities([]);
  });
  for (const type of ['tasknotesTaskList', 'tasknotesKanban']) {
  const root = await openView(type, `unusual-${type}`);
  for (let index = 0; index < 80; index++) await page.keyboard.press('j');
  await expect(root.locator('.tn-task-focused')).toHaveAttribute('data-task-path', `${folder}/Task 079.md`);
  await expect(root.locator('.tn-task-focused')).toBeInViewport();
  for (const theme of ['theme-light', 'theme-dark']) {
    await page.evaluate(theme => { document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(theme); }, theme);
    await root.focus();
    await page.keyboard.press('s');
    await expect(page.locator('.tn-picker__row')).toHaveCount(8);
    await expect(page.locator('.tn-picker__leading svg')).toHaveCount(8);
    await page.locator('.tn-picker').evaluate(async element => {
      await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished));
    });
    await page.screenshot({ path: `test-results/interaction-${type}-${theme}.png` });
    await page.keyboard.press('Escape');
  }
  await root.focus();
  await page.keyboard.press('p');
  await expect(page.locator('.tn-picker__row')).toHaveCount(2);
  await page.keyboard.press('Escape');
  }
});
