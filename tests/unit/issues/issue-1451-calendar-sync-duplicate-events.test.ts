/**
 * Issue #1451 / #1538: Google Calendar events created by TaskNotes should not
 * render beside the same native TaskNotes task event.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1451
 * @see https://github.com/callumalpass/tasknotes/issues/1538
 */

import {
	getDisplayedTaskLinkedGoogleEventIds,
	getGoogleProviderEventId,
	isDisplayedTaskLinkedGoogleEvent,
} from "../../../src/bases/calendarEventDeduplication";
import type { ICSEvent } from "../../../src/types";

function googleEvent(overrides: Partial<ICSEvent> = {}): ICSEvent {
	return {
		id: "google-primary-event-123",
		subscriptionId: "google-primary",
		title: "Synced task",
		start: "2026-01-08T09:00:00",
		end: "2026-01-08T09:30:00",
		allDay: false,
		...overrides,
	};
}

describe("Issue #1451: synced Google Calendar event duplicates", () => {
	it("extracts the provider event id without being confused by hyphenated calendar ids", () => {
		const event = googleEvent({
			id: "google-family-shared-calendar-event-id-with-hyphens",
			subscriptionId: "google-family-shared-calendar",
		});

		expect(getGoogleProviderEventId(event)).toBe("event-id-with-hyphens");
	});

	it("collects Google event ids only from displayed native task events", () => {
		const displayedIds = getDisplayedTaskLinkedGoogleEventIds([
			{
				extendedProps: {
					taskInfo: {
						googleCalendarEventId: "event-123",
					},
				},
			},
			{
				extendedProps: {
					taskInfo: {},
				},
			},
		]);

		expect(displayedIds).toEqual(new Set(["event-123"]));
	});

	it("filters a Google event that matches a displayed TaskNotes task export", () => {
		const displayedIds = new Set(["event-123"]);

		expect(isDisplayedTaskLinkedGoogleEvent(googleEvent(), displayedIds)).toBe(true);
	});

	it("does not filter unrelated events from the same Google calendar", () => {
		const displayedIds = new Set(["event-123"]);

		expect(
			isDisplayedTaskLinkedGoogleEvent(
				googleEvent({ id: "google-primary-unrelated-event" }),
				displayedIds
			)
		).toBe(false);
	});

	it("does not filter the Google event when the matching TaskNotes task is not displayed", () => {
		expect(isDisplayedTaskLinkedGoogleEvent(googleEvent(), new Set())).toBe(false);
	});

	it("ignores non-Google external calendar events", () => {
		const displayedIds = new Set(["event-123"]);

		expect(
			isDisplayedTaskLinkedGoogleEvent(
				googleEvent({
					id: "microsoft-work-event-123",
					subscriptionId: "microsoft-work",
				}),
				displayedIds
			)
		).toBe(false);
	});
});
