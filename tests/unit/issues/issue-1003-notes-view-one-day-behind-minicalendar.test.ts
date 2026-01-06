/**
 * Test to verify Issue #1003: Notes view one day behind the minicalendar
 *
 * Bug Description:
 * When clicking on a date in the mini calendar, the notes view shows notes
 * from the previous day instead of the selected day. This is a timezone-related
 * off-by-one day bug.
 *
 * This issue is related to #857 (Mini Calendar opens previous day when clicked)
 * which was fixed for opening daily notes, but this report suggests the issue
 * may persist in how notes are displayed/fetched for the selected date.
 *
 * Root Cause Hypothesis:
 * The bug likely occurs when converting between UTC-anchored dates and local dates
 * for display or lookup. The minicalendar uses UTC-anchored dates internally, but
 * when looking up notes for a given date, there may be a mismatch in how the date
 * key is calculated vs how it's stored.
 *
 * Key locations:
 * - src/bases/MiniCalendarView.ts:handleDayClick() - date selection handler
 * - src/bases/MiniCalendarView.ts:indexNotesByDate() - note indexing by date
 * - src/utils/dateUtils.ts:convertUTCToLocalCalendarDate() - date conversion
 * - src/utils/dateUtils.ts:formatDateForStorage() - date key generation
 */

import { formatDateForStorage, convertUTCToLocalCalendarDate, getDatePart } from '../../../src/utils/dateUtils';

// Set timezone to test edge cases
process.env.TZ = "America/Los_Angeles"; // UTC-8 (or UTC-7 during DST)

