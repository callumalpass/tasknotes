import { Scope } from "obsidian";
import { pushKeyboardShortcutCaptureScope } from "../../../src/settings/tabs/keyboardShortcutsTab";

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
