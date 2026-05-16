/**
 * Issue #1487: Calendar task event titles should remain readable.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1487
 */

import fs from "fs";
import path from "path";

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

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.resolve(__dirname, "../../../", relativePath), "utf8");
}

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
	return match?.[1] ?? "";
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

	it("allows FullCalendar event titles to wrap instead of clipping to one line", () => {
		const css = readRepoFile("styles/advanced-calendar-view.css");
		const eventTitleBlock = extractCssBlock(css, ".advanced-calendar-view .fc-event-title");

		expect(css).toContain(".advanced-calendar-view .fc-daygrid-event");
		expect(css).toContain(".advanced-calendar-view .fc-timegrid-event");
		expect(eventTitleBlock).toContain("white-space: normal;");
		expect(eventTitleBlock).toContain("overflow-wrap: anywhere;");
		expect(eventTitleBlock).toContain("overflow: visible;");
	});
});
