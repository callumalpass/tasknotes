/**
 * Issue #1441: [Bug] Task dragging in calendar view broken with
 * "Span tasks between scheduled and due dates" enabled.
 *
 * These tests use a real temporary task and real TaskNotes Base files. They
 * intentionally fail if the span, scheduled, or due events do not render.
 */

import { test, expect, Page, Locator } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { launchObsidian, closeObsidian, ObsidianApp } from '../obsidian';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const E2E_VAULT_DIR = path.join(PROJECT_ROOT, 'tasknotes-e2e-vault');
const DEFAULT_CALENDAR_BASE = path.join(E2E_VAULT_DIR, 'TaskNotes/Views/calendar-default.base');
const SPAN_BASE_RELATIVE_PATH = 'TaskNotes/Views/span-drag-e2e.base';
const NO_SPAN_BASE_RELATIVE_PATH = 'TaskNotes/Views/span-drag-no-span-e2e.base';
const SPAN_TASK_RELATIVE_PATH = 'TaskNotes/Span drag e2e.md';
const SPAN_TASK_TITLE = 'Span drag e2e';
const ACTIVE_LEAF_SELECTOR = '.workspace-leaf.mod-active';

let app: ObsidianApp;

type TaskDates = {
  scheduled: string;
  due: string;
};

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function initialTaskDates(): TaskDates {
  const today = new Date();
  const scheduled = new Date(today);
  scheduled.setDate(today.getDate() - 1);
  const due = new Date(today);
  due.setDate(today.getDate() + 2);
  return {
    scheduled: formatLocalDate(scheduled),
    due: formatLocalDate(due),
  };
}

function taskFixtureContent(dates: TaskDates): string {
  return [
    '---',
    `title: ${SPAN_TASK_TITLE}`,
    'status: todo',
    'priority: normal',
    `scheduled: ${dates.scheduled}`,
    `due: ${dates.due}`,
    'tags:',
    '  - task',
    '---',
    '',
    '# Span drag e2e',
    '',
    'Temporary e2e fixture for calendar span drag behaviour.',
    '',
  ].join('\n');
}

function baseFixtureContent(showSpan: boolean): string {
  const content = fs.readFileSync(DEFAULT_CALENDAR_BASE, 'utf8');
  return content
    .replace(/name: Calendar/g, `name: ${showSpan ? 'Span Drag E2E' : 'Span Drag No Span E2E'}`)
    .replace(/calendarView: \w+/g, 'calendarView: dayGridMonth')
    .replace(/showScheduledToDueSpan: (true|false)/g, `showScheduledToDueSpan: ${showSpan}`);
}

function writeInitialFixtures(): void {
  fs.writeFileSync(
    path.join(E2E_VAULT_DIR, SPAN_BASE_RELATIVE_PATH),
    baseFixtureContent(true),
    'utf8'
  );
  fs.writeFileSync(
    path.join(E2E_VAULT_DIR, NO_SPAN_BASE_RELATIVE_PATH),
    baseFixtureContent(false),
    'utf8'
  );
  fs.writeFileSync(
    path.join(E2E_VAULT_DIR, SPAN_TASK_RELATIVE_PATH),
    taskFixtureContent(initialTaskDates()),
    'utf8'
  );
}

async function writeVaultFile(page: Page, relativePath: string, content: string): Promise<void> {
  const written = await page.evaluate(async ({ targetPath, fileContent }) => {
    const obsidianApp = (window as any).app;
    const existingFile = obsidianApp?.vault?.getAbstractFileByPath?.(targetPath);
    if (existingFile) {
      await obsidianApp.vault.modify(existingFile, fileContent);
      return true;
    }
    await obsidianApp.vault.create(targetPath, fileContent);
    return true;
  }, { targetPath: relativePath, fileContent: content });

  if (!written) {
    throw new Error(`Could not write ${relativePath}`);
  }
}

async function resetTaskFixture(page: Page): Promise<TaskDates> {
  const dates = initialTaskDates();
  await writeVaultFile(page, SPAN_TASK_RELATIVE_PATH, taskFixtureContent(dates));
  await page.waitForTimeout(500);
  return dates;
}

async function openBaseFile(page: Page, relativePath: string): Promise<void> {
  const opened = await page.evaluate(async (targetPath) => {
    const obsidianApp = (window as any).app;
    const file = obsidianApp?.vault?.getAbstractFileByPath?.(targetPath);
    if (!file) return false;
    await obsidianApp.workspace.getLeaf(false).openFile(file);
    return true;
  }, relativePath);

  if (!opened) {
    throw new Error(`Could not open ${relativePath}`);
  }

  await expect(page.locator(`${ACTIVE_LEAF_SELECTOR} .fc`).first()).toBeVisible({ timeout: 10000 });
  const monthButton = page.locator(`${ACTIVE_LEAF_SELECTOR} .fc-dayGridMonth-button`).first();
  if (await monthButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await monthButton.click();
  }
  await page.waitForTimeout(500);
}

async function readTaskDates(page: Page): Promise<TaskDates> {
  return page.evaluate(async (targetPath) => {
    const obsidianApp = (window as any).app;
    const file = obsidianApp?.vault?.getAbstractFileByPath?.(targetPath);
    if (!file) {
      throw new Error(`Could not read ${targetPath}`);
    }
    const content: string = await obsidianApp.vault.read(file);
    const scheduled = content.match(/^scheduled:\s*(.+)$/m)?.[1]?.trim();
    const due = content.match(/^due:\s*(.+)$/m)?.[1]?.trim();
    if (!scheduled || !due) {
      throw new Error(`Task dates missing in ${targetPath}`);
    }
    return { scheduled, due };
  }, SPAN_TASK_RELATIVE_PATH);
}

