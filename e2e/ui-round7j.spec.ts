import { test, expect, type Locator, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

const phase = process.env.TASKNOTES_R7_PHASE ?? 'after';
const evidence = `/tmp/tasknotes-r7/jui/${phase}`;
const folder = `UIRound7J-${Date.now()}`;
let instance: ObsidianApp;
let page: Page;
const measurements: Record<string, unknown> = {};

async function capture(name: string) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const session = await page.context().newCDPSession(page);
  const image = await session.send('Page.captureScreenshot');
  writeFileSync(`${evidence}/${name}.png`, Buffer.from(image.data, 'base64'));
  await session.detach();
}

async function resize(width: number, theme: string, mobile = false) {
  await page.evaluate(({ theme, mobile }) => {
    const nativeWindow = (window as any).require('electron').remote.getCurrentWindow();
    nativeWindow.setMinimumSize(320, 500);
    if (nativeWindow.isMaximized()) nativeWindow.unmaximize();
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme}`);
    document.body.classList.toggle('is-mobile', mobile);
  }, { theme, mobile });
  await setObsidianViewport(page, { width, height: 800 });
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(width);
}

async function open(name: string) {
  await page.evaluate(async ({ folder, name }) => {
    const app = (window as any).app;
    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(app.vault.getAbstractFileByPath(`${folder}/${name}`));
    if (name.endsWith('.md')) await leaf.setViewState({ type: 'markdown', state: { file: `${folder}/${name}`, mode: 'preview' } });
  }, { folder, name });
  await expect(page.locator('.workspace-leaf.mod-active .task-card:visible').first()).toBeVisible();
}

test.beforeAll(async () => {
  mkdirSync(evidence, { recursive: true });
  instance = await launchObsidian();
  page = instance.page;
  await page.evaluate(async ({ folder, bases }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    plugin.settings.enableTaskLinkOverlay = true;
    plugin.settings.inlineVisibleProperties = ['status', 'priority', 'due', 'scheduled', 'recurrence', 'contexts', 'projects'];
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    await app.vault.createFolder(folder);
    for (let index = 0; index < 12; index++) {
      const properties = index === 1 ? '' : 'priority: high\nscheduled: 2026-11-07T09:00\ndue: 2026-11-08T15:30\ncontexts: [studio, focus]\n';
      await app.vault.create(`${folder}/Task ${index}.md`, `---\ntitle: ${index === 0 ? 'Review the release' : index === 1 ? 'No metadata' : index === 2 ? 'Review the implementation with the delivery team before the final accessibility and release-readiness check' : `Task ${index}`}\nstatus: ${index < 8 ? 'open' : 'in-progress'}\ntags: [task]\n${properties}---\n`);
    }
    await app.vault.create(`${folder}/Inline.md`, `# Inline baseline\n\n- [ ] A plain checkbox control\n- [ ] [[${folder}/Task 0]]\n- [ ] [[${folder}/Task 1]]\n- [ ] [[${folder}/Task 2]]\n- [[${folder}/Task 0]]\n\nBefore [[${folder}/Task 0]] and after.\n\n[[${folder}/Task 0]]\n`);
    for (const [name, content] of Object.entries(bases)) await app.vault.create(`${folder}/${name}`, content);
  }, { folder, bases: Object.fromEntries(['List', 'Board'].map(name => [`${name}.base`, stringify({
    filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
    views: [{ type: name === 'List' ? 'tasknotesTaskList' : 'tasknotesKanban', name,
      groupBy: { property: 'status', direction: 'ASC' },
      order: ['status', 'priority', 'scheduled', 'due', 'contexts'],
      sort: [{ property: 'tasknotes_manual_order', direction: 'DESC' }] }],
  })])) });
  const warning = page.locator('.notice').filter({ hasText: 'Secrets are stored without encryption' });
  if (await warning.isVisible()) await warning.getByText("Don't show again", { exact: true }).click();
});

test.afterAll(async () => {
  writeFileSync(`${evidence}/measurements.json`, JSON.stringify(measurements, null, 2));
  if (instance) await closeObsidian(instance);
});

test('reading widgets keep Markdown checkbox and title together', async () => {
  test.setTimeout(120000);
  for (const theme of ['light', 'dark']) for (const [width, mobile] of [[1180, false], [650, false], [400, false], [400, true]] as const) {
    await resize(width, theme, mobile);
    await open('Inline.md');
    const items = page.locator('.workspace-leaf.mod-active .markdown-preview-view:visible li.task-list-item');
    await expect(items).toHaveCount(4);
    await expect(items.nth(1).locator('.task-card__title-text')).toBeVisible();
    const geometry = await items.evaluateAll(elements => elements.map(element => {
      const checkbox = element.querySelector('input')!.getBoundingClientRect();
      const title = element.querySelector('.task-card__title-text')?.getBoundingClientRect();
      const wrapper = element.querySelector('.tasknotes-inline-widget');
      return { checkbox: checkbox.toJSON(), title: title?.toJSON(), height: element.getBoundingClientRect().height,
        display: wrapper ? getComputedStyle(wrapper).display : null };
    }));
    measurements[`inline-${theme}-${width}-${mobile}`] = geometry;
    await capture(`inline-${theme}-${width}-${mobile ? 'mobile' : 'pane'}`);
    if (phase === 'before') continue;
    for (const item of geometry.slice(1)) {
      expect(item.checkbox.top).toBeLessThan(item.title!.bottom);
      expect(item.checkbox.bottom).toBeGreaterThan(item.title!.top);
    }
    const widget = items.nth(1).locator('.tasknotes-inline-widget');
    await widget.locator('.task-card__context-menu').focus();
    await capture(`inline-focus-${theme}-${width}-${mobile ? 'mobile' : 'pane'}`);
    await widget.locator('.task-card__context-menu').press('Enter');
    await expect(page.locator('.menu')).toBeVisible();
    await page.keyboard.press('Escape');
  }
});

