import { App, Menu } from "obsidian";
import { TaskContextMenu } from "../../../src/components/TaskContextMenu";
import { getRecurringTaskActionDate } from "../../../src/services/task-service/taskRecurringPlanning";
import { createI18nService } from "../../../src/i18n";
import { formatDateForStorage, getTodayString } from "../../../src/utils/dateUtils";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";

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

function submenuOf(item: MockMenuItem): MockMenu | undefined {
	if ("type" in item) return undefined;
	const results = item.setSubmenu?.mock.results;
	return results && results.length ? (results[results.length - 1].value as MockMenu) : undefined;
}

// Skip now lives inside the "Complete or skip" submenu, so search deep.
function findTopLevelMenuItem(
	title: string,
	menu: MockMenu | undefined = menuMock.mock.results[0]?.value as MockMenu,
	seen = new Set<MockMenu>()
): Record<string, jest.Mock> | undefined {
	if (!menu || seen.has(menu)) return undefined;
	seen.add(menu);
	for (const item of menu.items) {
		if ("type" in item) continue;
		if (item.setTitle?.mock.calls[0]?.[0] === title) return item as Record<string, jest.Mock>;
		const found = findTopLevelMenuItem(title, submenuOf(item), seen);
		if (found) return found;
	}
	return undefined;
}

describe("Skip this instance records the occurrence date", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		// Freeze at midday UTC so "today" resolves deterministically regardless of
		// the runner's timezone (getTodayLocal vs. new Date() agree within +/-12h).
		jest.setSystemTime(new Date("2026-06-06T12:00:00Z"));
		menuMock.mockClear();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
		menuMock.mockClear();
	});

	it("List/Kanban skip passes no explicit date so the service resolves the scheduled occurrence, not today", async () => {
		const task = createRecurringTask();
		const plugin = createPlugin();

		// List/Kanban open the menu with a view-wide "today" targetDate and NO
		// occurrenceDate. The old behavior forwarded that today to the service.
		new TaskContextMenu({
			task,
			plugin,
			targetDate: new Date("2026-06-06T12:00:00"), // a Saturday review, not the Tuesday occurrence
		});

		const skipItem = findTopLevelMenuItem("Skip instance");
		await skipItem?.onClick.mock.calls[0]?.[0]();

		// The fix: pass undefined so getRecurringTaskActionDate resolves anchor-aware.
		expect(plugin.taskService.toggleRecurringTaskSkipped).toHaveBeenCalledWith(task, undefined);
		expect(plugin.taskService.toggleRecurringTaskSkipped).not.toHaveBeenCalledWith(
			task,
			expect.any(Date)
		);

		// And that anchor-aware resolution records the scheduled Tuesday, not today.
		const resolved = getRecurringTaskActionDate(task, undefined);
		expect(formatDateForStorage(resolved)).toBe("2026-06-02");
	});

	it("Calendar skip records the clicked occurrence via occurrenceDate", async () => {
		const task = createRecurringTask();
		const plugin = createPlugin();
		const clickedOccurrence = new Date("2026-06-09T00:00:00Z"); // next Tuesday

		new TaskContextMenu({
			task,
			plugin,
			targetDate: clickedOccurrence,
			occurrenceDate: clickedOccurrence,
		});

		const skipItem = findTopLevelMenuItem("Skip instance");
		await skipItem?.onClick.mock.calls[0]?.[0]();

		expect(plugin.taskService.toggleRecurringTaskSkipped).toHaveBeenCalledWith(
			task,
			clickedOccurrence
		);
	});

	it("completion-anchored skip still records today (unchanged)", async () => {
		const task = createRecurringTask({
			recurrence_anchor: "completion",
			scheduled: "2026-06-02",
		});
		const plugin = createPlugin();

		new TaskContextMenu({
			task,
			plugin,
			targetDate: new Date("2026-06-06T12:00:00"),
		});

		const skipItem = findTopLevelMenuItem("Skip instance");
		await skipItem?.onClick.mock.calls[0]?.[0]();

		// No explicit date passed; the service's anchor-aware default returns today
		// for completion-anchored recurrences.
		expect(plugin.taskService.toggleRecurringTaskSkipped).toHaveBeenCalledWith(task, undefined);
		const resolved = getRecurringTaskActionDate(task, undefined);
		expect(formatDateForStorage(resolved)).toBe(getTodayString()); // today, not scheduled
	});

	it("List/Kanban shows Unskip once the resolved scheduled date is already skipped, and toggles it out", async () => {
		// The label corollary of the fix: skip records the scheduled date, so the
		// card must offer "Unskip" for that same date even with NO occurrenceDate.
		const task = createRecurringTask({ skipped_instances: ["2026-06-02"] });
		const plugin = createPlugin();

		new TaskContextMenu({
			task,
			plugin,
			targetDate: new Date("2026-06-06T12:00:00"), // view-wide today, not the occurrence
		});

		expect(findTopLevelMenuItem("Unskip instance")).toBeDefined();
		expect(findTopLevelMenuItem("Skip instance")).toBeUndefined();

		const unskipItem = findTopLevelMenuItem("Unskip instance");
		await unskipItem?.onClick.mock.calls[0]?.[0]();
		// Still no explicit date: the service re-resolves the same scheduled date on the fresh task.
		expect(plugin.taskService.toggleRecurringTaskSkipped).toHaveBeenCalledWith(task, undefined);
	});

	it("due-only recurring skip resolves to today (no scheduled anchor)", async () => {
		// recurrence + due, no scheduled: getRecurringTaskActionDate falls through to today.
		const task = createRecurringTask({ due: "2026-06-02" });
		delete (task as Partial<TaskInfo>).scheduled;
		const plugin = createPlugin();

		new TaskContextMenu({
			task,
			plugin,
			targetDate: new Date("2026-06-06T12:00:00"),
		});

		const skipItem = findTopLevelMenuItem("Skip instance");
		await skipItem?.onClick.mock.calls[0]?.[0]();

		expect(plugin.taskService.toggleRecurringTaskSkipped).toHaveBeenCalledWith(task, undefined);
		expect(formatDateForStorage(getRecurringTaskActionDate(task, undefined))).toBe(getTodayString());
	});

	it("shows Unskip for a Calendar occurrence that is already skipped and toggles the same date out", async () => {
		const clickedOccurrence = new Date("2026-06-09T00:00:00Z");
		const task = createRecurringTask({
			skipped_instances: [formatDateForStorage(clickedOccurrence)],
		});
		const plugin = createPlugin();

		new TaskContextMenu({
			task,
			plugin,
			targetDate: clickedOccurrence,
			occurrenceDate: clickedOccurrence,
		});

		const unskipItem = findTopLevelMenuItem("Unskip instance");
		expect(unskipItem).toBeDefined();

		await unskipItem?.onClick.mock.calls[0]?.[0]();
		expect(plugin.taskService.toggleRecurringTaskSkipped).toHaveBeenCalledWith(
			task,
			clickedOccurrence
		);
	});
});
