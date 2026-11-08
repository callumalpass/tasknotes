import { createI18nService } from "../../../src/i18n";
import { Notice } from "obsidian";
import {
	createPriorityClickHandler,
	createRecurrenceClickHandler,
	createReminderClickHandler,
	createStatusCycleHandler,
} from "../../../src/ui/taskCardActions";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";
import { PriorityContextMenu } from "../../../src/components/PriorityContextMenu";
import { RecurrenceContextMenu } from "../../../src/components/RecurrenceContextMenu";
import { ReminderModal } from "../../../src/modals/ReminderModal";

jest.mock("../../../src/components/PriorityContextMenu", () => ({
	PriorityContextMenu: jest.fn().mockImplementation((options) => ({
		options,
		show: jest.fn(),
	})),
}));

jest.mock("../../../src/components/RecurrenceContextMenu", () => ({
	RecurrenceContextMenu: jest.fn().mockImplementation((options) => ({
		options,
		show: jest.fn(),
	})),
}));

jest.mock("../../../src/modals/ReminderModal", () => ({
	ReminderModal: jest.fn().mockImplementation((app, plugin, task, onSave) => ({
		app,
		plugin,
		task,
		onSave,
		open: jest.fn(),
	})),
}));

const task: TaskInfo = {
	path: "Tasks/Test.md",
	title: "Test task",
	status: "open",
	priority: "normal",
};

function createPlugin(overrides: Partial<TaskNotesPlugin> = {}): TaskNotesPlugin {
	return {
		app: {},
		i18n: createI18nService(),
		settings: {
			defaultTaskStatus: "open",
			enableDebugLogging: false,
		},
		statusManager: {
			getCompletedStatuses: jest.fn(() => ["done"]),
			getConfiguredStatusAfterCompletion: jest.fn(() => undefined),
			getNextStatus: jest.fn(() => "done"),
			getPreviousStatus: jest.fn(() => "backlog"),
			isCompletedStatus: jest.fn((status: string) => status === "done"),
		},
		cacheManager: {
			getTaskInfo: jest.fn(async () => task),
		},
		updateTaskProperty: jest.fn(async (updatedTask, property, value) => ({
			...updatedTask,
			[property]: value,
		})),
		toggleRecurringTaskComplete: jest.fn(async (updatedTask) => ({
			...updatedTask,
			status: "done",
		})),
		...overrides,
	} as unknown as TaskNotesPlugin;
}

async function flushAsyncHandlers(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
}

