import { normalizePath, TFile, Vault, App, parseYaml, stringifyYaml } from "obsidian";
import { format, isBefore, startOfDay } from "date-fns";
import { RRule } from "rrule";
import { TimeInfo, TaskInfo, TimeEntry, TimeBlock, DailyNoteFrontmatter } from "../types";
import { FieldMapper } from "../services/FieldMapper";
import { DEFAULT_FIELD_MAPPING } from "../settings/defaults";
import {
	isBeforeDateSafe,
	getTodayString,
	parseDateToLocal,
	parseDateToUTC,
	createUTCDateForRRule,
	formatDateForStorage,
	getTodayLocal,
	formatDateAsUTCString,
	hasTimeComponent,
} from "./dateUtils";
// import { RegexOptimizer } from './RegexOptimizer'; // Temporarily disabled

/**
 * Extracts frontmatter from a markdown file content using Obsidian's native parser
 */
function extractFrontmatter(content: string): any {
	if (!content.startsWith("---")) {
		return {};
	}

	const endOfFrontmatter = content.indexOf("---", 3);
	if (endOfFrontmatter === -1) {
		return {};
	}

	const frontmatterText = content.substring(3, endOfFrontmatter);
	try {
		return parseYaml(frontmatterText) || {};
	} catch (error) {
		console.error("Error parsing frontmatter:", error);
		return {};
	}
}

/**
 * Ensures a folder and its parent folders exist
 */
export async function ensureFolderExists(vault: Vault, folderPath: string): Promise<void> {
	try {
		const normalizedFolderPath = normalizePath(folderPath);
		const folders = normalizedFolderPath.split("/").filter((folder) => folder.length > 0);
		let currentPath = "";

		for (const folder of folders) {
			currentPath = currentPath ? `${currentPath}/${folder}` : folder;
			const abstractFile = vault.getAbstractFileByPath(currentPath);
			if (!abstractFile) {
				await vault.createFolder(currentPath);
			}
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const stack = error instanceof Error ? error.stack : undefined;
		console.error("Error creating folder structure:", {
			error: errorMessage,
			stack,
			folderPath,
			normalizedPath: normalizePath(folderPath),
		});

		// Create enhanced error with preserved context
		const enhancedError = new Error(`Failed to create folder "${folderPath}": ${errorMessage}`);
		if (stack) {
			enhancedError.stack = stack;
		}
		throw enhancedError;
	}
}

/**
 * Calculate duration in minutes between two ISO timestamp strings
 */
export function calculateDuration(startTime: string, endTime: string): number {
	try {
		const start = new Date(startTime);
		const end = new Date(endTime);

		// Validate dates
		if (isNaN(start.getTime()) || isNaN(end.getTime())) {
			console.error("Invalid timestamps for duration calculation:", { startTime, endTime });
			return 0;
		}

		// Ensure end is after start
		if (end <= start) {
			console.error("End time is not after start time:", { startTime, endTime });
			return 0;
		}

		// Calculate duration in minutes
		const durationMs = end.getTime() - start.getTime();
		const durationMinutes = Math.round(durationMs / (1000 * 60));

		return Math.max(0, durationMinutes); // Ensure non-negative
	} catch (error) {
		console.error("Error calculating duration:", error, { startTime, endTime });
		return 0;
	}
}

/**
 * Calculate total time spent for a task from its time entries
 */
export function calculateTotalTimeSpent(timeEntries: TimeEntry[]): number {
	if (!timeEntries || !Array.isArray(timeEntries)) {
		return 0;
	}

	return timeEntries.reduce((total, entry) => {
		// Skip entries without both start and end times
		if (!entry.startTime || !entry.endTime) {
			return total;
		}

		const duration = calculateDuration(entry.startTime, entry.endTime);
		return total + duration;
	}, 0);
}

/**
 * Get the active (running) time entry for a task
 */
export function getActiveTimeEntry(timeEntries: TimeEntry[]): TimeEntry | null {
	if (!timeEntries || !Array.isArray(timeEntries)) {
		return null;
	}

	return timeEntries.find((entry) => entry.startTime && !entry.endTime) || null;
}

/**
 * Format time in minutes to a readable string (e.g., "1h 30m", "45m")
 */
export function formatTime(minutes: number): string {
	if (!minutes || minutes === 0 || isNaN(minutes)) {
		return "0m";
	}

	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;

	if (hours === 0) return `${mins}m`;
	if (mins === 0) return `${hours}h`;
	return `${hours}h ${mins}m`;
}

/**
 * Parses a time string in the format HH:MM and returns hours and minutes
 */
export function parseTime(timeStr: string): TimeInfo | null {
	try {
		// Simple fallback parser
		const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
		if (match) {
			const hours = parseInt(match[1], 10);
			const minutes = parseInt(match[2], 10);
			if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
				return { hours, minutes };
			}
		}
		return null;
	} catch (error) {
		console.error("Error parsing time string:", error);
		return null;
	}
}

/**
 * Calculate default date based on configuration option
 */
export function calculateDefaultDate(
	defaultOption: "none" | "today" | "tomorrow" | "next-week"
): string {
	if (defaultOption === "none") {
		return "";
	}

	const today = new Date();
	let targetDate: Date;

	switch (defaultOption) {
		case "today":
			targetDate = today;
			break;
		case "tomorrow":
			targetDate = new Date(today);
			// Use local date methods for consistent date arithmetic
			targetDate.setDate(today.getDate() + 1);
			break;
		case "next-week":
			targetDate = new Date(today);
			// Use local date methods for consistent date arithmetic
			targetDate.setDate(today.getDate() + 7);
			break;
		default:
			return "";
	}

	return format(targetDate, "yyyy-MM-dd");
}

/**
 * Checks if two dates are the same day using UTC methods for consistency
 */
