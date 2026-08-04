import {
	DEFAULT_TASK_LIST_SHORTCUTS,
	findTaskListShortcutConflicts,
	findTaskListShortcutOwners,
	formatTaskListShortcut,
	normalizeTaskListShortcut,
	normalizeTaskListShortcutMap,
	resolveDefaultTaskListKeyboardAction,
	resolveTaskListKeyboardAction,
	replaceTaskListShortcut,
	taskListShortcutToScopeBinding,
} from "../../../src/bases/taskListKeyboardActions";

function key(
	value: string,
	modifiers: Partial<Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "isComposing">> = {}
) {
	return {
		key: value,
		ctrlKey: false,
		metaKey: false,
		altKey: false,
		shiftKey: false,
		isComposing: false,
		...modifiers,
	};
}

describe("resolveDefaultTaskListKeyboardAction", () => {
	it.each([
		["ArrowDown", {}, "navigate-next"],
		["j", {}, "navigate-next"],
		["ArrowUp", {}, "navigate-previous"],
		["k", {}, "navigate-previous"],
		["Home", {}, "jump-first"],
		["End", {}, "jump-last"],
		["Escape", {}, "clear-focus-and-selection"],
		["Backspace", {}, "clear-focus-and-selection"],
		[" ", {}, "toggle-select"],
		["x", {}, "toggle-select"],
		["a", { ctrlKey: true }, "select-all"],
		["a", { metaKey: true }, "select-all"],
		["c", { ctrlKey: true }, "copy-task-titles"],
		["c", { metaKey: true }, "copy-task-titles"],
		["y", {}, "toggle-archive"],
		["c", {}, "create-task"],
		["/", {}, "focus-search"],
		["Enter", {}, "edit-task"],
		["e", {}, "open-context-menu"],
		["Enter", { shiftKey: true }, "open-task-notes"],
		["d", {}, "edit-due"],
		["s", { shiftKey: true }, "edit-scheduled"],
		["p", {}, "edit-priority"],
		["!", { shiftKey: true }, "edit-priority"],
		["d", { ctrlKey: true }, "mark-complete"],
		["d", { metaKey: true }, "mark-complete"],
		["s", {}, "edit-status"],
		["*", { shiftKey: true }, "edit-status"],
		["r", {}, "edit-recurrence"],
		["#", { shiftKey: true }, "add-tags"],
		["@", { shiftKey: true }, "add-context"],
		["+", { shiftKey: true }, "add-project"],
		["Delete", { ctrlKey: true }, "delete-tasks"],
		["Delete", { metaKey: true }, "delete-tasks"],
	] as const)("maps %s to %s", (keyValue, modifiers, expected) => {
		expect(resolveDefaultTaskListKeyboardAction(key(keyValue, modifiers))).toBe(expected);
	});

	it.each([
		key("d", { altKey: true }),
		key("Process"),
		key("d", { isComposing: true }),
		key("q"),
	])("ignores unsupported or composition input", (event) => {
		expect(resolveDefaultTaskListKeyboardAction(event)).toBeNull();
	});

	it("resolves a customized map instead of the defaults", () => {
		const shortcuts = normalizeTaskListShortcutMap({
			"edit-due": ["Ctrl+Shift+K"],
		});

		expect(
			resolveTaskListKeyboardAction(
				key("k", { ctrlKey: true, shiftKey: true }),
				shortcuts
			)
		).toBe("edit-due");
		expect(resolveTaskListKeyboardAction(key("d"), shortcuts)).toBeNull();
	});

	it("resolves a configured user-field shortcut to its dynamic action", () => {
		const shortcuts = normalizeTaskListShortcutMap({});

		expect(
			resolveTaskListKeyboardAction(key("q"), shortcuts, { effort: ["q"] })
		).toBe("edit-user-field:effort");
	});

	it("gives built-in shortcuts precedence over user-field collisions", () => {
		const shortcuts = normalizeTaskListShortcutMap({});

		expect(
			resolveTaskListKeyboardAction(key("d"), shortcuts, { effort: ["d"] })
		).toBe("edit-due");
	});

	it.each([
		[" Control + Shift + K ", "mod+shift+k"],
		["Cmd+Return", "mod+enter"],
		["Option+/", "alt+slash"],
		["Shift++", "shift+plus"],
	])("normalizes %s", (raw, expected) => {
		expect(normalizeTaskListShortcut(raw)).toBe(expected);
	});

	it("preserves an explicitly cleared action while defaulting missing actions", () => {
		const shortcuts = normalizeTaskListShortcutMap({ "edit-due": [] });

		expect(shortcuts["edit-due"]).toEqual([]);
		expect(shortcuts["create-task"]).toEqual(DEFAULT_TASK_LIST_SHORTCUTS["create-task"]);
	});

	it("falls back safely when persisted shortcut data is malformed", () => {
		const shortcuts = normalizeTaskListShortcutMap({
			"edit-due": "not-an-array",
		} as unknown as Parameters<typeof normalizeTaskListShortcutMap>[0]);

		expect(shortcuts["edit-due"]).toEqual(DEFAULT_TASK_LIST_SHORTCUTS["edit-due"]);
	});

	it("reports duplicate bindings across semantic actions", () => {
		const shortcuts = normalizeTaskListShortcutMap({
			"edit-due": ["z"],
			"edit-status": ["Z"],
		});

		expect(findTaskListShortcutConflicts(shortcuts).get("z")).toEqual([
			"edit-due",
			"edit-status",
		]);
	});

	it("finds duplicate owners and replaces their binding atomically", () => {
		const shortcuts = normalizeTaskListShortcutMap({
			"edit-due": ["z"],
			"edit-status": ["z"],
			"jump-first": ["home"],
		});

		expect(findTaskListShortcutOwners(shortcuts, "z", "jump-first")).toEqual([
			"edit-due",
			"edit-status",
		]);
		const replaced = replaceTaskListShortcut(shortcuts, "jump-first", "z");
		expect(replaced["edit-due"]).toEqual([]);
		expect(replaced["edit-status"]).toEqual([]);
		expect(replaced["jump-first"]).toEqual(["home", "z"]);
	});

	it("formats portable modifiers for the current platform", () => {
		expect(formatTaskListShortcut("mod+shift+enter", false)).toBe("Ctrl+Shift+Enter");
		expect(formatTaskListShortcut("mod+shift+enter", true)).toBe("⌘⇧Enter");
	});

	it.each([
		["mod+b", { modifiers: ["Mod"], key: "b" }],
		["mod+shift+d", { modifiers: ["Mod", "Shift"], key: "d" }],
		["space", { modifiers: [], key: " " }],
		["shift+plus", { modifiers: ["Shift"], key: "+" }],
		["arrowdown", { modifiers: [], key: "ArrowDown" }],
	])("converts %s to an Obsidian scope binding", (shortcut, expected) => {
		expect(taskListShortcutToScopeBinding(shortcut)).toEqual(expected);
	});
});
