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
	it("renders leading actions before save and cancel and wires click handlers", () => {
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
		expect(buttons.map((button) => button.textContent)).toEqual([
			"Open note",
			"Save",
			"Cancel",
		]);
		expect(buttons[1].classList.contains("mod-cta")).toBe(true);

		buttons.forEach((button) => button.click());

		expect(open).toHaveBeenCalledTimes(1);
		expect(save).toHaveBeenCalledTimes(1);
		expect(cancel).toHaveBeenCalledTimes(1);
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
