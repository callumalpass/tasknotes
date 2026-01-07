/**
 * Issue #1054: [FR] "Progress" Task w/ Custom Recurrence Rules
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1054
 *
 * Feature Description:
 * "Progress" tasks would be tasks that aren't meant to be completed.
 * 1. They indicate how much time a person has spent (maybe compared to an
 *    "estimated time" goal) on this task between those intervals.
 * 2. Practically... They would automatically recur at the recurrence date and time,
 *    and would archive their previous instance or else have a record of activity
 *    per every instance it recurs.
 *
 * Key Concepts:
 * - A new task "type" or mode: progress vs standard
 * - Per-instance time tracking with comparison to time estimate
 * - Automatic recurrence with instance history preservation
 * - No completion status - tasks are never "done", they just roll over
 *
 * Relationship to Existing Features:
 * - Builds on existing recurrence system (RFC 5545 RRULE)
 * - Extends time tracking (timeEntries, timeEstimate, totalTrackedTime)
 * - Similar to complete_instances tracking but for time rather than completion
 *
 * Related Issues:
 * - #1065: Per-instance time tracking (prerequisite/related work)
 */

import { TaskInfo, TimeEntry } from '../../../src/types';

/**
 * Proposed new task type enum
 */
type TaskType = 'standard' | 'progress';

/**
 * Extended TimeEntry with instance association (may be needed per #1065)
 */
interface InstanceTimeEntry extends TimeEntry {
	instanceDate?: string; // YYYY-MM-DD format
}

/**
 * Progress task instance record for history
 */
interface ProgressInstanceRecord {
	instanceDate: string; // YYYY-MM-DD
	timeEntries: TimeEntry[];
	totalTrackedTime: number; // Minutes
	timeEstimate?: number; // Target minutes for this period
	percentComplete?: number; // totalTrackedTime / timeEstimate * 100
	archivedAt?: string; // ISO timestamp when instance was archived
}

/**
 * Extended TaskInfo for progress tasks
 */
interface ProgressTaskInfo extends TaskInfo {
	taskType?: TaskType;
	progressInstances?: ProgressInstanceRecord[];
}

/**
 * Helper to create a minimal progress task
 */
function createProgressTask(overrides: Partial<ProgressTaskInfo> = {}): ProgressTaskInfo {
	return {
		id: 'tasks/progress-task.md',
		path: 'tasks/progress-task.md',
		title: 'Weekly Exercise',
		status: 'in-progress',
		priority: 'normal',
		archived: false,
		taskType: 'progress',
		recurrence: 'DTSTART:20260101;FREQ=WEEKLY;BYDAY=MO', // Weekly on Monday
		scheduled: '2026-01-05',
		timeEstimate: 180, // 3 hours goal per week
		timeEntries: [],
		progressInstances: [],
		...overrides,
	};
}

