import { App, Menu } from "obsidian";
import { TaskContextMenu } from "../../../src/components/TaskContextMenu";
import { createI18nService } from "../../../src/i18n";
import { formatDateForStorage, getTodayString } from "../../../src/utils/dateUtils";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";

/**
 * U5 — the completion actions live under a "Complete or skip" submenu (just
 * "Complete" for non-recurring). Labels are uniform across task types (no
 * per-type qualifier). Covers AE1, AE2, AE5, AE7.
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

function titleOf(item: MockMenuItem): string | undefined {
	return "type" in item ? undefined : item.setTitle?.mock.calls[0]?.[0];
}

function submenuOf(item: MockMenuItem): MockMenu | undefined {
	if ("type" in item) return undefined;
	const results = item.setSubmenu?.mock.results;
	return results && results.length ? (results[results.length - 1].value as MockMenu) : undefined;
}

/** Find a menu item by title anywhere in the tree (top level or any submenu). */
function findItem(
	title: string,
	menu: MockMenu | undefined = menuMock.mock.results[0]?.value as MockMenu,
	seen = new Set<MockMenu>()
): Record<string, jest.Mock> | undefined {
	if (!menu || seen.has(menu)) return undefined;
	seen.add(menu);
	for (const item of menu.items) {
		if ("type" in item) continue;
		if (titleOf(item) === title) return item as Record<string, jest.Mock>;
		const found = findItem(title, submenuOf(item), seen);
		if (found) return found;
	}
	return undefined;
}