describe('Issue #1003: Notes view one day behind minicalendar', () => {
	describe('Date key consistency between calendar and notes lookup', () => {
		it.skip('reproduces issue #1003: clicking a date should show notes for that exact date', () => {
			// User clicks on January 15, 2025 in the mini calendar
			// The calendar creates a UTC-anchored date
			const clickedDateUTC = new Date(Date.UTC(2025, 0, 15, 0, 0, 0)); // Jan 15, 2025 00:00 UTC

			console.log('=== Mini Calendar Click Simulation ===');
			console.log('User clicks on: January 15, 2025');
			console.log('UTC-anchored date created:', clickedDateUTC.toISOString());
			console.log('Local interpretation:', clickedDateUTC.toString());

			// In handleDayClick, the date is converted to a key for lookup
			const dateKeyForLookup = formatDateForStorage(clickedDateUTC);
			console.log('Date key used for note lookup:', dateKeyForLookup);

			// The notes were indexed using getDatePart on their date property
			// Simulate a note with date "2025-01-15" stored in frontmatter
			const noteStoredDateValue = "2025-01-15";
			const noteIndexKey = getDatePart(noteStoredDateValue);
			console.log('Note index key from storage:', noteIndexKey);

			// These should match for the correct behavior
			expect(dateKeyForLookup).toBe(noteIndexKey);
			expect(dateKeyForLookup).toBe("2025-01-15");

			// However, if there's a timezone conversion issue, they might not match
			// This test documents the expected behavior
		});

		it.skip('reproduces issue #1003: date display vs notes lookup mismatch in negative UTC offset timezones', () => {
			// This tests the scenario where the displayed date differs from the lookup date
			// In Pacific timezone (UTC-8), UTC midnight Jan 15 is displayed as Jan 14 at 4pm

			// Calendar day that user sees and clicks: January 15
			// Calendar creates UTC date for Jan 15
			const calendarDayUTC = new Date(Date.UTC(2025, 0, 15, 0, 0, 0));

			console.log('\n=== Timezone Mismatch Scenario ===');
			console.log('Calendar displays: January 15, 2025');
			console.log('UTC Date object:', calendarDayUTC.toISOString());

			// formatDateForStorage uses UTC methods - should return "2025-01-15"
			const storageKey = formatDateForStorage(calendarDayUTC);
			console.log('formatDateForStorage result (UTC methods):', storageKey);

			// convertUTCToLocalCalendarDate creates a local Date with same calendar components
			const localCalendarDate = convertUTCToLocalCalendarDate(calendarDayUTC);
			console.log('convertUTCToLocalCalendarDate result:', localCalendarDate.toString());
			console.log('Local date parts: Year:', localCalendarDate.getFullYear(),
				'Month:', localCalendarDate.getMonth() + 1,
				'Day:', localCalendarDate.getDate());

			// The local date should represent January 15 in local time
			expect(localCalendarDate.getFullYear()).toBe(2025);
			expect(localCalendarDate.getMonth()).toBe(0); // January
			expect(localCalendarDate.getDate()).toBe(15);

			// And formatDateForStorage should give "2025-01-15" for the UTC-anchored date
			expect(storageKey).toBe("2025-01-15");
		});

		it.skip('reproduces issue #1003: notes indexed with datetime values may cause lookup mismatch', () => {
			// When notes have datetime values (not just dates), there could be conversion issues

			// Note has a datetime value in local timezone
			const noteDateTimeValue = "2025-01-15T10:00:00"; // Local time, no timezone
			const noteDateKey = getDatePart(noteDateTimeValue);
			console.log('\n=== DateTime Note Scenario ===');
			console.log('Note datetime value:', noteDateTimeValue);
			console.log('Extracted date key:', noteDateKey);

			// Calendar date for Jan 15
			const calendarDateUTC = new Date(Date.UTC(2025, 0, 15, 0, 0, 0));
			const calendarLookupKey = formatDateForStorage(calendarDateUTC);
			console.log('Calendar lookup key:', calendarLookupKey);

			// These should match
			expect(noteDateKey).toBe(calendarLookupKey);
			expect(noteDateKey).toBe("2025-01-15");
		});
	});

	describe('Edge case: Date boundary at midnight UTC', () => {
		it.skip('reproduces issue #1003: late evening local time should not show previous day notes', () => {
			// In Pacific timezone at 11pm on Jan 14, the UTC date is Jan 15
			// If user clicks Jan 14 in calendar, they should see Jan 14 notes

			// User clicks on January 14 in the calendar
			const clickedJan14UTC = new Date(Date.UTC(2025, 0, 14, 0, 0, 0));
			const jan14Key = formatDateForStorage(clickedJan14UTC);

			console.log('\n=== Date Boundary Edge Case ===');
			console.log('User clicks: January 14, 2025');
			console.log('UTC representation:', clickedJan14UTC.toISOString());
			console.log('Lookup key:', jan14Key);

			// Note stored for Jan 14
			const noteForJan14 = { dateValue: "2025-01-14", title: "Jan 14 Note" };
			const noteKey = getDatePart(noteForJan14.dateValue);

			console.log('Note date key:', noteKey);

			// They should match
			expect(jan14Key).toBe(noteKey);
			expect(jan14Key).toBe("2025-01-14");
		});

		it.skip('reproduces issue #1003: clicking should never show adjacent day notes', () => {
			// Test that clicking any date X always shows notes for date X, not X-1 or X+1

			const testDates = [
				{ month: 0, day: 1, expected: "2025-01-01" },  // New Year
				{ month: 0, day: 31, expected: "2025-01-31" }, // End of Jan
				{ month: 1, day: 28, expected: "2025-02-28" }, // End of Feb (non-leap)
				{ month: 2, day: 9, expected: "2025-03-09" },  // DST transition (US)
				{ month: 10, day: 2, expected: "2025-11-02" }, // DST transition (US)
				{ month: 11, day: 31, expected: "2025-12-31" }, // New Year's Eve
			];

			console.log('\n=== Multiple Date Validation ===');

			testDates.forEach(({ month, day, expected }) => {
				const calendarDateUTC = new Date(Date.UTC(2025, month, day, 0, 0, 0));
				const lookupKey = formatDateForStorage(calendarDateUTC);

				console.log(`Calendar date UTC ${calendarDateUTC.toISOString()} -> Key: ${lookupKey}`);

				expect(lookupKey).toBe(expected);
			});
		});
	});

	describe('Potential bug location: conversion function behavior', () => {
		it.skip('reproduces issue #1003: convertUTCToLocalCalendarDate may shift days in certain timezones', () => {
			// convertUTCToLocalCalendarDate extracts UTC components and creates a local Date
			// This should preserve the calendar date, but there could be edge cases

			const utcDate = new Date(Date.UTC(2025, 0, 15, 0, 0, 0)); // Jan 15 midnight UTC
			const localDate = convertUTCToLocalCalendarDate(utcDate);

			console.log('\n=== convertUTCToLocalCalendarDate Analysis ===');
			console.log('Input UTC:', utcDate.toISOString());
			console.log('Output local:', localDate.toString());
			console.log('Output ISO:', localDate.toISOString());

			// Check if the calendar date is preserved
			const inputYear = utcDate.getUTCFullYear();
			const inputMonth = utcDate.getUTCMonth();
			const inputDay = utcDate.getUTCDate();

			const outputYear = localDate.getFullYear();
			const outputMonth = localDate.getMonth();
			const outputDay = localDate.getDate();

			console.log(`Input components: ${inputYear}-${inputMonth + 1}-${inputDay}`);
			console.log(`Output components: ${outputYear}-${outputMonth + 1}-${outputDay}`);

			// The calendar date should be preserved
			expect(outputYear).toBe(inputYear);
			expect(outputMonth).toBe(inputMonth);
			expect(outputDay).toBe(inputDay);
		});

		it.skip('reproduces issue #1003: moment.js interpretation of UTC dates', () => {
			// When openDailyNoteForDate passes a date to moment(), it may interpret
			// the date differently than expected

			// UTC date for Jan 15 midnight
			const utcDate = new Date(Date.UTC(2025, 0, 15, 0, 0, 0));

			// When passed directly to moment(date), it interprets in local timezone
			// In Pacific (UTC-8), this becomes Jan 14 at 4pm

			console.log('\n=== Moment.js Interpretation Issue ===');
			console.log('UTC Date:', utcDate.toISOString());
			console.log('If passed to moment(date) in Pacific timezone:');
			console.log('  moment interprets as:', utcDate.toString());
			console.log('  Which is January 14 in Pacific timezone');

			// The fix in openDailyNoteForDate converts to local calendar date first
			const localAnchor = convertUTCToLocalCalendarDate(utcDate);
			console.log('After convertUTCToLocalCalendarDate:', localAnchor.toString());
			console.log('This preserves January 15 in the local timezone');

			// Verify the fix works
			expect(localAnchor.getDate()).toBe(15);
			expect(localAnchor.getMonth()).toBe(0); // January
		});
	});
});
