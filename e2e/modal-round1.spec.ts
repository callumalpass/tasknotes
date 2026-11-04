import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';
import { mkdirSync, writeFileSync } from 'node:fs';

let instance: ObsidianApp;
let page: Page;
const run = `ModalR1-${Date.now()}`;
const taskPath = `${run}/Review.md`;
const cssTheme = process.env.TASKNOTES_E2E_MODAL_THEME || '';

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await page.evaluate(async theme => {
    await (window as any).app.customCss.setTheme(theme);
  }, cssTheme);
  await expect.poll(() => page.evaluate(() => (window as any).app.vault.getConfig('cssTheme') || '')).toBe(cssTheme);
  await page.evaluate(async ({ run, taskPath }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    plugin.settings.enableModalSplitLayout = false;
    await app.vault.createFolder(run);
    await app.vault.create(taskPath, `---\ntags: [task]\ntitle: Review the launch plan\nstatus: ${plugin.settings.defaultTaskStatus}\npriority: ${plugin.settings.defaultTaskPriority}\nprojects: ["[[${run}/Project]]"]\n---\n\nPreserve keyboard access, draft recovery, and every configured field.\n`);
    await app.vault.create(`${run}/Project.md`, '# Launch project');
  }, { run, taskPath });
  await expect.poll(() => page.evaluate(async taskPath => Boolean(await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(taskPath)), taskPath)).toBe(true);
});

test.afterAll(async () => {
  try {
    if (page) await page.evaluate(async run => {
      const app = (window as any).app;
      for (const file of app.vault.getMarkdownFiles()) {
        if (file.basename.startsWith(run)) await app.vault.delete(file, true);
      }
      const folder = app.vault.getAbstractFileByPath(run);
      if (folder) await app.vault.delete(folder, true);
    }, run);
  } finally { if (instance) await closeObsidian(instance); }
});

test('modified Enter saves from a chip after Escape without leaking the composer', async () => {
  await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.openTaskCreationModal());
  const modal = page.locator('.modal.mod-tasknotes');
  await modal.locator('.tn-task-modal__markdown-editor--nlp .cm-content').fill(`${run} shortcut regression`);
  const status = modal.locator('[data-type="status"]');
  await status.click();
  await expect(page.locator('.tn-popover')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(status).toBeFocused();
  await page.keyboard.press('Control+Enter');
  await expect(modal).toHaveCount(0);
  await expect(page.locator('.tn-popover')).toHaveCount(0);
  await page.evaluate(async taskPath => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    await plugin.openTaskEditModal(await plugin.cacheManager.getTaskInfo(taskPath));
  }, taskPath);
  await expect(modal).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal-container')).toHaveCount(0);
});

for (const mode of ['create', 'edit']) {
  test(`${mode}: Ctrl and Cmd Enter submit from every property chip and footer control`, async () => {
    const controls = ['[data-type="status"]', '[data-type="priority"]', '[data-type="due-date"]', '[data-type="scheduled-date"]', '[data-type="recurrence"]', '[data-type="reminders"]', '.tn-task-modal__details-toggle', '.mod-cta', '.tn-task-modal__button-bar button:text-is("Cancel")', ...(mode === 'edit' ? ['.tn-task-modal__open-note-button', '.tn-task-modal__overflow-button', '.task-project-remove'] : ['.tn-modal__create-more input'])];
    for (const selector of controls) {
      for (const modifier of ['Control', 'Meta']) {
        await page.evaluate(async ({ mode, taskPath }) => {
          const plugin = (window as any).app.plugins.plugins.tasknotes;
          if (mode === 'create') plugin.openTaskCreationModal();
          else await plugin.openTaskEditModal(await plugin.cacheManager.getTaskInfo(taskPath));
        }, { mode, taskPath });
        const modal = page.locator('.modal.mod-tasknotes');
        if (mode === 'create') await modal.locator('.tn-task-modal__markdown-editor--nlp .cm-content').fill(`${run} ${modifier} ${selector}`);
        await modal.locator(selector).first().focus();
        await page.keyboard.press(`${modifier}+Enter`);
        await expect(modal).toHaveCount(0);
        await expect(page.locator('.modal-container, .tn-popover, .menu')).toHaveCount(0);
      }
    }
  });
}

async function capture(name: string, width: number, height: number) {
  if (cssTheme) name += `-${cssTheme.toLowerCase().replaceAll(' ', '-')}`;
  expect(await page.evaluate(() => [innerWidth, innerHeight])).toEqual([width, height]);
  const session = await page.context().newCDPSession(page);
  const { data } = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, clip: { x: 0, y: 0, width, height, scale: 1 } });
  mkdirSync('test-results/modal-round1', { recursive: true });
  writeFileSync(`test-results/modal-round1/${name}.png`, Buffer.from(data, 'base64'));
  writeFileSync(`test-results/modal-round1/${name}.json`, JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.modal-content, .minimalist-modal-container, .modal-split-content, .modal-split-left, .modal-split-right, .tn-task-modal__markdown-editor--details, .cm-editor, .cm-scroller, .cm-content, .tn-task-modal__action-bar, .task-projects-list, .metadata-container, .tn-task-modal__button-bar')].map(element => ({ cls: element.className, bounds: element.getBoundingClientRect().toJSON(), minHeight: getComputedStyle(element).minHeight, height: getComputedStyle(element).height, padding: getComputedStyle(element).padding, margin: getComputedStyle(element).margin }))), null, 2));
  await session.detach();
}