export function isSameDay(date1: Date, date2: Date): boolean {
	return (
		date1.getUTCFullYear() === date2.getUTCFullYear() &&
		date1.getUTCMonth() === date2.getUTCMonth() &&
		date1.getUTCDate() === date2.getUTCDate()
	);
}

/**
 * Extracts task information from a task file's content using field mapping
 */
export function extractTaskInfo(
	app: App,
	content: string,
	path: string,
	file: TFile,
	fieldMapper?: FieldMapper,
	storeTitleInFilename?: boolean
): TaskInfo | null {
	// Try to extract task info from frontmatter using native metadata cache
	const metadata = app.metadataCache.getFileCache(file);
	const yaml = metadata?.frontmatter;

	if (yaml) {
		if (fieldMapper) {
			// Use field mapper to extract task info
			const mappedTask = fieldMapper.mapFromFrontmatter(yaml, path, storeTitleInFilename);

			// Ensure required fields have defaults
			const taskInfo: TaskInfo = {
				title: mappedTask.title || "Untitled task",
				status: mappedTask.status || "open",
				priority: mappedTask.priority || "normal",
				due: mappedTask.due,
				scheduled: mappedTask.scheduled,
				path,
				archived: mappedTask.archived || false,
				tags: mappedTask.tags || [],
				contexts: mappedTask.contexts || [],
				projects: mappedTask.projects || [],
				recurrence: mappedTask.recurrence,
				complete_instances: mappedTask.complete_instances,
				completedDate: mappedTask.completedDate,
				timeEstimate: mappedTask.timeEstimate,
				timeEntries: mappedTask.timeEntries,
				dateCreated: mappedTask.dateCreated,
				dateModified: mappedTask.dateModified,
				reminders: mappedTask.reminders,
			};

			return taskInfo;
		} else {
			// Fallback to default field mapping
			const defaultMapper = new FieldMapper(DEFAULT_FIELD_MAPPING);
			const mappedTask = defaultMapper.mapFromFrontmatter(yaml, path, storeTitleInFilename);

			return {
				title: mappedTask.title || "Untitled task",
				status: mappedTask.status || "open",
				priority: mappedTask.priority || "normal",
				due: mappedTask.due,
				scheduled: mappedTask.scheduled,
				path,
				archived: mappedTask.archived || false,
				tags: mappedTask.tags || [],
				contexts: mappedTask.contexts || [],
				projects: mappedTask.projects || [],
				recurrence: mappedTask.recurrence,
				complete_instances: mappedTask.complete_instances,
				completedDate: mappedTask.completedDate,
				timeEstimate: mappedTask.timeEstimate,
				timeEntries: mappedTask.timeEntries,
				dateCreated: mappedTask.dateCreated,
				dateModified: mappedTask.dateModified,
				reminders: mappedTask.reminders,
			};
		}
	}

	// Fallback to basic info from filename
	const filename = path.split("/").pop()?.replace(".md", "") || "Untitled";
	return {
		title: filename,
		status: "open",
		priority: "normal",
		path,
		archived: false,
		reminders: [],
	};
}

export function splitFrontmatterAndBody(content: string): {
	frontmatter: string | null;
	body: string;
} {
	if (content.startsWith("---")) {
		const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
		if (match) {
			return {
				frontmatter: match[1],
				body: match[2] || "",
			};
		}
	}

	return {
		frontmatter: null,
		body: content,
	};
}

/**
 * Checks if a task is overdue (either due date or scheduled date is in the past)
 * @deprecated Use isOverdueTimeAware from dateUtils.ts instead. This function has timezone
 * bugs due to mixing UTC-anchored dates with local-timezone dates in comparisons.
 */
export function isTaskOverdue(task: { due?: string; scheduled?: string }): boolean {
	const today = getTodayLocal();

	// Check due date
	if (task.due) {
		try {
			// Use consistent date parsing for both datetime and date-only strings
			const dueDate = parseDateToUTC(task.due);
			if (isBefore(startOfDay(dueDate), startOfDay(today))) return true;
		} catch (e) {
			// If parsing fails, fall back to string comparison
			if (isBeforeDateSafe(task.due, getTodayString())) return true;
		}
	}

	// Check scheduled date
	if (task.scheduled) {
		try {
			// Use consistent date parsing for both datetime and date-only strings
			const scheduledDate = parseDateToUTC(task.scheduled);
			if (isBefore(startOfDay(scheduledDate), startOfDay(today))) return true;
		} catch (e) {
			// If parsing fails, fall back to string comparison
			if (isBeforeDateSafe(task.scheduled, getTodayString())) return true;
		}
	}

	return false;
}

/**
 * Checks if a recurring task is due on a specific date using RFC 5545 rrule
 */
