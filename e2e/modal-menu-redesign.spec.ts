import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
let page: Page;
const folder = `ModalMenuRedesign-${Date.now()}`;
const taskPath = `${folder}/Composer.md`;
const taskTitle = 'Review the launch plan with accessibility, localization, and offline recovery owners';

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  page.on('pageerror', error => console.error('Obsidian renderer error:', error));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await page.evaluate(async ({ folder, taskPath, taskTitle }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    (window as any).__modalMenuOriginalSettings = {
      customStatuses: plugin.settings.customStatuses,
      customPriorities: plugin.settings.customPriorities,
      defaultTaskStatus: plugin.settings.defaultTaskStatus,
      defaultTaskPriority: plugin.settings.defaultTaskPriority,
    };
    plugin.settings.enableModalSplitLayout = false;
    const status = plugin.settings.customStatuses[0];
    const priority = plugin.settings.customPriorities[0];
    plugin.settings.customStatuses = Array.from({ length: 18 }, (_, index) => ({
      ...status, id: `review-${index}`, value: `review-${index}`,
      label: index === 1 ? 'Awaiting cross-functional accessibility and localization review' : `Review stage ${index + 1}`,
      order: index, icon: index === 1 ? 'orbit' : 'circle', isCompleted: index === 17,
    }));
    plugin.settings.customPriorities = Array.from({ length: 18 }, (_, index) => ({
      ...priority, id: `impact-${index}`, value: `impact-${index}`,
      label: index === 1 ? 'Customer-facing and time-sensitive priority' : `Impact level ${index + 1}`,
      weight: index, icon: index === 1 ? 'flame' : 'flag',
    }));
    plugin.settings.defaultTaskStatus = 'review-1';
    plugin.settings.defaultTaskPriority = 'impact-1';
    plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
    plugin.priorityManager.updatePriorities(plugin.settings.customPriorities);
    for (const notice of document.querySelectorAll('.notice-container')) notice.remove();
    await app.vault.createFolder(folder);
    await app.vault.create(taskPath, `---\ntags: [task, release, accessibility, localization]\ntitle: ${taskTitle}\nstatus: review-1\npriority: impact-1\ndue: 2027-02-27T15:30\nscheduled: 2027-02-25\ncontexts: [work, planning, review]\ntimeEstimate: 120\nrecurrence: FREQ=WEEKLY;BYDAY=TU,TH\n---\n## Acceptance criteria\n\n- Preserve every existing action and all custom properties.\n- Check keyboard focus, light and dark themes, and narrow screens.\n\n${'Detailed planning notes with links, decisions, and follow-up work. '.repeat(8)}`);
  }, { folder, taskPath, taskTitle });
  await expect.poll(() => page.evaluate(async taskPath => !!await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(taskPath), taskPath)).toBe(true);
});

test.afterEach(async () => {
  await page.evaluate(() => {
    const app = (window as any).app;
    for (const modal of [...(app.modalStack ?? [])].reverse()) modal.close();
  });
  await page.keyboard.press('Escape');
});

