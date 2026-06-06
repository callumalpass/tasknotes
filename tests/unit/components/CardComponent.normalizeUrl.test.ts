/**
 * Test for normalizeCalendarUrl function
 *
 * Verifies that webcal:// and webcals:// URLs are correctly normalized
 * to http:// and https:// for calendar subscriptions.
 */

import { normalizeCalendarUrl } from '../../../src/settings/components/CardComponent';

describe('normalizeCalendarUrl', () => {
	it('should convert webcal:// to http://', () => {
		const input = 'webcal://example.com/calendar.ics';
		const output = normalizeCalendarUrl(input);
		expect(output).toBe('http://example.com/calendar.ics');
	});

	it('should convert webcals:// to https://', () => {
		const input = 'webcals://example.com/calendar.ics';
		const output = normalizeCalendarUrl(input);
		expect(output).toBe('https://example.com/calendar.ics');
	});

	it('should handle case-insensitive webcal:// protocol', () => {
		const input = 'WEBCAL://example.com/calendar.ics';
		const output = normalizeCalendarUrl(input);
		expect(output).toBe('http://example.com/calendar.ics');
	});

	it('should handle case-insensitive webcals:// protocol', () => {
		const input = 'WEBCALS://example.com/calendar.ics';
		const output = normalizeCalendarUrl(input);
		expect(output).toBe('https://example.com/calendar.ics');
	});

	it('should not modify http:// URLs', () => {
		const input = 'http://example.com/calendar.ics';
		const output = normalizeCalendarUrl(input);
		expect(output).toBe('http://example.com/calendar.ics');
	});

	it('should not modify https:// URLs', () => {
		const input = 'https://example.com/calendar.ics';
		const output = normalizeCalendarUrl(input);
		expect(output).toBe('https://example.com/calendar.ics');
	});

	it('should not modify file:// URLs', () => {
		const input = 'file:///home/user/Calendar.ics';
		const output = normalizeCalendarUrl(input);
		expect(output).toBe('file:///home/user/Calendar.ics');
	});

	it('should handle Apple iCloud calendar URLs', () => {
		const input = 'webcal://p01-caldav.icloud.com/published/2/MTY3NDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI';
		const output = normalizeCalendarUrl(input);
		expect(output).toBe('http://p01-caldav.icloud.com/published/2/MTY3NDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI');
	});

	it('should handle secure Apple iCloud calendar URLs', () => {
		const input = 'webcals://p01-caldav.icloud.com/published/2/MTY3NDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI';
		const output = normalizeCalendarUrl(input);
		expect(output).toBe('https://p01-caldav.icloud.com/published/2/MTY3NDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI');
	});

	it('should handle empty strings', () => {
		const input = '';
		const output = normalizeCalendarUrl(input);
		expect(output).toBe('');
	});

	it('should handle URLs with query parameters', () => {
		const input = 'webcal://example.com/calendar.ics?key=value&foo=bar';
		const output = normalizeCalendarUrl(input);
		expect(output).toBe('http://example.com/calendar.ics?key=value&foo=bar');
	});

	it('should only replace at the start of the URL', () => {
		// Edge case: webcal:// should only be replaced at the start
		const input = 'webcal://example.com/path/with/webcal://in/it';
		const output = normalizeCalendarUrl(input);
		expect(output).toBe('http://example.com/path/with/webcal://in/it');
	});
});
