import { msg } from "@lingui/core/macro";
import { uiLocale, uiText } from "./runtime";
import { uiData } from "./dataText";

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export function recurrenceOrdinal(day: number): string {
	return uiText(msg({ message: "{day, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}", context: "recurrence ordinal number" }), { day });
}

export function recurrenceMonthlyOn(day: number, interval = 1): string {
	if (interval === 1) return uiText(msg({ message: "{day, selectordinal, one {Monthly on the #st} two {Monthly on the #nd} few {Monthly on the #rd} other {Monthly on the #th}}", context: "recurrence monthly date" }), { day });
	return uiText(msg({ message: "{interval, plural, =1 {Monthly on day {day, number}} other {Every # months on day {day, number}}}", context: "recurrence interval on month day" }), { interval, day });
}

export function recurrenceYearlyOn(month: number, day: number, interval = 1): string {
	// Format month and day together: Russian and other locales need the contextual
	// month case, which a standalone month-name parameter cannot provide.
	const date = new Intl.DateTimeFormat(uiLocale(), { month: "long", day: "numeric" }).format(new Date(2024, month - 1, day));
	if (interval === 1) return uiText(msg({ message: "Yearly on {date}", context: "recurrence yearly date" }), { date });
	return uiText(msg({ message: "{interval, plural, =1 {Yearly on {date}} other {Every # years on {date}}}", context: "recurrence yearly interval date" }), { interval, date });
}

function monthlyWeekday(position: number, weekday: string, interval: number): string {
	// Translators: keep MO..SU and last/every/other select keys. Each weekday arm
	// owns the full phrase, allowing gender/case agreement for ordinal weekdays.
	return uiText(msg({ message: "{interval, plural, =1 {{weekday, select, MO {{position, select, last {Monthly on the last Monday} every {Monthly on every Monday} other {{index, selectordinal, one {Monthly on the #st Monday} two {Monthly on the #nd Monday} few {Monthly on the #rd Monday} other {Monthly on the #th Monday}}}}} TU {{position, select, last {Monthly on the last Tuesday} every {Monthly on every Tuesday} other {{index, selectordinal, one {Monthly on the #st Tuesday} two {Monthly on the #nd Tuesday} few {Monthly on the #rd Tuesday} other {Monthly on the #th Tuesday}}}}} WE {{position, select, last {Monthly on the last Wednesday} every {Monthly on every Wednesday} other {{index, selectordinal, one {Monthly on the #st Wednesday} two {Monthly on the #nd Wednesday} few {Monthly on the #rd Wednesday} other {Monthly on the #th Wednesday}}}}} TH {{position, select, last {Monthly on the last Thursday} every {Monthly on every Thursday} other {{index, selectordinal, one {Monthly on the #st Thursday} two {Monthly on the #nd Thursday} few {Monthly on the #rd Thursday} other {Monthly on the #th Thursday}}}}} FR {{position, select, last {Monthly on the last Friday} every {Monthly on every Friday} other {{index, selectordinal, one {Monthly on the #st Friday} two {Monthly on the #nd Friday} few {Monthly on the #rd Friday} other {Monthly on the #th Friday}}}}} SA {{position, select, last {Monthly on the last Saturday} every {Monthly on every Saturday} other {{index, selectordinal, one {Monthly on the #st Saturday} two {Monthly on the #nd Saturday} few {Monthly on the #rd Saturday} other {Monthly on the #th Saturday}}}}} SU {{position, select, last {Monthly on the last Sunday} every {Monthly on every Sunday} other {{index, selectordinal, one {Monthly on the #st Sunday} two {Monthly on the #nd Sunday} few {Monthly on the #rd Sunday} other {Monthly on the #th Sunday}}}}} other {Monthly}}} other {{weekday, select, MO {{position, select, last {Every {interval, number} months on the last Monday} every {Every {interval, number} months on every Monday} other {{index, selectordinal, one {Every {interval, number} months on the #st Monday} two {Every {interval, number} months on the #nd Monday} few {Every {interval, number} months on the #rd Monday} other {Every {interval, number} months on the #th Monday}}}}} TU {{position, select, last {Every {interval, number} months on the last Tuesday} every {Every {interval, number} months on every Tuesday} other {{index, selectordinal, one {Every {interval, number} months on the #st Tuesday} two {Every {interval, number} months on the #nd Tuesday} few {Every {interval, number} months on the #rd Tuesday} other {Every {interval, number} months on the #th Tuesday}}}}} WE {{position, select, last {Every {interval, number} months on the last Wednesday} every {Every {interval, number} months on every Wednesday} other {{index, selectordinal, one {Every {interval, number} months on the #st Wednesday} two {Every {interval, number} months on the #nd Wednesday} few {Every {interval, number} months on the #rd Wednesday} other {Every {interval, number} months on the #th Wednesday}}}}} TH {{position, select, last {Every {interval, number} months on the last Thursday} every {Every {interval, number} months on every Thursday} other {{index, selectordinal, one {Every {interval, number} months on the #st Thursday} two {Every {interval, number} months on the #nd Thursday} few {Every {interval, number} months on the #rd Thursday} other {Every {interval, number} months on the #th Thursday}}}}} FR {{position, select, last {Every {interval, number} months on the last Friday} every {Every {interval, number} months on every Friday} other {{index, selectordinal, one {Every {interval, number} months on the #st Friday} two {Every {interval, number} months on the #nd Friday} few {Every {interval, number} months on the #rd Friday} other {Every {interval, number} months on the #th Friday}}}}} SA {{position, select, last {Every {interval, number} months on the last Saturday} every {Every {interval, number} months on every Saturday} other {{index, selectordinal, one {Every {interval, number} months on the #st Saturday} two {Every {interval, number} months on the #nd Saturday} few {Every {interval, number} months on the #rd Saturday} other {Every {interval, number} months on the #th Saturday}}}}} SU {{position, select, last {Every {interval, number} months on the last Sunday} every {Every {interval, number} months on every Sunday} other {{index, selectordinal, one {Every {interval, number} months on the #st Sunday} two {Every {interval, number} months on the #nd Sunday} few {Every {interval, number} months on the #rd Sunday} other {Every {interval, number} months on the #th Sunday}}}}} other {Every {interval, number} months}}}}", context: "monthly weekday recurrence" }), {
		interval, weekday, position: position === -1 ? "last" : position === 0 ? "every" : "nth", index: Math.max(1, position),
	});
}

