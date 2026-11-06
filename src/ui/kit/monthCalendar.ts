import { setIcon } from "obsidian";
import { msg } from "@lingui/core/macro";
import { uiText } from "../../i18n/runtime";
import {
	generateUTCCalendarDates,
	getUTCEndOfMonth,
	getUTCEndOfWeek,
	getUTCStartOfMonth,
	getUTCStartOfWeek,
} from "../../utils/dateUtils";

export function renderMonthCalendar(container: HTMLElement, options: {
	month: Date;
	locale: string;
	monthFormat?: "short" | "long";
	firstDay: number;
	onNavigate: (month: Date) => void;
	renderDay: (grid: HTMLElement, day: Date) => void;
}): void {
	container.empty();
	container.addClass("tn-month-calendar");
	const header = container.createDiv({ cls: "tn-month-calendar__header recurring-calendar__header" });
	const previous = header.createEl("button", {
		cls: "tn-btn tn-btn--icon tn-btn--ghost recurring-calendar__nav",
		attr: { type: "button", "aria-label": uiText(msg({ message: "Previous month", context: "modals.taskEdit.previousMonth" })) },
	});
	setIcon(previous, "chevron-left");
	header.createSpan({
		cls: "tn-month-calendar__month recurring-calendar__month",
		text: new Intl.DateTimeFormat(options.locale, { month: options.monthFormat ?? "short", year: "numeric", timeZone: "UTC" }).format(options.month),
		attr: { "aria-live": "polite" },
	});
	const next = header.createEl("button", {
		cls: "tn-btn tn-btn--icon tn-btn--ghost recurring-calendar__nav",
		attr: { type: "button", "aria-label": uiText(msg({ message: "Next month", context: "components.dateContextMenu.nextMonth" })) },
	});
	setIcon(next, "chevron-right");
	const grid = container.createDiv({ cls: "tn-month-calendar__grid recurring-calendar__grid" });
	const start = getUTCStartOfWeek(getUTCStartOfMonth(options.month), options.firstDay);
	const end = getUTCEndOfWeek(getUTCEndOfMonth(options.month), options.firstDay);
	for (let index = 0; index < 7; index++) {
		const day = new Date(start);
		day.setUTCDate(day.getUTCDate() + index);
		grid.createSpan({ cls: "tn-month-calendar__weekday", text: new Intl.DateTimeFormat(options.locale, { weekday: "short", timeZone: "UTC" }).format(day) });
	}
	for (const day of generateUTCCalendarDates(start, end)) options.renderDay(grid, day);
	const navigate = (offset: number) => {
		options.onNavigate(new Date(Date.UTC(options.month.getUTCFullYear(), options.month.getUTCMonth() + offset, 1)));
		container.querySelector<HTMLButtonElement>(offset < 0 ? ".tn-month-calendar__header button:first-child" : ".tn-month-calendar__header button:last-child")?.focus();
	};
	previous.addEventListener("click", () => navigate(-1));
	next.addEventListener("click", () => navigate(1));
}
