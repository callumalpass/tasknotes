/**
 * Issue #603: [FR] Visually identify related notes in Calendar
 *
 * @see https://github.com/callumalpass/tasknotes/issues/603
 *
 * Feature Request:
 * When showing calendar items (ICS events), it is not immediately visible
 * whether a calendar item has a related note in the vault. Users want a
 * visual indicator (icon and/or CSS class) on calendar events that have
 * linked notes or tasks.
 *
 * Current Behavior:
 * - ICS events are rendered in the calendar via createICSEvent() (calendar-core.ts)
 *   and displayed using ICSCard (ICSCard.ts) in list view or FullCalendar's
 *   default rendering in grid views.
 * - The handleEventDidMount() method (CalendarView.ts ~line 1688) adds
 *   a calendar icon for provider-managed events and sets data-event-type,
 *   but does NOT check for related notes.
 * - Related notes are only discoverable by clicking an ICS event to open
 *   the ICSEventInfoModal, which calls findRelatedNotes() asynchronously.
 * - There is no CSS class or visual indicator on the calendar event element
 *   itself to show that related notes exist.
 *
 * Expected Behavior:
 * - Calendar items with related notes should have a CSS class (e.g.,
 *   'has-related-note') always added to enable user CSS customization.
 * - An optional configurable icon should be displayed on events that have
 *   related notes, making them visually distinct at a glance.
 * - The check for related notes could be done during event mount or
 *   pre-computed when generating calendar events.
 *
 * Implementation Considerations:
 * - findRelatedNotes() is async (searches cache + vault frontmatter),
 *   so calling it during handleEventDidMount for every ICS event could
 *   impact performance.
 * - A better approach might be to pre-compute a Set of ICS event IDs
 *   that have related notes when generating calendar events, then use
 *   that Set during event mounting.
 * - The CSS class should always be added (not configurable) so users can
 *   style it themselves. The icon display should be configurable.
 *
 * Related Files:
 * - src/bases/CalendarView.ts: handleEventDidMount() (~line 1688)
 * - src/bases/calendar-core.ts: createICSEvent() (~line 542)
 * - src/services/ICSNoteService.ts: findRelatedNotes() (~line 324)
 * - src/ui/ICSCard.ts: createICSEventCard() (~line 39)
 * - src/modals/ICSEventInfoModal.ts: loadRelatedNotes() (~line 155)
 */

import { describe, it, expect } from '@jest/globals';
import type { ICSEvent, TaskInfo, NoteInfo } from '../../../src/types';

/**
 * Helper to create a minimal ICS event for testing
 */
function createTestICSEvent(overrides?: Partial<ICSEvent>): ICSEvent {
	return {
		id: 'test-event-001',
		subscriptionId: 'test-subscription',
		title: 'Team Meeting',
		start: '2025-02-15T10:00:00',
		end: '2025-02-15T11:00:00',
		allDay: false,
		...overrides,
	};
}

/**
 * Helper to create a TaskInfo linked to an ICS event
 */
function createLinkedTask(icsEventId: string): TaskInfo {
	return {
		title: 'Meeting Notes - Team Meeting',
		status: ' ',
		priority: '',
		path: 'tasks/meeting-notes.md',
		archived: false,
		icsEventId: [icsEventId],
		tags: ['ics-event'],
	};
}

/**
 * Helper to create a NoteInfo linked to an ICS event
 */
function createLinkedNote(title: string): NoteInfo {
	return {
		title,
		path: `notes/${title.toLowerCase().replace(/\s+/g, '-')}.md`,
		tags: ['ics-event'],
		createdDate: '2025-02-15T09:00:00',
		lastModified: Date.now(),
	};
}

