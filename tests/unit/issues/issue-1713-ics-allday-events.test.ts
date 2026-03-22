/**
 * Issue #1713: Export timeless tasks as all-day events
 *
 * Tasks scheduled for a date without a specific time are exported as ICS events
 * starting at midnight (T000000Z) instead of as all-day events with VALUE=DATE.
 * This causes them to display incorrectly in calendar apps like Evolution and
 * Thunderbird.
 *
 * ROOT CAUSE:
 * CalendarExportService.parseTaskDate() (line ~430) parses date-only strings as
 * `T00:00:00` (midnight). The ICS generation in generateMultipleTasksICSContent()
 * always uses datetime format (YYYYMMDDTHHMMSSZ) and never emits the RFC 5545
 * all-day format `DTSTART;VALUE=DATE:YYYYMMDD`.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1713
 */

import { describe, it, expect } from '@jest/globals';

/**
 * Simulates current parseTaskDate behavior
 */
function parseTaskDate(dateStr: string): Date {
	if (dateStr.includes('T')) {
		return new Date(dateStr);
	} else {
		// BUG: Always adds T00:00:00, treating it as a timed event
		return new Date(`${dateStr}T00:00:00`);
	}
}

/**
 * Detects whether a task date string has a time component
 */
function hasTimeComponent(dateStr: string): boolean {
	return dateStr.includes('T');
}

/**
 * Current ICS formatting - always uses datetime
 */
function formatDateToICS_current(date: Date): string {
	return date
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');
}

/**
 * Proposed fix: format as VALUE=DATE for all-day events
 */
function formatICSDateProperty(dateStr: string, propertyName: string): string {
	if (hasTimeComponent(dateStr)) {
		// Timed event: DTSTART:YYYYMMDDTHHMMSSZ
		const date = new Date(dateStr);
		const icsDate = date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
		return `${propertyName}:${icsDate}`;
	} else {
		// All-day event: DTSTART;VALUE=DATE:YYYYMMDD
		const datePart = dateStr.replace(/-/g, '');
		return `${propertyName};VALUE=DATE:${datePart}`;
	}
}

/**
 * For all-day events, DTEND should be the next day per RFC 5545
 */
function formatICSEndDateForAllDay(dateStr: string): string {
	const date = new Date(dateStr);
	date.setDate(date.getDate() + 1);
	const nextDay = date.toISOString().split('T')[0].replace(/-/g, '');
	return `DTEND;VALUE=DATE:${nextDay}`;
}

describe('Issue #1713: ICS export of timeless tasks as all-day events', () => {
	it.skip('reproduces issue #1713 - date-only task exported with midnight time', () => {
		const scheduledDate = '2026-03-20'; // No time component
		const parsed = parseTaskDate(scheduledDate);
		const icsFormatted = formatDateToICS_current(parsed);

		// BUG: Creates a timed event at midnight instead of an all-day event
		expect(icsFormatted).toContain('T');
		expect(icsFormatted).toMatch(/^\d{8}T\d{6}Z$/);

		// Expected: Should be VALUE=DATE format without time
		// expect(icsFormatted).toMatch(/^\d{8}$/);
	});

	it.skip('verifies fix - date-only tasks use VALUE=DATE format', () => {
		const scheduledDate = '2026-03-20'; // No time component

		const dtstart = formatICSDateProperty(scheduledDate, 'DTSTART');
		expect(dtstart).toBe('DTSTART;VALUE=DATE:20260320');

		const dtend = formatICSEndDateForAllDay(scheduledDate);
		expect(dtend).toBe('DTEND;VALUE=DATE:20260321'); // Next day per RFC 5545
	});

	it.skip('verifies fix - timed tasks still use datetime format', () => {
		const scheduledDateTime = '2026-03-20T14:30:00'; // Has time component

		const dtstart = formatICSDateProperty(scheduledDateTime, 'DTSTART');
		expect(dtstart).toMatch(/^DTSTART:\d{8}T\d{6}Z$/);
		expect(dtstart).not.toContain('VALUE=DATE');
	});

	it.skip('verifies hasTimeComponent detection', () => {
		expect(hasTimeComponent('2026-03-20')).toBe(false);
		expect(hasTimeComponent('2026-03-20T14:30:00')).toBe(true);
		expect(hasTimeComponent('2026-03-20T00:00:00')).toBe(true); // Explicit midnight still timed
	});
});
