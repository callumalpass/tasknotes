import { test, expect, type Locator, type Page } from '@playwright/test';
import { pointer } from './xtest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport } from './obsidian';

const evidence = process.env.TASKNOTES_R9_EVIDENCE ?? '/tmp/tasknotes-round9';
const baseline = process.env.TASKNOTES_R9_BASELINE === '1';
let folder: string;
let instance: Awaited<ReturnType<typeof launchObsidian>>;
let page: Page;


async function start(source: Locator) {
  await source.scrollIntoViewIfNeeded();
  const bounds = (await source.boundingBox())!;
  const offset = await page.evaluate(() => ({ x: screenX, y: screenY + outerHeight - innerHeight }));
  pointer(['move', bounds.x + offset.x + bounds.width / 2, bounds.y + offset.y + bounds.height / 2]);
  pointer(['button', 1], ['move', bounds.x + offset.x + bounds.width / 2 - 20, bounds.y + offset.y + bounds.height / 2 + 2]);
  return offset;
}

async function moveTo(target: Locator, offset: { x: number; y: number }, bottom = false) {
  const bounds = (await target.boundingBox())!;
  const pointerX = bounds.x + bounds.width / 2;
  const pointerY = bottom ? Math.min(innerHeightSafe(), bounds.y + bounds.height - 12) : bounds.y + 10;
  await page.evaluate(() => {
    (window as any).r9AcceptedDrag = null;
    document.addEventListener('dragover', (event: DragEvent) => {
      setTimeout(() => { (window as any).r9AcceptedDrag = { x: event.clientX, y: event.clientY, accepted: event.defaultPrevented, effect: event.dataTransfer?.dropEffect }; }, 0);
    }, { capture: true });
  });
  await expect.poll(async () => {
    pointer(['move', pointerX + offset.x - 6, pointerY + offset.y - 2], ['move', pointerX + offset.x, pointerY + offset.y]);
    return page.evaluate(({ pointerX, pointerY }) => {
      const arrival = (window as any).r9AcceptedDrag;
      return arrival?.accepted && Math.abs(arrival.x - pointerX) < 10 && Math.abs(arrival.y - pointerY) < 5 && !document.body.classList.contains('tn-drag-invalid');
    }, { pointerX, pointerY });
  }).toBe(true);
}

function innerHeightSafe() { return 720; }

async function open(type: string, sort = 'tasknotes_manual_order') {
  await page.evaluate(async ({ folder, type, content }) => {
    const app = (window as any).app;
    const path = `${folder}/${type}.base`;
    const file = app.vault.getAbstractFileByPath(path) ?? await app.vault.create(path, content);
    await app.vault.modify(file, content);
    await app.workspace.getLeaf(false).setViewState({ type: 'empty' });
    await app.workspace.getLeaf(false).openFile(file);
  }, { folder, type, content: stringify({ filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] }, views: [{ type, name: 'Drag settle', groupBy: { property: 'status', direction: 'ASC' }, order: ['status', 'priority', 'due', 'tags'], sort: [{ property: sort, direction: 'ASC' }] }] }) });
  await expect(page.locator('.workspace-leaf.mod-active .task-card').first()).toBeVisible();
}

test.beforeEach(async () => {
  mkdirSync(evidence, { recursive: true });
  folder = `DragR9-${Date.now()}`;
  instance = await launchObsidian();
  page = instance.page;
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await page.evaluate(async folder => {
    const app = (window as any).app;
    app.workspace.leftSplit.collapse(); app.workspace.rightSplit.collapse();
    await app.vault.createFolder(folder);
    for (let index = 0; index < 61; index++) await app.vault.create(`${folder}/${String(index).padStart(2, '0')}.md`, `---\ntitle: Row ${String(index).padStart(2, '0')}\nstatus: ${index < 50 ? 'open' : index < 60 ? 'in-progress' : 'done'}\ntags: [task, studio]\npriority: high\ndue: 2026-11-10\n---\nPreview body\n`);
  }, folder);
  await expect.poll(() => page.evaluate(folder => Array.from({ length: 60 }, (_, index) => (window as any).app.plugins.plugins.tasknotes.cacheManager.getCachedTaskInfoSync(`${folder}/${String(index).padStart(2, '0')}.md`)).filter(Boolean).length, folder)).toBe(60);
});

