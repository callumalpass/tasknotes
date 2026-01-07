/**
 * Issue #1199 - Add due dates/scheduled times to Google/Office calendars
 *
 * Feature Request: https://github.com/tasknotes/tasknotes/issues/1199
 *
 * Description:
 * The user wants to create calendar events in Google Calendar or Office 365
 * from task due dates and scheduled times within Obsidian. Currently, TaskNotes
 * can link notes to existing calendar events, but cannot create new events
 * from task deadlines or scheduled time slots.
 *
 * Requested functionality:
 * 1. Create calendar events from task due dates/scheduled times
 * 2. Events should be linked to notes (bidirectional reference)
 * 3. Optional: Automated event creation based on tags or for all tasks with dates
 * 4. Support for both Google Calendar and Office 365/Outlook calendars
 *
 * Current state analysis:
 * - TaskCalendarSyncService (src/services/TaskCalendarSyncService.ts) already exists
 *   with 75% of the infrastructure implemented:
 *   - Task-to-event conversion (taskToCalendarEvent method)
 *   - Event title templates with {{title}}, {{status}}, {{priority}} placeholders
 *   - Event description builder with task metadata
 *   - Sync on create/update/complete/delete (configurable)
 *   - Debounced updates to prevent API spam
 *   - Concurrency limiting (max 5 parallel operations)
 *   - Event ID storage in task frontmatter (googleCalendarEventId)
 *
 * - GoogleCalendarService (src/services/GoogleCalendarService.ts) supports:
 *   - createEvent(), updateEvent(), deleteEvent()
 *   - OAuth authentication already working
 *
 * - Settings interface (src/types/settings.ts) defines GoogleCalendarExportSettings:
 *   - enabled, targetCalendarId, syncTrigger (scheduled/due/both)
 *   - Event formatting options (title template, color, reminders)
 *
 * What's missing:
 * 1. Settings UI tab to configure Google Calendar export
 * 2. Microsoft Calendar sync service (parallel to Google implementation)
 * 3. Tag-based sync filtering
 * 4. Reverse sync (calendar changes updating tasks)
 *
 * Inspiration: Notion's integration where a date column determines calendar appearance
 *
 * Related files:
 * - src/services/TaskCalendarSyncService.ts (main sync orchestration)
 * - src/services/GoogleCalendarService.ts (Google Calendar API)
 * - src/services/MicrosoftCalendarService.ts (Microsoft Graph API)
 * - src/services/CalendarProvider.ts (provider abstraction)
 * - src/types/settings.ts (GoogleCalendarExportSettings interface)
 */

import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";

// Mock Obsidian dependencies
jest.mock("obsidian", () => ({
	Notice: jest.fn(),
	requestUrl: jest.fn(),
	TFile: class MockTFile {},
}));

// Types for test mocks
interface MockTaskInfo {
	path: string;
	title: string;
	status?: string;
	priority?: string;
	due?: string;
	scheduled?: string;
	tags?: string[];
	contexts?: string[];
	projects?: string[];
	timeEstimate?: number;
	archived?: boolean;
	googleCalendarEventId?: string;
}

interface MockGoogleCalendarExportSettings {
	enabled: boolean;
	targetCalendarId: string;
	syncOnTaskCreate: boolean;
	syncOnTaskUpdate: boolean;
	syncOnTaskComplete: boolean;
	syncOnTaskDelete: boolean;
	eventTitleTemplate: string;
	includeDescription: boolean;
	eventColorId: string | null;
	syncTrigger: "scheduled" | "due" | "both";
	createAsAllDay: boolean;
	defaultEventDuration: number;
	includeObsidianLink: boolean;
	defaultReminderMinutes: number | null;
}

interface MockMicrosoftCalendarExportSettings {
	enabled: boolean;
	targetCalendarId: string;
	syncOnTaskCreate: boolean;
	syncOnTaskUpdate: boolean;
	syncOnTaskComplete: boolean;
	syncOnTaskDelete: boolean;
	eventTitleTemplate: string;
	includeDescription: boolean;
	syncTrigger: "scheduled" | "due" | "both";
	createAsAllDay: boolean;
	defaultEventDuration: number;
	includeObsidianLink: boolean;
}

