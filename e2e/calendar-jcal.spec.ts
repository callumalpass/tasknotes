import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

const baseline = process.env.TASKNOTES_JCAL_BASELINE === '1';
const output = `/tmp/tasknotes-r7/jcal/${baseline ? 'before' : 'after'}`;
const folder = 'CalendarJcal';
const root = '.workspace-leaf.mod-active #bases-calendar';
let instance: ObsidianApp;
test.use({ trace: 'on' });

test.beforeAll(async () => {
  mkdirSync(output, { recursive: true });
  instance = await launchObsidian();
  await instance.page.clock.setFixedTime(new Date('2026-11-07T11:00:00+11:00'));
  await instance.page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    (window as any).jcalSettings = structuredClone(plugin.settings);
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    await app.vault.createFolder(folder);
    for (const [name, title, dates] of [
      ['Scheduled', 'Review release notes', 'scheduled: 2026-11-07T13:00\ndue: 2026-11-07T14:00\ntimeEstimate: 60'],
      ['Long', 'Review the longer proposal with the entire accessibility and design team', 'scheduled: 2026-11-07'],
      ['Plain', 'Prepare workshop', 'scheduled: 2026-11-07'],
      ['Other', 'Prepare workshop', 'scheduled: 2026-11-07'],
      ['Tomorrow', 'Tomorrow has activity too', 'scheduled: 2026-11-08'],
    ]) {
      await app.vault.create(`${folder}/${name}.md`, `---\ntitle: ${title}\ntags: [task]\nstatus: open\npriority: normal\n${dates}\n---\n`);
    }
    await app.vault.create(`${folder}/Calendar.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\nviews:\n  - type: tasknotesCalendar\n    name: Calendar\n    calendarView: timeGridWeek\n    showMonthDayPanel: true\n    showScheduled: true\n    showDue: true\n    showOverdueOnToday: false\n    showRecurring: false\n    scrollTime: '11:00:00'\n`);
    await app.vault.create(`${folder}/Mini.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\nviews:\n  - type: tasknotesMiniCalendar\n    name: Mini\n    dateProperty: note.scheduled\n`);
    const leaf = app.workspace.getLeaf(true);
    (window as any).jcalLeaf = leaf;
    await leaf.openFile(app.vault.getAbstractFileByPath(`${folder}/Calendar.base`));
    app.workspace.setActiveLeaf(leaf, { focus: true });
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    const native = (window as any).require('electron').remote.getCurrentWindow();
    native.setMinimumSize(320, 500);
    if (native.isMaximized()) native.unmaximize();
  }, folder);
  await expect(instance.page.locator(`${root} .tnc-col`).first()).toBeVisible({ timeout: 20000 });
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await instance.page.evaluate(async folder => {
      const app = (window as any).app;
      app.plugins.plugins.tasknotes.settings = (window as any).jcalSettings;
      (window as any).jcalLeaf.detach();
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally { await closeObsidian(instance); }
});

async function appearance(width: number, theme: string, mobile = false) {
  await setObsidianViewport(instance.page, { width, height: 800 });
  await instance.page.evaluate(({ theme, mobile }) => {
    document.body.classList.toggle('is-mobile', mobile);
    (window as any).app.changeTheme(`obsidian${theme === 'dark' ? '' : '-light'}`);
  }, { theme, mobile });
}

async function mode(view: string) {
  await instance.page.evaluate(view => (window as any).jcalLeaf.view.controller.view.calendar.changeView(view, '2026-11-07'), view);
  await expect.poll(() => instance.page.evaluate(() => {
    const view = (window as any).jcalLeaf.view.controller.view;
    return Boolean(view._saveViewTypeTimer || view._isRendering || view._pendingRender || view._configChangedNeedsRecreate);
  })).toBe(false);
  await expect(instance.page.locator(`${root} > .tnc--${view}`)).toBeVisible();
  await instance.page.locator(root).evaluate(async element => {
    await Promise.all(element.getAnimations({ subtree: true }).filter(animation => animation instanceof CSSAnimation && animation.animationName === 'tn-calendar-view-enter').map(animation => animation.finished.catch(() => undefined)));
  });
}

async function shot(name: string) {
  const cdp = await instance.page.context().newCDPSession(instance.page);
  try {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(`${output}/${name}.png`, Buffer.from(data, 'base64'));
  } finally { await cdp.detach(); }
}

