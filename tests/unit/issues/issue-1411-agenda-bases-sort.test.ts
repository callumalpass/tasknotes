import { parseOrder, type NormalizedItem } from "@tasknotes/calendar";
import {
	applyBasesSortIndexesToCalendarEvents,
	getTaskNotesCalendarEventOrder,
	hasBasesCalendarSortConfig,
	TASKNOTES_CALENDAR_SORT_INDEX,
} from "../../../src/bases/CalendarView";
import type { CalendarEventInput } from "../../../src/bases/calendarEngine";
import { calendarOptionsFor } from "../../helpers/calendarViewHarness";

describe("Issue #1411: Agenda Calendar Bases respect Bases sort order", () => {
	it("uses the calendar's default order when the Base has no sort config", () => {
		expect(hasBasesCalendarSortConfig(undefined)).toBe(false);
		expect(hasBasesCalendarSortConfig([])).toBe(false);
		expect(getTaskNotesCalendarEventOrder(undefined)).toBe("start,-duration,allDay,title");
	});

	it("uses Bases order after event time, before duration and title", () => {
		const sortConfig = [{ column: "note.status", direction: "ASC" }];

		expect(hasBasesCalendarSortConfig(sortConfig)).toBe(true);
		expect(getTaskNotesCalendarEventOrder(sortConfig)).toBe(
			`start,allDay,${TASKNOTES_CALENDAR_SORT_INDEX},-duration,title`
		);
	});

	it("interleaves timed tasks with appointments while sorting untimed tasks by Bases rank", () => {
		const order = getTaskNotesCalendarEventOrder([{ column: "status" }]);
		const events = [
			{ title: "Evening task", start: 20, tasknotesSortIndex: 0 },
			{ title: "Morning appointment", start: 9 },
			{ title: "Morning task", start: 8, tasknotesSortIndex: 3 },
			{ title: "Doing", start: 0, tasknotesSortIndex: 2 },
			{ title: "Ready", start: 0, tasknotesSortIndex: 1 },
		];
		const items = events.map(({ title, start, tasknotesSortIndex }) => ({
			id: title,
			allDay: start === 0,
			startMs: start,
			endMs: start + 1,
			item: { id: title, title, start: "", data: { tasknotesSortIndex } },
		})) as unknown as NormalizedItem[];
		const sorted = items.sort(parseOrder(order)).map((item) => item.id);
		expect(sorted).toEqual([
			"Ready",
			"Doing",
			"Morning task",
			"Morning appointment",
			"Evening task",
		]);
	});

	it("adds Bases result indexes to task and property-based events", () => {
		const events = [
			{
				id: "scheduled-task-b",
				title: "B",
				extendedProps: {
					taskInfo: { path: "Tasks/B.md" },
				},
			},
			{
				id: "property-a",
				title: "A",
				extendedProps: {
					eventType: "property-based",
					filePath: "Tasks/A.md",
				},
			},
			{
				id: "external",
				title: "External",
				extendedProps: {
					eventType: "ics",
				},
			},
		];

		applyBasesSortIndexesToCalendarEvents(
			events as unknown as CalendarEventInput[],
			new Map([
				["Tasks/A.md", 0],
				["Tasks/B.md", 1],
			])
		);

		expect((events[0].extendedProps as Record<string, unknown>)[TASKNOTES_CALENDAR_SORT_INDEX]).toBe(1);
		expect((events[1].extendedProps as Record<string, unknown>)[TASKNOTES_CALENDAR_SORT_INDEX]).toBe(0);
		expect((events[2].extendedProps as Record<string, unknown>)[TASKNOTES_CALENDAR_SORT_INDEX]).toBeUndefined();
	});

	it("passes the Bases sort order to the calendar", () => {
		const sort = [{ property: "note.status", direction: "ASC" }];

		expect(calendarOptionsFor({}, { sort }).eventOrder).toBe(
			getTaskNotesCalendarEventOrder(sort)
		);
		expect(calendarOptionsFor({}).eventOrder).toBe(getTaskNotesCalendarEventOrder([]));
		document.body.replaceChildren();
	});
});