describe("Issue #1199 - Add due dates/scheduled times to Google/Office calendars", () => {
	describe("Google Calendar Export - Task to Event Conversion", () => {
		it.skip("reproduces issue #1199 - should create Google Calendar event from task with due date", async () => {
			// Feature: Create calendar events from task due dates
			// Expected behavior: When a task has a due date, create a corresponding
			// calendar event in the target Google Calendar

			const task: MockTaskInfo = {
				path: "tasks/important-task.md",
				title: "Important Deadline",
				due: "2025-03-15",
				priority: "high",
				status: "todo",
			};

			const settings: MockGoogleCalendarExportSettings = {
				enabled: true,
				targetCalendarId: "primary",
				syncOnTaskCreate: true,
				syncOnTaskUpdate: true,
				syncOnTaskComplete: true,
				syncOnTaskDelete: true,
				eventTitleTemplate: "{{title}}",
				includeDescription: true,
				eventColorId: null,
				syncTrigger: "due",
				createAsAllDay: true,
				defaultEventDuration: 60,
				includeObsidianLink: true,
				defaultReminderMinutes: 30,
			};

			// Expected: Event should be created with:
			// - title: "Important Deadline"
			// - date: 2025-03-15 (all-day event)
			// - description: Contains priority, status, Obsidian link
			// - googleCalendarEventId saved to task frontmatter
			expect(task.due).toBe("2025-03-15");
			expect(settings.syncTrigger).toBe("due");
		});

		it.skip("reproduces issue #1199 - should create timed event from task with scheduled datetime", async () => {
			// Feature: Create timed events when task has time component
			const task: MockTaskInfo = {
				path: "tasks/meeting-prep.md",
				title: "Meeting Prep",
				scheduled: "2025-03-15T14:00:00",
				timeEstimate: 45, // 45 minutes
			};

			const settings: MockGoogleCalendarExportSettings = {
				enabled: true,
				targetCalendarId: "primary",
				syncOnTaskCreate: true,
				syncOnTaskUpdate: true,
				syncOnTaskComplete: true,
				syncOnTaskDelete: true,
				eventTitleTemplate: "{{title}}",
				includeDescription: true,
				eventColorId: null,
				syncTrigger: "scheduled",
				createAsAllDay: false,
				defaultEventDuration: 60,
				includeObsidianLink: true,
				defaultReminderMinutes: null,
			};

			// Expected: Timed event created with:
			// - start: 2025-03-15T14:00:00
			// - end: 2025-03-15T14:45:00 (using timeEstimate)
			expect(task.scheduled).toContain("T");
			expect(task.timeEstimate).toBe(45);
		});

		it.skip("reproduces issue #1199 - should apply event title template with placeholders", async () => {
			// Feature: Customize event titles using templates
			const task: MockTaskInfo = {
				path: "tasks/review-code.md",
				title: "Review PR #123",
				status: "in-progress",
				priority: "high",
				due: "2025-03-15",
			};

			const template = "[TaskNotes] {{priority}}: {{title}}";

			// Expected result: "[TaskNotes] High: Review PR #123"
			// Template should support: {{title}}, {{status}}, {{priority}}, {{due}}, {{scheduled}}
			expect(template).toContain("{{title}}");
			expect(template).toContain("{{priority}}");
		});

		it.skip("reproduces issue #1199 - should include task metadata in event description", async () => {
			// Feature: Rich event descriptions with task details
			const task: MockTaskInfo = {
				path: "tasks/project-task.md",
				title: "Complete Feature",
				status: "todo",
				priority: "medium",
				due: "2025-03-20",
				scheduled: "2025-03-15T09:00:00",
				tags: ["feature", "v2.0"],
				contexts: ["work", "desk"],
				projects: ["ProjectX"],
				timeEstimate: 120,
			};

			// Expected description format:
			// Priority: Medium
			// Status: Todo
			// Due: 2025-03-20
			// Scheduled: 2025-03-15T09:00:00
			// Time Estimate: 2h 0m
			// Tags: #feature, #v2.0
			// Contexts: @work, @desk
			// Projects: ProjectX
			// ---
			// <a href="obsidian://open?vault=...">Open in Obsidian</a>

			expect(task.tags).toContain("feature");
			expect(task.contexts).toContain("work");
		});
	});

	describe("Google Calendar Export - Sync Triggers", () => {
		it.skip("reproduces issue #1199 - should sync when syncTrigger is 'due' and task has due date", async () => {
			const task: MockTaskInfo = {
				path: "tasks/deadline.md",
				title: "Project Deadline",
				due: "2025-03-30",
			};

			const settings: Partial<MockGoogleCalendarExportSettings> = {
				enabled: true,
				syncTrigger: "due",
			};

			// Should sync: task has due date and syncTrigger is "due"
			const shouldSync = settings.enabled && task.due && settings.syncTrigger === "due";
			expect(shouldSync).toBe(true);
		});

		it.skip("reproduces issue #1199 - should sync when syncTrigger is 'scheduled' and task has scheduled date", async () => {
			const task: MockTaskInfo = {
				path: "tasks/scheduled-work.md",
				title: "Scheduled Work Block",
				scheduled: "2025-03-15T10:00:00",
			};

			const settings: Partial<MockGoogleCalendarExportSettings> = {
				enabled: true,
				syncTrigger: "scheduled",
			};

			// Should sync: task has scheduled date and syncTrigger is "scheduled"
			const shouldSync = settings.enabled && task.scheduled && settings.syncTrigger === "scheduled";
			expect(shouldSync).toBe(true);
		});

		it.skip("reproduces issue #1199 - should sync when syncTrigger is 'both' and task has either date", async () => {
			const taskWithDue: MockTaskInfo = {
				path: "tasks/due-only.md",
				title: "Due Date Only",
				due: "2025-03-30",
			};

			const taskWithScheduled: MockTaskInfo = {
				path: "tasks/scheduled-only.md",
				title: "Scheduled Only",
				scheduled: "2025-03-15T10:00:00",
			};

			const taskWithBoth: MockTaskInfo = {
				path: "tasks/both-dates.md",
				title: "Both Dates",
				due: "2025-03-30",
				scheduled: "2025-03-15T10:00:00",
			};

			const settings: Partial<MockGoogleCalendarExportSettings> = {
				enabled: true,
				syncTrigger: "both",
			};

			// All three should sync when trigger is "both"
			const shouldSyncDue = settings.syncTrigger === "both" && (taskWithDue.due || taskWithDue.scheduled);
			const shouldSyncScheduled = settings.syncTrigger === "both" && (taskWithScheduled.due || taskWithScheduled.scheduled);
			const shouldSyncBoth = settings.syncTrigger === "both" && (taskWithBoth.due || taskWithBoth.scheduled);

			expect(shouldSyncDue).toBe(true);
			expect(shouldSyncScheduled).toBe(true);
			expect(shouldSyncBoth).toBe(true);
		});

		it.skip("reproduces issue #1199 - should NOT sync archived tasks", async () => {
			const archivedTask: MockTaskInfo = {
				path: "archive/old-task.md",
				title: "Archived Task",
				due: "2025-03-15",
				archived: true,
			};

			// Archived tasks should be excluded from calendar sync
			expect(archivedTask.archived).toBe(true);
		});
	});

	describe("Google Calendar Export - Event Lifecycle", () => {
		it.skip("reproduces issue #1199 - should update calendar event when task is modified", async () => {
			// Feature: Keep calendar events in sync with task changes
			const originalTask: MockTaskInfo = {
				path: "tasks/evolving-task.md",
				title: "Original Title",
				due: "2025-03-15",
				googleCalendarEventId: "abc123",
			};

			const updatedTask: MockTaskInfo = {
				...originalTask,
				title: "Updated Title",
				due: "2025-03-20", // Due date changed
			};

			// Expected: GoogleCalendarService.updateEvent() called with new details
			expect(updatedTask.title).not.toBe(originalTask.title);
			expect(updatedTask.due).not.toBe(originalTask.due);
		});

		it.skip("reproduces issue #1199 - should mark event complete when task is completed", async () => {
			// Feature: Update event title with completion indicator
			const completedTask: MockTaskInfo = {
				path: "tasks/done-task.md",
				title: "Completed Task",
				due: "2025-03-15",
				status: "done",
				googleCalendarEventId: "abc123",
			};

			// Expected: Event title becomes "✓ Completed Task"
			expect(completedTask.status).toBe("done");
		});

		it.skip("reproduces issue #1199 - should delete calendar event when task is deleted", async () => {
			// Feature: Remove calendar event when task is deleted
			const taskToDelete: MockTaskInfo = {
				path: "tasks/to-delete.md",
				title: "Task to Delete",
				due: "2025-03-15",
				googleCalendarEventId: "abc123",
			};

			// Expected: GoogleCalendarService.deleteEvent() called
			expect(taskToDelete.googleCalendarEventId).toBe("abc123");
		});

		it.skip("reproduces issue #1199 - should delete event when task no longer meets sync criteria", async () => {
			// Feature: Remove event if due date is removed from task
			const taskWithoutDue: MockTaskInfo = {
				path: "tasks/no-longer-dated.md",
				title: "Task Without Due",
				googleCalendarEventId: "abc123",
				// due date was removed
			};

			// Expected: Event should be deleted since task no longer has a due date
			expect(taskWithoutDue.due).toBeUndefined();
			expect(taskWithoutDue.googleCalendarEventId).toBeDefined();
		});
	});

	describe("Google Calendar Export - Event ID Management", () => {
		it.skip("reproduces issue #1199 - should store event ID in task frontmatter", async () => {
			// Feature: Link task to calendar event via frontmatter field
			const task: MockTaskInfo = {
				path: "tasks/linked-task.md",
				title: "Linked Task",
				due: "2025-03-15",
			};

			// After creation, task frontmatter should contain:
			// googleCalendarEventId: "event_abc123"
			const expectedFrontmatter = {
				title: "Linked Task",
				due: "2025-03-15",
				googleCalendarEventId: "event_abc123",
			};

			expect(expectedFrontmatter.googleCalendarEventId).toBeDefined();
		});

		it.skip("reproduces issue #1199 - should handle externally deleted events gracefully", async () => {
			// Feature: If event was deleted in Google Calendar, re-create on next sync
			const taskWithStaleLink: MockTaskInfo = {
				path: "tasks/stale-link.md",
				title: "Task with Stale Link",
				due: "2025-03-15",
				googleCalendarEventId: "deleted_event_123",
			};

			// Expected behavior when API returns 404:
			// 1. Clear googleCalendarEventId from frontmatter
			// 2. Create new event
			// 3. Save new event ID
			expect(taskWithStaleLink.googleCalendarEventId).toBeDefined();
		});
	});

	describe("Microsoft Calendar Export (Future Feature)", () => {
		it.skip("reproduces issue #1199 - should create Microsoft Calendar event from task", async () => {
			// Feature: Support Office 365/Outlook calendar export
			// Currently only Google Calendar is implemented in TaskCalendarSyncService
			// This documents the expected behavior for Microsoft Calendar integration

			const task: MockTaskInfo = {
				path: "tasks/work-deadline.md",
				title: "Work Deadline",
				due: "2025-03-15",
			};

			const settings: MockMicrosoftCalendarExportSettings = {
				enabled: true,
				targetCalendarId: "AAMkAGIxMjM0NTY3...",
				syncOnTaskCreate: true,
				syncOnTaskUpdate: true,
				syncOnTaskComplete: true,
				syncOnTaskDelete: true,
				eventTitleTemplate: "{{title}}",
				includeDescription: true,
				syncTrigger: "due",
				createAsAllDay: true,
				defaultEventDuration: 60,
				includeObsidianLink: true,
			};

			// Expected: Similar functionality to Google Calendar export
			// using MicrosoftCalendarService.createEvent()
			expect(settings.enabled).toBe(true);
			expect(task.due).toBeDefined();
		});

		it.skip("reproduces issue #1199 - should store Microsoft event ID in task frontmatter", async () => {
			// Feature: Track Microsoft calendar events separately from Google
			const expectedFrontmatter = {
				title: "Work Task",
				due: "2025-03-15",
				googleCalendarEventId: "google_event_123", // Existing Google link
				microsoftCalendarEventId: "microsoft_event_456", // New Microsoft link
			};

			// Tasks could sync to both calendars simultaneously
			expect(expectedFrontmatter.googleCalendarEventId).toBeDefined();
			expect(expectedFrontmatter.microsoftCalendarEventId).toBeDefined();
		});
	});

	describe("Tag-Based Sync Filtering (Future Feature)", () => {
		it.skip("reproduces issue #1199 - should only sync tasks with specific tag", async () => {
			// Feature: Automated event creation based on specific tags
			// User requested: "create calendar events from deadlines and schedules with a specific tag"

			const taggedTask: MockTaskInfo = {
				path: "tasks/calendar-task.md",
				title: "Calendar Synced Task",
				due: "2025-03-15",
				tags: ["sync-calendar", "work"],
			};

			const untaggedTask: MockTaskInfo = {
				path: "tasks/private-task.md",
				title: "Private Task",
				due: "2025-03-15",
				tags: ["personal"],
			};

			interface TagFilterSettings {
				syncFilterEnabled: boolean;
				syncFilterTag: string;
			}

			const filterSettings: TagFilterSettings = {
				syncFilterEnabled: true,
				syncFilterTag: "sync-calendar",
			};

			// Only taggedTask should sync based on tag filter
			const shouldSyncTagged = taggedTask.tags?.includes(filterSettings.syncFilterTag);
			const shouldSyncUntagged = untaggedTask.tags?.includes(filterSettings.syncFilterTag);

			expect(shouldSyncTagged).toBe(true);
			expect(shouldSyncUntagged).toBe(false);
		});

		it.skip("reproduces issue #1199 - should support multiple sync filter tags", async () => {
			// Feature: Multiple tags can trigger calendar sync
			interface MultiTagFilterSettings {
				syncFilterTags: string[];
			}

			const filterSettings: MultiTagFilterSettings = {
				syncFilterTags: ["calendar", "sync", "deadline"],
			};

			const taskWithDeadlineTag: MockTaskInfo = {
				path: "tasks/deadline-task.md",
				title: "Deadline Task",
				due: "2025-03-15",
				tags: ["deadline", "work"],
			};

			// Should sync because it has "deadline" tag
			const shouldSync = taskWithDeadlineTag.tags?.some((tag) =>
				filterSettings.syncFilterTags.includes(tag)
			);
			expect(shouldSync).toBe(true);
		});
	});

	describe("Settings UI (Future Feature)", () => {
		it.skip("reproduces issue #1199 - should expose Google Calendar export settings in UI", async () => {
			// Feature: Settings tab to configure calendar export
			// Currently the GoogleCalendarExportSettings interface exists but
			// there is no settings UI tab to configure it

			const settingsTabExpectations = {
				hasEnableToggle: true,
				hasCalendarSelector: true, // Dropdown of user's calendars
				hasSyncTriggerSelector: true, // due/scheduled/both
				hasTitleTemplateInput: true,
				hasDescriptionToggle: true,
				hasColorPicker: true,
				hasReminderInput: true,
				hasSyncAllButton: true, // Sync all tasks now
				hasUnlinkAllButton: true, // Disconnect all task-event links
			};

			expect(settingsTabExpectations.hasEnableToggle).toBe(true);
			expect(settingsTabExpectations.hasCalendarSelector).toBe(true);
		});

		it.skip("reproduces issue #1199 - should allow selecting target calendar from available calendars", async () => {
			// Feature: Calendar selector populated from GoogleCalendarService.getAvailableCalendars()
			const availableCalendars = [
				{ id: "primary", summary: "Personal", primary: true },
				{ id: "work@group.calendar.google.com", summary: "Work" },
				{ id: "tasks@group.calendar.google.com", summary: "TaskNotes" },
			];

			// User should be able to select any available calendar as the sync target
			expect(availableCalendars.length).toBeGreaterThan(0);
			expect(availableCalendars.find((c) => c.primary)).toBeDefined();
		});
	});

	describe("Bulk Sync Operations", () => {
		it.skip("reproduces issue #1199 - should sync all tasks with concurrency limiting", async () => {
			// Feature: Sync all tasks to calendar with rate limiting
			// TaskCalendarSyncService implements SYNC_CONCURRENCY_LIMIT = 5

			const tasks: MockTaskInfo[] = Array.from({ length: 50 }, (_, i) => ({
				path: `tasks/task-${i}.md`,
				title: `Task ${i}`,
				due: "2025-03-15",
			}));

			const SYNC_CONCURRENCY_LIMIT = 5;

			// Expected: Tasks are synced in batches of 5 to avoid rate limits
			expect(tasks.length).toBe(50);
			expect(SYNC_CONCURRENCY_LIMIT).toBe(5);
		});

		it.skip("reproduces issue #1199 - should report sync progress and results", async () => {
			// Feature: Show progress during bulk sync
			interface SyncResults {
				synced: number;
				failed: number;
				skipped: number;
			}

			const expectedResults: SyncResults = {
				synced: 45,
				failed: 2,
				skipped: 3, // Tasks without dates
			};

			// Expected: Notice shown with sync results
			// "Sync complete: 45 synced, 2 failed, 3 skipped"
			expect(expectedResults.synced + expectedResults.failed + expectedResults.skipped).toBe(50);
		});
	});

	describe("Debounced Sync for Rapid Edits", () => {
		it.skip("reproduces issue #1199 - should debounce rapid task updates", async () => {
			// Feature: Prevent API spam during quick successive edits
			// TaskCalendarSyncService implements SYNC_DEBOUNCE_MS = 500

			const SYNC_DEBOUNCE_MS = 500;

			// When user types in task title, only sync after 500ms pause
			// This prevents creating many API calls while typing

			expect(SYNC_DEBOUNCE_MS).toBe(500);
		});

		it.skip("reproduces issue #1199 - should use latest task state after debounce", async () => {
			// Feature: Re-fetch task after debounce to get latest state
			const initialTitle = "Tas";
			const intermediateTitle = "Task Ti";
			const finalTitle = "Task Title Complete";

			// After debounce, sync should use "Task Title Complete"
			// not any intermediate state
			expect(finalTitle).toBe("Task Title Complete");
		});
	});

	describe("Reverse Sync - Calendar to Task (Future Feature)", () => {
		it.skip("reproduces issue #1199 - should update task when calendar event is modified", async () => {
			// Feature: Bidirectional sync - changes in calendar update tasks
			// This is a future enhancement, not currently implemented

			const originalTask: MockTaskInfo = {
				path: "tasks/synced-task.md",
				title: "Original Title",
				due: "2025-03-15",
				googleCalendarEventId: "event_123",
			};

			// User edits event in Google Calendar:
			// - Changes title to "Updated Title in Calendar"
			// - Moves date to 2025-03-20

			// Expected: Task should be updated to match
			// - title: "Updated Title in Calendar"
			// - due: "2025-03-20"

			expect(originalTask.googleCalendarEventId).toBeDefined();
		});

		it.skip("reproduces issue #1199 - should handle deletion of calendar event", async () => {
			// Feature: When event is deleted in calendar, update task
			// Options: Remove the link, mark task as cancelled, or notify user

			const taskWithDeletedEvent: MockTaskInfo = {
				path: "tasks/orphaned-task.md",
				title: "Task with Deleted Event",
				due: "2025-03-15",
				googleCalendarEventId: "deleted_event_123",
			};

			// Expected behavior options:
			// 1. Clear googleCalendarEventId (current behavior on 404)
			// 2. Notify user that linked event was deleted
			// 3. Option to re-create the event

			expect(taskWithDeletedEvent.googleCalendarEventId).toBeDefined();
		});
	});
});

