import { test, expect, type Page } from '@playwright/test';
import { stringify } from 'yaml';
import { mkdirSync, writeFileSync } from 'fs';
import { launchObsidian, closeObsidian, closeObsidianSettings, setObsidianViewport, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
let page: Page;
const folder = `MobileR7-${Date.now()}`;
const taskPath = `${folder}/Review.md`;
const output = `/tmp/tasknotes-r7/mobile/${process.env.TASKNOTES_R7_PHASE ?? 'after'}`;
const baseline = process.env.TASKNOTES_R7_PHASE === 'before';
let surfaceVersion = 0;

async function resizeForCapture(target: Page, size: { width: number; height: number }) {
  await target.evaluate(({ width, height }) => {
    const nativeWindow = (window as any).require?.('electron')?.remote?.getCurrentWindow?.();
    if (nativeWindow) {
      const [minimumWidth, minimumHeight] = nativeWindow.getMinimumSize();
      nativeWindow.setMinimumSize(Math.min(width, minimumWidth), Math.min(height, minimumHeight));
    }
    if (nativeWindow?.isMaximized()) nativeWindow.unmaximize();
  }, size);
  await setObsidianViewport(target, size);
  await expect.poll(() => target.evaluate(() => (window as any).require?.('electron')?.remote?.getCurrentWindow?.()?.getContentSize())).toEqual([size.width, size.height]);
}

async function captureState(target: Page, path: string) {
  await target.locator('.notice-container .notice').evaluateAll(notices => notices
    .filter(notice => notice.textContent?.includes('Secrets are stored without encryption'))
    .forEach(notice => notice.remove()));
  const size = target.viewportSize()!;
  const image = await target.screenshot({ path, clip: { x: 0, y: 0, ...size } });
  expect(image.readUInt32BE(16)).toBe(size.width);
  expect(image.readUInt32BE(20)).toBe(size.height);
}

test.beforeAll(async () => {
  mkdirSync(output, { recursive: true });
  instance = await launchObsidian();
  page = instance.page;
  await page.evaluate(async ({ folder, taskPath }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    (window as any).mobileR7Settings = JSON.parse(JSON.stringify(plugin.settings));
    plugin.settings.enableNaturalLanguageInput = true;
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    await app.vault.createFolder(folder);
    const today = (window as any).moment().format('YYYY-MM-DD');
    await app.vault.create(taskPath, `---\ntitle: Review the supplier onboarding plan with operations before launch\ntags: [task, operations, accessibility]\nstatus: ${plugin.settings.defaultTaskStatus}\npriority: ${plugin.settings.defaultTaskPriority}\nscheduled: ${today}T10:00\ndue: ${today}\n---\n`);
    await app.vault.create(`${folder}/Selection.md`, `---\ntitle: Companion task\ntags: [task]\nstatus: ${plugin.settings.defaultTaskStatus}\n---\n`);
    for (const [index, status] of plugin.statusManager.getAllStatuses().entries()) {
      await app.vault.create(`${folder}/Task-${index}.md`, `---\ntitle: ${index ? 'Neighbouring column' : 'Short title'}\ntags: [task]\nstatus: ${status.value}\n---\n`);
    }
    await app.vault.create(`${folder}/Inline.md`, `# Standalone task\n\n[[${folder}/Review]]\n\nSentence control: see [[${folder}/Review]] before launch.\n`);
  }, { folder, taskPath });
  await expect.poll(() => page.evaluate(async taskPath => Boolean(await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(taskPath)), taskPath)).toBe(true);
});

test.afterAll(async () => {
  try {
    if (page) await page.evaluate(async folder => {
      const app = (window as any).app;
      Object.assign(app.plugins.plugins.tasknotes.settings, (window as any).mobileR7Settings);
      await app.plugins.plugins.tasknotes.saveSettings();
      for (const leaf of [...app.workspace.getLeavesOfType('bases'), ...app.workspace.getLeavesOfType('markdown')]) if (leaf.view.file?.path.startsWith(folder)) leaf.detach();
      const directory = app.vault.getAbstractFileByPath(folder);
      if (directory) await app.vault.delete(directory, true);
    }, folder);
  } finally { if (instance) await closeObsidian(instance); }
});

for (const theme of ['light', 'dark']) test(`${theme}: touch, batch, help, invalid date and failed-write recovery`, async () => {
  await setObsidianViewport(page, { width: 400, height: 900 });
  await page.evaluate(theme => {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme}`, 'is-mobile');
  }, theme);
  await openSurface('list');
  const card = page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${taskPath}"]`);
  const status = card.locator('.task-card__status-dot');
  await card.scrollIntoViewIfNeeded();
  await status.focus();
  await page.keyboard.press('s');
  const choices = await page.locator('.tn-picker__row').evaluateAll(elements => elements.map(element => ({ id: element.getAttribute('data-picker-id'), label: element.querySelector('.tn-picker__label')?.textContent, selected: element.classList.contains('is-selected') })));
  const next = choices.find(choice => !choice.selected)!;
  await page.keyboard.press('Escape');
  const glyph = (await status.locator('svg').boundingBox())!;
  const touch = await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: glyph.x + glyph.width / 2, y: glyph.y - 4 }] });
  await captureState(page, `${output}/${theme}-400-list-touch-pressed.png`);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await touch.detach();
  await expect(page.locator('.tn-toast')).toContainText('1 task updated');
  await expect(page.locator('.modal-container:visible')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.tn-toast')).toContainText('Undid Status change');
  await openSurface('list');
  await page.evaluate(({ folder, taskPath }) => (window as any).app.plugins.plugins.tasknotes.taskSelectionService.selectAll([taskPath, `${folder}/Task-0.md`]), { folder, taskPath });
  await status.focus();
  await page.keyboard.press('s');
  await expect(page.locator('.tn-popover__title')).toContainText('2 tasks selected');
  await captureState(page, `${output}/${theme}-400-batch-focus.png`);
  await page.keyboard.press('Escape');
  await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.taskSelectionService.clearSelection());
  await card.locator('.task-card__context-menu').click();
  await page.getByText('Keyboard shortcuts', { exact: true }).last().click();
  await expect(page.locator('.tn-popover')).toContainText('Undo');
  await captureState(page, `${output}/${theme}-400-shortcut-help.png`);
  await page.keyboard.press('Escape');
  await card.locator('.task-card__metadata-date--due').click();
  const quickInput = page.locator('.tn-picker input[role="combobox"]');
  await quickInput.fill('zxqv');
  await expect(quickInput).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.tn-picker__error')).toBeVisible();
  await quickInput.fill('');
  await expect(quickInput).not.toHaveAttribute('aria-invalid');
  await page.getByRole('option', { name: 'Pick date & time…', exact: true }).click();
  const nlp = page.locator('.date-time-picker-modal__nlp-input');
  await nlp.fill('zxqv');
  await nlp.press('Enter');
  await expect(nlp).toHaveAttribute('aria-invalid', 'true');
  await expect(nlp).toBeFocused();
  await expect(page.locator('.date-time-picker-modal__error')).toContainText('Could not find a date');
  await captureState(page, `${output}/${theme}-400-date-invalid.png`);
  await nlp.fill('still not a date');
  await expect(nlp).toHaveAttribute('aria-invalid', 'true');
  await nlp.fill('tomorrow');
  await expect(nlp).not.toHaveAttribute('aria-invalid');
  await expect(page.locator('.date-time-picker-modal__error')).toBeHidden();
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    (window as any).mobileR7Update = plugin.updateTaskProperty;
    plugin.updateTaskProperty = async () => { throw new Error('Read-only recovery fixture'); };
  });
  try {
    await status.focus();
    await page.keyboard.press('s');
    await page.getByRole('option', { name: next.label!, exact: true }).click();
    await expect(page.locator('.tn-toast')).toContainText('Check that the notes are writable');
    const recovery = page.getByRole('button', { name: 'Open task', exact: true });
    await expect(recovery).toBeVisible();
    await recovery.focus();
    await captureState(page, `${output}/${theme}-400-write-failed.png`);
    await recovery.click();
    await expect.poll(() => page.evaluate(() => (window as any).app.workspace.getActiveFile()?.path)).toBe(taskPath);
  } finally {
    await page.evaluate(() => { (window as any).app.plugins.plugins.tasknotes.updateTaskProperty = (window as any).mobileR7Update; });
  }
  await openSurface('board');
  const boardStatus = page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${taskPath}"] .task-card__status-dot`);
  await boardStatus.scrollIntoViewIfNeeded();
  const boardGlyph = (await boardStatus.locator('svg').boundingBox())!;
  const boardTouch = await page.context().newCDPSession(page);
  await boardTouch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: boardGlyph.x + boardGlyph.width / 2, y: boardGlyph.y - 4 }] });
  await captureState(page, `${output}/${theme}-400-board-touch-pressed.png`);
  await boardTouch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await boardTouch.detach();
  await expect(page.locator('.tn-toast')).toContainText('1 task updated');
  await expect(page.locator('.modal-container:visible')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
});

