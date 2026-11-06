import { test, expect, type Locator } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
let today: string;
let tomorrow: string;
const folder = `CalendarR7-${Date.now()}`;
const baseline = process.env.TASKNOTES_R7_BASELINE === '1';
const output = process.env.TASKNOTES_E2E_EVIDENCE_DIR ? `${process.env.TASKNOTES_E2E_EVIDENCE_DIR}/composition` : `/tmp/tasknotes-r7/${process.env.TASKNOTES_R7_SLICE ?? 'w'}/${baseline ? 'before' : 'after'}`;
test.use({ trace: 'on' });

test.beforeAll(async () => {
  mkdirSync(output, { recursive: true });
  instance = await launchObsidian();
  const dates = await instance.page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    (window as any).r7Settings = JSON.parse(JSON.stringify(plugin.settings));
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    const day = (offset: number) => {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    await app.vault.createFolder(folder);
    const titles = ['Write release notes with the entire product team', 'Review calendar interaction details', 'Prepare customer research', 'Plan accessibility fixes', 'Send weekly project update'];
    for (const [index, title] of titles.entries()) {
      await app.vault.create(`${folder}/Task ${index}.md`, `---\ntitle: ${title}\ntags: [task, design]\nstatus: ${index === 4 ? 'unknown-status' : 'open'}\npriority: ${index === 4 ? 'unknown-priority' : 'normal'}\nscheduled: ${day(0)}T10:00\ndue: ${day(1)}\ntimeEstimate: 60\n${index === 0 ? `timeEntries:\n  - startTime: '${new Date(`${day(0)}T10:00`).toISOString()}'\n    endTime: '${new Date(`${day(0)}T10:30`).toISOString()}'\n` : ''}---\n`);
    }
    await app.vault.create(`${folder}/Adjacent.md`, `---\ntitle: Follow up after the review\ntags: [task]\nstatus: open\nscheduled: ${day(0)}T11:00\ntimeEstimate: 60\n---\n`);
    await app.vault.create(`${folder}/Tomorrow.md`, `---\ntitle: Tomorrow's single task\ntags: [task]\nstatus: open\nscheduled: ${day(1)}T09:00\ntimeEstimate: 30\n---\n`);
    await app.vault.create(`${folder}/Calendar.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\nviews:\n  - type: tasknotesCalendar\n    name: Calendar composition\n    calendarView: timeGridWeek\n    showMonthDayPanel: true\n    showTimeEntries: true\n    showOverdueOnToday: false\n    slotMinTime: '08:00:00'\n    slotMaxTime: '18:00:00'\n    order: [status, priority, due, file.tags]\n`);
    await app.vault.create(`${folder}/Mini.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\nviews:\n  - type: tasknotesMiniCalendar\n    name: Mini calendar\n    dateProperty: note.scheduled\n`);
    const leaf = app.workspace.getLeaf(true);
    (window as any).r7Leaf = leaf;
    await leaf.openFile(app.vault.getAbstractFileByPath(`${folder}/Calendar.base`));
    app.workspace.setActiveLeaf(leaf, { focus: true });
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    return { today: day(0), tomorrow: day(1) };
  }, folder);
  today = dates.today;
  tomorrow = dates.tomorrow;
  await expect(instance.page.locator('.workspace-leaf.mod-active .tnc')).toBeVisible({ timeout: 20000 });
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await instance.page.evaluate(async folder => {
      const app = (window as any).app;
      app.plugins.plugins.tasknotes.settings = (window as any).r7Settings;
      (window as any).r7Leaf.detach();
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
      document.body.classList.remove('is-mobile');
    }, folder);
  } finally { await closeObsidian(instance); }
});

test('council: invalid releases never persist the last valid proposal', async () => {
  test.setTimeout(120000);
  const page = instance.page;
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await page.evaluate(() => document.body.classList.remove('is-mobile'));
  const evidence = [];
  for (const view of ['day', 'week', 'days', 'month']) {
    await mode(view);
    const filename = view === 'month' ? 'Task 3.md' : 'Adjacent.md';
    const target = page.locator(`.workspace-leaf.mod-active .tnc-item[data-event-type="scheduled"][data-task-path$="${filename}"]`).first();
    await target.scrollIntoViewIfNeeded();
    const initial = await page.evaluate(async ({ folder, filename }) => {
      const app = (window as any).app;
      return app.vault.read(app.vault.getAbstractFileByPath(`${folder}/${filename}`));
    }, { folder, filename });
    const bounds = (await target.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 8);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 38, { steps: 8 });
    await page.mouse.move(20, 105, { steps: 12 });
    const invalid = await page.locator('.workspace-leaf.mod-active .tnc').first().evaluate(element => element.classList.contains('tnc-drop-denied'));
    await capture(`council-${view}-outside-held`);
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => Boolean((window as any).r7Leaf.view.controller.view.calendar.session))).toBe(false);
    const final = await page.evaluate(async ({ folder, filename }) => {
      const app = (window as any).app;
      return app.vault.read(app.vault.getAbstractFileByPath(`${folder}/${filename}`));
    }, { folder, filename });
    evidence.push({ view, invalid, changed: initial !== final });
    if (!baseline) { expect(invalid).toBe(true); expect(final).toBe(initial); }
    if (initial !== final) {
      await page.evaluate(async ({ folder, filename, initial }) => {
        const app = (window as any).app;
        await app.vault.modify(app.vault.getAbstractFileByPath(`${folder}/${filename}`), initial);
        await (window as any).r7Leaf.view.controller.view.refreshCalendarWithFreshData();
      }, { folder, filename, initial });
    }
  }
  writeFileSync(`${output}/council-outside-drop.json`, JSON.stringify(evidence, null, 2));
});

