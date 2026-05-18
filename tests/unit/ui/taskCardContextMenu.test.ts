import { Menu, Notice, TFile } from "obsidian";
import { TaskContextMenu } from "../../../src/components/TaskContextMenu";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";
import {
	createTaskCardContextMenuButton,
	showTaskContextMenu,
} from "../../../src/ui/taskCardContextMenu";

jest.mock("obsidian");
jest.mock("../../../src/components/TaskContextMenu", () => ({
	TaskContextMenu: jest.fn().mockImplementation((options) => ({
		options,
		show: jest.fn(),
	})),
}));

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Task",
		status: "open",
		priority: "normal",
		path: "Tasks/task.md",
		archived: false,
		...overrides,
	};
}

function createPlugin(task: TaskInfo | null = createTask()): TaskNotesPlugin {
	return {
		settings: {
			enableDebugLogging: false,
		},
		i18n: {
			translate: jest.fn((key: string) => {
				if (key === "ui.taskCard.taskOptions") {
					return "Task options";
				}
				return key;
			}),
		},
		app: {
			vault: {
				getAbstractFileByPath: jest.fn(() => null),
			},
			workspace: {
				trigger: jest.fn(),
				getLeaf: jest.fn(() => ({
					openFile: jest.fn(),
				})),
				openLinkText: jest.fn(),
			},
		},
		cacheManager: {
			getTaskInfo: jest.fn(async () => task),
		},
	} as unknown as TaskNotesPlugin;
}

describe("taskCardContextMenu", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	it("creates a no-drag context-menu button and opens the task context menu", async () => {
		const task = createTask();
		const plugin = createPlugin(task);
		const mainRow = document.createElement("div");
		const targetDate = new Date("2026-05-19");

		const button = createTaskCardContextMenuButton({
			mainRow,
			taskPath: task.path,
			plugin,
			targetDate,
		});
		const click = new MouseEvent("click", { bubbles: true, cancelable: true });
		const stopPropagation = jest.spyOn(click, "stopPropagation");

		expect(button.classList.contains("task-card__context-menu")).toBe(true);
		expect(button.getAttribute("aria-label")).toBe("Task options");
		expect(button.getAttribute("data-icon")).toBe("ellipsis-vertical");
		expect(button.dataset.tnNoDrag).toBe("true");
		expect(button.getAttribute("role")).toBe("button");

		button.dispatchEvent(click);
		await Promise.resolve();

		expect(click.defaultPrevented).toBe(true);
		expect(stopPropagation).toHaveBeenCalled();
		expect(plugin.cacheManager.getTaskInfo).toHaveBeenCalledWith(task.path);
		expect(TaskContextMenu).toHaveBeenCalledWith(
			expect.objectContaining({ task, plugin, targetDate })
		);
	});

	it("shows a fresh task context menu and refreshes views after updates", async () => {
		const task = createTask();
		const plugin = createPlugin(task);
		const event = new MouseEvent("contextmenu");
		const targetDate = new Date("2026-05-19");

		await showTaskContextMenu(event, task.path, plugin, targetDate);

		const options = (TaskContextMenu as jest.Mock).mock.calls[0][0];
		expect(options).toEqual(
			expect.objectContaining({
				task,
				plugin,
				targetDate,
			})
		);

		options.onUpdate();
		expect(plugin.app.workspace.trigger).toHaveBeenCalledWith("tasknotes:refresh-views");
	});

	it("falls back to the native file menu when task data is unavailable", async () => {
		const plugin = createPlugin(null);
		const file = new TFile("Tasks/missing.md");
		(plugin.app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(file);
		const event = new MouseEvent("contextmenu");

		await showTaskContextMenu(event, file.path, plugin, new Date("2026-05-19"));

		expect(plugin.app.workspace.trigger).toHaveBeenCalledWith(
			"file-menu",
			expect.anything(),
			file,
			"tasknotes-bases-view"
		);
		expect(Menu).toHaveBeenCalled();
	});

	it("logs and notifies when creating the context menu fails", async () => {
		const plugin = createPlugin(null);
		const file = new TFile("Tasks/error.md");
		const error = new Error("Cache error");
		(plugin.app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(file);
		(plugin.cacheManager.getTaskInfo as jest.Mock).mockRejectedValue(error);
		const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);

		await showTaskContextMenu(new MouseEvent("contextmenu"), file.path, plugin, new Date());

		expect(consoleError).toHaveBeenCalledWith(
			expect.stringContaining("[TaskNotes][TaskCard/ContextMenu][internal][create-context-menu]"),
			expect.objectContaining({ taskPath: file.path, errorMessage: "Cache error" }),
			error
		);
		expect(Notice).toHaveBeenCalledWith("Failed to create context menu: Cache error");
	});
});
