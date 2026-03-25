/**
 * Issue #1720: tasknotesTaskList renders date-like Bases values as icon names
 * (e.g. "clock") and ignores property display names
 *
 * Bug Description:
 * In a tasknotesTaskList Bases view, date-like properties render as the Lucide icon name
 * (e.g. "clock") instead of the human-readable value. Additionally, property labels use
 * the raw property/formula id instead of the configured Bases display name.
 *
 * Root cause:
 * 1. extractBasesValue() in TaskCard.ts returns v.data before checking v.display or v.date
 *    for non-link Bases value objects. For date-like values, v.data holds the icon token
 *    while v.display holds the human-readable text.
 * 2. renderGenericProperty() derives labels from raw propertyId instead of Bases display names.
 * 3. The date fallback only checks for "lucide-calendar" icon, missing "lucide-clock".
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1720
 */

import { describe, it, expect } from '@jest/globals';

describe('Issue #1720: Bases date-like value rendering', () => {
	/**
	 * Simulates the extractBasesValue logic to demonstrate the bug.
	 * This mirrors the current implementation in src/ui/TaskCard.ts lines 550-595.
	 */
	function extractBasesValueCurrent(value: unknown): unknown {
		if (value && typeof value === 'object' && 'icon' in value) {
			const v = value as Record<string, unknown>;

			// Handle link results
			if (v.icon === 'lucide-link' && 'data' in v && v.data !== null && v.data !== undefined) {
				return v.data;
			}

			// BUG: Returns data first, which may be the icon token for date-like values
			if ('data' in v && v.data !== null && v.data !== undefined) {
				return v.data;
			}
			// BUG: Only checks lucide-calendar, misses lucide-clock
			if (v.icon === 'lucide-calendar' && 'date' in v) {
				return v.date;
			}
			if ('display' in v && v.display !== null && v.display !== undefined) {
				return v.display;
			}
			if (v.icon === 'lucide-file-question' || v.icon === 'lucide-help-circle') {
				return '';
			}
			return v.icon ? String(v.icon).replace('lucide-', '') : '';
		}
		return value;
	}

	describe('extractBasesValue with date-like Bases objects', () => {
		it.skip('reproduces issue #1720: relative date formula returns icon token instead of display text', () => {
			// Bases value object for file.mtime.relative() formula
			const basesValue = {
				icon: 'lucide-clock',
				data: 'clock',
				display: '13 days ago',
			};

			const result = extractBasesValueCurrent(basesValue);

			// BUG: Currently returns "clock" (the data field) instead of "13 days ago"
			// Expected: should return "13 days ago" (the display field)
			expect(result).toBe('13 days ago');
			// Actual: returns "clock"
		});

		it.skip('reproduces issue #1720: date property with lucide-clock icon falls through to wrong value', () => {
			// Bases value object for a date property rendered with clock icon
			const basesValue = {
				icon: 'lucide-clock',
				date: '2026-03-13',
				display: 'Mar 13',
			};

			const result = extractBasesValueCurrent(basesValue);

			// BUG: Falls through because icon !== "lucide-calendar", returns icon name
			// Expected: should return the date or display value
			expect(result).toBe('Mar 13');
			// Actual: returns "clock" from the fallback
		});

		it.skip('reproduces issue #1720: calendar date should still work with display preference', () => {
			// Bases value object with both display and date
			const basesValue = {
				icon: 'lucide-calendar',
				data: 'calendar',
				date: '2026-03-13',
				display: 'Mar 13, 2026',
			};

			const result = extractBasesValueCurrent(basesValue);

			// BUG: Returns "calendar" (data field) because data is checked first
			// Expected: should return "Mar 13, 2026" (display field)
			expect(result).toBe('Mar 13, 2026');
		});
	});

	describe('renderGenericProperty label derivation', () => {
		it.skip('reproduces issue #1720: formula property label uses raw ID instead of display name', () => {
			// Current logic: propertyId.startsWith("formula.") -> substring(8)
			const propertyId = 'formula.lastTouched';
			const expectedLabel = 'Last touched'; // Configured Bases display name

			// Current implementation just strips "formula." prefix
			const currentLabel = propertyId.substring(8); // "lastTouched"

			// BUG: Returns raw formula name instead of configured display name
			expect(currentLabel).toBe(expectedLabel);
			// Actual: returns "lastTouched"
		});

		it.skip('reproduces issue #1720: custom property label uses raw ID with incorrect casing', () => {
			const propertyId = 'modified-c';
			const expectedLabel = 'Modified c'; // Or whatever Bases configures

			// Current implementation: charAt(0).toUpperCase() + slice(1)
			const currentLabel = propertyId.charAt(0).toUpperCase() + propertyId.slice(1);

			// Returns "Modified-c" with the hyphen, not the Bases display name
			expect(currentLabel).toBe('Modified-c'); // This actually passes but is wrong
			// The label should come from Bases display name configuration, not derived from ID
		});
	});
});
