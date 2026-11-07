import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

const baseline = process.env.TASKNOTES_R9_BASELINE === '1';
const output = `${process.env.TASKNOTES_E2E_EVIDENCE_DIR ?? 'test-results/calendar-round9'}/${baseline ? 'before' : 'after'}`;
const folder = `CalendarRound9-${Date.now()}`;
let instance: ObsidianApp;
let today: string;
const observations: Record<string, unknown> = {};
test.use({ trace: 'on' });

test.beforeAll(async () => {
  mkdirSync(output, { recursive: true });
  instance = await launchObsidian();
  today = await instance.page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    (window as any).r9Settings = structuredClone(plugin.settings);
    plugin.i18n.setLocale('en');
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    const date = (window as any).moment().format('YYYY-MM-DD');
    await app.vault.createFolder(folder);
    for (let offset = 0; offset < 21; offset++) {
      for (let index = 0; index < (offset === 0 ? 9 : offset === 1 ? 1 : 3); index++) {
        const day = (window as any).moment(date).add(offset, 'days').format('YYYY-MM-DD');
        const name = `Plan ${offset}-${index}`;
        await app.vault.create(`${folder}/${name}.md`, `---\ntitle: ${name} Review the design with Rowan\ntags: [task, design]\nstatus: ${index === 3 || offset === 1 ? 'done' : 'open'}\npriority: ${['high', 'normal', 'low'][index % 3]}\nscheduled: ${day}${index < 4 ? 'T09:00' : ''}\ntimeEstimate: 60\n---\n`);
      }
    }
    await app.vault.create(`${folder}/Solo.md`, `---\ntitle: Independent appointment\ntags: [task]\nstatus: open\npriority: high\nscheduled: ${date}T13:00\ntimeEstimate: 30\n---\nDetails align with the section heading.\n`);
    for (const [name, time] of [['Overlap A', '14:00'], ['Overlap B', '14:15']]) {
      await app.vault.create(`${folder}/${name}.md`, `---\ntitle: ${name} Review the delivery plan\ntags: [task]\nstatus: open\npriority: normal\nscheduled: ${date}T${time}\ntimeEstimate: 60\n---\n`);
    }
    await app.vault.create(`${folder}/Calendar.base`, JSON.stringify({ filters: { and: [`file.inFolder("${folder}")`] }, views: [{ type: 'tasknotesCalendar', name: 'Calendar', calendarView: 'dayGridMonth', showMonthDayPanel: false, showOverdueOnToday: false, showAgendaStrip: true, scrollTime: '08:00:00', slotMinTime: '08:00:00', slotMaxTime: '19:00:00', order: ['status', 'priority', 'file.tags'] }] }));
    await app.vault.create(`${folder}/Mini.base`, JSON.stringify({ filters: { and: [`file.inFolder("${folder}")`] }, views: [{ type: 'tasknotesMiniCalendar', name: 'Mini', dateProperty: 'note.scheduled' }] }));
    const leaf = app.workspace.getLeaf(true);
    (window as any).r9Leaf = leaf;
    await leaf.openFile(app.vault.getAbstractFileByPath(`${folder}/Calendar.base`));
    app.workspace.setActiveLeaf(leaf, { focus: true });
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    return date;
  }, folder);
  await expect(instance.page.locator('.workspace-leaf.mod-active .tnc').first()).toBeVisible();
  const warning = instance.page.getByText("Don't show again", { exact: true });
  if (await warning.isVisible()) await warning.click();
});