type RuleProperties = Record<string, string | undefined>;

const CORE_KEYS = new Set(["FREQ", "INTERVAL", "BYMONTHDAY", "BYMONTH", "BYDAY", "BYSETPOS", "COUNT", "UNTIL", "WKST"]);
const DETAIL_KEYS = new Set(["BYHOUR", "BYMINUTE", "BYWEEKNO", "BYYEARDAY"]);

function integers(value: string | undefined, min: number, max: number): number[] | null {
	if (value === undefined) return [];
	const numbers = value.split(",").map(Number);
	return numbers.every(n => Number.isInteger(n) && n !== 0 && Math.abs(n) <= max && (min < 0 || n >= min)) ? numbers : null;
}

function list(items: string[]): string {
	return new Intl.ListFormat(uiLocale(), { type: "conjunction" }).format(items);
}

function weekdayName(token: string): string {
	return new Intl.DateTimeFormat(uiLocale(), { weekday: "long" }).format(new Date(2024, 0, 7 + WEEKDAYS.indexOf(token)));
}

/** "last", "1st", "2nd"... for positions counted from either end of a period. */
function position(n: number): string | null {
	if (n > 0) return recurrenceOrdinal(n);
	if (n === -1) return uiText(msg({ message: "last", context: "recurrence position last" }));
	return null;
}

