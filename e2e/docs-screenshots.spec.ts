/**
 * Documentation Screenshots Test Suite
 *
 * This test suite captures high-quality screenshots for use in TaskNotes documentation.
 * Screenshots are saved to test-results/docs/ and can be copied to docs/assets/.
 *
 * Run with: npm run e2e:docs
 *
 * Screenshot naming convention:
 * - views-{viewname}.png - Main view screenshots
 * - modal-{feature}.png - Modal/dialog screenshots
 * - feature-{name}.png - Feature-specific screenshots
 * - ui-{element}.png - UI element screenshots
 */

import { test, expect, Page } from '@playwright/test';
import {
  launchObsidian,
  closeObsidian,
  ObsidianApp,
  runCommand,
} from './obsidian';

const DOCS_SCREENSHOT_DIR = 'test-results/docs';

// Documentation-friendly viewport size
const DOC_VIEWPORT = { width: 1400, height: 900 };

let app: ObsidianApp;

test.beforeAll(async () => {
  app = await launchObsidian();
  // Set viewport for consistent screenshots
  await app.page.setViewportSize(DOC_VIEWPORT);
});

test.afterAll(async () => {
  if (app) {
    await closeObsidian(app);
  }
});

function getPage(): Page {
  if (!app?.page) {
    throw new Error('Obsidian app not initialized');
  }
  return app.page;
}

// Helper to ensure clean state before each screenshot
async function ensureCleanState(page: Page): Promise<void> {
  // Close any open modals
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(300);
}

// Helper to expand Views folder in sidebar
async function expandViewsFolder(page: Page): Promise<void> {
  const viewsFolder = page.locator('.nav-folder-title:has-text("Views")');
  if (await viewsFolder.isVisible({ timeout: 3000 }).catch(() => false)) {
    const isCollapsed = await viewsFolder
      .locator('..')
      .evaluate((el) => el.classList.contains('is-collapsed'));
    if (isCollapsed) {
      await viewsFolder.click();
      await page.waitForTimeout(300);
    }
  }
}

// Helper to take a screenshot with consistent settings
async function docScreenshot(
  page: Page,
  name: string,
  options?: { fullPage?: boolean; clip?: { x: number; y: number; width: number; height: number } }
): Promise<void> {
  await page.screenshot({
    path: `${DOCS_SCREENSHOT_DIR}/${name}.png`,
    ...options,
  });
}

// ============================================================================
// MAIN VIEW SCREENSHOTS
// Hero shots of each major view type
// ============================================================================

test.describe('Main Views', () => {
  test('calendar-month-view', async () => {
    const page = getPage();
    await ensureCleanState(page);

    await runCommand(page, 'Open calendar view');
    await page.waitForTimeout(1500);

    // Ensure we're on month view
    const monthButton = page.locator('button.fc-dayGridMonth-button');
    if (await monthButton.isVisible()) {
      await monthButton.click();
      await page.waitForTimeout(500);
    }

    // Click Today to ensure we're viewing current month
    const todayButton = page.locator('.fc-today-button');
    if (await todayButton.isVisible() && await todayButton.isEnabled()) {
      await todayButton.click();
      await page.waitForTimeout(500);
    }

    await docScreenshot(page, 'views-calendar-month');
  });

  test('calendar-week-view', async () => {
    const page = getPage();

    const weekButton = page.locator('button.fc-timeGridWeek-button');
    if (await weekButton.isVisible()) {
      await weekButton.click();
      await page.waitForTimeout(800);
    }

    await docScreenshot(page, 'views-calendar-week');
  });

  test('calendar-day-view', async () => {
    const page = getPage();

    const dayButton = page.locator('button.fc-timeGridDay-button');
    if (await dayButton.isVisible()) {
      await dayButton.click();
      await page.waitForTimeout(800);
    }

    await docScreenshot(page, 'views-calendar-day');
  });

  test('calendar-year-view', async () => {
    const page = getPage();

    const yearButton = page.locator('button.fc-multiMonthYear-button');
    if (await yearButton.isVisible()) {
      await yearButton.click();
      await page.waitForTimeout(800);
    }

    await docScreenshot(page, 'views-calendar-year');
  });

  test('kanban-view', async () => {
    const page = getPage();
    await ensureCleanState(page);

    // Calendar must be opened first to initialize FullCalendar
    await runCommand(page, 'Open calendar view');
    await page.waitForTimeout(1000);

    await expandViewsFolder(page);

    const kanbanItem = page.locator('.nav-file-title:has-text("kanban-default")');
    await expect(kanbanItem).toBeVisible({ timeout: 5000 });
    await kanbanItem.click();
    await page.waitForTimeout(1500);

    await docScreenshot(page, 'views-kanban');
  });

  test('tasks-list-view', async () => {
    const page = getPage();

    await expandViewsFolder(page);

    const tasksItem = page.locator('.nav-file-title:has-text("tasks-default")');
    await expect(tasksItem).toBeVisible({ timeout: 5000 });
    await tasksItem.click();
    await page.waitForTimeout(1500);

    await docScreenshot(page, 'views-tasks-list');
  });

  test('agenda-view', async () => {
    const page = getPage();

    await expandViewsFolder(page);

    const agendaItem = page.locator('.nav-file-title:has-text("agenda-default")');
    await expect(agendaItem).toBeVisible({ timeout: 5000 });
    await agendaItem.click();
    await page.waitForTimeout(1500);

    await docScreenshot(page, 'views-agenda');
  });

  test('mini-calendar-view', async () => {
    const page = getPage();

    await expandViewsFolder(page);

    const miniCalItem = page.locator('.nav-file-title:has-text("mini-calendar-default")');
    await expect(miniCalItem).toBeVisible({ timeout: 5000 });
    await miniCalItem.click();
    await page.waitForTimeout(1500);

    await docScreenshot(page, 'views-mini-calendar');
  });
});

