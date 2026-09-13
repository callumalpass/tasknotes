import type { EventInput } from "@fullcalendar/core";
import { execFileSync } from "node:child_process";
import {
	applyBasesSortIndexesToCalendarEvents,
	getTaskNotesCalendarEventOrder,
	hasBasesCalendarSortConfig,
	TASKNOTES_CALENDAR_SORT_INDEX,
} from "../../../src/bases/CalendarView";

describe("Issue #1411: Agenda Calendar Bases respect Bases sort order", () => {
	it("uses FullCalendar's default order when the Base has no sort config", () => {
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
			{ title: "Ready", start: 0, tasknotesSortIndex: 2 },
			{ title: "Doing", start: 0, tasknotesSortIndex: 1 },
		];
		// The suite mocks FullCalendar. Exercise its real comparator in Node.
		const sorted = JSON.parse(
			execFileSync(
				process.execPath,
				[
					"-e",
					"const {parseFieldSpecs,compareByFieldSpecs}=require('@fullcalendar/core/internal'); const events=JSON.parse(process.argv[2]); const specs=parseFieldSpecs(process.argv[1]); console.log(JSON.stringify(events.sort((a,b)=>compareByFieldSpecs(a,b,specs)).map(e=>e.title)));",
					order,
					JSON.stringify(events),
				],
				{ encoding: "utf8" }
			)
		);
		expect(sorted).toEqual([
			"Doing",
			"Ready",
			"Morning task",
			"Morning appointment",
			"Evening task",
		]);
	});

	it("adds Bases result indexes to task and property-based events", () => {
		const events: EventInput[] = [
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
			events,
			new Map([
				["Tasks/A.md", 0],
				["Tasks/B.md", 1],
			])
		);

		expect(events[0].extendedProps?.[TASKNOTES_CALENDAR_SORT_INDEX]).toBe(1);
		expect(events[1].extendedProps?.[TASKNOTES_CALENDAR_SORT_INDEX]).toBe(0);
		expect(events[2].extendedProps?.[TASKNOTES_CALENDAR_SORT_INDEX]).toBeUndefined();
	});
});
