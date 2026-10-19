import { test, expect } from '@playwright/test';
import {
  launchObsidian, closeObsidian, ObsidianApp,
  setObsidianViewport, openObsidianSettings, closeObsidianSettings,
} from './obsidian';

let app: ObsidianApp;

test.beforeAll(async () => { app = await launchObsidian(); });
test.afterAll(async () => { if (app) await closeObsidian(app); });

test('native window and emulated viewport have the same desktop dimensions', async () => {
  const size = { width: 1400, height: 900 };
  await setObsidianViewport(app.page, size);
  const actual = await app.page.evaluate(() => ({
    native: (window as any).require('electron').remote.getCurrentWindow().getContentSize(),
    viewport: [window.innerWidth, window.innerHeight],
  }));
  expect(actual.native).toEqual([size.width, size.height]);
  expect(actual.viewport).toEqual([size.width, size.height]);
});

test('Settings targets its actual window or modal and returns to the workspace', async () => {
  const pageCount = app.page.context().pages().length;
  const settingsPage = await openObsidianSettings(app.page);
  await expect(settingsPage.locator('.vertical-tab-content')).toBeVisible();
  await closeObsidianSettings(app.page, settingsPage);
  await expect(app.page.locator('.workspace')).toBeVisible();
  await expect.poll(() => app.page.context().pages().length).toBe(pageCount);
});