export function isDueByRRule(task: TaskInfo, date: Date): boolean {
	// If no recurrence, non-recurring task is always shown
	if (!task.recurrence) {
		return true;
	}

	// If recurrence is a string (rrule format), process it
	if (typeof task.recurrence === "string") {
		try {
			// Parse DTSTART from RRULE string if present, otherwise use fallback logic
			let dtstart: Date;
			const dtstartMatch = task.recurrence.match(/DTSTART:(\d{8}(?:T\d{6}Z?)?)/);

			if (dtstartMatch) {
				// Extract DTSTART from RRULE string (supports both YYYYMMDD and YYYYMMDDTHHMMSSZ formats)
				const dtstartStr = dtstartMatch[1];
				if (dtstartStr.length === 8) {
					// YYYYMMDD format
					const year = parseInt(dtstartStr.slice(0, 4));
					const month = parseInt(dtstartStr.slice(4, 6)) - 1; // JavaScript months are 0-indexed
					const day = parseInt(dtstartStr.slice(6, 8));
					dtstart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
				} else {
					// YYYYMMDDTHHMMSSZ format - parse manually since createUTCDateForRRule expects YYYY-MM-DD
					const year = parseInt(dtstartStr.slice(0, 4));
					const month = parseInt(dtstartStr.slice(4, 6)) - 1; // JavaScript months are 0-indexed
					const day = parseInt(dtstartStr.slice(6, 8));
					const hour = parseInt(dtstartStr.slice(9, 11)) || 0;
					const minute = parseInt(dtstartStr.slice(11, 13)) || 0;
					const second = parseInt(dtstartStr.slice(13, 15)) || 0;
					dtstart = new Date(Date.UTC(year, month, day, hour, minute, second, 0));
				}
			} else {
				// Fallback to original logic for backward compatibility
				if (task.scheduled) {
					dtstart = createUTCDateForRRule(task.scheduled);
				} else if (task.dateCreated) {
					dtstart = createUTCDateForRRule(task.dateCreated);
				} else {
					// If no anchor date available, task cannot generate recurring instances
					return false;
				}
			}

			// Parse the rrule string and create RRule object
			// Remove DTSTART from the string before parsing since we set it manually
			const rruleString = task.recurrence.replace(/DTSTART:[^;]+;?/, "");
			const rruleOptions = RRule.parseString(rruleString);
			rruleOptions.dtstart = dtstart;

			const rrule = new RRule(rruleOptions);

			// Check if the target date is an occurrence
			// Use UTC date to match the dtstart timezone
			const targetDateStart = createUTCDateForRRule(formatDateAsUTCString(date));
			const occurrences = rrule.between(
				targetDateStart,
				new Date(targetDateStart.getTime() + 24 * 60 * 60 * 1000 - 1),
				true
			);

			return occurrences.length > 0;
		} catch (error) {
			console.error("Error evaluating rrule:", error, {
				task: task.title,
				recurrence: task.recurrence,
			});
			// Fall back to treating as non-recurring on error
			return true;
		}
	}

	// If recurrence is an object (legacy format), handle it inline
	// Legacy recurrence object handling
	const frequency = task.recurrence.frequency;
	const targetDate = parseDateToUTC(formatDateForStorage(date));
	const dayOfWeek = targetDate.getUTCDay();
	const dayOfMonth = targetDate.getUTCDate();
	const monthOfYear = targetDate.getUTCMonth() + 1; // JavaScript months are 0-indexed
	// Map JavaScript's day of week (0-6, where 0 is Sunday) to our day abbreviations
	const weekdayMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

	switch (frequency) {
		case "daily":
			return true;
		case "weekly": {
			// Check if the day of week is in the specified days
			const daysOfWeek = task.recurrence.days_of_week || [];
			return daysOfWeek.includes(weekdayMap[dayOfWeek]);
		}
		case "monthly":
			// Check if the day of month matches
			return dayOfMonth === task.recurrence.day_of_month;
		case "yearly": {
			// Check if it's the specific day of month in the correct month
			// First check if we have explicit month_of_year in recurrence
			if (task.recurrence.month_of_year && task.recurrence.day_of_month) {
				return (
					dayOfMonth === task.recurrence.day_of_month &&
					monthOfYear === task.recurrence.month_of_year
				);
			}
			// Fall back to using the original due date
			else if (task.due) {
				try {
					const originalDueDate = parseDateToUTC(task.due); // Safe parsing
					return (
						originalDueDate.getUTCDate() === dayOfMonth &&
						originalDueDate.getUTCMonth() === targetDate.getUTCMonth()
					);
				} catch (error) {
					console.error(`Error parsing due date ${task.due}:`, error);
					return false;
				}
			}
			return false;
		}
		default:
			return false;
	}
}

/**
 * Checks if a recurring task is due on a specific date (legacy implementation)
 * @deprecated Use isDueByRRule instead
 */
export function isRecurringTaskDueOn(task: any, date: Date): boolean {
	if (!task.recurrence) return true; // Non-recurring tasks are always shown

	// If recurrence is a string (rrule), this legacy function can't handle it
	if (typeof task.recurrence === "string") return true;

	const frequency = task.recurrence.frequency;
	const targetDate = parseDateToUTC(formatDateForStorage(date));
	const dayOfWeek = targetDate.getUTCDay();
	const dayOfMonth = targetDate.getUTCDate();
	const monthOfYear = targetDate.getUTCMonth() + 1; // JavaScript months are 0-indexed
	// Map JavaScript's day of week (0-6, where 0 is Sunday) to our day abbreviations
	const weekdayMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

	switch (frequency) {
		case "daily":
			return true;
		case "weekly": {
			// Check if the day of week is in the specified days
			const daysOfWeek = task.recurrence.days_of_week || [];
			return daysOfWeek.includes(weekdayMap[dayOfWeek]);
		}
		case "monthly":
			// Check if the day of month matches
			return dayOfMonth === task.recurrence.day_of_month;
		case "yearly":
			// Check if it's the specific day of month in the correct month
			// First check if we have explicit month_of_year in recurrence
			if (task.recurrence.month_of_year && task.recurrence.day_of_month) {
				return (
					dayOfMonth === task.recurrence.day_of_month &&
					monthOfYear === task.recurrence.month_of_year
				);
			}
			// Fall back to using the original due date
			else if (task.due) {
				try {
					const originalDueDate = parseDateToUTC(task.due); // Safe parsing
					return (
						originalDueDate.getUTCDate() === dayOfMonth &&
						originalDueDate.getUTCMonth() === targetDate.getUTCMonth()
					);
				} catch (error) {
					console.error(`Error parsing due date ${task.due}:`, error);
					return false;
				}
			}
			return false;
		default:
			return false;
	}
}

/**
 * Gets the effective status of a task, considering recurrence
 */
