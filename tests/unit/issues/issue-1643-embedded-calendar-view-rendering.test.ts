/**
 * Reproduction test for Issue #1643: Embedded calendar view has buggy embedding between source and preview note view
 *
 * Bug Description:
 * When a .base file (e.g., agenda-default.base) is embedded in a note using ![[...]], the
 * calendar view renders differently between source mode and reading/preview mode. In source
 * mode the embedding may occupy full width; in preview mode it is truncated or misaligned.
 *
 * Root Cause Hypothesis:
 * FullCalendar initializes with the container dimensions at mount time. The embedding container
 * has different computed dimensions in source mode (CodeMirror iframe context) vs reading mode
 * (markdown-preview-sizer context). When dimensions are zero or mismatched at initialization,
 * FullCalendar renders with incorrect sizing and does not reflow. The CalendarView does not
 * call calendar.updateSize() after the embedding container settles, leaving it stuck in its
 * initial (wrong) layout.
 *
 * Key locations:
 * - src/bases/CalendarView.ts (calendar initialization and resize handling)
 * - src/bases/calendar-core.ts (shared calendar logic)
 */

jest.mock('obsidian');

describe('Issue #1643: Embedded calendar view rendering differs between source and preview', () => {
  it.skip('reproduces issue #1643: calendar should call updateSize() when container dimensions change after embedding', () => {
    // Simulate what happens when FullCalendar is initialized in a container
    // that has zero/incorrect dimensions (as happens in embedded mode)

    // Mock container with initially zero dimensions (as in an embed before layout settles)
    const mockContainer = {
      offsetWidth: 0,
      offsetHeight: 0,
      isConnected: true,
    };

    // Simulate FullCalendar initialization — records the width at init time
    let calendarInitWidth = mockContainer.offsetWidth;
    const mockCalendar = {
      render: () => {
        calendarInitWidth = mockContainer.offsetWidth;
      },
      updateSize: jest.fn(),
      view: { type: 'timeGridWeek' },
    };

    mockCalendar.render();

    // Simulate container getting real dimensions after embedding layout resolves
    mockContainer.offsetWidth = 800;
    mockContainer.offsetHeight = 600;

    // The bug: updateSize() is NOT called after the container resizes
    // So the calendar is stuck at its initial (zero-width) layout
    expect(mockCalendar.updateSize).toHaveBeenCalled(); // Fails — updateSize is never called
    expect(calendarInitWidth).toBe(800); // Fails — was 0 at init time
  });

  it.skip('reproduces issue #1643: embedded calendar in preview mode should match source mode dimensions', () => {
    // Simulate the two rendering contexts for an embedded .base file

    const sourceModeDimensions = { width: 850, height: 500, mode: 'source' };
    const previewModeDimensions = { width: 0, height: 0, mode: 'preview' }; // preview often initializes with 0

    // A properly implemented calendar view should normalize these before rendering
    function initCalendarWithDimensions(dims: { width: number; height: number; mode: string }) {
      const effectiveWidth = dims.width > 0 ? dims.width : null;
      return { initialized: effectiveWidth !== null, width: effectiveWidth };
    }

    const sourceResult = initCalendarWithDimensions(sourceModeDimensions);
    const previewResult = initCalendarWithDimensions(previewModeDimensions);

    // Bug: preview mode fails to initialize because container is not yet sized
    expect(previewResult.initialized).toBe(true); // Fails — preview has 0 dimensions
    expect(previewResult.width).toBe(sourceResult.width); // Fails — widths differ
  });
});
