import { Notice, TFile } from "obsidian";
import { format } from "date-fns";
import TaskNotesPlugin from "../main";
import { GoogleCalendarService } from "./GoogleCalendarService";
import { TaskInfo } from "../types";
import { convertToGoogleRecurrence } from "../utils/rruleConverter";
import { getDatePart } from "../utils/dateUtils";
import { TokenRefreshError } from "./errors";

/** Debounce delay for rapid task updates (ms) */
const SYNC_DEBOUNCE_MS = 500;

/** Max concurrent API calls during bulk sync to avoid rate limits */
const SYNC_CONCURRENCY_LIMIT = 5;

/** Minimum spacing between Google Calendar API calls (ms) to reduce 403 rate limits.
 *  Google Calendar enforces ~10 req/s per-user; 100ms keeps us comfortably under that. */
const GOOGLE_API_CALL_SPACING_MS = 100;

/**
 * Service for syncing TaskNotes tasks to Google Calendar.
 * Handles creating, updating, and deleting calendar events when tasks change.
 */
export class TaskCalendarSyncService {
	private plugin: TaskNotesPlugin;
	private googleCalendarService: GoogleCalendarService;
	private rateLimitChain: Promise<unknown> = Promise.resolve();
	private lastApiCallAt = 0;

	/** Debounce timers for pending syncs, keyed by task path */
	private pendingSyncs: Map<string, ReturnType<typeof setTimeout>> = new Map();

	/** In-flight sync operations to prevent concurrent syncs for the same task */
	private inFlightSyncs: Map<string, Promise<void>> = new Map();

	/** Track previous task state for detecting recurrence removal */
	private previousTaskState: Map<string, TaskInfo> = new Map();

	/** Store the latest explicitly passed task object during debounce to avoid cache race conditions */
	private pendingTasks: Map<string, TaskInfo> = new Map();

	constructor(plugin: TaskNotesPlugin, googleCalendarService: GoogleCalendarService) {
		this.plugin = plugin;
		this.googleCalendarService = googleCalendarService;
	}

	/**
	 * Clean up pending timers (call on plugin unload)
	 */
	destroy(): void {
		for (const timer of this.pendingSyncs.values()) {
			clearTimeout(timer);
		}
		this.pendingSyncs.clear();
		this.previousTaskState.clear();
		this.pendingTasks.clear();
	}

	/**
	 * Process items in parallel with a concurrency limit.
	 * Executes up to SYNC_CONCURRENCY_LIMIT operations simultaneously.
	 */
	private async processInParallel<T>(
		items: T[],
		processor: (item: T) => Promise<void>
	): Promise<void> {
		const executing: Promise<void>[] = [];

		for (const item of items) {
			const promise = processor(item).then(() => {
				executing.splice(executing.indexOf(promise), 1);
			});
			executing.push(promise);

			if (executing.length >= SYNC_CONCURRENCY_LIMIT) {
				await Promise.race(executing);
			}
		}

		await Promise.all(executing);
	}

