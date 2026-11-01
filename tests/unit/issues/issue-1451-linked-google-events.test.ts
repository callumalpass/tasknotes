jest.mock("rrule", () => jest.requireActual("rrule/dist/es5/rrule.js"));

import { CalendarView } from "../../../src/bases/CalendarView";
import { MiniCalendarView } from "../../../src/bases/MiniCalendarView";
import { CalendarTaskProjection } from "../../../src/bases/calendarModelEvents";
import { buildLinkedGoogleEventPredicate } from "../../../src/bases/calendarExternalEvents";
import { buildCalendarDataSignature, buildCalendarDataSignaturePropertyIds } from "../../../src/bases/calendarDataSignature";
import { createTaskInfoFromBasesData } from "../../../src/bases/helpers";
import { FieldMapper } from "../../../src/core/FieldMapper";
import { DEFAULT_FIELD_MAPPING } from "../../../src/core/defaultFieldMapping";
import { TaskFactory } from "../../helpers/mock-factories";
import type TaskNotesPlugin from "../../../src/main";
import type { ICSEvent, TaskInfo } from "../../../src/types";

const day = "2026-05-19";
const calendarId = "my-work-calendar@example.com";
const range = { start: new Date(`${day}T00:00:00Z`), end: new Date("2026-05-22T00:00:00Z") };
function googleEvent(id = "exported", date = day, extra: Partial<ICSEvent> = {}): ICSEvent {
	return { id: `google-${calendarId}-${id}`, subscriptionId: `google-${calendarId}`,
		title: "Exported task", start: date, allDay: true, ...extra };
}
function plugin(events: ICSEvent[] = []) {
	return {
		settings: { googleCalendarExport: { targetCalendarId: calendarId } },
		googleCalendarService: {
			getAllEvents: () => events,
			getAvailableCalendars: () => [{ id: calendarId, primary: true, summary: "Work" }],
		},
		statusManager: { getCompletedStatuses: () => ["done"] },
		priorityManager: { getPriorityConfig: () => ({ color: "#3366ff" }) },
		icsNoteService: { getRelatedNoteCountsByEventId: async () => new Map() },
		cacheManager: { getCachedTaskInfoSync: () => null },
	} as unknown as TaskNotesPlugin;
}
function calendar(tasks: TaskInfo[], events: ICSEvent[], options: Record<string, unknown> = {}) {
	const host = plugin(events);
	const setItems = jest.fn();
	const view = Object.assign(Object.create(CalendarView.prototype), {
		plugin: host, currentTasks: tasks, identityTasks: tasks,
		calendarTimezone: "UTC", basesSortIndexByPath: new Map(),
		viewOptions: { showScheduled: true, showDue: true, showRecurring: true, showAllDaySlot: true, ...options },
		taskProjection: new CalendarTaskProjection({ timezone: "UTC", now: `${day}T12:00:00Z` }, () => {}),
		googleCalendarToggles: new Map(), nonTaskEvents: [], refetchSeq: 0,
		calendar: { getView: () => ({ range, type: "week" }), setItems },
	}) as any;
	return { view, setItems };
}
const task = TaskFactory.createTask({ path: "Tasks/Task.md", scheduled: day, due: undefined, googleCalendarEventId: "exported" });

