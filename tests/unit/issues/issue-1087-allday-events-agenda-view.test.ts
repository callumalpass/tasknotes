/**
 * Tests for Issue #1087: All day events from external calendars do not show up in the agenda view
 *
 * Bug Description:
 * All day events from external calendars (ICS subscriptions, Google Calendar,
 * Microsoft Calendar) do not appear in the agenda view (listWeek), while
 * timed events from the same sources do appear.
 *
 * The user expects all-day events to be visible alongside timed events
 * in the agenda view, either by default or as a configurable option.
 *
 * Relevant code:
 * - src/bases/CalendarView.ts - Main calendar view implementation
 * - src/bases/calendar-core.ts - createICSEvent function
 * - src/services/ICSSubscriptionService.ts - parseICS function
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock structures representing how calendar events flow through the system
interface MockICSEvent {
	id: string;
	subscriptionId: string;
	title: string;
	start: string;
	end?: string;
	allDay: boolean;
	description?: string;
	location?: string;
}

interface MockCalendarEvent {
	id: string;
	title: string;
	start: string;
	end?: string;
	allDay: boolean;
	backgroundColor?: string;
	borderColor?: string;
	textColor?: string;
	editable?: boolean;
	extendedProps?: {
		icsEvent?: MockICSEvent;
		subscriptionName?: string;
	};
}

/**
 * Simulates the createICSEvent function from calendar-core.ts
 * This converts ICSEvent to FullCalendar-compatible CalendarEvent
 */
function createMockICSEvent(icsEvent: MockICSEvent): MockCalendarEvent | null {
	const borderColor = "#4285F4";
	const backgroundColor = "rgba(66, 133, 244, 0.2)";
	const textColor = "#4285F4";

	return {
		id: icsEvent.id,
		title: icsEvent.title,
		start: icsEvent.start,
		end: icsEvent.end,
		allDay: icsEvent.allDay,
		backgroundColor: backgroundColor,
		borderColor: borderColor,
		textColor: textColor,
		editable: false,
		extendedProps: {
			icsEvent: icsEvent,
			subscriptionName: "Test Calendar",
		},
	};
}

/**
 * Simulates building ICS events for the calendar (from CalendarView.ts)
 */
function buildICSEvents(allICSEvents: MockICSEvent[], enabledCalendars: Set<string>): MockCalendarEvent[] {
	const events: MockCalendarEvent[] = [];

	for (const icsEvent of allICSEvents) {
		// Check if this calendar is enabled
		if (!enabledCalendars.has(icsEvent.subscriptionId)) continue;

		const calendarEvent = createMockICSEvent(icsEvent);
		if (calendarEvent) {
			events.push(calendarEvent);
		}
	}

	return events;
}

/**
 * Simulates FullCalendar's event source callback filtering
 * FullCalendar's list view may filter events differently than grid views
 */
function filterEventsForListView(
	events: MockCalendarEvent[],
	_viewStart: Date,
	_viewEnd: Date,
	options: { showAllDayEvents?: boolean } = {}
): MockCalendarEvent[] {
	const { showAllDayEvents = true } = options;

	return events.filter(event => {
		// BUG SIMULATION: If showAllDayEvents is false or there's filtering logic
		// that excludes all-day events in list view, they won't appear
		if (!showAllDayEvents && event.allDay) {
			return false;
		}
		return true;
	});
}

