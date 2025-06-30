import { normalizePath, TFile, Vault, App, parseYaml, stringifyYaml } from 'obsidian';
import { format } from 'date-fns';
import { RRule } from 'rrule';
import { TimeInfo, TaskInfo, TimeEntry, TimeBlock, DailyNoteFrontmatter } from '../types';
import { FieldMapper } from '../services/FieldMapper';
import { DEFAULT_FIELD_MAPPING } from '../settings/settings';
import { isBeforeDateSafe, getTodayString, parseDate, createUTCDateForRRule } from './dateUtils';
// import { RegexOptimizer } from './RegexOptimizer'; // Temporarily disabled

/**
 * Extracts frontmatter from a markdown file content using Obsidian's native parser
 */
function extractFrontmatter(content: string): any {
	if (!content.startsWith('---')) {
		return {};
	}
	
	const endOfFrontmatter = content.indexOf('---', 3);
	if (endOfFrontmatter === -1) {
		return {};
	}
	
	const frontmatterText = content.substring(3, endOfFrontmatter);
	try {
		return parseYaml(frontmatterText) || {};
	} catch (error) {
		console.error('Error parsing frontmatter:', error);
		return {};
	}
}

/**
 * Creates a debounced version of a function
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: number | null = null;
    
    return function debounced(...args: Parameters<T>) {
        if (timeout) {
            window.clearTimeout(timeout);
        }
        
        timeout = window.setTimeout(() => {
            func(...args);
            timeout = null;
        }, wait);
    };
}

/**
 * Ensures a folder and its parent folders exist
 */
