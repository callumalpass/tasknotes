import { App, Modal, setIcon } from "obsidian";

export interface DateTimePickerOptions {
	currentDate?: string | null;
	currentTime?: string | null;
	title?: string;
	onSelect: (date: string | null, time: string | null) => void;
}

export interface CalendarGridDay {
	date: string;
	day: number;
	isCurrentMonth: boolean;
	isSelected: boolean;
	isToday: boolean;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(value: number): string {
	return String(value).padStart(2, "0");
}

export function formatCalendarDate(year: number, monthIndex: number, day: number): string {
	return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

export function parseCalendarDate(value: string | null | undefined): Date | null {
	if (!value) return null;
	const match = DATE_PATTERN.exec(value);
	if (!match) return null;

	const year = Number(match[1]);
	const monthIndex = Number(match[2]) - 1;
	const day = Number(match[3]);
	const date = new Date(year, monthIndex, day);

	if (
		date.getFullYear() !== year ||
		date.getMonth() !== monthIndex ||
		date.getDate() !== day
	) {
		return null;
	}

	return date;
}

export function getInitialDisplayMonth(currentDate: string | null | undefined): Date {
	const parsed = parseCalendarDate(currentDate) ?? new Date();
	return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
}

export function buildCalendarGrid(
	displayMonth: Date,
	selectedDate: string | null | undefined,
	today = new Date()
): CalendarGridDay[] {
	const monthStart = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1);
	const gridStart = new Date(monthStart);
	gridStart.setDate(monthStart.getDate() - monthStart.getDay());

	const todayValue = formatCalendarDate(today.getFullYear(), today.getMonth(), today.getDate());
	const days: CalendarGridDay[] = [];

	for (let index = 0; index < 42; index += 1) {
		const dayDate = new Date(gridStart);
		dayDate.setDate(gridStart.getDate() + index);
		const dateValue = formatCalendarDate(
			dayDate.getFullYear(),
			dayDate.getMonth(),
			dayDate.getDate()
		);

		days.push({
			date: dateValue,
			day: dayDate.getDate(),
			isCurrentMonth: dayDate.getMonth() === displayMonth.getMonth(),
			isSelected: dateValue === selectedDate,
			isToday: dateValue === todayValue,
		});
	}

	return days;
}

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

function nextMonday(from: Date): Date {
	const result = new Date(from);
	const daysUntilMonday = ((1 - result.getDay() + 7) % 7) || 7;
	result.setDate(result.getDate() + daysUntilMonday);
	return result;
}

/**
 * Calendar-first modal for selecting a task date and optional time.
 */
export class DateTimePickerModal extends Modal {
	private readonly options: DateTimePickerOptions;
	private selectedDate: string | null;
	private displayMonth: Date;
	private timeInput: HTMLInputElement | null = null;
	private monthLabelEl: HTMLElement | null = null;
	private calendarGridEl: HTMLElement | null = null;
	private selectButtonEl: HTMLButtonElement | null = null;

