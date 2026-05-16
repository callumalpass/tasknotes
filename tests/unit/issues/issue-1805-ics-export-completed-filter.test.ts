import { CalendarExportService } from "../../../src/services/CalendarExportService";
import type { TaskInfo } from "../../../src/types";

jest.mock("obsidian", () => ({
	Notice: jest.fn(),
}));

function makeTask(overrides: Partial<TaskInfo>): TaskInfo {
	return {
		title: "Task",
		path: "Tasks/task.md",
		status: "open",
		archived: false,
		tags: [],
		projects: [],
		contexts: [],
		scheduled: "2026-05-16T10:00:00",
		...overrides,
	};
}

describe("Issue #1805: exclude completed tasks from ICS export", () => {
	it("includes completed tasks by default for backwards compatibility", () => {
		const icsContent = CalendarExportService.generateMultipleTasksICSContent([
			makeTask({ title: "Active task", path: "Tasks/active.md", status: "open" }),
			makeTask({ title: "Completed task", path: "Tasks/completed.md", status: "done" }),
		]);

		expect(icsContent).toContain("SUMMARY:Active task");
		expect(icsContent).toContain("SUMMARY:Completed task");
	});

	it("omits tasks whose status is completed when excludeCompleted is enabled", () => {
		const icsContent = CalendarExportService.generateMultipleTasksICSContent(
			[
				makeTask({ title: "Active task", path: "Tasks/active.md", status: "open" }),
				makeTask({ title: "Completed task", path: "Tasks/completed.md", status: "done" }),
			],
			{ excludeCompleted: true, completedStatuses: ["done"] }
		);

		expect(icsContent).toContain("SUMMARY:Active task");
		expect(icsContent).not.toContain("SUMMARY:Completed task");
		expect(icsContent.split("BEGIN:VEVENT").length - 1).toBe(1);
	});

	it("uses custom completed statuses supplied by the plugin", () => {
		const icsContent = CalendarExportService.generateMultipleTasksICSContent(
			[
				makeTask({ title: "Open task", path: "Tasks/open.md", status: "open" }),
				makeTask({ title: "Finished task", path: "Tasks/finished.md", status: "finished" }),
			],
			{ excludeCompleted: true, completedStatuses: ["done", "finished"] }
		);

		expect(icsContent).toContain("SUMMARY:Open task");
		expect(icsContent).not.toContain("SUMMARY:Finished task");
	});
});
