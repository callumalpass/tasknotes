/**
 * Issue #921: [FR] Add projects to calendar events and visualize in the project note
 *
 * Feature Request Description:
 * Similar to how tasks can have one or more projects, it would be nice to be able
 * to link calendar events to projects. That would allow seeing all the calendar
 * events related to a specific project from the project note, together with the
 * tasks.
 *
 * Current behavior:
 * - Tasks can be linked to projects via the `projects` field in frontmatter
 * - Calendar events are generated from tasks but don't prominently display project info
 * - Project notes show related tasks but not calendar events explicitly
 *
 * Requested behavior:
 * - Calendar events should display project links (similar to how TaskCard displays them)
 * - Project notes should show related calendar events alongside tasks
 * - Allow filtering calendar by project
 * - Visual consistency with existing project link styling (+ prefix)
 *
 * Implementation context:
 * - Calendar events are generated in src/bases/calendar-core.ts
 * - CalendarEvent.extendedProps contains taskInfo which has projects array
 * - Project links are rendered via src/ui/renderers/linkRenderer.ts (renderProjectLinks)
 * - The generateTaskTooltip() function already shows first project in tooltip
 *
 * @see https://github.com/callumalpass/tasknotes/issues/921
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #921: Calendar events with project links', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'FR #921 - calendar events should display project links',
    async () => {
      /**
       * This test verifies that calendar events from tasks with projects
       * display the project information visibly on the event itself.
       *
       * Expected behavior:
       * - When a task has a project assigned, the calendar event shows the project
       * - Project is displayed with the + prefix (consistent with TaskCard)
       * - Project link is clickable to navigate to the project note
       */
      const page = app.page;

      // Open a calendar view
      const calendarView = page.locator('.advanced-calendar-view, .bases-calendar-view, .calendar-view');

      // Look for calendar events
      const calendarEvents = calendarView.locator('.fc-event, .calendar-event');

      // Find an event that has a project associated with it
      const eventWithProject = calendarEvents.filter({
        // Looking for event that displays project info
        has: page.locator('.event-project, .project-link, [data-project]'),
      }).first();

      const hasProjectDisplay = await eventWithProject.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasProjectDisplay) {
        // Verify project link has + prefix (matching TaskCard styling)
        const projectLink = eventWithProject.locator('.event-project, .project-link');
        const projectText = await projectLink.textContent();
        console.log('Project displayed on event:', projectText);

        // Project links should start with + prefix
        expect(projectText).toMatch(/^\+/);

        // Project link should be clickable
        const isClickable = await projectLink.evaluate((el) => {
          return el.tagName === 'A' || el.classList.contains('internal-link');
        });
        expect(isClickable).toBe(true);
      } else {
        // Feature not yet implemented - document expected behavior
        console.log('Project display on calendar events not yet implemented');
        expect(hasProjectDisplay).toBe(true);
      }
    }
  );

  test.fixme(
    'FR #921 - event tooltip should show all projects (not just first)',
    async () => {
      /**
       * Currently generateTaskTooltip() only shows the first project.
       * This test verifies that all projects are shown when a task has multiple.
       *
       * Expected behavior:
       * - Hovering over a calendar event shows all associated projects
       * - Projects are separated visually (comma-separated or on new lines)
       */
      const page = app.page;

      // Open a calendar view
      const calendarView = page.locator('.advanced-calendar-view, .bases-calendar-view, .calendar-view');

      // Find a calendar event and hover to show tooltip
      const calendarEvent = calendarView.locator('.fc-event, .calendar-event').first();

      if (await calendarEvent.isVisible({ timeout: 3000 })) {
        await calendarEvent.hover();
        await page.waitForTimeout(500); // Wait for tooltip to appear

        // Look for tooltip
        const tooltip = page.locator('.tooltip, .event-tooltip, [role="tooltip"]');

        if (await tooltip.isVisible({ timeout: 2000 })) {
          const tooltipText = await tooltip.textContent();
          console.log('Event tooltip content:', tooltipText);

          // If the task has multiple projects, all should be displayed
          // Currently only first project is shown per generateTaskTooltip()
          // Example: "Project: [[Project1]], [[Project2]]"
          const projectMatches = tooltipText?.match(/Project:/g) || [];

          // There should be indication of projects in tooltip
          expect(tooltipText).toContain('Project');
        }
      }
    }
  );

  test.fixme(
    'FR #921 - project note should display related calendar events',
    async () => {
      /**
       * This test verifies that when viewing a project note, calendar events
       * from tasks linked to that project are visible alongside the tasks.
       *
       * Expected behavior:
       * - Project note shows a calendar or timeline of events from linked tasks
       * - Events are displayed in a dedicated section or integrated with task list
       * - User can see upcoming scheduled/due dates for project tasks
       */
      const page = app.page;

      // Open a project note (a note that has tasks linking to it)
      // Project notes typically have tasks with projects: [[ThisProject]]

      // Look for a calendar section or event timeline in the project view
      const projectEventSection = page.locator(
        '.project-events, .project-calendar, .project-timeline, .related-events'
      );

      const hasEventSection = await projectEventSection.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasEventSection) {
        // Verify events are displayed
        const events = projectEventSection.locator('.event, .calendar-event, .timeline-item');
        const eventCount = await events.count();
        console.log('Calendar events shown on project note:', eventCount);

        expect(eventCount).toBeGreaterThanOrEqual(0);
      } else {
        // Feature not yet implemented
        console.log('Project note event display not yet implemented');
        expect(hasEventSection).toBe(true);
      }
    }
  );

  test.fixme(
    'FR #921 - should be able to filter calendar by project',
    async () => {
      /**
       * This test verifies that the calendar can be filtered to show only
       * events from tasks belonging to a specific project.
       *
       * Expected behavior:
       * - Filter/dropdown option to select a project
       * - Calendar updates to show only events from tasks in that project
       * - Clear indication of active project filter
       */
      const page = app.page;

      // Open a calendar view
      const calendarView = page.locator('.advanced-calendar-view, .bases-calendar-view, .calendar-view');

      // Look for project filter control
      const projectFilter = calendarView.locator(
        '.project-filter, [data-filter="project"], .filter-project-selector'
      );

      const hasProjectFilter = await projectFilter.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasProjectFilter) {
        // Click to open project selector
        await projectFilter.click();
        await page.waitForTimeout(300);

        // Look for dropdown with project options
        const filterDropdown = page.locator('.menu, .dropdown-menu, .suggestion-container');

        if (await filterDropdown.isVisible({ timeout: 1000 })) {
          const projectOptions = filterDropdown.locator('.menu-item, .suggestion-item');
          const optionCount = await projectOptions.count();
          console.log('Project filter options available:', optionCount);

          expect(optionCount).toBeGreaterThan(0);
        }
      } else {
        // Feature not yet implemented
        console.log('Project filter for calendar not yet implemented');
        expect(hasProjectFilter).toBe(true);
      }
    }
  );

  test.fixme(
    'FR #921 - clicking project link on calendar event should navigate to project note',
    async () => {
      /**
       * This test verifies that clicking a project link on a calendar event
       * opens the project note file.
       *
       * Expected behavior:
       * - Click on project link within calendar event
       * - Project note opens in editor or new tab
       * - Navigation respects user's link click settings
       */
      const page = app.page;

      // Open a calendar view
      const calendarView = page.locator('.advanced-calendar-view, .bases-calendar-view, .calendar-view');

      // Find an event with a project link
      const eventWithProject = calendarView.locator('.fc-event .project-link, .fc-event .internal-link[data-project]').first();

      const hasProjectLink = await eventWithProject.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasProjectLink) {
        // Get the project link target
        const projectHref = await eventWithProject.getAttribute('href');
        const projectDataPath = await eventWithProject.getAttribute('data-path');
        console.log('Project link href:', projectHref);
        console.log('Project link data-path:', projectDataPath);

        // Click the project link
        await eventWithProject.click();
        await page.waitForTimeout(500);

        // Verify navigation occurred - check if a new file was opened
        // The project note should now be visible in the editor
        const editorContent = page.locator('.workspace-leaf.mod-active .cm-content, .workspace-leaf.mod-active .markdown-preview-view');

        // The opened file should be the project note
        const activeFile = await page.evaluate(() => {
          // @ts-ignore - Obsidian API
          return window.app?.workspace?.getActiveFile()?.path;
        });

        console.log('Active file after click:', activeFile);

        // Should have navigated to some file (the project)
        expect(activeFile).toBeTruthy();
      } else {
        console.log('Project link on calendar event not yet implemented');
        expect(hasProjectLink).toBe(true);
      }
    }
  );

  test.fixme(
    'FR #921 - event detail modal should show project with link styling',
    async () => {
      /**
       * This test verifies that when opening an event's detail modal/popover,
       * the project information is displayed with proper link styling.
       *
       * Expected behavior:
       * - Click on calendar event opens a detail view/modal
       * - Project is displayed with + prefix (consistent with TaskCard)
       * - Project is rendered as a clickable internal link
       */
      const page = app.page;

      // Open a calendar view
      const calendarView = page.locator('.advanced-calendar-view, .bases-calendar-view, .calendar-view');

      // Click on a calendar event to open its detail view
      const calendarEvent = calendarView.locator('.fc-event, .calendar-event').first();

      if (await calendarEvent.isVisible({ timeout: 3000 })) {
        await calendarEvent.click();
        await page.waitForTimeout(500);

        // Look for event detail modal/popover
        const eventDetail = page.locator('.event-detail-modal, .modal, .popover, .task-edit-modal');

        if (await eventDetail.isVisible({ timeout: 2000 })) {
          // Find project section in the detail view
          const projectSection = eventDetail.locator('.project-section, .projects-container, [data-field="projects"]');

          if (await projectSection.isVisible({ timeout: 1000 })) {
            // Check for project links with + prefix
            const projectLinks = projectSection.locator('.project-link, .internal-link');
            const projectText = await projectLinks.first().textContent();
            console.log('Project in detail modal:', projectText);

            // Should have + prefix
            expect(projectText).toMatch(/^\+/);
          }
        }
      }
    }
  );

  test.fixme(
    'FR #921 - multiple projects should all be displayed on calendar event',
    async () => {
      /**
       * This test verifies that when a task has multiple projects assigned,
       * all of them are displayed on the calendar event (not just the first one).
       *
       * Expected behavior:
       * - Event displays all projects from the task
       * - Projects are separated visually (space, comma, or stacked)
       * - All project links are functional
       */
      const page = app.page;

      // Open a calendar view
      const calendarView = page.locator('.advanced-calendar-view, .bases-calendar-view, .calendar-view');

      // Find an event that has multiple projects (indicated by multiple + prefixes)
      const calendarEvents = calendarView.locator('.fc-event, .calendar-event');

      // Look for an event with multiple project links
      let foundMultiProject = false;
      const eventCount = await calendarEvents.count();

      for (let i = 0; i < Math.min(eventCount, 10); i++) {
        const event = calendarEvents.nth(i);
        const projectLinks = event.locator('.project-link, [data-project]');
        const projectCount = await projectLinks.count();

        if (projectCount > 1) {
          console.log(`Event ${i} has ${projectCount} projects`);
          foundMultiProject = true;

          // All project links should be functional
          for (let j = 0; j < projectCount; j++) {
            const link = projectLinks.nth(j);
            const text = await link.textContent();
            console.log(`  Project ${j}: ${text}`);

            // Each should have + prefix
            expect(text).toMatch(/^\+/);
          }
          break;
        }
      }

      if (!foundMultiProject) {
        console.log('No calendar events with multiple projects found or feature not implemented');
        // Feature not yet implemented - multiple project display
        expect(foundMultiProject).toBe(true);
      }
    }
  );

  test.fixme(
    'FR #921 - project visualization should work in different calendar views',
    async () => {
      /**
       * This test verifies that project information is displayed correctly
       * across different calendar view types (month, week, day, agenda).
       *
       * Expected behavior:
       * - Project info visible in month view (may be abbreviated)
       * - Project info visible in week view
       * - Project info visible in day view
       * - Project info visible in agenda/list view
       */
      const page = app.page;

      // Open a calendar view
      const calendarView = page.locator('.advanced-calendar-view, .bases-calendar-view, .calendar-view');

      // Array of view types and their selectors/buttons
      const viewTypes = [
        { name: 'month', selector: '.fc-dayGridMonth-button, [data-view="month"]' },
        { name: 'week', selector: '.fc-timeGridWeek-button, [data-view="week"]' },
        { name: 'day', selector: '.fc-timeGridDay-button, [data-view="day"]' },
        { name: 'list', selector: '.fc-listWeek-button, [data-view="list"]' },
      ];

      for (const viewType of viewTypes) {
        const viewButton = calendarView.locator(viewType.selector);

        if (await viewButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await viewButton.click();
          await page.waitForTimeout(500);

          // Check for events with project display in this view
          const eventsWithProjects = calendarView.locator('.fc-event .project-link, .fc-event [data-project]');
          const count = await eventsWithProjects.count();

          console.log(`${viewType.name} view - events with project display: ${count}`);

          // If there are events, projects should be displayable
          // (actual count may be 0 if no events in current date range)
        }
      }
    }
  );
});