describe('Issue #603: Visually identify related notes in Calendar', () => {
	describe('Calendar event elements should indicate related notes', () => {
		it.skip('reproduces issue #603 - ICS event with related note should have CSS class', () => {
			// An ICS event that has a linked task in the vault
			const icsEvent = createTestICSEvent({ id: 'event-with-note' });
			const linkedTask = createLinkedTask('event-with-note');

			// The ICS event has a related note
			expect(linkedTask.icsEventId).toContain(icsEvent.id);

			// When this event is rendered in the calendar via handleEventDidMount(),
			// the event element should receive a CSS class indicating it has related notes.
			//
			// Currently, handleEventDidMount() does NOT check for related notes.
			// It only sets data-event-type and adds a calendar icon for provider events.
			//
			// After the feature is implemented:
			// - The event element should have a class like 'has-related-note'
			// - This class should be added regardless of icon configuration
			//   so users can apply their own CSS styling
			//
			// Expected DOM:
			//   <div class="fc-event has-related-note" data-event-type="ics">...</div>
			//
			// For now, we verify the data relationships exist but the visual
			// indicator is missing from the rendering pipeline.
		});

		it.skip('reproduces issue #603 - ICS event without related note should NOT have CSS class', () => {
			// An ICS event that has no linked notes in the vault
			const icsEvent = createTestICSEvent({ id: 'event-without-note' });

			// Verify this event has no related notes (simulating empty findRelatedNotes result)
			const relatedNotes: (TaskInfo | NoteInfo)[] = [];
			expect(relatedNotes).toHaveLength(0);

			// After the feature is implemented:
			// - The event element should NOT have the 'has-related-note' class
			// - No icon should be displayed for events without related notes
			//
			// Expected DOM:
			//   <div class="fc-event" data-event-type="ics">...</div>
			//   (no 'has-related-note' class)
			expect(icsEvent.id).toBe('event-without-note');
		});

		it.skip('reproduces issue #603 - ICS event with multiple related notes should have CSS class', () => {
			// An ICS event linked to both a task and a note
			const icsEvent = createTestICSEvent({ id: 'event-with-multiple-notes' });
			const linkedTask = createLinkedTask('event-with-multiple-notes');
			const linkedNote = createLinkedNote('Meeting Discussion Notes');

			const relatedNotes: (TaskInfo | NoteInfo)[] = [linkedTask, linkedNote];

			expect(relatedNotes).toHaveLength(2);
			expect(linkedTask.icsEventId).toContain(icsEvent.id);

			// After the feature is implemented:
			// - The event element should have the 'has-related-note' class
			// - The icon (if configured) should be displayed
			// - The number of related notes could optionally be indicated
			//   (e.g., a badge count or tooltip)
		});
	});

	describe('ICSCard should show related note indicator in list view', () => {
		it.skip('reproduces issue #603 - ICSCard in list view should indicate related notes', () => {
			// In list view (listWeek), ICS events are rendered using createICSEventCard()
			// from ICSCard.ts. Currently, this card shows:
			// - Calendar icon (with subscription color)
			// - Event title
			// - Metadata line (time, location, source)
			//
			// After the feature is implemented:
			// - The card should include an indicator for related notes
			// - This could be an additional icon (e.g., 'file-text' or 'link')
			//   next to the title or in the metadata area
			// - The card element itself should also have the 'has-related-note' class
			//
			// The createICSEventCard() function currently doesn't receive any
			// information about related notes. The function signature would need
			// to be extended or the card would need to query for related notes.
			const icsEvent = createTestICSEvent();
			expect(icsEvent.title).toBe('Team Meeting');
		});
	});

	describe('Related notes pre-computation for performance', () => {
		it.skip('reproduces issue #603 - related notes should be pre-computed for calendar events', () => {
			// Calling findRelatedNotes() during handleEventDidMount() for every
			// ICS event would be expensive since it:
			// 1. Iterates all cached tasks checking icsEventId
			// 2. Iterates all markdown files reading frontmatter
			//
			// A better approach is to pre-compute a Set<string> of ICS event IDs
			// that have related notes, and pass this to the rendering pipeline.
			//
			// This could be done:
			// 1. When calendar events are generated (in generateCalendarEvents)
			// 2. As a separate pre-fetch step in CalendarView before rendering
			// 3. Maintained as a cache in ICSNoteService that updates on file changes
			//
			// The pre-computed set would allow O(1) lookup during event mount.

			const icsEventsWithNotes = new Set<string>();

			// Simulate pre-computing: scan all tasks for icsEventId references
			const allTasks: TaskInfo[] = [
				createLinkedTask('event-001'),
				createLinkedTask('event-003'),
			];

			for (const task of allTasks) {
				if (task.icsEventId) {
					for (const eventId of task.icsEventId) {
						icsEventsWithNotes.add(eventId);
					}
				}
			}

			// The set should contain event IDs that have related notes
			expect(icsEventsWithNotes.has('event-001')).toBe(true);
			expect(icsEventsWithNotes.has('event-003')).toBe(true);
			expect(icsEventsWithNotes.has('event-002')).toBe(false);

			// During handleEventDidMount, a simple set lookup determines
			// whether to add the CSS class and icon:
			//   if (icsEventsWithNotes.has(icsEvent.id)) {
			//     arg.el.classList.add('has-related-note');
			//   }
		});
	});

	describe('Configurable icon for related notes', () => {
		it.skip('reproduces issue #603 - related notes icon should be configurable', () => {
			// The feature request specifies that:
			// 1. CSS class should ALWAYS be added (not configurable)
			// 2. Icon should be configurable
			//
			// This means there should be a setting like:
			// - calendarViewSettings.relatedNoteIcon: string (e.g., 'file-text', 'link', 'note')
			// - calendarViewSettings.showRelatedNoteIcon: boolean (default: true)
			//
			// The CSS class 'has-related-note' is always added regardless of
			// whether the icon is shown, allowing users to add custom styling
			// via CSS snippets.

			const calendarSettings = {
				showRelatedNoteIcon: true,
				relatedNoteIcon: 'file-text',
			};

			// After the feature is implemented:
			// - The icon name should be used with Obsidian's setIcon() function
			// - If showRelatedNoteIcon is false, no icon is rendered but the
			//   CSS class is still applied
			expect(calendarSettings.showRelatedNoteIcon).toBe(true);
			expect(calendarSettings.relatedNoteIcon).toBe('file-text');
		});
	});
});