async function openSurface(surface: string) {
  const version = ++surfaceVersion;
  const content = stringify({
    filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
    views: [{ type: surface === 'board' ? 'tasknotesKanban' : surface === 'mini' ? 'tasknotesMiniCalendar' : surface === 'list' ? 'tasknotesTaskList' : 'tasknotesCalendar',
      name: surface, groupBy: { property: 'status', direction: 'ASC' }, columnWidth: 300,
      calendarView: 'listWeek', dateProperty: 'note.scheduled', showTimeblocks: false, showTimeEntries: false,
      order: ['status', 'priority', 'scheduled', 'due', 'tags'] }],
  });
  await page.evaluate(async ({ folder, surface, content, version }) => {
    const app = (window as any).app;
    const path = `${folder}/${surface === 'inline' ? 'Inline.md' : `${surface}-${version}.base`}`;
    const file = app.vault.getAbstractFileByPath(path) || await app.vault.create(path, content);
    await app.workspace.getLeaf(false).openFile(file, surface === 'inline' ? { state: { mode: 'preview' } } : undefined);
  }, { folder, surface, content, version });
  await expect(page.locator(surface === 'mini' ? '.mini-calendar-view__day:visible' : `.workspace-leaf.mod-active .task-card[data-task-path="${taskPath}"]:visible`).first()).toBeVisible();
}

