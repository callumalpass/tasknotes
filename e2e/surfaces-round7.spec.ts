import { test, expect, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { launchObsidian, closeObsidian, setObsidianViewport, openTaskNotesSettings, closeObsidianSettings, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
let page: Page;
let originalSettings: any;
const folder = `SurfacesR7-${Date.now()}`;
const taskPath = `${folder}/Review.md`;
const phase = process.env.TASKNOTES_R7_PHASE ?? 'after';
const evidence = `/tmp/tasknotes-r7/o/${phase}`;

test.beforeAll(async () => {
  mkdirSync(evidence, { recursive: true });
  instance = await launchObsidian();
  page = instance.page;
  originalSettings = await page.evaluate(async ({ folder, taskPath }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const settings = JSON.parse(JSON.stringify(plugin.settings));
    plugin.settings.enableModalSplitLayout = false;
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    plugin.settings.customStatuses = Array.from({ length: 24 }, (_, index) => ({
      id: `surface-${index}`, value: `surface-${index}`,
      label: index === 1 ? 'Awaiting accessibility and localization review' : `Review stage ${index + 1}`,
      color: 'var(--color-blue)', icon: 'circle', isCompleted: index === 23, order: index,
    }));
    plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
    await app.vault.createFolder(folder);
    await app.vault.create(taskPath, '---\ntags: [task, design, accessibility]\ntitle: Review the launch plan with the team\nstatus: surface-1\npriority: normal\nscheduled: 2026-11-06T10:00\ndue: 2026-11-07\ncontexts: [work, review]\n---\nSupporting notes stay available while editing.\n');
    await app.vault.create(`${folder}/List.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\nviews:\n  - type: tasknotesTaskList\n    name: Review tasks\n    order: [status, priority, scheduled, due, tags]\n`);
    await app.vault.create(`${folder}/Prose.md`, `# Review notes\n\nDiscuss [[${folder}/Review]] with the team.\n\n[[${folder}/Review]]\n\nKeep supporting notes beside the task.\n`);
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    (window as any).surfacesR7Leaf = app.workspace.getLeaf(true);
    return settings;
  }, { folder, taskPath });
  await expect.poll(() => page.evaluate(async taskPath => !!await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(taskPath), taskPath)).toBe(true);
});

test.afterEach(async () => {
  for (let index = 0; index < 4; index++) await page.keyboard.press('Escape');
});

test.afterAll(async () => {
  try {
    if (page && !page.isClosed()) await page.evaluate(async ({ folder, originalSettings }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      Object.assign(plugin.settings, originalSettings);
      plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
      await plugin.saveSettings();
      (window as any).surfacesR7Leaf?.detach();
      const directory = app.vault.getAbstractFileByPath(folder);
      if (directory) await app.vault.delete(directory, true);
    }, { folder, originalSettings });
  } finally { if (instance) await closeObsidian(instance); }
});

async function appearance(target: Page, theme: string, width: number) {
  await setObsidianViewport(target, { width, height: 800 });
  await target.evaluate(({ theme, width }) => {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme}`);
    document.body.classList.toggle('is-mobile', width === 400);
    document.querySelectorAll('.notice').forEach(element => element.remove());
    document.querySelector('.tn-toast')?.dispatchEvent(new Event('tn-dismiss'));
  }, { theme, width });
}

async function capture(target: Page, name: string) {
  await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await target.screenshot({ path: `${evidence}/${name}.png`, clip: { x: 0, y: 0, ...target.viewportSize()! } });
}

async function states(target: Page, control: Locator, name: string) {
  await control.scrollIntoViewIfNeeded();
  await target.mouse.move(1, 1);
  if (await control.evaluate(element => element.matches(':disabled, [aria-disabled="true"]'))) {
    await capture(target, `${name}-disabled`);
    return;
  }
  await capture(target, `${name}-rest`);
  const before = await control.boundingBox();
  await control.hover();
  await capture(target, `${name}-hover`);
  expect(await control.boundingBox()).toEqual(before);
  await target.mouse.down();
  await capture(target, `${name}-pressed`);
  await target.mouse.move(1, 1);
  await target.mouse.up();
  await target.keyboard.press('Tab');
  await control.focus();
  if (phase !== 'before') await expect(control).toBeFocused();
  else if (!await control.evaluate(element => element === element.ownerDocument.activeElement)) {
    await capture(target, `${name}-focus-unavailable`);
    return;
  }
  await capture(target, `${name}-focus`);
}

async function openTask() {
  await page.evaluate(async taskPath => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    plugin.openTaskEditModal(await plugin.cacheManager.getTaskInfo(taskPath));
  }, taskPath);
  return page.locator('.modal.mod-tasknotes');
}

async function tap(target: Page, control: Locator) {
  const bounds = await control.boundingBox();
  const session = await target.context().newCDPSession(target);
  try {
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds!.x + bounds!.width / 2, y: bounds!.y + bounds!.height / 2 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await session.detach();
  }
}

for (const theme of ['light', 'dark']) for (const width of [1180, 400]) {
  const variant = `${theme}-${width}`;
  test(`${variant}: composer, picker, precise input and reminder states`, async () => {
    test.setTimeout(120000);
    await appearance(page, theme, width);
    const modal = await openTask();
    const status = modal.locator('[data-type="status"]');
    await states(page, status, `composer-${variant}`);
    await status.click();
    const input = page.locator('.tn-picker__input');
    const rows = page.locator('.tn-picker__row');
    await input.press('Home');
    await capture(page, `picker-${variant}-keyboard`);
    const pointerRow = rows.nth(3);
    await pointerRow.hover();
    await capture(page, `picker-${variant}-pointer`);
    const listScroll = await page.locator('.tn-picker__list').evaluate(element => element.scrollTop);
    for (let index = 0; index < 4; index++) {
      const bounds = await rows.nth(index).boundingBox();
      await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
    }
    expect(await page.locator('.tn-picker__list').evaluate(element => element.scrollTop)).toBe(listScroll);
    await expect(page.locator('.tn-picker__row.is-active')).toHaveCount(1);
    await capture(page, `picker-${variant}-pointer-sweep`);
    await input.press('ArrowDown');
    await expect(page.locator('.tn-picker__row.is-active')).toHaveCount(1);
    await capture(page, `picker-${variant}-keyboard-after-pointer`);
    await input.fill('does-not-exist');
    await capture(page, `picker-${variant}-empty`);
    await expect(page.locator('.tn-picker__select-hint')).toBeHidden();
    await page.keyboard.press('Escape');
    if (width === 400) {
      const original = await page.evaluate(async taskPath => {
        const app = (window as any).app;
        return app.vault.read(app.vault.getAbstractFileByPath(taskPath));
      }, taskPath);
      await tap(page, status);
      await tap(page, page.locator('[data-picker-id="surface-2"]'));
      await expect(status).toContainText('Review stage 3');
      if (phase !== 'before') await expect(status).toHaveCSS('outline-style', 'none');
      await capture(page, `composer-${variant}-touch-draft`);
      expect(await page.evaluate(async taskPath => {
        const app = (window as any).app;
        return app.vault.read(app.vault.getAbstractFileByPath(taskPath));
      }, taskPath)).toBe(original);
    }
    await modal.locator('[data-type="due-date"]').click();
    await capture(page, `date-picker-${variant}-open`);
    await page.locator('[data-picker-id="custom"]').click();
    await states(page, page.locator('.date-time-picker-modal__time-input'), `date-input-${variant}`);
    if (phase !== 'before') {
      await expect(page.locator('.date-time-picker-modal__time-input')).toHaveCSS('box-shadow', 'none');
      await expect(page.locator('.date-time-picker-modal__time-input')).toHaveCSS('outline-width', '2px');
    }
    await page.keyboard.press('Escape');
    await modal.locator('[data-type="reminders"]').click();
    await page.getByText('Manage all reminders...', { exact: true }).click();
    await states(page, page.locator('.reminder-modal__save-btn'), `reminders-${variant}-save`);
    await states(page, page.locator('.reminder-modal__cancel-btn'), `reminders-${variant}`);
    await states(page, page.locator('.reminder-modal__type-tab--active'), `reminder-segments-${variant}`);
    await page.locator('.reminder-modal__type-tab').nth(1).click();
    await capture(page, `reminder-segments-${variant}-absolute-selected`);
  });

  test(`${variant}: settings controls and real reorder cancellation`, async () => {
    test.setTimeout(120000);
    const settingsPage = await openTaskNotesSettings(page, 'Task properties');
    try {
      await appearance(settingsPage, theme, width);
      const tabSelect = settingsPage.locator('.settings-view__tab-select');
      const navigation = await tabSelect.isVisible() ? tabSelect : settingsPage.getByRole('tab', { name: 'Task properties', exact: true });
      await states(settingsPage, navigation, `settings-navigation-${variant}`);
      const section = settingsPage.locator('[data-card-id="property-status"]');
      if (await section.evaluate(element => element.classList.contains('tasknotes-settings__card--collapsed'))) {
        await section.locator(':scope > .tasknotes-settings__card-header').click();
      }
      const handles = section.locator('.tasknotes-settings__card-drag-handle');
      await expect(handles.first()).toBeVisible();
      const firstCard = section.locator('.tasknotes-settings__card--draggable').first();
      await firstCard.locator(':scope > .tasknotes-settings__card-header').click();
      await states(settingsPage, firstCard.locator('input[type="text"]').first(), `settings-input-${variant}`);
      const toggle = firstCard.locator('.checkbox-container').first();
      await states(settingsPage, toggle, `settings-toggle-${variant}`);
      await toggle.click();
      await capture(settingsPage, `settings-toggle-${variant}-selected`);
      await toggle.click();
      await firstCard.locator(':scope > .tasknotes-settings__card-header').click();
      await states(settingsPage, handles.first(), `settings-${variant}`);
      await handles.nth(1).scrollIntoViewIfNeeded();
      await handles.first().scrollIntoViewIfNeeded();
      const source = await handles.first().boundingBox();
      const target = await handles.nth(1).boundingBox();
      await settingsPage.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
      await settingsPage.mouse.down();
      await settingsPage.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, { steps: 12 });
      await settingsPage.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2 + 2);
      await expect(section.locator('.tasknotes-settings__card--dragging')).toHaveCount(1);
      await capture(settingsPage, `settings-${variant}-drag`);
      await settingsPage.keyboard.press('Escape');
      await settingsPage.mouse.up();
      await capture(settingsPage, `settings-${variant}-cancelled`);
      if (phase !== 'before') {
        await expect(section.locator('[class*="--drag-over"], .tasknotes-settings__card--dragging')).toHaveCount(0);
        const firstId = await handles.first().evaluate(element => element.closest('[data-card-id]')?.getAttribute('data-card-id'));
        await handles.first().focus();
        await settingsPage.keyboard.press('Alt+ArrowDown');
        await expect.poll(() => handles.nth(1).evaluate(element => element.closest('[data-card-id]')?.getAttribute('data-card-id'))).toBe(firstId);
        await expect(handles.nth(1)).toBeFocused();
        await capture(settingsPage, `settings-${variant}-keyboard-reordered`);
        await settingsPage.keyboard.press('Alt+ArrowUp');
      }
      await handles.nth(1).scrollIntoViewIfNeeded();
      await handles.first().scrollIntoViewIfNeeded();
      const firstId = await handles.first().evaluate(element => element.closest('[data-card-id]')?.getAttribute('data-card-id'));
      const dropSource = await handles.first().boundingBox();
      const dropTarget = await handles.nth(1).evaluate(element => {
        const bounds = element.closest('[data-card-id]')!.getBoundingClientRect();
        return { x: bounds.x + bounds.width / 2, y: bounds.bottom - 4 };
      });
      await settingsPage.mouse.move(dropSource!.x + dropSource!.width / 2, dropSource!.y + dropSource!.height / 2);
      await settingsPage.mouse.down();
      await settingsPage.mouse.move(dropTarget.x, dropTarget.y, { steps: 12 });
      await settingsPage.mouse.move(dropTarget.x + 1, dropTarget.y + 1);
      await capture(settingsPage, `settings-${variant}-drop-target`);
      await settingsPage.mouse.up();
      await expect.poll(() => handles.nth(1).evaluate(element => element.closest('[data-card-id]')?.getAttribute('data-card-id'))).toBe(firstId);
      await expect(section.locator('[class*="--drag-over"], .tasknotes-settings__card--dragging')).toHaveCount(0);
      await capture(settingsPage, `settings-${variant}-drop-settled`);
      if (phase !== 'before') {
        await handles.first().scrollIntoViewIfNeeded();
        const invalidSource = await handles.first().boundingBox();
        const order = await handles.evaluateAll(elements => elements.map(element => element.closest('[data-card-id]')?.getAttribute('data-card-id')));
        await settingsPage.mouse.move(invalidSource!.x + invalidSource!.width / 2, invalidSource!.y + invalidSource!.height / 2);
        await settingsPage.mouse.down();
        await settingsPage.mouse.move(50, 80, { steps: 12 });
        await capture(settingsPage, `settings-${variant}-invalid-target`);
        await settingsPage.mouse.up();
        await expect(section.locator('[class*="--drag-over"], .tasknotes-settings__card--dragging')).toHaveCount(0);
        expect(await handles.evaluateAll(elements => elements.map(element => element.closest('[data-card-id]')?.getAttribute('data-card-id')))).toEqual(order);
        await handles.first().scrollIntoViewIfNeeded();
        const scrollSource = await handles.first().boundingBox();
        const scroller = settingsPage.locator('.vertical-tab-content').first();
        const scrollBounds = await scroller.boundingBox();
        const scrollBefore = await scroller.evaluate(element => element.scrollTop);
        await settingsPage.mouse.move(scrollSource!.x + scrollSource!.width / 2, scrollSource!.y + scrollSource!.height / 2);
        await settingsPage.mouse.down();
        await settingsPage.mouse.move(scrollBounds!.x + scrollBounds!.width / 2, Math.min(792, scrollBounds!.y + scrollBounds!.height - 8), { steps: 12 });
        await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(scrollBefore);
        await capture(settingsPage, `settings-${variant}-auto-scroll`);
        await settingsPage.keyboard.press('Escape');
        await settingsPage.mouse.up();
        await expect(section.locator('[class*="--drag-over"], .tasknotes-settings__card--dragging')).toHaveCount(0);
      }
    } finally {
      if (!settingsPage.isClosed()) await closeObsidianSettings(page, settingsPage);
    }
  });

  test(`${variant}: toolbar, menu, toast and secondary controls`, async () => {
    test.setTimeout(120000);
    await appearance(page, theme, width);
    await page.evaluate(async folder => {
      const app = (window as any).app;
      await (window as any).surfacesR7Leaf.openFile(app.vault.getAbstractFileByPath(`${folder}/List.base`));
      app.workspace.setActiveLeaf((window as any).surfacesR7Leaf, { focus: true });
    }, folder);
    await states(page, page.locator('.workspace-leaf.mod-active .tn-bases-new-task-btn button'), `toolbar-${variant}`);
    const card = page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${taskPath}"]`);
    await card.click({ button: 'right' });
    await capture(page, `menu-${variant}-open`);
    await page.keyboard.press('ArrowDown');
    await capture(page, `menu-${variant}-keyboard`);
    await page.keyboard.press('Escape');
    await card.locator('.task-card__status-dot').press('s');
    await page.locator('[data-picker-id="surface-2"]').click();
    await states(page, page.locator('.tn-toast__action'), `toast-${variant}`);
    await page.locator('.tn-toast__action').click();
    await expect(page.locator('.tn-toast__action')).toHaveCount(0);
    if (phase !== 'before') {
      await card.locator('.task-card__status-dot').press('s');
      await page.locator('[data-picker-id="surface-3"]').click();
      await page.evaluate(taskPath => {
        const app = (window as any).app;
        (window as any).surfacesR7Process = app.vault.process;
        app.vault.process = async function(file: any, ...args: any[]) {
          if (file.path === taskPath) await new Promise(resolve => { (window as any).surfacesR7Release = resolve; });
          return (window as any).surfacesR7Process.call(this, file, ...args);
        };
      }, taskPath);
      try {
        await page.locator('.tn-toast__action').click();
        await expect(page.locator('.tn-toast__action')).toHaveAttribute('aria-busy', 'true');
        await expect.poll(() => page.evaluate(() => typeof (window as any).surfacesR7Release)).toBe('function');
        await capture(page, `toast-${variant}-pending-disabled`);
        await page.evaluate(() => (window as any).surfacesR7Release?.());
        await expect(page.locator('.tn-toast__action')).toHaveCount(0);
      } finally {
        await page.evaluate(() => {
          (window as any).surfacesR7Release?.();
          (window as any).app.vault.process = (window as any).surfacesR7Process;
        });
      }
      await page.evaluate(() => {
        const plugin = (window as any).app.plugins.plugins.tasknotes;
        (window as any).surfacesR7Update = plugin.updateTaskProperty;
        plugin.updateTaskProperty = async () => { throw new Error('Fixture write failure'); };
      });
      try {
        await card.locator('.task-card__status-dot').press('s');
        await page.locator('[data-picker-id="surface-4"]').click();
        await expect(page.locator('.tn-toast.is-error')).toContainText('Could not save');
        await expect(page.locator('.tn-toast')).toHaveAttribute('role', 'alert');
        await capture(page, `toast-${variant}-failed-write`);
      } finally {
        await page.evaluate(() => { (window as any).app.plugins.plugins.tasknotes.updateTaskProperty = (window as any).surfacesR7Update; });
      }
    }
    await page.evaluate(() => document.querySelector('.tn-toast')?.dispatchEvent(new Event('tn-dismiss')));
    for (const [view, selector] of [['tasknotes-pomodoro-view', '.pomodoro-view__start-button'], ['tasknotes-stats-view', '.stats-view button'], ['tasknotes-pomodoro-stats-view', '.pomodoro-stats-view button']]) {
      await page.evaluate(async view => (window as any).surfacesR7Leaf.setViewState({ type: view, active: true }), view);
      await states(page, page.locator(selector).first(), `${view}-${variant}`);
      if (view === 'tasknotes-stats-view') {
        await page.locator('.stats-view__filter-disclosure summary').click();
        await states(page, page.locator('.stats-view__filter-select'), `report-filter-${variant}`);
      }
    }
  });

  test(`${variant}: inline task controls preserve prose and keyboard actions`, async () => {
    await appearance(page, theme, width);
    await page.evaluate(async folder => {
      const app = (window as any).app;
      await (window as any).surfacesR7Leaf.openFile(app.vault.getAbstractFileByPath(`${folder}/Prose.md`), { state: { mode: 'preview' } });
      app.workspace.setActiveLeaf((window as any).surfacesR7Leaf, { focus: true });
    }, folder);
    const cards = page.locator('.workspace-leaf.mod-active .task-card--layout-inline:visible');
    await expect(cards).toHaveCount(2);
    await states(page, cards.last().locator('.task-card__status-dot'), `inline-${variant}`);
    await cards.first().locator('.task-card__status-dot').focus();
    await expect(cards.first().locator('.task-card__context-menu')).toHaveCSS('opacity', '1');
    await capture(page, `inline-${variant}-sentence-focus`);
    await cards.last().locator('.task-card__context-menu').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.menu').last()).toBeVisible();
    await capture(page, `inline-${variant}-menu`);
  });
}
