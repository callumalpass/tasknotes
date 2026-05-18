/**
 * Issue #1065: [Bug] Time tracking applies to all recurring and future and done tasks
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1065
 *
 * Bug Description:
 * When you start tracking time for a recurring task, the tracking time is applied to
 * all future tasks and also the done tasks in the past. The tracking indicator is
 * also applied to all task instances.
 *
 * Expected Behavior:
 * Tracking of time should be applied only to the task instance on which tracking is set,
 * so that specific instance can be started and stopped for tracking independently.
 *
 * Root Cause Analysis:
 * The issue stems from how recurring tasks store time entries:
 *
 * 1. Time entries are stored at the FILE level (in the `timeEntries` frontmatter array)
 * 2. All recurring task instances share the same underlying file
 * 3. When time tracking starts, it adds an entry to `timeEntries` without any
 *    instance-specific identifier
 * 4. The UI displays ALL time entries for ALL instances since they share the array
 * 5. The "actively tracked" indicator checks for ANY active entry, affecting all instances
 *
 * Contrast with completion tracking (which works correctly):
 * - Completion uses `complete_instances: string[]` with dates like ["2025-01-15", "2025-01-22"]
 * - Each instance date is checked against this array to determine completion status
 * - Time entries have no equivalent instance-aware structure
 *
 * Key Code Locations:
 * - TaskService.startTimeTracking(): src/services/TaskService.ts:1089
 *   - Adds entry to shared `timeEntries` array without instance context
 * - TaskCard rendering: src/ui/TaskCard.ts:1352-1373
 *   - Checks isActivelyTracked for ANY task with active entry
 * - Calendar event generation: src/bases/calendar-core.ts:750-812
 *   - Generates instances but they all reference the same task with shared timeEntries
 *
 * Suggested Fix:
 * Similar to how `complete_instances` stores per-date completion status, time tracking
 * should either:
 * Option A: Add `instanceDate` field to TimeEntry interface
 * Option B: Create `timeEntries_by_instance: Record<string, TimeEntry[]>` structure
 * Option C: Store instance date in a separate field on TimeEntry
 */

import { TimeEntry, TaskInfo } from '../../../src/types';
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

/**
 * Helper to create a minimal recurring task
 */
function createRecurringTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		id: 'tasks/recurring-task.md',
		path: 'tasks/recurring-task.md',
		title: 'Weekly Recurring Task',
		status: 'in-progress',
		recurrence: 'FREQ=WEEKLY;BYDAY=MO', // Weekly on Monday
		scheduled: '2026-01-05', // A Monday
		timeEntries: [],
		complete_instances: [],
		skipped_instances: [],
		...overrides,
	} as TaskInfo;
}

