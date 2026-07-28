import { resolveDefaultTaskListKeyboardAction } from "../../../src/bases/taskListKeyboardActions";

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
});
