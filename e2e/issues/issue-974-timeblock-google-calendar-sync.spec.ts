/**
 * Issue #974: sync daily-note timeblocks to Google Calendar.
 *
 * Exercises the real wiring (metadata-cache events, daily-note date lookup,
 * shared TaskCalendarSyncService queues) with the Google API stubbed in-page.
 */
import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

let app: ObsidianApp;
const NOTE = '2031-03-04.md';

test.beforeAll(async () => { app = await launchObsidian(); });
test.afterAll(async () => { if (app) await closeObsidian(app); });

test('creates, updates and deletes a Google event as a timeblock is added, edited and removed', async () => {
  const page = app.page;
  await page.waitForFunction(() => !!(window as any).app.plugins.plugins.tasknotes?.taskCalendarSyncService, null, { timeout: 30000 });

  await page.evaluate(() => {
    const w = window as any;
    const plugin = w.app.plugins.plugins.tasknotes;
    const google = plugin.googleCalendarService;
    const calls: any[] = [];
    w.__tb974 = {
      calls,
      original: {
        getAvailableCalendars: google.getAvailableCalendars,
        createEvent: google.createEvent,
        updateEvent: google.updateEvent,
        deleteEvent: google.deleteEvent,
        getConnectionGeneration: google.getConnectionGeneration,
        isConnectionGenerationCurrent: google.isConnectionGenerationCurrent,
        settings: { ...plugin.settings.googleCalendarExport },
      },
    };
    let next = 1;
    // No real OAuth session in the test vault; report a stable connection.
    google.getConnectionGeneration = () => 1;
    google.isConnectionGenerationCurrent = async () => true;
    google.getAvailableCalendars = () => [{ id: 'team-e2e@group.calendar.google.com', summary: 'E2E' }];
    google.createEvent = async (calendarId: string, event: any) => {
      calls.push({ op: 'create', calendarId, summary: event.summary, start: event.start.dateTime });
      return { id: `google-${calendarId}-evt-${next++}` };
    };
    google.updateEvent = async (calendarId: string, eventId: string, event: any) => {
      calls.push({ op: 'update', calendarId, eventId, summary: event.summary });
      return {};
    };
    google.deleteEvent = async (calendarId: string, eventId: string) => {
      calls.push({ op: 'delete', calendarId, eventId });
    };
    Object.assign(plugin.settings.googleCalendarExport, {
      syncTimeblocks: true,
      targetCalendarId: 'team-e2e@group.calendar.google.com',
      timeblockTargetCalendarId: '',
      timeblockEventTitleTemplate: 'TB: {{title}} ({{startTime}})',
      includeObsidianLink: false,
    });
  });

  const calls = () => page.evaluate(() => (window as any).__tb974.calls);
  const write = (title: string | null) => page.evaluate(async ({ note, title }) => {
    const w = window as any;
    const body = title
      ? `---\ntimeblocks:\n  - id: tb-e2e-974\n    title: ${title}\n    startTime: "09:00"\n    endTime: "10:00"\n---\n`
      : `---\ntimeblocks: []\n---\n`;
    const file = w.app.vault.getAbstractFileByPath(note);
    if (file) await w.app.vault.modify(file, body);
    else await w.app.vault.create(note, body);
  }, { note: NOTE, title });

  try {
    await write('Deep work');
    await expect.poll(calls, { timeout: 10000 }).toEqual([
      { op: 'create', calendarId: 'team-e2e@group.calendar.google.com', summary: 'TB: Deep work (09:00)', start: '2031-03-04T09:00:00' },
    ]);

    await write('Planning');
    await expect.poll(async () => (await calls()).slice(1), { timeout: 10000 }).toEqual([
      { op: 'update', calendarId: 'team-e2e@group.calendar.google.com', eventId: 'evt-1', summary: 'TB: Planning (09:00)' },
    ]);

    // Exercise the installed Obsidian's real malformed-YAML index, not a fake
    // cache shape. An incomplete hand-edit must not delete the linked event.
    await page.evaluate(async (note) => {
      const host = (window as any).app;
      let indexed!: () => void;
      const changed = new Promise<void>((resolve) => { indexed = resolve; });
      const ref = host.metadataCache.on('changed', (file: any, data: string) => {
        if (file.path === note && data.includes('timeblocks: [')) indexed();
      });
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await host.vault.modify(host.vault.getAbstractFileByPath(note), '---\ntimeblocks: [\n---\n');
        await Promise.race([changed, new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Malformed YAML was not indexed')), 10000);
        })]);
        const sync = host.plugins.plugins.tasknotes.taskCalendarSyncService.timeblocks;
        sync.handleNoteChanged(note);
        await sync.flush();
        await sync.processRecovery(true);
      } finally {
        clearTimeout(timer);
        host.metadataCache.offref(ref);
      }
    }, NOTE);
    expect(await calls()).toHaveLength(2);
    await write('Planning');
    await expect.poll(() => page.evaluate((note) => {
      const host = (window as any).app;
      return host.metadataCache.getFileCache(host.vault.getAbstractFileByPath(note))?.frontmatter?.timeblocks?.[0]?.title;
    }, NOTE)).toBe('Planning');

    await write(null);
    await expect.poll(async () => (await calls()).slice(2), { timeout: 10000 }).toEqual([
      { op: 'delete', calendarId: 'team-e2e@group.calendar.google.com', eventId: 'evt-1' },
    ]);
  } finally {
    await page.evaluate(async (note) => {
      const w = window as any;
      const plugin = w.app.plugins.plugins.tasknotes;
      const saved = w.__tb974?.original;
      if (saved) {
        const google = plugin.googleCalendarService;
        google.getAvailableCalendars = saved.getAvailableCalendars;
        google.createEvent = saved.createEvent;
        google.updateEvent = saved.updateEvent;
        google.deleteEvent = saved.deleteEvent;
        google.getConnectionGeneration = saved.getConnectionGeneration;
        google.isConnectionGenerationCurrent = saved.isConnectionGenerationCurrent;
        plugin.settings.googleCalendarExport = saved.settings;
      }
      const file = w.app.vault.getAbstractFileByPath(note);
      if (file) await w.app.vault.delete(file);
      const data = await plugin.loadData();
      delete data.googleCalendarTimeblockEventIndex;
      delete data.googleCalendarTimeblockSyncQueue;
      await plugin.saveData(data);
    }, NOTE);
  }
});
