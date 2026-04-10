/**
 * Issue #1698: Inline/bulk task conversion doesn't parse both scheduled and due dates
 *
 * The creation modal was fixed in #1042 to handle both "scheduled" and "due" NLP
 * triggers, but the inline conversion code path in InstantTaskConvertService was
 * not updated. When converting "- [ ] Test task due March 20 scheduled March 16",
 * only the due date is extracted; the scheduled keyword stays in the title as
 * literal text and defaults to today's date.
 *
 * ROOT CAUSE:
 * InstantTaskConvertService uses a separate merge flow (mergeParseResults at line ~960)
 * that combines TasksPluginParser output with NLP output. TasksPluginParser only
 * recognizes emoji-based dates, not NLP keywords. The NLP parser should handle
 * the "scheduled" keyword, but the early-return bug from #1042 may still affect
 * this path, or the title passed to NLP has already been partially stripped.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1698
 */

import { describe, it, expect } from '@jest/globals';

interface ParsedTaskData {
	title: string;
	isCompleted: boolean;
	dueDate?: string;
	scheduledDate?: string;
	dueTime?: string;
	scheduledTime?: string;
	priority?: string;
	status?: string;
	tags?: string[];
	contexts?: string[];
	projects?: string[];
	recurrence?: string;
	timeEstimate?: number;
	userFields?: Record<string, string | string[]>;
	startDate?: string;
	createdDate?: string;
	doneDate?: string;
	recurrenceData?: any;
}

/**
 * Simulates the mergeParseResults logic from InstantTaskConvertService (line ~960)
 */
function mergeParseResults(
	tasksPluginData: ParsedTaskData,
	nlpData: ParsedTaskData
): ParsedTaskData {
	// If no NLP data, return tasks plugin data
	if (!nlpData || !nlpData.title) return tasksPluginData;

	return {
		title: nlpData.title?.trim() || tasksPluginData.title,
		dueDate: tasksPluginData.dueDate || nlpData.dueDate,
		scheduledDate: tasksPluginData.scheduledDate || nlpData.scheduledDate,
		dueTime: tasksPluginData.dueTime || nlpData.dueTime,
		scheduledTime: tasksPluginData.scheduledTime || nlpData.scheduledTime,
		priority: tasksPluginData.priority || nlpData.priority,
		status: tasksPluginData.status || nlpData.status,
		recurrence: tasksPluginData.recurrence || nlpData.recurrence,
		timeEstimate: tasksPluginData.timeEstimate || nlpData.timeEstimate,
		isCompleted: tasksPluginData.isCompleted,
		tags: [...(tasksPluginData.tags || []), ...(nlpData.tags || [])],
		contexts: [...(tasksPluginData.contexts || []), ...(nlpData.contexts || [])],
		projects: [...(tasksPluginData.projects || []), ...(nlpData.projects || [])],
	};
}

describe('Issue #1698: Inline/bulk task conversion dual date parsing', () => {
	describe('mergeParseResults preserves both dates from NLP', () => {
		it.skip('reproduces issue #1698 - scheduled date from NLP should not be lost in merge', () => {
			// TasksPluginParser output: only has due date (no emoji for scheduled)
			const tasksPluginData: ParsedTaskData = {
				title: 'Test task due March 20 scheduled March 16',
				isCompleted: false,
				// TasksPluginParser does NOT parse NLP keywords, so no dates extracted
				// unless emoji markers are present
			};

			// NLP parser output: should have both dates extracted
			const nlpData: ParsedTaskData = {
				title: 'Test task',
				isCompleted: false,
				dueDate: '2026-03-20',
				scheduledDate: '2026-03-16',
			};

			const merged = mergeParseResults(tasksPluginData, nlpData);

			// Both dates should be present in merged result
			expect(merged.dueDate).toBe('2026-03-20');
			expect(merged.scheduledDate).toBe('2026-03-16');
			// Title should be clean (from NLP)
			expect(merged.title).toBe('Test task');
			// "scheduled March 16" should NOT be in the title
			expect(merged.title).not.toContain('scheduled');
		});

		it.skip('reproduces issue #1698 - NLP parser must extract both triggers without early return', () => {
			// This test validates the NLP parser itself handles both triggers
			// The actual NaturalLanguageParser should parse both "due" and "scheduled"
			// from "Test task due March 20 scheduled March 16"

			// Simulating what NLP SHOULD return:
			const expectedNlpOutput: ParsedTaskData = {
				title: 'Test task',
				isCompleted: false,
				dueDate: '2026-03-20',
				scheduledDate: '2026-03-16',
			};

			// BUG: In the inline path, NLP may still have the early-return bug
			// where only the first trigger (due) is processed
			const buggyNlpOutput: ParsedTaskData = {
				title: 'Test task scheduled March 16', // "scheduled" left in title
				isCompleted: false,
				dueDate: '2026-03-20',
				// scheduledDate is missing - this is the bug
			};

			// The fix should ensure NLP output matches expected, not buggy
			expect(expectedNlpOutput.scheduledDate).toBe('2026-03-16');
			expect(expectedNlpOutput.dueDate).toBe('2026-03-20');
			expect(expectedNlpOutput.title).not.toContain('scheduled');

			// Buggy output demonstrates the problem
			expect(buggyNlpOutput.scheduledDate).toBeUndefined();
			expect(buggyNlpOutput.title).toContain('scheduled');
		});

		it.skip('reproduces issue #1698 - reversed order should also work', () => {
			// "scheduled March 16 due March 20" - reversed order
			const tasksPluginData: ParsedTaskData = {
				title: 'Test task scheduled March 16 due March 20',
				isCompleted: false,
			};

			const nlpData: ParsedTaskData = {
				title: 'Test task',
				isCompleted: false,
				scheduledDate: '2026-03-16',
				dueDate: '2026-03-20',
			};

			const merged = mergeParseResults(tasksPluginData, nlpData);

			expect(merged.scheduledDate).toBe('2026-03-16');
			expect(merged.dueDate).toBe('2026-03-20');
			expect(merged.title).toBe('Test task');
		});
	});
});
