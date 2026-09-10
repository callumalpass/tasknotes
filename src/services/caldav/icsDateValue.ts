/**
 * iCalendar (RFC 5545) date and date-time values, in the three forms a CalDAV
 * server actually sends them:
 *
 *   DUE;VALUE=DATE:20250901                     date-only
 *   DUE:20250901T120000Z                        UTC instant
 *   DUE;TZID=Europe/Berlin:20250901T120000      wall time in a named zone
 *
 * TaskNotes stores dates as `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm[:ss]` local wall
 * time (see `hasTimeComponent` / `getDatePart` in src/utils/dateUtils.ts), so
 * this module is the translation boundary between the two.
 *
 * Pure: no Obsidian runtime, no network, no DOM or timer globals. Zone
 * resolution for TZID values is injected rather than imported, because the
 * repo's TZID table (src/utils/icsTimezoneFallback.ts) pulls in ical.js.
 */

export interface IcsDateValue {
	/** VALUE=DATE — a calendar day with no time component. */
	dateOnly: boolean;
	/**
	 * `YYYY-MM-DD` when `dateOnly`, otherwise `YYYY-MM-DDTHH:mm:ss`.
	 * For `utc` values this is the UTC wall time; for `tzid` values it is the
	 * wall time in that zone; with neither it is a floating local time.
	 */
	value: string;
	/** TZID parameter, when the property carried one. */
	tzid?: string;
	/** The raw form ended with `Z`. */
	utc: boolean;
}

/** Converts a wall time in a named zone to a UTC ISO instant. */
export type ZoneToUtc = (wallTime: string, tzid: string) => string | null;

const ICS_DATE = /^(\d{4})(\d{2})(\d{2})$/u;
const ICS_DATE_TIME = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/u;
const TASK_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;
const TASK_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/u;

/**
 * Parses a raw iCalendar date/date-time value plus its property parameters.
 * Returns null for anything malformed — callers treat that as "property absent"
 * rather than failing the whole sync over one bad line.
 */
export function parseIcsDateValue(
	raw: string,
	params: Record<string, string> = {}
): IcsDateValue | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;

	const tzid = params.TZID?.trim() || undefined;

	const dateMatch = ICS_DATE.exec(trimmed);
	if (dateMatch) {
		const [, year, month, day] = dateMatch;
		if (!isRealDate(+year, +month, +day)) return null;
		return { dateOnly: true, value: `${year}-${month}-${day}`, utc: false };
	}

	const dateTimeMatch = ICS_DATE_TIME.exec(trimmed);
	if (dateTimeMatch) {
		const [, year, month, day, hour, minute, second, zulu] = dateTimeMatch;
		if (!isRealDate(+year, +month, +day)) return null;
		if (+hour > 23 || +minute > 59 || +second > 60) return null;
		// A VALUE=DATE parameter on a value that carries a time is contradictory;
		// the value itself wins, since that is what the server will round-trip.
		return {
			dateOnly: false,
			value: `${year}-${month}-${day}T${hour}:${minute}:${second}`,
			tzid: zulu ? undefined : tzid,
			utc: Boolean(zulu),
		};
	}

	return null;
}

/**
 * Serialises back to the raw value plus the parameters that must accompany it.
 */
export function formatIcsDateValue(value: IcsDateValue): {
	value: string;
	params: Record<string, string>;
} {
	if (value.dateOnly) {
		return { value: value.value.replace(/-/gu, ""), params: { VALUE: "DATE" } };
	}

	const compact = value.value.replace(/[-:]/gu, "");
	if (value.utc) {
		return { value: `${compact}Z`, params: {} };
	}
	return { value: compact, params: value.tzid ? { TZID: value.tzid } : {} };
}

/**
 * Converts to the string TaskNotes stores in frontmatter.
 *
 * UTC and zoned values are resolved to local wall time so that a task due at
 * 12:00 in Berlin reads as the viewer's own clock time, matching how the rest
 * of the plugin displays dates.
 */
export function icsDateValueToTaskDate(
	value: IcsDateValue,
	zoneToUtc?: ZoneToUtc
): string | null {
	if (value.dateOnly) return value.value;

	if (value.utc) return utcWallTimeToLocal(value.value);

	if (value.tzid) {
		const asUtc = zoneToUtc?.(value.value, value.tzid);
		// Without a resolver, a zoned time is treated as floating rather than
		// silently shifted by the wrong offset.
		if (!asUtc) return trimSeconds(value.value);
		const normalised = asUtc.replace(/\.\d+Z?$/u, "").replace(/Z$/u, "");
		return utcWallTimeToLocal(normalised);
	}

	return trimSeconds(value.value);
}

