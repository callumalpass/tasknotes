import { App } from "obsidian";
import { TaskActionPaletteModal } from "../../../src/modals/TaskActionPaletteModal";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		id: "Tasks/quick-date.md",
		path: "Tasks/quick-date.md",
		title: "Quick date task",
		status: "open",
		priority: "normal",
		...overrides,
	} as TaskInfo;
}

function createPlugin(): TaskNotesPlugin {
	return {
		app: new App(),
		statusManager: {
			getAllStatuses: jest.fn(() => [{ value: "open", label: "Open" }]),
			getNonCompletionStatuses: jest.fn(() => [{ value: "open", label: "Open" }]),
		},
		priorityManager: {
			getAllPriorities: jest.fn(() => [{ value: "normal", label: "Normal" }]),
		},
		cacheManager: {
			getTaskInfo: jest.fn(),
		},
		updateTaskProperty: jest.fn(),
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

function createModal(task: TaskInfo, plugin: TaskNotesPlugin): TaskActionPaletteModal {
	return new TaskActionPaletteModal(
		new App() as never,
		task,
		plugin,
		new Date("2026-05-18T12:00:00+10:00")
	);
}

describe("Issue #887: quick-action date presets", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2026-05-18T12:00:00+10:00"));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("adds built-in scheduled-date presets to the action palette", () => {
		const modal = createModal(createTask(), createPlugin());

		const actions = modal.getItems();

		expect(actions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "set-scheduled-today",
					title: "Schedule for today",
				}),
				expect.objectContaining({
					id: "set-scheduled-tomorrow",
					title: "Schedule for tomorrow",
				}),
				expect.objectContaining({
					id: "set-scheduled-this-weekend",
					title: "Schedule for this weekend",
				}),
				expect.objectContaining({
					id: "set-scheduled-next-week",
					title: "Schedule for next week",
				}),
				expect.objectContaining({
					id: "set-scheduled-next-month",
					title: "Schedule for next month",
				}),
			])
		);
	});

	it("adds matching due-date presets", () => {
		const modal = createModal(createTask(), createPlugin());

		const actions = modal.getItems();

		expect(actions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: "set-due-today", title: "Set due for today" }),
				expect.objectContaining({
					id: "set-due-this-weekend",
					title: "Set due for this weekend",
				}),
				expect.objectContaining({
					id: "set-due-next-month",
					title: "Set due for next month",
				}),
			])
		);
	});

	it("sets preset dates directly without opening the date picker", async () => {
		const task = createTask();
		const plugin = createPlugin();
		const modal = createModal(task, plugin);
		const action = modal.getItems().find((item) => item.id === "set-scheduled-tomorrow");

		await action?.execute(task, plugin, new Date("2026-05-18T12:00:00+10:00"));

		expect(plugin.updateTaskProperty).toHaveBeenCalledWith(task, "scheduled", "2026-05-19");
		expect(plugin.openScheduledDateModal).not.toHaveBeenCalled();
	});

	it("omits a preset when the task already has that date", () => {
		const modal = createModal(createTask({ scheduled: "2026-05-19" }), createPlugin());

		const actionIds = modal.getItems().map((action) => action.id);

		expect(actionIds).not.toContain("set-scheduled-tomorrow");
		expect(actionIds).toContain("set-due-tomorrow");
	});
});
