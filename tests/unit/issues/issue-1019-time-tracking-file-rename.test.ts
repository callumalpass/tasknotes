/**
 * Issue #1019: Time tracking fails to stop when renaming TaskNote file
 *
 * @see https://github.com/TaskNotesPlugin/tasknotes/issues/1019
 *
 * Bug Description:
 * When a user renames a file while time tracking is active, they cannot stop
 * time tracking unless they rename the file back to its original name.
 *
 * Root Cause Analysis:
 * Several components store task references by file path, and these paths are NOT
 * updated when a file is renamed:
 *
 * 1. PomodoroService stores taskPath in state:
 *    - src/services/PomodoroService.ts:213 - `taskPath: task?.path` in PomodoroSession
 *    - src/services/PomodoroService.ts:227 - `this.lastWorkSessionTaskPath = task.path`
 *    - src/services/PomodoroService.ts:228 - `this.lastSelectedTaskPath = task.path`
 *    - This state is persisted to disk and restored on plugin reload
 *
 * 2. When stopping time tracking or completing a Pomodoro:
 *    - PomodoroService.completePomodoro() line ~639 calls:
 *      `this.plugin.cacheManager.getTaskInfo(session.taskPath)`
 *    - If the file was renamed, session.taskPath points to the OLD path
 *    - getTaskInfo returns null because no file exists at the old path
 *    - Time tracking cannot be stopped
 *
 * 3. Similar issues with the advanced calendar:
 *    - Calendar events may store task path references
 *    - When file is renamed, calendar can't find the task
 *
 * User's Suggestion:
 * The user suggests using UIDs for task references instead of file paths.
 * This would require:
 * - Adding a unique identifier property to each TaskNote
 * - Storing references by UID instead of path
 * - Implementing UID lookup across the vault
 *
 * Current File Rename Handling:
 * - TaskManager.handleFileRenamed() (src/utils/TaskManager.ts:202-212)
 *   - Emits 'file-renamed' event but doesn't update PomodoroService state
 * - DependencyCache.handleFileRenamed() (src/utils/DependencyCache.ts:148-159)
 *   - Clears old path from indexes and re-indexes at new path
 *   - Does NOT update any in-memory path references in other services
 *
 * Suggested Fix Approaches:
 *
 * Option A: Listen to file rename events and update stored paths
 * - PomodoroService subscribes to 'file-renamed' event
 * - Updates currentSession.taskPath, lastWorkSessionTaskPath, lastSelectedTaskPath
 * - Saves updated state
 *
 * Option B: Use UID-based task references (user's suggestion)
 * - Add mandatory or auto-generated UID to TaskInfo
 * - Store UID in PomodoroSession instead of taskPath
 * - Implement TaskManager.getTaskByUID() for UID-based lookup
 * - More robust but requires migration
 *
 * Option C: Path-based lookup with fallback
 * - When getTaskInfo(path) returns null, search for task by other criteria
 * - e.g., search by time entry startTime that matches the active session
 * - Least invasive but more complex lookup logic
 */

import { TFile } from 'obsidian';
import { TaskInfo, TimeEntry, PomodoroSession } from '../../../src/types';

/**
 * Mock task factory for tests
 */
function createMockTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		path: 'tasks/original-task-name.md',
		title: 'Original Task Name',
		status: 'open',
		timeEntries: [],
		...overrides,
	} as TaskInfo;
}

/**
 * Mock time entry with active session
 */
function createActiveTimeEntry(): TimeEntry {
	return {
		startTime: new Date().toISOString(),
		description: 'Work session',
		// No endTime = active session
	};
}

/**
 * Mock Pomodoro session
 */
function createMockPomodoroSession(taskPath: string): PomodoroSession {
	return {
		id: Date.now().toString(),
		taskPath,
		startTime: new Date().toISOString(),
		plannedDuration: 25,
		type: 'work',
		completed: false,
		activePeriods: [
			{
				startTime: new Date().toISOString(),
			},
		],
	};
}

