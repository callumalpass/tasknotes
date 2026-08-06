import { generateCalendarEvents, type CalendarEvent } from "../../../src/bases/calendar-core";
import type TaskNotesPlugin from "../../../src/main";
import { TaskFactory } from "../../helpers/mock-factories";

function createPlugin(): TaskNotesPlugin {
	return {
		priorityManager: {
			getPriorityConfig: jest.fn().mockReturnValue({ color: "#3366ff" }),
		},
		statusManager: {
			isCompletedStatus: jest.fn().mockReturnValue(false),
		},
	} as unknown as TaskNotesPlugin;
}

function patternInstanceDates(events: CalendarEvent[]): string[] {
	return events
		.filter((event) => event.extendedProps.isPatternInstance)
		.map((event) => event.extendedProps.instanceDate)
		.filter((date): date is string => typeof date === "string")
		.sort();
}

describe("Issue #2159: recurring instances on the final visible week day", () => {
	it("keeps Sunday recurring instances visible when Monday-start weeks end at local Monday midnight", async () => {
		const sundayTask = TaskFactory.createRecurringTask(
			"DTSTART:20260719T110000;FREQ=WEEKLY;INTERVAL=1;BYDAY=SU",
			{
				title: "Sunday recurring task",
				path: "tasks/sunday.md",
				scheduled: "2026-07-19T11:00",
				timeEstimate: 120,
			}
		);

		const events = await generateCalendarEvents([sundayTask], createPlugin(), {
			showScheduled: false,
			showDue: false,
			showRecurring: true,
			showTimeEntries: false,
			showTimeblocks: false,
			showICSEvents: false,
			visibleStart: new Date("2026-07-20T00:00:00+02:00"),
			visibleEnd: new Date("2026-07-27T00:00:00+02:00"),
			visibleStartDate: "2026-07-20",
			visibleEndDate: "2026-07-27",
		});

		expect(patternInstanceDates(events)).toContain("2026-07-26");
	});

	it("keeps Saturday recurring instances visible when Sunday-start weeks end at local Sunday midnight", async () => {
		const saturdayTask = TaskFactory.createRecurringTask(
			"DTSTART:20260718T110000;FREQ=WEEKLY;INTERVAL=1;BYDAY=SA",
			{
				title: "Saturday recurring task",
				path: "tasks/saturday.md",
				scheduled: "2026-07-18T11:00",
				timeEstimate: 90,
			}
		);

		const events = await generateCalendarEvents([saturdayTask], createPlugin(), {
			showScheduled: false,
			showDue: false,
			showRecurring: true,
			showTimeEntries: false,
			showTimeblocks: false,
			showICSEvents: false,
			visibleStart: new Date("2026-07-19T00:00:00+02:00"),
			visibleEnd: new Date("2026-07-26T00:00:00+02:00"),
			visibleStartDate: "2026-07-19",
			visibleEndDate: "2026-07-26",
		});

		expect(patternInstanceDates(events)).toContain("2026-07-25");
	});
});
