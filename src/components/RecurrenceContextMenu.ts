import { App, Modal, Setting } from "obsidian";
import { TranslationKey } from "../i18n";
import TaskNotesPlugin from "../main";
import { ContextMenu } from "./ContextMenu";
import { attachDateInputBehavior } from "../ui/dateInputBehavior";

export interface RecurrenceOption {
	label: string;
	value: string;
	icon?: string;
	anchor?: "scheduled" | "completion"; // NEW: Determines if recurrence is from scheduled date or completion date
}

export interface RecurrenceContextMenuOptions {
	currentValue?: string;
	currentAnchor?: "scheduled" | "completion";
	scheduledDate?: string; // Task's scheduled date to extract time from
	onSelect: (value: string | null, anchor?: "scheduled" | "completion") => void;
	app: App;
	plugin: TaskNotesPlugin;
}

export interface CustomRecurrenceRuleInput {
	frequency: string;
	interval: number;
	dtstart: string;
	dtstartTime: string;
	recurrenceAnchor: "scheduled" | "completion";
	byDay: string[];
	byMonthDay: number[];
	byMonth: number[];
	bySetPos: number | undefined;
	endType: "never" | "count" | "until";
	count: number | undefined;
	until: string;
	monthlyType?: string;
	yearlyType?: string;
}

type RecurrenceWeekdayCode = "SU" | "MO" | "TU" | "WE" | "TH" | "FR" | "SA";
type WeekdayNameKey =
	| "sunday"
	| "monday"
	| "tuesday"
	| "wednesday"
	| "thursday"
	| "friday"
	| "saturday";
type WeekdayShortKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

interface RecurrenceWeekdayDefinition {
	dateIndex: number;
	code: RecurrenceWeekdayCode;
	nameKey: WeekdayNameKey;
	shortKey: WeekdayShortKey;
}

interface MonthDayOption {
	value: string;
	text: string;
}

const RECURRENCE_WEEKDAYS: RecurrenceWeekdayDefinition[] = [
	{ dateIndex: 0, code: "SU", nameKey: "sunday", shortKey: "sun" },
	{ dateIndex: 1, code: "MO", nameKey: "monday", shortKey: "mon" },
	{ dateIndex: 2, code: "TU", nameKey: "tuesday", shortKey: "tue" },
	{ dateIndex: 3, code: "WE", nameKey: "wednesday", shortKey: "wed" },
	{ dateIndex: 4, code: "TH", nameKey: "thursday", shortKey: "thu" },
	{ dateIndex: 5, code: "FR", nameKey: "friday", shortKey: "fri" },
	{ dateIndex: 6, code: "SA", nameKey: "saturday", shortKey: "sat" },
];

function getIntlLocaleWeekInfo(locale: string | undefined):
	| {
			firstDay?: number;
			weekend?: number[];
	  }
	| undefined {
	if (!locale) {
		return undefined;
	}

	try {
		const LocaleCtor = (
			Intl as unknown as {
				Locale?: new (locale: string) => {
					weekInfo?: {
						firstDay?: number;
						weekend?: number[];
					};
				};
			}
		).Locale;

		if (!LocaleCtor) {
			return undefined;
		}

		return new LocaleCtor(locale).weekInfo;
	} catch {
		return undefined;
	}
}

function normalizeFirstDay(firstDay: number | undefined, locale?: string): number {
	if (typeof firstDay === "number" && Number.isInteger(firstDay) && firstDay >= 0 && firstDay <= 6) {
		return firstDay;
	}

	const localeFirstDay = getIntlLocaleWeekInfo(locale)?.firstDay;
	if (typeof localeFirstDay === "number") {
		return localeFirstDay % 7;
	}

	return 1;
}

export function getPluginCalendarLocale(plugin: TaskNotesPlugin): string | undefined {
	const configuredLocale = plugin.settings?.calendarViewSettings?.locale?.trim();
	if (configuredLocale) {
		return configuredLocale;
	}

	const navigatorLocale = typeof navigator !== "undefined" ? navigator.language : "";
	if (navigatorLocale) {
		return navigatorLocale;
	}

	try {
		return Intl.DateTimeFormat().resolvedOptions().locale;
	} catch {
		return undefined;
	}
}