export function getEffectiveTaskStatus(task: any, date: Date): string {
	if (!task.recurrence) {
		return task.status || "open";
	}

	// If it has recurrence, check if it's completed for the specified date
	const dateStr = formatDateForStorage(date);
	const completedDates = Array.isArray(task.complete_instances) ? task.complete_instances : [];

	return completedDates.includes(dateStr) ? "done" : "open";
}

/**
 * Checks if a recurring task should be due on the current target date
 */
export function shouldShowRecurringTaskOnDate(task: TaskInfo, targetDate: Date): boolean {
	if (!task.recurrence) return true; // Non-recurring tasks are always shown

	return isDueByRRule(task, targetDate);
}

/**
 * Gets the completion state text for a recurring task on a specific date
 */
export function getRecurringTaskCompletionText(task: TaskInfo, targetDate: Date): string {
	if (!task.recurrence) return "";

	const dateStr = formatDateForStorage(targetDate);
	const isCompleted = task.complete_instances?.includes(dateStr) || false;

	return isCompleted ? "Completed for this date" : "Not completed for this date";
}

/**
 * Checks if a task should use recurring task UI behavior
 */
export function shouldUseRecurringTaskUI(task: TaskInfo): boolean {
	return !!task.recurrence;
}

/**
 * Generates recurring task instances within a date range using rrule
 */
export function generateRecurringInstances(task: TaskInfo, startDate: Date, endDate: Date): Date[] {
	// If no recurrence, return empty array
	if (!task.recurrence) {
		return [];
	}

	// If recurrence is a string (rrule format), use rrule
	if (typeof task.recurrence === "string") {
		try {
			// Parse DTSTART from RRULE string if present, otherwise use fallback logic
			let dtstart: Date;
			const dtstartMatch = task.recurrence.match(/DTSTART:(\d{8}(?:T\d{6}Z?)?)/);

			if (dtstartMatch) {
				// Extract DTSTART from RRULE string (supports both YYYYMMDD and YYYYMMDDTHHMMSSZ formats)
				const dtstartStr = dtstartMatch[1];
				if (dtstartStr.length === 8) {
					// YYYYMMDD format
					const year = parseInt(dtstartStr.slice(0, 4));
					const month = parseInt(dtstartStr.slice(4, 6)) - 1; // JavaScript months are 0-indexed
					const day = parseInt(dtstartStr.slice(6, 8));
					dtstart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
				} else {
					// YYYYMMDDTHHMMSSZ format - parse manually since createUTCDateForRRule expects YYYY-MM-DD
					const year = parseInt(dtstartStr.slice(0, 4));
					const month = parseInt(dtstartStr.slice(4, 6)) - 1; // JavaScript months are 0-indexed
					const day = parseInt(dtstartStr.slice(6, 8));
					const hour = parseInt(dtstartStr.slice(9, 11)) || 0;
					const minute = parseInt(dtstartStr.slice(11, 13)) || 0;
					const second = parseInt(dtstartStr.slice(13, 15)) || 0;
					dtstart = new Date(Date.UTC(year, month, day, hour, minute, second, 0));
				}
			} else {
				// Fallback to original logic for backward compatibility
				if (task.scheduled) {
					dtstart = createUTCDateForRRule(task.scheduled);
				} else if (task.dateCreated) {
					dtstart = createUTCDateForRRule(task.dateCreated);
				} else {
					// If no anchor date available, task cannot generate recurring instances
					return [];
				}
			}

			// Parse the rrule string and create RRule object
			// Remove DTSTART from the string before parsing since we set it manually
			const rruleString = task.recurrence.replace(/DTSTART:[^;]+;?/, "");
			const rruleOptions = RRule.parseString(rruleString);
			rruleOptions.dtstart = dtstart;

			const rrule = new RRule(rruleOptions);

			// Convert start and end dates to UTC to match dtstart
			// This ensures consistent timezone handling and prevents off-by-one day errors
			const utcStartDate = new Date(
				Date.UTC(
					startDate.getFullYear(),
					startDate.getMonth(),
					startDate.getDate(),
					0,
					0,
					0,
					0
				)
			);
			const utcEndDate = new Date(
				Date.UTC(
					endDate.getFullYear(),
					endDate.getMonth(),
					endDate.getDate(),
					23,
					59,
					59,
					999
				)
			);

			// Generate occurrences within the date range
			return rrule.between(utcStartDate, utcEndDate, true);
		} catch (error) {
			console.error("Error generating recurring instances:", error, {
				task: task.title,
				recurrence: task.recurrence,
			});
			// Fall back to legacy method on error
		}
	}

	// Fall back to legacy method (for object recurrence or errors)
	const instances: Date[] = [];
	const current = new Date(startDate);

	while (current <= endDate) {
		if (isDueByRRule(task, current)) {
			instances.push(new Date(current));
		}
		current.setUTCDate(current.getUTCDate() + 1);
	}

	return instances;
}

/**
 * Calculates the next uncompleted occurrence for a recurring task
 * Returns null if no future occurrences exist
 */
export function getNextUncompletedOccurrence(task: TaskInfo): Date | null {
	// If no recurrence, return null
	if (!task.recurrence) {
		return null;
	}

	try {
		// Get current date as starting point using UTC anchor principle
		const todayStr = getTodayString(); // YYYY-MM-DD format
		const today = parseDateToUTC(todayStr); // UTC anchored for consistent logic
		const endDate = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000); // Look ahead 1 year

		// Generate all occurrences from today onwards
		const occurrences = generateRecurringInstances(task, today, endDate);

		// Get completed instances as Set for faster lookup
		const completedInstances = new Set(task.complete_instances || []);

		// Find the first occurrence that hasn't been completed
		for (const occurrence of occurrences) {
			const occurrenceStr = formatDateForStorage(occurrence);
			if (!completedInstances.has(occurrenceStr)) {
				return occurrence;
			}
		}

		return null; // No future occurrences or all completed
	} catch (error) {
		console.error("Error calculating next uncompleted occurrence:", error, {
			task: task.title,
		});
		return null;
	}
}

