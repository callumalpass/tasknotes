import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

const baseline = process.env.TASKNOTES_R8_BASELINE === '1';
const evidence = `${process.env.TASKNOTES_E2E_EVIDENCE_DIR ?? 'test-results/calendar-round8'}/round8-${baseline ? 'before' : 'after'}`;
const folder = `CalendarRound8-${Date.now()}`;
let instance: ObsidianApp;
let today: string;
const observations: Record<string, unknown> = {};
test.use({ trace: 'on' });

test.beforeAll(async () => {
  mkdirSync(evidence, { recursive: true });
  instance = await launchObsidian();
  today = await instance.page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    const date = (window as any).moment().format('YYYY-MM-DD');
    await app.vault.createFolder(folder);
    for (const [name, time, extra] of [
      ['Recurring', '', 'recurrence: FREQ=DAILY\n'],
      ['Ordinary', '', ''],
      ['Timed', 'T09:00', 'timeEstimate: 60\n'],
      ...Array.from({ length: 8 }, (_, index) => [`Extra${index}`, '', '']),
    ]) {
      const scheduled = name === 'Ordinary' ? (window as any).moment().subtract(1, 'day').format('YYYY-MM-DD') : date;
      await app.vault.create(`${folder}/${name}.md`, `---\ntags: [task]\ntitle: ${name} calendar planning with the whole team\nstatus: open\npriority: normal\nscheduled: ${scheduled}${time}\n${extra}---\n`);
    }
    await app.vault.create(`${folder}/Calendar.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\nviews:\n  - type: tasknotesCalendar\n    name: Calendar\n    calendarView: dayGridMonth\n    showMonthDayPanel: false\n    showOverdueOnToday: false\n    slotMinTime: '00:00:00'\n    slotMaxTime: '24:00:00'\n  - type: tasknotesTaskList\n    name: Tasks\n  - type: tasknotesCalendar\n    name: Agenda\n    calendarView: listWeek\n`);
    for (const [name, type, extra] of [['Tasks', 'tasknotesTaskList', ''], ['Agenda', 'tasknotesCalendar', '    calendarView: listWeek\n']]) {
      await app.vault.create(`${folder}/${name}.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\n    - note.status == "open"\nviews:\n  - type: ${type}\n    name: ${name}\n${extra}`);
    }
    const leaf = app.workspace.getLeaf(true);
    (window as any).r8Leaf = leaf;
    await leaf.openFile(app.vault.getAbstractFileByPath(`${folder}/Calendar.base`));
    app.workspace.setActiveLeaf(leaf, { focus: true });
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    return date;
  }, folder);
  await expect(instance.page.locator('.workspace-leaf.mod-active .tnc').first()).toBeVisible();
});