test('council: year targets, strip scrolling, short tracked items and empty-day heading', async () => {
  test.setTimeout(180000);
  const page = instance.page;
  const evidence = [];
  for (const theme of ['light', 'dark']) for (const width of [1180, 400]) {
    await setObsidianViewport(page, { width, height: 800 });
    for (const mobile of width === 400 ? [false, true] : [false]) {
      await page.evaluate(({ theme, mobile }) => {
        document.body.classList.remove('theme-light', 'theme-dark', 'is-mobile');
        document.body.classList.add(`theme-${theme}`);
        document.body.classList.toggle('is-mobile', mobile);
      }, { theme, mobile });
      await mode('year');
      const year = await page.locator('.workspace-leaf.mod-active .tnc-year').evaluate(element => {
        const months = Array.from(element.querySelectorAll('.tnc-ym'));
        return {
          overflow: element.scrollWidth > element.clientWidth + 1,
          overlaps: months.some(month => Array.from(month.querySelectorAll('.tnc-ym-day')).some(day => day.getBoundingClientRect().right > month.getBoundingClientRect().right + 1)),
          minTarget: Math.min(...Array.from(element.querySelectorAll('.tnc-ym-day')).map(day => day.getBoundingClientRect().width)),
          shadow: getComputedStyle(element.querySelector('.tnc-ym-day')!).boxShadow,
          emptyBackground: getComputedStyle(element.querySelector('.tnc-ym-day:not(.has-items)')!).backgroundColor,
          titleBackground: getComputedStyle(element.querySelector('.tnc-ym-title')!).backgroundColor,
          surfaceBackground: getComputedStyle(element.closest('.tnc')!).backgroundColor,
        };
      });
      evidence.push({ theme, width, mobile, year });
      await capture(`council-${theme}-${width}-${mobile ? 'mobile' : 'desktop'}-year`);
      if (!baseline) { expect(year.overflow).toBe(false); expect(year.overlaps).toBe(false); expect(year.minTarget).toBeGreaterThanOrEqual(40); expect(year.shadow).toBe('none'); expect(year.emptyBackground).toMatch(/(?:rgba\(0, 0, 0, 0\)|\/ 0\))$/); expect(year.titleBackground).toBe(year.surfaceBackground); expect(year.titleBackground).not.toBe('rgba(0, 0, 0, 0)'); }
    }
    await mode('list');
    const toolbar = page.locator('.workspace-leaf.mod-active .tnc-toolbar').first();
    const before = await toolbar.boundingBox();
    await page.locator(`.workspace-leaf.mod-active .tnc-strip-day[data-date="${tomorrow}"]`).click();
    const after = await toolbar.boundingBox();
    evidence.push({ theme, width, toolbarBefore: before?.y, toolbarAfter: after?.y });
    await capture(`council-${theme}-${width}-strip-select`);
    if (!baseline) expect(after?.y).toBe(before?.y);
    await mode('month');
    const empty = await page.evaluate(today => {
      const date = new Date(`${today}T12:00`); date.setDate(date.getDate() + 3);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }, today);
    await page.evaluate(empty => (window as any).r7Leaf.view.controller.view.selectMonthDay(empty), empty);
    const heading = page.locator('.tn-calendar-day-panel .tnc-list-day');
    const panel = await page.locator('.tn-calendar-day-panel').boundingBox();
    evidence.push({ theme, width, emptyHeading: await heading.count(), panelY: panel?.y });
    await capture(`council-${theme}-${width}-empty-month`);
    if (!baseline) {
      await expect(heading).toBeVisible(); expect(panel!.y).toBeLessThan(700);
      await expect(page.locator('.tn-calendar-day-panel .tnc-list-empty')).toHaveCount(1);
      await page.evaluate(() => {
        const view = (window as any).r7Leaf.view.controller.view;
        (window as any).councilCreateFile = view.createFileForView;
        view.createFileForView = async (_parent: unknown, transform: (frontmatter: any) => void) => {
          const frontmatter = {}; transform(frontmatter); (window as any).councilCreated = frontmatter;
        };
      });
      try {
        await page.locator('.tn-calendar-day-panel-add').click();
        expect(await page.evaluate(() => (window as any).councilCreated.scheduled)).toBe(empty);
      } finally {
        await page.evaluate(() => { (window as any).r7Leaf.view.controller.view.createFileForView = (window as any).councilCreateFile; });
      }
    }
    await mode('day', today);
    await page.evaluate(({ folder, today }) => {
      const view = (window as any).r7Leaf.view.controller.view;
      const source = view.calendarItems.find((item: any) => item.data?.eventType === 'timeEntry');
      if (!source) throw new Error('Missing tracked fixture');
      view.calendar.upsertItems([{ ...source, id: 'council-short-tracked', start: `${today}T12:00:00`, end: `${today}T12:30:00`, data: { ...source.data, taskInfo: { ...source.data.taskInfo, path: `${folder}/Tracked.md`, title: 'Short tracked review' } }, title: 'Short tracked review' }]);
    }, { folder, today });
    const tracked = page.locator('[data-id="council-short-tracked"]');
    await tracked.scrollIntoViewIfNeeded();
    await capture(`council-${theme}-${width}-short-tracked`);
    const short = await tracked.evaluate(element => ({ compact: element.classList.contains('is-short'), label: element.getAttribute('aria-label'), title: element.querySelector('.tnc-item-title')?.getBoundingClientRect().toJSON(), box: element.getBoundingClientRect().toJSON() }));
    evidence.push({ theme, width, short });
    if (!baseline) { expect(short.compact).toBe(true); expect(short.title!.height).toBeLessThan(24); expect(short.title!.bottom).toBeLessThanOrEqual(short.box.bottom + 1); expect(short.label).toContain('30 min tracked'); expect(short.label).toMatch(/12:00.*12:30/); expect(short.label).not.toContain('Estimate'); }
  }
  writeFileSync(`${output}/council-layout.json`, JSON.stringify(evidence, null, 2));
});

