import {
	createTaskModalActionButtons,
	runTaskModalSaveAction,
	type TaskModalActionButtonContext,
} from "../../../src/modals/taskModalActionButtons";

function createContext(): TaskModalActionButtonContext {
	return {
		translate: (key) =>
			({
				"modals.task.buttons.save": "Save",
				"common.cancel": "Cancel",
			})[key] || key,
	};
}

describe("taskModalActionButtons", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("renders leading actions before save and cancel and wires click handlers", () => {
		const container = document.createElement("div");
		const open = jest.fn();
		const archive = jest.fn();
		const cancel = jest.fn();

		const buttonContainer = createTaskModalActionButtons(createContext(), {
			container,
			leadingButtons: [
				{ className: "open-button", text: "Open note", onClick: open },
				{ className: "archive-button", text: "Archive", onClick: archive },
			],
			onSave: jest.fn().mockResolvedValue(undefined),
			onSaved: jest.fn(),
			onCancel: cancel,
		});

		const buttons = Array.from(buttonContainer.querySelectorAll("button"));
		expect(buttons.map((button) => button.textContent)).toEqual([
			"Open note",
			"Archive",
			"Save",
			"Cancel",
		]);
		expect(buttons[0].classList.contains("open-button")).toBe(true);
		expect(buttons[1].classList.contains("archive-button")).toBe(true);
		expect(buttons[2].classList.contains("mod-cta")).toBe(true);

		buttons[0].click();
		buttons[1].click();
		buttons[3].click();

		expect(open).toHaveBeenCalledTimes(1);
		expect(archive).toHaveBeenCalledTimes(1);
		expect(cancel).toHaveBeenCalledTimes(1);
	});

	it("disables the save button while saving and calls the saved callback afterwards", async () => {
		const saveButton = document.createElement("button");
		const onSaved = jest.fn();
		let resolveSave: (() => void) | undefined;
		const savePromise = new Promise<void>((resolve) => {
			resolveSave = resolve;
		});
		const running = runTaskModalSaveAction(saveButton, () => savePromise, onSaved);

		expect(saveButton.disabled).toBe(true);
		expect(onSaved).not.toHaveBeenCalled();

		resolveSave?.();
		await running;

		expect(onSaved).toHaveBeenCalledTimes(1);
		expect(saveButton.disabled).toBe(false);
	});

	it("reenables save and skips the saved callback when save fails", async () => {
		const saveButton = document.createElement("button");
		const onSaved = jest.fn();
		const error = new Error("save failed");

		await expect(
			runTaskModalSaveAction(saveButton, () => Promise.reject(error), onSaved)
		).rejects.toThrow("save failed");

		expect(onSaved).not.toHaveBeenCalled();
		expect(saveButton.disabled).toBe(false);
	});
});
