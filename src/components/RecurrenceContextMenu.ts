import { App, Modal, Setting } from "obsidian";
import { TranslationKey } from "../i18n";
import TaskNotesPlugin from "../main";
import { ContextMenu } from "./ContextMenu";

export interface RecurrenceOption {
	label: string;
	value: string;
	icon?: string;
	anchor?: 'scheduled' | 'completion'; // NEW: Determines if recurrence is from scheduled date or completion date
}

export interface RecurrenceContextMenuOptions {
	currentValue?: string;
	currentAnchor?: 'scheduled' | 'completion';
	scheduledDate?: string; // Task's scheduled date to extract time from
	onSelect: (value: string | null, anchor?: 'scheduled' | 'completion') => void;
	app: App;
	plugin: TaskNotesPlugin;
}

export class RecurrenceContextMenu {
	private menu: ContextMenu;
	private options: RecurrenceContextMenuOptions;
	private translate: (key: TranslationKey, vars?: Record<string, string>) => string;

	constructor(options: RecurrenceContextMenuOptions) {
		this.menu = new ContextMenu();
		this.options = options;
		this.translate = options.plugin.i18n.translate.bind(options.plugin.i18n);
		this.buildMenu();
	}

	private buildMenu(): void {
		const recurrenceOptions = this.getRecurrenceOptions();

		// Add quick recurrence options
		recurrenceOptions.forEach((option) => {
			// Handle separator
			if (option.label.startsWith("─")) {
				this.menu.addSeparator();
				return;
			}

			this.menu.addItem((item) => {
				let title = option.label;

				if (option.icon) {
					item.setIcon(option.icon);
				}

				// Highlight current selection with visual indicator
				if (option.value === this.options.currentValue) {
					title = `✓ ${option.label}`;
				}

				item.setTitle(title);

				item.onClick(async () => {
					const anchorValue = option.anchor || 'scheduled';
					this.options.onSelect(option.value, anchorValue);
				});
			});
		});

		// Add separator before custom options
		this.menu.addSeparator();

		// Add custom recurrence option
		this.menu.addItem((item) => {
			item.setTitle(this.translate("components.recurrenceContextMenu.customRecurrence"));
			item.setIcon("settings");
			item.onClick(async () => {
				this.showCustomRecurrenceModal();
			});
		});

		// Add clear option if there's a current value
		if (this.options.currentValue) {
			this.menu.addItem((item) => {
				item.setTitle(this.translate("components.recurrenceContextMenu.clearRecurrence"));
				item.setIcon("x");
				item.onClick(async () => {
					this.options.onSelect(null);
				});
			});
		}
	}

