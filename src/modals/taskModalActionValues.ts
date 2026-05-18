import type { PriorityConfig, StatusConfig } from "../types";

const WEEKDAY_NAMES: Record<string, string> = {
	SU: "Sunday",
	MO: "Monday",
	TU: "Tuesday",
	WE: "Wednesday",
	TH: "Thursday",
	FR: "Friday",
	SA: "Saturday",
};

const MONTH_NAMES = [
	"",
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

export function getDefaultTaskModalStatus(
	statusConfigs: readonly StatusConfig[] | undefined
): string {
	if (!statusConfigs || statusConfigs.length === 0) {
		return "open";
	}

	const sortedStatuses = [...statusConfigs].sort((a, b) => a.order - b.order);
	return sortedStatuses[0].value;
}

export function getDefaultTaskModalPriority(
	priorityConfigs: readonly PriorityConfig[] | undefined
): string {
	if (!priorityConfigs || priorityConfigs.length === 0) {
		return "normal";
	}

	const sortedPriorities = [...priorityConfigs].sort((a, b) => a.weight - b.weight);
	return sortedPriorities[0].value;
}

export function getTaskModalRecurrenceDisplayText(recurrenceRule: string): string {
	if (!recurrenceRule) return "";

	if (recurrenceRule.includes("FREQ=DAILY")) {
		return "Daily";
	}
	if (recurrenceRule.includes("FREQ=WEEKLY")) {
		return getWeeklyRecurrenceDisplayText(recurrenceRule);
	}
	if (recurrenceRule.includes("FREQ=MONTHLY")) {
		return getMonthlyRecurrenceDisplayText(recurrenceRule);
	}
	if (recurrenceRule.includes("FREQ=YEARLY")) {
		return getYearlyRecurrenceDisplayText(recurrenceRule);
	}

	return `Custom${getRecurrenceEndText(recurrenceRule)}`;
}

export function getOrdinal(value: number): string {
	const suffixes = ["th", "st", "nd", "rd"];
	const remainder = value % 100;
	return value + (suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0]);
}

function getWeeklyRecurrenceDisplayText(rule: string): string {
	if (rule.includes("INTERVAL=2")) {
		return "Every 2 weeks";
	}
	if (rule.includes("BYDAY=MO,TU,WE,TH,FR")) {
		return "Weekdays";
	}
	if (!rule.includes("BYDAY=")) {
		return "Weekly";
	}

	const dayMatch = rule.match(/BYDAY=([A-Z]{2})/);
	if (!dayMatch) {
		return "Weekly";
	}

	return `Weekly on ${WEEKDAY_NAMES[dayMatch[1]] || dayMatch[1]}`;
}

function getMonthlyRecurrenceDisplayText(rule: string): string {
	if (rule.includes("INTERVAL=3")) {
		return "Every 3 months";
	}
	if (rule.includes("BYMONTHDAY=")) {
		const dayMatch = rule.match(/BYMONTHDAY=(\d+)/);
		if (dayMatch) {
			return `Monthly on the ${getOrdinal(Number.parseInt(dayMatch[1], 10))}`;
		}
		return "Monthly";
	}
	if (rule.includes("BYDAY=")) {
		return "Monthly (by weekday)";
	}
	return "Monthly";
}

function getYearlyRecurrenceDisplayText(rule: string): string {
	if (rule.includes("BYMONTH=") && rule.includes("BYMONTHDAY=")) {
		const monthMatch = rule.match(/BYMONTH=(\d+)/);
		const dayMatch = rule.match(/BYMONTHDAY=(\d+)/);
		if (monthMatch && dayMatch) {
			const month = MONTH_NAMES[Number.parseInt(monthMatch[1], 10)];
			const day = getOrdinal(Number.parseInt(dayMatch[1], 10));
			return `Yearly on ${month} ${day}`;
		}
	}
	return "Yearly";
}

function getRecurrenceEndText(rule: string): string {
	if (rule.includes("COUNT=")) {
		const countMatch = rule.match(/COUNT=(\d+)/);
		return countMatch ? ` (${countMatch[1]} times)` : "";
	}

	if (rule.includes("UNTIL=")) {
		const untilMatch = rule.match(/UNTIL=(\d{8})/);
		if (untilMatch) {
			const date = untilMatch[1];
			return ` (until ${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)})`;
		}
	}

	return "";
}
