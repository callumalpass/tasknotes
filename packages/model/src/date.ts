const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const STRICT_DATETIME_RE =
	/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(?:Z|([+-])(\d{2}):(\d{2}))?$/;
const RELAXED_DATETIME_RE =
	/^(\d{4})-(\d{2})-(\d{2})(?:T| )(\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?(Z|([+-])(\d{2}):(\d{2}))?$/;

export type DateTimeRangeBound = "from" | "to";

export function parseDateToUTC(dateString: string): Date {
	const trimmed = requireDateString(dateString);
	const dateOnlyMatch = trimmed.match(DATE_ONLY_RE);
	if (dateOnlyMatch) {
		const [, year, month, day] = dateOnlyMatch;
		const y = Number(year);
		const m = Number(month);
		const d = Number(day);
		if (!isValidCalendarDate(y, m, d)) {
			throw new Error(`Invalid date "${dateString}".`);
		}
		return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
	}

	if (!isStrictDateTime(trimmed)) {
		throw new Error(`Invalid date "${dateString}".`);
	}

	const parsed = new Date(trimmed);
	if (!isValidDate(parsed)) {
		throw new Error(`Invalid date "${dateString}".`);
	}
	return parsed;
}

export function parseDateToLocal(dateString: string): Date {
	const trimmed = requireDateString(dateString);
	const dateOnlyMatch = trimmed.match(DATE_ONLY_RE);
	if (dateOnlyMatch) {
		const [, year, month, day] = dateOnlyMatch;
		const y = Number(year);
		const m = Number(month);
		const d = Number(day);
		const parsed = new Date(y, m - 1, d, 0, 0, 0, 0);
		if (
			!isValidDate(parsed) ||
			parsed.getFullYear() !== y ||
			parsed.getMonth() !== m - 1 ||
			parsed.getDate() !== d
		) {
			throw new Error(`Invalid date "${dateString}".`);
		}
		return parsed;
	}

	if (!isStrictDateTime(trimmed)) {
		throw new Error(`Invalid date "${dateString}".`);
	}

	const parsed = new Date(trimmed);
	if (!isValidDate(parsed)) {
		throw new Error(`Invalid date "${dateString}".`);
	}
	return parsed;
}

export function formatDateForStorage(date: Date): string {
	if (!isValidDate(date)) {
		return "";
	}
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function formatDateAsUTCString(date: Date): string {
	return formatDateForStorage(date);
}

export function getCurrentDateString(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export const getTodayString = getCurrentDateString;

export function resolveDateOrToday(date?: string): string {
	if (!date) {
		return getCurrentDateString();
	}
	return validateDateString(date);
}

export function getTodayLocal(): Date {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

export function createUTCDateFromLocalCalendarDate(localDate: Date): Date {
	return new Date(
		Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), 0, 0, 0, 0)
	);
}

export function createUTCDateForRRule(dateString: string): Date {
	return parseDateToUTC(getDatePart(dateString));
}

export function validateDateString(date: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		throw new Error(`Invalid date "${date}". Expected YYYY-MM-DD.`);
	}
	parseDateToUTC(date);
	return date;
}

export function hasTimeComponent(dateString: string | undefined): boolean {
	if (!dateString) return false;
	return /T\d{2}:\d{2}/.test(dateString);
}

export function getDatePart(dateString: string): string {
	if (!dateString) return "";
	const trimmed = dateString.trim();
	if (DATE_ONLY_RE.test(trimmed)) {
		return trimmed;
	}
	const tIndex = trimmed.indexOf("T");
	if (tIndex > -1) {
		return trimmed.slice(0, tIndex);
	}
	const spaceIndex = trimmed.indexOf(" ");
	if (spaceIndex > -1 && DATE_ONLY_RE.test(trimmed.slice(0, spaceIndex))) {
		return trimmed.slice(0, spaceIndex);
	}
	return formatDateForStorage(parseDateToUTC(trimmed));
}

export function resolveOperationTargetDate(
	explicitDate: string | undefined,
	scheduled: string | undefined,
	due: string | undefined
): string {
	if (explicitDate) {
		return validateDateString(explicitDate);
	}

	const scheduledDate = extractValidDatePartOrUndefined(scheduled);
	if (scheduledDate) {
		return scheduledDate;
	}

	const dueDate = extractValidDatePartOrUndefined(due);
	if (dueDate) {
		return dueDate;
	}

	return getCurrentDateString();
}

export function isSameDateSafe(date1: string, date2: string): boolean {
	try {
		return parseDateToUTC(getDatePart(date1)).getTime() === parseDateToUTC(getDatePart(date2)).getTime();
	} catch {
		return false;
	}
}

export function isBeforeDateSafe(date1: string, date2: string): boolean {
	try {
		return parseDateToUTC(getDatePart(date1)).getTime() < parseDateToUTC(getDatePart(date2)).getTime();
	} catch {
		return false;
	}
}

export function validateCompleteInstances(value: unknown[]): string[] {
	const result: string[] = [];
	const seen = new Set<string>();
	for (const entry of value) {
		if (typeof entry !== "string") {
			continue;
		}
		try {
			const date = validateDateString(getDatePart(entry.trim()));
			if (!seen.has(date)) {
				seen.add(date);
				result.push(date);
			}
		} catch {
			// Invalid persisted instance dates are ignored for compatibility with plugin behavior.
		}
	}
	return result;
}

export function resolveDateTimeRangeBound(value: string, bound: DateTimeRangeBound): Date {
	const trimmed = requireDateString(value, "Datetime cannot be empty.");
	const dateOnlyMatch = trimmed.match(DATE_ONLY_RE);
	if (dateOnlyMatch) {
		const [, year, month, day] = dateOnlyMatch;
		const y = Number(year);
		const m = Number(month);
		const d = Number(day);
		if (!isValidCalendarDate(y, m, d)) {
			throw new Error(`Invalid datetime "${value}".`);
		}
		return bound === "from"
			? new Date(y, m - 1, d, 0, 0, 0, 0)
			: new Date(y, m - 1, d, 23, 59, 59, 999);
	}

	const match = trimmed.match(RELAXED_DATETIME_RE);
	if (!match) {
		throw new Error(
			`Invalid datetime "${value}". Expected YYYY-MM-DD, YYYY-MM-DD HH:mm, or YYYY-MM-DDTHH:mm.`
		);
	}

	const [, year, month, day, hours, minutes, seconds, fraction, tz, tzSign, tzHours, tzMinutes] =
		match;
	const y = Number(year);
	const m = Number(month);
	const d = Number(day);
	const hh = Number(hours);
	const mm = Number(minutes);
	const ss = seconds === undefined ? (bound === "to" ? 59 : 0) : Number(seconds);
	const ms = fraction ? Number(fraction.slice(1).padEnd(3, "0")) : bound === "to" ? 999 : 0;

	if (
		!isValidCalendarDate(y, m, d) ||
		!isValidClockTime(hh, mm, ss) ||
		!isValidOffset(tzSign, tzHours, tzMinutes)
	) {
		throw new Error(`Invalid datetime "${value}".`);
	}

	const normalized =
		`${year}-${month}-${day}T${hours}:${minutes}:${String(ss).padStart(2, "0")}` +
		`.${String(ms).padStart(3, "0")}${tz || ""}`;
	const parsed = new Date(normalized);
	if (!isValidDate(parsed)) {
		throw new Error(`Invalid datetime "${value}".`);
	}
	return parsed;
}

function extractValidDatePartOrUndefined(dateString: string | undefined): string | undefined {
	if (!dateString || dateString.trim().length === 0) {
		return undefined;
	}

	try {
		return validateDateString(getDatePart(dateString.trim()));
	} catch {
		return undefined;
	}
}

function requireDateString(value: string, message = "Date string cannot be empty"): string {
	if (!value || value.trim().length === 0) {
		throw new Error(message);
	}
	return value.trim();
}

function isStrictDateTime(value: string): boolean {
	const match = value.match(STRICT_DATETIME_RE);
	if (!match) return false;

	const [, year, month, day, hours, minutes, seconds, , tzSign, tzHours, tzMinutes] = match;
	return (
		isValidCalendarDate(Number(year), Number(month), Number(day)) &&
		isValidClockTime(Number(hours), Number(minutes), Number(seconds)) &&
		isValidOffset(tzSign, tzHours, tzMinutes)
	);
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
	const parsed = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
	return (
		parsed.getUTCFullYear() === year &&
		parsed.getUTCMonth() === month - 1 &&
		parsed.getUTCDate() === day
	);
}

function isValidClockTime(hours: number, minutes: number, seconds: number): boolean {
	return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59;
}

function isValidOffset(
	tzSign: string | undefined,
	tzHours: string | undefined,
	tzMinutes: string | undefined
): boolean {
	if (!tzSign) return true;

	const offsetHours = Number(tzHours);
	const offsetMinutes = Number(tzMinutes);
	if (offsetHours > 14 || offsetMinutes > 59) return false;
	if (offsetHours === 14 && offsetMinutes !== 0) return false;
	return true;
}

function isValidDate(value: Date): boolean {
	return value instanceof Date && !Number.isNaN(value.getTime());
}
