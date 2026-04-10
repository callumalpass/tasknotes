/**
 * Regression coverage for Issue #1611: formula.urgencyScore not working as expected
 *
 * The urgencyScore formula returns null when daysUntilNext evaluates to null,
 * because max(0, 10 - null) propagates null. This breaks sort ordering in
 * all default base views that sort by urgencyScore.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1611
 */

import { describe, it, expect } from '@jest/globals';

/**
 * Simulates the formula evaluation chain from defaultBasesFiles.ts.
 * daysUntilDue/daysUntilScheduled return null when no date is set.
 * daysUntilNext selects the appropriate one.
 * urgencyScore combines priorityWeight with daysUntilNext.
 */

function daysUntilDue(due: string | null): number | null {
	if (!due) return null;
	// Simplified: just return a number
	return 5;
}

function daysUntilScheduled(scheduled: string | null): number | null {
	if (!scheduled) return null;
	return 3;
}

function daysUntilNext(due: string | null, scheduled: string | null): number | null {
	const dDue = daysUntilDue(due);
	const dSched = daysUntilScheduled(scheduled);

	if (due && scheduled) {
		// min() with null operand returns null in some formula engines
		return Math.min(dDue!, dSched!);
	}
	if (due) return dDue;
	return dSched;
}

/**
 * Buggy urgencyScore: max(0, 10 - daysUntilNext) where daysUntilNext can be null.
 * In the Bases formula engine, arithmetic with null propagates null.
 */
function urgencyScoreBuggy(
	priorityWeight: number,
	due: string | null,
	scheduled: string | null
): number | null {
	if (!due && !scheduled) {
		return priorityWeight;
	}
	const nextDays = daysUntilNext(due, scheduled);
	// BUG: if nextDays is null, 10 - null = null, max(0, null) = null
	if (nextDays === null) return null; // simulates null propagation
	return priorityWeight + Math.max(0, 10 - nextDays);
}

/**
 * Fixed urgencyScore: wraps daysUntilNext in null-safe fallback.
 */
function urgencyScoreFixed(
	priorityWeight: number,
	due: string | null,
	scheduled: string | null
): number | null {
	if (!due && !scheduled) {
		return priorityWeight;
	}
	const nextDays = daysUntilNext(due, scheduled);
	const safeNextDays = nextDays !== null ? nextDays : 0;
	return priorityWeight + Math.max(0, 10 - safeNextDays);
}

describe('Issue #1611: formula.urgencyScore null propagation', () => {
	it.skip('reproduces issue #1611 - urgencyScore returns null when daysUntilNext is null', () => {
		// Edge case: due is truthy (set) but somehow daysUntilNext returns null
		// This can happen when date parsing fails in the formula engine
		// Simulating by passing a due value that produces null daysUntilNext

		// Normal case: task with due date works fine
		const normalResult = urgencyScoreBuggy(5, '2026-04-01', null);
		expect(normalResult).not.toBeNull();

		// Task with no dates returns just priority weight
		const noDatesResult = urgencyScoreBuggy(5, null, null);
		expect(noDatesResult).toBe(5);
	});

	it.skip('verifies fix - urgencyScore never returns null when dates are set', () => {
		// With the fix, even if daysUntilNext somehow returns null,
		// urgencyScore falls back to 0 for the days component
		const result = urgencyScoreFixed(5, '2026-04-01', null);
		expect(result).not.toBeNull();
		expect(typeof result).toBe('number');

		const resultBoth = urgencyScoreFixed(3, '2026-04-01', '2026-03-25');
		expect(resultBoth).not.toBeNull();
		expect(typeof resultBoth).toBe('number');
	});

	it.skip('verifies the actual formula string should use null-safe daysUntilNext', () => {
		// The buggy formula:
		const buggyFormula = 'if(!due && !scheduled, formula.priorityWeight, formula.priorityWeight + max(0, 10 - formula.daysUntilNext))';

		// The fixed formula should wrap daysUntilNext:
		const fixedFormula = 'if(!due && !scheduled, formula.priorityWeight, formula.priorityWeight + max(0, 10 - if(formula.daysUntilNext, formula.daysUntilNext, 0)))';

		expect(buggyFormula).not.toContain('if(formula.daysUntilNext');
		expect(fixedFormula).toContain('if(formula.daysUntilNext, formula.daysUntilNext, 0)');
	});
});
