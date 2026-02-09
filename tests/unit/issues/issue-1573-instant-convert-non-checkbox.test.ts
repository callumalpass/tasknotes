/**
 * Skipped reproduction tests for Issue #1573:
 * [Bug]: Instant Task Conversion only working with checkboxes
 *
 * Bug Description:
 * The documentation states that the Instant Task Conversion button should
 * appear for multiple line types (bullet points, numbered lists, blockquotes,
 * plain text), but the button only shows up for checkbox lines (- [ ] / - [x]).
 *
 * Steps to reproduce:
 * 1. Enable Instant Task Conversion in plugin settings
 * 2. In a markdown note, type a bullet point line: "- Buy groceries"
 * 3. Observe: no convert button appears at the end of the line
 * 4. Change the line to a checkbox: "- [ ] Buy groceries"
 * 5. Observe: the convert button now appears
 *
 * Root cause:
 * In InstantConvertButtons.ts, the buildConvertButtonDecorations() function
 * (line ~227) only creates the convert button when:
 *   `taskLineInfo.isTaskLine && taskLineInfo.parsedData`
 *
 * TasksPluginParser.parseTaskLine() only sets isTaskLine=true for checkbox
 * patterns (- [ ], - [x], etc.), so non-checkbox lines never get the button.
 *
 * However, the InstantTaskConvertService.instantConvertTask() method (line ~179)
 * already handles non-checkbox lines via extractLineContentAsTitle(), which
 * strips bullets, numbers, blockquotes, and headers to produce a task title.
 *
 * Additionally, ConvertButtonWidget.validateEditorState() (line ~135) has a
 * secondary gate that also rejects non-checkbox lines, which would need to be
 * relaxed alongside the decoration builder.
 *
 * Affected source files:
 * - src/editor/InstantConvertButtons.ts (buildConvertButtonDecorations, validateEditorState)
 * - src/services/InstantTaskConvertService.ts (instantConvertTask, extractLineContentAsTitle)
 * - src/utils/TasksPluginParser.ts (parseTaskLine — only matches checkboxes)
 *
 * Documentation references:
 * - https://tasknotes.dev/features/inline-tasks/#instant-task-conversion
 * - https://tasknotes.dev/features/inline-tasks/#supported-line-types
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1573
 */

import { describe, it, expect } from '@jest/globals';
import { TasksPluginParser } from '../../../src/utils/TasksPluginParser';