test.afterAll(async () => {
  try {
    if (page && !page.isClosed()) await page.evaluate(async folder => {
      const app = (window as any).app;
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally {
    if (instance) await closeObsidian(instance);
  }
});

test.beforeEach(async () => {
  await page.evaluate(() => document.body.classList.remove('is-mobile'));
  await setObsidianViewport(page, { width: 1180, height: 800 });
});

for (const theme of ['theme-light', 'theme-dark']) {
  for (const mode of ['create', 'edit']) {
    test(`${theme}: ${mode} modal pickers keep changes in the draft until save`, async () => {
      await setObsidianViewport(page, { width: 1180, height: 800 });
      const before = await page.evaluate(async ({ theme, mode, taskPath }) => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins.tasknotes;
        document.body.classList.remove('theme-light', 'theme-dark', 'is-mobile');
        document.body.classList.add(theme);
        const file = app.vault.getAbstractFileByPath(taskPath);
        const content = await app.vault.read(file);
        const paths = app.vault.getMarkdownFiles().map((entry: any) => entry.path).sort();
        if (mode === 'edit') plugin.openTaskEditModal(await plugin.cacheManager.getTaskInfo(taskPath));
        else plugin.openTaskCreationModal();
        return { content, paths };
      }, { theme, mode, taskPath });
      const modal = page.locator('.modal.mod-tasknotes');
      const title = `Picker draft ${mode} ${theme}`;
      const titleInput = mode === 'create'
        ? modal.locator('.tn-task-modal__markdown-editor--nlp .cm-content')
        : modal.locator('.title-input');
      if (mode === 'edit') await expect(titleInput).toBeFocused();
      await titleInput.fill(title);
      const status = modal.locator('[data-type="status"]');
      await status.click();
      const picker = page.locator('.tn-picker');
      await expect(picker.locator('[data-picker-id]')).toHaveCount(18);
      await expect(picker.locator('[data-picker-id="review-1"]')).toHaveClass(/is-selected/);
      await expect(picker.locator('[data-picker-id="review-1"] .tn-picker__leading svg')).toHaveClass(/orbit/);
      await expect(picker.locator('input')).toBeFocused();
      await page.evaluate(() => document.querySelectorAll('.notice-container').forEach(element => element.remove()));
      await page.screenshot({ path: `test-results/modal-pickers/${mode}-${theme}-status.png`, clip: (await modal.boundingBox())! });
      await picker.locator('input').fill('Review stage 18');
      await page.keyboard.press('Escape');
      await expect(picker).toHaveCount(0);
      await expect(modal).toBeVisible();
      await expect(status).toBeFocused();
      if (mode === 'edit') await expect(titleInput).toHaveText(title);
      else await expect(titleInput).toHaveText(title);
      await status.press('Enter');
      await picker.locator('input').fill('Review stage 3');
      await page.keyboard.press('Enter');
      await expect(status).toContainText('Review stage 3');
      await modal.locator('[data-type="priority"]').click();
      await expect(picker.locator('[data-picker-id]')).toHaveCount(18);
      await expect(picker.locator('[data-picker-id="impact-0"]')).toBeAttached();
      await expect(picker.locator('[data-picker-id="impact-1"] .tn-picker__leading svg')).toHaveClass(/flame/);
      await picker.locator('input').fill('Impact level 18');
      await page.keyboard.press('Enter');
      await expect(modal.locator('[data-type="priority"]')).toContainText('Impact level 18');
      await modal.locator('[data-type="due-date"]').click();
      await picker.locator('input').fill('March 11 2027 at 10:15');
      await page.keyboard.press('Enter');
      await expect(modal.locator('[data-type="due-date"]')).toContainText('10:15');
      await modal.locator('[data-type="due-date"]').click();
      await picker.getByText('+1 day', { exact: true }).click();
      await expect(modal.locator('[data-type="due-date"]')).toContainText('10:15');
      await modal.locator('[data-type="scheduled-date"]').click();
      await picker.getByText('Clear', { exact: true }).click();
      await modal.locator('[data-type="priority"]').click();
      await page.locator('.modal-bg').last().click({ position: { x: 5, y: 5 }, force: true });
      await expect(picker).toHaveCount(0);
      await expect(modal).toBeVisible();
      await expect(modal.locator('[data-type="priority"]')).toBeFocused();
      const unsaved = await page.evaluate(async taskPath => {
        const app = (window as any).app;
        return { content: await app.vault.read(app.vault.getAbstractFileByPath(taskPath)),
          paths: app.vault.getMarkdownFiles().map((entry: any) => entry.path).sort() };
      }, taskPath);
      expect(unsaved).toEqual(before);
      if (mode === 'edit') {
        await page.keyboard.press('Escape');
        const keepEditing = page.getByRole('button', { name: 'Keep editing', exact: true });
        await expect(keepEditing).toBeVisible();
        await keepEditing.click();
        await expect(status).toContainText('Review stage 3');
      }
      await modal.locator('button.mod-cta').click();
      await expect(modal).toHaveCount(0);
      let saved: any;
      await expect.poll(async () => {
        saved = await page.evaluate(async title => {
          const plugin = (window as any).app.plugins.plugins.tasknotes;
          return (await plugin.cacheManager.getAllTasks()).find((task: any) => task.title === title);
        }, title);
        return saved?.status;
      }).toBe('review-2');
      expect(saved.priority).toBe('impact-17');
      expect(saved.due).toBe('2027-03-12T10:15');
      expect(saved.scheduled || '').toBe('');
      await page.evaluate(async ({ savedPath, taskPath, content, mode }) => {
        const app = (window as any).app;
        if (mode === 'create') await app.vault.delete(app.vault.getAbstractFileByPath(savedPath));
        else {
          const file = app.vault.getAbstractFileByPath(savedPath);
          if (savedPath !== taskPath) await app.fileManager.renameFile(file, taskPath);
          await app.vault.modify(file, content);
        }
      }, { savedPath: saved.path, taskPath, content: before.content, mode });
      await expect.poll(() => page.evaluate(async taskPath =>
        (await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(taskPath))?.title,
      taskPath)).toBe(taskTitle);
    });
  }

  test(`${theme}: composer hierarchy, defaults, custom icons and labelled values`, async () => {
    await setObsidianViewport(page, { width: 1180, height: 800 });
    await page.evaluate(theme => {
      document.body.classList.remove('theme-light', 'theme-dark', 'is-mobile');
      document.body.classList.add(theme);
      (window as any).app.plugins.plugins.tasknotes.openTaskCreationModal();
    }, theme);
    const modal = page.locator('.modal.mod-tasknotes');
    await expect(modal.locator('[data-type="status"]')).toHaveAttribute('data-value-state', 'default');
    await expect(modal.locator('[data-type="priority"]')).toHaveAttribute('data-value-state', 'default');
    await expect(modal.getByRole('checkbox', { name: 'Create more' })).toBeVisible();
    await expect(modal.locator('.tn-task-modal__markdown-editor--details')).toBeVisible();
    await expect(modal.locator('.tn-task-modal__action-bar')).toBeVisible();
    const positions = await modal.evaluate(element => ['.tn-task-modal__markdown-editor--nlp', '.modal-split-right', '.tn-task-modal__action-bar'].map(selector => element.querySelector(selector)!.getBoundingClientRect().top));
    expect(positions[0]).toBeLessThan(positions[1]);
    expect(positions[1]).toBeLessThan(positions[2]);
    expect(await modal.locator('[data-type="status"] .icon svg').getAttribute('class')).toContain('orbit');
    expect(await modal.locator('[data-type="priority"] .icon svg').getAttribute('class')).toContain('flame');
    await page.screenshot({ path: `test-results/modal-menu/create-${theme}.png` });
    await page.keyboard.press('Escape');
    await page.evaluate(async taskPath => {
      const plugin = (window as any).app.plugins.plugins.tasknotes;
      plugin.openTaskEditModal(await plugin.cacheManager.getTaskInfo(taskPath));
    }, taskPath);
    await expect(modal.locator('.title-input')).toHaveText(taskTitle);
    await expect(modal.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
    await expect(modal.locator('.mod-cta .tn-key-hint')).toBeVisible();
    await page.screenshot({ path: `test-results/modal-menu/edit-${theme}.png` });
    await page.keyboard.press('Escape');
  });
}

test('narrow mobile composer preserves every property without horizontal overflow', async () => {
  await setObsidianViewport(page, { width: 420, height: 780 });
  await page.evaluate(async taskPath => {
    document.body.classList.add('is-mobile');
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    plugin.openTaskEditModal(await plugin.cacheManager.getTaskInfo(taskPath));
  }, taskPath);
  const modal = page.locator('.modal.mod-tasknotes');
  await expect(modal.locator('.title-input')).toHaveText(taskTitle);
  const layout = await modal.evaluate(element => ({
    width: element.getBoundingClientRect().width,
    viewport: innerWidth,
    contentWidth: element.querySelector('.modal-content')!.scrollWidth,
    available: element.querySelector('.modal-content')!.clientWidth,
  }));
  expect(layout.width).toBeLessThanOrEqual(layout.viewport);
  expect(layout.contentWidth).toBeLessThanOrEqual(layout.available + 1);
  await expect(modal.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
  const positions = await modal.evaluate(element => ['.title-input-container', '.modal-split-right', '.tn-task-modal__action-bar'].map(selector => element.querySelector(selector)!.getBoundingClientRect().top));
  expect(positions[0]).toBeLessThan(positions[1]);
  expect(positions[1]).toBeLessThan(positions[2]);
  await page.screenshot({ path: 'test-results/modal-menu/edit-mobile.png' });
  const status = modal.locator('[data-type="status"]');
  expect((await status.boundingBox())!.height).toBeGreaterThanOrEqual(40);
  await status.click();
  const picker = page.locator('.tn-picker');
  const dimensions = await picker.evaluate(element => ({
    bounds: element.getBoundingClientRect().toJSON(), viewport: innerWidth,
    targets: [...element.querySelectorAll('.tn-picker__row, input')].map(row => row.getBoundingClientRect().height),
  }));
  expect(dimensions.bounds.x).toBeGreaterThanOrEqual(0);
  expect(dimensions.bounds.right).toBeLessThanOrEqual(dimensions.viewport);
  expect(Math.min(...dimensions.targets)).toBeGreaterThanOrEqual(40);
  await page.evaluate(() => document.querySelectorAll('.notice-container').forEach(element => element.remove()));
  await page.screenshot({ path: 'test-results/modal-pickers/mobile-status.png', clip: (await modal.boundingBox())! });
  await picker.locator('input').fill('Review stage 18');
  await page.keyboard.press('Escape');
  await expect(modal).toBeVisible();
  await expect(status).toBeFocused();
  await page.keyboard.press('Escape');
});

test('pop-out modal pickers use the owning window and return focus', async () => {
  await page.evaluate(() => document.body.classList.remove('is-mobile'));
  const opened = page.context().waitForEvent('page');
  await page.evaluate(async taskPath => {
    const app = (window as any).app;
    (window as any).__modalPickerOriginalLeaf = app.workspace.activeLeaf;
    const leaf = app.workspace.openPopoutLeaf({ width: 980, height: 760 });
    (window as any).__modalPickerPopoutLeaf = leaf;
    await leaf.openFile(app.vault.getAbstractFileByPath(taskPath));
  }, taskPath);
  const popout = await opened;
  try {
    await popout.waitForLoadState('domcontentloaded');
    await popout.bringToFront();
    await popout.evaluate(() => (window as any).require('electron').remote.getCurrentWindow().focus());
    await popout.locator('.workspace-leaf-content').last().click({ position: { x: 30, y: 80 } });
    await popout.evaluate(async taskPath => {
      const plugin = (window as any).app.plugins.plugins.tasknotes;
      const task = await plugin.cacheManager.getTaskInfo(taskPath);
      window.dispatchEvent(new Event('focus'));
      plugin.openTaskEditModal(task);
    }, taskPath);
    const modal = popout.locator('.modal.mod-tasknotes');
    const status = modal.locator('[data-type="status"]');
    await status.click();
    const picker = popout.locator('.tn-picker');
    await expect(picker.locator('input')).toBeFocused();
    await expect(picker.locator('[data-picker-id]')).toHaveCount(18);
    await expect(page.locator('.tn-picker')).toHaveCount(0);
    await picker.locator('input').fill('Review stage 18');
    await popout.keyboard.press('Escape');
    await expect(picker).toHaveCount(0);
    await expect(modal).toBeVisible();
    await expect(status).toBeFocused();
    await popout.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
  } finally {
    await page.evaluate(() => {
      const app = (window as any).app;
      app.workspace.setActiveLeaf((window as any).__modalPickerOriginalLeaf, { focus: true });
      (window as any).__modalPickerPopoutLeaf.detach();
      delete (window as any).__modalPickerOriginalLeaf;
      delete (window as any).__modalPickerPopoutLeaf;
      window.dispatchEvent(new Event('focus'));
    });
    if (!popout.isClosed()) await popout.close();
    if (!page.isClosed()) await page.bringToFront();
  }
});

test('native task menu groups every action and keeps keyboard hints aligned', async () => {
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await page.evaluate(async ({ folder, taskPath }) => {
    document.body.classList.remove('is-mobile');
    const app = (window as any).app;
    const base = await app.vault.create(`${folder}/Menu.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\nviews:\n  - type: tasknotesTaskList\n    name: Tasks\n`);
    await app.workspace.getLeaf(false).openFile(base);
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
  }, { folder, taskPath });
  const card = page.locator(`.task-card[data-task-path="${taskPath}"]`).first();
  await expect(card).toBeVisible();
  await card.click({ button: 'right' });
  const menu = page.locator('.menu').last();
  await expect(menu.locator('.menu-item-title').filter({ hasText: /^Time tracking$/ })).toBeVisible();
  await expect(menu.locator('.menu-item-title').filter({ hasText: /^Note actions$/ })).toBeVisible();
  await expect(menu.locator('.menu-item-shortcut').filter({ hasText: /^E$/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/modal-menu/task-menu.png' });
  await menu.locator('.menu-item').filter({ has: page.locator('.menu-item-title', { hasText: /^Status$/ }) }).hover();
  const statuses = page.locator('.menu').last();
  await expect(statuses.locator('.menu-item')).toHaveCount(18);
  await expect(statuses.getByText('Awaiting cross-functional accessibility and localization review', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/modal-menu/status-menu.png' });
  await page.keyboard.press('Escape');
});

test('date, recurrence and reminder editors share the modal shell', async () => {
  await page.evaluate(async taskPath => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    plugin.openTaskEditModal(await plugin.cacheManager.getTaskInfo(taskPath));
  }, taskPath);
  const composer = page.locator('.modal.mod-tasknotes');
  await composer.locator('[data-type="due-date"]').click();
  await page.locator('.tn-picker').getByText('Pick date & time…', { exact: true }).click();
  let editor = page.locator('.modal.tn-modal').last();
  await expect(editor.locator('.mod-cta .tn-key-hint')).toBeVisible();
  await page.screenshot({ path: 'test-results/modal-menu/date-time.png', clip: (await editor.boundingBox())! });
  await page.keyboard.press('Escape');
  await composer.locator('[data-type="recurrence"]').click();
  await page.locator('.menu-item-title').getByText('Custom recurrence...', { exact: true }).click();
  editor = page.locator('.modal.tn-modal').last();
  await expect(editor.locator('.mod-cta .tn-key-hint')).toBeVisible();
  await page.screenshot({ path: 'test-results/modal-menu/recurrence.png', clip: (await editor.boundingBox())! });
  await page.keyboard.press('Escape');
  await composer.locator('[data-type="reminders"]').click();
  await page.getByText('Manage all reminders...', { exact: true }).click();
  editor = page.locator('.modal.tn-modal').last();
  await expect(editor.locator('.reminder-modal__save-btn .tn-key-hint')).toBeVisible();
  await page.screenshot({ path: 'test-results/modal-menu/reminders.png', clip: (await editor.boundingBox())! });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
});

test('unknown workflow values remain visible and selectable menus preserve them', async () => {
  await page.evaluate(async taskPath => {
    const app = (window as any).app;
    await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(taskPath), (frontmatter: any) => {
      frontmatter.status = 'retired-review-stage';
      frontmatter.priority = 'legacy-impact';
    });
  }, taskPath);
  await expect.poll(() => page.evaluate(async taskPath => (await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(taskPath)).status, taskPath)).toBe('retired-review-stage');
  await page.evaluate(async taskPath => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    plugin.openTaskEditModal(await plugin.cacheManager.getTaskInfo(taskPath));
  }, taskPath);
  const modal = page.locator('.modal.mod-tasknotes');
  await expect(modal.locator('[data-type="status"]')).toHaveAttribute('data-value-state', 'set');
  await expect(modal.locator('[data-type="priority"]')).toContainText('legacy-impact');
  await modal.locator('[data-type="status"]').click();
  await expect(page.locator('.tn-picker [data-picker-id="retired-review-stage"]')).toHaveClass(/is-selected/);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
});

test('project selector and delete confirmation retain native cancellation', async () => {
  await page.evaluate(async taskPath => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    plugin.openTaskEditModal(await plugin.cacheManager.getTaskInfo(taskPath));
  }, taskPath);
  const modal = page.locator('.modal.mod-tasknotes');
  await expect(modal.locator('.title-input')).toBeVisible();
  if (await modal.locator('.tn-task-modal__details-toggle').getAttribute('aria-expanded') !== 'true') await modal.locator('.tn-task-modal__details-toggle').click();
  await modal.getByText('Add to project', { exact: true }).click();
  const selector = page.locator('.prompt.tn-modal');
  await expect(selector.locator('input')).toBeVisible();
  await page.screenshot({ path: 'test-results/modal-menu/project-selector.png', clip: (await selector.boundingBox())! });
  await page.keyboard.press('Escape');
  await modal.locator('.tn-task-modal__overflow-button').click();
  await page.locator('.menu').last().getByText('Delete', { exact: true }).click();
  const confirmation = page.locator('.modal.tn-modal').last();
  await expect(confirmation.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/modal-menu/delete-confirmation.png', clip: (await confirmation.boundingBox())! });
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(taskPath => !!(window as any).app.vault.getAbstractFileByPath(taskPath), taskPath)).toBe(true);
  await page.keyboard.press('Escape');
});

test('documentation image shows the current filled composer', async () => {
  await page.evaluate(async ({ taskPath, taskTitle }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const settings = (window as any).__modalMenuOriginalSettings;
    Object.assign(plugin.settings, settings);
    plugin.statusManager.updateStatuses(settings.customStatuses);
    plugin.priorityManager.updatePriorities(settings.customPriorities);
    document.body.classList.remove('theme-dark', 'is-mobile');
    document.body.classList.add('theme-light');
    const task = await plugin.cacheManager.getTaskInfo(taskPath);
    await app.vault.modify(app.vault.getAbstractFileByPath(taskPath), `---\ntags: [task, launch]\ntitle: ${taskTitle}\nstatus: ${settings.defaultTaskStatus}\npriority: ${settings.defaultTaskPriority}\ndue: 2027-02-27\nscheduled: 2027-02-25\n---\nCoordinate the launch checklist with the team.\n\n- Review accessibility and localization\n- Confirm the offline recovery plan`);
    plugin.openTaskEditModal({ ...task, title: taskTitle, status: settings.defaultTaskStatus, priority: settings.defaultTaskPriority });
  }, { taskPath, taskTitle: 'Prepare the product launch checklist' });
  const modal = page.locator('.modal.mod-tasknotes');
  await expect(modal.locator('.title-input')).toHaveText('Prepare the product launch checklist');
  await expect(modal.locator('[data-type="status"] .action-icon__label')).toBeVisible();
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.getSelection()?.removeAllRanges();
  });
  await page.screenshot({ path: 'test-results/modal-menu/feature-task-modal-filled.png', clip: (await modal.boundingBox())! });
  await page.keyboard.press('Escape');
});
