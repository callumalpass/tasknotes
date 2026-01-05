import { Notice, TFile } from "obsidian";
import { format } from "date-fns";
import TaskNotesPlugin from "../main";
import { GoogleCalendarService } from "./GoogleCalendarService";
import { TaskInfo } from "../types";

/**
 * Service for syncing TaskNotes tasks to Google Calendar.
 * Handles creating, updating, and deleting calendar events when tasks change.
 */
export class TaskCalendarSyncService {
	private plugin: TaskNotesPlugin;
	private googleCalendarService: GoogleCalendarService;

	constructor(plugin: TaskNotesPlugin, googleCalendarService: GoogleCalendarService) {
		this.plugin = plugin;
		this.googleCalendarService = googleCalendarService;
	}

	/**
	 * Check if the sync service is enabled and properly configured
	 */
	isEnabled(): boolean {
		const settings = this.plugin.settings.googleCalendarExport;
		const enabled = settings.enabled;
		const hasTargetCalendar = !!settings.targetCalendarId;
		// Check if Google Calendar is connected by verifying calendars are available
		// (populated during GoogleCalendarService.initialize() when OAuth is connected)
		const isConnected = this.googleCalendarService.getAvailableCalendars().length > 0;

		return enabled && hasTargetCalendar && isConnected;
	}

	/**
	 * Determine if a task should be synced based on settings and task properties
	 */
	shouldSyncTask(task: TaskInfo): boolean {
		if (!this.isEnabled()) return false;

		const settings = this.plugin.settings.googleCalendarExport;

		// Don't sync archived tasks
		if (task.archived) return false;

		// Check if task has the required date(s) based on sync trigger setting
		switch (settings.syncTrigger) {
			case "scheduled":
				return !!task.scheduled;
			case "due":
				return !!task.due;
			case "both":
				return !!task.scheduled || !!task.due;
			default:
				return false;
		}
	}

	/**
	 * Get the Google Calendar event ID from the task's frontmatter
	 */
	getTaskEventId(task: TaskInfo): string | undefined {
		return task.googleCalendarEventId;
	}

