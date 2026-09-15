import { TFile } from "obsidian";
import { showConfirmationModal } from "../../../src/modals/ConfirmationModal";
import {
	executeBasesTaskCardAction,
	updateTasksProperty,
	updateTasksStatus,
	type BasesTaskCardActionContext,
} from "../../../src/bases/basesTaskCardActions";
import type { TaskInfo } from "../../../src/types";

jest.mock(
	"tasknotes-nlp-core",
	() => ({
		NaturalLanguageParserCore: class {},
	}),
	{ virtual: true }
);
jest.mock("../../../src/modals/ConfirmationModal", () => ({
	showConfirmationModal: jest.fn(),
}));
jest.mock("../../../src/modals/UserFieldEditModal", () => ({
	UserFieldEditModal: jest.fn().mockImplementation(() => ({ open: jest.fn() })),
}));

const mockedConfirmation = showConfirmationModal as jest.MockedFunction<
	typeof showConfirmationModal
>;
const mockedUserFieldEditModal = jest.requireMock(
	"../../../src/modals/UserFieldEditModal"
).UserFieldEditModal as jest.Mock;

function task(path: string, overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		path,
		title: path,
		status: "open",
		priority: "normal",
		archived: false,
		...overrides,
	} as TaskInfo;
}

function createContext(
	tasks: TaskInfo[],
	overrides: Partial<BasesTaskCardActionContext> = {}
): BasesTaskCardActionContext {
	const byPath = new Map(tasks.map((t) => [t.path, t]));
	return {
		plugin: {
			cacheManager: { getTaskInfo: jest.fn(async (path: string) => byPath.get(path) ?? null) },
		} as any,
		app: {} as any,
		taskSelectionService: undefined,
		getTargetPaths: () => tasks.map((t) => t.path),
		getVisibleTaskPaths: () => tasks.map((t) => t.path),
		isPathVisible: (path: string) => byPath.has(path),
		getAnchor: () => null,
		getCurrentTargetDate: () => new Date("2026-08-02T00:00:00.000Z"),
		restoreFocus: () => false,
		rootElement: null,
		showBatchContextMenu: jest.fn(),
		createFileForView: jest.fn(async () => undefined),
		...overrides,
	};
}