/**
 * Updates the scheduled date of a recurring task to its next uncompleted occurrence
 * Returns the updated scheduled date or null if no next occurrence
 * @param task Task info object
 * @param maintainDueOffset Whether to maintain the due date offset (from settings)
 */
export function updateToNextScheduledOccurrence(
	task: TaskInfo,
	maintainDueOffset = true
): { scheduled: string | null; due: string | null } {
	const nextOccurrence = getNextUncompletedOccurrence(task);
	let nextScheduleStr: string | null = null;
	let nextDueStr: string | null = null;
	let nextDueDate: Date | null = null;

	if (nextOccurrence) {
		// Calculate the offset between original scheduled and due dates (only if setting is enabled)
		if (maintainDueOffset) {
			try {
				const originalScheduled = task.scheduled ? parseDateToUTC(task.scheduled) : null;
				const originalDue = task.due ? parseDateToUTC(task.due) : null;

				if (originalScheduled && originalDue) {
					// Calculate the time difference
					const offsetMs = originalDue.getTime() - originalScheduled.getTime();
					if (nextOccurrence) {
						// Apply the same offset to get the new due date
						nextDueDate = new Date(nextOccurrence.getTime() + offsetMs);
					}
				}
			} catch (error) {
				console.error("Error calculating next due date with offset:", error);
			}
		}

		// Preserve time component if original scheduled date had time
		if (task.scheduled && task.scheduled.includes("T")) {
			const timePart = task.scheduled.split("T")[1];
			nextScheduleStr = `${formatDateForStorage(nextOccurrence)}T${timePart}`;
		} else {
			nextScheduleStr = formatDateForStorage(nextOccurrence);
		}
		if (nextDueDate && task.due && task.due.includes("T")) {
			const timePart = task.due.split("T")[1];
			nextDueStr = `${formatDateForStorage(nextDueDate)}T${timePart}`;
		} else if (nextDueDate) {
			nextDueStr = formatDateForStorage(nextDueDate);
		}
	}

	return {
		scheduled: nextScheduleStr,
		due: nextDueStr,
	};
}

/**
 * Converts legacy RecurrenceInfo to RFC 5545 rrule string
 * Used for migration from old recurrence format
 */
export function convertLegacyRecurrenceToRRule(recurrence: any): string {
	if (!recurrence || !recurrence.frequency) {
		throw new Error("Invalid recurrence object");
	}

	try {
		let rruleOptions: any = {};

		switch (recurrence.frequency) {
			case "daily":
				rruleOptions.freq = RRule.DAILY;
				break;
			case "weekly":
				rruleOptions.freq = RRule.WEEKLY;
				if (recurrence.days_of_week && Array.isArray(recurrence.days_of_week)) {
					// Map day abbreviations to RRule weekday constants
					const dayMap: { [key: string]: any } = {
						sun: RRule.SU,
						mon: RRule.MO,
						tue: RRule.TU,
						wed: RRule.WE,
						thu: RRule.TH,
						fri: RRule.FR,
						sat: RRule.SA,
					};
					rruleOptions.byweekday = recurrence.days_of_week
						.map((day: string) => dayMap[day.toLowerCase()])
						.filter(Boolean);
				}
				break;
			case "monthly":
				rruleOptions.freq = RRule.MONTHLY;
				if (recurrence.day_of_month) {
					rruleOptions.bymonthday = [recurrence.day_of_month];
				}
				break;
			case "yearly":
				rruleOptions.freq = RRule.YEARLY;
				if (recurrence.month_of_year) {
					rruleOptions.bymonth = [recurrence.month_of_year];
				}
				if (recurrence.day_of_month) {
					rruleOptions.bymonthday = [recurrence.day_of_month];
				}
				break;
			default:
				throw new Error(`Unsupported frequency: ${recurrence.frequency}`);
		}

		// Create RRule object and return string representation
		const rrule = new RRule(rruleOptions);
		return rrule.toString();
	} catch (error) {
		console.error("Error converting legacy recurrence to rrule:", error, { recurrence });
		throw error;
	}
}

/**
 * Converts rrule string or RecurrenceInfo to human-readable text
 */
export function getRecurrenceDisplayText(recurrence: string | any): string {
	if (!recurrence) {
		return "";
	}

	try {
		// Handle rrule string format
		if (typeof recurrence === "string" && recurrence.includes("FREQ=")) {
			// Remove DTSTART from the string before parsing since RRule.fromString() expects only RRULE parameters
			const rruleString = recurrence.replace(/DTSTART:[^;]+;?/, "");
			const rrule = RRule.fromString(rruleString);
			return rrule.toText();
		}

		// Handle legacy RecurrenceInfo object
		if (typeof recurrence === "object" && recurrence.frequency) {
			// Convert to rrule first, then get text
			const rruleString = convertLegacyRecurrenceToRRule(recurrence);
			const rrule = RRule.fromString(rruleString);
			return rrule.toText();
		}

		// Fallback for unknown format
		return "rrule";
	} catch (error) {
		console.error("Error converting recurrence to display text:", error, { recurrence });
		return "rrule";
	}
}

/**
 * Extracts note information from a note file's content
 */
