import { format, parse, addDays, addWeeks, addMonths, addYears, startOfDay, isValid } from 'date-fns';
import { StatusConfig, PriorityConfig } from '../types';
import * as chrono from 'chrono-node';

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
	private defaultToScheduled: boolean;

	constructor(statusConfigs: StatusConfig[] = [], priorityConfigs: PriorityConfig[] = [], defaultToScheduled: boolean = true) {
		this.statusConfigs = statusConfigs;
		this.priorityConfigs = priorityConfigs;
		this.defaultToScheduled = defaultToScheduled;
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

		// Extract explicit due/scheduled date patterns first
		const explicitDateResult = this.extractExplicitDates(workingText);
		Object.assign(result, explicitDateResult.dates);
		workingText = explicitDateResult.remainingText;

		// Extract dates and times using chrono-node (primary parser for remaining dates)
		const dateTimeResult = this.extractDatesAndTimesWithChrono(workingText);
		Object.assign(result, dateTimeResult.dateTime);
		workingText = dateTimeResult.remainingText;

		// Extract time estimate
		const estimateResult = this.extractTimeEstimate(workingText);
		if (estimateResult.estimate) {
			result.estimate = estimateResult.estimate;
			workingText = estimateResult.remainingText;
		}

		// Extract recurrence AFTER date parsing to avoid conflicts
		const recurrenceResult = this.extractRecurrence(workingText);
		if (recurrenceResult.recurrence) {
			result.recurrence = recurrenceResult.recurrence;
			workingText = recurrenceResult.remainingText;
		}
		if (recurrenceResult.daysOfWeek) {
			result.daysOfWeek = recurrenceResult.daysOfWeek;
		}

		// Whatever remains is the title
		result.title = workingText.trim();

		// Add details if there were multiple lines
		if (details) {
			result.details = details;
		}

		// Validate and cleanup the final result
		return this.validateAndCleanupResult(result);
	}


	/**
	 * Extract priority from text (legacy method)
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
	 * Extract status from text (legacy method)
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
	 * Extract recurrence from text (improved to avoid conflicts with date parsing)
	 */
	private extractRecurrence(text: string): { recurrence?: string; daysOfWeek?: string[]; remainingText: string } {
		// More specific recurrence patterns that avoid ambiguity
		const recurrencePatterns = [
			{ regex: /\b(daily|every day|each day)\b/i, value: 'daily' },
			{ regex: /\b(weekly|every week|each week)\b/i, value: 'weekly' },
			{ regex: /\b(monthly|every month|each month)\b/i, value: 'monthly' },
			{ regex: /\b(yearly|annually|every year|each year)\b/i, value: 'yearly' }
		];

		// Check for "every [weekday]" patterns - more specific to avoid conflicts
		const everyDayPattern = /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
		const everyDayMatch = text.match(everyDayPattern);
		if (everyDayMatch) {
			const dayName = everyDayMatch[1].toLowerCase();
			const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
			return {
				recurrence: 'weekly',
				daysOfWeek: [capitalizedDay],
				remainingText: text.replace(everyDayPattern, '').trim()
			};
		}

		// Check for plural day patterns (mondays, tuesdays, etc.) - but be more specific
		const pluralDayPattern = /\b(mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays)\b/i;
		const pluralDayMatch = text.match(pluralDayPattern);
		if (pluralDayMatch) {
			const pluralDay = pluralDayMatch[1].toLowerCase();
			const dayMapping: Record<string, string> = {
				'mondays': 'Monday',
				'tuesdays': 'Tuesday', 
				'wednesdays': 'Wednesday',
				'thursdays': 'Thursday',
				'fridays': 'Friday',
				'saturdays': 'Saturday',
				'sundays': 'Sunday'
			};
			
			const mappedDay = dayMapping[pluralDay];
			if (mappedDay) {
				return {
					recurrence: 'weekly',
					daysOfWeek: [mappedDay],
					remainingText: text.replace(pluralDayPattern, '').trim()
				};
			}
		}

		// Check for "every other" patterns
		const everyOtherPattern = /\bevery\s+other\s+(day|week|month|year)\b/i;
		const everyOtherMatch = text.match(everyOtherPattern);
		if (everyOtherMatch) {
			const period = everyOtherMatch[1].toLowerCase();
			const periodMapping: Record<string, string> = {
				'day': 'daily',
				'week': 'weekly',
				'month': 'monthly',
				'year': 'yearly'
			};
			
			return {
				recurrence: periodMapping[period] || 'weekly',
				remainingText: text.replace(everyOtherPattern, '').trim()
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
	 * Extract time estimate from text (legacy method)
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
	 * Extract explicit due/scheduled date patterns
	 */
	private extractExplicitDates(text: string): {
		dates: Partial<ParsedTaskData>;
		remainingText: string;
	} {
		const result: Partial<ParsedTaskData> = {};
		let workingText = text;

		// Patterns that identify trigger words and their positions
		const triggerPatterns = [
			{ type: 'due', regex: /\b(due\s+(?:on\s+)?|deadline\s+(?:on\s+)?|must\s+be\s+done\s+(?:by\s+)?)/i },
			{ type: 'scheduled', regex: /\b(scheduled\s+(?:for\s+)?|start\s+(?:on\s+)?|begin\s+(?:on\s+)?|work\s+on\s+)/i }
		];

		// Process each trigger pattern
		for (const triggerPattern of triggerPatterns) {
			const match = workingText.match(triggerPattern.regex);
			if (match) {
				// Get the position where the date text starts (after the trigger)
				const triggerEnd = match.index! + match[0].length;
				const remainingText = workingText.substring(triggerEnd);
				
				// Use chrono-node to parse from this position onward
				const chronoParsed = this.parseChronoFromPosition(remainingText);
				
				if (chronoParsed.success) {
					// Assign to the correct field based on trigger type
					if (triggerPattern.type === 'due') {
						result.dueDate = chronoParsed.date;
						if (chronoParsed.time) {
							result.dueTime = chronoParsed.time;
						}
					} else {
						result.scheduledDate = chronoParsed.date;
						if (chronoParsed.time) {
							result.scheduledTime = chronoParsed.time;
						}
					}
					
					// Remove the entire matched expression (trigger + date) from working text
					workingText = workingText.replace(triggerPattern.regex, '');
					if (chronoParsed.matchedText) {
						workingText = workingText.replace(chronoParsed.matchedText, '');
					}
					workingText = workingText.trim();
					break; // Only match first occurrence
				}
			}
		}

		return { dates: result, remainingText: workingText };
	}

	/**
	 * Use chrono-node to parse date starting from a specific position
	 */
	private parseChronoFromPosition(text: string): { 
		success: boolean; 
		date?: string; 
		time?: string; 
		matchedText?: string 
	} {
		try {
			// Parse the text starting from the beginning
			const parsed = chrono.parse(text, new Date(), { forwardDate: true });
			
			if (parsed.length > 0) {
				const firstMatch = parsed[0];
				
				// Ensure the match starts at or near the beginning of the text
				if (firstMatch.index <= 3) { // Allow for a few characters of whitespace/prepositions
					const parsedDate = firstMatch.start.date();
					if (isValid(parsedDate)) {
						const result: any = {
							success: true,
							date: format(parsedDate, 'yyyy-MM-dd'),
							matchedText: firstMatch.text
						};
						
						// Check if time is included and certain
						if (firstMatch.start.isCertain('hour')) {
							result.time = format(parsedDate, 'HH:mm');
						}
						
						return result;
					}
				}
			}
		} catch (error) {
			console.debug('Error parsing date with chrono:', error);
		}
		
		return { success: false };
	}


	/**
	 * Extract dates and times from text using chrono-node as primary parser
	 */
	private extractDatesAndTimesWithChrono(text: string): { 
		dateTime: Partial<ParsedTaskData>; 
		remainingText: string 
	} {
		const result: Partial<ParsedTaskData> = {};
		let workingText = text;

		try {
			// Configure chrono for better parsing
			const customChrono = chrono.casual.clone();
			
			// Parse all dates found in the text
			const parsed = customChrono.parse(text, new Date(), { forwardDate: true });
			
			if (parsed.length > 0) {
				// Process the first (most confident) date match
				const primaryDate = parsed[0];
				
				if (primaryDate.start) {
					const startDate = primaryDate.start.date();
					if (isValid(startDate)) {
						// Apply default behavior: scheduled by default, due if setting changed
						if (this.defaultToScheduled) {
							result.scheduledDate = format(startDate, 'yyyy-MM-dd');
							
							// Extract time if present and certain
							if (primaryDate.start.isCertain('hour') && primaryDate.start.isCertain('minute')) {
								result.scheduledTime = format(startDate, 'HH:mm');
							} else if (primaryDate.start.isCertain('hour')) {
								// If only hour is certain, assume minute is 0
								result.scheduledTime = format(startDate, 'HH:00');
							}
						} else {
							result.dueDate = format(startDate, 'yyyy-MM-dd');
							
							// Extract time if present and certain
							if (primaryDate.start.isCertain('hour') && primaryDate.start.isCertain('minute')) {
								result.dueTime = format(startDate, 'HH:mm');
							} else if (primaryDate.start.isCertain('hour')) {
								// If only hour is certain, assume minute is 0
								result.dueTime = format(startDate, 'HH:00');
							}
						}
					}
					
					// Handle end date for ranges
					if (primaryDate.end) {
						const endDate = primaryDate.end.date();
						if (isValid(endDate) && endDate.getTime() !== startDate.getTime()) {
							// For ranges, start is always scheduled, end is always due
							if (this.defaultToScheduled) {
								// Start date is already in scheduledDate, end date becomes due
								result.dueDate = format(endDate, 'yyyy-MM-dd');
								
								if (primaryDate.end.isCertain('hour') && primaryDate.end.isCertain('minute')) {
									result.dueTime = format(endDate, 'HH:mm');
								} else if (primaryDate.end.isCertain('hour')) {
									result.dueTime = format(endDate, 'HH:00');
								}
							} else {
								// Start date is already in dueDate, end date becomes scheduled
								result.scheduledDate = format(endDate, 'yyyy-MM-dd');
								
								if (primaryDate.end.isCertain('hour') && primaryDate.end.isCertain('minute')) {
									result.scheduledTime = format(endDate, 'HH:mm');
								} else if (primaryDate.end.isCertain('hour')) {
									result.scheduledTime = format(endDate, 'HH:00');
								}
							}
						}
					}
					
					// Remove the matched date text from working text
					// Use the exact text that chrono matched
					const dateText = primaryDate.text;
					const dateIndex = primaryDate.index;
					
					// Remove the date text more precisely
					workingText = text.substring(0, dateIndex) + 
								 text.substring(dateIndex + dateText.length);
					workingText = workingText.replace(/\s+/g, ' ').trim();
				}
			}
		} catch (error) {
			console.debug('Chrono-node parsing failed, using fallback:', error);
			// Fallback to legacy date extraction if chrono fails
			const legacyResult = this.extractDatesAndTimes(workingText);
			Object.assign(result, legacyResult.dateTime);
			workingText = legacyResult.remainingText;
		}

		return {
			dateTime: result,
			remainingText: workingText
		};
	}

	/**
	 * Extract dates and times from text (legacy method)
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
	 * Get the next occurrence of a weekday with improved logic
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
	 * Enhanced validation and cleanup for parsed results
	 */
	private validateAndCleanupResult(result: ParsedTaskData): ParsedTaskData {
		// Ensure title is not empty
		if (!result.title || result.title.trim().length === 0) {
			result.title = 'Untitled Task';
		}

		// Validate date formats
		if (result.dueDate && !this.isValidDateString(result.dueDate)) {
			delete result.dueDate;
		}
		if (result.scheduledDate && !this.isValidDateString(result.scheduledDate)) {
			delete result.scheduledDate;
		}

		// Validate time formats
		if (result.dueTime && !this.isValidTimeString(result.dueTime)) {
			delete result.dueTime;
		}
		if (result.scheduledTime && !this.isValidTimeString(result.scheduledTime)) {
			delete result.scheduledTime;
		}

		// Ensure arrays are properly initialized
		result.tags = result.tags || [];
		result.contexts = result.contexts || [];
		
		// Remove duplicate tags and contexts
		result.tags = [...new Set(result.tags)];
		result.contexts = [...new Set(result.contexts)];

		return result;
	}

	/**
	 * Validate date string format (YYYY-MM-DD)
	 */
	private isValidDateString(dateString: string): boolean {
		const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
		if (!dateRegex.test(dateString)) return false;
		
		const date = new Date(dateString);
		return isValid(date);
	}

	/**
	 * Validate time string format (HH:MM)
	 */
	private isValidTimeString(timeString: string): boolean {
		const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
		return timeRegex.test(timeString);
	}

	/**
	 * Get preview data for parsed data (without icons - icons will be added in UI)
	 */
	getPreviewData(parsed: ParsedTaskData): Array<{ icon: string; text: string }> {
		const parts: Array<{ icon: string; text: string }> = [];
		
		if (parsed.title) parts.push({ icon: 'edit-3', text: `"${parsed.title}"` });
		if (parsed.details) parts.push({ icon: 'file-text', text: `Details: "${parsed.details.substring(0, 50)}${parsed.details.length > 50 ? '...' : ''}"` });
		if (parsed.dueDate) {
			const dateStr = parsed.dueTime ? `${parsed.dueDate} ${parsed.dueTime}` : parsed.dueDate;
			parts.push({ icon: 'calendar', text: `Due: ${dateStr}` });
		}
		if (parsed.scheduledDate) {
			const dateStr = parsed.scheduledTime ? `${parsed.scheduledDate} ${parsed.scheduledTime}` : parsed.scheduledDate;
			parts.push({ icon: 'calendar-clock', text: `Scheduled: ${dateStr}` });
		}
		if (parsed.priority) parts.push({ icon: 'alert-triangle', text: `Priority: ${parsed.priority}` });
		if (parsed.status) parts.push({ icon: 'activity', text: `Status: ${parsed.status}` });
		if (parsed.contexts.length > 0) parts.push({ icon: 'map-pin', text: `Contexts: ${parsed.contexts.map(c => '@' + c).join(', ')}` });
		if (parsed.tags.length > 0) parts.push({ icon: 'tag', text: `Tags: ${parsed.tags.map(t => '#' + t).join(', ')}` });
		if (parsed.recurrence) {
			let recurrenceText = parsed.recurrence;
			if (parsed.daysOfWeek && parsed.daysOfWeek.length > 0) {
				recurrenceText += ` (${parsed.daysOfWeek.join(', ')})`;
			}
			parts.push({ icon: 'repeat', text: `Recurrence: ${recurrenceText}` });
		}
		if (parsed.estimate) parts.push({ icon: 'clock', text: `Estimate: ${parsed.estimate}min` });
		
		return parts;
	}

	/**
	 * Get preview text for parsed data (fallback without icons)
	 */
	getPreviewText(parsed: ParsedTaskData): string {
		return this.getPreviewData(parsed).map(part => part.text).join(' • ');
	}

	/**
	 * Escape special regex characters in a string
	 */
	private escapeRegex(str: string): string {
		return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}
}