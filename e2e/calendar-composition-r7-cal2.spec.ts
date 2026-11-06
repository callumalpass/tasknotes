import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
const folder = 'CalendarCal2';
const root = '.workspace-leaf.mod-active #bases-calendar';
const output = '/tmp/tasknotes-r7/cal2';
const baseline = process.env.CAL2_BASELINE === '1';
test.use({ trace: 'on' });

test.beforeAll(async () => {
  mkdirSync(output, { recursive: true });
  instance = await launchObsidian();
  await instance.page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    (window as any).cal2Settings = JSON.parse(JSON.stringify(plugin.settings));
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    plugin.settings.hideIdentifyingTagsInCards = true;
    await app.vault.createFolder(folder);
    for (const [name, title, properties] of [
      ['Launch', 'Launch planning with the product team', 'scheduled: 2026-11-10\nstatus: open'],
      ['Research', 'Research interviews and synthesis', 'scheduled: 2026-11-10\nstatus: in-progress'],
      ['Deadline', 'Submit the research proposal', 'due: 2026-11-10T10:00\nstatus: open'],
      ['Review', 'Review the calendar composition with the product team', 'scheduled: 2026-11-10T11:00\ntimeEstimate: 60\nstatus: open'],
      ['Collision', 'Resolve overlapping schedules', 'scheduled: 2026-11-10T11:15\ntimeEstimate: 60\nstatus: in-progress'],
      ['Long', 'A very long title that must retain its identity in a compact calendar cell without an ellipsis', 'scheduled: 2026-11-10\nstatus: open\ncontexts: [studio, research]\nprojects: [Project]\npriority: high'],
      ['Tomorrow', 'Prepare tomorrow’s workshop', 'scheduled: 2026-11-11\nstatus: done'],
    ]) await app.vault.create(`${folder}/${name}.md`, `---\ntitle: ${title}\ntags: [task]\n${properties}\n---\n`);
    await app.vault.create(`${folder}/Calendar.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\nviews:\n  - type: tasknotesCalendar\n    name: Calendar\n    calendarView: month\n    showMonthDayPanel: true\n    showDue: true\n    showOverdueOnToday: false\n    order: [status, priority, scheduled, due, projects, contexts, file.tags]\n`);
    const leaf = app.workspace.getLeaf(true);
    (window as any).cal2Leaf = leaf;
    await leaf.openFile(app.vault.getAbstractFileByPath(`${folder}/Calendar.base`));
    app.workspace.setActiveLeaf(leaf, { focus: true });
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    const native = (window as any).require('electron').remote.getCurrentWindow();
    native.setMinimumSize(320, 500);
    if (native.isMaximized()) native.unmaximize();
  }, folder);
  await expect(instance.page.locator(`${root} .tnc-dg-day`).first()).toBeVisible({ timeout: 20000 });
  const startupNotice = instance.page.locator('.notice').filter({ hasText: 'Secrets are stored without encryption' });
  if (await startupNotice.count()) await startupNotice.click({ position: { x: 8, y: 8 } });
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await instance.page.evaluate(async folder => {
      const app = (window as any).app;
      app.plugins.plugins.tasknotes.settings = (window as any).cal2Settings;
      (window as any).cal2Leaf.detach();
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
      document.body.classList.remove('is-mobile');
    }, folder);
  } finally { await closeObsidian(instance); }
});

