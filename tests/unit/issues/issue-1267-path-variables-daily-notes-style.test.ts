/**
 * Tests for Issue #1267: Path Variables like Daily Notes
 *
 * Feature Request Description:
 * Daily Notes has the option to specify path variables using moment.js-style tokens
 * (e.g., YYYY, MM, MMMM, DD, dddd), which improves clarity. The user requests this
 * same syntax to be available in TaskNotes path settings like "Standard note folder".
 *
 * Example from issue:
 * Path: `Meetings/YYYY/MM-MMMM/DD dddd/YYYY-MM-DD`
 * Result: `/Meetings/2025/11-November/28 Friday/2025-11-28 Project Meeting.md`
 *
 * Current state:
 * - TaskNotes uses {{year}}, {{month}}, {{day}} etc. syntax via processFolderTemplate()
 * - The code already processes templates for tasksFolder, but this is not documented
 * - Daily Notes-style syntax (YYYY, MM, DD, MMMM, dddd) is NOT supported
 *
 * This file contains tests that will pass once the feature is implemented.
 *
 * @see https://github.com/taskNotes/taskNotes/issues/1267
 */

import { processFolderTemplate } from '../../../src/utils/folderTemplateProcessor';

describe('Issue #1267: Path Variables like Daily Notes', () => {
	const testDate = new Date('2025-11-28T10:00:00');

	describe('Daily Notes style path variables (moment.js tokens)', () => {
		/**
		 * Test that YYYY token is replaced with four-digit year
		 * Daily Notes uses moment.js format tokens
		 */
		it.skip('reproduces issue #1267 - should support YYYY token for four-digit year', () => {
			const result = processFolderTemplate('Tasks/YYYY', { date: testDate });
			expect(result).toBe('Tasks/2025');
		});

		/**
		 * Test that MM token is replaced with two-digit month
		 */
		it.skip('reproduces issue #1267 - should support MM token for two-digit month', () => {
			const result = processFolderTemplate('Tasks/MM', { date: testDate });
			expect(result).toBe('Tasks/11');
		});

		/**
		 * Test that DD token is replaced with two-digit day
		 */
		it.skip('reproduces issue #1267 - should support DD token for two-digit day', () => {
			const result = processFolderTemplate('Tasks/DD', { date: testDate });
			expect(result).toBe('Tasks/28');
		});

		/**
		 * Test that MMMM token is replaced with full month name
		 */
		it.skip('reproduces issue #1267 - should support MMMM token for full month name', () => {
			const result = processFolderTemplate('Tasks/MMMM', { date: testDate });
			expect(result).toBe('Tasks/November');
		});

		/**
		 * Test that dddd token is replaced with full day name
		 */
		it.skip('reproduces issue #1267 - should support dddd token for full day name', () => {
			const result = processFolderTemplate('Tasks/dddd', { date: testDate });
			expect(result).toBe('Tasks/Friday');
		});

		/**
		 * Test the exact example from the issue:
		 * Path: `Meetings/YYYY/MM-MMMM/DD dddd/YYYY-MM-DD`
		 * Result: `Meetings/2025/11-November/28 Friday/2025-11-28`
		 */
		it.skip('reproduces issue #1267 - should process full Daily Notes style path', () => {
			const result = processFolderTemplate(
				'Meetings/YYYY/MM-MMMM/DD dddd/YYYY-MM-DD',
				{ date: testDate }
			);
			expect(result).toBe('Meetings/2025/11-November/28 Friday/2025-11-28');
		});

		/**
		 * Test combined Daily Notes tokens in a single folder segment
		 */
		it.skip('reproduces issue #1267 - should handle multiple tokens in same segment', () => {
			const result = processFolderTemplate('Tasks/YYYY-MM-DD', { date: testDate });
			expect(result).toBe('Tasks/2025-11-28');
		});

		/**
		 * Test MMM token for abbreviated month name
		 */
		it.skip('reproduces issue #1267 - should support MMM token for abbreviated month name', () => {
			const result = processFolderTemplate('Tasks/MMM', { date: testDate });
			expect(result).toBe('Tasks/Nov');
		});

		/**
		 * Test ddd token for abbreviated day name
		 */
		it.skip('reproduces issue #1267 - should support ddd token for abbreviated day name', () => {
			const result = processFolderTemplate('Tasks/ddd', { date: testDate });
			expect(result).toBe('Tasks/Fri');
		});

		/**
		 * Test YY token for two-digit year
		 */
		it.skip('reproduces issue #1267 - should support YY token for two-digit year', () => {
			const result = processFolderTemplate('Tasks/YY', { date: testDate });
			expect(result).toBe('Tasks/25');
		});
	});

	describe('current TaskNotes syntax works (baseline tests)', () => {
		/**
		 * Verify that existing {{year}} syntax continues to work
		 */
		it('confirms existing {{year}} syntax works', () => {
			const result = processFolderTemplate('Tasks/{{year}}', { date: testDate });
			expect(result).toBe('Tasks/2025');
		});

		/**
		 * Verify that existing {{month}} syntax continues to work
		 */
		it('confirms existing {{month}} syntax works', () => {
			const result = processFolderTemplate('Tasks/{{month}}', { date: testDate });
			expect(result).toBe('Tasks/11');
		});

		/**
		 * Verify that existing {{day}} syntax continues to work
		 */
		it('confirms existing {{day}} syntax works', () => {
			const result = processFolderTemplate('Tasks/{{day}}', { date: testDate });
			expect(result).toBe('Tasks/28');
		});

		/**
		 * Verify that existing {{monthName}} syntax continues to work
		 */
		it('confirms existing {{monthName}} syntax works', () => {
			const result = processFolderTemplate('Tasks/{{monthName}}', { date: testDate });
			expect(result).toBe('Tasks/November');
		});

		/**
		 * Verify that existing {{dayName}} syntax continues to work
		 */
		it('confirms existing {{dayName}} syntax works', () => {
			const result = processFolderTemplate('Tasks/{{dayName}}', { date: testDate });
			expect(result).toBe('Tasks/Friday');
		});
	});
});
