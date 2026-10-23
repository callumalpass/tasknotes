import { msg } from "@lingui/core/macro";
import { uiLocale, uiText } from "./runtime";

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export function recurrenceOrdinal(day: number): string {
	return uiText(msg({ message: "{day, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}", context: "recurrence ordinal number" }), { day });
}

export function recurrenceMonthlyOn(day: number, interval = 1): string {
	if (interval === 1) return uiText(msg({ message: "{day, selectordinal, one {Monthly on the #st} two {Monthly on the #nd} few {Monthly on the #rd} other {Monthly on the #th}}", context: "recurrence monthly date" }), { day });
	return uiText(msg({ message: "{interval, plural, one {Monthly on day {day, number}} other {Every # months on day {day, number}}}", context: "recurrence interval on month day" }), { interval, day });
}

export function recurrenceYearlyOn(month: number, day: number): string {
	const monthName = new Intl.DateTimeFormat(uiLocale(), { month: "long" }).format(new Date(2024, month - 1, 1));
	return uiText(msg({ message: "{day, selectordinal, one {Yearly on {month} #st} two {Yearly on {month} #nd} few {Yearly on {month} #rd} other {Yearly on {month} #th}}", context: "recurrence yearly date" }), { month: monthName, day });
}

/** Plugin presentation adapter: the shared model deliberately exposes English RRule.toText(). */
export function recurrenceDisplayText(rule: string): string {
	if (!rule) return "";
	const properties: Record<string, string | undefined> = Object.fromEntries(rule.replace(/DTSTART:[^;]+;?/, "").split(";").map(part => part.split("=")));
	const interval = Math.max(1, Number(properties.INTERVAL) || 1);
	const day = Number(properties.BYMONTHDAY);
	const month = Number(properties.BYMONTH);
	const days = properties.BYDAY?.split(",") ?? [];
	const weekdays = days.map(token => {
		const index = WEEKDAYS.indexOf(token);
		return index === -1 ? token : new Intl.DateTimeFormat(uiLocale(), { weekday: "long" }).format(new Date(2024, 0, 7 + index));
	});
	const weekdayList = new Intl.ListFormat(uiLocale(), { type: "conjunction" }).format(weekdays);
	let summary: string;
	if (properties.FREQ === "DAILY") {
		summary = uiText(msg({ message: "{interval, plural, one {Daily} other {Every # days}}", context: "recurrence daily interval" }), { interval });
	} else if (properties.FREQ === "WEEKLY" && properties.BYDAY === "MO,TU,WE,TH,FR" && interval === 1) {
		summary = uiText(msg({ message: "Weekdays", context: "recurrence weekdays" }));
	} else if (properties.FREQ === "WEEKLY" && weekdayList) {
		summary = uiText(msg({ message: "{interval, plural, one {Weekly on {days}} other {Every # weeks on {days}}}", context: "recurrence weekly weekdays" }), { interval, days: weekdayList });
	} else if (properties.FREQ === "WEEKLY") {
		summary = uiText(msg({ message: "{interval, plural, one {Weekly} other {Every # weeks}}", context: "recurrence weekly interval" }), { interval });
	} else if (properties.FREQ === "MONTHLY" && day >= 1 && day <= 31) {
		summary = recurrenceMonthlyOn(day, interval);
	} else if (properties.FREQ === "MONTHLY" && !properties.BYDAY) {
		summary = uiText(msg({ message: "{interval, plural, one {Monthly} other {Every # months}}", context: "recurrence monthly interval" }), { interval });
	} else if (properties.FREQ === "YEARLY" && month >= 1 && month <= 12 && day >= 1 && day <= 31 && interval === 1) {
		summary = recurrenceYearlyOn(month, day);
	} else if (properties.FREQ === "YEARLY" && !properties.BYMONTH && !properties.BYMONTHDAY) {
		summary = uiText(msg({ message: "{interval, plural, one {Yearly} other {Every # years}}", context: "recurrence yearly interval" }), { interval });
	} else {
		// Preserve full custom-rule detail as immutable data rather than returning English NLP.
		summary = uiText(msg({ message: "Custom recurrence: {rule}", context: "recurrence custom rule" }), { rule });
	}
	if (properties.COUNT && Number(properties.COUNT) > 0) {
		return uiText(msg({ message: "{count, plural, one {{recurrence} (# time)} other {{recurrence} (# times)}}", context: "recurrence occurrence limit" }), { count: Number(properties.COUNT), recurrence: summary });
	}
	const until = properties.UNTIL?.match(/^(\d{4})(\d{2})(\d{2})/);
	if (until) {
		const date = new Intl.DateTimeFormat(uiLocale(), { dateStyle: "medium" }).format(new Date(Number(until[1]), Number(until[2]) - 1, Number(until[3])));
		return uiText(msg({ message: "{recurrence} (until {date})", context: "recurrence end date" }), { recurrence: summary, date });
	}
	return summary;
}
