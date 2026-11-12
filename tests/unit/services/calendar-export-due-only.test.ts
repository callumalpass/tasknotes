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

const exporters = [
	["single task", (task: TaskInfo) => CalendarExportService.generateICSContent(task)],
	["feed", (task: TaskInfo) => CalendarExportService.generateMultipleTasksICSContent([task])],
] as const;

describe.each(exporters)("ICS due-date controls: %s", (_name, exportICS) => {
	it("exports a timed deadline as one hour starting at the due time", () => {
		const ics = exportICS(dueOnly("2026-11-20T14:30:00Z"));
		expect(ics).toContain("DTSTART:20261120T143000Z");
		expect(ics).toContain("DTEND:20261120T153000Z");
	});

	it("preserves an offset deadline across UTC date rollover", () => {
		const ics = exportICS(dueOnly("2026-11-20T23:30:00-05:00"));
		expect(ics).toContain("DTSTART:20261121T043000Z");
		expect(ics).toContain("DTEND:20261121T053000Z");
	});

	it("uses the next year for an all-day deadline's exclusive end", () => {
		const ics = exportICS(dueOnly("2026-12-31"));
		expect(ics).toContain("DTSTART;VALUE=DATE:20261231");
		expect(ics).toContain("DTEND;VALUE=DATE:20270101");
	});

	it("retains the scheduled-to-due range when both dates exist", () => {
		const ics = exportICS({
			...dueOnly("2026-11-20T15:30:00Z"),
			scheduled: "2026-11-20T12:30:00Z",
		});
		expect(ics).toContain("DTSTART:20261120T123000Z");
		expect(ics).toContain("DTEND:20261120T153000Z");
	});
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