	private getRecurrenceOptions(): RecurrenceOption[] {
		const options: RecurrenceOption[] = [];
		const today = new Date();

		// Get current day/month/year context for smart defaults
		const dayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
		const monthNames = [
			"January",
			"February",
			"March",
			"April",
			"May",
			"June",
			"July",
			"August",
			"September",
			"October",
			"November",
			"December",
		];
		const currentDay = dayNames[today.getDay()];
		const currentDate = today.getDate();
		const currentMonth = today.getMonth() + 1; // 1-based
		const currentMonthName = monthNames[today.getMonth()];
		const dayName = today.toLocaleDateString("en-US", { weekday: "long" });

		// Format today as DTSTART, preserving existing time if available
		let todayDTSTART = this.formatDateForDTSTART(today);

		// Priority 1: Preserve time from existing recurrence
		if (this.options.currentValue) {
			const existingDtstartMatch = this.options.currentValue.match(
				/DTSTART:(\d{8}(?:T\d{6}Z?)?)/
			);
			if (existingDtstartMatch && existingDtstartMatch[1].includes("T")) {
				// Extract time part from existing DTSTART
				const existingTime = existingDtstartMatch[1].split("T")[1];
				todayDTSTART = `${todayDTSTART}T${existingTime}`;
			}
		}
		// Priority 2: If no existing recurrence time, check task's scheduled date
		else if (this.options.scheduledDate && this.options.scheduledDate.includes("T")) {
			// Extract time from scheduled date (format: YYYY-MM-DDTHH:mm or similar)
			const timeMatch = this.options.scheduledDate.match(/T(\d{2}):(\d{2})/);
			if (timeMatch) {
				const hours = timeMatch[1];
				const minutes = timeMatch[2];
				todayDTSTART = `${todayDTSTART}T${hours}${minutes}00Z`;
			}
		}

		// Daily
		options.push({
			label: this.translate("components.recurrenceContextMenu.daily"),
			value: `DTSTART:${todayDTSTART};FREQ=DAILY;INTERVAL=1`,
			icon: "calendar-days",
		});

		// Weekly (for current day of week)
		options.push({
			label: this.translate("components.recurrenceContextMenu.weeklyOn", { day: dayName }),
			value: `DTSTART:${todayDTSTART};FREQ=WEEKLY;INTERVAL=1;BYDAY=${currentDay}`,
			icon: "calendar",
		});

		// Every 2 weeks (for current day of week)
		options.push({
			label: this.translate("components.recurrenceContextMenu.everyTwoWeeksOn", {
				day: dayName,
			}),
			value: `DTSTART:${todayDTSTART};FREQ=WEEKLY;INTERVAL=2;BYDAY=${currentDay}`,
			icon: "calendar",
		});

		// Monthly (on current date)
		options.push({
			label: this.translate("components.recurrenceContextMenu.monthlyOnThe", {
				ordinal: this.getOrdinal(currentDate),
			}),
			value: `DTSTART:${todayDTSTART};FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=${currentDate}`,
			icon: "calendar-range",
		});

		// Every 3 months (on current date)
		options.push({
			label: this.translate("components.recurrenceContextMenu.everyThreeMonthsOnThe", {
				ordinal: this.getOrdinal(currentDate),
			}),
			value: `DTSTART:${todayDTSTART};FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=${currentDate}`,
			icon: "calendar-range",
		});

		// Yearly (on current date)
		options.push({
			label: this.translate("components.recurrenceContextMenu.yearlyOn", {
				month: currentMonthName,
				ordinal: this.getOrdinal(currentDate),
			}),
			value: `DTSTART:${todayDTSTART};FREQ=YEARLY;INTERVAL=1;BYMONTH=${currentMonth};BYMONTHDAY=${currentDate}`,
			icon: "calendar-clock",
		});

		// Weekdays only
		options.push({
			label: this.translate("components.recurrenceContextMenu.weekdaysOnly"),
			value: `DTSTART:${todayDTSTART};FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR`,
			icon: "briefcase",
		});

		// Separator (visual only - will be filtered out)
		options.push({
			label: "─────────",
			value: "",
			icon: undefined,
		});

		// Completion-based options
		options.push({
			label: this.translate("components.recurrenceContextMenu.dailyAfterCompletion"),
			value: `DTSTART:${todayDTSTART};FREQ=DAILY;INTERVAL=1`,
			icon: "calendar-days",
			anchor: "completion",
		});

		options.push({
			label: this.translate("components.recurrenceContextMenu.every3DaysAfterCompletion"),
			value: `DTSTART:${todayDTSTART};FREQ=DAILY;INTERVAL=3`,
			icon: "calendar-days",
			anchor: "completion",
		});

		options.push({
			label: this.translate("components.recurrenceContextMenu.weeklyAfterCompletion"),
			value: `DTSTART:${todayDTSTART};FREQ=WEEKLY;INTERVAL=1`,
			icon: "calendar",
			anchor: "completion",
		});

		options.push({
			label: this.translate("components.recurrenceContextMenu.monthlyAfterCompletion"),
			value: `DTSTART:${todayDTSTART};FREQ=MONTHLY;INTERVAL=1`,
			icon: "calendar-range",
			anchor: "completion",
		});

		return options;
	}

	private formatDateForDTSTART(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		return `${year}${month}${day}`;
	}

	private getOrdinal(n: number): string {
		const s = ["th", "st", "nd", "rd"];
		const v = n % 100;
		return n + (s[(v - 20) % 10] || s[v] || s[0]);
	}

