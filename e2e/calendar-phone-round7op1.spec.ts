import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

const baseline = process.env.TASKNOTES_PHONE_BASELINE === '1';
const mobileSession = process.env.TASKNOTES_PHONE_MOBILE === '1';
const evidence = `${process.env.TASKNOTES_E2E_EVIDENCE_DIR ?? '/tmp/tasknotes-r7'}/phone/${baseline ? 'before' : 'after'}/${mobileSession ? 'mobile' : 'pane'}`;
const folder = `PhoneOP1-${Date.now()}`;
let instance: ObsidianApp;
let today: string;
test.use({ trace: 'on' });

test.beforeAll(async () => {
  mkdirSync(evidence, { recursive: true });
  instance = await launchObsidian();
  if (mobileSession) {
    await Promise.all([
      instance.page.waitForEvent('load'),
      instance.page.evaluate(() => (window as any).app.emulateMobile(true)),
    ]);
    await expect.poll(() => instance.page.evaluate(() => Boolean((window as any).app?.plugins?.plugins?.tasknotes?.taskSelectionService))).toBe(true);
  }
  today = await instance.page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    (window as any).phoneSettings = structuredClone(plugin.settings);
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    const day = (window as any).moment().format('YYYY-MM-DD');
    const yesterday = (window as any).moment().subtract(1, 'day').format('YYYY-MM-DD');
    await app.vault.createFolder(folder);
    for (const [name, title, dates, extra] of [
      ['Scheduled', 'Review release notes', `scheduled: ${day}T09:00\ndue: ${day}T17:00\ntimeEstimate: 60`, ''],
      ['Deadline', 'Send project update', `due: ${day}T11:00`, ''],
      ['Tracked', 'Research customer feedback', `scheduled: ${day}T08:00`, `timeEntries:\n  - startTime: '${new Date(`${day}T08:00`).toISOString()}'\n    endTime: '${new Date(`${day}T08:50`).toISOString()}'`],
      ['Long', 'Review the longer proposal with the entire accessibility and design team', `scheduled: ${day}T12:00\ndue: ${day}T18:00`, 'contexts: [office, research]\nprojects: [Launch]'],
      ['Plain', 'No extra properties', `scheduled: ${day}`, ''],
      ['Past', 'Yesterday still has a task marker', `scheduled: ${yesterday}T09:00`, ''],
    ]) {
      await app.vault.create(`${folder}/${name}.md`, `---\ntitle: ${title}\ntags: [task]\nstatus: open\npriority: normal\n${dates}\n${extra}\n---\n`);
    }
    const view = { type: 'tasknotesCalendar', name: 'Phone', calendarView: 'listWeek', showAgendaStrip: true, showMonthDayPanel: true, showOverdueOnToday: false, showRecurring: false, showTimeEntries: true, scrollTime: '08:00:00', slotMinTime: '00:00:00', slotMaxTime: '24:00:00', order: ['status', 'priority', 'scheduled', 'due', 'formula.dueIn', 'contexts', 'projects', 'file.tags'] };
    await app.vault.create(`${folder}/Agenda.base`, JSON.stringify({ filters: { and: [`file.inFolder("${folder}")`] }, formulas: { dueIn: 'if(due, "Today", "")' }, properties: { 'formula.dueIn': { displayName: 'Due in' } }, views: [view] }));
    const leaf = app.workspace.getLeaf(true);
    (window as any).phoneLeaf = leaf;
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
      app.plugins.plugins.tasknotes.settings = (window as any).phoneSettings;
      (window as any).phoneLeaf.detach();
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally { await closeObsidian(instance); }
});

