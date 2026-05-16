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
