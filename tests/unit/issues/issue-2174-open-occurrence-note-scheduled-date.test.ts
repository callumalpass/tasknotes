import { App, TFile } from "obsidian";
import { TaskActionPaletteModal } from "../../../src/modals/TaskActionPaletteModal";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";

function createRecurringTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		id: "Tasks/Task3.md",
		path: "Tasks/Task3.md",
		title: "Task3",
		status: "open",
		priority: "normal",
		recurrence: "DTSTART:20260101;FREQ=DAILY;INTERVAL=10",
		recurrence_anchor: "completion",
		occurrence_materialization: "on_completion",
		scheduled: "2026-01-01",
		...overrides,
	} as TaskInfo;
}

function createPlugin(occurrence: TaskInfo): TaskNotesPlugin {
	const app = new App();
	const openFile = jest.fn();

	app.vault.getAbstractFileByPath = jest.fn((path: string) => new TFile(path));
	app.workspace.getLeaf = jest.fn(() => ({ openFile })) as never;

	return {
		app,
		statusManager: {
			getAllStatuses: jest.fn(() => [{ value: "open", label: "Open" }]),
			getNonCompletionStatuses: jest.fn(() => [{ value: "open", label: "Open" }]),
			isCompletedStatus: jest.fn(() => false),
		},
		priorityManager: {
			getAllPriorities: jest.fn(() => [{ value: "normal", label: "Normal" }]),
		},
		taskService: {
			findMaterializedOccurrence: jest.fn(async () => occurrence),
			materializeOccurrence: jest.fn(async () => occurrence),
		},
		cacheManager: {
			getTaskInfo: jest.fn(),
		},
		updateTaskProperty: jest.fn(),
		toggleRecurringTaskComplete: jest.fn(),
		getActiveTimeSession: jest.fn(() => null),
		stopTimeTracking: jest.fn(),
		startTimeTracking: jest.fn(),
		openDueDateModal: jest.fn(),
		openScheduledDateModal: jest.fn(),
		openTimeEntryEditor: jest.fn(),
		toggleTaskArchive: jest.fn(),
		openTaskEditModal: jest.fn(),
	} as unknown as TaskNotesPlugin;
}

describe("Issue #2174: quick actions open the scheduled occurrence note", () => {
	it("uses the parent scheduled date for occurrence-note identity", async () => {
		const task = createRecurringTask();
		const occurrence = createRecurringTask({
			path: "Tasks/Task3 2026-01-01.md",
			recurrence: undefined,
			recurrence_parent: "[[Task3]]",
			occurrence_date: "2026-01-01",
			scheduled: "2026-01-01",
		});
		const plugin = createPlugin(occurrence);
		const modal = new TaskActionPaletteModal(
			new App() as never,
			task,
			plugin,
			new Date("2026-07-30T00:00:00.000Z")
		);
		const action = modal.getItems().find((item) => item.id === "open-or-create-occurrence-note");

		await action?.execute(task, plugin, new Date("2026-07-30T00:00:00.000Z"));

		const targetDate = (plugin.taskService.materializeOccurrence as jest.Mock).mock
			.calls[0][1] as Date;
		expect(targetDate.toISOString().slice(0, 10)).toBe("2026-01-01");
	});
});