async function mode(view: string, date?: string) {
  await instance.page.evaluate(({ view, date }) => (window as any).cal2Leaf.view.controller.view.calendar.changeView(view, date), { view, date });
  await instance.page.locator(root).evaluate(async element => {
    await Promise.all(element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').map(animation => animation.finished.catch(() => undefined)));
  });
}

test('selected month date follows the view switch and deadlines have no invented duration', async () => {
  await setObsidianViewport(instance.page, { width: 1180, height: 820 });
  await mode('month', '2026-11-06');
  await instance.page.locator(`${root} > .tnc .tnc-dg-day[data-date="2026-11-10"] .tnc-dg-num`).click();
  await expect(instance.page.locator(`${root} .tn-calendar-day-panel .task-card`).first()).toBeVisible();
  await instance.page.locator(`${root} > .tnc .tnc-btn-view-day`).click();
  const selectedDate = await instance.page.evaluate(() => (window as any).cal2Leaf.view.controller.view.calendar.getDate().getDate());
  await mode('list', '2026-11-10');
  const deadline = instance.page.locator(`${root} .tnc-item[data-event-type="due"]`).first();
  await expect(deadline).toBeVisible();
  const deadlineText = await deadline.innerText();
  const deadlineLabel = await deadline.getAttribute('aria-label');
  writeFileSync(`${output}/${baseline ? 'before' : 'after'}-behavior.json`, JSON.stringify({ selectedDate, deadlineText, deadlineLabel }, null, 2));
  if (!baseline) {
    expect(selectedDate).toBe(10);
    expect(deadlineText).not.toContain('10:30');
    expect(deadlineLabel).not.toContain('10:30');
  }
});

test('calendar composition matrix preserves identity, geometry and interaction', async () => {
  test.setTimeout(180000);
  const page = instance.page;
  const measurements: unknown[] = [];
  for (const width of [1180, 700, 400]) for (const theme of ['light', 'dark']) {
    await setObsidianViewport(page, { width, height: 820 });
    await page.evaluate(({ theme, width }) => {
      document.body.classList.remove('theme-light', 'theme-dark', 'is-mobile');
      document.body.classList.add(`theme-${theme}`);
      document.body.classList.toggle('is-mobile', width === 400);
    }, { theme, width });
    await expect.poll(() => page.evaluate(() => (window as any).require('electron').remote.getCurrentWindow().getContentSize())).toEqual([width, 820]);
    for (const view of ['month', 'list', 'day', 'week']) {
      await mode(view, '2026-11-10');
      if (view === 'month') {
        await page.locator(`${root} > .tnc .tnc-dg-day[data-date="2026-11-10"] .tnc-dg-num`).click();
        await expect(page.locator(`${root} .tn-calendar-day-panel .task-card`).first()).toBeVisible();
      }
      await page.screenshot({ path: `${output}/${baseline ? 'before' : 'after'}-${view}-${theme}-${width}.png` });
      measurements.push(await page.locator(root).evaluate((element, args) => {
        const selectors = ['.tnc-toolbar', '.tnc-strip', '.tnc-dg-grid', '.tn-calendar-day-panel', '.tnc-tg-body', '.tnc-tg-scroll', '.tnc-list', '.tnc-allday-layer'];
        const geometry = Object.fromEntries(selectors.map(selector => {
          const node = element.querySelector(selector);
          const rect = node?.getBoundingClientRect();
          return [selector, rect ? { top: rect.top, height: rect.height, width: rect.width, overflow: getComputedStyle(node!).overflowY } : null];
        }));
        const titles = [...element.querySelectorAll('.tnc-item--list')].map(item => ({
          type: item.getAttribute('data-event-type'),
          left: item.querySelector('.task-card__title')?.getBoundingClientRect().left,
        }));
        return { ...args, geometry, titles };
      }, { width, theme, view }));
      if (!baseline && view === 'month' && width <= 700) {
        writeFileSync(`${output}/chip-geometry.json`, JSON.stringify(await page.locator(`${root} > .tnc .tnc-dg-day[data-date="2026-11-10"]`).evaluate(element => [...element.querySelectorAll('.tnc-dg-dots, .tnc-item--indicator')].map(node => ({
          className: node.className, bounds: node.getBoundingClientRect().toJSON(),
          chip: getComputedStyle(node).getPropertyValue('--tnc-chip-h'),
          gap: getComputedStyle(node).getPropertyValue('--tnc-dot-gap'),
          top: getComputedStyle(node).top, bottom: getComputedStyle(node).bottom,
        }))), null, 2));
        const day = page.locator(`${root} > .tnc .tnc-dg-day[data-date="2026-11-10"]`);
        await expect(day.locator('.tnc-item--indicator').first()).toBeVisible();
        const count = day.locator('.tnc-dg-dots-more');
        const hiddenCount = await count.isVisible() ? Number((await count.innerText()).slice(1)) : 0;
        expect(await day.locator('.tnc-item--indicator').count() + hiddenCount).toBe(6);
        const panel = page.locator(`${root} .tn-calendar-day-panel`);
        await expect(panel.locator('.task-card')).toHaveCount(6);
        const title = panel.locator('.task-card__title-text').first();
        await expect(title).toBeVisible();
        await expect(title).toHaveCSS('white-space', 'normal');
        await page.locator(`${root} > .tnc .tnc-dg-day[data-date="2026-11-11"] .tnc-dg-num`).click();
        await expect(panel.locator('.task-card--completed').first()).toBeVisible();
        await expect(panel.locator('.task-card--completed').first()).toHaveCSS('opacity', '1');
      }
    }
  }
  writeFileSync(`${output}/${baseline ? 'before' : 'after'}-geometry.json`, JSON.stringify(measurements, null, 2));
});

test('custom event colours retain contrast, point targets and keyboard or pointer state', async () => {
  if (baseline) return;
  const page = instance.page;
  const contrastByTheme: unknown[] = [];
  await setObsidianViewport(page, { width: 400, height: 820 });
  await mode('day', '2026-11-10');
  await page.evaluate(() => {
    const view = (window as any).cal2Leaf.view.controller.view;
    (window as any).cal2SetItems = view.setCalendarItems;
    const colours = ['#f3df35', '#071d3f', 'var(--color-green)'].map((color, index) => ({
        id: `cal2-colour-${index}`, title: ['Yellow calendar event', 'Dark calendar event', 'Theme calendar event'][index],
        start: `2026-11-10T${13 + index}:00`, end: `2026-11-10T${14 + index}:00`,
        color, allDay: false, editable: false, data: { eventType: 'ics' },
      }));
    view.setCalendarItems = (items: any[]) => (window as any).cal2SetItems.call(view, [
      ...items.filter(item => !item.id.startsWith('cal2-colour-')), ...colours,
    ]);
    view.setCalendarItems(view.calendarItems);
  });
  const event = page.locator(`${root} .tnc-item[data-id="cal2-colour-0"]`);
  await event.scrollIntoViewIfNeeded();
  const geometry = await event.boundingBox();
  expect(geometry!.height).toBeGreaterThanOrEqual(40);
  expect(geometry!.width).toBeGreaterThanOrEqual(40);
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => {
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(`theme-${theme}`);
      (window as any).app.workspace.trigger('css-change');
    }, theme);
    const contrasts = async () => page.locator(`${root} .tnc-item[data-id^="cal2-colour-"]`).evaluateAll(elements => elements.map(element => {
      const style = getComputedStyle(element);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d')!;
      const luminance = (color: string) => {
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        const channels = Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3).map(value => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      const foreground = luminance(style.color);
      const background = luminance(style.backgroundColor);
      return { id: element.getAttribute('data-id'), contrast: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05) };
    }));
    await expect(page.locator(`${root} .tnc-item[data-id^="cal2-colour-"]`)).toHaveCount(3);
    await expect.poll(async () => Math.min(...(await contrasts()).map(result => result.contrast))).toBeGreaterThanOrEqual(4.5);
    const restingColours = await contrasts();
    for (let index = 0; index < 3; index++) {
      await page.locator(`${root} .tnc-item[data-id="cal2-colour-${index}"]`).hover();
      await expect.poll(async () => (await contrasts())[index].contrast).toBeGreaterThanOrEqual(4.5);
    }
    contrastByTheme.push({ theme, colours: restingColours, hoveredColours: await contrasts() });
    await event.hover();
    expect(await event.boundingBox()).toEqual(geometry);
    await page.keyboard.press('Tab');
    await event.focus();
    await expect(event).toBeFocused();
    await page.screenshot({ path: `${output}/after-colours-${theme}-400-focus.png` });
    await page.locator(`${root} .tnc-more`).first().click();
    await expect(page.locator('.tnc-popover')).toBeVisible();
    const popoverTasks = await page.locator('.tnc-popover .tnc-item').count();
    expect(popoverTasks).toBeGreaterThan(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.tnc-popover')).toHaveCount(0);
  }
  await page.evaluate(() => {
    const view = (window as any).cal2Leaf.view.controller.view;
    view.setCalendarItems = (window as any).cal2SetItems;
  });
  await mode('month', '2026-11-10');
  const emptyDay = page.locator(`${root} > .tnc .tnc-dg-day[data-date="2026-11-12"]`);
  await emptyDay.focus();
  await page.keyboard.press('Enter');
  await expect(emptyDay).toBeFocused();
  await expect(emptyDay).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator(`${root} .tn-calendar-day-panel .tnc-list-empty`)).toBeVisible();
  writeFileSync(`${output}/after-contrast.json`, JSON.stringify(contrastByTheme, null, 2));
});
