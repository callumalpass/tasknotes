import { Scope } from "obsidian";
import {
	formatShortcutOwnerLabel,
	partitionShortcutOwners,
	pushKeyboardShortcutCaptureScope,
} from "../../../src/settings/tabs/keyboardShortcutsTab";
import type { UserMappedField } from "../../../src/types/settings";

describe("keyboard shortcut owner labels", () => {
	const translate = (key: string) =>
		key === "settings.keyboardShortcuts.actions.edit-task" ? "Edit task" : key;

	it("shows a user field display name followed by its stable ID", () => {
		const fields: UserMappedField[] = [
			{
				id: "field_1234",
				key: "storyPoints",
				displayName: "Story Points",
				type: "number",
			},
		];

		expect(formatShortcutOwnerLabel("field_1234", fields, translate)).toBe(
			"Story Points (field_1234)"
		);
	});

	it("keeps translated built-in action labels and unknown owner fallbacks", () => {
		expect(formatShortcutOwnerLabel("edit-task", [], translate)).toBe("Edit task");
		expect(formatShortcutOwnerLabel("missing_field", [], translate)).toBe("missing_field");
	});

	it("separates deleted fields from conflicts that still require confirmation", () => {
		const fields: UserMappedField[] = [
			{
				id: "field_1234",
				key: "storyPoints",
				displayName: "Story Points",
				type: "number",
			},
		];

		expect(
			partitionShortcutOwners(
				["edit-task", "field_1234", "field_removed"],
				fields
			)
		).toEqual({
			activeOwners: ["edit-task", "field_1234"],
			staleFieldOwners: ["field_removed"],
		});
	});
});

describe("keyboard shortcut capture scope", () => {
	it("swallows Escape, cancels capture, and pops itself", () => {
		let escapeHandler: (event: KeyboardEvent) => boolean;
		jest.spyOn(Scope.prototype, "register").mockImplementation(
			(_modifiers, _key, handler) => {
				escapeHandler = handler as (event: KeyboardEvent) => boolean;
			}
		);
		const app = {
			scope: new Scope(),
			keymap: {
				pushScope: jest.fn(),
				popScope: jest.fn(),
			},
		};
		const onEscape = jest.fn();
		const stop = pushKeyboardShortcutCaptureScope({ app } as any, onEscape);
		const scope = app.keymap.pushScope.mock.calls[0][0] as Scope;
		const event = {
			preventDefault: jest.fn(),
			stopPropagation: jest.fn(),
		} as unknown as KeyboardEvent;

		expect(escapeHandler!(event)).toBe(false);
		expect(event.preventDefault).toHaveBeenCalled();
		expect(event.stopPropagation).toHaveBeenCalled();
		expect(onEscape).toHaveBeenCalledWith(event);
		expect(app.keymap.popScope.mock.calls[0][0] === scope).toBe(true);

		stop();
		expect(app.keymap.popScope).toHaveBeenCalledTimes(1);
	});
});
