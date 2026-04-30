import { describe, expect, it, jest } from "@jest/globals";

import {
	createTaskInfoFromBasesData,
	type BasesDataItem,
} from "../../../src/bases/helpers";
import { generateRecurringTaskInstances } from "../../../src/bases/calendar-core";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";
import { TaskFactory } from "../../helpers/mock-factories";

function createCalendarPlugin(): TaskNotesPlugin {
	return {
		priorityManager: {
			getPriorityConfig: jest.fn().mockReturnValue({ color: "#1f2937" }),
		},
		statusManager: {
			isCompletedStatus: jest.fn().mockReturnValue(false),
		},
	} as unknown as TaskNotesPlugin;
}

function createWeeklyGroceryOrderTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return TaskFactory.createRecurringTask("DTSTART:20260314;FREQ=WEEKLY;BYDAY=SA", {
		title: "Weekly grocery order",
		path: "TaskNotes/Tasks/Weekly grocery order.md",
		status: "open",
		priority: "normal",
		scheduled: "2026-03-20",
		recurrence_anchor: "scheduled",
		skipped_instances: [],
		...overrides,
	});
}

describe("Issue #1696: local recurring calendar reschedule rendering", () => {
	it("preserves recurring exception metadata when Bases data is flattened", () => {
		const basesItem: BasesDataItem = {
			path: "TaskNotes/Tasks/Weekly grocery order.md",
			properties: {
				title: "Weekly grocery order",
				status: "open",
				priority: "normal",
				scheduled: "2026-03-20",
				recurrence: "DTSTART:20260314;FREQ=WEEKLY;BYDAY=SA",
				recurrence_anchor: "scheduled",
				googleCalendarExceptionOriginalScheduled: "2026-03-21",
				googleCalendarMovedOriginalDates: ["2026-03-14"],
			},
		};

		const task = createTaskInfoFromBasesData(basesItem);

		expect(task?.googleCalendarExceptionOriginalScheduled).toBe("2026-03-21");
		expect(task?.googleCalendarMovedOriginalDates).toEqual(["2026-03-14"]);
		expect(task?.customProperties).toBeUndefined();
	});

	it("suppresses original-pattern dates recorded on top-level exception fields", () => {
		const task = createWeeklyGroceryOrderTask({
			googleCalendarExceptionOriginalScheduled: "2026-03-21",
			googleCalendarMovedOriginalDates: ["2026-03-14"],
		});

		const events = generateRecurringTaskInstances(
			task,
			new Date("2026-03-13T00:00:00Z"),
			new Date("2026-03-22T00:00:00Z"),
			createCalendarPlugin()
		);

		expect(events.map((event) => event.start)).toEqual(["2026-03-20"]);
	});

	it("suppresses original-pattern dates even when they only survive in customProperties", () => {
		const task = createWeeklyGroceryOrderTask({
			customProperties: {
				googleCalendarExceptionOriginalScheduled: "2026-03-21",
				googleCalendarMovedOriginalDates: ["2026-03-14"],
			},
		});

		const events = generateRecurringTaskInstances(
			task,
			new Date("2026-03-13T00:00:00Z"),
			new Date("2026-03-22T00:00:00Z"),
			createCalendarPlugin()
		);

		expect(events.map((event) => event.start)).toEqual(["2026-03-20"]);
	});
});
