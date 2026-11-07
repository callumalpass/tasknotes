import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
const folder = 'CalendarWeekR7';
const root = '.workspace-leaf.mod-active #bases-calendar';
const output = '/tmp/tasknotes-r7/week';
const baseline = process.env.WEEK_BASELINE === '1';

test.beforeAll(async () => {
  mkdirSync(output, { recursive: true });
  instance = await launchObsidian();
  await instance.page.clock.setFixedTime(new Date('2026-11-07T11:00:00+11:00'));
  await instance.page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    await app.vault.createFolder(folder);
    const tasks = [
      ['Standup', 'Daily standup with the design team', 'scheduled: 2026-11-07T09:00\ntimeEstimate: 15\nrecurrence: FREQ=DAILY'],
      ['Long', 'Review the research findings with the entire product team before next week', 'scheduled: 2026-11-07T10:00\ntimeEstimate: 60'],
      ['Quiet', 'Prepare the workshop', 'scheduled: 2026-11-09'],
      ['Due', 'Send the final proposal', 'due: 2026-11-07'],
      ...Array.from({ length: 8 }, (_, index) => [`Busy${index}`, `Workshop preparation ${index}`, 'scheduled: 2026-11-07']),
      ...Array.from({ length: 5 }, (_, index) => [`Overlap${index}`, `Product review ${index}`, 'scheduled: 2026-11-07T11:00\ntimeEstimate: 60']),
    ];
    for (const [name, title, properties] of tasks) {
      await app.vault.create(`${folder}/${name}.md`, `---\ntitle: ${title}\ntags: [task]\nstatus: open\npriority: high\n${properties}\n---\n`);
    }
    await app.vault.create(`${folder}/Calendar.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\nviews:\n  - type: tasknotesCalendar\n    name: Calendar\n    calendarView: timeGridWeek\n    showMonthDayPanel: false\n    showScheduled: true\n    showRecurring: true\n    showDue: true\n    showOverdueOnToday: false\n`);
    const leaf = app.workspace.getLeaf(true);
    (window as any).weekLeaf = leaf;
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
      (window as any).weekLeaf.detach();
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
      document.body.classList.remove('is-mobile');
    }, folder);
  } finally { await closeObsidian(instance); }
});

async function mode(view: string, width = 1180, theme = 'light', mobile = false) {
  await setObsidianViewport(instance.page, { width, height: 820 });
  await instance.page.evaluate(({ view, theme, mobile }) => {
    document.body.classList.toggle('is-mobile', mobile);
    (window as any).app.changeTheme(`obsidian${theme === 'dark' ? '' : '-light'}`);
    (window as any).weekLeaf.view.controller.view.calendar.changeView(view, '2026-11-07');
  }, { view, theme, mobile });
  const persisted = ({ week: 'timeGridWeek', day: 'timeGridDay', month: 'dayGridMonth' } as Record<string, string>)[view];
  await expect.poll(() => instance.page.evaluate(async folder => {
    const app = (window as any).app;
    return app.vault.read(app.vault.getAbstractFileByPath(`${folder}/Calendar.base`));
  }, folder)).toContain(`calendarView: ${persisted}`);
  await expect.poll(() => instance.page.evaluate(() => Boolean((window as any).weekLeaf.view.controller.view._saveViewTypeTimer))).toBe(false);
  await expect(instance.page.locator(`${root} .tnc`)).toBeVisible();
}

async function shot(name: string) {
  await instance.page.screenshot({ path: `${output}/${baseline ? 'before' : 'after'}-${name}.png` });
}