describe('Issue #1019 - Time Tracking Fails After File Rename', () => {
	describe('Bug Reproduction - Path Reference Becomes Stale', () => {
		it.skip('reproduces issue #1019 - stopTimeTracking fails when file is renamed', () => {
			/**
			 * Scenario:
			 * 1. User creates task "Original Task" at path "tasks/original-task.md"
			 * 2. User starts time tracking on the task
			 * 3. User renames file to "tasks/renamed-task.md"
			 * 4. User tries to stop time tracking - FAILS
			 *
			 * Current behavior:
			 * - TaskService.stopTimeTracking() receives task with path "tasks/renamed-task.md"
			 * - But if Pomodoro is active, it stores the OLD path "tasks/original-task.md"
			 * - When trying to look up the task by old path, it's not found
			 */

			const originalPath = 'tasks/original-task.md';
			const newPath = 'tasks/renamed-task.md';

			// Step 1: Create task with active time tracking
			const task = createMockTask({
				path: originalPath,
				title: 'Original Task',
				timeEntries: [createActiveTimeEntry()],
			});

			// Step 2: Simulate PomodoroService storing the task path
			const pomodoroSession = createMockPomodoroSession(originalPath);

			// Step 3: Simulate file rename (path changes, but pomodoro session keeps old path)
			const renamedTask: TaskInfo = {
				...task,
				path: newPath,
			};

			// Step 4: Bug - Pomodoro session still has OLD path
			expect(pomodoroSession.taskPath).toBe(originalPath);
			expect(renamedTask.path).toBe(newPath);

			// The paths don't match - this is the bug
			expect(pomodoroSession.taskPath).not.toBe(renamedTask.path);

			// When PomodoroService tries to stop time tracking:
			// await this.plugin.cacheManager.getTaskInfo(session.taskPath) // returns null!
			// The session.taskPath points to the OLD path which no longer exists
		});

		it.skip('reproduces issue #1019 - PomodoroService state becomes invalid after rename', () => {
			/**
			 * The PomodoroService stores multiple path references that all become stale:
			 * - currentSession.taskPath
			 * - lastWorkSessionTaskPath
			 * - lastSelectedTaskPath
			 *
			 * None of these are updated when the file is renamed.
			 */

			const originalPath = 'tasks/original-task.md';
			const newPath = 'tasks/renamed-task.md';

			// Simulate PomodoroService state after starting tracking
			const pomodoroState = {
				isRunning: true,
				timeRemaining: 1500,
				currentSession: createMockPomodoroSession(originalPath),
			};

			const lastWorkSessionTaskPath = originalPath;
			const lastSelectedTaskPath = originalPath;

			// After file rename - all these paths are now stale
			const fileStillExistsAtOldPath = false; // Simulated: file was renamed

			// BUG: All path references still point to old location
			expect(pomodoroState.currentSession?.taskPath).toBe(originalPath);
			expect(lastWorkSessionTaskPath).toBe(originalPath);
			expect(lastSelectedTaskPath).toBe(originalPath);

			// File lookup would fail
			expect(fileStillExistsAtOldPath).toBe(false);
		});

		it.skip('reproduces issue #1019 - calendar events may lose task reference after rename', () => {
			/**
			 * The user also mentions issues with file names changing in the advanced calendar.
			 * Calendar events store task paths for:
			 * - Rendering task details
			 * - Navigating to task on click
			 * - Drag-and-drop operations
			 *
			 * When file is renamed, these references become stale.
			 */

			interface CalendarEvent {
				taskPath: string;
				title: string;
				scheduledDate: string;
			}

			const originalPath = 'tasks/calendar-task.md';
			const newPath = 'tasks/renamed-calendar-task.md';

			// Calendar event created with original path
			const calendarEvent: CalendarEvent = {
				taskPath: originalPath,
				title: 'Calendar Task',
				scheduledDate: '2025-01-01',
			};

			// After file rename - calendar still has old path
			// Clicking on event would fail to open the file
			const attemptToOpenTask = (path: string): boolean => {
				// Simulates vault.getAbstractFileByPath(path)
				const fileExists = path === newPath;
				return fileExists;
			};

			// BUG: Calendar event points to non-existent path
			expect(calendarEvent.taskPath).toBe(originalPath);
			expect(attemptToOpenTask(calendarEvent.taskPath)).toBe(false);
			expect(attemptToOpenTask(newPath)).toBe(true);
		});
	});

	describe('EXPECTED BEHAVIOR - File Rename Should Update References', () => {
		it.skip('reproduces issue #1019 - PomodoroService should update paths on file rename', () => {
			/**
			 * Fix Option A: Subscribe to file rename events
			 *
			 * Expected behavior:
			 * - PomodoroService listens to TaskManager's 'file-renamed' event
			 * - Updates all stored path references
			 * - Saves updated state
			 */

			const originalPath = 'tasks/original-task.md';
			const newPath = 'tasks/renamed-task.md';

			// Initial state
			const pomodoroState = {
				isRunning: true,
				currentSession: createMockPomodoroSession(originalPath),
			};
			let lastWorkSessionTaskPath = originalPath;
			let lastSelectedTaskPath = originalPath;

			// Simulate file-renamed event handler (expected fix)
			function handleFileRenamed(event: { oldPath: string; newPath: string }): void {
				// Update currentSession.taskPath
				if (pomodoroState.currentSession?.taskPath === event.oldPath) {
					pomodoroState.currentSession.taskPath = event.newPath;
				}

				// Update lastWorkSessionTaskPath
				if (lastWorkSessionTaskPath === event.oldPath) {
					lastWorkSessionTaskPath = event.newPath;
				}

				// Update lastSelectedTaskPath
				if (lastSelectedTaskPath === event.oldPath) {
					lastSelectedTaskPath = event.newPath;
				}
			}

			// Trigger the fix
			handleFileRenamed({ oldPath: originalPath, newPath });

			// EXPECTED: All paths should now point to new location
			expect(pomodoroState.currentSession?.taskPath).toBe(newPath);
			expect(lastWorkSessionTaskPath).toBe(newPath);
			expect(lastSelectedTaskPath).toBe(newPath);
		});

		it.skip('reproduces issue #1019 - UID-based task references would be rename-proof', () => {
			/**
			 * Fix Option B: Use UIDs instead of paths (user's suggestion)
			 *
			 * Expected behavior:
			 * - Each task has a unique identifier that doesn't change on rename
			 * - Services store UID instead of path
			 * - UID lookup finds task regardless of current file name
			 */

			interface TaskWithUID extends TaskInfo {
				uid: string;
			}

			const taskUID = 'task-12345-abcde';

			// Task with UID - path changes but UID stays constant
			const taskBeforeRename: TaskWithUID = {
				uid: taskUID,
				path: 'tasks/original-name.md',
				title: 'Task Title',
				status: 'open',
			} as TaskWithUID;

			const taskAfterRename: TaskWithUID = {
				uid: taskUID,
				path: 'tasks/new-name.md',
				title: 'Task Title',
				status: 'open',
			} as TaskWithUID;

			// Pomodoro session stores UID instead of path
			interface PomodoroSessionWithUID {
				taskUID: string;
				// ... other fields
			}

			const session: PomodoroSessionWithUID = {
				taskUID: taskUID,
			};

			// UID remains valid after rename
			expect(session.taskUID).toBe(taskBeforeRename.uid);
			expect(session.taskUID).toBe(taskAfterRename.uid);

			// UID-based lookup would find the task regardless of current path
			function getTaskByUID(uid: string, allTasks: TaskWithUID[]): TaskWithUID | undefined {
				return allTasks.find((t) => t.uid === uid);
			}

			const foundTask = getTaskByUID(taskUID, [taskAfterRename]);
			expect(foundTask).toBeDefined();
			expect(foundTask?.path).toBe('tasks/new-name.md');
		});
	});

	describe('Edge Cases', () => {
		it.skip('reproduces issue #1019 - should handle rename during active Pomodoro session', () => {
			/**
			 * Specific edge case: File is renamed while Pomodoro timer is counting down
			 *
			 * Current behavior:
			 * - Timer continues counting
			 * - But when it completes, it can't find the task to stop time tracking
			 */

			const originalPath = 'tasks/pomodoro-task.md';
			const newPath = 'tasks/renamed-during-pomodoro.md';

			// Pomodoro started with original path
			const session = createMockPomodoroSession(originalPath);
			const timeRemaining = 1200; // 20 minutes left

			// File gets renamed during the session
			// Pomodoro has no knowledge of this

			// When timer completes (completePomodoro() is called):
			// It tries: await this.plugin.cacheManager.getTaskInfo(session.taskPath)
			// But session.taskPath is still originalPath which no longer exists

			// EXPECTED: Session should still be completable with task update at new path
			// CURRENT: Task lookup fails, time entry not closed properly
		});

		it.skip('reproduces issue #1019 - should handle rename to different folder', () => {
			/**
			 * Edge case: Task is moved to a different folder (also a rename operation)
			 */

			const originalPath = 'inbox/task.md';
			const newPath = 'projects/project-a/task.md';

			const session = createMockPomodoroSession(originalPath);

			// Moving to different folder is still a rename operation
			// Same issues apply
			expect(session.taskPath).toBe(originalPath);
			expect(session.taskPath).not.toBe(newPath);
		});

		it.skip('reproduces issue #1019 - should handle multiple rapid renames', () => {
			/**
			 * Edge case: File is renamed multiple times
			 */

			const path1 = 'tasks/name-1.md';
			const path2 = 'tasks/name-2.md';
			const path3 = 'tasks/name-3.md';

			const session = createMockPomodoroSession(path1);

			// Multiple renames happen
			// If fix uses event-based updates, it should handle each rename
			// Final session.taskPath should be path3
		});

		it.skip('reproduces issue #1019 - should persist updated paths across plugin reload', () => {
			/**
			 * Edge case: Plugin is reloaded after file was renamed
			 *
			 * PomodoroService saves state to disk including taskPath.
			 * If path was updated to new location, that should persist.
			 * If path wasn't updated, the stale path persists and issue continues.
			 */

			// Simulated persisted state
			const persistedState = {
				pomodoroState: {
					isRunning: false,
					currentSession: null,
				},
				lastSelectedTaskPath: 'tasks/old-path-that-no-longer-exists.md',
			};

			// On reload, lastSelectedTaskPath points to non-existent file
			// This causes issues when user tries to resume with "last selected task"
		});
	});
});

