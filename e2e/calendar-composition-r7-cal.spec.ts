import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
let today: string;
let emptyDay: string;
const folder = `CalendarComposition-${Date.now()}`;
const output = '/tmp/tasknotes-r7/cal2/regression';
const root = '.workspace-leaf.mod-active #bases-calendar';
test.use({ trace: 'on' });

test.beforeAll(async () => {
  mkdirSync(output, { recursive: true });
  instance = await launchObsidian();
  const dates = await instance.page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    (window as any).calCompositionSettings = JSON.parse(JSON.stringify(plugin.settings));
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    plugin.settings.hideIdentifyingTagsInCards = true;
    const date = new Date();
    const day = (offset: number) => {
      const target = new Date(date);
      target.setDate(target.getDate() + offset);
      return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
    };
    await app.vault.createFolder(folder);
    for (const [name, title, properties] of [
      ['Plain', 'A quiet all-day task', ''],
      ['Timed', 'Review the calendar composition with the product team', '\ntimeEstimate: 45'],
      ['Rich', 'A very long calendar title that must remain readable without narrowing to tiny fragments', `\ndue: ${day(2)}\ncontexts: [studio, research, long-context-name]\nprojects: [Project]\n`],
      ['Unknown', 'Custom unknown workflow values remain visible', ''],
    ]) {
      await app.vault.create(`${folder}/${name}.md`, `---\ntitle: ${title}\ntags: [task]\nstatus: ${name === 'Unknown' ? 'custom-workflow' : 'open'}\npriority: ${name === 'Unknown' ? 'custom-priority' : 'high'}\nscheduled: ${day(0)}${name === 'Timed' ? 'T10:00' : ''}${properties}\n---\nCalendar fixture details.\n`);
    }
    await app.vault.create(`${folder}/Calendar.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\nviews:\n  - type: tasknotesCalendar\n    name: Calendar composition\n    calendarView: listWeek\n    showMonthDayPanel: true\n    showDue: false\n    showOverdueOnToday: false\n    order: [status, priority, scheduled, due, projects, contexts, file.tags]\n`);
    const leaf = app.workspace.getLeaf(true);
    (window as any).calCompositionLeaf = leaf;
    await leaf.openFile(app.vault.getAbstractFileByPath(`${folder}/Calendar.base`));
    app.workspace.setActiveLeaf(leaf, { focus: true });
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    const native = (window as any).require('electron').remote.getCurrentWindow();
    native.setMinimumSize(320, 500);
    if (native.isMaximized()) native.unmaximize();
    const empty = new Date(date.getFullYear(), date.getMonth(), date.getDate() === 1 ? 2 : 1);
    return { today: day(0), emptyDay: `${empty.getFullYear()}-${String(empty.getMonth() + 1).padStart(2, '0')}-${String(empty.getDate()).padStart(2, '0')}` };
  }, folder);
  today = dates.today;
  emptyDay = dates.emptyDay;
  await expect(instance.page.locator(`${root} .tn-calendar-list-entry`).first()).toBeVisible({ timeout: 20000 });
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await instance.page.evaluate(async folder => {
      const app = (window as any).app;
      app.plugins.plugins.tasknotes.settings = (window as any).calCompositionSettings;
      (window as any).calCompositionLeaf.detach();
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
      document.body.classList.remove('is-mobile');
    }, folder);
  } finally { await closeObsidian(instance); }
});

async function resize(width: number, theme: string, mobile = false) {
  const page = instance.page;
  await setObsidianViewport(page, { width, height: 820 });
  await page.evaluate(({ theme, mobile }) => {
    document.body.classList.remove('theme-light', 'theme-dark', 'is-mobile');
    document.body.classList.add(`theme-${theme}`);
    document.body.classList.toggle('is-mobile', mobile);
  }, { theme, mobile });
  await expect.poll(() => page.evaluate(() => (window as any).require('electron').remote.getCurrentWindow().getContentSize())).toEqual([width, 820]);
}