test.afterAll(async () => {
  writeFileSync(`${output}/observations.json`, JSON.stringify(observations, null, 2));
  if (!instance) return;
  try {
    await instance.page.evaluate(async folder => {
      const app = (window as any).app;
      app.plugins.plugins.tasknotes.settings = (window as any).r9Settings;
      app.plugins.plugins.tasknotes.priorityManager.updatePriorities((window as any).r9Settings.customPriorities);
      (window as any).r9Leaf.detach();
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally { await closeObsidian(instance); }
});

async function appearance(theme: string, width = 1180, mobile = false) {
  await instance.page.evaluate(({ theme, mobile }) => {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme}`);
    document.body.classList.toggle('is-mobile', mobile);
    (window as any).app.workspace.trigger('css-change');
  }, { theme, mobile });
  await setObsidianViewport(instance.page, { width, height: 800 });
}

async function mode(view: string) {
  await instance.page.evaluate(({ view, today }) => (window as any).r9Leaf.view.controller.view.calendar.changeView(view, today), { view, today });
  await expect(instance.page.locator(`.workspace-leaf.mod-active #bases-calendar > .tnc--${view}`)).toBeVisible();
  await expect.poll(() => instance.page.evaluate(() => {
    const view = (window as any).r9Leaf.view.controller.view;
    return Boolean(view._saveViewTypeTimer || view._isRendering || view._pendingRender || view._configChangedNeedsRecreate);
  })).toBe(false);
  await pageAnimations();
  await instance.page.mouse.move(45, 120);
}

async function pageAnimations() {
  await instance.page.locator('.workspace-leaf.mod-active').evaluate(async element => {
    await Promise.all(element.getAnimations({ subtree: true }).filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
  });
}

test('calendar paint, toolbar focus, selection, and dense layouts', async () => {
  test.setTimeout(180000);
  const page = instance.page;
  for (const theme of ['light', 'dark']) {
    await appearance(theme);
    for (const view of ['month', 'week', 'list', 'day', 'year']) {
      await mode(view);
      await page.screenshot({ path: `${output}/${theme}-${view}.png` });
      observations[`${theme}-${view}`] = await page.locator('.workspace-leaf.mod-active .tnc-item:not(.tnc-item--list)').evaluateAll(elements => elements.slice(0, 15).map(element => {
        const style = getComputedStyle(element);
        const time = element.querySelector('.tnc-item-time');
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d')!;
        const luminance = (color: string) => {
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          const channels = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
          return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
        };
        const foreground = luminance(style.color);
        const background = luminance(style.backgroundColor);
        return { title: element.textContent, color: style.color, fill: style.backgroundColor, contrast: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05), opacity: style.opacity, completed: element.classList.contains('is-completed'), weight: style.fontWeight, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height, time: time?.textContent, timeDisplay: time ? getComputedStyle(time).display : null };
      }));
      if (!baseline && view !== 'year') {
        const paints = observations[`${theme}-${view}`] as Array<{ contrast: number; opacity: string }>;
        for (const paint of paints) {
          expect(paint.contrast).toBeGreaterThanOrEqual(4.5);
          expect(paint.opacity).toBe('1');
        }
      }
      if (view === 'year') {
        const geometry = await page.locator(`.tnc-ym-day[data-date="${today}"]`).evaluate(element => ({ month: element.closest('.tnc-ym')!.getBoundingClientRect().toJSON(), viewport: element.closest('.tnc-year-scroll')!.getBoundingClientRect().toJSON() }));
        observations[`${theme}-year-anchor`] = geometry;
        if (!baseline) expect(geometry.month.top).toBeGreaterThanOrEqual(geometry.viewport.top - 1);
      }
      if (view === 'list') {
        const tools = await page.locator('#bases-calendar > .tnc > .tnc-toolbar').boundingBox();
        const header = await page.locator('.tnc-strip-head').boundingBox();
        observations[`${theme}-agenda-header`] = { tools, header, metadata: await page.locator('.tn-calendar-list-entry .task-card__metadata').first().innerHTML() };
        if (!baseline) {
          expect(tools!.y + tools!.height).toBeLessThanOrEqual(header!.y + header!.height + 1);
          await expect(page.locator('.tnc-list-add')).toHaveCount(0);
          const menu = page.locator('.tn-calendar-list-entry .task-card__context-menu').first();
          await expect(menu).toHaveCSS('opacity', '0');
          await page.locator('.tn-calendar-list-entry').first().hover();
          await expect(menu).toHaveCSS('opacity', '1');
          await page.mouse.move(45, 120);
        }
      }
    }
    if (!baseline) {
      await page.evaluate(async () => {
        const plugin = (window as any).app.plugins.plugins.tasknotes;
        const custom = plugin.settings.customPriorities.map((priority: any, index: number) => ({ ...priority, color: ['#ff00ff', '#00ffff', '#aaff00'][index % 3] }));
        plugin.priorityManager.updatePriorities(custom);
        await (window as any).r9Leaf.view.controller.view.refetchEvents();
      });
      for (const view of ['month', 'week', 'list', 'day']) {
        await mode(view);
        await page.screenshot({ path: `${output}/${theme}-${view}-custom.png` });
      }
      await page.evaluate(async () => {
        (window as any).app.plugins.plugins.tasknotes.priorityManager.updatePriorities((window as any).r9Settings.customPriorities);
        await (window as any).r9Leaf.view.controller.view.refetchEvents();
      });
    }
  }
  await appearance('light');
  await mode('month');
  await page.locator('.tnc-btn-view-week').click();
  await expect(page.locator('#bases-calendar > .tnc--week')).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean((window as any).r9Leaf.view.controller.view._saveViewTypeTimer))).toBe(false);
  observations.toolbarFocus = await page.evaluate(() => document.activeElement?.className);
  await page.keyboard.press('m');
  observations.toolbarKeyboard = await page.locator('#bases-calendar > .tnc').getAttribute('class');
  if (!baseline) await expect(page.locator('#bases-calendar > .tnc--month')).toBeVisible();
  await mode('month');
  await page.locator('.tnc-btn-selectTasks').click();
  await page.locator('[data-task-path$="/Plan 1-0.md"]').first().click();
  await page.screenshot({ path: `${output}/selection.png` });
  observations.selection = await page.locator('.tn-calendar-item-selected').first().evaluate(element => ({ outline: getComputedStyle(element).outline, shadow: getComputedStyle(element).boxShadow, marker: getComputedStyle(element, '::after').content }));
  if (!baseline) expect((observations.selection as { marker: string }).marker).toBe('"✓"');
  await page.keyboard.press('Escape');
});

test('month drag retains source layout and mini day selection opens only rows', async () => {
  const page = instance.page;
  await appearance('light');
  await mode('month');
  const item = page.locator('[data-task-path$="/Plan 1-0.md"]').first();
  const source = await item.boundingBox();
  const target = await page.locator('.tnc-dg-day').filter({ has: page.locator('.tnc-dg-num') }).nth(18).boundingBox();
  if (!source || !target) throw new Error('Missing month drag geometry');
  const before = await page.locator('.tnc-dg-day').evaluateAll(elements => elements.map(element => ({ date: (element as HTMLElement).dataset.date, text: element.textContent })));
  const peers = await page.locator('.tnc-dg .tnc-item:not(.is-mirror)').evaluateAll(elements => elements.map(element => ({ id: (element as HTMLElement).dataset.id, box: element.getBoundingClientRect().toJSON() })));
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + 50, { steps: 16 });
  await expect(page.locator('.tnc-item.is-dragging').first()).toBeVisible();
  await page.screenshot({ path: `${output}/month-drag.png` });
  observations.monthDrag = { before, during: await page.locator('.tnc-dg-day').evaluateAll(elements => elements.map(element => ({ date: (element as HTMLElement).dataset.date, text: element.textContent }))), source: await item.boundingBox() };
  if (!baseline) {
    expect(await item.boundingBox()).toEqual(source);
    expect(await item.evaluate(element => Number(getComputedStyle(element).opacity))).toBeLessThan(0.5);
    await expect(page.locator('.tnc-month-preview')).toHaveCount(1);
    expect(await page.locator('.tnc-dg .tnc-item:not(.is-mirror)').evaluateAll(elements => elements.map(element => ({ id: (element as HTMLElement).dataset.id, box: element.getBoundingClientRect().toJSON() })))).toEqual(peers);
  }
  await page.keyboard.press('Escape');
  await page.mouse.up();
  if (!baseline) {
    await expect(page.locator('.tnc-month-preview')).toHaveCount(0);
    expect(await item.boundingBox()).toEqual(source);
    const readTask = () => page.evaluate(async path => { const app = (window as any).app; const text = await app.vault.read(app.vault.getAbstractFileByPath(path)); return text.match(/^scheduled: (.+)$/m)?.[1]; }, `${folder}/Plan 1-0.md`);
    const original = await readTask();
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + 50, { steps: 16 });
    await page.mouse.up();
    await expect.poll(readTask).not.toBe(original);
    await expect(page.locator('.tn-toast')).toHaveCount(1);
    await expect(page.locator('body')).toHaveClass(/tn-calendar-gesture/);
    await page.locator('.tn-toast__action').filter({ hasText: 'Undo' }).click();
    await expect.poll(readTask).toBe(original);
  }
  await page.evaluate(async folder => {
    const app = (window as any).app;
    await (window as any).r9Leaf.openFile(app.vault.getAbstractFileByPath(`${folder}/Mini.base`));
  }, folder);
  const day = page.locator('.mini-calendar-view__day[aria-current="date"]');
  await day.click();
  observations.miniModal = await page.locator('.modal-container').count();
  await page.screenshot({ path: `${output}/mini.png` });
  if (baseline && await page.locator('.modal-container').count()) await page.keyboard.press('Escape');
  if (!baseline) {
    await expect(page.locator('.modal-container')).toHaveCount(0);
    await expect(page.locator('.mini-calendar-view__entry')).toHaveCount(12);
    await expect(page.locator('.mini-calendar-view__entry-time')).toHaveCount(7);
    expect(await page.locator('.mini-calendar-view__entry-time').allTextContents()).toEqual(['09:00', '09:00', '09:00', '09:00', '13:00', '14:00', '14:15']);
    const firstPath = await page.locator('.mini-calendar-view__entry').first().getAttribute('data-entry-path');
    await page.locator('.mini-calendar-view__entry').first().click();
    await expect.poll(() => page.evaluate(() => (window as any).app.workspace.getActiveFile()?.path)).toBe(firstPath);
    await page.evaluate(async folder => {
      const app = (window as any).app;
      await (window as any).r9Leaf.openFile(app.vault.getAbstractFileByPath(`${folder}/Mini.base`));
    }, folder);
    await page.locator('.mini-calendar-view__day[aria-current="date"]').click();
    await page.locator('.mini-calendar-view__grid').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page.locator('.mini-calendar-view__entry')).toHaveCount(1);
    await expect(page.locator('.modal-container')).toHaveCount(0);
    const selected = page.locator('.mini-calendar-view__day[aria-selected="true"]');
    await selected.click();
    await expect(page.locator('.mini-calendar-view__entry')).toHaveCount(1);
    await expect(page.locator('.modal-container')).toHaveCount(0);
    await page.locator('.mini-calendar-view__entry').focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => (window as any).app.workspace.getActiveFile()?.path)).toBe(`${folder}/Plan 1-0.md`);
  }
});

