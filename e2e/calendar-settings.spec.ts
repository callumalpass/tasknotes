import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, type ObsidianApp } from './obsidian';

let app: ObsidianApp;
const BASE = 'TaskNotes/Views/e2e-calendar-settings.base';
const PREFIX = 'TaskNotes/E2E settings';

test.beforeAll(async () => { app = await launchObsidian(); });
test.afterAll(async () => { if (app) await closeObsidian(app); });

test('legacy calendar keys keep their rendering when opening the grouped settings', async () => {
  const page = app.page;
  const source = await page.evaluate(async ({ base, prefix }) => {
    const w = window as any;
    const day = w.moment().format('YYYY-MM-DD');
    for (let i = 0; i < 6; i++) {
      await w.app.vault.create(`${prefix} ${i}.md`, `---\ntitle: Settings event ${i}\nstatus: open\npriority: normal\nscheduled: ${day}${i < 3 ? '' : 'T10:00'}\ntimeEstimate: 60\ntags: [task]\n---\n`);
    }
    const source = `filters:\n  and:\n    - file.name.startsWith("E2E settings")\nviews:\n  - type: tasknotesCalendar\n    name: Legacy settings\n    calendarView: timeGridCustom\n    customDayCount: 3\n    initialDate: ${day}\n    heightMode: fill\n    timeFormat: "12"\n    weekNumbers: true\n    showWeekends: true\n    showAllDaySlot: true\n    showTimeGrid: true\n    slotMinTime: 08:00:00\n    slotMaxTime: 18:00:00\n    slotDuration: 00:30:00\n    snapDuration: 00:05:00\n    scrollTime: 08:00:00\n    nowIndicator: false\n    selectMirror: false\n    slotEventOverlap: false\n    eventMinHeight: 25\n    eventMaxStack: 2\n    dayMaxEvents: 8\n    dayMaxEventRows: 2\n    todayColumnWidthMultiplier: 2\n    showDue: false\n    showRecurring: false\n    showTimeEntries: false\n    showTimeblocks: false\n    showPropertyBasedEvents: false\n`;
    await w.app.vault.create(base, source);
    await w.app.workspace.getLeaf(true).openFile(w.app.vault.getAbstractFileByPath(base));
    return source;
  }, { base: BASE, prefix: PREFIX });

  try {
    const cal = page.locator('.tnc:visible').first();
    await expect(cal).toBeVisible();
    await expect(cal.locator('.tnc-tg-head .tnc-dh')).toHaveCount(3);
    await expect(cal.locator('.tnc-item:visible')).toHaveCount(2);
    await expect(cal.locator('.tnc-more:visible')).toHaveCount(2);
    await expect(cal.locator('.tnc-tg')).toContainText(/\d(am|pm)/);
    const widths = await cal.locator('.tnc-tg-head .tnc-dh').evaluateAll(els => els.map(el => el.getBoundingClientRect().width));
    expect(widths[0]).toBeGreaterThan(widths[1] * 1.5);
    const rendering = async () => cal.evaluate(el => Array.from(el.querySelectorAll('.tnc-item, .tnc-more')).filter(node => (node as HTMLElement).offsetHeight > 0).map(node => {
      const box = node.getBoundingClientRect();
      const root = el.getBoundingClientRect();
      return { text: node.textContent, x: Math.round(box.x - root.x), y: Math.round(box.y - root.y), width: Math.round(box.width), height: Math.round(box.height) };
    }));
    const before = await rendering();
    await page.locator('.bases-toolbar-item.bases-toolbar-views-menu').click();
    await page.locator('.bases-toolbar-menu-item.mod-active .bases-toolbar-menu-item-icon').click();
    const panel = page.locator('.menu.bases-toolbar-menu');
    await expect(panel.locator('.input-group-header-text:visible')).toHaveText([
      'What to show', 'Layout', 'Time grid', 'Day cells', 'Advanced',
    ]);
    await page.screenshot({ path: 'test-results/calendar-settings-groups.png' });
    await panel.getByText('Advanced', { exact: true }).click();
    const advanced = panel.locator('.input-group-container').filter({ has: page.getByText('Advanced', { exact: true }) });
    const row = (name: string) => advanced.locator('.input-row').filter({ has: page.getByText(name, { exact: true }) });
    await expect(row('Drag and resize step').locator('input')).toHaveValue('00:05:00');
    await expect(row('Preview selected time range').locator('input')).not.toBeChecked();
    await expect(row('Simultaneous events (0 = no limit)').locator('input')).toHaveValue('2');
    await expect(row('Row limit override (0 = off; includes “+ more”)').locator('input')).toHaveValue('2');
    await row('Row limit override (0 = off; includes “+ more”)').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/calendar-settings-advanced.png' });
    await panel.locator('.close-icon').click();
    await expect(panel).toBeHidden();
    expect(await rendering()).toEqual(before);
    expect(await page.evaluate(async p => {
      const w = window as any;
      return w.app.vault.read(w.app.vault.getAbstractFileByPath(p));
    }, BASE)).toBe(source);
    // Reopen from disk as well: no migration or default rewrite may be needed.
    await page.evaluate(async p => {
      const w = window as any;
      const previous = w.app.workspace.getLeaf();
      await w.app.workspace.getLeaf(true).openFile(w.app.vault.getAbstractFileByPath(p));
      previous.detach();
    }, BASE);
    await expect(cal.locator('.tnc-item:visible')).toHaveCount(2);
    expect(await rendering()).toEqual(before);
  } finally {
    await page.evaluate(async ({ base, prefix }) => {
      const w = window as any;
      await w.app.workspace.getLeaf()?.detach();
      for (const path of [base, ...Array.from({ length: 6 }, (_, i) => `${prefix} ${i}.md`)]) {
        const file = w.app.vault.getAbstractFileByPath(path);
        if (file) await w.app.vault.delete(file);
      }
    }, { base: BASE, prefix: PREFIX });
  }
});
