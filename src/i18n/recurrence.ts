import { msg } from "@lingui/core/macro";
import { uiLocale, uiText } from "./runtime";
import { uiData } from "./dataText";

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export function recurrenceOrdinal(day: number): string {
	return uiText(msg({ message: "{day, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}", context: "recurrence ordinal number" }), { day });
}

export function recurrenceMonthlyOn(day: number, interval = 1): string {
	if (interval === 1) return uiText(msg({ message: "{day, selectordinal, one {Monthly on the #st} two {Monthly on the #nd} few {Monthly on the #rd} other {Monthly on the #th}}", context: "recurrence monthly date" }), { day });
	return uiText(msg({ message: "{interval, plural, one {Monthly on day {day, number}} other {Every # months on day {day, number}}}", context: "recurrence interval on month day" }), { interval, day });
}

export function recurrenceYearlyOn(month: number, day: number, interval = 1): string {
	// Format month and day together: Russian and other locales need the contextual
	// month case, which a standalone month-name parameter cannot provide.
	const date = new Intl.DateTimeFormat(uiLocale(), { month: "long", day: "numeric" }).format(new Date(2024, month - 1, day));
	if (interval === 1) return uiText(msg({ message: "Yearly on {date}", context: "recurrence yearly date" }), { date });
	return uiText(msg({ message: "{interval, plural, one {Yearly on {date}} other {Every # years on {date}}}", context: "recurrence yearly interval date" }), { interval, date });
}

function monthlyWeekday(position: number, weekday: string, interval: number): string {
	// Translators: keep MO..SU and last/every/other select keys. Each weekday arm
	// owns the full phrase, allowing gender/case agreement for ordinal weekdays.
	return uiText(msg({ message: "{interval, plural, one {{weekday, select, MO {{position, select, last {Monthly on the last Monday} every {Monthly on every Monday} other {{index, selectordinal, one {Monthly on the #st Monday} two {Monthly on the #nd Monday} few {Monthly on the #rd Monday} other {Monthly on the #th Monday}}}}} TU {{position, select, last {Monthly on the last Tuesday} every {Monthly on every Tuesday} other {{index, selectordinal, one {Monthly on the #st Tuesday} two {Monthly on the #nd Tuesday} few {Monthly on the #rd Tuesday} other {Monthly on the #th Tuesday}}}}} WE {{position, select, last {Monthly on the last Wednesday} every {Monthly on every Wednesday} other {{index, selectordinal, one {Monthly on the #st Wednesday} two {Monthly on the #nd Wednesday} few {Monthly on the #rd Wednesday} other {Monthly on the #th Wednesday}}}}} TH {{position, select, last {Monthly on the last Thursday} every {Monthly on every Thursday} other {{index, selectordinal, one {Monthly on the #st Thursday} two {Monthly on the #nd Thursday} few {Monthly on the #rd Thursday} other {Monthly on the #th Thursday}}}}} FR {{position, select, last {Monthly on the last Friday} every {Monthly on every Friday} other {{index, selectordinal, one {Monthly on the #st Friday} two {Monthly on the #nd Friday} few {Monthly on the #rd Friday} other {Monthly on the #th Friday}}}}} SA {{position, select, last {Monthly on the last Saturday} every {Monthly on every Saturday} other {{index, selectordinal, one {Monthly on the #st Saturday} two {Monthly on the #nd Saturday} few {Monthly on the #rd Saturday} other {Monthly on the #th Saturday}}}}} SU {{position, select, last {Monthly on the last Sunday} every {Monthly on every Sunday} other {{index, selectordinal, one {Monthly on the #st Sunday} two {Monthly on the #nd Sunday} few {Monthly on the #rd Sunday} other {Monthly on the #th Sunday}}}}} other {Monthly}}} other {{weekday, select, MO {{position, select, last {Every {interval, number} months on the last Monday} every {Every {interval, number} months on every Monday} other {{index, selectordinal, one {Every {interval, number} months on the #st Monday} two {Every {interval, number} months on the #nd Monday} few {Every {interval, number} months on the #rd Monday} other {Every {interval, number} months on the #th Monday}}}}} TU {{position, select, last {Every {interval, number} months on the last Tuesday} every {Every {interval, number} months on every Tuesday} other {{index, selectordinal, one {Every {interval, number} months on the #st Tuesday} two {Every {interval, number} months on the #nd Tuesday} few {Every {interval, number} months on the #rd Tuesday} other {Every {interval, number} months on the #th Tuesday}}}}} WE {{position, select, last {Every {interval, number} months on the last Wednesday} every {Every {interval, number} months on every Wednesday} other {{index, selectordinal, one {Every {interval, number} months on the #st Wednesday} two {Every {interval, number} months on the #nd Wednesday} few {Every {interval, number} months on the #rd Wednesday} other {Every {interval, number} months on the #th Wednesday}}}}} TH {{position, select, last {Every {interval, number} months on the last Thursday} every {Every {interval, number} months on every Thursday} other {{index, selectordinal, one {Every {interval, number} months on the #st Thursday} two {Every {interval, number} months on the #nd Thursday} few {Every {interval, number} months on the #rd Thursday} other {Every {interval, number} months on the #th Thursday}}}}} FR {{position, select, last {Every {interval, number} months on the last Friday} every {Every {interval, number} months on every Friday} other {{index, selectordinal, one {Every {interval, number} months on the #st Friday} two {Every {interval, number} months on the #nd Friday} few {Every {interval, number} months on the #rd Friday} other {Every {interval, number} months on the #th Friday}}}}} SA {{position, select, last {Every {interval, number} months on the last Saturday} every {Every {interval, number} months on every Saturday} other {{index, selectordinal, one {Every {interval, number} months on the #st Saturday} two {Every {interval, number} months on the #nd Saturday} few {Every {interval, number} months on the #rd Saturday} other {Every {interval, number} months on the #th Saturday}}}}} SU {{position, select, last {Every {interval, number} months on the last Sunday} every {Every {interval, number} months on every Sunday} other {{index, selectordinal, one {Every {interval, number} months on the #st Sunday} two {Every {interval, number} months on the #nd Sunday} few {Every {interval, number} months on the #rd Sunday} other {Every {interval, number} months on the #th Sunday}}}}} other {Every {interval, number} months}}}}", context: "monthly weekday recurrence" }), {
		interval, weekday, position: position === -1 ? "last" : position === 0 ? "every" : "nth", index: Math.max(1, position),
	});
}

