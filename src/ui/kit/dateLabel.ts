import { differenceInCalendarDays, isValid, parseISO } from "date-fns";
import { msg } from "@lingui/core/macro";
import { uiText } from "../../i18n/runtime";
import { formatDateTimeForDisplay } from "../../utils/dateUtils";

export type RelativeDay = "today" | "tomorrow" | "yesterday" | null;

/** Near dates read as words. Everything else keeps its calendar format. */
export function relativeDay(dateValue: string, now: Date = new Date()): RelativeDay {
	const date = parseISO(dateValue.slice(0, 10));
	if (!isValid(date)) return null;

	const offset = differenceInCalendarDays(date, now);
	if (offset === 0) return "today";
	if (offset === 1) return "tomorrow";
	if (offset === -1) return "yesterday";
	return null;
}

const labels = {
	today: msg({ message: "Today", context: "ui.taskCard.relativeDay" }),
	tomorrow: msg({ message: "Tomorrow", context: "ui.taskCard.relativeDay" }),
	yesterday: msg({ message: "Yesterday", context: "ui.taskCard.relativeDay" }),
};

export function taskDateLabel(
	dateValue: string,
	timeFormat?: "12" | "24",
	now = new Date()
): string {
	const relative = relativeDay(dateValue, now);
	const day = relative
		? uiText(labels[relative])
		: formatDateTimeForDisplay(dateValue, {
				dateFormat:
					Number(dateValue.slice(0, 4)) === now.getFullYear() ? "MMM d" : "MMM d, yyyy",
				showTime: false,
			});
	const time = formatDateTimeForDisplay(dateValue, {
		dateFormat: "",
		showTime: true,
		userTimeFormat: timeFormat,
	}).trim();
	return time ? `${day} ${time}` : day;
}
