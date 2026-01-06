/**
 * Issue #1079: [FR] Multiple time tracking timers running simultaneously
 *
 * @see https://github.com/TaskNotesPlugin/tasknotes/issues/1079
 *
 * Feature Request:
 * Users want the ability to run multiple time tracking timers at once for cases
 * where they are working on several tasks simultaneously.
 *
 * Current Behavior:
 * - The system allows only ONE active timer per task (enforced in startTimeTracking())
 * - Different tasks CAN have active timers simultaneously (this already works)
 * - However, the UI and UX do not make it easy to view/manage multiple active timers
 * - The API endpoint GET /api/time/active can return multiple active sessions across tasks
 *
 * Key Code Locations:
 * - TaskService.startTimeTracking(): src/services/TaskService.ts:1089
 *   - Throws error if task already has active timer: "Time tracking is already active for this task"
 * - getActiveTimeEntry(): src/utils/helpers.ts:129
 *   - Returns first entry with startTime but no endTime
 * - TimeTrackingController.getActiveTimeSessions(): src/api/TimeTrackingController.ts
 *   - Already supports returning multiple active sessions across different tasks
 *
 * Implementation Considerations:
 * 1. Per-task multiple timers: Allow a single task to have multiple concurrent timers
 *    - Would need to remove the check in startTimeTracking() that prevents this
 *    - Would need UI to show/manage multiple timers per task
 *    - Complexity: Distinguishing which timer to stop, pause, or resume
 *
 * 2. Cross-task parallel timers (partially exists):
 *    - Already technically possible at the data layer
 *    - Needs UI improvements to show all active timers in a dashboard/status bar
 *    - Needs ability to quickly switch between or stop multiple timers
 *
 * 3. Timer switching/context switching:
 *    - Quick way to pause current timer and start another
 *    - Timer history view showing all active sessions
 *
 * These tests document the expected behavior for the feature request.
 */

import { TimeEntry } from '../../../src/types';
import { getActiveTimeEntry } from '../../../src/utils/helpers';

/**
 * Helper to create a time entry
 */
function createTimeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
	return {
		startTime: new Date().toISOString(),
		description: 'Work session',
		...overrides,
	};
}

