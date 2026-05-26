/**
 * Issue #1948: Agenda completed recurring instances should be shown from the
 * recorded completion dates, even when those dates do not match the RRULE.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1948
 */

import { generateCalendarEvents, type CalendarEvent } from "../../../src/bases/calendar-core";
import type TaskNotesPlugin from "../../../src/main";
import { TaskFactory } from "../../helpers/mock-factories";

function createPlugin(): TaskNotesPlugin {
	return {
		priorityManager: {
			getPriorityConfig: jest.fn().mockReturnValue({ color: "#3366ff" }),
		},
	} as unknown as TaskNotesPlugin;
}

function eventSummaries(events: CalendarEvent[]): Array<{
	id: string;
	start: string;
	instanceDate?: string;
	isCompleted?: boolean;
	isPatternInstance?: boolean;
	isNextScheduledOccurrence?: boolean;
}> {
	return events
		.filter((event) => event.extendedProps.taskInfo?.path === "tasks/recycling.md")
		.map((event) => ({
			id: event.id,
			start: event.start,
			instanceDate: event.extendedProps.instanceDate,
			isCompleted: event.extendedProps.isCompleted,
			isPatternInstance: event.extendedProps.isPatternInstance,
			isNextScheduledOccurrence: event.extendedProps.isNextScheduledOccurrence,
		}))
		.sort((a, b) => a.start.localeCompare(b.start));
}

describe("Issue #1948: Agenda completed recurring instances", () => {
	const plugin = createPlugin();
	const visibleStart = new Date("2026-05-20T00:00:00.000Z");
	const visibleEnd = new Date("2026-05-26T00:00:00.000Z");

	function createScheduledAnchorTask() {
		return TaskFactory.createRecurringTask("DTSTART:20260518;FREQ=WEEKLY;BYDAY=MO,TH", {
			title: "Recycling",
			path: "tasks/recycling.md",
			scheduled: "2026-05-28",
			recurrence_anchor: "scheduled",
			complete_instances: ["2026-05-20"],
			skipped_instances: [],
		});
	}

	it("shows recorded completed dates that are not recurrence-rule dates", async () => {
		const events = await generateCalendarEvents([createScheduledAnchorTask()], plugin, {
			showRecurring: true,
			showCompletedRecurringInstances: true,
			showSkippedRecurringInstances: true,
			visibleStart,
			visibleEnd,
		});

		expect(eventSummaries(events)).toEqual(expect.arrayContaining([
			expect.objectContaining({
				id: "recurring-recorded-tasks/recycling.md-2026-05-20",
				start: "2026-05-20",
				instanceDate: "2026-05-20",
				isCompleted: true,
			}),
			expect.objectContaining({
				id: "recurring-tasks/recycling.md-2026-05-21",
				start: "2026-05-21",
				instanceDate: "2026-05-21",
				isPatternInstance: true,
			}),
			expect.objectContaining({
				id: "recurring-tasks/recycling.md-2026-05-25",
				start: "2026-05-25",
				instanceDate: "2026-05-25",
				isPatternInstance: true,
			}),
		]));
	});

	it("allows completed instances to show when projected recurring tasks are hidden", async () => {
		const events = await generateCalendarEvents([createScheduledAnchorTask()], plugin, {
			showScheduled: true,
			showRecurring: false,
			showCompletedRecurringInstances: true,
			showSkippedRecurringInstances: true,
			visibleStart,
			visibleEnd,
		});

		expect(eventSummaries(events)).toEqual([
			expect.objectContaining({
				id: "recurring-recorded-tasks/recycling.md-2026-05-20",
				start: "2026-05-20",
				instanceDate: "2026-05-20",
				isCompleted: true,
			}),
		]);
	});

	it("hides recorded completed dates when completed instances are disabled", async () => {
		const events = await generateCalendarEvents([createScheduledAnchorTask()], plugin, {
			showRecurring: true,
			showCompletedRecurringInstances: false,
			showSkippedRecurringInstances: true,
			visibleStart,
			visibleEnd,
		});

		const instanceDates = eventSummaries(events).map((event) => event.instanceDate);
		expect(instanceDates).not.toContain("2026-05-20");
		expect(instanceDates).toEqual(expect.arrayContaining(["2026-05-21", "2026-05-25"]));
	});
});
