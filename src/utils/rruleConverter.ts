/**
 * Utility for converting TaskNotes RRULE format to Google Calendar recurrence format.
 *
 * TaskNotes format: "DTSTART:YYYYMMDD;FREQ=DAILY;INTERVAL=1;BYDAY=MO,TU"
 * Google format: ["RRULE:FREQ=DAILY;INTERVAL=1;BYDAY=MO,TU", "EXDATE:20240115"]
 *
 * Key differences:
 * 1. DTSTART is NOT included in Google Calendar recurrence array (separate start field)
 * 2. EXDATE rules are separate entries in the array
 * 3. Google expects "RRULE:" prefix for recurrence rules
 */

import { RRule } from "rrule";

export interface GoogleRecurrenceData {
	/** Recurrence array for Google Calendar API */
	recurrence: string[];
	/** Extracted DTSTART date in YYYY-MM-DD format */
	dtstart: string;
	/** Whether the event has a time component */
	hasTime: boolean;
	/** Extracted time in HH:MM:SS format if present */
	time?: string;
}

export interface ConversionOptions {
	/** Validate against the DATE start actually exported to Google. */
	allDay?: boolean;
	/** Completed instances to exclude via EXDATE (YYYY-MM-DD format) */
	completedInstances?: string[];
	/** Skipped instances to exclude via EXDATE (YYYY-MM-DD format) */
	skippedInstances?: string[];
	/** Additional dates to exclude via EXDATE (YYYY-MM-DD format) */
	additionalExcludedDates?: string[];
}

/**
 * Converts TaskNotes RRULE to Google Calendar recurrence format.
 *
 * @param tasknotesRrule - TaskNotes RRULE string (with embedded DTSTART)
 * @param options - Optional completed/skipped instances to convert to EXDATE
 * @returns Google Calendar recurrence data or null if invalid
 */
export function convertToGoogleRecurrence(
	tasknotesRrule: string,
	options?: ConversionOptions
): GoogleRecurrenceData | null {
	if (!tasknotesRrule) return null;

	// Extract DTSTART from the rule
	// Supports both date-only (YYYYMMDD) and datetime (YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ)
	const dtstartMatch = tasknotesRrule.match(/DTSTART:(\d{8})(T(\d{6})Z?)?;?/);
	if (!dtstartMatch) return null;

	const dateStr = dtstartMatch[1]; // YYYYMMDD
	const timeStr = dtstartMatch[3]; // HHMMSS or undefined
	const hasTime = !!timeStr;

	// Convert YYYYMMDD to YYYY-MM-DD
	const dtstart = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;

	// Convert HHMMSS to HH:MM:SS if present
	const time = timeStr
		? `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}:${timeStr.slice(4, 6)}`
		: undefined;

	// Remove DTSTART from the RRULE and add RRULE: prefix
	const rruleWithoutDtstart = tasknotesRrule
		.replace(/DTSTART:\d{8}(T\d{6}Z?)?;?/, "")
		.trim();

	// Validate that we have a meaningful RRULE
	if (!rruleWithoutDtstart || !rruleWithoutDtstart.includes("FREQ=")) {
		return null;
	}

	// Build the recurrence array
	const recurrence: string[] = [`RRULE:${rruleWithoutDtstart}`];

	// Add EXDATE entries for completed and skipped instances
	const excludedDates = [
		...(options?.completedInstances || []),
		...(options?.skippedInstances || []),
		...(options?.additionalExcludedDates || []),
	];
	const validDates = [...new Set(excludedDates)].filter((date) =>
		/^\d{4}-\d{2}-\d{2}$/.test(date) &&
		!Number.isNaN(Date.parse(date)) &&
		new Date(date).toISOString().slice(0, 10) === date
	);
	if (validDates.length > 0) {
		// One bounded expansion, not one full traversal per exclusion. Use the
		// effective exported DTSTART so DATE events retain the last UNTIL day.
		const ruleOptions = RRule.parseString(rruleWithoutDtstart);
		ruleOptions.dtstart = new Date(`${dtstart}T${options?.allDay || !time ? "00:00:00" : time}Z`);
		const rule = new RRule(ruleOptions);
		const sorted = [...validDates].sort();
		const members = new Set(rule.between(
			new Date(`${sorted[0]}T00:00:00Z`),
			new Date(`${sorted[sorted.length - 1]}T23:59:59Z`),
			true
		).map((date) => date.toISOString().slice(0, 10)));
		recurrence.push(...formatExdates(validDates.filter((date) => members.has(date))));
	}

	return {
		recurrence,
		dtstart,
		hasTime,
		time,
	};
}

/**
 * Formats date strings as EXDATE entries for Google Calendar.
 *
 * @param dates - Array of dates in YYYY-MM-DD format
 * @returns Array of EXDATE strings in YYYYMMDD format
 */
export function formatExdates(dates: string[]): string[] {
	if (!dates || dates.length === 0) return [];

	return dates
		.filter((date) => date && /^\d{4}-\d{2}-\d{2}$/.test(date))
		.map((date) => {
			// Convert YYYY-MM-DD to YYYYMMDD with VALUE=DATE per RFC 5545
			const compact = date.replace(/-/g, "");
			return `EXDATE;VALUE=DATE:${compact}`;
		});
}

/**
 * Validates that an RRULE is compatible with Google Calendar.
 * Google Calendar supports a subset of RFC 5545.
 *
 * @param rrule - RRULE string to validate
 * @returns true if compatible with Google Calendar
 */
export function isGoogleCompatibleRrule(rrule: string): boolean {
	if (!rrule) return false;

	// Must have FREQ component
	if (!rrule.includes("FREQ=")) return false;

	// Check for supported FREQ values
	const freqMatch = rrule.match(/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/);
	if (!freqMatch) return false;

	// Google Calendar doesn't support these (uncommon) RFC 5545 features:
	// - BYSECOND, BYMINUTE (too granular)
	// - BYHOUR (rarely used)
	// These would silently be ignored or cause issues
	const unsupportedPatterns = [/BYSECOND=/, /BYMINUTE=/, /BYHOUR=/];
	for (const pattern of unsupportedPatterns) {
		if (pattern.test(rrule)) return false;
	}

	return true;
}

/**
 * Extracts the DTSTART from a TaskNotes RRULE string.
 *
 * @param rrule - TaskNotes RRULE string
 * @returns DTSTART in YYYY-MM-DD format, or null if not found
 */
export function extractDTSTART(rrule: string): string | null {
	if (!rrule) return null;

	const match = rrule.match(/DTSTART:(\d{8})/);
	if (!match) return null;

	const dateStr = match[1];
	return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
}