test('council: timeblock Undo restores the rendered move and duration', async () => {
  test.setTimeout(120000);
  const page = instance.page;
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await page.evaluate(async ({ folder, today }) => {
    document.body.classList.remove('is-mobile');
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const daily = app.internalPlugins.getEnabledPluginById('daily-notes');
    (window as any).councilDailyFolder = daily.options.folder;
    daily.options.folder = folder;
    plugin.settings.calendarViewSettings.enableTimeblocking = true;
    await app.vault.create(`${folder}/${today}.md`, `---\ntimeblocks:\n  - id: council-undo\n    title: Calendar focus\n    startTime: '13:00'\n    endTime: '14:00'\n---\n`);
  }, { folder, today });
  const evidence = [];
  try {
    await expect.poll(() => page.evaluate(({ folder, today }) => {
      const app = (window as any).app;
      return app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(`${folder}/${today}.md`))?.frontmatter?.timeblocks?.[0];
    }, { folder, today })).toMatchObject({ id: 'council-undo', startTime: '13:00', endTime: '14:00' });
    await mode('day');
    await page.evaluate(async () => {
      const view = (window as any).r7Leaf.view.controller.view;
      view.viewOptions.showTimeblocks = true;
      await view.refreshCalendarWithFreshData();
    });
    await expect.poll(() => page.evaluate(async () => {
      const view = (window as any).r7Leaf.view.controller.view;
      await view.refetchEvents();
      return view.calendar.getItem('timeblock-council-undo')?.data.timeblock;
    }), { timeout: 15000 }).toMatchObject({ startTime: '13:00', endTime: '14:00' });
    const block = page.locator('[data-id="timeblock-council-undo"]');
    await expect(block).toBeVisible();
    for (const action of ['resize', 'move']) {
      const before = (await block.boundingBox())!;
      const handle = action === 'resize' ? block.locator('.tnc-resize-end') : block;
      await handle.hover();
      const target = (await handle.boundingBox())!;
      const point = { x: target.x + target.width / 2, y: action === 'resize' ? target.y + target.height / 2 : target.y + 8 };
      await page.mouse.move(point.x, point.y); await page.mouse.down();
      await page.mouse.move(point.x, point.y + before.height / 2, { steps: 12 }); await page.mouse.up();
      await expect(page.locator('.tn-toast button').filter({ hasText: 'Undo' })).toBeVisible();
      await capture(`council-timeblock-${action}-changed`);
      await page.locator('.tn-toast button').filter({ hasText: 'Undo' }).click();
      await expect.poll(() => page.evaluate(async ({ folder, today }) => {
        const app = (window as any).app;
        return app.vault.read(app.vault.getAbstractFileByPath(`${folder}/${today}.md`));
      }, { folder, today })).toContain('14:00');
      if (!baseline) await expect.poll(() => page.evaluate(() => (window as any).r7Leaf.view.controller.view.calendar.getItem('timeblock-council-undo')?.data.timeblock)).toMatchObject({ startTime: '13:00', endTime: '14:00' });
      await capture(`council-timeblock-${action}-undone`);
      const rendered = await page.evaluate(() => (window as any).r7Leaf.view.controller.view.calendar.getItem('timeblock-council-undo'));
      evidence.push({ action, before, after: await block.boundingBox(), rendered });
      if (!baseline) { expect(rendered.data.timeblock.startTime).toBe('13:00'); expect(rendered.data.timeblock.endTime).toBe('14:00'); }
      await page.evaluate(async () => (window as any).r7Leaf.view.controller.view.refreshCalendarWithFreshData());
    }
  } finally {
    await page.evaluate(() => {
      const app = (window as any).app;
      app.internalPlugins.getEnabledPluginById('daily-notes').options.folder = (window as any).councilDailyFolder;
    });
    writeFileSync(`${output}/council-timeblock-undo.json`, JSON.stringify(evidence, null, 2));
  }
});

