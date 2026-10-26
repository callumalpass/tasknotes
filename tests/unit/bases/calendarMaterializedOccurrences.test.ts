import { getOccurrenceDateForEvent, getTargetDateForEvent } from "../../../src/bases/calendar-core";
import { formatDateForStorage } from "../../../src/utils/dateUtils";
import { TaskFactory } from "../../helpers/mock-factories";

function localDate(year: number, monthIndex: number, day: number): Date {
	return new Date(year, monthIndex, day);
}

describe("calendar occurrence menu identity", () => {
	it("uses the occurrence date, not the scheduled date, as the context-menu target date", () => {
		const targetDate = getTargetDateForEvent({
			event: {
				start: localDate(2026, 5, 3),
				extendedProps: {
					isMaterializedOccurrence: true,
					instanceDate: "2026-06-02",
				},
			},
		});

		expect(formatDateForStorage(targetDate)).toBe("2026-06-02");
	});
});


describe("calendar recurring occurrence context", () => {
	const recurringTask = TaskFactory.createRecurringTask("FREQ=WEEKLY", {
		scheduled: "2026-06-02T09:00",
	});

	it("uses instanceDate instead of the rendered event date", () => {
		const occurrenceDate = getOccurrenceDateForEvent(recurringTask, {
			event: {
				start: localDate(2026, 5, 9),
				extendedProps: { instanceDate: "2026-06-02" },
			},
		});

		expect(occurrenceDate && formatDateForStorage(occurrenceDate)).toBe("2026-06-02");
	});

	it("does not treat a recurring task's unrelated calendar event as an occurrence", () => {
		const occurrenceDate = getOccurrenceDateForEvent(recurringTask, {
			event: {
				start: localDate(2026, 5, 9),
				extendedProps: { eventType: "timeEntry" },
			},
		});

		expect(occurrenceDate).toBeUndefined();
	});

	it("requires a valid date-only instanceDate", () => {
		const occurrenceDate = getOccurrenceDateForEvent(recurringTask, {
			event: {
				extendedProps: { instanceDate: "not-a-date" },
			},
		});

		expect(occurrenceDate).toBeUndefined();
	});

	it("does not promote materialized occurrence notes to recurring parent context", () => {
		const occurrenceTask = TaskFactory.createTask({
			recurrence_parent: "[[Tasks/parent]]",
			occurrence_date: "2026-06-02",
		});
		const occurrenceDate = getOccurrenceDateForEvent(occurrenceTask, {
			event: {
				extendedProps: { instanceDate: "2026-06-02" },
			},
		});

		expect(occurrenceDate).toBeUndefined();
	});
});
