import { App, Menu } from "obsidian";
import { TaskContextMenu } from "../../../src/components/TaskContextMenu";
import { TaskActionPaletteModal } from "../../../src/modals/TaskActionPaletteModal";
import { createI18nService } from "../../../src/i18n";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";

jest.mock("obsidian");

type MockMenuItem = Record<string, jest.Mock> | { type: string };
type MockMenu = {
	items: MockMenuItem[];
};

const menuMock = Menu as unknown as jest.Mock;

function createRecurringTask(): TaskInfo {
	return {
		id: "Tasks/recurring.md",
		path: "Tasks/recurring.md",
		title: "Recurring task",
		status: "open",
		priority: "normal",
		recurrence: "DTSTART:20260516;FREQ=DAILY;INTERVAL=1",
		complete_instances: [],
		skipped_instances: [],
	} as TaskInfo;
}

function createPlugin(): TaskNotesPlugin {
	const app = new App();
	return {
		app,
		i18n: createI18nService(),
		settings: {
			customStatuses: [
				{ value: "open", label: "Open", order: 0 },
				{ value: "done", label: "Done", order: 1 },
			],
			customPriorities: [{ value: "normal", label: "Normal", weight: 0 }],
			calendarViewSettings: {
				enableTimeblocking: false,
			},
			useFrontmatterMarkdownLinks: true,
		},
		statusManager: {
			getAllStatuses: jest.fn(() => [
				{ value: "open", label: "Open" },
				{ value: "done", label: "Done" },
			]),
			getNonCompletionStatuses: jest.fn(() => [{ value: "open", label: "Open" }]),
			isCompletedStatus: jest.fn((status: string) => status === "done"),
		},
		priorityManager: {
			getAllPriorities: jest.fn(() => [{ value: "normal", label: "Normal" }]),
			getPrioritiesByWeight: jest.fn(() => [{ value: "normal", label: "Normal" }]),
		},
		taskService: {
			toggleRecurringTaskSkipped: jest.fn(),
			updateBlockingRelationships: jest.fn(),
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

function getTopLevelTitles(): string[] {
	const topLevelMenu = menuMock.mock.results[0].value as MockMenu;
	return topLevelMenu.items
		.filter((item): item is Record<string, jest.Mock> => !("type" in item))
		.map((item) => item.setTitle.mock.calls[0]?.[0])
		.filter((title): title is string => typeof title === "string");
}

describe("Issue #1724: recurring task actions belong with date menu items", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		menuMock.mockClear();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
		menuMock.mockClear();
	});

	it("places recurring complete and skip actions after scheduled date, not between status and priority", () => {
		new TaskContextMenu({
			task: createRecurringTask(),
			plugin: createPlugin(),
			targetDate: new Date("2026-05-16T12:00:00"),
		});

		const titles = getTopLevelTitles();

		expect(titles).toEqual(
			expect.arrayContaining([
				"Status",
				"Priority",
				"Due date",
				"Scheduled date",
				"Mark complete for this date",
				"Skip instance",
				"Reminders",
			])
		);

		expect(titles.indexOf("Status")).toBeLessThan(titles.indexOf("Priority"));
		expect(titles.indexOf("Priority")).toBeLessThan(
			titles.indexOf("Mark complete for this date")
		);
		expect(titles.indexOf("Scheduled date")).toBeLessThan(
			titles.indexOf("Mark complete for this date")
		);
		expect(titles.indexOf("Mark complete for this date")).toBeLessThan(
			titles.indexOf("Skip instance")
		);
		expect(titles.indexOf("Skip instance")).toBeLessThan(titles.indexOf("Reminders"));
	});

	it("categorizes the quick-action recurring completion action with date actions", () => {
		const modal = new TaskActionPaletteModal(
			new App() as never,
			createRecurringTask(),
			createPlugin(),
			new Date("2026-05-16T12:00:00")
		);

		const actions = modal.getItems();
		const recurringComplete = actions.find(
			(action) => action.id === "complete-recurring-instance"
		);

		expect(recurringComplete?.category).toBe("dates");
		expect(actions.findIndex((action) => action.id.startsWith("priority-"))).toBeLessThan(
			actions.findIndex((action) => action.id === "complete-recurring-instance")
		);
	});
});
