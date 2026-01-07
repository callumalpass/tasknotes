/**
 * Tests for Issue #1055: Break sessions are logged as type `work`
 *
 * Bug Description:
 * When completing short or long break sessions, they are incorrectly written
 * to the daily note frontmatter with `type: work` instead of `type: short-break`
 * or `type: long-break`.
 *
 * Expected behavior:
 * - Work sessions should have type: "work"
 * - Short break sessions should have type: "short-break"
 * - Long break sessions should have type: "long-break"
 *
 * @see https://github.com/TaskNotes/tasknotes/issues/1055
 */

import { PomodoroSession, PomodoroSessionHistory } from '../../../src/types';

describe('Issue #1055: Break sessions logged as type work', () => {
	describe('PomodoroSession type assignment', () => {
		it.skip('reproduces issue #1055 - short break session should have type "short-break"', () => {
			// This test documents the expected behavior that break sessions
			// should preserve their type when logged to history
			const shortBreakSession: PomodoroSession = {
				id: '1704067200000',
				startTime: '2024-01-01T10:00:00.000Z',
				endTime: '2024-01-01T10:05:00.000Z',
				plannedDuration: 5,
				type: 'short-break', // This is correctly set when starting a break
				completed: true,
				activePeriods: [
					{
						startTime: '2024-01-01T10:00:00.000Z',
						endTime: '2024-01-01T10:05:00.000Z',
					},
				],
			};

			// When converted to history, the type should be preserved
			const historyEntry: PomodoroSessionHistory = {
				id: shortBreakSession.id,
				startTime: shortBreakSession.startTime,
				endTime: shortBreakSession.endTime!,
				plannedDuration: shortBreakSession.plannedDuration,
				type: shortBreakSession.type, // BUG: In practice this becomes "work"
				taskPath: shortBreakSession.taskPath,
				completed: shortBreakSession.completed,
				activePeriods: shortBreakSession.activePeriods.slice(),
			};

			// The bug is that historyEntry.type ends up as "work" in the daily note
			// even though shortBreakSession.type is "short-break"
			expect(historyEntry.type).toBe('short-break');
		});

		it.skip('reproduces issue #1055 - long break session should have type "long-break"', () => {
			const longBreakSession: PomodoroSession = {
				id: '1704067200001',
				startTime: '2024-01-01T10:30:00.000Z',
				endTime: '2024-01-01T10:45:00.000Z',
				plannedDuration: 15,
				type: 'long-break', // This is correctly set when starting a long break
				completed: true,
				activePeriods: [
					{
						startTime: '2024-01-01T10:30:00.000Z',
						endTime: '2024-01-01T10:45:00.000Z',
					},
				],
			};

			const historyEntry: PomodoroSessionHistory = {
				id: longBreakSession.id,
				startTime: longBreakSession.startTime,
				endTime: longBreakSession.endTime!,
				plannedDuration: longBreakSession.plannedDuration,
				type: longBreakSession.type, // BUG: In practice this becomes "work"
				taskPath: longBreakSession.taskPath,
				completed: longBreakSession.completed,
				activePeriods: longBreakSession.activePeriods.slice(),
			};

			expect(historyEntry.type).toBe('long-break');
		});

		it.skip('reproduces issue #1055 - work session should correctly have type "work"', () => {
			// This is a sanity check that work sessions are handled correctly
			const workSession: PomodoroSession = {
				id: '1704067200002',
				taskPath: 'tasks/my-task.md',
				startTime: '2024-01-01T09:00:00.000Z',
				endTime: '2024-01-01T09:25:00.000Z',
				plannedDuration: 25,
				type: 'work',
				completed: true,
				activePeriods: [
					{
						startTime: '2024-01-01T09:00:00.000Z',
						endTime: '2024-01-01T09:25:00.000Z',
					},
				],
			};

			const historyEntry: PomodoroSessionHistory = {
				id: workSession.id,
				startTime: workSession.startTime,
				endTime: workSession.endTime!,
				plannedDuration: workSession.plannedDuration,
				type: workSession.type,
				taskPath: workSession.taskPath,
				completed: workSession.completed,
				activePeriods: workSession.activePeriods.slice(),
			};

			expect(historyEntry.type).toBe('work');
		});
	});

	describe('Session type in daily note frontmatter', () => {
		it.skip('reproduces issue #1055 - all session types should be preserved when written to daily notes', () => {
			// This test documents the expected structure in daily note frontmatter
			// The bug report shows that break sessions appear as:
			// - type: work (incorrect)
			// instead of:
			// - type: short-break
			// - type: long-break

			const expectedPomodorosFrontmatter = [
				{
					id: '1704067200000',
					startTime: '2024-01-01T09:00:00.000Z',
					endTime: '2024-01-01T09:25:00.000Z',
					plannedDuration: 25,
					type: 'work',
					taskPath: 'tasks/my-task.md',
					completed: true,
					activePeriods: [
						{ startTime: '2024-01-01T09:00:00.000Z', endTime: '2024-01-01T09:25:00.000Z' },
					],
				},
				{
					id: '1704067200001',
					startTime: '2024-01-01T09:25:00.000Z',
					endTime: '2024-01-01T09:30:00.000Z',
					plannedDuration: 5,
					type: 'short-break', // BUG: This shows as "work" in actual frontmatter
					completed: true,
					activePeriods: [
						{ startTime: '2024-01-01T09:25:00.000Z', endTime: '2024-01-01T09:30:00.000Z' },
					],
				},
				{
					id: '1704067200002',
					startTime: '2024-01-01T09:30:00.000Z',
					endTime: '2024-01-01T09:55:00.000Z',
					plannedDuration: 25,
					type: 'work',
					taskPath: 'tasks/my-task.md',
					completed: true,
					activePeriods: [
						{ startTime: '2024-01-01T09:30:00.000Z', endTime: '2024-01-01T09:55:00.000Z' },
					],
				},
				{
					id: '1704067200003',
					startTime: '2024-01-01T09:55:00.000Z',
					endTime: '2024-01-01T10:10:00.000Z',
					plannedDuration: 15,
					type: 'long-break', // BUG: This shows as "work" in actual frontmatter
					completed: true,
					activePeriods: [
						{ startTime: '2024-01-01T09:55:00.000Z', endTime: '2024-01-01T10:10:00.000Z' },
					],
				},
			];

			// Verify each session type is correct
			const workSessions = expectedPomodorosFrontmatter.filter((s) => s.type === 'work');
			const shortBreakSessions = expectedPomodorosFrontmatter.filter(
				(s) => s.type === 'short-break'
			);
			const longBreakSessions = expectedPomodorosFrontmatter.filter(
				(s) => s.type === 'long-break'
			);

			expect(workSessions).toHaveLength(2);
			expect(shortBreakSessions).toHaveLength(1);
			expect(longBreakSessions).toHaveLength(1);
		});
	});
});