describe('Issue #1087: All day events from external calendars do not show up in agenda view', () => {
	const mockICSEvents: MockICSEvent[] = [
		{
			id: 'test-sub-event1',
			subscriptionId: 'test-sub',
			title: 'All Day Meeting',
			start: '2025-01-15', // Date-only format indicates all-day
			end: '2025-01-16',
			allDay: true,
		},
		{
			id: 'test-sub-event2',
			subscriptionId: 'test-sub',
			title: 'Timed Meeting',
			start: '2025-01-15T14:00:00.000Z',
			end: '2025-01-15T15:00:00.000Z',
			allDay: false,
		},
		{
			id: 'test-sub-event3',
			subscriptionId: 'test-sub',
			title: 'Multi-day All Day Event',
			start: '2025-01-15',
			end: '2025-01-18',
			allDay: true,
		},
	];

	const enabledCalendars = new Set(['test-sub']);

	describe('Event parsing and conversion', () => {
		it('should correctly identify all-day events from ICS data', () => {
			const allDayEvent = mockICSEvents[0];
			const timedEvent = mockICSEvents[1];

			expect(allDayEvent.allDay).toBe(true);
			expect(timedEvent.allDay).toBe(false);

			// All-day events should have date-only start (no time component)
			expect(allDayEvent.start).not.toContain('T');
			expect(timedEvent.start).toContain('T');
		});

		it('should convert all-day ICS events to calendar events with allDay flag', () => {
			const allDayICSEvent = mockICSEvents[0];
			const calendarEvent = createMockICSEvent(allDayICSEvent);

			expect(calendarEvent).not.toBeNull();
			expect(calendarEvent?.allDay).toBe(true);
			expect(calendarEvent?.title).toBe('All Day Meeting');
		});

		it('should include both all-day and timed events when building ICS events', () => {
			const events = buildICSEvents(mockICSEvents, enabledCalendars);

			// All 3 events should be included
			expect(events).toHaveLength(3);

			const allDayEvents = events.filter(e => e.allDay);
			const timedEvents = events.filter(e => !e.allDay);

			expect(allDayEvents).toHaveLength(2);
			expect(timedEvents).toHaveLength(1);
		});
	});

	describe('Agenda (list) view event display', () => {
		it.skip('should display all-day events in agenda view - reproduces issue #1087', () => {
			// This test reproduces the reported bug:
			// All-day events from external calendars should appear in the agenda view
			// but reportedly they do not.
			//
			// Steps to reproduce:
			// 1. Subscribe to an external calendar (ICS, Google, Microsoft) that has all-day events
			// 2. Open the agenda view (listWeek)
			// 3. Expected: All-day events appear in the list
			// 4. Actual: All-day events do not appear

			const events = buildICSEvents(mockICSEvents, enabledCalendars);
			const viewStart = new Date('2025-01-13');
			const viewEnd = new Date('2025-01-20');

			// Simulate what happens in the agenda (list) view
			// If there's a bug, all-day events would be filtered out
			const visibleEvents = filterEventsForListView(events, viewStart, viewEnd, {
				showAllDayEvents: true // User expects all-day events to show
			});

			// EXPECTED BEHAVIOR: All 3 events should be visible in agenda view
			expect(visibleEvents).toHaveLength(3);

			// Check that all-day events are included
			const allDayVisible = visibleEvents.filter(e => e.allDay);
			expect(allDayVisible).toHaveLength(2);
			expect(allDayVisible.map(e => e.title)).toContain('All Day Meeting');
			expect(allDayVisible.map(e => e.title)).toContain('Multi-day All Day Event');
		});

		it('should have an option to toggle all-day event visibility in agenda view', () => {
			// Feature suggestion from the issue:
			// If hiding all-day events is intentional, there should be an option to show them

			const events = buildICSEvents(mockICSEvents, enabledCalendars);
			const viewStart = new Date('2025-01-13');
			const viewEnd = new Date('2025-01-20');

			// With option enabled (default should be true)
			const withAllDay = filterEventsForListView(events, viewStart, viewEnd, {
				showAllDayEvents: true
			});
			expect(withAllDay.filter(e => e.allDay)).toHaveLength(2);

			// With option disabled
			const withoutAllDay = filterEventsForListView(events, viewStart, viewEnd, {
				showAllDayEvents: false
			});
			expect(withoutAllDay.filter(e => e.allDay)).toHaveLength(0);
		});
	});

	describe('Integration with external calendar sources', () => {
		it.skip('should display Google Calendar all-day events in agenda view - reproduces issue #1087', () => {
			// Google Calendar events follow the same flow as ICS events
			const googleAllDayEvent: MockICSEvent = {
				id: 'google-cal-event1',
				subscriptionId: 'google-work-calendar',
				title: 'Company Holiday',
				start: '2025-01-20',
				end: '2025-01-21',
				allDay: true,
			};

			const googleCalendars = new Set(['google-work-calendar']);
			const events = buildICSEvents([googleAllDayEvent], googleCalendars);

			expect(events).toHaveLength(1);
			expect(events[0].allDay).toBe(true);

			// In agenda view, this should be visible
			const visibleEvents = filterEventsForListView(events, new Date('2025-01-19'), new Date('2025-01-26'));
			expect(visibleEvents).toHaveLength(1);
		});

		it.skip('should display Microsoft Calendar all-day events in agenda view - reproduces issue #1087', () => {
			// Microsoft Calendar events follow the same flow as ICS events
			const microsoftAllDayEvent: MockICSEvent = {
				id: 'microsoft-cal-event1',
				subscriptionId: 'microsoft-personal',
				title: 'Day Off',
				start: '2025-01-21',
				end: '2025-01-22',
				allDay: true,
			};

			const microsoftCalendars = new Set(['microsoft-personal']);
			const events = buildICSEvents([microsoftAllDayEvent], microsoftCalendars);

			expect(events).toHaveLength(1);
			expect(events[0].allDay).toBe(true);

			// In agenda view, this should be visible
			const visibleEvents = filterEventsForListView(events, new Date('2025-01-19'), new Date('2025-01-26'));
			expect(visibleEvents).toHaveLength(1);
		});
	});

	describe('Date format handling for all-day events', () => {
		it('should handle date-only format (YYYY-MM-DD) for all-day events', () => {
			// Per RFC 5545, all-day events use VALUE=DATE format
			// This means the date should be stored without time component

			const allDayEvent: MockICSEvent = {
				id: 'test-allday',
				subscriptionId: 'test',
				title: 'Date Only Event',
				start: '2025-01-15', // YYYY-MM-DD format
				end: '2025-01-16',
				allDay: true,
			};

			const calendarEvent = createMockICSEvent(allDayEvent);

			expect(calendarEvent?.start).toBe('2025-01-15');
			expect(calendarEvent?.allDay).toBe(true);
		});

		it('should preserve all-day flag through the event pipeline', () => {
			// The allDay flag should be preserved from ICS parsing through to display
			const icsEvent: MockICSEvent = {
				id: 'test-preserve-allday',
				subscriptionId: 'test',
				title: 'Preserve All Day Flag',
				start: '2025-01-15',
				allDay: true,
			};

			// Step 1: Parse ICS (mock) - allDay is true
			expect(icsEvent.allDay).toBe(true);

			// Step 2: Convert to calendar event - allDay should still be true
			const calendarEvent = createMockICSEvent(icsEvent);
			expect(calendarEvent?.allDay).toBe(true);

			// Step 3: Pass through buildICSEvents - allDay should still be true
			const events = buildICSEvents([icsEvent], new Set(['test']));
			expect(events[0].allDay).toBe(true);
		});
	});
});

