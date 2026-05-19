import {
	collectCalendarInitialDateCandidates,
	determineCalendarInitialDate,
	getCalendarRecreateNavigationState,
	toCalendarInitialDateCandidate,
} from "../../../src/bases/calendarInitialDate";
import type { TaskInfo } from "../../../src/types";

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Task",
		status: "open",
		priority: "normal",
		path: "Tasks/task.md",
		archived: false,
		...overrides,
	};
}

describe("calendarInitialDate", () => {
	it("normalizes explicit initial dates before reading property-backed candidates", () => {
		const result = determineCalendarInitialDate({
			viewOptions: {
				initialDate: "2031-04-05T09:30:00",
				initialDateProperty: "note.date",
				initialDateStrategy: "earliest",
			},
			taskNotes: [],
			entries: [{ "note.date": "2031-01-10" }],
			getEntryPropertyValue: (entry, propertyId) =>
				(entry as Record<string, unknown>)[propertyId],
			mapPropertyToTaskField: (propertyId) => propertyId,
		});

		expect(result).toBe("2031-04-05T09:30");
	});

	it("returns undefined when no explicit date or valid property candidates exist", () => {
		const result = determineCalendarInitialDate({
			viewOptions: {
				initialDate: "",
				initialDateProperty: "note.date",
				initialDateStrategy: "first",
			},
			taskNotes: [createTask({ customProperties: { date: "not a date" } })],
			entries: [{ "note.date": "" }],
			getEntryPropertyValue: (entry, propertyId) =>
				(entry as Record<string, unknown>)[propertyId],
			mapPropertyToTaskField: (propertyId) => propertyId.replace(/^note\./, ""),
		});

		expect(result).toBeUndefined();
	});

	it("prefers valid Bases entry candidates over TaskInfo fallback values", () => {
		const candidates = collectCalendarInitialDateCandidates({
			propertyId: "note.date",
			taskNotes: [createTask({ customProperties: { date: "2031-12-20" } })],
			entries: [{ "note.date": "2031-01-10" }],
			getEntryPropertyValue: (entry, propertyId) =>
				(entry as Record<string, unknown>)[propertyId],
			mapPropertyToTaskField: (propertyId) => propertyId.replace(/^note\./, ""),
		});

		expect(candidates.map((candidate) => candidate.value)).toEqual(["2031-01-10"]);
	});

	it("uses TaskInfo top-level fields before custom property fallback values", () => {
		const candidates = collectCalendarInitialDateCandidates({
			propertyId: "task.scheduled",
			taskNotes: [
				createTask({
					scheduled: "2031-05-01",
					customProperties: { scheduled: "2031-06-01" },
				}),
			],
			mapPropertyToTaskField: () => "scheduled",
		});

		expect(candidates.map((candidate) => candidate.value)).toEqual(["2031-05-01"]);
	});

	it("builds comparable candidates for all-day and timed date values", () => {
		expect(toCalendarInitialDateCandidate("2031-04-05")?.value).toBe("2031-04-05");
		expect(toCalendarInitialDateCandidate("2031-04-05T09:30:00")?.value).toBe(
			"2031-04-05T09:30"
		);
		expect(toCalendarInitialDateCandidate("not a date")).toBeNull();
	});

	it("captures the config fields that control calendar recreate navigation", () => {
		expect(
			getCalendarRecreateNavigationState({
				initialDate: "2031-04-05",
				initialDateProperty: "note.date",
				initialDateStrategy: "latest",
			})
		).toEqual({
			initialDate: "2031-04-05",
			initialDateProperty: "note.date",
			initialDateStrategy: "latest",
		});
	});
});
