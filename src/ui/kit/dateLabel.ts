import { parseVaultISO, vaultDate } from "../../utils/vaultTime";
import { differenceInCalendarDays, isValid } from "date-fns";
import { msg } from "@lingui/core/macro";
import { uiText } from "../../i18n/runtime";
import { formatDateTimeForDisplay, getDatePart } from "../../utils/dateUtils";
import { isOverdueTimeAware, isTodayTimeAware } from "../../utils/dateUtils";

export function taskDueUrgency(
	value: string | undefined,
	completed = false,
	hideCompleted = true
): "overdue" | "today" | "neutral" {
	if (!value) return "neutral";
	if (isOverdueTimeAware(value, completed, hideCompleted)) return "overdue";
	return isTodayTimeAware(value) ? "today" : "neutral";
}

export type RelativeDay = "today" | "tomorrow" | "yesterday" | null;

/** Near dates read as words. Everything else keeps its calendar format. */
export function relativeDay(dateValue: string, now: Date = vaultDate()): RelativeDay {
	const date = parseVaultISO(getDatePart(dateValue));
	if (!isValid(date)) return null;

	const offset = differenceInCalendarDays(date, vaultDate(now));
	if (offset === 0) return "today";
	if (offset === 1) return "tomorrow";
	if (offset === -1) return "yesterday";
	return null;
}

export const relativeDayLabels = {
	today: msg({ message: "Today", context: "ui.taskCard.relativeDay" }),
	tomorrow: msg({ message: "Tomorrow", context: "ui.taskCard.relativeDay" }),
	yesterday: msg({ message: "Yesterday", context: "ui.taskCard.relativeDay" }),
};

export function taskDateLabel(
	dateValue: string,
	timeFormat?: "12" | "24",
	now = vaultDate()
): string {
	const relative = relativeDay(dateValue, now);
	const day = relative
		? uiText(relativeDayLabels[relative])
		: formatDateTimeForDisplay(dateValue, {
				dateFormat:
					Number(getDatePart(dateValue).slice(0, 4)) === vaultDate(now).getFullYear() ? "MMM d" : "MMM d, yyyy",
				showTime: false,
			});
	const time = formatDateTimeForDisplay(dateValue, {
		dateFormat: "",
		showTime: true,
		userTimeFormat: timeFormat,
	}).trim();
	return time ? `${day} ${time}` : day;
}
