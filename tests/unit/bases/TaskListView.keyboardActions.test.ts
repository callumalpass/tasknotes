import { showConfirmationModal } from "../../../src/modals/ConfirmationModal";
import { TaskListView } from "../../../src/bases/TaskListView";
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

const mockedConfirmation = showConfirmationModal as jest.MockedFunction<
	typeof showConfirmationModal
>;

function task(path: string): TaskInfo {
	return {
		path,
		title: path,
		status: "open",
		priority: "normal",
		archived: false,
	} as TaskInfo;
}

describe("TaskListView keyboard actions", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it.each([
		["open-task-notes", "openTaskActionTargets", null],
		["edit-due", "showTaskActionDateMenu", "due"],
		["edit-scheduled", "showTaskActionDateMenu", "scheduled"],
		["edit-priority", "showTaskActionPriorityMenu", null],
		["edit-status", "showTaskActionStatusMenu", null],
		["edit-recurrence", "showTaskActionRecurrenceMenu", null],
		["add-tags", "addTagsToTaskActionTargets", null],
		["add-context", "addContextToTaskActionTargets", null],
		["add-project", "addProjectToTaskActionTargets", null],
		["delete-tasks", "deleteTaskActionTargets", null],
	] as const)("routes %s to its semantic handler", async (action, method, argument) => {
		const handler = jest.fn();
		const view = { [method]: handler };

		await (TaskListView.prototype as any).executeTaskListAction.call(view, action);

		expect(handler).toHaveBeenCalledWith(...(argument ? [argument] : []));
	});

	it("claims a recognized shortcut when the task card owns focus", () => {
		const executeTaskListAction = jest.fn();
		const view = {
			focusController: {
				getFocusedPathForEvent: jest.fn(() => "focused.md"),
			},
			executeTaskListAction,
		};
		const event = new KeyboardEvent("keydown", {
			key: "d",
			cancelable: true,
		});
		const stopPropagation = jest.spyOn(event, "stopPropagation");

		(TaskListView.prototype as any).handleTaskListActionKeyDown.call(view, event);

		expect(event.defaultPrevented).toBe(true);
		expect(stopPropagation).toHaveBeenCalled();
		expect(executeTaskListAction).toHaveBeenCalledWith("edit-due");
	});

	it.each([
		["Enter", { shiftKey: true }, "open-task-notes"],
		["s", { shiftKey: true }, "edit-scheduled"],
		["#", { shiftKey: true }, "add-tags"],
		["@", { shiftKey: true }, "add-context"],
		["+", { shiftKey: true }, "add-project"],
		["Delete", { ctrlKey: true }, "delete-tasks"],
		["Delete", { metaKey: true }, "delete-tasks"],
	] as const)("allows the modifier chord %s after action recognition", (keyValue, modifiers, action) => {
		const executeTaskListAction = jest.fn();
		const getFocusedPathForEvent = jest.fn(() => "focused.md");
		const view = {
			focusController: { getFocusedPathForEvent },
			executeTaskListAction,
		};
		const event = new KeyboardEvent("keydown", {
			key: keyValue,
			cancelable: true,
			...modifiers,
		});

		(TaskListView.prototype as any).handleTaskListActionKeyDown.call(view, event);

		expect(getFocusedPathForEvent).toHaveBeenCalledWith(event, true);
		expect(event.defaultPrevented).toBe(true);
		expect(executeTaskListAction).toHaveBeenCalledWith(action);
	});

	it("does not claim shortcuts when an interactive control owns focus", () => {
		const executeTaskListAction = jest.fn();
		const view = {
			focusController: {
				getFocusedPathForEvent: jest.fn(() => null),
			},
			executeTaskListAction,
		};
		const event = new KeyboardEvent("keydown", {
			key: "d",
			cancelable: true,
		});

		(TaskListView.prototype as any).handleTaskListActionKeyDown.call(view, event);

		expect(event.defaultPrevented).toBe(false);
		expect(executeTaskListAction).not.toHaveBeenCalled();
	});

	it("uses the first resolved target for the single-task edit modal", async () => {
		const first = task("first.md");
		const second = task("second.md");
		const openTaskEditModal = jest.fn();
		const view = {
			getTaskActionTargets: jest.fn(async () => [first, second]),
			plugin: { openTaskEditModal },
		};

		await (TaskListView.prototype as any).executeTaskListAction.call(view, "edit-task");

		expect(openTaskEditModal).toHaveBeenCalledWith(first);
	});

	it("updates every resolved target through the current property API", async () => {
		const tasks = [task("first.md"), task("second.md")];
		const updateTaskProperty = jest.fn(async () => undefined);
		const view = { plugin: { updateTaskProperty } };

		await (TaskListView.prototype as any).updateTaskActionTargets.call(
			view,
			tasks,
			"priority",
			"high"
		);

		expect(updateTaskProperty).toHaveBeenNthCalledWith(1, tasks[0], "priority", "high");
		expect(updateTaskProperty).toHaveBeenNthCalledWith(2, tasks[1], "priority", "high");
	});

	it("does not delete when destructive confirmation is cancelled", async () => {
		const tasks = [task("first.md"), task("second.md")];
		const deleteTask = jest.fn();
		mockedConfirmation.mockResolvedValue(false);
		const view = {
			getTaskActionTargets: jest.fn(async () => tasks),
			plugin: {
				app: {},
				i18n: { translate: jest.fn(() => "Cancel") },
				taskService: { deleteTask },
				taskSelectionService: { clearSelection: jest.fn() },
			},
		};

		await (TaskListView.prototype as any).deleteTaskActionTargets.call(view);

		expect(mockedConfirmation).toHaveBeenCalled();
		expect(deleteTask).not.toHaveBeenCalled();
	});

	it("deletes every target after one confirmation and clears selection", async () => {
		const tasks = [task("first.md"), task("second.md")];
		const deleteTask = jest.fn(async () => undefined);
		const clearSelection = jest.fn();
		mockedConfirmation.mockResolvedValue(true);
		const view = {
			getTaskActionTargets: jest.fn(async () => tasks),
			plugin: {
				app: {},
				i18n: { translate: jest.fn(() => "Cancel") },
				taskService: { deleteTask },
				taskSelectionService: { clearSelection },
			},
		};

		await (TaskListView.prototype as any).deleteTaskActionTargets.call(view);

		expect(mockedConfirmation).toHaveBeenCalledTimes(1);
		expect(deleteTask).toHaveBeenCalledTimes(2);
		expect(clearSelection).toHaveBeenCalled();
	});
});
