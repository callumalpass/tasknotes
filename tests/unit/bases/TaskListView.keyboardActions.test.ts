import { showConfirmationModal } from "../../../src/modals/ConfirmationModal";
import { TaskListView } from "../../../src/bases/TaskListView";
import type { TaskInfo } from "../../../src/types";
import { normalizeTaskListShortcutMap } from "../../../src/bases/taskListKeyboardActions";
import { Scope } from "obsidian";

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
		["clear-focus-and-selection", "clearTaskListFocusAndSelection", null],
		["toggle-select", "toggleFocusedTaskSelection", null],
		["select-all", "selectAllVisibleTasks", null],
		["copy-task-titles", "copyTaskActionTargetTitles", null],
		["toggle-archive", "toggleTaskActionTargetsArchive", null],
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

	it("routes configured Gmail-style navigation through the focus controller", () => {
		const moveFocus = jest.fn();
		const event = new KeyboardEvent("keydown", { key: "j", cancelable: true });
		const view = {
			plugin: {
				settings: {
					taskListShortcuts: {
						"navigate-next": ["j"],
						"navigate-previous": ["k"],
					},
				},
			},
			focusController: {
				getFocusedPathForEvent: jest.fn(() => "focused.md"),
				moveFocus,
			},
		};

		(TaskListView.prototype as any).handleTaskListActionKeyDown.call(view, event);

		expect(moveFocus).toHaveBeenCalledWith(event, "next");
	});

	it.each([
		["g", "jump-first", "first"],
		["G", "jump-last", "last"],
	] as const)("routes configured boundary key %s through the focus controller", (key, action, direction) => {
		const moveFocus = jest.fn();
		const event = new KeyboardEvent("keydown", { key, cancelable: true });
		const view = {
			plugin: {
				settings: {
					taskListShortcuts: {
						[action]: [key.toLowerCase()],
					},
				},
			},
			focusController: {
				getFocusedPathForEvent: jest.fn(() => "focused.md"),
				moveFocus,
			},
		};

		(TaskListView.prototype as any).handleTaskListActionKeyDown.call(view, event);

		expect(moveFocus).toHaveBeenCalledWith(event, direction);
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

		expect(getFocusedPathForEvent).toHaveBeenCalledWith(event, true, false);
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

	it("routes a shortcut from the active view shell through remembered task focus", () => {
		const executeTaskListAction = jest.fn();
		const getFocusedPathForEvent = jest.fn(() => "remembered.md");
		const event = new KeyboardEvent("keydown", { key: "d", cancelable: true });
		const view = {
			focusController: { getFocusedPathForEvent },
			executeTaskListAction,
		};

		(TaskListView.prototype as any).handleTaskListActionKeyDown.call(
			view,
			event,
			true
		);

		expect(getFocusedPathForEvent).toHaveBeenCalledWith(event, true, true);
		expect(executeTaskListAction).toHaveBeenCalledWith("edit-due");
	});

	it("routes a body-targeted shortcut through remembered task focus after a rerender", () => {
		const executeTaskListAction = jest.fn();
		const canHandleListKeyDown = jest.fn(() => true);
		const getFocusedPathForEvent = jest.fn(() => "remembered.md");
		const event = new KeyboardEvent("keydown", {
			key: " ",
			cancelable: true,
		});
		Object.defineProperty(event, "target", { value: document.body });
		const view = {
			inputOwnershipController: { canHandleListKeyDown },
			focusController: { getFocusedPathForEvent },
			handleTaskListActionKeyDown:
				(TaskListView.prototype as any).handleTaskListActionKeyDown,
			executeTaskListAction,
		};

		(TaskListView.prototype as any).handleTaskListKeyDown.call(view, event, true);

		expect(canHandleListKeyDown).toHaveBeenCalledWith(event, true);
		expect(getFocusedPathForEvent).toHaveBeenCalledWith(event, true, true);
		expect(executeTaskListAction).toHaveBeenCalledWith("toggle-select");
	});

	it("routes a prevented modifier chord from the active view shell", () => {
		const executeTaskListAction = jest.fn();
		const event = new KeyboardEvent("keydown", {
			key: "a",
			ctrlKey: true,
			cancelable: true,
		});
		event.preventDefault();
		const view = {
			plugin: {
				settings: {
					taskListShortcuts: {
						"select-all": ["mod+a"],
					},
				},
			},
			focusController: {
				getFocusedPathForEvent: jest.fn(() => null),
			},
			executeTaskListAction,
		};

		(TaskListView.prototype as any).handleTaskListActionKeyDown.call(
			view,
			event,
			true
		);

		expect(executeTaskListAction).toHaveBeenCalledWith("select-all");
	});

	it("does not discard a prevented chord before shell shortcut routing", () => {
		const root = document.createElement("div");
		const itemsContainer = document.createElement("div");
		root.appendChild(itemsContainer);
		const event = new KeyboardEvent("keydown", {
			key: "c",
			metaKey: true,
			cancelable: true,
		});
		Object.defineProperty(event, "target", { value: root });
		event.preventDefault();
		const handleTaskListKeyDown = jest.fn();
		const view = { itemsContainer, handleTaskListKeyDown };

		(TaskListView.prototype as any).handleTaskListRootKeyDown.call(view, event);

		expect(handleTaskListKeyDown).toHaveBeenCalledWith(event, true);
	});

	it("routes card chords from the root without using remembered-focus fallback", () => {
		const root = document.createElement("div");
		const itemsContainer = document.createElement("div");
		const card = document.createElement("div");
		itemsContainer.appendChild(card);
		root.appendChild(itemsContainer);
		const event = new KeyboardEvent("keydown", {
			key: "b",
			ctrlKey: true,
		});
		Object.defineProperty(event, "target", { value: card });
		const handleTaskListKeyDown = jest.fn();
		const view = { itemsContainer, handleTaskListKeyDown };

		(TaskListView.prototype as any).handleTaskListRootKeyDown.call(view, event);

		expect(handleTaskListKeyDown).toHaveBeenCalledWith(event, false);
	});

	it("registers task-list shortcut routing in the capture phase", () => {
		const rootElement = document.createElement("div");
		const itemsContainer = document.createElement("div");
		rootElement.appendChild(itemsContainer);
		const registerDomEvent = jest.fn();
		const view = {
			rootElement,
			itemsContainer,
			containerListenersRegistered: false,
			handleItemClick: jest.fn(),
			focusController: null,
			inputOwnershipController: null,
			registerDomEvent,
		};

		(TaskListView.prototype as any).registerContainerListeners.call(view);

		expect(registerDomEvent).toHaveBeenCalledWith(
			rootElement,
			"keydown",
			expect.any(Function),
			true
		);
		expect(registerDomEvent).toHaveBeenCalledWith(
			itemsContainer,
			"mousemove",
			expect.any(Function)
		);
	});

	it("keeps the active view shortcut scope when focus falls back to the body", () => {
		const canOwnKeyboardTarget = jest.fn(() => true);
		const activateTaskListShortcutScope = jest.fn();
		const deactivateTaskListShortcutScope = jest.fn();
		const view = {
			taskListLeafActive: true,
			inputOwnershipController: { canOwnKeyboardTarget },
			activateTaskListShortcutScope,
			deactivateTaskListShortcutScope,
		};

		(TaskListView.prototype as any).syncTaskListShortcutScopeForFocusTarget.call(
			view,
			document.body
		);

		expect(canOwnKeyboardTarget).toHaveBeenCalledWith(document.body, true);
		expect(activateTaskListShortcutScope).toHaveBeenCalled();
		expect(deactivateTaskListShortcutScope).not.toHaveBeenCalled();
	});

	it("pushes an Obsidian child scope for configured view-local chords", () => {
		const registerSpy = jest.spyOn(Scope.prototype, "register");
		const pushScope = jest.fn();
		const popScope = jest.fn();
		const handleTaskListKeyDown = jest.fn(() => true);
		const view = {
			taskListShortcutScope: null,
			taskListLeafActive: true,
			plugin: {
				settings: {
					taskListShortcuts: normalizeTaskListShortcutMap({
						"select-all": ["Ctrl+B"],
						"copy-task-titles": ["Ctrl+D"],
					}),
				},
				app: {
					scope: {},
					keymap: { pushScope, popScope },
				},
			},
			handleTaskListKeyDown,
		};

		(TaskListView.prototype as any).activateTaskListShortcutScope.call(view);

		expect(pushScope).toHaveBeenCalledTimes(1);
		const scope = view.taskListShortcutScope;
		expect(registerSpy).toHaveBeenCalledWith(
			["Mod"],
			"b",
			expect.any(Function)
		);
		expect(registerSpy).toHaveBeenCalledWith(
			["Mod"],
			"d",
			expect.any(Function)
		);

		const ctrlBHandler = registerSpy.mock.calls.find(
			([modifiers, key]) => modifiers[0] === "Mod" && key === "b"
		)?.[2] as (event: KeyboardEvent) => unknown;
		const event = new KeyboardEvent("keydown", { key: "b", ctrlKey: true });
		expect(ctrlBHandler(event)).toBe(false);
		expect(handleTaskListKeyDown).toHaveBeenCalledWith(event, true);

		(TaskListView.prototype as any).deactivateTaskListShortcutScope.call(view);
		expect(popScope).toHaveBeenCalledTimes(1);
		expect(popScope.mock.calls[0][0]).toBe(scope);
		expect(view.taskListShortcutScope).toBeNull();
		registerSpy.mockRestore();
	});

	it("does not claim a scoped chord after the task-list leaf is deactivated", () => {
		const registerSpy = jest.spyOn(Scope.prototype, "register");
		const view = {
			taskListShortcutScope: null,
			taskListLeafActive: true,
			plugin: {
				settings: {
					taskListShortcuts: normalizeTaskListShortcutMap({
						"select-all": ["Ctrl+B"],
					}),
				},
				app: {
					scope: {},
					keymap: { pushScope: jest.fn(), popScope: jest.fn() },
				},
			},
			handleTaskListKeyDown: jest.fn(() => true),
		};
		(TaskListView.prototype as any).activateTaskListShortcutScope.call(view);
		const handler = registerSpy.mock.calls.find(
			([modifiers, key]) => modifiers[0] === "Mod" && key === "b"
		)?.[2] as (event: KeyboardEvent) => unknown;
		view.taskListLeafActive = false;

		expect(handler(new KeyboardEvent("keydown", { key: "b", ctrlKey: true }))).toBeUndefined();
		expect(view.handleTaskListKeyDown).not.toHaveBeenCalled();
		registerSpy.mockRestore();
	});

	it("creates search controls on demand before focusing them", () => {
		const rootElement = document.createElement("div");
		const focus = jest.fn();
		const view = {
			rootElement,
			searchBox: null,
			searchOpenedByShortcut: false,
			enableSearch: false,
			setupSearch: jest.fn(function (this: { searchBox: { focus: () => void } | null }) {
				this.searchBox = { focus };
			}),
		};

		(TaskListView.prototype as any).focusTaskListSearch.call(view);

		expect(view.searchOpenedByShortcut).toBe(true);
		expect(view.enableSearch).toBe(true);
		expect(view.setupSearch).toHaveBeenCalledWith(rootElement);
		expect(focus).toHaveBeenCalled();
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

	it("selects only tasks visible in the current filtered view", () => {
		const selectAll = jest.fn();
		const enterSelectionMode = jest.fn();
		const view = {
			currentVisibleTaskPaths: new Set(["visible-a.md", "visible-b.md"]),
			plugin: {
				taskSelectionService: { selectAll, enterSelectionMode },
			},
		};

		(TaskListView.prototype as any).selectAllVisibleTasks.call(view);

		expect(selectAll).toHaveBeenCalledWith(["visible-a.md", "visible-b.md"]);
		expect(enterSelectionMode).toHaveBeenCalled();
	});

	it("copies resolved visible target titles as newline-delimited text", async () => {
		const tasks = [
			{ ...task("first.md"), title: "First title" },
			{ ...task("second.md"), title: "Second title" },
		];
		const writeText = jest.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});
		const view = {
			getTaskActionTargets: jest.fn(async () => tasks),
		};

		await (TaskListView.prototype as any).copyTaskActionTargetTitles.call(view);

		expect(writeText).toHaveBeenCalledWith("First title\nSecond title");
	});

	it("toggles archive only when all resolved targets share the same state", async () => {
		const tasks = [task("first.md"), task("second.md")];
		const toggleArchive = jest.fn().mockResolvedValue(undefined);
		const view = {
			getTaskActionTargets: jest.fn(async () => tasks),
			plugin: { taskService: { toggleArchive } },
		};

		await (TaskListView.prototype as any).toggleTaskActionTargetsArchive.call(view);

		expect(toggleArchive).toHaveBeenNthCalledWith(1, tasks[0]);
		expect(toggleArchive).toHaveBeenNthCalledWith(2, tasks[1]);
	});

	it("does not toggle a mixed archive selection", async () => {
		const tasks = [
			task("open.md"),
			{ ...task("archived.md"), archived: true },
		];
		const toggleArchive = jest.fn();
		const view = {
			getTaskActionTargets: jest.fn(async () => tasks),
			plugin: { taskService: { toggleArchive } },
		};

		await (TaskListView.prototype as any).toggleTaskActionTargetsArchive.call(view);

		expect(toggleArchive).not.toHaveBeenCalled();
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
