import {
	buildExternalCalendarEvents,
	getExternalCalendarToggleId,
	shouldIncludeExternalCalendarEvent,
} from "../../../src/bases/calendarExternalEvents";
import type TaskNotesPlugin from "../../../src/main";
import type { ICSEvent } from "../../../src/types";

function createEvent(overrides: Partial<ICSEvent> = {}): ICSEvent {
	return {
		id: "event-1",
		subscriptionId: "calendar-1",
		title: "Planning",
		start: "2026-05-18T09:00",
		end: "2026-05-18T10:00",
		allDay: false,
		...overrides,
	};
}

describe("calendar external event assembly", () => {
	it("uses provider-specific toggle ids", () => {
		expect(
			getExternalCalendarToggleId(createEvent({ subscriptionId: "calendar-1" }), "ics")
		).toBe("calendar-1");
		expect(
			getExternalCalendarToggleId(
				createEvent({ subscriptionId: "google-primary" }),
				"google"
			)
		).toBe("primary");
		expect(
			getExternalCalendarToggleId(
				createEvent({ subscriptionId: "microsoft-work" }),
				"microsoft"
			)
		).toBe("work");
	});

	it("filters events disabled by calendar toggles", () => {
		const toggles = new Map<string, boolean>([["primary", false]]);

		expect(
			shouldIncludeExternalCalendarEvent(
				createEvent({ subscriptionId: "google-primary" }),
				"google",
				toggles
			)
		).toBe(false);
		expect(
			shouldIncludeExternalCalendarEvent(
				createEvent({ subscriptionId: "google-secondary" }),
				"google",
				toggles
			)
		).toBe(true);
	});

	it("builds provider events with related note counts", () => {
		const sourceEvents = [
			createEvent({ id: "included", subscriptionId: "microsoft-work" }),
			createEvent({ id: "disabled", subscriptionId: "microsoft-personal" }),
		];
		const createCalendarEvent = jest.fn((event: ICSEvent) => ({
			id: event.id,
			title: event.title,
			start: event.start,
			allDay: event.allDay,
			extendedProps: { eventType: "ics" as const },
		}));

		const events = buildExternalCalendarEvents({
			events: sourceEvents,
			provider: "microsoft",
			plugin: {} as TaskNotesPlugin,
			toggles: new Map<string, boolean>([["personal", false]]),
			relatedNoteCountsByEventId: new Map<string, number>([["included", 2]]),
			createEvent: createCalendarEvent,
		});

		expect(events).toEqual([
			{
				id: "included",
				title: "Planning",
				start: "2026-05-18T09:00",
				allDay: false,
				extendedProps: { eventType: "ics" },
			},
		]);
		expect(createCalendarEvent).toHaveBeenCalledWith(sourceEvents[0], {}, {
			relatedNoteCount: 2,
		});
		expect(createCalendarEvent).not.toHaveBeenCalledWith(
			sourceEvents[1],
			expect.anything(),
			expect.anything()
		);
	});

	it("skips events when the provider factory returns null", () => {
		const events = buildExternalCalendarEvents({
			events: [createEvent()],
			provider: "ics",
			plugin: {} as TaskNotesPlugin,
			createEvent: () => null,
		});

		expect(events).toEqual([]);
	});
});