test('week dates fit every header and compact month reveals selected-day titles', async () => {
  test.setTimeout(180000);
  const measurements = [];
  for (const theme of ['light', 'dark']) for (const [width, mobile] of [[1180, false], [700, false], [472, false], [400, false], [400, true]] as const) {
    await appearance(width, theme, mobile);
    await mode('week');
    const headers = await instance.page.locator(`${root} .tnc-dh`).evaluateAll(elements => elements.map(element => {
      const parent = element.getBoundingClientRect();
      return { date: element.getAttribute('data-date'), children: Array.from(element.querySelectorAll('.tnc-dh-dow, .tnc-dh-num')).map(child => {
        const bounds = child.getBoundingClientRect();
        return { text: child.textContent, contained: bounds.left >= parent.left && bounds.right <= parent.right && bounds.top >= parent.top && bounds.bottom <= parent.bottom };
      }) };
    }));
    await shot(`week-${theme}-${width}-${mobile ? 'mobile' : 'pane'}`);
    if (!baseline) expect(headers.every(header => header.children.every(child => child.contained))).toBe(true);
    await mode('month');
    await expect(instance.page.locator(`${root} .tn-calendar-day-panel .task-card__title`).first()).toBeVisible();
    const month = await instance.page.locator(root).evaluate(element => {
      const weeks = Array.from(element.querySelectorAll('.tnc-dg-week')).map(week => week.getBoundingClientRect().height);
      const title = element.querySelector('.tn-calendar-day-panel .task-card__title')!.getBoundingClientRect();
      return { weeks, firstTitleTop: title.top, dates: element.querySelectorAll('.tnc-dg-day').length };
    });
    await shot(`month-${theme}-${width}-${mobile ? 'mobile' : 'pane'}`);
    if (!baseline && width === 400) {
      expect(month.firstTitleTop).toBeLessThan(600);
      expect(month.weeks.every(height => height >= 40 && height <= 52)).toBe(true);
      expect(month.dates).toBe(42);
    }
    measurements.push({ theme, width, mobile, headers, month });
  }
  writeFileSync(`${output}/geometry.json`, JSON.stringify(measurements, null, 2));
});

test('held calendar move retains original source, cancellation and persisted Undo', async () => {
  test.setTimeout(120000);
  const page = instance.page;
  for (const theme of ['light', 'dark']) {
    await appearance(1180, theme);
    await mode('day');
    const event = page.locator(`${root} .tnc-item--timed[data-task-path="${folder}/Scheduled.md"]`).filter({ hasText: 'Review release notes' }).first();
    await event.scrollIntoViewIfNeeded();
    const start = await event.boundingBox();
    expect(start).not.toBeNull();
    const begin = async () => {
      await page.mouse.move(start!.x + start!.width / 2, start!.y + 20);
      await page.mouse.down();
      await page.mouse.move(start!.x + start!.width / 2, start!.y + 20 + start!.height * 2, { steps: 12 });
      await expect(page.locator(`${root} .tnc-dragging`)).toHaveCount(1);
      if (!baseline) await expect.poll(() => event.evaluate(element => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0.9);
    };
    await shot(`day-${theme}-rest`);
    await begin();
    await shot(`day-${theme}-held`);
    writeFileSync(`${output}/day-${theme}-held.json`, JSON.stringify(await page.locator(`${root} .tnc-item--timed`).evaluateAll(elements => elements.map(element => ({
      text: element.textContent, classes: element.className, opacity: getComputedStyle(element).opacity, top: element.getBoundingClientRect().top,
    }))), null, 2));
    if (!baseline) {
      const source = page.locator(`${root} .tnc-drag-source`).first();
      await expect(source).toBeVisible();
      const held = await source.boundingBox();
      expect(Math.abs(held!.y - start!.y)).toBeLessThan(1);
      expect(await source.evaluate(element => Number(getComputedStyle(element).opacity))).toBeLessThan(0.6);
    }
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(page.locator(`${root} .tnc-drag-source, ${root} .tnc-dragging`)).toHaveCount(0);
    const read = () => page.evaluate(folder => {
      const app = (window as any).app;
      return app.vault.read(app.vault.getAbstractFileByPath(`${folder}/Scheduled.md`));
    }, folder);
    expect(await read()).toContain('scheduled: 2026-11-07T13:00');
    await begin();
    await page.mouse.up();
    await expect.poll(read).toContain('scheduled: 2026-11-07T15:00');
    await expect(page.locator(`${root} .is-write-pending`)).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(read).toContain('scheduled: 2026-11-07T13:00');
    await expect(page.locator(`${root} .is-write-pending`)).toHaveCount(0);
  }
});

test('mini-calendar titles lead while file identity and direct note access remain', async () => {
  const page = instance.page;
  await page.evaluate(async folder => {
    const app = (window as any).app;
    await (window as any).jcalLeaf.openFile(app.vault.getAbstractFileByPath(`${folder}/Mini.base`));
  }, folder);
  for (const theme of ['light', 'dark']) for (const width of [1180, 400]) {
    await appearance(width, theme, width === 400);
    const entry = page.locator(`.mini-calendar-view__entry[data-entry-path="${folder}/Scheduled.md"]`);
    if (!await entry.isVisible()) {
      await page.locator('.workspace-leaf.mod-active .mini-calendar-view__day[aria-current="date"]').click();
      await expect(page.locator('.modal-container')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.modal-container')).toHaveCount(0);
    }
    await expect(entry).toBeVisible();
    await shot(`mini-${theme}-${width}`);
    if (!baseline) {
      await expect(entry).toHaveAttribute('title', `Review release notes\n${folder}/Scheduled.md`);
      expect(await entry.boundingBox().then(bounds => bounds!.height)).toBeGreaterThanOrEqual(40);
      const identity = entry.locator('.tn-picker__detail');
      await expect(identity).toHaveText('Scheduled');
      expect(await identity.evaluate(element => element.clientWidth >= element.scrollWidth)).toBe(true);
    }
  }
  await page.locator(`.mini-calendar-view__entry[data-entry-path="${folder}/Scheduled.md"]`).click();
  await expect.poll(() => page.evaluate(() => (window as any).app.workspace.getActiveFile()?.path)).toBe(`${folder}/Scheduled.md`);
});
