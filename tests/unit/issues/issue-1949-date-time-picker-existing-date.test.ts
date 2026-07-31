import { DateTimePickerModal } from "../../../src/modals/DateTimePickerModal";

describe("Issue #1949: date picker keeps existing-date edits open", () => {
	it("does not commit or close when typing a digit into an existing date", () => {
		const onSelect = jest.fn();
		const modal = new DateTimePickerModal({} as any, {
			currentDate: "2026-01-15",
			currentTime: "09:30",
			onSelect,
		});

		modal.open();

		const dateInput = modal.contentEl.querySelector<HTMLInputElement>(
			'input[type="date"].date-time-picker-modal__date-input'
		);
		expect(dateInput).toBeTruthy();

		dateInput!.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "2",
				bubbles: true,
				cancelable: true,
			})
		);

		expect(onSelect).not.toHaveBeenCalled();
		expect(
			modal.contentEl.querySelector<HTMLInputElement>(
				'input[type="date"].date-time-picker-modal__date-input'
			)
		).toBe(dateInput);
	});

	it("accepts compact YYYYMMDD typing and waits for explicit selection", () => {
		const onSelect = jest.fn();
		const modal = new DateTimePickerModal({} as any, {
			currentDate: "2026-01-15",
			currentTime: "09:30",
			onSelect,
		});

		modal.open();

		const dateInput = modal.contentEl.querySelector<HTMLInputElement>(
			'input[type="date"].date-time-picker-modal__date-input'
		);
		const selectButton = modal.contentEl.querySelector<HTMLButtonElement>(
			".date-time-picker-modal__action-button.mod-cta"
		);
		expect(dateInput).toBeTruthy();
		expect(selectButton).toBeTruthy();

		for (const digit of "20260120") {
			dateInput!.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: digit,
					bubbles: true,
					cancelable: true,
				})
			);
		}

		expect(dateInput!.value).toBe("2026-01-20");
		expect(onSelect).not.toHaveBeenCalled();

		selectButton!.click();

		expect(onSelect).toHaveBeenCalledWith("2026-01-20", "09:30");
	});
});
