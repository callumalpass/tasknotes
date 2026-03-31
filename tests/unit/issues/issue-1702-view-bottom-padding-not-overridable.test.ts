/**
 * Reproduction test for Issue #1702: Padding at bottom of views too large, no way to remove it.
 *
 * Bug Description:
 * All TaskNotes views (calendar, etc.) have a visible bottom padding/border that cannot be
 * removed via CSS snippets. Users expect to be able to customize this with CSS like they can
 * with other Obsidian plugins, but TaskNotes uses hardcoded inline styles that override any
 * CSS class rules.
 *
 * Root Cause Hypothesis:
 * In `CalendarView.setupContainer()`, the root element and calendar element are styled via
 * `element.style.cssText = "..."`. Inline styles set directly on DOM elements via the `style`
 * attribute have the highest CSS specificity (short of `!important`), making them impossible
 * to override with external CSS snippets that target class selectors. Specifically:
 * - rootElement gets `min-height: 800px` hardcoded inline
 * - calendarEl gets `min-height: 700px` hardcoded inline
 * These large minimum heights create extra whitespace at the bottom when the view container is
 * shorter (e.g., in split panes or embedded canvases). Since CSS snippets cannot override inline
 * styles without `!important`, users have no way to remove this padding.
 *
 * Key locations:
 * - src/bases/CalendarView.ts (setupContainer method, ~line 2151-2168)
 * - styles/advanced-calendar-view.css (where styles should live instead)
 */

jest.mock('obsidian');

describe('Issue #1702: View bottom padding cannot be removed via CSS snippets', () => {
  it.skip('reproduces issue #1702: inline styles on calendar container override CSS class rules', () => {
    // Simulate the CalendarView.setupContainer() behavior
    const mockRootElement = {
      style: { cssText: '' },
      className: '',
    };

    const mockCalendarEl = {
      style: { cssText: '' },
    };

    // This is what setupContainer() does:
    mockRootElement.style.cssText = "min-height: 800px; height: 100%; display: flex; flex-direction: column;";
    mockCalendarEl.style.cssText = "flex: 1; min-height: 700px; overflow: auto;";

    // A CSS snippet targeting a class selector would look like:
    // .advanced-calendar-view { min-height: 0 !important; }
    // But since the style is set via style.cssText (inline), it wins over class-based CSS
    // unless the user adds !important to their snippet.

    // The bug: inline min-height cannot be overridden by a CSS class rule (without !important)
    // In a real browser, .cssText is an inline style which beats class specificity
    const inlineMinHeight = mockRootElement.style.cssText.match(/min-height:\s*(\d+)px/)?.[1];

    // The inline style should NOT set a large min-height if we want CSS overridability
    // Instead, min-height should be in a CSS class so snippets can target it
    expect(inlineMinHeight).toBeUndefined(); // Fails to indicate bug is present - hardcoded 800px found
  });

  it.skip('reproduces issue #1702: calendar element min-height should use a CSS variable for overridability', () => {
    // After the fix, the style should use a CSS custom property that users can override
    // e.g.: style.cssText = "flex: 1; min-height: var(--tn-calendar-min-height, 700px); overflow: auto;"

    const mockCalendarEl = {
      style: { cssText: '' },
    };

    // Current broken behavior: hardcoded value
    mockCalendarEl.style.cssText = "flex: 1; min-height: 700px; overflow: auto;";

    // Check if the style uses a CSS variable (the fix)
    const usesCSSVariable = mockCalendarEl.style.cssText.includes('var(--tn-calendar-min-height');

    // This should be true after the fix, but is false currently
    expect(usesCSSVariable).toBe(true); // Fails to indicate bug is present
  });
});
