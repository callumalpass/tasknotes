import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

let instance: ObsidianApp;
let server: Server;
let baseUrl: string;
const calendars = [
  { id: 'feed', summary: 'https://example.com/running.ics', summaryOverride: 'Running' },
  { id: 'shared', summary: 'Calendar', summaryOverride: 'Team meetings' },
  { id: 'owned', summary: 'Personal', primary: true },
  { id: 'empty', summary: 'Original title', summaryOverride: '' },
];

test.beforeAll(async () => {
  // Exercise Obsidian's real requestUrl without Google credentials or live data.
  server = createServer((request, response) => {
    if (request.url !== '/users/me/calendarList') {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ items: calendars }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing fixture port');
  baseUrl = `http://127.0.0.1:${address.port}`;
  instance = await launchObsidian();
});

test.afterAll(async () => {
  try {
    if (instance) await closeObsidian(instance);
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('Google calendar labels prefer user names and retain original-title fallbacks', async ({}, testInfo) => {
  const actual = await instance.page.evaluate(async baseUrl => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    // Use a separate service so the active plugin's OAuth and metadata stay untouched.
    const service = new plugin.googleCalendarService.constructor(plugin, {
      getValidToken: async () => 'fixture-token',
    });
    service.baseUrl = baseUrl;
    return service.listCalendars();
  }, baseUrl);
  await testInfo.attach('calendar-display-names', {
    body: JSON.stringify({ time: new Date().toISOString(), input: calendars, actual }, null, 2),
    contentType: 'application/json',
  });
  // Owned calendars and empty overrides are controls for unchanged behavior.
  expect(actual.map((calendar: { summary: string }) => calendar.summary)).toEqual([
    'Running', 'Team meetings', 'Personal', 'Original title',
  ]);
  expect(actual.map((calendar: { id: string }) => calendar.id)).toEqual(calendars.map(calendar => calendar.id));
});
