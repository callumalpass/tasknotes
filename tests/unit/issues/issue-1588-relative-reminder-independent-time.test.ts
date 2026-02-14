/**
 * Issue #1588: Relative Reminders with independent Reminder Time
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1588
 *
 * Feature Request:
 * Currently, relative reminders are linked to the set Due Date + Due Time. A relative
 * reminder set to "1 day before due" will trigger at the set due time (if present).
 * When tasks have no due time (only a date), reminders fire at midnight.
 *
 * The user requests the ability to choose a specific time when the reminder happens,
 * independent of whether the task has a due time.
 *
 * Example:
 * - Task: "Test Task" due on 5 Mar (no time)
 * - Reminder 1: 2 days before at 18:00 → fires 3 Mar at 18:00
 * - Reminder 2: 1 day before at 12:00 → fires 4 Mar at 12:00
 *
 * Current behavior:
 * - Relative reminder calculates: anchorDate + offset
 * - If task is due "2025-03-05" (date only) with reminder "-P1D" (1 day before),
 *   the reminder fires at 2025-03-04T00:00:00 (midnight)
 *
 * Expected behavior after implementation:
 * - Relative reminder with atTime: "18:00" and offset: "-P1D"
 * - Calculates: (anchorDate + offset).setTime(atTime)
 * - Task due "2025-03-05" → reminder fires at 2025-03-04T18:00:00
 */

import type { Reminder, TaskInfo } from '../../../src/types';