test('compact modal retains long labels and cancelling a picker preserves its draft', async () => {
  const label = 'Waiting for supplier approval and accessibility verification';
  const original = await page.evaluate(async ({ taskPath, label }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const original = JSON.parse(JSON.stringify(plugin.settings.customStatuses));
    const task = await plugin.cacheManager.getTaskInfo(taskPath);
    const status = plugin.settings.customStatuses.find((configuration: any) => configuration.value === task.status);
    status.label = label;
    plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
    return { statuses: original, content: await app.vault.read(app.vault.getAbstractFileByPath(taskPath)) };
  }, { taskPath, label });
  try {
    await setObsidianViewport(page, { width: 400, height: 900 });
    await page.evaluate(() => document.body.classList.add('is-mobile'));
    await openSurface('list');
    await page.locator(`.task-card[data-task-path="${taskPath}"] .task-card__context-menu`).first().click();
    await page.getByText('Edit task', { exact: true }).last().click();
    const modal = page.locator('.modal.mod-tasknotes');
    const chip = modal.locator('[data-type="status"]');
    await expect(chip.locator('.action-icon__label')).toHaveAttribute('title', label);
    await expect(chip).toHaveAttribute('aria-label', new RegExp(label));
    await chip.click();
    await expect(page.getByRole('option', { name: label, exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).toBeVisible();
    await expect(chip).toBeFocused();
    await expect(chip.locator('.action-icon__label')).toHaveText(label);
    await captureState(page, `${output}/400-modal-long-label-focus.png`);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(async taskPath => {
      const app = (window as any).app;
      return app.vault.read(app.vault.getAbstractFileByPath(taskPath));
    }, taskPath)).toBe(original.content);
  } finally {
    await page.evaluate(statuses => {
      const plugin = (window as any).app.plugins.plugins.tasknotes;
      plugin.settings.customStatuses = statuses;
      plugin.statusManager.updateStatuses(statuses);
    }, original.statuses);
  }
});

for (const surface of ['list', 'board']) test(`${surface}: multi-drop names configured destination and count`, async () => {
  await setObsidianViewport(page, { width: 1180, height: 900 });
  const destination = await page.evaluate(() => {
    document.body.classList.remove('is-mobile');
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    const statuses = plugin.settings.customStatuses;
    const destination = statuses.find((status: any) => !status.isCompleted && status.value !== plugin.settings.defaultTaskStatus && status.value !== 'none');
    destination.label = 'In progress — council';
    plugin.statusManager.updateStatuses(statuses);
    return destination.value;
  });
  await openSurface(surface);
  const source = page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${taskPath}"]`);
  await page.evaluate(({ folder, taskPath }) => (window as any).app.plugins.plugins.tasknotes.taskSelectionService.selectAll([taskPath, `${folder}/Selection.md`]), { folder, taskPath });
  const target = surface === 'list' ? page.locator('.task-group-header').filter({ hasText: 'In progress — council' }).first() : page.locator(`.kanban-view__column[data-group="${destination}"] .kanban-view__column-header`);
  await source.scrollIntoViewIfNeeded();
  const sourceBox = (await source.boundingBox())!;
  const targetBox = (await target.boundingBox())!;
  await page.mouse.move(sourceBox.x + 11, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + 25, sourceBox.y + sourceBox.height / 2 + 7, { steps: 5 });
  await page.mouse.move(targetBox.x + 100, targetBox.y + targetBox.height / 2, { steps: 12 });
  await captureState(page, `${output}/${surface}-multi-drop-target.png`);
  await page.mouse.up();
  await expect(page.locator('.tn-toast')).toContainText('Moved 2 tasks to In progress — council');
  await captureState(page, `${output}/${surface}-multi-drop-settle.png`);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.taskSelectionService.clearSelection());
});

