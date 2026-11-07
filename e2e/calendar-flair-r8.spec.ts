import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
let today: string;
const folder = `CalendarFlair-${Date.now()}`;
const baseline = process.env.TASKNOTES_R8_BASELINE === '1';
const output = join(process.env.TASKNOTES_E2E_EVIDENCE_DIR ?? join(tmpdir(), 'tasknotes-r8-flair'), baseline ? 'before' : 'after');
test.use({ trace: 'on' });

test.beforeAll(async () => {
  mkdirSync(output, { recursive: true });
  instance = await launchObsidian();
  today = await instance.page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    (window as any).flairSettings = structuredClone(plugin.settings);
    plugin.i18n.setLocale('en');
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    plugin.settings.singleClickAction = 'edit';
    plugin.settings.doubleClickAction = 'none';
    await app.vault.createFolder(folder);
    const day = (window as any).moment().format('YYYY-MM-DD');
    for (let offset = 0; offset < 17; offset++) {
      const date = (window as any).moment(day).add(offset, 'days').format('YYYY-MM-DD');
      for (let index = 0; index < (offset === 0 ? 9 : offset % 3 + 1); index++) {
        const time = index < 4 ? `T09:${index === 1 ? '15' : '00'}` : '';
        const name = `Review ${offset}-${index}`;
        await app.vault.create(`${folder}/${name}.md`, `---\ntitle: ${name}\ntags: [task, design]\nstatus: ${index % 2 ? 'in-progress' : 'open'}\npriority: high\nscheduled: ${date}${time}\ndue: ${date}T17:00\ntimeEstimate: ${index === 1 ? 15 : 60}\n---\n`);
      }
    }
    await app.vault.create(`${folder}/Short.md`, `---\ntitle: Short independent appointment\ntags: [task]\nstatus: open\npriority: high\nscheduled: ${day}T13:15\ntimeEstimate: 15\n---\n`);
    await app.vault.create(`${folder}/Calendar.base`, JSON.stringify({ filters: { and: [`file.inFolder("${folder}")`] }, views: [{ type: 'tasknotesCalendar', name: 'Flair', calendarView: 'listWeek', order: ['status', 'priority', 'file.tags'], timeFormat: '12', showAgendaStrip: true, showMonthDayPanel: true, showDue: true, showOverdueOnToday: false, scrollTime: '08:00:00', slotMinTime: '08:00:00', slotMaxTime: '19:00:00' }] }));
    await app.vault.create(`${folder}/Mini.base`, JSON.stringify({ filters: { and: [`file.inFolder("${folder}")`] }, views: [{ type: 'tasknotesMiniCalendar', name: 'Mini', dateProperty: 'note.scheduled' }] }));
    const leaf = app.workspace.getLeaf(true);
    (window as any).flairLeaf = leaf;
    await leaf.openFile(app.vault.getAbstractFileByPath(`${folder}/Calendar.base`));
    app.workspace.setActiveLeaf(leaf, { focus: true });
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    return day;
  }, folder);
  await expect(instance.page.locator('.workspace-leaf.mod-active .tnc-strip')).toBeVisible();
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await instance.page.evaluate(async folder => {
      const app = (window as any).app;
      app.plugins.plugins.tasknotes.settings = (window as any).flairSettings;
      (window as any).flairLeaf.detach();
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally { await closeObsidian(instance); }
});

