import { normalizePath, TFile, Vault, App, parseYaml, stringifyYaml } from "obsidian";
import { format } from "date-fns";
import { TimeInfo, TaskInfo, TimeEntry, TimeBlock, DailyNoteFrontmatter } from "../types";
import { FieldMapper } from "../services/FieldMapper";
import { DEFAULT_FIELD_MAPPING } from "../settings/defaults";
import {
	addDTSTARTToRecurrenceRule as addDTSTARTToRecurrenceRuleCore,
	addDTSTARTToRecurrenceRuleWithDraggedTime as addDTSTARTToRecurrenceRuleWithDraggedTimeCore,
	generateRecurringInstances as generateRecurringInstancesCore,
	getEffectiveTaskStatus as getEffectiveTaskStatusCore,
	getNextUncompletedOccurrence as getNextUncompletedOccurrenceCore,
	getRecurrenceDisplayText as getRecurrenceDisplayTextCore,
	getRecurringTaskCompletionText as getRecurringTaskCompletionTextCore,
	isDueByRRule as isDueByRRuleCore,
	shouldShowRecurringTaskOnDate as shouldShowRecurringTaskOnDateCore,
	shouldUseRecurringTaskUI as shouldUseRecurringTaskUICore,
	updateDTSTARTInRecurrenceRule as updateDTSTARTInRecurrenceRuleCore,
	updateToNextScheduledOccurrence as updateToNextScheduledOccurrenceCore,
} from "../core/recurrence";
import {
	getTodayString,
	parseDateToLocal,
	formatDateForStorage,
	isBeforeDateSafe as _isBeforeDateSafe,
	getTodayLocal as _getTodayLocal,
} from "./dateUtils";

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

			// Check on-disk existence via adapter rather than the in-memory
			// vault cache, which can be stale during startup or after external
			// filesystem changes.
			if (await vault.adapter.exists(currentPath)) {
				continue;
			}

			try {
				await vault.createFolder(currentPath);
			} catch {
				// Race condition: another call may have created the folder
				// between our exists check and createFolder.  Only re-throw
				// if the folder genuinely doesn't exist.
				if (!(await vault.adapter.exists(currentPath))) {
					throw new Error(`Failed to create folder "${currentPath}"`);
				}
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
	storeTitleInFilename?: boolean,
	defaultStatus?: string
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
				status: mappedTask.status || (defaultStatus || "open"),
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
				status: mappedTask.status || (defaultStatus || "open"),
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
		status: defaultStatus || "open",
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
 * Resets all checked markdown checkboxes to unchecked in the given content.
 * Handles all standard markdown checkbox formats:
 * - Unordered lists: - [x], * [x], + [x]
 * - Ordered lists: 1. [x], 2. [x], etc.
 * - Various indentation levels
 * - Both [x] and [X] (case-insensitive)
 *
 * @param content The markdown content to process
 * @returns Object with the processed content and whether any changes were made
 */
export function resetMarkdownCheckboxes(content: string): {
	content: string;
	changed: boolean;
} {
	// Match checkbox list items that are checked: - [x], * [x], + [x], 1. [x], etc.
	// Pattern breakdown:
	// ^(\s*)           - Start of line, capture leading whitespace
	// ([-*+]|\d+\.)    - List marker: -, *, +, or number with dot
	// (\s+\[)          - Whitespace and opening bracket
	// [xX]             - The check mark (x or X)
	// (\].*)           - Closing bracket and rest of line
	const checkboxPattern = /^(\s*)([-*+]|\d+\.)(\s+\[)[xX](\].*)/gm;

	let changed = false;
	const result = content.replace(checkboxPattern, (match, indent, marker, beforeX, afterX) => {
		changed = true;
		return `${indent}${marker}${beforeX} ${afterX}`;
	});

	return { content: result, changed };
}

/**
 * Checks if a recurring task is due on a specific date using RFC 5545 rrule
 */
export function isDueByRRule(task: TaskInfo, date: Date): boolean {
	return isDueByRRuleCore(task, date);
}

/**
 * Gets the effective status of a task, considering recurrence
 */
export function getEffectiveTaskStatus(task: any, date: Date, completedStatus?: string): string {
	return getEffectiveTaskStatusCore(task, date, completedStatus);
}

/**
 * Checks if a recurring task should be due on the current target date
 */
export function shouldShowRecurringTaskOnDate(task: TaskInfo, targetDate: Date): boolean {
	return shouldShowRecurringTaskOnDateCore(task, targetDate);
}

/**
 * Gets the completion state text for a recurring task on a specific date
 */
export function getRecurringTaskCompletionText(task: TaskInfo, targetDate: Date): string {
	return getRecurringTaskCompletionTextCore(task, targetDate);
}

/**
 * Checks if a task should use recurring task UI behavior
 */
export function shouldUseRecurringTaskUI(task: TaskInfo): boolean {
	return shouldUseRecurringTaskUICore(task);
}

/**
 * Generates recurring task instances within a date range using rrule
 */
export function generateRecurringInstances(task: TaskInfo, startDate: Date, endDate: Date): Date[] {
	return generateRecurringInstancesCore(task, startDate, endDate);
}

/**
 * Calculates the next uncompleted occurrence for a recurring task
 * Returns null if no future occurrences exist
 */
export function getNextUncompletedOccurrence(task: TaskInfo): Date | null {
	return getNextUncompletedOccurrenceCore(task);
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
	return updateToNextScheduledOccurrenceCore(task, maintainDueOffset);
}

/**
 * Converts rrule string to human-readable text
 */
export function getRecurrenceDisplayText(recurrence: string): string {
	return getRecurrenceDisplayTextCore(recurrence);
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
export function timeblockToCalendarEvent(timeblock: TimeBlock, date: string, defaultColor = "#6366f1"): any {
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
		backgroundColor: timeblock.color || defaultColor,
		borderColor: timeblock.color || defaultColor,
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
		try {
			dailyNote = await createDailyNote(moment);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new Error(
				`Failed to create daily note: ${errorMessage}. Please check your Daily Notes plugin configuration and ensure the daily notes folder exists.`
			);
		}

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
	return addDTSTARTToRecurrenceRuleCore(task);
}

/**
 * Updates the DTSTART in a recurrence rule to a specific date
 * Used for completion-based recurrence to shift the anchor point
 * @param recurrence - The RRULE string (may or may not have DTSTART)
 * @param dateStr - Date string in YYYY-MM-DD format (or with time component)
 * @returns Updated RRULE string with new DTSTART, or null on error
 */
export function updateDTSTARTInRecurrenceRule(
	recurrence: string,
	dateStr: string
): string | null {
	return updateDTSTARTInRecurrenceRuleCore(recurrence, dateStr);
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
	return addDTSTARTToRecurrenceRuleWithDraggedTimeCore(task, draggedStart, allDay);
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

/**
 * Sanitizes a string for use as a CSS class name
 * Replaces non-alphanumeric characters (except hyphens) with hyphens and lowercases
 * This prevents DOMTokenList errors when using classList.add() with values containing spaces
 *
 * @example
 * sanitizeForCssClass("In Progress") // "in-progress"
 * sanitizeForCssClass("60-In Progress") // "60-in-progress"
 */
export function sanitizeForCssClass(value: string): string {
	if (!value || typeof value !== "string") {
		return "";
	}
	return value.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
}