for (const theme of ['light', 'dark']) {
  test(`week, day and month retain readable content across pane sizes (${theme})`, async () => {
    const measurements = [];
    for (const [width, mobile] of [[1180, false], [700, false], [400, false], [400, true]] as const) {
      for (const view of ['week', 'day', 'month']) {
        await mode(view, width, theme, mobile);
        await expect(instance.page.locator(`${root} .tnc-item`).first()).toBeAttached();
        if (view !== 'month') {
          const event = instance.page.locator(`${root} .tnc-item--timed[data-task-path="${folder}/Standup.md"]`).first();
          await event.scrollIntoViewIfNeeded();
          const measure = await event.evaluate(element => {
            const title = element.querySelector('.tn-calendar-event-title')!;
            const time = element.querySelector('.tnc-item-time')!;
            return { titleWidth: title.getBoundingClientRect().width, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height, timeWidth: time.getBoundingClientRect().width, timeDisplay: getComputedStyle(time).display, timeText: time.textContent, fill: getComputedStyle(element).backgroundColor };
          });
          measurements.push({ theme, paneWidth: width, mobile, view, ...measure });
          if (!baseline && measure.width < 220) {
            expect(measure.timeDisplay).toBe(measure.height <= 32 && measure.width <= 100 ? 'none' : 'block');
            expect(measure.timeText).toMatch(/09:00/);
            expect(measure.titleWidth).toBeGreaterThanOrEqual(measure.width - measure.timeWidth - 41);
          }
        } else if (!baseline && width === 400) {
          for (const date of ['2026-11-07', '2026-11-09']) {
            await expect(instance.page.locator(`${root} .tnc-dg-day[data-date="${date}"] .tnc-item--indicator`).first()).toBeVisible();
          }
        }
        await shot(`${view}-${theme}-${width}${width === 400 && !mobile ? '-desktop' : ''}`);
      }
    }
    writeFileSync(`${output}/${baseline ? 'before' : 'after'}-measurements-${theme}.json`, JSON.stringify(measurements, null, 2));
  });
}

