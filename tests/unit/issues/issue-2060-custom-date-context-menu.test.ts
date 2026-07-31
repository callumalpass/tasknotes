import { App, Menu } from "obsidian";
import { TaskContextMenu } from "../../../src/components/TaskContextMenu";
import { DateTimePickerModal } from "../../../src/modals/DateTimePickerModal";
import { createI18nService } from "../../../src/i18n";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";

jest.mock("../../../src/modals/DateTimePickerModal", () => ({
	DateTimePickerModal: jest.fn().mockImplementation(() => ({
		open: jest.fn(),
	})),
}));

type MockMenuItem = {
	setTitle?: jest.Mock;
	setIcon?: jest.Mock;
	onClick?: jest.Mock;
	submenu?: MockMenu;
	type?: string;
};

type MockMenu = {
	items: MockMenuItem[];
	hide: jest.Mock;
};

const menuMock = Menu as unknown as jest.Mock;
const dateTimePickerMock = DateTimePickerModal as unknown as jest.Mock;

function createTask(overrides: Record<string, unknown> = {}): TaskInfo {
	return {
		id: "Tasks/custom-date-menu.md",
		path: "Tasks/custom-date-menu.md",
		title: "Custom date menu",
		status: "open",
		priority: "normal",
		archived: false,
		tags: [],
		contexts: [],
		projects: [],
		...overrides,
	} as unknown as TaskInfo;
}

function createPlugin(): TaskNotesPlugin {
	const app = new App();
	return {
		app,
		i18n: createI18nService(),
		settings: {
			customStatuses: [],
			customPriorities: [],
			userFields: [
				{
					id: "snoozed",
					key: "snoozed",
					displayName: "Snoozed",
					type: "date",
				},
				{
					id: "energy",
					key: "energy",
					displayName: "Energy",
					type: "number",
				},
			],
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
		updateTaskProperty: jest.fn(async (task, property, value) => ({
			...task,
			[property]: value,
		})),
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

function findMenuItemByTitle(menu: MockMenu | undefined, title: string): MockMenuItem | undefined {
	return menu?.items.find((item) =>
		item.setTitle?.mock.calls.some(([value]) => value === title)
	);
}

function createMenuContext(task = createTask({ snoozed: "2026-06-24" })) {
	const plugin = createPlugin();
	const onUpdate = jest.fn();

	new TaskContextMenu({
		task,
		plugin,
		targetDate: new Date("2026-06-21T12:00:00"),
		onUpdate,
	});

	const customDatesItem = findMenuItemByTitle(getTopLevelMenu(), "Custom dates");
	const snoozedItem = findMenuItemByTitle(customDatesItem?.submenu, "Snoozed");

	return {
		plugin,
		onUpdate,
		topLevelMenu: getTopLevelMenu(),
		customDatesItem,
		snoozedItem,
		snoozedMenu: snoozedItem?.submenu,
	};
}

describe("Issue #2060: custom date fields in the task context menu", () => {
	beforeEach(() => {
		menuMock.mockClear();
		dateTimePickerMock.mockClear();
	});

	afterEach(() => {
		menuMock.mockClear();
		dateTimePickerMock.mockClear();
	});

	it("adds date-type user fields to a Custom dates submenu", () => {
		const { customDatesItem, snoozedItem, snoozedMenu } = createMenuContext();

		expect(customDatesItem).toBeDefined();
		expect(customDatesItem?.setIcon).toHaveBeenCalledWith("calendar-days");
		expect(snoozedItem).toBeDefined();
		expect(findMenuItemByTitle(customDatesItem?.submenu, "Energy")).toBeUndefined();
		expect(findMenuItemByTitle(snoozedMenu, "Pick Snoozed date")).toBeDefined();
		expect(findMenuItemByTitle(snoozedMenu, "Clear date")).toBeDefined();
	});

	it("clears custom dates through the configured field key", async () => {
		const task = createTask({ snoozed: "2026-06-24" });
		const { plugin, onUpdate, snoozedMenu } = createMenuContext(task);
		const clearItem = findMenuItemByTitle(snoozedMenu, "Clear date");

		clearItem?.onClick?.mock.calls[0][0]();
		await Promise.resolve();
		await Promise.resolve();

		expect(plugin.updateTaskProperty).toHaveBeenCalledWith(task, "snoozed", undefined);
		expect(onUpdate).toHaveBeenCalledTimes(1);
	});

	it("opens the date-only picker for custom date fields", () => {
		const { plugin, topLevelMenu, snoozedMenu } = createMenuContext();
		const pickItem = findMenuItemByTitle(snoozedMenu, "Pick Snoozed date");

		pickItem?.onClick?.mock.calls[0][0]();

		expect(topLevelMenu.hide).toHaveBeenCalledTimes(1);
		expect(dateTimePickerMock).toHaveBeenCalledWith(
			plugin.app,
			expect.objectContaining({
				currentDate: "2026-06-24",
				title: "Pick Snoozed date",
				showTime: false,
				plugin,
			})
		);
		expect(dateTimePickerMock.mock.results[0].value.open).toHaveBeenCalledTimes(1);
	});
});