describe('Issue #1054 - Progress Tasks Feature Request', () => {
	describe('Task Type System', () => {
		it.skip('reproduces issue #1054 - tasks should support a taskType field', () => {
			/**
			 * Expected behavior: Tasks can be designated as 'progress' type,
			 * which changes how they behave with respect to completion.
			 *
			 * - 'standard' (default): Normal task, can be completed
			 * - 'progress': Never completed, tracks effort over time
			 */
			const standardTask = createProgressTask({ taskType: 'standard' });
			const progressTask = createProgressTask({ taskType: 'progress' });

			expect(standardTask.taskType).toBe('standard');
			expect(progressTask.taskType).toBe('progress');
		});

		it.skip('reproduces issue #1054 - progress tasks should not have completion status', () => {
			/**
			 * Expected behavior: Progress tasks don't use the standard completion
			 * workflow. They don't get marked "done" in the traditional sense.
			 * Instead, instances roll over automatically at recurrence intervals.
			 */
			const progressTask = createProgressTask();

			// Progress tasks should not participate in completion-based views/filters
			const isCompletable = progressTask.taskType !== 'progress';
			expect(isCompletable).toBe(false);

			// Clicking "complete" on a progress task should behave differently:
			// - Archive the current instance with its time data
			// - Move to the next recurrence instance
			// - NOT mark the task as "done"
		});

		it.skip('reproduces issue #1054 - progress tasks should always show in active task lists', () => {
			/**
			 * Expected behavior: Since progress tasks are never "done", they should
			 * always appear in active task lists (unless archived entirely).
			 */
			const progressTask = createProgressTask();

			// Even if current period has logged time, task remains active
			progressTask.timeEntries = [
				{
					startTime: '2026-01-05T09:00:00Z',
					endTime: '2026-01-05T12:00:00Z',
					duration: 180,
				},
			];

			// Task should still appear as active, not completed
			const isActiveTask =
				progressTask.taskType === 'progress' || progressTask.status !== 'done';
			expect(isActiveTask).toBe(true);
		});
	});

	describe('Time Tracking vs Estimate', () => {
		it.skip('reproduces issue #1054 - should compare tracked time to time estimate', () => {
			/**
			 * Expected behavior: Progress tasks show how much time has been tracked
			 * in the current period compared to the time estimate goal.
			 */
			const progressTask = createProgressTask({
				timeEstimate: 180, // 3 hour goal per week
			});

			// Track 2 hours so far this week
			progressTask.timeEntries = [
				{
					startTime: '2026-01-05T09:00:00Z',
					endTime: '2026-01-05T10:00:00Z',
					duration: 60,
				},
				{
					startTime: '2026-01-06T14:00:00Z',
					endTime: '2026-01-06T15:00:00Z',
					duration: 60,
				},
			];

			const trackedMinutes = progressTask.timeEntries.reduce(
				(sum, e) => sum + (e.duration || 0),
				0
			);
			const estimateMinutes = progressTask.timeEstimate || 0;
			const percentComplete =
				estimateMinutes > 0 ? (trackedMinutes / estimateMinutes) * 100 : 0;

			expect(trackedMinutes).toBe(120);
			expect(estimateMinutes).toBe(180);
			expect(percentComplete).toBeCloseTo(66.67, 1);

			// UI should show something like "2h / 3h (67%)"
		});

		it.skip('reproduces issue #1054 - should handle exceeding time estimate', () => {
			/**
			 * Expected behavior: Progress tasks can exceed their time estimate.
			 * The UI should indicate when the goal has been met or exceeded.
			 */
			const progressTask = createProgressTask({
				timeEstimate: 60, // 1 hour goal
			});

			// Track 1.5 hours (exceed goal)
			progressTask.timeEntries = [
				{
					startTime: '2026-01-05T09:00:00Z',
					endTime: '2026-01-05T10:30:00Z',
					duration: 90,
				},
			];

			const trackedMinutes = progressTask.timeEntries.reduce(
				(sum, e) => sum + (e.duration || 0),
				0
			);
			const percentComplete = (trackedMinutes / (progressTask.timeEstimate || 1)) * 100;
			const exceededGoal = trackedMinutes > (progressTask.timeEstimate || 0);

			expect(percentComplete).toBe(150);
			expect(exceededGoal).toBe(true);
		});

		it.skip('reproduces issue #1054 - should work without time estimate (no goal)', () => {
			/**
			 * Expected behavior: Progress tasks can work without a time estimate.
			 * In this case, they just track time without showing percentage.
			 */
			const progressTask = createProgressTask({
				timeEstimate: undefined,
			});

			progressTask.timeEntries = [
				{
					startTime: '2026-01-05T09:00:00Z',
					endTime: '2026-01-05T10:00:00Z',
					duration: 60,
				},
			];

			const hasEstimate = progressTask.timeEstimate !== undefined;
			expect(hasEstimate).toBe(false);

			// UI should show just "1h tracked" without percentage
		});
	});

	describe('Automatic Recurrence with Instance History', () => {
		it.skip('reproduces issue #1054 - should archive previous instance on recurrence', () => {
			/**
			 * Expected behavior: When a recurrence interval passes, the progress
			 * task should archive the previous instance's data and start fresh.
			 */
			const progressTask = createProgressTask({
				progressInstances: [
					{
						instanceDate: '2025-12-29', // Previous week
						timeEntries: [
							{
								startTime: '2025-12-29T09:00:00Z',
								endTime: '2025-12-29T11:00:00Z',
								duration: 120,
							},
						],
						totalTrackedTime: 120,
						timeEstimate: 180,
						percentComplete: 66.67,
						archivedAt: '2026-01-05T00:00:00Z',
					},
				],
			});

			// When viewing Jan 5 instance (current), previous week is archived
			expect(progressTask.progressInstances).toHaveLength(1);
			expect(progressTask.progressInstances![0].archivedAt).toBeDefined();
		});

		it.skip('reproduces issue #1054 - should maintain history of all instances', () => {
			/**
			 * Expected behavior: Progress tasks maintain a record of all past
			 * instances, allowing users to see their progress over time.
			 */
			const progressTask = createProgressTask({
				progressInstances: [
					{
						instanceDate: '2025-12-15',
						timeEntries: [],
						totalTrackedTime: 150,
						timeEstimate: 180,
						percentComplete: 83.33,
						archivedAt: '2025-12-22T00:00:00Z',
					},
					{
						instanceDate: '2025-12-22',
						timeEntries: [],
						totalTrackedTime: 200,
						timeEstimate: 180,
						percentComplete: 111.11,
						archivedAt: '2025-12-29T00:00:00Z',
					},
					{
						instanceDate: '2025-12-29',
						timeEntries: [],
						totalTrackedTime: 90,
						timeEstimate: 180,
						percentComplete: 50,
						archivedAt: '2026-01-05T00:00:00Z',
					},
				],
			});

			// Can calculate average progress across instances
			const instances = progressTask.progressInstances || [];
			const avgPercent =
				instances.reduce((sum, i) => sum + (i.percentComplete || 0), 0) /
				instances.length;

			expect(instances).toHaveLength(3);
			expect(avgPercent).toBeCloseTo(81.48, 1);
		});

		it.skip('reproduces issue #1054 - should auto-transition at recurrence boundary', () => {
			/**
			 * Expected behavior: When the current date passes the recurrence
			 * boundary, the task should automatically:
			 * 1. Archive the current instance with its time data
			 * 2. Create a new current instance for the new period
			 * 3. Keep the task active (never mark as complete)
			 */
			// Simulate system at different times
			const jan4 = new Date('2026-01-04T23:59:00Z'); // Before Monday
			const jan5 = new Date('2026-01-05T00:01:00Z'); // After Monday boundary

			const progressTask = createProgressTask({
				recurrence: 'DTSTART:20260101;FREQ=WEEKLY;BYDAY=MO',
				scheduled: '2025-12-29', // Last Monday
				timeEntries: [
					{
						startTime: '2025-12-29T09:00:00Z',
						endTime: '2025-12-29T11:00:00Z',
						duration: 120,
					},
				],
			});

			// At jan4: still in Dec 29 instance
			// At jan5: should transition to Jan 5 instance, archive Dec 29

			// This logic would be in a service that checks recurrence boundaries
			const shouldArchiveInstance = (task: ProgressTaskInfo, currentDate: Date) => {
				// Placeholder for actual implementation
				// Would use RRule to determine if we've crossed a boundary
				return currentDate >= jan5;
			};

			expect(shouldArchiveInstance(progressTask, jan4)).toBe(false);
			expect(shouldArchiveInstance(progressTask, jan5)).toBe(true);
		});
	});

	describe('UI Display Requirements', () => {
		it.skip('reproduces issue #1054 - task card should show progress indicator', () => {
			/**
			 * Expected behavior: Progress tasks should display a progress bar or
			 * indicator showing tracked time vs estimate.
			 */
			interface ProgressDisplayData {
				trackedTime: number;
				timeEstimate: number | null;
				percentComplete: number | null;
				displayText: string;
			}

			const getProgressDisplay = (task: ProgressTaskInfo): ProgressDisplayData => {
				const tracked = (task.timeEntries || []).reduce(
					(sum, e) => sum + (e.duration || 0),
					0
				);
				const estimate = task.timeEstimate || null;
				const percent = estimate ? (tracked / estimate) * 100 : null;

				// Format display text
				const trackedStr = `${Math.floor(tracked / 60)}h ${tracked % 60}m`;
				let displayText = trackedStr;
				if (estimate) {
					const estimateStr = `${Math.floor(estimate / 60)}h ${estimate % 60}m`;
					displayText = `${trackedStr} / ${estimateStr} (${Math.round(percent!)}%)`;
				}

				return {
					trackedTime: tracked,
					timeEstimate: estimate,
					percentComplete: percent,
					displayText,
				};
			};

			const task = createProgressTask({
				timeEstimate: 180,
				timeEntries: [
					{
						startTime: '2026-01-05T09:00:00Z',
						endTime: '2026-01-05T11:00:00Z',
						duration: 120,
					},
				],
			});

			const display = getProgressDisplay(task);
			expect(display.trackedTime).toBe(120);
			expect(display.percentComplete).toBeCloseTo(66.67, 1);
			expect(display.displayText).toBe('2h 0m / 3h 0m (67%)');
		});

		it.skip('reproduces issue #1054 - should show history view for past instances', () => {
			/**
			 * Expected behavior: Users should be able to view a history of past
			 * instances, showing how their progress varied over time.
			 */
			interface InstanceHistoryView {
				instanceDate: string;
				totalTrackedTime: number;
				percentComplete: number;
				comparisonToPrevious: number; // +/- percentage
			}

			const calculateHistoryView = (
				instances: ProgressInstanceRecord[]
			): InstanceHistoryView[] => {
				return instances.map((instance, idx) => {
					const prevPercent =
						idx > 0 ? instances[idx - 1].percentComplete || 0 : 0;
					const currentPercent = instance.percentComplete || 0;

					return {
						instanceDate: instance.instanceDate,
						totalTrackedTime: instance.totalTrackedTime,
						percentComplete: currentPercent,
						comparisonToPrevious: idx > 0 ? currentPercent - prevPercent : 0,
					};
				});
			};

			const instances: ProgressInstanceRecord[] = [
				{
					instanceDate: '2025-12-15',
					timeEntries: [],
					totalTrackedTime: 150,
					percentComplete: 83.33,
				},
				{
					instanceDate: '2025-12-22',
					timeEntries: [],
					totalTrackedTime: 200,
					percentComplete: 111.11,
				},
				{
					instanceDate: '2025-12-29',
					timeEntries: [],
					totalTrackedTime: 90,
					percentComplete: 50,
				},
			];

			const history = calculateHistoryView(instances);

			expect(history[1].comparisonToPrevious).toBeCloseTo(27.78, 1); // Improved
			expect(history[2].comparisonToPrevious).toBeCloseTo(-61.11, 1); // Declined
		});

		it.skip('reproduces issue #1054 - calendar should show progress instances differently', () => {
			/**
			 * Expected behavior: In calendar view, progress task instances should
			 * be visually distinct from regular tasks. They might show:
			 * - A progress bar overlay
			 * - Different icon (e.g., chart icon instead of checkbox)
			 * - Color coding based on progress percentage
			 */
			interface CalendarProgressEvent {
				eventId: string;
				taskPath: string;
				instanceDate: string;
				isProgressTask: boolean;
				progressPercent: number | null;
				visualStyle: 'default' | 'progress-low' | 'progress-mid' | 'progress-high';
			}

			const getProgressEventStyle = (
				percent: number | null
			): CalendarProgressEvent['visualStyle'] => {
				if (percent === null) return 'default';
				if (percent < 33) return 'progress-low';
				if (percent < 66) return 'progress-mid';
				return 'progress-high';
			};

			expect(getProgressEventStyle(null)).toBe('default');
			expect(getProgressEventStyle(20)).toBe('progress-low');
			expect(getProgressEventStyle(50)).toBe('progress-mid');
			expect(getProgressEventStyle(80)).toBe('progress-high');
		});
	});

	describe('Data Model Considerations', () => {
		it.skip('reproduces issue #1054 - FieldMapping should support progress task fields', () => {
			/**
			 * Expected behavior: The FieldMapping system should support new fields:
			 * - taskType: Maps to frontmatter property name
			 * - progressInstances: Maps to frontmatter property name
			 */
			interface ExtendedFieldMapping {
				taskType: string;
				progressInstances: string;
			}

			const defaultProgressMapping: ExtendedFieldMapping = {
				taskType: 'taskType',
				progressInstances: 'progressInstances',
			};

			// Users might customize to fit their workflow
			const customMapping: ExtendedFieldMapping = {
				taskType: 'type',
				progressInstances: 'progress_history',
			};

			expect(defaultProgressMapping.taskType).toBe('taskType');
			expect(customMapping.taskType).toBe('type');
		});

		it.skip('reproduces issue #1054 - frontmatter should store progress task data', () => {
			/**
			 * Expected frontmatter structure for a progress task:
			 *
			 * ---
			 * title: "Weekly Exercise"
			 * status: "in-progress"
			 * taskType: "progress"
			 * recurrence: "DTSTART:20260101;FREQ=WEEKLY;BYDAY=MO"
			 * scheduled: "2026-01-05"
			 * timeEstimate: 180
			 * timeEntries:
			 *   - startTime: "2026-01-05T09:00:00Z"
			 *     endTime: "2026-01-05T11:00:00Z"
			 *     duration: 120
			 * progressInstances:
			 *   - instanceDate: "2025-12-29"
			 *     totalTrackedTime: 90
			 *     percentComplete: 50
			 *     archivedAt: "2026-01-05T00:00:00Z"
			 * ---
			 */
			const expectedFrontmatter = {
				title: 'Weekly Exercise',
				status: 'in-progress',
				taskType: 'progress',
				recurrence: 'DTSTART:20260101;FREQ=WEEKLY;BYDAY=MO',
				scheduled: '2026-01-05',
				timeEstimate: 180,
				timeEntries: [
					{
						startTime: '2026-01-05T09:00:00Z',
						endTime: '2026-01-05T11:00:00Z',
						duration: 120,
					},
				],
				progressInstances: [
					{
						instanceDate: '2025-12-29',
						totalTrackedTime: 90,
						percentComplete: 50,
						archivedAt: '2026-01-05T00:00:00Z',
					},
				],
			};

			expect(expectedFrontmatter.taskType).toBe('progress');
			expect(expectedFrontmatter.progressInstances).toHaveLength(1);
		});
	});

	describe('Integration with Existing Features', () => {
		it.skip('reproduces issue #1054 - should integrate with pomodoro tracking', () => {
			/**
			 * Expected behavior: Progress tasks should work with pomodoro sessions.
			 * Pomodoro time should count toward the progress task's tracked time.
			 */
			// Pomodoro sessions on a progress task should add to timeEntries
			const progressTask = createProgressTask({
				timeEstimate: 180, // 3 hours = ~7 pomodoros
			});

			// After 4 pomodoro sessions (25 min each)
			const pomodoroEntries: TimeEntry[] = [
				{ startTime: '2026-01-05T09:00:00Z', endTime: '2026-01-05T09:25:00Z', duration: 25 },
				{ startTime: '2026-01-05T09:30:00Z', endTime: '2026-01-05T09:55:00Z', duration: 25 },
				{ startTime: '2026-01-05T10:00:00Z', endTime: '2026-01-05T10:25:00Z', duration: 25 },
				{ startTime: '2026-01-05T10:30:00Z', endTime: '2026-01-05T10:55:00Z', duration: 25 },
			];

			progressTask.timeEntries = pomodoroEntries;

			const totalMinutes = pomodoroEntries.reduce((sum, e) => sum + (e.duration || 0), 0);
			const percentComplete = (totalMinutes / (progressTask.timeEstimate || 1)) * 100;

			expect(totalMinutes).toBe(100); // 1h 40m
			expect(percentComplete).toBeCloseTo(55.56, 1);
		});

		it.skip('reproduces issue #1054 - should work with webhooks', () => {
			/**
			 * Expected behavior: Progress task events should trigger webhooks:
			 * - progress.instance.archived: When an instance rolls over
			 * - progress.goal.reached: When tracked time reaches estimate
			 * - progress.goal.exceeded: When tracked time exceeds estimate
			 */
			type ProgressWebhookEvent =
				| 'progress.instance.archived'
				| 'progress.goal.reached'
				| 'progress.goal.exceeded';

			const webhookEvents: ProgressWebhookEvent[] = [
				'progress.instance.archived',
				'progress.goal.reached',
				'progress.goal.exceeded',
			];

			expect(webhookEvents).toContain('progress.instance.archived');
			expect(webhookEvents).toContain('progress.goal.reached');
		});

		it.skip('reproduces issue #1054 - should work with Bases integration', () => {
			/**
			 * Expected behavior: Progress tasks should work with Bases for:
			 * - Filtering by task type
			 * - Calculating aggregate progress across tasks
			 * - Formula fields based on progress data
			 */
			interface BasesProgressFields {
				taskType: string;
				currentInstanceProgress: number;
				averageHistoricalProgress: number;
				totalTrackedAllTime: number;
			}

			// Example: A Bases formula calculating weekly average
			const calculateAverageProgress = (instances: ProgressInstanceRecord[]): number => {
				if (instances.length === 0) return 0;
				return (
					instances.reduce((sum, i) => sum + (i.percentComplete || 0), 0) /
					instances.length
				);
			};

			const instances: ProgressInstanceRecord[] = [
				{ instanceDate: '2025-12-15', timeEntries: [], totalTrackedTime: 150, percentComplete: 83 },
				{ instanceDate: '2025-12-22', timeEntries: [], totalTrackedTime: 200, percentComplete: 111 },
				{ instanceDate: '2025-12-29', timeEntries: [], totalTrackedTime: 90, percentComplete: 50 },
			];

			expect(calculateAverageProgress(instances)).toBeCloseTo(81.33, 1);
		});
	});
});