test.afterAll(async () => {
  writeFileSync(`${evidence}/observations.json`, JSON.stringify(observations, null, 2));
  writeFileSync(`${evidence}/observations-${Date.now()}.json`, JSON.stringify(observations, null, 2));
  if (!instance) return;
  try {
    await instance.page.evaluate(async folder => {
      const app = (window as any).app;
      (window as any).r8Leaf.detach();
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally { await closeObsidian(instance); }
});

async function appearance(width: number, theme: string, mobile = false) {
  await instance.page.evaluate(({ theme, mobile }) => {
    const nativeWindow = (window as any).require('electron').remote.getCurrentWindow();
    nativeWindow.setMinimumSize(320, 500);
    if (nativeWindow.isMaximized()) nativeWindow.unmaximize();
    document.body.classList.toggle('is-mobile', mobile);
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme}`);
  }, { theme, mobile });
  await setObsidianViewport(instance.page, { width, height: 800 });
  await expect.poll(() => instance.page.evaluate(() => (window as any).require('electron').remote.getCurrentWindow().getContentSize())).toEqual([width, 800]);
}

async function mode(view: string) {
  await instance.page.evaluate(({ view, today }) => (window as any).r8Leaf.view.controller.view.calendar.changeView(view, today), { view, today });
  await expect(instance.page.locator(`.tnc-${view === 'month' ? 'dg' : view === 'year' ? 'year' : 'tg'}`).first()).toBeVisible();
  await expect.poll(() => instance.page.evaluate(() => (window as any).r8Leaf.view.controller.view._saveViewTypeTimer)).toBeNull();
}

test('recurring selection and cursor identify one mounted occurrence', async () => {
  const page = instance.page;
  await appearance(1180, 'light');
  await mode('month');
  await page.locator('.tnc-btn-selectTasks').click();
  await page.locator('[data-task-path$="/Ordinary.md"]').first().click();
  await page.locator('[data-task-path$="/Recurring.md"]').first().click();
  await expect.poll(() => page.evaluate(() => document.querySelector('.modal-container') !== null || (window as any).app.plugins.plugins.tasknotes.taskSelectionService.getSelectedPaths().length === 2)).toBe(true);
  observations.selection = await page.evaluate(() => ({
    paths: (window as any).app.plugins.plugins.tasknotes.taskSelectionService.getSelectedPaths(),
    modal: !!document.querySelector('.modal-container'),
  }));
  if (!baseline) {
    expect((observations.selection as any).paths).toHaveLength(2);
    await expect(page.locator('.modal-container')).toHaveCount(0);
    await page.locator('[data-task-path$="/Recurring.md"]').first().click();
    await expect.poll(() => page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.taskSelectionService.getSelectedPaths().length)).toBe(1);
    await page.locator('[data-task-path$="/Recurring.md"]').first().click();
    await expect.poll(() => page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.taskSelectionService.getSelectedPaths().length)).toBe(2);
  }
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const selection = (window as any).app.plugins.plugins.tasknotes.taskSelectionService;
    selection.clearSelection(); selection.exitSelectionMode();
  });
  const recurring = page.locator('[data-task-path$="/Recurring.md"]').first();
  await recurring.hover();
  await recurring.focus();
  await page.keyboard.press('ArrowDown');
  observations.cursor = await page.locator('.tn-task-focused').count();
  observations.relatedRings = await page.locator('.fc-task-event--related-hover').count();
  if (!baseline) {
    await expect(page.locator('.tn-task-focused')).toHaveCount(1);
    expect(observations.relatedRings).toBe(0);
  }
  await page.evaluate(() => (window as any).r8Leaf.view.controller.view.rootElement.focus());
  const before = await page.locator('.tnc-title').innerText();
  await page.keyboard.press(']');
  observations.nextShortcut = { before, after: await page.locator('.tnc-title').innerText() };
  if (!baseline) expect((observations.nextShortcut as any).after).not.toBe(before);
  await page.keyboard.press('[');
  if (!baseline) await expect(page.locator('.tnc-title')).toHaveText(before);
  await page.keyboard.press(']');
  await page.keyboard.press('t');
  if (!baseline) await expect(page.locator('.tnc-title')).toHaveText(before);
  observations.todayKey = await page.evaluate(() => ({ modal: !!document.querySelector('.modal-container'), focus: document.activeElement?.className }));
  await page.keyboard.press('w');
  observations.weekShortcut = await page.evaluate(() => (window as any).r8Leaf.view.controller.view.calendar.view.type);
  observations.weekKey = await page.evaluate(() => ({ modal: !!document.querySelector('.modal-container'), focus: document.activeElement?.className }));
  if (!baseline) expect(observations.weekShortcut).toBe('week');
  await page.keyboard.press('m');
  observations.monthShortcut = await page.evaluate(() => (window as any).r8Leaf.view.controller.view.calendar.view.type);
  if (!baseline) expect(observations.monthShortcut).toBe('month');
  await page.screenshot({ path: `${evidence}/desktop-selection.png` });
});

test('week starts below its sticky band and passing the edge does not creep or leave rings', async () => {
  const page = instance.page;
  await appearance(1180, 'light');
  await mode('week');
  const label = await page.locator('.tnc-slot-label').first().evaluate(element => element.outerHTML.slice(0,1200));
  observations.axis = label;
  observations.initialScroll = await page.locator('.tnc-tg-scroll').evaluate(element => ({ top: element.scrollTop, html: element.innerHTML.slice(0,250) }));
  if (!baseline) {
    const hour = await page.locator('.tnc-slot-label').nth(7).evaluate(element => ({ top: element.getBoundingClientRect().top, band: document.querySelector('.tnc-tg-top')!.getBoundingClientRect().bottom }));
    expect(hour.top).toBeGreaterThanOrEqual(hour.band);
  }
  await page.screenshot({ path: `${evidence}/week-initial.png` });
  const event = page.locator('.tnc-item--timed[data-task-path$="/Timed.md"]').first();
  await expect(async () => { await event.scrollIntoViewIfNeeded(); await expect(event).toBeVisible(); }).toPass();
  const bounds = (await event.boundingBox())!;
  const scroller = page.locator('.tnc-tg-scroll');
  const viewport = (await scroller.boundingBox())!;
  const before = await scroller.evaluate(element => element.scrollTop);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2, viewport.y + viewport.height - 8, { steps: 8 });
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2 + 48, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('.tnc-dragging')).toHaveCount(0);
  observations.drop = { before, after: await scroller.evaluate(element => element.scrollTop), focused: await page.locator('.tn-task-focused').count(), related: await page.locator('.fc-task-event--related-hover, .fc-task-event--hover-source').count(), selected: await page.locator('.tnc-item.is-selected').count() };
  if (!baseline) {
    expect((observations.drop as any).after).toBe(before);
    expect((observations.drop as any).focused).toBe(0);
    expect(await event.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('none');
  }
  await page.screenshot({ path: `${evidence}/week-dropped.png` });
  if (!baseline) {
    await expect.poll(() => page.evaluate(async folder => (window as any).app.vault.cachedRead((window as any).app.vault.getAbstractFileByPath(`${folder}/Timed.md`)), folder)).toContain(`${today}T10:00`);
    const settled = (await event.boundingBox())!;
    const top = await scroller.evaluate(element => element.scrollTop);
    await page.mouse.move(settled.x + settled.width / 2, settled.y + 12);
    await page.mouse.down();
    await page.mouse.move(settled.x + settled.width / 2, viewport.y + viewport.height - 8, { steps: 4 });
    await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(top);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect(await scroller.evaluate(element => element.scrollTop)).toBe(top);
  }
});

test('phone calendar geometry preserves chrome, month content and week titles', async () => {
  test.setTimeout(120000);
  const page = instance.page;
  for (const theme of ['light', 'dark']) {
    for (const mobile of [false, true]) {
      await appearance(400, theme, mobile);
      await mode('month');
      const chrome = await page.locator('.workspace-leaf.mod-active .bases-toolbar').evaluate(element => ({
        width: element.clientWidth, scroll: element.scrollWidth, height: element.getBoundingClientRect().height,
        controls: [...element.children].map(control => ({ class: control.className, text: control.getAttribute('aria-label') ?? control.textContent, left: control.getBoundingClientRect().left, right: control.getBoundingClientRect().right, width: control.getBoundingClientRect().width })),
      }));
      observations[`chrome-${theme}-${mobile}`] = chrome;
      if (!baseline) {
        expect(chrome.scroll).toBeLessThanOrEqual(chrome.width);
        expect(chrome.height).toBe(48);
        const more = page.locator('.workspace-leaf.mod-active .tn-bases-toolbar-more');
        expect((await more.boundingBox())!.width).toBeGreaterThanOrEqual(40);
        await more.click();
        const panel = page.locator('.tn-bases-toolbar-overflow-panel');
        for (const control of ['results-menu', 'sort-menu', 'filter-menu', 'properties-menu', 'search']) await expect(panel.locator(`.bases-toolbar-${control}`)).toBeVisible();
        await expect(panel.locator('.tn-shortcut-help')).toBeVisible();
        await page.screenshot({ path: `${evidence}/toolbar-more-${theme}-${mobile}.png` });
        await panel.locator('.tn-shortcut-help').click();
        await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts', exact: true })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(panel).toHaveCount(0);
      }
      observations[`month-${theme}-${mobile}`] = await page.locator('.tnc-dg-day.is-today').evaluate(element => ({
        cell: element.getBoundingClientRect().toJSON(),
        content: [...element.querySelectorAll('.tnc-dg-top, .tnc-dg-dots, .tnc-dg-dots-more, .tnc-dg-num')].map(child => ({ class: child.className, bounds: child.getBoundingClientRect().toJSON() })),
      }));
      await page.screenshot({ path: `${evidence}/month-${theme}-${mobile}.png` });
      if (!baseline) {
        await setObsidianViewport(page, { width: 400, height: 500 });
        await expect.poll(() => page.locator('.tnc-dg-day.is-today').evaluate(element => {
          const number = element.querySelector('.tnc-dg-num')!.getBoundingClientRect();
          const dots = element.querySelector('.tnc-dg-dots')!.getBoundingClientRect();
          const contents = [...element.querySelector('.tnc-dg-dots')!.children].map(child => child.getBoundingClientRect());
          return number.bottom + 4 <= dots.top && contents.every(child => child.bottom <= dots.bottom) && dots.bottom + 3 <= element.getBoundingClientRect().bottom;
        })).toBe(true);
        await appearance(400, theme, mobile);
      }
      await mode('week');
      if (!baseline) {
        expect(await page.evaluate(() => (window as any).r8Leaf.view.controller.view.calendar.view.type)).toBe('days');
        await expect(page.locator('.tnc-tg-head .tnc-dh')).toHaveCount(3);
        const todayBackground = await page.locator('.tnc-col.is-today').evaluate(element => ({
          day: getComputedStyle(element).backgroundColor,
          surface: getComputedStyle(element.closest('.tnc')!).backgroundColor,
        }));
        expect(todayBackground.day).toBe(todayBackground.surface);
        await page.locator('.tnc-btn-prev').focus();
        for (const control of ['today', 'next', 'overflow']) {
          await page.keyboard.press('Tab');
          await expect(page.locator(`.tnc-btn-${control}`)).toBeFocused();
        }
        await page.keyboard.press('Tab');
        await expect(page.locator('.tnc-toolbar-view-select')).toBeFocused();
      }
      observations[`week-${theme}-${mobile}`] = await page.locator('.tnc-item--timed').first().evaluate(element => ({ width: element.getBoundingClientRect().width, title: element.querySelector('.tnc-item-title')?.textContent }));
      await page.screenshot({ path: `${evidence}/week-${theme}-${mobile}.png` });
      if (!baseline && theme === 'light' && !mobile) {
        await appearance(1180, theme);
        await expect.poll(() => page.evaluate(() => (window as any).r8Leaf.view.controller.view.calendar.view.type)).toBe('week');
        await appearance(400, theme);
        await expect(page.locator('.tnc-tg-head .tnc-dh')).toHaveCount(3);
        await page.evaluate(() => { (window as any).r8Leaf.view.controller.view.viewOptions.customDayCount = 5; });
        await page.locator('.tnc-toolbar-view-select').selectOption('days');
        await expect(page.locator('.tnc-tg-head .tnc-dh')).toHaveCount(5);
        await appearance(1180, theme);
        await expect(page.locator('.tnc-tg-head .tnc-dh')).toHaveCount(5);
        await appearance(400, theme);
        await expect(page.locator('.tnc-tg-head .tnc-dh')).toHaveCount(5);
        await mode('week');
        await expect(page.locator('.tnc-tg-head .tnc-dh')).toHaveCount(3);
      }
      await mode('year');
      await page.locator('.tnc-year-scroll').evaluate(element => element.scrollTop = 120);
      await page.screenshot({ path: `${evidence}/year-${theme}-${mobile}.png` });
      if (!baseline) {
        const headers = await page.locator('.tnc-ym').first().evaluate(element => ({
          title: element.querySelector('.tnc-ym-title')!.getBoundingClientRect().toJSON(),
          days: [...element.querySelectorAll('.tnc-ym-dow')].map(day => day.getBoundingClientRect().toJSON()),
        }));
        for (const day of headers.days) expect(day.top).toBeGreaterThanOrEqual(headers.title.bottom);
      }
    }
  }
  if (!baseline) {
    for (const name of ['Tasks', 'Agenda', 'Calendar']) {
      await page.evaluate(async ({ folder, name }) => {
        const app = (window as any).app;
        await (window as any).r8Leaf.openFile(app.vault.getAbstractFileByPath(`${folder}/${name}.base`));
        app.workspace.setActiveLeaf((window as any).r8Leaf, { focus: true });
      }, { folder, name });
      await expect(page.locator('.tn-bases-toolbar-more:visible')).toHaveCount(1);
      expect(await page.locator('.workspace-leaf.mod-active .bases-toolbar').evaluate(element => element.getBoundingClientRect().height)).toBe(48);
    }
  }
});

test('touch swipe navigates without stealing vertical scrolling', async () => {
  const page = instance.page;
  await appearance(400, 'light', true);
  await mode('month');
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const grid = (await page.locator('.tnc-dg').boundingBox())!;
  const before = await page.locator('.tnc-title').innerText();
  const start = { x: Math.round(grid.x + grid.width * .8), y: Math.round(grid.y + grid.height * .65) };
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  for (let step = 1; step <= 6; step++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x - step * 30, y: start.y }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  observations.swipe = { before, after: await page.locator('.tnc-title').innerText() };
  if (!baseline) expect((observations.swipe as any).after).not.toBe(before);
  await page.screenshot({ path: `${evidence}/swipe.png` });
  if (!baseline) {
    await mode('day');
    const title = await page.locator('.tnc-title').innerText();
    const scroller = page.locator('.tnc-tg-scroll');
    const viewport = (await scroller.boundingBox())!;
    const scrollBefore = await scroller.evaluate(element => element.scrollTop);
    const point = { x: viewport.x + 15, y: viewport.y + viewport.height - 30 };
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    for (let step = 1; step <= 6; step++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y - step * 25 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(scrollBefore);
    await expect(page.locator('.tnc-title')).toHaveText(title);
    await page.evaluate(() => (window as any).r8Leaf.view.controller.view.calendar.scrollToTime('08:00'));
    const event = page.locator('.tnc-item--timed[data-task-path$="/Timed.md"]').first();
    await expect(async () => { await event.scrollIntoViewIfNeeded(); await expect(event).toBeVisible(); }).toPass();
    const bounds = (await event.boundingBox())!;
    const previous = await page.evaluate(async folder => (window as any).app.vault.cachedRead((window as any).app.vault.getAbstractFileByPath(`${folder}/Timed.md`)), folder);
    const touch = { x: bounds.x + bounds.width / 2, y: bounds.y + 12 };
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] });
    await page.waitForFunction(start => performance.now() - start >= (window as any).r8Leaf.view.controller.view.calendar.getOptions().longPressDelay + 50, await page.evaluate(() => performance.now()));
    for (let step = 1; step <= 6; step++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touch.x, y: touch.y + step * 8 }] });
    await expect(page.locator('.tnc-dragging')).toHaveCount(1);
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => page.evaluate(async folder => (window as any).app.vault.cachedRead((window as any).app.vault.getAbstractFileByPath(`${folder}/Timed.md`)), folder)).not.toBe(previous);
    await expect(page.locator('.tnc-title')).toHaveText(title);
    observations.touch = { emulated: true, verticalScroll: true, longPressPersisted: true };
  }
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await client.detach();
});
