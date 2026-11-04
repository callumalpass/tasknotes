import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

let app: ObsidianApp;
const folder = `e2e-calendar-design-${Date.now()}`;
let dailyNotesFolder: string | undefined;
test.beforeAll(async () => {
  app = await launchObsidian();
  dailyNotesFolder = await app.page.evaluate(async (folder) => {
    const app = (window as any).app;
    const now = new Date();
    const day = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const today = day(now);
    const yesterday = day(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    await app.vault.createFolder(folder);
    const dailyNotes = app.internalPlugins.getEnabledPluginById('daily-notes');
    const previousFolder = dailyNotes.options.folder;
    dailyNotes.options.folder = folder;
    await app.vault.create(`${folder}/${today}.md`, `---
timeblocks:
  - id: calendar-design-focus
    title: Focus on calendar polish
    startTime: '13:00'
    endTime: '14:00'
    description: Keep the vault visible while planning.
    attachments: ['[[Design task]]']
---
`);
    await app.vault.create(`${folder}/Design task.md`, `---
title: Review calendar interaction details
tags: [task, design]
status: open
priority: high
scheduled: ${today}T10:00
due: ${yesterday}
timeEstimate: 60
timeEntries:
  - startTime: '${new Date(`${today}T11:00`).toISOString()}'
    endTime: '${new Date(`${today}T11:30`).toISOString()}'
---
`);
    const base = await app.vault.create(`${folder}/Calendar.base`, `filters:
  and:
    - file.inFolder("${folder}")
views:
  - type: tasknotesCalendar
    name: Calendar design
    calendarView: timeGridWeek
    showOverdueOnToday: true
    showTimeEntries: true
    showTimeblocks: true
    slotMinTime: '08:00:00'
    slotMaxTime: '18:00:00'
    order: [status, priority, due, file.tags]
`);
    const leaf = app.workspace.getLeaf(true);
    await leaf.openFile(base);
    app.workspace.setActiveLeaf(leaf, { focus: true });
    return previousFolder;
  }, folder);
  await expect(app.page.locator('.workspace-leaf.mod-active .tnc')).toBeVisible({ timeout: 20000 });
});

test.afterAll(async () => {
  if (!app) return;
  try {
    await app.page.evaluate(async ({ folder, dailyNotesFolder }) => {
      const app = (window as any).app;
      app.internalPlugins.getEnabledPluginById('daily-notes').options.folder = dailyNotesFolder;
      for (const leaf of app.workspace.getLeavesOfType('bases')) {
        if (leaf.view.file?.path.startsWith(folder)) leaf.detach();
      }
      const file = app.vault.getAbstractFileByPath(folder);
      if (file) await app.vault.delete(file, true);
    }, { folder, dailyNotesFolder });
  } finally {
    await closeObsidian(app);
  }
});

test('public view buttons share kit styles across themes and narrow panes', async () => {
  test.setTimeout(180000);
  const page = app.page;
  for (const theme of ['theme-light', 'theme-dark']) {
    await page.evaluate((theme) => {
      const app = (window as any).app;
      app.customCss?.setTheme('');
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(theme);
    }, theme);
    for (const width of [1180, 430]) {
      await page.evaluate(() => {
        const app = (window as any).app;
        app.workspace.leftSplit.collapse();
        app.workspace.rightSplit.collapse();
      });
      await setObsidianViewport(page, { width, height: 800 });
      const calendar = page.locator('.workspace-leaf.mod-active .tnc');
      for (const mode of ['month', 'week', 'days', 'day', 'year', 'list']) {
        await calendar.locator(`.tnc-btn-view-${mode}`).click();
        await expect(calendar.locator(`.tnc-btn-view-${mode}`)).toHaveAttribute('aria-pressed', 'true');
        await expect(calendar.locator('.tnc-toolbar-views .tnc-btn-view')).toHaveCount(6);
        const toolbarLine = await calendar.locator('.tnc-toolbar-start').evaluate(element => {
          const title = element.querySelector('.tnc-title')!.getBoundingClientRect();
          const navigation = element.querySelector('.tnc-toolbar-nav')!.getBoundingClientRect();
          return Math.abs((title.top + title.bottom) / 2 - (navigation.top + navigation.bottom) / 2);
        });
        expect(toolbarLine).toBeLessThan(3);
        if (mode === 'week') {
          const event = calendar.locator('.tnc-item[data-task-path] .tn-task-glyphs').first();
          await expect(event).toBeVisible();
          const style = await calendar.locator('.tnc-item[data-task-path]').first().evaluate(element => {
            const css = getComputedStyle(element);
            return { left: css.borderLeftWidth, top: css.borderTopWidth };
          });
          expect(style).toEqual({ left: '2px', top: '0px' });
          await expect(calendar.locator('.tnc-item[data-event-type="timeblock"]').first()).toBeVisible();
        }
        if (mode === 'list') {
          await expect(calendar.locator('.task-card__metadata-date--overdue').first()).toBeVisible();
          await expect(calendar.locator('.timeblock-card__time')).toHaveText('13:00 - 14:00');
          await expect(calendar.locator('.timeblock-card__attachments')).toContainText('1 attachment');
        }
        await page.screenshot({ path: `test-results/calendar-design/${theme}-${width}-${mode}.png` });
      }
      const comparison = await calendar.evaluate(calendar => {
        const kit = document.createElement('div');
        kit.className = 'tn-segmented';
        const button = kit.appendChild(document.createElement('button'));
        button.className = 'tn-segmented__item is-selected';
        calendar.appendChild(kit);
        const actual = calendar.querySelector('.tnc-btn-view[aria-pressed="true"]')!;
        const properties = ['height', 'padding', 'border-radius', 'background-color', 'color', 'font-size', 'box-shadow'];
        const read = (element: Element) => Object.fromEntries(properties.map(property => [property, getComputedStyle(element).getPropertyValue(property)]));
        const result = { kit: read(button), calendar: read(actual) };
        kit.remove();
        return result;
      });
      expect(comparison.calendar).toEqual(comparison.kit);
    }
  }
});

test('mini calendar retains today, selection and note chooser', async () => {
  const page = app.page;
  await page.evaluate(async ({ folder }) => {
    const app = (window as any).app;
    const base = await app.vault.create(`${folder}/Mini.base`, `filters:
  and:
    - file.inFolder("${folder}")
views:
  - type: tasknotesMiniCalendar
    name: Mini design
    dateProperty: note.scheduled
    titleProperty: title
`);
    const leaf = app.workspace.getLeaf(true);
    await leaf.openFile(base);
    app.workspace.setActiveLeaf(leaf, { focus: true });
  }, { folder });
  const mini = page.locator('.workspace-leaf.mod-active .mini-calendar-bases-view');
  await expect(mini).toBeVisible();
  for (const theme of ['theme-light', 'theme-dark']) {
    await page.evaluate(theme => {
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(theme);
    }, theme);
    const todayCell = mini.locator('[aria-current="date"]');
    await expect(todayCell).toBeVisible();
    await page.screenshot({ path: `test-results/calendar-design/${theme}-mini.png` });
    await todayCell.click();
    await expect(page.locator('.note-selector-modal__title').filter({ hasText: 'Review calendar' })).toBeVisible();
    await expect(page.locator('.note-selector-modal__title .tn-task-glyphs')).toBeVisible();
    await page.keyboard.press('Escape');
    await mini.locator('.mini-calendar-view__day:not(.mini-calendar-view__day--outside-month):not([aria-current="date"])').first().click();
    await expect(todayCell).toHaveAttribute('aria-selected', 'false');
    const todayStyle = await todayCell.evaluate(element => {
      const css = getComputedStyle(element);
      return { border: css.borderWidth, shadow: css.boxShadow };
    });
    expect(todayStyle).toEqual({ border: '0px', shadow: 'none' });
    await expect(todayCell).toHaveClass(/mini-calendar-view__day--intensity-/);
    await page.screenshot({ path: `test-results/calendar-design/${theme}-mini-independent-selection.png` });
  }
});
