import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp } from '../obsidian';

let obsidian: ObsidianApp;
const folder = `e2e-2409-${Date.now()}`;

// The launcher verifies the vault and owns a separate Obsidian process/profile.
test.beforeAll(async () => {
  obsidian = await launchObsidian();
  await obsidian.page.evaluate(async (path) => {
    await (window as any).app.vault.createFolder(path);
  }, folder);
});

test.afterAll(async () => {
  if (!obsidian) return;
  try {
    await obsidian.page.evaluate(async (path) => {
      const app = (window as any).app;
      const fixture = app.vault.getAbstractFileByPath(path);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally {
    await closeObsidian(obsidian);
  }
});

for (const { firstDay, startDay, endDay } of [
  { firstDay: 0, startDay: 17, endDay: 18 },
  { firstDay: 1, startDay: 18, endDay: 19 },
]) {
  test(`overnight entry continues into a new week and day (firstDay=${firstDay})`, async () => {
    const page = obsidian.page;
    const title = `Overnight session ${firstDay}`;
    const startDate = `2026-10-${startDay}`;
    const endDate = `2026-10-${endDay}`;
    const notePath = `${folder}/${title}.md`;
    const basePath = `${folder}/Calendar ${firstDay}.base`;
    const note = `---
title: ${title}
tags: [task]
status: open
priority: normal
timeEntries:
  - startTime: '${new Date(2026, 9, startDay, 22).toISOString()}'
    endTime: '${new Date(2026, 9, endDay, 1).toISOString()}'
---
`;
    await page.evaluate(async ({ notePath, basePath, note, firstDay, folder }) => {
      const app = (window as any).app;
      await app.vault.create(notePath, note);
      const base = await app.vault.create(basePath, `filters:
  and:
    - file.inFolder("${folder}")
views:
  - type: tasknotesCalendar
    name: Overnight session
    calendarView: timeGridWeek
    firstDay: ${firstDay}
    slotMinTime: '00:00:00'
    slotMaxTime: '24:00:00'
    showTimeEntries: true
    showScheduled: false
    showDue: false
    showTimeblocks: false
`);
      await app.workspace.getLeaf().openFile(base);
    }, { notePath, basePath, note, firstDay, folder });

    await page.locator('.fc').waitFor();
    await page.waitForFunction(() =>
      (window as any).app.workspace.getMostRecentLeaf().view.controller?.view?.calendar
    );
    await page.evaluate((date) => {
      const view = (window as any).app.workspace.getMostRecentLeaf().view.controller.view;
      view.calendar.changeView('timeGridWeek', date);
    }, startDate);

    const segment = (date: string) => page
      .locator(`.fc-timegrid-col[data-date="${date}"] .fc-timegrid-event`)
      .filter({ hasText: title });

    await expect(segment(startDate)).toHaveCount(1);
    await page.locator('.fc-next-button').click();
    await expect(segment(endDate)).toHaveCount(1);
    await page.locator('.fc-prev-button').click();
    await expect(segment(startDate)).toHaveCount(1);
    await page.locator('.fc-next-button').click();
    await expect(segment(endDate)).toHaveCount(1);

    await page.evaluate((date) => {
      const view = (window as any).app.workspace.getMostRecentLeaf().view.controller.view;
      view.calendar.changeView('timeGridDay', date);
    }, endDate);
    await expect(segment(endDate)).toHaveCount(1);

    // Rendering and navigating must not split or otherwise rewrite the session.
    expect(await page.evaluate(async (path) => {
      const app = (window as any).app;
      return app.vault.read(app.vault.getAbstractFileByPath(path));
    }, notePath)).toBe(note);
  });
}
