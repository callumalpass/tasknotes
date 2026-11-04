import { observeTranslation as mockObserveTranslation } from "../../helpers/real-i18n";
import {
	createTaskModalActionButtons,
	type TaskModalActionButtonContext,
} from "../../../src/modals/taskModalActionButtons";

function createContext(): TaskModalActionButtonContext {
	return {
		translate: mockObserveTranslation(),
	};
}

describe("taskModalActionButtons", () => {
	it("renders leading actions, cancel, and a primary save with its keyboard hint", () => {
		const container = document.createElement("div");
		const open = jest.fn();
		const save = jest.fn();
		const cancel = jest.fn();

		const buttonContainer = createTaskModalActionButtons(createContext(), {
			container,
			leadingButtons: [{ className: "open-button", text: "Open note", onClick: open }],
			onSave: save,
			onCancel: cancel,
		});

		const buttons = Array.from(buttonContainer.querySelectorAll("button"));
		expect(buttons[0].textContent).toBe("Open note");
		expect(buttons[1].textContent).toBe("Cancel");
		expect(buttons[2].getAttribute("aria-label")).toBe("Save");
		expect(buttons[2].classList.contains("mod-cta")).toBe(true);
		expect(buttons[2].querySelector(".tn-key-hint")).not.toBeNull();

		buttons.forEach((button) => button.click());

		expect(open).toHaveBeenCalledTimes(1);
		expect(save).toHaveBeenCalledTimes(1);
		expect(cancel).toHaveBeenCalledTimes(1);
	});

	it("keeps repeat creation an explicit choice and preserves its checked state", () => {
		const onCreateMoreChange = jest.fn();
		const bar = createTaskModalActionButtons(createContext(), {
			container: document.createElement("div"),
			createMore: true,
			onCreateMoreChange,
			onSave: jest.fn(),
			onCancel: jest.fn(),
		});
		const checkbox = bar.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
		expect(checkbox.checked).toBe(true);
		checkbox.checked = false;
		checkbox.dispatchEvent(new Event("change"));
		expect(onCreateMoreChange).toHaveBeenCalledWith(false);
	});

	it("puts overflow actions in a menu rather than the button bar", () => {
		const container = document.createElement("div");

		const buttonContainer = createTaskModalActionButtons(createContext(), {
			container,
			overflowActions: [{ title: "Delete", icon: "trash", warning: true, onClick: jest.fn() }],
			onSave: jest.fn(),
			onCancel: jest.fn(),
		});

		expect(buttonContainer.textContent).not.toContain("Delete");
		expect(buttonContainer.querySelector(".tn-task-modal__overflow-button")).not.toBeNull();
	});
});