	private showCustomRecurrenceModal(): void {
		new CustomRecurrenceModal(
			this.options.app,
			this.options.currentValue || "",
			this.options.currentAnchor || 'scheduled',
			this.options.scheduledDate,
			(result, anchor) => {
				if (result) {
					this.options.onSelect(result, anchor);
				}
			}
		).open();
	}

	public show(event: UIEvent): void {
		this.menu.show(event);
	}
}

class CustomRecurrenceModal extends Modal {
	private currentValue: string;
	private scheduledDate?: string;
	private onSubmit: (result: string | null, anchor?: 'scheduled' | 'completion') => void;
	private frequency = "DAILY";
	private interval = 1;
	private byDay: string[] = [];
	private byMonthDay: number[] = [];
	private byMonth: number[] = [];
	private bySetPos: number | undefined; // For "first Monday", "last Friday", etc.
	private count: number | undefined;
	private until = "";
	private endType: "never" | "count" | "until" = "never";
	private dtstart = "";
	private dtstartTime = "";
	private recurrenceAnchor: 'scheduled' | 'completion' = 'scheduled'; // NEW: Recurrence anchor

	constructor(app: App, currentValue: string, currentAnchor: 'scheduled' | 'completion', scheduledDate: string | undefined, onSubmit: (result: string | null, anchor?: 'scheduled' | 'completion') => void) {
		super(app);
		this.currentValue = currentValue;
		this.recurrenceAnchor = currentAnchor;
		this.scheduledDate = scheduledDate;
		this.onSubmit = onSubmit;
		this.parseCurrentValue();
	}

	private parseCurrentValue(): void {
		if (!this.currentValue) {
			// Set default DTSTART to today
			this.dtstart = this.formatTodayForInput();
			
			// Check if we should preserve time from scheduled date
			if (this.scheduledDate && this.scheduledDate.includes("T")) {
				const timeMatch = this.scheduledDate.match(/T(\d{2}):(\d{2})/);
				if (timeMatch) {
					this.dtstartTime = `${timeMatch[1]}:${timeMatch[2]}`;
				}
			}
			return;
		}

		// Parse RRULE format
		const parts = this.currentValue.split(";");

		for (const part of parts) {
			// DTSTART uses colon, other properties use equals
			const separator = part.includes(":") && part.startsWith("DTSTART") ? ":" : "=";
			const [key, value] = part.split(separator);

			switch (key) {
				case "DTSTART":
					// Convert YYYYMMDD or YYYYMMDDTHHMMSSZ to YYYY-MM-DD for date input
					if (value.length >= 8) {
						this.dtstart = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;

						// Extract time if present (YYYYMMDDTHHMMSSZ format)
						if (value.length > 8 && value.includes("T")) {
							const timeStr = value.slice(9); // Get HHMMSSZ part
							if (timeStr.length >= 4) {
								this.dtstartTime = `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}`;
							}
						}
					} else {
						// Fallback: try to parse as ISO date or use current date
						const parsed = new Date(value);
						if (!isNaN(parsed.getTime())) {
							this.dtstart = value; // Already in YYYY-MM-DD format
						} else {
							// Invalid date, use today as fallback
							this.dtstart = this.formatTodayForInput();
						}
					}
					break;
				case "FREQ":
					this.frequency = value;
					break;
				case "INTERVAL":
					this.interval = parseInt(value) || 1;
					break;
				case "BYDAY": {
					// Handle positioned days like "1MO" or "MO,TU,WE"
					const dayValues = value.split(",");
					const parsedDays = [];

					for (const dayValue of dayValues) {
						// Check if it has a position prefix (like "1MO", "2TU", "-1FR")
						const positionMatch = dayValue.match(/^(-?\d+)([A-Z]{2})$/);
						if (positionMatch) {
							// This is a positioned day (e.g., "1MO" = first Monday)
							this.bySetPos = parseInt(positionMatch[1]);
							parsedDays.push(positionMatch[2]);
						} else {
							// This is just a day code (e.g., "MO", "TU")
							parsedDays.push(dayValue);
						}
					}
					this.byDay = parsedDays;
					break;
				}
				case "BYMONTHDAY":
					this.byMonthDay = value.split(",").map((v) => parseInt(v));
					break;
				case "BYMONTH":
					this.byMonth = value.split(",").map((v) => parseInt(v));
					break;
				case "BYSETPOS":
					// This is already handled in BYDAY parsing for most cases
					this.bySetPos = parseInt(value);
					break;
				case "COUNT":
					this.count = parseInt(value);
					this.endType = "count";
					break;
				case "UNTIL":
					// Convert YYYYMMDD format to YYYY-MM-DD for date input
					if (value.length === 8) {
						this.until = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
					} else {
						this.until = value;
					}
					this.endType = "until";
					break;
			}
		}
	}