async function mode(view: string, date?: string) {
  await instance.page.evaluate(({ view, date }) => (window as any).calCompositionLeaf.view.controller.view.calendar.changeView(view, date), { view, date });
  await instance.page.locator(root).evaluate(async element => {
    await Promise.all(element.getAnimations({ subtree: true })
      .filter(animation => animation.playState === 'running')
      .map(animation => animation.finished.catch(() => undefined)));
  });
}

test('narrow desktop and mobile agenda keep titles full-width and controls on one supporting line', async () => {
  test.setTimeout(120000);
  const page = instance.page;
  for (const theme of ['light', 'dark']) for (const mobile of [false, true]) {
    await resize(400, theme, mobile);
    await mode('list');
    const card = page.locator(`${root} .task-card[data-task-path$="/Plain.md"]`).first();
    await expect(card).toBeVisible();
    const geometry = await card.evaluate(element => {
      const entry = element.closest('.tn-calendar-list-entry')!;
      const bounds = entry.getBoundingClientRect();
      const title = element.querySelector('.task-card__title-text')!.getBoundingClientRect();
      const selectors = ['.task-card__status-dot', '.task-card__priority-dot', '.task-card__context-menu', '.task-card__badges'];
      return {
        titleWidth: title.width, entryWidth: bounds.width,
        emptyStamp: entry.querySelector('.tn-calendar-list-stamp')!.getBoundingClientRect().width,
        controls: selectors.map(selector => {
          const control = element.querySelector(selector)!.getBoundingClientRect();
          return { y: control.y + control.height / 2, width: control.width, height: control.height };
        }),
      };
    });
    expect(geometry.titleWidth).toBeGreaterThanOrEqual(geometry.entryWidth - 36);
    expect(geometry.emptyStamp).toBe(0);
    for (const control of geometry.controls.slice(0, 3)) {
      expect(control.width).toBeGreaterThanOrEqual(40);
      expect(control.height).toBeGreaterThanOrEqual(40);
    }
    expect(Math.max(...geometry.controls.map(control => control.y)) - Math.min(...geometry.controls.map(control => control.y))).toBeLessThanOrEqual(1);
    const timed = page.locator(`${root} .task-card[data-task-path$="/Timed.md"]`).first();
    const timeAbove = await timed.evaluate(element => {
      const entry = element.closest('.tn-calendar-list-entry')!;
      return entry.querySelector('.tn-calendar-list-time')!.getBoundingClientRect().bottom <= element.querySelector('.task-card__title-text')!.getBoundingClientRect().top;
    });
    expect(timeAbove).toBe(true);
    const beforeHover = await card.boundingBox();
    await card.hover();
    expect(await card.boundingBox()).toEqual(beforeHover);
    await card.locator('.task-card__status-dot').focus();
    await expect(card.locator('.task-card__status-dot')).toBeFocused();
    await page.screenshot({ path: `${output}/agenda-${theme}-${mobile ? 'mobile' : 'narrow'}-focus.png` });
  }
});

test('month summaries and selected-day empty state survive pointer, keyboard and width changes', async () => {
  test.setTimeout(120000);
  const page = instance.page;
  for (const theme of ['light', 'dark']) {
    await resize(400, theme);
    await mode('month');
    await expect(page.locator(`${root} > .tnc .tnc-dg--chips`)).toBeVisible();
    await expect.poll(() => page.locator(`${root} > .tnc`).evaluate(element => {
      const weeks = element.querySelectorAll('.tnc-dg-week');
      return weeks[weeks.length - 1].getBoundingClientRect().bottom <= element.getBoundingClientRect().bottom + 1;
    })).toBe(true);
    const day = page.locator(`${root} > .tnc .tnc-dg-day[data-date="${today}"]`);
    await day.locator('.tnc-dg-num').click();
    await expect(day).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator(`${root} .tn-calendar-day-panel .task-card`).first()).toBeVisible();
    const empty = page.locator(`${root} > .tnc .tnc-dg-day[data-date="${emptyDay}"]`);
    await empty.focus();
    await page.keyboard.press('Enter');
    await expect(empty).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator(`${root} .tn-calendar-day-panel .tnc-list-empty`)).toBeVisible();
    const add = page.locator(`${root} .tn-calendar-day-panel-add`);
    await expect(add).toBeVisible();
    await add.focus();
    await expect(add).toBeFocused();
    await page.screenshot({ path: `${output}/month-empty-${theme}-400.png` });
    await resize(1180, theme);
    await expect(page.locator(`${root} > .tnc .tnc-dg--dots`)).toHaveCount(0);
    await expect(page.locator(`${root} > .tnc .tnc-dg-day[data-date="${emptyDay}"]`)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator(`${root} .tn-calendar-day-panel .tnc-list-empty`)).toBeVisible();
  }
});

