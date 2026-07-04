import { App, Menu } from "obsidian";
import { TaskContextMenu } from "../../../src/components/TaskContextMenu";
import { createI18nService } from "../../../src/i18n";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";

/**
 * U5 — the four explicit completion actions (with un-complete) replace the single
 * recurring "Mark complete for this date" item and are net-new for non-recurring
 * tasks. Covers AE1, AE2, AE5, AE7.
 */

type MockMenuItem = Record<string, jest.Mock> | { type: string };
type MockMenu = { items: MockMenuItem[] };

const menuMock = Menu as unknown as jest.Mock;

function createPlugin(): TaskNotesPlugin {
	const app = new App();
	return {
		app,
		i18n: createI18nService(),
		settings: {
			defaultTaskStatus: "open",
			customStatuses: [
				{ value: "open", label: "Open", order: 0 },
				{ value: "done", label: "Done", order: 1, isCompleted: true },
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
			getCompletedStatuses: jest.fn(() => ["done"]),
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

function task(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		id: "Tasks/t.md",
		path: "Tasks/t.md",
		title: "T",
		status: "open",
		priority: "normal",
		complete_instances: [],
		skipped_instances: [],
		...overrides,
	} as TaskInfo;
}

function findItem(title: string): Record<string, jest.Mock> | undefined {
	const menu = menuMock.mock.results[0].value as MockMenu;
	return menu.items.find(
		(item): item is Record<string, jest.Mock> =>
			!("type" in item) && item.setTitle.mock.calls[0]?.[0] === title
	);
}

function allTitles(): string[] {
	const menu = menuMock.mock.results[0].value as MockMenu;
	return menu.items
		.filter((item): item is Record<string, jest.Mock> => !("type" in item))
		.map((item) => item.setTitle.mock.calls[0]?.[0])
		.filter((t): t is string => typeof t === "string");
}

describe("U5: completion menu items", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2026-06-15T12:00:00Z")); // not the scheduled/due dates below
		menuMock.mockClear();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
		menuMock.mockClear();
	});

	describe("recurring", () => {
		const recurring = (o: Partial<TaskInfo> = {}) =>
			task({
				recurrence: "DTSTART:20260601;FREQ=WEEKLY;BYDAY=TU",
				recurrence_anchor: "scheduled",
				scheduled: "2026-06-02",
				...o,
			});

		it("offers the four actions with an (Instance) prefix and removes the old single item", () => {
			new TaskContextMenu({
				task: recurring({ due: "2026-06-30" }),
				plugin: createPlugin(),
				targetDate: new Date("2026-06-15T12:00:00"),
			});

			expect(findItem("(Instance) Complete today")).toBeDefined();
			expect(findItem("(Instance) Complete as scheduled")).toBeDefined();
			expect(findItem("(Instance) Complete on due date")).toBeDefined();
			expect(findItem("(Instance) Complete on…")).toBeDefined();
			// old single item gone
			expect(findItem("Mark complete for this date")).toBeUndefined();
		});

		it("records the scheduled occurrence for 'Complete as scheduled' (AE1)", async () => {
			const plugin = createPlugin();
			const t = recurring();
			new TaskContextMenu({ task: t, plugin, targetDate: new Date("2026-06-15T12:00:00") });

			await findItem("(Instance) Complete as scheduled")?.onClick.mock.calls[0]?.[0]();

			const [, date] = (plugin.toggleRecurringTaskComplete as jest.Mock).mock.calls[0];
			const { formatDateForStorage } = require("../../../src/utils/dateUtils");
			expect(formatDateForStorage(date)).toBe("2026-06-02");
		});

		it("resolves 'Complete as scheduled' to scheduled for a completion-anchored recurrence (AE2 re-anchor)", async () => {
			const plugin = createPlugin();
			const t = recurring({ recurrence_anchor: "completion", scheduled: "2026-06-02" });
			new TaskContextMenu({ task: t, plugin, targetDate: new Date("2026-06-15T12:00:00") });

			await findItem("(Instance) Complete as scheduled")?.onClick.mock.calls[0]?.[0]();
			const { formatDateForStorage } = require("../../../src/utils/dateUtils");
			const [, date] = (plugin.toggleRecurringTaskComplete as jest.Mock).mock.calls[0];
			expect(formatDateForStorage(date)).toBe("2026-06-02");
		});

		it("disables 'Complete on due date' with a reason when there is no due date (AE5)", () => {
			new TaskContextMenu({
				task: recurring({ due: undefined }),
				plugin: createPlugin(),
				targetDate: new Date("2026-06-15T12:00:00"),
			});

			const onDue = findItem("(Instance) Complete on due date");
			expect(onDue?.setDisabled).toHaveBeenCalledWith(true);
			// enabled actions remain
			expect(findItem("(Instance) Complete today")?.setDisabled).not.toHaveBeenCalledWith(true);
		});

		it("shows '(Instance) Mark incomplete' for an already-recorded instance and toggles it out (AE7)", async () => {
			const plugin = createPlugin();
			const t = recurring({ complete_instances: ["2026-06-02"] });
			new TaskContextMenu({
				task: t,
				plugin,
				targetDate: new Date("2026-06-02T00:00:00Z"),
				occurrenceDate: new Date("2026-06-02T00:00:00Z"),
			});

			// The asScheduled action (resolving 2026-06-02) collapses to Mark incomplete.
			const incompleteItem = findItem("(Instance) Mark incomplete");
			expect(incompleteItem).toBeDefined();

			await incompleteItem?.onClick.mock.calls[0]?.[0]();
			expect(plugin.toggleRecurringTaskComplete).toHaveBeenCalled();
		});

		it("records the due date for 'Complete on due date'", async () => {
			const plugin = createPlugin();
			const t = recurring({ due: "2026-06-30" });
			new TaskContextMenu({ task: t, plugin, targetDate: new Date("2026-06-15T12:00:00") });

			await findItem("(Instance) Complete on due date")?.onClick.mock.calls[0]?.[0]();

			const { formatDateForStorage } = require("../../../src/utils/dateUtils");
			const [, date] = (plugin.toggleRecurringTaskComplete as jest.Mock).mock.calls[0];
			expect(formatDateForStorage(date)).toBe("2026-06-30");
		});
	});

	describe("non-recurring", () => {
		it("offers the four actions net-new WITHOUT an (Instance) prefix", () => {
			new TaskContextMenu({
				task: task({ scheduled: "2026-06-02", due: "2026-06-30" }),
				plugin: createPlugin(),
				targetDate: new Date("2026-06-15T12:00:00"),
			});

			expect(findItem("Complete today")).toBeDefined();
			expect(findItem("Complete as scheduled")).toBeDefined();
			expect(findItem("Complete on due date")).toBeDefined();
			expect(findItem("Complete on…")).toBeDefined();
			expect(allTitles().some((t) => t.startsWith("(Instance)"))).toBe(false);
		});

		it("dispatches a status change carrying the resolved completion date", async () => {
			const plugin = createPlugin();
			const t = task({ scheduled: "2026-06-02" });
			new TaskContextMenu({ task: t, plugin, targetDate: new Date("2026-06-15T12:00:00") });

			await findItem("Complete as scheduled")?.onClick.mock.calls[0]?.[0]();

			expect(plugin.updateTaskProperty).toHaveBeenCalledWith(t, "status", "done", {
				completionDate: "2026-06-02",
			});
		});

		it("records today for 'Complete today'", async () => {
			const plugin = createPlugin();
			const t = task({ scheduled: "2026-06-02" });
			new TaskContextMenu({ task: t, plugin, targetDate: new Date("2026-06-15T12:00:00") });

			await findItem("Complete today")?.onClick.mock.calls[0]?.[0]();

			const { getTodayString } = require("../../../src/utils/dateUtils");
			expect(plugin.updateTaskProperty).toHaveBeenCalledWith(t, "status", "done", {
				completionDate: getTodayString(),
			});
		});

		it("shows a notice and does not dispatch when no completed status is configured", async () => {
			const plugin = createPlugin();
			(plugin.statusManager.getCompletedStatuses as jest.Mock).mockReturnValue([]);
			const t = task({ scheduled: "2026-06-02" });
			new TaskContextMenu({ task: t, plugin, targetDate: new Date("2026-06-15T12:00:00") });

			await findItem("Complete today")?.onClick.mock.calls[0]?.[0]();

			expect(plugin.updateTaskProperty).not.toHaveBeenCalled();
		});

		it("disables scheduled/due for an undated task but keeps today and pick enabled (AE5)", () => {
			new TaskContextMenu({
				task: task(),
				plugin: createPlugin(),
				targetDate: new Date("2026-06-15T12:00:00"),
			});

			expect(findItem("Complete as scheduled")?.setDisabled).toHaveBeenCalledWith(true);
			expect(findItem("Complete on due date")?.setDisabled).toHaveBeenCalledWith(true);
			expect(findItem("Complete today")?.setDisabled).not.toHaveBeenCalledWith(true);
			expect(findItem("Complete on…")?.setDisabled).not.toHaveBeenCalledWith(true);
		});

		it("collapses to a single 'Mark incomplete' when already in a completed status and reverts to the default status (AE7)", async () => {
			const plugin = createPlugin();
			const t = task({ status: "done", completedDate: "2026-06-02", scheduled: "2026-06-02" });
			new TaskContextMenu({ task: t, plugin, targetDate: new Date("2026-06-15T12:00:00") });

			expect(findItem("Complete today")).toBeUndefined();
			expect(findItem("Complete as scheduled")).toBeUndefined();
			expect(findItem("Complete on…")).toBeUndefined();

			const incomplete = findItem("Mark incomplete");
			expect(incomplete).toBeDefined();
			await incomplete?.onClick.mock.calls[0]?.[0]();
			expect(plugin.updateTaskProperty).toHaveBeenCalledWith(t, "status", "open");
		});
	});
});
