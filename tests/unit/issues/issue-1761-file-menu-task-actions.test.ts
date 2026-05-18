import TaskNotesPlugin from "../../../src/main";
import { createI18nService } from "../../../src/i18n";
import type { TaskInfo } from "../../../src/types";
import { App, Menu, TFile } from "../../__mocks__/obsidian";
import { TaskContextMenu } from "../../../src/components/TaskContextMenu";

jest.mock("obsidian");
jest.mock("../../../src/components/TaskContextMenu", () => ({
	TaskContextMenu: {
		addToMenu: jest.fn(),
	},
}));

type MockMenu = {
	items: Array<Record<string, jest.Mock> | { type: string }>;
};

function createTask(path: string): TaskInfo {
	return {
		id: path,
		title: "Review native menu",
		path,
		status: "open",
		priority: "normal",
	} as TaskInfo;
}

function createPlugin(task: TaskInfo | null): TaskNotesPlugin {
	const plugin = new TaskNotesPlugin(new App() as never, {} as never);
	plugin.i18n = createI18nService();
	plugin.cacheManager = {
		isTaskFile: jest.fn(() => task !== null),
		getTaskInfo: jest.fn(async () => task),
		getCachedTaskInfoSync: jest.fn(() => task),
	} as never;
	plugin.openTaskEditModal = jest.fn(async () => undefined) as never;
	return plugin;
}

function setFrontmatter(plugin: TaskNotesPlugin, path: string, frontmatter: unknown): void {
	const metadataCache = plugin.app.metadataCache as unknown as {
		setCache: (path: string, metadata: unknown) => void;
	};
	metadataCache.setCache(path, { frontmatter });
}

describe("issue #1761 - native file menu TaskNotes actions", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("adds edit and TaskNotes submenu entries for recognized task files", async () => {
		const task = createTask("Tasks/review-native-menu.md");
		const plugin = createPlugin(task);
		const menu = new Menu() as never;
		const file = new TFile(task.path);
		setFrontmatter(plugin, task.path, { tags: ["task"] });

		plugin.addTaskNotesFileMenuActions(menu, file);

		const menuItems = (menu as MockMenu).items;
		expect(menuItems).toHaveLength(3);
		expect(menuItems[0]).toEqual({ type: "separator" });
		const editItem = menuItems[1] as Record<string, jest.Mock>;
		const taskNotesItem = menuItems[2] as Record<string, jest.Mock>;
		expect(editItem.setTitle).toHaveBeenCalledWith("Edit task");
		expect(editItem.setIcon).toHaveBeenCalledWith("pencil");
		expect(editItem.setSection).toHaveBeenCalledWith("tasknotes");
		expect(taskNotesItem.setTitle).toHaveBeenCalledWith("TaskNotes");
		expect(taskNotesItem.setIcon).toHaveBeenCalledWith("list-checks");
		expect(taskNotesItem.setSection).toHaveBeenCalledWith("tasknotes");
		expect(taskNotesItem.setSubmenu).toHaveBeenCalledTimes(1);
		expect(TaskContextMenu.addToMenu).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				task,
				plugin,
				onUpdate: expect.any(Function),
			})
		);

		const editClick = editItem.onClick.mock.calls[0][0];
		await editClick(new MouseEvent("click"));

		expect(plugin.cacheManager.getTaskInfo).toHaveBeenCalledWith(task.path);
		expect(plugin.openTaskEditModal).toHaveBeenCalledWith(task);
	});

	it("does not add TaskNotes submenu entries to TaskNotes-triggered nested file menus", () => {
		const task = createTask("Tasks/review-native-menu.md");
		const plugin = createPlugin(task);
		const menu = new Menu() as never;
		const file = new TFile(task.path);
		setFrontmatter(plugin, task.path, { tags: ["task"] });

		plugin.addTaskNotesFileMenuActions(menu, file, "tasknotes-context-menu");

		expect((menu as { items: unknown[] }).items).toEqual([]);
		expect(TaskContextMenu.addToMenu).not.toHaveBeenCalled();
	});

	it("does not add TaskNotes actions for non-task files", () => {
		const plugin = createPlugin(null);
		const menu = new Menu() as never;
		setFrontmatter(plugin, "Notes/plain-note.md", { tags: ["note"] });

		plugin.addTaskNotesFileMenuActions(menu, new TFile("Notes/plain-note.md"));

		expect((menu as { items: unknown[] }).items).toEqual([]);
	});
});