test.afterEach(async () => {
  try {
    pointer(['escape', 0], ['button', 0]);
    if (page && !page.isClosed()) await page.evaluate(() => {
      const state = window as any;
      if (state.r9Statuses) {
        const plugin = state.app.plugins.plugins.tasknotes;
        plugin.settings.customStatuses = state.r9Statuses;
        plugin.statusManager.updateStatuses(state.r9Statuses);
      }
    });
    if (page && !page.isClosed()) await page.evaluate(async folder => {
      const app = (window as any).app;
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally { if (instance) await closeObsidian(instance); }
});

test('native board lift and all delayed refreshes keep geometry and source order', async () => {
  test.setTimeout(120000);
  await setObsidianViewport(page, { width: 800, height: 800 });
  await open('tasknotesKanban');
  const board = page.locator('.workspace-leaf.mod-active .kanban-view__board');
  const sourceColumn = board.locator('[data-group="open"]').first();
  const destination = board.locator('[data-group="in-progress"]').first();
  await board.evaluate(element => { element.scrollLeft = 120; });
  const before = await board.evaluate(element => {
    const view = (window as any).app.workspace.activeLeaf.view.controller.view;
    return { scroll: element.scrollLeft, widths: [...element.querySelectorAll('.kanban-view__column')].map(column => column.getBoundingClientRect().width), cards: [...element.querySelectorAll('.kanban-view__column .task-card')].map(card => card.getBoundingClientRect().width), order: view.columnScrollers.get('open').getItems().map((task: any) => task.path) };
  });
  const source = sourceColumn.locator('.task-card').nth(2);
  const moved = await source.getAttribute('data-task-path');
  const meta = source.locator('.task-card__metadata-date').first();
  let offset = await start(meta);
  const metadataLift = await page.locator('.kanban-view__board--task-dragging').isVisible();
  writeFileSync(join(evidence, 'metadata.json'), JSON.stringify({ metadataLift }));
  if (!metadataLift) { pointer(['button', 0], ['escape', 0]); await page.keyboard.press('Escape'); offset = await start(source.locator('.task-card__title-text')); }
  await expect(page.locator('.kanban-view__board--task-dragging')).toBeVisible();
  const held = await board.evaluate(element => ({ scroll: element.scrollLeft, cards: [...element.querySelectorAll('.kanban-view__column .task-card')].map(card => card.getBoundingClientRect().width) }));
  pointer(['move', 400 + offset.x, 70 + offset.y]);
  await expect(page.locator('.kanban-view__board--invalid-drop')).toBeVisible();
  const offViewFeedback = await page.locator('.kanban-view__floating-drag-preview').textContent();
  writeFileSync(join(evidence, 'off-view.json'), JSON.stringify({ offViewFeedback }));
  await moveTo(destination.locator('.task-card').nth(2), offset);
  writeFileSync(join(evidence, 'board-before-release.json'), JSON.stringify(await page.evaluate(() => ({ arrival: (window as any).r9AcceptedDrag, active: document.body.className, target: document.elementFromPoint((window as any).r9AcceptedDrag.x, (window as any).r9AcceptedDrag.y)?.outerHTML.slice(0, 1000) })), null, 2));
  await page.screenshot({ path: join(evidence, 'board-before-release.png') });
  await page.evaluate(() => {
    const state = window as any;
    state.r9Frames = []; state.r9DropTime = null;
    document.addEventListener('dragend', event => { state.r9Ended = { effect: event.dataTransfer?.dropEffect, x: event.clientX, y: event.clientY }; }, { once: true, capture: true });
    document.addEventListener('drop', () => {
      state.r9DropTime = performance.now();
      const sample = () => {
        const board = document.querySelector('.workspace-leaf.mod-active .kanban-view__board') as HTMLElement;
        state.r9Frames.push({ ms: performance.now() - state.r9DropTime, scroll: board.scrollLeft, widths: [...board.querySelectorAll('.kanban-view__column')].map(column => column.getBoundingClientRect().width) });
        if (performance.now() - state.r9DropTime < 5000) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }, { once: true, capture: true });
  });
  pointer(['button', 0]);
  writeFileSync(join(evidence, 'board-after-release.json'), JSON.stringify(await page.evaluate(() => ({ ended: (window as any).r9Ended, dropped: (window as any).r9DropTime })), null, 2));
  await expect.poll(() => page.evaluate(() => (window as any).r9Frames?.at(-1)?.ms ?? 0), { timeout: 10000 }).toBeGreaterThan(5000);
  const after = await page.evaluate(() => {
    const view = (window as any).app.workspace.activeLeaf.view.controller.view;
    return { frames: (window as any).r9Frames, order: view.columnScrollers.get('open').getItems().map((task: any) => task.path) };
  });
  writeFileSync(join(evidence, 'board.json'), JSON.stringify({ before, held, metadataLift, moved, after, offViewFeedback }, null, 2));
  await page.screenshot({ path: join(evidence, 'board.png') });
  if (!baseline) {
    expect(metadataLift).toBe(true);
    expect(offViewFeedback).toContain('Drop on a task row or group destination.');
    expect(held.cards.every(width => before.cards.includes(width))).toBe(true);
    expect(after.frames.every((frame: any) => Math.abs(frame.scroll - before.scroll) <= 1 && frame.widths.every((width: number, index: number) => width === before.widths[index]))).toBe(true);
    expect(after.order).toEqual(before.order.filter((path: string) => path !== moved));
  }
});

test('content-height cards, metadata clicks and phone navigation clearance', async () => {
  test.setTimeout(120000);
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await page.evaluate(() => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    (window as any).r9Statuses = plugin.settings.customStatuses;
    plugin.settings.customStatuses = plugin.settings.customStatuses.map((status: any) => status.value === 'in-progress' ? { ...status, label: 'Waiting on the external vendor response' } : status);
    plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
  });
  await open('tasknotesKanban');
  const board = page.locator('.workspace-leaf.mod-active .kanban-view__board');
  const card = board.locator('.kanban-view__column[data-group="open"] .task-card').first();
  const geometry = await card.evaluate(element => ({ height: element.getBoundingClientRect().height,
    title: element.querySelector('.task-card__title-text')?.getBoundingClientRect().toJSON(),
    titleMinHeight: getComputedStyle(element.querySelector('.task-card__title-text')!).minHeight,
    titleLineHeight: parseFloat(getComputedStyle(element.querySelector('.task-card__title-text')!).lineHeight),
    headers: [...element.closest('.kanban-view__board')!.querySelectorAll('.kanban-view__column:not(.kanban-view__column--empty-rail)')].map(column => ({ title: column.querySelector('.kanban-view__column-title')?.textContent, header: column.querySelector('.kanban-view__column-header')?.getBoundingClientRect().toJSON(), card: column.querySelector('.task-card')?.getBoundingClientRect().toJSON() })) }));
  const date = card.locator('.task-card__metadata-date').first();
  await date.click();
  await expect(page.locator('.tn-popover')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.kanban-view__board--task-dragging')).toHaveCount(0);
  await page.screenshot({ path: join(evidence, 'board-content-light.png'), animations: 'disabled' });
  await page.evaluate(() => { document.body.classList.remove('theme-light'); document.body.classList.add('theme-dark'); });
  await open('tasknotesKanban');
  await page.screenshot({ path: join(evidence, 'board-content-dark.png'), animations: 'disabled' });
  await setObsidianViewport(page, { width: 390, height: 800 });
  await page.evaluate(() => {
    document.body.classList.add('is-mobile');
    const nav = document.body.createDiv({ cls: 'mobile-navbar', attr: { id: 'r9-navigation' } });
    Object.assign(nav.style, { position: 'fixed', left: '5px', right: '5px', width: '380px', maxWidth: 'none', margin: '0', transform: 'none', bottom: '14px', height: '52px', zIndex: '100' });
  });
  try {
    await open('tasknotesTaskList');
    const root = page.locator('.workspace-leaf.mod-active .tn-tasknotesTaskList');
    await root.focus(); await page.keyboard.press('j'); await page.keyboard.press('x');
    const indicator = root.locator('.tn-selection-indicator');
    await expect(indicator).toBeVisible();
    const pill = await indicator.evaluate(element => ({ text: element.textContent, bounds: element.getBoundingClientRect().toJSON(), position: getComputedStyle(element).position, items: element.parentElement!.querySelector('.tn-bases-items-container')!.getBoundingClientRect().toJSON(), nav: document.querySelector('#r9-navigation')!.getBoundingClientRect().toJSON(), viewportHeight: innerHeight }));
    await page.screenshot({ path: join(evidence, 'phone-selection.png') });
    await page.keyboard.press('Escape');
    const row = root.locator('.task-card').first();
    await row.locator('.task-card__status-dot').click();
    await expect(page.locator('.tn-toast')).toHaveCount(1);
    const clearance = await page.locator('.tn-toast').evaluate(element => ({ bounds: element.getBoundingClientRect().toJSON(), nav: document.querySelector('#r9-navigation')!.getBoundingClientRect().toJSON() }));
    await page.screenshot({ path: join(evidence, 'phone-toast.png') });
    await open('tasknotesTaskList');
    const source = root.locator('.task-card').first();
    await source.locator('[data-tn-drag-handle]').focus();
    const dragOffset = await start(source.locator('[data-tn-drag-handle]'));
    await expect(page.locator('.task-list-view--moving')).toBeVisible();
    const nav = await page.locator('#r9-navigation').boundingBox();
    const scroller = root.locator('.tn-bases-items-container');
    const before = await scroller.evaluate(element => element.scrollTop);
    await expect.poll(async () => {
      pointer(['move', 190 + dragOffset.x, nav!.y - 8 + dragOffset.y]);
      return scroller.evaluate(element => element.scrollTop);
    }).toBeGreaterThan(before);
    const after = await scroller.evaluate(element => element.scrollTop);
    pointer(['escape', 0], ['button', 0]);
    await expect(page.locator('.task-list-view--moving')).toHaveCount(0);
    writeFileSync(join(evidence, 'controls-phone.json'), JSON.stringify({ geometry, pill, clearance, edge: { before, after, pointerY: nav!.y - 8, navTop: nav!.y } }, null, 2));
    if (!baseline) {
      expect(Math.abs(geometry.title!.height - geometry.titleLineHeight)).toBeLessThan(1);
      expect(pill.text).toContain('Clear selection'); expect(pill.position).toBe('static');
      expect(pill.bounds.top).toBeGreaterThanOrEqual(0);
      expect(pill.bounds.bottom).toBeLessThanOrEqual(Math.min(pill.viewportHeight, pill.nav.top, pill.items.top));
      expect(clearance.bounds.bottom).toBeLessThan(clearance.nav.top); expect(after).toBeGreaterThan(before);
      const tops = geometry.headers.flatMap(header => header.card ? [header.card.top] : []);
      expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1);
    }
  } finally {
    await page.evaluate(() => { document.querySelector('#r9-navigation')?.remove(); document.body.classList.remove('is-mobile', 'theme-dark'); document.body.classList.add('theme-light'); });
  }
});

test('native list preview and exact Escape', async () => {
  test.setTimeout(120000);
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await open('tasknotesTaskList');
  const root = page.locator('.workspace-leaf.mod-active .tn-tasknotesTaskList');
  const source = root.locator(`.task-card[data-task-path="${folder}/04.md"]`).first();
  const sourceBounds = (await source.boundingBox())!;
  const offset = await start(source.locator('[data-tn-drag-handle]'));
  await expect(page.locator('.task-list-view--moving')).toBeVisible();
  const preview = await page.locator('.task-list-view__touch-ghost').evaluate(element => element.getBoundingClientRect().toJSON());
  await moveTo(root.locator('.task-card').nth(6), offset);
  const scroller = root.locator('.tn-bases-items-container');
  const scroll = () => scroller.evaluate(element => { let current = element as HTMLElement; while (current.scrollHeight <= current.clientHeight && current.parentElement) current = current.parentElement; return current.scrollTop; });
  const original = await scroll();
  const bounds = (await scroller.boundingBox())!;
  const bottom = Math.min(780, bounds.y + bounds.height - 5);
  pointer(['move', bounds.x + offset.x + bounds.width / 2, bottom + offset.y]);
  await expect.poll(async () => { pointer(['move', bounds.x + offset.x + bounds.width / 2 + 4, bottom + offset.y], ['move', bounds.x + offset.x + bounds.width / 2, bottom + offset.y]); return scroll(); }).toBeGreaterThan(original + 100);
  const autoScrolled = await scroll();
  pointer(['escape', 0], ['button', 0]);
  await expect(page.locator('.task-list-view--moving')).toHaveCount(0);
  const restored = await scroll();
  await root.focus(); await page.keyboard.press('j'); pointer(['question', 0]);
  if (!baseline) await expect(page.locator('.tn-popover[role="dialog"]')).toBeVisible();
  const help = await page.locator('.tn-popover[role="dialog"]').allTextContents();
  await page.keyboard.press('Escape');
  writeFileSync(join(evidence, 'list.json'), JSON.stringify({ sourceBounds, preview, original, autoScrolled, restored, help }, null, 2));
  await page.screenshot({ path: join(evidence, 'list.png') });
  if (!baseline) { expect(restored).toBe(original); expect(preview.width).toBeCloseTo(sourceBounds.width, 0); expect(help.join('')).toContain('Keyboard shortcuts'); expect(help.join('')).not.toContain('Preview'); }
});

test('native cross-group row stays at destination while its write is held and rolls back on failure', async () => {
  test.setTimeout(120000);
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await page.evaluate(() => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    (window as any).r9Statuses = plugin.settings.customStatuses;
    plugin.settings.customStatuses = plugin.settings.customStatuses.map((status: any) => status.value === 'in-progress' ? { ...status, label: 'Waiting on vendor' } : status);
    plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
  });
  await open('tasknotesTaskList');
  const root = page.locator('.workspace-leaf.mod-active .tn-tasknotesTaskList');
  const source = root.locator(`.task-card[data-task-path="${folder}/05.md"]`).first();
  await source.scrollIntoViewIfNeeded();
  const offset = await start(source.locator('[data-tn-drag-handle]'));
  await expect(page.locator('.task-list-view--moving')).toBeVisible();
  const destination = root.locator('.task-group[data-group-key="in-progress"]');
  await destination.scrollIntoViewIfNeeded();
  await moveTo(destination, offset);
  await expect(page.locator('.task-list-view__movement-feedback')).toBeVisible();
  const feedback = await page.locator('.task-list-view__movement-feedback').textContent();
  const forced = await root.evaluate(element => ({ lines: element.querySelectorAll('.task-list-view__drop-slot-before, .task-list-view__drop-slot-after').length, highlights: element.querySelectorAll('.task-list-view__move-target').length }));
  await page.evaluate(() => {
    const app = (window as any).app;
    const original = app.fileManager.processFrontMatter;
    (window as any).r9OriginalWrite = original;
    app.fileManager.processFrontMatter = async function(...args: any[]) {
      await new Promise<void>((resolve, reject) => { (window as any).r9ReleaseWrite = resolve; (window as any).r9FailWrite = () => reject(new Error('Round9 held write failed')); });
      return original.apply(this, args);
    };
  });
  await page.evaluate(path => {
    (window as any).r9FirstLanding = null;
    document.addEventListener('drop', () => {
      const dropped = performance.now();
      requestAnimationFrame(() => {
        const card = [...document.querySelectorAll<HTMLElement>('.workspace-leaf.mod-active .task-card')].find(element => element.dataset.taskPath === path);
        (window as any).r9FirstLanding = { ms: performance.now() - dropped, group: card?.parentElement?.querySelector<HTMLElement>('.task-group')?.dataset.groupKey, busy: card?.getAttribute('aria-busy') };
      });
    }, { once: true, capture: true });
  }, `${folder}/05.md`);
  try {
    pointer(['button', 0]);
    await expect.poll(() => page.evaluate(() => !!(window as any).r9ReleaseWrite)).toBe(true);
    const landing = await source.evaluate(element => ({ group: element.parentElement?.querySelector<HTMLElement>('.task-group')?.dataset.groupKey, busy: element.getAttribute('aria-busy') }));
    await expect.poll(() => page.evaluate(() => !!(window as any).r9FirstLanding)).toBe(true);
    const firstFrame = await page.evaluate(() => (window as any).r9FirstLanding);
    writeFileSync(join(evidence, 'list-cross-group.json'), JSON.stringify({ feedback, landing, forced, firstFrame }, null, 2));
    await page.screenshot({ path: join(evidence, 'list-cross-held.png') });
    await page.evaluate(() => { const app = (window as any).app; app.fileManager.processFrontMatter = (window as any).r9OriginalWrite; (window as any).r9FailWrite(); });
    await expect(page.locator('.tn-toast')).toContainText('Could not');
    const restored = root.locator(`.task-card[data-task-path="${folder}/05.md"]`).first();
    await expect.poll(() => restored.evaluate(element => element.parentElement?.querySelector<HTMLElement>('.task-group')?.dataset.groupKey)).toBe('open');
    if (!baseline) { expect(landing).toEqual({ group: 'in-progress', busy: 'true' }); expect(firstFrame.group).toBe('in-progress'); expect(firstFrame.busy).toBe('true'); expect(feedback).toBe('Waiting on vendor'); expect(forced.lines).toBe(0); }
  } finally {
    await page.evaluate(() => { const app = (window as any).app; if ((window as any).r9OriginalWrite) app.fileManager.processFrontMatter = (window as any).r9OriginalWrite; (window as any).r9ReleaseWrite?.(); });
  }
});

test('nested hover exposes only the child menu and rows use the normal cursor', async () => {
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await page.evaluate(async folder => {
    const app = (window as any).app;
    await app.vault.create(`${folder}/NestedParent.md`, '---\ntitle: Nested parent\ntags: [task]\nstatus: open\n---\n');
    await app.vault.create(`${folder}/NestedChild.md`, `---\ntitle: Nested child\ntags: [task]\nstatus: open\nprojects: ["[[${folder}/NestedParent]]"]\n---\n`);
  }, folder);
  await open('tasknotesTaskList');
  const parent = page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${folder}/NestedParent.md"]`).first();
  await expect(parent.locator('.task-card__chevron').first()).toBeVisible();
  await parent.locator('.task-card__chevron').first().click();
  const child = parent.locator('.task-card__subtasks .task-card').first();
  await expect(child).toBeVisible();
  const measurements = [];
  for (const theme of ['theme-light', 'theme-dark']) {
    await page.evaluate(theme => { document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(theme); }, theme);
    await child.scrollIntoViewIfNeeded();
    const bounds = (await child.boundingBox())!;
    const offset = await page.evaluate(() => ({ x: screenX, y: screenY + outerHeight - innerHeight }));
    pointer(['move', bounds.x + bounds.width / 2 + offset.x, bounds.y + 20 + offset.y]);
    await expect(parent).toHaveClass(/task-card--nested-interactive-hover/);
    if (!baseline) await expect.poll(() => parent.locator(':scope > .task-card__main-row .task-card__context-menu').evaluate(element => Number(getComputedStyle(element).opacity))).toBe(0);
    const measure = await parent.evaluate(element => ({
      parentMenu: Number(getComputedStyle(element.querySelector(':scope > .task-card__main-row .task-card__context-menu')!).opacity),
      childMenu: Number(getComputedStyle(element.querySelector('.task-card__subtasks .task-card__main-row .task-card__context-menu')!).opacity),
      cursor: getComputedStyle(element).cursor,
    }));
    measurements.push({ theme, ...measure });
    await page.screenshot({ path: join(evidence, `nested-${theme}.png`) });
    if (!baseline) { expect(measure.parentMenu).toBe(0); expect(measure.childMenu).toBeGreaterThan(0); expect(measure.cursor).not.toBe('grab'); }
  }
  writeFileSync(join(evidence, 'nested.json'), JSON.stringify(measurements, null, 2));
});