describe("Issue 1451: hide only represented Google exports", () => {
	it("matches direct ids, recurring instances and detached exceptions, but not other calendars or days", () => {
		const isLinked = buildLinkedGoogleEventPredicate([{ task: { ...task, googleCalendarExceptionEventId: "exception" }, date: day }], plugin());
		expect(isLinked(googleEvent())).toBe(true);
		expect(isLinked(googleEvent("instance", day, { recurringEventId: `google-${calendarId}-exported` }))).toBe(true);
		expect(isLinked(googleEvent("exception"))).toBe(true);
		expect(isLinked(googleEvent("unrelated"))).toBe(false);
		expect(isLinked(googleEvent("exported", "2026-05-20"))).toBe(false);
		expect(isLinked(googleEvent("exported", day, { subscriptionId: "google-other" }))).toBe(false);
	});

	it.each(["primary", calendarId])("resolves primary aliases with export target %s", target => {
		const host = plugin();
		host.settings.googleCalendarExport.targetCalendarId = target;
		const isLinked = buildLinkedGoogleEventPredicate([{ task, date: day }], host);
		expect(isLinked(googleEvent())).toBe(true);
		expect(isLinked(googleEvent("exported", day, { id: "google-primary-exported", subscriptionId: "google-primary" }))).toBe(true);
	});

	it.each([
		[{}, false],
		[{ showScheduled: false }, true],
		[{ showDue: false }, false],
	])("respects the Calendar's rendered scheduled layer %j", async (options, visible) => {
		const { view } = calendar([task], [googleEvent()], options);
		const events = await view.buildAllEvents({ range, type: "week" });
		expect(events.some((event: { id: string }) => event.id === googleEvent().id)).toBe(visible);
	});

	it("keeps the Google event when only the due layer exists and is disabled", async () => {
		const { view } = calendar([{ ...task, scheduled: undefined, due: day }], [googleEvent()], { showDue: false });
		expect((await view.buildAllEvents({ range, type: "week" })).map((e: { id: string }) => e.id)).toContain(googleEvent().id);
	});

	it("keeps recurring instances beyond the actual scheduled entry when their layer is off", async () => {
		const event = googleEvent("instance", "2026-05-20", { recurringEventId: `google-${calendarId}-exported` });
		const { view } = calendar([{ ...task, recurrence: "DTSTART:20260519T000000Z\nRRULE:FREQ=DAILY;COUNT=3" }], [event], { showRecurring: false });
		expect((await view.buildAllEvents({ range, type: "week" })).map((e: { id: string }) => e.id)).toContain(event.id);
	});

	it("suppresses each rendered recurring occurrence when the recurring layer is on", async () => {
		const event = googleEvent("instance", "2026-05-20", { recurringEventId: `google-${calendarId}-exported` });
		const { view } = calendar([{ ...task, recurrence: "DTSTART:20260519\nRRULE:FREQ=DAILY;COUNT=3" }], [event]);
		const events = await view.buildAllEvents({ range, type: "week" });
		expect(events.some((e: { id: string }) => e.id === event.id)).toBe(false);
		expect(events.some((e: { id: string }) => e.id === `recurring-${task.path}-2026-05-20`)).toBe(true);
	});

	it("re-evaluates suppression after an exception-id-only incremental update", async () => {
		const event = googleEvent("detached");
		const { view, setItems } = calendar([task], [event]);
		await view.buildAllEvents({ range, type: "week" });
		await view.refreshCalendarWithFreshData({ ...task, googleCalendarExceptionEventId: "detached" });
		expect(setItems.mock.calls.at(-1)[0].map((e: { id: string }) => e.id)).not.toContain(event.id);
		await view.refreshCalendarWithFreshData(task);
		expect(setItems.mock.calls.at(-1)[0].map((e: { id: string }) => e.id)).toContain(event.id);
	});

	it("includes mapped Google ids without a task cache entry", () => {
		const host = plugin();
		host.fieldMapper = new FieldMapper({ ...DEFAULT_FIELD_MAPPING, googleCalendarEventId: "gcal", googleCalendarExceptionEventId: "gcalException" });
		const converted = createTaskInfoFromBasesData({ path: task.path, properties: { title: "Task", gcal: "exported", gcalException: "detached" } }, host)!;
		expect(converted.googleCalendarEventId).toBe("exported");
		expect(converted.googleCalendarExceptionEventId).toBe("detached");
	});

	it("invalidates the Bases data signature when only the mapped exception id changes", () => {
		const fields = buildCalendarDataSignaturePropertyIds({ mapField: f => f === "googleCalendarExceptionEventId" ? "gcalException" : undefined, showPropertyBasedEvents: false });
		expect(buildCalendarDataSignature([{ path: task.path, properties: {} }], fields)).not.toBe(
			buildCalendarDataSignature([{ path: task.path, properties: { gcalException: "detached" } }], fields)
		);
	});

	it.each([undefined, "2026-05-20", day])("Mini Calendar suppresses only its indexed date (%s)", date => {
		const events = [googleEvent(), googleEvent("later", "2026-05-20", { recurringEventId: `google-${calendarId}-exported` })];
		const host = plugin(events);
		host.fieldMapper = new FieldMapper({ ...DEFAULT_FIELD_MAPPING, googleCalendarEventId: "gcal" });
		const item = { file: { path: task.path, basename: "Task" }, properties: { title: "Task", gcal: "exported", due: date }, getValue: () => null };
		const view = Object.assign(Object.create(MiniCalendarView.prototype), {
			plugin: host, notesByDate: new Map(), dateProperty: "note.due",
			googleCalendarToggles: new Map(),
			dataAdapter: {
				extractDataItems: () => [{ path: task.path, properties: item.properties }],
				getPropertyValue: () => date,
			},
		}) as any;
		view.indexNotesByDate([item]);
		const externalIds = Array.from(view.notesByDate.values() as Iterable<Array<{ externalEvent?: ICSEvent }>>)
			.flat().flatMap(e => e.externalEvent ? [e.externalEvent.id] : []);
		expect(externalIds.includes(events[0].id)).toBe(date !== day);
		expect(externalIds.includes(events[1].id)).toBe(date !== "2026-05-20");
	});
});
