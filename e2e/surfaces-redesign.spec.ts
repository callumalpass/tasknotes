import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, openTaskNotesSettings, closeObsidianSettings, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
let originalSettings: Record<string, unknown>;
const folder = `Surfaces-${Date.now()}`;

test.beforeAll(async () => {
  instance = await launchObsidian();
  await setObsidianViewport(instance.page, { width: 1180, height: 800 });
  originalSettings = await instance.page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const leaves: any[] = [];
    app.workspace.iterateAllLeaves((leaf: any) => leaves.push(leaf));
    leaves.forEach(leaf => leaf.detach());
    const original = JSON.parse(JSON.stringify(plugin.settings));
    plugin.settings.customStatuses = [
      { id: 'open', value: 'open', label: 'Waiting for a very long external review', color: 'var(--color-blue)', order: 0, isCompleted: false },
      { id: 'review', value: 'review', label: 'Review', color: 'var(--color-orange)', order: 1, isCompleted: false },
      { id: 'done', value: 'done', label: 'Shipped', color: 'var(--color-green)', order: 2, isCompleted: true, icon: 'rocket' },
    ];
    plugin.settings.customPriorities = [
      { id: 'normal', value: 'normal', label: 'Normal', color: 'var(--text-muted)', weight: 1 },
      { id: 'urgent', value: 'urgent', label: 'Needs an unusually long priority description', color: 'var(--color-red)', weight: 2, icon: 'flame' },
    ];
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
    plugin.priorityManager.updatePriorities(plugin.settings.customPriorities);
    await plugin.saveSettings();
    await app.vault.createFolder(folder);
    for (const [name, status, priority] of [['Review', 'review', 'urgent'], ['Unknown', 'retired', 'unconfigured'], ['Custom', 'done', 'urgent']]) {
      await app.vault.create(`${folder}/${name}.md`, `---\ntitle: ${name}\ntags: [task]\n${plugin.fieldMapper.toUserField('status')}: ${status}\n${plugin.fieldMapper.toUserField('priority')}: ${priority}\n${plugin.fieldMapper.toUserField('due')}: 2026-11-01\nprojects: ["[[Surface project]]"]\n---\n`);
    }
    await app.vault.create(`${folder}/Prose.md`, `# A working note\n\nBefore [[${folder}/Review]] and after.\n\nA missing configuration: [[${folder}/Unknown]].\n\nKeep the cursor here.\n\nA custom icon: [[${folder}/Custom]].\n`);
    (window as any).surfaceTestLeaf = app.workspace.getLeaf(true);
    return original;
  }, folder);
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await instance.page.evaluate(async ({ folder, settings }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      if (plugin.pomodoroService?.getState().isRunning) await plugin.pomodoroService.stopPomodoro();
      app.setting.close();
      Object.assign(plugin.settings, settings);
      plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
      plugin.priorityManager.updatePriorities(plugin.settings.customPriorities);
      await plugin.saveSettings();
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, { folder, settings: originalSettings });
  } finally {
    await closeObsidian(instance);
  }
});

async function openView(type: string) {
  await instance.page.evaluate(async type => {
    const app = (window as any).app;
    app.setting.close();
    await (window as any).surfaceTestLeaf.setViewState({ type, active: true });
    app.workspace.setActiveLeaf((window as any).surfaceTestLeaf, { focus: true });
  }, type);
}

async function appearance(theme: string, mobile: boolean) {
  await setObsidianViewport(instance.page, { width: mobile ? 390 : 1180, height: 800 });
  await instance.page.evaluate(({ theme, mobile }) => {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(theme);
    document.body.classList.toggle('is-mobile', mobile);
    const app = (window as any).app;
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    document.querySelectorAll('.notice').forEach(notice => notice.remove());
  }, { theme, mobile });
}

async function screenshot(name: string, page: Page = instance.page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `test-results/surfaces/${name}.png` });
}

