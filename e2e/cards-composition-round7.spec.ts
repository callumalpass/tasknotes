import { test, expect, type Locator, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

const evidence = '/tmp/tasknotes-r7/cards/regression';
const folder = `CardsComposition-${Date.now()}`;
let instance: ObsidianApp;
let page: Page;

async function resize(width: number, theme: string, mobile = width === 400) {
  await page.evaluate(({ theme, mobile }) => {
    const nativeWindow = (window as any).require('electron').remote.getCurrentWindow();
    nativeWindow.setMinimumSize(320, 500);
    if (nativeWindow.isMaximized()) nativeWindow.unmaximize();
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme}`);
    document.body.classList.toggle('is-mobile', mobile);
  }, { theme, mobile });
  await setObsidianViewport(page, { width, height: 820 });
  await expect.poll(() => page.evaluate(() => (window as any).require('electron').remote.getCurrentWindow().getContentSize())).toEqual([width, 820]);
}

async function open(name: string) {
  await page.evaluate(async ({ folder, name }) => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(`${folder}/${name}`));
    if (name.endsWith('.md')) await app.workspace.getMostRecentLeaf().setViewState({ type: 'markdown', state: { file: `${folder}/${name}`, mode: 'preview' } });
  }, { folder, name });
  await expect(page.locator('.workspace-leaf.mod-active .task-card:visible').first()).toBeVisible();
}

async function capture(name: string) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: `${evidence}/${name}.png`, clip: { x: 0, y: 0, ...page.viewportSize()! } });
}

async function expectOwnHitTargets(card: Locator, mobile: boolean) {
  const targets = await card.locator('[role=button]:visible').evaluateAll(elements => elements.filter(element => getComputedStyle(element).opacity !== '0').map(element => {
    const bounds = element.getBoundingClientRect();
    const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    return { label: element.getAttribute('aria-label'), control: element.className, hit: hit?.className, own: hit === element || element.contains(hit), bounds: bounds.toJSON() };
  }));
  for (const target of targets) {
    expect(target.own, `${JSON.stringify(target)} must hit its own control`).toBe(true);
    if (mobile) {
      expect(target.bounds.width, target.label || '').toBeGreaterThanOrEqual(40);
      expect(target.bounds.height, target.label || '').toBeGreaterThanOrEqual(40);
    }
  }
  for (let first = 0; first < targets.length; first++) for (let second = first + 1; second < targets.length; second++) {
    const left = targets[first].bounds;
    const right = targets[second].bounds;
    expect(Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1 && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1, `${targets[first].label} overlaps ${targets[second].label}`).toBe(false);
  }
  return targets;
}

test.beforeAll(async () => {
  mkdirSync(evidence, { recursive: true });
  instance = await launchObsidian();
  page = instance.page;
  const filters = { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] };
  const order = ['status', 'priority', 'projects', 'contexts', 'tags', 'scheduled', 'due', 'timeEstimate'];
  const bases = {
    'List.base': { filters, views: [{ type: 'tasknotesTaskList', name: 'Delivery', groupBy: { property: 'status', direction: 'ASC' }, order }] },
    'Board.base': { filters, views: [{ type: 'tasknotesKanban', name: 'Delivery', groupBy: { property: 'status', direction: 'ASC' }, columnWidth: 300, hideEmptyColumns: false, order }] },
  };
  await page.evaluate(async ({ folder, bases }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    plugin.settings.hideIdentifyingTagsInCards = true;
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    await app.vault.createFolder(folder);
    const day = (offset: number) => { const date = new Date(); date.setDate(date.getDate() + offset); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
    const dates = `scheduled: ${day(0)}T09:00\ndue: ${day(1)}T09:00\n`;
    const tasks: Record<string, string> = {
      'Project': `title: Code review PR 123\nstatus: open\npriority: normal\n${dates}contexts: [development, review, delivery]\ntimeEstimate: 45\n`,
      'Child': `title: Review implementation with the delivery team before the final accessibility and release-readiness check\nstatus: open\npriority: high\nprojects: ['[[${folder}/Project]]']\nblockedBy: ['[[${folder}/Project]]']\n${dates}`,
      'Short': `title: Ready to ship\nstatus: open\npriority: normal\nscheduled: ${day(0)}T09:00\n`,
      'Empty': 'title: No metadata\nstatus: open\n',
      'Done': 'title: Completed review\nstatus: done\n',
      'Unknown': 'title: Unconfigured workflow\nstatus: review-custom\npriority: custom\n',
    };
    for (const [name, content] of Object.entries(tasks)) await app.vault.create(`${folder}/${name}.md`, `---\ntags: [task]\n${content}---\n`);
    for (const [name, content] of Object.entries(bases)) await app.vault.create(`${folder}/${name}`, content);
    await app.vault.create(`${folder}/Inline.md`, `# Delivery notes\n\nBefore [[${folder}/Project|review implementation with the delivery team]], then [[${folder}/Short|ship the release]] and continue.\n\n[[${folder}/Child]]\n`);
  }, { folder, bases: Object.fromEntries(Object.entries(bases).map(([name, value]) => [name, stringify(value)])) });
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

test('board control lanes hit themselves at rest, on hover and focus without moving metadata', async () => {
  test.setTimeout(180000);
  const measurements: Record<string, unknown> = {};
  for (const theme of ['light', 'dark']) for (const width of [1180, 760, 400]) {
    await resize(width, theme);
    await open('Board.base');
    const project = page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${folder}/Project.md"]`).first();
    await project.scrollIntoViewIfNeeded();
    await expect(project.locator('.task-card__date-slot:not([hidden])')).toHaveCount(2);
    await page.mouse.move(1, 1);
    const before = await project.locator('.task-card__metadata').boundingBox();
    measurements[`${theme}-${width}`] = await expectOwnHitTargets(project, width === 400);
    await capture(`board-${theme}-${width}`);
    await project.hover();
    await expectOwnHitTargets(project, width === 400);
    expect(await project.locator('.task-card__metadata').boundingBox()).toEqual(before);
    await project.locator('.task-card__context-menu').focus();
    await expectOwnHitTargets(project, width === 400);
    const overflow = project.locator('.task-card__metadata-overflow');
    if (await overflow.isVisible()) {
      await overflow.click();
      await expect(page.locator('.tn-picker[role=dialog]')).toBeVisible();
      await page.keyboard.press('Escape');
    }
    const chevron = project.locator('.task-card__chevron');
    await chevron.click();
    await expect(project.locator('.task-card__subtasks')).toBeVisible();
    await expect(page.locator('.menu')).toHaveCount(0);
    await chevron.click();
    await expect(project.locator('.task-card__subtasks')).toHaveCount(0);
    const short = page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${folder}/Short.md"]`).first();
    if (width !== 400) expect((await short.boundingBox())!.height).toBeLessThan(80);
    const empty = page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${folder}/Empty.md"]`).first();
    await expect(empty).toHaveClass(/task-card--metadata-empty/);
    await empty.scrollIntoViewIfNeeded();
    await expectOwnHitTargets(empty, width === 400);
    expect((await empty.boundingBox())!.height).toBeLessThan(width === 400 ? 100 : 80);
  }
  writeFileSync(`${evidence}/hit-targets.json`, JSON.stringify(measurements, null, 2));
});

test('list date identities align, selection can be cleared and group commands are reachable', async () => {
  test.setTimeout(120000);
  for (const theme of ['light', 'dark']) {
    await resize(1180, theme);
    await open('List.base');
    const root = page.locator('.workspace-leaf.mod-active .tn-bases-items-container');
    for (const field of ['scheduled', 'due']) {
      const controls = root.locator(`.task-card__metadata-date--${field}`);
      await expect(controls).toHaveCount(field === 'scheduled' ? 3 : 2);
      const positions = await controls.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().x));
      expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(1);
      for (const control of await controls.all()) await expect(control).toHaveAttribute('aria-label', new RegExp(field === 'scheduled' ? '^Scheduled:' : '^Due:'));
    }
    const header = root.locator('.task-group-header').first();
    const title = await header.locator('.task-group-title').boundingBox();
    const count = await header.locator('.agenda-view__item-count').boundingBox();
    expect(count!.x - (title!.x + title!.width)).toBeLessThan(20);
    await header.click({ button: 'right' });
    await page.getByText('Collapse all groups', { exact: true }).click();
    await expect(root.locator('.task-card:visible')).toHaveCount(0);
    await header.click({ button: 'right' });
    await page.getByText('Expand all groups', { exact: true }).click();
    await expect(root.locator('.task-card:visible')).not.toHaveCount(0);
    const project = root.locator(`.task-card[data-task-path="${folder}/Project.md"]`).first();
    const short = root.locator(`.task-card[data-task-path="${folder}/Short.md"]`).first();
    for (const action of ['click', 'Enter', 'Space']) {
      await project.locator('.task-card__title-text').click({ modifiers: ['Control'] });
      await short.locator('.task-card__title-text').click({ modifiers: ['Control'] });
      const indicator = page.locator('.workspace-leaf.mod-active .tn-selection-indicator');
      await expect(indicator).toBeVisible();
      await expect(indicator).toHaveText('2 selected · Clear selection');
      await capture(`selection-${theme}-${action}`);
      if (action === 'click') await indicator.click();
      else { await indicator.focus(); await page.keyboard.press(action); }
      await expect(indicator).toBeHidden();
      await expect(project).not.toHaveClass(/task-card--selected/);
      await expect(short).not.toHaveClass(/task-card--selected/);
    }
    for (const width of [1180, 760, 400]) {
      await resize(width, theme);
      await project.scrollIntoViewIfNeeded();
      if (width === 400) for (const icon of await project.locator('.task-card__date-icon:visible').all()) await expect(icon).toBeVisible();
      await capture(`list-${theme}-${width}`);
    }
  }
});

test('inline references keep status next to readable titles and desktop options quiet', async () => {
  for (const theme of ['light', 'dark']) for (const width of [1180, 400]) {
    await resize(width, theme);
    await open('Inline.md');
    const sentence = page.locator('.markdown-preview-view .tasknotes-inline-widget--sentence').first();
    await expect(sentence).toBeVisible();
    const menu = sentence.locator('.task-card__context-menu');
    if (width === 1180) {
      await page.mouse.move(1, 1);
      await expect(menu).toHaveCSS('opacity', '0');
      await capture(`inline-rest-${theme}-${width}`);
      const before = await sentence.boundingBox();
      await sentence.hover();
      await expect(menu).toHaveCSS('opacity', '1');
      await capture(`inline-hover-${theme}-${width}`);
      expect(await sentence.boundingBox()).toEqual(before);
    }
    await menu.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.mouse.move(1, 1);
    await capture(`inline-${theme}-${width}`);
  }
});
