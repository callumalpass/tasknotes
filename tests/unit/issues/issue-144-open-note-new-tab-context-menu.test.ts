import { App, Menu } from "obsidian";
import { MockObsidian } from "../../helpers/obsidian-runtime";
import { TaskContextMenu } from "../../../src/components/TaskContextMenu";
import { createI18nService } from "../../../src/i18n";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";

type MockMenuItem = {
	setTitle?: jest.Mock;
	onClick?: jest.Mock;
};

type MockMenu = {
	items: MockMenuItem[];
};

const menuMock = Menu as unknown as jest.Mock;

function createTask(): TaskInfo {
	return {
		id: "Tasks/open-new-tab.md",
		path: "Tasks/open-new-tab.md",
		title: "Open new tab",
		status: "open",
		priority: "normal",
		archived: false,
		tags: [],
		contexts: [],
		projects: [],
	} as TaskInfo;
}

function createPlugin(): TaskNotesPlugin {
	const app = new App();
	const openLinkText = jest.fn();
	(app.workspace as typeof app.workspace & { openLinkText: jest.Mock }).openLinkText =
		openLinkText;

	return {
		app,
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

describe("Issue #144: task context menu opens notes in a new tab", () => {
	beforeEach(() => {
		MockObsidian.reset();
		menuMock.mockClear();
	});

	afterEach(() => {
		MockObsidian.reset();
		menuMock.mockClear();
	});

	it("adds an Open note in new tab action to the task context menu", async () => {
		const plugin = createPlugin();
		await plugin.app.vault.create("Tasks/open-new-tab.md", "");

		new TaskContextMenu({
			task: createTask(),
			plugin,
			targetDate: new Date("2026-05-18T12:00:00"),
		});

		const menu = getTopLevelMenu();
		const newTabItem = findTopLevelTitle(menu, "Open note in new tab");

		expect(newTabItem).toBeDefined();

		const newTabHandler = newTabItem?.onClick?.mock.calls[0][0];
		newTabHandler();

		expect(plugin.app.workspace.openLinkText).toHaveBeenCalledWith(
			"Tasks/open-new-tab.md",
			"",
			true
		);
	});
});
