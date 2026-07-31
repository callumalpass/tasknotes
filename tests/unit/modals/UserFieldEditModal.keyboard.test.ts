import { UserFieldEditModal } from "../../../src/modals/UserFieldEditModal";

function createModal() {
	const onApply = jest.fn().mockResolvedValue(undefined);
	const onClose = jest.fn();
	const plugin = {
		settings: {
			userFieldMru: {
				effort: ["one", "two", "three"],
			},
		},
		saveSettings: jest.fn().mockResolvedValue(undefined),
	};
	const modal = new UserFieldEditModal({} as any, plugin as any, {
		field: { id: "effort", key: "effort", displayName: "Effort", type: "text" },
		tasks: [{ path: "task.md", title: "Task", effort: "old" } as any],
		onApply,
		onClose,
	});
	(modal as any).onOpen();
	document.body.appendChild(modal.contentEl);
	return { modal, onApply, onClose };
}

describe("UserFieldEditModal MRU keyboard navigation", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("moves through MRU values with arrows and returns focus to the input on Enter", () => {
		const { modal, onApply } = createModal();
		const input = (modal as any).input as HTMLInputElement;
		const buttons = Array.from(
			modal.contentEl.querySelectorAll<HTMLButtonElement>(".tasknotes-user-field-mru button")
		);

		buttons[0].focus();
		buttons[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
		expect(document.activeElement).toBe(buttons[1]);

		buttons[1].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		expect(input.value).toBe("two");
		expect(document.activeElement).toBe(input);
		expect(onApply).not.toHaveBeenCalled();
	});

	it("wraps from the first MRU value to the last with ArrowUp", () => {
		const { modal } = createModal();
		const buttons = Array.from(
			modal.contentEl.querySelectorAll<HTMLButtonElement>(".tasknotes-user-field-mru button")
		);

		buttons[0].focus();
		buttons[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
		expect(document.activeElement).toBe(buttons[2]);
	});

	it("notifies the task view when the popup closes", () => {
		const { modal, onClose } = createModal();

		modal.onClose();

		expect(onClose).toHaveBeenCalledTimes(1);
	});
});
