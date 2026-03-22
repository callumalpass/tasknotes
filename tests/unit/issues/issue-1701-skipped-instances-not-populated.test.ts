/**
 * Issue #1701: Skipped instances aren't appearing in the skipped instances property
 *
 * When a recurring task's scheduled date passes without user interaction (neither
 * completed nor explicitly skipped), the date does not appear in skipped_instances.
 * The user expects automatic population of skipped_instances for missed occurrences.
 *
 * ROOT CAUSE:
 * skipped_instances is only populated via explicit user action
 * (TaskService.toggleRecurringTaskSkip). There is no automatic reconciliation
 * that detects past, un-completed, un-skipped recurring instances.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1701
 */

import { describe, it, expect } from '@jest/globals';

interface MockRecurringTask {
	title: string;
	recurrence: string;
	scheduled: string;
	complete_instances: string[];
	skipped_instances: string[];
}

/**
 * Simulates the current behavior: skipped_instances only contains
 * explicitly skipped dates, not automatically missed ones.
 */
function getSkippedInstances(task: MockRecurringTask): string[] {
	return task.skipped_instances || [];
}

/**
 * Proposed fix: reconcile past occurrences and auto-populate skipped_instances
 * for dates that were neither completed nor already skipped.
 */
function reconcileSkippedInstances(
	task: MockRecurringTask,
	pastOccurrences: string[],
	today: string
): string[] {
	const completed = new Set(task.complete_instances || []);
	const skipped = new Set(task.skipped_instances || []);

	const autoSkipped: string[] = [];
	for (const occurrence of pastOccurrences) {
		if (occurrence < today && !completed.has(occurrence) && !skipped.has(occurrence)) {
			autoSkipped.push(occurrence);
		}
	}

	return [...(task.skipped_instances || []), ...autoSkipped];
}

describe('Issue #1701: Skipped instances not appearing for missed recurring tasks', () => {
	const task: MockRecurringTask = {
		title: 'Daily standup',
		recurrence: 'FREQ=DAILY',
		scheduled: '2026-03-15',
		complete_instances: ['2026-03-15', '2026-03-16', '2026-03-18'],
		skipped_instances: [],
	};

	it.skip('reproduces issue #1701 - missed instances are not auto-populated in skipped_instances', () => {
		// Current behavior: skipped_instances is empty even though 3/17, 3/19, 3/20, 3/21
		// were not completed
		const skipped = getSkippedInstances(task);
		// BUG: user expects missed dates to appear here
		expect(skipped).toEqual([]);

		// With auto-reconciliation, past occurrences that were not completed should appear
		const pastOccurrences = [
			'2026-03-15', '2026-03-16', '2026-03-17', '2026-03-18',
			'2026-03-19', '2026-03-20', '2026-03-21',
		];
		const today = '2026-03-22';

		const reconciled = reconcileSkippedInstances(task, pastOccurrences, today);

		// After reconciliation, 3/17, 3/19, 3/20, 3/21 should be skipped
		expect(reconciled).toContain('2026-03-17');
		expect(reconciled).toContain('2026-03-19');
		expect(reconciled).toContain('2026-03-20');
		expect(reconciled).toContain('2026-03-21');
		// Completed dates should NOT appear in skipped
		expect(reconciled).not.toContain('2026-03-15');
		expect(reconciled).not.toContain('2026-03-16');
		expect(reconciled).not.toContain('2026-03-18');
	});
});
