/* eslint-disable no-console */
import { TFile, EventRef } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskInfo, Reminder, EVENT_TASK_UPDATED } from "../types";
import { parseDateToLocal } from "../utils/dateUtils";
import { shouldNotifyForTask, isAssignedToUser } from "../utils/assigneeFilter";
import { resolveAnchorDate, getAnchorDisplayName } from "../utils/dateAnchorUtils";

interface NotificationQueueItem {
	taskPath: string;
	reminder: Reminder;
	notifyAt: number;
}

/**
 * Info about a reminder that has fired and is waiting to be consumed
 * by the unified notification system (ToastNotification + status bar).
 */
export interface FiredReminderInfo {
	taskPath: string;
	message: string;
	firedAt: number;
	reminderType: string; // "due-date" | "overdue" | "lead-time" | "start-date"
	reminderId: string;
	task: TaskInfo;
}

export class NotificationService {
	private plugin: TaskNotesPlugin;
	private notificationQueue: NotificationQueueItem[] = [];
	private broadScanInterval?: number;
	private quickCheckInterval?: number;
	private processedReminders: Set<string> = new Set(); // Track processed reminders to avoid duplicates
	private sessionFiredReminders: Set<string> = new Set(); // Track persistent/overdue reminders fired this scan cycle
	private taskUpdateListener?: EventRef;
	/** Reminders that have fired and are waiting to be consumed by the unified toast system */
	private firedReminders: Map<string, FiredReminderInfo> = new Map();
	private lastBroadScanTime: number = Date.now();
	private lastQuickCheckTime: number = Date.now();