/** Plugin presentation adapter: never change the rule or use English RRule.toText(). */
export function recurrenceDisplayText(rule: string): string {
	if (!rule) return "";
	const custom = () => uiText(msg({ message: "Custom recurrence: {rule}", context: "recurrence custom rule" }), { rule: uiData(rule, "Stored RRULE/exception syntax; preserve the full user recurrence data") });
	const lines = rule.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
	if (lines.filter(line => line.startsWith("RRULE:")).length > 1 || lines.some(line => /^(?:RDATE|EXDATE|EXRULE)/.test(line))) return custom();
	const body = lines.find(line => /^(?:RRULE:)?FREQ=/.test(line)) ?? rule.trim().replace(/^DTSTART:[^;\r\n]+;/, "");
	const fields = body.replace(/^RRULE:/, "").split(";").filter(Boolean).map(part => part.split("="));
	if (fields.some(parts => parts.length !== 2 || !parts[0] || !parts[1])) return custom();
	const properties: Record<string, string | undefined> = Object.fromEntries(fields);
	const supported = new Set(["FREQ", "INTERVAL", "BYMONTHDAY", "BYMONTH", "BYDAY", "BYSETPOS", "COUNT", "UNTIL", "WKST"]);
	if (Object.keys(properties).some(key => !supported.has(key)) || properties.COUNT && properties.UNTIL) return custom();
	const interval = properties.INTERVAL === undefined ? 1 : Number(properties.INTERVAL);
	if (!Number.isSafeInteger(interval) || interval < 1) return custom();
	if (properties.COUNT && (!Number.isSafeInteger(Number(properties.COUNT)) || Number(properties.COUNT) < 0)) return custom();
	if (properties.UNTIL && !/^\d{8}(?:T\d{6}Z?)?$/.test(properties.UNTIL)) return custom();
	const day = Number(properties.BYMONTHDAY), month = Number(properties.BYMONTH);
	const days = properties.BYDAY?.split(",") ?? [];
	const simpleWeekdays = days.every(token => WEEKDAYS.includes(token));
	const weekdayList = simpleWeekdays ? new Intl.ListFormat(uiLocale(), { type: "conjunction" }).format(days.map(token =>
		new Intl.DateTimeFormat(uiLocale(), { weekday: "long" }).format(new Date(2024, 0, 7 + WEEKDAYS.indexOf(token)))
	)) : "";
	const nthDay = days.length === 1 ? /^(-?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/.exec(days[0]) : null;
	const position = properties.BYSETPOS !== undefined ? Number(properties.BYSETPOS) : nthDay?.[1] ? Number(nthDay[1]) : 0;
	let summary: string;
	if (properties.FREQ === "DAILY" && !days.length && !properties.BYMONTH && !properties.BYMONTHDAY && !properties.BYSETPOS) {
		summary = uiText(msg({ message: "{interval, plural, one {Daily} other {Every # days}}", context: "recurrence daily interval" }), { interval });
	} else if (properties.FREQ === "WEEKLY" && simpleWeekdays && !properties.BYMONTH && !properties.BYMONTHDAY && !properties.BYSETPOS) {
		if (properties.BYDAY === "MO,TU,WE,TH,FR" && interval === 1) {
			summary = uiText(msg({ message: "Weekdays", context: "recurrence weekdays" }));
		} else if (weekdayList) {
			summary = uiText(msg({ message: "{interval, plural, one {Weekly on {days}} other {Every # weeks on {days}}}", context: "recurrence weekly weekdays" }), { interval, days: weekdayList });
		} else {
			summary = uiText(msg({ message: "{interval, plural, one {Weekly} other {Every # weeks}}", context: "recurrence weekly interval" }), { interval });
		}
	} else if (properties.FREQ === "MONTHLY" && !properties.BYMONTH && Number.isInteger(day) && day >= 1 && day <= 31 && !days.length && !properties.BYSETPOS) {
		summary = recurrenceMonthlyOn(day, interval);
	} else if (properties.FREQ === "MONTHLY" && !properties.BYMONTH && !properties.BYMONTHDAY && nthDay && !(nthDay[1] && properties.BYSETPOS) && Number.isInteger(position) && (position === -1 || position >= 1 && position <= 5 || position === 0 && !properties.BYSETPOS)) {
		summary = monthlyWeekday(position, nthDay[2], interval);
	} else if (properties.FREQ === "MONTHLY" && !properties.BYMONTH && !properties.BYMONTHDAY && !days.length && !properties.BYSETPOS) {
		summary = uiText(msg({ message: "{interval, plural, one {Monthly} other {Every # months}}", context: "recurrence monthly interval" }), { interval });
	} else if (properties.FREQ === "YEARLY" && Number.isInteger(month) && month >= 1 && month <= 12 && Number.isInteger(day) && day >= 1 && day <= new Date(2024, month, 0).getDate() && !days.length && !properties.BYSETPOS) {
		summary = recurrenceYearlyOn(month, day, interval);
	} else if (properties.FREQ === "YEARLY" && !properties.BYMONTH && !properties.BYMONTHDAY && !days.length && !properties.BYSETPOS) {
		summary = uiText(msg({ message: "{interval, plural, one {Yearly} other {Every # years}}", context: "recurrence yearly interval" }), { interval });
	} else {
		return custom();
	}
	if (properties.COUNT !== undefined) {
		return uiText(msg({ message: "{count, plural, one {{recurrence} (# time)} other {{recurrence} (# times)}}", context: "recurrence occurrence limit" }), { count: Number(properties.COUNT), recurrence: summary });
	}
	const until = properties.UNTIL?.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
	if (until) {
		const parts = [Number(until[1]), Number(until[2]) - 1, Number(until[3]), Number(until[4] || 0), Number(until[5] || 0), Number(until[6] || 0)] as const;
		if (parts[1] < 0 || parts[1] > 11 || parts[2] < 1 || parts[2] > new Date(parts[0], parts[1] + 1, 0).getDate() || parts[3] > 23 || parts[4] > 59 || parts[5] > 59) return custom();
		const timestamp = until[7] ? Date.UTC(...parts) : new Date(...parts).getTime();
		if (!Number.isFinite(timestamp)) return custom();
		const date = new Intl.DateTimeFormat(uiLocale(), { dateStyle: "medium", ...(until[4] ? { timeStyle: "short" as const } : {}) }).format(new Date(timestamp));
		return uiText(msg({ message: "{recurrence} (until {date})", context: "recurrence end date" }), { recurrence: summary, date });
	}
	return summary;
}