export function getOrderedRecurrenceWeekdays(
	firstDay?: number,
	locale?: string
): RecurrenceWeekdayDefinition[] {
	const normalizedFirstDay = normalizeFirstDay(firstDay, locale);
	const startIndex = RECURRENCE_WEEKDAYS.findIndex(
		(day) => day.dateIndex === normalizedFirstDay
	);
	const safeStartIndex = startIndex >= 0 ? startIndex : 1;

	return [
		...RECURRENCE_WEEKDAYS.slice(safeStartIndex),
		...RECURRENCE_WEEKDAYS.slice(0, safeStartIndex),
	];
}

export function getWeekdayOnlyRRuleCodes(locale?: string): RecurrenceWeekdayCode[] {
	const weekendDayIndexes = getIntlLocaleWeekInfo(locale)?.weekend
		?.map((day) => day % 7)
		.filter((day) => day >= 0 && day <= 6);

	if (!weekendDayIndexes || weekendDayIndexes.length === 0) {
		return ["MO", "TU", "WE", "TH", "FR"];
	}

	const weekendSet = new Set(weekendDayIndexes);
	const weekdays = RECURRENCE_WEEKDAYS.filter((day) => !weekendSet.has(day.dateIndex)).map(
		(day) => day.code
	);

	return weekdays.length > 0 && weekdays.length < 7 ? weekdays : ["MO", "TU", "WE", "TH", "FR"];
}

export function buildWeekdaysOnlyRecurrenceRule(dtstart: string, locale?: string): string {
	return `DTSTART:${dtstart};FREQ=WEEKLY;BYDAY=${getWeekdayOnlyRRuleCodes(locale).join(",")}`;
}

export function buildCustomRecurrenceRule(input: CustomRecurrenceRuleInput): string {
	const parts: string[] = [];
	const isFlexibleCompletionAnchor = input.recurrenceAnchor === "completion";

	if (input.dtstart) {
		let dtstartFormatted = input.dtstart.replace(/-/g, "");

		if (input.dtstartTime) {
			const timeFormatted = input.dtstartTime.replace(":", "") + "00";
			dtstartFormatted = `${dtstartFormatted}T${timeFormatted}`;
		}

		parts.push(`DTSTART:${dtstartFormatted}`);
	}

	parts.push(`FREQ=${input.frequency}`);

	if (input.interval > 1) {
		parts.push(`INTERVAL=${input.interval}`);
	}

	switch (input.frequency) {
		case "DAILY":
			if (!isFlexibleCompletionAnchor && input.byDay.length > 0) {
				parts.push(`BYDAY=${input.byDay.join(",")}`);
			}
			break;

		case "WEEKLY":
			if (!isFlexibleCompletionAnchor && input.byDay.length > 0) {
				parts.push(`BYDAY=${input.byDay.join(",")}`);
			}
			break;

		case "MONTHLY":
			if (isFlexibleCompletionAnchor) {
				break;
			}

			if (input.monthlyType === "bydate") {
				const dayOfMonth =
					input.byMonthDay.length > 0 ? input.byMonthDay[0] : new Date().getDate();
				parts.push(`BYMONTHDAY=${dayOfMonth}`);
			} else if (input.monthlyType === "byday" && input.byDay.length > 0) {
				const setPos = input.bySetPos || 1;
				parts.push(`BYDAY=${setPos}${input.byDay[0]}`);
			}
			break;

		case "YEARLY":
			if (isFlexibleCompletionAnchor) {
				break;
			}

			if (input.yearlyType === "bydate") {
				const month = input.byMonth.length > 0 ? input.byMonth[0] : new Date().getMonth() + 1;
				const dayOfMonth =
					input.byMonthDay.length > 0 ? input.byMonthDay[0] : new Date().getDate();
				parts.push(`BYMONTH=${month}`);
				parts.push(`BYMONTHDAY=${dayOfMonth}`);
			} else if (input.yearlyType === "byday") {
				const month = input.byMonth.length > 0 ? input.byMonth[0] : new Date().getMonth() + 1;
				parts.push(`BYMONTH=${month}`);

				if (input.byDay.length > 0) {
					const setPos = input.bySetPos || 1;
					parts.push(`BYDAY=${setPos}${input.byDay[0]}`);
				}
			}
			break;
	}

	switch (input.endType) {
		case "count":
			if (input.count && input.count > 0) {
				parts.push(`COUNT=${input.count}`);
			}
			break;
		case "until":
			if (input.until) {
				parts.push(`UNTIL=${input.until.replace(/-/g, "")}`);
			}
			break;
	}

	return parts.join(";");
}

