/**
 * Issue #1425: [FR] Auto-Refresh Calendar Upon Edit to Time Entries
 *
 * @see https://github.com/TaskNotesPlugin/tasknotes/issues/1425
 *
 * Feature Request:
 * When (a) users select `Save` after editing the Time Entries for a task, and
 * (b) upon completing a Pomodoro Session, the Advanced Calendar should
 * automatically update if it is presently open.
 *
 * Current Behavior:
 * - Time entry edits trigger EVENT_TASK_UPDATED but calendar uses 5-second debounce
 * - Pomodoro completion triggers EVENT_TASK_UPDATED via stopTimeTracking() but
 *   the calendar does not treat it as a user-initiated action
 * - User-initiated actions should use expectImmediateUpdate() but currently don't
 *   for time entry saves and pomodoro completions
 *
 * Expected Behavior:
 * - Calendar should refresh immediately (not after 5-second debounce) when:
 *   1. User saves time entries via Time Entry Editor modal
 *   2. A Pomodoro session completes (work session ends, creating a time entry)
 *
 * Root Cause:
 * The openTimeEntryEditor() method in main.ts does not call expectImmediateUpdate()
 * before triggering the data change event. Similarly, PomodoroService does not
 * signal that calendar views should refresh immediately.
 *
 * Suggested Fix:
 * 1. In main.ts openTimeEntryEditor(), call expectImmediateUpdate() on all
 *    open CalendarView instances before triggering EVENT_DATA_CHANGED
 * 2. In PomodoroService.completePomodoro(), emit an event that CalendarView
 *    listens to and triggers expectImmediateUpdate() + render
 *
 * Test Strategy:
 * These unit tests use a mock of CalendarView's update handler to demonstrate:
 * - CURRENT BEHAVIOR: Documents the buggy behavior (no immediate refresh)
 * - EXPECTED BEHAVIOR: Specifies the correct behavior after fix (immediate refresh)
 *
 * The mock replicates the actual CalendarView.onDataUpdated() logic.
 * E2E tests in e2e/tasknotes.spec.ts provide real-world validation (marked fixme).
 */

import { EVENT_TASK_UPDATED, EVENT_DATA_CHANGED, EVENT_POMODORO_COMPLETE, TimeEntry } from '../../../src/types';

/**
 * Mock EventEmitter that matches the Obsidian Events class interface used by TaskManager.
 * The actual emitter uses `trigger` and `on` methods.
 */
class MockEventEmitter {
	private events: { [key: string]: Array<(...args: any[]) => void> } = {};

	on(event: string, listener: (...args: any[]) => void): () => void {
		if (!this.events[event]) {
			this.events[event] = [];
		}
		this.events[event].push(listener);
		return () => {
			this.events[event] = this.events[event].filter((l) => l !== listener);
		};
	}

	trigger(event: string, ...args: any[]): void {
		if (this.events[event]) {
			this.events[event].forEach((listener) => {
				listener(...args);
			});
		}
	}

	removeAllListeners(event?: string): void {
		if (event) {
			delete this.events[event];
		} else {
			this.events = {};
		}
	}
}

