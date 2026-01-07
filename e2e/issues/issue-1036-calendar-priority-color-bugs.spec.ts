/**
 * Issue #1036: [Bug]: Strange Priority Behaviour in Bases Calendar View (beta 4.0)
 *
 * Bug Description:
 * Multiple priority-related color issues in the calendar view:
 *
 * 1. YAML-defined priorities not recognized:
 *    - When priority is set manually in YAML frontmatter, TaskNotes does not recognize
 *      it as having that priority for coloring purposes
 *    - The task shows default color instead of the priority-specific color
 *    - Due events show correct border/outline color but wrong fill color
 *    - When changed back to default priority, due date retains the old color (stale state)
 *
 * 2. Due dates not draggable (reported but needs verification):
 *    - User reports due dates cannot be dragged like scheduled dates
 *    - Code shows editable: true for due events, so this may be a UI feedback issue
 *
 * 3. UI-set priority color inconsistencies:
 *    - Even when priority is added via UI, sometimes displays strange coloration
 *
 * Root cause analysis:
 * - PriorityManager.getPriorityConfig() looks up priority by exact string value match
 * - If the YAML-defined priority value doesn't exactly match a configured priority value,
 *   no config is found and fallback CSS variables are used
 * - hexToRgba() cannot convert CSS variables like "var(--color-orange)" to RGBA,
 *   so it returns them unchanged - causing fill colors to not be faded properly
 * - The due event's backgroundColor becomes the full CSS variable instead of
 *   a 15% opacity version, creating visual inconsistency
 *
 * Key files:
 * - src/bases/calendar-core.ts (createDueEvent, createScheduledEvent, hexToRgba)
 * - src/services/PriorityManager.ts (getPriorityConfig)
 * - src/services/FieldMapper.ts (maps frontmatter to TaskInfo.priority)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1036
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1036: Strange Priority Behaviour in Calendar View', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.describe('Bug 1: YAML-defined priority colors not recognized', () => {
    test.fixme(
      'reproduces issue #1036 - YAML priority should produce same color as UI-set priority',
      async () => {
        /**
         * This test verifies that tasks with priority set via YAML frontmatter
         * display the same colors as tasks with priority set via the UI.
         *
         * Expected behavior:
         * - A task with `priority: high` in YAML should show the same colors
         *   as a task where "high" priority was set via the TaskNotes UI
         *
         * Current behavior (bug):
         * - YAML-defined priorities may not match configured priority values exactly
         * - This causes getPriorityConfig() to return undefined
         * - Fallback CSS variables are used instead of the priority color
         */
        const page = app.page;

        // Open calendar view
        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1500);

        const calendarView = page.locator('.fc, .bases-calendar-view');
        await expect(calendarView).toBeVisible({ timeout: 10000 });

        // Look for scheduled events with different priorities
        const scheduledEvents = page.locator('.fc-event[data-event-type="scheduled"]');
        const eventCount = await scheduledEvents.count();

        if (eventCount > 0) {
          // Get border colors of all events to check for consistency
          const eventColors: { title: string; borderColor: string; backgroundColor: string }[] = [];

          for (let i = 0; i < Math.min(eventCount, 5); i++) {
            const event = scheduledEvents.nth(i);
            const colors = await event.evaluate((el) => {
              const computed = window.getComputedStyle(el);
              return {
                title: el.querySelector('.fc-event-title')?.textContent || 'Unknown',
                borderColor: computed.borderColor || computed.borderLeftColor,
                backgroundColor: computed.backgroundColor,
              };
            });
            eventColors.push(colors);
          }

          console.log('Event colors:', JSON.stringify(eventColors, null, 2));

          // Tasks with the same priority should have the same border color
          // regardless of whether priority was set via YAML or UI
        }

        await page.keyboard.press('Escape');
      }
    );

    test.fixme(
      'reproduces issue #1036 - due event fill color should be faded version of border color',
      async () => {
        /**
         * This test verifies that due events have properly faded background colors.
         *
         * Expected behavior:
         * - Due event backgroundColor should be a 15% opacity version of borderColor
         * - Both border and background should derive from priority color
         *
         * Current behavior (bug):
         * - When priority falls back to CSS variable (e.g., "var(--color-orange)"),
         *   hexToRgba() cannot convert it and returns the variable unchanged
         * - This causes backgroundColor to be the full color instead of faded
         * - Visual inconsistency between scheduled (transparent bg) and due events
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1500);

        const calendarView = page.locator('.fc, .bases-calendar-view');
        await expect(calendarView).toBeVisible({ timeout: 10000 });

        // Find due events (they have "DUE:" prefix in title)
        const dueEvents = page.locator('.fc-event').filter({ hasText: 'DUE:' });
        const dueCount = await dueEvents.count();

        if (dueCount > 0) {
          const dueEvent = dueEvents.first();
          const colors = await dueEvent.evaluate((el) => {
            const computed = window.getComputedStyle(el);
            return {
              borderColor: computed.borderColor || computed.borderLeftColor,
              backgroundColor: computed.backgroundColor,
            };
          });

          console.log('Due event colors:', JSON.stringify(colors, null, 2));

          // Check if backgroundColor is a faded version of borderColor
          // The background should be rgba with ~0.15 alpha
          const bgIsRgba = colors.backgroundColor.startsWith('rgba');
          const bgHasLowAlpha = colors.backgroundColor.includes('0.15') ||
            colors.backgroundColor.includes('0.2') ||
            // Check for very low opacity values
            /rgba\(\d+,\s*\d+,\s*\d+,\s*0\.[012]\d*\)/.test(colors.backgroundColor);

          // If background is not a proper faded color, the bug is present
          if (!bgIsRgba || !bgHasLowAlpha) {
            console.log('Bug detected: backgroundColor is not a proper faded version of border');
            console.log(`  Expected: rgba(r, g, b, 0.15) based on borderColor`);
            console.log(`  Got: ${colors.backgroundColor}`);
          }

          // After fix: background should be a faded version of the border color
          expect(bgIsRgba).toBe(true);
        } else {
          console.log('No due events found in calendar - create a task with due date to test');
        }

        await page.keyboard.press('Escape');
      }
    );

    test.fixme(
      'reproduces issue #1036 - priority color should not persist after changing to default',
      async () => {
        /**
         * This test verifies that color updates correctly when priority changes.
         *
         * Expected behavior:
         * - When a task's priority is changed, all colors should update immediately
         * - Changing from "high" to "normal" should use "normal" priority colors
         *
         * Current behavior (bug):
         * - When changing back to default priority, due date retains old color
         * - Stale color state persists until some trigger causes re-render
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1500);

        const calendarView = page.locator('.fc, .bases-calendar-view');
        await expect(calendarView).toBeVisible({ timeout: 10000 });

        // This test would require:
        // 1. Creating a task with a specific priority
        // 2. Noting the due event colors
        // 3. Changing the priority
        // 4. Verifying colors updated correctly

        // For now, document the expected behavior
        console.log('Test requires task creation and priority modification');
        console.log('Bug: Stale color state after priority change');

        await page.keyboard.press('Escape');
      }
    );
  });

  test.describe('Bug 2: Due dates draggability', () => {
    test.fixme(
      'reproduces issue #1036 - due dates should be draggable like scheduled dates',
      async () => {
        /**
         * This test verifies that due events can be dragged to reschedule.
         *
         * Expected behavior:
         * - Due events should be draggable (editable: true in createDueEvent)
         * - Dragging a due event should update the task's due date
         * - Visual feedback should indicate the event is draggable
         *
         * Note: Code analysis shows due events have editable: true, so this may
         * be a UI feedback issue or specific edge case rather than missing feature.
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1500);

        const calendarView = page.locator('.fc, .bases-calendar-view');
        await expect(calendarView).toBeVisible({ timeout: 10000 });

        // Find a due event
        const dueEvents = page.locator('.fc-event').filter({ hasText: 'DUE:' });
        const dueCount = await dueEvents.count();

        if (dueCount > 0) {
          const dueEvent = dueEvents.first();

          // Check if the event has draggable attributes
          const isDraggable = await dueEvent.evaluate((el) => {
            // FullCalendar adds specific classes/attributes for draggable events
            const hasEditableClass = el.classList.contains('fc-event-draggable');
            const cursorStyle = window.getComputedStyle(el).cursor;
            return {
              hasEditableClass,
              cursor: cursorStyle,
              isDraggableLooking: hasEditableClass || cursorStyle === 'pointer' || cursorStyle === 'grab',
            };
          });

          console.log('Due event draggability:', JSON.stringify(isDraggable, null, 2));

          // Due events should be draggable
          expect(isDraggable.isDraggableLooking).toBe(true);
        } else {
          console.log('No due events found - create a task with due date to test draggability');
        }

        await page.keyboard.press('Escape');
      }
    );

    test.fixme(
      'reproduces issue #1036 - verify due event drag operation updates frontmatter',
      async () => {
        /**
         * This test verifies that dragging a due event actually updates the task.
         *
         * Expected behavior:
         * - After dragging a due event, the task's due date in frontmatter should update
         * - The calendar should refresh to show the new position
         *
         * Current behavior (reported):
         * - User reports due dates cannot be dragged
         * - Need to verify if this is drag initiation, visual feedback, or update issue
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1500);

        // This test would need to:
        // 1. Find a due event
        // 2. Get its current date/position
        // 3. Perform drag operation
        // 4. Verify the task's due date was updated

        console.log('Test requires drag simulation and file verification');
        console.log('handleEventDrop in CalendarView.ts handles both scheduled and due events');

        await page.keyboard.press('Escape');
      }
    );
  });

  test.describe('Bug 3: Intermittent UI priority color issues', () => {
    test.fixme(
      'reproduces issue #1036 - UI-set priority should consistently apply correct colors',
      async () => {
        /**
         * This test verifies that setting priority via UI always produces correct colors.
         *
         * Expected behavior:
         * - Setting priority via TaskNotes UI should always apply the correct color
         * - Color should be consistent across all calendar event types
         *
         * Current behavior (bug):
         * - Even when priority is added via UI, sometimes shows strange colors
         * - This suggests a timing/state update issue beyond just YAML parsing
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1500);

        const calendarView = page.locator('.fc, .bases-calendar-view');
        await expect(calendarView).toBeVisible({ timeout: 10000 });

        // Get all scheduled events
        const scheduledEvents = page.locator('.fc-event:not(:has-text("DUE:"))');
        const eventCount = await scheduledEvents.count();

        const colorInconsistencies: string[] = [];

        for (let i = 0; i < eventCount; i++) {
          const event = scheduledEvents.nth(i);
          const eventInfo = await event.evaluate((el) => {
            const computed = window.getComputedStyle(el);
            return {
              title: el.querySelector('.fc-event-title')?.textContent || 'Unknown',
              borderColor: computed.borderColor || computed.borderLeftColor,
              backgroundColor: computed.backgroundColor,
              // Check for CSS variable in inline style (indicates fallback)
              usesVariableFallback:
                el.getAttribute('style')?.includes('var(--') || false,
            };
          });

          if (eventInfo.usesVariableFallback) {
            colorInconsistencies.push(
              `${eventInfo.title}: Uses CSS variable fallback (may indicate priority not recognized)`
            );
          }

          // Check if border color is a CSS variable (should be converted to hex)
          if (eventInfo.borderColor.includes('var(')) {
            colorInconsistencies.push(
              `${eventInfo.title}: Border still contains CSS variable`
            );
          }
        }

        if (colorInconsistencies.length > 0) {
          console.log('Color inconsistencies found:');
          colorInconsistencies.forEach((issue) => console.log(`  - ${issue}`));
        }

        // After fix: no events should use CSS variable fallbacks when they have priority set
        expect(colorInconsistencies.length).toBe(0);

        await page.keyboard.press('Escape');
      }
    );
  });

  test.describe('Technical verification', () => {
    test.fixme(
      'reproduces issue #1036 - hexToRgba should handle CSS variables gracefully',
      async () => {
        /**
         * This test documents the technical issue with hexToRgba.
         *
         * The hexToRgba function in calendar-core.ts (line 78) cannot convert
         * CSS variables to RGBA format:
         *
         * ```typescript
         * if (hex.startsWith("var(")) {
         *   return hex; // Returns unchanged
         * }
         * ```
         *
         * This means when priority falls back to "var(--color-orange)", the
         * call to hexToRgba(borderColor, 0.15) returns "var(--color-orange)"
         * instead of an RGBA color with 15% opacity.
         *
         * Potential fixes:
         * 1. Compute the CSS variable value at runtime and convert
         * 2. Use color-mix() CSS function for transparency
         * 3. Define faded CSS variables for fallbacks (--color-orange-faded)
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1500);

        // Find due events to check their background colors
        const dueEvents = page.locator('.fc-event').filter({ hasText: 'DUE:' });

        if ((await dueEvents.count()) > 0) {
          const dueEvent = dueEvents.first();

          // Get the actual CSS applied
          const cssAnalysis = await dueEvent.evaluate((el) => {
            const htmlEl = el as HTMLElement;
            const computed = window.getComputedStyle(el);

            return {
              // Inline styles (set by FullCalendar from our event object)
              inlineStyle: htmlEl.getAttribute('style'),
              // Computed values
              computedBg: computed.backgroundColor,
              computedBorder: computed.borderColor,
              // Check if CSS variable is being used directly
              bgContainsVar: computed.backgroundColor.includes('var('),
            };
          });

          console.log('CSS Analysis:', JSON.stringify(cssAnalysis, null, 2));

          // If inline style contains a CSS variable for background,
          // that indicates hexToRgba returned the variable unchanged
          if (cssAnalysis.inlineStyle?.includes('var(--color')) {
            console.log('Bug confirmed: CSS variable used directly in inline style');
            console.log('hexToRgba returned the variable unchanged instead of converting');
          }
        }

        await page.keyboard.press('Escape');
      }
    );

    test.fixme(
      'reproduces issue #1036 - verify PriorityManager lookup with various priority values',
      async () => {
        /**
         * This test documents how priority values might not match.
         *
         * PriorityManager.getPriorityConfig() uses exact string matching:
         * ```typescript
         * return this.priorities.find((p) => p.value === value);
         * ```
         *
         * If YAML contains `priority: High` but config has value: "high",
         * the lookup fails due to case sensitivity.
         *
         * Potential mismatches:
         * - Case differences: "High" vs "high"
         * - Whitespace: " high" vs "high"
         * - Unicode: different quote characters
         * - Localized values vs internal values
         */
        const page = app.page;

        // This test would require examining the plugin's priority configuration
        // and comparing it to YAML frontmatter values

        console.log('Priority matching is case-sensitive and exact');
        console.log('YAML value must exactly match configured priority value');
        console.log('No normalization is performed before lookup');

        // The fix could involve:
        // 1. Case-insensitive matching
        // 2. Trimming whitespace
        // 3. Fuzzy matching or suggestions
        // 4. Better error handling when priority not found
      }
    );
  });
});