export function getMonthDayOptions(): MonthDayOption[] {
	return [
		...Array.from({ length: 31 }, (_, index) => {
			const day = index + 1;
			return {
				value: day.toString(),
				text: day.toString(),
			};
		}),
		{
			value: "-1",
			text: "Last day",
		},
	];
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
					const anchorValue = option.anchor || "scheduled";
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
		const calendarLocale = getPluginCalendarLocale(this.options.plugin);
		const dayName = today.toLocaleDateString(calendarLocale || undefined, { weekday: "long" });

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
			value: buildWeekdaysOnlyRecurrenceRule(todayDTSTART, calendarLocale),
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
			this.options.currentAnchor || "scheduled",
			this.options.scheduledDate,
			this.options.plugin,
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
	private plugin: TaskNotesPlugin;
	private onSubmit: (result: string | null, anchor?: "scheduled" | "completion") => void;
	private translate: (key: TranslationKey, vars?: Record<string, string>) => string;
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
	private recurrenceAnchor: "scheduled" | "completion" = "scheduled"; // NEW: Recurrence anchor

	constructor(
		app: App,
		currentValue: string,
		currentAnchor: "scheduled" | "completion",
		scheduledDate: string | undefined,
		plugin: TaskNotesPlugin,
		onSubmit: (result: string | null, anchor?: "scheduled" | "completion") => void
	) {
		super(app);
		this.currentValue = currentValue;
		this.recurrenceAnchor = currentAnchor;
		this.scheduledDate = scheduledDate;
		this.plugin = plugin;
		this.translate = plugin.i18n.translate.bind(plugin.i18n);
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
		const calendarLocale = getPluginCalendarLocale(this.plugin);
		const firstDay = this.plugin.settings?.calendarViewSettings?.firstDay;
		const orderedWeekdays = getOrderedRecurrenceWeekdays(firstDay, calendarLocale);

		contentEl.createEl("h2", {
			text: this.translate("components.recurrenceContextMenu.customRecurrenceModal.title"),
		});

		// Start date selection
		new Setting(contentEl)
			.setName("Start date")
			.setDesc("The date when the recurrence pattern begins")
			.addText((text) => {
				text.inputEl.type = "date";
				text.setValue(this.dtstart).onChange((value) => {
					this.dtstart = value;
				});
				attachDateInputBehavior(text.inputEl, {
					onCommit: (value) => {
						this.dtstart = value;
					},
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
					.addOption("scheduled", "Scheduled date (fixed schedule)")
					.addOption("completion", "Completion date (flexible schedule)")
					.setValue(this.recurrenceAnchor)
					.onChange((value) => {
						this.recurrenceAnchor = value as "scheduled" | "completion";
						this.updateFrequencySpecificVisibility();
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
			.setDesc("Select specific days (for daily or weekly recurrence)");

		const daysContainer = byDaySetting.controlEl.createDiv("days-container");
		const days = orderedWeekdays.map((day) => ({
			key: day.code,
			label: this.translate(
				`components.recurrenceContextMenu.customRecurrenceModal.weekdaysShort.${day.shortKey}`
			),
		}));

		days.forEach((day) => {
			const dayEl = daysContainer.createEl("label", { cls: "day-checkbox" });
			dayEl.classList.remove(
				"tn-static-display-block-2a1b75c9",
				"tn-static-display-flex-4d51fc62",
				"tn-static-display-flex-75816cae",
				"tn-static-display-flex-8bb39979",
				"tn-static-display-inline-cccfa456",
				"tn-static-display-inline-flex-f984c520",
				"tn-static-display-none-6b99de8b",
				"tn-static-min-height-800px-997b4c8c"
			);
			dayEl.classList.add("tn-static-display-inline-block-60e32dcb");
			dayEl.classList.remove("tn-static-margin-right-4px-c6b76b85");
			dayEl.classList.add("tn-static-margin-right-8px-539fa9a0");

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
		monthlyByDateRadio.classList.remove(
			"tn-static-display-flex-4d51fc62",
			"tn-static-display-flex-75816cae",
			"tn-static-display-flex-8bb39979",
			"tn-static-display-inline-block-60e32dcb",
			"tn-static-display-inline-cccfa456",
			"tn-static-display-inline-flex-f984c520",
			"tn-static-display-none-6b99de8b",
			"tn-static-min-height-800px-997b4c8c"
		);
		monthlyByDateRadio.classList.add("tn-static-display-block-2a1b75c9");
		monthlyByDateRadio.classList.remove(
			"tn-static-font-size-12px-65574819",
			"tn-static-font-weight-bold-0fe8c30d",
			"tn-static-font-weight-bold-e0b452bd",
			"tn-static-margin-bottom-0-75rem-c05a3c6e",
			"tn-static-margin-bottom-20px-49f14f8f"
		);
		monthlyByDateRadio.classList.add("tn-static-margin-bottom-8px-fdf33f23");
		const monthlyByDateInput = monthlyByDateRadio.createEl("input", {
			type: "radio",
			value: "bydate",
		});
		monthlyByDateInput.name = "monthly-type";
		monthlyByDateInput.checked =
			this.byMonthDay.length > 0 || (this.byDay.length === 0 && this.bySetPos === undefined);
		monthlyByDateRadio.createSpan({ text: " On " });

		const monthlyDateSelect = monthlyByDateRadio.createEl("select");
		monthlyDateSelect.classList.add("tn-static-margin-left-4px-46cec891");
		monthlyDateSelect.classList.remove("tn-static-margin-right-8px-539fa9a0");
		monthlyDateSelect.classList.add("tn-static-margin-right-4px-c6b76b85");
		for (const dayOption of getMonthDayOptions()) {
			const option = monthlyDateSelect.createEl("option", {
				value: dayOption.value,
				text: dayOption.text,
			});
			const dayValue = parseInt(dayOption.value, 10);
			if (this.byMonthDay.length > 0 && this.byMonthDay[0] === dayValue) {
				option.selected = true;
			} else if (this.byMonthDay.length === 0 && dayValue === new Date().getDate()) {
				option.selected = true;
			}
		}
		monthlyByDateRadio.createSpan({ text: " of each month" });

		const monthlyByDayRadio = monthlyTypeContainer.createEl("label", { cls: "radio-option" });
		monthlyByDayRadio.classList.remove(
			"tn-static-display-flex-4d51fc62",
			"tn-static-display-flex-75816cae",
			"tn-static-display-flex-8bb39979",
			"tn-static-display-inline-block-60e32dcb",
			"tn-static-display-inline-cccfa456",
			"tn-static-display-inline-flex-f984c520",
			"tn-static-display-none-6b99de8b",
			"tn-static-min-height-800px-997b4c8c"
		);
		monthlyByDayRadio.classList.add("tn-static-display-block-2a1b75c9");
		monthlyByDayRadio.classList.remove(
			"tn-static-font-size-12px-65574819",
			"tn-static-font-weight-bold-0fe8c30d",
			"tn-static-font-weight-bold-e0b452bd",
			"tn-static-margin-bottom-0-75rem-c05a3c6e",
			"tn-static-margin-bottom-20px-49f14f8f"
		);
		monthlyByDayRadio.classList.add("tn-static-margin-bottom-8px-fdf33f23");
		const monthlyByDayInput = monthlyByDayRadio.createEl("input", {
			type: "radio",
			value: "byday",
		});
		monthlyByDayInput.name = "monthly-type";
		monthlyByDayInput.checked = this.byDay.length > 0 && this.bySetPos !== undefined;
		monthlyByDayRadio.createSpan({ text: " On the " });

		const monthlyWeekSelect = monthlyByDayRadio.createEl("select");
		monthlyWeekSelect.classList.add("tn-static-margin-left-4px-46cec891");
		monthlyWeekSelect.classList.remove("tn-static-margin-right-8px-539fa9a0");
		monthlyWeekSelect.classList.add("tn-static-margin-right-4px-c6b76b85");
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
		monthlyDaySelect.classList.add("tn-static-margin-left-4px-46cec891");
		monthlyDaySelect.classList.remove("tn-static-margin-right-8px-539fa9a0");
		monthlyDaySelect.classList.add("tn-static-margin-right-4px-c6b76b85");
		const dayOptions = orderedWeekdays.map((day) => ({
			value: day.code,
			text: this.translate(
				`components.recurrenceContextMenu.customRecurrenceModal.weekdays.${day.nameKey}`
			),
		}));
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
		yearlyByDateRadio.classList.remove(
			"tn-static-display-flex-4d51fc62",
			"tn-static-display-flex-75816cae",
			"tn-static-display-flex-8bb39979",
			"tn-static-display-inline-block-60e32dcb",
			"tn-static-display-inline-cccfa456",
			"tn-static-display-inline-flex-f984c520",
			"tn-static-display-none-6b99de8b",
			"tn-static-min-height-800px-997b4c8c"
		);
		yearlyByDateRadio.classList.add("tn-static-display-block-2a1b75c9");
		yearlyByDateRadio.classList.remove(
			"tn-static-font-size-12px-65574819",
			"tn-static-font-weight-bold-0fe8c30d",
			"tn-static-font-weight-bold-e0b452bd",
			"tn-static-margin-bottom-0-75rem-c05a3c6e",
			"tn-static-margin-bottom-20px-49f14f8f"
		);
		yearlyByDateRadio.classList.add("tn-static-margin-bottom-8px-fdf33f23");
		const yearlyByDateInput = yearlyByDateRadio.createEl("input", {
			type: "radio",
			value: "bydate",
		});
		yearlyByDateInput.name = "yearly-type";
		yearlyByDateInput.checked =
			this.byMonthDay.length > 0 || (this.byDay.length === 0 && this.bySetPos === undefined);
		yearlyByDateRadio.createSpan({ text: " On " });

		const yearlyMonthSelect = yearlyByDateRadio.createEl("select");
		yearlyMonthSelect.classList.add("tn-static-margin-left-4px-46cec891");
		yearlyMonthSelect.classList.remove("tn-static-margin-right-8px-539fa9a0");
		yearlyMonthSelect.classList.add("tn-static-margin-right-4px-c6b76b85");
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
		yearlyDateSelect.classList.add("tn-static-margin-left-4px-46cec891");
		yearlyDateSelect.classList.remove("tn-static-margin-right-8px-539fa9a0");
		yearlyDateSelect.classList.add("tn-static-margin-right-4px-c6b76b85");
		for (const dayOption of getMonthDayOptions()) {
			const option = yearlyDateSelect.createEl("option", {
				value: dayOption.value,
				text: dayOption.text,
			});
			const dayValue = parseInt(dayOption.value, 10);
			if (this.byMonthDay.length > 0 && this.byMonthDay[0] === dayValue) {
				option.selected = true;
			} else if (this.byMonthDay.length === 0 && dayValue === new Date().getDate()) {
				option.selected = true;
			}
		}
		yearlyByDateRadio.createSpan({ text: " each year" });

		const yearlyByDayRadio = yearlyTypeContainer.createEl("label", { cls: "radio-option" });
		yearlyByDayRadio.classList.remove(
			"tn-static-display-flex-4d51fc62",
			"tn-static-display-flex-75816cae",
			"tn-static-display-flex-8bb39979",
			"tn-static-display-inline-block-60e32dcb",
			"tn-static-display-inline-cccfa456",
			"tn-static-display-inline-flex-f984c520",
			"tn-static-display-none-6b99de8b",
			"tn-static-min-height-800px-997b4c8c"
		);
		yearlyByDayRadio.classList.add("tn-static-display-block-2a1b75c9");
		yearlyByDayRadio.classList.remove(
			"tn-static-font-size-12px-65574819",
			"tn-static-font-weight-bold-0fe8c30d",
			"tn-static-font-weight-bold-e0b452bd",
			"tn-static-margin-bottom-0-75rem-c05a3c6e",
			"tn-static-margin-bottom-20px-49f14f8f"
		);
		yearlyByDayRadio.classList.add("tn-static-margin-bottom-8px-fdf33f23");
		const yearlyByDayInput = yearlyByDayRadio.createEl("input", {
			type: "radio",
			value: "byday",
		});
		yearlyByDayInput.name = "yearly-type";
		yearlyByDayInput.checked = this.byDay.length > 0 && this.bySetPos !== undefined;
		yearlyByDayRadio.createSpan({ text: " On the " });

		const yearlyWeekSelect = yearlyByDayRadio.createEl("select");
		yearlyWeekSelect.classList.add("tn-static-margin-left-4px-46cec891");
		yearlyWeekSelect.classList.remove("tn-static-margin-right-8px-539fa9a0");
		yearlyWeekSelect.classList.add("tn-static-margin-right-4px-c6b76b85");
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
		yearlyDaySelect.classList.add("tn-static-margin-left-4px-46cec891");
		yearlyDaySelect.classList.remove("tn-static-margin-right-8px-539fa9a0");
		yearlyDaySelect.classList.add("tn-static-margin-right-4px-c6b76b85");
		dayOptions.forEach((opt) => {
			const option = yearlyDaySelect.createEl("option", { value: opt.value, text: opt.text });
			if (this.byDay.length > 0 && this.byDay[0] === opt.value) {
				option.selected = true;
			} else if (this.byDay.length === 0 && opt.value === currentDayCode) {
				option.selected = true;
			}
		});

		const yearlyByDayMonthSelect = yearlyByDayRadio.createEl("select");
		yearlyByDayMonthSelect.classList.add("tn-static-margin-left-4px-46cec891");
		yearlyByDayMonthSelect.classList.remove("tn-static-margin-right-8px-539fa9a0");
		yearlyByDayMonthSelect.classList.add("tn-static-margin-right-4px-c6b76b85");
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
		neverRadio.classList.remove(
			"tn-static-display-flex-4d51fc62",
			"tn-static-display-flex-75816cae",
			"tn-static-display-flex-8bb39979",
			"tn-static-display-inline-block-60e32dcb",
			"tn-static-display-inline-cccfa456",
			"tn-static-display-inline-flex-f984c520",
			"tn-static-display-none-6b99de8b",
			"tn-static-min-height-800px-997b4c8c"
		);
		neverRadio.classList.add("tn-static-display-block-2a1b75c9");
		neverRadio.classList.remove(
			"tn-static-font-size-12px-65574819",
			"tn-static-font-weight-bold-0fe8c30d",
			"tn-static-font-weight-bold-e0b452bd",
			"tn-static-margin-bottom-0-75rem-c05a3c6e",
			"tn-static-margin-bottom-20px-49f14f8f"
		);
		neverRadio.classList.add("tn-static-margin-bottom-8px-fdf33f23");
		const neverInput = neverRadio.createEl("input", { type: "radio", value: "never" });
		neverInput.name = "end-type";
		neverInput.checked = this.endType === "never";
		neverRadio.createSpan({ text: " Never ends" });

		// End after X occurrences
		const countRadio = endConditionContainer.createEl("label", { cls: "radio-option" });
		countRadio.classList.remove(
			"tn-static-display-flex-4d51fc62",
			"tn-static-display-flex-75816cae",
			"tn-static-display-flex-8bb39979",
			"tn-static-display-inline-block-60e32dcb",
			"tn-static-display-inline-cccfa456",
			"tn-static-display-inline-flex-f984c520",
			"tn-static-display-none-6b99de8b",
			"tn-static-min-height-800px-997b4c8c"
		);
		countRadio.classList.add("tn-static-display-block-2a1b75c9");
		countRadio.classList.remove(
			"tn-static-font-size-12px-65574819",
			"tn-static-font-weight-bold-0fe8c30d",
			"tn-static-font-weight-bold-e0b452bd",
			"tn-static-margin-bottom-0-75rem-c05a3c6e",
			"tn-static-margin-bottom-20px-49f14f8f"
		);
		countRadio.classList.add("tn-static-margin-bottom-8px-fdf33f23");
		const countInput = countRadio.createEl("input", { type: "radio", value: "count" });
		countInput.name = "end-type";
		countInput.checked = this.endType === "count";
		countRadio.createSpan({ text: " End after " });
		const countText = countRadio.createEl("input", { type: "number", placeholder: "10" });
		countText.classList.remove(
			"tn-static-width-100-0466783d",
			"tn-static-width-12px-fbf353fb",
			"tn-static-width-16px-7375d50b",
			"tn-static-width-1px-aa77e27e",
			"tn-static-width-200px-2acaf3b5",
			"tn-static-width-80px-8573bae3"
		);
		countText.classList.add("tn-static-width-60px-bd09c419");
		countText.classList.add("tn-static-margin-left-4px-46cec891");
		countText.classList.remove("tn-static-margin-right-8px-539fa9a0");
		countText.classList.add("tn-static-margin-right-4px-c6b76b85");
		countText.value = this.count ? this.count.toString() : "";
		countRadio.createSpan({ text: " occurrences" });

		// End on date
		const untilRadio = endConditionContainer.createEl("label", { cls: "radio-option" });
		untilRadio.classList.remove(
			"tn-static-display-flex-4d51fc62",
			"tn-static-display-flex-75816cae",
			"tn-static-display-flex-8bb39979",
			"tn-static-display-inline-block-60e32dcb",
			"tn-static-display-inline-cccfa456",
			"tn-static-display-inline-flex-f984c520",
			"tn-static-display-none-6b99de8b",
			"tn-static-min-height-800px-997b4c8c"
		);
		untilRadio.classList.add("tn-static-display-block-2a1b75c9");
		untilRadio.classList.remove(
			"tn-static-font-size-12px-65574819",
			"tn-static-font-weight-bold-0fe8c30d",
			"tn-static-font-weight-bold-e0b452bd",
			"tn-static-margin-bottom-0-75rem-c05a3c6e",
			"tn-static-margin-bottom-20px-49f14f8f"
		);
		untilRadio.classList.add("tn-static-margin-bottom-8px-fdf33f23");
		const untilInput = untilRadio.createEl("input", { type: "radio", value: "until" });
		untilInput.name = "end-type";
		untilInput.checked = this.endType === "until";
		untilRadio.createSpan({ text: " End on " });
		const untilDate = untilRadio.createEl("input", { type: "date" });
		untilDate.classList.add("tn-static-margin-left-4px-46cec891");
		untilDate.value = this.until ? this.until.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3") : "";
		attachDateInputBehavior(untilDate, {
			onCommit: (value) => {
				this.until = value.replace(/-/g, "");
				untilInput.checked = true;
				this.endType = "until";
			},
		});

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
			const useFlexibleInterval = this.recurrenceAnchor === "completion";
			byDaySetting.settingEl.style.display =
				(this.frequency === "DAILY" || this.frequency === "WEEKLY") &&
				!useFlexibleInterval
					? "flex"
					: "none";
			monthlyTypeSetting.settingEl.style.display =
				this.frequency === "MONTHLY" && !useFlexibleInterval ? "flex" : "none";
			yearlyTypeSetting.settingEl.style.display =
				this.frequency === "YEARLY" && !useFlexibleInterval ? "flex" : "none";
		};
		this.updateFrequencySpecificVisibility();

		// Buttons
		const buttonContainer = contentEl.createDiv("button-container");
		buttonContainer.classList.remove(
			"tn-static-display-block-2a1b75c9",
			"tn-static-display-flex-4d51fc62",
			"tn-static-display-flex-8bb39979",
			"tn-static-display-inline-block-60e32dcb",
			"tn-static-display-inline-cccfa456",
			"tn-static-display-inline-flex-f984c520",
			"tn-static-display-none-6b99de8b",
			"tn-static-min-height-800px-997b4c8c"
		);
		buttonContainer.classList.add("tn-static-display-flex-75816cae");
		buttonContainer.classList.remove(
			"tn-static-justify-content-center-03c4bb6f",
			"tn-static-justify-content-space-between-a562f4fd"
		);
		buttonContainer.classList.add("tn-static-justify-content-flex-end-455f8cca");
		buttonContainer.classList.remove(
			"tn-static-display-flex-8bb39979",
			"tn-static-gap-0-5rem-ce2fca4d",
			"tn-static-gap-10px-f3d7ce77",
			"tn-static-gap-12px-ed7b3d87",
			"tn-static-gap-6px-f0abc1db"
		);
		buttonContainer.classList.add("tn-static-gap-8px-33fcd4c3");
		buttonContainer.classList.remove(
			"tn-static-font-size-12px-b0cc7e05",
			"tn-static-margin-top-0-5rem-3dc98b5e",
			"tn-static-margin-top-0-d462248a",
			"tn-static-margin-top-12px-91e0f558",
			"tn-static-margin-top-1rem-2239d6d5",
			"tn-static-margin-top-20px-a26bda7d",
			"tn-static-margin-top-30px-2fbbbcd4",
			"tn-static-margin-top-4px-96ad6099",
			"tn-static-margin-top-8px-8a77e5a3",
			"tn-static-margin-top-8px-f4f01e68"
		);
		buttonContainer.classList.add("tn-static-margin-top-16px-1b0f4999");

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
		return buildCustomRecurrenceRule({
			frequency: this.frequency,
			interval: this.interval,
			dtstart: this.dtstart,
			dtstartTime: this.dtstartTime,
			recurrenceAnchor: this.recurrenceAnchor,
			byDay: this.byDay,
			byMonthDay: this.byMonthDay,
			byMonth: this.byMonth,
			bySetPos: this.bySetPos,
			endType: this.endType,
			count: this.count,
			until: this.until,
			monthlyType,
			yearlyType,
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
