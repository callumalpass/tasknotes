import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchObsidian, closeObsidian, setObsidianViewport, openTaskNotesSettings, closeObsidianSettings } from './obsidian';

const phase = process.env.TASKNOTES_R7_PHASE ?? 'after';
const evidence = `/tmp/tasknotes-r7/sec2/${phase}`;

test('sec2: expanded composer, exposed settings, metric hierarchy and timer states', async () => {
  test.setTimeout(300000);
  mkdirSync(evidence, { recursive: true });
  const instance = await launchObsidian();
  const page = instance.page;
  page.setDefaultTimeout(10000);
  const folder = `Sec2-${Date.now()}`;
  const measurements: Record<string, unknown> = {};
  const appearance = async (target: Page, width: number, theme: string) => {
    await target.evaluate(({ width, theme }) => {
      const native = (window as any).require('electron').remote.getCurrentWindow();
      native.setMinimumSize(320, 500);
      if (native.isMaximized()) native.unmaximize();
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(`theme-${theme}`);
      document.body.classList.toggle('is-mobile', width === 400);
    }, { width, theme });
    await setObsidianViewport(target, { width, height: 800 });
    await expect.poll(() => target.evaluate(() => [innerWidth, innerHeight])).toEqual([width, 800]);
  };
  const capture = async (target: Page, name: string) => {
    await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await target.screenshot({ path: `${evidence}/${name}.png` });
  };
  const original = await page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const settings = JSON.parse(JSON.stringify(plugin.settings));
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    plugin.settings.enableModalSplitLayout = false;
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    await app.vault.createFolder(folder);
    await app.vault.create(`${folder}/Review.md`, `---\ntags: [task, release, planning]\ntitle: Review the delivery plan with accessibility and localization reviewers\nstatus: open\npriority: normal\ncontexts: [work, planning]\nprojects: [Release]\ntimeEstimate: 90\n---\nReview the complete release checklist.\n`);
    (window as any).sec2Leaf = app.workspace.getLeaf(true);
    return settings;
  }, folder);
  try {
    await expect.poll(() => page.evaluate(async folder => !!await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(`${folder}/Review.md`), folder)).toBe(true);
    const warning = page.locator('.notice').filter({ hasText: 'Secrets are stored without encryption' });
    if (await warning.isVisible()) await warning.getByText("Don't show again", { exact: true }).click();
    for (const theme of ['light', 'dark']) for (const width of [1180, 720, 400]) {
      const variant = `${theme}-${width}`;
      await appearance(page, width, theme);
      await page.evaluate(async folder => {
        const plugin = (window as any).app.plugins.plugins.tasknotes;
        plugin.openTaskEditModal(await plugin.cacheManager.getTaskInfo(`${folder}/Review.md`));
      }, folder);
      const modal = page.locator('.minimalist-task-modal');
      await modal.locator('.tn-task-modal__details-toggle').click();
      await expect(modal.locator('.details-container')).toBeVisible();
      await capture(page, `expanded-modal-${variant}`);
      measurements[`modal-${variant}`] = await modal.locator('.details-container').evaluate(element => ({
        width: element.clientWidth, scroll: element.scrollWidth,
        fields: [...element.querySelectorAll('.setting-item')].map(row => ({ text: row.querySelector('.setting-item-name')?.textContent, display: getComputedStyle(row).display, bounds: row.getBoundingClientRect().toJSON() })),
      }));
      if (phase !== 'before') {
        const fields = await modal.locator('.details-container .setting-item').evaluateAll(elements => elements.map(element => ({
          control: element.querySelector('.setting-item-control')!.getBoundingClientRect().toJSON(),
          label: element.querySelector('.setting-item-name')!.getBoundingClientRect().toJSON(),
        })));
        const left = fields[0].control.x;
        for (const field of fields) expect(Math.abs(field.control.x - left)).toBeLessThan(1);
        if (width === 400) for (const field of fields) expect(field.control.y).toBeGreaterThan(field.label.y);
      }
      await page.keyboard.press('Escape');
      const settings = await openTaskNotesSettings(page, 'Task properties');
      try {
        await appearance(settings, width, theme);
        const status = settings.locator('[data-card-id="property-status"]');
        await capture(settings, `settings-default-${variant}`);
        measurements[`settings-${variant}`] = await status.evaluate(element => ({ collapsed: element.classList.contains('tasknotes-settings__card--collapsed'), nested: element.querySelectorAll('.tasknotes-settings__card--draggable').length }));
        if (phase !== 'before') {
          await expect(status).not.toHaveClass(/tasknotes-settings__card--collapsed/);
          const values = status.locator('.tasknotes-settings__collapsible-section-header');
          await values.focus();
          await settings.keyboard.press('Space');
          await expect(values).toHaveAttribute('aria-expanded', 'false');
          await expect(status.locator('.tasknotes-settings__collapsible-section-content')).toBeHidden();
          await settings.keyboard.press('Enter');
          await expect(values).toHaveAttribute('aria-expanded', 'true');
          const first = status.locator('.tasknotes-settings__card--draggable').first();
          const disclosure = first.locator(':scope > .tasknotes-settings__card-header button').first();
          await disclosure.focus();
          await settings.keyboard.press('Space');
          await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
          await settings.keyboard.press('Enter');
          await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
          await capture(settings, `settings-focused-${variant}`);
        }
      } finally { await closeObsidianSettings(page, settings); }
      for (const [type, selector] of [['tasknotes-stats-view', '.stats-view'], ['tasknotes-pomodoro-stats-view', '.pomodoro-stats-view'], ['tasknotes-pomodoro-view', '.pomodoro-view']]) {
        await page.evaluate(async type => {
          await (window as any).sec2Leaf.setViewState({ type, active: true });
          (window as any).app.workspace.setActiveLeaf((window as any).sec2Leaf, { focus: true });
        }, type);
        const view = page.locator(`.workspace-leaf.mod-active ${selector}`);
        await expect(view).toBeVisible();
        await capture(page, `${type}-${variant}`);
        if (type === 'tasknotes-pomodoro-view') {
          measurements[`timer-${variant}`] = await view.evaluate(element => ({
            timer: element.querySelector('.pomodoro-view__timer-display')!.getBoundingClientRect().toJSON(),
            controls: element.querySelector('.pomodoro-view__primary-controls')!.getBoundingClientRect().toJSON(),
          }));
          if (phase !== 'before') {
            const start = view.locator('.pomodoro-view__start-button');
            await start.focus();
            await capture(page, `timer-focus-${variant}`);
            await page.keyboard.press('Enter');
            const pause = view.locator('.pomodoro-view__pause-button');
            await expect(pause).toBeVisible();
            await pause.click();
            await capture(page, `timer-paused-${variant}`);
            await view.locator('.pomodoro-view__stop-button').click();
            await expect(start).toBeVisible();
            const pausedNotice = page.locator('.notice').filter({ hasText: 'Pomodoro paused' });
            if (await pausedNotice.isVisible()) await pausedNotice.click();
            const buttons = await view.locator('button:visible').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().toJSON()));
            for (const button of buttons) {
              expect(button.height).toBeGreaterThanOrEqual(40);
              expect(button.width).toBeGreaterThanOrEqual(40);
            }
            await view.locator('.pomodoro-view__task-select-button').click();
            const prompt = page.locator('.prompt.tn-modal');
            await prompt.locator('input').first().fill('Review the delivery plan');
            const option = prompt.locator('.suggestion-item').filter({ hasText: 'Review the delivery plan' }).first();
            await expect(option).toBeVisible();
            await capture(page, `prompt-picker-${variant}`);
            expect(await option.evaluate(element => getComputedStyle(element).paddingInlineStart)).toBe('0px');
            await page.keyboard.press('Escape');
          }
        } else {
          const metrics = view.locator('.tn-metrics').first();
          measurements[`${type}-${variant}`] = await metrics.evaluate(element => ({ columns: getComputedStyle(element).gridTemplateColumns, values: [...element.querySelectorAll('[class$="__overview-value"]')].map(value => ({ size: getComputedStyle(value).fontSize, text: value.textContent })) }));
          if (phase !== 'before' && type === 'tasknotes-stats-view') {
            const sizes = await metrics.locator('.stats-view__overview-value').evaluateAll(elements => elements.map(element => parseFloat(getComputedStyle(element).fontSize)));
            expect(sizes[0]).toBeGreaterThan(sizes[1]);
          }
        }
      }
    }
  } finally {
    writeFileSync(`${evidence}/measurements.json`, JSON.stringify(measurements, null, 2));
    try {
      await page.evaluate(async ({ folder, original }) => {
        const app = (window as any).app;
        Object.assign(app.plugins.plugins.tasknotes.settings, original);
        await app.plugins.plugins.tasknotes.saveSettings();
        (window as any).sec2Leaf?.detach();
        const directory = app.vault.getAbstractFileByPath(folder);
        if (directory) await app.vault.delete(directory, true);
      }, { folder, original });
    } finally { await closeObsidian(instance); }
  }
});

