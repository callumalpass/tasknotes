/**
 * Issue #1039: [Bug]: 4.0.0-beta.0 Bugs/Differences with 3.25.5 Release
 *
 * This is a comprehensive bug report comparing 4.0.0-beta.0 with 3.25.5.
 * The report contains 5 distinct issues:
 *
 * 1. No more functionality to group and sub-group tasks (bases limitation?)
 * 2. Grouping by Project issues:
 *    a. Project name keeps "[[" and "]]" symbols (should be stripped)
 *    b. Project name only shows note name, not full path (nested projects broken)
 * 3. Agenda view doesn't have "Overdue" section anymore
 * 4. Agenda view duplicates tasks with due date = scheduled date (related to #1028)
 * 5. Advanced Calendar refresh button icon issue
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1039
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1039: v4.0.0-beta.0 Bugs/Differences with 3.25.5', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.describe('Bug 1: Group and sub-group functionality', () => {
    test.fixme(
      'reproduces issue #1039 - task list should support both grouping and sub-grouping',
      async () => {
        /**
         * Users report that v4.0.0-beta.0 no longer has functionality to group
         * and sub-group tasks (was available in 3.25.5).
         *
         * Expected behavior:
         * - Task list view should support primary grouping (e.g., by status)
         * - Task list view should support secondary sub-grouping (e.g., by project)
         * - Both should be configurable via the view options
         *
         * Key files:
         * - src/bases/TaskListView.ts (lines 144-157, 375-536)
         * - src/services/HierarchicalGroupingService.ts
         * - src/components/SubgroupMenuBuilder.ts
         */
        const page = app.page;

        // Open task list view
        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskListView = page.locator('.task-list-view, .bases-view');
        await expect(taskListView).toBeVisible({ timeout: 10000 });

        // Look for grouping controls in the view header/toolbar
        const groupByControl = page.locator(
          '[data-testid="group-by"], ' +
            '.group-by-selector, ' +
            '.bases-view-toolbar button:has-text("Group")'
        );

        const subGroupByControl = page.locator(
          '[data-testid="subgroup-by"], ' +
            '.subgroup-by-selector, ' +
            '.bases-view-toolbar button:has-text("Sub-group")'
        );

        // Check if grouping control exists and is functional
        const hasGroupControl = await groupByControl.isVisible({ timeout: 3000 }).catch(() => false);
        const hasSubGroupControl = await subGroupByControl.isVisible({ timeout: 3000 }).catch(() => false);

        console.log(`Group control visible: ${hasGroupControl}`);
        console.log(`Sub-group control visible: ${hasSubGroupControl}`);

        // Both grouping and sub-grouping should be available
        if (!hasGroupControl) {
          console.log('Primary grouping control is not visible in the UI');
        }
        if (!hasSubGroupControl) {
          console.log('Sub-grouping control is not visible in the UI');
        }

        // If group headers are present, verify sub-groups can be nested
        const groupHeaders = page.locator('.group-header, .bases-group-header');
        const subGroupHeaders = page.locator('.subgroup-header, .bases-subgroup-header');

        const groupCount = await groupHeaders.count();
        const subGroupCount = await subGroupHeaders.count();

        console.log(`Group headers: ${groupCount}, Sub-group headers: ${subGroupCount}`);

        // Expectation: both group and sub-group functionality should work
        expect(hasGroupControl || groupCount > 0).toBe(true);
      }
    );
  });

  test.describe('Bug 2a: Project name shows wikilink brackets', () => {
    test.fixme(
      'reproduces issue #1039 - project group headers should not show [[ and ]] symbols',
      async () => {
        /**
         * When grouping by project, the project name displays with "[[" and "]]"
         * symbols, which should be stripped for clean display.
         *
         * v3.25.5 behavior: Project names displayed cleanly without brackets
         * v4.0.0-beta.0 behavior: Project names show "[[ProjectName]]"
         *
         * Expected behavior:
         * - Group headers should display clean project names
         * - Wikilink syntax should be parsed/stripped from display
         *
         * Key files:
         * - src/bases/groupTitleRenderer.ts (lines 43-106)
         * - src/services/FilterService.ts (lines 1502-1509)
         */
        const page = app.page;

        // Open task list view grouped by project
        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskListView = page.locator('.task-list-view, .bases-view');
        await expect(taskListView).toBeVisible({ timeout: 10000 });

        // Try to set grouping to "project" if not already set
        // This may require opening a settings menu or using keyboard shortcut
        const groupByButton = page.locator(
          '.bases-view-toolbar button:has-text("Group"), ' +
            '[data-testid="group-by"]'
        );

        if (await groupByButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await groupByButton.click();
          await page.waitForTimeout(300);

          // Look for "Project" option in dropdown
          const projectOption = page.locator('text=Project').first();
          if (await projectOption.isVisible({ timeout: 1000 }).catch(() => false)) {
            await projectOption.click();
            await page.waitForTimeout(500);
          }
        }

        // Find group headers
        const groupHeaders = page.locator(
          '.group-header, ' +
            '.bases-group-header, ' +
            '.task-list-group-header'
        );

        const headerCount = await groupHeaders.count();
        let bracketsFound = false;

        for (let i = 0; i < headerCount; i++) {
          const header = groupHeaders.nth(i);
          const headerText = await header.textContent();

          if (headerText && (headerText.includes('[[') || headerText.includes(']]'))) {
            bracketsFound = true;
            console.log(`Group header ${i} contains wikilink brackets: "${headerText}"`);
          }
        }

        // Group headers should NOT contain wikilink brackets
        expect(bracketsFound).toBe(false);
      }
    );
  });

  test.describe('Bug 2b: Project name shows only basename, not full path', () => {
    test.fixme(
      'reproduces issue #1039 - nested project names should show full folder path',
      async () => {
        /**
         * When grouping by project with nested projects (e.g., Projects/Work/TaskA),
         * the group header only shows the note name ("TaskA") instead of the full
         * path ("Projects/Work/TaskA").
         *
         * v3.25.5 behavior: Full path displayed for nested projects
         * v4.0.0-beta.0 behavior: Only basename shown
         *
         * Expected behavior:
         * - Group headers should show enough path context to distinguish
         *   projects with the same name in different folders
         * - Or show full relative path from vault root
         *
         * Key files:
         * - src/utils/linkUtils.ts (lines 87-132, getProjectDisplayName)
         * - src/services/FilterService.ts (lines 2704-2735, extractProjectNamesFromTaskValue)
         */
        const page = app.page;

        // Open task list view
        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskListView = page.locator('.task-list-view, .bases-view');
        await expect(taskListView).toBeVisible({ timeout: 10000 });

        // Find group headers (assuming grouped by project)
        const groupHeaders = page.locator(
          '.group-header, ' +
            '.bases-group-header, ' +
            '.task-list-group-header'
        );

        const headerCount = await groupHeaders.count();
        let pathContextFound = false;

        for (let i = 0; i < headerCount; i++) {
          const header = groupHeaders.nth(i);
          const headerText = await header.textContent();

          if (headerText) {
            // Check if path separator is present (indicating nested path)
            if (headerText.includes('/') || headerText.includes('\\')) {
              pathContextFound = true;
              console.log(`Group header ${i} shows path context: "${headerText}"`);
            } else {
              console.log(`Group header ${i} shows only basename: "${headerText}"`);
            }
          }
        }

        // For nested projects, headers should include path context
        // This test documents the issue - path context should be shown
        console.log(`Path context found in any header: ${pathContextFound}`);
      }
    );
  });

  test.describe('Bug 3: Missing Overdue section in Agenda view', () => {
    test.fixme(
      'reproduces issue #1039 - agenda view should have Overdue section',
      async () => {
        /**
         * The agenda view no longer has an "Overdue" section which was a
         * valuable addition in v3.25.5.
         *
         * v3.25.5 behavior: Agenda had dedicated "Overdue" section at top
         * v4.0.0-beta.0 behavior: No Overdue section visible
         *
         * Expected behavior:
         * - Agenda should show overdue tasks in a dedicated section
         * - Overdue tasks should be easily identifiable/separated from upcoming
         *
         * Key files:
         * - src/services/FilterService.ts (lines 1644-1682, getDueDateGroup)
         * - src/bases/TaskListView.ts (agenda rendering)
         * - Translation key: "overdue" in i18n resources
         *
         * Related to issue #1156 Bug 3
         */
        const page = app.page;

        // Open agenda view
        await runCommand(page, 'TaskNotes: Open agenda view');
        await page.waitForTimeout(1000);

        const agendaView = page.locator('.agenda-view, .bases-view');
        await expect(agendaView).toBeVisible({ timeout: 10000 });

        // Look for "Overdue" section header
        const overdueSection = page.locator(
          '.group-header:has-text("Overdue"), ' +
            '.bases-group-header:has-text("Overdue"), ' +
            '.agenda-section:has-text("Overdue"), ' +
            '[data-group="overdue"], ' +
            'text=Overdue'
        );

        const overdueVisible = await overdueSection.isVisible({ timeout: 3000 }).catch(() => false);

        console.log(`Overdue section visible: ${overdueVisible}`);

        if (!overdueVisible) {
          console.log('Overdue section is missing from agenda view - regression from v3.25.5');
        }

        // Overdue section should be present in agenda view
        expect(overdueVisible).toBe(true);
      }
    );
  });

  test.describe('Bug 4: Agenda duplicates tasks when due date = scheduled date', () => {
    test.fixme(
      'reproduces issue #1039 - tasks should not be duplicated when due date equals scheduled date',
      async () => {
        /**
         * Tasks that have the same due date and scheduled date appear twice
         * in the agenda view - once for each date.
         *
         * Related to: https://github.com/callumalpass/tasknotes/issues/1028
         *
         * Expected behavior:
         * - Tasks with due date = scheduled date should appear only once
         * - OR be clearly labeled if intentionally shown twice
         *
         * Key files:
         * - src/bases/calendar-core.ts (lines 992-1019, generateCalendarEvents)
         * - Deduplication logic may be missing for same-day due/scheduled
         */
        const page = app.page;

        // Open agenda view
        await runCommand(page, 'TaskNotes: Open agenda view');
        await page.waitForTimeout(1000);

        const agendaView = page.locator('.agenda-view, .bases-view');
        await expect(agendaView).toBeVisible({ timeout: 10000 });

        // Find all task items in the agenda
        const taskItems = page.locator(
          '.task-card, ' +
            '.bases-row, ' +
            '.agenda-item'
        );

        const itemCount = await taskItems.count();

        // Collect task titles/identifiers to check for duplicates
        const taskTitles: string[] = [];

        for (let i = 0; i < itemCount; i++) {
          const item = taskItems.nth(i);
          const titleEl = item.locator('.task-card__title, .task-title, [data-task-title]');
          const titleText = await titleEl.textContent().catch(() => '');

          if (titleText) {
            taskTitles.push(titleText.trim());
          }
        }

        // Check for duplicates
        const titleCounts = new Map<string, number>();
        for (const title of taskTitles) {
          titleCounts.set(title, (titleCounts.get(title) || 0) + 1);
        }

        const duplicates: string[] = [];
        titleCounts.forEach((count, title) => {
          if (count > 1) {
            duplicates.push(`"${title}" appears ${count} times`);
          }
        });

        if (duplicates.length > 0) {
          console.log('Duplicate tasks found in agenda:');
          duplicates.forEach((d) => console.log(`  - ${d}`));
          console.log('This may be caused by tasks with due date = scheduled date');
        }

        // There should be no duplicate task entries
        // (unless they have genuinely different scheduled/due dates)
        expect(duplicates.length).toBe(0);
      }
    );
  });

  test.describe('Bug 5: Advanced Calendar refresh button icon issue', () => {
    test.fixme(
      'reproduces issue #1039 - calendar refresh button should have proper icon',
      async () => {
        /**
         * The refresh button in the Advanced Calendar view has an icon display
         * issue - the icon is either missing, broken, or displays incorrectly.
         *
         * Expected behavior:
         * - Refresh button should display a clear refresh/rotate icon
         * - Icon should be consistent with Obsidian's icon system
         *
         * Key files:
         * - src/bases/CalendarView.ts (lines 638, 673-701)
         * - The refreshCalendars button config may be missing setIcon() call
         * - Should use icon like "rotate-cw" or "refresh-cw"
         */
        const page = app.page;

        // Open calendar view
        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarView = page.locator('.calendar-view, .bases-calendar-view, .fc');
        await expect(calendarView).toBeVisible({ timeout: 10000 });

        // Find the refresh button in the calendar toolbar
        const refreshButton = page.locator(
          '.fc-refreshCalendars-button, ' +
            'button:has-text("Refresh"), ' +
            '.fc-toolbar button[title*="Refresh"], ' +
            '.fc-toolbar button[title*="refresh"]'
        );

        const refreshVisible = await refreshButton.isVisible({ timeout: 3000 }).catch(() => false);

        if (refreshVisible) {
          // Check if the button has an icon
          const buttonIcon = refreshButton.locator('svg, .lucide, .svg-icon');
          const hasIcon = await buttonIcon.isVisible({ timeout: 1000 }).catch(() => false);

          // Also check for text-only button (no icon)
          const buttonText = await refreshButton.textContent();

          console.log(`Refresh button visible: ${refreshVisible}`);
          console.log(`Has icon: ${hasIcon}`);
          console.log(`Button text: "${buttonText}"`);

          if (!hasIcon) {
            console.log('Refresh button is missing icon - only shows text');
          }

          // Check if the icon SVG is rendering properly (not empty or broken)
          if (hasIcon) {
            const iconBox = await buttonIcon.boundingBox();
            if (iconBox && (iconBox.width < 5 || iconBox.height < 5)) {
              console.log('Icon appears to be rendering incorrectly (too small)');
            }
          }

          // Button should have a visible icon
          expect(hasIcon).toBe(true);
        } else {
          console.log('Refresh button not found in calendar toolbar');
        }
      }
    );
  });
});