describe('Issue #1065 - Recurring Task Time Tracking Bug', () => {
	describe('Current Behavior (Demonstrates the Bug)', () => {
		it('shows that all recurring instances share the same timeEntries array', () => {
			// This demonstrates the root cause: all instances share data
			const recurringTask = createRecurringTask();

			// Simulate starting time tracking for "this week's" instance
			const timeEntry = createTimeEntry({
				startTime: '2026-01-05T09:00:00Z', // Monday Jan 5
				description: 'Working on this week instance',
			});

			recurringTask.timeEntries = [timeEntry];

			// ALL instances see the same timeEntries - this is the bug
			// Whether we're looking at Jan 5, Jan 12, or Dec 29, they all see this entry
			const jan5Instance = { ...recurringTask, instanceDate: '2026-01-05' };
			const jan12Instance = { ...recurringTask, instanceDate: '2026-01-12' };
			const dec29Instance = { ...recurringTask, instanceDate: '2025-12-29' };

			// Bug: All instances have access to the same time entries
			expect(jan5Instance.timeEntries).toHaveLength(1);
			expect(jan12Instance.timeEntries).toHaveLength(1); // Should be 0
			expect(dec29Instance.timeEntries).toHaveLength(1); // Should be 0
		});

		it('shows that getActiveTimeEntry affects all instances when tracking is active', () => {
			// Demonstrates that the "actively tracked" indicator affects all instances
			const recurringTask = createRecurringTask();

			// Start tracking on one instance (no endTime = active)
			recurringTask.timeEntries = [
				createTimeEntry({
					startTime: '2026-01-05T09:00:00Z',
					endTime: undefined, // Still active
				}),
			];

			// Get active entry - this is what the UI uses
			const activeEntry = getActiveTimeEntry(recurringTask.timeEntries);

			// The active entry is found regardless of which instance we're viewing
			expect(activeEntry).not.toBeNull();

			// Bug: This check returns the same result for ALL instances
			// The UI shows the tracking indicator on ALL recurring instances
			const isActivelyTracked = activeEntry !== null;
			expect(isActivelyTracked).toBe(true);
		});

		it('demonstrates time accumulation issue across all instances', () => {
			// Shows that total tracked time is shown on ALL instances
			const recurringTask = createRecurringTask();

			// Multiple time entries from different weeks
			recurringTask.timeEntries = [
				createTimeEntry({
					startTime: '2025-12-22T09:00:00Z',
					endTime: '2025-12-22T10:30:00Z',
					duration: 90, // Dec 22 instance: 1.5 hours
				}),
				createTimeEntry({
					startTime: '2025-12-29T14:00:00Z',
					endTime: '2025-12-29T16:00:00Z',
					duration: 120, // Dec 29 instance: 2 hours
				}),
				createTimeEntry({
					startTime: '2026-01-05T09:00:00Z',
					endTime: '2026-01-05T11:30:00Z',
					duration: 150, // Jan 5 instance: 2.5 hours
				}),
			];

			// Calculate total tracked time (as done in the UI)
			const totalMinutes = recurringTask.timeEntries.reduce(
				(sum, entry) => sum + (entry.duration || 0),
				0
			);

			// Bug: Every instance shows the TOTAL time (6 hours)
			// Instead of showing only the time for that specific instance
			expect(totalMinutes).toBe(360); // 6 hours total

			// Currently, if you view the Jan 5 instance, it shows "6 hours tracked"
			// But it should only show "2.5 hours tracked" for that instance
		});
	});

	describe('EXPECTED BEHAVIOR - Instance-Specific Time Tracking', () => {
		it.skip('reproduces issue #1065 - time tracking should only apply to the specific instance', () => {
			/**
			 * Expected behavior: When starting time tracking on a recurring task instance,
			 * the time entry should only be associated with that specific instance date.
			 *
			 * Implementation approach: TimeEntry should include instance context
			 */
			interface InstanceAwareTimeEntry extends TimeEntry {
				instanceDate?: string; // e.g., "2026-01-05" for the Jan 5 instance
			}

			const recurringTask = createRecurringTask();

			// Start tracking on Jan 5 instance - should include instance date
			const instanceAwareEntry: InstanceAwareTimeEntry = {
				startTime: '2026-01-05T09:00:00Z',
				instanceDate: '2026-01-05', // Associates this entry with specific instance
			};

			// When viewing Jan 5 instance, filter by instanceDate
			const jan5Entries = [instanceAwareEntry].filter(
				(e) => e.instanceDate === '2026-01-05'
			);
			expect(jan5Entries).toHaveLength(1);

			// When viewing Jan 12 instance, should have no entries
			const jan12Entries = [instanceAwareEntry].filter(
				(e) => e.instanceDate === '2026-01-12'
			);
			expect(jan12Entries).toHaveLength(0);
		});

		it.skip('reproduces issue #1065 - active tracking indicator should only show on tracked instance', () => {
			/**
			 * Expected behavior: The "actively tracked" visual indicator (pulsing dot,
			 * highlighted card, etc.) should only appear on the instance being tracked.
			 */
			interface InstanceAwareTimeEntry extends TimeEntry {
				instanceDate?: string;
			}

			// Active tracking on Jan 5 instance only
			const activeEntry: InstanceAwareTimeEntry = {
				startTime: '2026-01-05T09:00:00Z',
				endTime: undefined, // Active
				instanceDate: '2026-01-05',
			};

			const timeEntries = [activeEntry];

			// Helper: get active entry for a specific instance date
			const getActiveEntryForInstance = (
				entries: InstanceAwareTimeEntry[],
				instanceDate: string
			) => {
				return entries.find(
					(e) => !e.endTime && e.instanceDate === instanceDate
				) || null;
			};

			// Jan 5 should show as actively tracked
			const jan5Active = getActiveEntryForInstance(timeEntries, '2026-01-05');
			expect(jan5Active).not.toBeNull();

			// Jan 12 should NOT show as actively tracked
			const jan12Active = getActiveEntryForInstance(timeEntries, '2026-01-12');
			expect(jan12Active).toBeNull();

			// Past instances should NOT show as actively tracked
			const dec29Active = getActiveEntryForInstance(timeEntries, '2025-12-29');
			expect(dec29Active).toBeNull();
		});

		it.skip('reproduces issue #1065 - each instance should show its own tracked time', () => {
			/**
			 * Expected behavior: Each recurring instance should display only the time
			 * tracked for that specific instance, not the cumulative total.
			 */
			interface InstanceAwareTimeEntry extends TimeEntry {
				instanceDate?: string;
			}

			const timeEntries: InstanceAwareTimeEntry[] = [
				{
					startTime: '2025-12-29T14:00:00Z',
					endTime: '2025-12-29T16:00:00Z',
					duration: 120, // 2 hours for Dec 29
					instanceDate: '2025-12-29',
				},
				{
					startTime: '2026-01-05T09:00:00Z',
					endTime: '2026-01-05T11:30:00Z',
					duration: 150, // 2.5 hours for Jan 5
					instanceDate: '2026-01-05',
				},
				{
					startTime: '2026-01-05T14:00:00Z',
					endTime: '2026-01-05T15:00:00Z',
					duration: 60, // 1 more hour for Jan 5
					instanceDate: '2026-01-05',
				},
			];

			// Helper: calculate tracked time for specific instance
			const getTrackedTimeForInstance = (
				entries: InstanceAwareTimeEntry[],
				instanceDate: string
			): number => {
				return entries
					.filter((e) => e.instanceDate === instanceDate)
					.reduce((sum, e) => sum + (e.duration || 0), 0);
			};

			// Dec 29 instance should show 2 hours
			expect(getTrackedTimeForInstance(timeEntries, '2025-12-29')).toBe(120);

			// Jan 5 instance should show 3.5 hours (2.5 + 1)
			expect(getTrackedTimeForInstance(timeEntries, '2026-01-05')).toBe(210);

			// Jan 12 instance should show 0 hours (no tracking yet)
			expect(getTrackedTimeForInstance(timeEntries, '2026-01-12')).toBe(0);
		});

		it.skip('reproduces issue #1065 - stopping tracking should only affect the tracked instance', () => {
			/**
			 * Expected behavior: When stopping time tracking, only the active entry
			 * for that specific instance should be stopped.
			 */
			interface InstanceAwareTimeEntry extends TimeEntry {
				instanceDate?: string;
			}

			// Hypothetically tracking two instances simultaneously
			const timeEntries: InstanceAwareTimeEntry[] = [
				{
					startTime: '2026-01-05T09:00:00Z',
					endTime: undefined, // Active on Jan 5
					instanceDate: '2026-01-05',
				},
				{
					startTime: '2026-01-12T10:00:00Z',
					endTime: undefined, // Active on Jan 12
					instanceDate: '2026-01-12',
				},
			];

			// Stop tracking on Jan 5 instance only
			const stopTrackingForInstance = (
				entries: InstanceAwareTimeEntry[],
				instanceDate: string,
				endTime: string
			): InstanceAwareTimeEntry[] => {
				return entries.map((e) =>
					e.instanceDate === instanceDate && !e.endTime
						? { ...e, endTime }
						: e
				);
			};

			const updatedEntries = stopTrackingForInstance(
				timeEntries,
				'2026-01-05',
				'2026-01-05T12:00:00Z'
			);

			// Jan 5 should now have endTime
			const jan5Entry = updatedEntries.find((e) => e.instanceDate === '2026-01-05');
			expect(jan5Entry?.endTime).toBe('2026-01-05T12:00:00Z');

			// Jan 12 should still be active
			const jan12Entry = updatedEntries.find((e) => e.instanceDate === '2026-01-12');
			expect(jan12Entry?.endTime).toBeUndefined();
		});
	});

	describe('UI/Display Requirements', () => {
		it.skip('reproduces issue #1065 - task card should filter time entries by instance date', () => {
			/**
			 * When rendering a TaskCard for a specific recurring instance, the card
			 * should only show time tracking data relevant to that instance.
			 *
			 * Current code in TaskCard.ts:1352-1373 needs to be updated to:
			 * 1. Accept the targetDate/instanceDate for recurring tasks
			 * 2. Filter timeEntries to only those matching the instance date
			 * 3. Only show "actively tracked" indicator if active entry matches instance
			 */
			interface TaskCardProps {
				task: TaskInfo;
				targetDate?: Date; // The instance date being displayed
			}

			const shouldShowActiveIndicator = (
				task: TaskInfo,
				targetDate?: Date
			): boolean => {
				if (!targetDate || !task.recurrence) {
					// Non-recurring: show if any active entry exists
					return getActiveTimeEntry(task.timeEntries || []) !== null;
				}

				// Recurring: only show if active entry matches this instance
				const instanceDateStr = targetDate.toISOString().split('T')[0];
				const instanceEntries = (task.timeEntries || []).filter(
					(e: any) => e.instanceDate === instanceDateStr
				);
				return getActiveTimeEntry(instanceEntries) !== null;
			};

			// This documents the expected behavior for TaskCard
			expect(shouldShowActiveIndicator).toBeDefined();
		});

		it.skip('reproduces issue #1065 - calendar events should show instance-specific tracking', () => {
			/**
			 * In the calendar view, each recurring task event should show the tracking
			 * status and time for its specific instance, not the shared total.
			 *
			 * Current code in calendar-core.ts generates events but they share timeEntries.
			 */
			interface CalendarEventWithTimeTracking {
				eventId: string; // e.g., "recurring-task.md-2026-01-05"
				instanceDate: string;
				isActivelyTracked: boolean; // Should be instance-specific
				trackedMinutes: number; // Should be instance-specific
			}

			// Expected: Each calendar event has its own tracking data
			const jan5Event: CalendarEventWithTimeTracking = {
				eventId: 'recurring-task.md-2026-01-05',
				instanceDate: '2026-01-05',
				isActivelyTracked: true, // Only if THIS instance is being tracked
				trackedMinutes: 150, // Only time tracked for THIS instance
			};

			const jan12Event: CalendarEventWithTimeTracking = {
				eventId: 'recurring-task.md-2026-01-12',
				instanceDate: '2026-01-12',
				isActivelyTracked: false, // Different from Jan 5
				trackedMinutes: 0, // No time tracked for this instance yet
			};

			expect(jan5Event.isActivelyTracked).not.toBe(jan12Event.isActivelyTracked);
			expect(jan5Event.trackedMinutes).not.toBe(jan12Event.trackedMinutes);
		});
	});

	describe('Data Model Migration Considerations', () => {
		it.skip('reproduces issue #1065 - existing time entries should be migrated gracefully', () => {
			/**
			 * Existing tasks with timeEntries (no instanceDate) should continue to work.
			 * A migration strategy should be considered:
			 *
			 * Option 1: Infer instanceDate from startTime
			 *   - Match entry to closest preceding/matching recurrence date
			 *   - May not be 100% accurate for entries spanning midnight
			 *
			 * Option 2: Legacy entries apply to all instances
			 *   - New entries get instanceDate, old ones don't
			 *   - Gradually phase out legacy entries
			 *
			 * Option 3: Prompt user to assign historical entries
			 *   - Show a one-time migration dialog
			 *   - Let user confirm/assign instance dates
			 */
			interface MigrationStrategy {
				handleLegacyEntries: 'infer' | 'apply-to-all' | 'prompt-user';
			}

			// Document the consideration
			const strategy: MigrationStrategy = { handleLegacyEntries: 'infer' };
			expect(strategy).toBeDefined();
		});

		it.skip('reproduces issue #1065 - TimeEntry interface should support instanceDate', () => {
			/**
			 * The TimeEntry interface should be extended to include instance context.
			 *
			 * Current interface (from types.ts:477-482):
			 * interface TimeEntry {
			 *   startTime: string;
			 *   endTime?: string;
			 *   description?: string;
			 *   duration?: number;
			 * }
			 *
			 * Proposed extension:
			 * interface TimeEntry {
			 *   startTime: string;
			 *   endTime?: string;
			 *   description?: string;
			 *   duration?: number;
			 *   instanceDate?: string; // For recurring tasks: "2026-01-05"
			 * }
			 *
			 * The instanceDate field should be:
			 * - Optional (to support non-recurring tasks and legacy data)
			 * - In YYYY-MM-DD format (matching complete_instances format)
			 * - Set automatically when starting tracking on a recurring instance
			 */
			interface ProposedTimeEntry extends TimeEntry {
				instanceDate?: string;
			}

			const entry: ProposedTimeEntry = {
				startTime: '2026-01-05T09:00:00Z',
				instanceDate: '2026-01-05',
			};

			expect(entry.instanceDate).toBe('2026-01-05');
		});
	});
});

