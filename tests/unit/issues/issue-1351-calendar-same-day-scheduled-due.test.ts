/**
 * Issue #1351: Date-only scheduled and due entries should consolidate when they
 * land on the same day.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1351
 */

import {
	createSameDayScheduledDueEvent,
	generateCalendarEvents,
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

describe("Issue #1351: calendar same-day scheduled/due consolidation", () => {
	const plugin = createPlugin();

	it("creates one consolidated event for date-only scheduled and due values on the same day", async () => {
		const task = TaskFactory.createTask({
			title: "Submit travel claim",
			path: "tasks/travel-claim.md",
			scheduled: "2026-02-15",
			due: "2026-02-15",
		});

		const events = await generateCalendarEvents([task], plugin, {
			showScheduled: true,
			showDue: true,
			showTimeEntries: false,
		});

		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			id: "scheduled-due-tasks/travel-claim.md",
			title: "Start/Due: Submit travel claim",
			start: "2026-02-15",
			allDay: true,
			extendedProps: {
				eventType: "scheduledToDueSpan",
				taskInfo: task,
			},
		});
	});

	it("keeps separate events when only one date type is visible", async () => {
		const task = TaskFactory.createTask({
			title: "Submit travel claim",
			path: "tasks/travel-claim.md",
			scheduled: "2026-02-15",
			due: "2026-02-15",
		});

		const events = await generateCalendarEvents([task], plugin, {
			showScheduled: true,
			showDue: false,
			showTimeEntries: false,
		});

		expect(events).toHaveLength(1);
		expect(events[0].extendedProps.eventType).toBe("scheduled");
	});

	it("keeps timed scheduled and due values separate on the same day", async () => {
		const task = TaskFactory.createTask({
			title: "Submit travel claim",
			path: "tasks/travel-claim.md",
			scheduled: "2026-02-15T09:00",
			due: "2026-02-15T17:00",
		});

		const consolidated = createSameDayScheduledDueEvent(task, plugin);
		expect(consolidated).toBeNull();

		const events = await generateCalendarEvents([task], plugin, {
			showScheduled: true,
			showDue: true,
			showTimeEntries: false,
		});

		expect(events.map((event) => event.extendedProps.eventType)).toEqual([
			"scheduled",
			"due",
		]);
	});
});
