import { test, expect, type Page, type Locator } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
let page: Page;
let sortField: string;
const folder = `RowStates-${Date.now()}`;
const output = process.env.TASKNOTES_R7_EVIDENCE ?? 'test-results/round7-list';
const card = (index: number) => page.locator(`.workspace-leaf.mod-active .tn-bases-items-container > .task-list-group .task-card[data-task-path="${folder}/Task ${index}.md"]`).first();
const root = () => page.locator('.workspace-leaf.mod-active .tn-tasknotesTaskList');

async function capture(name: string) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const size = page.viewportSize()!;
  await page.screenshot({ path: `${output}/${name}.png`, clip: { x: 0, y: 0, width: size.width, height: 800 } });
}

async function openList(theme: string, width = 1180, mobile = false, manual = false, readOnly = false) {
  await setObsidianViewport(page, { width, height: 800 });
  const path = `${folder}/${theme}-${width}-${mobile}-${Date.now()}.base`;
  const content = stringify({
    ...(readOnly ? { formulas: { bucket: 'if(status == "open", "Open work", "Other work")' } } : {}),
    filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
    views: [{ type: 'tasknotesTaskList', name: 'List', groupBy: { property: readOnly ? 'formula.bucket' : 'status', direction: 'ASC' },
      order: ['status', 'priority', 'projects', 'contexts', 'tags', 'scheduled', 'due'],
      sort: manual ? [{ column: sortField, direction: 'ASC' }] : [], enableSearch: true }],
  });
  await page.evaluate(async ({ theme, mobile, path, content }) => {
    document.querySelector('.tn-toast')?.dispatchEvent(new Event('tn-dismiss'));
    document.body.classList.remove('theme-light', 'theme-dark', 'is-mobile');
    document.body.classList.add(theme);
    if (mobile) document.body.classList.add('is-mobile');
    const app = (window as any).app;
    app.plugins.plugins.tasknotes.taskSelectionService.clearSelection();
    await app.workspace.getLeaf(false).openFile(await app.vault.create(path, content));
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
  }, { theme, mobile, path, content });
  await expect(card(0)).toBeVisible();
  await expect(card(0).locator('.task-card__metadata')).toBeVisible();
  if (width > 600) {
    await expect(card(0).locator('.task-card__metadata-values')).toBeVisible();
  } else if (!await card(0).locator('.task-card__metadata-values').isVisible()) {
    await expect(card(0).locator('.task-card__metadata-overflow')).toBeVisible();
    await expect(card(0).locator('.task-card__metadata-overflow')).toHaveAttribute('aria-label', /studio/);
  }
  const notice = page.getByText("Don't show again", { exact: true });
  if (await notice.isVisible()) await notice.click();
}

async function select(indices: number[]) {
  await page.evaluate(({ folder, indices }) => {
    const selection = (window as any).app.plugins.plugins.tasknotes.taskSelectionService;
    selection.clearSelection();
    for (const index of indices) selection.addToSelection(`${folder}/Task ${index}.md`);
  }, { folder, indices });
}

async function startDrag(source: Locator, target: { x: number; y: number }) {
  await source.scrollIntoViewIfNeeded();
  const box = (await source.boundingBox())!;
  await page.mouse.move(box.x + 11, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 24, box.y + box.height / 2 + 7, { steps: 5 });
  await page.mouse.move(target.x, target.y, { steps: 12 });
  await expect(page.locator('.task-list-view__touch-ghost')).toBeVisible();
}

test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
  instance = await launchObsidian();
  page = instance.page;
  sortField = await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.fieldMapper.toUserField('sortOrder'));
  await page.evaluate(async folder => {
    const app = (window as any).app;
    app.plugins.plugins.tasknotes.settings.hideIdentifyingTagsInCards = true;
    await app.vault.createFolder(folder);
    for (let index = 0; index < 7; index++) {
      const title = ['Prepare launch checklist', 'Review onboarding with the accessibility team before the November launch', 'Ship the task row interactions', 'Write release notes', 'Send final handoff notes', 'Plan next week', 'Capture an idea'][index];
      const status = index === 3 ? 'in-progress' : index === 4 ? 'done' : index === 6 ? 'custom-unconfigured' : 'open';
      await app.vault.create(`${folder}/Task ${index}.md`, `---\ntags: [task${index === 6 ? '' : ', design, release'}]\ntitle: ${title}\nstatus: ${status}\npriority: ${index === 2 ? 'custom-unconfigured' : 'normal'}\n${index === 6 ? '' : 'contexts: [studio]\nscheduled: 2026-11-06\ndue: 2026-11-09\n'}${index === 0 ? 'due: 2026-11-03\n' : ''}${index === 2 ? `blockedBy: ["[[${folder}/Task 0]]"]\n` : ''}${index === 5 ? 'archived: true\n' : ''}---\n${index === 1 ? 'Review keyboard and pointer states.' : ''}`.replace('due: 2026-11-09\ndue:', 'due:'));
    }
  }, folder);
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