describe("executeBasesTaskCardAction", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("navigate/jump actions are no-ops (handled by the keyboard controller before dispatch)", async () => {
		const context = createContext([]);
		await expect(
			executeBasesTaskCardAction("navigate-next", null, context)
		).resolves.toBeUndefined();
	});

	it("uses the first resolved target for the single-task edit modal", async () => {
		const first = task("first.md");
		const second = task("second.md");
		const openTaskEditModal = jest.fn();
		const context = createContext([first, second], {
			plugin: {
				cacheManager: {
					getTaskInfo: jest.fn(async (path: string) =>
						[first, second].find((t) => t.path === path)
					),
				},
				openTaskEditModal,
			} as any,
		});

		await executeBasesTaskCardAction("edit-task", null, context);

		expect(openTaskEditModal).toHaveBeenCalledWith(first);
	});

	it("starts all selected task cache reads before awaiting their results", async () => {
		const first = task("first.md");
		const second = task("second.md");
		let resolveFirst: (value: TaskInfo | null) => void;
		let resolveSecond: (value: TaskInfo | null) => void;
		const firstRead = new Promise<TaskInfo | null>((resolve) => {
			resolveFirst = resolve;
		});
		const secondRead = new Promise<TaskInfo | null>((resolve) => {
			resolveSecond = resolve;
		});
		const getTaskInfo = jest.fn((path: string) =>
			path === first.path ? firstRead : secondRead
		);
		const openTaskEditModal = jest.fn();
		const context = createContext([first, second], {
			plugin: { cacheManager: { getTaskInfo }, openTaskEditModal } as any,
		});

		const action = executeBasesTaskCardAction("edit-task", null, context);
		expect(getTaskInfo).toHaveBeenCalledTimes(2);
		resolveFirst!(first);
		resolveSecond!(second);
		await action;

		expect(openTaskEditModal).toHaveBeenCalledWith(first);
	});

	it("selects only tasks visible in the current filtered view", async () => {
		const selectAll = jest.fn();
		const enterSelectionMode = jest.fn();
		const context = createContext([task("visible-a.md"), task("visible-b.md")], {
			taskSelectionService: { selectAll, enterSelectionMode } as any,
		});

		await executeBasesTaskCardAction("select-all", null, context);

		expect(selectAll).toHaveBeenCalledWith(["visible-a.md", "visible-b.md"]);
		expect(enterSelectionMode).toHaveBeenCalled();
	});

	it("copies resolved visible target titles as newline-delimited text", async () => {
		const tasks = [task("first.md", { title: "First title" }), task("second.md", { title: "Second title" })];
		const writeText = jest.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});
		const context = createContext(tasks);

		await executeBasesTaskCardAction("copy-task-titles", null, context);

		expect(writeText).toHaveBeenCalledWith("First title\nSecond title");
	});

	it("toggles archive only when all resolved targets share the same state", async () => {
		const tasks = [task("first.md"), task("second.md")];
		const toggleArchive = jest.fn().mockResolvedValue(undefined);
		const context = createContext(tasks, {
			plugin: {
				cacheManager: { getTaskInfo: jest.fn(async (path: string) => tasks.find((t) => t.path === path)) },
				taskService: { toggleArchive },
			} as any,
		});

		await executeBasesTaskCardAction("toggle-archive", null, context);

		expect(toggleArchive).toHaveBeenNthCalledWith(1, tasks[0]);
		expect(toggleArchive).toHaveBeenNthCalledWith(2, tasks[1]);
	});

	it("does not toggle a mixed archive selection", async () => {
		const tasks = [task("open.md"), task("archived.md", { archived: true })];
		const toggleArchive = jest.fn();
		const context = createContext(tasks, {
			plugin: {
				cacheManager: { getTaskInfo: jest.fn(async (path: string) => tasks.find((t) => t.path === path)) },
				taskService: { toggleArchive },
			} as any,
		});

		await executeBasesTaskCardAction("toggle-archive", null, context);

		expect(toggleArchive).not.toHaveBeenCalled();
	});

	it("opens every resolved target's note in a new tab", async () => {
		const tasks = [task("first.md"), task("second.md")];
		const files = new Map(tasks.map((t) => [t.path, new TFile()]));
		const openFile = jest.fn();
		const context = createContext(tasks, {
			app: {
				vault: { getAbstractFileByPath: jest.fn((path: string) => files.get(path) ?? null) },
				workspace: { getLeaf: jest.fn(() => ({ openFile })) },
			} as any,
		});

		await executeBasesTaskCardAction("open-task-notes", null, context);

		expect(openFile).toHaveBeenCalledTimes(2);
		expect(openFile).toHaveBeenNthCalledWith(1, files.get("first.md"));
		expect(openFile).toHaveBeenNthCalledWith(2, files.get("second.md"));
	});

	it("opens the numeric field editor for time estimates and updates every target", async () => {
		const tasks = [task("first.md", { timeEstimate: 30 }), task("second.md")];
		const updateTaskProperty = jest.fn(async () => undefined);
		const onOverlayClosed = jest.fn();
		const context = createContext(tasks, {
			plugin: {
				cacheManager: { getTaskInfo: jest.fn(async (path: string) => tasks.find((t) => t.path === path)) },
				app: {},
				i18n: { translate: jest.fn(() => "Time estimate (minutes)") },
				updateTaskProperty,
			} as any,
			onOverlayClosed,
		});

		await executeBasesTaskCardAction("edit-time-estimate", null, context);

		expect(mockedUserFieldEditModal).toHaveBeenCalledWith(
			context.plugin.app,
			context.plugin,
			expect.objectContaining({
				field: expect.objectContaining({
					id: "builtin-time-estimate",
					key: "timeEstimate",
					type: "number",
				}),
				tasks,
			})
		);
		expect(mockedUserFieldEditModal.mock.results[0].value.open).toHaveBeenCalledTimes(1);

		const options = mockedUserFieldEditModal.mock.calls[0][2];
		await options.onApply(45);
		expect(updateTaskProperty).toHaveBeenNthCalledWith(
			1,
			tasks[0],
			"timeEstimate",
			45,
			{ silent: true }
		);
		expect(updateTaskProperty).toHaveBeenNthCalledWith(
			2,
			tasks[1],
			"timeEstimate",
			45,
			{ silent: true }
		);
		options.onClose();
		expect(onOverlayClosed).toHaveBeenCalledTimes(1);
	});

	it("does not delete when destructive confirmation is cancelled", async () => {
		const tasks = [task("first.md"), task("second.md")];
		const deleteTask = jest.fn();
		mockedConfirmation.mockResolvedValue(false);
		const context = createContext(tasks, {
			plugin: {
				cacheManager: { getTaskInfo: jest.fn(async (path: string) => tasks.find((t) => t.path === path)) },
				app: {},
				i18n: { translate: jest.fn(() => "Cancel") },
				taskService: { deleteTask },
			} as any,
			taskSelectionService: { clearSelection: jest.fn() } as any,
		});

		await executeBasesTaskCardAction("delete-tasks", null, context);

		expect(mockedConfirmation).toHaveBeenCalled();
		expect(deleteTask).not.toHaveBeenCalled();
	});

	it("deletes every target after one confirmation and clears selection", async () => {
		const tasks = [task("first.md"), task("second.md")];
		const deleteTask = jest.fn(async () => undefined);
		const clearSelection = jest.fn();
		mockedConfirmation.mockResolvedValue(true);
		const context = createContext(tasks, {
			plugin: {
				cacheManager: { getTaskInfo: jest.fn(async (path: string) => tasks.find((t) => t.path === path)) },
				app: {},
				i18n: { translate: jest.fn(() => "Cancel") },
				taskService: { deleteTask },
			} as any,
			taskSelectionService: { clearSelection } as any,
		});

		await executeBasesTaskCardAction("delete-tasks", null, context);

		expect(mockedConfirmation).toHaveBeenCalledTimes(1);
		expect(deleteTask).toHaveBeenCalledTimes(2);
		expect(clearSelection).toHaveBeenCalled();
	});
});

