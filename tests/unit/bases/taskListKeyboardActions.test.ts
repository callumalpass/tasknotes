import {
	DEFAULT_TASK_LIST_SHORTCUTS,
	findTaskListShortcutConflicts,
	formatTaskListShortcut,
	normalizeTaskListShortcut,
	normalizeTaskListShortcutMap,
	resolveDefaultTaskListKeyboardAction,
	resolveTaskListKeyboardAction,
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
		["c", {}, "create-task"],
		["/", {}, "focus-search"],
		["Enter", {}, "edit-task"],
		["Enter", { shiftKey: true }, "open-task-notes"],
		["d", {}, "edit-due"],
		["s", { shiftKey: true }, "edit-scheduled"],
		["p", {}, "edit-priority"],
		["s", {}, "edit-status"],
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
		key("d", { ctrlKey: true }),
		key("Process"),
		key("d", { isComposing: true }),
		key("x"),
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
			"edit-due": ["x"],
			"edit-status": ["X"],
		});

		expect(findTaskListShortcutConflicts(shortcuts).get("x")).toEqual([
			"edit-due",
			"edit-status",
		]);
	});

	it("formats portable modifiers for the current platform", () => {
		expect(formatTaskListShortcut("mod+shift+enter", false)).toBe("Ctrl+Shift+Enter");
		expect(formatTaskListShortcut("mod+shift+enter", true)).toBe("⌘⇧Enter");
	});
});
