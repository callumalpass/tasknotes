import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

const baseline = process.env.TASKNOTES_CAL3_BASELINE === '1';
const evidence = process.env.TASKNOTES_E2E_EVIDENCE_DIR ? `${process.env.TASKNOTES_E2E_EVIDENCE_DIR}/cal3` : `/tmp/tasknotes-r7/cal3/${baseline ? 'before' : 'after'}`;
const folder = `CalendarCal3-${Date.now()}`;
let instance: ObsidianApp;
let today: string;
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
    const tasks = [
      ['Recurring', 'Daily planning with the whole product team', 'open', '', 0, 'recurrence: FREQ=DAILY\n'],
      ['Hour', 'Review the release', 'open', 'T09:00', 60, ''],
      ['Long', 'Write release notes with the whole product team', 'open', 'T11:00', 90, ''],
      ['Unknown', 'Unconfigured status still has considered colour', 'cal3-unknown', '', 0, ''],
      ['Complete', 'Completed release checklist', 'done', '', 0, ''],
      ...Array.from({ length: 3 }, (_, index) => [`Collision${index}`, `Collision review ${index}`, 'open', 'T14:00', 60, '']),
    ];
    for (const [name, title, status, time, duration, extra] of tasks) {
      await app.vault.create(`${folder}/${name}.md`, `---\ntags: [task]\ntitle: ${title}\nstatus: ${status}\npriority: normal\nscheduled: ${date}${time}\ntimeEstimate: ${duration}\n${extra}---\n`);
    }
    await app.vault.create(`${folder}/Calendar.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\nviews:\n  - type: tasknotesCalendar\n    name: Cal3\n    calendarView: dayGridMonth\n    showMonthDayPanel: true\n    showOverdueOnToday: false\n    showCompleted: true\n    slotMinTime: '08:00:00'\n    slotMaxTime: '18:00:00'\n`);
    const daily = app.internalPlugins.getEnabledPluginById('daily-notes');
    (window as any).cal3DailyFolder = daily.options.folder;
    daily.options.folder = folder;
    plugin.settings.calendarViewSettings.enableTimeblocking = true;
    await app.vault.create(`${folder}/${date}.md`, `---\ntimeblocks:\n  - id: cal3-range\n    title: Calendar focus\n    startTime: '16:00'\n    endTime: '17:30'\n---\n`);
    const leaf = app.workspace.getLeaf(true);
    (window as any).cal3Leaf = leaf;
    await leaf.openFile(app.vault.getAbstractFileByPath(`${folder}/Calendar.base`));
    app.workspace.setActiveLeaf(leaf, { focus: true });
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    return date;
  }, folder);
  await expect(instance.page.locator('.workspace-leaf.mod-active .tnc').first()).toBeVisible();
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await instance.page.evaluate(async folder => {
      const app = (window as any).app;
      app.internalPlugins.getEnabledPluginById('daily-notes').options.folder = (window as any).cal3DailyFolder;
      (window as any).cal3Leaf.detach();
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally {
    await closeObsidian(instance);
  }
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
  await instance.page.evaluate(({ view, today }) => (window as any).cal3Leaf.view.controller.view.calendar.changeView(view, today), { view, today });
  const persisted = ({ month: 'dayGridMonth', week: 'timeGridWeek', day: 'timeGridDay', year: 'multiMonthYear' } as Record<string, string>)[view];
  await expect.poll(() => instance.page.evaluate(async folder => {
    const app = (window as any).app;
    return app.vault.read(app.vault.getAbstractFileByPath(`${folder}/Calendar.base`));
  }, folder)).toContain(`calendarView: ${persisted}`);
  await expect.poll(() => instance.page.evaluate(() => Boolean((window as any).cal3Leaf.view.controller.view._saveViewTypeTimer))).toBe(false);
  const effective = view === 'week' && await instance.page.locator('.advanced-calendar-view').first().evaluate(element => element.clientWidth < 640) ? 'days' : view;
  await expect(instance.page.locator(`.workspace-leaf.mod-active .tnc--${effective}`).first()).toBeVisible();
}

async function capture(name: string) {
  await instance.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await instance.page.screenshot({ path: `${evidence}/${name}.png` });
}

test('month recurrence keeps readable geometry and ink in both themes and input modes', async () => {
  test.setTimeout(120000);
  const observations = [];
  for (const theme of ['light', 'dark']) {
    for (const width of [1180, 760, 400]) {
      for (const mobile of width === 400 ? [false, true] : [false]) {
        await appearance(width, theme, mobile);
        await mode('month');
        const recurring = instance.page.locator('.tnc-dg .fc-pattern-instance-event').first();
        await expect(recurring).toBeVisible();
        if (await recurring.evaluate(element => Boolean(element.closest('.tnc-dg--dots:not(.tnc-dg--chips)')))) {
          expect(await recurring.evaluate(element => Math.round(element.getBoundingClientRect().height))).toBeGreaterThanOrEqual(6);
          await expect(instance.page.locator('.tn-calendar-day-panel .task-card').first()).toBeVisible();
          await capture(`month-${theme}-${width}${mobile ? '-touch' : ''}`);
          continue;
        }
        const geometry = await recurring.evaluate(element => {
          const style = getComputedStyle(element);
          const title = element.querySelector<HTMLElement>('.tn-calendar-event-title')!;
          const context = document.createElement('canvas').getContext('2d')!;
          const luminance = (color: string) => {
            context.fillStyle = color;
            context.fillRect(0, 0, 1, 1);
            const channels = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => {
              const channel = value / 255;
              return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
            });
            return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
          };
          const ink = luminance(style.color);
          const fill = luminance(style.backgroundColor);
          return { height: element.getBoundingClientRect().height, titleHeight: title.getBoundingClientRect().height, borderTop: style.borderTopWidth, borderBottom: style.borderBottomWidth, ink: style.color, opacity: style.opacity, fill: style.backgroundColor, contrast: (Math.max(ink, fill) + 0.05) / (Math.min(ink, fill) + 0.05) };
        });
        observations.push({ width, theme, mobile, ...geometry });
        await capture(`month-${theme}-${width}${mobile ? '-touch' : ''}`);
        if (!baseline) {
          expect(geometry.height).toBeGreaterThanOrEqual(geometry.titleHeight);
          expect(geometry.borderTop).toBe('0px');
          expect(geometry.borderBottom).toBe('0px');
          expect(geometry.opacity).toBe('1');
          expect(geometry.contrast).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
    await appearance(1180, theme);
    await mode('month');
    const more = instance.page.locator('.tnc-dg .tnc-more').first();
    await more.click();
    const unknown = instance.page.locator('.tnc-popover [data-task-path$="/Unknown.md"]');
    await expect(unknown).toBeVisible();
    if (!baseline) expect(await unknown.evaluate(element => element.style.getPropertyValue('--tn-calendar-status-color'))).toBe('var(--tnc-accent)');
    await capture(`month-overflow-${theme}-1180`);
    await instance.page.keyboard.press('Escape');
  }
  writeFileSync(`${evidence}/month.json`, JSON.stringify(observations, null, 2));
});

test('timed range follows available width and survives a live resize and cancellation', async () => {
  test.setTimeout(120000);
  const page = instance.page;
  const observations = [];
  for (const theme of ['light', 'dark']) {
    await appearance(1180, theme);
    await mode('day');
    if (!baseline) {
      const allDay = page.locator('.tnc-allday-layer');
      expect((await allDay.boundingBox())!.height).toBeLessThan(100);
      await allDay.locator('.tnc-more').click();
      await expect(page.locator('.tnc-popover [data-task-path$="/Unknown.md"]')).toBeVisible();
      await expect(page.locator('.tnc-popover [data-task-path$="/Recurring.md"]')).toBeVisible();
      await page.keyboard.press('Escape');
    }
    await page.evaluate(async () => {
      const view = (window as any).cal3Leaf.view.controller.view;
      view.viewOptions.showTimeblocks = true;
      await view.refreshCalendarWithFreshData();
    });
    const timeblock = page.locator('[data-id="timeblock-cal3-range"]');
    await expect(timeblock).toBeVisible();
    if (!baseline) await expect(timeblock.locator('.tnc-item-time-end')).toBeVisible();
    for (const name of ['Hour', 'Long']) {
      const event = page.locator(`.tnc-item--timed[data-task-path$="/${name}.md"]`).first();
      await event.scrollIntoViewIfNeeded();
      const geometry = await event.locator('.tnc-item-time-end').evaluate(element => ({ display: getComputedStyle(element).display, text: element.textContent }));
      observations.push({ theme, name, ...geometry });
      if (!baseline) expect(geometry.display).not.toBe('none');
    }
    await capture(`day-${theme}-1180`);
    const event = page.locator('.tnc-item--timed[data-task-path$="/Long.md"]').first();
    const initial = await event.boundingBox();
    const handle = event.locator('.tnc-resize-end');
    await handle.hover();
    const target = (await handle.boundingBox())!;
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + 40, { steps: 12 });
    await expect(page.locator('.tnc-dragging-resize-end')).toBeVisible();
    const live = await event.locator('.tnc-item-time-end').evaluate(element => ({ display: getComputedStyle(element).display, text: element.textContent }));
    observations.push({ theme, name: 'live-resize', ...live });
    await capture(`resize-${theme}-1180`);
    if (!baseline) expect(live.display).not.toBe('none');
    if (!baseline) expect(live.text).not.toBe(' – 12:30');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(page.locator('.tnc-dragging-resize-end')).toHaveCount(0);
    await expect.poll(async () => (await event.boundingBox())!.height).toBe(initial!.height);
    await appearance(400, theme, true);
    await capture(`day-${theme}-400`);
    await mode('week');
    await capture(`week-${theme}-400`);
    await appearance(1180, theme);
    await capture(`week-${theme}-1180`);
  }
  writeFileSync(`${evidence}/time.json`, JSON.stringify(observations, null, 2));
});

test('year density and collision hierarchy keep their content and keyboard targets', async () => {
  test.setTimeout(120000);
  for (const theme of ['light', 'dark']) {
    for (const width of [1180, 400]) {
      await appearance(width, theme, width === 400);
      await mode('year');
      const day = instance.page.locator(`.tnc-ym-day[data-date="${today}"]`);
      await expect(day).toHaveAttribute('data-count', /[1-9]/);
      await day.focus();
      await expect(day).toBeFocused();
      await capture(`year-${theme}-${width}`);
      await mode('week');
      const collision = instance.page.locator('.tnc-more--collision').first();
      await collision.scrollIntoViewIfNeeded();
      await expect(collision.locator('.tnc-collision-title')).not.toBeEmpty();
      if (!baseline) {
        const geometry = await collision.evaluate(element => {
          const bounds = element.getBoundingClientRect();
          const range = element.querySelector('.tnc-collision-range')!.getBoundingClientRect();
          const title = element.querySelector('.tnc-collision-title')!.getBoundingClientRect();
          return { height: bounds.height, rangeHeight: range.height, titleHeight: title.height, last: Math.max(range.bottom, title.bottom), bottom: bounds.bottom, hit: document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)?.closest('button') === element };
        });
        expect(geometry.height).toBeGreaterThanOrEqual(40);
        expect(geometry.rangeHeight).toBeGreaterThan(10);
        expect(geometry.titleHeight).toBeGreaterThan(10);
        expect(geometry.last).toBeLessThanOrEqual(geometry.bottom);
        expect(geometry.hit).toBe(true);
      }
      await capture(`collision-${theme}-${width}`);
    }
  }
});