export function extractNoteInfo(
	app: App,
	content: string,
	path: string,
	file?: TFile,
	fieldMapper?: FieldMapper
): {
	title: string;
	tags: string[];
	path: string;
	createdDate?: string;
	lastModified?: number;
} | null {
	let title = path.split("/").pop()?.replace(".md", "") || "Untitled";
	let tags: string[] = [];
	let createdDate: string | undefined = undefined;
	let lastModified: number | undefined = file?.stat.mtime;

	// Try to extract note info from frontmatter using native metadata cache
	if (file) {
		const metadata = app.metadataCache.getFileCache(file);
		const frontmatter = metadata?.frontmatter;

		if (frontmatter) {
			if (frontmatter.title) {
				title = frontmatter.title;
			}

			if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
				tags = frontmatter.tags;
			}

			// Extract creation date using field mapper if available
			if (fieldMapper) {
				const dateCreatedField = fieldMapper.toUserField("dateCreated");
				if (frontmatter[dateCreatedField]) {
					createdDate = frontmatter[dateCreatedField];
				}
			} else {
				// Fallback to common field names when no field mapper provided
				if (frontmatter.dateCreated) {
					createdDate = frontmatter.dateCreated;
				} else if (frontmatter.created) {
					createdDate = frontmatter.created;
				}
			}
		}
	}

	// Look for first heading in the content as a fallback title
	if (title === "Untitled") {
		const headingMatch = content.match(/^#\s+(.+)$/m);
		if (headingMatch && headingMatch[1]) {
			title = headingMatch[1].trim();
		}
	}

	// If no creation date in frontmatter, use file creation time
	if (!createdDate && file) {
		createdDate = format(new Date(file.stat.ctime), "yyyy-MM-dd'T'HH:mm:ss");
	}

	// Normalize date format for consistent comparison
	if (createdDate) {
		// If it's just a date without time (YYYY-MM-DD), keep it as is
		if (createdDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
			// Already in the right format
		}
		// If it's a full ISO timestamp or similar, extract just the date part
		else {
			try {
				const date = parseDateToLocal(createdDate); // Use safe parsing
				if (!isNaN(date.getTime())) {
					// Format to YYYY-MM-DD to ensure consistency
					createdDate = format(date, "yyyy-MM-dd");
				}
			} catch (e) {
				console.error(`Error parsing date ${createdDate}:`, e);
			}
		}
	}

	return { title, tags, path, createdDate, lastModified };
}

/**
 * Validates a timeblock object against the expected schema
 */
export function validateTimeBlock(timeblock: any): timeblock is TimeBlock {
	if (!timeblock || typeof timeblock !== "object") {
		return false;
	}

	// Required fields
	if (!timeblock.id || typeof timeblock.id !== "string") {
		return false;
	}

	if (!timeblock.title || typeof timeblock.title !== "string") {
		return false;
	}

	if (!timeblock.startTime || typeof timeblock.startTime !== "string") {
		return false;
	}

	if (!timeblock.endTime || typeof timeblock.endTime !== "string") {
		return false;
	}

	// Validate time format (HH:MM)
	const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
	if (!timeRegex.test(timeblock.startTime) || !timeRegex.test(timeblock.endTime)) {
		return false;
	}

	// Ensure end time is after start time
	const [startHour, startMin] = timeblock.startTime.split(":").map(Number);
	const [endHour, endMin] = timeblock.endTime.split(":").map(Number);
	const startMinutes = startHour * 60 + startMin;
	const endMinutes = endHour * 60 + endMin;

	if (endMinutes <= startMinutes) {
		return false;
	}

	// Optional fields validation
	if (timeblock.attachments && !Array.isArray(timeblock.attachments)) {
		return false;
	}

	if (timeblock.attachments) {
		for (const attachment of timeblock.attachments) {
			if (typeof attachment !== "string") {
				return false;
			}
			// Optional: validate markdown link format (basic check)
			// Could be [[WikiLink]] or [Text](path) format
			if (!attachment.trim()) {
				return false;
			}
		}
	}

	if (timeblock.color && typeof timeblock.color !== "string") {
		return false;
	}

	if (timeblock.description && typeof timeblock.description !== "string") {
		return false;
	}

	return true;
}

/**
 * Extracts and validates timeblocks from daily note frontmatter
 */
export function extractTimeblocksFromNote(content: string, path: string): TimeBlock[] {
	try {
		const frontmatter = extractFrontmatter(content) as DailyNoteFrontmatter;

		if (!frontmatter || !frontmatter.timeblocks || !Array.isArray(frontmatter.timeblocks)) {
			return [];
		}

		const validTimeblocks: TimeBlock[] = [];

		for (const timeblock of frontmatter.timeblocks) {
			if (validateTimeBlock(timeblock)) {
				validTimeblocks.push(timeblock);
			} else {
				console.warn(`Invalid timeblock in ${path}:`, timeblock);
			}
		}

		return validTimeblocks;
	} catch (error) {
		console.error(`Error extracting timeblocks from ${path}:`, error);
		return [];
	}
}

/**
 * Converts a timeblock to a calendar event format
 * Uses proper timezone handling following UTC Anchor pattern to prevent date shift issues
 */
export function timeblockToCalendarEvent(timeblock: TimeBlock, date: string): any {
	// Create datetime strings that FullCalendar interprets consistently
	// Using date-only format ensures the timeblock appears on the correct day
	const startDateTime = `${date}T${timeblock.startTime}:00`;
	const endDateTime = `${date}T${timeblock.endTime}:00`;

	return {
		id: `timeblock-${timeblock.id}`,
		title: timeblock.title,
		start: startDateTime,
		end: endDateTime,
		allDay: false,
		backgroundColor: timeblock.color || "#6366f1", // Default indigo color
		borderColor: timeblock.color || "#4f46e5",
		editable: true, // Enable drag and drop for timeblocks
		eventType: "timeblock", // Mark as timeblock for FullCalendar
		extendedProps: {
			type: "timeblock",
			eventType: "timeblock",
			timeblock: timeblock,
			originalDate: date, // Store original date for tracking moves
			description: timeblock.description,
			attachments: timeblock.attachments || [],
		},
	};
}