test('narrow composer fits property captions and retains its footer', async () => {
  test.setTimeout(120000);
  for (const theme of ['light', 'dark']) for (const [width, mobile] of [[1180, false], [650, false], [400, false], [400, true]] as const) {
    await resize(width, theme, mobile);
    await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.openTaskCreationModal());
    const modal = page.locator('.modal.mod-tasknotes');
    await expect(modal).toBeVisible();
    await modal.locator('.tn-task-modal__details-toggle').click();
    const geometry = await modal.locator('.tn-task-modal__action-bar').evaluate(element => ({
      box: element.getBoundingClientRect().toJSON(),
      buttons: Array.from(element.querySelectorAll('.action-icon')).map(button => ({
        text: button.textContent, box: button.getBoundingClientRect().toJSON(),
        labels: Array.from(button.querySelectorAll('.action-icon__label')).map(label => ({
          text: label.textContent, width: label.clientWidth, scroll: label.scrollWidth,
        })),
      })),
    }));
    measurements[`composer-${theme}-${width}-${mobile}`] = geometry;
    await capture(`composer-${theme}-${width}-${mobile ? 'mobile' : 'pane'}`);
    if (phase !== 'before') {
      const recurrence = modal.locator('.action-icon').filter({ hasText: 'Recurrence' });
      await recurrence.hover();
      await recurrence.focus();
      await capture(`composer-focus-${theme}-${width}-${mobile ? 'mobile' : 'pane'}`);
    }
    const save = modal.locator('button.mod-cta');
    await expect(save).toBeVisible();
    const saveBounds = (await save.boundingBox())!;
    expect(saveBounds.y + saveBounds.height).toBeLessThanOrEqual(800);
    if (phase !== 'before') for (const button of geometry.buttons) {
      expect(button.box.height).toBeGreaterThanOrEqual(mobile ? 40 : 28);
      for (const label of button.labels) expect(label.scroll, label.text ?? '').toBeLessThanOrEqual(label.width + 1);
    }
    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
  }
});

test('narrow expanded composer still saves with the keyboard', async () => {
  if (phase === 'before') return;
  await resize(400, 'dark', true);
  const title = `JUI keyboard submission ${Date.now()}`;
  await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.openTaskCreationModal());
  const modal = page.locator('.modal.mod-tasknotes');
  await modal.locator('.tn-task-modal__details-toggle').click();
  await modal.locator('.tn-task-modal__markdown-editor--nlp .cm-content:visible, .title-input:visible').first().fill(title);
  await page.keyboard.press('Control+Enter');
  await expect(modal).toHaveCount(0);
  await expect.poll(() => page.evaluate(title => {
    const app = (window as any).app;
    return app.vault.getMarkdownFiles().some((file: any) => file.basename === title);
  }, title)).toBe(true);
  const saved = await page.evaluate(async title => {
    const app = (window as any).app;
    const file = app.vault.getMarkdownFiles().find((file: any) => file.basename === title);
    return app.vault.read(file);
  }, title);
  expect(saved).toContain('status: open');
  expect(saved).toMatch(/tags:\s*\n\s*- task/);
});

async function hold(source: Locator) {
  await source.scrollIntoViewIfNeeded();
  await source.hover();
  const box = (await source.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 18);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 22, box.y + 26, { steps: 8 });
  await expect(page.locator('body')).toHaveClass(/tn-drag-active/);
}

test('list and board hold the same task card with a multi-task count', async () => {
  test.setTimeout(180000);
  for (const theme of ['light', 'dark']) for (const width of [1180, 400]) for (const name of ['List', 'Board']) {
    await resize(width, theme);
    await open(`${name}.base`);
    const root = page.locator('.workspace-leaf.mod-active');
    const source = root.locator(`.task-card[data-task-path="${folder}/Task 0.md"]`).first();
    for (const count of [1, 2]) {
      await page.evaluate(({ folder, count }) => {
        const selection = (window as any).app.plugins.plugins.tasknotes.taskSelectionService;
        selection.clearSelection();
        if (count > 1) {
          selection.selectTask(`${folder}/Task 0.md`);
          selection.addToSelection(`${folder}/Task 1.md`);
        }
      }, { folder, count });
      await hold(source);
      await capture(`drag-${name}-${theme}-${width}-${count}`);
      if (phase !== 'before') {
        const preview = page.locator('.kanban-view__floating-drag-preview');
        await expect(preview).toBeVisible();
        await expect(preview.locator('.task-card__title-text')).toHaveText('Review the release');
        await expect(preview.locator('.task-card')).not.toHaveClass(/task-card--dragging|drag-source|kanban-view__card--dragging/);
        expect(await preview.evaluate(element => (element as HTMLElement).inert)).toBe(true);
        if (count > 1) await expect(preview).toHaveAttribute('data-drag-count', '2');
      }
      await page.keyboard.press('Escape');
      await page.mouse.up();
      await expect(page.locator('body')).not.toHaveClass(/tn-drag-active/);
      await expect(page.locator('.kanban-view__floating-drag-preview, .task-list-view__touch-ghost')).toHaveCount(0);
    }
  }
});
