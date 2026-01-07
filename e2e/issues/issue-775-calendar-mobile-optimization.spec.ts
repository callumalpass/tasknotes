/**
 * Issue #775: [FR] Calendar needs some work on Mobile
 *
 * Feature request description:
 * The calendar views are not well optimized for mobile use. Many buttons are
 * small or go off the screen which makes navigating around difficult. The user
 * reports that opening and editing tasks is also difficult on mobile.
 *
 * Key issues identified:
 * 1. Navigation and view mode buttons are too small for touch targets (should be 44x44px)
 * 2. View mode selector buttons (Y, M, W, 3D, D, L) are cramped and hard to tap
 * 3. Task badges are truncated to unreadable single characters on narrow viewports
 * 4. Calendar header and controls don't adapt well to narrow screens
 * 5. Overall touch interaction is not mobile-native feeling
 *
 * @see https://github.com/callumalpass/tasknotes/discussions/762
 * @see https://github.com/callumalpass/tasknotes/issues/775
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #775: Calendar mobile optimization', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #775 - view mode buttons are too small for touch on mobile', async () => {
    /**
     * This test verifies that the view mode selector buttons (Y, M, W, 3D, D, L)
     * meet the minimum touch target size of 44x44px on mobile viewports.
     *
     * The user reported: "Many buttons are small or go off the screen which
     * makes navigating around far more difficult than any other calendar app."
     *
     * Expected behavior:
     * - All touch targets should be at least 44x44px (Apple HIG recommendation)
     * - Buttons should have adequate spacing to prevent mis-taps
     * - Alternatively, a dropdown selector should be used for view modes
     *
     * Current behavior:
     * - Buttons are 28-32px on mobile (set in calendar-view.css lines 800-803)
     * - Buttons are cramped together, making it easy to tap the wrong one
     */
    const page = app.page;

    // Set viewport to mobile size (iPhone 14 Pro dimensions)
    await page.setViewportSize({ width: 393, height: 852 });

    // Open calendar view
    await runCommand(page, 'TaskNotes: Open calendar view');
    await page.waitForTimeout(1500);

    // Wait for FullCalendar to render
    const calendarView = page.locator('.fc');
    await expect(calendarView.first()).toBeVisible({ timeout: 10000 });

    // Find the toolbar with view mode buttons
    const toolbar = page.locator('.fc-toolbar, .tasknotes-calendar-controls');

    // Look for view mode buttons (Y, M, W, 3D, D, L or their FullCalendar equivalents)
    const viewButtons = page.locator('.fc-button-group .fc-button, .fc-toolbar-chunk button');

    const buttonCount = await viewButtons.count();
    console.log(`Found ${buttonCount} toolbar buttons`);

    // Minimum touch target size per Apple HIG
    const MIN_TOUCH_TARGET = 44;

    for (let i = 0; i < buttonCount; i++) {
      const button = viewButtons.nth(i);
      if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
        const box = await button.boundingBox();
        if (box) {
          console.log(`Button ${i}: ${box.width}x${box.height}px`);

          // Each button should be at least 44x44px for comfortable touch
          // This test will fail with current implementation
          expect(box.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
          expect(box.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
        }
      }
    }

    await page.screenshot({ path: 'test-results/screenshots/issue-775-mobile-view-buttons.png' });
  });

  test.fixme('reproduces issue #775 - navigation buttons are too small for touch', async () => {
    /**
     * This test verifies that navigation buttons (prev, next, today) meet
     * minimum touch target requirements on mobile.
     *
     * Current CSS (calendar-view.css lines 798-803) sets:
     * - .calendar-view__nav-button width: 28px, height: 28px at 768px breakpoint
     *
     * Expected: 44x44px minimum touch targets
     */
    const page = app.page;

    await page.setViewportSize({ width: 393, height: 852 });

    await runCommand(page, 'TaskNotes: Open calendar view');
    await page.waitForTimeout(1500);

    const calendarView = page.locator('.fc');
    await expect(calendarView.first()).toBeVisible({ timeout: 10000 });

    // Find navigation buttons
    const navButtons = page.locator('.fc-prev-button, .fc-next-button, .fc-today-button, .mini-calendar-view__nav-button');

    const buttonCount = await navButtons.count();
    console.log(`Found ${buttonCount} navigation buttons`);

    const MIN_TOUCH_TARGET = 44;

    for (let i = 0; i < buttonCount; i++) {
      const button = navButtons.nth(i);
      if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
        const box = await button.boundingBox();
        if (box) {
          console.log(`Nav button ${i}: ${box.width}x${box.height}px`);

          // Navigation buttons should be at least 44x44px
          expect(box.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
          expect(box.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
        }
      }
    }

    await page.screenshot({ path: 'test-results/screenshots/issue-775-mobile-nav-buttons.png' });
  });

  test.fixme('reproduces issue #775 - calendar controls should not overflow horizontally', async () => {
    /**
     * This test verifies that calendar header controls don't extend beyond
     * the viewport width on mobile screens.
     *
     * The user reported buttons "go off the screen" which indicates horizontal
     * overflow issues on narrow viewports.
     *
     * Expected behavior:
     * - All controls should be visible within the viewport
     * - Controls should wrap or collapse into a menu on narrow screens
     * - No horizontal scrolling required to access controls
     */
    const page = app.page;

    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size

    await runCommand(page, 'TaskNotes: Open calendar view');
    await page.waitForTimeout(1500);

    const calendarView = page.locator('.fc');
    await expect(calendarView.first()).toBeVisible({ timeout: 10000 });

    // Check for horizontal overflow on the toolbar
    const toolbar = page.locator('.fc-header-toolbar, .tasknotes-calendar-controls');

    if (await toolbar.isVisible({ timeout: 2000 }).catch(() => false)) {
      const overflowInfo = await toolbar.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        return {
          toolbarWidth: rect.width,
          toolbarRight: rect.right,
          viewportWidth,
          extendsOffScreen: rect.right > viewportWidth,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          hasHorizontalOverflow: el.scrollWidth > el.clientWidth,
        };
      });

      console.log('Toolbar overflow info:', overflowInfo);

      // Toolbar should not extend beyond viewport
      expect(overflowInfo.extendsOffScreen).toBe(false);
      expect(overflowInfo.hasHorizontalOverflow).toBe(false);
    }

    // Also check the main calendar container
    const container = page.locator('.workspace-leaf-content, .view-content').first();

    if (await container.isVisible({ timeout: 2000 }).catch(() => false)) {
      const containerOverflow = await container.evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        hasHorizontalOverflow: el.scrollWidth > el.clientWidth,
      }));

      console.log('Container overflow:', containerOverflow);

      // Container should not have horizontal overflow
      expect(containerOverflow.hasHorizontalOverflow).toBe(false);
    }

    await page.screenshot({ path: 'test-results/screenshots/issue-775-mobile-overflow.png' });
  });

  test.fixme('reproduces issue #775 - task badges should be readable on narrow viewports', async () => {
    /**
     * This test verifies that task badges/events in the calendar are readable
     * on narrow mobile viewports rather than being truncated to single letters.
     *
     * Expected behavior:
     * - Task badges should gracefully degrade on narrow screens:
     *   a) Show colored dots/indicators instead of truncated text
     *   b) Hide overflow and show "+N" count
     *   c) Stack vertically with full text where possible
     *
     * Current behavior:
     * - Text is truncated to unreadable fragments like "B", "E", "+3 n"
     */
    const page = app.page;

    await page.setViewportSize({ width: 375, height: 667 });

    await runCommand(page, 'TaskNotes: Open calendar view');
    await page.waitForTimeout(1500);

    const calendarView = page.locator('.fc');
    await expect(calendarView.first()).toBeVisible({ timeout: 10000 });

    // Look for event elements (task badges) in the calendar
    const events = page.locator('.fc-event, .fc-daygrid-event, .fc-timegrid-event');
    const eventCount = await events.count();

    console.log(`Found ${eventCount} events in calendar`);

    if (eventCount > 0) {
      // Check each visible event for reasonable text display
      for (let i = 0; i < Math.min(eventCount, 5); i++) {
        const event = events.nth(i);

        if (await event.isVisible({ timeout: 1000 }).catch(() => false)) {
          const eventInfo = await event.evaluate((el) => {
            const titleEl = el.querySelector('.fc-event-title, .fc-event-title-container');
            const box = el.getBoundingClientRect();
            return {
              width: box.width,
              height: box.height,
              textContent: titleEl?.textContent || el.textContent || '',
              isTruncated: (titleEl?.textContent?.length || 0) <= 2 && !titleEl?.textContent?.startsWith('+'),
            };
          });

          console.log(`Event ${i}:`, eventInfo);

          // Events should either:
          // 1. Have readable text (more than 2 chars unless it's a "+N" indicator)
          // 2. Be displayed as indicators/dots (small size is OK)
          // Single-letter truncations like "B", "E" are not acceptable

          // If the event is text-based (not a dot indicator), it shouldn't be truncated to single char
          if (eventInfo.width > 20) {
            // This is likely a text event, not a dot indicator
            const isSingleCharTruncation =
              eventInfo.textContent.length <= 2 &&
              !eventInfo.textContent.startsWith('+') &&
              eventInfo.textContent !== '';

            expect(isSingleCharTruncation).toBe(false);
          }
        }
      }
    }

    await page.screenshot({ path: 'test-results/screenshots/issue-775-mobile-task-badges.png' });
  });

  test.fixme('reproduces issue #775 - calendar day cells should have adequate tap targets', async () => {
    /**
     * This test verifies that calendar day cells are large enough to be
     * easily tapped on mobile devices.
     *
     * The user reports that "opening and editing tasks is also difficult"
     * which may relate to small day cell tap targets.
     *
     * Current CSS (calendar-view.css line 833):
     * - Day cells have min-height: 1.5rem (24px) on mobile
     *
     * Expected: Day cells should be at least 44x44px for comfortable interaction
     */
    const page = app.page;

    await page.setViewportSize({ width: 375, height: 667 });

    await runCommand(page, 'TaskNotes: Open calendar view');
    await page.waitForTimeout(1500);

    const calendarView = page.locator('.fc');
    await expect(calendarView.first()).toBeVisible({ timeout: 10000 });

    // Find day cells in the calendar grid
    const dayCells = page.locator('.fc-daygrid-day, .fc-timegrid-slot, .mini-calendar-view__day');
    const cellCount = await dayCells.count();

    console.log(`Found ${cellCount} day cells`);

    // Check the first few visible day cells
    let smallCellCount = 0;

    for (let i = 0; i < Math.min(cellCount, 7); i++) {
      const cell = dayCells.nth(i);

      if (await cell.isVisible({ timeout: 1000 }).catch(() => false)) {
        const box = await cell.boundingBox();
        if (box) {
          console.log(`Day cell ${i}: ${box.width}x${box.height}px`);

          // Day cells should ideally be at least 44px tall for touch interaction
          if (box.height < 44) {
            smallCellCount++;
          }
        }
      }
    }

    // Most day cells should meet minimum touch target size
    // Allow some flexibility since calendar grid layout may constrain this
    expect(smallCellCount).toBeLessThanOrEqual(2);

    await page.screenshot({ path: 'test-results/screenshots/issue-775-mobile-day-cells.png' });
  });

  test.fixme('reproduces issue #775 - mini calendar buttons should be touch-friendly', async () => {
    /**
     * This test specifically checks the mini calendar navigation buttons
     * which are used for date selection in the sidebar.
     *
     * Current CSS (calendar-view.css lines 798-803):
     * - Mini calendar nav buttons are 28px on mobile
     *
     * Expected: 44x44px minimum for touch targets
     */
    const page = app.page;

    await page.setViewportSize({ width: 393, height: 852 });

    // Try to locate a mini calendar view (often in sidebar)
    await runCommand(page, 'TaskNotes: Open calendar view');
    await page.waitForTimeout(1500);

    // Look for mini calendar specifically
    const miniCalendar = page.locator('.mini-calendar-view');

    if (await miniCalendar.isVisible({ timeout: 3000 }).catch(() => false)) {
      const navButtons = miniCalendar.locator('.mini-calendar-view__nav-button, .mini-calendar-view__controls button');

      const buttonCount = await navButtons.count();
      console.log(`Found ${buttonCount} mini calendar nav buttons`);

      const MIN_TOUCH_TARGET = 44;

      for (let i = 0; i < buttonCount; i++) {
        const button = navButtons.nth(i);
        if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
          const box = await button.boundingBox();
          if (box) {
            console.log(`Mini calendar nav button ${i}: ${box.width}x${box.height}px`);

            // Navigation buttons should be at least 44x44px
            expect(box.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
            expect(box.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
          }
        }
      }
    } else {
      console.log('Mini calendar not visible in current view');
    }

    await page.screenshot({ path: 'test-results/screenshots/issue-775-mini-calendar-buttons.png' });
  });
});