async function mode(view: string, date?: string) {
  await instance.page.evaluate(({ view, date }) => (window as any).r7Leaf.view.controller.view.calendar.changeView(view, date), { view, date });
  const persisted = ({ month: 'dayGridMonth', week: 'timeGridWeek', day: 'timeGridDay', list: 'listWeek' } as Record<string, string>)[view];
  if (persisted) await expect.poll(() => instance.page.evaluate(async folder => {
    const app = (window as any).app;
    return app.vault.read(app.vault.getAbstractFileByPath(`${folder}/Calendar.base`));
  }, folder)).toContain(`calendarView: ${persisted}`);
  await expect.poll(() => instance.page.evaluate(() => Boolean((window as any).r7Leaf.view.controller.view._saveViewTypeTimer))).toBe(false);
  const effective = view === 'week' && await instance.page.locator('.advanced-calendar-view').first().evaluate(element => element.clientWidth < 640) ? 'days' : view;
  await expect(instance.page.locator(`.workspace-leaf.mod-active > .workspace-leaf-content .tnc--${effective}`).first()).toBeVisible();
  await instance.page.locator('.workspace-leaf.mod-active #bases-calendar').evaluate(async element => {
    await Promise.all(element.getAnimations({ subtree: true })
      .filter(animation => animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity)
      .map(animation => animation.finished.catch(() => undefined)));
  });
}

async function capture(name: string) {
  if (/-(rest|agenda|month)$/.test(name)) {
    await instance.page.evaluate(() => document.querySelectorAll('.tooltip').forEach(element => element.remove()));
  }
  if (/-(agenda|month)$/.test(name)) {
    await instance.page.evaluate(() => {
      let ancestor = document.querySelector('.workspace-leaf.mod-active .tnc-toolbar');
      while (ancestor) {
        ancestor.scrollTop = 0;
        ancestor = ancestor.parentElement;
      }
    });
  }
  const viewport = instance.page.viewportSize()!;
  await instance.page.screenshot({ path: `${output}/${name}.png`, clip: { x: 0, y: 0, ...viewport } });
}