	constructor(app: App, options: DateTimePickerOptions) {
		super(app);
		this.options = options;
		this.selectedDate = options.currentDate ?? null;
		this.displayMonth = getInitialDisplayMonth(options.currentDate);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("tasknotes-plugin", "date-time-picker-modal");

		if (this.options.title) {
			contentEl.createEl("h3", {
				text: this.options.title,
				cls: "date-time-picker-modal__title",
			});
		}

		this.renderQuickActions(contentEl);
		this.renderCalendar(contentEl);
		this.renderTimeInput(contentEl);
		this.renderActions(contentEl);
		this.updateSelectButtonState();

		window.setTimeout(() => {
			this.calendarGridEl
				?.querySelector<HTMLButtonElement>(
					".date-time-picker-modal__day.is-selected, .date-time-picker-modal__day.is-today"
				)
				?.focus();
		}, 100);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderQuickActions(container: HTMLElement): void {
		const today = new Date();
		const quickActions = [
			{ label: "Today", date: today },
			{ label: "Tomorrow", date: addDays(today, 1) },
			{ label: "Next week", date: nextMonday(today) },
		];

		const row = container.createDiv({ cls: "date-time-picker-modal__quick-actions" });
		for (const action of quickActions) {
			const button = row.createEl("button", {
				text: action.label,
				cls: "date-time-picker-modal__quick-button",
				attr: { type: "button" },
			});
			button.addEventListener("click", () => {
				this.selectDate(
					formatCalendarDate(action.date.getFullYear(), action.date.getMonth(), action.date.getDate())
				);
			});
		}
	}

	private renderCalendar(container: HTMLElement): void {
		const calendar = container.createDiv({ cls: "date-time-picker-modal__calendar" });
		const header = calendar.createDiv({ cls: "date-time-picker-modal__calendar-header" });

		const previousButton = header.createEl("button", {
			cls: "clickable-icon date-time-picker-modal__nav-button",
			attr: { type: "button", "aria-label": "Previous month", title: "Previous month" },
		});
		setIcon(previousButton, "chevron-left");
		previousButton.addEventListener("click", () => this.changeMonth(-1));

		this.monthLabelEl = header.createDiv({ cls: "date-time-picker-modal__month-label" });

		const nextButton = header.createEl("button", {
			cls: "clickable-icon date-time-picker-modal__nav-button",
			attr: { type: "button", "aria-label": "Next month", title: "Next month" },
		});
		setIcon(nextButton, "chevron-right");
		nextButton.addEventListener("click", () => this.changeMonth(1));

		const weekdays = calendar.createDiv({ cls: "date-time-picker-modal__weekdays" });
		for (const day of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
			weekdays.createDiv({ text: day, cls: "date-time-picker-modal__weekday" });
		}

		this.calendarGridEl = calendar.createDiv({ cls: "date-time-picker-modal__grid" });
		this.renderCalendarGrid();
	}

	private renderCalendarGrid(): void {
		if (!this.calendarGridEl || !this.monthLabelEl) return;

		this.monthLabelEl.textContent = this.displayMonth.toLocaleDateString(undefined, {
			month: "long",
			year: "numeric",
		});

		this.calendarGridEl.empty();
		const days = buildCalendarGrid(this.displayMonth, this.selectedDate);
		for (const day of days) {
			const button = this.calendarGridEl.createEl("button", {
				text: String(day.day),
				cls: [
					"date-time-picker-modal__day",
					day.isCurrentMonth ? "is-current-month" : "is-outside-month",
					day.isSelected ? "is-selected" : "",
					day.isToday ? "is-today" : "",
				]
					.filter(Boolean)
					.join(" "),
				attr: {
					type: "button",
					"aria-label": day.date,
					"aria-pressed": day.isSelected ? "true" : "false",
				},
			});
			button.addEventListener("click", () => this.selectDate(day.date));
		}
	}

	private renderTimeInput(container: HTMLElement): void {
		const field = container.createDiv({ cls: "date-time-picker-modal__time-field" });
		field.createEl("label", {
			text: "Time (optional)",
			cls: "date-time-picker-modal__time-label",
			attr: { for: "tasknotes-date-time-picker-time" },
		});

		this.timeInput = field.createEl("input", {
			cls: "date-time-picker-modal__time-input",
			attr: {
				id: "tasknotes-date-time-picker-time",
				type: "time",
				value: this.options.currentTime ?? "",
			},
		});
		this.timeInput.addEventListener("keydown", (event) => {
			if (event.key === "Enter" && this.selectedDate) {
				event.preventDefault();
				this.confirmSelectedDate();
			}
		});
	}

	private renderActions(container: HTMLElement): void {
		const actions = container.createDiv({ cls: "date-time-picker-modal__actions" });

		if (this.options.currentDate) {
			const clearButton = actions.createEl("button", {
				text: "Clear date",
				cls: "date-time-picker-modal__action-button",
				attr: { type: "button" },
			});
			clearButton.addEventListener("click", () => {
				this.options.onSelect(null, null);
				this.close();
			});
		}

		const cancelButton = actions.createEl("button", {
			text: "Cancel",
			cls: "date-time-picker-modal__action-button",
			attr: { type: "button" },
		});
		cancelButton.addEventListener("click", () => this.close());

		this.selectButtonEl = actions.createEl("button", {
			text: "Select",
			cls: "mod-cta date-time-picker-modal__action-button",
			attr: { type: "button" },
		});
		this.selectButtonEl.addEventListener("click", () => this.confirmSelectedDate());
	}

	private changeMonth(delta: number): void {
		this.displayMonth = new Date(
			this.displayMonth.getFullYear(),
			this.displayMonth.getMonth() + delta,
			1
		);
		this.renderCalendarGrid();
	}

	private selectDate(date: string): void {
		this.selectedDate = date;
		this.confirmSelectedDate();
	}

	private confirmSelectedDate(): void {
		if (!this.selectedDate) return;
		this.options.onSelect(this.selectedDate, this.timeInput?.value || null);
		this.close();
	}

	private updateSelectButtonState(): void {
		if (!this.selectButtonEl) return;
		this.selectButtonEl.disabled = !this.selectedDate;
	}
}
