/**
 * Issue #983: [FR]: Rearrange Agenda view to get rid of sideways scrolling
 *
 * Feature description:
 * When the Agenda view is placed in the sidebar, users have to scroll horizontally
 * to see "Today" and "Refresh calendars" buttons. The request is to:
 * 1. Make these buttons wrap below the date when there isn't enough room
 * 2. Eliminate horizontal scrolling in the sidebar entirely
 * 3. Prevent task icons (chevron, recurring, blocking, reminders) from disappearing
 *    behind long task names
 *
 * The issue occurs because:
 * - The header layout is fixed and doesn't adapt to narrow widths
 * - No flex-wrap or responsive reflow is applied to header elements
 * - Task card content doesn't properly handle overflow with icons
 *
 * @see https://github.com/callumalpass/tasknotes/issues/983
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #983: Agenda view sidebar horizontal scrolling', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #983 - agenda view header causes horizontal scroll in narrow sidebar', async () => {
    /**
     * This test reproduces the horizontal scrollbar issue when the Agenda view
     * is placed in a sidebar panel with limited width.
     *
     * The bug manifests when:
     * 1. User opens Agenda view in the sidebar (not main content area)
     * 2. The sidebar is narrow (e.g., 280-350px typical sidebar width)
     * 3. The header contains: prev/next buttons, date title, "Today" button, "Refresh calendars" button
     * 4. All elements try to fit on one row, causing horizontal overflow
     *
     * Expected behavior:
     * - The "Today" and "Refresh calendars" buttons should wrap below the date
     * - No horizontal scrollbar should appear
     * - All header controls should remain accessible without scrolling
     *
     * Potential fixes:
     * 1. Add flex-wrap to .agenda-view__header-content
     * 2. Use CSS media query or container query for narrow widths
     * 3. Move action buttons to a second row when space is limited
     * 4. Add overflow-x: hidden to .agenda-view container
     */
    const page = app.page;

    // Open agenda view
    await runCommand(page, 'TaskNotes: Open agenda view');
    await page.waitForTimeout(1000);

    // Find the agenda view container
    const agendaView = page.locator('.agenda-view');

    if (!await agendaView.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Agenda view not visible - cannot test layout');
      return;
    }

    // Simulate narrow sidebar width by constraining the container
    // Typical Obsidian sidebar widths are 280-350px
    const sidebarWidth = 300;

    // Find the parent workspace leaf and resize it to simulate sidebar
    const workspaceLeaf = page.locator('.workspace-leaf').filter({ has: agendaView }).first();

    if (await workspaceLeaf.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Force the container to a narrow width to simulate sidebar placement
      await workspaceLeaf.evaluate((el, width) => {
        (el as HTMLElement).style.width = `${width}px`;
        (el as HTMLElement).style.maxWidth = `${width}px`;
      }, sidebarWidth);

      await page.waitForTimeout(300);
    }

    // Check for horizontal scroll on the agenda view
    const { scrollWidth, clientWidth, hasHorizontalScroll } = await agendaView.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      hasHorizontalScroll: el.scrollWidth > el.clientWidth,
    }));

    console.log(`Agenda view - scrollWidth: ${scrollWidth}, clientWidth: ${clientWidth}`);

    // The bug: agenda view should not have horizontal scroll
    // When fixed, scrollWidth should equal clientWidth (no overflow)
    expect(hasHorizontalScroll).toBe(false);
  });

  test.fixme('reproduces issue #983 - Today and Refresh buttons should wrap on narrow width', async () => {
    /**
     * This test verifies that the header action buttons (Today, Refresh calendars)
     * wrap to a new row when the container is too narrow to fit them inline.
     *
     * Current behavior: All header elements are on one row, causing overflow
     * Expected behavior: Action buttons wrap below the navigation/title section
     */
    const page = app.page;

    // Open agenda view
    await runCommand(page, 'TaskNotes: Open agenda view');
    await page.waitForTimeout(1000);

    const agendaView = page.locator('.agenda-view');

    if (!await agendaView.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Agenda view not visible');
      return;
    }

    // Simulate narrow width
    const sidebarWidth = 300;
    await agendaView.evaluate((el, width) => {
      (el as HTMLElement).style.width = `${width}px`;
      (el as HTMLElement).style.maxWidth = `${width}px`;
    }, sidebarWidth);

    await page.waitForTimeout(300);

    // Find header elements
    const headerContent = agendaView.locator('.agenda-view__header-content');
    const actionsSection = agendaView.locator('.agenda-view__actions-section');
    const titleSection = agendaView.locator('.agenda-view__title-section');

    if (!await headerContent.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Header content not found');
      return;
    }

    // Get positions to check if elements wrapped
    const titleBox = await titleSection.boundingBox().catch(() => null);
    const actionsBox = await actionsSection.boundingBox().catch(() => null);

    if (titleBox && actionsBox) {
      // If actions section wrapped, its top should be below the title section
      // (i.e., actionsBox.y >= titleBox.y + titleBox.height - some tolerance)
      // If they're on the same row, actionsBox.y should be approximately equal to titleBox.y

      const tolerance = 10; // Allow 10px tolerance for alignment
      const actionsAreBelowTitle = actionsBox.y >= titleBox.y + titleBox.height - tolerance;

      console.log(`Title section: y=${titleBox.y}, height=${titleBox.height}`);
      console.log(`Actions section: y=${actionsBox.y}`);
      console.log(`Actions should wrap below title at narrow width`);

      // When fixed, actions should wrap below title at narrow widths
      // This assertion documents the expected behavior
      expect(actionsAreBelowTitle).toBe(true);
    }
  });

  test.fixme('reproduces issue #983 - agenda view should not scroll horizontally at all', async () => {
    /**
     * This test verifies that the Agenda view has overflow-x: hidden
     * to prevent any horizontal scrolling, intentional or accidental.
     *
     * The user specifically requested that horizontal scrolling be
     * impossible to prevent accidental sideways scrolling.
     */
    const page = app.page;

    // Open agenda view
    await runCommand(page, 'TaskNotes: Open agenda view');
    await page.waitForTimeout(1000);

    const agendaView = page.locator('.agenda-view');

    if (!await agendaView.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Agenda view not visible');
      return;
    }

    // Check CSS overflow-x property
    const overflowX = await agendaView.evaluate((el) => {
      return window.getComputedStyle(el).overflowX;
    });

    console.log(`Agenda view overflow-x: ${overflowX}`);

    // The fix should set overflow-x to 'hidden' to prevent horizontal scroll entirely
    // Current value is likely 'auto' or 'visible' which allows scrolling
    expect(overflowX).toBe('hidden');
  });

  test.fixme('reproduces issue #983 - task icons should not disappear behind long task names', async () => {
    /**
     * This test verifies that task icons (chevron, recurring, blocking, reminders)
     * remain visible even when task names are long.
     *
     * The user reported that in agenda view with a narrow sidebar:
     * - Chevron (subtask toggle)
     * - Recurring icon
     * - Blocking icon
     * - "Click to filter subtasks" icon
     * - Reminders icon
     * ...all disappear behind long task names.
     *
     * Expected behavior:
     * - Task names should truncate with ellipsis
     * - Icons should always remain visible
     * - Icons should have a minimum reserved space
     */
    const page = app.page;

    // Open agenda view
    await runCommand(page, 'TaskNotes: Open agenda view');
    await page.waitForTimeout(1000);

    const agendaView = page.locator('.agenda-view');

    if (!await agendaView.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Agenda view not visible');
      return;
    }

    // Simulate narrow width
    const sidebarWidth = 280;
    await agendaView.evaluate((el, width) => {
      (el as HTMLElement).style.width = `${width}px`;
      (el as HTMLElement).style.maxWidth = `${width}px`;
    }, sidebarWidth);

    await page.waitForTimeout(300);

    // Find task cards in the agenda view
    const taskCards = agendaView.locator('.task-card');
    const cardCount = await taskCards.count();

    if (cardCount === 0) {
      console.log('No task cards visible - cannot test icon visibility');
      return;
    }

    // Check each card for icon visibility
    for (let i = 0; i < Math.min(cardCount, 5); i++) {
      const card = taskCards.nth(i);
      const cardBox = await card.boundingBox();

      if (!cardBox) continue;

      // Find icons within the card (various icon classes used)
      const icons = card.locator('.lucide-rotate-ccw, .lucide-bell, .lucide-git-branch, .lucide-chevron-right, .task-card__badge');

      const iconCount = await icons.count();

      for (let j = 0; j < iconCount; j++) {
        const icon = icons.nth(j);
        const iconBox = await icon.boundingBox().catch(() => null);

        if (iconBox) {
          // Icon should be within the card boundaries (not clipped outside)
          const iconRightEdge = iconBox.x + iconBox.width;
          const cardRightEdge = cardBox.x + cardBox.width;

          // The bug: icons extend beyond card or are hidden
          // When fixed: icons should be visible within card bounds
          expect(iconRightEdge).toBeLessThanOrEqual(cardRightEdge + 5); // 5px tolerance
          expect(iconBox.x).toBeGreaterThanOrEqual(cardBox.x - 5);
        }
      }
    }
  });

  test.fixme('reproduces issue #983 - task card CSS should handle text overflow', async () => {
    /**
     * This test verifies that task card content has proper text overflow handling
     * to prevent long task names from hiding icons.
     *
     * Expected CSS properties:
     * - Task title should have text-overflow: ellipsis
     * - Task title container should have overflow: hidden
     * - Icon container should have flex-shrink: 0 to prevent shrinking
     */
    const page = app.page;

    // Open agenda view
    await runCommand(page, 'TaskNotes: Open agenda view');
    await page.waitForTimeout(1000);

    const agendaView = page.locator('.agenda-view');

    if (!await agendaView.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Agenda view not visible');
      return;
    }

    // Find a task card
    const taskCard = agendaView.locator('.task-card').first();

    if (!await taskCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('No task card visible');
      return;
    }

    // Find the task title element
    const taskTitle = taskCard.locator('.task-card__title, .task-card__content-title').first();

    if (await taskTitle.isVisible({ timeout: 2000 }).catch(() => false)) {
      const titleCss = await taskTitle.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          overflow: style.overflow,
          textOverflow: style.textOverflow,
          whiteSpace: style.whiteSpace,
        };
      });

      console.log('Task title CSS:', titleCss);

      // Expected: text should truncate with ellipsis, not overflow
      const hasProperTruncation =
        titleCss.overflow === 'hidden' &&
        titleCss.textOverflow === 'ellipsis';

      // This documents the expected fix
      expect(hasProperTruncation).toBe(true);
    }

    // Find the badge/icon container
    const badges = taskCard.locator('.task-card__badges, .task-card__indicators').first();

    if (await badges.isVisible({ timeout: 2000 }).catch(() => false)) {
      const badgeCss = await badges.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          flexShrink: style.flexShrink,
          minWidth: style.minWidth,
        };
      });

      console.log('Badge container CSS:', badgeCss);

      // Expected: badges should not shrink when space is limited
      expect(badgeCss.flexShrink).toBe('0');
    }
  });

  test.fixme('reproduces issue #983 - header should use responsive layout at narrow widths', async () => {
    /**
     * This test verifies that the existing responsive CSS (max-width: 768px)
     * properly handles the header layout for sidebar placement.
     *
     * The existing CSS has responsive rules at 768px and 480px breakpoints,
     * but these may not be triggered for sidebar placement since the
     * viewport width is larger - only the container is narrow.
     *
     * Fix approach: Use container queries or JavaScript-based responsive
     * layout detection instead of viewport media queries.
     */
    const page = app.page;

    // Open agenda view
    await runCommand(page, 'TaskNotes: Open agenda view');
    await page.waitForTimeout(1000);

    const agendaView = page.locator('.agenda-view');

    if (!await agendaView.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Agenda view not visible');
      return;
    }

    // Simulate sidebar width (narrower than 768px breakpoint would handle)
    const sidebarWidth = 320;

    await agendaView.evaluate((el, width) => {
      (el as HTMLElement).style.width = `${width}px`;
      (el as HTMLElement).style.maxWidth = `${width}px`;
    }, sidebarWidth);

    await page.waitForTimeout(300);

    // Check header content layout
    const headerContent = agendaView.locator('.agenda-view__header-content');

    if (await headerContent.isVisible({ timeout: 2000 }).catch(() => false)) {
      const layoutCss = await headerContent.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          flexDirection: style.flexDirection,
          flexWrap: style.flexWrap,
          width: el.clientWidth,
        };
      });

      console.log('Header content layout at narrow width:', layoutCss);

      // The fix should change to column layout or allow wrapping at narrow widths
      // Current: likely row layout with no wrap
      // Expected: column layout OR row with wrap enabled
      const hasResponsiveLayout =
        layoutCss.flexDirection === 'column' ||
        layoutCss.flexWrap === 'wrap';

      expect(hasResponsiveLayout).toBe(true);
    }
  });
});
