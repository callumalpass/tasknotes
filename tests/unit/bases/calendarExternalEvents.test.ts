import {
	buildExternalCalendarEvents,
	buildLinkedExternalCalendarEventPredicate,
	getExternalCalendarToggleId,
	shouldIncludeExternalCalendarEvent,
} from "../../../src/bases/calendarExternalEvents";
import type TaskNotesPlugin from "../../../src/main";
import type { ICSEvent, TaskInfo } from "../../../src/types";

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

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		path: "Tasks/task-1.md",
		title: "Task one",
		...overrides,
	} as TaskInfo;
}

function createPlugin(
	targetCalendarId = "primary"
): TaskNotesPlugin {
	return {
		settings: {
			googleCalendarExport: { targetCalendarId },
		},
	} as unknown as TaskNotesPlugin;
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

describe("buildLinkedExternalCalendarEventPredicate", () => {
	it("returns a never-match predicate for non-google providers", () => {
		const predicate = buildLinkedExternalCalendarEventPredicate(
			[createTask({ googleCalendarEventId: "abc" })],
			"microsoft",
			createPlugin()
		);

		expect(predicate(createEvent({ id: "microsoft-work-abc", subscriptionId: "microsoft-work" }))).toBe(false);
	});

	it("returns a never-match predicate when no tasks carry google event ids", () => {
		const predicate = buildLinkedExternalCalendarEventPredicate(
			[createTask()],
			"google",
			createPlugin()
		);

		expect(predicate(createEvent({ id: "google-primary-abc", subscriptionId: "google-primary" }))).toBe(false);
	});

	it("filters a google event whose raw id matches a task googleCalendarEventId", () => {
		const predicate = buildLinkedExternalCalendarEventPredicate(
			[createTask({ googleCalendarEventId: "abc123" })],
			"google",
			createPlugin("primary")
		);

		const linked = createEvent({
			id: "google-primary-abc123",
			subscriptionId: "google-primary",
		});
		const unrelated = createEvent({
			id: "google-primary-other",
			subscriptionId: "google-primary",
		});

		expect(predicate(linked)).toBe(true);
		expect(predicate(unrelated)).toBe(false);
	});

	it("retains events from a different google calendar than the export target", () => {
		const predicate = buildLinkedExternalCalendarEventPredicate(
			[createTask({ googleCalendarEventId: "abc123" })],
			"google",
			createPlugin("primary")
		);

		const otherCalendarEvent = createEvent({
			id: "google-secondary-abc123",
			subscriptionId: "google-secondary",
		});

		expect(predicate(otherCalendarEvent)).toBe(false);
	});

	it("filters a detached recurring exception by googleCalendarExceptionEventId", () => {
		const predicate = buildLinkedExternalCalendarEventPredicate(
			[
				createTask({
					googleCalendarEventId: "master123",
					googleCalendarExceptionEventId: "exception456",
				}),
			],
			"google",
			createPlugin("primary")
		);

		const exception = createEvent({
			id: "google-primary-exception456",
			subscriptionId: "google-primary",
			recurringEventId: "google-primary-master123",
		});

		expect(predicate(exception)).toBe(true);
	});

	it("filters expanded recurring instances whose recurringEventId matches a task master id", () => {
		const predicate = buildLinkedExternalCalendarEventPredicate(
			[createTask({ googleCalendarEventId: "master123" })],
			"google",
			createPlugin("primary")
		);

		const instance = createEvent({
			id: "google-primary-20260518T090000Z",
			subscriptionId: "google-primary",
			recurringEventId: "google-primary-master123",
		});
		const unrelatedInstance = createEvent({
			id: "google-primary-20260519T090000Z",
			subscriptionId: "google-primary",
			recurringEventId: "google-primary-otherMaster",
		});

		expect(predicate(instance)).toBe(true);
		expect(predicate(unrelatedInstance)).toBe(false);
	});

	it("handles calendar ids containing hyphens when stripping the prefix", () => {
		const predicate = buildLinkedExternalCalendarEventPredicate(
			[createTask({ googleCalendarEventId: "abc123" })],
			"google",
			createPlugin("family@group.calendar.google.com")
		);

		const linked = createEvent({
			id: "google-family@group.calendar.google.com-abc123",
			subscriptionId: "google-family@group.calendar.google.com",
		});

		expect(predicate(linked)).toBe(true);
	});
});

describe("buildExternalCalendarEvents linked-event filtering", () => {
	it("drops linked google events while retaining unrelated ones", () => {
		const sourceEvents: ICSEvent[] = [
			createEvent({ id: "google-primary-linked", subscriptionId: "google-primary" }),
			createEvent({ id: "google-primary-unrelated", subscriptionId: "google-primary" }),
		];
		const createCalendarEvent = jest.fn((event: ICSEvent) => ({
			id: event.id,
			title: event.title,
			start: event.start,
			allDay: event.allDay,
			extendedProps: { eventType: "ics" as const },
		}));

		const isLinkedToTask = buildLinkedExternalCalendarEventPredicate(
			[createTask({ googleCalendarEventId: "linked" })],
			"google",
			createPlugin("primary")
		);

		const events = buildExternalCalendarEvents({
			events: sourceEvents,
			provider: "google",
			plugin: createPlugin("primary"),
			createEvent: createCalendarEvent,
			isLinkedToTask,
		});

		expect(events).toEqual([
			{
				id: "google-primary-unrelated",
				title: "Planning",
				start: "2026-05-18T09:00",
				allDay: false,
				extendedProps: { eventType: "ics" },
			},
		]);
		expect(createCalendarEvent).toHaveBeenCalledTimes(1);
		expect(createCalendarEvent).toHaveBeenCalledWith(
			sourceEvents[1],
			expect.anything(),
			expect.anything()
		);
	});

	it("retains all events when no isLinkedToTask predicate is supplied", () => {
		const sourceEvents: ICSEvent[] = [
			createEvent({ id: "google-primary-a", subscriptionId: "google-primary" }),
			createEvent({ id: "google-primary-b", subscriptionId: "google-primary" }),
		];
		const createCalendarEvent = jest.fn((event: ICSEvent) => ({
			id: event.id,
			title: event.title,
			start: event.start,
			allDay: event.allDay,
		}));

		const events = buildExternalCalendarEvents({
			events: sourceEvents,
			provider: "google",
			plugin: createPlugin("primary"),
			createEvent: createCalendarEvent,
		});

		expect(events).toHaveLength(2);
	});
});
