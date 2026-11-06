import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
let today: string;
const folder = `AgendaComp3-${Date.now()}`;
const baseline = process.env.TASKNOTES_R7_BASELINE === '1';
const output = process.env.TASKNOTES_R7_OUTPUT ?? `/tmp/tasknotes-r7/agenda/${baseline ? 'before' : 'after'}`;
test.use({ trace: 'on' });

test.beforeAll(async () => {
  mkdirSync(output, { recursive: true });
  instance = await launchObsidian();
  today = await instance.page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    (window as any).agendaOriginalSettings = structuredClone(plugin.settings);
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    const nativeWindow = (window as any).require('electron').remote.getCurrentWindow();
    nativeWindow.setMinimumSize(320, 500);
    if (nativeWindow.isMaximized()) nativeWindow.unmaximize();
    const now = new Date();
    const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    await app.vault.createFolder(folder);
    const titles = ['Review release notes', 'Plan customer research', 'Send project update', 'Review the longer proposal with the entire accessibility and design team', 'No extra properties', 'Completed review', 'Unknown custom state'];
    for (const [index, title] of titles.entries()) {
      const dates = index === 2 ? `due: ${day}T11:00` : index === 4 ? `scheduled: ${day}` : `scheduled: ${day}T09:00\ndue: ${day}T17:00\ntimeEstimate: 60`;
      const extra = index === 3 ? '\ncontexts: [office, research]\nprojects: [Launch]\nrecurrence: DTSTART:20260101;FREQ=DAILY' : '';
      await app.vault.create(`${folder}/Task ${index}.md`, `---\ntitle: ${title}\ntags: [task${index === 3 ? ', design, product, research' : ''}]\nstatus: ${index === 5 ? 'done' : index === 6 ? 'custom-review' : 'open'}\npriority: ${index === 6 ? 'custom-priority' : 'normal'}\n${dates}${extra}\n---\n`);
    }
    const filters = { and: [`file.inFolder("${folder}")`] };
    await app.vault.create(`${folder}/Agenda.base`, JSON.stringify({ filters, views: [{ type: 'tasknotesCalendar', name: 'Agenda', calendarView: 'listWeek', showAgendaStrip: true, showMonthDayPanel: true, showOverdueOnToday: false, showRecurring: false, order: ['status', 'priority', 'scheduled', 'due', 'contexts', 'projects', 'file.tags'] }] }));
    await app.vault.create(`${folder}/Mini.base`, JSON.stringify({ filters, views: [{ type: 'tasknotesMiniCalendar', name: 'Mini', dateProperty: 'note.scheduled' }] }));
    const leaf = app.workspace.getLeaf(true);
    (window as any).agendaLeaf = leaf;
    await leaf.openFile(app.vault.getAbstractFileByPath(`${folder}/Agenda.base`));
    app.workspace.setActiveLeaf(leaf, { focus: true });
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    return day;
  }, folder);
  await expect(instance.page.locator('.workspace-leaf.mod-active .tnc-strip')).toBeVisible({ timeout: 20000 });
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await instance.page.evaluate(async folder => {
      const app = (window as any).app;
      app.plugins.plugins.tasknotes.settings = (window as any).agendaOriginalSettings;
      (window as any).agendaLeaf.detach();
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally { await closeObsidian(instance); }
});