describe('Issue #1065 - API Considerations', () => {
	it.skip('reproduces issue #1065 - startTimeTracking should accept instance date', () => {
		/**
		 * The TaskService.startTimeTracking() method should accept an optional
		 * instanceDate parameter for recurring tasks.
		 *
		 * Current signature: startTimeTracking(task: TaskInfo): Promise<TaskInfo>
		 * Proposed: startTimeTracking(task: TaskInfo, instanceDate?: string): Promise<TaskInfo>
		 *
		 * The method should:
		 * 1. Accept the instance date for recurring tasks
		 * 2. Include instanceDate in the new TimeEntry
		 * 3. Store in frontmatter as before, but with instance context
		 */
		interface StartTimeTrackingOptions {
			task: TaskInfo;
			instanceDate?: string; // Required for recurring tasks
			description?: string;
		}

		const options: StartTimeTrackingOptions = {
			task: createRecurringTask(),
			instanceDate: '2026-01-05',
			description: 'Working on Jan 5 instance',
		};

		expect(options.instanceDate).toBeDefined();
	});

	it.skip('reproduces issue #1065 - stopTimeTracking should accept instance date', () => {
		/**
		 * The TaskService.stopTimeTracking() method should accept an optional
		 * instanceDate parameter to stop tracking for a specific instance.
		 *
		 * Current behavior: stops the first active entry found
		 * Expected behavior: stops the active entry for the specified instance
		 */
		interface StopTimeTrackingOptions {
			task: TaskInfo;
			instanceDate?: string; // If provided, only stop entry for this instance
		}

		const options: StopTimeTrackingOptions = {
			task: createRecurringTask(),
			instanceDate: '2026-01-05',
		};

		expect(options.instanceDate).toBeDefined();
	});
});