async function mode(view: string) {
  await instance.page.evaluate(({ view, today }) => (window as any).phoneLeaf.view.controller.view.calendar.changeView(view, today), { view, today });
  await settleView();
  const effective = view === 'week' && await instance.page.locator('.advanced-calendar-view').first().evaluate(element => element.clientWidth < 640) ? 'days' : view;
  await expect(instance.page.locator(`.workspace-leaf.mod-active #bases-calendar > .tnc--${effective}`)).toBeVisible();
  await instance.page.locator('#bases-calendar').evaluate(async element => {
    await Promise.all(element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running' && animation instanceof CSSAnimation && animation.animationName === 'tn-calendar-view-enter').map(animation => animation.finished.catch(() => undefined)));
  });
}

async function settleView() {
  await expect.poll(() => instance.page.evaluate(() => {
    const view = (window as any).phoneLeaf.view.controller.view;
    return Boolean(view._saveViewTypeTimer || view._isRendering || view._pendingRender || view._configChangedNeedsRecreate);
  })).toBe(false);
}

test('agenda toolbar and compact rows fit desktop, narrow and mobile panes', async () => {
  test.setTimeout(180000);
  const page = instance.page;
  const measurements = [];
  for (const theme of ['light', 'dark']) {
    for (const [width, mobile] of [[1180, false], [700, false], [400, false], [400, true]] as const) {
      await setObsidianViewport(page, { width, height: 800 });
      await page.evaluate(({ theme, mobile }) => {
        document.body.classList.remove('theme-light', 'theme-dark', 'is-mobile');
        document.body.classList.add(`theme-${theme}`);
        document.body.classList.toggle('is-mobile', mobile);
        document.querySelectorAll('.notice, .tooltip').forEach(element => element.remove());
      }, { theme, mobile });
      for (const surface of ['list', 'month']) {
        await mode(surface);
        if (surface === 'month') await page.locator(`.tnc-dg-day[data-date="${today}"] .tnc-dg-num`).click();
        const root = surface === 'list' ? page.locator('#bases-calendar > .tnc') : page.locator('.tn-calendar-day-panel');
        const rows = root.locator('.tn-calendar-list-entry');
        await expect(rows.first()).toBeVisible();
        await page.mouse.move(0, 0);
        const geometry = await rows.evaluateAll(entries => entries.map(entry => {
          const stamp = entry.querySelector('.tn-calendar-list-stamp')!;
          const time = stamp.querySelector('.tn-calendar-list-time');
          const bounds = entry.getBoundingClientRect();
          return { text: entry.textContent, height: bounds.height, stampWidth: stamp.getBoundingClientRect().width, stampHeight: stamp.getBoundingClientRect().height, timeWraps: time ? [...time.children].some(line => line.scrollHeight > parseFloat(getComputedStyle(time).lineHeight) * 1.5) || time.childElementCount > 2 : false, stampCount: entry.querySelectorAll('.tn-calendar-list-stamp').length };
        }));
        measurements.push({ theme, width, mobile, surface, geometry });
        writeFileSync(`${evidence}/rows.json`, JSON.stringify(measurements, null, 2));
        await page.screenshot({ path: `${evidence}/${surface}-${theme}-${width}-${mobile ? 'mobile' : 'pane'}.png` });
        if (baseline) continue;
        expect(geometry.every(row => !row.timeWraps && row.stampCount === 1)).toBe(true);
        expect(geometry.filter(row => !row.text?.includes('longer proposal')).every(row => row.height <= 84)).toBe(true);
        await expect(root.locator('.task-card__metadata-property').filter({ hasText: 'Due in:' })).toHaveCount(0);
        const due = root.locator('[data-event-type="due"][data-task-path$="Deadline.md"]').first();
        await expect(due.locator('.tn-calendar-list-stamp')).toHaveAccessibleName(/^Deadline:/);
        if (surface === 'list') {
          const marker = root.locator('.tnc-strip-day.has-items .tnc-strip-dot').first();
          await expect(marker).toBeVisible();
          const pastDate = await page.evaluate(() => (window as any).moment().subtract(1, 'day').format('YYYY-MM-DD'));
          const pastDay = root.locator(`.tnc-strip-day[data-date="${pastDate}"]`);
          if (await pastDay.count()) await expect(pastDay.locator('.tnc-strip-dot')).toBeVisible();
          if (width === 400) {
            await expect(root.locator('.tnc-toolbar-view-select')).toBeVisible();
            await expect(root.locator('.tnc-toolbar-views')).toBeHidden();
            const title = await root.locator('.tnc-strip-title').boundingBox();
            const toolbar = await root.locator('.tnc-toolbar').boundingBox();
            expect(title!.x + title!.width).toBeLessThanOrEqual(toolbar!.x + 1);
            const select = root.locator('.tnc-toolbar-view-select');
            await select.focus();
            await page.keyboard.press('ArrowUp');
            await expect(page.locator('#bases-calendar > .tnc--day')).toBeVisible();
            await settleView();
            await expect(page.locator('.advanced-calendar-view').first()).toBeFocused();
            await select.focus();
            await page.keyboard.press('ArrowDown');
            await expect(page.locator('#bases-calendar > .tnc--list')).toBeVisible();
            await settleView();
            await expect(page.locator('.advanced-calendar-view').first()).toBeFocused();
          }
        }
      }
    }
  }
});

test('phone week and three-day views fit once and start at the configured time', async () => {
  const page = instance.page;
  const measurements = [];
  await setObsidianViewport(page, { width: 400, height: 800 });
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => {
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(`theme-${theme}`, 'is-mobile');
    }, theme);
    for (const view of ['week', 'days']) {
      await mode(view);
      const geometry = await page.locator('.tnc-tg').evaluate(element => {
        const scroller = element.querySelector('.tnc-tg-scroll')!;
        const body = element.querySelector('.tnc-tg-body')!;
        const heads = [...element.querySelectorAll('.tnc-dh')].map(head => head.getBoundingClientRect().toJSON());
        const calendar = (window as any).phoneLeaf.view.controller.view.calendar;
        const label = element.querySelector('.tnc-slot-label')!;
        const labelInset = Math.ceil(label.getBoundingClientRect().height / 2) + 2;
        return { width: scroller.clientWidth, scrollWidth: scroller.scrollWidth, navVisible: !!element.querySelector<HTMLElement>('.tnc-tg-day-navigation')?.offsetHeight, heads, labelInset, minute: calendar.slot.min + (scroller.scrollTop + labelInset) / (body.getBoundingClientRect().height / (calendar.slot.max - calendar.slot.min)) };
      });
      measurements.push({ theme, view, geometry });
      writeFileSync(`${evidence}/timegrid.json`, JSON.stringify(measurements, null, 2));
      await page.screenshot({ path: `${evidence}/${view}-${theme}-400-mobile.png` });
      if (baseline) continue;
      expect(geometry.heads).toHaveLength(3);
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
      expect(geometry.navVisible).toBe(false);
      expect(Math.abs(geometry.minute - 480)).toBeLessThan(2);
    }
  }
});