// ============================================================================
// TASK NOTE SCREENSHOTS
// Showing task files open in the editor
// ============================================================================

test.describe('Task Note', () => {
  test('task-note-open', async () => {
    const page = getPage();
    await ensureCleanState(page);

    // Open a task file from the sidebar
    const taskItem = page.locator('.nav-file-title:has-text("Review project proposal")');
    if (await taskItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await taskItem.click();
      await page.waitForTimeout(1000);
    } else {
      // Fallback to another task
      const fallbackTask = page.locator('.nav-file-title:has-text("Fix login bug")');
      if (await fallbackTask.isVisible({ timeout: 3000 }).catch(() => false)) {
        await fallbackTask.click();
        await page.waitForTimeout(1000);
      }
    }

    await docScreenshot(page, 'feature-task-note-open');
  });

  test('task-note-with-content', async () => {
    const page = getPage();
    await ensureCleanState(page);

    // Open a task that has more content
    const taskItem = page.locator('.nav-file-title:has-text("Weekly team meeting")');
    if (await taskItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await taskItem.click();
      await page.waitForTimeout(1000);
    }

    await docScreenshot(page, 'feature-task-note-content');
  });
});

// ============================================================================
// TASK MODAL SCREENSHOTS
// Showing task creation and editing interface
// ============================================================================

test.describe('Task Modal', () => {
  test('task-modal-create', async () => {
    const page = getPage();
    await ensureCleanState(page);

    await runCommand(page, 'Create new task');
    await page.waitForTimeout(800);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    await docScreenshot(page, 'modal-task-create');

    await page.keyboard.press('Escape');
  });

  test('task-modal-edit', async () => {
    const page = getPage();
    await ensureCleanState(page);

    // Open calendar view and click on a task event to open edit modal
    await runCommand(page, 'Open calendar view');
    await page.waitForTimeout(1500);

    // Click on a task event in the calendar
    const taskEvent = page.locator('.fc-event').first();
    if (await taskEvent.isVisible({ timeout: 5000 }).catch(() => false)) {
      await taskEvent.click();
      await page.waitForTimeout(800);

      const modal = page.locator('.modal');
      if (await modal.isVisible({ timeout: 5000 }).catch(() => false)) {
        await docScreenshot(page, 'modal-task-edit');
        await page.keyboard.press('Escape');
      }
    }
  });

  test('task-modal-with-content', async () => {
    const page = getPage();
    await ensureCleanState(page);

    await runCommand(page, 'Create new task');
    await page.waitForTimeout(500);

    // Fill in some sample content
    const titleInput = page.locator('.modal input[type="text"]').first();
    if (await titleInput.isVisible()) {
      await titleInput.fill('Complete project documentation');
    }

    await page.waitForTimeout(300);
    await docScreenshot(page, 'modal-task-filled');

    await page.keyboard.press('Escape');
  });
});

