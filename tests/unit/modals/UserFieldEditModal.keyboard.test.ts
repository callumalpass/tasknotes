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

	it("makes list-value removal controls tabbable and provides Alt+Down MRU access", () => {
		const plugin = {
			settings: { userFieldMru: { labels: ["urgent", "later"] } },
			saveSettings: jest.fn().mockResolvedValue(undefined),
		};
		const modal = new UserFieldEditModal({} as any, plugin as any, {
			field: { id: "labels", key: "labels", displayName: "Labels", type: "list" },
			tasks: [{ path: "task.md", title: "Task", customProperties: { labels: ["current"] } } as any],
			onApply: jest.fn().mockResolvedValue(undefined),
		});
		(modal as any).onOpen();
		document.body.appendChild(modal.contentEl);

		const input = (modal as any).input as HTMLInputElement;
		const removeButton = modal.contentEl.querySelector<HTMLButtonElement>(
			".tasknotes-user-field-value-remove"
		);
		const mruButtons = Array.from(
			modal.contentEl.querySelectorAll<HTMLButtonElement>(".tasknotes-user-field-mru button")
		);

		expect(removeButton?.tabIndex).toBe(0);
		input.dispatchEvent(
			new KeyboardEvent("keydown", { key: "ArrowDown", altKey: true, bubbles: true })
		);
		expect(document.activeElement).toBe(mruButtons[0]);
	});

	it("keeps the date input focused after selecting an MRU value with Enter", () => {
		jest.useFakeTimers();
		try {
			const onApply = jest.fn().mockResolvedValue(undefined);
			const plugin = {
				settings: { userFieldMru: { dueDate: ["2026-08-03"] } },
				saveSettings: jest.fn().mockResolvedValue(undefined),
			};
			const modal = new UserFieldEditModal({} as any, plugin as any, {
				field: { id: "dueDate", key: "dueDate", displayName: "Due date", type: "date" },
				tasks: [{ path: "task.md", title: "Task" } as any],
				onApply,
			});
			(modal as any).onOpen();
			document.body.appendChild(modal.contentEl);

			const input = (modal as any).input as HTMLInputElement;
			const mruButton = modal.contentEl.querySelector<HTMLButtonElement>(
				".tasknotes-user-field-mru button"
			);
			mruButton?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
			jest.runAllTimers();

			expect(input.value).toBe("2026-08-03");
			expect(document.activeElement).toBe(input);
		} finally {
			jest.useRealTimers();
		}
	});
});