	/**
	 * Save the Google Calendar event ID to the task's frontmatter
	 */
	private async saveTaskEventId(taskPath: string, eventId: string): Promise<void> {
		const file = this.plugin.app.vault.getAbstractFileByPath(taskPath);
		if (!(file instanceof TFile)) {
			console.warn(`Cannot save event ID: file not found at ${taskPath}`);
			return;
		}

		const fieldName = this.plugin.fieldMapper.toUserField("googleCalendarEventId");
		await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			frontmatter[fieldName] = eventId;
		});
	}

	/**
	 * Remove the Google Calendar event ID from the task's frontmatter
	 */
	private async removeTaskEventId(taskPath: string): Promise<void> {
		const file = this.plugin.app.vault.getAbstractFileByPath(taskPath);
		if (!(file instanceof TFile)) {
			console.warn(`Cannot remove event ID: file not found at ${taskPath}`);
			return;
		}

		const fieldName = this.plugin.fieldMapper.toUserField("googleCalendarEventId");
		await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			delete frontmatter[fieldName];
		});
	}

	/**
	 * Apply the title template to generate the event title
	 */
	private applyTitleTemplate(task: TaskInfo): string {
		const template = this.plugin.settings.googleCalendarExport.eventTitleTemplate;

		// Get human-readable labels for status and priority
		const statusConfig = task.status
			? this.plugin.statusManager.getStatusConfig(task.status)
			: null;
		const priorityConfig = task.priority
			? this.plugin.priorityManager.getPriorityConfig(task.priority)
			: null;

		const untitledTask = this.plugin.i18n.translate("settings.integrations.googleCalendarExport.eventDescription.untitledTask");
		return template
			.replace(/\{\{title\}\}/g, task.title || untitledTask)
			.replace(/\{\{status\}\}/g, statusConfig?.label || task.status || "")
			.replace(/\{\{priority\}\}/g, priorityConfig?.label || task.priority || "")
			.replace(/\{\{due\}\}/g, task.due || "")
			.replace(/\{\{scheduled\}\}/g, task.scheduled || "")
			.trim();
	}

	/**
	 * Build the event description from task properties
	 */
	private buildEventDescription(task: TaskInfo): string {
		const settings = this.plugin.settings.googleCalendarExport;
		const t = (key: string, params?: Record<string, string | number>) =>
			this.plugin.i18n.translate(`settings.integrations.googleCalendarExport.eventDescription.${key}` as any, params);
		const parts: string[] = [];

		// Add task metadata
		if (task.priority && task.priority !== "none") {
			const priorityConfig = this.plugin.priorityManager.getPriorityConfig(task.priority);
			parts.push(t("priority", { value: priorityConfig?.label || task.priority }));
		}

		if (task.status) {
			const statusConfig = this.plugin.statusManager.getStatusConfig(task.status);
			parts.push(t("status", { value: statusConfig?.label || task.status }));
		}

		// Add dates
		if (task.due) {
			parts.push(t("due", { value: task.due }));
		}
		if (task.scheduled) {
			parts.push(t("scheduled", { value: task.scheduled }));
		}

		// Add time estimate
		if (task.timeEstimate) {
			const hours = Math.floor(task.timeEstimate / 60);
			const minutes = task.timeEstimate % 60;
			const estimateStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
			parts.push(t("timeEstimate", { value: estimateStr }));
		}

		// Add tags
		if (task.tags && task.tags.length > 0) {
			parts.push(t("tags", { value: task.tags.map((tag) => `#${tag}`).join(", ") }));
		}

		// Add contexts
		if (task.contexts && task.contexts.length > 0) {
			parts.push(t("contexts", { value: task.contexts.map((c) => `@${c}`).join(", ") }));
		}

		// Add projects
		if (task.projects && task.projects.length > 0) {
			parts.push(t("projects", { value: task.projects.join(", ") }));
		}

		// Add separator before link
		if (parts.length > 0 && settings.includeObsidianLink) {
			parts.push("");
			parts.push("---");
		}

		// Add Obsidian link (as HTML anchor for clickability in Google Calendar)
		if (settings.includeObsidianLink) {
			const vaultName = this.plugin.app.vault.getName();
			const encodedPath = encodeURIComponent(task.path);
			const obsidianUri = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodedPath}`;
			// Google Calendar renders HTML in descriptions, so use an anchor tag
			const linkText = t("openInObsidian");
			parts.push(`<a href="${obsidianUri}">${linkText}</a>`);
		}

		return parts.join("\n");
	}

	/**
	 * Get the date to use for the calendar event based on settings
	 */
	private getEventDate(task: TaskInfo): string | undefined {
		const settings = this.plugin.settings.googleCalendarExport;

		switch (settings.syncTrigger) {
			case "scheduled":
				return task.scheduled;
			case "due":
				return task.due;
			case "both":
				// Prefer scheduled, fall back to due
				return task.scheduled || task.due;
			default:
				return undefined;
		}
	}

	/**
	 * Parse a task date string and determine if it's all-day or timed
	 */
	private parseDateForEvent(dateStr: string): {
		date?: string;
		dateTime?: string;
		timeZone?: string;
		isAllDay: boolean;
	} {
		// Check if the date includes a time component (has 'T')
		if (dateStr.includes("T")) {
			// Timed event - parse and format for Google Calendar
			const date = new Date(dateStr);
			return {
				dateTime: date.toISOString(),
				timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
				isAllDay: false,
			};
		} else {
			// All-day event - just use the date string
			return {
				date: dateStr,
				isAllDay: true,
			};
		}
	}

	/**
	 * Calculate the end date/time for an event
	 */
	private getEventEnd(
		startInfo: { date?: string; dateTime?: string; timeZone?: string; isAllDay: boolean },
		task: TaskInfo
	): { date?: string; dateTime?: string; timeZone?: string } {
		const settings = this.plugin.settings.googleCalendarExport;

		if (startInfo.isAllDay || settings.createAsAllDay) {
			// All-day events: end is the same date (or next day for multi-day)
			// Google Calendar requires end date to be the day AFTER for all-day events
			if (startInfo.date) {
				const startDate = new Date(startInfo.date + "T00:00:00");
				const endDate = new Date(startDate);
				endDate.setDate(endDate.getDate() + 1);
				return { date: format(endDate, "yyyy-MM-dd") };
			}
			// Fallback for dateTime that should be all-day
			const startDate = new Date(startInfo.dateTime!);
			const endDate = new Date(startDate);
			endDate.setDate(endDate.getDate() + 1);
			return { date: format(endDate, "yyyy-MM-dd") };
		} else {
			// Timed events: use duration
			const duration = task.timeEstimate || settings.defaultEventDuration;
			const startDate = new Date(startInfo.dateTime!);
			const endDate = new Date(startDate.getTime() + duration * 60 * 1000);
			return {
				dateTime: endDate.toISOString(),
				timeZone: startInfo.timeZone,
			};
		}
	}

	/**
	 * Convert a task to a Google Calendar event payload
	 */
	private taskToCalendarEvent(task: TaskInfo): {
		summary: string;
		description?: string;
		start: { date?: string; dateTime?: string; timeZone?: string };
		end: { date?: string; dateTime?: string; timeZone?: string };
		colorId?: string;
		reminders?: {
			useDefault: boolean;
			overrides?: Array<{ method: string; minutes: number }>;
		};
	} | null {
		const eventDate = this.getEventDate(task);
		if (!eventDate) return null;

		const settings = this.plugin.settings.googleCalendarExport;
		const startInfo = this.parseDateForEvent(eventDate);

		// If user prefers all-day events, convert timed to all-day
		let start: { date?: string; dateTime?: string; timeZone?: string };
		if (settings.createAsAllDay && !startInfo.isAllDay) {
			// Convert to all-day
			const dateOnly = eventDate.split("T")[0];
			start = { date: dateOnly };
		} else if (startInfo.isAllDay) {
			start = { date: startInfo.date };
		} else {
			start = { dateTime: startInfo.dateTime, timeZone: startInfo.timeZone };
		}

		// Calculate end based on start and duration
		const adjustedStartInfo = {
			...startInfo,
			isAllDay: settings.createAsAllDay || startInfo.isAllDay,
			date: start.date,
			dateTime: start.dateTime,
		};
		const end = this.getEventEnd(adjustedStartInfo, task);

		const event: {
			summary: string;
			description?: string;
			start: { date?: string; dateTime?: string; timeZone?: string };
			end: { date?: string; dateTime?: string; timeZone?: string };
			colorId?: string;
			reminders?: {
				useDefault: boolean;
				overrides?: Array<{ method: string; minutes: number }>;
			};
		} = {
			summary: this.applyTitleTemplate(task),
			start,
			end,
		};

		if (settings.includeDescription) {
			event.description = this.buildEventDescription(task);
		}

		if (settings.eventColorId) {
			event.colorId = settings.eventColorId;
		}

		// Add reminder if configured
		if (settings.defaultReminderMinutes !== null && settings.defaultReminderMinutes > 0) {
			event.reminders = {
				useDefault: false,
				overrides: [{ method: "popup", minutes: settings.defaultReminderMinutes }],
			};
		}

		return event;
	}

	/**
	 * Sync a task to Google Calendar (create or update)
	 */
	async syncTaskToCalendar(task: TaskInfo): Promise<void> {
		if (!this.shouldSyncTask(task)) {
			return;
		}

		const settings = this.plugin.settings.googleCalendarExport;
		const existingEventId = this.getTaskEventId(task);

		try {
			const eventData = this.taskToCalendarEvent(task);
			if (!eventData) {
				console.warn("[TaskCalendarSync] Could not convert task to event:", task.path);
				return;
			}

			if (existingEventId) {
				// Update existing event
				await this.googleCalendarService.updateEvent(
					settings.targetCalendarId,
					existingEventId,
					eventData
				);
			} else {
				// Create new event
				const createdEvent = await this.googleCalendarService.createEvent(
					settings.targetCalendarId,
					{
						...eventData,
						start: eventData.start.date || eventData.start.dateTime!,
						end: eventData.end.date || eventData.end.dateTime!,
						isAllDay: !!eventData.start.date,
					}
				);

				// Extract the actual event ID from the ICSEvent ID format
				// Format is "google-{calendarId}-{eventId}"
				const eventIdMatch = createdEvent.id.match(/^google-[^-]+-(.+)$/);
				const eventId = eventIdMatch ? eventIdMatch[1] : createdEvent.id;

				// Save the event ID to the task's frontmatter
				await this.saveTaskEventId(task.path, eventId);
			}
		} catch (error: any) {
			// Check if it's a 404 error (event was deleted externally)
			if (error.status === 404 && existingEventId) {
				// Clear the stale link and retry as create
				await this.removeTaskEventId(task.path);
				// Retry without the link - refetch task to get updated version
				const updatedTask = await this.plugin.cacheManager.getTaskInfo(task.path);
				if (updatedTask) {
					return this.syncTaskToCalendar(updatedTask);
				}
			}

			console.error("[TaskCalendarSync] Failed to sync task:", task.path, error);
			new Notice(this.plugin.i18n.translate("settings.integrations.googleCalendarExport.notices.syncFailed", { message: error.message }));
		}
	}

	/**
	 * Update a task in Google Calendar when it changes
	 */
	async updateTaskInCalendar(task: TaskInfo, previous?: TaskInfo): Promise<void> {
		if (!this.plugin.settings.googleCalendarExport.syncOnTaskUpdate) {
			return;
		}

		const existingEventId = this.getTaskEventId(task);

		// If task no longer meets sync criteria, delete the event
		if (!this.shouldSyncTask(task)) {
			if (existingEventId) {
				await this.deleteTaskFromCalendar(task);
			}
			return;
		}

		// Sync the updated task
		await this.syncTaskToCalendar(task);
	}

	/**
	 * Handle task completion - update the calendar event
	 */
	async completeTaskInCalendar(task: TaskInfo): Promise<void> {
		if (!this.plugin.settings.googleCalendarExport.syncOnTaskComplete) {
			return;
		}

		const settings = this.plugin.settings.googleCalendarExport;
		const existingEventId = this.getTaskEventId(task);
		if (!existingEventId) {
			return;
		}

		try {
			// Update the event title to indicate completion
			const completedTitle = `✓ ${this.applyTitleTemplate(task)}`;
			const description = settings.includeDescription
				? this.buildEventDescription(task)
				: undefined;

			await this.googleCalendarService.updateEvent(
				settings.targetCalendarId,
				existingEventId,
				{
					summary: completedTitle,
					description,
				}
			);
		} catch (error: any) {
			if (error.status === 404) {
				// Event was deleted externally, clean up the link
				await this.removeTaskEventId(task.path);
				return;
			}
			console.error("[TaskCalendarSync] Failed to update completed task:", task.path, error);
		}
	}

	/**
	 * Delete a task's calendar event
	 */
	async deleteTaskFromCalendar(task: TaskInfo): Promise<void> {
		if (!this.plugin.settings.googleCalendarExport.syncOnTaskDelete) {
			return;
		}

		const settings = this.plugin.settings.googleCalendarExport;
		const existingEventId = this.getTaskEventId(task);
		if (!existingEventId) {
			return;
		}

		try {
			await this.googleCalendarService.deleteEvent(
				settings.targetCalendarId,
				existingEventId
			);
		} catch (error: any) {
			// 404 or 410 means event is already gone - that's fine
			if (error.status !== 404 && error.status !== 410) {
				console.error("[TaskCalendarSync] Failed to delete event:", task.path, error);
			}
		}

		// Always remove the event ID from frontmatter
		await this.removeTaskEventId(task.path);
	}

	/**
	 * Delete a task's calendar event by path (used when task is being deleted)
	 */
	async deleteTaskFromCalendarByPath(taskPath: string, eventId: string): Promise<void> {
		if (!this.plugin.settings.googleCalendarExport.syncOnTaskDelete) {
			return;
		}

		const settings = this.plugin.settings.googleCalendarExport;

		try {
			await this.googleCalendarService.deleteEvent(settings.targetCalendarId, eventId);
		} catch (error: any) {
			// 404 or 410 means event is already gone - that's fine
			if (error.status !== 404 && error.status !== 410) {
				console.error("[TaskCalendarSync] Failed to delete event:", taskPath, error);
			}
		}
		// No need to remove from frontmatter since the task file is being deleted
	}

	// handleTaskPathChange is no longer needed - event ID is stored in frontmatter
	// and moves with the file automatically when renamed/moved

	/**
	 * Sync all tasks to Google Calendar (initial sync or resync)
	 */
	async syncAllTasks(): Promise<{ synced: number; failed: number; skipped: number }> {
		const results = { synced: 0, failed: 0, skipped: 0 };

		if (!this.isEnabled()) {
			new Notice(this.plugin.i18n.translate("settings.integrations.googleCalendarExport.notices.notEnabledOrConfigured"));
			return results;
		}

		const tasks = await this.plugin.cacheManager.getAllTasks();
		const total = tasks.length;

		new Notice(this.plugin.i18n.translate("settings.integrations.googleCalendarExport.notices.syncingTasks", { total }));

		for (const task of tasks) {
			if (!this.shouldSyncTask(task)) {
				results.skipped++;
				continue;
			}

			try {
				await this.syncTaskToCalendar(task);
				results.synced++;
			} catch (error) {
				results.failed++;
				console.error(`[TaskCalendarSync] Failed to sync task ${task.path}:`, error);
			}
		}

		new Notice(
			this.plugin.i18n.translate("settings.integrations.googleCalendarExport.notices.syncComplete", {
				synced: results.synced,
				failed: results.failed,
				skipped: results.skipped,
			})
		);

		return results;
	}

	/**
	 * Remove all task-event links and optionally delete events.
	 * Iterates over all tasks and removes the googleCalendarEventId from frontmatter.
	 */
	async unlinkAllTasks(deleteEvents: boolean = false): Promise<void> {
		const settings = this.plugin.settings.googleCalendarExport;
		const tasks = await this.plugin.cacheManager.getAllTasks();
		let unlinkedCount = 0;

		for (const task of tasks) {
			if (!task.googleCalendarEventId) {
				continue;
			}

			if (deleteEvents) {
				try {
					await this.googleCalendarService.deleteEvent(
						settings.targetCalendarId,
						task.googleCalendarEventId
					);
				} catch (error) {
					console.warn(`[TaskCalendarSync] Failed to delete event for ${task.path}:`, error);
				}
			}

			// Remove the event ID from task frontmatter
			await this.removeTaskEventId(task.path);
			unlinkedCount++;
		}

		new Notice(
			deleteEvents
				? this.plugin.i18n.translate("settings.integrations.googleCalendarExport.notices.eventsDeletedAndUnlinked", { count: unlinkedCount })
				: this.plugin.i18n.translate("settings.integrations.googleCalendarExport.notices.tasksUnlinked", { count: unlinkedCount })
		);
	}
}
