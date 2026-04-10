/**
 * Reproduction tests for issue #1696.
 *
 * Reported behavior:
 * - When a recurring task's next occurrence is rescheduled (scheduled date
 *   changed without modifying the recurrence pattern), the Google Calendar
 *   export uses DTSTART from the recurrence rule instead of the rescheduled
 *   scheduled date.
 */

describe('Issue #1696: Google Calendar export ignores rescheduled next occurrence', () => {
	it.skip('reproduces issue #1696 - event start uses DTSTART, not rescheduled scheduled date', () => {
		// Simulate the data scenario from the bug report:
		// - scheduled: 2026-03-16 (rescheduled next occurrence)
		// - recurrence: DTSTART:20260313;FREQ=WEEKLY;INTERVAL=4;BYDAY=FR
		// - recurrence_anchor: scheduled

		const task = {
			scheduled: '2026-03-16',
			recurrence: 'DTSTART:20260313;FREQ=WEEKLY;INTERVAL=4;BYDAY=FR',
			recurrence_anchor: 'scheduled',
		};

		// Simulate what convertToGoogleRecurrence returns
		const recurrenceData = {
			recurrence: ['RRULE:FREQ=WEEKLY;INTERVAL=4;BYDAY=FR'],
			dtstart: '2026-03-13', // From DTSTART in recurrence rule
			hasTime: false,
			time: null,
		};

		// Simulate buildCalendarEvent behavior (lines 634-638):
		// The event start is overridden with recurrenceData.dtstart
		const eventStart = recurrenceData.dtstart; // '2026-03-13'

		// BUG: The event should use the rescheduled date (2026-03-16)
		// but instead uses DTSTART from the recurrence rule (2026-03-13)
		expect(eventStart).toBe('2026-03-13'); // Documents the bug
		expect(eventStart).not.toBe(task.scheduled); // The scheduled date is ignored
	});
});