// ============================================================================
// POMODORO SCREENSHOTS
// Timer and statistics views
// ============================================================================

test.describe('Pomodoro Timer', () => {
  test('pomodoro-timer', async () => {
    const page = getPage();
    await ensureCleanState(page);

    await runCommand(page, 'Open pomodoro timer');
    await page.waitForTimeout(1000);

    await docScreenshot(page, 'feature-pomodoro-timer');
  });

  test('pomodoro-statistics', async () => {
    const page = getPage();
    await ensureCleanState(page);

    await runCommand(page, 'Open pomodoro statistics');
    await page.waitForTimeout(1000);

    await docScreenshot(page, 'feature-pomodoro-stats');
  });
});

// ============================================================================
// STATISTICS SCREENSHOTS
// Task and project analytics
// ============================================================================

test.describe('Statistics', () => {
  test('task-statistics', async () => {
    const page = getPage();
    await ensureCleanState(page);

    await runCommand(page, 'Open task & project statistics');
    await page.waitForTimeout(1000);

    await docScreenshot(page, 'feature-task-statistics');
  });
});

// ============================================================================
// UI ELEMENT SCREENSHOTS
// Toolbar, sidebar, and other UI components
// ============================================================================

test.describe('UI Elements', () => {
  test('sidebar-navigation', async () => {
    const page = getPage();
    await ensureCleanState(page);

    // Ensure sidebar is visible and Views folder is expanded
    await expandViewsFolder(page);

    // Also expand TaskNotes folder if collapsed
    const tasknotesFolder = page.locator('.nav-folder-title:has-text("TaskNotes")').first();
    if (await tasknotesFolder.isVisible({ timeout: 2000 }).catch(() => false)) {
      const isCollapsed = await tasknotesFolder
        .locator('..')
        .evaluate((el) => el.classList.contains('is-collapsed'));
      if (isCollapsed) {
        await tasknotesFolder.click();
        await page.waitForTimeout(300);
      }
    }

    await docScreenshot(page, 'ui-sidebar-navigation');
  });

  test('command-palette', async () => {
    const page = getPage();
    await ensureCleanState(page);

    await page.keyboard.press('Control+p');
    await page.waitForTimeout(300);

    await page.keyboard.type('TaskNotes', { delay: 30 });
    await page.waitForTimeout(500);

    await docScreenshot(page, 'ui-command-palette');

    await page.keyboard.press('Escape');
  });

  test('calendar-toolbar', async () => {
    const page = getPage();
    await ensureCleanState(page);

    await runCommand(page, 'Open calendar view');
    await page.waitForTimeout(1000);

    // Focus on just the toolbar area
    const toolbar = page.locator('.tn-view-toolbar, .fc-header-toolbar').first();
    if (await toolbar.isVisible()) {
      const box = await toolbar.boundingBox();
      if (box) {
        await docScreenshot(page, 'ui-calendar-toolbar', {
          clip: {
            x: box.x - 10,
            y: box.y - 10,
            width: box.width + 20,
            height: box.height + 20,
          },
        });
      }
    }
  });
});

// ============================================================================
// SETTINGS SCREENSHOTS
// Plugin configuration interface - all tabs
// ============================================================================