async function states(target: Locator, name: string, drag = false) {
  const page = instance.page;
  await target.scrollIntoViewIfNeeded();
  await page.mouse.move(5, 5);
  await capture(`${name}-rest`);
  const before = await target.boundingBox();
  await target.hover();
  await capture(`${name}-hover`);
  expect(await target.boundingBox()).toEqual(before);
  if (!baseline && name.endsWith('-agenda-row')) {
    const peers = page.locator('.workspace-leaf.mod-active .tnc-item--list');
    for (let index = 0; index < Math.min(4, await peers.count()); index++) {
      const bounds = await peers.nth(index).boundingBox();
      if (bounds && bounds.y >= 0 && bounds.y + bounds.height < 800) {
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      }
    }
    await target.hover();
    const background = await target.evaluate(async element => {
      await Promise.all(element.getAnimations()
        .filter(animation => animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity)
        .map(animation => animation.finished.catch(() => undefined)));
      return getComputedStyle(element).backgroundColor;
    });
    await page.evaluate(() => (window as any).r7Leaf.view.controller.view.calendar.rerender());
    await page.locator('.workspace-leaf.mod-active #bases-calendar').evaluate(async element => {
      await Promise.all(element.getAnimations({ subtree: true })
        .filter(animation => animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity)
        .map(animation => animation.finished.catch(() => undefined)));
    });
    await expect.poll(() => target.evaluate(element => element.matches(':hover'))).toBe(true);
    await expect.poll(() => target.evaluate(element => getComputedStyle(element).backgroundColor)).toBe(background);
    expect(await target.boundingBox()).toEqual(before);
    await capture(`${name}-hover-refresh`);
  }
  await page.keyboard.press('Tab');
  await target.focus();
  await capture(`${name}-focus`);
  if (!drag) {
    const bounds = (await target.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    if (await target.getAttribute('aria-busy') === 'true') {
      expect(await target.evaluate(element => getComputedStyle(element).cursor)).toBe('progress');
    }
    await capture(`${name}-pressed`);
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 5, y: 5, button: 'left', buttons: 0, clickCount: 0 });
    await page.mouse.move(5, 5);
    await page.mouse.up();
    await session.detach();
    return;
  }
  await expect(target).toBeVisible();
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(12, box.height / 2));
  await page.mouse.down();
  await capture(`${name}-pressed`);
  await page.mouse.move(box.x + box.width / 2, box.y + 70, { steps: 10 });
  if (!baseline && name.includes('-agenda-multi')) {
    const preview = page.locator('.tnc-drag-preview');
    await expect(preview).toHaveAttribute('data-drag-count', '2');
    expect(await preview.evaluate(element => ({ opacity: getComputedStyle(element).opacity, surface: getComputedStyle(element).backgroundColor }))).toMatchObject({ opacity: '1' });
    expect(await preview.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  }
  if (name.includes('-invalid')) await expect(page.locator('.tnc-drop-denied')).toHaveCount(1);
  await capture(`${name}-drag`);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('.modal-container')).toHaveCount(0);
  await expect(page.locator('.tnc-dragging')).toHaveCount(0);
  await expect(page.locator('.tnc-drag-origin')).toHaveCount(0);
  await expect(page.locator('.tnc-drag-preview')).toHaveCount(0);
  await capture(`${name}-cancelled`);
}

test('calendar surfaces and real pointer states across themes and widths', async () => {
  test.setTimeout(240000);
  const page = instance.page;
  for (const theme of ['light', 'dark']) {
    for (const width of [1180, 400]) {
      await setObsidianViewport(page, { width, height: 800 });
      await page.evaluate(({ theme, width }) => {
        document.body.classList.remove('theme-light', 'theme-dark', 'is-mobile');
        document.body.classList.add(`theme-${theme}`);
        if (width === 400) document.body.classList.add('is-mobile');
        document.querySelectorAll('.notice').forEach(element => element.remove());
      }, { theme, width });
      const prefix = `${theme}-${width}`;
      await mode('week');
      const stack = page.locator('.workspace-leaf.mod-active .tnc-more--collision').first();
      await expect(stack).toBeVisible();
      await states(stack, `${prefix}-stack`);
      await stack.click();
      const popover = page.locator('.tnc-popover');
      await expect(popover).toBeVisible();
      await states(popover.locator('.tnc-item').first(), `${prefix}-popover`);
      if (!baseline) {
        await page.mouse.move(5, 5);
        for (const entry of await popover.locator('.tnc-item').all()) {
          await expect(entry).toHaveAttribute('aria-label', /\S/);
          await entry.hover();
          await page.waitForTimeout(1100);
          await expect(page.locator('.tooltip')).toHaveCount(0);
        }
        await capture(`${prefix}-popover-tooltip-dwell`);
      }
      const bounds = (await popover.boundingBox())!;
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
      await page.keyboard.press('Escape');
      await mode('day');
      const event = page.locator('.workspace-leaf.mod-active .tnc-item[data-task-path$="Adjacent.md"]').first();
      await expect(event).toBeVisible();
      if (!baseline && width === 1180) {
        await event.hover();
        await expect(page.locator('.tooltip')).toHaveText((await event.getAttribute('aria-label'))!);
        await page.mouse.move(-10, -10);
        await expect(page.locator('.tooltip')).toHaveCount(0);
      }
      await states(event, `${prefix}-events`, true);
      if (!baseline) {
        await event.click({ modifiers: ['Control'] });
        await expect(event).toHaveClass(/tn-calendar-item-selected/);
        await event.hover();
        await capture(`${prefix}-events-selected-hover`);
        await page.keyboard.press('Tab');
        await event.focus();
        await capture(`${prefix}-events-selected-focus`);
        await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.taskSelectionService.exitSelectionMode(true));
      }
      await mode('list');
      await page.mouse.move(5, 5);
      await capture(`${prefix}-agenda`);
      const row = page.locator('.workspace-leaf.mod-active .tnc-item--list[data-task-path$="Task 0.md"]').first();
      await states(row, `${prefix}-agenda-row`, !baseline);
      if (!baseline) {
        await row.locator('.task-card__title-text').click({ modifiers: ['Control'] });
        await row.hover();
        await capture(`${prefix}-agenda-selected-hover`);
        await page.keyboard.press('Tab');
        await row.focus();
        await capture(`${prefix}-agenda-selected-focus`);
        const peer = page.locator('.tnc-item--list[data-task-path$="Task 1.md"]').first();
        await peer.locator('.task-card__title-text').click({ modifiers: ['Control'] });
        await expect(row).toHaveAttribute('data-drag-count', '2');
        await states(row, `${prefix}-agenda-multi`, true);
        await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.taskSelectionService.exitSelectionMode(true));
        const stripDay = page.locator('.tnc-strip-day.is-focus').first();
        await expect(stripDay).toBeVisible();
        await states(stripDay, `${prefix}-strip`);
        await page.locator('.tnc-strip-title').click();
        await expect(page.locator('.tnc-strip')).toHaveClass(/is-expanded/);
        await capture(`${prefix}-strip-expanded`);
        await page.locator('.tnc-strip-title').click();
      }
      await mode('month');
      await page.mouse.move(5, 5);
      await capture(`${prefix}-month`);
      if (!baseline) {
        await expect(page.locator('.tn-calendar-day-panel')).toBeVisible();
        const panelBounds = (await page.locator('.tn-calendar-day-panel').boundingBox())!;
        const monthBounds = (await page.locator('#bases-calendar > .tnc').boundingBox())!;
        if (width === 1180) expect(panelBounds.x).toBeGreaterThanOrEqual(monthBounds.x + monthBounds.width);
        else expect(panelBounds.y).toBeGreaterThanOrEqual(monthBounds.y + monthBounds.height);
        await page.locator(`.tnc-dg-day[data-date="${tomorrow}"] .tnc-dg-num`).click();
        await expect(page.locator('.tn-calendar-day-panel')).toContainText("Tomorrow's single task");
        await capture(`${prefix}-month-selected`);
        await page.locator(`.tnc-dg-day[data-date="${today}"] .tnc-dg-num`).click();
      }
    }
  }
});

