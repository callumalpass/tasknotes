import { Notice, TFile, EventRef } from 'obsidian';
import TaskNotesPlugin from '../main';
import { TaskInfo, Reminder, EVENT_TASK_UPDATED } from '../types';
import { parseDateToLocal, hasTimeComponent } from '../utils/dateUtils';

interface NotificationQueueItem {
	taskPath: string;
	reminder: Reminder;
	notifyAt: number;
}

export class NotificationService {
	private plugin: TaskNotesPlugin;
	private notificationQueue: NotificationQueueItem[] = [];
	private broadScanInterval?: NodeJS.Timer;
	private quickCheckInterval?: NodeJS.Timer;
	private processedReminders: Set<string> = new Set(); // Track processed reminders to avoid duplicates
	private taskUpdateListener?: EventRef;
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
		if (this.plugin.settings.notificationType === 'system' && 'Notification' in window) {
			if (Notification.permission === 'default') {
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
	}

	private startBroadScan(): void {
		this.broadScanInterval = setInterval(async () => {
			const now = Date.now();
			const timeSinceLastScan = now - this.lastBroadScanTime;
			
			// Check for system sleep/wake - if gap is significantly larger than interval, handle catch-up
			if (timeSinceLastScan > this.BROAD_SCAN_INTERVAL + 60000) { // 1 minute tolerance
				console.log('NotificationService: Detected potential system sleep, performing catch-up scan');
				await this.handleSystemWakeUp();
			}
			
			await this.scanTasksAndBuildQueue();
			this.lastBroadScanTime = now;
		}, this.BROAD_SCAN_INTERVAL);
	}

	private startQuickCheck(): void {
		this.quickCheckInterval = setInterval(() => {
			const now = Date.now();
			const timeSinceLastCheck = now - this.lastQuickCheckTime;
			
			// Check for system sleep/wake for quick checks too
			if (timeSinceLastCheck > this.QUICK_CHECK_INTERVAL + 60000) { // 1 minute tolerance
				console.log('NotificationService: Detected potential system sleep during quick check');
				// Don't spam with catch-up, just process current queue
			}
			
			this.checkNotificationQueue();
			this.lastQuickCheckTime = now;
		}, this.QUICK_CHECK_INTERVAL);
	}

	private async scanTasksAndBuildQueue(): Promise<void> {
		// Clear existing queue and rebuild
		this.notificationQueue = [];

		// Get all tasks from the cache
		const tasks = await this.plugin.cacheManager.getAllTasks();
		const now = Date.now();
		const windowEnd = now + this.QUEUE_WINDOW;

		for (const task of tasks) {
			if (!task.reminders || task.reminders.length === 0) {
				continue;
			}

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
				if (notifyAt > now && notifyAt <= windowEnd) {
					this.notificationQueue.push({
						taskPath: task.path,
						reminder,
						notifyAt
					});
				}
			}
		}

		// Sort queue by notification time
		this.notificationQueue.sort((a, b) => a.notifyAt - b.notifyAt);
	}