async function appearance(width: number, theme: string) {
  await instance.page.evaluate(theme => {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme}`);
    (window as any).app.workspace.trigger('css-change');
    document.querySelectorAll('.notice, .tooltip').forEach(element => element.remove());
  }, theme);
  await setObsidianViewport(instance.page, { width, height: 800 });
}

async function mode(view: string) {
  if (view === 'days') {
    const select = instance.page.locator('.workspace-leaf.mod-active .tnc-toolbar-view-select');
    if (await select.isVisible()) await select.selectOption('days');
    else await instance.page.locator('.workspace-leaf.mod-active .tnc-btn-view-days').click();
  }
  await instance.page.evaluate(({ view, today }) => (window as any).flairLeaf.view.controller.view.calendar.changeView(view, today), { view, today });
  const persisted = ({ month: 'dayGridMonth', week: 'timeGridWeek', days: 'timeGridCustom', day: 'timeGridDay', list: 'listWeek' } as Record<string, string>)[view];
  await expect.poll(() => instance.page.evaluate(async folder => {
    const app = (window as any).app;
    return app.vault.read(app.vault.getAbstractFileByPath(`${folder}/Calendar.base`));
  }, folder)).toMatch(new RegExp(`calendarView["']?:\\s*["']?${persisted}`));
  await expect.poll(() => instance.page.evaluate(() => {
    const current = (window as any).flairLeaf.view.controller.view;
    return Boolean(current._saveViewTypeTimer || current._isRendering || current._pendingRender || current._configChangedNeedsRecreate);
  })).toBe(false);
  const effective = view === 'week' && await instance.page.locator('.advanced-calendar-view').first().evaluate(element => element.clientWidth < 640) ? 'days' : view;
  await expect(instance.page.locator(`.workspace-leaf.mod-active #bases-calendar > .tnc--${effective}`)).toBeVisible();
  await instance.page.locator('.workspace-leaf.mod-active #bases-calendar').evaluate(async element => {
    await Promise.all(element.getAnimations({ subtree: true }).filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
  });
  await instance.page.mouse.move(5, 5);
}

test('strip paging and list scroll share the focused date', async () => {
  const page = instance.page;
  await appearance(1180, 'light');
  await page.locator('.tnc-strip-next').click();
  const position = () => page.evaluate(() => {
    const root = document.querySelector('.workspace-leaf.mod-active .tnc--list')!;
    const scroll = root.querySelector('.tnc-list-scroll')!;
    const top = scroll.getBoundingClientRect().top;
    const first = [...root.querySelectorAll<HTMLElement>('.tnc-list-section')].find(section => section.getBoundingClientRect().bottom > top + 2);
    return { focus: root.querySelector<HTMLElement>('.tnc-strip-day.is-focus')?.dataset.date, first: first?.dataset.date };
  });
  const result = await position();
  writeFileSync(`${output}/strip-paging.json`, JSON.stringify(result));
  if (!baseline) await expect.poll(async () => { const state = await position(); return state.focus === state.first; }).toBe(true);
  await page.screenshot({ path: `${output}/strip-paging.png` });
  await page.evaluate(() => {
    const scroll = document.querySelector('.workspace-leaf.mod-active .tnc-list-scroll')!;
    scroll.scrollTop += 650;
  });
  if (!baseline) {
    await expect.poll(async () => (await position()).focus).not.toBe(result.focus);
    await expect.poll(async () => { const state = await position(); return state.focus === state.first; }).toBe(true);
    const selected = page.locator('.tnc-strip-day.is-focus');
    await selected.click();
    await page.locator('.tnc-list-scroll').hover();
    await page.mouse.wheel(0, 650);
    await expect.poll(async () => { const state = await position(); return state.focus !== result.focus && state.focus === state.first; }).toBe(true);
  }
  await page.screenshot({ path: `${output}/strip-scroll.png` });
});

test('agenda, filled events, compact all-day band, day panel and mini calendar matrix', async () => {
  test.setTimeout(180000);
  const page = instance.page;
  for (const width of [1180, 400]) for (const theme of ['light', 'dark']) {
    await appearance(width, theme);
    for (const view of ['list', 'week', 'days', 'day', 'month']) {
      await mode(view);
      await page.screenshot({ path: `${output}/${view}-${width}-${theme}.png` });
      const metrics = await page.locator('.workspace-leaf.mod-active #bases-calendar').evaluate(root => ({
        todayBackground: root.querySelector('.tnc-col.is-today') && getComputedStyle(root.querySelector('.tnc-col.is-today')!).backgroundColor,
        chips: [...root.querySelectorAll<HTMLElement>('.tnc-allday-layer .tnc-item--bar')].map(element => ({ height: element.getBoundingClientRect().height, fill: getComputedStyle(element).backgroundColor, ink: getComputedStyle(element).color })),
        stamps: [...root.querySelectorAll<HTMLElement>('.tn-calendar-list-stamp')].slice(0, 2).map(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height, text: element.textContent })),
        short: [...root.querySelectorAll<HTMLElement>('.tnc-item--timed')].filter(element => element.textContent?.includes('Short independent')).map(element => ({ height: element.getBoundingClientRect().height, text: element.textContent })),
        flags: [...root.querySelectorAll<HTMLElement>('.tnc-dg .tn-calendar-deadline-marker')].map(element => ({ width: element.closest('.tnc-item')!.getBoundingClientRect().width, display: getComputedStyle(element).display })),
      }));
      writeFileSync(`${output}/${view}-${width}-${theme}.json`, JSON.stringify(metrics, null, 2));
      if (!baseline) {
        for (const chip of metrics.chips) expect(chip.height).toBeLessThanOrEqual(22);
        for (const item of metrics.short) {
          expect(item.height).toBeGreaterThanOrEqual(15);
          expect(item.height).toBeLessThan(40);
          expect(item.text).toContain('1:15 PM');
        }
        for (const stamp of metrics.stamps) expect(stamp.height).toBeLessThanOrEqual(24);
        if (view === 'month') await expect(page.locator('.tn-calendar-day-count')).toHaveText('10 items');
        for (const flag of metrics.flags) if (flag.width < 110) expect(flag.display).toBe('none');
        if (view === 'week') await expect(page.locator('.tnc-col.is-today')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      }
    }
    await page.evaluate(async folder => {
      const app = (window as any).app;
      await (window as any).flairLeaf.openFile(app.vault.getAbstractFileByPath(`${folder}/Mini.base`));
    }, folder);
    await expect(page.locator('.mini-calendar-view__grid')).toBeVisible();
    if (!baseline) {
      const circle = await page.locator('.mini-calendar-view__day--today .mini-calendar-view__number').boundingBox();
      expect(circle!.width).toBe(32);
      expect(circle!.height).toBe(32);
      await expect(page.locator('.mini-calendar-view__nav-button--next svg')).toHaveCount(1);
      await expect(page.locator('.mini-calendar-view__entry-content .tn-picker__detail').filter({ hasText: /^Review / })).toHaveCount(0);
    }
    await page.screenshot({ path: `${output}/mini-${width}-${theme}.png` });
    if (!baseline && width === 1180 && theme === 'light') {
      await page.locator('.mini-calendar-view__day--outside-month').first().click();
      await expect(page.locator('.mini-calendar-view__selected-day .tn-picker__empty')).toHaveText('Nothing scheduled for this day.');
      await expect(page.locator('.mini-calendar-view__day--today .mini-calendar-view__number')).toHaveCSS('border-radius', '999px');
      await page.screenshot({ path: `${output}/mini-empty.png` });
    }
    await page.evaluate(async folder => {
      const app = (window as any).app;
      await (window as any).flairLeaf.openFile(app.vault.getAbstractFileByPath(`${folder}/Calendar.base`));
    }, folder);
    await expect(page.locator('.workspace-leaf.mod-active #bases-calendar > .tnc')).toBeVisible();
  }
});

test('effective view clock reaches events, stacks, mirrors and the selected-day panel', async () => {
  test.setTimeout(90000);
  const page = instance.page;
  await appearance(1180, 'light');
  await page.evaluate(async ({ folder, today }) => {
    const app = (window as any).app;
    for (const [name, time, minutes] of [['Draft', '10:30', 90], ['Review', '10:30', 60], ['Meeting', '11:00', 30]]) {
      await app.vault.create(`${folder}/Dense ${name}.md`, `---\ntitle: Dense ${name}\ntags: [task]\nstatus: open\nscheduled: ${today}T${time}\ntimeEstimate: ${minutes}\n---\n`);
    }
    await (window as any).flairLeaf.view.controller.view.refreshCalendarWithFreshData();
  }, { folder, today });
  for (const clock of ['24', '12']) {
    await page.evaluate(clock => {
      const view = (window as any).flairLeaf.view.controller.view;
      view.config.set('timeFormat', clock);
    }, clock);
    await expect.poll(() => page.evaluate(() => (window as any).flairLeaf.view.controller.view.viewOptions.timeFormat)).toBe(clock);
    await mode('day');
    await expect(page.locator('#bases-calendar > .tnc .tnc-more--stack').filter({ hasText: 'Dense Draft' })).toContainText('Dense Meeting');
    await expect(page.locator('#bases-calendar > .tnc .tnc-item--timed').filter({ hasText: 'Dense Draft' })).toHaveCount(0);
    const event = page.locator('#bases-calendar > .tnc .tnc-item--timed').filter({ hasText: 'Short independent' });
    await expect(event).toContainText(clock === '12' ? '1:15 PM' : '13:15');
    await expect(page.locator('#bases-calendar > .tnc .tnc-collision-range').first()).toContainText(clock === '12' ? '9:00 AM' : '09:00');
    const column = await page.locator(`#bases-calendar > .tnc .tnc-col[data-date="${today}"]`).boundingBox();
    await page.mouse.move(column!.x + column!.width / 2, column!.y + column!.height * 6 / 11);
    await page.mouse.down();
    await page.mouse.move(column!.x + column!.width / 2, column!.y + column!.height * 6.5 / 11, { steps: 6 });
    const mirror = page.locator('#bases-calendar > .tnc .tnc-sel--mirror');
    await expect(mirror).toBeVisible();
    if (clock === '12') await expect(mirror).toContainText('PM');
    else await expect(mirror).not.toContainText(/AM|PM/);
    await page.screenshot({ path: `${output}/selection-${clock}.png` });
    await page.mouse.up();
    await page.keyboard.press('Escape');
    await mode('month');
    await expect(page.locator('.tn-calendar-day-panel .tnc-item--list').filter({ hasText: 'Short independent' }).first()).toContainText(clock === '12' ? '1:15 PM' : '13:15');
  }
  await mode('day');
  await page.locator('#bases-calendar > .tnc .tnc-item--timed').filter({ hasText: 'Short independent' }).click();
  await expect(page.locator('.modal-container .mod-tasknotes')).toBeVisible();
  const details = await page.locator('.modal-container .modal').evaluate(element => ({
    bounds: element.getBoundingClientRect().toJSON(), fields: element.querySelectorAll('input, textarea, button').length,
  }));
  writeFileSync(`${output}/event-details.json`, JSON.stringify(details, null, 2));
  await page.screenshot({ path: `${output}/event-details.png` });
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal-container .mod-tasknotes')).toHaveCount(0);
});