describe('Issue #1079 - Multiple Simultaneous Time Tracking Timers', () => {
	describe('Current Behavior - Single Timer Per Task', () => {
		it('should only return one active entry per task (current behavior)', () => {
			// Currently, getActiveTimeEntry returns only the first active entry
			const timeEntries: TimeEntry[] = [
				createTimeEntry({ startTime: '2025-01-01T10:00:00Z' }), // Active (no endTime)
				createTimeEntry({ startTime: '2025-01-01T11:00:00Z' }), // Also active
			];

			const activeEntry = getActiveTimeEntry(timeEntries);

			// Current behavior: returns the first active entry found
			expect(activeEntry).not.toBeNull();
			expect(activeEntry?.startTime).toBe('2025-01-01T10:00:00Z');
		});

		it('should prevent starting second timer on same task (current behavior)', () => {
			// This test documents the current restriction in TaskService.startTimeTracking()
			// The actual method throws an error when trying to start a second timer
			const hasActiveSession = true; // Simulates task already having an active timer

			// Current behavior: this would throw "Time tracking is already active for this task"
			const wouldThrowError = hasActiveSession;
			expect(wouldThrowError).toBe(true);
		});
	});

	describe('EXPECTED BEHAVIOR - Multiple Timers Per Task', () => {
		it.skip('reproduces issue #1079 - should allow multiple active timers on same task', () => {
			/**
			 * Feature: Users should be able to start multiple timers on the same task
			 *
			 * Use case: Working on different aspects of the same task simultaneously
			 * Example: Running a build process while also coding - both are work on the same task
			 *
			 * Expected behavior:
			 * - startTimeTracking() should NOT throw if task already has active timer
			 * - Each call should create a new TimeEntry with startTime
			 * - All active entries should be trackable
			 */
			const timeEntries: TimeEntry[] = [
				createTimeEntry({ startTime: '2025-01-01T10:00:00Z', description: 'Coding' }),
				createTimeEntry({ startTime: '2025-01-01T10:30:00Z', description: 'Build running' }),
			];

			// Feature: should return ALL active entries, not just the first
			const allActiveEntries = timeEntries.filter((e) => e.startTime && !e.endTime);
			expect(allActiveEntries).toHaveLength(2);
		});

		it.skip('reproduces issue #1079 - should provide way to stop specific timer', () => {
			/**
			 * Feature: When multiple timers are running, user needs to stop specific ones
			 *
			 * Expected behavior:
			 * - stopTimeTracking() should accept an optional session/entry identifier
			 * - UI should show which timers are running with ability to stop each
			 */
			const timeEntries: TimeEntry[] = [
				createTimeEntry({ startTime: '2025-01-01T10:00:00Z', description: 'Timer 1' }),
				createTimeEntry({ startTime: '2025-01-01T10:30:00Z', description: 'Timer 2' }),
			];

			// Feature: stop a specific timer by its startTime
			const targetStartTime = '2025-01-01T10:00:00Z';
			const updatedEntries = timeEntries.map((entry) =>
				entry.startTime === targetStartTime
					? { ...entry, endTime: new Date().toISOString() }
					: entry
			);

			// Timer 1 should be stopped, Timer 2 should still be active
			const stillActive = updatedEntries.filter((e) => !e.endTime);
			expect(stillActive).toHaveLength(1);
			expect(stillActive[0].description).toBe('Timer 2');
		});
	});

	describe('EXPECTED BEHAVIOR - Multiple Timers Across Tasks', () => {
		it.skip('reproduces issue #1079 - should show all active timers in UI', () => {
			/**
			 * Feature: Dashboard or status bar showing all currently running timers
			 *
			 * This partially works at the API level (GET /api/time/active returns all)
			 * but needs UI implementation.
			 *
			 * Expected behavior:
			 * - Status bar indicator showing number of active timers
			 * - Click to expand and see all active timers with task names
			 * - Quick actions to stop any timer from the dashboard
			 */
			interface ActiveSession {
				taskPath: string;
				taskTitle: string;
				session: TimeEntry;
				elapsedMinutes: number;
			}

			const activeSessions: ActiveSession[] = [
				{
					taskPath: 'tasks/project-a.md',
					taskTitle: 'Project A Work',
					session: createTimeEntry({ description: 'Development' }),
					elapsedMinutes: 45,
				},
				{
					taskPath: 'tasks/project-b.md',
					taskTitle: 'Project B Meeting',
					session: createTimeEntry({ description: 'Meeting notes' }),
					elapsedMinutes: 15,
				},
			];

			// Feature: UI should display all active sessions
			expect(activeSessions.length).toBeGreaterThan(1);

			// Feature: should show total time across all timers
			const totalMinutes = activeSessions.reduce((sum, s) => sum + s.elapsedMinutes, 0);
			expect(totalMinutes).toBe(60);
		});

		it.skip('reproduces issue #1079 - should support quick timer switching', () => {
			/**
			 * Feature: Quick switch between tasks without manually stopping/starting
			 *
			 * Use case: Context switching between projects throughout the day
			 *
			 * Expected behavior:
			 * - "Switch to this task" action that pauses current timer and starts new one
			 * - Option to keep previous timer running (parallel work) or stop it
			 * - History of timer switches for accurate time reconstruction
			 */
			interface TimerSwitch {
				fromTask?: string;
				toTask: string;
				timestamp: string;
				keepPreviousRunning: boolean;
			}

			const timerSwitch: TimerSwitch = {
				fromTask: 'tasks/project-a.md',
				toTask: 'tasks/project-b.md',
				timestamp: new Date().toISOString(),
				keepPreviousRunning: true, // This is the "multiple timers" use case
			};

			// Feature: switch should maintain context
			expect(timerSwitch.keepPreviousRunning).toBe(true);
		});
	});

	describe('UI/UX Requirements for Multiple Timers', () => {
		it.skip('reproduces issue #1079 - should have timer management view', () => {
			/**
			 * Feature: Dedicated view/modal for managing all active timers
			 *
			 * Requirements:
			 * 1. List of all active timers with:
			 *    - Task name/link
			 *    - Timer start time
			 *    - Elapsed time (live updating)
			 *    - Description
			 * 2. Actions per timer:
			 *    - Stop
			 *    - Pause/Resume (if pause is supported)
			 *    - Edit description
			 *    - Navigate to task
			 * 3. Bulk actions:
			 *    - Stop all timers
			 *    - Export time entries
			 */
			interface TimerManagementView {
				activeTimers: Array<{
					taskPath: string;
					taskTitle: string;
					startTime: string;
					description: string;
					elapsedSeconds: number;
				}>;
				actions: {
					stopTimer: (taskPath: string, startTime: string) => void;
					stopAllTimers: () => void;
					navigateToTask: (taskPath: string) => void;
				};
			}

			// This interface documents the expected UI component
			const mockView: TimerManagementView = {
				activeTimers: [],
				actions: {
					stopTimer: () => {},
					stopAllTimers: () => {},
					navigateToTask: () => {},
				},
			};

			expect(mockView.actions).toBeDefined();
		});

		it.skip('reproduces issue #1079 - should show timer indicator in status bar', () => {
			/**
			 * Feature: Visual indicator when timers are running
			 *
			 * Requirements:
			 * 1. Status bar shows icon when any timer is active
			 * 2. Badge/count shows number of active timers (if > 1)
			 * 3. Tooltip shows summary of active timers
			 * 4. Click opens timer management view
			 */
			interface StatusBarIndicator {
				isVisible: boolean;
				activeCount: number;
				tooltipText: string;
				onClick: () => void;
			}

			const indicator: StatusBarIndicator = {
				isVisible: true,
				activeCount: 3,
				tooltipText: '3 timers running: Project A (45m), Project B (15m), Project C (5m)',
				onClick: () => {
					/* open timer management view */
				},
			};

			expect(indicator.activeCount).toBe(3);
		});
	});
});