function frequencyPhrase(freq: string | undefined, interval: number): string | null {
	switch (freq) {
		case "YEARLY": return uiText(msg({ message: "{interval, plural, =1 {Yearly} other {Every # years}}", context: "recurrence yearly interval" }), { interval });
		case "MONTHLY": return uiText(msg({ message: "{interval, plural, =1 {Monthly} other {Every # months}}", context: "recurrence monthly interval" }), { interval });
		case "WEEKLY": return uiText(msg({ message: "{interval, plural, =1 {Weekly} other {Every # weeks}}", context: "recurrence weekly interval" }), { interval });
		case "DAILY": return uiText(msg({ message: "{interval, plural, =1 {Daily} other {Every # days}}", context: "recurrence daily interval" }), { interval });
		case "HOURLY": return uiText(msg({ message: "{interval, plural, =1 {Hourly} other {Every # hours}}", context: "recurrence hourly interval" }), { interval });
		case "MINUTELY": return uiText(msg({ message: "{interval, plural, =1 {Every minute} other {Every # minutes}}", context: "recurrence minutely interval" }), { interval });
		case "SECONDLY": return uiText(msg({ message: "{interval, plural, =1 {Every second} other {Every # seconds}}", context: "recurrence secondly interval" }), { interval });
		default: return null;
	}
}

/**
 * Describes any valid rule as its frequency followed by one clause per BY part,
 * for rules too unusual for one of the whole phrases. Returns null when a part
 * is malformed, so the caller can show the stored rule instead.
 */
function describeByParts(properties: RuleProperties, interval: number): string | null {
	const base = frequencyPhrase(properties.FREQ, interval);
	if (!base) return null;
	const clauses: string[] = [];
	const months = integers(properties.BYMONTH, 1, 12);
	const weeks = integers(properties.BYWEEKNO, -53, 53);
	const yearDays = integers(properties.BYYEARDAY, -366, 366);
	const monthDays = integers(properties.BYMONTHDAY, -31, 31);
	const setPositions = integers(properties.BYSETPOS, -366, 366);
	const hours = properties.BYHOUR === undefined ? [] : properties.BYHOUR.split(",").map(Number);
	const minutes = properties.BYMINUTE === undefined ? [] : properties.BYMINUTE.split(",").map(Number);
	if (!months || !weeks || !yearDays || !monthDays || !setPositions) return null;
	if (!hours.every(h => Number.isInteger(h) && h >= 0 && h <= 23) || !minutes.every(m => Number.isInteger(m) && m >= 0 && m <= 59)) return null;
	if (months.length) {
		const names = months.map(m => new Intl.DateTimeFormat(uiLocale(), { month: "long" }).format(new Date(2024, m - 1, 1)));
		clauses.push(uiText(msg({ message: "in {months}", context: "recurrence detail months" }), { months: list(names) }));
	}
	if (weeks.length) {
		const labels = weeks.map(position);
		if (labels.some(label => label === null)) return null;
		clauses.push(uiText(msg({ message: "{count, plural, one {in the {weeks} week of the year} other {in the {weeks} weeks of the year}}", context: "recurrence detail weeks of year" }), { count: weeks.length, weeks: list(labels as string[]) }));
	}
	if (yearDays.length) {
		const labels = yearDays.map(position);
		if (labels.some(label => label === null)) return null;
		clauses.push(uiText(msg({ message: "{count, plural, one {on the {days} day of the year} other {on the {days} days of the year}}", context: "recurrence detail days of year" }), { count: yearDays.length, days: list(labels as string[]) }));
	}
	if (monthDays.length) {
		const labels = monthDays.map(position);
		if (labels.some(label => label === null)) return null;
		clauses.push(uiText(msg({ message: "{count, plural, one {on the {days} day of the month} other {on the {days} days of the month}}", context: "recurrence detail days of month" }), { count: monthDays.length, days: list(labels as string[]) }));
	}
	if (properties.BYDAY) {
		const labels: string[] = [];
		for (const token of properties.BYDAY.split(",")) {
			const match = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(token);
			if (!match) return null;
			if (!match[1]) {
				labels.push(weekdayName(match[2]));
				continue;
			}
			const ordinal = position(Number(match[1]));
			if (!ordinal) return null;
			labels.push(uiText(msg({ message: "the {position} {weekday}", context: "recurrence detail nth weekday, e.g. the 2nd Monday" }), { position: ordinal, weekday: weekdayName(match[2]) }));
		}
		clauses.push(uiText(msg({ message: "on {days}", context: "recurrence detail weekdays" }), { days: list(labels) }));
	}
	if (hours.length || minutes.length) {
		if (hours.length) {
			const times = hours.flatMap(h => (minutes.length ? minutes : [0]).map(m =>
				new Intl.DateTimeFormat(uiLocale(), { hour: "numeric", minute: "2-digit" }).format(new Date(2024, 0, 1, h, m))));
			clauses.push(uiText(msg({ message: "at {times}", context: "recurrence detail times" }), { times: list(times) }));
		} else {
			clauses.push(uiText(msg({ message: "{count, plural, one {at minute {minutes}} other {at minutes {minutes}}}", context: "recurrence detail minutes past the hour" }), { count: minutes.length, minutes: list(minutes.map(String)) }));
		}
	}
	if (setPositions.length) {
		const labels = setPositions.map(position);
		if (labels.some(label => label === null)) return null;
		clauses.push(uiText(msg({ message: "{count, plural, one {only the {positions} match in each period} other {only the {positions} matches in each period}}", context: "recurrence detail set positions" }), { count: setPositions.length, positions: list(labels as string[]) }));
	}
	return clauses.reduce((recurrence, detail) => uiText(msg({ message: "{recurrence}, {detail}", context: "recurrence followed by one detail clause" }), { recurrence, detail }), base);
}