test.describe('Settings', () => {
  // Helper to open TaskNotes settings
  async function openTaskNotesSettings(page: Page): Promise<void> {
    await page.keyboard.press('Control+,');
    await page.waitForTimeout(500);

    const settingsModal = page.locator('.modal.mod-settings');
    await expect(settingsModal).toBeVisible({ timeout: 5000 });

    const tasknotesTab = page.locator('.vertical-tab-nav-item:has-text("TaskNotes")');
    if (await tasknotesTab.isVisible()) {
      await tasknotesTab.click();
      await page.waitForTimeout(500);
    }
  }

  // Helper to click a settings tab
  async function clickSettingsTab(page: Page, tabName: string): Promise<void> {
    const tab = page.locator(`.mod-settings button:has-text("${tabName}")`).first();
    if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(400);
    }
  }

  // Helper to scroll settings content
  async function scrollSettingsContent(page: Page, pixels: number): Promise<void> {
    const settingsContent = page.locator('.mod-settings .vertical-tab-content');
    await settingsContent.evaluate((el, px) => el.scrollTop += px, pixels);
    await page.waitForTimeout(200);
  }

  test('settings-general', async () => {
    const page = getPage();
    await ensureCleanState(page);
    await openTaskNotesSettings(page);

    // General tab should be selected by default
    await docScreenshot(page, 'settings-general');

    await page.keyboard.press('Escape');
  });

  test('settings-task-properties', async () => {
    const page = getPage();
    await ensureCleanState(page);
    await openTaskNotesSettings(page);

    await clickSettingsTab(page, 'Task Properties');
    await docScreenshot(page, 'settings-task-properties');

    // Scroll down to show more properties
    await scrollSettingsContent(page, 400);
    await docScreenshot(page, 'settings-task-properties-2');

    await page.keyboard.press('Escape');
  });

  test('settings-modal-fields', async () => {
    const page = getPage();
    await ensureCleanState(page);
    await openTaskNotesSettings(page);

    await clickSettingsTab(page, 'Modal Fields');
    await docScreenshot(page, 'settings-modal-fields');

    await page.keyboard.press('Escape');
  });

  test('settings-appearance', async () => {
    const page = getPage();
    await ensureCleanState(page);
    await openTaskNotesSettings(page);

    await clickSettingsTab(page, 'Appearance');
    await docScreenshot(page, 'settings-appearance');

    // Scroll to show calendar settings
    await scrollSettingsContent(page, 400);
    await docScreenshot(page, 'settings-appearance-calendar');

    await page.keyboard.press('Escape');
  });

  test('settings-features', async () => {
    const page = getPage();
    await ensureCleanState(page);
    await openTaskNotesSettings(page);

    await clickSettingsTab(page, 'Features');
    await docScreenshot(page, 'settings-features');

    // Scroll to show more features (NLP, Pomodoro, etc.)
    await scrollSettingsContent(page, 400);
    await docScreenshot(page, 'settings-features-2');

    await page.keyboard.press('Escape');
  });

  test('settings-integrations', async () => {
    const page = getPage();
    await ensureCleanState(page);
    await openTaskNotesSettings(page);

    await clickSettingsTab(page, 'Integrations');
    await docScreenshot(page, 'settings-integrations');

    // Scroll to show OAuth calendar settings
    await scrollSettingsContent(page, 400);
    await docScreenshot(page, 'settings-integrations-calendar');

    // Scroll more to show ICS/HTTP API
    await scrollSettingsContent(page, 400);
    await docScreenshot(page, 'settings-integrations-api');

    await page.keyboard.press('Escape');
  });
});

// ============================================================================
// TIME TRACKING SCREENSHOTS
// Time entries and timeblocking features
// ============================================================================

test.describe('Time Tracking', () => {
  test('calendar-week-with-timeblocks', async () => {
    const page = getPage();
    await ensureCleanState(page);

    await runCommand(page, 'Open calendar view');
    await page.waitForTimeout(1000);

    // Switch to week view to show timeblocks
    const weekButton = page.locator('button.fc-timeGridWeek-button');
    if (await weekButton.isVisible()) {
      await weekButton.click();
      await page.waitForTimeout(800);
    }

    await docScreenshot(page, 'feature-timeblocks-week');
  });

  test('calendar-day-with-timeblocks', async () => {
    const page = getPage();

    // Switch to day view
    const dayButton = page.locator('button.fc-timeGridDay-button');
    if (await dayButton.isVisible()) {
      await dayButton.click();
      await page.waitForTimeout(800);
    }

    await docScreenshot(page, 'feature-timeblocks-day');
  });
});

// ============================================================================
// TASK FILE SCREENSHOTS
// Task notes with YAML frontmatter visible
// ============================================================================

