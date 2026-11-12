import { describe, expect, it } from "@jest/globals";
import { CalendarExportService } from "../../../src/services/CalendarExportService";
import { TaskInfo } from "../../../src/types";

jest.mock("obsidian", () => ({
	Notice: jest.fn(),
}));

const dueOnly = (due: string): TaskInfo => ({
	title: "Pay rent",
	path: "tasks/pay-rent.md",
	due,
	dateCreated: "2026-11-02T10:15:00.000-05:00",
	status: "todo",
	tags: [],
	projects: [],
	contexts: [],
});

describe("ICS export of tasks with only a due date", () => {
	it("exports a date-only due as an all-day event on that day", () => {
		const ics = CalendarExportService.generateICSContent(dueOnly("2026-11-20"));

		expect(ics).toContain("DTSTART;VALUE=DATE:20261120");
		expect(ics).toContain("DTEND;VALUE=DATE:20261121");
	});

	it("does not stretch the feed event back to the creation date", () => {
		const ics = CalendarExportService.generateMultipleTasksICSContent([dueOnly("2026-11-20")]);

		expect(ics).toContain("DTSTART;VALUE=DATE:20261120");
		expect(ics).not.toContain("DTSTART:20261102");
	});
});