describe("Issue #1199 - Integration Scenarios", () => {
	it.skip("reproduces issue #1199 - should show tasks with due dates in external calendar apps", async () => {
		// Main user story: "It would be so, so cool to have to dos appear outside of Obsidian"

		// Scenario:
		// 1. User creates task in TaskNotes with due date: 2025-03-15
		// 2. TaskCalendarSyncService creates Google Calendar event
		// 3. User opens Google Calendar on phone
		// 4. Event "Task Title" appears on March 15th

		const workflow = {
			step1: "Create task with due date in Obsidian",
			step2: "TaskCalendarSyncService detects new task",
			step3: "Creates event via GoogleCalendarService.createEvent()",
			step4: "Event appears in Google Calendar (mobile/web)",
			step5: "User can see task deadlines across devices",
		};

		expect(Object.keys(workflow).length).toBe(5);
	});

	it.skip("reproduces issue #1199 - should handle time slot scheduling like Notion Calendar", async () => {
		// User mentioned: "My inspiration is Notion's integration of Databases and Notion Calendar"

		// Scenario:
		// - Task has scheduled: "2025-03-15T14:00:00"
		// - Event created for that exact time slot
		// - Duration based on timeEstimate or defaultEventDuration

		const scheduledTask: MockTaskInfo = {
			path: "tasks/scheduled-block.md",
			title: "Deep Work Session",
			scheduled: "2025-03-15T14:00:00",
			timeEstimate: 120, // 2 hours
		};

		// Expected event:
		// - Start: 2025-03-15T14:00:00
		// - End: 2025-03-15T16:00:00 (start + timeEstimate)
		// - Shows as 2-hour block in calendar

		expect(scheduledTask.scheduled).toBeDefined();
		expect(scheduledTask.timeEstimate).toBe(120);
	});

	it.skip("reproduces issue #1199 - should maintain link between note and calendar event", async () => {
		// User requested: "These events would be linked to notes the same way that it works now"

		const linkedTask: MockTaskInfo = {
			path: "tasks/linked-to-calendar.md",
			title: "Important Meeting Prep",
			due: "2025-03-15",
			googleCalendarEventId: "event_abc123",
		};

		// Expected bidirectional linking:
		// 1. Task has googleCalendarEventId in frontmatter
		// 2. Event description contains obsidian:// URI to open task
		// 3. Clicking link in Google Calendar opens task in Obsidian

		expect(linkedTask.googleCalendarEventId).toBeDefined();
	});

	it.skip("reproduces issue #1199 - should support planning workflow with deadlines and time blocks", async () => {
		// Complete workflow for planning To Dos:

		const projectTasks: MockTaskInfo[] = [
			{
				path: "tasks/project/research.md",
				title: "Research Phase",
				scheduled: "2025-03-10T09:00:00",
				timeEstimate: 180,
			},
			{
				path: "tasks/project/design.md",
				title: "Design Phase",
				scheduled: "2025-03-12T10:00:00",
				timeEstimate: 240,
			},
			{
				path: "tasks/project/implement.md",
				title: "Implementation",
				scheduled: "2025-03-15T09:00:00",
				due: "2025-03-17",
				timeEstimate: 480,
			},
			{
				path: "tasks/project/review.md",
				title: "Final Review",
				due: "2025-03-18",
			},
		];

		// All tasks should appear in calendar showing the project timeline
		expect(projectTasks.length).toBe(4);
		expect(projectTasks.every((t) => t.due || t.scheduled)).toBe(true);
	});
});