	// Configuration constants
	private readonly BROAD_SCAN_INTERVAL = 5 * 60 * 1000; // 5 minutes
	private readonly QUICK_CHECK_INTERVAL = 30 * 1000; // 30 seconds
	private readonly QUEUE_WINDOW = 5 * 60 * 1000; // 5 minutes ahead

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
	}

	async initialize(): Promise<void> {
		if (!this.plugin.settings.enableNotifications) {
			return;
		}

		// Request notification permission if using system notifications
		const effectiveType = this.plugin.devicePrefs.getNotificationType();
		if ((effectiveType === "system" || effectiveType === "both") && "Notification" in window) {
			if (Notification.permission === "default") {
				await Notification.requestPermission();
			}
		}

		// Set up task update listener to handle stale notifications
		this.setupTaskUpdateListener();

		// Start the two-tier interval system
		this.startBroadScan();
		this.startQuickCheck();

		// Do an initial scan
		await this.scanTasksAndBuildQueue();
	}

	/**
	 * Clear all processed/session-fired tracking so reminders can re-fire.
	 * Used by "Check reminders now" command to reset state for demos.
	 */
	clearAllProcessed(): void {
		this.processedReminders.clear();
		this.sessionFiredReminders.clear();
		this.firedReminders.clear();
		this.notificationQueue = [];
		this.plugin.debugLog.log("NotificationService", "Cleared all processed/fired state");
	}

	/**
	 * Force an immediate scan and queue check. Useful for debugging and demos.
	 * Also includes a grace period for recently-past reminders (up to 2 minutes ago).
	 */
	async checkNow(): Promise<{ queued: number; fired: number }> {
		this.plugin.debugLog.log("NotificationService", "=== MANUAL CHECK NOW ===");
		await this.scanTasksAndBuildQueue();

		// Also queue recently-past explicit reminders (grace period for demos/testing)
		const now = Date.now();
		const gracePeriod = 2 * 60 * 1000; // 2 minutes
		const tasks = await this.plugin.cacheManager.getAllTasks();
		let graceQueued = 0;

		for (const task of tasks) {
			if (!task.reminders) continue;
			for (const reminder of task.reminders) {
				const reminderId = `${task.path}-${reminder.id}`;
				if (this.processedReminders.has(reminderId)) continue;

				const notifyAt = this.calculateNotificationTime(task, reminder);
				if (notifyAt === null) continue;

				// Queue if within grace period (recently past but not yet processed)
				if (notifyAt <= now && notifyAt > now - gracePeriod) {
					this.notificationQueue.push({ taskPath: task.path, reminder, notifyAt: now });
					graceQueued++;
					this.plugin.debugLog.log("NotificationService", `Grace-queued past reminder: ${reminderId}`);
				}
			}
		}

		// Process the queue immediately
		this.checkNotificationQueue();

		const result = { queued: this.notificationQueue.length, fired: graceQueued };
		this.plugin.debugLog.log("NotificationService", `Check complete: ${result.queued} queued, ${result.fired} grace-fired`);
		return result;
	}

	destroy(): void {
		if (this.broadScanInterval) {
			clearInterval(this.broadScanInterval);
		}
		if (this.quickCheckInterval) {
			clearInterval(this.quickCheckInterval);
		}
		if (this.taskUpdateListener) {
			this.plugin.emitter.offref(this.taskUpdateListener);
		}
		this.notificationQueue = [];
		this.processedReminders.clear();
		this.sessionFiredReminders.clear();
		this.firedReminders.clear();
	}

	private startBroadScan(): void {
		this.broadScanInterval = setInterval(async () => {
			const now = Date.now();
			const timeSinceLastScan = now - this.lastBroadScanTime;

			// Check for system sleep/wake - if gap is significantly larger than interval, handle catch-up
			if (timeSinceLastScan > this.BROAD_SCAN_INTERVAL + 60000) {
				// 1 minute tolerance
				this.plugin.debugLog.log(
					"NotificationService", "Detected potential system sleep, performing catch-up scan"
				);
				await this.handleSystemWakeUp();
			}

			await this.scanTasksAndBuildQueue();
			this.lastBroadScanTime = now;
		}, this.BROAD_SCAN_INTERVAL) as unknown as number;
	}

	private startQuickCheck(): void {
		this.quickCheckInterval = setInterval(() => {
			const now = Date.now();
			const timeSinceLastCheck = now - this.lastQuickCheckTime;

			// Check for system sleep/wake for quick checks too
			if (timeSinceLastCheck > this.QUICK_CHECK_INTERVAL + 60000) {
				// 1 minute tolerance
				this.plugin.debugLog.log(
					"NotificationService", "Detected potential system sleep during quick check"
				);
				// Don't spam with catch-up, just process current queue
			}

			this.checkNotificationQueue();
			this.lastQuickCheckTime = now;
		}, this.QUICK_CHECK_INTERVAL) as unknown as number;
	}

	/**
	 * Get the person note path relevant to the current device for a given task.
	 * Returns null if no device-person mapping exists (graceful degradation).
	 */
	private getRelevantPersonPath(task: TaskInfo): string | null {
		const currentUser = this.plugin.userRegistry?.getCurrentUser() ?? null;
		if (!currentUser) {
			return null; // No device-person mapping — use global defaults
		}

		// If not filtering by assignment, the current user is always relevant
		if (!this.plugin.devicePrefs.getFilterByAssignment()) {
			return currentUser;
		}

		// Check if current user is assigned to this task (directly or via group)
		const assigneeFieldName = this.plugin.settings.assigneeFieldName || "assignee";
		const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
		if (!(file instanceof TFile)) {
			return currentUser; // Can't check — default to current user
		}
		const cache = this.plugin.app.metadataCache.getFileCache(file);
		const assigneeValue = cache?.frontmatter?.[assigneeFieldName];

		if (!assigneeValue) {
			// Unassigned task — person is relevant if includeUnassigned is on
			return this.plugin.devicePrefs.getIncludeUnassignedTasks() ? currentUser : null;
		}

		return isAssignedToUser(assigneeValue, currentUser, this.plugin.groupRegistry ?? null)
			? currentUser
			: null;
	}

	/**
	 * Adjust notification time based on the person's availability window.
	 * Only adjusts virtual reminders (from global rules) — explicit reminders keep exact timing.
	 * Returns { skip: true } if the person has disabled notifications.
	 *
	 * Availability logic:
	 * - Day+ lead-times: pin to availableFrom time
	 * - Sub-day lead-times with < 1 hour offset: keep exact time (critical reminders)
	 * - Other sub-day reminders: if outside [availableFrom, availableUntil], defer to next availableFrom
	 */
	private applyPersonTiming(
		notifyAt: number,
		personPath: string | null,
		reminder: Reminder
	): { notifyAt: number; skip: boolean } {
		if (!personPath || !this.plugin.personNoteService) {
			return { notifyAt, skip: false };
		}

		const prefs = this.plugin.personNoteService.getPreferences(personPath);

		// If person has disabled notifications, skip entirely
		if (!prefs.notificationEnabled) {
			this.plugin.debugLog.log(
				"NotificationService", `Skipping notification for ${personPath} — notificationEnabled: false`
			);
			return { notifyAt, skip: true };
		}

		// Only adjust timing for virtual reminders (global rules).
		// Explicit reminders retain their exact user-specified timing.
		if (!reminder.isVirtual) {
			return { notifyAt, skip: false };
		}

		const fromTime = this.plugin.personNoteService.getAvailableFrom(personPath);
		const untilTime = this.plugin.personNoteService.getAvailableUntil(personPath);

		// Sub-day lead-time reminders with < 1 hour offset keep exact time (critical)
		if (reminder.semanticType === "lead-time" && reminder.offset) {
			const isSubDay = /^-?PT/.test(reminder.offset) && !/\d+[DWY]/.test(reminder.offset);
			if (isSubDay) {
				// Check if < 1 hour offset — these are critical and skip availability deferral
				const absMs = Math.abs(this.parseISO8601Duration(reminder.offset) ?? 0);
				if (absMs > 0 && absMs < 3600000) {
					return { notifyAt, skip: false };
				}
				// Longer sub-day offsets: apply availability window deferral
				return { notifyAt: this.deferToAvailability(notifyAt, fromTime, untilTime, personPath), skip: false };
			}
		}

		// Day+ lead-times and other virtual reminders: pin to availableFrom
		const notifyDate = new Date(notifyAt);
		const originalHours = notifyDate.getHours();
		const originalMinutes = notifyDate.getMinutes();
		notifyDate.setHours(fromTime.hours, fromTime.minutes, 0, 0);

		if (originalHours !== fromTime.hours || originalMinutes !== fromTime.minutes) {
			this.plugin.debugLog.log(
				"NotificationService", `Person timing adjusted: ${originalHours}:${String(originalMinutes).padStart(2, "0")} → ${fromTime.hours}:${String(fromTime.minutes).padStart(2, "0")} for ${personPath}`
			);
		}

		return { notifyAt: notifyDate.getTime(), skip: false };
	}

	/**
	 * Defer a notification time to the person's availability window.
	 * Handles both normal (e.g., 09:00-17:00) and wrap-around (e.g., 22:00-06:00) windows.
	 * - If within window: fire as-is
	 * - If outside window: defer to next availableFrom
	 */
	private deferToAvailability(
		notifyAt: number,
		fromTime: { hours: number; minutes: number },
		untilTime: { hours: number; minutes: number },
		personPath: string
	): number {
		const d = new Date(notifyAt);
		const fromMinutes = fromTime.hours * 60 + fromTime.minutes;
		const untilMinutes = untilTime.hours * 60 + untilTime.minutes;
		const currentMinutes = d.getHours() * 60 + d.getMinutes();

		const isWraparound = fromMinutes > untilMinutes;

		// Check if current time is within the availability window
		const isWithinWindow = isWraparound
			? (currentMinutes >= fromMinutes || currentMinutes <= untilMinutes)
			: (currentMinutes >= fromMinutes && currentMinutes <= untilMinutes);

		if (isWithinWindow) {
			return notifyAt;
		}

		// Outside window — defer to next availableFrom
		if (isWraparound) {
			// Wrap-around: outside window is between untilMinutes and fromMinutes
			// Always defer to today's fromTime (it's later today)
			if (currentMinutes > untilMinutes && currentMinutes < fromMinutes) {
				d.setHours(fromTime.hours, fromTime.minutes, 0, 0);
				this.plugin.debugLog.log("NotificationService", `Deferred to availableFrom (today, night shift) for ${personPath}`);
			}
		} else {
			// Normal: before from → today's from; after until → tomorrow's from
			if (currentMinutes < fromMinutes) {
				d.setHours(fromTime.hours, fromTime.minutes, 0, 0);
				this.plugin.debugLog.log("NotificationService", `Deferred to availableFrom (today) for ${personPath}`);
			} else {
				d.setDate(d.getDate() + 1);
				d.setHours(fromTime.hours, fromTime.minutes, 0, 0);
				this.plugin.debugLog.log("NotificationService", `Deferred to availableFrom (tomorrow) for ${personPath}`);
			}
		}

		return d.getTime();
	}

	private async scanTasksAndBuildQueue(): Promise<void> {
		// Clear existing queue and rebuild
		this.notificationQueue = [];
		// Clear session-fired set so persistent/overdue reminders can re-fire
		this.sessionFiredReminders.clear();

		// Get all tasks from the cache
		const tasks = await this.plugin.cacheManager.getAllTasks();
		const now = Date.now();
		const windowEnd = now + this.QUEUE_WINDOW;

		// Assignee filtering setup (per-device via DevicePreferencesManager)
		const filterByAssignee = this.plugin.devicePrefs.getFilterByAssignment();
		const currentUser = filterByAssignee ? (this.plugin.userRegistry?.getCurrentUser() ?? null) : null;
		const includeUnassigned = this.plugin.devicePrefs.getIncludeUnassignedTasks();
		const assigneeFieldName = this.plugin.settings.assigneeFieldName || "assignee";

		// Scan diagnostics
		let tasksScanned = 0;
		let tasksSkippedAssignee = 0;
		let tasksSkippedDisabled = 0;
		let personLeadTimeTaskCount = 0;

		for (const task of tasks) {
			tasksScanned++;

			// Skip tasks not assigned to current user (when filtering enabled)
			if (filterByAssignee) {
				const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
				if (file instanceof TFile) {
					const cache = this.plugin.app.metadataCache.getFileCache(file);
					const assigneeValue = cache?.frontmatter?.[assigneeFieldName];
					if (!shouldNotifyForTask(assigneeValue, currentUser, includeUnassigned, this.plugin.groupRegistry ?? null)) {
						tasksSkippedAssignee++;
						continue;
					}
				}
			}

			// Resolve person path once per task for person-aware timing
			const personPath = this.getRelevantPersonPath(task);

			// Skip entire task if person has disabled notifications
			if (personPath && this.plugin.personNoteService) {
				const prefs = this.plugin.personNoteService.getPreferences(personPath);
				if (!prefs.notificationEnabled) {
					tasksSkippedDisabled++;
					continue;
				}
			}

			// Process explicit reminders
			if (task.reminders && task.reminders.length > 0) {
				for (const reminder of task.reminders) {
					// Skip if already processed
					const reminderId = `${task.path}-${reminder.id}`;
					if (this.processedReminders.has(reminderId)) {
						continue;
					}

					const notifyAt = this.calculateNotificationTime(task, reminder);
					if (notifyAt === null) {
						continue;
					}

					// Add to queue if within the next scan window
					// (explicit reminders keep exact timing — no person time adjustment)
					if (notifyAt > now && notifyAt <= windowEnd) {
						this.notificationQueue.push({
							taskPath: task.path,
							reminder,
							notifyAt,
						});
					}
				}
			}

			// Generate and process virtual reminders from global rules (+ person lead times)
			const virtualReminders = this.generateVirtualReminders(task, personPath);
			const hasPersonLT = virtualReminders.some(r => r.sourceRuleId?.startsWith("person-lt_"));
			if (hasPersonLT) personLeadTimeTaskCount++;

			for (const vReminder of virtualReminders) {
				const reminderId = `${task.path}-${vReminder.id}`;
				if (this.processedReminders.has(reminderId)) continue;
				if (this.sessionFiredReminders.has(reminderId)) continue;

				let notifyAt = this.calculateNotificationTime(task, vReminder);
				if (notifyAt === null) continue;

				// Apply person-specific timing for virtual reminders
				const { notifyAt: adjustedNotifyAt, skip } = this.applyPersonTiming(notifyAt, personPath, vReminder);
				if (skip) continue;
				notifyAt = adjustedNotifyAt;

				// Handle past notification times based on semantic type
				if (notifyAt <= now) {
					if (vReminder.semanticType === "lead-time" || vReminder.semanticType === "start-date") {
						// One-shot: missed window, skip
						continue;
					} else if (vReminder.semanticType === "overdue" && vReminder.repeatIntervalHours) {
						// Overdue: advance to next valid fire time
						const intervalMs = Math.max(vReminder.repeatIntervalHours * 3600000, 3600000); // Min 1h
						while (notifyAt <= now) {
							notifyAt += intervalMs;
						}
					} else if (vReminder.semanticType === "due-date") {
						// Persistent: fire soon (within next check cycle)
						notifyAt = now + 1000;
					}
				}

				if (notifyAt > now && notifyAt <= windowEnd) {
					this.notificationQueue.push({
						taskPath: task.path,
						reminder: vReminder,
						notifyAt,
					});
				}
			}
		}

		// Sort queue by notification time
		this.notificationQueue.sort((a, b) => a.notifyAt - b.notifyAt);

		// Scan summary for diagnostics
		const personPath = this.plugin.userRegistry?.getCurrentUser() ?? null;
		const hasCustomLT = personPath && this.plugin.personNoteService
			? this.plugin.personNoteService.hasCustomLeadTimes(personPath)
			: false;
		this.plugin.debugLog.log(
			"NotificationService", `Scan complete: ` +
			`${tasksScanned} tasks scanned, ` +
			`${tasksSkippedAssignee} skipped (assignee), ` +
			`${tasksSkippedDisabled} skipped (disabled), ` +
			`${this.notificationQueue.length} queued. ` +
			`Person: ${personPath || "none"}, ` +
			`customLeadTimes: ${hasCustomLT}, ` +
			`personLTTasks: ${personLeadTimeTaskCount}`
		);
	}

	/**
	 * Generate virtual reminders for a task based on enabled global reminder rules.
	 * Virtual reminders are never persisted to frontmatter — they exist only at runtime.
	 */
	private generateVirtualReminders(task: TaskInfo, personPath?: string | null): Reminder[] {
		const rules = this.plugin.settings.globalReminderRules;
		if (!rules || rules.length === 0) return [];

		// Skip completed tasks entirely
		if (this.plugin.statusManager.isCompletedStatus(task.status)) {
			return [];
		}

		const virtualReminders: Reminder[] = [];
		const skippedRules: string[] = [];

		// Check if person has custom lead times
		const personService = this.plugin.personNoteService;
		const hasPersonLeadTimes = personPath && personService
			? personService.hasCustomLeadTimes(personPath)
			: false;

		// Check override vs additive mode
		const shouldOverride = personPath && personService
			? personService.shouldOverrideGlobal(personPath)
			: true; // Default to override for backwards compat

		const personLeadTimeReminders: Reminder[] = [];
		if (hasPersonLeadTimes && personService) {
			const prefs = personService.getPreferences(personPath!);

			// Collect anchor properties from enabled global lead-time rules
			const leadTimeAnchors = new Set<string>();
			for (const rule of rules) {
				if (rule.enabled && rule.semanticType === "lead-time") {
					leadTimeAnchors.add(rule.anchorProperty);
				}
			}

			// Skip if explicit lead-time reminder exists on this task
			const hasExplicitLeadTime = task.reminders?.some(
				(r) => r.semanticType === "lead-time" && !r.isVirtual
			) ?? false;

			if (!hasExplicitLeadTime) {
				for (const anchor of leadTimeAnchors) {
					const anchorDate = resolveAnchorDate(task, anchor, this.plugin);
					if (!anchorDate) continue;

					for (const lt of prefs.reminderLeadTimes) {
						const offset = personService.leadTimeToISO8601(lt);
						personLeadTimeReminders.push({
							id: `virtual_person-lt_${anchor}_${lt.value}${lt.unit}`,
							type: "relative",
							relatedTo: anchor,
							offset,
							description: `${lt.value} ${lt.unit} before ${anchor} (person)`,
							semanticType: "lead-time",
							isVirtual: true,
							sourceRuleId: `person-lt_${anchor}_${lt.value}${lt.unit}`,
						});
					}
				}
			}

			const mode = shouldOverride ? "replacing" : "adding to";
			if (personLeadTimeReminders.length > 0) {
				this.plugin.debugLog.log(
					"NotificationService", `Person lead times for ${personPath}: ` +
					`generated ${personLeadTimeReminders.length} reminders (${mode} global lead-time rules)`
				);
			}
		}

		// Collect offsets from person lead-time reminders for deduplication in additive mode
		const personOffsets = new Set<string>();
		if (!shouldOverride && personLeadTimeReminders.length > 0) {
			for (const r of personLeadTimeReminders) {
				personOffsets.add(`${r.relatedTo}_${r.offset}`);
			}
		}

		for (const rule of rules) {
			if (!rule.enabled) continue;

			// In override mode: skip global lead-time rules when person has custom lead times
			// In additive mode: keep global rules but deduplicate against person offsets
			if (hasPersonLeadTimes && rule.semanticType === "lead-time") {
				if (shouldOverride) {
					skippedRules.push(`${rule.id}:person-override`);
					continue;
				}
				// Additive: skip if person already has same offset for same anchor
				const key = `${rule.anchorProperty}_${rule.offset}`;
				if (personOffsets.has(key)) {
					skippedRules.push(`${rule.id}:person-duplicate`);
					continue;
				}
			}

			// Check if task has the anchor property
			const anchorDate = resolveAnchorDate(task, rule.anchorProperty, this.plugin);
			if (!anchorDate) {
				skippedRules.push(`${rule.id}:no-anchor`);
				continue;
			}

			// Skip if explicit reminder with same semantic type exists
			if (rule.skipIfExplicitExists && task.reminders) {
				const hasExplicit = task.reminders.some(
					(r) => r.semanticType === rule.semanticType && !r.isVirtual
				);
				if (hasExplicit) {
					skippedRules.push(`${rule.id}:explicit-exists`);
					continue;
				}
			}

			virtualReminders.push({
				id: `virtual_${rule.id}`,
				type: "relative",
				relatedTo: rule.anchorProperty,
				offset: rule.offset,
				description: rule.description,
				semanticType: rule.semanticType,
				isVirtual: true,
				sourceRuleId: rule.id,
				...(rule.repeatIntervalHours ? { repeatIntervalHours: rule.repeatIntervalHours } : {}),
			});
		}

		// Append person lead-time reminders
		virtualReminders.push(...personLeadTimeReminders);

		if (virtualReminders.length > 0 || skippedRules.length > 0) {
			this.plugin.debugLog.log(
				"NotificationService", `Virtual reminders for ${task.path}: ` +
				`generated=[${virtualReminders.map((r) => r.sourceRuleId).join(", ")}], ` +
				`skipped=[${skippedRules.join(", ")}]`
			);
		}

		return virtualReminders;
	}

	private calculateNotificationTime(task: TaskInfo, reminder: Reminder): number | null {
		try {
			if (reminder.type === "absolute") {
				// Absolute reminder - parse the timestamp directly
				if (!reminder.absoluteTime) {
					return null;
				}
				return parseDateToLocal(reminder.absoluteTime).getTime();
			} else if (reminder.type === "relative") {
				// Relative reminder - calculate based on anchor date
				if (!reminder.relatedTo || !reminder.offset) {
					return null;
				}

				const anchorDateStr = resolveAnchorDate(task, reminder.relatedTo!, this.plugin);
				if (!anchorDateStr) {
					return null;
				}

				// Parse the anchor date
				const anchorDate = parseDateToLocal(anchorDateStr);

				// Parse the ISO 8601 duration and apply offset
				const offsetMs = this.parseISO8601Duration(reminder.offset);
				if (offsetMs === null) {
					return null;
				}

				return anchorDate.getTime() + offsetMs;
			}
		} catch (error) {
			console.error("Error calculating notification time:", error);
			return null;
		}

		return null;
	}

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

	private checkNotificationQueue(): void {
		const now = Date.now();
		const toRemove: number[] = [];
		const toRequeue: NotificationQueueItem[] = [];

		for (let i = 0; i < this.notificationQueue.length; i++) {
			const item = this.notificationQueue[i];

			if (item.notifyAt <= now) {
				// Trigger the notification
				this.triggerNotification(item);
				toRemove.push(i);

				const reminderId = `${item.taskPath}-${item.reminder.id}`;
				const semanticType = item.reminder.semanticType;

				if (semanticType === "due-date") {
					// Fire once per session — stored in firedReminders map for unified toast display.
					// Using processedReminders (not sessionFiredReminders) prevents re-firing on each scan.
					this.processedReminders.add(reminderId);
					this.plugin.debugLog.log("NotificationService", `Due-date reminder fired once for ${item.taskPath}`);
				} else if (semanticType === "overdue" && item.reminder.repeatIntervalHours) {
					// Overdue: re-queue with next interval
					this.sessionFiredReminders.add(reminderId);
					const intervalMs = Math.max(item.reminder.repeatIntervalHours * 3600000, 3600000); // Min 1h
					toRequeue.push({
						taskPath: item.taskPath,
						reminder: item.reminder,
						notifyAt: item.notifyAt + intervalMs,
					});
					this.plugin.debugLog.log("NotificationService", `Overdue reminder re-queued for ${item.taskPath} in ${item.reminder.repeatIntervalHours}h`);
				} else {
					// One-shot (lead-time, start-date, custom): mark as processed
					this.processedReminders.add(reminderId);
				}
			} else {
				// Queue is sorted, so we can break early
				break;
			}
		}

		// Remove triggered items from queue
		for (let i = toRemove.length - 1; i >= 0; i--) {
			this.notificationQueue.splice(toRemove[i], 1);
		}

		// Re-queue overdue reminders with next interval
		if (toRequeue.length > 0) {
			this.notificationQueue.push(...toRequeue);
			this.notificationQueue.sort((a, b) => a.notifyAt - b.notifyAt);
		}
	}

	private async triggerNotification(item: NotificationQueueItem): Promise<void> {
		// Get the task info for the notification
		const file = this.plugin.app.vault.getAbstractFileByPath(item.taskPath) as TFile;
		if (!file) {
			return;
		}

		const metadata = this.plugin.app.metadataCache.getFileCache(file);
		if (!metadata || !metadata.frontmatter) {
			return;
		}

		const task = this.plugin.fieldMapper.mapFromFrontmatter(
			metadata.frontmatter,
			item.taskPath,
			this.plugin.settings.storeTitleInFilename
		) as TaskInfo;

		// Generate notification message
		const message =
			item.reminder.description || this.generateDefaultMessage(task, item.reminder);

		const notifType = this.plugin.devicePrefs.getNotificationType();

		// System (desktop OS) notifications — kept as-is
		if (notifType === "system" || notifType === "both") {
			if ("Notification" in window && Notification.permission === "granted") {
				const notification = new Notification("TaskNotes Reminder", {
					body: message,
					tag: `tasknotes-${item.taskPath}-${item.reminder.id}`,
				});

				notification.onclick = () => {
					this.plugin.app.workspace.openLinkText(item.taskPath, "", false);
					notification.close();
				};
			}
		}

		// In-app notifications: store in firedReminders map for the unified
		// toast/bell/upcoming system to consume (replaces old Notice approach)
		if (notifType === "in-app" || notifType === "both") {
			const key = `${item.taskPath}-${item.reminder.id}`;
			this.firedReminders.set(key, {
				taskPath: item.taskPath,
				message,
				firedAt: Date.now(),
				reminderType: item.reminder.semanticType || "custom",
				reminderId: item.reminder.id,
				task,
			});
			this.plugin.debugLog.log("NotificationService", `Fired reminder stored for unified display: ${key}`);

			// Invalidate notification cache so the next bell/toast check picks this up
			if (this.plugin.notificationCache) {
				this.plugin.notificationCache.invalidateAggregated();
			}
		}

		// Trigger webhook for reminder
		if (this.plugin.apiService) {
			await this.plugin.apiService.triggerWebhook("reminder.triggered", {
				task,
				reminder: item.reminder,
				notificationTime: new Date(item.notifyAt).toISOString(),
				message,
				notificationType: notifType,
			});
		}
	}

	private generateDefaultMessage(task: TaskInfo, reminder: Reminder): string {
		if (reminder.type === "absolute") {
			return `Reminder: ${task.title}`;
		} else {
			const anchor = getAnchorDisplayName(reminder.relatedTo || "due", this.plugin).toLowerCase();
			const offset = this.formatDurationForDisplay(reminder.offset || "");

			if (offset.startsWith("-")) {
				return `${task.title} is ${anchor} in ${offset.substring(1)}`;
			} else if (offset === "PT0S" || offset === "PT0M") {
				return `${task.title} is ${anchor} now`;
			} else {
				return `${task.title} was ${anchor} ${offset} ago`;
			}
		}
	}

	private formatDurationForDisplay(duration: string): string {
		const ms = this.parseISO8601Duration(duration);
		if (ms === null) return duration;

		const absMs = Math.abs(ms);
		const minutes = Math.floor(absMs / (60 * 1000));
		const hours = Math.floor(absMs / (60 * 60 * 1000));
		const days = Math.floor(absMs / (24 * 60 * 60 * 1000));

		let result = "";
		if (days > 0) {
			result = `${days} day${days > 1 ? "s" : ""}`;
		} else if (hours > 0) {
			result = `${hours} hour${hours > 1 ? "s" : ""}`;
		} else if (minutes > 0) {
			result = `${minutes} minute${minutes > 1 ? "s" : ""}`;
		} else {
			result = "now";
		}

		return ms < 0 ? `-${result}` : result;
	}

	// Public method to manually refresh reminders (useful for testing)
	async refreshReminders(): Promise<void> {
		await this.scanTasksAndBuildQueue();
	}

	// Public method to clear processed reminders (useful when task is edited)
	clearProcessedRemindersForTask(taskPath: string): void {
		const keysToRemove: string[] = [];
		for (const key of this.processedReminders) {
			if (key.startsWith(`${taskPath}-`)) {
				keysToRemove.push(key);
			}
		}
		keysToRemove.forEach((key) => this.processedReminders.delete(key));
	}

	/**
	 * Get all fired reminders waiting to be consumed by the unified notification system.
	 * Called by VaultWideNotificationService to include upstream reminders in aggregation.
	 */
	getFiredReminders(): FiredReminderInfo[] {
		return Array.from(this.firedReminders.values());
	}

	/**
	 * Clear a specific fired reminder after it has been seen/dismissed in the toast UI.
	 */
	clearFiredReminder(key: string): void {
		this.firedReminders.delete(key);
	}

	/**
	 * Clear all fired reminders for a specific task path.
	 * Called when a task is completed or its reminders change.
	 */
	clearFiredRemindersForTask(taskPath: string): void {
		for (const key of this.firedReminders.keys()) {
			if (key.startsWith(`${taskPath}-`)) {
				this.firedReminders.delete(key);
			}
		}
	}

	private clearSessionFiredRemindersForTask(taskPath: string): void {
		const keysToRemove: string[] = [];
		for (const key of this.sessionFiredReminders) {
			if (key.startsWith(`${taskPath}-`)) {
				keysToRemove.push(key);
			}
		}
		keysToRemove.forEach((key) => this.sessionFiredReminders.delete(key));
	}

	private setupTaskUpdateListener(): void {
		this.taskUpdateListener = this.plugin.emitter.on(
			EVENT_TASK_UPDATED,
			async ({ path, originalTask, updatedTask }) => {
				if (!path || !updatedTask) {
					return;
				}

				// Clear any existing notifications for this task path
				this.removeNotificationsForTask(path);

				// Only clear processed/session-fired reminders when reminder-relevant
				// properties actually changed. Without this guard, any metadata update
				// (e.g., metadataCache refresh) clears the dedup set, causing
				// persistent "due-date" reminders to re-fire repeatedly.
				const reminderRelevantChanged =
					!originalTask ||
					originalTask.status !== updatedTask.status ||
					originalTask.due !== updatedTask.due ||
					originalTask.scheduled !== updatedTask.scheduled ||
					JSON.stringify(originalTask.reminders) !== JSON.stringify(updatedTask.reminders);

				if (reminderRelevantChanged) {
					this.clearProcessedRemindersForTask(path);
					this.clearSessionFiredRemindersForTask(path);
					this.clearFiredRemindersForTask(path);
				}

				// If task is now completed, block all virtual reminders and stop
				if (this.plugin.statusManager.isCompletedStatus(updatedTask.status)) {
					this.clearFiredRemindersForTask(path);
					const rules = this.plugin.settings.globalReminderRules;
					if (rules) {
						for (const rule of rules) {
							this.processedReminders.add(`${path}-virtual_${rule.id}`);
						}
					}
					this.plugin.debugLog.log("NotificationService", `Task completed, cancelled virtual reminders for ${path}`);
					return;
				}

				// Skip tasks not assigned to current user (per-device scope)
				if (this.plugin.devicePrefs.getFilterByAssignment()) {
					const currentUser = this.plugin.userRegistry?.getCurrentUser() ?? null;
					const assigneeFieldName = this.plugin.settings.assigneeFieldName || "assignee";
					const file = this.plugin.app.vault.getAbstractFileByPath(path);
					if (file instanceof TFile) {
						const cache = this.plugin.app.metadataCache.getFileCache(file);
						const assigneeValue = cache?.frontmatter?.[assigneeFieldName];
						if (!shouldNotifyForTask(assigneeValue, currentUser, this.plugin.devicePrefs.getIncludeUnassignedTasks(), this.plugin.groupRegistry ?? null)) {
							return;
						}
					}
				}

				// Resolve person path for person-aware timing
				const personPath = this.getRelevantPersonPath(updatedTask);

				// Skip if person has disabled notifications
				if (personPath && this.plugin.personNoteService) {
					const prefs = this.plugin.personNoteService.getPreferences(personPath);
					if (!prefs.notificationEnabled) {
						return;
					}
				}

				// Re-calculate notification times for the updated task within the current window
				const now = Date.now();
				const windowEnd = now + this.QUEUE_WINDOW;

				if (updatedTask.reminders && updatedTask.reminders.length > 0) {
					for (const reminder of updatedTask.reminders) {
						const reminderId = `${path}-${reminder.id}`;
						if (this.processedReminders.has(reminderId)) {
							continue;
						}

						const notifyAt = this.calculateNotificationTime(updatedTask, reminder);
						if (notifyAt === null) {
							continue;
						}

						// Explicit reminders keep exact timing — no person time adjustment
						if (notifyAt > now && notifyAt <= windowEnd) {
							this.notificationQueue.push({
								taskPath: path,
								reminder,
								notifyAt,
							});
						}
					}
				}

				// Re-evaluate virtual reminders for the updated task (+ person lead times)
				const virtualReminders = this.generateVirtualReminders(updatedTask, personPath);
				for (const vReminder of virtualReminders) {
					const reminderId = `${path}-${vReminder.id}`;
					if (this.processedReminders.has(reminderId)) continue;
					if (this.sessionFiredReminders.has(reminderId)) continue;

					let notifyAt = this.calculateNotificationTime(updatedTask, vReminder);
					if (notifyAt === null) continue;

					// Apply person-specific timing for virtual reminders
					const { notifyAt: adjustedNotifyAt, skip } = this.applyPersonTiming(notifyAt, personPath, vReminder);
					if (skip) continue;
					notifyAt = adjustedNotifyAt;

					// Handle past notification times based on semantic type
					if (notifyAt <= now) {
						if (vReminder.semanticType === "lead-time" || vReminder.semanticType === "start-date") {
							continue;
						} else if (vReminder.semanticType === "overdue" && vReminder.repeatIntervalHours) {
							const intervalMs = Math.max(vReminder.repeatIntervalHours * 3600000, 3600000);
							while (notifyAt <= now) {
								notifyAt += intervalMs;
							}
						} else if (vReminder.semanticType === "due-date") {
							notifyAt = now + 1000;
						}
					}

					if (notifyAt > now && notifyAt <= windowEnd) {
						this.notificationQueue.push({
							taskPath: path,
							reminder: vReminder,
							notifyAt,
						});
					}
				}

				// Re-sort queue by notification time
				this.notificationQueue.sort((a, b) => a.notifyAt - b.notifyAt);
			}
		);
	}

	private removeNotificationsForTask(taskPath: string): void {
		this.notificationQueue = this.notificationQueue.filter(
			(item) => item.taskPath !== taskPath
		);
	}

	private async handleSystemWakeUp(): Promise<void> {
		// Clear processed reminders to allow missed notifications to trigger
		// But only for reminders that are now past their notification time
		const now = Date.now();
		const keysToRemove: string[] = [];

		// Check all processed reminders and remove ones that should have triggered
		for (const key of this.processedReminders) {
			const [taskPath, reminderId] = key.split("-", 2);
			if (!taskPath || !reminderId) continue;

			// Try to get the task and check if the reminder time has passed
			try {
				const task = await this.plugin.cacheManager.getTaskInfo(taskPath);
				if (task && task.reminders) {
					const reminder = task.reminders.find((r) => r.id === reminderId);
					if (reminder) {
						const notifyAt = this.calculateNotificationTime(task, reminder);
						if (notifyAt && notifyAt <= now) {
							keysToRemove.push(key);
						}
					}
				}
			} catch (error) {
				// If we can't get the task, remove the processed reminder anyway
				keysToRemove.push(key);
			}
		}

		keysToRemove.forEach((key) => this.processedReminders.delete(key));

		// Perform a full scan to rebuild the queue with current data
		await this.scanTasksAndBuildQueue();
	}
}