/**
 * Generates a unique ID for a new timeblock
 */
export function generateTimeblockId(): string {
	return `tb-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Updates a timeblock in a daily note's frontmatter
 */
export async function updateTimeblockInDailyNote(
	app: any,
	timeblockId: string,
	oldDate: string,
	newDate: string,
	newStartTime: string,
	newEndTime: string
): Promise<void> {
	const { getDailyNote, getAllDailyNotes, appHasDailyNotesPluginLoaded } = await import(
		"obsidian-daily-notes-interface"
	);

	if (!appHasDailyNotesPluginLoaded()) {
		throw new Error("Daily Notes plugin is not enabled");
	}

	const allDailyNotes = getAllDailyNotes();

	// Get the timeblock from the old date
	const oldMoment = (window as any).moment(oldDate);
	const oldDailyNote = getDailyNote(oldMoment, allDailyNotes);

	if (!oldDailyNote) {
		throw new Error(`Daily note for ${oldDate} not found`);
	}

	const oldContent = await app.vault.read(oldDailyNote);
	const timeblocks = extractTimeblocksFromNote(oldContent, oldDailyNote.path);

	// Find the timeblock to move
	const timeblockIndex = timeblocks.findIndex((tb) => tb.id === timeblockId);
	if (timeblockIndex === -1) {
		throw new Error(`Timeblock ${timeblockId} not found`);
	}

	const timeblock = timeblocks[timeblockIndex];

	// If moving to same date, just update times
	if (oldDate === newDate) {
		await updateTimeblockTimes(app, oldDailyNote, timeblockId, newStartTime, newEndTime);
		return;
	}

	// Remove from old date
	await removeTimeblockFromDailyNote(app, oldDailyNote, timeblockId);

	// Add to new date with updated times
	const updatedTimeblock: TimeBlock = {
		...timeblock,
		startTime: newStartTime,
		endTime: newEndTime,
	};

	await addTimeblockToDailyNote(app, newDate, updatedTimeblock);
}

/**
 * Updates timeblock times within the same daily note
 */
async function updateTimeblockTimes(
	app: any,
	dailyNote: any,
	timeblockId: string,
	newStartTime: string,
	newEndTime: string
): Promise<void> {
	const content = await app.vault.read(dailyNote);
	const frontmatter = extractFrontmatter(content) || {};

	if (!frontmatter.timeblocks || !Array.isArray(frontmatter.timeblocks)) {
		throw new Error("No timeblocks found in frontmatter");
	}

	// Update the timeblock
	const timeblockIndex = frontmatter.timeblocks.findIndex((tb: any) => tb.id === timeblockId);
	if (timeblockIndex === -1) {
		throw new Error(`Timeblock ${timeblockId} not found`);
	}

	frontmatter.timeblocks[timeblockIndex].startTime = newStartTime;
	frontmatter.timeblocks[timeblockIndex].endTime = newEndTime;

	// Save back to file
	await updateDailyNoteFrontmatter(app, dailyNote, frontmatter, content);
}

/**
 * Removes a timeblock from a daily note
 */
async function removeTimeblockFromDailyNote(
	app: any,
	dailyNote: any,
	timeblockId: string
): Promise<void> {
	const content = await app.vault.read(dailyNote);
	const frontmatter = extractFrontmatter(content) || {};

	if (!frontmatter.timeblocks || !Array.isArray(frontmatter.timeblocks)) {
		return; // No timeblocks to remove
	}

	// Remove the timeblock
	frontmatter.timeblocks = frontmatter.timeblocks.filter((tb: any) => tb.id !== timeblockId);

	// Save back to file
	await updateDailyNoteFrontmatter(app, dailyNote, frontmatter, content);
}

/**
 * Adds a timeblock to a daily note (creating the note if needed)
 */
async function addTimeblockToDailyNote(
	app: any,
	date: string,
	timeblock: TimeBlock
): Promise<void> {
	const { createDailyNote, getDailyNote, getAllDailyNotes } = await import(
		"obsidian-daily-notes-interface"
	);

	const moment = (window as any).moment(date);
	const allDailyNotes = getAllDailyNotes();
	let dailyNote = getDailyNote(moment, allDailyNotes);

	if (!dailyNote) {
		dailyNote = await createDailyNote(moment);

		// Validate that daily note was created successfully
		if (!dailyNote) {
			throw new Error(
				"Failed to create daily note. Please check your Daily Notes plugin configuration and ensure the daily notes folder exists."
			);
		}
	}

	const content = await app.vault.read(dailyNote);
	const frontmatter = extractFrontmatter(content) || {};

	if (!frontmatter.timeblocks) {
		frontmatter.timeblocks = [];
	}

	frontmatter.timeblocks.push(timeblock);

	// Save back to file
	await updateDailyNoteFrontmatter(app, dailyNote, frontmatter, content);
}

/**
 * Updates daily note frontmatter while preserving body content
 */
async function updateDailyNoteFrontmatter(
	app: any,
	dailyNote: any,
	frontmatter: any,
	originalContent: string
): Promise<void> {
	// Get body content (everything after frontmatter)
	let bodyContent = originalContent;
	if (originalContent.startsWith("---")) {
		const endOfFrontmatter = originalContent.indexOf("---", 3);
		if (endOfFrontmatter !== -1) {
			bodyContent = originalContent.substring(endOfFrontmatter + 3);
		}
	}

	// Convert frontmatter back to YAML
	const frontmatterText = stringifyYaml(frontmatter);

	// Reconstruct file content
	const newContent = `---\n${frontmatterText}---${bodyContent}`;

	// Write back to file
	await app.vault.modify(dailyNote, newContent);

	// Native metadata cache will automatically update
}

/**
 * Filters out empty or whitespace-only project strings
 * This prevents empty projects from rendering as '+ ' in the UI
 */
export function filterEmptyProjects(projects: string[]): string[] {
	if (!projects || !Array.isArray(projects)) {
		return [];
	}

	return projects.filter((project) => {
		// Return false for null, undefined, or non-string values
		if (typeof project !== "string") {
			return false;
		}

		// Return false for empty strings or whitespace-only strings
		const trimmed = project.trim();
		if (trimmed.length === 0) {
			return false;
		}

		// Return false for quoted empty strings like '""' or "''"
		if (trimmed === '""' || trimmed === "''") {
			return false;
		}

		return true;
	});
}

/**
 * Adds DTSTART to a recurrence rule that doesn't have one, using the same fallback logic
 * as the recurrence interpretation (scheduled date first, then dateCreated)
 * Follows the UTC Anchor principle for consistent date handling
 */
export function addDTSTARTToRecurrenceRule(task: TaskInfo): string | null {
	if (!task.recurrence || typeof task.recurrence !== "string") {
		return null;
	}

	// Check if DTSTART is already present
	if (task.recurrence.includes("DTSTART:")) {
		return task.recurrence; // Already has DTSTART, return as-is
	}

	// Determine the source date string using the same fallback logic as isDueByRRule
	let sourceDateString: string;
	if (task.scheduled) {
		sourceDateString = task.scheduled;
	} else if (task.dateCreated) {
		sourceDateString = task.dateCreated;
	} else {
		// No anchor date available, cannot add DTSTART
		return null;
	}

	try {
		// Use the plugin's established date handling approach
		let dtstartValue: string;

		if (hasTimeComponent(sourceDateString)) {
			// Has time component - parse as local time for accuracy, then format for DTSTART
			const dateTime = parseDateToLocal(sourceDateString);
			const year = dateTime.getFullYear();
			const month = String(dateTime.getMonth() + 1).padStart(2, "0");
			const day = String(dateTime.getDate()).padStart(2, "0");
			const hours = String(dateTime.getHours()).padStart(2, "0");
			const minutes = String(dateTime.getMinutes()).padStart(2, "0");
			const seconds = String(dateTime.getSeconds()).padStart(2, "0");
			dtstartValue = `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
		} else {
			// Date-only - use UTC anchor principle for consistency
			const date = parseDateToUTC(sourceDateString);
			const year = date.getUTCFullYear();
			const month = String(date.getUTCMonth() + 1).padStart(2, "0");
			const day = String(date.getUTCDate()).padStart(2, "0");
			dtstartValue = `${year}${month}${day}`;
		}

		// Add DTSTART at the beginning of the recurrence rule
		return `DTSTART:${dtstartValue};${task.recurrence}`;
	} catch (error) {
		console.error("Error parsing date for DTSTART:", error, { sourceDateString });
		return null; // Return null on parsing errors
	}
}

