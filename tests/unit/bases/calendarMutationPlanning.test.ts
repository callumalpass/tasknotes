import {
	buildProviderEventDateUpdate,
	planTaskCalendarDrop,
	planTaskCalendarResize,
	planTimeEntryDrop,
	planTimeEntryResize,
} from "../../../src/bases/calendarMutationPlanning";
import type { TimeEntry } from "../../../src/types";

function localDate(year: number, monthIndex: number, day: number, hour = 0, minute = 0): Date {
	return new Date(year, monthIndex, day, hour, minute);
}

describe("calendar mutation planning", () => {
	describe("task drop planning", () => {
		it("updates scheduled all-day events as date-only values", () => {
			const plan = planTaskCalendarDrop({
				eventType: "scheduled",
				taskInfo: {},
				newStart: localDate(2026, 4, 18),
				allDay: true,
			});

			expect(plan).toEqual({
				kind: "update-date-property",
				property: "scheduled",
				value: "2026-05-18",
			});
		});

		it("updates due timed events as local datetime values", () => {
			const plan = planTaskCalendarDrop({
				eventType: "due",
				taskInfo: {},
				newStart: localDate(2026, 4, 18, 14, 30),
				allDay: false,
			});

			expect(plan).toEqual({
				kind: "update-date-property",
				property: "due",
				value: "2026-05-18T14:30",
			});
		});

		it("shifts scheduled-to-due spans while preserving date-only and timed field formats", () => {
			const plan = planTaskCalendarDrop({
				eventType: "scheduledToDueSpan",
				taskInfo: {
					scheduled: "2026-05-18T09:15",
					due: "2026-05-20",
				},
				oldStart: localDate(2026, 4, 18),
				newStart: localDate(2026, 4, 21),
				allDay: true,
			});

			expect(plan).toEqual({
				kind: "update-scheduled-due-span",
				scheduled: "2026-05-21T09:15",
				due: "2026-05-23",
			});
		});

		it("reverts task drops when FullCalendar does not provide the required dates", () => {
			expect(
				planTaskCalendarDrop({
					eventType: "scheduled",
					taskInfo: {},
					newStart: null,
					allDay: true,
				})
			).toEqual({ kind: "revert", reason: "missing-new-start" });

			expect(
				planTaskCalendarDrop({
					eventType: "scheduledToDueSpan",
					taskInfo: { scheduled: "2026-05-18", due: "2026-05-20" },
					oldStart: null,
					newStart: localDate(2026, 4, 21),
					allDay: true,
				})
			).toEqual({ kind: "revert", reason: "missing-old-start" });
		});
	});

	describe("task resize planning", () => {
		it("converts all-day exclusive ranges to minute estimates", () => {
			const plan = planTaskCalendarResize({
				eventType: "scheduled",
				start: localDate(2026, 4, 18),
				end: localDate(2026, 4, 20),
				allDay: true,
			});

			expect(plan).toEqual({ kind: "update-time-estimate", value: 2880 });
		});

		it("converts timed ranges to minute estimates", () => {
			const plan = planTaskCalendarResize({
				eventType: "recurring",
				start: localDate(2026, 4, 18, 10, 15),
				end: localDate(2026, 4, 18, 11, 45),
				allDay: false,
			});

			expect(plan).toEqual({ kind: "update-time-estimate", value: 90 });
		});

		it("reverts unsupported event types and ignores missing resize ranges", () => {
			expect(
				planTaskCalendarResize({
					eventType: "due",
					start: localDate(2026, 4, 18),
					end: localDate(2026, 4, 19),
					allDay: true,
				})
			).toEqual({ kind: "revert", reason: "unsupported-event-type" });

			expect(
				planTaskCalendarResize({
					eventType: "scheduled",
					start: localDate(2026, 4, 18),
					end: null,
					allDay: false,
				})
			).toEqual({ kind: "ignore", reason: "missing-range" });
		});
	});

	describe("time entry planning", () => {
		const entries: TimeEntry[] = [
			{
				startTime: "2026-05-18T00:00:00.000Z",
				endTime: "2026-05-18T01:00:00.000Z",
				duration: 60,
			},
			{
				startTime: "2026-05-18T02:00:00.000Z",
				endTime: "2026-05-18T03:00:00.000Z",
				duration: 60,
			},
		];

		it("shifts a dragged time entry and removes stale duration fields from all entries", () => {
			const plan = planTimeEntryDrop({
				timeEntries: entries,
				timeEntryIndex: 0,
				oldStart: localDate(2026, 4, 18, 10),
				newStart: localDate(2026, 4, 18, 11, 30),
				newEnd: localDate(2026, 4, 18, 12, 30),
			});

			expect(plan.kind).toBe("update-time-entries");
			if (plan.kind !== "update-time-entries") return;
			expect(plan.timeEntries[0]).toEqual({
				startTime: "2026-05-18T01:30:00.000Z",
				endTime: "2026-05-18T02:30:00.000Z",
			});
			expect(plan.timeEntries[1]).toEqual({
				startTime: "2026-05-18T02:00:00.000Z",
				endTime: "2026-05-18T03:00:00.000Z",
			});
		});

		it("resizes a time entry by replacing its start and end timestamps", () => {
			const plan = planTimeEntryResize({
				timeEntries: entries,
				timeEntryIndex: 1,
				newStart: new Date("2026-05-19T04:00:00.000Z"),
				newEnd: new Date("2026-05-19T05:15:00.000Z"),
			});

			expect(plan.kind).toBe("update-time-entries");
			if (plan.kind !== "update-time-entries") return;
			expect(plan.timeEntries[1]).toEqual({
				startTime: "2026-05-19T04:00:00.000Z",
				endTime: "2026-05-19T05:15:00.000Z",
			});
		});

		it("reverts dragged running entries because they do not have a fixed end", () => {
			expect(
				planTimeEntryDrop({
					timeEntries: [{ startTime: "2026-05-18T00:00:00.000Z" }],
					timeEntryIndex: 0,
					oldStart: localDate(2026, 4, 18, 10),
					newStart: localDate(2026, 4, 18, 11),
					newEnd: localDate(2026, 4, 18, 12),
				})
			).toEqual({ kind: "revert", reason: "missing-entry-end" });
		});
	});

	describe("provider update planning", () => {
		it("defaults missing drag end dates before updating all-day provider events", () => {
			const plan = buildProviderEventDateUpdate({
				start: localDate(2026, 4, 18),
				end: null,
				allDay: true,
				timezone: "Australia/Melbourne",
			});

			expect(plan).toEqual({
				kind: "update-provider-event",
				updates: {
					start: { date: "2026-05-18" },
					end: { date: "2026-05-19" },
				},
			});
		});

		it("uses timezone-aware datetime payloads for timed provider events", () => {
			const plan = buildProviderEventDateUpdate({
				start: localDate(2026, 4, 18, 9),
				end: localDate(2026, 4, 18, 10, 30),
				allDay: false,
				timezone: "Australia/Melbourne",
			});

			expect(plan.kind).toBe("update-provider-event");
			if (plan.kind !== "update-provider-event") return;
			expect(plan.updates.start).toEqual({
				dateTime: expect.any(String),
				timeZone: "Australia/Melbourne",
			});
			expect(plan.updates.end).toEqual({
				dateTime: expect.any(String),
				timeZone: "Australia/Melbourne",
			});
		});

		it("requires explicit end dates for provider resize updates", () => {
			expect(
				buildProviderEventDateUpdate({
					start: localDate(2026, 4, 18, 9),
					end: null,
					allDay: false,
					timezone: "Australia/Melbourne",
					requireEnd: true,
				})
			).toEqual({ kind: "revert", reason: "missing-end" });
		});
	});
});