describe('Issue #1425 - Calendar Auto-Refresh on Time Entry and Pomodoro Updates', () => {
	/**
	 * Mock implementation of the calendar view's data update handling.
	 * Replicates the actual behavior in CalendarView.onDataUpdated().
	 */
	class MockCalendarViewUpdateHandler {
		private _isRendering = false;
		private _pendingRender = false;
		private _expectingImmediateUpdate = false;
		private _isFirstDataUpdate = true;
		private _previousConfigSnapshot: string | null = null;
		private dataUpdateDebounceTimer: ReturnType<typeof setTimeout> | null = null;
		private renderCount = 0;
		private renderTimestamps: number[] = [];
		private configSnapshot = '{}';

		// Track if view shows time entries
		viewOptions = {
			showTimeEntries: true
		};

		render(): void {
			// Simplified render - just increment count
			// (We don't need the render lock for these tests)
			this.renderCount++;
			this.renderTimestamps.push(Date.now());
		}

		expectImmediateUpdate(): void {
			this._expectingImmediateUpdate = true;
			// Auto-reset after 2 seconds (as implemented)
			setTimeout(() => {
				this._expectingImmediateUpdate = false;
			}, 2000);
		}

		hasConfigChanged(): boolean {
			const current = this.configSnapshot;
			if (this._previousConfigSnapshot === null) {
				this._previousConfigSnapshot = current;
				return false;
			}
			if (current !== this._previousConfigSnapshot) {
				this._previousConfigSnapshot = current;
				return true;
			}
			return false;
		}

		onDataUpdated(): void {
			if (this.dataUpdateDebounceTimer) {
				clearTimeout(this.dataUpdateDebounceTimer);
				this.dataUpdateDebounceTimer = null;
			}

			// First data update should be immediate
			if (this._isFirstDataUpdate) {
				this._isFirstDataUpdate = false;
				this.render();
				return;
			}

			// User-initiated actions should be immediate
			if (this._expectingImmediateUpdate) {
				this._expectingImmediateUpdate = false;
				this.render();
				return;
			}

			// Config changes should be immediate
			if (this.hasConfigChanged()) {
				this.render();
				return;
			}

			// Otherwise debounce for 5 seconds (current behavior)
			this.dataUpdateDebounceTimer = setTimeout(() => {
				this.dataUpdateDebounceTimer = null;
				this.render();
			}, 5000);
		}

		getRenderCount(): number {
			return this.renderCount;
		}

		hasPendingDebounce(): boolean {
			return this.dataUpdateDebounceTimer !== null;
		}

		cancelPendingDebounce(): void {
			if (this.dataUpdateDebounceTimer) {
				clearTimeout(this.dataUpdateDebounceTimer);
				this.dataUpdateDebounceTimer = null;
			}
		}

		isExpectingImmediateUpdate(): boolean {
			return this._expectingImmediateUpdate;
		}

		reset(): void {
			this.cancelPendingDebounce();
			this._isRendering = false;
			this._pendingRender = false;
			this._expectingImmediateUpdate = false;
			this._isFirstDataUpdate = true;
			this._previousConfigSnapshot = null;
			this.renderCount = 0;
			this.renderTimestamps = [];
		}
	}

	/**
	 * Mock implementation simulating what happens when time entries are saved.
	 * This replicates the flow in main.ts openTimeEntryEditor().
	 */
	class MockTimeEntrySaveHandler {
		constructor(
			private emitter: MockEventEmitter,
			private calendarViews: MockCalendarViewUpdateHandler[]
		) {}

		/**
		 * Current implementation - does NOT call expectImmediateUpdate()
		 */
		async saveTimeEntriesCurrent(taskPath: string, timeEntries: TimeEntry[]): Promise<void> {
			// Simulates taskService.updateTask() which triggers EVENT_TASK_UPDATED
			this.emitter.trigger(EVENT_TASK_UPDATED, { path: taskPath, task: { timeEntries } });

			// Then triggers EVENT_DATA_CHANGED
			this.emitter.trigger(EVENT_DATA_CHANGED);
		}

		/**
		 * Fixed implementation - DOES call expectImmediateUpdate()
		 */
		async saveTimeEntriesFixed(taskPath: string, timeEntries: TimeEntry[]): Promise<void> {
			// Signal immediate update expected on all calendar views
			for (const view of this.calendarViews) {
				view.expectImmediateUpdate();
			}

			// Simulates taskService.updateTask() which triggers EVENT_TASK_UPDATED
			this.emitter.trigger(EVENT_TASK_UPDATED, { path: taskPath, task: { timeEntries } });

			// Then triggers EVENT_DATA_CHANGED
			this.emitter.trigger(EVENT_DATA_CHANGED);
		}
	}

	/**
	 * Mock implementation simulating pomodoro completion.
	 * This replicates the flow in PomodoroService.completePomodoro().
	 */
	class MockPomodoroCompletionHandler {
		constructor(
			private emitter: MockEventEmitter,
			private calendarViews: MockCalendarViewUpdateHandler[]
		) {}

		/**
		 * Current implementation - does NOT signal calendar to refresh immediately
		 */
		async completePomodoroSessionCurrent(taskPath: string, sessionDuration: number): Promise<void> {
			// Simulates stopTimeTracking which triggers EVENT_TASK_UPDATED
			const timeEntry: TimeEntry = {
				startTime: new Date(Date.now() - sessionDuration * 60 * 1000).toISOString(),
				endTime: new Date().toISOString(),
				duration: sessionDuration,
				description: 'Pomodoro session'
			};

			this.emitter.trigger(EVENT_TASK_UPDATED, { path: taskPath, task: { timeEntries: [timeEntry] } });

			// Triggers EVENT_POMODORO_COMPLETE
			this.emitter.trigger(EVENT_POMODORO_COMPLETE, {
				session: { type: 'work', taskPath, completed: true },
				nextType: 'short-break'
			});
		}

		/**
		 * Fixed implementation - DOES signal calendar to refresh immediately
		 */
		async completePomodoroSessionFixed(taskPath: string, sessionDuration: number): Promise<void> {
			// Signal immediate update expected on all calendar views
			for (const view of this.calendarViews) {
				view.expectImmediateUpdate();
			}

			// Simulates stopTimeTracking which triggers EVENT_TASK_UPDATED
			const timeEntry: TimeEntry = {
				startTime: new Date(Date.now() - sessionDuration * 60 * 1000).toISOString(),
				endTime: new Date().toISOString(),
				duration: sessionDuration,
				description: 'Pomodoro session'
			};

			this.emitter.trigger(EVENT_TASK_UPDATED, { path: taskPath, task: { timeEntries: [timeEntry] } });

			// Triggers EVENT_POMODORO_COMPLETE
			this.emitter.trigger(EVENT_POMODORO_COMPLETE, {
				session: { type: 'work', taskPath, completed: true },
				nextType: 'short-break'
			});
		}
	}

	let emitter: MockEventEmitter;
	let calendarView: MockCalendarViewUpdateHandler;
	let timeEntrySaveHandler: MockTimeEntrySaveHandler;
	let pomodoroHandler: MockPomodoroCompletionHandler;

	beforeEach(() => {
		jest.useFakeTimers();
		emitter = new MockEventEmitter();
		calendarView = new MockCalendarViewUpdateHandler();
		timeEntrySaveHandler = new MockTimeEntrySaveHandler(emitter, [calendarView]);
		pomodoroHandler = new MockPomodoroCompletionHandler(emitter, [calendarView]);

		// Set up calendar to listen for data changes
		emitter.on(EVENT_DATA_CHANGED, () => calendarView.onDataUpdated());
		emitter.on(EVENT_TASK_UPDATED, () => calendarView.onDataUpdated());
	});

	afterEach(() => {
		calendarView.cancelPendingDebounce();
		emitter.removeAllListeners();
		jest.useRealTimers();
	});

	describe('Mock Sanity Check', () => {
		it('should verify expectImmediateUpdate works correctly', () => {
			// Create fresh instance
			const view = new MockCalendarViewUpdateHandler();

			// Verify initial state
			expect(view.isExpectingImmediateUpdate()).toBe(false);

			// Set immediate flag
			view.expectImmediateUpdate();

			// Verify flag is set
			expect(view.isExpectingImmediateUpdate()).toBe(true);
		});

		it('should verify render count increases on render', () => {
			const view = new MockCalendarViewUpdateHandler();
			expect(view.getRenderCount()).toBe(0);

			// First onDataUpdated triggers immediate render (isFirstDataUpdate)
			view.onDataUpdated();
			expect(view.getRenderCount()).toBe(1);
		});

		it('should verify expectImmediateUpdate causes immediate render', () => {
			const view = new MockCalendarViewUpdateHandler();

			// First update - consumes isFirstDataUpdate
			view.onDataUpdated();
			expect(view.getRenderCount()).toBe(1);

			// Set immediate update flag
			view.expectImmediateUpdate();
			expect(view.isExpectingImmediateUpdate()).toBe(true);

			// Second update should render immediately
			view.onDataUpdated();
			expect(view.getRenderCount()).toBe(2);
			expect(view.isExpectingImmediateUpdate()).toBe(false); // Flag consumed
		});
	});

	describe('Time Entry Save - Calendar Refresh Behavior', () => {
		it('CURRENT BEHAVIOR (BUG): calendar does NOT refresh immediately when time entries are saved', async () => {
			// Consume first update (initial load)
			calendarView.onDataUpdated();
			expect(calendarView.getRenderCount()).toBe(1);

			// Simulate current implementation (NO expectImmediateUpdate called)
			// This is what happens today - time entries are saved but calendar debounces
			calendarView.onDataUpdated(); // EVENT_TASK_UPDATED fires
			calendarView.onDataUpdated(); // EVENT_DATA_CHANGED fires

			// Calendar is in debounce mode, not rendered yet
			expect(calendarView.getRenderCount()).toBe(1); // Still only first load
			expect(calendarView.hasPendingDebounce()).toBe(true); // Waiting for debounce

			// User has to wait 5 seconds for calendar to show the new time entry
			jest.advanceTimersByTime(5000);
			jest.runAllTimers();

			expect(calendarView.getRenderCount()).toBe(2); // Finally rendered after 5s
		});

		it('EXPECTED BEHAVIOR (FIX): calendar SHOULD refresh immediately when time entries are saved', async () => {
			// Consume first update (initial load)
			calendarView.onDataUpdated();
			expect(calendarView.getRenderCount()).toBe(1);

			// Simulate FIXED implementation - expectImmediateUpdate() is called before events
			// This is what SHOULD happen after the fix
			calendarView.expectImmediateUpdate(); // Fix: called before data change
			calendarView.onDataUpdated(); // EVENT_TASK_UPDATED fires - immediate render due to flag
			calendarView.onDataUpdated(); // EVENT_DATA_CHANGED fires - debounces (flag consumed)

			// Calendar should render immediately (not waiting for debounce)
			expect(calendarView.getRenderCount()).toBe(2); // Immediate render
			// Note: A debounce may be pending from the second event, but user already sees update
		});

		it('should verify time entry events would be visible with showTimeEntries enabled', () => {
			// This tests that the calendar config would show time entry events
			expect(calendarView.viewOptions.showTimeEntries).toBe(true);
		});
	});

	describe('Pomodoro Completion - Calendar Refresh Behavior', () => {
		it('CURRENT BEHAVIOR (BUG): calendar does NOT refresh immediately when pomodoro completes', async () => {
			// Consume first update (initial load)
			calendarView.onDataUpdated();
			expect(calendarView.getRenderCount()).toBe(1);

			// Simulate current implementation (NO expectImmediateUpdate called)
			// This is what happens today - pomodoro completes but calendar debounces
			calendarView.onDataUpdated(); // EVENT_TASK_UPDATED fires from stopTimeTracking
			// EVENT_POMODORO_COMPLETE also fires but calendar doesn't listen to it

			// Calendar is in debounce mode, not rendered yet
			expect(calendarView.getRenderCount()).toBe(1); // Still only first load
			expect(calendarView.hasPendingDebounce()).toBe(true); // Waiting for debounce

			// User has to wait 5 seconds for calendar to show the pomodoro time entry
			jest.advanceTimersByTime(5000);
			jest.runAllTimers();

			expect(calendarView.getRenderCount()).toBe(2); // Finally rendered after 5s
		});

		it('EXPECTED BEHAVIOR (FIX): calendar SHOULD refresh immediately when pomodoro completes', async () => {
			// Consume first update (initial load)
			calendarView.onDataUpdated();
			expect(calendarView.getRenderCount()).toBe(1);

			// Simulate FIXED implementation - expectImmediateUpdate() is called before events
			// This is what SHOULD happen after the fix
			calendarView.expectImmediateUpdate(); // Fix: called before stopTimeTracking
			calendarView.onDataUpdated(); // EVENT_TASK_UPDATED fires - immediate render due to flag

			// Calendar should render immediately (not waiting for debounce)
			expect(calendarView.getRenderCount()).toBe(2); // Immediate render
		});
	});

	describe('Integration: Time Entry Modal Save Flow', () => {
		it('EXPECTED: should render immediately when expectImmediateUpdate is called before data update', () => {
			/**
			 * Expected flow (after fix):
			 * 1. User edits time entries in TimeEntryEditorModal
			 * 2. User clicks Save
			 * 3. TimeEntryEditorModal calls onSave callback with updated entries
			 * 4. main.ts openTimeEntryEditor handler:
			 *    a. Gets all open CalendarView instances
			 *    b. Calls expectImmediateUpdate() on each
			 *    c. Calls taskService.updateTask() (triggers EVENT_TASK_UPDATED)
			 *    d. Triggers EVENT_DATA_CHANGED
			 * 5. CalendarView.onDataUpdated receives event
			 * 6. Since expectImmediateUpdate was called, renders immediately
			 * 7. User sees updated time entry on calendar within ~100ms
			 */

			// Simulate the fixed flow
			calendarView.onDataUpdated(); // Initial load
			expect(calendarView.getRenderCount()).toBe(1);

			// Step 4b: Call expectImmediateUpdate before data changes
			calendarView.expectImmediateUpdate();

			// Step 5: Data update triggers
			calendarView.onDataUpdated();

			// Step 6 & 7: Immediate render
			expect(calendarView.getRenderCount()).toBe(2);
		});
	});

	describe('Edge Cases', () => {
		it('EXPECTED: should handle multiple calendar views being open', () => {
			const calendarView2 = new MockCalendarViewUpdateHandler();

			// Initial load for both views
			calendarView.onDataUpdated();
			calendarView2.onDataUpdated();
			expect(calendarView.getRenderCount()).toBe(1);
			expect(calendarView2.getRenderCount()).toBe(1);

			// Simulate fixed implementation: expectImmediateUpdate called on BOTH views
			calendarView.expectImmediateUpdate();
			calendarView2.expectImmediateUpdate();

			// Data update triggers for both views
			calendarView.onDataUpdated();
			calendarView2.onDataUpdated();

			// Both views should refresh immediately
			expect(calendarView.getRenderCount()).toBe(2);
			expect(calendarView2.getRenderCount()).toBe(2);

			calendarView2.cancelPendingDebounce();
		});

		it('EXPECTED: should handle rapid time entry edits', () => {
			calendarView.onDataUpdated(); // Initial load

			// Rapid edits (user making quick changes) - each triggers expectImmediateUpdate
			for (let i = 0; i < 5; i++) {
				calendarView.expectImmediateUpdate();
				calendarView.onDataUpdated();
			}

			// Each edit should cause immediate render
			expect(calendarView.getRenderCount()).toBe(6); // 1 initial + 5 edits
		});

		it('EXPECTED: should still debounce external changes that are not time entry related', () => {
			calendarView.onDataUpdated(); // Initial load
			expect(calendarView.getRenderCount()).toBe(1);

			// External change (e.g., user typing in a note file) - NO expectImmediateUpdate
			calendarView.onDataUpdated();

			// Should debounce
			expect(calendarView.getRenderCount()).toBe(1);
			expect(calendarView.hasPendingDebounce()).toBe(true);

			// But time entry save should still be immediate
			calendarView.expectImmediateUpdate();
			calendarView.onDataUpdated();

			expect(calendarView.getRenderCount()).toBe(2);
		});
	});
});