test('collision and month overflow use compact rows and return focus on Escape', async () => {
  for (const theme of ['light', 'dark']) {
    for (const view of ['week', 'month']) {
      await mode(view, 1180, theme);
      const trigger = instance.page.locator(`${root} ${view === 'week' ? '.tnc-more--collision' : '.tnc-more'}`).first();
      await trigger.click();
      const popover = instance.page.locator('.tnc-popover');
      await expect(popover).toBeVisible();
      await instance.page.mouse.move(600, 60);
      await shot(`${view}-popover-${theme}`);
      if (!baseline) {
        const row = popover.locator('.tnc-item').first();
        expect(await row.evaluate(element => element.getBoundingClientRect().height)).toBeLessThanOrEqual(48);
        await expect(row).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      }
      await instance.page.keyboard.press('Escape');
      await expect(popover).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
  }
});

test('linked occurrence hover is suppressed throughout a drag and cleared on cancellation', async () => {
  await mode('week');
  const event = instance.page.locator(`${root} .tnc-item--timed[data-task-path="${folder}/Standup.md"]`).first();
  await event.scrollIntoViewIfNeeded();
  const bounds = (await event.boundingBox())!;
  await instance.page.mouse.move(bounds.x + 20, bounds.y + 8);
  await shot('linked-hover');
  await instance.page.mouse.down();
  await instance.page.mouse.move(bounds.x + 30, bounds.y + 50, { steps: 8 });
  await expect(instance.page.locator(`${root} .tnc-dragging`)).toBeVisible();
  await shot('drag-held');
  if (!baseline) await expect(instance.page.locator(`${root} .fc-task-event--related-hover, ${root} .fc-task-event--hover-source`)).toHaveCount(0);
  await instance.page.keyboard.press('Escape');
  await instance.page.mouse.up();
  await expect(instance.page.locator(`${root} .tnc-dragging`)).toHaveCount(0);
  if (!baseline) await expect(instance.page.locator(`${root} .fc-task-event--related-hover`)).toHaveCount(0);
  await instance.page.mouse.move(100, 140);
  if (!baseline) await expect(instance.page.locator(`${root} .fc-task-event--related-hover, ${root} .fc-task-event--hover-source`)).toHaveCount(0);
  await shot('drag-cancelled');
});

test('selection mode has a pressed appearance and clears through Escape', async () => {
  await mode('week');
  const select = instance.page.locator(`${root} .tnc-btn-selectTasks`);
  const before = await select.evaluate(element => getComputedStyle(element).backgroundColor);
  await select.click();
  await expect(select).toHaveAttribute('aria-pressed', 'true');
  await shot('selection-pressed');
  if (!baseline) expect(await select.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(before);
  await instance.page.keyboard.press('Escape');
});

test('selection actions and a real move Undo toast do not overlap', async () => {
  for (const mobile of [false, true]) {
    await mode('day', mobile ? 400 : 1180, mobile ? 'dark' : 'light', mobile);
    const event = instance.page.locator(`${root} .tnc-item[data-task-path="${folder}/Long.md"]`).first();
    await event.evaluate(element => element.scrollIntoView({ block: 'nearest' }));
    await expect(event).toBeInViewport();
    const bounds = (await event.boundingBox())!;
    await instance.page.mouse.move(bounds.x + 24, bounds.y + 12);
    await instance.page.mouse.down();
    await instance.page.mouse.move(bounds.x + 24, bounds.y + 36, { steps: 8 });
    await instance.page.mouse.up();
    const toast = instance.page.locator('.tn-toast');
    await expect(toast).toBeVisible();
    if (mobile) {
      await instance.page.locator(`${root} .tnc-btn-overflow`).click();
      await instance.page.locator('.tn-picker__row[data-picker-id="select"]').click();
    } else await instance.page.locator(`${root} .tnc-btn-selectTasks`).click();
    const selectable = instance.page.locator(`${root} .tnc-item[data-task-path="${folder}/Due.md"]`).first();
    await expect(selectable).toHaveAttribute('data-batch-selectable', 'true');
    await selectable.click();
    const indicator = instance.page.locator('.workspace-leaf.mod-active .tn-calendar-selection-indicator-visible');
    await expect(indicator).toBeVisible();
    await shot(`selection-and-undo${mobile ? '-mobile-dark' : ''}`);
    const toastBounds = (await toast.boundingBox())!;
    const indicatorBounds = (await indicator.boundingBox())!;
    if (!baseline) expect(toastBounds.y >= indicatorBounds.y + indicatorBounds.height + 4 || indicatorBounds.y >= toastBounds.y + toastBounds.height + 4).toBe(true);
    await instance.page.locator('.tn-toast__action').first().click();
    await expect.poll(() => instance.page.evaluate(async folder => {
      const app = (window as any).app;
      return app.vault.read(app.vault.getAbstractFileByPath(`${folder}/Long.md`));
    }, folder)).toContain('scheduled: 2026-11-07T10:00');
    await instance.page.keyboard.press('Escape');
  }
});

test('custom status fills keep titles and glyphs readable in both themes', async () => {
  const ratios = [];
  for (const theme of ['light', 'dark']) {
    for (const color of ['#ffffff', '#000000', '#ffff00', '#0000ff', '#ff0000']) {
      await instance.page.evaluate(color => {
        const manager = (window as any).app.plugins.plugins.tasknotes.statusManager;
        manager.updateStatuses(manager.getAllStatuses().map((status: any) => status.value === 'open' ? { ...status, color, icon: 'star' } : status));
      }, color);
      await mode('day', 1180, theme);
      const event = instance.page.locator(`${root} .tnc-item--timed[data-task-path="${folder}/Standup.md"]`).first();
      await event.scrollIntoViewIfNeeded();
      const contrast = await event.evaluate(element => {
        const context = document.createElement('canvas').getContext('2d')!;
        const luminance = (color: string) => {
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          const pixels = context.getImageData(0, 0, 1, 1).data;
          return Array.from(pixels).slice(0, 3).map(channel => channel / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4).reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
        };
        const background = luminance(getComputedStyle(element).backgroundColor);
        return ['.tn-calendar-event-title', '.tn-task-glyphs__status', '.tn-task-glyphs__priority'].map(selector => {
          const foreground = luminance(getComputedStyle(element.querySelector(selector)!).color);
          return (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05);
        });
      });
      ratios.push({ theme, color, contrast });
      if (!baseline) for (const ratio of contrast) expect(ratio).toBeGreaterThanOrEqual(4.5);
      if (color === '#0000ff') await shot(`custom-status-${theme}`);
    }
  }
  writeFileSync(`${output}/custom-colour-contrast.json`, JSON.stringify(ratios, null, 2));
});