for (const theme of ['theme-light', 'theme-dark']) {
  test(`${theme}: stable pointer, keyboard, selection and refresh states`, async () => {
    await openList(theme);
    const source = card(0);
    await page.mouse.move(1100, 95);
    await capture(`${theme}-1180-rest`);
    const before = (await source.boundingBox())!;
    await source.hover();
    await capture(`${theme}-1180-hover`);
    expect(await source.boundingBox()).toEqual(before);
    await page.mouse.down();
    await capture(`${theme}-1180-pressed`);
    expect(await source.boundingBox()).toEqual(before);
    await page.mouse.move(before.x + before.width / 2 + 16, before.y + before.height / 2 + 7, { steps: 5 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(page.locator('.modal')).toHaveCount(0);
    expect(await root().locator('.tn-task-focused').count()).toBe(0);
    await select([0, 1]);
    await source.hover();
    await capture(`${theme}-1180-selected-hover`);
    await page.evaluate(async folder => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(`${folder}/Task 0.md`);
      await app.fileManager.processFrontMatter(file, (frontmatter: any) => { frontmatter.title = 'Prepare launch checklist — refreshed'; });
    }, folder);
    await expect(source.locator('.task-card__title-text')).toContainText('refreshed');
    await expect(source).toHaveClass(/task-card--selected/);
    await expect(source).toHaveClass(/task-card--reorderable/);
    expect((await source.boundingBox())!.height).toBe(before.height);
    await capture(`${theme}-1180-hover-refresh`);
    await root().focus();
    await page.keyboard.press('ArrowDown');
    await expect(root().locator('.tn-task-focused')).toHaveCount(1);
    await capture(`${theme}-1180-selected-focused`);
    await select([]);
    await page.keyboard.press('Home');
    await capture(`${theme}-1180-keyboard`);
    await source.locator('.task-card__status-dot').focus();
    await expect(root().locator('.tn-task-focused')).toHaveCount(0);
    await capture(`${theme}-1180-control-focus`);
    await page.keyboard.press('s');
    await expect(page.locator('.tn-picker')).toBeVisible();
    await page.keyboard.press('Escape');
    for (let index = 0; index < 5; index++) {
      await card(index).hover();
      expect((await card(index).boundingBox())!.height).toBe(58);
    }
    for (const [index, state] of [[6, 'unknown-no-metadata'], [4, 'completed'], [5, 'archived'], [2, 'blocked']] as const) {
      await select([index]);
      await card(index).hover();
      await capture(`${theme}-1180-${state}-selected-hover`);
    }
    await select([]);
    await card(0).scrollIntoViewIfNeeded();
    const header = root().locator('.task-group-header').first();
    await header.hover();
    await capture(`${theme}-1180-header-hover`);
    await header.locator('.task-group-toggle').click();
    await capture(`${theme}-1180-collapsed`);
    await header.locator('.task-group-toggle').click();
  });

  test(`${theme}: single and selected drag previews, cancellation, group drop and Undo`, async () => {
    await openList(theme);
    const target = (await card(2).boundingBox())!;
    await startDrag(card(0), { x: target.x + 180, y: target.y + 3 });
    await expect(root().locator('.task-list-view__drag-source')).toHaveCount(1);
    await capture(`${theme}-1180-single-drag`);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(page.locator('.task-list-view__touch-ghost')).toHaveCount(0);
    await select([0, 1]);
    const before = await page.evaluate(async folder => {
      const app = (window as any).app;
      return Promise.all([0, 1].map(index => app.vault.read(app.vault.getAbstractFileByPath(`${folder}/Task ${index}.md`))));
    }, folder);
    await startDrag(card(0), { x: target.x + 180, y: target.y + 3 });
    await expect(root().locator('.task-list-view__drag-source')).toHaveCount(2);
    await expect(page.locator('.task-list-view__touch-ghost')).toHaveAttribute('data-drag-count', '2');
    await capture(`${theme}-1180-multi-drag`);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(root().locator('.task-card--selected')).toHaveCount(2);
    expect(await page.evaluate(async folder => {
      const app = (window as any).app;
      return Promise.all([0, 1].map(index => app.vault.read(app.vault.getAbstractFileByPath(`${folder}/Task ${index}.md`))));
    }, folder)).toEqual(before);
    const header = root().locator('.task-group-header').filter({ hasText: 'In Progress' }).first();
    await select([0, 1, 3]);
    const destination = (await header.boundingBox())!;
    await startDrag(card(0), { x: destination.x + 140, y: destination.y + destination.height / 2 });
    await capture(`${theme}-1180-group-drop-target`);
    await page.mouse.up();
    await expect(card(0)).toHaveAttribute('data-status', 'in-progress');
    await expect(card(1)).toHaveAttribute('data-status', 'in-progress');
    await capture(`${theme}-1180-drop-settle`);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(card(0)).toHaveAttribute('data-status', 'open');
    await expect(card(1)).toHaveAttribute('data-status', 'open');
  });

  test(`${theme}: manual insertion, refresh during drag, delayed and failed writes`, async () => {
    await openList(theme, 1180, false, true);
    const target = (await card(2).boundingBox())!;
    const sourceBefore = await card(0).evaluate(element => { (window as any).r7DragSource = element; return element.dataset.taskPath; });
    await startDrag(card(0), { x: target.x + 160, y: target.y + target.height - 2 });
    await expect(root().locator('.task-list-view__drop-slot-after, .task-list-view__drop-slot-before')).toHaveCount(1);
    await capture(`${theme}-1180-insertion`);
    await page.evaluate(async folder => {
      const app = (window as any).app;
      await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(`${folder}/Task 1.md`), (frontmatter: any) => { frontmatter.title = 'Review onboarding — changed during drag'; });
    }, folder);
    expect(await card(0).evaluate(element => element === (window as any).r7DragSource)).toBe(true);
    expect(await card(0).getAttribute('data-task-path')).toBe(sourceBefore);
    await page.mouse.move(target.x + 160, target.y + target.height - 3, { steps: 2 });
    await page.mouse.up();
    await expect.poll(() => card(0).evaluate((element, sortField) => {
      const app = (window as any).app;
      return app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(element.getAttribute('data-task-path')))?.frontmatter?.[sortField];
    }, sortField)).toBeTruthy();
    await capture(`${theme}-1180-reordered`);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(() => card(0).evaluate((element, sortField) => {
      const app = (window as any).app;
      return app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(element.getAttribute('data-task-path')))?.frontmatter?.[sortField];
    }, sortField)).toBeUndefined();
    await page.evaluate(() => {
      const plugin = (window as any).app.plugins.plugins.tasknotes;
      (window as any).r7OriginalWrite = plugin.updateTaskProperty;
      plugin.updateTaskProperty = () => new Promise((_resolve, reject) => { (window as any).r7RejectWrite = reject; });
    });
    try {
      await card(0).locator('.task-card__status-dot').click();
      await expect(card(0)).toHaveClass(/task-card--pending/);
      await expect(card(0).locator('.task-card__status-dot')).toHaveAttribute('aria-disabled', 'true');
      await capture(`${theme}-1180-pending-disabled`);
      await page.evaluate(() => (window as any).r7RejectWrite(new Error('Isolated fixture: write denied')));
      await expect(card(0)).toHaveClass(/task-card--write-failed/);
      await expect(card(0)).not.toHaveClass(/task-card--pending/);
      await capture(`${theme}-1180-failed`);
    } finally {
      await page.evaluate(() => { (window as any).app.plugins.plugins.tasknotes.updateTaskProperty = (window as any).r7OriginalWrite; });
    }
    const nextStatus = await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.statusManager.getNextStatus('open'));
    await card(0).locator('.task-card__status-dot').click();
    await expect(card(0)).toHaveAttribute('data-status', nextStatus);
    await expect(card(0)).not.toHaveClass(/task-card--pending|task-card--write-failed/);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(card(0)).toHaveAttribute('data-status', 'open');
  });

  test(`${theme}: narrow desktop and touch-sized non-overlapping controls`, async () => {
    await openList(theme, 400);
    await capture(`${theme}-400-rest`);
    await card(0).hover();
    await capture(`${theme}-400-hover`);
    await openList(theme, 400, true);
    await capture(`${theme}-400-mobile`);
    const controls = await card(0).evaluate(element => Array.from(element.querySelectorAll<HTMLElement>('.task-card__status-dot, .task-card__priority-dot, .task-card__drag-handle, .task-card__context-menu')).map(control => control.getBoundingClientRect().toJSON()).sort((left, right) => left.x - right.x));
    expect(controls).toHaveLength(4);
    for (const rect of controls) {
      expect(rect.width).toBeGreaterThanOrEqual(40);
      expect(rect.height).toBeGreaterThanOrEqual(40);
    }
    for (const [index, control] of controls.entries()) {
      for (const other of controls.slice(index + 1)) {
        expect(control.right <= other.left || other.right <= control.left || control.bottom <= other.top || other.bottom <= control.top).toBe(true);
      }
    }
    const before = await card(0).evaluate(element => getComputedStyle(element.querySelector('.task-card__main-row')!, '::before').backgroundColor);
    await card(0).hover();
    expect(await card(0).evaluate(element => getComputedStyle(element.querySelector('.task-card__main-row')!, '::before').backgroundColor)).toBe(before);
    await select([0]);
    await capture(`${theme}-400-mobile-selected`);
    await setObsidianViewport(page, { width: 430, height: 800 });
    await expect(card(0).locator('.task-card__metadata-date--due')).toBeVisible();
    await expect(card(0).locator('.task-card__metadata-date--scheduled')).toBeVisible();
    const input = await page.context().newCDPSession(page);
    await input.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    try {
      const handle = (await card(0).locator('.task-card__drag-handle').boundingBox())!;
      const x = handle.x + handle.width / 2;
      const y = handle.y + handle.height / 2;
      await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await expect(page.locator('.task-list-view__touch-ghost')).toBeVisible();
      await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 35, y: y + 55 }] });
      await capture(`${theme}-430-touch-drag`);
      await input.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await expect(page.locator('.task-list-view__touch-ghost')).toHaveCount(0);
      await expect(root().locator('.task-list-view__drag-source')).toHaveCount(0);
    } finally {
      await input.send('Emulation.setTouchEmulationEnabled', { enabled: false });
      await input.detach();
    }
  });

  test(`${theme}: edge auto-scroll and invalid read-only destinations cancel cleanly`, async () => {
    await page.evaluate(async folder => {
      const app = (window as any).app;
      for (let index = 0; index < 24; index++) await app.vault.create(`${folder}/Follow-up ${index}.md`, `---\ntitle: Follow-up ${index}\ntags: [task]\nstatus: open\n---\n`);
    }, folder);
    await openList(theme);
    await startDrag(card(0), { x: 400, y: 770 });
    await expect.poll(() => root().locator('.tn-bases-items-container').evaluate(element => element.scrollTop)).toBeGreaterThan(60);
    await capture(`${theme}-1180-auto-scroll`);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(page.locator('.task-list-view__touch-ghost')).toHaveCount(0);
    await expect(root().locator('.task-list-view__drag-source, .task-list-view__move-candidate')).toHaveCount(0);
    await page.evaluate(async folder => {
      const app = (window as any).app;
      for (let index = 0; index < 24; index++) await app.vault.delete(app.vault.getAbstractFileByPath(`${folder}/Follow-up ${index}.md`));
    }, folder);
    await openList(theme, 1180, false, false, true);
    const header = root().locator('.task-group-header').filter({ hasText: 'Other work' }).first();
    const target = (await header.boundingBox())!;
    await startDrag(card(0), { x: target.x + 180, y: target.y + target.height / 2 });
    await expect(root().locator('.task-list-view__move-target--blocked').first()).toBeVisible();
    await expect(root().locator('.task-list-view__movement-feedback')).toContainText('read-only');
    await capture(`${theme}-1180-invalid`);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(card(0)).toHaveAttribute('data-status', 'open');
    await expect(root().locator('.task-list-view__move-target--blocked')).toHaveCount(0);
  });
}
