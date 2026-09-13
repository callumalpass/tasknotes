/**
 * Issue #1603: Calendar views can hide completed/skipped recurring instances.
 *
 * Bases filters operate on the task note, but recurring calendar events are
 * generated per instance. These tests cover the per-instance visibility layer.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1603
 */

import {
	generateCalendarEvents,
	generateRecurringTaskInstances,
	type CalendarEvent,
} from "../../../src/bases/calendar-core";
import type TaskNotesPlugin from "../../../src/main";
import { TaskFactory } from "../../helpers/mock-factories";
import { createTaskInfoFromBasesData } from "../../../src/bases/helpers";

function createPlugin(): TaskNotesPlugin {
	return {
		priorityManager: {
			getPriorityConfig: jest.fn().mockReturnValue({ color: "#3366ff" }),
		},
	} as unknown as TaskNotesPlugin;
}

function getInstanceDates(events: CalendarEvent[]): string[] {
	return events
		.map((event) => event.extendedProps.instanceDate)
		.filter((date): date is string => typeof date === "string")
		.sort();
}

describe("Issue #1603: recurring calendar instance visibility", () => {
	const plugin = createPlugin();
	const start = new Date("2026-02-01T00:00:00.000Z");
	const end = new Date("2026-02-06T00:00:00.000Z");

	it("renders a moved occurrence once and keeps later weekly occurrences", () => {
		const task = TaskFactory.createRecurringTask("DTSTART:20260905;FREQ=WEEKLY;BYDAY=SA", {
			scheduled: "2026-09-11",
			googleCalendarExceptionOriginalScheduled: "2026-09-12",
			googleCalendarMovedOriginalDates: ["2026-09-05"],
		});
		const before = JSON.stringify(task);
		const events = generateRecurringTaskInstances(
			task,
			new Date("2026-09-01T00:00:00Z"),
			new Date("2026-09-21T00:00:00Z"),
			plugin
		);
		expect(getInstanceDates(events)).toEqual(["2026-09-11", "2026-09-19"]);
		expect(JSON.stringify(task)).toBe(before);
	});

	it("preserves move markers through Bases conversion before the task cache is warm", () => {
		const task = createTaskInfoFromBasesData({
			path: "tasks/moved.md",
			properties: {
				recurrence: "DTSTART:20260905;FREQ=WEEKLY;BYDAY=SA",
				scheduled: "2026-09-11",
				googleCalendarExceptionOriginalScheduled: "2026-09-12",
				googleCalendarMovedOriginalDates: ["2026-09-05"],
			},
		});
		expect(task).not.toBeNull();
		expect(getInstanceDates(generateRecurringTaskInstances(
			task!, new Date("2026-09-01T00:00:00Z"), new Date("2026-09-21T00:00:00Z"), plugin
		))).toEqual(["2026-09-11", "2026-09-19"]);
	});

	it("keeps recorded history for moved dates when history is requested", () => {
		const task = TaskFactory.createRecurringTask("DTSTART:20260905;FREQ=WEEKLY;BYDAY=SA", {
			scheduled: "2026-09-19",
			googleCalendarMovedOriginalDates: ["2026-09-12"],
			complete_instances: ["2026-09-12"],
		});
		const range = [new Date("2026-09-11T00:00:00Z"), new Date("2026-09-21T00:00:00Z")] as const;
		expect(getInstanceDates(generateRecurringTaskInstances(task, ...range, plugin))).toEqual([
			"2026-09-12",
			"2026-09-19",
		]);
		expect(
			getInstanceDates(
				generateRecurringTaskInstances(task, ...range, plugin, {
					showCompletedRecurringInstances: false,
				})
			)
		).toEqual(["2026-09-19"]);
	});

	it("keeps completed and skipped recurring instances visible by default", () => {
		const task = TaskFactory.createRecurringTask("FREQ=DAILY;INTERVAL=1", {
			path: "tasks/recur.md",
			scheduled: "2026-02-01",
			complete_instances: ["2026-02-02"],
			skipped_instances: ["2026-02-03"],
		});

		const events = generateRecurringTaskInstances(task, start, end, plugin);
		const dates = getInstanceDates(events);

		expect(dates).toContain("2026-02-02");
		expect(dates).toContain("2026-02-03");
	});

	it("can hide completed and skipped recurring instances independently", () => {
		const task = TaskFactory.createRecurringTask("FREQ=DAILY;INTERVAL=1", {
			path: "tasks/recur.md",
			scheduled: "2026-02-01",
			complete_instances: ["2026-02-02"],
			skipped_instances: ["2026-02-03"],
		});

		const withoutCompleted = generateRecurringTaskInstances(task, start, end, plugin, {
			showCompletedRecurringInstances: false,
			showSkippedRecurringInstances: true,
		});
		expect(getInstanceDates(withoutCompleted)).not.toContain("2026-02-02");
		expect(getInstanceDates(withoutCompleted)).toContain("2026-02-03");

		const withoutSkipped = generateRecurringTaskInstances(task, start, end, plugin, {
			showCompletedRecurringInstances: true,
			showSkippedRecurringInstances: false,
		});
		expect(getInstanceDates(withoutSkipped)).toContain("2026-02-02");
		expect(getInstanceDates(withoutSkipped)).not.toContain("2026-02-03");
	});

	it("applies the visibility options through generateCalendarEvents", async () => {
		const task = TaskFactory.createRecurringTask("FREQ=DAILY;INTERVAL=1", {
			path: "tasks/recur.md",
			scheduled: "2026-02-01",
			complete_instances: ["2026-02-02"],
			skipped_instances: ["2026-02-03"],
		});

		const events = await generateCalendarEvents([task], plugin, {
			showRecurring: true,
			showCompletedRecurringInstances: false,
			showSkippedRecurringInstances: false,
			visibleStart: start,
			visibleEnd: end,
		});

		const dates = getInstanceDates(events);
		expect(dates).not.toContain("2026-02-02");
		expect(dates).not.toContain("2026-02-03");
		expect(dates).toContain("2026-02-04");
	});
});