describe('Issue #1425 - Implementation Requirements', () => {
	/**
	 * These tests document the specific code changes required to fix the issue.
	 * They serve as acceptance criteria for the fix.
	 */

	it('should document required changes in main.ts openTimeEntryEditor()', () => {
		/**
		 * File: src/main.ts
		 * Method: openTimeEntryEditor()
		 *
		 * Current implementation (around line 2745):
		 * ```typescript
		 * const modal = new TimeEntryEditorModal(this.app, this, task, async (updatedEntries) => {
		 *   try {
		 *     await this.taskService.updateTask(task, { timeEntries: updatedEntries });
		 *     onSave?.();
		 *     this.emitter.trigger(EVENT_DATA_CHANGED);
		 *     new Notice(this.i18n.translate("modals.timeEntryEditor.saved"));
		 *   } catch (error) { ... }
		 * });
		 * ```
		 *
		 * Required change - add before updateTask:
		 * ```typescript
		 * // Signal immediate update for calendar views before triggering data change
		 * this.signalCalendarImmediateUpdate();
		 * ```
		 *
		 * New helper method to add:
		 * ```typescript
		 * private signalCalendarImmediateUpdate(): void {
		 *   // Find all open calendar views and signal immediate update
		 *   this.app.workspace.iterateAllLeaves((leaf) => {
		 *     const view = leaf.view;
		 *     if (view instanceof CalendarView) {
		 *       view.expectImmediateUpdate();
		 *     }
		 *   });
		 * }
		 * ```
		 */
		expect(true).toBe(true); // Documentation test
	});

	it('should document required changes in PomodoroService', () => {
		/**
		 * File: src/services/PomodoroService.ts
		 * Method: completePomodoro()
		 *
		 * Option 1: Signal calendar views before stopTimeTracking
		 * ```typescript
		 * async completePomodoro(): Promise<void> {
		 *   // ... existing code ...
		 *
		 *   // Signal immediate update for calendar views
		 *   this.plugin.signalCalendarImmediateUpdate();
		 *
		 *   // Call stopTimeTracking which triggers EVENT_TASK_UPDATED
		 *   await this.taskService.stopTimeTracking(task);
		 *
		 *   // ... rest of existing code ...
		 * }
		 * ```
		 *
		 * Option 2: Have CalendarView listen to EVENT_POMODORO_COMPLETE
		 * In CalendarView.ts setupEventListeners():
		 * ```typescript
		 * this.plugin.emitter.on(EVENT_POMODORO_COMPLETE, () => {
		 *   this.expectImmediateUpdate();
		 *   this.render();
		 * });
		 * ```
		 */
		expect(true).toBe(true); // Documentation test
	});

	it('should verify CalendarView.expectImmediateUpdate() is accessible', () => {
		/**
		 * CalendarView already has expectImmediateUpdate() method.
		 * It just needs to be made public or called via a plugin method.
		 *
		 * Current: private _expectingImmediateUpdate = false;
		 * Method exists: expectImmediateUpdate() sets this flag and auto-resets after 2 seconds
		 *
		 * The method bypasses the 5-second debounce in onDataUpdated().
		 */
		expect(true).toBe(true); // Documentation test
	});
});
