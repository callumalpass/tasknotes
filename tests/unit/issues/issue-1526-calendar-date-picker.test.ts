import { DateTimePickerModal, buildCalendarGrid } from "../../../src/modals/DateTimePickerModal";

jest.mock("obsidian");

describe("Issue #1526: calendar-first task date picker", () => {
	it("builds a stable 6-week month grid with selected and today states", () => {
		const days = buildCalendarGrid(
			new Date(2026, 0, 1),
			"2026-01-15",
			new Date(2026, 0, 15)
		);

		expect(days).toHaveLength(42);
		expect(days[0].date).toBe("2025-12-28");
		expect(days[41].date).toBe("2026-02-07");
		expect(days.find((day) => day.date === "2026-01-15")).toMatchObject({
			isCurrentMonth: true,
			isSelected: true,
			isToday: true,
		});
	});

	it("saves immediately when a calendar day is clicked", () => {
		const onSelect = jest.fn();
		const modal = new DateTimePickerModal({} as any, {
			currentDate: "2026-01-15",
			currentTime: "09:30",
			onSelect,
		});

		modal.open();

		const targetDay = Array.from(
			modal.contentEl.querySelectorAll<HTMLButtonElement>(
				".date-time-picker-modal__day"
			)
		).find((button) => button.getAttribute("aria-label") === "2026-01-20");

		expect(targetDay).toBeTruthy();
		targetDay?.click();

		expect(onSelect).toHaveBeenCalledWith("2026-01-20", "09:30");
	});

	it("updates the month grid without changing the selected date", () => {
		const onSelect = jest.fn();
		const modal = new DateTimePickerModal({} as any, {
			currentDate: "2026-01-15",
			onSelect,
		});

		modal.open();

		const nextMonthButton = modal.contentEl.querySelector<HTMLButtonElement>(
			'[aria-label="Next month"]'
		);
		nextMonthButton?.click();

		const februaryDay = Array.from(
			modal.contentEl.querySelectorAll<HTMLButtonElement>(
				".date-time-picker-modal__day"
			)
		).find((button) => button.getAttribute("aria-label") === "2026-02-10");

		expect(februaryDay).toBeTruthy();
		expect(
			modal.contentEl.querySelector(".date-time-picker-modal__day.is-selected")?.textContent
		).not.toBe("10");
		expect(onSelect).not.toHaveBeenCalled();
	});
});