function eventsForTask(page: Page, eventType: string): Locator {
  return page
    .locator(`${ACTIVE_LEAF_SELECTOR} .fc-event[data-event-type="${eventType}"]`)
    .filter({ hasText: SPAN_TASK_TITLE });
}

function eventForTask(page: Page, eventType: string): Locator {
  return eventsForTask(page, eventType)
    .first();
}

function daysBetween(start: string, end: string): number {
  const startTime = new Date(`${start}T00:00:00`).getTime();
  const endTime = new Date(`${end}T00:00:00`).getTime();
  return Math.round((endTime - startTime) / 86400000);
}

async function dragEventByOneDay(page: Page, event: Locator): Promise<void> {
  const eventBox = await event.boundingBox();
  expect(eventBox).not.toBeNull();
  const firstDayBox = await page
    .locator(`${ACTIVE_LEAF_SELECTOR} .fc-daygrid-day`)
    .first()
    .boundingBox();
  expect(firstDayBox).not.toBeNull();

  const startX = eventBox!.x + eventBox!.width / 2;
  const startY = eventBox!.y + eventBox!.height / 2;
  const targetX = startX + firstDayBox!.width;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.move(targetX, startY, { steps: 12 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(1200);
}

async function expectSpanCalendar(page: Page): Promise<Locator> {
  await openBaseFile(page, SPAN_BASE_RELATIVE_PATH);
  const spanEvent = eventForTask(page, 'scheduledToDueSpan');
  await expect(spanEvent).toBeVisible({ timeout: 10000 });
  return spanEvent;
}

test.describe('Issue #1441: Span task drag with scheduled-to-due span enabled', () => {
  test.beforeAll(async () => {
    writeInitialFixtures();
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
    fs.rmSync(path.join(E2E_VAULT_DIR, SPAN_BASE_RELATIVE_PATH), { force: true });
    fs.rmSync(path.join(E2E_VAULT_DIR, NO_SPAN_BASE_RELATIVE_PATH), { force: true });
    fs.rmSync(path.join(E2E_VAULT_DIR, SPAN_TASK_RELATIVE_PATH), { force: true });
  });

  test('span events should be draggable and update both scheduled and due dates', async () => {
    const page = app.page;
    const initialDates = await resetTaskFixture(page);
    const spanEvent = await expectSpanCalendar(page);

    await dragEventByOneDay(page, spanEvent);

    const updatedDates = await readTaskDates(page);
    expect(daysBetween(initialDates.scheduled, updatedDates.scheduled)).toBe(1);
    expect(daysBetween(initialDates.due, updatedDates.due)).toBe(1);
  });

  test('span event drag should preserve span duration', async () => {
    const page = app.page;
    const initialDates = await resetTaskFixture(page);
    const spanEvent = await expectSpanCalendar(page);
    const initialDuration = daysBetween(initialDates.scheduled, initialDates.due);

    await dragEventByOneDay(page, spanEvent);

    const updatedDates = await readTaskDates(page);
    expect(daysBetween(updatedDates.scheduled, updatedDates.due)).toBe(initialDuration);
  });

  test('individual scheduled/due events should still work when span disabled', async () => {
    const page = app.page;
    const initialDates = await resetTaskFixture(page);

    await openBaseFile(page, NO_SPAN_BASE_RELATIVE_PATH);
    await expect(eventsForTask(page, 'scheduledToDueSpan')).toHaveCount(0);

    const scheduledEvent = eventForTask(page, 'scheduled');
    await expect(scheduledEvent).toBeVisible({ timeout: 10000 });
    await dragEventByOneDay(page, scheduledEvent);

    const updatedScheduledDates = await readTaskDates(page);
    expect(daysBetween(initialDates.scheduled, updatedScheduledDates.scheduled)).toBe(1);
    expect(updatedScheduledDates.due).toBe(initialDates.due);

    const resetDates = await resetTaskFixture(page);
    await openBaseFile(page, NO_SPAN_BASE_RELATIVE_PATH);
    const dueEvent = eventForTask(page, 'due');
    await expect(dueEvent).toBeVisible({ timeout: 10000 });
    await dragEventByOneDay(page, dueEvent);

    const updatedDueDates = await readTaskDates(page);
    expect(updatedDueDates.scheduled).toBe(resetDates.scheduled);
    expect(daysBetween(resetDates.due, updatedDueDates.due)).toBe(1);
  });

  test('span events should be explicitly editable', async () => {
    const page = app.page;
    await resetTaskFixture(page);
    const spanEvent = await expectSpanCalendar(page);

    await expect(spanEvent).not.toHaveClass(/fc-event-not-editable/);

    const eventBox = await spanEvent.boundingBox();
    expect(eventBox).not.toBeNull();
    const startX = eventBox!.x + eventBox!.width / 2;
    const startY = eventBox!.y + eventBox!.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 50, startY, { steps: 3 });

    const dragMirror = page.locator('.fc-event-mirror, .fc-event-dragging');
    await expect(dragMirror.first()).toBeVisible({ timeout: 1000 });

    await page.mouse.up();
  });
});