for (const mobile of [false, true]) {
  for (const theme of ['light', 'dark']) {
    test(`${theme} ${mobile ? 'mobile' : 'desktop'}: shared shell, caret, disclosure and recurrence`, async () => {
      const width = mobile ? 390 : 1180;
      const height = 800;
      await setObsidianViewport(page, { width, height });
      await page.evaluate(({ theme, mobile }) => {
        document.body.classList.remove('theme-light', 'theme-dark', 'is-mobile');
        document.body.classList.add(`theme-${theme}`);
        document.body.classList.toggle('is-mobile', mobile);
        document.querySelectorAll('.notice-container').forEach(element => element.remove());
        (window as any).app.plugins.plugins.tasknotes.openTaskCreationModal();
      }, { theme, mobile });
      const composer = page.locator('.modal.mod-tasknotes');
      await expect(composer.getByRole('button', { name: 'Show detailed options' })).toContainText('More fields');
      await expect(composer.locator('.tn-task-modal__markdown-editor--nlp .cm-content')).toHaveText('Buy groceries tomorrow at 3pm @home #errands');
      await expect(composer.locator('.tn-nlp-highlight')).toHaveCount(0);
      await capture(`create-${theme}-${mobile ? 'mobile' : 'desktop'}`, width, height);
      await composer.getByRole('button', { name: 'Show detailed options' }).click();
      await expect(composer.getByRole('button', { name: 'Hide detailed options' })).toHaveAttribute('aria-expanded', 'true');
      await expect(composer.locator('.details-container')).toBeVisible();
      await capture(`create-expanded-${theme}-${mobile ? 'mobile' : 'desktop'}`, width, height);
      await page.keyboard.press('Escape');
      await expect(composer).toHaveCount(0);
      await page.evaluate(async taskPath => {
        const plugin = (window as any).app.plugins.plugins.tasknotes;
        await plugin.openTaskEditModal(await plugin.cacheManager.getTaskInfo(taskPath));
      }, taskPath);
      await expect(composer.locator('.title-input')).toHaveValue('Review the launch plan');
      await expect.poll(() => composer.locator('.title-input').evaluate((input: HTMLTextAreaElement) => [input.selectionStart, input.selectionEnd])).toEqual([22, 22]);
      const dimensions = await composer.evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth }));
      expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
      if (mobile) {
        await expect(composer.locator('.mod-cta .tn-key-hint')).toBeHidden();
        const footer = await composer.locator('.tn-task-modal__button-bar').boundingBox();
        expect(footer!.height).toBeLessThan(70);
      }
      await capture(`edit-${theme}-${mobile ? 'mobile' : 'desktop'}`, width, height);
      await composer.getByRole('button', { name: 'Show detailed options' }).click();
      expect(await composer.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await capture(`edit-expanded-${theme}-${mobile ? 'mobile' : 'desktop'}`, width, height);
      await composer.locator('[data-type="recurrence"]').click();
      await page.getByText('Custom recurrence...', { exact: true }).click();
      const recurrence = page.locator('.tn-recurrence-modal');
      await expect(recurrence).toBeVisible();
      expect(await recurrence.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      if (mobile) expect((await recurrence.locator('.modal-button-container').boundingBox())!.height).toBeLessThan(70);
      await expect(recurrence.locator('details')).not.toHaveAttribute('open', '');
      await capture(`recurrence-${theme}-${mobile ? 'mobile' : 'desktop'}`, width, height);
      await recurrence.locator('summary').click();
      await expect(recurrence.locator('input[type="time"]')).toBeVisible();
      await recurrence.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.keyboard.press('Escape');
      await expect(page.locator('.modal-container')).toHaveCount(0);
    });
  }
}

test('recurrence disclosure preserves frequency rules, anchor, start time and ending', async () => {
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await page.evaluate(async taskPath => {
    document.body.classList.remove('is-mobile');
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    await plugin.openTaskEditModal(await plugin.cacheManager.getTaskInfo(taskPath));
  }, taskPath);
  const composer = page.locator('.modal.mod-tasknotes');
  await composer.locator('[data-type="recurrence"]').click();
  await page.getByText('Custom recurrence...', { exact: true }).click();
  const recurrence = page.locator('.tn-recurrence-modal');
  const frequency = recurrence.locator('.setting-item').filter({ has: page.getByText('Frequency', { exact: true }) }).locator('select:not(.is-measuring)');
  for (const value of ['MONTHLY', 'YEARLY', 'WEEKLY']) {
    await frequency.selectOption(value);
    await expect(recurrence.locator('.setting-item').filter({ has: page.getByText(value === 'MONTHLY' ? 'Monthly recurrence' : value === 'YEARLY' ? 'Yearly recurrence' : 'Days of week', { exact: true }) })).toBeVisible();
  }
  await recurrence.locator('.setting-item').filter({ has: page.getByText('Interval', { exact: true }) }).locator('input').fill('2');
  await recurrence.locator('.days-container input').first().check();
  await recurrence.locator('summary').click();
  await recurrence.locator('details input[type="time"]').fill('09:30:00');
  await recurrence.locator('details input[type="number"]').fill('3');
  await recurrence.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(recurrence).toHaveCount(0);
  await expect(composer).toHaveCount(1);
  await composer.locator('.mod-cta').click();
  await expect(page.locator('.modal-container')).toHaveCount(0);
  await expect.poll(() => page.evaluate(async taskPath => (await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(taskPath)).recurrence, taskPath)).toContain('COUNT=3');
  const saved = await page.evaluate(async taskPath => (await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(taskPath)).recurrence, taskPath);
  expect(saved).toContain('FREQ=WEEKLY');
  expect(saved).toContain('INTERVAL=2');
  expect(saved).toContain('T093000');
});