/**
 * Converts a TaskNotes frontmatter date into an iCalendar value.
 *
 * Date-only stays date-only. A local wall time is emitted as a UTC instant,
 * which every CalDAV server understands and which avoids shipping a VTIMEZONE
 * component we would then have to keep correct.
 */
export function taskDateToIcsDateValue(taskDate: string): IcsDateValue | null {
	const trimmed = taskDate?.trim();
	if (!trimmed) return null;

	const dateMatch = TASK_DATE.exec(trimmed);
	if (dateMatch) {
		const [, year, month, day] = dateMatch;
		if (!isRealDate(+year, +month, +day)) return null;
		return { dateOnly: true, value: trimmed, utc: false };
	}

	const match = TASK_DATE_TIME.exec(trimmed);
	if (!match) return null;

	const [, year, month, day, hour, minute, second] = match;
	if (!isRealDate(+year, +month, +day)) return null;

	const local = new Date(
		+year,
		+month - 1,
		+day,
		+hour,
		+minute,
		second ? +second : 0,
		0
	);
	if (Number.isNaN(local.getTime())) return null;

	return {
		dateOnly: false,
		value: [
			local.getUTCFullYear(),
			"-",
			pad(local.getUTCMonth() + 1),
			"-",
			pad(local.getUTCDate()),
			"T",
			pad(local.getUTCHours()),
			":",
			pad(local.getUTCMinutes()),
			":",
			pad(local.getUTCSeconds()),
		].join(""),
		utc: true,
	};
}

/** Renders an ISO timestamp as a UTC iCalendar date-time (for DTSTAMP etc.). */
export function isoToIcsUtcStamp(iso: string): string | null {
	const parsed = Date.parse(iso);
	if (Number.isNaN(parsed)) return null;
	const date = new Date(parsed);
	return [
		date.getUTCFullYear(),
		pad(date.getUTCMonth() + 1),
		pad(date.getUTCDate()),
		"T",
		pad(date.getUTCHours()),
		pad(date.getUTCMinutes()),
		pad(date.getUTCSeconds()),
		"Z",
	].join("");
}

/**
 * Reads a UTC iCalendar stamp (DTSTAMP / LAST-MODIFIED) as epoch milliseconds,
 * for the conflict tiebreak. Returns null when absent or malformed so callers
 * can fall back rather than comparing against NaN.
 */
export function icsStampToEpochMs(raw: string | undefined): number | null {
	if (!raw) return null;
	const parsed = parseIcsDateValue(raw);
	if (!parsed || parsed.dateOnly) return null;

	const match = TASK_DATE_TIME.exec(parsed.value);
	if (!match) return null;
	const [, year, month, day, hour, minute, second] = match;

	const ms = Date.UTC(+year, +month - 1, +day, +hour, +minute, second ? +second : 0);
	return Number.isNaN(ms) ? null : ms;
}

function utcWallTimeToLocal(utcWallTime: string): string | null {
	const match = TASK_DATE_TIME.exec(utcWallTime);
	if (!match) return null;
	const [, year, month, day, hour, minute, second] = match;

	const instant = new Date(
		Date.UTC(+year, +month - 1, +day, +hour, +minute, second ? +second : 0)
	);
	if (Number.isNaN(instant.getTime())) return null;

	return [
		instant.getFullYear(),
		"-",
		pad(instant.getMonth() + 1),
		"-",
		pad(instant.getDate()),
		"T",
		pad(instant.getHours()),
		":",
		pad(instant.getMinutes()),
	].join("");
}

function trimSeconds(wallTime: string): string {
	const match = TASK_DATE_TIME.exec(wallTime);
	if (!match) return wallTime;
	const [, year, month, day, hour, minute] = match;
	return `${year}-${month}-${day}T${hour}:${minute}`;
}

function isRealDate(year: number, month: number, day: number): boolean {
	if (month < 1 || month > 12 || day < 1 || day > 31) return false;
	const probe = new Date(Date.UTC(year, month - 1, day));
	return (
		probe.getUTCFullYear() === year &&
		probe.getUTCMonth() === month - 1 &&
		probe.getUTCDate() === day
	);
}

function pad(value: number): string {
	return String(value).padStart(2, "0");
}
