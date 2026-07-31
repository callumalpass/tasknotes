import { App, Menu } from "obsidian";
import { MockObsidian } from "../../helpers/obsidian-runtime";
import { TaskContextMenu } from "../../../src/components/TaskContextMenu";
import { createI18nService } from "../../../src/i18n";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";

type MockMenuItem = {
	setTitle?: jest.Mock;
	setIcon?: jest.Mock;
	onClick?: jest.Mock;
};

type MockMenu = {
	items: MockMenuItem[];
};

const menuMock = Menu as unknown as jest.Mock;

function createTask(): TaskInfo {
	return {
		id: "Tasks/edit-from-menu.md",
		path: "Tasks/edit-from-menu.md",
		title: "Edit from menu",
		status: "open",
		priority: "normal",
		archived: false,
		tags: [],
		contexts: [],
		projects: [],
	} as TaskInfo;
}

function createPlugin(): TaskNotesPlugin {
	return {
		app: new App(),
		i18n: createI18nService(),
		settings: {
			customStatuses: [],
			customPriorities: [],
			calendarViewSettings: {
				enableTimeblocking: false,
			},
			useFrontmatterMarkdownLinks: true,
		},
		statusManager: {
			getAllStatuses: jest.fn(() => []),
			getNonCompletionStatuses: jest.fn(() => []),
			isCompletedStatus: jest.fn(() => false),
		},
		priorityManager: {
			getAllPriorities: jest.fn(() => []),
			getPrioritiesByWeight: jest.fn(() => []),
		},
		taskService: {
			toggleRecurringTaskSkipped: jest.fn(),
			updateBlockingRelationships: jest.fn(),
			deleteTask: jest.fn(),
		},
		cacheManager: {
			getAllContexts: jest.fn(() => []),
			getAllTasks: jest.fn(() => []),
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
		openTaskCreationModal: jest.fn(),
	} as unknown as TaskNotesPlugin;
}

function getTopLevelMenu(): MockMenu {
	return menuMock.mock.results[0].value as MockMenu;
}

function findTopLevelTitle(menu: MockMenu, title: string): MockMenuItem | undefined {
	return menu.items.find((item) =>
		item.setTitle?.mock.calls.some(([value]) => value === title)
	);
}

describe("Issue #2067: inline task context menu edit action", () => {
	beforeEach(() => {
		MockObsidian.reset();
		menuMock.mockClear();
	});

	afterEach(() => {
		MockObsidian.reset();
		menuMock.mockClear();
	});

	it("adds an Edit task action that opens the edit modal and refreshes after save", () => {
		const task = createTask();
		const plugin = createPlugin();
		const onUpdate = jest.fn();

		new TaskContextMenu({
			task,
			plugin,
			targetDate: new Date("2026-06-23T12:00:00"),
			onUpdate,
		});

		const editItem = findTopLevelTitle(getTopLevelMenu(), "Edit task");

		expect(editItem).toBeDefined();
		expect(editItem?.setIcon).toHaveBeenCalledWith("pencil");

		const editHandler = editItem?.onClick?.mock.calls[0][0];
		editHandler();

		expect(plugin.openTaskEditModal).toHaveBeenCalledWith(task, expect.any(Function));

		const editCallback = (plugin.openTaskEditModal as jest.Mock).mock.calls[0][1];
		editCallback({ ...task, title: "Edited from menu" });

		expect(onUpdate).toHaveBeenCalledTimes(1);
	});
});