describe('Issue #1019 - Implementation Requirements', () => {
	describe('Required Changes for Fix Option A (Event-based path updates)', () => {
		it.skip('reproduces issue #1019 - PomodoroService should subscribe to file-renamed event', () => {
			/**
			 * Change 1: Subscribe to rename events
			 *
			 * Location: src/services/PomodoroService.ts
			 *
			 * In initialize() or constructor:
			 * ```typescript
			 * this.plugin.cacheManager.on('file-renamed', (event) => {
			 *   this.handleFileRenamed(event.oldPath, event.newPath);
			 * });
			 * ```
			 */
		});

		it.skip('reproduces issue #1019 - handleFileRenamed should update all path references', () => {
			/**
			 * Change 2: Implement path update handler
			 *
			 * Location: src/services/PomodoroService.ts
			 *
			 * ```typescript
			 * private handleFileRenamed(oldPath: string, newPath: string): void {
			 *   let stateChanged = false;
			 *
			 *   // Update current session
			 *   if (this.state.currentSession?.taskPath === oldPath) {
			 *     this.state.currentSession.taskPath = newPath;
			 *     stateChanged = true;
			 *   }
			 *
			 *   // Update last work session path
			 *   if (this.lastWorkSessionTaskPath === oldPath) {
			 *     this.lastWorkSessionTaskPath = newPath;
			 *   }
			 *
			 *   // Update last selected task path
			 *   if (this.lastSelectedTaskPath === oldPath) {
			 *     this.lastSelectedTaskPath = newPath;
			 *     this.saveLastSelectedTask(newPath);
			 *   }
			 *
			 *   // Persist state changes
			 *   if (stateChanged) {
			 *     this.saveState();
			 *   }
			 * }
			 * ```
			 */
		});
	});

	describe('Required Changes for Fix Option B (UID-based references)', () => {
		it.skip('reproduces issue #1019 - TaskInfo should have UID property', () => {
			/**
			 * Change 1: Add UID to TaskInfo type
			 *
			 * Location: src/types.ts
			 *
			 * ```typescript
			 * interface TaskInfo {
			 *   uid?: string; // Unique identifier, generated on task creation
			 *   // ... existing properties
			 * }
			 * ```
			 */
		});

		it.skip('reproduces issue #1019 - TaskManager should provide UID-based lookup', () => {
			/**
			 * Change 2: Add getTaskByUID method
			 *
			 * Location: src/utils/TaskManager.ts
			 *
			 * ```typescript
			 * async getTaskByUID(uid: string): Promise<TaskInfo | null> {
			 *   const allTasks = await this.getAllTasks();
			 *   return allTasks.find(task => task.uid === uid) || null;
			 * }
			 * ```
			 */
		});

		it.skip('reproduces issue #1019 - PomodoroSession should store taskUID instead of taskPath', () => {
			/**
			 * Change 3: Update PomodoroSession to use UID
			 *
			 * Location: src/types.ts
			 *
			 * ```typescript
			 * interface PomodoroSession {
			 *   taskUID?: string; // Changed from taskPath
			 *   // ... other properties
			 * }
			 * ```
			 *
			 * Migration: Need to handle existing sessions with taskPath
			 */
		});
	});
});