async function settle() {
  await instance.page.locator('.workspace-leaf.mod-active #bases-calendar').evaluate(async element => {
    await Promise.all(element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running' && animation instanceof CSSAnimation && animation.animationName === 'tn-calendar-view-enter').map(animation => animation.finished.catch(() => undefined)));
  });
}

async function capture(options: { path: string }) {
  await instance.page.locator('.notice').filter({ hasText: 'Secrets are stored without encryption' }).evaluateAll(elements => elements.forEach(element => element.remove()));
  await instance.page.screenshot(options);
}

async function mode(view: string) {
  await instance.page.evaluate(({ view, today }) => (window as any).agendaLeaf.view.controller.view.calendar.changeView(view, today), { view, today });
  const persisted = ({ month: 'dayGridMonth', list: 'listWeek' } as Record<string, string>)[view];
  await expect.poll(() => instance.page.evaluate(async folder => {
    const app = (window as any).app;
    return app.vault.read(app.vault.getAbstractFileByPath(`${folder}/Agenda.base`));
  }, folder)).toMatch(new RegExp(`calendarView["']?:\\s*["']?${persisted}`));
  await expect.poll(() => instance.page.evaluate(() => {
    const view = (window as any).agendaLeaf.view.controller.view;
    return Boolean(view._saveViewTypeTimer || view._isRendering || view._pendingRender || view._configChangedNeedsRecreate);
  })).toBe(false);
  await expect(instance.page.locator(`.workspace-leaf.mod-active #bases-calendar > .tnc--${view}`)).toBeVisible();
  await settle();
}

test('agenda and selected-day rows keep a compact aligned reading lane', async () => {
  test.setTimeout(180000);
  const page = instance.page;
  const measurements = [];
  for (const theme of ['light', 'dark']) {
    for (const width of [1180, 700, 400]) {
      await setObsidianViewport(page, { width, height: 800 });
      await page.evaluate(({ theme, width }) => {
        document.body.classList.remove('theme-light', 'theme-dark', 'is-mobile');
        document.body.classList.add(`theme-${theme}`);
        document.body.classList.toggle('is-mobile', width === 400);
        document.querySelectorAll('.notice, .tooltip').forEach(element => element.remove());
      }, { theme, width });
      for (const surface of ['list', 'month']) {
        await mode(surface);
        if (surface === 'month') await page.locator(`.tnc-dg-day[data-date="${today}"] .tnc-dg-num`).click();
        const root = surface === 'list' ? page.locator('#bases-calendar > .tnc') : page.locator('.tn-calendar-day-panel');
        if (surface === 'month') await root.locator('.tnc-list-day').scrollIntoViewIfNeeded();
        const rows = root.locator('.tn-calendar-list-entry');
        await expect(rows.first()).toBeVisible();
        await settle();
        await page.mouse.move(0, 0);
        const geometry = await rows.evaluateAll(rows => rows.map(row => {
          const title = row.querySelector('.task-card__title-text')!.getBoundingClientRect();
          const bounds = row.getBoundingClientRect();
          return { height: bounds.height, titleX: title.x, titleY: title.y, text: row.textContent, visible: title.top >= 0 && title.bottom <= innerHeight };
        }));
        measurements.push({ theme, width, surface, geometry });
        writeFileSync(`${output}/measurements.json`, JSON.stringify(measurements, null, 2));
        await capture({ path: `${output}/${surface}-${theme}-${width}.png` });
        if (baseline) continue;
        if (surface === 'list') {
          expect(geometry[0].titleY).toBeLessThan(width === 400 ? 320 : 340);
          expect(geometry.filter(row => row.visible).length).toBeGreaterThanOrEqual(width === 400 ? 6 : 5);
        }
        expect(geometry.filter(row => !row.text?.includes('longer proposal')).every(row => row.height <= 76)).toBe(true);
        expect(new Set(geometry.map(row => Math.round(row.titleX))).size).toBe(1);
        const controls = await root.locator('.tn-calendar-list-entry :is(button, a, [role="button"])').evaluateAll(elements => elements.filter(element => element.getClientRects().length).map(element => {
          const bounds = element.getBoundingClientRect();
          const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
          return { label: element.getAttribute('aria-label'), classes: element.className, hitClasses: hit?.className, width: bounds.width, height: bounds.height, onscreen: bounds.top >= 0 && bounds.bottom <= innerHeight, hit: hit === element || element.contains(hit) };
        }));
        writeFileSync(`${output}/controls-${surface}-${theme}-${width}.json`, JSON.stringify(controls, null, 2));
        expect(controls.filter(control => control.onscreen).every(control => control.width >= 40 && control.height >= 40 && control.hit)).toBe(true);
        const scheduled = root.locator('[data-event-type="scheduled"][data-task-path$="Task 0.md"]').first();
        await expect(scheduled.locator('.tn-calendar-list-stamp[data-event-type="scheduled"]')).toHaveAccessibleName(/^Scheduled:/);
        const due = root.locator('[data-event-type="due"][data-task-path$="Task 2.md"]').first();
        await expect(due.locator('.tn-calendar-list-stamp')).toHaveAccessibleName(/^Deadline:/);
      }
    }
  }
  writeFileSync(`${output}/measurements.json`, JSON.stringify(measurements, null, 2));
});

test('agenda preserves navigation, hit targets and pointer/keyboard states', async () => {
  test.setTimeout(180000);
  const page = instance.page;
  for (const theme of ['light', 'dark']) for (const width of [1180, 400]) {
    await setObsidianViewport(page, { width, height: 800 });
    await page.evaluate(({ theme, width }) => {
      document.body.classList.remove('theme-light', 'theme-dark', 'is-mobile');
      document.body.classList.add(`theme-${theme}`);
      document.body.classList.toggle('is-mobile', width === 400);
      (window as any).app.plugins.plugins.tasknotes.taskSelectionService.clearSelection();
      document.querySelectorAll('.notice, .tooltip').forEach(element => element.remove());
    }, { theme, width });
    await mode('list');
    const prefix = `${output}/${theme}-${width}`;
    const strip = page.locator('.tnc-strip');
    const title = strip.locator('.tnc-strip-title');
    if (!baseline && width === 400) {
      await expect(strip.locator('.tnc-strip-prev')).toBeHidden();
      await expect(strip.locator('.tnc-strip-next')).toBeHidden();
      const titleBounds = (await title.boundingBox())!;
      const switcherBounds = (await page.locator('#bases-calendar > .tnc .tnc-toolbar-view-select').boundingBox())!;
      expect(Math.abs(titleBounds.y + titleBounds.height / 2 - switcherBounds.y - switcherBounds.height / 2)).toBeLessThan(3);
    }
    await title.click();
    await expect(title).toHaveAttribute('aria-expanded', 'true');
    await expect(strip.locator('.tnc-strip-next')).toBeVisible();
    await capture({ path: `${prefix}-strip-expanded.png` });
    await title.click();
    const selectedDay = strip.locator('[aria-pressed="true"]');
    const selectedDate = await selectedDay.getAttribute('data-date');
    await page.keyboard.press('Tab');
    await selectedDay.focus();
    await capture({ path: `${prefix}-strip-focus.png` });
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(strip.locator('[aria-pressed="true"]')).not.toHaveAttribute('data-date', selectedDate!);
    await mode('list');
    if (width === 400) {
      const touchDay = strip.locator('[aria-pressed="true"]').locator('..').locator('.tnc-strip-day').last();
      const touchDate = await touchDay.getAttribute('data-date');
      const bounds = (await touchDay.boundingBox())!;
      const session = await page.context().newCDPSession(page);
      await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect(strip.locator('[aria-pressed="true"]')).toHaveAttribute('data-date', touchDate!);
      await capture({ path: `${prefix}-strip-touch.png` });
      await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
      await session.detach();
      await mode('list');
    }
    const row = page.locator('.tnc-item--list[data-event-type="scheduled"][data-task-path$="Task 0.md"]').first();
    await row.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await capture({ path: `${prefix}-row-rest.png` });
    const before = await row.boundingBox();
    await row.hover();
    await settle();
    await capture({ path: `${prefix}-row-hover.png` });
    expect(await row.boundingBox()).toEqual(before);
    await page.evaluate(() => (window as any).agendaLeaf.view.controller.view.calendar.rerender());
    await expect.poll(() => row.evaluate(element => element.matches(':hover'))).toBe(true);
    if (!baseline) expect(await page.locator('#bases-calendar > .tnc > .tnc-view').evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running' && animation instanceof CSSAnimation && animation.animationName === 'tn-calendar-view-enter').length)).toBe(0);
    await settle();
    expect(await row.boundingBox()).toEqual(before);
    await page.keyboard.press('Tab');
    await row.focus();
    await capture({ path: `${prefix}-row-focus.png` });
    const status = row.locator('.task-card__status-dot');
    const originalStatus = await page.evaluate(async folder => (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(`${folder}/Task 0.md`).then((task: any) => task.status), folder);
    await status.click();
    await expect.poll(() => page.evaluate(async folder => (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(`${folder}/Task 0.md`).then((task: any) => task.status), folder)).not.toBe(originalStatus);
    await expect(page.locator('.tn-picker')).toHaveCount(0);
    await status.click({ modifiers: ['Shift'] });
    await expect.poll(() => page.evaluate(async folder => (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(`${folder}/Task 0.md`).then((task: any) => task.status), folder)).toBe(originalStatus);
    for (const multi of [false, true]) {
      await page.evaluate(({ folder, multi }) => {
        const selection = (window as any).app.plugins.plugins.tasknotes.taskSelectionService;
        selection.clearSelection();
        if (multi) {
          selection.toggleSelection(`${folder}/Task 0.md`);
          selection.toggleSelection(`${folder}/Task 1.md`);
        }
      }, { folder, multi });
      await row.hover();
      await capture({ path: `${prefix}-row-${multi ? 'selected-hover' : 'unselected'}.png` });
      if (multi) {
        await page.keyboard.press('Tab');
        await row.focus();
        await capture({ path: `${prefix}-row-selected-focus.png` });
      }
      await row.scrollIntoViewIfNeeded();
      const stamp = (await row.locator('.tn-calendar-list-stamp').boundingBox())!;
      await page.mouse.move(stamp.x + 12, stamp.y + 8);
      await page.mouse.down();
      await capture({ path: `${prefix}-row-pressed.png` });
      await page.mouse.move(stamp.x + 12, stamp.y + 30, { steps: 5 });
      await expect(page.locator('.tnc-dragging')).toHaveCount(1);
      if (multi) await expect(page.locator('.tnc-drag-preview')).toHaveAttribute('data-drag-count', '2');
      await capture({ path: `${prefix}-${multi ? 'multi' : 'single'}-drag.png` });
      await page.keyboard.press('Escape');
      await page.mouse.up();
      await expect(page.locator('.tnc-dragging, .tnc-drag-preview')).toHaveCount(0);
      await capture({ path: `${prefix}-drag-cancelled.png` });
    }
    await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.taskSelectionService.clearSelection());
    if (!baseline) {
      await page.evaluate(() => {
        const view = (window as any).agendaLeaf.view.controller.view;
        (window as any).agendaVisibleProperties = view.getVisibleProperties;
        view.getVisibleProperties = () => ['status'];
        view.calendar.rerender();
      });
      const plain = page.locator('.tnc-item--list[data-task-path$="Task 4.md"]').first();
      await plain.scrollIntoViewIfNeeded();
      await expect(plain.locator('.task-card__metadata')).toBeHidden();
      expect((await plain.boundingBox())!.height).toBeLessThanOrEqual(45);
      await capture({ path: `${prefix}-no-metadata.png` });
      await page.evaluate(() => {
        const view = (window as any).agendaLeaf.view.controller.view;
        view.getVisibleProperties = (window as any).agendaVisibleProperties;
        view.calendar.rerender();
      });
    }
    await mode('month');
    await page.locator(`.tnc-dg-day[data-date="${today}"] .tnc-dg-num`).click();
    const panel = page.locator('.tn-calendar-day-panel');
    const panelRow = panel.locator('[data-event-type="scheduled"][data-task-path$="Task 0.md"]').first();
    if (baseline) await panelRow.evaluate(element => element.scrollIntoView({ block: 'nearest', behavior: 'instant' }));
    else await panelRow.scrollIntoViewIfNeeded();
    await panelRow.hover();
    await capture({ path: `${prefix}-panel-hover.png` });
    await page.keyboard.press('Tab');
    await panelRow.focus();
    await capture({ path: `${prefix}-panel-focus.png` });
    await panelRow.locator('.task-card__context-menu').click({ force: baseline });
    await expect(page.locator('.menu')).toBeVisible();
    await page.keyboard.press('Escape');
  }
});

test('agenda and day-panel rows retain transaction, invalid-drag and empty states', async () => {
  test.setTimeout(180000);
  const page = instance.page;
  for (const theme of ['light', 'dark']) for (const width of [1180, 400]) for (const surface of ['list', 'month']) {
    await setObsidianViewport(page, { width, height: 800 });
    await page.evaluate(({ theme, width }) => {
      document.body.classList.remove('theme-light', 'theme-dark', 'is-mobile');
      document.body.classList.add(`theme-${theme}`);
      document.body.classList.toggle('is-mobile', width === 400);
      document.querySelectorAll('.notice, .tooltip').forEach(element => element.remove());
    }, { theme, width });
    await mode(surface);
    if (surface === 'month') await page.locator(`.tnc-dg-day[data-date="${today}"] .tnc-dg-num`).click();
    const root = surface === 'list' ? page.locator('#bases-calendar > .tnc') : page.locator('.tn-calendar-day-panel');
    const row = root.locator('[data-event-type="scheduled"][data-task-path$="Task 0.md"]').first();
    const prefix = `${output}/${theme}-${width}-${surface}`;
    await page.evaluate(surface => {
      const view = (window as any).agendaLeaf.view.controller.view;
      const calendar = surface === 'list' ? view.calendar : view.dayPanel;
      (window as any).agendaStateCalendar = calendar;
      (window as any).agendaStateOptions = calendar.getOptions();
      (window as any).agendaStateItems = view.calendarItems;
      calendar.setOptions({ onRangeChange: undefined, onViewChange: undefined, onItemDrop: () => new Promise<void>(resolve => { (window as any).agendaResolveWrite = resolve; }) });
    }, surface);
    await settle();
    await row.scrollIntoViewIfNeeded();
    if (surface === 'list') {
      await row.focus();
      await page.keyboard.press('Alt+ArrowDown');
      await expect(row).toHaveAttribute('aria-busy', 'true');
      await row.hover();
      await capture({ path: `${prefix}-pending.png` });
      await page.evaluate(() => (window as any).agendaResolveWrite());
      await expect(row).toHaveClass(/is-write-changed/);
      await capture({ path: `${prefix}-settled.png` });
      await page.evaluate(() => (window as any).agendaStateCalendar.setOptions({ onItemDrop: (arg: any) => arg.revert() }));
      await settle();
      await row.focus();
      await page.keyboard.press('Alt+ArrowDown');
      await expect(row).toHaveClass(/is-write-failed/);
      await capture({ path: `${prefix}-failed.png` });
      await page.evaluate(() => {
        const view = (window as any).agendaLeaf.view.controller.view;
        (window as any).agendaStateCalendar.setItems(view.calendarItems.map((item: any) => ({ ...item, editable: false, startEditable: false, durationEditable: false })));
      });
      await settle();
      await expect(row).not.toHaveClass(/is-draggable/);
      const stamp = await row.locator('.tn-calendar-list-stamp').textContent();
      await row.focus();
      await page.keyboard.press('Alt+ArrowDown');
      await expect(row.locator('.tn-calendar-list-stamp')).toHaveText(stamp!);
      await capture({ path: `${prefix}-move-disabled.png` });
      await page.evaluate(() => {
        (window as any).agendaStateCalendar.setOptions({ canDrop: () => false });
        (window as any).agendaStateCalendar.setItems((window as any).agendaLeaf.view.controller.view.calendarItems);
      });
      await settle();
      await row.scrollIntoViewIfNeeded();
      const bounds = (await row.locator('.tn-calendar-list-stamp').boundingBox())!;
      await page.mouse.move(bounds.x + 8, bounds.y + 8);
      await page.mouse.down();
      await page.mouse.move(bounds.x + 8, bounds.y + 35, { steps: 6 });
      await expect(page.locator('.tnc-drop-denied')).toHaveCount(1);
      await capture({ path: `${prefix}-invalid-drop.png` });
      const scrollBefore = await row.evaluate(element => {
        for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
          if (ancestor.scrollHeight > ancestor.clientHeight + 1 && /auto|scroll|overlay/.test(getComputedStyle(ancestor).overflowY)) {
            (window as any).agendaDragScroller = ancestor;
            return ancestor.scrollTop;
          }
        }
        throw new Error('No scrollable agenda ancestor');
      });
      const edge = await row.evaluate(element => {
        const bounds = (window as any).agendaDragScroller.getBoundingClientRect();
        const root = element.closest('.tnc')!;
        const centerX = bounds.x + bounds.width / 2;
        for (let edgeY = Math.min(innerHeight - 2, bounds.bottom - 2); edgeY > bounds.top; edgeY -= 2) {
          if (root.contains(document.elementFromPoint(centerX, edgeY))) return { x: centerX, y: edgeY };
        }
        throw new Error('No visible calendar scroll edge');
      });
      await page.mouse.move(edge.x, edge.y, { steps: 5 });
      if (baseline) {
        const observedScroll = await page.evaluate(async () => {
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          return (window as any).agendaDragScroller.scrollTop;
        });
        writeFileSync(`${prefix}-autoscroll.json`, JSON.stringify({ scrollBefore, observedScroll }));
      } else await expect.poll(() => page.evaluate(() => (window as any).agendaDragScroller.scrollTop)).toBeGreaterThan(scrollBefore);
      await capture({ path: `${prefix}-drag-autoscroll.png` });
      await page.keyboard.press('Escape');
      await page.mouse.up();
      await expect(page.locator('.tnc-dragging, .tnc-drag-preview, .tnc-drop-denied')).toHaveCount(0);
    } else {
      await expect(row).not.toHaveClass(/is-draggable/);
      const stamp = await row.locator('.tn-calendar-list-stamp').textContent();
      await row.focus();
      await page.keyboard.press('Alt+ArrowDown');
      await expect(row.locator('.tn-calendar-list-stamp')).toHaveText(stamp!);
      await capture({ path: `${prefix}-move-disabled.png` });
    }
    await page.evaluate(() => {
      const view = (window as any).agendaLeaf.view.controller.view;
      view.calendarItems = [(window as any).agendaStateItems.find((item: any) => item.data?.eventType === 'scheduled' && item.data?.taskInfo?.path.endsWith('/Task 0.md'))];
      (window as any).agendaStateCalendar.setItems(view.calendarItems);
    });
    await expect(root.locator('.tn-calendar-list-entry')).toHaveCount(1);
    await capture({ path: `${prefix}-single-item.png` });
    await page.evaluate(() => {
      (window as any).agendaLeaf.view.controller.view.calendarItems = [];
      (window as any).agendaStateCalendar.setItems([]);
    });
    await expect(root.locator('.tn-calendar-list-entry')).toHaveCount(0);
    await capture({ path: `${prefix}-empty.png` });
    await page.evaluate(() => {
      const calendar = (window as any).agendaStateCalendar;
      (window as any).agendaLeaf.view.controller.view.calendarItems = (window as any).agendaStateItems;
      calendar.setOptions((window as any).agendaStateOptions);
      calendar.setItems((window as any).agendaLeaf.view.controller.view.calendarItems);
    });
  }
});
