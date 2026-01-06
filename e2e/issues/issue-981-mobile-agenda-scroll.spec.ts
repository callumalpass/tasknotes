/**
 * Issue #981: [FR]: Get rid of unnecessary sideways scroll bar on mobile Agenda view
 *
 * Bug description:
 * When opening the Agenda view in the Obsidian app on iPhone, there's a horizontal
 * scrollbar at the bottom that allows scrolling left and right, even though there's
 * nothing that needs to be displayed to the right. When scrolling down the view,
 * it "wiggles" left and right which is annoying on touch devices.
 *
 * This issue is related to but distinct from #983 (sidebar scroll):
 * - Issue #983: Horizontal scroll in narrow sidebar (desktop)
 * - Issue #981: Horizontal scroll on mobile (touch devices with viewport-based width)
 *
 * The core problem is the same: content is overflowing horizontally, but the
 * manifestation differs. On mobile, the view takes the full viewport width,
 * and the "wiggle" during vertical scroll is a mobile-specific symptom of
 * horizontal overflow interacting with touch scrolling.
 *
 * Root cause:
 * - The .agenda-view container has overflow-y: auto but no overflow-x constraint
 * - Some child elements may exceed the container width
 * - On mobile touch devices, this causes elastic horizontal scrolling behavior
 *
 * @see https://github.com/callumalpass/tasknotes/issues/981
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #981: Mobile Agenda view horizontal scrollbar', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #981 - agenda view should not have horizontal overflow on mobile viewport', async () => {
    /**
     * This test simulates a mobile viewport and checks for horizontal scroll.
     *
     * On iPhone, the Obsidian app runs at the device's screen width. Common
     * iPhone widths:
     * - iPhone SE: 375px
     * - iPhone 12/13/14: 390px
     * - iPhone 12/13/14 Pro Max: 428px
     *
     * The bug: When the agenda view is displayed at these widths, horizontal
     * scrolling is possible even though no content should extend beyond the
     * viewport width.
     *
     * Expected behavior:
     * - overflow-x should be hidden or clip on the agenda view container
     * - scrollWidth should equal clientWidth (no horizontal overflow)
     */
    const page = app.page;

    // Set viewport to iPhone dimensions
    const mobileWidth = 390;
    const mobileHeight = 844;
    await page.setViewportSize({ width: mobileWidth, height: mobileHeight });
    await page.waitForTimeout(300);

    // Open agenda view
    await runCommand(page, 'TaskNotes: Open agenda view');
    await page.waitForTimeout(1000);

    const agendaView = page.locator('.agenda-view');

    if (!await agendaView.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Agenda view not visible - cannot test mobile layout');
      return;
    }

    // Check for horizontal scroll
    const { scrollWidth, clientWidth, hasHorizontalScroll, overflowX } = await agendaView.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      hasHorizontalScroll: el.scrollWidth > el.clientWidth,
      overflowX: window.getComputedStyle(el).overflowX,
    }));

    console.log(`Mobile Agenda view - scrollWidth: ${scrollWidth}, clientWidth: ${clientWidth}, overflow-x: ${overflowX}`);

    // The bug: scrollWidth > clientWidth means horizontal scroll is possible
    // When fixed: scrollWidth should equal clientWidth (no overflow)
    expect(hasHorizontalScroll).toBe(false);
  });

  test.fixme('reproduces issue #981 - agenda view should have overflow-x hidden to prevent wiggle', async () => {
    /**
     * This test verifies that overflow-x is set to hidden on the agenda view.
     *
     * The "wiggle" behavior described in the issue occurs on touch devices when:
     * 1. There's horizontal scroll potential (even just a few pixels)
     * 2. User performs vertical scroll with touch gesture
     * 3. Slight horizontal movement in the gesture causes the view to shift
     *
     * Fix: Set overflow-x: hidden on .agenda-view to completely prevent
     * horizontal scrolling, which eliminates the wiggle.
     */
    const page = app.page;

    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);

    // Open agenda view
    await runCommand(page, 'TaskNotes: Open agenda view');
    await page.waitForTimeout(1000);

    const agendaView = page.locator('.agenda-view');

    if (!await agendaView.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Agenda view not visible');
      return;
    }

    const overflowX = await agendaView.evaluate((el) => {
      return window.getComputedStyle(el).overflowX;
    });

    console.log(`Agenda view overflow-x: ${overflowX}`);

    // The fix should set overflow-x to 'hidden' to prevent horizontal scroll entirely
    // This prevents the "wiggle" on mobile touch scrolling
    expect(overflowX).toBe('hidden');
  });

  test.fixme('reproduces issue #981 - no child elements should overflow container at mobile width', async () => {
    /**
     * This test checks that all child elements of the agenda view stay within
     * the container bounds at mobile viewport width.
     *
     * Potential overflow sources:
     * - Header content (.agenda-view__header-content) with fixed max-width: 1000px
     * - Period title (.agenda-view__period-title) with white-space: nowrap
     * - Navigation buttons and action buttons that don't wrap
     * - Task cards with long content
     */
    const page = app.page;

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size
    await page.waitForTimeout(300);

    // Open agenda view
    await runCommand(page, 'TaskNotes: Open agenda view');
    await page.waitForTimeout(1000);

    const agendaView = page.locator('.agenda-view');

    if (!await agendaView.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Agenda view not visible');
      return;
    }

    const containerBox = await agendaView.boundingBox();
    if (!containerBox) {
      console.log('Could not get agenda view bounding box');
      return;
    }

    // Check header content
    const headerContent = agendaView.locator('.agenda-view__header-content');
    if (await headerContent.isVisible({ timeout: 2000 }).catch(() => false)) {
      const headerBox = await headerContent.boundingBox();
      if (headerBox) {
        const headerRightEdge = headerBox.x + headerBox.width;
        const containerRightEdge = containerBox.x + containerBox.width;

        console.log(`Header right edge: ${headerRightEdge}, Container right edge: ${containerRightEdge}`);

        // Header should not extend beyond container
        expect(headerRightEdge).toBeLessThanOrEqual(containerRightEdge + 5);
      }
    }

    // Check settings section if visible
    const settings = agendaView.locator('.agenda-view__settings');
    if (await settings.isVisible({ timeout: 2000 }).catch(() => false)) {
      const settingsBox = await settings.boundingBox();
      if (settingsBox) {
        const settingsRightEdge = settingsBox.x + settingsBox.width;
        const containerRightEdge = containerBox.x + containerBox.width;

        console.log(`Settings right edge: ${settingsRightEdge}, Container right edge: ${containerRightEdge}`);

        expect(settingsRightEdge).toBeLessThanOrEqual(containerRightEdge + 5);
      }
    }
  });

  test.fixme('reproduces issue #981 - agenda view header should adapt to narrow mobile width', async () => {
    /**
     * This test verifies that the agenda view header properly adapts to
     * narrow mobile widths by wrapping or stacking elements.
     *
     * At 768px and below, the CSS applies responsive styles:
     * - .agenda-view__header-content becomes flex-direction: column
     * - Navigation and action sections get centered
     *
     * However, on mobile the viewport IS narrow (unlike sidebar case in #983),
     * so these media queries SHOULD apply. If they don't work correctly,
     * the header layout may still cause overflow.
     */
    const page = app.page;

    // Set narrow mobile viewport (smaller than 480px breakpoint)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);

    // Open agenda view
    await runCommand(page, 'TaskNotes: Open agenda view');
    await page.waitForTimeout(1000);

    const agendaView = page.locator('.agenda-view');

    if (!await agendaView.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Agenda view not visible');
      return;
    }

    const headerContent = agendaView.locator('.agenda-view__header-content');

    if (await headerContent.isVisible({ timeout: 2000 }).catch(() => false)) {
      const layoutCss = await headerContent.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          flexDirection: style.flexDirection,
          flexWrap: style.flexWrap,
          gap: style.gap,
        };
      });

      console.log('Header layout at 375px width:', layoutCss);

      // At mobile width, header should be in column layout per the existing media query
      // This allows elements to stack vertically instead of overflowing horizontally
      expect(layoutCss.flexDirection).toBe('column');
    }
  });

  test.fixme('reproduces issue #981 - touch scroll should not cause horizontal wiggle', async () => {
    /**
     * This test simulates touch scrolling to verify no horizontal "wiggle".
     *
     * The user reported that when scrolling down, the view wiggles left and right.
     * This happens when:
     * 1. There's slight horizontal overflow potential
     * 2. Touch gesture has minor horizontal component
     * 3. View shifts horizontally during vertical scroll
     *
     * With overflow-x: hidden, any horizontal overflow is clipped and
     * touch gestures cannot cause horizontal movement.
     *
     * Note: This test simulates the behavior but may not perfectly replicate
     * the iOS touch scrolling physics. Manual testing on device is recommended.
     */
    const page = app.page;

    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);

    // Open agenda view
    await runCommand(page, 'TaskNotes: Open agenda view');
    await page.waitForTimeout(1000);

    const agendaView = page.locator('.agenda-view');

    if (!await agendaView.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Agenda view not visible');
      return;
    }

    // Get initial scroll position
    const initialScrollLeft = await agendaView.evaluate((el) => el.scrollLeft);

    // Simulate a touch scroll gesture with slight horizontal component
    const box = await agendaView.boundingBox();
    if (box) {
      const startX = box.x + box.width / 2;
      const startY = box.y + box.height / 2;

      // Simulate touch scroll: mostly vertical with slight horizontal movement
      await page.touchscreen.tap(startX, startY);
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      // Move down (vertical scroll) with slight horizontal drift
      await page.mouse.move(startX + 20, startY - 100, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(300);
    }

    // Get scroll position after gesture
    const finalScrollLeft = await agendaView.evaluate((el) => el.scrollLeft);

    console.log(`Scroll position - initial: ${initialScrollLeft}, final: ${finalScrollLeft}`);

    // With overflow-x: hidden, horizontal scroll position should remain 0
    expect(finalScrollLeft).toBe(0);
  });
});
