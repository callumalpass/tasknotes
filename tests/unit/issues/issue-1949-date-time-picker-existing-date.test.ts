import { DateTimePickerModal } from "../../../src/modals/DateTimePickerModal";

describe("Issue #1949: date picker keeps existing-date edits open", () => {
	it("does not steal focus from an already selected time field after opening", () => {
		jest.useFakeTimers();
		const modal = new DateTimePickerModal({} as any, {
			currentDate: "2026-11-07",
			currentTime: "09:30",
			onSelect: jest.fn(),
		});
		try {
			document.body.appendChild(modal.modalEl);
			modal.onOpen();
			const time = modal.contentEl.querySelector<HTMLInputElement>('input[type="time"]')!;
			time.focus();
			expect(document.activeElement).toBe(time);
			jest.advanceTimersByTime(100);
			expect(document.activeElement).toBe(time);
		} finally {
			modal.close();
			modal.modalEl.remove();
			jest.useRealTimers();
		}
	});

	it("reuses the month grid without committing until Select and retains the current time", () => {
		const onSelect = jest.fn();
		const modal = new DateTimePickerModal({} as any, {
			currentDate: "2026-01-31",
			currentTime: "13:05",
			onSelect,
		});
		modal.open();
		const calendar = modal.contentEl.querySelector(".tn-month-calendar")!;
		calendar.querySelector<HTMLButtonElement>('[aria-label="Next month"]')!.click();
		expect(calendar.querySelector(".tn-month-calendar__month")?.textContent).toBe("February 2026");
		calendar.querySelector<HTMLButtonElement>('[data-date="2026-02-12"]')!.click();
		expect(onSelect).not.toHaveBeenCalled();
		expect(modal.contentEl.querySelector<HTMLInputElement>('input[type="date"]')!.value).toBe("2026-02-12");
		modal.contentEl.querySelector<HTMLButtonElement>(".date-time-picker-modal__action-button.mod-cta")!.click();
		expect(onSelect).toHaveBeenCalledWith("2026-02-12", "13:05");
	});

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

	it("keeps the calendar usable with an invalid stored date", () => {
		const modal = new DateTimePickerModal({} as any, {
			currentDate: "invalid",
			onSelect: jest.fn(),
		});
		expect(() => modal.open()).not.toThrow();
		expect(modal.contentEl.querySelector('.tn-month-calendar__day[tabindex="0"]')).toBeTruthy();
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
