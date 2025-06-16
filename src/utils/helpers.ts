import { normalizePath, TFile, Vault } from 'obsidian';
import { format, parseISO, startOfDay, isBefore, isSameDay as isSameDayFns } from 'date-fns';
import { TimeInfo, TaskInfo, TimeEntry } from '../types';
import { YAMLCache } from './YAMLCache';
import { FieldMapper } from '../services/FieldMapper';
import { DEFAULT_FIELD_MAPPING } from '../settings/settings';
import { isBeforeDateSafe, getTodayString, parseDate, isSameDateSafe } from './dateUtils';
// import { RegexOptimizer } from './RegexOptimizer'; // Temporarily disabled

/**
 * Creates a debounced version of a function
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    
    return function debounced(...args: Parameters<T>) {
        if (timeout) {
            clearTimeout(timeout);
        }
        
        timeout = setTimeout(() => {
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
	content: string, 
	path: string, 
	fieldMapper?: FieldMapper
): TaskInfo | null {
	
	// Try to extract task info from frontmatter
	if (content.startsWith('---')) {
		const endOfFrontmatter = content.indexOf('---', 3);
		if (endOfFrontmatter !== -1) {
			// Use our cached YAML parser
			const yaml = YAMLCache.extractFrontmatter(content, path);
			
			if (yaml) {
				if (fieldMapper) {
					// Use field mapper to extract task info
					const mappedTask = fieldMapper.mapFromFrontmatter(yaml, path);
					
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
					const mappedTask = defaultMapper.mapFromFrontmatter(yaml, path);
					
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
 * Checks if a recurring task is due on a specific date
 */
export function isRecurringTaskDueOn(task: any, date: Date): boolean {
	if (!task.recurrence) return true; // Non-recurring tasks are always shown
	
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
		case 'weekly':
			// Check if the day of week is in the specified days
			const daysOfWeek = task.recurrence.days_of_week || [];
			return daysOfWeek.includes(weekdayMap[dayOfWeek]);
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
	
	return isRecurringTaskDueOn(task, targetDate);
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
 * Extracts note information from a note file's content
 */
export function extractNoteInfo(content: string, path: string, file?: TFile): {title: string, tags: string[], path: string, createdDate?: string, lastModified?: number} | null {
	let title = path.split('/').pop()?.replace('.md', '') || 'Untitled';
	let tags: string[] = [];
	let createdDate: string | undefined = undefined;
	let lastModified: number | undefined = file?.stat.mtime;
	
	// Try to extract note info from frontmatter
	if (content.startsWith('---')) {
		// Use our cached YAML parser
		const yaml = YAMLCache.extractFrontmatter(content, path);
		
		if (yaml) {
			if (yaml.title) {
				title = yaml.title;
			}
			
			if (yaml.tags && Array.isArray(yaml.tags)) {
				tags = yaml.tags;
			}
			
			// Extract creation date from dateCreated or date field
			if (yaml.dateCreated) {
				createdDate = yaml.dateCreated;
			} else if (yaml.date) {
				createdDate = yaml.date;
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