test('calendar finish measurements: overlaps, short times, modal and compact month', async () => {
  const page = instance.page;
  await page.evaluate(async folder => {
    const app = (window as any).app;
    await (window as any).r9Leaf.openFile(app.vault.getAbstractFileByPath(`${folder}/Calendar.base`));
  }, folder);
  await appearance('light');
  await page.locator('.tnc-btn-view-day').click();
  await pageAnimations();
  const overlaps = await page.locator('.tnc-item--timed[data-task-path*="/Overlap "]').evaluateAll(elements => elements.map(element => ({ title: element.textContent, left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right, width: element.getBoundingClientRect().width })));
  const solo = page.locator('.tnc-item--timed[data-task-path$="/Solo.md"]').first();
  await solo.scrollIntoViewIfNeeded();
  observations.finish = { overlaps, time: await solo.locator('.tnc-item-time').evaluate(element => ({ text: element.textContent, display: getComputedStyle(element).display, height: element.parentElement!.getBoundingClientRect().height })) };
  await page.screenshot({ path: `${output}/day-overlaps.png` });
  if (!baseline) {
    expect(overlaps).toHaveLength(2);
    expect(overlaps[0].right).toBeLessThanOrEqual(overlaps[1].left + 1);
    await expect(solo.locator('.tnc-item-time')).toBeVisible();
  }
  await solo.click();
  await expect(page.locator('.modal-container')).toBeVisible();
  await page.screenshot({ path: `${output}/event-modal.png` });
  observations.modal = await page.locator('.modal-container').evaluate(element => ({ details: element.querySelector('.cm-content')?.getBoundingClientRect().toJSON(), detailsPadding: getComputedStyle(element.querySelector('.cm-content')!).paddingLeft, titlePadding: getComputedStyle(element.querySelector('.title-input, .title-input-detailed')!).paddingLeft, text: element.textContent }));
  if (!baseline) {
    expect((observations.modal as { detailsPadding: string }).detailsPadding).toBe('0px');
    expect(Number.parseFloat((observations.modal as { titlePadding: string }).titlePadding)).toBeGreaterThanOrEqual(8);
  }
  await page.keyboard.press('Escape');
  await appearance('light', 400, true);
  await mode('month');
  await page.screenshot({ path: `${output}/phone-month.png` });
  observations.phoneMonth = await page.locator('.tnc-dg').getAttribute('class');
  if (!baseline) {
    await expect(page.locator('.tnc-dg--compact')).toBeVisible();
    await page.locator(`.tnc-dg-day[data-date="${today}"]`).click({ position: { x: 12, y: 45 } });
    await expect(page.locator('.tnc-popover')).toBeVisible();
    await expect(page.locator('.tnc-popover')).toContainText('Review the design with Rowan');
    await page.keyboard.press('Escape');
  }
});