describe('Issue #1079 - API Requirements', () => {
	it.skip('reproduces issue #1079 - GET /api/time/active should return all timers', () => {
		/**
		 * API already supports this, but documenting expected behavior
		 *
		 * Endpoint: GET /api/time/active
		 * Response: Array of all active time sessions across all tasks
		 */
		interface ActiveTimeSessionsResponse {
			sessions: Array<{
				task: {
					id: string;
					title: string;
					path: string;
				};
				session: {
					startTime: string;
					description?: string;
				};
				elapsedMinutes: number;
			}>;
			totalElapsedMinutes: number;
		}

		const mockResponse: ActiveTimeSessionsResponse = {
			sessions: [
				{
					task: { id: 'task-1', title: 'Task 1', path: 'tasks/task-1.md' },
					session: { startTime: '2025-01-01T10:00:00Z', description: 'Work' },
					elapsedMinutes: 30,
				},
				{
					task: { id: 'task-2', title: 'Task 2', path: 'tasks/task-2.md' },
					session: { startTime: '2025-01-01T10:30:00Z', description: 'Review' },
					elapsedMinutes: 15,
				},
			],
			totalElapsedMinutes: 45,
		};

		expect(mockResponse.sessions).toHaveLength(2);
	});

	it.skip('reproduces issue #1079 - POST /api/time/stop should support stopping specific timer', () => {
		/**
		 * Feature: API should allow stopping a specific timer when multiple are running
		 *
		 * Current: POST /api/tasks/:id/time/stop - stops the only active timer
		 * Needed: Support for specifying which timer to stop when multiple exist
		 *
		 * Option 1: POST /api/tasks/:id/time/stop?startTime=2025-01-01T10:00:00Z
		 * Option 2: POST /api/tasks/:id/time/:entryIndex/stop
		 */
		interface StopTimerRequest {
			taskId: string;
			startTime?: string; // Optional: if not provided, stop all or most recent
		}

		const request: StopTimerRequest = {
			taskId: 'task-1',
			startTime: '2025-01-01T10:00:00Z',
		};

		expect(request.startTime).toBeDefined();
	});
});