function wholePhrase(properties: RuleProperties, interval: number): string | null {
	const day = Number(properties.BYMONTHDAY), month = Number(properties.BYMONTH);
	const days = properties.BYDAY?.split(",") ?? [];
	const simpleWeekdays = days.every(token => WEEKDAYS.includes(token));
	const weekdayList = simpleWeekdays && days.length ? list(days.map(weekdayName)) : "";
	const nthDay = days.length === 1 ? /^(-?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/.exec(days[0]) : null;
	const setPosition = properties.BYSETPOS !== undefined ? Number(properties.BYSETPOS) : nthDay?.[1] ? Number(nthDay[1]) : 0;
	const weekly = (weeks: number) => {
		if (new Set(days).size === 7 && weeks === 1) return frequencyPhrase("DAILY", 1);
		if (properties.BYDAY === "MO,TU,WE,TH,FR" && weeks === 1) return uiText(msg({ message: "Weekdays", context: "recurrence weekdays" }));
		if (weekdayList) return uiText(msg({ message: "{interval, plural, =1 {Weekly on {days}} other {Every # weeks on {days}}}", context: "recurrence weekly weekdays" }), { interval: weeks, days: weekdayList });
		return frequencyPhrase("WEEKLY", weeks);
	};
	if (properties.FREQ === "DAILY" && !properties.BYMONTH && !properties.BYMONTHDAY && !properties.BYSETPOS) {
		if (!days.length) return frequencyPhrase("DAILY", interval);
		// Daily on some weekdays is the same as weekly on them
		if (simpleWeekdays && interval === 1) return weekly(1);
		return null;
	}
	if (properties.FREQ === "WEEKLY" && simpleWeekdays && !properties.BYMONTH && !properties.BYMONTHDAY && !properties.BYSETPOS) return weekly(interval);
	if (properties.FREQ === "MONTHLY" && !properties.BYMONTH && Number.isInteger(day) && day >= 1 && day <= 31 && !days.length && !properties.BYSETPOS) return recurrenceMonthlyOn(day, interval);
	if (properties.FREQ === "MONTHLY" && !properties.BYMONTH && !properties.BYMONTHDAY && nthDay && !(nthDay[1] && properties.BYSETPOS) && Number.isInteger(setPosition) && (setPosition === -1 || setPosition >= 1 && setPosition <= 5 || setPosition === 0 && !properties.BYSETPOS)) return monthlyWeekday(setPosition, nthDay[2], interval);
	if (properties.FREQ === "MONTHLY" && !properties.BYMONTH && !properties.BYMONTHDAY && !days.length && !properties.BYSETPOS) return frequencyPhrase("MONTHLY", interval);
	if (properties.FREQ === "YEARLY" && Number.isInteger(month) && month >= 1 && month <= 12 && Number.isInteger(day) && day >= 1 && day <= new Date(2024, month, 0).getDate() && !days.length && !properties.BYSETPOS) return recurrenceYearlyOn(month, day, interval);
	if (properties.FREQ === "YEARLY" && !properties.BYMONTH && !properties.BYMONTHDAY && !days.length && !properties.BYSETPOS) return frequencyPhrase("YEARLY", interval);
	return null;
}

/** Plugin presentation adapter: never change the rule or use English RRule.toText(). */
export function recurrenceDisplayText(rule: string): string {
	if (!rule) return "";
	// Only a rule that cannot be read is shown as stored, so no data is hidden
	const custom = () => uiText(msg({ message: "Custom recurrence: {rule}", context: "recurrence custom rule" }), { rule: uiData(rule, "Stored RRULE/exception syntax; preserve the full user recurrence data") });
	const lines = rule.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
	if (lines.filter(line => line.startsWith("RRULE:")).length > 1 || lines.some(line => /^EXRULE/.test(line))) return custom();
	const dateCount = (name: string) => lines.filter(line => line.startsWith(name)).reduce((total, line) => total + line.slice(line.indexOf(":") + 1).split(",").filter(Boolean).length, 0);
	const exceptions = dateCount("EXDATE"), extraDates = dateCount("RDATE");
	const body = lines.find(line => /^(?:RRULE:)?(?:DTSTART:[^;]+;)?FREQ=/.test(line)) ?? rule.trim();
	const fields = body.replace(/^RRULE:/, "").replace(/^DTSTART:[^;\r\n]+;/, "").split(";").filter(Boolean).map(part => part.split("="));
	if (fields.some(parts => parts.length !== 2 || !parts[0] || !parts[1])) return custom();
	const properties: RuleProperties = Object.fromEntries(fields);
	if (Object.keys(properties).some(key => !CORE_KEYS.has(key) && !DETAIL_KEYS.has(key)) || properties.COUNT && properties.UNTIL) return custom();
	const interval = properties.INTERVAL === undefined ? 1 : Number(properties.INTERVAL);
	if (!Number.isSafeInteger(interval) || interval < 1) return custom();
	if (properties.COUNT && (!Number.isSafeInteger(Number(properties.COUNT)) || Number(properties.COUNT) < 0)) return custom();
	if (properties.UNTIL && !/^\d{8}(?:T\d{6}Z?)?$/.test(properties.UNTIL)) return custom();
	const hasDetailKeys = Object.keys(properties).some(key => DETAIL_KEYS.has(key));
	let summary = (hasDetailKeys ? null : wholePhrase(properties, interval)) ?? describeByParts(properties, interval);
	if (!summary) return custom();
	if (properties.COUNT !== undefined) {
		summary = uiText(msg({ message: "{count, plural, one {{recurrence} (# time)} other {{recurrence} (# times)}}", context: "recurrence occurrence limit" }), { count: Number(properties.COUNT), recurrence: summary });
	}
	const until = properties.UNTIL?.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
	if (until) {
		const parts = [Number(until[1]), Number(until[2]) - 1, Number(until[3]), Number(until[4] || 0), Number(until[5] || 0), Number(until[6] || 0)] as const;
		if (parts[1] < 0 || parts[1] > 11 || parts[2] < 1 || parts[2] > new Date(parts[0], parts[1] + 1, 0).getDate() || parts[3] > 23 || parts[4] > 59 || parts[5] > 59) return custom();
		const timestamp = until[7] ? Date.UTC(...parts) : new Date(...parts).getTime();
		if (!Number.isFinite(timestamp)) return custom();
		const date = new Intl.DateTimeFormat(uiLocale(), { dateStyle: "medium", ...(until[4] ? { timeStyle: "short" as const } : {}) }).format(new Date(timestamp));
		summary = uiText(msg({ message: "{recurrence} (until {date})", context: "recurrence end date" }), { recurrence: summary, date });
	}
	if (extraDates) summary = uiText(msg({ message: "{count, plural, one {{recurrence}, plus # extra date} other {{recurrence}, plus # extra dates}}", context: "recurrence extra RDATE dates" }), { count: extraDates, recurrence: summary });
	if (exceptions) summary = uiText(msg({ message: "{count, plural, one {{recurrence}, except # date} other {{recurrence}, except # dates}}", context: "recurrence EXDATE exceptions" }), { count: exceptions, recurrence: summary });
	return summary;
}