test('phone drag geometry, strip gesture ownership, and colour alternatives', async () => {
  test.setTimeout(180000);
  const page = instance.page;
  await page.evaluate(async folder => {
    const app = (window as any).app;
    await (window as any).r9Leaf.openFile(app.vault.getAbstractFileByPath(`${folder}/Calendar.base`));
  }, folder);
  await appearance('light', 400, true);
  await mode('days');
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const item = page.locator('[data-task-path$="/Solo.md"]').first();
  await item.scrollIntoViewIfNeeded();
  const source = await item.boundingBox();
  const collision = await page.locator('.tnc-more--collision').first().boundingBox();
  if (!source || !collision) throw new Error('Missing touch drag geometry');
  if (!baseline) {
    const appointment = page.locator('.tnc-item--timed[data-task-path$="/Plan 1-0.md"]').first();
    const time = appointment.locator('.tnc-item-time');
    const oldRule = await page.addStyleTag({ content: '@container (max-height: 50px) and (max-width: 239px) { .tasknotes-plugin .tnc-item--timed .tnc-item-time { display: none; } }' });
    await expect(time).toBeHidden();
    await oldRule.evaluate(element => element.remove());
    await expect(time).toBeVisible();
    observations.phoneAppointmentTime = await appointment.evaluate(element => ({ height: element.getBoundingClientRect().height, width: element.getBoundingClientRect().width, time: element.querySelector('.tnc-item-time')?.textContent }));
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: source.x + source.width / 2, y: source.y + 10 }] });
  await expect(page.locator('.tnc-dragging')).toBeVisible();
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: collision.x + collision.width / 2, y: collision.y + 15 }] });
  const dragged = page.locator('.tnc-item.is-dragging').first();
  observations.phoneMirror = { source, collision, during: await dragged.boundingBox() };
  await page.screenshot({ path: `${output}/phone-drag.png` });
  if (!baseline) expect((await dragged.boundingBox())!.width).toBeGreaterThanOrEqual(source.width - 1);
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await mode('list');
  await page.evaluate(() => {
    (window as any).r9TouchBubbles = [];
    document.addEventListener('touchstart', () => (window as any).r9TouchBubbles.push('start'), { once: true });
    document.addEventListener('touchmove', () => (window as any).r9TouchBubbles.push('move'), { once: true });
  });
  const strip = await page.locator('.tnc-strip-grid').boundingBox();
  if (!strip) throw new Error('Missing strip');
  const before = await page.locator('.tnc-strip-day').first().getAttribute('data-date');
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: strip.x + strip.width - 20, y: strip.y + strip.height / 2 }] });
  for (let step = 1; step <= 8; step++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: strip.x + strip.width - 20 - step * 30, y: strip.y + strip.height / 2 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  observations.stripSwipe = { before, after: await page.locator('.tnc-strip-day').first().getAttribute('data-date'), bubbled: await page.evaluate(() => (window as any).r9TouchBubbles) };
  await page.screenshot({ path: `${output}/phone-strip.png` });
  if (!baseline) {
    expect(await page.evaluate(() => (window as any).r9TouchBubbles)).toEqual([]);
    await expect(page.locator('.tnc-strip-day').first()).not.toHaveAttribute('data-date', before!);
  }
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await session.detach();
  await page.evaluate(() => {
    (window as any).app.workspace.leftSplit.collapse();
    (window as any).app.workspace.rightSplit.collapse();
  });
  if (process.env.TASKNOTES_R9_TRIALS !== '1') return;
  for (const theme of ['light', 'dark']) {
    await appearance(theme);
    for (const direction of ['tuned', 'quiet']) {
      const style = await page.addStyleTag({ content: `.tasknotes-plugin .tnc-item:not(.tnc-item--list) { background: ${direction === 'tuned' ? `oklch(from var(--tnc-c, red) ${theme === 'dark' ? '.40' : '.89'} min(c, .10) h)` : `color-mix(in oklch, var(--tnc-c, red) ${theme === 'dark' ? '16%' : '10%'}, var(--background-primary))`} !important; color: var(--text-normal) !important; border-inline-start: 3px solid oklch(from var(--tnc-c, red) ${theme === 'dark' ? '.72' : '.50'} min(c, .14) h); } .tasknotes-plugin .tnc-item .tnc-item-title { font-weight: 500; }` });
      for (const view of ['month', 'week', 'list', 'day']) {
        await mode(view);
        await page.screenshot({ path: `${output}/trial-${theme}-${direction}-${view}.png` });
        await page.locator('.tnc-item').evaluateAll(elements => elements.forEach((element, index) => (element as HTMLElement).style.setProperty('--tnc-c', ['#ff00ff', '#00ffff', '#aaff00'][index % 3])));
        await page.screenshot({ path: `${output}/trial-${theme}-${direction}-${view}-custom.png` });
      }
      await style.evaluate(element => element.remove());
    }
  }
});