test('calendar transaction, invalid target and resize state matrix', async () => {
  test.skip(baseline);
  test.setTimeout(180000);
  const page = instance.page;
  for (const theme of ['light', 'dark']) for (const width of [1180, 400]) {
    await setObsidianViewport(page, { width, height: 800 });
    await page.evaluate(({ theme, width }) => {
      document.body.classList.remove('theme-light', 'theme-dark', 'is-mobile');
      document.body.classList.add(`theme-${theme}`);
      if (width === 400) document.body.classList.add('is-mobile');
      const view = (window as any).r7Leaf.view.controller.view;
      view.calendar.setOptions(view.buildCalendarOptions());
      view.calendar.setItems(view.calendarItems);
    }, { theme, width });
    await mode('day');
    const event = page.locator('.tnc-item[data-task-path$="Adjacent.md"]').first();
    await event.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      (window as any).r7Leaf.view.controller.view.calendar.setOptions({ onItemDrop: () => new Promise<void>(resolve => { (window as any).r7Resolve = resolve; }) });
    });
    await event.focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect(event).toHaveAttribute('aria-busy', 'true');
    await capture(`${theme}-${width}-write-pending`);
    await states(event, `${theme}-${width}-write-pending`);
    await page.evaluate(() => (window as any).r7Resolve());
    await expect(event).toHaveClass(/is-write-changed/);
    await capture(`${theme}-${width}-write-settled`);
    await page.evaluate(() => (window as any).r7Leaf.view.controller.view.calendar.setOptions({ onItemDrop: (arg: any) => arg.revert() }));
    await event.focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect(event).toHaveClass(/is-write-failed/);
    await capture(`${theme}-${width}-write-failed`);
    await page.evaluate(() => (window as any).r7Leaf.view.controller.view.calendar.setOptions({ canDrop: () => false }));
    await states(event, `${theme}-${width}-invalid`, true);
    await page.evaluate(() => {
      const view = (window as any).r7Leaf.view.controller.view;
      view.calendar.setOptions({ canDrop: () => true, onItemResize: (arg: any) => arg.revert() });
      view.calendar.setItems(view.calendarItems.map((item: any) => ({ ...item, durationEditable: true })));
    });
    const handle = event.locator('.tnc-resize-end');
    const bounds = (await handle.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 25, { steps: 6 });
    await expect(page.locator('.tnc-dragging-resize-end')).toHaveCount(1);
    await capture(`${theme}-${width}-resize`);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(page.locator('.tnc-dragging')).toHaveCount(0);
  }
  await page.evaluate(() => {
    const view = (window as any).r7Leaf.view.controller.view;
    view.calendar.setOptions(view.buildCalendarOptions());
    view.calendar.setItems(view.calendarItems);
  });
});

