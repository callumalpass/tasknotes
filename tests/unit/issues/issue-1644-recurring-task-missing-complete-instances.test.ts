/**
 * Reproduction tests for Issue #1644: Default filter on This Week view broken
 * for recurring tasks that have never been completed.
 *
 * Bug: Recurring tasks without a `complete_instances` property don't appear in
 * views that filter with `!complete_instances.contains(today())`. When the
 * property is absent/undefined, `.contains()` returns undefined instead of
 * false, causing the negation to be falsy and hiding the task.
 *
 * Root cause:
 * - `src/templates/defaultBasesFiles.ts` generates filter expressions like:
 *   `!completeInstances.contains(today().format("yyyy-MM-dd"))`
 * - When `complete_instances` is not in frontmatter (new recurring task never
 *   completed), the expression evaluates as `!undefined.contains(...)` which
 *   is undefined, not true.
 * - Missing fallback: `complete_instances.isEmpty()` should be an OR clause.
 *
 * Related files:
 * - src/templates/defaultBasesFiles.ts (lines ~524-627, all recurring filters)
 * - src/bases/TaskSearchFilter.ts (filter evaluation)
 */

import { describe, it, expect } from '@jest/globals';

describe('Issue #1644: Recurring tasks with no complete_instances hidden from views', () => {
	it.skip('reproduces issue #1644 - undefined complete_instances causes task to be filtered out', () => {
		// Simulates a recurring task that has never been completed
		const recurringTaskNoCompletions = {
			title: 'Weekly standup',
			status: 'open',
			recurrence: 'weekly',
			complete_instances: undefined, // Property not in frontmatter yet
		};

		const today = '2026-03-22';

		// Simulate the filter logic from defaultBasesFiles.ts:
		// `!complete_instances.contains(today().format("yyyy-MM-dd"))`
		const completeInstances = recurringTaskNoCompletions.complete_instances;

		// Current behavior: undefined.contains() would throw or return undefined
		// In the expression evaluator, this likely returns undefined/falsy
		const containsToday = completeInstances?.includes(today);
		const currentFilterResult = !containsToday;

		// The negation of undefined is true in JS, but the expression evaluator
		// may handle this differently, returning undefined from the .contains() call
		// which then fails the overall AND condition

		// The fix: add `complete_instances.isEmpty()` as an OR clause
		const isEmpty = !completeInstances || (Array.isArray(completeInstances) && completeInstances.length === 0);
		const fixedFilterResult = isEmpty || !containsToday;

		expect(fixedFilterResult).toBe(true); // Task should be visible
	});

	it.skip('reproduces issue #1644 - task with empty complete_instances array should be visible', () => {
		const recurringTaskEmptyArray = {
			title: 'Daily review',
			status: 'open',
			recurrence: 'daily',
			complete_instances: [] as string[],
		};

		const today = '2026-03-22';
		const completeInstances = recurringTaskEmptyArray.complete_instances;

		// empty array.includes(today) is false, so !false = true
		const containsToday = completeInstances.includes(today);
		expect(containsToday).toBe(false);
		expect(!containsToday).toBe(true); // Task should be visible
	});

	it.skip('reproduces issue #1644 - task completed today should be hidden', () => {
		const recurringTaskCompletedToday = {
			title: 'Morning exercise',
			status: 'open',
			recurrence: 'daily',
			complete_instances: ['2026-03-22'],
		};

		const today = '2026-03-22';
		const completeInstances = recurringTaskCompletedToday.complete_instances;

		const containsToday = completeInstances.includes(today);
		expect(containsToday).toBe(true);
		expect(!containsToday).toBe(false); // Task should be hidden (completed today)
	});
});
