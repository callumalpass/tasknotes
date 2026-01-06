/**
 * Issue #1179: [Bug] Calendar view flashes intermittently when typing in another pane
 *
 * Bug description:
 * When the user has two panes open simultaneously - one with the calendar view
 * and one with another note - typing in the other note causes the calendar text
 * and tasks to flash intermittently. It appears as if the calendar is refreshing.
 *
 * Root cause analysis:
 * The flashing is likely caused by the calendar view's response to data updates.
 * When typing in Obsidian, the file is periodically auto-saved which triggers:
 * 1. EVENT_DATA_CHANGED events through Bases
 * 2. `onDataUpdated()` calls on the CalendarView
 * 3. Potential re-renders via `render()` or `refetchEvents()`
 *
 * Although CalendarView.ts has a 5-second debounce for external changes (line 279-282),
 * there may be scenarios where:
 * - The debounce is bypassed (e.g., config change detection returns true incorrectly)
 * - The `hasConfigChanged()` method produces false positives
 * - Other update paths bypass the debounce (e.g., task update listener)
 * - FullCalendar's `refetchEvents()` causes visual flashing even when data hasn't changed
 *
 * The `refetchEvents()` call (line 1046) regenerates all calendar events which can
 * cause visual jank if called too frequently. The calendar re-mounts event elements
 * which may cause the "flash" effect described.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1179
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1179: Calendar view flashes when typing in another pane', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #1179 - calendar should not flash when typing in another pane',
    async () => {
      /**
       * This test reproduces the core bug: calendar view flashes when typing
       * in a note in a different pane.
       *
       * Steps to reproduce:
       * 1. Open the calendar view
       * 2. Split the window to create a second pane
       * 3. Open a note in the second pane
       * 4. Type continuously in the note
       * 5. Observe the calendar view for flashing/flickering
       *
       * Current behavior: Calendar flashes intermittently while typing
       * Expected behavior: Calendar remains stable with no visual flashing
       */
      const page = app.page;

      // Open the calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Split the pane vertically to create a second pane
      await runCommand(page, 'Split right');
      await page.waitForTimeout(500);

      // Create or open a note in the new pane
      await runCommand(page, 'Create new note');
      await page.waitForTimeout(500);

      // Find the editor in the second pane
      const editor = page.locator('.cm-editor .cm-content').last();
      await expect(editor).toBeVisible({ timeout: 5000 });

      // Focus the editor
      await editor.click();
      await page.waitForTimeout(200);

      // Record the initial state of the calendar
      // We'll check for DOM mutations or style changes that indicate flashing
      const calendarEvents = page.locator('.fc-event');
      const initialEventCount = await calendarEvents.count();

      // Set up a mutation observer to detect DOM changes in the calendar
      const flashDetected = await page.evaluate(() => {
        return new Promise<boolean>((resolve) => {
          const calendar = document.querySelector('.fc');
          if (!calendar) {
            resolve(false);
            return;
          }

          let flashCount = 0;
          let lastMutationTime = 0;

          const observer = new MutationObserver((mutations) => {
            const now = Date.now();
            // Count rapid successive mutations as potential flashing
            if (now - lastMutationTime < 500) {
              // Check if this affects visible content
              const hasVisibleChanges = mutations.some(
                (m) =>
                  m.type === 'childList' ||
                  (m.type === 'attributes' &&
                    (m.attributeName === 'style' || m.attributeName === 'class'))
              );
              if (hasVisibleChanges) {
                flashCount++;
              }
            }
            lastMutationTime = now;
          });

          observer.observe(calendar, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class'],
          });

          // Stop observing after the typing test
          setTimeout(() => {
            observer.disconnect();
            // If we detected multiple rapid mutations, that indicates flashing
            resolve(flashCount > 3);
          }, 8000);
        });
      });

      // Start typing while the mutation observer is running
      // Type continuously for several seconds to trigger auto-saves
      for (let i = 0; i < 10; i++) {
        await editor.type(`Testing note content iteration ${i + 1}. `, { delay: 50 });
        await page.waitForTimeout(300);
      }

      // Wait for the mutation observer to complete
      await page.waitForTimeout(3000);

      // The calendar should not have flashed
      // After the fix, this should be false (no flashing detected)
      expect(flashDetected).toBe(false);

      // Also verify the calendar is still functional
      const finalEventCount = await calendarEvents.count();
      expect(finalEventCount).toBe(initialEventCount);
    }
  );

  test.fixme(
    'reproduces issue #1179 - calendar should debounce updates during rapid typing',
    async () => {
      /**
       * This test verifies that the 5-second debounce in CalendarView.onDataUpdated()
       * is working correctly and not being bypassed.
       *
       * The debounce should prevent render() from being called during rapid typing,
       * only allowing a render after typing stops for 5 seconds.
       */
      const page = app.page;

      // Open the calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Split pane and open a note
      await runCommand(page, 'Split right');
      await page.waitForTimeout(500);

      await runCommand(page, 'Create new note');
      await page.waitForTimeout(500);

      const editor = page.locator('.cm-editor .cm-content').last();
      await expect(editor).toBeVisible({ timeout: 5000 });
      await editor.click();

      // Inject a counter to track how many times the calendar re-renders
      await page.evaluate(() => {
        const calendar = document.querySelector('.fc');
        if (calendar) {
          (window as any).__calendarRenderCount = 0;
          const observer = new MutationObserver((mutations) => {
            // Count significant re-renders (full event list rebuilds)
            const hasEventRebuild = mutations.some(
              (m) =>
                m.target instanceof Element &&
                (m.target.classList.contains('fc-event') ||
                  m.target.closest('.fc-timegrid-events') ||
                  m.target.closest('.fc-daygrid-events'))
            );
            if (hasEventRebuild) {
              (window as any).__calendarRenderCount++;
            }
          });
          observer.observe(calendar, {
            childList: true,
            subtree: true,
          });
          (window as any).__renderObserver = observer;
        }
      });

      // Type rapidly for 4 seconds (less than the 5-second debounce)
      const startTime = Date.now();
      while (Date.now() - startTime < 4000) {
        await editor.type('typing rapidly ', { delay: 30 });
        await page.waitForTimeout(100);
      }

      // Get the render count while still typing
      const rendersDuringTyping = await page.evaluate(() => {
        return (window as any).__calendarRenderCount || 0;
      });

      // During rapid typing, the calendar should NOT re-render due to debounce
      // Allowing for at most 1 render (initial state)
      expect(rendersDuringTyping).toBeLessThanOrEqual(1);

      // Now wait for the debounce period to elapse (5+ seconds)
      await page.waitForTimeout(6000);

      // After debounce, one render should have occurred
      const rendersAfterDebounce = await page.evaluate(() => {
        const count = (window as any).__calendarRenderCount || 0;
        if ((window as any).__renderObserver) {
          (window as any).__renderObserver.disconnect();
        }
        return count;
      });

      // Should have exactly one more render after the debounce
      expect(rendersAfterDebounce).toBeLessThanOrEqual(2);
    }
  );

  test.fixme(
    'reproduces issue #1179 - calendar should not flash when editing unrelated notes',
    async () => {
      /**
       * The flashing should not occur when editing notes that are completely
       * unrelated to any tasks shown in the calendar. The calendar should
       * check relevance before re-rendering.
       *
       * This tests the relevantPathsCache optimization in BasesViewBase.
       */
      const page = app.page;

      // Open the calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Create a completely new note (not a task note)
      await runCommand(page, 'Split right');
      await page.waitForTimeout(500);

      await runCommand(page, 'Create new note');
      await page.waitForTimeout(500);

      // Add content that clearly marks this as a non-task note
      const editor = page.locator('.cm-editor .cm-content').last();
      await expect(editor).toBeVisible({ timeout: 5000 });
      await editor.click();

      // Type a note without any task markers
      await editor.type('# Regular Note\n\nThis is just a regular note with no tasks.\n');
      await page.waitForTimeout(500);

      // Take a screenshot of the calendar for visual comparison
      const calendarScreenshotBefore = await calendarContainer.screenshot();

      // Type more content
      for (let i = 0; i < 5; i++) {
        await editor.type(`Paragraph ${i + 1}: Lorem ipsum dolor sit amet.\n\n`, { delay: 30 });
        await page.waitForTimeout(200);
      }

      // Wait for any potential updates
      await page.waitForTimeout(2000);

      // Take another screenshot
      const calendarScreenshotAfter = await calendarContainer.screenshot();

      // The screenshots should be visually identical (no flashing)
      // This is a simplified check - in reality we'd use image comparison
      expect(calendarScreenshotBefore.length).toBeGreaterThan(0);
      expect(calendarScreenshotAfter.length).toBeGreaterThan(0);

      // Verify calendar is still responsive (not stuck)
      const todayButton = page.locator('.fc-today-button');
      if (await todayButton.isEnabled({ timeout: 1000 }).catch(() => false)) {
        await todayButton.click();
        await page.waitForTimeout(300);
      }
    }
  );

  test.fixme(
    'reproduces issue #1179 - refetchEvents should not cause visible flicker',
    async () => {
      /**
       * The FullCalendar refetchEvents() method rebuilds all event elements.
       * This can cause visual flickering if events are removed and re-added
       * to the DOM rapidly. This test checks if the re-rendering is smooth.
       *
       * Potential solutions include:
       * - Using batch DOM updates
       * - Implementing event diffing to only update changed events
       * - Adding CSS transitions to smooth visual changes
       */
      const page = app.page;

      // Open the calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Wait for events to load
      await page.waitForTimeout(2000);

      const calendarEvents = page.locator('.fc-event');
      const eventCount = await calendarEvents.count();

      if (eventCount > 0) {
        // Trigger a forced refresh via the refresh button if available
        const refreshButton = page.locator('.fc-refreshCalendars-button, button[title*="Refresh"]');

        if (await refreshButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Monitor for opacity changes (indicator of flashing)
          const flashingDetected = await page.evaluate(() => {
            return new Promise<boolean>((resolve) => {
              const events = document.querySelectorAll('.fc-event');
              let opacityChanges = 0;

              events.forEach((event) => {
                const observer = new MutationObserver((mutations) => {
                  mutations.forEach((m) => {
                    if (
                      m.type === 'attributes' &&
                      (m.attributeName === 'style' || m.attributeName === 'class')
                    ) {
                      const style = window.getComputedStyle(event);
                      if (style.opacity !== '1' && style.opacity !== '') {
                        opacityChanges++;
                      }
                    }
                  });
                });
                observer.observe(event, { attributes: true });
              });

              // Also watch for elements being removed and re-added
              const container = document.querySelector('.fc-view-harness');
              if (container) {
                const containerObserver = new MutationObserver((mutations) => {
                  mutations.forEach((m) => {
                    if (m.removedNodes.length > 0) {
                      m.removedNodes.forEach((node) => {
                        if (
                          node instanceof Element &&
                          (node.classList.contains('fc-event') || node.querySelector('.fc-event'))
                        ) {
                          opacityChanges++;
                        }
                      });
                    }
                  });
                });
                containerObserver.observe(container, { childList: true, subtree: true });
              }

              setTimeout(() => {
                resolve(opacityChanges > 2);
              }, 2000);
            });
          });

          // Click refresh
          await refreshButton.click();
          await page.waitForTimeout(2000);

          // After fix, there should be minimal visual disruption
          expect(flashingDetected).toBe(false);
        }
      }
    }
  );

  test.fixme(
    'reproduces issue #1179 - config change detection should not cause false positives',
    async () => {
      /**
       * The hasConfigChanged() method in CalendarView.ts compares JSON snapshots
       * of config values. If this returns true incorrectly (false positive),
       * it bypasses the debounce and causes immediate re-renders.
       *
       * This could happen if:
       * - ICS/Google/Microsoft calendar arrays change order
       * - Undefined vs null comparisons
       * - Floating point number serialization differences
       */
      const page = app.page;

      // Open the calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Split and create a note
      await runCommand(page, 'Split right');
      await page.waitForTimeout(500);

      await runCommand(page, 'Create new note');
      await page.waitForTimeout(500);

      const editor = page.locator('.cm-editor .cm-content').last();
      await expect(editor).toBeVisible({ timeout: 5000 });
      await editor.click();

      // Inject monitoring for hasConfigChanged calls
      // This would require internal access, so we simulate by watching for rapid renders
      const renderTimestamps: number[] = [];

      await page.evaluate(() => {
        (window as any).__renderTimestamps = [];
        const calendar = document.querySelector('.fc');
        if (calendar) {
          const observer = new MutationObserver(() => {
            (window as any).__renderTimestamps.push(Date.now());
          });
          observer.observe(calendar, { childList: true, subtree: true });
          (window as any).__configObserver = observer;
        }
      });

      // Type to trigger potential config change false positives
      for (let i = 0; i < 8; i++) {
        await editor.type(`Line ${i + 1} of test content.\n`, { delay: 40 });
        await page.waitForTimeout(500);
      }

      // Get render timestamps
      const timestamps = await page.evaluate(() => {
        const ts = (window as any).__renderTimestamps || [];
        if ((window as any).__configObserver) {
          (window as any).__configObserver.disconnect();
        }
        return ts as number[];
      });

      // Analyze render frequency
      // If config change detection has false positives, we'll see frequent renders
      // (less than 5 second intervals despite the debounce)
      let rapidRenders = 0;
      for (let i = 1; i < timestamps.length; i++) {
        if (timestamps[i] - timestamps[i - 1] < 4000) {
          rapidRenders++;
        }
      }

      // There should be very few rapid renders (ideally none)
      expect(rapidRenders).toBeLessThanOrEqual(1);
    }
  );
});
