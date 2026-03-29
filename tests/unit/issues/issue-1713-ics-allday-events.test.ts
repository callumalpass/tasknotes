import { describe, expect, it } from "@jest/globals";
import { CalendarExportService } from "../../../src/services/CalendarExportService";
import { TaskInfo } from "../../../src/types";

jest.mock("obsidian", () => ({
	Notice: jest.fn(),
}));

describe("Issue #1713 - export timeless tasks as all-day events", () => {
	it("exports a date-only scheduled task as an all-day VEVENT", () => {
		const task: TaskInfo = {
			title: "Review quarterly plan",
			path: "tasks/review-quarterly-plan.md",
			scheduled: "2026-03-20",
			status: "todo",
			tags: [],
			projects: [],
			contexts: [],
		};

		const icsContent = CalendarExportService.generateICSContent(task);

		expect(icsContent).toContain("DTSTART;VALUE=DATE:20260320");
		expect(icsContent).toContain("DTEND;VALUE=DATE:20260321");
		expect(icsContent).not.toContain("DTSTART:20260320T");
	});

	it("uses the due date as the inclusive final day for date-only spans", () => {
		const task: TaskInfo = {
			title: "Conference",
			path: "tasks/conference.md",
			scheduled: "2026-03-20",
			due: "2026-03-22",
			status: "todo",
			tags: [],
			projects: [],
			contexts: [],
		};

		const icsContent = CalendarExportService.generateICSContent(task);

		expect(icsContent).toContain("DTSTART;VALUE=DATE:20260320");
		expect(icsContent).toContain("DTEND;VALUE=DATE:20260323");
	});

	it("keeps timed tasks as timed VEVENTs", () => {
		const task: TaskInfo = {
			title: "Meet designer",
			path: "tasks/meet-designer.md",
			scheduled: "2026-03-20T14:30:00",
			status: "todo",
			tags: [],
			projects: [],
			contexts: [],
		};

		const icsContent = CalendarExportService.generateICSContent(task);

		expect(icsContent).toMatch(/DTSTART:\d{8}T\d{6}Z/);
		expect(icsContent).toMatch(/DTEND:\d{8}T\d{6}Z/);
		expect(icsContent).not.toContain("VALUE=DATE");
	});

	it("exports date-only tasks as all-day events in bulk ICS export", () => {
		const tasks: TaskInfo[] = [
			{
				title: "Review quarterly plan",
				path: "tasks/review-quarterly-plan.md",
				scheduled: "2026-03-20",
				status: "todo",
				tags: [],
				projects: [],
				contexts: [],
			},
			{
				title: "Meet designer",
				path: "tasks/meet-designer.md",
				scheduled: "2026-03-20T14:30:00",
				status: "todo",
				tags: [],
				projects: [],
				contexts: [],
			},
		];

		const icsContent = CalendarExportService.generateMultipleTasksICSContent(tasks);

		expect(icsContent).toContain("DTSTART;VALUE=DATE:20260320");
		expect(icsContent).toContain("DTEND;VALUE=DATE:20260321");
		expect(icsContent).toMatch(/DTSTART:\d{8}T\d{6}Z/);
	});
});
