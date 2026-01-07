/**
 * Issue #811 - CalDAV Two-Way Sync Support Feature Request
 *
 * This test file documents the expected behavior for CalDAV two-way sync.
 * The key distinction from issue #1209 (CalDAV integration) is the bidirectional
 * nature: not just reading calendar events, but syncing TaskNotes tasks TO a
 * CalDAV server (similar to how TaskCalendarSyncService works for Google Calendar).
 *
 * Feature Request: https://github.com/tasknotes/tasknotes/issues/811
 *
 * User's use case:
 * - Sync with CalDAV servers (Nextcloud, iCloud, other CalDAV-compatible services)
 * - Keep tasks and deadlines unified across devices and apps
 * - Integrate Obsidian notes with existing calendar setups
 * - Avoid duplicating effort by re-entering tasks in multiple places
 *
 * Expected functionality:
 * - Task-to-CalDAV sync: Create calendar events from tasks on CalDAV server
 * - CalDAV-to-task sync: Create/update tasks from CalDAV events
 * - Conflict resolution for bidirectional changes
 * - Support for various CalDAV providers (Nextcloud, iCloud, Radicale, etc.)
 */

import { EventEmitter } from "events";
import { ICSEvent, TaskInfo } from "../../../src/types";

// Mock Obsidian dependencies
jest.mock("obsidian", () => ({
	Notice: jest.fn(),
	requestUrl: jest.fn(),
	TFile: jest.fn(),
}));

/**
 * Mock CalDAV Two-Way Sync Service
 * This represents what a real CalDAVTwoWaySyncService would look like,
 * analogous to TaskCalendarSyncService for Google Calendar
 */
class MockCalDAVTwoWaySyncService extends EventEmitter {
	private serverUrl: string;
	private calendarId: string | null = null;
	private enabled = false;

	// Track synced items: task path -> CalDAV event UID
	private syncedTasks: Map<string, string> = new Map();
	// Track CalDAV events that have been imported as tasks
	private importedEvents: Map<string, string> = new Map();

	constructor(config: { serverUrl: string }) {
		super();
		this.serverUrl = config.serverUrl;
	}

	setTargetCalendar(calendarId: string): void {
		this.calendarId = calendarId;
	}

	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
	}

	isEnabled(): boolean {
		return this.enabled && this.calendarId !== null;
	}

	/**
	 * Sync a task to CalDAV - creates or updates a calendar event
	 */
	async syncTaskToCalDAV(task: TaskInfo): Promise<string | null> {
		if (!this.isEnabled()) return null;
		if (!task.due && !task.scheduled) return null;

		const eventUid = `tasknotes-${task.path.replace(/[^a-z0-9]/gi, "-")}`;
		this.syncedTasks.set(task.path, eventUid);
		return eventUid;
	}

	/**
	 * Remove a task's calendar event from CalDAV
	 */
	async removeTaskFromCalDAV(taskPath: string): Promise<void> {
		this.syncedTasks.delete(taskPath);
	}

	/**
	 * Import a CalDAV event as a task
	 */
	async importEventAsTask(event: ICSEvent): Promise<string | null> {
		if (!this.isEnabled()) return null;

		const taskPath = `tasks/${event.title.replace(/[^a-z0-9]/gi, "-")}.md`;
		this.importedEvents.set(event.id, taskPath);
		return taskPath;
	}

	/**
	 * Get the CalDAV event UID for a synced task
	 */
	getEventUidForTask(taskPath: string): string | undefined {
		return this.syncedTasks.get(taskPath);
	}

	/**
	 * Get the task path for an imported CalDAV event
	 */
	getTaskPathForEvent(eventId: string): string | undefined {
		return this.importedEvents.get(eventId);
	}

	/**
	 * Perform a full bidirectional sync
	 */
	async performFullSync(): Promise<{
		tasksCreated: number;
		eventsCreated: number;
		conflicts: number;
	}> {
		return { tasksCreated: 0, eventsCreated: 0, conflicts: 0 };
	}

	destroy(): void {
		this.syncedTasks.clear();
		this.importedEvents.clear();
	}
}