test.describe('Task Files', () => {
  test('task-yaml-frontmatter', async () => {
    const page = getPage();
    await ensureCleanState(page);

    // Open a task file
    const taskItem = page.locator('.nav-file-title:has-text("Review project proposal")');
    if (await taskItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await taskItem.click();
      await page.waitForTimeout(800);
    }

    // Switch to source mode to show YAML frontmatter
    await page.keyboard.press('Control+e');
    await page.waitForTimeout(500);

    await docScreenshot(page, 'feature-task-yaml-source');

    // Switch back to reading/preview mode
    await page.keyboard.press('Control+e');
    await page.waitForTimeout(300);
  });

  test('task-properties-view', async () => {
    const page = getPage();
    await ensureCleanState(page);

    // Open a task with good content
    const taskItem = page.locator('.nav-file-title:has-text("Weekly team meeting")');
    if (await taskItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await taskItem.click();
      await page.waitForTimeout(800);
    }

    await docScreenshot(page, 'feature-task-properties-view');
  });
});

// ============================================================================
// WORKFLOW SCREENSHOTS
// Common user workflows and interactions
// ============================================================================

test.describe('Workflows', () => {
  test('quick-add-from-calendar', async () => {
    const page = getPage();
    await ensureCleanState(page);

    await runCommand(page, 'Open calendar view');
    await page.waitForTimeout(1000);

    // Ensure month view
    const monthButton = page.locator('button.fc-dayGridMonth-button');
    if (await monthButton.isVisible()) {
      await monthButton.click();
      await page.waitForTimeout(500);
    }

    // Double-click a day to open quick add
    const dayCell = page.locator('.fc-daygrid-day').nth(15); // Middle of month
    if (await dayCell.isVisible()) {
      await dayCell.dblclick();
      await page.waitForTimeout(500);

      await docScreenshot(page, 'workflow-quick-add-calendar');

      await page.keyboard.press('Escape');
    }
  });

  test('task-context-menu', async () => {
    const page = getPage();
    await ensureCleanState(page);

    await runCommand(page, 'Open calendar view');
    await page.waitForTimeout(1000);

    // Right-click on a task event
    const taskEvent = page.locator('.fc-event').first();
    if (await taskEvent.isVisible({ timeout: 3000 }).catch(() => false)) {
      await taskEvent.click({ button: 'right' });
      await page.waitForTimeout(500);

      await docScreenshot(page, 'workflow-task-context-menu');

      await page.keyboard.press('Escape');
    }
  });

  test('task-hover-preview', async () => {
    const page = getPage();
    await ensureCleanState(page);

    await runCommand(page, 'Open calendar view');
    await page.waitForTimeout(1000);

    // Hover over a task event
    const taskEvent = page.locator('.fc-event').first();
    if (await taskEvent.isVisible({ timeout: 3000 }).catch(() => false)) {
      await taskEvent.hover();
      await page.waitForTimeout(800);

      await docScreenshot(page, 'workflow-task-hover');
    }
  });
});

// ============================================================================
// THEME SCREENSHOTS
// Capturing UI in different visual states
// ============================================================================

test.describe('Theme Variants', () => {
  test('full-interface-dark', async () => {
    const page = getPage();
    await ensureCleanState(page);

    // Capture full interface with calendar view open
    await runCommand(page, 'Open calendar view');
    await page.waitForTimeout(1000);

    await docScreenshot(page, 'theme-full-interface', { fullPage: true });
  });
});

// ============================================================================
// RESPONSIVE SCREENSHOTS
// Different viewport sizes
// ============================================================================

test.describe('Responsive Layout', () => {
  test('narrow-viewport', async () => {
    const page = getPage();
    await ensureCleanState(page);

    // Set narrow viewport
    await page.setViewportSize({ width: 900, height: 700 });

    await runCommand(page, 'Open calendar view');
    await page.waitForTimeout(1000);

    await docScreenshot(page, 'responsive-narrow');

    // Reset viewport
    await page.setViewportSize(DOC_VIEWPORT);
  });

  test('wide-viewport', async () => {
    const page = getPage();
    await ensureCleanState(page);

    // Set wide viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    await runCommand(page, 'Open calendar view');
    await page.waitForTimeout(1000);

    await docScreenshot(page, 'responsive-wide');

    // Reset viewport
    await page.setViewportSize(DOC_VIEWPORT);
  });
});