test('sec2: date feedback keeps localized counts, a separate Undo action and persisted receipts', async () => {
  test.setTimeout(180000);
  const instance = await launchObsidian();
  const page = instance.page;
  const folder = `Sec2Feedback-${Date.now()}`;
  mkdirSync(evidence, { recursive: true });
  const original = await page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const settings = JSON.parse(JSON.stringify(plugin.settings));
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    await app.vault.createFolder(folder);
    for (const name of ['Alpha', 'Bravo']) await app.vault.create(`${folder}/${name}.md`, `---\ntags: [task]\ntitle: ${name}\nstatus: open\npriority: normal\n---\nPreserve this note.\n`);
    await app.vault.create(`${folder}/List.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\nviews:\n  - type: tasknotesTaskList\n    name: Feedback\n    order: [status, priority, due, scheduled]\n`);
    const leaf = app.workspace.getLeaf(true);
    (window as any).sec2FeedbackLeaf = leaf;
    await leaf.openFile(app.vault.getAbstractFileByPath(`${folder}/List.base`));
    app.workspace.setActiveLeaf(leaf, { focus: true });
    return settings;
  }, folder);
  try {
    await expect(page.locator('.task-card')).toHaveCount(2);
    const readDates = () => page.evaluate(async folder => {
      const app = (window as any).app;
      return Promise.all(['Alpha', 'Bravo'].map(async name => {
        const content = await app.vault.adapter.read(`${folder}/${name}.md`);
        return { content, due: /\ndue: (.+)/.exec(content)?.[1] };
      }));
    }, folder);
    for (const theme of ['light', 'dark']) for (const width of [1180, 400]) {
      await page.evaluate(({ theme, width }) => {
        const native = (window as any).require('electron').remote.getCurrentWindow();
        native.setMinimumSize(320, 500);
        if (native.isMaximized()) native.unmaximize();
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${theme}`);
        document.body.classList.toggle('is-mobile', width === 400);
      }, { theme, width });
      await setObsidianViewport(page, { width, height: 800 });
      await page.locator('.tn-tasknotesTaskList').focus();
      await page.keyboard.press('Escape');
      await page.keyboard.press('j');
      await page.keyboard.press('d');
      const picker = page.locator('.tn-picker');
      await expect(picker).toBeVisible();
      const insets = await picker.locator('.tn-picker__row').first().evaluate(element => ({ row: getComputedStyle(element).paddingInlineStart, gutter: getComputedStyle(element.querySelector('.tn-picker__leading')!).width }));
      expect(insets).toEqual({ row: '8px', gutter: '16px' });
      await page.screenshot({ path: `${evidence}/anchored-picker-${theme}-${width}.png` });
      await picker.locator('.tn-picker__input').fill('tomorrow at 9am');
      await page.keyboard.press('Enter');
      await expect(page.locator('.tn-toast__message')).toHaveText(/^1 task updated: Due date → Tomorrow /);
      await expect(page.locator('.tn-toast__message')).not.toContainText(/\d{4}-\d{2}-\d{2}/);
      await expect.poll(async () => (await readDates()).filter(task => !!task.due).length).toBe(1);
      await page.screenshot({ path: `${evidence}/date-toast-${theme}-${width}.png` });
      const action = page.locator('.tn-toast__actions .tn-toast__action');
      await expect(action).toHaveText('Undo');
      await action.focus();
      await page.keyboard.press('Enter');
      await expect.poll(async () => (await readDates()).filter(task => !!task.due).length).toBe(0);
      await page.locator('.tn-tasknotesTaskList').focus();
      await page.keyboard.press('x');
      await page.keyboard.press('j');
      await page.keyboard.press('x');
      await page.keyboard.press('d');
      await picker.getByText('Tomorrow', { exact: true }).click();
      await expect(page.locator('.tn-toast__message')).toHaveText(/^2 tasks updated: Due date → Tomorrow/);
      await expect(page.locator('.tn-toast')).toHaveCount(1);
      await expect.poll(async () => (await readDates()).filter(task => !!task.due).length).toBe(2);
      await page.locator('.tn-toast__actions .tn-toast__action').click();
      await expect.poll(async () => (await readDates()).filter(task => !!task.due).length).toBe(0);
      for (const task of await readDates()) expect(task.content).toContain('Preserve this note.');
      await page.keyboard.press('Escape');
    }
  } finally {
    try {
      await page.evaluate(async ({ folder, original }) => {
        const app = (window as any).app;
        Object.assign(app.plugins.plugins.tasknotes.settings, original);
        await app.plugins.plugins.tasknotes.saveSettings();
        (window as any).sec2FeedbackLeaf?.detach();
        const directory = app.vault.getAbstractFileByPath(folder);
        if (directory) await app.vault.delete(directory, true);
      }, { folder, original });
    } finally { await closeObsidian(instance); }
  }
});
