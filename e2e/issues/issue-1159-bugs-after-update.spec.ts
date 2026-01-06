/**
 * Issue #1159: [Bug]: Bug report after latest update
 *
 * This issue reports 4 bugs observed after updating to version 4.0.1:
 *
 * 1. Kanban view: text overflows card boundaries when there are many items
 *    - Task titles extend beyond card edges
 *    - Likely related to flex layout and word-break CSS properties
 *
 * 2. Kanban view: scrolling behavior changed
 *    - Entire canvas moves instead of scrolling within kanban lanes
 *    - May be related to commit afe28f02 which lowered virtual scrolling threshold
 *    - Ephemeral state restoration may be affecting scroll behavior
 *
 * 3. Calendar view: Pomodoro time entries visible despite setting disabled
 *    - Time entries show even when "time entries" is unchecked in settings
 *    - Config synchronization issue between viewOptions and settings
 *
 * 4. Visual hierarchy issue: time entries vs tasks styling
 *    - Time entries have 2px dashed borders + background pattern
 *    - Tasks have thin 1px borders
 *    - Time entries appear visually dominant over tasks
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1159
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1159: Bug report after latest update', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.describe('Bug 1: Kanban card text overflow', () => {
    test.fixme(
      'reproduces issue #1159 - kanban card text should not overflow boundaries',
      async () => {
        /**
         * This test verifies that task card titles in Kanban view stay within
         * card boundaries, even when there are many items or long titles.
         *
         * Current behavior (bug):
         * - Text overflows card boundaries when there are many items
         * - Long titles may extend beyond the card edges
         *
         * Expected behavior:
         * - Text should wrap within card boundaries
         * - Card width should constrain title text
         * - word-wrap/word-break CSS should properly handle long words
         *
         * Root cause analysis:
         * - task-card__title uses display: flex with gap property
         * - Combined with status indicators may create width calculation issues
         * - Default column width of 280px may be too narrow with flex layout
         */
        const page = app.page;

        // Open a kanban view
        await runCommand(page, 'TaskNotes: Open kanban view');
        await page.waitForTimeout(1000);

        const kanbanBoard = page.locator('.kanban-view__board');
        await expect(kanbanBoard).toBeVisible({ timeout: 10000 });

        // Find task cards in the kanban view
        const taskCards = page.locator('.task-card');
        const cardCount = await taskCards.count();

        if (cardCount === 0) {
          console.log('No task cards found - skipping overflow check');
          return;
        }

        // Check each card for overflow
        for (let i = 0; i < Math.min(cardCount, 10); i++) {
          const card = taskCards.nth(i);
          const cardTitle = card.locator('.task-card__title, .task-card__title-text');

          if (await cardTitle.isVisible({ timeout: 1000 }).catch(() => false)) {
            // Get the card and title bounding boxes
            const cardBox = await card.boundingBox();
            const titleBox = await cardTitle.boundingBox();

            if (cardBox && titleBox) {
              // Title should not extend beyond card boundaries
              const titleRight = titleBox.x + titleBox.width;
              const cardRight = cardBox.x + cardBox.width;

              // Allow small margin (padding)
              const overflows = titleRight > cardRight + 16;

              if (overflows) {
                console.log(
                  `Card ${i} title overflow detected: title ends at ${titleRight}, card ends at ${cardRight}`
                );
              }

              expect(overflows).toBe(false);
            }
          }
        }
      }
    );

    test.fixme(
      'reproduces issue #1159 - kanban cards with long titles should wrap properly',
      async () => {
        /**
         * Test specifically for long title handling in kanban cards.
         * The CSS should use word-wrap: break-word to handle long titles.
         */
        const page = app.page;

        // Open kanban view
        await runCommand(page, 'TaskNotes: Open kanban view');
        await page.waitForTimeout(1000);

        const kanbanBoard = page.locator('.kanban-view__board');
        await expect(kanbanBoard).toBeVisible({ timeout: 10000 });

        // Check that the CSS word-wrap properties are correctly applied
        const taskCard = page.locator('.task-card').first();
        if (await taskCard.isVisible({ timeout: 2000 }).catch(() => false)) {
          const titleElement = taskCard.locator('.task-card__title-text');

          if (await titleElement.isVisible({ timeout: 1000 }).catch(() => false)) {
            const styles = await titleElement.evaluate((el) => {
              const computed = window.getComputedStyle(el);
              return {
                wordWrap: computed.wordWrap,
                wordBreak: computed.wordBreak,
                overflowWrap: computed.overflowWrap,
                whiteSpace: computed.whiteSpace,
                overflow: computed.overflow,
              };
            });

            // Verify text wrapping CSS is applied
            const hasProperWordWrap =
              styles.wordWrap === 'break-word' ||
              styles.overflowWrap === 'break-word' ||
              styles.wordBreak === 'break-word';

            expect(hasProperWordWrap).toBe(true);

            // White-space should allow wrapping (not nowrap)
            expect(styles.whiteSpace).not.toBe('nowrap');
          }
        }
      }
    );
  });

  test.describe('Bug 2: Kanban scrolling behavior', () => {
    test.fixme(
      'reproduces issue #1159 - kanban lanes should scroll independently',
      async () => {
        /**
         * This test verifies that scrolling in kanban view works correctly.
         *
         * Current behavior (bug):
         * - Entire canvas moves instead of scrolling within kanban lanes
         * - May be related to ephemeral state restoration (scrollTop on rootElement)
         *
         * Expected behavior:
         * - Each kanban column should scroll independently
         * - Horizontal board scrolling should be separate from vertical column scrolling
         * - The board container should not move the entire canvas
         *
         * Root cause analysis:
         * - KanbanView saves/restores scrollTop on rootElement
         * - Board container has overflow: hidden
         * - Board has overflow-x: auto for horizontal scrolling
         * - Virtual scrolling threshold was lowered from 30 to 15 (commit afe28f02)
         */
        const page = app.page;

        // Open kanban view
        await runCommand(page, 'TaskNotes: Open kanban view');
        await page.waitForTimeout(1000);

        const kanbanBoard = page.locator('.kanban-view__board');
        await expect(kanbanBoard).toBeVisible({ timeout: 10000 });

        // Find kanban columns with enough items to scroll
        const columns = page.locator('.kanban-view__column');
        const columnCount = await columns.count();

        if (columnCount === 0) {
          console.log('No kanban columns found');
          return;
        }

        // Find a column with content that might need scrolling
        for (let i = 0; i < columnCount; i++) {
          const column = columns.nth(i);
          const columnContent = column.locator(
            '.kanban-view__column-content, .kanban-view__column-cards'
          );

          if (await columnContent.isVisible({ timeout: 1000 }).catch(() => false)) {
            // Get column content scroll properties
            const scrollInfo = await columnContent.evaluate((el) => {
              return {
                scrollHeight: el.scrollHeight,
                clientHeight: el.clientHeight,
                scrollTop: el.scrollTop,
                overflow: window.getComputedStyle(el).overflow,
                overflowY: window.getComputedStyle(el).overflowY,
              };
            });

            // If column has scrollable content
            if (scrollInfo.scrollHeight > scrollInfo.clientHeight) {
              // Record initial scroll position
              const initialScrollTop = scrollInfo.scrollTop;

              // Scroll within the column
              await columnContent.evaluate((el) => {
                el.scrollTop = 100;
              });
              await page.waitForTimeout(100);

              // Check that only the column scrolled, not the entire canvas
              const afterScroll = await columnContent.evaluate((el) => el.scrollTop);

              // Verify column scrolled
              expect(afterScroll).toBeGreaterThan(initialScrollTop);

              // Verify the board container didn't move
              const boardContainer = page.locator('.kanban-view__board-container');
              const boardScrollTop = await boardContainer.evaluate((el) => el.scrollTop);

              // Board container should not have scrolled
              expect(boardScrollTop).toBe(0);

              break;
            }
          }
        }
      }
    );

    test.fixme(
      'reproduces issue #1159 - kanban horizontal scroll should not affect vertical scroll',
      async () => {
        /**
         * Test that horizontal scrolling on the board doesn't interfere
         * with vertical scrolling in columns.
         */
        const page = app.page;

        // Open kanban view
        await runCommand(page, 'TaskNotes: Open kanban view');
        await page.waitForTimeout(1000);

        const kanbanBoard = page.locator('.kanban-view__board');
        await expect(kanbanBoard).toBeVisible({ timeout: 10000 });

        // Check board overflow CSS
        const boardOverflow = await kanbanBoard.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            overflowX: computed.overflowX,
            overflowY: computed.overflowY,
          };
        });

        // Board should have horizontal scroll only
        expect(boardOverflow.overflowX).toBe('auto');

        // Get the board container
        const boardContainer = page.locator('.kanban-view__board-container');
        if (await boardContainer.isVisible({ timeout: 1000 }).catch(() => false)) {
          const containerOverflow = await boardContainer.evaluate((el) => {
            return window.getComputedStyle(el).overflow;
          });

          // Container should constrain overflow
          expect(containerOverflow).toBe('hidden');
        }
      }
    );
  });

  test.describe('Bug 3: Calendar time entries visibility setting', () => {
    test.fixme(
      'reproduces issue #1159 - time entries should respect visibility setting',
      async () => {
        /**
         * This test verifies that time entries are hidden when the
         * "show time entries" setting is disabled.
         *
         * Current behavior (bug):
         * - Pomodoro time entries show even when "time entries" is unchecked
         *
         * Expected behavior:
         * - When showTimeEntries is false, no time entry events should appear
         * - The setting should immediately affect the calendar view
         *
         * Root cause analysis:
         * - CalendarView.ts reads showTimeEntries config at line 192
         * - calendar-core.ts filters at lines 1023-1031
         * - The issue may be config not being read properly or defaulting to true
         */
        const page = app.page;

        // Open calendar view
        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // Count time entry events before disabling
        const timeEntryEvents = page.locator('.fc-event[data-event-type="timeEntry"]');
        const initialTimeEntryCount = await timeEntryEvents.count();

        console.log(`Initial time entry count: ${initialTimeEntryCount}`);

        // Find and disable the time entries toggle
        // Look in the calendar toolbar or settings
        const timeEntriesToggle = page.locator(
          '[data-setting="showTimeEntries"], ' +
            'input[aria-label*="time entr"], ' +
            '.calendar-toggle-time-entries, ' +
            'button:has-text("Time Entries"), ' +
            '.view-options input:has-text("Time")'
        );

        if (await timeEntriesToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Check current state
          const isChecked = await timeEntriesToggle.isChecked().catch(() => null);

          if (isChecked === true || isChecked === null) {
            // Uncheck/toggle off
            await timeEntriesToggle.click();
            await page.waitForTimeout(500);

            // After disabling, time entry events should not be visible
            const afterDisableCount = await timeEntryEvents.count();

            expect(afterDisableCount).toBe(0);
          }
        } else {
          // If toggle not found in calendar, check in view options menu
          const optionsButton = page.locator(
            '.calendar-view__options-button, ' +
              'button[aria-label="Options"], ' +
              '.fc-toolbar button:has-text("Options")'
          );

          if (await optionsButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await optionsButton.click();
            await page.waitForTimeout(300);

            const timeEntriesOption = page.locator(
              '[data-option="showTimeEntries"], ' +
                '.option-item:has-text("Time Entries"), ' +
                'label:has-text("Time Entries")'
            );

            if (await timeEntriesOption.isVisible({ timeout: 1000 }).catch(() => false)) {
              await timeEntriesOption.click();
              await page.waitForTimeout(500);

              // Verify time entries are now hidden
              const afterDisableCount = await timeEntryEvents.count();
              expect(afterDisableCount).toBe(0);
            }
          }
        }
      }
    );

    test.fixme(
      'reproduces issue #1159 - time entries toggle should persist and sync correctly',
      async () => {
        /**
         * Test that the time entries visibility setting persists across
         * view refreshes and is properly synced with the config.
         */
        const page = app.page;

        // Open calendar view
        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // Disable time entries (if possible through the UI)
        // This would involve finding the toggle and setting it to off

        // Then navigate away and back
        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(500);

        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        // Time entries should still be hidden (setting persisted)
        const timeEntryEvents = page.locator('.fc-event[data-event-type="timeEntry"]');
        const countAfterReturn = await timeEntryEvents.count();

        // If the setting persisted correctly, time entries should still be hidden
        // This test documents the expected behavior
        console.log(`Time entry count after returning to calendar: ${countAfterReturn}`);
      }
    );
  });

  test.describe('Bug 4: Visual hierarchy - time entries vs tasks', () => {
    test.fixme(
      'reproduces issue #1159 - time entries should not be more visually dominant than tasks',
      async () => {
        /**
         * This test verifies that the visual hierarchy between time entries
         * and tasks is appropriate - tasks should be more prominent.
         *
         * Current behavior (bug):
         * - Time entries have 2px dashed borders + striped background
         * - Tasks have thin 1px borders
         * - Time entries are visually dominant over tasks
         *
         * Expected behavior:
         * - Tasks (actionable items) should be more visually prominent
         * - Time entries (historical/informational) should be subtle
         * - Visual weight should reflect importance hierarchy
         *
         * User suggestion:
         * - Allow users to customize time entry colors to match their workflow
         */
        const page = app.page;

        // Open calendar view
        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // Get time entry styling
        const timeEntryEvent = page.locator('.fc-event[data-event-type="timeEntry"]').first();
        const taskEvent = page.locator(
          '.fc-task-event, .fc-event:not([data-event-type="timeEntry"])'
        ).first();

        let timeEntryStyles = null;
        let taskStyles = null;

        if (await timeEntryEvent.isVisible({ timeout: 2000 }).catch(() => false)) {
          timeEntryStyles = await timeEntryEvent.evaluate((el) => {
            const computed = window.getComputedStyle(el);
            return {
              borderWidth: computed.borderWidth,
              borderStyle: computed.borderStyle,
              backgroundColor: computed.backgroundColor,
              opacity: computed.opacity,
            };
          });
        }

        if (await taskEvent.isVisible({ timeout: 2000 }).catch(() => false)) {
          taskStyles = await taskEvent.evaluate((el) => {
            const computed = window.getComputedStyle(el);
            return {
              borderWidth: computed.borderWidth,
              borderStyle: computed.borderStyle,
              backgroundColor: computed.backgroundColor,
              opacity: computed.opacity,
            };
          });
        }

        if (timeEntryStyles && taskStyles) {
          console.log('Time entry styles:', timeEntryStyles);
          console.log('Task styles:', taskStyles);

          // Parse border widths
          const timeEntryBorderWidth = parseFloat(timeEntryStyles.borderWidth) || 0;
          const taskBorderWidth = parseFloat(taskStyles.borderWidth) || 0;

          // Tasks should have at least as much visual weight as time entries
          // (border width comparison - tasks should not have thinner borders)
          if (timeEntryBorderWidth > taskBorderWidth) {
            console.log(
              `Visual hierarchy issue: time entry border (${timeEntryBorderWidth}px) ` +
                `is thicker than task border (${taskBorderWidth}px)`
            );
          }

          // Time entries should have more subtle styling
          // Currently they have dashed borders which should indicate secondary status
          // but combined with thick borders + background, they become dominant
          expect(timeEntryBorderWidth).toBeLessThanOrEqual(taskBorderWidth);
        }
      }
    );

    test.fixme(
      'reproduces issue #1159 - time entry border and background should be configurable',
      async () => {
        /**
         * The user suggests allowing customization of time entry colors.
         * This test checks if such customization is available.
         */
        const page = app.page;

        // Open TaskNotes settings
        await runCommand(page, 'Open settings');
        await page.waitForTimeout(500);

        const settingsContainer = page.locator('.modal-container');
        await expect(settingsContainer).toBeVisible({ timeout: 5000 });

        // Navigate to TaskNotes settings
        const taskNotesTab = page.locator('.vertical-tab-nav-item:has-text("TaskNotes")');
        if (await taskNotesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await taskNotesTab.click();
          await page.waitForTimeout(500);
        }

        // Look for appearance/style settings
        const appearanceSection = page.locator(
          '.setting-item:has-text("Appearance"), ' +
            'h3:has-text("Appearance"), ' +
            '.setting-item:has-text("Style")'
        );

        // Look for time entry color/style settings
        const timeEntryColorSetting = page.locator(
          '.setting-item:has-text("Time Entry"), ' +
            '.setting-item:has-text("time entry color"), ' +
            '.setting-item:has-text("Pomodoro color"), ' +
            '[data-setting="timeEntryColor"]'
        );

        const hasTimeEntryColorSetting = await timeEntryColorSetting
          .isVisible({ timeout: 2000 })
          .catch(() => false);

        // After implementing the user's suggestion, there should be a color setting
        // Currently this likely doesn't exist
        console.log(`Time entry color setting exists: ${hasTimeEntryColorSetting}`);

        // Close settings
        await page.keyboard.press('Escape');
      }
    );
  });
});