/** The items directly inside the top-level "Complete or skip"/"Complete" submenu. */
function completionSubmenuTitles(): string[] {
	const top = menuMock.mock.results[0].value as MockMenu;
	const parent = top.items.find(
		(it) => titleOf(it) === "Complete or skip" || titleOf(it) === "Complete"
	);
	const sub = parent ? submenuOf(parent) : undefined;
	return sub
		? sub.items
				.map(titleOf)
				.filter((t): t is string => typeof t === "string")
		: [];
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

		it("nests the four actions + skip under a 'Complete or Skip' submenu and drops the old single item", () => {
			new TaskContextMenu({
				task: recurring({ due: "2026-06-30" }),
				plugin: createPlugin(),
				targetDate: new Date("2026-06-15T12:00:00"),
			});

			// The submenu exists at the top level...
			const top = menuMock.mock.results[0].value as MockMenu;
			expect(top.items.some((it) => titleOf(it) === "Complete or skip")).toBe(true);
			// ...and holds the four completion actions plus skip.
			expect(completionSubmenuTitles()).toEqual(
				expect.arrayContaining([
					"Completed today",
					"Completed on schedule",
					"Completed on due date",
					"Completed on (pick date)",
					"Skip instance",
				])
			);
			// old single item gone
			expect(findItem("Mark complete for this date")).toBeUndefined();
		});

		it("records the scheduled occurrence for 'Completed on Schedule' (AE1)", async () => {
			const plugin = createPlugin();
			const t = recurring();
			new TaskContextMenu({ task: t, plugin, targetDate: new Date("2026-06-15T12:00:00") });

			await findItem("Completed on schedule")?.onClick.mock.calls[0]?.[0]();

			const [, date] = (plugin.toggleRecurringTaskComplete as jest.Mock).mock.calls[0];
			expect(formatDateForStorage(date)).toBe("2026-06-02");
		});

		it("resolves 'Completed on Schedule' to scheduled for a completion-anchored recurrence (AE2 re-anchor)", async () => {
			const plugin = createPlugin();
			const t = recurring({ recurrence_anchor: "completion", scheduled: "2026-06-02" });
			new TaskContextMenu({ task: t, plugin, targetDate: new Date("2026-06-15T12:00:00") });

			await findItem("Completed on schedule")?.onClick.mock.calls[0]?.[0]();
			const [, date] = (plugin.toggleRecurringTaskComplete as jest.Mock).mock.calls[0];
			expect(formatDateForStorage(date)).toBe("2026-06-02");
		});

		it("records the due date for 'Completed on Due Date'", async () => {
			const plugin = createPlugin();
			const t = recurring({ due: "2026-06-30" });
			new TaskContextMenu({ task: t, plugin, targetDate: new Date("2026-06-15T12:00:00") });

			await findItem("Completed on due date")?.onClick.mock.calls[0]?.[0]();

			const [, date] = (plugin.toggleRecurringTaskComplete as jest.Mock).mock.calls[0];
			expect(formatDateForStorage(date)).toBe("2026-06-30");
		});

		it("disables 'Completed on Due Date' with a reason when there is no due date (AE5)", () => {
			new TaskContextMenu({
				task: recurring({ due: undefined }),
				plugin: createPlugin(),
				targetDate: new Date("2026-06-15T12:00:00"),
			});

			expect(findItem("Completed on due date")?.setDisabled).toHaveBeenCalledWith(true);
			expect(findItem("Completed today")?.setDisabled).not.toHaveBeenCalledWith(true);
		});

		it("shows 'Mark Incomplete' for an already-recorded instance and toggles it out (AE7)", async () => {
			const plugin = createPlugin();
			const t = recurring({ complete_instances: ["2026-06-02"] });
			new TaskContextMenu({
				task: t,
				plugin,
				targetDate: new Date("2026-06-02T00:00:00Z"),
				occurrenceDate: new Date("2026-06-02T00:00:00Z"),
			});

			// The asScheduled action (resolving 2026-06-02) collapses to Mark Incomplete.
			const incompleteItem = findItem("Mark incomplete");
			expect(incompleteItem).toBeDefined();

			await incompleteItem?.onClick.mock.calls[0]?.[0]();
			expect(plugin.toggleRecurringTaskComplete).toHaveBeenCalled();
		});
	});

	describe("non-recurring", () => {
		it("nests the four actions under a 'Complete' submenu (no skip, uniform labels)", () => {
			new TaskContextMenu({
				task: task({ scheduled: "2026-06-02", due: "2026-06-30" }),
				plugin: createPlugin(),
				targetDate: new Date("2026-06-15T12:00:00"),
			});

			const top = menuMock.mock.results[0].value as MockMenu;
			expect(top.items.some((it) => titleOf(it) === "Complete")).toBe(true);
			const titles = completionSubmenuTitles();
			expect(titles).toEqual(
				expect.arrayContaining([
					"Completed today",
					"Completed on schedule",
					"Completed on due date",
					"Completed on (pick date)",
				])
			);
			// Non-recurring has no skip action.
			expect(titles).not.toContain("Skip instance");
		});

		it("dispatches a status change carrying the resolved completion date", async () => {
			const plugin = createPlugin();
			const t = task({ scheduled: "2026-06-02" });
			new TaskContextMenu({ task: t, plugin, targetDate: new Date("2026-06-15T12:00:00") });

			await findItem("Completed on schedule")?.onClick.mock.calls[0]?.[0]();

			expect(plugin.updateTaskProperty).toHaveBeenCalledWith(t, "status", "done", {
				completionDate: "2026-06-02",
			});
		});

		it("records today for 'Completed Today'", async () => {
			const plugin = createPlugin();
			const t = task({ scheduled: "2026-06-02" });
			new TaskContextMenu({ task: t, plugin, targetDate: new Date("2026-06-15T12:00:00") });

			await findItem("Completed today")?.onClick.mock.calls[0]?.[0]();

			expect(plugin.updateTaskProperty).toHaveBeenCalledWith(t, "status", "done", {
				completionDate: getTodayString(),
			});
		});

		it("shows a notice and does not dispatch when no completed status is configured", async () => {
			const plugin = createPlugin();
			(plugin.statusManager.getCompletedStatuses as jest.Mock).mockReturnValue([]);
			const t = task({ scheduled: "2026-06-02" });
			new TaskContextMenu({ task: t, plugin, targetDate: new Date("2026-06-15T12:00:00") });

			await findItem("Completed today")?.onClick.mock.calls[0]?.[0]();

			expect(plugin.updateTaskProperty).not.toHaveBeenCalled();
		});

		it("disables scheduled/due for an undated task but keeps today and pick enabled (AE5)", () => {
			new TaskContextMenu({
				task: task(),
				plugin: createPlugin(),
				targetDate: new Date("2026-06-15T12:00:00"),
			});

			expect(findItem("Completed on schedule")?.setDisabled).toHaveBeenCalledWith(true);
			expect(findItem("Completed on due date")?.setDisabled).toHaveBeenCalledWith(true);
			expect(findItem("Completed today")?.setDisabled).not.toHaveBeenCalledWith(true);
			expect(findItem("Completed on (pick date)")?.setDisabled).not.toHaveBeenCalledWith(true);
		});

		it("collapses to a single 'Mark Incomplete' when already completed and reverts to the default status (AE7)", async () => {
			const plugin = createPlugin();
			const t = task({ status: "done", completedDate: "2026-06-02", scheduled: "2026-06-02" });
			new TaskContextMenu({ task: t, plugin, targetDate: new Date("2026-06-15T12:00:00") });

			expect(findItem("Completed today")).toBeUndefined();
			expect(findItem("Completed on schedule")).toBeUndefined();
			expect(findItem("Completed on (pick date)")).toBeUndefined();

			const incomplete = findItem("Mark incomplete");
			expect(incomplete).toBeDefined();
			await incomplete?.onClick.mock.calls[0]?.[0]();
			expect(plugin.updateTaskProperty).toHaveBeenCalledWith(t, "status", "open");
		});
	});
});
