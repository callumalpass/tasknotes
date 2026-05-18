import { Notice } from "obsidian";
import {
	createPriorityClickHandler,
	createProjectClickHandler,
	createRecurrenceClickHandler,
	createReminderClickHandler,
	createStatusCycleHandler,
} from "../../../src/ui/taskCardActions";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";
import { PriorityContextMenu } from "../../../src/components/PriorityContextMenu";
import { RecurrenceContextMenu } from "../../../src/components/RecurrenceContextMenu";
import { ReminderModal } from "../../../src/modals/ReminderModal";

jest.mock("obsidian");

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
		settings: {
			defaultTaskStatus: "open",
			enableDebugLogging: false,
		},
		statusManager: {
			getCompletedStatuses: jest.fn(() => ["done"]),
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
		applyProjectSubtaskFilter: jest.fn(async () => undefined),
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

	it("wires project indicators to the project-subtask filter", async () => {
		const plugin = createPlugin();
		const handler = createProjectClickHandler(task, plugin);

		handler();
		await flushAsyncHandlers();

		expect(plugin.applyProjectSubtaskFilter).toHaveBeenCalledWith(task);
	});
});