async function expectTouchTargets(selector: string, page: Page = instance.page) {
  const targets = await page.locator(selector).evaluateAll(elements => elements
    .filter(element => (element as HTMLElement).offsetWidth > 0 && (element as HTMLElement).offsetHeight > 0)
    .map(element => ({ label: element.getAttribute('aria-label') || element.textContent?.trim(), height: element.getBoundingClientRect().height })));
  expect(targets.length).toBeGreaterThan(0);
  expect(targets.filter(target => target.height < 40)).toEqual([]);
}

test('timer retains edit, focus, pause, resume and stop without a decorative ring', async () => {
  const page = instance.page;
  await openView('tasknotes-pomodoro-view');
  const display = page.locator('.pomodoro-view__timer-display');
  await expect(display).toBeVisible();
  await expect(page.locator('.pomodoro-view__progress-circle, .pomodoro-view__progress-svg')).toHaveCount(0);
  await display.click();
  await page.locator('.pomodoro-view__timer-input').fill('invalid');
  await page.locator('.pomodoro-view__timer-input').press('Enter');
  await expect(page.locator('.tasknotes-plugin.tn-notice')).toContainText('Enter a duration');
  await display.click();
  await page.locator('.pomodoro-view__timer-input').fill('12:30');
  await page.locator('.pomodoro-view__timer-input').press('Enter');
  await expect(display).toHaveText('12:30');
  await page.locator('.pomodoro-view__start-button').click();
  await expect(page.locator('.pomodoro-view__pause-button')).toBeVisible();
  await page.locator('.pomodoro-view__pause-button').click();
  await expect(page.locator('.pomodoro-view__start-button')).toContainText('Resume');
  await page.locator('.pomodoro-view__start-button').click();
  await page.locator('.pomodoro-view__stop-button').click();
  for (const theme of ['theme-light', 'theme-dark']) {
    for (const mobile of [false, true]) {
      await appearance(theme, mobile);
      if (mobile) await expectTouchTargets('.pomodoro-view button, .pomodoro-view__timer-display');
      await screenshot(`timer-${theme}-${mobile ? 'mobile' : 'desktop'}`);
    }
  }
});

