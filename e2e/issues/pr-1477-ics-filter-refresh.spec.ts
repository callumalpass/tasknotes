import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

let app: ObsidianApp;
test.beforeAll(async () => { app = await launchObsidian(); });
test.afterAll(async () => { if (app) await closeObsidian(app); });

for (const type of ['tasknotesCalendar', 'tasknotesMiniCalendar']) {
  test(`${type} applies and clears an ICS title filter without reopening`, async () => {
    const page = app.page;
    const subscriptionId = await page.evaluate(async type => {
      const host = (window as any).app;
      const service = host.plugins.plugins.tasknotes.icsSubscriptionService;
      const date = new Date();
      const day = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
      const feedPath = `filter-${type}.ics`;
      const events = ['Meeting', 'Lunch'].map(title => [
        'BEGIN:VEVENT', `UID:filter-${title}`, `DTSTART;VALUE=DATE:${day}`,
        `SUMMARY:Filter ${title}`, 'END:VEVENT',
      ].join('\r\n'));
      await host.vault.create(feedPath, ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events, 'END:VCALENDAR'].join('\r\n'));
      const subscription = await service.addSubscription({
        type: 'local', filePath: feedPath, name: 'Filter test', enabled: true,
        color: '#3788d8', refreshInterval: 60,
      });
      const basePath = `filter-${type}.base`;
      await host.vault.create(basePath, `filters:\n  and:\n    - file.name == "no-matching-notes"\nviews:\n  - type: ${type}\n    name: Filter\n    calendarView: dayGridMonth\n    dateProperty: note.due\n`);
      await host.workspace.getLeaf(true).openFile(host.vault.getAbstractFileByPath(basePath));
      return subscription.id;
    }, type);
    const events = type === 'tasknotesCalendar'
      ? page.locator('.tnc:visible .tnc-item').filter({ hasText: 'Filter ' })
      : page.locator('.mini-calendar-view__external-event-dot:visible');
    await expect(events).toHaveCount(2, { timeout: 15000 });
    await page.evaluate(async id => {
      await (window as any).app.plugins.plugins.tasknotes.icsSubscriptionService.updateSubscription(id, { filter: 'meeting' });
    }, subscriptionId);
    await expect(events).toHaveCount(1);
    await page.screenshot({ path: `/tmp/tasknotes-1477-logs/${type}-filtered.png` });
    await page.evaluate(async id => {
      await (window as any).app.plugins.plugins.tasknotes.icsSubscriptionService.updateSubscription(id, { filter: '' });
    }, subscriptionId);
    await expect(events).toHaveCount(2);
    await page.evaluate(async id => {
      const host = (window as any).app;
      await host.plugins.plugins.tasknotes.icsSubscriptionService.removeSubscription(id);
      host.workspace.getMostRecentLeaf()?.detach();
    }, subscriptionId);
  });
}
