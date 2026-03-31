/**
 * Reproduction test for Issue #1649: Daily note on Day view is not working
 *
 * Bug Description:
 * Clicking the day header (e.g., "Thursday") in the FullCalendar single-day (timeGridDay) view
 * does not open or create the daily note for that date. Clicking date headers in all other views
 * (week, month, 3-day, list) works correctly because those views render the header as a proper
 * navLink anchor (<a data-navlink="">). In the day view, FullCalendar renders the header as a
 * plain <a> element without the data-navlink attribute, so the navLinkDayClick handler is never
 * triggered.
 *
 * Root Cause Hypothesis:
 * CalendarView.ts configures FullCalendar with navLinks: true and navLinkDayClick pointing to
 * handleDateTitleClick. FullCalendar only emits navLink click events for elements it renders
 * with the data-navlink attribute. In timeGridDay view, the column header shows the day name
 * ("Thursday") but FullCalendar does not render it as a navLink because the date is already
 * the current view date — there is nothing to navigate to. The click event on the header
 * element fires on the DOM but FullCalendar's navLink system never intercepts it.
 *
 * Key locations:
 * - src/bases/CalendarView.ts (navLinks config, navLinkDayClick handler, viewDidMount)
 * - src/bases/calendar-core.ts (handleDateTitleClick function)
 */

jest.mock('obsidian');

describe('Issue #1649: Daily note not opening from Day view header', () => {
  it.skip('reproduces issue #1649: navLinkDayClick is not triggered for timeGridDay view header', () => {
    // Simulate FullCalendar navLink behavior across different view types
    // navLinks renders headers as clickable links in multi-day views but NOT in single-day view

    const navLinkDayClickHandler = jest.fn();

    // Simulate which view types generate navLink elements for day headers
    function simulateHeaderClick(viewType: string, clickedElement: { hasNavLink: boolean }) {
      if (!clickedElement.hasNavLink) {
        // FullCalendar does not fire navLinkDayClick for elements without data-navlink
        return false;
      }
      navLinkDayClickHandler(new Date());
      return true;
    }

    // In week view: header cells have data-navlink, click works
    const weekViewHeaderClick = simulateHeaderClick('timeGridWeek', { hasNavLink: true });
    expect(weekViewHeaderClick).toBe(true);
    expect(navLinkDayClickHandler).toHaveBeenCalledTimes(1);

    navLinkDayClickHandler.mockClear();

    // In day view: header does NOT have data-navlink attribute
    // This is the bug — fc-col-header-cell-cushion has no data-navlink in timeGridDay
    const dayViewHeaderClick = simulateHeaderClick('timeGridDay', { hasNavLink: false });

    // Bug: click does not reach the navLinkDayClick handler
    expect(dayViewHeaderClick).toBe(true); // Fails — returns false for day view
    expect(navLinkDayClickHandler).toHaveBeenCalledTimes(1); // Fails — never called
  });

  it.skip('reproduces issue #1649: day view header element has empty title and no navlink data attribute', () => {
    // Verify the HTML structure difference reported in the issue
    // Week/list view: <a data-navlink="" title="Go to 26 February 2026">26 February 2026</a>
    // Day view:       <a title="" class="fc-col-header-cell-cushion">Thursday</a>

    function isNavLinkElement(element: { title: string; hasNavLinkAttr: boolean }): boolean {
      // FullCalendar navLink elements have non-empty title and data-navlink attribute
      return element.hasNavLinkAttr && element.title.length > 0;
    }

    const weekViewHeader = { title: 'Go to 26 February 2026', hasNavLinkAttr: true };
    const dayViewHeader = { title: '', hasNavLinkAttr: false }; // As observed in issue

    expect(isNavLinkElement(weekViewHeader)).toBe(true); // Passes — week view works
    expect(isNavLinkElement(dayViewHeader)).toBe(true);  // Fails — day view header is not a navLink
  });
});