describe('Issue #1573: Instant Task Conversion only working with checkboxes', () => {

	describe('button visibility for different line types', () => {
		/**
		 * The buildConvertButtonDecorations function uses TasksPluginParser.parseTaskLine()
		 * to decide whether to show the convert button. Since parseTaskLine() only recognises
		 * checkbox patterns, all other documented line types are excluded.
		 *
		 * These tests demonstrate that parseTaskLine returns isTaskLine=false for supported
		 * non-checkbox line types, which causes the button to be hidden.
		 */

		it.skip('reproduces issue #1573 - bullet point lines should be eligible for conversion button', () => {
			const bulletLine = '- Buy groceries';
			const result = TasksPluginParser.parseTaskLine(bulletLine);

			// Currently: isTaskLine is false, so no button is shown
			// Expected: the button should appear for bullet point lines
			expect(result.isTaskLine).toBe(false); // This passes — demonstrating the bug

			// Once fixed, the button should be shown for this line.
			// The conversion service already supports it via extractLineContentAsTitle().
		});

		it.skip('reproduces issue #1573 - numbered list lines should be eligible for conversion button', () => {
			const numberedLine = '1. First task item';
			const result = TasksPluginParser.parseTaskLine(numberedLine);

			// Currently: isTaskLine is false, so no button is shown
			expect(result.isTaskLine).toBe(false); // This passes — demonstrating the bug
		});

		it.skip('reproduces issue #1573 - blockquote lines should be eligible for conversion button', () => {
			const blockquoteLine = '> Important task to handle';
			const result = TasksPluginParser.parseTaskLine(blockquoteLine);

			// Currently: isTaskLine is false, so no button is shown
			expect(result.isTaskLine).toBe(false); // This passes — demonstrating the bug
		});

		it.skip('reproduces issue #1573 - plain text lines should be eligible for conversion button', () => {
			const plainText = 'Pick up dry cleaning tomorrow';
			const result = TasksPluginParser.parseTaskLine(plainText);

			// Currently: isTaskLine is false, so no button is shown
			expect(result.isTaskLine).toBe(false); // This passes — demonstrating the bug
		});

		it.skip('reproduces issue #1573 - checkbox lines correctly show the button (control case)', () => {
			const checkboxLine = '- [ ] Buy groceries';
			const result = TasksPluginParser.parseTaskLine(checkboxLine);

			// This works correctly — checkbox lines DO get the button
			expect(result.isTaskLine).toBe(true);
			expect(result.parsedData).toBeDefined();
			expect(result.parsedData?.title).toBe('Buy groceries');
		});
	});

	describe('conversion service handles non-checkbox lines', () => {
		/**
		 * The InstantTaskConvertService.instantConvertTask() already has logic to
		 * handle non-checkbox lines (line ~179-207). It calls extractLineContentAsTitle()
		 * to strip list markers, blockquote prefixes, and headers.
		 *
		 * This means the backend supports non-checkbox conversion, but the UI
		 * (button visibility) doesn't expose it for those line types.
		 */

		it.skip('reproduces issue #1573 - service can extract title from bullet point', () => {
			// extractLineContentAsTitle is private, but we can verify the pattern it uses
			const bulletLine = '- Buy groceries';
			const cleaned = bulletLine.trim().replace(/^\s*[-*+]\s+/, '');
			expect(cleaned).toBe('Buy groceries');
		});

		it.skip('reproduces issue #1573 - service can extract title from numbered list', () => {
			const numberedLine = '1. First task item';
			const cleaned = numberedLine.trim().replace(/^\s*\d+\.\s+/, '');
			expect(cleaned).toBe('First task item');
		});

		it.skip('reproduces issue #1573 - service can extract title from blockquote', () => {
			const blockquoteLine = '> Important task to handle';
			let cleaned = blockquoteLine.trim();
			while (cleaned.match(/^\s*>\s*/)) {
				cleaned = cleaned.replace(/^\s*>\s*/, '');
			}
			expect(cleaned).toBe('Important task to handle');
		});

		it.skip('reproduces issue #1573 - service can extract title from markdown header', () => {
			const headerLine = '## Review meeting notes';
			const cleaned = headerLine.trim().replace(/^\s*#+\s+/, '');
			expect(cleaned).toBe('Review meeting notes');
		});
	});

	describe('secondary validation gate in ConvertButtonWidget', () => {
		/**
		 * Even if buildConvertButtonDecorations were fixed to show the button for
		 * non-checkbox lines, the ConvertButtonWidget.validateEditorState() method
		 * (line ~135) performs a second parseTaskLine() check and rejects the click
		 * if isTaskLine is false. Both gates need to be addressed.
		 */

		it.skip('reproduces issue #1573 - validateEditorState rejects non-checkbox lines on click', () => {
			// The validation at line 135-138 of InstantConvertButtons.ts:
			//   const taskLineInfo = TasksPluginParser.parseTaskLine(currentLine);
			//   if (!taskLineInfo.isTaskLine) { return false; }
			//
			// This means even if a button were shown on a bullet point line,
			// clicking it would be rejected by this secondary validation.
			const bulletLine = '- Buy groceries';
			const taskLineInfo = TasksPluginParser.parseTaskLine(bulletLine);
			expect(taskLineInfo.isTaskLine).toBe(false);

			// Fix should either:
			// 1. Remove this secondary checkbox-only gate (the service handles all line types), or
			// 2. Replace it with a broader check that allows any non-empty line
		});
	});
});