describe('Issue #1588: Relative Reminders with independent Reminder Time', () => {
	// Helper to simulate NotificationService.calculateNotificationTime logic
	const parseISO8601Duration = (duration: string): number | null => {
		const match = duration.match(
			/^(-?)P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/
		);

		if (!match) {
			return null;
		}

		const [, sign, years, months, weeks, days, hours, minutes, seconds] = match;

		let totalMs = 0;
		if (years) totalMs += parseInt(years) * 365 * 24 * 60 * 60 * 1000;
		if (months) totalMs += parseInt(months) * 30 * 24 * 60 * 60 * 1000;
		if (weeks) totalMs += parseInt(weeks) * 7 * 24 * 60 * 60 * 1000;
		if (days) totalMs += parseInt(days) * 24 * 60 * 60 * 1000;
		if (hours) totalMs += parseInt(hours) * 60 * 60 * 1000;
		if (minutes) totalMs += parseInt(minutes) * 60 * 1000;
		if (seconds) totalMs += parseInt(seconds) * 1000;

		return sign === '-' ? -totalMs : totalMs;
	};

	// Current implementation (without atTime support)
	const calculateNotificationTimeCurrent = (
		task: Pick<TaskInfo, 'due' | 'scheduled'>,
		reminder: Reminder
	): Date | null => {
		if (reminder.type !== 'relative') return null;

		const anchorDateStr = reminder.relatedTo === 'due' ? task.due : task.scheduled;
		if (!anchorDateStr) return null;

		// Parse anchor date (assuming local timezone)
		const anchorDate = new Date(anchorDateStr);
		if (isNaN(anchorDate.getTime())) return null;

		const offsetMs = parseISO8601Duration(reminder.offset || 'PT0M');
		if (offsetMs === null) return null;

		return new Date(anchorDate.getTime() + offsetMs);
	};

	// Proposed implementation (with atTime support)
	const calculateNotificationTimeProposed = (
		task: Pick<TaskInfo, 'due' | 'scheduled'>,
		reminder: Reminder & { atTime?: string }
	): Date | null => {
		if (reminder.type !== 'relative') return null;

		const anchorDateStr = reminder.relatedTo === 'due' ? task.due : task.scheduled;
		if (!anchorDateStr) return null;

		// Parse anchor date
		const anchorDate = new Date(anchorDateStr);
		if (isNaN(anchorDate.getTime())) return null;

		const offsetMs = parseISO8601Duration(reminder.offset || 'PT0M');
		if (offsetMs === null) return null;

		const resultDate = new Date(anchorDate.getTime() + offsetMs);

		// If atTime is specified, override the time portion
		if (reminder.atTime) {
			const [hours, minutes] = reminder.atTime.split(':').map(Number);
			if (!isNaN(hours) && !isNaN(minutes)) {
				resultDate.setHours(hours, minutes, 0, 0);
			}
		}

		return resultDate;
	};

	describe('Current behavior (documenting the limitation)', () => {
		it.skip('reproduces issue #1588: relative reminder on date-only task fires at midnight', () => {
			// Task with due date but no time
			const task: Pick<TaskInfo, 'due' | 'scheduled'> = {
				due: '2025-03-05', // Date only, no time
				scheduled: undefined,
			};

			// Reminder: 1 day before due
			const reminder: Reminder = {
				id: 'rem_test_1',
				type: 'relative',
				relatedTo: 'due',
				offset: '-P1D', // 1 day before
			};

			const notificationTime = calculateNotificationTimeCurrent(task, reminder);

			// Current behavior: fires at midnight (00:00) on March 4th
			expect(notificationTime).not.toBeNull();
			expect(notificationTime!.toISOString()).toBe('2025-03-04T00:00:00.000Z');

			// This is the limitation: user cannot specify a different time
			// They might want it to fire at 18:00 instead of midnight
		});

		it.skip('reproduces issue #1588: relative reminder uses due time when present', () => {
			// Task with due date AND time
			const task: Pick<TaskInfo, 'due' | 'scheduled'> = {
				due: '2025-03-05T14:00:00', // Due at 2pm
				scheduled: undefined,
			};

			// Reminder: 1 day before due
			const reminder: Reminder = {
				id: 'rem_test_2',
				type: 'relative',
				relatedTo: 'due',
				offset: '-P1D',
			};

			const notificationTime = calculateNotificationTimeCurrent(task, reminder);

			// Fires at 2pm on March 4th (same time as due)
			expect(notificationTime).not.toBeNull();
			expect(notificationTime!.getHours()).toBe(14);
			expect(notificationTime!.getMinutes()).toBe(0);
		});
	});

	describe('Expected behavior after implementation', () => {
		it.skip('reproduces issue #1588: should allow setting independent reminder time for relative reminders', () => {
			// Task with due date but no time
			const task: Pick<TaskInfo, 'due' | 'scheduled'> = {
				due: '2025-03-05', // Date only
				scheduled: undefined,
			};

			// Reminder: 2 days before at 18:00
			const reminderWithAtTime: Reminder & { atTime?: string } = {
				id: 'rem_test_3',
				type: 'relative',
				relatedTo: 'due',
				offset: '-P2D', // 2 days before
				atTime: '18:00', // Fire at 6pm
			};

			const notificationTime = calculateNotificationTimeProposed(task, reminderWithAtTime);

			// Should fire at 18:00 on March 3rd
			expect(notificationTime).not.toBeNull();
			expect(notificationTime!.getFullYear()).toBe(2025);
			expect(notificationTime!.getMonth()).toBe(2); // March (0-indexed)
			expect(notificationTime!.getDate()).toBe(3);
			expect(notificationTime!.getHours()).toBe(18);
			expect(notificationTime!.getMinutes()).toBe(0);
		});

		it.skip('reproduces issue #1588: should support multiple reminders with different times', () => {
			// Example from the issue: "Test Task" due on 5 Mar
			const task: Pick<TaskInfo, 'due' | 'scheduled'> = {
				due: '2025-03-05',
				scheduled: undefined,
			};

			// Reminder 1: 2 days before at 18:00
			const reminder1: Reminder & { atTime?: string } = {
				id: 'rem_test_4a',
				type: 'relative',
				relatedTo: 'due',
				offset: '-P2D',
				atTime: '18:00',
			};

			// Reminder 2: 1 day before at 12:00
			const reminder2: Reminder & { atTime?: string } = {
				id: 'rem_test_4b',
				type: 'relative',
				relatedTo: 'due',
				offset: '-P1D',
				atTime: '12:00',
			};

			const time1 = calculateNotificationTimeProposed(task, reminder1);
			const time2 = calculateNotificationTimeProposed(task, reminder2);

			// First reminder: March 3rd at 18:00
			expect(time1).not.toBeNull();
			expect(time1!.getDate()).toBe(3);
			expect(time1!.getHours()).toBe(18);

			// Second reminder: March 4th at 12:00
			expect(time2).not.toBeNull();
			expect(time2!.getDate()).toBe(4);
			expect(time2!.getHours()).toBe(12);
		});

		it.skip('reproduces issue #1588: should preserve backward compatibility when atTime is not set', () => {
			// Task with due date and time
			const task: Pick<TaskInfo, 'due' | 'scheduled'> = {
				due: '2025-03-05T14:00:00',
				scheduled: undefined,
			};

			// Reminder without atTime (existing behavior)
			const reminderWithoutAtTime: Reminder & { atTime?: string } = {
				id: 'rem_test_5',
				type: 'relative',
				relatedTo: 'due',
				offset: '-P1D',
				// No atTime - should use existing behavior
			};

			const notificationTime = calculateNotificationTimeProposed(task, reminderWithoutAtTime);

			// Should still fire at 14:00 (same as due time)
			expect(notificationTime).not.toBeNull();
			expect(notificationTime!.getHours()).toBe(14);
			expect(notificationTime!.getMinutes()).toBe(0);
		});

		it.skip('reproduces issue #1588: atTime should override due time when both are present', () => {
			// Task with due date AND time
			const task: Pick<TaskInfo, 'due' | 'scheduled'> = {
				due: '2025-03-05T14:00:00', // Due at 2pm
				scheduled: undefined,
			};

			// Reminder with custom atTime that differs from due time
			const reminder: Reminder & { atTime?: string } = {
				id: 'rem_test_6',
				type: 'relative',
				relatedTo: 'due',
				offset: '-P1D',
				atTime: '09:00', // Fire at 9am, not 2pm
			};

			const notificationTime = calculateNotificationTimeProposed(task, reminder);

			// Should fire at 09:00, not 14:00
			expect(notificationTime).not.toBeNull();
			expect(notificationTime!.getHours()).toBe(9);
			expect(notificationTime!.getMinutes()).toBe(0);
		});
	});

	describe('Reminder interface extension', () => {
		it.skip('reproduces issue #1588: Reminder type should support optional atTime field', () => {
			// This test documents the expected interface extension
			// After implementation, the Reminder interface should include:
			// atTime?: string; // HH:MM format for independent reminder time

			const reminderWithAtTime: Reminder & { atTime?: string } = {
				id: 'rem_interface_test',
				type: 'relative',
				relatedTo: 'due',
				offset: '-P1D',
				atTime: '18:00',
				description: 'Reminder 1 day before at 6pm',
			};

			// Verify the structure
			expect(reminderWithAtTime.type).toBe('relative');
			expect(reminderWithAtTime.atTime).toBe('18:00');
			expect(reminderWithAtTime.offset).toBe('-P1D');
		});
	});
});
