import { DateTimePickerModal } from "../../../src/modals/DateTimePickerModal";

describe("Issue #1526: native task date picker", () => {
	it("uses a native date input initialized with the current date", () => {
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
		const timeInput = modal.contentEl.querySelector<HTMLInputElement>(
			'input[type="time"].date-time-picker-modal__time-input'
		);

		expect(dateInput).toBeTruthy();
		expect(dateInput?.value).toBe("2026-01-15");
		expect(timeInput?.value).toBe("09:30");
	});

	it("keeps native date edits pending until Select is clicked", () => {
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

		dateInput!.value = "2026-01-20";
		dateInput!.dispatchEvent(new Event("change", { bubbles: true }));

		expect(onSelect).not.toHaveBeenCalled();

		const selectButton = modal.contentEl.querySelector<HTMLButtonElement>(
			".date-time-picker-modal__action-button.mod-cta"
		);
		expect(selectButton).toBeTruthy();
		selectButton!.click();

		expect(onSelect).toHaveBeenCalledWith("2026-01-20", "09:30");
	});

	it("keeps the selected date available for explicit selection after editing time", () => {
		const onSelect = jest.fn();
		const modal = new DateTimePickerModal({} as any, {
			currentDate: "2026-01-15",
			onSelect,
		});

		modal.open();

		const timeInput = modal.contentEl.querySelector<HTMLInputElement>(
			'input[type="time"].date-time-picker-modal__time-input'
		);
		const selectButton = modal.contentEl.querySelector<HTMLButtonElement>(
			".date-time-picker-modal__action-button.mod-cta"
		);

		expect(timeInput).toBeTruthy();
		expect(selectButton).toBeTruthy();

		timeInput!.value = "14:15";
		selectButton!.click();

		expect(onSelect).toHaveBeenCalledWith("2026-01-15", "14:15");
	});
});
