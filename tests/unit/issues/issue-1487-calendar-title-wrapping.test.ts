/**
 * Issue #1487: Calendar task event titles should remain readable.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1487
 */

import {
	createDueEvent,
	generateCalendarEvents,
	type CalendarEvent,
} from "../../../src/bases/calendar-core";
import type TaskNotesPlugin from "../../../src/main";
import { TaskFactory } from "../../helpers/mock-factories";

function createPlugin(): TaskNotesPlugin {
	return {
		priorityManager: {
			getPriorityConfig: jest.fn().mockReturnValue({ color: "#f97316" }),
		},
		statusManager: {
			isCompletedStatus: jest.fn().mockReturnValue(false),
		},
	} as unknown as TaskNotesPlugin;
}

describe("Issue #1487: calendar title wrapping and due titles", () => {
	const plugin = createPlugin();

	it("uses the task title directly for due calendar events", async () => {
		const task = TaskFactory.createTaskWithDue("2026-02-15", {
			title: "DAT130 - Assignment 0: Intro",
			path: "tasks/dat130-assignment.md",
		});

		const dueEvent = createDueEvent(task, plugin);
		expect(dueEvent?.title).toBe("DAT130 - Assignment 0: Intro");
		expect(dueEvent?.title).not.toMatch(/^DUE?:/i);

		const events = await generateCalendarEvents([task], plugin, {
			showScheduled: false,
			showDue: true,
			showTimeEntries: false,
		});
		const generatedDueEvent = events.find(
			(event: CalendarEvent) => event.extendedProps.eventType === "due"
		);
		expect(generatedDueEvent?.title).toBe(task.title);
	});
});
