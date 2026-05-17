import { CalendarExportService } from "../../../src/services/CalendarExportService";
import type { TaskInfo } from "../../../src/types";

jest.mock("obsidian", () => ({
	Notice: jest.fn(),
}));

function makeTask(overrides: Partial<TaskInfo>): TaskInfo {
	return {
		title: "Task",
		path: "Tasks/task.md",
		status: "todo",
		priority: "normal",
		archived: false,
		tags: [],
		projects: [],
		contexts: [],
		...overrides,
	};
}

function makeTasks(): TaskInfo[] {
	return [
		makeTask({
			title: "Active task with due date",
			path: "Tasks/active-due.md",
			scheduled: "2026-05-18T10:00:00",
			due: "2026-05-18T11:00:00",
		}),
		makeTask({
			title: "Completed task",
			path: "Tasks/completed.md",
			status: "done",
			scheduled: "2026-05-18T12:00:00",
			due: "2026-05-18T13:00:00",
		}),
		makeTask({
			title: "Archived task",
			path: "Tasks/archived.md",
			archived: true,
			scheduled: "2026-05-18T14:00:00",
			due: "2026-05-18T15:00:00",
		}),
		makeTask({
			title: "Scheduled only task",
			path: "Tasks/scheduled-only.md",
			scheduled: "2026-05-18T16:00:00",
		}),
		makeTask({
			title: "Due only task",
			path: "Tasks/due-only.md",
			due: "2026-05-18T17:00:00",
		}),
		makeTask({
			title: "Task with no dates",
			path: "Tasks/no-dates.md",
		}),
	];
}

function expectTaskTitles(icsContent: string, included: string[], excluded: string[] = []): void {
	for (const title of included) {
		expect(icsContent).toContain(`SUMMARY:${title}`);
	}
	for (const title of excluded) {
		expect(icsContent).not.toContain(`SUMMARY:${title}`);
	}
}

describe("Issue #773: ICS export filter options", () => {
	it("exports archived, completed, and undated tasks by default", () => {
		const icsContent = CalendarExportService.generateMultipleTasksICSContent(makeTasks());

		expect(icsContent.split("BEGIN:VEVENT").length - 1).toBe(6);
		expectTaskTitles(icsContent, [
			"Active task with due date",
			"Completed task",
			"Archived task",
			"Scheduled only task",
			"Due only task",
			"Task with no dates",
		]);
	});

	it("omits archived tasks when excludeArchived is enabled", () => {
		const icsContent = CalendarExportService.generateMultipleTasksICSContent(makeTasks(), {
			excludeArchived: true,
		});

		expectTaskTitles(
			icsContent,
			["Active task with due date", "Completed task", "Scheduled only task"],
			["Archived task"]
		);
		expect(icsContent.split("BEGIN:VEVENT").length - 1).toBe(5);
	});

	it("omits completed tasks when excludeCompleted is enabled", () => {
		const icsContent = CalendarExportService.generateMultipleTasksICSContent(makeTasks(), {
			excludeCompleted: true,
			completedStatuses: ["done"],
		});

		expectTaskTitles(
			icsContent,
			["Active task with due date", "Archived task", "Scheduled only task"],
			["Completed task"]
		);
		expect(icsContent.split("BEGIN:VEVENT").length - 1).toBe(5);
	});

	it("only includes tasks with due dates when requireDueDate is enabled", () => {
		const icsContent = CalendarExportService.generateMultipleTasksICSContent(makeTasks(), {
			requireDueDate: true,
		});

		expectTaskTitles(
			icsContent,
			["Active task with due date", "Completed task", "Archived task", "Due only task"],
			["Scheduled only task", "Task with no dates"]
		);
		expect(icsContent.split("BEGIN:VEVENT").length - 1).toBe(4);
	});

	it("only includes tasks with scheduled dates when requireScheduledDate is enabled", () => {
		const icsContent = CalendarExportService.generateMultipleTasksICSContent(makeTasks(), {
			requireScheduledDate: true,
		});

		expectTaskTitles(
			icsContent,
			["Active task with due date", "Completed task", "Archived task", "Scheduled only task"],
			["Due only task", "Task with no dates"]
		);
		expect(icsContent.split("BEGIN:VEVENT").length - 1).toBe(4);
	});

	it("supports scheduled-only exports without requiring due dates", () => {
		const icsContent = CalendarExportService.generateMultipleTasksICSContent(makeTasks(), {
			requireDueDate: false,
			requireScheduledDate: true,
		});

		expectTaskTitles(icsContent, ["Scheduled only task"], ["Due only task", "Task with no dates"]);
	});

	it("combines filters so all enabled requirements must pass", () => {
		const icsContent = CalendarExportService.generateMultipleTasksICSContent(makeTasks(), {
			excludeArchived: true,
			excludeCompleted: true,
			completedStatuses: ["done"],
			requireDueDate: true,
			requireScheduledDate: true,
		});

		expectTaskTitles(
			icsContent,
			["Active task with due date"],
			[
				"Completed task",
				"Archived task",
				"Scheduled only task",
				"Due only task",
				"Task with no dates",
			]
		);
		expect(icsContent.split("BEGIN:VEVENT").length - 1).toBe(1);
	});

	it("uses filter results for download notices", () => {
		const createElement = jest.fn(() => ({
			href: "",
			download: "",
			click: jest.fn(),
		}));
		const originalCreateObjectURL = URL.createObjectURL;
		const originalRevokeObjectURL = URL.revokeObjectURL;
		URL.createObjectURL = jest.fn(() => "blob:tasknotes");
		URL.revokeObjectURL = jest.fn();
		const translate = jest.fn((key: string, vars?: Record<string, unknown>) => {
			if (key === "services.calendarExport.notices.downloadSuccess") {
				return `Downloaded ${vars?.filename} with ${vars?.count} task${vars?.plural}`;
			}
			return key;
		});
		const { Notice } = jest.requireMock("obsidian") as { Notice: jest.Mock };
		Notice.mockClear();
		Object.defineProperty(global, "activeDocument", {
			value: { createElement },
			configurable: true,
		});

		CalendarExportService.downloadAllTasksICSFile(makeTasks(), translate, {
			excludeArchived: true,
			excludeCompleted: true,
			completedStatuses: ["done"],
			requireDueDate: true,
			requireScheduledDate: true,
		});

		expect(Notice).toHaveBeenCalledWith(expect.stringContaining("with 1 task"));
		expect(createElement).toHaveBeenCalledWith("a");

		URL.createObjectURL = originalCreateObjectURL;
		URL.revokeObjectURL = originalRevokeObjectURL;
	});
});