describe("updateTasksProperty", () => {
	it("updates every resolved target through the current property API", async () => {
		const tasks = [task("first.md"), task("second.md")];
		const updateTaskProperty = jest.fn(async () => undefined);
		const context = createContext(tasks, {
			plugin: { updateTaskProperty } as any,
		});

		await updateTasksProperty(context, tasks, "priority", "high");

		expect(updateTaskProperty).toHaveBeenNthCalledWith(1, tasks[0], "priority", "high");
		expect(updateTaskProperty).toHaveBeenNthCalledWith(2, tasks[1], "priority", "high");
	});
});

describe("updateTasksStatus", () => {
	it("routes a completed status through recurring-instance completion", async () => {
		const recurring = task("recurring.md", { recurrence: "FREQ=WEEKLY" });
		const ordinary = task("ordinary.md");
		const actionDate = new Date("2026-08-02T00:00:00.000Z");
		const toggleRecurringTaskComplete = jest.fn(async () => recurring);
		const updateTaskProperty = jest.fn(async () => ordinary);
		const context = createContext([recurring, ordinary], {
			plugin: {
				statusManager: { isCompletedStatus: (status: string) => status === "done" },
				toggleRecurringTaskComplete,
				updateTaskProperty,
			} as any,
			getCurrentTargetDate: () => actionDate,
		});

		await updateTasksStatus(context, [recurring, ordinary], "done");

		expect(toggleRecurringTaskComplete).toHaveBeenCalledWith(recurring, actionDate);
		expect(updateTaskProperty).toHaveBeenCalledWith(ordinary, "status", "done");
	});
});
