/**
 * Tests for Issue #1086: White colouration when expanding more tasks on calendar tasks (dark mode)
 *
 * Bug Description:
 * When there are many tasks in the all-day slot in calendar, expanding them
 * (clicking the "+more" link) makes them completely white (text and background)
 * in dark mode, making the content invisible.
 *
 * Root Cause:
 * The `.fc-more-link` CSS class (used for the "more" expand button in the day grid
 * all-day area) only has light mode styling. There is no `.theme-dark` override
 * for this element, unlike `.fc-timegrid-more-link` which does have dark mode styling.
 *
 * Relevant code:
 * - styles/advanced-calendar-view.css - Lines 880-889 (missing dark mode rules)
 * - For comparison, see lines 1323-1332 for proper dark mode handling of `.fc-timegrid-more-link`
 *
 * Expected behavior:
 * The "more" link and expanded task list should have proper dark mode styling
 * with appropriate text and background colors that are visible.
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

/**
 * These tests verify that dark mode CSS rules exist for the calendar "more" link
 * that appears when there are too many tasks to display in the all-day area.
 */
describe('Issue #1086: White colouration when expanding more tasks in dark mode', () => {
	const cssFilePath = path.resolve(__dirname, '../../../styles/advanced-calendar-view.css');

	describe('CSS dark mode rules for .fc-more-link', () => {
		it.skip('should have dark mode styling for .fc-more-link - reproduces issue #1086', () => {
			// This test verifies that dark mode CSS rules exist for the "more" link
			// in the all-day event area of the calendar.
			//
			// Steps to reproduce the bug:
			// 1. Enable dark mode in Obsidian
			// 2. Create many tasks with the same scheduled date (more than fit in all-day slot)
			// 3. Open the calendar view
			// 4. Click the "+X more" link to expand the hidden tasks
			// 5. Expected: Tasks appear with readable text on appropriate dark background
			// 6. Actual: Tasks appear white on white, making them invisible

			const cssContent = fs.readFileSync(cssFilePath, 'utf-8');

			// The CSS should have dark mode rules for .fc-more-link
			// Similar to how it handles .fc-timegrid-more-link (lines 1323-1332)
			const hasDarkModeMoreLink = cssContent.includes('.theme-dark') &&
				cssContent.includes('.fc-more-link') &&
				// Check that the dark mode rule applies to .fc-more-link specifically
				/\.theme-dark\s+\.advanced-calendar-view\s+\.fc-more-link/.test(cssContent);

			expect(hasDarkModeMoreLink).toBe(true);
		});

		it('should have proper light mode styling for .fc-more-link (baseline)', () => {
			// Verify that light mode styling exists (which it does)
			const cssContent = fs.readFileSync(cssFilePath, 'utf-8');

			const hasLightModeMoreLink =
				cssContent.includes('.advanced-calendar-view .fc-more-link');

			expect(hasLightModeMoreLink).toBe(true);
		});

		it('should have dark mode styling for .fc-timegrid-more-link (for comparison)', () => {
			// This shows that dark mode handling IS implemented for the timegrid version
			// The fix for issue #1086 should follow the same pattern
			const cssContent = fs.readFileSync(cssFilePath, 'utf-8');

			const hasDarkModeTimegridMoreLink =
				cssContent.includes('.theme-dark .advanced-calendar-view .fc-timegrid-more-link');

			expect(hasDarkModeTimegridMoreLink).toBe(true);
		});

		it('should have dark mode styling for .fc-popover (the expanded popup)', () => {
			// The popover that shows expanded events has proper dark mode styling
			// This was fixed previously, but the link that opens it was not
			const cssContent = fs.readFileSync(cssFilePath, 'utf-8');

			const hasDarkModePopover =
				cssContent.includes('.theme-dark .advanced-calendar-view .fc-popover');

			expect(hasDarkModePopover).toBe(true);
		});
	});

	describe('Expected CSS variables for dark mode fix', () => {
		it('should document the expected CSS variables for the fix', () => {
			// This test documents what CSS variables should be used for the fix
			// Based on the pattern used for .fc-timegrid-more-link

			const expectedDarkModeRules = {
				selector: '.theme-dark .advanced-calendar-view .fc-more-link',
				properties: {
					color: 'var(--text-normal)',
					background: 'var(--background-secondary)',
					borderColor: 'var(--background-modifier-border)',
				},
			};

			// This is a documentation test - the actual fix should use these values
			expect(expectedDarkModeRules.selector).toContain('.theme-dark');
			expect(expectedDarkModeRules.properties.color).toBe('var(--text-normal)');
		});
	});
});

describe('FullCalendar more link styling consistency', () => {
	/**
	 * The calendar uses two types of "more" links:
	 * 1. .fc-more-link - in the all-day (dayGrid) area
	 * 2. .fc-timegrid-more-link - in the time slots area
	 *
	 * Both should have consistent dark mode styling.
	 */

	it.skip('should have consistent dark mode styling for both more link types - reproduces issue #1086', () => {
		// Both link types should have dark mode styling for consistency
		// Currently only .fc-timegrid-more-link has dark mode rules

		const cssFilePath = path.resolve(__dirname, '../../../styles/advanced-calendar-view.css');
		const cssContent = fs.readFileSync(cssFilePath, 'utf-8');

		const hasDarkModeMoreLink = /\.theme-dark\s+\.advanced-calendar-view\s+\.fc-more-link/.test(cssContent);
		const hasDarkModeTimegridMoreLink = cssContent.includes('.theme-dark .advanced-calendar-view .fc-timegrid-more-link');

		// Both should have dark mode styling for consistency
		expect(hasDarkModeMoreLink).toBe(true);
		expect(hasDarkModeTimegridMoreLink).toBe(true);
	});
});