test('agenda option, day-panel actions and localised move feedback', async () => {
  test.skip(baseline);
  const page = instance.page;
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await page.evaluate(() => document.body.classList.remove('is-mobile'));
  await mode('list');
  await expect(page.locator('.tnc-strip')).toBeVisible();
  expect(await page.locator('.tnc-strip-day').first().evaluate(element => ({
    background: getComputedStyle(element).backgroundColor,
    shadow: getComputedStyle(element).boxShadow,
  }))).toEqual({ background: 'rgba(0, 0, 0, 0)', shadow: 'none' });
  await expect(page.locator('.tnc-strip-day.has-items').first()).toBeVisible();
  await expect(page.locator('.tnc-list-add').first()).toBeVisible();
  await page.evaluate(() => {
    const view = (window as any).r7Leaf.view.controller.view;
    view.viewOptions.showAgendaStrip = false;
    view.calendar.setOptions(view.buildCalendarOptions());
  });
  await expect(page.locator('.tnc-strip')).toHaveCount(0);
  await page.evaluate(() => {
    const view = (window as any).r7Leaf.view.controller.view;
    view.viewOptions.showAgendaStrip = true;
    view.calendar.setOptions(view.buildCalendarOptions());
  });
  await mode('month');
  await page.locator(`.tnc-dg-day[data-date="${today}"] .tnc-dg-num`).click();
  const panel = page.locator('.tn-calendar-day-panel');
  const status = panel.locator('[data-task-path$="Task 0.md"] .task-card__status-dot').first();
  const originalStatus = await page.evaluate(async folder => (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(`${folder}/Task 0.md`).then((task: any) => task.status), folder);
  await status.click();
  await expect.poll(() => page.evaluate(async folder => (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(`${folder}/Task 0.md`).then((task: any) => task.status), folder)).not.toBe(originalStatus);
  await page.locator('.tn-toast__action').filter({ hasText: 'Undo' }).click();
  await expect.poll(() => page.evaluate(async folder => (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(`${folder}/Task 0.md`).then((task: any) => task.status), folder)).toBe(originalStatus);
  await panel.locator('[data-task-path$="Task 0.md"] .task-card__title').first().click({ button: 'right' });
  await expect(page.locator('.menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.evaluate(async ({ folder, tomorrow }) => {
    const view = (window as any).r7Leaf.view.controller.view;
    const item = view.calendarItems.find((item: any) => item.data?.taskInfo?.path === `${folder}/Adjacent.md`);
    const oldEvent = { id: item.id, title: item.title, start: new Date(item.start), end: new Date(item.end), allDay: false, extendedProps: item.data };
    await view.handleEventDrop({ oldEvent, event: { ...oldEvent, start: new Date(`${tomorrow}T11:00`), end: new Date(`${tomorrow}T12:00`) }, isPointer: true, revert: () => { throw new Error('Unexpected revert'); } });
  }, { folder, tomorrow });
  await expect(page.locator('.tn-toast').last()).not.toContainText(/\d{4}-\d\d-\d\dT/);
});

test('agenda domain-state fixtures keep metadata and selection readable', async () => {
  test.skip(baseline);
  test.setTimeout(180000);
  const page = instance.page;
  await mode('list');
  for (const theme of ['light', 'dark']) for (const width of [1180, 400]) {
    await setObsidianViewport(page, { width, height: 800 });
    await page.evaluate(({ theme, width, today, folder }) => {
      document.body.classList.remove('theme-light', 'theme-dark', 'is-mobile');
      document.body.classList.add(`theme-${theme}`);
      if (width === 400) document.body.classList.add('is-mobile');
      const plugin = (window as any).app.plugins.plugins.tasknotes;
      const view = (window as any).r7Leaf.view.controller.view;
      (window as any).r7VisibleProperties ??= view.getVisibleProperties;
      view.getVisibleProperties = () => ['status', 'priority', 'due', 'scheduled', 'tags', 'contexts', 'projects', 'timeEstimate']
        .map(property => plugin.fieldMapper.toUserField(property) ?? property);
      const originals = view.calendarItems.filter((item: any) => item.data?.eventType === 'scheduled');
      const states = ['completed', 'archived', 'overdue', 'blocked', 'unknown', 'no-metadata', 'all-properties'];
      const fixtures = states.map((state, index) => {
        const original = originals[index % originals.length];
        const task = { ...original.data.taskInfo, title: `${state}: ${original.title}` };
        if (state === 'completed') task.status = plugin.statusManager.getCompletedStatuses()[0];
        if (state === 'archived') task.archived = true;
        if (state === 'overdue') task.due = '2020-01-01';
        if (state === 'blocked') { task.isBlocked = true; task.blockedBy = [{ uid: `[[${folder}/Task 0]]`, reltype: 'FINISHTOSTART' }]; }
        if (state === 'unknown') { task.status = 'custom-awaiting-research'; task.priority = 'custom-next-quarter'; }
        if (state === 'no-metadata') { task.tags = []; task.contexts = []; task.projects = []; task.due = undefined; task.scheduled = undefined; task.timeEstimate = undefined; task.priority = 'none'; }
        if (state === 'all-properties') { task.contexts = ['studio', 'research']; task.projects = ['[[Calendar composition]]']; task.tags = ['task', 'design', 'accessibility']; task.due = today; }
        return { ...original, id: `r7-domain-${state}`, title: task.title, start: `${today}T${String(9 + index).padStart(2, '0')}:00`, end: `${today}T${String(10 + index).padStart(2, '0')}:00`, completed: state === 'completed', data: { ...original.data, taskInfo: task } };
      });
      view.calendar.setOptions({ onRangeChange: undefined, onViewChange: undefined, listDayCount: 1 });
      view.calendar.setItems(fixtures);
      (window as any).r7DomainFixtures = fixtures;
    }, { theme, width, today, folder });
    for (const state of ['completed', 'archived', 'overdue', 'blocked', 'unknown', 'no-metadata', 'all-properties']) {
      const row = page.locator(`.tnc-item[data-id="r7-domain-${state}"]`).first();
      await expect(row).toBeVisible();
      await row.hover();
      await expect.poll(() => row.evaluate(element => [...element.querySelectorAll<HTMLElement>('.task-card__metadata')].every(metadata => {
        const bounds = metadata.getBoundingClientRect();
        return [...metadata.querySelectorAll<HTMLElement>('.task-card__metadata-values > *, .task-card__date-slot, .task-card__metadata-overflow')]
          .filter(part => !part.closest('[hidden]') && part.getClientRects().length > 0)
          .every(part => part.getBoundingClientRect().right <= bounds.right + 1);
      }))).toBe(true);
      await capture(`${theme}-${width}-domain-${state}-hover`);
      await page.evaluate(state => {
        const plugin = (window as any).app.plugins.plugins.tasknotes;
        plugin.taskSelectionService.clearSelection();
        const item = (window as any).r7DomainFixtures.find((item: any) => item.id === `r7-domain-${state}`);
        plugin.taskSelectionService.toggleSelection(item.data.taskInfo.path);
      }, state);
      await capture(`${theme}-${width}-domain-${state}-selected`);
    }
  }
  await page.evaluate(() => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    plugin.taskSelectionService.clearSelection();
    const view = (window as any).r7Leaf.view.controller.view;
    view.getVisibleProperties = (window as any).r7VisibleProperties;
    view.calendar.setOptions(view.buildCalendarOptions());
    view.calendar.setItems(view.calendarItems);
  });
});

test('mini calendar uses the selected-day skin in both themes and widths', async () => {
  test.setTimeout(120000);
  const page = instance.page;
  await page.evaluate(() => document.querySelectorAll('.tn-toast, .notice').forEach(element => element.remove()));
  await page.evaluate(async folder => {
    const app = (window as any).app;
    await (window as any).r7Leaf.openFile(app.vault.getAbstractFileByPath(`${folder}/Mini.base`));
  }, folder);
  const day = page.locator('.workspace-leaf.mod-active .mini-calendar-view__day[aria-current="date"]');
  await expect(day).toBeVisible();
  for (const theme of ['light', 'dark']) for (const width of [1180, 400]) {
    await setObsidianViewport(page, { width, height: 800 });
    await page.evaluate(({ theme, width }) => {
      document.body.classList.remove('theme-light', 'theme-dark', 'is-mobile');
      document.body.classList.add(`theme-${theme}`);
      if (width === 400) document.body.classList.add('is-mobile');
    }, { theme, width });
    await states(day, `${theme}-${width}-mini`);
    if (!baseline) {
      const label = await page.evaluate(tomorrow => new Intl.DateTimeFormat((window as any).app.plugins.plugins.tasknotes.i18n.getCurrentLocale(), { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${tomorrow}T12:00Z`)), tomorrow);
      const other = page.getByRole('gridcell', { name: label, exact: true });
      await other.click();
      await expect(page.locator('.modal-container')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.modal-container')).toHaveCount(0);
      await page.mouse.move(5, 5);
      await expect(other).toHaveClass(/mini-calendar-view__day--selected/);
      expect(await day.evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
      expect(await other.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
      const nav = (await page.locator('.mini-calendar-view__navigation').boundingBox())!;
      const todayButton = (await page.locator('.mini-calendar-view__today-button').boundingBox())!;
      expect(Math.abs(nav.y - todayButton.y)).toBeLessThan(12);
      await capture(`${theme}-${width}-mini-today-vs-selected`);
      await page.locator('.mini-calendar-view__today-button').click();
    }
  }
});