/**
 * Adds DTSTART to a recurrence rule with a specific time from user drag interaction
 * Uses fallback logic for the date (scheduled first, then dateCreated) but applies the user-dragged time
 * Follows the UTC Anchor principle for consistent date handling
 */
export function addDTSTARTToRecurrenceRuleWithDraggedTime(
	task: TaskInfo,
	draggedStart: Date,
	allDay: boolean
): string | null {
	if (!task.recurrence || typeof task.recurrence !== "string") {
		return null;
	}

	// Check if DTSTART is already present
	if (task.recurrence.includes("DTSTART:")) {
		return task.recurrence; // Already has DTSTART, return as-is
	}

	// Determine the source date string using the same fallback logic as isDueByRRule
	let sourceDateString: string;
	if (task.scheduled) {
		sourceDateString = task.scheduled;
	} else if (task.dateCreated) {
		sourceDateString = task.dateCreated;
	} else {
		// No anchor date available, cannot add DTSTART
		return null;
	}

	try {
		// Use the plugin's established date handling approach
		let dtstartValue: string;

		if (allDay) {
			// All-day event - use date-only format from the source date (not draggedStart)
			const date = parseDateToUTC(sourceDateString);
			const year = date.getUTCFullYear();
			const month = String(date.getUTCMonth() + 1).padStart(2, "0");
			const day = String(date.getUTCDate()).padStart(2, "0");
			dtstartValue = `${year}${month}${day}`;
		} else {
			// Timed event - use date from source, time from draggedStart
			const sourceDate = parseDateToUTC(sourceDateString);
			const year = sourceDate.getUTCFullYear();
			const month = String(sourceDate.getUTCMonth() + 1).padStart(2, "0");
			const day = String(sourceDate.getUTCDate()).padStart(2, "0");

			// Use the time from the dragged position
			const hours = String(draggedStart.getHours()).padStart(2, "0");
			const minutes = String(draggedStart.getMinutes()).padStart(2, "0");
			dtstartValue = `${year}${month}${day}T${hours}${minutes}00Z`;
		}

		// Add DTSTART at the beginning of the recurrence rule
		return `DTSTART:${dtstartValue};${task.recurrence}`;
	} catch (error) {
		console.error("Error parsing date for DTSTART with dragged time:", error, {
			sourceDateString,
			draggedStart,
			allDay,
		});
		return null; // Return null on parsing errors
	}
}

/**
 * Sanitizes tag input by removing # prefixes to prevent duplicate tags
 * Handles both single tags and comma-separated lists
 */
export function sanitizeTags(tags: string): string {
	if (!tags || typeof tags !== "string") {
		return "";
	}

	return tags
		.split(",")
		.map((tag) => {
			const trimmed = tag.trim();
			// Remove # prefix if it exists
			return trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
		})
		.filter((tag) => tag.length > 0) // Remove empty tags
		.join(", ");
}
