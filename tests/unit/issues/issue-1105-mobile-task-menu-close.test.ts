import { App, Menu, Platform } from "obsidian";
import { TaskContextMenu } from "../../../src/components/TaskContextMenu";
import { createI18nService } from "../../../src/i18n";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";

jest.mock("obsidian");

type MutablePlatform = typeof Platform & {
	isMobile: boolean;
	isDesktop: boolean;
};

type MockMenuItem = {
	setTitle?: jest.Mock;
	setIcon?: jest.Mock;
	onClick?: jest.Mock;
	type?: string;
};

type MockMenu = {
	items: MockMenuItem[];
	hide: jest.Mock;
};

const menuMock = Menu as unknown as jest.Mock;
const mutablePlatform = Platform as MutablePlatform;

function createTask(): TaskInfo {
	return {
		id: "Tasks/mobile-menu.md",
		path: "Tasks/mobile-menu.md",
		title: "Mobile menu",
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

describe("Issue #1105: mobile task options menu dismissal", () => {
	beforeEach(() => {
		menuMock.mockClear();
		mutablePlatform.isMobile = false;
		mutablePlatform.isDesktop = true;
	});

	afterEach(() => {
		menuMock.mockClear();
		mutablePlatform.isMobile = false;
		mutablePlatform.isDesktop = true;
	});

	it("adds an explicit close action to the task menu on mobile", () => {
		mutablePlatform.isMobile = true;
		mutablePlatform.isDesktop = false;

		new TaskContextMenu({
			task: createTask(),
			plugin: createPlugin(),
			targetDate: new Date("2026-05-17T12:00:00"),
		});

		const menu = getTopLevelMenu();
		const closeItem = findTopLevelTitle(menu, "Close");

		expect(closeItem).toBeDefined();
		expect(closeItem?.setIcon).toHaveBeenCalledWith("x");

		const closeHandler = closeItem?.onClick?.mock.calls[0][0];
		closeHandler();

		expect(menu.hide).toHaveBeenCalledTimes(1);
	});

	it("does not add the extra close action on desktop", () => {
		new TaskContextMenu({
			task: createTask(),
			plugin: createPlugin(),
			targetDate: new Date("2026-05-17T12:00:00"),
		});

		expect(findTopLevelTitle(getTopLevelMenu(), "Close")).toBeUndefined();
	});
});
