import {
	createTaskModalActionButtons,
	runTaskModalSaveAction,
	type TaskModalActionButtonContext,
} from "../../../src/modals/taskModalActionButtons";

const mockSetIcon = jest.fn();
const mockSetTooltip = jest.fn();

jest.mock("obsidian", () => ({
	setIcon: (...args: unknown[]) => mockSetIcon(...args),
	setTooltip: (...args: unknown[]) => mockSetTooltip(...args),
}));

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
		mockSetIcon.mockClear();
		mockSetTooltip.mockClear();
	});

	it("renders labeled leading actions and trailing save/cancel controls", () => {
		const container = document.createElement("div");
		const open = jest.fn();
		const archive = jest.fn();
		const cancel = jest.fn();

		const buttonContainer = createTaskModalActionButtons(createContext(), {
			container,
			leadingButtons: [
				{
					className: "open-button",
					iconName: "external-link",
					label: "Open note",
					onClick: open,
				},
				{
					className: "archive-button",
					iconName: "archive",
					label: "Archive",
					onClick: archive,
					isWarning: true,
				},
			],
			onSave: jest.fn().mockResolvedValue(undefined),
			onSaved: jest.fn(),
			onCancel: cancel,
		});

		expect(
			buttonContainer.querySelector(".tn-task-modal__icon-button-leading")
		).not.toBeNull();
		expect(
			buttonContainer.querySelector(".tn-task-modal__icon-button-trailing")
		).not.toBeNull();

		const buttons = Array.from(buttonContainer.querySelectorAll("button"));
		expect(buttons).toHaveLength(4);
		expect(buttons[0].getAttribute("aria-label")).toBe("Open note");
		expect(buttons[1].getAttribute("aria-label")).toBe("Archive");
		expect(buttons[2].getAttribute("aria-label")).toBe("Cancel");
		expect(buttons[3].getAttribute("aria-label")).toBe("Save");
		expect(
			buttons[0].querySelector(".tn-task-modal__icon-button-label")?.textContent
		).toBe("Open note");
		expect(
			buttons[1].querySelector(".tn-task-modal__icon-button-label")?.textContent
		).toBe("Archive");
		expect(
			buttons[2].querySelector(".tn-task-modal__icon-button-label")?.textContent
		).toBe("Cancel");
		expect(
			buttons[3].querySelector(".tn-task-modal__icon-button-label")?.textContent
		).toBe("Save");
		expect(buttons[3].classList.contains("mod-cta")).toBe(true);

		buttons[0].click();
		buttons[1].click();
		buttons[2].click();

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