for (const theme of ['light', 'dark']) for (const width of [1180, 400]) {
  test(`${theme} ${width}: mobile surfaces, hit areas and recovery`, async () => {
    await resizeForCapture(page, { width, height: 900 });
    await page.evaluate(({ theme, width }) => {
      document.body.classList.remove('theme-light', 'theme-dark', 'is-mobile');
      document.body.classList.add(`theme-${theme}`);
      document.body.classList.toggle('is-mobile', width === 400);
    }, { theme, width });
    const measurements: Record<string, unknown> = {};
    for (const surface of ['list', 'agenda', 'board', 'mini', 'inline']) {
      await openSurface(surface);
      if (surface === 'board') {
        const review = page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${taskPath}"]`);
        await review.scrollIntoViewIfNeeded();
        await expect(review).toBeInViewport({ ratio: 0.9 });
      }
      await captureState(page, `${output}/${theme}-${width}-${surface}.png`);
      const controls = page.locator('.workspace-leaf.mod-active :is(.task-card__status-dot, .task-card__priority-dot, .task-card__metadata-date, .task-card__metadata-overflow, .task-card__context-menu, .mini-calendar-view__day, .kanban-view__column-collapse-button):not(.tasknotes-inline-widget--sentence *):visible');
      const sizes = await controls.evaluateAll(elements => elements.map(element => ({ name: element.className, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })));
      measurements[surface] = sizes;
      if (!baseline) {
        const target = surface === 'mini' ? controls.first() : page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${taskPath}"] .task-card__status-dot:visible`).first();
        await target.hover();
        await captureState(page, `${output}/${theme}-${width}-${surface}-hover.png`);
        await page.mouse.move(1, 1);
        await target.focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        await captureState(page, `${output}/${theme}-${width}-${surface}-focus.png`);
      }
      if (width === 400 && surface === 'list') writeFileSync(`${output}/${theme}-layout.json`, JSON.stringify(await page.locator(`.task-card[data-task-path="${taskPath}"]`).first().evaluate(element => ({ html: element.outerHTML, nodes: [...element.querySelectorAll<HTMLElement>('*')].map(node => { const style = getComputedStyle(node); const box = node.getBoundingClientRect(); return { cls: node.className, box: { x: box.x, y: box.y, width: box.width, height: box.height }, display: style.display, row: style.gridRow, col: style.gridColumn, cols: style.gridTemplateColumns, rows: style.gridTemplateRows }; }) })), null, 2));
      if (!baseline && width === 400) for (const size of sizes) {
        expect(size.width, `${surface}: ${size.name}`).toBeGreaterThanOrEqual(39.5);
        expect(size.height, `${surface}: ${size.name}`).toBeGreaterThanOrEqual(39.5);
      }
      if (!baseline && width === 400 && surface !== 'mini') {
        const overlap = await page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${taskPath}"]:visible`).first().evaluate(card => {
          const controls = [...card.querySelectorAll<HTMLElement>('.task-card__status-dot, .task-card__priority-dot, .task-card__metadata-date, .task-card__context-menu')].filter(element => element.checkVisibility());
          return controls.flatMap((first, index) => controls.slice(index + 1).filter(second => {
            const firstBox = first.getBoundingClientRect();
            const secondBox = second.getBoundingClientRect();
            return Math.min(firstBox.right, secondBox.right) - Math.max(firstBox.left, secondBox.left) > 1 && Math.min(firstBox.bottom, secondBox.bottom) - Math.max(firstBox.top, secondBox.top) > 1;
          }).map(second => `${first.className} overlaps ${second.className}`));
        });
        expect(overlap, surface).toEqual([]);
      }
      if (surface === 'board' && !baseline && width === 400) {
        const navigation = page.locator('.kanban-view__column-nav');
        await expect(navigation).toBeVisible();
        await page.locator('.kanban-view__board').evaluate(element => { element.scrollLeft = 0; });
        await expect(navigation.locator('button').first()).toBeDisabled();
        await captureState(page, `${output}/${theme}-400-board-navigator-disabled.png`);
        await navigation.locator('button').last().click();
        await expect.poll(() => page.locator('.kanban-view__board').evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
      }
    }
    writeFileSync(`${output}/${theme}-${width}-geometry.json`, JSON.stringify(measurements, null, 2));
    await openSurface('list');
    await page.locator(`.task-card[data-task-path="${taskPath}"] .task-card__context-menu`).first().click();
    await page.getByText('Edit task', { exact: true }).last().click();
    await expect(page.locator('.modal.mod-tasknotes')).toBeVisible();
    const labels = page.locator('.modal.mod-tasknotes .action-icon[data-value-state] .action-icon__label');
    for (const label of await labels.all()) {
      if (await label.textContent()) await expect(label).toHaveAttribute('title', (await label.textContent())!);
    }
    await captureState(page, `${output}/${theme}-${width}-modal.png`);
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      const app = (window as any).app;
      app.setting.open();
      app.setting.openTabById('tasknotes');
    });
    let settingsPage: Page | undefined;
    await expect.poll(async () => {
      settingsPage = page.context().pages().find(candidate => candidate !== page);
      return Boolean(settingsPage) || await page.locator('.tasknotes-settings').isVisible();
    }).toBe(true);
    settingsPage ??= page;
    await expect(settingsPage.locator('.tasknotes-settings')).toBeVisible();
    await resizeForCapture(settingsPage, { width, height: 900 });
    await settingsPage.evaluate(({ theme, width }) => {
      document.body.classList.remove('theme-light', 'theme-dark', 'is-mobile');
      document.body.classList.add(`theme-${theme}`);
      document.body.classList.toggle('is-mobile', width === 400);
    }, { theme, width });
    if (width === 400) writeFileSync(`${output}/${theme}-settings-layout.json`, JSON.stringify(await settingsPage.locator('.tasknotes-settings').evaluate(element => {
      const result = []; let node: Element | null = element;
      while (node) { const style = getComputedStyle(node); result.push({ cls: node.className, width: node.getBoundingClientRect().width, padding: style.padding, margin: style.margin, display: style.display }); node = node.parentElement; }
      return result;
    }), null, 2));
    if (!baseline && width === 400) {
      expect(await settingsPage.locator('.tasknotes-settings').evaluate(element => getComputedStyle(element).padding)).toBe('0px');
      expect(await settingsPage.locator('.tasknotes-settings').evaluate(element => element.clientWidth)).toBeGreaterThanOrEqual(160);
    }
    await captureState(settingsPage, `${output}/${theme}-${width}-settings.png`);
    await closeObsidianSettings(page, settingsPage);
  });
}