export async function ensureFolderExists(vault: Vault, folderPath: string): Promise<void> {
	try {
		const normalizedFolderPath = normalizePath(folderPath);
		const folders = normalizedFolderPath.split('/').filter(folder => folder.length > 0);
		let currentPath = '';
		
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
		console.error('Error creating folder structure:', {
			error: errorMessage,
			stack,
			folderPath,
			normalizedPath: normalizePath(folderPath)
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
			console.error('Invalid timestamps for duration calculation:', { startTime, endTime });
			return 0;
		}
		
		// Ensure end is after start
		if (end <= start) {
			console.error('End time is not after start time:', { startTime, endTime });
			return 0;
		}
		
		// Calculate duration in minutes
		const durationMs = end.getTime() - start.getTime();
		const durationMinutes = Math.round(durationMs / (1000 * 60));
		
		return Math.max(0, durationMinutes); // Ensure non-negative
	} catch (error) {
		console.error('Error calculating duration:', error, { startTime, endTime });
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
	
	return timeEntries.find(entry => entry.startTime && !entry.endTime) || null;
}

/**
 * Format time in minutes to a readable string (e.g., "1h 30m", "45m")
 */
export function formatTime(minutes: number): string {
	if (!minutes || minutes === 0 || isNaN(minutes)) {
		return '0m';
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
		console.error('Error parsing time string:', error);
		return null;
	}
}




/**
 * Generate task body content from template, similar to daily note templates
 */
export function generateTaskBodyFromTemplate(templateContent: string, taskData: any): string {
	return processTaskTemplateVariables(templateContent, taskData);
}

/**
 * Process task template variables like {{title}}, {{priority}}, {{status}}, etc.
 */
function processTaskTemplateVariables(template: string, taskData: any): string {
	let result = template;
	const now = new Date();
	
	// {{title}} - Task title
	result = result.replace(/\{\{title\}\}/g, taskData.title || '');
	
	// {{priority}} - Task priority
	result = result.replace(/\{\{priority\}\}/g, taskData.priority || '');
	
	// {{status}} - Task status
	result = result.replace(/\{\{status\}\}/g, taskData.status || '');
	
	// {{contexts}} - Task contexts (comma-separated)
	const contexts = Array.isArray(taskData.contexts) ? taskData.contexts.join(', ') : (taskData.contexts || '');
	result = result.replace(/\{\{contexts\}\}/g, contexts);
	
	// {{tags}} - Task tags (comma-separated)
	const tags = Array.isArray(taskData.tags) ? taskData.tags.join(', ') : (taskData.tags || '');
	result = result.replace(/\{\{tags\}\}/g, tags);
	
	// {{timeEstimate}} - Time estimate in minutes
	result = result.replace(/\{\{timeEstimate\}\}/g, taskData.timeEstimate?.toString() || '');
	
	// {{dueDate}} - Due date
	result = result.replace(/\{\{dueDate\}\}/g, taskData.dueDate || '');
	
	// {{scheduledDate}} - Scheduled date
	result = result.replace(/\{\{scheduledDate\}\}/g, taskData.scheduledDate || '');
	
	// {{details}} - User-provided details/description
	result = result.replace(/\{\{details\}\}/g, taskData.details || '');
	
	// {{parentNote}} - Parent note name/path where task was created
	result = result.replace(/\{\{parentNote\}\}/g, taskData.parentNote || '');
	
	// {{date}} - Current date (basic format only)
	result = result.replace(/\{\{date\}\}/g, format(now, 'yyyy-MM-dd'));
	
	// {{time}} - Current time (basic format only)
	result = result.replace(/\{\{time\}\}/g, format(now, 'HH:mm'));
	
	return result;
}

/**
 * Calculate default date based on configuration option
 */
export function calculateDefaultDate(defaultOption: 'none' | 'today' | 'tomorrow' | 'next-week'): string {
	if (defaultOption === 'none') {
		return '';
	}
	
	const today = new Date();
	let targetDate: Date;
	
	switch (defaultOption) {
		case 'today':
			targetDate = today;
			break;
		case 'tomorrow':
			targetDate = new Date(today);
			targetDate.setDate(today.getDate() + 1);
			break;
		case 'next-week':
			targetDate = new Date(today);
			targetDate.setDate(today.getDate() + 7);
			break;
		default:
			return '';
	}
	
	return format(targetDate, 'yyyy-MM-dd');
}

/**
 * Checks if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
	return date1.getFullYear() === date2.getFullYear() &&
		date1.getMonth() === date2.getMonth() &&
		date1.getDate() === date2.getDate();
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
				title: mappedTask.title || 'Untitled task',
				status: mappedTask.status || 'open',
				priority: mappedTask.priority || 'normal',
				due: mappedTask.due,
				scheduled: mappedTask.scheduled,
				path,
				archived: mappedTask.archived || false,
				tags: mappedTask.tags || [],
				contexts: mappedTask.contexts || [],
				recurrence: mappedTask.recurrence,
				complete_instances: mappedTask.complete_instances,
				completedDate: mappedTask.completedDate,
				timeEstimate: mappedTask.timeEstimate,
				timeEntries: mappedTask.timeEntries,
				dateCreated: mappedTask.dateCreated,
				dateModified: mappedTask.dateModified
			};
			
			return taskInfo;
		} else {
			// Fallback to default field mapping
			const defaultMapper = new FieldMapper(DEFAULT_FIELD_MAPPING);
			const mappedTask = defaultMapper.mapFromFrontmatter(yaml, path, storeTitleInFilename);
			
			return {
				title: mappedTask.title || 'Untitled task',
				status: mappedTask.status || 'open',
				priority: mappedTask.priority || 'normal',
				due: mappedTask.due,
				scheduled: mappedTask.scheduled,
				path,
				archived: mappedTask.archived || false,
				tags: mappedTask.tags || [],
				contexts: mappedTask.contexts || [],
				recurrence: mappedTask.recurrence,
				complete_instances: mappedTask.complete_instances,
				completedDate: mappedTask.completedDate,
				timeEstimate: mappedTask.timeEstimate,
				timeEntries: mappedTask.timeEntries,
				dateCreated: mappedTask.dateCreated,
				dateModified: mappedTask.dateModified
			};
		}
	}
	
	// Fallback to basic info from filename
	const filename = path.split('/').pop()?.replace('.md', '') || 'Untitled';
	return {
		title: filename,
		status: 'open',
		priority: 'normal',
		path,
		archived: false
	};
}

/**
 * Checks if a task is overdue (either due date or scheduled date is in the past)
 */
export function isTaskOverdue(task: {due?: string; scheduled?: string}): boolean {
	const today = getTodayString();
	
	// Check due date
	if (task.due) {
		if (isBeforeDateSafe(task.due, today)) return true;
	}
	
	// Check scheduled date
	if (task.scheduled) {
		if (isBeforeDateSafe(task.scheduled, today)) return true;
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
	if (typeof task.recurrence === 'string') {
		try {
			// Determine the anchor date (dtstart) for the recurrence
			// Use UTC date to avoid timezone issues with day-of-week calculations
			let dtstart: Date;
			if (task.scheduled) {
				dtstart = createUTCDateForRRule(task.scheduled);
			} else if (task.dateCreated) {
				dtstart = createUTCDateForRRule(task.dateCreated);
			} else {
				// If no anchor date available, task cannot generate recurring instances
				return false;
			}
			
			// Parse the rrule string and create RRule object
			// The rrule string should contain all recurrence information including any UNTIL dates
			const rruleOptions = RRule.parseString(task.recurrence);
			rruleOptions.dtstart = dtstart;
			
			const rrule = new RRule(rruleOptions);
			
			// Check if the target date is an occurrence
			// Use UTC date to match the dtstart timezone
			const targetDateStart = createUTCDateForRRule(format(date, 'yyyy-MM-dd'));
			const occurrences = rrule.between(targetDateStart, new Date(targetDateStart.getTime() + 24 * 60 * 60 * 1000 - 1), true);
			
			return occurrences.length > 0;
		} catch (error) {
			console.error('Error evaluating rrule:', error, { task: task.title, recurrence: task.recurrence });
			// Fall back to treating as non-recurring on error
			return true;
		}
	}
	
	// If recurrence is an object (legacy format), handle it inline
	// Legacy recurrence object handling
	const frequency = task.recurrence.frequency;
	const targetDate = parseDate(format(date, 'yyyy-MM-dd'));
	const dayOfWeek = targetDate.getDay();
	const dayOfMonth = targetDate.getDate();
	const monthOfYear = targetDate.getMonth() + 1; // JavaScript months are 0-indexed
	// Map JavaScript's day of week (0-6, where 0 is Sunday) to our day abbreviations
	const weekdayMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
	
	switch (frequency) {
		case 'daily':
			return true;
		case 'weekly': {
			// Check if the day of week is in the specified days
			const daysOfWeek = task.recurrence.days_of_week || [];
			return daysOfWeek.includes(weekdayMap[dayOfWeek]);
		}
		case 'monthly':
			// Check if the day of month matches
			return dayOfMonth === task.recurrence.day_of_month;
		case 'yearly': {
			// Check if it's the specific day of month in the correct month
			// First check if we have explicit month_of_year in recurrence
			if (task.recurrence.month_of_year && task.recurrence.day_of_month) {
				return dayOfMonth === task.recurrence.day_of_month && 
						monthOfYear === task.recurrence.month_of_year;
			}
			// Fall back to using the original due date
			else if (task.due) {
				try {
					const originalDueDate = parseDate(task.due); // Safe parsing
					return originalDueDate.getDate() === dayOfMonth && 
							originalDueDate.getMonth() === targetDate.getMonth();
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
	if (typeof task.recurrence === 'string') return true;
	
	const frequency = task.recurrence.frequency;
	const targetDate = parseDate(format(date, 'yyyy-MM-dd'));
	const dayOfWeek = targetDate.getDay();
	const dayOfMonth = targetDate.getDate();
	const monthOfYear = targetDate.getMonth() + 1; // JavaScript months are 0-indexed
	// Map JavaScript's day of week (0-6, where 0 is Sunday) to our day abbreviations
	const weekdayMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
	
	switch (frequency) {
		case 'daily':
			return true;
		case 'weekly': {
			// Check if the day of week is in the specified days
			const daysOfWeek = task.recurrence.days_of_week || [];
			return daysOfWeek.includes(weekdayMap[dayOfWeek]);
		}
		case 'monthly':
			// Check if the day of month matches
			return dayOfMonth === task.recurrence.day_of_month;
		case 'yearly':
			// Check if it's the specific day of month in the correct month
			// First check if we have explicit month_of_year in recurrence
			if (task.recurrence.month_of_year && task.recurrence.day_of_month) {
				return dayOfMonth === task.recurrence.day_of_month && 
					monthOfYear === task.recurrence.month_of_year;
			}
			// Fall back to using the original due date
			else if (task.due) {
				try {
					const originalDueDate = parseDate(task.due); // Safe parsing
					return originalDueDate.getDate() === dayOfMonth && 
						originalDueDate.getMonth() === targetDate.getMonth();
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
		return task.status || 'open';
	}
	
	// If it has recurrence, check if it's completed for the specified date
	const dateStr = format(date, 'yyyy-MM-dd');
	const completedDates = Array.isArray(task.complete_instances) ? task.complete_instances : [];
	
	return completedDates.includes(dateStr) ? 'done' : 'open';
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
	if (!task.recurrence) return '';
	
	const dateStr = format(targetDate, 'yyyy-MM-dd');
	const isCompleted = task.complete_instances?.includes(dateStr) || false;
	
	return isCompleted ? 'Completed for this date' : 'Not completed for this date';
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
	if (typeof task.recurrence === 'string') {
		try {
			// Determine the anchor date (dtstart) for the recurrence
			// Use UTC date to avoid timezone issues with day-of-week calculations
			let dtstart: Date;
			if (task.scheduled) {
				dtstart = createUTCDateForRRule(task.scheduled);
			} else if (task.dateCreated) {
				dtstart = createUTCDateForRRule(task.dateCreated);
			} else {
				// If no anchor date available, task cannot generate recurring instances
				return [];
			}
			
			// Parse the rrule string and create RRule object
			// The rrule string should contain all recurrence information including any UNTIL dates
			const rruleOptions = RRule.parseString(task.recurrence);
			rruleOptions.dtstart = dtstart;
			
			const rrule = new RRule(rruleOptions);
			
			// Generate occurrences within the date range
			return rrule.between(startDate, endDate, true);
		} catch (error) {
			console.error('Error generating recurring instances:', error, { task: task.title, recurrence: task.recurrence });
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
		current.setDate(current.getDate() + 1);
	}
	
	return instances;
}

/**
 * Converts legacy RecurrenceInfo to RFC 5545 rrule string
 * Used for migration from old recurrence format
 */
export function convertLegacyRecurrenceToRRule(recurrence: any): string {
	if (!recurrence || !recurrence.frequency) {
		throw new Error('Invalid recurrence object');
	}
	
	try {
		let rruleOptions: any = {};
		
		switch (recurrence.frequency) {
			case 'daily':
				rruleOptions.freq = RRule.DAILY;
				break;
			case 'weekly':
				rruleOptions.freq = RRule.WEEKLY;
				if (recurrence.days_of_week && Array.isArray(recurrence.days_of_week)) {
					// Map day abbreviations to RRule weekday constants
					const dayMap: { [key: string]: any } = {
						'sun': RRule.SU,
						'mon': RRule.MO,
						'tue': RRule.TU,
						'wed': RRule.WE,
						'thu': RRule.TH,
						'fri': RRule.FR,
						'sat': RRule.SA
					};
					rruleOptions.byweekday = recurrence.days_of_week.map((day: string) => dayMap[day.toLowerCase()]).filter(Boolean);
				}
				break;
			case 'monthly':
				rruleOptions.freq = RRule.MONTHLY;
				if (recurrence.day_of_month) {
					rruleOptions.bymonthday = [recurrence.day_of_month];
				}
				break;
			case 'yearly':
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
		console.error('Error converting legacy recurrence to rrule:', error, { recurrence });
		throw error;
	}
}

/**
 * Converts rrule string or RecurrenceInfo to human-readable text
 */
export function getRecurrenceDisplayText(recurrence: string | any): string {
	if (!recurrence) {
		return '';
	}
	
	try {
		// Handle rrule string format
		if (typeof recurrence === 'string' && recurrence.includes('FREQ=')) {
			const rrule = RRule.fromString(recurrence);
			return rrule.toText();
		}
		
		// Handle legacy RecurrenceInfo object
		if (typeof recurrence === 'object' && recurrence.frequency) {
			// Convert to rrule first, then get text
			const rruleString = convertLegacyRecurrenceToRRule(recurrence);
			const rrule = RRule.fromString(rruleString);
			return rrule.toText();
		}
		
		// Fallback for unknown format
		return 'rrule';
	} catch (error) {
		console.error('Error converting recurrence to display text:', error, { recurrence });
		return 'rrule';
	}
}

/**
 * Extracts note information from a note file's content
 */
export function extractNoteInfo(app: App, content: string, path: string, file?: TFile): {title: string, tags: string[], path: string, createdDate?: string, lastModified?: number} | null {
	let title = path.split('/').pop()?.replace('.md', '') || 'Untitled';
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
			
			// Extract creation date from dateCreated or date field
			if (frontmatter.dateCreated) {
				createdDate = frontmatter.dateCreated;
			} else if (frontmatter.date) {
				createdDate = frontmatter.date;
			}
		}
	}
	
	// Look for first heading in the content as a fallback title
	if (title === 'Untitled') {
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
				const date = parseDate(createdDate); // Use safe parsing
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
	if (!timeblock || typeof timeblock !== 'object') {
		return false;
	}
	
	// Required fields
	if (!timeblock.id || typeof timeblock.id !== 'string') {
		return false;
	}
	
	if (!timeblock.title || typeof timeblock.title !== 'string') {
		return false;
	}
	
	if (!timeblock.startTime || typeof timeblock.startTime !== 'string') {
		return false;
	}
	
	if (!timeblock.endTime || typeof timeblock.endTime !== 'string') {
		return false;
	}
	
	// Validate time format (HH:MM)
	const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
	if (!timeRegex.test(timeblock.startTime) || !timeRegex.test(timeblock.endTime)) {
		return false;
	}
	
	// Ensure end time is after start time
	const [startHour, startMin] = timeblock.startTime.split(':').map(Number);
	const [endHour, endMin] = timeblock.endTime.split(':').map(Number);
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
			if (typeof attachment !== 'string') {
				return false;
			}
			// Optional: validate markdown link format (basic check)
			// Could be [[WikiLink]] or [Text](path) format
			if (!attachment.trim()) {
				return false;
			}
		}
	}
	
	if (timeblock.color && typeof timeblock.color !== 'string') {
		return false;
	}
	
	if (timeblock.description && typeof timeblock.description !== 'string') {
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
 */
export function timeblockToCalendarEvent(timeblock: TimeBlock, date: string): any {
	const startDateTime = `${date}T${timeblock.startTime}:00`;
	const endDateTime = `${date}T${timeblock.endTime}:00`;
	
	return {
		id: `timeblock-${timeblock.id}`,
		title: timeblock.title,
		start: startDateTime,
		end: endDateTime,
		allDay: false,
		backgroundColor: timeblock.color || '#6366f1', // Default indigo color
		borderColor: timeblock.color || '#4f46e5',
		editable: true, // Enable drag and drop for timeblocks
		eventType: 'timeblock', // Mark as timeblock for FullCalendar
		extendedProps: {
			type: 'timeblock',
			eventType: 'timeblock',
			timeblock: timeblock,
			originalDate: date, // Store original date for tracking moves
			description: timeblock.description,
			attachments: timeblock.attachments || []
		}
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
	const { 
		getDailyNote, 
		getAllDailyNotes, 
		appHasDailyNotesPluginLoaded 
	} = await import('obsidian-daily-notes-interface');
	
	if (!appHasDailyNotesPluginLoaded()) {
		throw new Error('Daily Notes plugin is not enabled');
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
	const timeblockIndex = timeblocks.findIndex(tb => tb.id === timeblockId);
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
		endTime: newEndTime
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
		throw new Error('No timeblocks found in frontmatter');
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
async function removeTimeblockFromDailyNote(app: any, dailyNote: any, timeblockId: string): Promise<void> {
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
async function addTimeblockToDailyNote(app: any, date: string, timeblock: TimeBlock): Promise<void> {
	const { createDailyNote, getDailyNote, getAllDailyNotes } = 
		await import('obsidian-daily-notes-interface');
	
	const moment = (window as any).moment(date);
	const allDailyNotes = getAllDailyNotes();
	let dailyNote = getDailyNote(moment, allDailyNotes);
	
	if (!dailyNote) {
		dailyNote = await createDailyNote(moment);
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
async function updateDailyNoteFrontmatter(app: any, dailyNote: any, frontmatter: any, originalContent: string): Promise<void> {
	
	// Get body content (everything after frontmatter)
	let bodyContent = originalContent;
	if (originalContent.startsWith('---')) {
		const endOfFrontmatter = originalContent.indexOf('---', 3);
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