describe("taskCardActions", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("cycles a regular task status through the plugin write path", async () => {
		const plugin = createPlugin();
		const updateStatusVisuals = jest.fn();
		const stopPropagation = jest.fn();
		const handler = createStatusCycleHandler({
			task,
			plugin,
			targetDate: new Date("2026-05-19T00:00:00Z"),
			updateStatusVisuals,
		});

		handler({ stopPropagation, shiftKey: false } as unknown as MouseEvent);
		await flushAsyncHandlers();

		expect(stopPropagation).toHaveBeenCalled();
		expect(plugin.cacheManager.getTaskInfo).toHaveBeenCalledWith("Tasks/Test.md");
		expect(plugin.updateTaskProperty).toHaveBeenCalledWith(task, "status", "done");
		expect(updateStatusVisuals).toHaveBeenCalledWith(
			expect.objectContaining({ status: "done" }),
			"done",
			true
		);
	});

	it("uses the previous status when shift-clicking the status indicator", async () => {
		const plugin = createPlugin();
		const handler = createStatusCycleHandler({
			task,
			plugin,
			targetDate: new Date("2026-05-19T00:00:00Z"),
			updateStatusVisuals: jest.fn(),
		});

		handler({ stopPropagation: jest.fn(), shiftKey: true } as unknown as MouseEvent);
		await flushAsyncHandlers();

		expect(plugin.statusManager.getPreviousStatus).toHaveBeenCalledWith("open");
		expect(plugin.updateTaskProperty).toHaveBeenCalledWith(task, "status", "backlog");
	});

	it("notices when the status handler cannot find a fresh task", async () => {
		const plugin = createPlugin({
			cacheManager: {
				getTaskInfo: jest.fn(async () => null),
			},
		} as Partial<TaskNotesPlugin>);
		const handler = createStatusCycleHandler({
			task,
			plugin,
			targetDate: new Date("2026-05-19T00:00:00Z"),
			updateStatusVisuals: jest.fn(),
		});

		handler({ stopPropagation: jest.fn(), shiftKey: false } as unknown as MouseEvent);
		await flushAsyncHandlers();

		expect(Notice).toHaveBeenCalledWith("Task not found");
		expect(plugin.updateTaskProperty).not.toHaveBeenCalled();
	});

	describe("on a recurring card", () => {
		const targetDate = new Date("2026-05-19T00:00:00Z");
		const recurring: TaskInfo = { ...task, recurrence: "FREQ=WEEKLY", scheduled: "2026-05-19" };
		const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

		function cyclingPlugin(card: TaskInfo, statuses: Partial<Record<"next" | "previous", string>>) {
			const plugin = createPlugin({
				cacheManager: { getTaskInfo: jest.fn(async () => card) },
			} as Partial<TaskNotesPlugin>);
			const statusManager = plugin.statusManager as unknown as Record<string, jest.Mock>;
			statusManager.getConfiguredStatusAfterCompletion.mockReturnValue("open");
			plugin.settings.resetRecurringStatusAfterOccurrence = true;
			if (statuses.next) statusManager.getNextStatus.mockReturnValue(statuses.next);
			if (statuses.previous) statusManager.getPreviousStatus.mockReturnValue(statuses.previous);
			return plugin;
		}

		async function click(plugin: TaskNotesPlugin, card: TaskInfo, shiftKey = false) {
			const updateStatusVisuals = jest.fn();
			createStatusCycleHandler({ task: card, plugin, targetDate, updateStatusVisuals })({
				stopPropagation: jest.fn(),
				shiftKey,
			} as unknown as MouseEvent);
			await settle();
			return updateStatusVisuals;
		}

		it("completes the occurrence in one click while a finished series has no status to return to", async () => {
			const plugin = cyclingPlugin(recurring, { next: "in-progress" });
			(plugin.statusManager.getConfiguredStatusAfterCompletion as jest.Mock).mockReturnValue(undefined);

			await click(plugin, recurring);

			expect(plugin.toggleRecurringTaskComplete).toHaveBeenCalledWith(recurring, targetDate);
			expect(plugin.updateTaskProperty).not.toHaveBeenCalled();
		});

		it("completes the occurrence in one click when the status reset is off (#2521)", async () => {
			const plugin = cyclingPlugin(recurring, { next: "in-progress" });
			plugin.settings.resetRecurringStatusAfterOccurrence = false;

			await click(plugin, recurring);

			expect(plugin.toggleRecurringTaskComplete).toHaveBeenCalledWith(recurring, targetDate);
			expect(plugin.updateTaskProperty).not.toHaveBeenCalled();
		});

		it("follows the status cycle like any other card once the series has one", async () => {
			const plugin = cyclingPlugin(recurring, { next: "in-progress" });

			const updateStatusVisuals = await click(plugin, recurring);

			expect(plugin.statusManager.getNextStatus).toHaveBeenCalledWith("open");
			expect(plugin.updateTaskProperty).toHaveBeenCalledWith(recurring, "status", "in-progress");
			expect(plugin.toggleRecurringTaskComplete).not.toHaveBeenCalled();
			expect(updateStatusVisuals).toHaveBeenCalledWith(
				expect.objectContaining({ status: "in-progress" }),
				"in-progress",
				false
			);
		});

		it("completes the occurrence when the cycle reaches a completed status", async () => {
			const inProgress = { ...recurring, status: "in-progress" };
			const plugin = cyclingPlugin(inProgress, { next: "done" });

			await click(plugin, inProgress);

			expect(plugin.toggleRecurringTaskComplete).toHaveBeenCalledWith(inProgress, targetDate);
			expect(plugin.updateTaskProperty).not.toHaveBeenCalled();
		});

		it("steps back through open statuses on shift-click", async () => {
			const inProgress = { ...recurring, status: "in-progress" };
			const plugin = cyclingPlugin(inProgress, { previous: "open" });

			await click(plugin, inProgress, true);

			expect(plugin.statusManager.getPreviousStatus).toHaveBeenCalledWith("in-progress");
			expect(plugin.updateTaskProperty).toHaveBeenCalledWith(inProgress, "status", "open");
		});

		it("reopens a completed occurrence instead of cycling the series", async () => {
			const completed = { ...recurring, complete_instances: ["2026-05-19"] };
			const plugin = cyclingPlugin(completed, { next: "in-progress" });

			await click(plugin, completed);

			expect(plugin.toggleRecurringTaskComplete).toHaveBeenCalledWith(completed, targetDate);
			expect(plugin.updateTaskProperty).not.toHaveBeenCalled();
		});
	});

	it("wires priority menu selections to priority writes", async () => {
		const plugin = createPlugin();
		const handler = createPriorityClickHandler(task, plugin);

		handler({ stopPropagation: jest.fn() } as unknown as MouseEvent);
		const menuOptions = (PriorityContextMenu as jest.Mock).mock.calls[0][0];
		menuOptions.onSelect("high");
		await flushAsyncHandlers();

		expect(menuOptions.currentValue).toBe("normal");
		expect(plugin.updateTaskProperty).toHaveBeenCalledWith(task, "priority", "high");
	});

	it("wires recurrence menu selections to recurrence and anchor writes", async () => {
		const plugin = createPlugin();
		const handler = createRecurrenceClickHandler(
			{ ...task, recurrence: "FREQ=DAILY", recurrence_anchor: "scheduled" },
			plugin
		);

		handler({ stopPropagation: jest.fn() } as unknown as MouseEvent);
		const menuOptions = (RecurrenceContextMenu as jest.Mock).mock.calls[0][0];
		menuOptions.onSelect("FREQ=WEEKLY", "due");
		await flushAsyncHandlers();

		expect(menuOptions.currentValue).toBe("FREQ=DAILY");
		expect(plugin.updateTaskProperty).toHaveBeenCalledWith(
			expect.objectContaining({ path: task.path }),
			"recurrence",
			"FREQ=WEEKLY"
		);
		expect(plugin.updateTaskProperty).toHaveBeenCalledWith(
			expect.objectContaining({ path: task.path }),
			"recurrence_anchor",
			"due"
		);
	});

	it("wires reminder modal saves to reminder writes", async () => {
		const plugin = createPlugin();
		const reminders = [{ id: "r1", type: "relative", relatedTo: "due" }];
		const handler = createReminderClickHandler(task, plugin);

		handler();
		const modalInstance = (ReminderModal as jest.Mock).mock.results[0].value;
		modalInstance.onSave(reminders);
		await flushAsyncHandlers();

		expect(modalInstance.open).toHaveBeenCalled();
		expect(plugin.updateTaskProperty).toHaveBeenCalledWith(task, "reminders", reminders);
	});
});
