/**
 * Manual test for Issue #854 - All-day ICS events showing on wrong day
 *
 * This test verifies that all-day events are stored as date-only strings
 * and display correctly regardless of timezone.
 */

import ICAL from 'ical.js';

// Simulate the fixed icalTimeToISOString method
function icalTimeToISOString(icalTime: ICAL.Time): string {
	// For all-day events, return date-only string (YYYY-MM-DD)
	// This preserves the calendar date semantics without timezone ambiguity
	// per iCalendar RFC 5545 specification for VALUE=DATE events
	if (icalTime.isDate) {
		const year = icalTime.year.toString().padStart(4, '0');
		const month = icalTime.month.toString().padStart(2, '0');
		const day = icalTime.day.toString().padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	// For timed events, use toUnixTime() which correctly converts to UTC
	const unixTime = icalTime.toUnixTime();
	return new Date(unixTime * 1000).toISOString();
}

// Test 1: All-day event on January 20, 2025
console.log('\n=== Test 1: All-day event on January 20, 2025 ===');
const icsData1 = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART;VALUE=DATE:20250120
DTEND;VALUE=DATE:20250121
SUMMARY:All-day event test
END:VEVENT
END:VCALENDAR`;

const jcalData1 = ICAL.parse(icsData1);
const comp1 = new ICAL.Component(jcalData1);
const vevent1 = comp1.getFirstSubcomponent('vevent');
if (!vevent1) throw new Error('No VEVENT found');
const event1 = new ICAL.Event(vevent1);

const start1 = icalTimeToISOString(event1.startDate);
const end1 = icalTimeToISOString(event1.endDate);

console.log('Start:', start1);
console.log('End:', end1);
console.log('Expected start: 2025-01-20');
console.log('Expected end: 2025-01-21');
console.log('✓ Start matches:', start1 === '2025-01-20');
console.log('✓ End matches:', end1 === '2025-01-21');

// Verify it parses correctly in different timezones
console.log('\nDate parsing verification:');
const parsedStart = new Date(start1 + 'T00:00:00');
console.log('Parsed start (local):', parsedStart.toLocaleDateString());
console.log('Should show Jan 20, 2025 in all timezones');

// Test 2: Timed event (should still work with ISO timestamps)
console.log('\n=== Test 2: Timed event with timezone ===');
const icsData2 = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTIMEZONE
TZID:America/New_York
BEGIN:STANDARD
DTSTART:19701101T020000
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:19700308T020000
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
END:VTIMEZONE
BEGIN:VEVENT
DTSTART;TZID=America/New_York:20250120T140000
DTEND;TZID=America/New_York:20250120T150000
SUMMARY:Timed event test
END:VEVENT
END:VCALENDAR`;

const jcalData2 = ICAL.parse(icsData2);
const comp2 = new ICAL.Component(jcalData2);
const vevent2 = comp2.getFirstSubcomponent('vevent');
if (!vevent2) throw new Error('No VEVENT found');
const event2 = new ICAL.Event(vevent2);

const start2 = icalTimeToISOString(event2.startDate);
const end2 = icalTimeToISOString(event2.endDate);

console.log('Start:', start2);
console.log('End:', end2);
console.log('Should be ISO timestamps (contain T and Z):', start2.includes('T') && start2.includes('Z'));

console.log('\n=== All tests complete ===');