	/**
	 * Ensure Google API calls are spaced out to avoid 403 rate limits.
	 * Calls are queued and executed with at least GOOGLE_API_CALL_SPACING_MS between them.
	 */
	private withGoogleRateLimit<T>(fn: () => Promise<T>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			this.rateLimitChain = this.rateLimitChain.then(async () => {
				const now = Date.now();
				const wait = Math.max(0, GOOGLE_API_CALL_SPACING_MS - (now - this.lastApiCallAt));
				if (wait > 0) {
					await new Promise((r) => setTimeout(r, wait));
				}
				try {
					const result = await fn();
					this.lastApiCallAt = Date.now();
					resolve(result);
				} catch (e) {
					this.lastApiCallAt = Date.now();
					reject(e);
				}
			}, () => {
				// Previous call in chain failed; continue the chain
				fn().then(resolve, reject);
			});
		});
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
	 * Get the detached recurring exception event ID from the task's frontmatter.
	 */
	getTaskExceptionEventId(task: TaskInfo): string | undefined {
		return task.googleCalendarExceptionEventId;
	}

	/**
	 * Determines if a task should be synced as a Google Calendar recurring event.
	 * Only scheduled-based recurring tasks are synced as recurring events.
	 * Completion-based recurring tasks remain as single events (since their
	 * DTSTART shifts on each completion, which doesn't map well to Google Calendar).
	 */
	private shouldSyncAsRecurring(task: TaskInfo): boolean {
		// Must have a recurrence rule
		if (!task.recurrence) return false;

		// Only scheduled-based recurrence syncs as recurring events
		// Completion-based recurrence stays as single events (existing behavior)
		const anchor = task.recurrence_anchor || "scheduled";
		return anchor === "scheduled";
	}

	/**
	 * True when the task still has any Google recurring exception metadata.
	 */
	private hasStoredRecurringExceptionMetadata(task: TaskInfo): boolean {
		return Boolean(
			task.googleCalendarExceptionEventId ||
				task.googleCalendarExceptionOriginalScheduled ||
				(task.googleCalendarMovedOriginalDates &&
					task.googleCalendarMovedOriginalDates.length > 0)
		);
	}

	/**
	 * Additional recurrence exclusions beyond completed/skipped instances.
	 */
	private getAdditionalRecurringExdates(task: TaskInfo): string[] {
		const excluded = new Set<string>();

		if (Array.isArray(task.googleCalendarMovedOriginalDates)) {
			for (const date of task.googleCalendarMovedOriginalDates) {
				const normalized = getDatePart(date);
				if (normalized) {
					excluded.add(normalized);
				}
			}
		}

		const pendingOriginal = getDatePart(task.googleCalendarExceptionOriginalScheduled || "");
		if (pendingOriginal) {
			excluded.add(pendingOriginal);
		}

		return Array.from(excluded).sort();
	}

	/**
	 * Save the Google Calendar event ID to the task's frontmatter
	 */
	private async saveTaskEventId(taskPath: string, eventId: string): Promise<void> {
		await this.saveTaskGoogleCalendarMetadata(taskPath, {
			googleCalendarEventId: eventId,
		});
	}

	/**
	 * Save Google Calendar metadata fields to frontmatter.
	 */
	private async saveTaskGoogleCalendarMetadata(
		taskPath: string,
		updates: Partial<
			Pick<
				TaskInfo,
				| "googleCalendarEventId"
				| "googleCalendarExceptionEventId"
				| "googleCalendarExceptionOriginalScheduled"
				| "googleCalendarMovedOriginalDates"
			>
		>
	): Promise<void> {
		const file = this.plugin.app.vault.getAbstractFileByPath(taskPath);
		if (!(file instanceof TFile)) {
			console.warn(`Cannot save Google Calendar metadata: file not found at ${taskPath}`);
			return;
		}

		const eventIdField =
			this.plugin.fieldMapper.toUserField("googleCalendarEventId") ||
			"googleCalendarEventId";
		const exceptionEventIdField =
			this.plugin.fieldMapper.toUserField("googleCalendarExceptionEventId") ||
			"googleCalendarExceptionEventId";
		const exceptionOriginalField =
			this.plugin.fieldMapper.toUserField("googleCalendarExceptionOriginalScheduled") ||
			"googleCalendarExceptionOriginalScheduled";
		const movedDatesField =
			this.plugin.fieldMapper.toUserField("googleCalendarMovedOriginalDates") ||
			"googleCalendarMovedOriginalDates";

		await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			if ("googleCalendarEventId" in updates) {
				if (updates.googleCalendarEventId) {
					frontmatter[eventIdField] = updates.googleCalendarEventId;
				} else {
					delete frontmatter[eventIdField];
				}
			}

			if ("googleCalendarExceptionEventId" in updates) {
				if (updates.googleCalendarExceptionEventId) {
					frontmatter[exceptionEventIdField] =
						updates.googleCalendarExceptionEventId;
				} else {
					delete frontmatter[exceptionEventIdField];
				}
			}

			if ("googleCalendarExceptionOriginalScheduled" in updates) {
				if (updates.googleCalendarExceptionOriginalScheduled) {
					frontmatter[exceptionOriginalField] =
						updates.googleCalendarExceptionOriginalScheduled;
				} else {
					delete frontmatter[exceptionOriginalField];
				}
			}

			if ("googleCalendarMovedOriginalDates" in updates) {
				if (
					updates.googleCalendarMovedOriginalDates &&
					updates.googleCalendarMovedOriginalDates.length > 0
				) {
					frontmatter[movedDatesField] = updates.googleCalendarMovedOriginalDates;
				} else {
					delete frontmatter[movedDatesField];
				}
			}
		});
	}

	/**
	 * Remove all Google Calendar metadata from frontmatter.
	 */
	private async clearTaskGoogleCalendarMetadata(taskPath: string): Promise<void> {
		await this.saveTaskGoogleCalendarMetadata(taskPath, {
			googleCalendarEventId: undefined,
			googleCalendarExceptionEventId: undefined,
			googleCalendarExceptionOriginalScheduled: undefined,
			googleCalendarMovedOriginalDates: undefined,
		});
	}

	/**
	 * Remove the Google Calendar event ID from the task's frontmatter
	 */
	private async removeTaskEventId(taskPath: string): Promise<void> {
		await this.saveTaskGoogleCalendarMetadata(taskPath, {
			googleCalendarEventId: undefined,
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
			// Timed event - format with local timezone offset for Google Calendar.
			// Using date-fns format with 'xxx' to produce an offset-aware RFC 3339 string
			// (e.g. "2024-03-15T14:30:00+05:00") so the dateTime matches the timeZone.
			const date = new Date(dateStr);
			return {
				dateTime: format(date, "yyyy-MM-dd'T'HH:mm:ssxxx"),
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
				dateTime: format(endDate, "yyyy-MM-dd'T'HH:mm:ssxxx"),
				timeZone: startInfo.timeZone,
			};
		}
	}

	/**
	 * Parse ISO 8601 duration format and return milliseconds.
	 * Based on the parser from NotificationService.
	 */
	private parseISO8601Duration(duration: string): number | null {
		// Parse ISO 8601 duration format (e.g., "-PT15M", "P2D", "-PT1H30M")
		const match = duration.match(
			/^(-?)P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/
		);

		if (!match) {
			return null;
		}

		const [, sign, years, months, weeks, days, hours, minutes, seconds] = match;

		let totalMs = 0;

		// Note: For simplicity, we treat months as 30 days and years as 365 days
		if (years) totalMs += parseInt(years) * 365 * 24 * 60 * 60 * 1000;
		if (months) totalMs += parseInt(months) * 30 * 24 * 60 * 60 * 1000;
		if (weeks) totalMs += parseInt(weeks) * 7 * 24 * 60 * 60 * 1000;
		if (days) totalMs += parseInt(days) * 24 * 60 * 60 * 1000;
		if (hours) totalMs += parseInt(hours) * 60 * 60 * 1000;
		if (minutes) totalMs += parseInt(minutes) * 60 * 1000;
		if (seconds) totalMs += parseInt(seconds) * 1000;

		// Apply sign for negative durations (before the anchor date)
		return sign === "-" ? -totalMs : totalMs;
	}

	/**
	 * Convert task reminders to Google Calendar reminder format.
	 * Returns an array of reminder overrides in the format Google Calendar API expects.
	 * 
	 * @param task - The task with reminders
	 * @param eventStartTime - The event start time (ISO string or date string)
	 * @param eventDateSource - Which date field was used for the event ('due' or 'scheduled')
	 * @returns Array of { method: string; minutes: number } or null if no valid reminders
	 */
	private convertTaskRemindersToGoogleFormat(
		task: TaskInfo,
		eventStartTime: string,
		eventDateSource: 'due' | 'scheduled'
	): Array<{ method: string; minutes: number }> | null {
		if (!task.reminders || !Array.isArray(task.reminders) || task.reminders.length === 0) {
			return null;
		}

		const googleReminders: Array<{ method: string; minutes: number }> = [];
		const GOOGLE_MAX_REMINDER_MINUTES = 40320; // 4 weeks in minutes (Google Calendar API limit)

		// Parse event start time to get a timestamp
		let eventStartMs: number;
		try {
			// Handle both ISO timestamps and date-only strings
			if (eventStartTime.includes('T')) {
				eventStartMs = new Date(eventStartTime).getTime();
			} else {
				// Date-only string - assume start of day in local timezone
				eventStartMs = new Date(eventStartTime + 'T00:00:00').getTime();
			}

			if (isNaN(eventStartMs)) {
				console.warn('[TaskCalendarSync] Invalid event start time:', eventStartTime);
				return null;
			}
		} catch (error) {
			console.warn('[TaskCalendarSync] Error parsing event start time:', error);
			return null;
		}

		for (const reminder of task.reminders) {
			if (!reminder.type) continue;

			if (reminder.type === 'relative') {
				// Only include relative reminders that match the event's date source
				if (reminder.relatedTo !== eventDateSource) {
					continue;
				}

				// Parse the ISO 8601 duration
				if (!reminder.offset) continue;
				const durationMs = this.parseISO8601Duration(reminder.offset);
				if (durationMs === null) {
					console.warn('[TaskCalendarSync] Invalid duration format:', reminder.offset);
					continue;
				}

				// Convert to minutes before the event
				// Negative duration means "before", which is what we want
				// Zero duration means "at event time"
				// Positive duration means "after", which Google Calendar doesn't support for reminders
				const minutesBefore = Math.abs(Math.round(durationMs / (60 * 1000)));

				// Skip if reminder is after the event (positive duration without negative sign)
				if (durationMs > 0) {
					console.warn('[TaskCalendarSync] Skipping reminder after event:', reminder);
					continue;
				}

				// Cap at Google Calendar's limit
				const cappedMinutes = Math.min(minutesBefore, GOOGLE_MAX_REMINDER_MINUTES);

				// Include 0-minute reminders (at event time)
				if (cappedMinutes >= 0) {
					googleReminders.push({ method: 'popup', minutes: cappedMinutes });
				}
			} else if (reminder.type === 'absolute') {
				// Calculate minutes before event start
				if (!reminder.absoluteTime) continue;

				try {
					const reminderTimeMs = new Date(reminder.absoluteTime).getTime();
					if (isNaN(reminderTimeMs)) {
						console.warn('[TaskCalendarSync] Invalid absolute time:', reminder.absoluteTime);
						continue;
					}

					// Calculate difference in minutes
					const diffMs = eventStartMs - reminderTimeMs;
					const minutesBefore = Math.round(diffMs / (60 * 1000));

					// Skip if reminder is after the event start
					if (minutesBefore < 0) {
						console.warn('[TaskCalendarSync] Skipping absolute reminder after event:', reminder);
						continue;
					}

					// Cap at Google Calendar's limit
					const cappedMinutes = Math.min(minutesBefore, GOOGLE_MAX_REMINDER_MINUTES);
					// Include 0-minute reminders (at event time)
					googleReminders.push({ method: 'popup', minutes: cappedMinutes });
				} catch (error) {
					console.warn('[TaskCalendarSync] Error parsing absolute reminder time:', error);
					continue;
				}
			}
		}

		return googleReminders.length > 0 ? googleReminders : null;
	}

	/**
	 * Convert a task to a Google Calendar event payload
	 */
	private taskToCalendarEvent(task: TaskInfo, clearRecurrence?: boolean): {
		summary: string;
		description?: string;
		start: { date?: string; dateTime?: string; timeZone?: string };
		end: { date?: string; dateTime?: string; timeZone?: string };
		colorId?: string;
		reminders?: {
			useDefault: boolean;
			overrides?: Array<{ method: string; minutes: number }>;
		};
		recurrence?: string[];
	} | null {
		const eventDate = this.getEventDate(task);
		if (!eventDate) return null;

		const settings = this.plugin.settings.googleCalendarExport;
		const startInfo = this.parseDateForEvent(eventDate);

		// If user prefers all-day events, convert timed to all-day
		let start: { date?: string; dateTime?: string; timeZone?: string };
		if (settings.createAsAllDay && !startInfo.isAllDay) {
			// Convert to all-day - use local date to handle timezone correctly
			// e.g., "2024-01-15T23:00:00" in UTC+5 should become "2024-01-16" not "2024-01-15"
			const localDate = new Date(eventDate);
			const dateOnly = format(localDate, "yyyy-MM-dd");
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
			recurrence?: string[];
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

		// Determine which date field was used for the event (for reminder conversion)
		let eventDateSource: 'due' | 'scheduled';
		if (settings.syncTrigger === 'scheduled' || (settings.syncTrigger === 'both' && task.scheduled)) {
			eventDateSource = 'scheduled';
		} else {
			eventDateSource = 'due';
		}

		// Add reminders - prioritize task reminders, fall back to default
		const taskReminders = this.convertTaskRemindersToGoogleFormat(
			task,
			eventDate,
			eventDateSource
		);

		if (taskReminders && taskReminders.length > 0) {
			// Use task-specific reminders
			event.reminders = {
				useDefault: false,
				overrides: taskReminders,
			};
		} else if (settings.defaultReminderMinutes !== null && settings.defaultReminderMinutes > 0) {
			// For all-day events, use Google Calendar's default all-day notifications
			// (configured by the user in their Google Calendar settings) rather than
			// overriding with minutes-based reminders which would fire at the wrong time
			// (e.g., 11:30 PM the night before instead of 9 AM day-of). See #1465.
			const isAllDay = settings.createAsAllDay || startInfo.isAllDay;
			if (isAllDay) {
				event.reminders = { useDefault: true };
			} else {
				event.reminders = {
					useDefault: false,
					overrides: [{ method: "popup", minutes: settings.defaultReminderMinutes }],
				};
			}
		}

		// Add recurrence rules for scheduled-based recurring tasks
		if (this.shouldSyncAsRecurring(task) && task.recurrence) {
			const recurrenceData = convertToGoogleRecurrence(task.recurrence, {
				completedInstances: task.complete_instances,
				skippedInstances: task.skipped_instances,
				additionalExcludedDates: this.getAdditionalRecurringExdates(task),
			});

			if (recurrenceData) {
				event.recurrence = recurrenceData.recurrence;

				// Override start date with DTSTART from recurrence rule
				// This ensures the recurring event starts from the correct date
				if (recurrenceData.dtstart) {
					if (settings.createAsAllDay || !recurrenceData.hasTime) {
						event.start = { date: recurrenceData.dtstart };
						// Recalculate end for all-day event
						const endDate = new Date(recurrenceData.dtstart + "T00:00:00");
						endDate.setDate(endDate.getDate() + 1);
						event.end = { date: format(endDate, "yyyy-MM-dd") };
					} else if (recurrenceData.time) {
						const dateTimeStr = `${recurrenceData.dtstart}T${recurrenceData.time}`;
						const startDate = new Date(dateTimeStr);
						event.start = {
							dateTime: format(startDate, "yyyy-MM-dd'T'HH:mm:ssxxx"),
							timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
						};
						// Recalculate end based on duration
						const duration = task.timeEstimate || settings.defaultEventDuration;
						const endDate = new Date(startDate.getTime() + duration * 60 * 1000);
						event.end = {
							dateTime: format(endDate, "yyyy-MM-dd'T'HH:mm:ssxxx"),
							timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
						};
					}
				}
			}
		} else if (clearRecurrence) {
			// Explicitly clear recurrence when it was removed from the task
			// Google Calendar API requires an empty array to remove recurrence
			event.recurrence = [];
		}

		return event;
	}

	/**
	 * Whether a recurring task currently needs a detached Google exception event.
	 */
	private shouldCreateDetachedRecurringException(task: TaskInfo): boolean {
		if (!this.shouldSyncAsRecurring(task)) {
			return false;
		}

		const movedScheduled = getDatePart(task.scheduled || "");
		const originalScheduled = getDatePart(task.googleCalendarExceptionOriginalScheduled || "");

		return Boolean(movedScheduled && originalScheduled && movedScheduled !== originalScheduled);
	}

	/**
	 * Build payload for detached recurring exception event.
	 * This always tracks the concrete moved scheduled occurrence, not the RRULE.
	 */
	private buildRecurringExceptionEvent(task: TaskInfo): {
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
		if (!task.scheduled) {
			return null;
		}

		const settings = this.plugin.settings.googleCalendarExport;
		const startInfo = this.parseDateForEvent(task.scheduled);

		let start: { date?: string; dateTime?: string; timeZone?: string };
		if (settings.createAsAllDay && !startInfo.isAllDay) {
			const localDate = new Date(task.scheduled);
			start = { date: format(localDate, "yyyy-MM-dd") };
		} else if (startInfo.isAllDay) {
			start = { date: startInfo.date };
		} else {
			start = { dateTime: startInfo.dateTime, timeZone: startInfo.timeZone };
		}

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

		const taskReminders = this.convertTaskRemindersToGoogleFormat(
			task,
			task.scheduled,
			"scheduled"
		);

		if (taskReminders && taskReminders.length > 0) {
			event.reminders = {
				useDefault: false,
				overrides: taskReminders,
			};
		}

		return event;
	}

	/**
	 * Create/update/delete the detached Google event for the current moved recurring occurrence.
	 */
	private async syncRecurringExceptionEvent(task: TaskInfo): Promise<void> {
		const settings = this.plugin.settings.googleCalendarExport;
		const hasActiveException = this.shouldCreateDetachedRecurringException(task);
		const existingExceptionEventId = this.getTaskExceptionEventId(task);

		if (!hasActiveException) {
			if (existingExceptionEventId) {
				try {
					await this.withGoogleRateLimit(() =>
						this.googleCalendarService.deleteEvent(
							settings.targetCalendarId,
							existingExceptionEventId
						)
					);
				} catch (error: any) {
					if (error.status !== 404 && error.status !== 410) {
						throw error;
					}
				}
			}

			await this.saveTaskGoogleCalendarMetadata(task.path, {
				googleCalendarExceptionEventId: undefined,
				googleCalendarExceptionOriginalScheduled: undefined,
			});
			return;
		}

		const eventData = this.buildRecurringExceptionEvent(task);
		if (!eventData) {
			return;
		}

		try {
			if (existingExceptionEventId) {
				await this.withGoogleRateLimit(() =>
					this.googleCalendarService.updateEvent(
						settings.targetCalendarId,
						existingExceptionEventId,
						eventData
					)
				);
				return;
			}

			const createdEvent = await this.withGoogleRateLimit(() =>
				this.googleCalendarService.createEvent(settings.targetCalendarId, {
					...eventData,
					isAllDay: !!eventData.start.date,
				})
			);

			const prefix = `google-${settings.targetCalendarId}-`;
			const eventId = createdEvent.id.startsWith(prefix)
				? createdEvent.id.slice(prefix.length)
				: createdEvent.id;

			await this.saveTaskGoogleCalendarMetadata(task.path, {
				googleCalendarExceptionEventId: eventId,
				googleCalendarExceptionOriginalScheduled: getDatePart(
					task.googleCalendarExceptionOriginalScheduled || ""
				),
			});
		} catch (error: any) {
			if (error.status === 404 && existingExceptionEventId) {
				await this.saveTaskGoogleCalendarMetadata(task.path, {
					googleCalendarExceptionEventId: undefined,
				});
				const updatedTask = await this.plugin.cacheManager.getTaskInfo(task.path);
				if (updatedTask) {
					return this.syncRecurringExceptionEvent(updatedTask);
				}
			}
			throw error;
		}
	}

	/**
	 * Sync a task to Google Calendar (create or update)
	 */
	async syncTaskToCalendar(task: TaskInfo, previous?: TaskInfo): Promise<void> {
		if (!this.shouldSyncTask(task)) {
			return;
		}

		const settings = this.plugin.settings.googleCalendarExport;
		const existingEventId = this.getTaskEventId(task);

		try {
			// Check if recurrence was removed (previous had recurrence, current doesn't)
			const clearRecurrence = !!(previous?.recurrence && !task.recurrence);
			
			const eventData = this.taskToCalendarEvent(task, clearRecurrence);
			if (!eventData) {
				console.warn("[TaskCalendarSync] Could not convert task to event:", task.path);
				return;
			}

			if (existingEventId) {
				// Update existing event
				await this.withGoogleRateLimit(() =>
					this.googleCalendarService.updateEvent(
						settings.targetCalendarId,
						existingEventId,
						eventData
					)
				);
			} else {
				// Create new event — pass structured start/end objects to preserve timeZone
				const createdEvent = await this.withGoogleRateLimit(() =>
					this.googleCalendarService.createEvent(
						settings.targetCalendarId,
						{
							...eventData,
							isAllDay: !!eventData.start.date,
						}
					)
				);

				// Extract the actual event ID from the ICSEvent ID format
				// Format is "google-{calendarId}-{eventId}"
				// Calendar IDs can contain hyphens, so strip the known prefix
				const prefix = `google-${settings.targetCalendarId}-`;
				const eventId = createdEvent.id.startsWith(prefix)
					? createdEvent.id.slice(prefix.length)
					: createdEvent.id;

				// Save the event ID to the task's frontmatter
				await this.saveTaskEventId(task.path, eventId);
			}

			// Keep the detached recurring exception event aligned with the current moved occurrence.
			if (this.shouldSyncAsRecurring(task) || task.googleCalendarExceptionEventId) {
				await this.syncRecurringExceptionEvent(task);
			}
		} catch (error: any) {
			// Check if it's a 404 error (event was deleted externally)
			if (error.status === 404 && existingEventId) {
				// Clear the stale link and retry as create
				await this.saveTaskGoogleCalendarMetadata(task.path, {
					googleCalendarEventId: undefined,
				});
				// Retry without the link - refetch task to get updated version
				const updatedTask = await this.plugin.cacheManager.getTaskInfo(task.path);
				if (updatedTask) {
					return this.syncTaskToCalendar(updatedTask, previous);
				}
			}

			console.error("[TaskCalendarSync] Failed to sync task:", task.path, error);

			// Show user-friendly message for token refresh errors
			// TokenRefreshError indicates the OAuth connection expired and user needs to reconnect
			if (error instanceof TokenRefreshError) {
				new Notice(this.plugin.i18n.translate("settings.integrations.googleCalendarExport.notices.connectionExpired"));
			} else {
				new Notice(this.plugin.i18n.translate("settings.integrations.googleCalendarExport.notices.syncFailed", { message: error.message }));
			}
		}
	}

	/**
	 * Update a task in Google Calendar when it changes.
	 * Debounced to prevent rapid-fire API calls during quick successive edits.
	 */
	async updateTaskInCalendar(task: TaskInfo, previous?: TaskInfo): Promise<void> {
		if (!this.plugin.settings.googleCalendarExport.syncOnTaskUpdate) {
			return;
		}

		const taskPath = task.path;

		// Store previous state for recurrence change detection
		if (previous) {
			this.previousTaskState.set(taskPath, previous);
		}

		// Cancel any pending debounced sync for this task
		const existingTimer = this.pendingSyncs.get(taskPath);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		// Store the authoritative task state passed to us so we don't rely on the async metadata cache
		this.pendingTasks.set(taskPath, task);

		// Return a promise that resolves when the debounced sync completes
		return new Promise((resolve, reject) => {
			const timer = setTimeout(async () => {
				this.pendingSyncs.delete(taskPath);

				// Wait for any in-flight sync to complete before starting a new one
				const inFlight = this.inFlightSyncs.get(taskPath);
				if (inFlight) {
					await inFlight.catch(() => {}); // Ignore errors from previous sync
				}

				// Use the latest task data that was passed to us explicitly
				const latestTask = this.pendingTasks.get(taskPath);
				this.pendingTasks.delete(taskPath);

				// Fallback to cache only if the pending task is missing
				const freshTask = latestTask || await this.plugin.cacheManager.getTaskInfo(taskPath);

				if (!freshTask) {
					resolve();
					return;
				}

				const syncPromise = this.executeTaskUpdate(freshTask);
				this.inFlightSyncs.set(taskPath, syncPromise);

				try {
					await syncPromise;
					resolve();
				} catch (error) {
					reject(error);
				} finally {
					this.inFlightSyncs.delete(taskPath);
				}
			}, SYNC_DEBOUNCE_MS);

			this.pendingSyncs.set(taskPath, timer);
		});
	}

	/**
	 * Internal method that performs the actual task update sync
	 */
	private async executeTaskUpdate(task: TaskInfo): Promise<void> {
		const existingEventId = this.getTaskEventId(task);

		// If task no longer meets sync criteria, delete the event
		if (!this.shouldSyncTask(task)) {
			if (existingEventId || this.hasStoredRecurringExceptionMetadata(task)) {
				const deleted = await this.deleteTaskFromCalendar(task);
				if (!deleted) {
					throw new Error(`Failed to delete task from Google Calendar: ${task.path}`);
				}
			}
			// Clean up previous state
			this.previousTaskState.delete(task.path);
			return;
		}

		// Get previous state for recurrence change detection
		const previousState = this.previousTaskState.get(task.path);

		// Sync the updated task
		await this.syncTaskToCalendar(task, previousState);
		
		// Update previous state with current task
		this.previousTaskState.set(task.path, task);
	}

	/**
	 * Handle task completion - update the calendar event.
	 * For recurring tasks, updates the EXDATE list to exclude the completed instance.
	 * For non-recurring tasks, adds a checkmark to the event title.
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

		// For recurring tasks, update EXDATE to exclude completed instance
		if (this.shouldSyncAsRecurring(task)) {
			await this.updateRecurringEventExdates(task);
			return;
		}

		try {
			// Update the event title to indicate completion
			const completedTitle = `✓ ${this.applyTitleTemplate(task)}`;
			const description = settings.includeDescription
				? this.buildEventDescription(task)
				: undefined;

			await this.withGoogleRateLimit(() =>
				this.googleCalendarService.updateEvent(
					settings.targetCalendarId,
					existingEventId,
					{
						summary: completedTitle,
						description,
					}
				)
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
	 * Updates a recurring event's EXDATE list when an instance is completed or skipped.
	 * This adds EXDATE entries for completed/skipped instances to hide them from the calendar.
	 */
	private async updateRecurringEventExdates(task: TaskInfo): Promise<void> {
		if (!this.shouldSyncAsRecurring(task) || !task.recurrence) return;

		const settings = this.plugin.settings.googleCalendarExport;
		const eventId = this.getTaskEventId(task);
		if (!eventId) return;

		try {
			const recurrenceData = convertToGoogleRecurrence(task.recurrence, {
				completedInstances: task.complete_instances,
				skippedInstances: task.skipped_instances,
				additionalExcludedDates: this.getAdditionalRecurringExdates(task),
			});

			if (recurrenceData) {
				await this.withGoogleRateLimit(() =>
					this.googleCalendarService.updateEvent(
						settings.targetCalendarId,
						eventId,
						{ recurrence: recurrenceData.recurrence }
					)
				);
			}
		} catch (error: any) {
			if (error.status === 404) {
				// Event was deleted externally, clean up the link
				await this.removeTaskEventId(task.path);
				return;
			}
			console.error("[TaskCalendarSync] Failed to update recurring event EXDATEs:", task.path, error);
			// Fall back to full resync
			await this.syncTaskToCalendar(task);
		}
	}

	/**
	 * Delete a task's calendar event
	 */
	async deleteTaskFromCalendar(task: TaskInfo): Promise<boolean> {
		if (!this.plugin.settings.googleCalendarExport.syncOnTaskDelete) {
			return true;
		}

		const settings = this.plugin.settings.googleCalendarExport;
		const existingEventId = this.getTaskEventId(task);
		const exceptionEventId = this.getTaskExceptionEventId(task);
		if (!existingEventId && !this.hasStoredRecurringExceptionMetadata(task)) {
			return true;
		}

		let hadDeleteFailure = false;
		for (const eventId of [existingEventId, exceptionEventId]) {
			if (!eventId) {
				continue;
			}

			try {
				await this.withGoogleRateLimit(() =>
					this.googleCalendarService.deleteEvent(settings.targetCalendarId, eventId)
				);
			} catch (error: any) {
				// 404 or 410 means event is already gone - that's fine
				if (error.status !== 404 && error.status !== 410) {
					hadDeleteFailure = true;
					console.error("[TaskCalendarSync] Failed to delete event:", task.path, error);
				}
			}
		}

		if (hadDeleteFailure) {
			return false;
		}

		await this.clearTaskGoogleCalendarMetadata(task.path);
		return true;
	}

	/**
	 * Delete a task's calendar event by path (used when task is being deleted)
	 */
	async deleteTaskFromCalendarByPath(
		taskPath: string,
		eventId?: string,
		exceptionEventId?: string
	): Promise<void> {
		if (!this.plugin.settings.googleCalendarExport.syncOnTaskDelete) {
			return;
		}

		const settings = this.plugin.settings.googleCalendarExport;

		for (const id of [eventId, exceptionEventId]) {
			if (!id) {
				continue;
			}

			try {
				await this.withGoogleRateLimit(() =>
					this.googleCalendarService.deleteEvent(settings.targetCalendarId, id)
				);
			} catch (error: any) {
				// 404 or 410 means event is already gone - that's fine
				if (error.status !== 404 && error.status !== 410) {
					console.error("[TaskCalendarSync] Failed to delete event:", taskPath, error);
				}
			}
		}
		// No need to remove from frontmatter since the task file is being deleted
	}

	// handleTaskPathChange is no longer needed - event ID is stored in frontmatter
	// and moves with the file automatically when renamed/moved

	/**
	 * Sync all tasks to Google Calendar (initial sync or resync).
	 * Uses parallel execution with concurrency limits to improve performance.
	 */
	async syncAllTasks(): Promise<{ synced: number; failed: number; skipped: number }> {
		const results = { synced: 0, failed: 0, skipped: 0 };

		if (!this.isEnabled()) {
			new Notice(this.plugin.i18n.translate("settings.integrations.googleCalendarExport.notices.notEnabledOrConfigured"));
			return results;
		}

		const allTasks = await this.plugin.cacheManager.getAllTasks();

		// Filter to only tasks that should be synced
		const tasksToSync = allTasks.filter((task) => {
			if (!this.shouldSyncTask(task)) {
				results.skipped++;
				return false;
			}
			return true;
		});

		const total = allTasks.length;
		new Notice(this.plugin.i18n.translate("settings.integrations.googleCalendarExport.notices.syncingTasks", { total }));

		// Process tasks in parallel with concurrency limit
		await this.processInParallel(tasksToSync, async (task) => {
			try {
				await this.syncTaskToCalendar(task);
				results.synced++;
			} catch (error) {
				results.failed++;
				console.error(`[TaskCalendarSync] Failed to sync task ${task.path}:`, error);
			}
		});

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
			if (!task.googleCalendarEventId && !this.hasStoredRecurringExceptionMetadata(task)) {
				continue;
			}

			if (deleteEvents) {
				for (const eventId of [
					task.googleCalendarEventId,
					task.googleCalendarExceptionEventId,
				]) {
					if (!eventId) {
						continue;
					}
					try {
						await this.withGoogleRateLimit(() =>
							this.googleCalendarService.deleteEvent(
								settings.targetCalendarId,
								eventId
							)
						);
					} catch (error) {
						console.warn(
							`[TaskCalendarSync] Failed to delete event for ${task.path}:`,
							error
						);
					}
				}
			}

			await this.clearTaskGoogleCalendarMetadata(task.path);
			unlinkedCount++;
		}

		new Notice(
			deleteEvents
				? this.plugin.i18n.translate("settings.integrations.googleCalendarExport.notices.eventsDeletedAndUnlinked", { count: unlinkedCount })
				: this.plugin.i18n.translate("settings.integrations.googleCalendarExport.notices.tasksUnlinked", { count: unlinkedCount })
		);
	}
}