	private calculateNotificationTime(task: TaskInfo, reminder: Reminder): number | null {
		try {
			if (reminder.type === 'absolute') {
				// Absolute reminder - parse the timestamp directly
				if (!reminder.absoluteTime) {
					return null;
				}
				return parseDateToLocal(reminder.absoluteTime).getTime();
			} else if (reminder.type === 'relative') {
				// Relative reminder - calculate based on anchor date
				if (!reminder.relatedTo || !reminder.offset) {
					return null;
				}

				const anchorDateStr = reminder.relatedTo === 'due' ? task.due : task.scheduled;
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
			console.error('Error calculating notification time:', error);
			return null;
		}

		return null;
	}

	private parseISO8601Duration(duration: string): number | null {
		// Parse ISO 8601 duration format (e.g., "-PT15M", "P2D", "-PT1H30M")
		const match = duration.match(/^(-?)P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
		
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
		return sign === '-' ? -totalMs : totalMs;
	}

	private checkNotificationQueue(): void {
		const now = Date.now();
		const toRemove: number[] = [];

		for (let i = 0; i < this.notificationQueue.length; i++) {
			const item = this.notificationQueue[i];
			
			if (item.notifyAt <= now) {
				// Trigger the notification
				this.triggerNotification(item);
				toRemove.push(i);
				
				// Mark as processed to avoid duplicates
				const reminderId = `${item.taskPath}-${item.reminder.id}`;
				this.processedReminders.add(reminderId);
			} else {
				// Queue is sorted, so we can break early
				break;
			}
		}

		// Remove triggered items from queue
		for (let i = toRemove.length - 1; i >= 0; i--) {
			this.notificationQueue.splice(toRemove[i], 1);
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
		const message = item.reminder.description || this.generateDefaultMessage(task, item.reminder);

		if (this.plugin.settings.notificationType === 'system') {
			// System notification
			if ('Notification' in window && Notification.permission === 'granted') {
				const notification = new Notification('TaskNotes Reminder', {
					body: message,
					tag: `tasknotes-${item.taskPath}-${item.reminder.id}`
				});

				// Open task note when notification is clicked
				notification.onclick = () => {
					this.plugin.app.workspace.openLinkText(item.taskPath, '', false);
					notification.close();
				};
			} else {
				// Fallback to in-app notice if system notifications aren't available
				this.showInAppNotice(message, item.taskPath);
			}
		} else {
			// In-app notification
			this.showInAppNotice(message, item.taskPath);
		}
	}

	private showInAppNotice(message: string, taskPath: string): void {
		const notice = new Notice(message, 0); // 0 = persistent until clicked
		
		// Add click handler to open the task
		(notice as any).noticeEl.addEventListener('click', () => {
			this.plugin.app.workspace.openLinkText(taskPath, '', false);
			notice.hide();
		});

		// Add styling to make it clickable
		(notice as any).noticeEl.style.cursor = 'pointer';
	}

	private generateDefaultMessage(task: TaskInfo, reminder: Reminder): string {
		if (reminder.type === 'absolute') {
			return `Reminder: ${task.title}`;
		} else {
			const anchor = reminder.relatedTo === 'due' ? 'due' : 'scheduled';
			const offset = this.formatDurationForDisplay(reminder.offset || '');
			
			if (offset.startsWith('-')) {
				return `${task.title} is ${anchor} in ${offset.substring(1)}`;
			} else if (offset === 'PT0S' || offset === 'PT0M') {
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

		let result = '';
		if (days > 0) {
			result = `${days} day${days > 1 ? 's' : ''}`;
		} else if (hours > 0) {
			result = `${hours} hour${hours > 1 ? 's' : ''}`;
		} else if (minutes > 0) {
			result = `${minutes} minute${minutes > 1 ? 's' : ''}`;
		} else {
			result = 'now';
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
		keysToRemove.forEach(key => this.processedReminders.delete(key));
	}

	private setupTaskUpdateListener(): void {
		this.taskUpdateListener = this.plugin.emitter.on(EVENT_TASK_UPDATED, async ({ path, originalTask, updatedTask }) => {
			if (!path || !updatedTask) {
				return;
			}

			// Clear any existing notifications for this task path
			this.removeNotificationsForTask(path);
			
			// Clear processed reminders for this task so they can trigger again if needed
			this.clearProcessedRemindersForTask(path);

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

					// Add to queue if within the next scan window
					if (notifyAt > now && notifyAt <= windowEnd) {
						this.notificationQueue.push({
							taskPath: path,
							reminder,
							notifyAt
						});
					}
				}

				// Re-sort queue by notification time
				this.notificationQueue.sort((a, b) => a.notifyAt - b.notifyAt);
			}
		});
	}

	private removeNotificationsForTask(taskPath: string): void {
		this.notificationQueue = this.notificationQueue.filter(item => item.taskPath !== taskPath);
	}

	private async handleSystemWakeUp(): Promise<void> {
		// Clear processed reminders to allow missed notifications to trigger
		// But only for reminders that are now past their notification time
		const now = Date.now();
		const keysToRemove: string[] = [];

		// Check all processed reminders and remove ones that should have triggered
		for (const key of this.processedReminders) {
			const [taskPath, reminderId] = key.split('-', 2);
			if (!taskPath || !reminderId) continue;

			// Try to get the task and check if the reminder time has passed
			try {
				const task = await this.plugin.cacheManager.getTaskInfo(taskPath);
				if (task && task.reminders) {
					const reminder = task.reminders.find(r => r.id === reminderId);
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

		keysToRemove.forEach(key => this.processedReminders.delete(key));

		// Perform a full scan to rebuild the queue with current data
		await this.scanTasksAndBuildQueue();
	}
}