	private formatTodayForInput(): string {
		const today = new Date();
		const year = today.getFullYear();
		const month = String(today.getMonth() + 1).padStart(2, "0");
		const day = String(today.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Custom Recurrence" });

		// Start date selection
		new Setting(contentEl)
			.setName("Start date")
			.setDesc("The date when the recurrence pattern begins")
			.addText((text) => {
				text.inputEl.type = "date";
				text.setValue(this.dtstart).onChange((value) => {
					this.dtstart = value;
				});
			});

		// Start time selection
		new Setting(contentEl)
			.setName("Start time")
			.setDesc("The time when recurring instances should appear (optional)")
			.addText((text) => {
				text.inputEl.type = "time";
				text.setValue(this.dtstartTime).onChange((value) => {
					this.dtstartTime = value;
				});
			});

		// Recurrence anchor selection
		new Setting(contentEl)
			.setName("Recur from")
			.setDesc("When should the next occurrence be calculated from?")
			.addDropdown((dropdown) => {
				dropdown
					.addOption('scheduled', 'Scheduled date (fixed schedule)')
					.addOption('completion', 'Completion date (flexible schedule)')
					.setValue(this.recurrenceAnchor)
					.onChange((value) => {
						this.recurrenceAnchor = value as 'scheduled' | 'completion';
					});
			});

		// Frequency selection
		new Setting(contentEl).setName("Frequency").addDropdown((dropdown) => {
			dropdown
				.addOption("DAILY", "Daily")
				.addOption("WEEKLY", "Weekly")
				.addOption("MONTHLY", "Monthly")
				.addOption("YEARLY", "Yearly")
				.setValue(this.frequency)
				.onChange((value) => {
					this.frequency = value;
					this.updateFrequencySpecificVisibility();
				});
		});

		// Interval selection
		new Setting(contentEl)
			.setName("Interval")
			.setDesc("Every X days/weeks/months/years")
			.addText((text) => {
				text.setValue(this.interval.toString()).onChange((value) => {
					this.interval = parseInt(value) || 1;
				});
			});

		// Days of week (for weekly frequency)
		const byDaySetting = new Setting(contentEl)
			.setName("Days of week")
			.setDesc("Select specific days (for weekly recurrence)");

		const daysContainer = byDaySetting.controlEl.createDiv("days-container");
		const days = [
			{ key: "MO", label: "Mon" },
			{ key: "TU", label: "Tue" },
			{ key: "WE", label: "Wed" },
			{ key: "TH", label: "Thu" },
			{ key: "FR", label: "Fri" },
			{ key: "SA", label: "Sat" },
			{ key: "SU", label: "Sun" },
		];

		days.forEach((day) => {
			const dayEl = daysContainer.createEl("label", { cls: "day-checkbox" });
			dayEl.style.display = "inline-block";
			dayEl.style.marginRight = "8px";

			const checkbox = dayEl.createEl("input", { type: "checkbox" });
			checkbox.checked = this.byDay.includes(day.key);
			checkbox.addEventListener("change", () => {
				if (checkbox.checked) {
					if (!this.byDay.includes(day.key)) {
						this.byDay.push(day.key);
					}
				} else {
					this.byDay = this.byDay.filter((d) => d !== day.key);
				}
			});

			dayEl.createSpan({ text: ` ${day.label}` });
		});

		// Monthly options
		const monthlyTypeSetting = new Setting(contentEl)
			.setName("Monthly recurrence")
			.setDesc("Choose how to repeat monthly");

		const monthlyTypeContainer = monthlyTypeSetting.controlEl.createDiv("monthly-options");

		const monthlyByDateRadio = monthlyTypeContainer.createEl("label", { cls: "radio-option" });
		monthlyByDateRadio.style.display = "block";
		monthlyByDateRadio.style.marginBottom = "8px";
		const monthlyByDateInput = monthlyByDateRadio.createEl("input", {
			type: "radio",
			value: "bydate",
		});
		monthlyByDateInput.name = "monthly-type";
		monthlyByDateInput.checked =
			this.byMonthDay.length > 0 || (this.byDay.length === 0 && this.bySetPos === undefined);
		monthlyByDateRadio.createSpan({ text: " On day " });

		const monthlyDateSelect = monthlyByDateRadio.createEl("select");
		monthlyDateSelect.style.marginLeft = "4px";
		monthlyDateSelect.style.marginRight = "4px";
		for (let i = 1; i <= 31; i++) {
			const option = monthlyDateSelect.createEl("option", {
				value: i.toString(),
				text: i.toString(),
			});
			if (this.byMonthDay.length > 0 && this.byMonthDay[0] === i) {
				option.selected = true;
			} else if (this.byMonthDay.length === 0 && i === new Date().getDate()) {
				option.selected = true;
			}
		}
		monthlyByDateRadio.createSpan({ text: " of each month" });

		const monthlyByDayRadio = monthlyTypeContainer.createEl("label", { cls: "radio-option" });
		monthlyByDayRadio.style.display = "block";
		monthlyByDayRadio.style.marginBottom = "8px";
		const monthlyByDayInput = monthlyByDayRadio.createEl("input", {
			type: "radio",
			value: "byday",
		});
		monthlyByDayInput.name = "monthly-type";
		monthlyByDayInput.checked = this.byDay.length > 0 && this.bySetPos !== undefined;
		monthlyByDayRadio.createSpan({ text: " On the " });

		const monthlyWeekSelect = monthlyByDayRadio.createEl("select");
		monthlyWeekSelect.style.marginLeft = "4px";
		monthlyWeekSelect.style.marginRight = "4px";
		const weekOptions = [
			{ value: "1", text: "first" },
			{ value: "2", text: "second" },
			{ value: "3", text: "third" },
			{ value: "4", text: "fourth" },
			{ value: "-1", text: "last" },
		];
		weekOptions.forEach((opt) => {
			const option = monthlyWeekSelect.createEl("option", {
				value: opt.value,
				text: opt.text,
			});
			if (this.bySetPos === parseInt(opt.value)) {
				option.selected = true;
			} else if (!this.bySetPos && opt.value === "1") {
				option.selected = true;
			}
		});

		const monthlyDaySelect = monthlyByDayRadio.createEl("select");
		monthlyDaySelect.style.marginLeft = "4px";
		monthlyDaySelect.style.marginRight = "4px";
		const dayOptions = [
			{ value: "MO", text: "Monday" },
			{ value: "TU", text: "Tuesday" },
			{ value: "WE", text: "Wednesday" },
			{ value: "TH", text: "Thursday" },
			{ value: "FR", text: "Friday" },
			{ value: "SA", text: "Saturday" },
			{ value: "SU", text: "Sunday" },
		];
		const today = new Date();
		const currentDayCode = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][today.getDay()];
		dayOptions.forEach((opt) => {
			const option = monthlyDaySelect.createEl("option", {
				value: opt.value,
				text: opt.text,
			});
			if (this.byDay.length > 0 && this.byDay[0] === opt.value) {
				option.selected = true;
			} else if (this.byDay.length === 0 && opt.value === currentDayCode) {
				option.selected = true;
			}
		});
		monthlyByDayRadio.createSpan({ text: " of each month" });

		// Yearly options
		const yearlyTypeSetting = new Setting(contentEl)
			.setName("Yearly recurrence")
			.setDesc("Choose how to repeat yearly");

		const yearlyTypeContainer = yearlyTypeSetting.controlEl.createDiv("yearly-options");

		const yearlyByDateRadio = yearlyTypeContainer.createEl("label", { cls: "radio-option" });
		yearlyByDateRadio.style.display = "block";
		yearlyByDateRadio.style.marginBottom = "8px";
		const yearlyByDateInput = yearlyByDateRadio.createEl("input", {
			type: "radio",
			value: "bydate",
		});
		yearlyByDateInput.name = "yearly-type";
		yearlyByDateInput.checked =
			this.byMonthDay.length > 0 || (this.byDay.length === 0 && this.bySetPos === undefined);
		yearlyByDateRadio.createSpan({ text: " On " });

		const yearlyMonthSelect = yearlyByDateRadio.createEl("select");
		yearlyMonthSelect.style.marginLeft = "4px";
		yearlyMonthSelect.style.marginRight = "4px";
		const monthNames = [
			"January",
			"February",
			"March",
			"April",
			"May",
			"June",
			"July",
			"August",
			"September",
			"October",
			"November",
			"December",
		];
		monthNames.forEach((month, index) => {
			const option = yearlyMonthSelect.createEl("option", {
				value: (index + 1).toString(),
				text: month,
			});
			if (this.byMonth.length > 0 && this.byMonth[0] === index + 1) {
				option.selected = true;
			} else if (this.byMonth.length === 0 && index + 1 === new Date().getMonth() + 1) {
				option.selected = true;
			}
		});

		const yearlyDateSelect = yearlyByDateRadio.createEl("select");
		yearlyDateSelect.style.marginLeft = "4px";
		yearlyDateSelect.style.marginRight = "4px";
		for (let i = 1; i <= 31; i++) {
			const option = yearlyDateSelect.createEl("option", {
				value: i.toString(),
				text: i.toString(),
			});
			if (this.byMonthDay.length > 0 && this.byMonthDay[0] === i) {
				option.selected = true;
			} else if (this.byMonthDay.length === 0 && i === new Date().getDate()) {
				option.selected = true;
			}
		}
		yearlyByDateRadio.createSpan({ text: " each year" });

		const yearlyByDayRadio = yearlyTypeContainer.createEl("label", { cls: "radio-option" });
		yearlyByDayRadio.style.display = "block";
		yearlyByDayRadio.style.marginBottom = "8px";
		const yearlyByDayInput = yearlyByDayRadio.createEl("input", {
			type: "radio",
			value: "byday",
		});
		yearlyByDayInput.name = "yearly-type";
		yearlyByDayInput.checked = this.byDay.length > 0 && this.bySetPos !== undefined;
		yearlyByDayRadio.createSpan({ text: " On the " });

		const yearlyWeekSelect = yearlyByDayRadio.createEl("select");
		yearlyWeekSelect.style.marginLeft = "4px";
		yearlyWeekSelect.style.marginRight = "4px";
		weekOptions.forEach((opt) => {
			const option = yearlyWeekSelect.createEl("option", {
				value: opt.value,
				text: opt.text,
			});
			if (this.bySetPos === parseInt(opt.value)) {
				option.selected = true;
			} else if (!this.bySetPos && opt.value === "1") {
				option.selected = true;
			}
		});

		const yearlyDaySelect = yearlyByDayRadio.createEl("select");
		yearlyDaySelect.style.marginLeft = "4px";
		yearlyDaySelect.style.marginRight = "4px";
		dayOptions.forEach((opt) => {
			const option = yearlyDaySelect.createEl("option", { value: opt.value, text: opt.text });
			if (this.byDay.length > 0 && this.byDay[0] === opt.value) {
				option.selected = true;
			} else if (this.byDay.length === 0 && opt.value === currentDayCode) {
				option.selected = true;
			}
		});

		const yearlyByDayMonthSelect = yearlyByDayRadio.createEl("select");
		yearlyByDayMonthSelect.style.marginLeft = "4px";
		yearlyByDayMonthSelect.style.marginRight = "4px";
		monthNames.forEach((month, index) => {
			const option = yearlyByDayMonthSelect.createEl("option", {
				value: (index + 1).toString(),
				text: month,
			});
			if (this.byMonth.length > 0 && this.byMonth[0] === index + 1) {
				option.selected = true;
			} else if (this.byMonth.length === 0 && index + 1 === new Date().getMonth() + 1) {
				option.selected = true;
			}
		});
		yearlyByDayRadio.createSpan({ text: " each year" });

		// End condition
		new Setting(contentEl)
			.setName("End condition")
			.setDesc("Choose when the recurrence should end");

		const endConditionContainer = contentEl.createDiv("end-condition-container");

		// Never ends
		const neverRadio = endConditionContainer.createEl("label", { cls: "radio-option" });
		neverRadio.style.display = "block";
		neverRadio.style.marginBottom = "8px";
		const neverInput = neverRadio.createEl("input", { type: "radio", value: "never" });
		neverInput.name = "end-type";
		neverInput.checked = this.endType === "never";
		neverRadio.createSpan({ text: " Never ends" });

		// End after X occurrences
		const countRadio = endConditionContainer.createEl("label", { cls: "radio-option" });
		countRadio.style.display = "block";
		countRadio.style.marginBottom = "8px";
		const countInput = countRadio.createEl("input", { type: "radio", value: "count" });
		countInput.name = "end-type";
		countInput.checked = this.endType === "count";
		countRadio.createSpan({ text: " End after " });
		const countText = countRadio.createEl("input", { type: "number", placeholder: "10" });
		countText.style.width = "60px";
		countText.style.marginLeft = "4px";
		countText.style.marginRight = "4px";
		countText.value = this.count ? this.count.toString() : "";
		countRadio.createSpan({ text: " occurrences" });

		// End on date
		const untilRadio = endConditionContainer.createEl("label", { cls: "radio-option" });
		untilRadio.style.display = "block";
		untilRadio.style.marginBottom = "8px";
		const untilInput = untilRadio.createEl("input", { type: "radio", value: "until" });
		untilInput.name = "end-type";
		untilInput.checked = this.endType === "until";
		untilRadio.createSpan({ text: " End on " });
		const untilDate = untilRadio.createEl("input", { type: "date" });
		untilDate.style.marginLeft = "4px";
		untilDate.value = this.until ? this.until.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3") : "";

		// Event listeners for end condition
		neverInput.addEventListener("change", () => {
			if (neverInput.checked) this.endType = "never";
		});
		countInput.addEventListener("change", () => {
			if (countInput.checked) this.endType = "count";
		});
		untilInput.addEventListener("change", () => {
			if (untilInput.checked) this.endType = "until";
		});

		countText.addEventListener("input", () => {
			this.count = parseInt(countText.value) || undefined;
			if (countText.value) {
				countInput.checked = true;
				this.endType = "count";
			}
		});

		untilDate.addEventListener("input", () => {
			this.until = untilDate.value ? untilDate.value.replace(/-/g, "") : "";
			if (untilDate.value) {
				untilInput.checked = true;
				this.endType = "until";
			}
		});

		this.updateFrequencySpecificVisibility = () => {
			byDaySetting.settingEl.style.display = this.frequency === "WEEKLY" ? "flex" : "none";
			monthlyTypeSetting.settingEl.style.display =
				this.frequency === "MONTHLY" ? "flex" : "none";
			yearlyTypeSetting.settingEl.style.display =
				this.frequency === "YEARLY" ? "flex" : "none";
		};
		this.updateFrequencySpecificVisibility();

		// Buttons
		const buttonContainer = contentEl.createDiv("button-container");
		buttonContainer.style.display = "flex";
		buttonContainer.style.justifyContent = "flex-end";
		buttonContainer.style.gap = "8px";
		buttonContainer.style.marginTop = "16px";

		const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
		cancelButton.addEventListener("click", () => {
			this.close();
		});

		const saveButton = buttonContainer.createEl("button", { text: "Save", cls: "mod-cta" });
		saveButton.addEventListener("click", () => {
			// Get current radio button states and dropdown values
			const monthlyType = monthlyByDateInput.checked ? "bydate" : "byday";
			const yearlyType = yearlyByDateInput.checked ? "bydate" : "byday";

			// Update internal state from form controls
			if (this.frequency === "MONTHLY") {
				if (monthlyType === "bydate") {
					this.byMonthDay = [parseInt(monthlyDateSelect.value)];
					this.byDay = [];
					this.bySetPos = undefined;
				} else {
					this.byMonthDay = [];
					this.byDay = [monthlyDaySelect.value];
					this.bySetPos = parseInt(monthlyWeekSelect.value);
				}
			} else if (this.frequency === "YEARLY") {
				if (yearlyType === "bydate") {
					this.byMonth = [parseInt(yearlyMonthSelect.value)];
					this.byMonthDay = [parseInt(yearlyDateSelect.value)];
					this.byDay = [];
					this.bySetPos = undefined;
				} else {
					this.byMonth = [parseInt(yearlyByDayMonthSelect.value)];
					this.byMonthDay = [];
					this.byDay = [yearlyDaySelect.value];
					this.bySetPos = parseInt(yearlyWeekSelect.value);
				}
			}

			const rrule = this.buildRRule(monthlyType, yearlyType);
			this.onSubmit(rrule, this.recurrenceAnchor);
			this.close();
		});
	}

