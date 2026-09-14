import { App, Menu } from "obsidian";

// Capture the DateTimePickerModal options so the test can drive onSelect.
jest.mock("../../../src/modals/DateTimePickerModal", () => ({
	DateTimePickerModal: jest.fn().mockImplementation(() => ({ open: jest.fn() })),
}));

import { TaskContextMenu } from "../../../src/components/TaskContextMenu";
import { DateTimePickerModal } from "../../../src/modals/DateTimePickerModal";
import { createI18nService } from "../../../src/i18n";
import { formatDateForStorage } from "../../../src/utils/dateUtils";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";

type MockMenuItem = Record<string, jest.Mock> | { type: string };
type MockMenu = { items: MockMenuItem[] };

const menuMock = Menu as unknown as jest.Mock;
const modalMock = DateTimePickerModal as unknown as jest.Mock;

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
		taskService: { toggleRecurringTaskSkipped: jest.fn(), updateBlockingRelationships: jest.fn() },
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

function submenuOf(item: MockMenuItem): MockMenu | undefined {
	if ("type" in item) return undefined;
	const results = item.setSubmenu?.mock.results;
	return results && results.length ? (results[results.length - 1].value as MockMenu) : undefined;
}

// Completion actions live inside the "Complete or Skip" submenu, so search deep.
function findItem(
	title: string,
	menu: MockMenu | undefined = menuMock.mock.results[0]?.value as MockMenu,
	seen = new Set<MockMenu>()
): Record<string, jest.Mock> | undefined {
	if (!menu || seen.has(menu)) return undefined;
	seen.add(menu);
	for (const item of menu.items) {
		if ("type" in item) continue;
		if (item.setTitle?.mock.calls[0]?.[0] === title) return item as Record<string, jest.Mock>;
		const found = findItem(title, submenuOf(item), seen);
		if (found) return found;
	}
	return undefined;
}

function getPickerOnSelect(): (date: string | null) => void {
	return modalMock.mock.calls[modalMock.mock.calls.length - 1][1].onSelect;
}

describe("Complete on… date picker", () => {
	beforeEach(() => {
		menuMock.mockClear();
		modalMock.mockClear();
	});

	it("records the picked date into complete_instances for a recurring task", async () => {
		const plugin = createPlugin();
		const t = task({ recurrence: "DTSTART:20260601;FREQ=WEEKLY;BYDAY=TU", scheduled: "2026-06-02" });
		new TaskContextMenu({ task: t, plugin, targetDate: new Date("2026-06-15T12:00:00") });

		await findItem("Completed on (pick date)")?.onClick.mock.calls[0]?.[0]();
		expect(modalMock).toHaveBeenCalledTimes(1);

		await getPickerOnSelect()("2026-05-20");

		expect(plugin.toggleRecurringTaskComplete).toHaveBeenCalledTimes(1);
		const [, date] = (plugin.toggleRecurringTaskComplete as jest.Mock).mock.calls[0];
		expect(formatDateForStorage(date)).toBe("2026-05-20");
	});

	it("records the picked date as completedDate via a status change for a non-recurring task", async () => {
		const plugin = createPlugin();
		const t = task(); // undated
		new TaskContextMenu({ task: t, plugin, targetDate: new Date("2026-06-15T12:00:00") });

		await findItem("Completed on (pick date)")?.onClick.mock.calls[0]?.[0]();
		await getPickerOnSelect()("2026-05-20");

		expect(plugin.updateTaskProperty).toHaveBeenCalledWith(t, "status", "done", {
			completionDate: "2026-05-20",
		});
	});

	it("records nothing when the picker is cancelled", async () => {
		const plugin = createPlugin();
		const t = task({ scheduled: "2026-06-02" });
		new TaskContextMenu({ task: t, plugin, targetDate: new Date("2026-06-15T12:00:00") });

		await findItem("Completed on (pick date)")?.onClick.mock.calls[0]?.[0]();
		await getPickerOnSelect()(null);

		expect(plugin.updateTaskProperty).not.toHaveBeenCalled();
		expect(plugin.toggleRecurringTaskComplete).not.toHaveBeenCalled();
	});
});
