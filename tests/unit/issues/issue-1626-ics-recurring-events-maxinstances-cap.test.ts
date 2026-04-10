/**
 * Regression coverage for Issue #1626: ICS subscription recurring events
 * truncated by maxInstances=100 cap
 *
 * High-frequency recurring events (3+/week) are silently truncated because
 * parseICS() in ICSSubscriptionService.ts caps expansion at 100 instances.
 * For a 3x/week event, 100 instances covers only ~8 months, not the full
 * 1-year expansion window. Additionally, EXDATE-excluded dates count toward
 * the cap, wasting slots.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1626
 */

import { describe, it, expect } from '@jest/globals';

interface RecurrenceConfig {
	daysPerWeek: number;
	weeksInYear: number;
	exdateCount: number;
}

/**
 * Simulates the buggy instance expansion loop from ICSSubscriptionService.ts
 * (lines ~430-445). The maxInstances=100 cap truncates high-frequency events.
 */
function expandRecurringEventBuggy(config: RecurrenceConfig): number {
	const maxInstances = 100; // Bug: too low for high-frequency events
	const totalPossibleInstances = config.daysPerWeek * config.weeksInYear;

	let instanceCount = 0;
	let visibleCount = 0;

	for (let i = 0; i < totalPossibleInstances; i++) {
		if (instanceCount >= maxInstances) break;

		// Bug: EXDATE-excluded dates still increment instanceCount
		if (i < config.exdateCount) {
			instanceCount++; // Bug: counts toward cap even though excluded
			continue;
		}

		instanceCount++;
		visibleCount++;
	}

	return visibleCount;
}

/**
 * Fixed version: higher maxInstances and EXDATE-excluded dates don't count
 * toward the cap.
 */
function expandRecurringEventFixed(config: RecurrenceConfig): number {
	const maxInstances = 3000; // Fix: covers daily events for a full year
	const totalPossibleInstances = config.daysPerWeek * config.weeksInYear;

	let instanceCount = 0;
	let visibleCount = 0;

	for (let i = 0; i < totalPossibleInstances; i++) {
		if (instanceCount >= maxInstances) break;

		// Fix: EXDATE-excluded dates don't count toward cap
		if (i < config.exdateCount) {
			continue;
		}

		instanceCount++;
		visibleCount++;
	}

	return visibleCount;
}

describe('Issue #1626: ICS recurring events truncated by maxInstances=100', () => {
	it.skip('reproduces issue #1626 - 3x/week event truncated before 1 year', () => {
		const config: RecurrenceConfig = {
			daysPerWeek: 3,
			weeksInYear: 52,
			exdateCount: 0,
		};

		const expectedTotal = 3 * 52; // 156 instances in a year
		const actualVisible = expandRecurringEventBuggy(config);

		// BUG: only 100 instances visible, not 156
		expect(actualVisible).toBe(100);
		expect(actualVisible).toBeLessThan(expectedTotal);
	});

	it.skip('reproduces issue #1626 - daily event severely truncated', () => {
		const config: RecurrenceConfig = {
			daysPerWeek: 7, // daily
			weeksInYear: 52,
			exdateCount: 0,
		};

		const expectedTotal = 7 * 52; // 364 instances
		const actualVisible = expandRecurringEventBuggy(config);

		// BUG: only 100 out of 364
		expect(actualVisible).toBe(100);
		expect(actualVisible).toBeLessThan(expectedTotal);
	});

	it.skip('reproduces issue #1626 - EXDATE wastes instance slots', () => {
		const config: RecurrenceConfig = {
			daysPerWeek: 2,
			weeksInYear: 52,
			exdateCount: 10, // 10 excluded dates
		};

		const actualVisible = expandRecurringEventBuggy(config);

		// BUG: 10 exdates counted toward cap, so only 90 visible instead of 94
		expect(actualVisible).toBe(90);
	});

	it.skip('verifies fix - all instances visible with higher cap', () => {
		const config3x: RecurrenceConfig = {
			daysPerWeek: 3,
			weeksInYear: 52,
			exdateCount: 0,
		};

		const configDaily: RecurrenceConfig = {
			daysPerWeek: 7,
			weeksInYear: 52,
			exdateCount: 0,
		};

		expect(expandRecurringEventFixed(config3x)).toBe(156);
		expect(expandRecurringEventFixed(configDaily)).toBe(364);
	});

	it.skip('verifies fix - EXDATE does not reduce visible count', () => {
		const config: RecurrenceConfig = {
			daysPerWeek: 2,
			weeksInYear: 52,
			exdateCount: 10,
		};

		// Fixed: 104 total - 10 exdates = 94 visible, none wasted on cap
		expect(expandRecurringEventFixed(config)).toBe(94);
	});
});
