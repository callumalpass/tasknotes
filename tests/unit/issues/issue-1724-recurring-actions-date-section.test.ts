import { App, Menu, TFile } from "obsidian";
import { TaskContextMenu } from "../../../src/components/TaskContextMenu";
import { TaskActionPaletteModal } from "../../../src/modals/TaskActionPaletteModal";
import { createI18nService } from "../../../src/i18n";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";

type MockMenuItem = Record<string, jest.Mock> | { type: string };
type MockMenu = {
	items: MockMenuItem[];
};

const menuMock = Menu as unknown as jest.Mock;

function createRecurringTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		id: "Tasks/recurring.md",
		path: "Tasks/recurring.md",
		title: "Recurring task",
		status: "open",
		priority: "normal",
		recurrence: "DTSTART:20260516;FREQ=DAILY;INTERVAL=1",
		complete_instances: [],
		skipped_instances: [],
		...overrides,
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
			findMaterializedOccurrence: jest.fn(),
			materializeOccurrence: jest.fn(),
			getMaterializedOccurrenceParent: jest.fn(),
			skipMaterializedOccurrence: jest.fn(),
			unskipMaterializedOccurrence: jest.fn(),
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

function findTopLevelMenuItem(title: string): Record<string, jest.Mock> | undefined {
	const topLevelMenu = menuMock.mock.results[0].value as MockMenu;
	return topLevelMenu.items.find(
		(item): item is Record<string, jest.Mock> =>
			!("type" in item) && item.setTitle.mock.calls[0]?.[0] === title
	);
}

function getAllMenuTitles(): string[] {
	const collectTitles = (menu: MockMenu | undefined, seen = new Set<MockMenu>()): string[] => {
		if (!menu || seen.has(menu)) return [];
		seen.add(menu);

		return menu.items.flatMap((item) => {
			if ("type" in item) return [];
			const ownTitles = item.setTitle.mock.calls
				.map(([title]) => title)
				.filter((title): title is string => typeof title === "string");
			const submenuTitles = item.setSubmenu.mock.results.flatMap((result) =>
				collectTitles(result.value as MockMenu | undefined, seen)
			);
			return [...ownTitles, ...submenuTitles];
		});
	};

	return collectTitles(menuMock.mock.results[0]?.value as MockMenu | undefined);
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
				"Open or create occurrence note",
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
		expect(titles.indexOf("Skip instance")).toBeLessThan(
			titles.indexOf("Open or create occurrence note")
		);
		expect(titles.indexOf("Open or create occurrence note")).toBeLessThan(
			titles.indexOf("Reminders")
		);
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
		const occurrenceNote = actions.find(
			(action) => action.id === "open-or-create-occurrence-note"
		);

		expect(recurringComplete?.category).toBe("dates");
		expect(occurrenceNote?.category).toBe("dates");
		expect(actions.findIndex((action) => action.id.startsWith("priority-"))).toBeLessThan(
			actions.findIndex((action) => action.id === "complete-recurring-instance")
		);
	});

	it("opens the materialized occurrence note from the recurring task menu", async () => {
		const task = createRecurringTask();
		const plugin = createPlugin();
		const occurrence = {
			...task,
			path: "Tasks/recurring 2026-05-16.md",
			recurrence: undefined,
			recurrence_parent: "[[Tasks/recurring]]",
			occurrence_date: "2026-05-16",
		};
		const openFile = jest.fn();
		plugin.taskService.findMaterializedOccurrence = jest.fn(async () => undefined);
		plugin.taskService.materializeOccurrence = jest.fn(async () => occurrence);
		plugin.app.vault.getAbstractFileByPath = jest.fn((path: string) => new TFile(path));
		plugin.app.workspace.getLeaf = jest.fn(() => ({ openFile }));

		new TaskContextMenu({
			task,
			plugin,
			targetDate: new Date("2026-05-16T12:00:00"),
		});

		const item = findTopLevelMenuItem("Open or create occurrence note");
		await item?.onClick.mock.calls[0]?.[0]();

		expect(plugin.taskService.findMaterializedOccurrence).toHaveBeenCalledWith(
			task,
			new Date("2026-05-16T12:00:00")
		);
		expect(plugin.taskService.materializeOccurrence).toHaveBeenCalledWith(
			task,
			new Date("2026-05-16T12:00:00")
		);
		expect(openFile).toHaveBeenCalledWith(expect.objectContaining({ path: occurrence.path }));
	});

	it("can promote occurrence controls for calendar event context menus", () => {
		new TaskContextMenu({
			task: createRecurringTask(),
			plugin: createPlugin(),
			targetDate: new Date("2026-05-16T12:00:00"),
			promoteOccurrenceControls: true,
		});

		const titles = getTopLevelTitles();
		expect(titles[0]).toBe("Open or create occurrence note");
		expect(titles.filter((title) => title === "Open or create occurrence note")).toHaveLength(
			1
		);
		expect(titles.indexOf("Open or create occurrence note")).toBeLessThan(
			titles.indexOf("Status")
		);
	});

	it("shows parent and skip controls for materialized occurrence notes", () => {
		const occurrence = {
			...createRecurringTask(),
			recurrence: undefined,
			status: "skipped",
			recurrence_parent: "[[Tasks/recurring]]",
			occurrence_date: "2026-05-16",
		};
		const plugin = createPlugin();
		plugin.settings.customStatuses = [
			...(plugin.settings.customStatuses || []),
			{
				id: "skipped",
				value: "skipped",
				label: "Skipped",
				color: "#888888",
				isCompleted: false,
				isSkipped: true,
				excludeFromCycle: false,
				order: 2,
				autoArchive: false,
				autoArchiveDelay: 5,
			},
		];

		new TaskContextMenu({
			task: occurrence,
			plugin,
			targetDate: new Date("2026-05-16T12:00:00"),
		});

		expect(getTopLevelTitles()).toEqual(
			expect.arrayContaining(["Open recurring parent", "Unskip occurrence"])
		);
	});

	it("shows parent materialization policy controls under recurrence", () => {
		new TaskContextMenu({
			task: createRecurringTask({
				occurrence_materialization: "on_completion",
				occurrence_next_trigger: "completion_or_skip",
			}),
			plugin: createPlugin(),
			targetDate: new Date("2026-05-16T12:00:00"),
		});

		const policyTitles = getAllMenuTitles().filter(
			(title) =>
				title.includes("Occurrence") ||
				title.includes("Create next") ||
				title.includes("Completion") ||
				title.includes("Rolling")
		);

		expect(policyTitles).toEqual(
			expect.arrayContaining([
				"Occurrence notes",
				"✓ Create next after completion",
				"Rolling window (not automated yet)",
				"✓ Completion or skip",
			])
		);
	});
});