describe("Issue #811 - CalDAV Two-Way Sync Support", () => {
	let syncService: MockCalDAVTwoWaySyncService;

	beforeEach(() => {
		syncService = new MockCalDAVTwoWaySyncService({
			serverUrl: "https://nextcloud.example.com/remote.php/dav/",
		});
	});

	afterEach(() => {
		syncService.destroy();
	});

	describe("Task-to-CalDAV Sync (Outbound)", () => {
		it.skip("reproduces issue #811 - should sync task with due date to CalDAV", async () => {
			// Feature: When a task has a due date, create a corresponding calendar event on CalDAV
			syncService.setTargetCalendar("personal");
			syncService.setEnabled(true);

			const task: TaskInfo = {
				title: "Submit report",
				path: "tasks/submit-report.md",
				status: "open",
				priority: "medium",
				due: "2025-01-20",
				projects: [],
				contexts: [],
				tags: [],
			};

			const eventUid = await syncService.syncTaskToCalDAV(task);

			expect(eventUid).toBeDefined();
			expect(syncService.getEventUidForTask(task.path)).toBe(eventUid);
		});

		it.skip("reproduces issue #811 - should sync task with scheduled date to CalDAV", async () => {
			// Feature: Tasks with scheduled dates should also sync as calendar events
			syncService.setTargetCalendar("personal");
			syncService.setEnabled(true);

			const task: TaskInfo = {
				title: "Team meeting prep",
				path: "tasks/team-meeting-prep.md",
				status: "open",
				priority: "high",
				scheduled: "2025-01-15T09:00",
				projects: [],
				contexts: [],
				tags: [],
			};

			const eventUid = await syncService.syncTaskToCalDAV(task);

			expect(eventUid).toBeDefined();
		});

		it.skip("reproduces issue #811 - should update CalDAV event when task changes", async () => {
			// Feature: Task updates should propagate to CalDAV
			syncService.setTargetCalendar("personal");
			syncService.setEnabled(true);

			const task: TaskInfo = {
				title: "Original title",
				path: "tasks/my-task.md",
				status: "open",
				priority: "medium",
				due: "2025-01-20",
				projects: [],
				contexts: [],
				tags: [],
			};

			await syncService.syncTaskToCalDAV(task);
			const eventUid = syncService.getEventUidForTask(task.path);

			// Update the task
			task.title = "Updated title";
			task.due = "2025-01-25";

			await syncService.syncTaskToCalDAV(task);

			// Should maintain the same event UID (update, not create new)
			expect(syncService.getEventUidForTask(task.path)).toBe(eventUid);
		});

		it.skip("reproduces issue #811 - should delete CalDAV event when task is deleted", async () => {
			// Feature: Removing a task should remove its calendar event
			syncService.setTargetCalendar("personal");
			syncService.setEnabled(true);

			const task: TaskInfo = {
				title: "Temporary task",
				path: "tasks/temporary-task.md",
				status: "open",
				priority: "low",
				due: "2025-01-20",
				projects: [],
				contexts: [],
				tags: [],
			};

			await syncService.syncTaskToCalDAV(task);
			expect(syncService.getEventUidForTask(task.path)).toBeDefined();

			await syncService.removeTaskFromCalDAV(task.path);
			expect(syncService.getEventUidForTask(task.path)).toBeUndefined();
		});

		it.skip("reproduces issue #811 - should mark CalDAV event completed when task is completed", async () => {
			// Feature: Completing a task should update the CalDAV event status
			syncService.setTargetCalendar("personal");
			syncService.setEnabled(true);

			const task: TaskInfo = {
				title: "Complete me",
				path: "tasks/complete-me.md",
				status: "open",
				priority: "medium",
				due: "2025-01-20",
				projects: [],
				contexts: [],
				tags: [],
			};

			await syncService.syncTaskToCalDAV(task);

			// Mark task as completed
			task.status = "completed";
			task.completedDate = "2025-01-18";

			await syncService.syncTaskToCalDAV(task);

			// Event should be updated to reflect completion
			expect(syncService.getEventUidForTask(task.path)).toBeDefined();
		});
	});

	describe("CalDAV-to-Task Sync (Inbound)", () => {
		it.skip("reproduces issue #811 - should create task from CalDAV event", async () => {
			// Feature: Import CalDAV events as TaskNotes tasks
			// This keeps tasks unified across devices and apps
			syncService.setTargetCalendar("personal");
			syncService.setEnabled(true);

			const caldavEvent: ICSEvent = {
				id: "caldav-personal-event123",
				subscriptionId: "caldav-personal",
				title: "Project deadline",
				start: "2025-01-25",
				allDay: true,
				description: "Final submission for Q1 project",
			};

			const taskPath = await syncService.importEventAsTask(caldavEvent);

			expect(taskPath).toBeDefined();
			expect(syncService.getTaskPathForEvent(caldavEvent.id)).toBe(
				taskPath
			);
		});

		it.skip("reproduces issue #811 - should update task when CalDAV event changes", async () => {
			// Feature: Changes made to events in external calendar apps should
			// sync back to TaskNotes (avoids re-entering tasks in multiple places)
			syncService.setTargetCalendar("personal");
			syncService.setEnabled(true);

			const caldavEvent: ICSEvent = {
				id: "caldav-personal-event456",
				subscriptionId: "caldav-personal",
				title: "Meeting",
				start: "2025-01-20T10:00:00",
				end: "2025-01-20T11:00:00",
				allDay: false,
			};

			await syncService.importEventAsTask(caldavEvent);
			const taskPath = syncService.getTaskPathForEvent(caldavEvent.id);

			// Event is updated externally
			caldavEvent.title = "Important Meeting";
			caldavEvent.start = "2025-01-21T10:00:00";

			await syncService.importEventAsTask(caldavEvent);

			// Should update the same task, not create a new one
			expect(syncService.getTaskPathForEvent(caldavEvent.id)).toBe(
				taskPath
			);
		});

		it.skip("reproduces issue #811 - should handle timed events from CalDAV", async () => {
			// Feature: Support importing events with specific times
			syncService.setTargetCalendar("personal");
			syncService.setEnabled(true);

			const timedEvent: ICSEvent = {
				id: "caldav-personal-timed1",
				subscriptionId: "caldav-personal",
				title: "Doctor appointment",
				start: "2025-01-22T14:30:00",
				end: "2025-01-22T15:00:00",
				allDay: false,
				location: "Medical Center",
			};

			const taskPath = await syncService.importEventAsTask(timedEvent);

			expect(taskPath).toBeDefined();
			// Task should preserve the time component
		});
	});

	describe("Bidirectional Sync and Conflict Resolution", () => {
		it.skip("reproduces issue #811 - should detect and handle sync conflicts", async () => {
			// Feature: When both task and event are modified, handle conflict
			syncService.setTargetCalendar("personal");
			syncService.setEnabled(true);

			// Scenario: Task synced to CalDAV, then both are modified
			const result = await syncService.performFullSync();

			// Should track conflicts for user resolution
			expect(result).toHaveProperty("conflicts");
		});

		it.skip("reproduces issue #811 - should perform full bidirectional sync", async () => {
			// Feature: Sync all tasks to CalDAV and import all CalDAV events as tasks
			syncService.setTargetCalendar("personal");
			syncService.setEnabled(true);

			const result = await syncService.performFullSync();

			expect(result).toHaveProperty("tasksCreated");
			expect(result).toHaveProperty("eventsCreated");
		});

		it.skip("reproduces issue #811 - should not duplicate items during sync", async () => {
			// Feature: Syncing should maintain 1:1 mapping between tasks and events
			// This addresses the user's concern about "duplicating effort"
			syncService.setTargetCalendar("personal");
			syncService.setEnabled(true);

			const task: TaskInfo = {
				title: "Unique task",
				path: "tasks/unique-task.md",
				status: "open",
				priority: "medium",
				due: "2025-01-20",
				projects: [],
				contexts: [],
				tags: [],
			};

			// Sync multiple times
			await syncService.syncTaskToCalDAV(task);
			await syncService.syncTaskToCalDAV(task);
			await syncService.syncTaskToCalDAV(task);

			// Should still have only one event UID
			const eventUid = syncService.getEventUidForTask(task.path);
			expect(eventUid).toBeDefined();
		});
	});

	describe("CalDAV Provider Support", () => {
		it.skip("reproduces issue #811 - should support Nextcloud CalDAV server", async () => {
			// Feature: Connect to Nextcloud calendar
			const nextcloudService = new MockCalDAVTwoWaySyncService({
				serverUrl: "https://nextcloud.example.com/remote.php/dav/",
			});

			nextcloudService.setTargetCalendar("personal");
			nextcloudService.setEnabled(true);

			expect(nextcloudService.isEnabled()).toBe(true);
			nextcloudService.destroy();
		});

		it.skip("reproduces issue #811 - should support iCloud CalDAV server", async () => {
			// Feature: Connect to iCloud calendar (CalDAV-compatible)
			const icloudService = new MockCalDAVTwoWaySyncService({
				serverUrl: "https://caldav.icloud.com/",
			});

			icloudService.setTargetCalendar("calendar-id");
			icloudService.setEnabled(true);

			expect(icloudService.isEnabled()).toBe(true);
			icloudService.destroy();
		});

		it.skip("reproduces issue #811 - should support other CalDAV-compatible services", async () => {
			// Feature: Generic CalDAV support for any compliant server
			// Examples: Radicale, Baikal, ownCloud, Fastmail, etc.
			const genericService = new MockCalDAVTwoWaySyncService({
				serverUrl: "https://calendar.example.com/caldav/",
			});

			genericService.setTargetCalendar("default");
			genericService.setEnabled(true);

			expect(genericService.isEnabled()).toBe(true);
			genericService.destroy();
		});
	});

	describe("Cross-Device Sync Scenarios", () => {
		it.skip("reproduces issue #811 - should keep tasks unified across devices", async () => {
			// Feature: User's main use case - tasks stay in sync across devices/apps
			// Task created in Obsidian -> appears in phone calendar app
			// Event created in calendar app -> appears as task in Obsidian
			syncService.setTargetCalendar("personal");
			syncService.setEnabled(true);

			// Create task in TaskNotes
			const task: TaskInfo = {
				title: "Call client",
				path: "tasks/call-client.md",
				status: "open",
				priority: "high",
				due: "2025-01-20T14:00",
				projects: [],
				contexts: [],
				tags: [],
			};

			// Sync to CalDAV (will appear on phone, tablet, other devices)
			const eventUid = await syncService.syncTaskToCalDAV(task);
			expect(eventUid).toBeDefined();

			// Event created externally (from phone calendar)
			const externalEvent: ICSEvent = {
				id: "caldav-personal-external1",
				subscriptionId: "caldav-personal",
				title: "Dentist appointment",
				start: "2025-01-22T09:00:00",
				end: "2025-01-22T10:00:00",
				allDay: false,
			};

			// Import as task in TaskNotes
			const taskPath =
				await syncService.importEventAsTask(externalEvent);
			expect(taskPath).toBeDefined();
		});

		it.skip("reproduces issue #811 - should integrate with existing calendar setups", async () => {
			// Feature: Work with user's existing CalDAV calendar infrastructure
			// No need to change their current workflow, just enhance it
			syncService.setTargetCalendar("work-calendar");
			syncService.setEnabled(true);

			// Existing calendar events should be importable
			const existingEvent: ICSEvent = {
				id: "caldav-work-existing1",
				subscriptionId: "caldav-work-calendar",
				title: "Existing team meeting",
				start: "2025-01-21T15:00:00",
				end: "2025-01-21T16:00:00",
				allDay: false,
				description: "Weekly sync",
			};

			const taskPath =
				await syncService.importEventAsTask(existingEvent);
			expect(taskPath).toBeDefined();
		});
	});

	describe("Service Configuration", () => {
		it.skip("reproduces issue #811 - should require target calendar to be enabled", async () => {
			// Feature: Must select a calendar before sync works
			syncService.setEnabled(true);
			// No calendar selected

			expect(syncService.isEnabled()).toBe(false);

			syncService.setTargetCalendar("personal");
			expect(syncService.isEnabled()).toBe(true);
		});

		it.skip("reproduces issue #811 - should not sync when disabled", async () => {
			// Feature: Sync can be toggled on/off
			syncService.setTargetCalendar("personal");
			syncService.setEnabled(false);

			const task: TaskInfo = {
				title: "Should not sync",
				path: "tasks/no-sync.md",
				status: "open",
				priority: "low",
				due: "2025-01-20",
				projects: [],
				contexts: [],
				tags: [],
			};

			const eventUid = await syncService.syncTaskToCalDAV(task);
			expect(eventUid).toBeNull();
		});
	});
});
