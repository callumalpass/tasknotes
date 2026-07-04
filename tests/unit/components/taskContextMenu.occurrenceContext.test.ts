import { App, Menu } from "obsidian";
import { TaskContextMenu } from "../../../src/components/TaskContextMenu";
import { createI18nService } from "../../../src/i18n";
import { formatDateForStorage } from "../../../src/utils/dateUtils";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";

/**
 * U1 — a distinct optional `occurrenceDate` carries the clicked-occurrence
 * signal, separate from the overloaded `targetDate`. Occurrence-aware menu
 * logic must read `occurrenceDate` and never infer occurrence-ness from
 * `targetDate` (KTD5). When absent, behavior falls through to the anchor-aware
 * service default.
 */

type MockMenuItem = Record<string, jest.Mock> | { type: string };
type MockMenu = { items: MockMenuItem[] };

const menuMock = Menu as unknown as jest.Mock;

function createRecurringTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		id: "Tasks/recurring.md",
		path: "Tasks/recurring.md",
		title: "Recurring task",
		status: "open",
		priority: "normal",
		recurrence: "DTSTART:20260601;FREQ=WEEKLY;BYDAY=TU",
		recurrence_anchor: "scheduled",
		scheduled: "2026-06-02",
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
			calendarViewSettings: { enableTimeblocking: false },
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

function findTopLevelMenuItem(title: string): Record<string, jest.Mock> | undefined {
	const topLevelMenu = menuMock.mock.results[0].value as MockMenu;
	return topLevelMenu.items.find(
		(item): item is Record<string, jest.Mock> =>
			!("type" in item) && item.setTitle.mock.calls[0]?.[0] === title
	);
}

describe("U1: occurrenceDate context field", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		menuMock.mockClear();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
		menuMock.mockClear();
	});

	it("is optional — existing callers that omit it still build a menu", () => {
		expect(
			() =>
				new TaskContextMenu({
					task: createRecurringTask(),
					plugin: createPlugin(),
					targetDate: new Date("2026-06-06T12:00:00"),
				})
		).not.toThrow();

		expect(findTopLevelMenuItem("Skip instance")).toBeDefined();
	});

	it("reads occurrenceDate (not targetDate) to decide the skip/unskip label", () => {
		// The already-skipped date matches occurrenceDate but NOT targetDate.
		const occurrence = new Date("2026-06-09T00:00:00Z");
		const task = createRecurringTask({
			skipped_instances: [formatDateForStorage(occurrence)],
		});

		new TaskContextMenu({
			task,
			plugin: createPlugin(),
			// A different, unrelated targetDate — if the label inferred from
			// targetDate it would (wrongly) show "Skip instance".
			targetDate: new Date("2026-06-06T12:00:00"),
			occurrenceDate: occurrence,
		});

		expect(findTopLevelMenuItem("Unskip instance")).toBeDefined();
		expect(findTopLevelMenuItem("Skip instance")).toBeUndefined();
	});
});