	private updateFrequencySpecificVisibility(): void {
		// This will be set in onOpen
	}

	private buildRRule(monthlyType?: string, yearlyType?: string): string {
		let parts = [];

		// Add DTSTART first (convert YYYY-MM-DD to YYYYMMDD or YYYYMMDDTHHMMSSZ format)
		if (this.dtstart) {
			let dtstartFormatted = this.dtstart.replace(/-/g, "");

			// Add time if specified (local time, no Z suffix — the time comes from the task's scheduled date which is local)
			if (this.dtstartTime) {
				const timeFormatted = this.dtstartTime.replace(":", "") + "00";
				dtstartFormatted = `${dtstartFormatted}T${timeFormatted}`;
			}

			parts.push(`DTSTART:${dtstartFormatted}`);
		}

		parts.push(`FREQ=${this.frequency}`);

		if (this.interval > 1) {
			parts.push(`INTERVAL=${this.interval}`);
		}

		// Handle frequency-specific rules
		switch (this.frequency) {
			case "WEEKLY":
				if (this.byDay.length > 0) {
					parts.push(`BYDAY=${this.byDay.join(",")}`);
				}
				break;

			case "MONTHLY":
				if (monthlyType === "bydate") {
					const dayOfMonth =
						this.byMonthDay.length > 0 ? this.byMonthDay[0] : new Date().getDate();
					parts.push(`BYMONTHDAY=${dayOfMonth}`);
				} else if (monthlyType === "byday") {
					if (this.byDay.length > 0) {
						const setPos = this.bySetPos || 1;
						parts.push(`BYDAY=${setPos}${this.byDay[0]}`);
					}
				}
				break;

			case "YEARLY":
				if (yearlyType === "bydate") {
					const month =
						this.byMonth.length > 0 ? this.byMonth[0] : new Date().getMonth() + 1;
					const dayOfMonth =
						this.byMonthDay.length > 0 ? this.byMonthDay[0] : new Date().getDate();
					parts.push(`BYMONTH=${month}`);
					parts.push(`BYMONTHDAY=${dayOfMonth}`);
				} else if (yearlyType === "byday") {
					const month =
						this.byMonth.length > 0 ? this.byMonth[0] : new Date().getMonth() + 1;
					parts.push(`BYMONTH=${month}`);

					if (this.byDay.length > 0) {
						const setPos = this.bySetPos || 1;
						parts.push(`BYDAY=${setPos}${this.byDay[0]}`);
					}
				}
				break;
		}

		// Handle end conditions
		switch (this.endType) {
			case "count":
				if (this.count && this.count > 0) {
					parts.push(`COUNT=${this.count}`);
				}
				break;
			case "until":
				if (this.until) {
					// Convert YYYY-MM-DD to YYYYMMDD format
					const untilFormatted = this.until.replace(/-/g, "");
					parts.push(`UNTIL=${untilFormatted}`);
				}
				break;
			// 'never' case - no additional parts needed
		}

		return parts.join(";");
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
