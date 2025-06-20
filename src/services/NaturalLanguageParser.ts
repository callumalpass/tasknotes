import { format, parse, addDays, addWeeks, addMonths, addYears, startOfDay, isValid } from 'date-fns';
import { StatusConfig, PriorityConfig } from '../types';

export interface ParsedTaskData {
	title: string;
	details?: string;
	dueDate?: string;
	scheduledDate?: string;
	dueTime?: string;
	scheduledTime?: string;
	priority?: string;
	status?: string;
	tags: string[];
	contexts: string[];
	recurrence?: string;
	daysOfWeek?: string[];
	estimate?: number;
}

/**
 * Service for parsing natural language input into structured task data
 */
export class NaturalLanguageParser {
	private statusConfigs: StatusConfig[];
	private priorityConfigs: PriorityConfig[];

	constructor(statusConfigs: StatusConfig[] = [], priorityConfigs: PriorityConfig[] = []) {
		this.statusConfigs = statusConfigs;
		this.priorityConfigs = priorityConfigs;
	}
	
	/**
	 * Parse natural language input into structured task data
	 */
	parseInput(input: string): ParsedTaskData {
		const trimmedInput = input.trim();
		const result: ParsedTaskData = {
			title: '',
			tags: [],
			contexts: []
		};

		// Split on first line break - first line is parsed, rest becomes details
		const firstLineBreak = trimmedInput.indexOf('\n');
		let workingText: string;
		let details: string = '';

		if (firstLineBreak !== -1) {
			workingText = trimmedInput.substring(0, firstLineBreak).trim();
			details = trimmedInput.substring(firstLineBreak + 1).trim();
		} else {
			workingText = trimmedInput;
		}

		// Extract tags (#tag)
		const tagMatches = workingText.match(/#\w+/g);
		if (tagMatches) {
			result.tags = tagMatches.map(tag => tag.substring(1));
			workingText = workingText.replace(/#\w+/g, '').trim();
		}

		// Extract contexts (@context)
		const contextMatches = workingText.match(/@\w+/g);
		if (contextMatches) {
			result.contexts = contextMatches.map(context => context.substring(1));
			workingText = workingText.replace(/@\w+/g, '').trim();
		}

		// Extract priority
		const priorityResult = this.extractPriority(workingText);
		if (priorityResult.priority) {
			result.priority = priorityResult.priority;
			workingText = priorityResult.remainingText;
		}

		// Extract status
		const statusResult = this.extractStatus(workingText);
		if (statusResult.status) {
			result.status = statusResult.status;
			workingText = statusResult.remainingText;
		}

		// Extract recurrence
		const recurrenceResult = this.extractRecurrence(workingText);
		if (recurrenceResult.recurrence) {
			result.recurrence = recurrenceResult.recurrence;
			workingText = recurrenceResult.remainingText;
		}
		if (recurrenceResult.daysOfWeek) {
			result.daysOfWeek = recurrenceResult.daysOfWeek;
		}

		// Extract time estimate
		const estimateResult = this.extractTimeEstimate(workingText);
		if (estimateResult.estimate) {
			result.estimate = estimateResult.estimate;
			workingText = estimateResult.remainingText;
		}

		// Extract dates and times
		const dateTimeResult = this.extractDatesAndTimes(workingText);
		Object.assign(result, dateTimeResult.dateTime);
		workingText = dateTimeResult.remainingText;

		// Whatever remains is the title
		result.title = workingText.trim();

		// Add details if there were multiple lines
		if (details) {
			result.details = details;
		}

		return result;
	}

	/**
	 * Extract priority from text
	 */
	private extractPriority(text: string): { priority?: string; remainingText: string } {
		// Build patterns from user's custom priority configurations
		const priorityPatterns: { regex: RegExp; value: string }[] = [];
		
		// Add patterns for each custom priority
		for (const priorityConfig of this.priorityConfigs) {
			// Match exact priority value
			priorityPatterns.push({
				regex: new RegExp(`\\b${this.escapeRegex(priorityConfig.value)}\\b`, 'i'),
				value: priorityConfig.value
			});
			
			// Match priority label
			priorityPatterns.push({
				regex: new RegExp(`\\b${this.escapeRegex(priorityConfig.label)}\\b`, 'i'),
				value: priorityConfig.value
			});
		}

		// Fallback patterns if no custom priorities are configured
		if (priorityPatterns.length === 0) {
			priorityPatterns.push(
				{ regex: /\b(urgent|critical|highest|emergency)\b/i, value: 'urgent' },
				{ regex: /\b(high|important|high priority)\b/i, value: 'high' },
				{ regex: /\b(medium|normal|medium priority)\b/i, value: 'normal' },
				{ regex: /\b(low|low priority|minor)\b/i, value: 'low' }
			);
		}

		for (const pattern of priorityPatterns) {
			const match = text.match(pattern.regex);
			if (match) {
				return {
					priority: pattern.value,
					remainingText: text.replace(pattern.regex, '').trim()
				};
			}
		}

		return { remainingText: text };
	}

	/**
	 * Extract status from text
	 */
	private extractStatus(text: string): { status?: string; remainingText: string } {
		// Build patterns from user's custom status configurations
		const statusPatterns: { regex: RegExp; value: string }[] = [];
		
		// Add patterns for each custom status
		for (const statusConfig of this.statusConfigs) {
			// Match exact status value
			statusPatterns.push({
				regex: new RegExp(`\\b${this.escapeRegex(statusConfig.value)}\\b`, 'i'),
				value: statusConfig.value
			});
			
			// Match status label
			statusPatterns.push({
				regex: new RegExp(`\\b${this.escapeRegex(statusConfig.label)}\\b`, 'i'),
				value: statusConfig.value
			});
		}

		// Fallback patterns if no custom statuses are configured
		if (statusPatterns.length === 0) {
			statusPatterns.push(
				{ regex: /\b(todo|to do|open|new)\b/i, value: 'open' },
				{ regex: /\b(in progress|in-progress|working|started|doing)\b/i, value: 'in-progress' },
				{ regex: /\b(done|completed|finished|complete)\b/i, value: 'done' },
				{ regex: /\b(cancelled|canceled|dropped)\b/i, value: 'cancelled' },
				{ regex: /\b(waiting|blocked|on hold)\b/i, value: 'waiting' }
			);
		}

		for (const pattern of statusPatterns) {
			const match = text.match(pattern.regex);
			if (match) {
				return {
					status: pattern.value,
					remainingText: text.replace(pattern.regex, '').trim()
				};
			}
		}

		return { remainingText: text };
	}

	/**
	 * Extract recurrence from text
	 */
	private extractRecurrence(text: string): { recurrence?: string; daysOfWeek?: string[]; remainingText: string } {
		const recurrencePatterns = [
			{ regex: /\b(daily|every day|each day)\b/i, value: 'daily' },
			{ regex: /\b(weekly|every week|each week)\b/i, value: 'weekly' },
			{ regex: /\b(monthly|every month|each month)\b/i, value: 'monthly' },
			{ regex: /\b(yearly|annually|every year|each year)\b/i, value: 'yearly' }
		];

		// Check for specific day patterns first
		const dayPattern = /\bevery (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
		const dayMatch = text.match(dayPattern);
		if (dayMatch) {
			const dayName = dayMatch[1].toLowerCase();
			const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
			return {
				recurrence: 'weekly',
				daysOfWeek: [capitalizedDay],
				remainingText: text.replace(dayPattern, '').trim()
			};
		}

		// Check for short day patterns (mondays, tuesdays, etc.)
		const shortDayPattern = /\b(mon|tue|wed|thu|fri|sat|sun)days?\b/i;
		const shortDayMatch = text.match(shortDayPattern);
		if (shortDayMatch) {
			const shortDay = shortDayMatch[1].toLowerCase();
			const dayMapping: Record<string, string> = {
				'mon': 'Monday',
				'tue': 'Tuesday', 
				'wed': 'Wednesday',
				'thu': 'Thursday',
				'fri': 'Friday',
				'sat': 'Saturday',
				'sun': 'Sunday'
			};
			return {
				recurrence: 'weekly',
				daysOfWeek: [dayMapping[shortDay]],
				remainingText: text.replace(shortDayPattern, '').trim()
			};
		}

		// Check for general recurrence patterns
		for (const pattern of recurrencePatterns) {
			const match = text.match(pattern.regex);
			if (match) {
				return {
					recurrence: pattern.value,
					remainingText: text.replace(pattern.regex, '').trim()
				};
			}
		}

		return { remainingText: text };
	}

	/**
	 * Extract time estimate from text
	 */
	private extractTimeEstimate(text: string): { estimate?: number; remainingText: string } {
		const estimatePatterns = [
			{ regex: /\b(\d+)\s*(?:min|mins|minute|minutes)\b/i, multiplier: 1 },
			{ regex: /\b(\d+)\s*(?:hr|hrs|hour|hours)\b/i, multiplier: 60 },
			{ regex: /\b(\d+)\s*(?:h)\b/i, multiplier: 60 },
			{ regex: /\b(\d+)h\s*(\d+)m\b/i, special: 'hourMin' }
		];

		for (const pattern of estimatePatterns) {
			const match = text.match(pattern.regex);
			if (match) {
				let estimate: number;
				if (pattern.special === 'hourMin') {
					estimate = parseInt(match[1]) * 60 + parseInt(match[2]);
				} else {
					estimate = parseInt(match[1]) * (pattern.multiplier || 1);
				}
				return {
					estimate,
					remainingText: text.replace(pattern.regex, '').trim()
				};
			}
		}

		return { remainingText: text };
	}

	/**
	 * Extract dates and times from text
	 */
	private extractDatesAndTimes(text: string): { 
		dateTime: Partial<ParsedTaskData>; 
		remainingText: string 
	} {
		let workingText = text;
		const result: Partial<ParsedTaskData> = {};

		// Extract specific dates first
		const specificDateResult = this.extractSpecificDates(workingText);
		Object.assign(result, specificDateResult.dates);
		workingText = specificDateResult.remainingText;

		// Extract relative dates
		const relativeDateResult = this.extractRelativeDates(workingText);
		Object.assign(result, relativeDateResult.dates);
		workingText = relativeDateResult.remainingText;

		// Extract times
		const timeResult = this.extractTimes(workingText);
		Object.assign(result, timeResult.times);
		workingText = timeResult.remainingText;

		return {
			dateTime: result,
			remainingText: workingText
		};
	}

	/**
	 * Extract specific dates (2024-12-25, Dec 25, etc.)
	 */
	private extractSpecificDates(text: string): {
		dates: Partial<ParsedTaskData>;
		remainingText: string;
	} {
		const result: Partial<ParsedTaskData> = {};
		let workingText = text;

		// ISO format dates (2024-12-25)
		const isoMatch = workingText.match(/\b(\d{4}-\d{2}-\d{2})\b/);
		if (isoMatch) {
			const date = new Date(isoMatch[1]);
			if (isValid(date)) {
				result.dueDate = format(date, 'yyyy-MM-dd');
				workingText = workingText.replace(isoMatch[0], '').trim();
			}
		}

		// Month day format (Dec 25, December 25)
		const monthDayMatch = workingText.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/i);
		if (monthDayMatch) {
			const monthName = monthDayMatch[1];
			const day = parseInt(monthDayMatch[2]);
			const year = new Date().getFullYear();
			
			try {
				const date = parse(`${monthName} ${day} ${year}`, 'MMMM d yyyy', new Date());
				if (isValid(date)) {
					result.dueDate = format(date, 'yyyy-MM-dd');
					workingText = workingText.replace(monthDayMatch[0], '').trim();
				}
			} catch (e) {
				// Try short month format
				try {
					const date = parse(`${monthName} ${day} ${year}`, 'MMM d yyyy', new Date());
					if (isValid(date)) {
						result.dueDate = format(date, 'yyyy-MM-dd');
						workingText = workingText.replace(monthDayMatch[0], '').trim();
					}
				} catch (e) {
					// Ignore parsing errors
				}
			}
		}

		return { dates: result, remainingText: workingText };
	}

	/**
	 * Extract relative dates (today, tomorrow, next week, etc.)
	 */
	private extractRelativeDates(text: string): {
		dates: Partial<ParsedTaskData>;
		remainingText: string;
	} {
		const result: Partial<ParsedTaskData> = {};
		let workingText = text;
		const now = new Date();

		const relativeDatePatterns = [
			{ regex: /\b(today)\b/i, getDate: () => startOfDay(now) },
			{ regex: /\b(tomorrow|tmrw)\b/i, getDate: () => startOfDay(addDays(now, 1)) },
			{ regex: /\b(yesterday)\b/i, getDate: () => startOfDay(addDays(now, -1)) },
			{ regex: /\bin (\d+) days?\b/i, getDate: (match: RegExpMatchArray) => startOfDay(addDays(now, parseInt(match[1]))) },
			{ regex: /\bnext week\b/i, getDate: () => startOfDay(addWeeks(now, 1)) },
			{ regex: /\bnext month\b/i, getDate: () => startOfDay(addMonths(now, 1)) },
			{ regex: /\bnext year\b/i, getDate: () => startOfDay(addYears(now, 1)) },
			{ regex: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, getDate: (match: RegExpMatchArray) => this.getNextWeekday(match[1]) },
			{ regex: /\bnext (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, getDate: (match: RegExpMatchArray) => this.getNextWeekday(match[1], true) }
		];

		for (const pattern of relativeDatePatterns) {
			const match = workingText.match(pattern.regex);
			if (match) {
				const date = pattern.getDate(match);
				if (date && isValid(date)) {
					result.dueDate = format(date, 'yyyy-MM-dd');
					workingText = workingText.replace(match[0], '').trim();
					break; // Only match the first date found
				}
			}
		}

		return { dates: result, remainingText: workingText };
	}

	/**
	 * Extract times from text
	 */
	private extractTimes(text: string): {
		times: Partial<ParsedTaskData>;
		remainingText: string;
	} {
		const result: Partial<ParsedTaskData> = {};
		let workingText = text;

		// Time patterns
		const timePatterns = [
			// 3pm, 3:30pm, 15:30
			/\b(?:at\s+)?(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)\b/,
			// 24-hour format: 14:30, 9:00
			/\b(?:at\s+)?(\d{1,2}):(\d{2})\b/,
			// Simple hour: 3pm, 14h
			/\b(?:at\s+)?(\d{1,2})\s*(am|pm|AM|PM|h)\b/
		];

		for (const pattern of timePatterns) {
			const match = workingText.match(pattern);
			if (match) {
				const timeString = this.parseTimeString(match);
				if (timeString) {
					result.dueTime = timeString;
					workingText = workingText.replace(match[0], '').trim();
					break; // Only match the first time found
				}
			}
		}

		return { times: result, remainingText: workingText };
	}

	/**
	 * Parse time string from regex match
	 */
	private parseTimeString(match: RegExpMatchArray): string | null {
		const hour = parseInt(match[1]);
		const minute = match[2] ? parseInt(match[2]) : 0;
		const ampm = match[3]?.toLowerCase();

		// Validate hour and minute
		if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
			return null;
		}

		// Handle 12-hour format
		if (ampm === 'am' || ampm === 'pm') {
			let adjustedHour = hour;
			if (ampm === 'pm' && hour !== 12) {
				adjustedHour += 12;
			} else if (ampm === 'am' && hour === 12) {
				adjustedHour = 0;
			}
			return `${adjustedHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
		}

		// Handle 24-hour format or 'h' suffix
		if (ampm === 'h' || !ampm) {
			return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
		}

		return null;
	}

	/**
	 * Get the next occurrence of a weekday
	 */
	private getNextWeekday(dayName: string, forceNext = false): Date {
		const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
		const targetDay = weekdays.indexOf(dayName.toLowerCase());
		
		if (targetDay === -1) return new Date(); // Invalid day name
		
		const today = new Date();
		const currentDay = today.getDay();
		
		let daysToAdd = targetDay - currentDay;
		
		// If the target day is today and we're not forcing next week, use today
		if (daysToAdd === 0 && !forceNext) {
			return startOfDay(today);
		}
		
		// If the target day has passed this week or we're forcing next week, go to next week
		if (daysToAdd <= 0 || forceNext) {
			daysToAdd += 7;
		}
		
		return startOfDay(addDays(today, daysToAdd));
	}

	/**
	 * Get preview text for parsed data
	 */
	getPreviewText(parsed: ParsedTaskData): string {
		const parts: string[] = [];
		
		if (parsed.title) parts.push(`📝 "${parsed.title}"`);
		if (parsed.details) parts.push(`📄 Details: "${parsed.details.substring(0, 50)}${parsed.details.length > 50 ? '...' : ''}"`);
		if (parsed.dueDate) {
			const dateStr = parsed.dueTime ? `${parsed.dueDate} ${parsed.dueTime}` : parsed.dueDate;
			parts.push(`📅 Due: ${dateStr}`);
		}
		if (parsed.scheduledDate) {
			const dateStr = parsed.scheduledTime ? `${parsed.scheduledDate} ${parsed.scheduledTime}` : parsed.scheduledDate;
			parts.push(`🗓️ Scheduled: ${dateStr}`);
		}
		if (parsed.priority) parts.push(`⚡ Priority: ${parsed.priority}`);
		if (parsed.status) parts.push(`🔄 Status: ${parsed.status}`);
		if (parsed.contexts.length > 0) parts.push(`📍 Contexts: ${parsed.contexts.map(c => '@' + c).join(', ')}`);
		if (parsed.tags.length > 0) parts.push(`🏷️ Tags: ${parsed.tags.map(t => '#' + t).join(', ')}`);
		if (parsed.recurrence) {
			let recurrenceText = parsed.recurrence;
			if (parsed.daysOfWeek && parsed.daysOfWeek.length > 0) {
				recurrenceText += ` (${parsed.daysOfWeek.join(', ')})`;
			}
			parts.push(`🔄 Recurrence: ${recurrenceText}`);
		}
		if (parsed.estimate) parts.push(`⏱️ Estimate: ${parsed.estimate}min`);
		
		return parts.join(' • ');
	}

	/**
	 * Escape special regex characters in a string
	 */
	private escapeRegex(str: string): string {
		return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}
}