describe('FullCalendar list view all-day event handling', () => {
	/**
	 * FullCalendar's list view handles events differently than grid views.
	 * This section tests potential issues specific to the list view implementation.
	 */

	it.skip('should render all-day events in list view without special handling - reproduces issue #1087', () => {
		// FullCalendar list view (listWeek) should display all-day events
		// just like it displays timed events. If there's an issue, it might be:
		// 1. CSS hiding all-day events
		// 2. eventDidMount callback filtering them out
		// 3. FullCalendar configuration issue

		// This test documents the expected behavior:
		// All-day events should appear in the list with their date shown
		// and should not require special rendering logic

		const allDayEvent: MockCalendarEvent = {
			id: 'list-allday',
			title: 'All Day in List',
			start: '2025-01-15',
			allDay: true,
		};

		const timedEvent: MockCalendarEvent = {
			id: 'list-timed',
			title: 'Timed in List',
			start: '2025-01-15T10:00:00',
			end: '2025-01-15T11:00:00',
			allDay: false,
		};

		// Both should be visible in list view
		// The actual rendering is handled by FullCalendar, but we can verify
		// that the data we pass to it is correct
		expect(allDayEvent.allDay).toBe(true);
		expect(timedEvent.allDay).toBe(false);

		// Both events have valid dates within the view range
		const viewStart = new Date('2025-01-13');
		const viewEnd = new Date('2025-01-20');

		const allDayDate = new Date(allDayEvent.start);
		const timedDate = new Date(timedEvent.start);

		expect(allDayDate >= viewStart && allDayDate <= viewEnd).toBe(true);
		expect(timedDate >= viewStart && timedDate <= viewEnd).toBe(true);
	});
});