test('typographic reports, release notes and all settings tabs in both themes and mobile', async () => {
  test.setTimeout(120000);
  const page = instance.page;
  for (const theme of ['theme-light', 'theme-dark']) {
    for (const mobile of [false, true]) {
      await appearance(theme, mobile);
      for (const [type, root] of [['tasknotes-stats-view', '.stats-view'], ['tasknotes-pomodoro-stats-view', '.pomodoro-stats-view'], ['tasknotes-release-notes', '.tasknotes-release-notes-view']]) {
        await openView(type);
        await expect(page.locator(root)).toBeVisible();
        await expect(page.locator(`${root} .stats-view__progress-circle`)).toHaveCount(0);
        if (type === 'tasknotes-stats-view') {
          await expect(page.locator('.stats-view__overview-card').first()).toBeVisible();
          expect(await page.locator('.stats-view__overview-grid').evaluate(element => getComputedStyle(element).display)).toBe('flex');
        }
        if (type === 'tasknotes-release-notes') {
          const header = page.locator('.release-notes-version-header').nth(1);
          await header.click();
          await expect(page.locator('.release-notes-version-content').nth(1)).toBeVisible();
          await header.click();
          await expect(page.locator('.release-notes-version-content').nth(1)).toBeHidden();
        }
        if (mobile && type !== 'tasknotes-release-notes') await expectTouchTargets(`${root} button, ${root} select, ${root} input`);
        await screenshot(`${type}-${theme}-${mobile ? 'mobile' : 'desktop'}`);
      }
      const settingsPage = await openTaskNotesSettings(page);
      try {
        await settingsPage.setViewportSize({ width: mobile ? 640 : 1180, height: 800 });
        await settingsPage.evaluate(({ theme, mobile }) => {
          document.body.classList.remove('theme-light', 'theme-dark');
          document.body.classList.add(theme);
          document.body.classList.toggle('is-mobile', mobile);
        }, { theme, mobile });
        const tabs = settingsPage.locator('.settings-view__tab-button');
        await expect(tabs).toHaveCount(6);
        for (let index = 0; index < 6; index++) {
          await tabs.nth(index).click();
          await expect(tabs.nth(index)).toHaveAttribute('aria-selected', 'true');
          await screenshot(`settings-${index}-${theme}-${mobile ? 'mobile' : 'desktop'}`, settingsPage);
        }
        await settingsPage.locator('#tab-button-task-properties').click();
        await expect(settingsPage.locator('.tasknotes-settings__value-glyph .tn-glyph').first()).toBeAttached();
        await expect(settingsPage.locator('.tasknotes-settings__value-glyph .lucide-rocket')).toBeAttached();
        await expect(settingsPage.locator('.tasknotes-settings__value-glyph .lucide-flame')).toBeAttached();
        for (const property of ['status', 'priority']) {
          const card = settingsPage.locator(`[data-card-id="property-${property}"]`);
          if (await card.evaluate(element => element.classList.contains('tasknotes-settings__card--collapsed'))) await card.locator(':scope > .tasknotes-settings__card-header').click();
          await expect(card.locator('.tasknotes-settings__value-glyph').first()).toBeVisible();
          await card.locator('.tasknotes-settings__value-glyph').first().evaluate(element => element.scrollIntoView({ block: 'center' }));
          await screenshot(`settings-${property}-${theme}-${mobile ? 'mobile' : 'desktop'}`, settingsPage);
        }
        if (mobile) await expectTouchTargets('.settings-view__tab-button, .tasknotes-settings__card-input, .checkbox-container, .tasknotes-settings__card-header button', settingsPage);
      } finally {
        await closeObsidianSettings(page, settingsPage);
      }
    }
  }
});

test('inline task glyphs, dates and unknown values sit in reading and live-preview prose', async () => {
  const page = instance.page;
  for (const theme of ['theme-light', 'theme-dark']) {
    for (const mobile of [false, true]) {
      await appearance(theme, mobile);
      for (const mode of ['preview', 'source']) {
        await page.evaluate(async ({ path, mode }) => {
          const app = (window as any).app;
          await (window as any).surfaceTestLeaf.openFile(app.vault.getAbstractFileByPath(path), { state: { mode, source: false } });
          app.workspace.setActiveLeaf((window as any).surfaceTestLeaf, { focus: true });
          const view = app.workspace.activeLeaf.view;
          if (view.editor) view.editor.setCursor({ line: 6, ch: 0 });
        }, { path: `${folder}/Prose.md`, mode });
        const cards = page.locator('.task-card--layout-inline:visible');
        await expect(cards).toHaveCount(3);
        await expect(cards.first().locator('.tn-glyph').first()).toBeVisible();
        expect(await cards.first().locator('.tn-glyph').first().evaluate(element => element.getBoundingClientRect().width)).toBe(16);
        await expect(cards.first().locator('.task-card__priority-dot .lucide-flame')).toBeAttached();
        await expect(cards.nth(2).locator('.task-card__status-dot .lucide-rocket')).toBeAttached();
        await expect(cards.nth(1).locator('[data-tn-glyph="unknown"]').first()).toBeAttached();
        await expect(cards.first().locator('.task-card__metadata-date--overdue')).toBeAttached();
        if (mobile) await expectTouchTargets('.task-card--layout-inline .task-card__status-dot, .task-card--layout-inline .task-card__priority-dot, .task-card--layout-inline .task-card__metadata-date, .task-card--layout-inline .task-card__context-menu');
        await screenshot(`inline-${mode}-${theme}-${mobile ? 'mobile' : 'desktop'}`);
      }
    }
  }
});