test('compact task controls retain status cycling, shared Undo and metadata disclosure', async () => {
  const page = instance.page;
  await resize(400, 'light', true);
  await mode('list');
  const card = page.locator(`${root} .task-card[data-task-path$="/Plain.md"]`).first();
  const status = await page.evaluate(async folder => (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(`${folder}/Plain.md`).then((task: any) => task.status), folder);
  await card.locator('.task-card__status-dot').click();
  await expect.poll(() => page.evaluate(async folder => (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(`${folder}/Plain.md`).then((task: any) => task.status), folder)).not.toBe(status);
  await expect(page.locator('.tn-picker')).toHaveCount(0);
  await expect(page.locator('.menu')).toHaveCount(0);
  await page.locator('.tn-toast__action').filter({ hasText: 'Undo' }).click();
  await expect.poll(() => page.evaluate(async folder => (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(`${folder}/Plain.md`).then((task: any) => task.status), folder)).toBe(status);
  await card.locator('.task-card__priority-dot').click();
  await expect(page.locator('.menu')).toBeVisible();
  await page.keyboard.press('Escape');
  const rich = page.locator(`${root} .task-card[data-task-path$="/Rich.md"]`).first();
  const overflow = rich.locator('.task-card__metadata-overflow:not([hidden])');
  await expect(overflow).toBeVisible();
  await overflow.click();
  await expect(page.locator('.tn-picker')).toBeVisible();
  await expect(page.locator('.tn-picker')).toContainText('long-context-name');
  await page.screenshot({ path: `${output}/agenda-mobile-metadata-disclosure.png` });
  await page.keyboard.press('Escape');
});

test('year targets, configured glyphs and reduced-motion view changes stay usable', async () => {
  const page = instance.page;
  await resize(400, 'light');
  await mode('year');
  const days = await page.locator(`${root} .tnc-ym-day`).evaluateAll(elements => elements.map(element => ({width:Math.round(element.getBoundingClientRect().width * 100) / 100, height:Math.round(element.getBoundingClientRect().height * 100) / 100, minimum:parseFloat(getComputedStyle(element).minHeight)})));
  expect(Math.min(...days.map(day => day.width))).toBeGreaterThanOrEqual(40);
  expect(Math.min(...days.map(day => day.height))).toBeGreaterThanOrEqual(40);
  expect(Math.min(...days.map(day => day.minimum))).toBeGreaterThanOrEqual(40);
  expect(await page.locator(root).evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mode('list');
  expect(await page.locator(`${root} .tnc-list`).evaluate(element => getComputedStyle(element).animationDuration)).toBe('0s');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await mode('month');
  expect(await page.locator(`${root} > .tnc .tnc-dg`).evaluate(element => getComputedStyle(element).animationDuration)).toBe('0.25s');
  await resize(1180, 'light');
  await mode('day', today);
  await expect(page.locator(`${root} .tnc-item[data-task-path$="/Timed.md"] .tn-task-glyphs__priority`).first()).toBeVisible();
  await page.screenshot({ path: `${output}/day-chips-light-1180.png` });
});
