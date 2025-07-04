import { format, isValid } from 'date-fns';
import { StatusConfig, PriorityConfig } from '../types';
import * as chrono from 'chrono-node';
import { RRule } from 'rrule';

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
    projects: string[];
    recurrence?: string;
    estimate?: number; // in minutes
    isCompleted?: boolean;
}

interface RegexPattern {
    regex: RegExp;
    value: string;
}

/**
 * Service for parsing natural language input into structured task data.
 * This refined version centralizes date parsing, pre-compiles regexes for performance,
 * and uses a more declarative pattern-matching approach for maintainability.
 */
export class NaturalLanguageParser {
    private readonly statusPatterns: RegexPattern[];
    private readonly priorityPatterns: RegexPattern[];
    private readonly defaultToScheduled: boolean;

    constructor(statusConfigs: StatusConfig[] = [], priorityConfigs: PriorityConfig[] = [], defaultToScheduled = true) {
        this.defaultToScheduled = defaultToScheduled;
        
        // Pre-compile regex patterns for performance
        this.priorityPatterns = this.buildPriorityPatterns(priorityConfigs);
        this.statusPatterns = this.buildStatusPatterns(statusConfigs);
    }

    /**
     * Parse natural language input into structured task data.
     * The order of operations is crucial to avoid conflicts (e.g., parse recurrence before dates).
     */
    public parseInput(input: string): ParsedTaskData {
        const result: ParsedTaskData = {
            title: '',
            tags: [],
            contexts: [],
            projects: [],
        };

        // 1. Separate title line from details
        const [workingText, details] = this.extractTitleAndDetails(input);
        if (details) {
            result.details = details;
        }

        // 2. Process text, extracting components and shrinking the workingText
        let remainingText = workingText;
        
        // Extract simple, unambiguous patterns first
        remainingText = this.extractTags(remainingText, result);
        remainingText = this.extractContexts(remainingText, result);
        remainingText = this.extractProjects(remainingText, result);

        // Extract configured keywords
        remainingText = this.extractPriority(remainingText, result);
        remainingText = this.extractStatus(remainingText, result);

        // Extract explicit due/scheduled date patterns first
        remainingText = this.extractExplicitDates(remainingText, result);

        // Extract recurrence BEFORE general date parsing to prevent chrono from consuming keywords like "daily" or "weekly"
        remainingText = this.extractRecurrence(remainingText, result);

        // Extract time estimate
        remainingText = this.extractTimeEstimate(remainingText, result);

        // Extract all remaining dates and times in one pass with context
        remainingText = this.parseDatesAndTimes(remainingText, result);

        // 3. The remainder is the title
        result.title = remainingText.trim();
        
        // 4. Validate and finalize the result
        return this.validateAndCleanupResult(result);
    }
    
    /**
     * Splits the input string into the first line (for parsing) and the rest (for details).
     */
    private extractTitleAndDetails(input: string): [string, string | undefined] {
        const trimmedInput = input.trim();
        const firstLineBreak = trimmedInput.indexOf('\n');

        if (firstLineBreak !== -1) {
            const titleLine = trimmedInput.substring(0, firstLineBreak).trim();
            const details = trimmedInput.substring(firstLineBreak + 1).trim();
            return [titleLine, details];
        }
        
        return [trimmedInput, undefined];
    }

    /** Extracts #tags from the text and adds them to the result object. */
    private extractTags(text: string, result: ParsedTaskData): string {
        const tagMatches = text.match(/#\w+/g);
        if (tagMatches) {
            result.tags.push(...tagMatches.map(tag => tag.substring(1)));
            return this.cleanupWhitespace(text.replace(/#\w+/g, ''));
        }
        return text;
    }

    /** Extracts @contexts from the text and adds them to the result object. */
    private extractContexts(text: string, result: ParsedTaskData): string {
        const contextMatches = text.match(/@\w+/g);
        if (contextMatches) {
            result.contexts.push(...contextMatches.map(context => context.substring(1)));
            return this.cleanupWhitespace(text.replace(/@\w+/g, ''));
        }
        return text;
    }

    /** Extracts +projects from the text and adds them to the result object. */
    private extractProjects(text: string, result: ParsedTaskData): string {
        const projectMatches = text.match(/\+\w+/g);
        if (projectMatches) {
            result.projects.push(...projectMatches.map(project => project.substring(1)));
            return this.cleanupWhitespace(text.replace(/\+\w+/g, ''));
        }
        return text;
    }

    /**
     * Pre-builds priority regex patterns from configuration for efficiency.
     */
    private buildPriorityPatterns(configs: PriorityConfig[]): RegexPattern[] {
        if (configs.length > 0) {
            return configs.flatMap(config => [
                { regex: new RegExp(`\\b${this.escapeRegex(config.value)}\\b`, 'i'), value: config.value },
                { regex: new RegExp(`\\b${this.escapeRegex(config.label)}\\b`, 'i'), value: config.value }
            ]);
        }
        // Fallback patterns - order matters, most specific first
        return [
            { regex: /\b(urgent|critical|highest)\b/i, value: 'urgent' },
            { regex: /\b(high)\b/i, value: 'high' },
            { regex: /\b(important)\b/i, value: 'high' },
            { regex: /\b(medium|normal)\b/i, value: 'normal' },
            { regex: /\b(low|minor)\b/i, value: 'low' }
        ];
    }

    /** Extracts priority using pre-compiled patterns. */
    private extractPriority(text: string, result: ParsedTaskData): string {
        let foundMatch: { pattern: RegexPattern; index: number } | null = null;
        
        // Find the first occurrence in the text
        for (const pattern of this.priorityPatterns) {
            const match = text.match(pattern.regex);
            if (match && match.index !== undefined) {
                if (!foundMatch || match.index < foundMatch.index) {
                    foundMatch = { pattern, index: match.index };
                }
            }
        }
        
        if (foundMatch) {
            result.priority = foundMatch.pattern.value;
            return this.cleanupWhitespace(text.replace(foundMatch.pattern.regex, ''));
        }
        
        return text;
    }

    /**
     * Pre-builds status regex patterns from configuration for efficiency.
     */
    private buildStatusPatterns(configs: StatusConfig[]): RegexPattern[] {
        if (configs.length > 0) {
            return configs.flatMap(config => [
                { regex: new RegExp(`\\b${this.escapeRegex(config.value)}\\b`, 'i'), value: config.value },
                { regex: new RegExp(`\\b${this.escapeRegex(config.label)}\\b`, 'i'), value: config.value }
            ]);
        }
        // Fallback patterns
        return [
            { regex: /\b(todo|to do|open)\b/i, value: 'open' },
            { regex: /\b(in progress|in-progress|doing)\b/i, value: 'in-progress' },
            { regex: /\b(done|completed|finished)\b/i, value: 'done' },
            { regex: /\b(cancelled|canceled)\b/i, value: 'cancelled' },
            { regex: /\b(waiting|blocked|on hold)\b/i, value: 'waiting' }
        ];
    }

    /** Extracts status using pre-compiled patterns. */
    private extractStatus(text: string, result: ParsedTaskData): string {
        for (const pattern of this.statusPatterns) {
            if (pattern.regex.test(text)) {
                result.status = pattern.value;
                return this.cleanupWhitespace(text.replace(pattern.regex, ''));
            }
        }
        return text;
    }

    /**
     * Extract explicit due/scheduled date patterns with trigger words
     */
    private extractExplicitDates(text: string, result: ParsedTaskData): string {
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
                    workingText = this.cleanupWhitespace(workingText);
                    break; // Only match first occurrence
                }
            }
        }

        return workingText;
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
     * Extracts recurrence from text and generates rrule strings using a declarative pattern map.
     */
    private extractRecurrence(text: string, result: ParsedTaskData): string {
        const recurrencePatterns = [
            // "every [ordinal] [weekday]" (e.g., "every second monday") - MUST be first for priority
            {
                regex: /\bevery\s+(first|second|third|fourth|last)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
                handler: (match: RegExpMatchArray) => {
                    const ordinal = match[1].toLowerCase();
                    const dayName = match[2].toLowerCase();
                    const rruleDay = dayName.toUpperCase().substring(0, 2);
                    const position = { first: 1, second: 2, third: 3, fourth: 4, last: -1 }[ordinal] || 1;
                    return `FREQ=MONTHLY;BYDAY=${rruleDay};BYSETPOS=${position}`;
                }
            },
            // "every [N] period" (e.g., "every 3 days")
            {
                regex: /\bevery\s+(\d+)\s+(days?|weeks?|months?|years?)\b/i,
                handler: (match: RegExpMatchArray) => {
                    const interval = parseInt(match[1]);
                    const period = match[2].replace(/s$/, '').toLowerCase();
                    const freqMap: Record<string, string> = {
                        'day': 'DAILY',
                        'week': 'WEEKLY', 
                        'month': 'MONTHLY',
                        'year': 'YEARLY'
                    };
                    return `FREQ=${freqMap[period]};INTERVAL=${interval}`;
                }
            },
            // "every other period" (e.g., "every other week")
            {
                regex: /\bevery\s+other\s+(day|week|month|year)\b/i,
                handler: (match: RegExpMatchArray) => {
                    const period = match[1].toLowerCase();
                    const freqMap: Record<string, string> = {
                        'day': 'DAILY',
                        'week': 'WEEKLY',
                        'month': 'MONTHLY', 
                        'year': 'YEARLY'
                    };
                    return `FREQ=${freqMap[period]};INTERVAL=2`;
                }
            },
            // "every [weekday]" - ONLY with explicit "every" keyword
            {
                regex: /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
                handler: (match: RegExpMatchArray) => {
                    const day = match[1].toUpperCase().substring(0, 2);
                    return `FREQ=WEEKLY;BYDAY=${day}`;
                }
            },
            // Plural weekdays (e.g., "mondays", "tuesdays") - only plurals indicate recurrence
            {
                regex: /\b(mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays)\b/i,
                handler: (match: RegExpMatchArray) => {
                    const day = match[1].replace(/s$/, '').toUpperCase().substring(0, 2);
                    return `FREQ=WEEKLY;BYDAY=${day}`;
                }
            },
            // General frequencies
            { regex: /\b(daily|every day)\b/i, handler: () => 'FREQ=DAILY' },
            { regex: /\b(weekly|every week)\b/i, handler: () => 'FREQ=WEEKLY' },
            { regex: /\b(monthly|every month)\b/i, handler: () => 'FREQ=MONTHLY' },
            { regex: /\b(yearly|annually|every year)\b/i, handler: () => 'FREQ=YEARLY' }
        ];

        for (const pattern of recurrencePatterns) {
            const match = text.match(pattern.regex);
            if (match) {
                const rruleString = pattern.handler(match);
                // Validate the rrule string before setting it
                if (this.isValidRRuleString(rruleString)) {
                    result.recurrence = rruleString;
                    return this.cleanupWhitespace(text.replace(pattern.regex, ''));
                }
            }
        }

        return text;
    }

    /**
     * Validate an rrule string to prevent parsing errors
     */
    private isValidRRuleString(rruleString: string): boolean {
        // Check for empty or undefined BYDAY values
        if (rruleString.includes('BYDAY=undefined') || rruleString.includes('BYDAY=;') || rruleString.includes('BYDAY=')) {
            const byDayMatch = rruleString.match(/BYDAY=([^;]*)/);
            if (byDayMatch && (!byDayMatch[1] || byDayMatch[1] === 'undefined' || byDayMatch[1].trim() === '')) {
                return false;
            }
        }
        
        // Check for basic FREQ requirement
        if (!rruleString.includes('FREQ=')) {
            return false;
        }
        
        return true;
    }

    /**
     * Extracts time estimate from text (e.g., "1hr 30min", "45m").
     */
    private extractTimeEstimate(text: string, result: ParsedTaskData): string {
        const patterns = [
            // Combined format: 1h30m
            { regex: /\b(\d+)h\s*(\d+)m\b/i, handler: (m: RegExpMatchArray) => parseInt(m[1]) * 60 + parseInt(m[2]) },
            // Hours: 1hr, 2 hours, 3h
            { regex: /\b(\d+)\s*(?:hr|hrs|hour|hours|h)\b/i, handler: (m: RegExpMatchArray) => parseInt(m[1]) * 60 },
            // Minutes: 30min, 45 m, 15 minutes
            { regex: /\b(\d+)\s*(?:min|mins|minute|minutes|m)\b/i, handler: (m: RegExpMatchArray) => parseInt(m[1]) },
        ];
        
        let workingText = text;
        let totalEstimate = 0;

        for (const pattern of patterns) {
            const match = workingText.match(pattern.regex);
            if (match) {
                totalEstimate += pattern.handler(match);
                workingText = this.cleanupWhitespace(workingText.replace(pattern.regex, ''));
            }
        }

        if (totalEstimate > 0) {
            result.estimate = totalEstimate;
        }

        return workingText;
    }

    /**
     * A unified and robust method to parse all date and time information using chrono-node.
     * It intelligently handles keywords like "due" and "scheduled" and date ranges.
     */
    private parseDatesAndTimes(text: string, result: ParsedTaskData): string {
        let workingText = text;
        try {
            const parsedResults = chrono.parse(text, new Date(), { forwardDate: true });
            if (parsedResults.length === 0) {
                return text;
            }
            
            const primaryMatch = parsedResults[0];
            const dateText = primaryMatch.text;
            
            const startDate = primaryMatch.start.date();
            const endDate = primaryMatch.end?.date();

            let isDue = /due|by|deadline/i.test(primaryMatch.text);
            let isScheduled = /scheduled|from|start|on/i.test(primaryMatch.text);
            
            // Handle date ranges (e.g., "from tomorrow to next friday")
            if (endDate && isValid(endDate) && endDate.getTime() !== startDate.getTime()) {
                result.scheduledDate = format(startDate, 'yyyy-MM-dd');
                if (primaryMatch.start.isCertain('hour')) {
                    result.scheduledTime = format(startDate, 'HH:mm');
                }
                result.dueDate = format(endDate, 'yyyy-MM-dd');
                if (primaryMatch.end?.isCertain('hour')) {
                    result.dueTime = format(endDate, 'HH:mm');
                }
            } 
            // Handle single dates
            else if (isValid(startDate)) {
                const dateString = format(startDate, 'yyyy-MM-dd');
                const timeString = primaryMatch.start.isCertain('hour') ? format(startDate, 'HH:mm') : undefined;

                // Prioritize explicit keywords, otherwise use default setting
                if (isDue && !isScheduled) {
                    result.dueDate = dateString;
                    result.dueTime = timeString;
                } else if (isScheduled && !isDue) {
                    result.scheduledDate = dateString;
                    result.scheduledTime = timeString;
                } else if (this.defaultToScheduled) {
                    result.scheduledDate = dateString;
                    result.scheduledTime = timeString;
                } else {
                    result.dueDate = dateString;
                    result.dueTime = timeString;
                }
            }

            // Clean the parsed date text from the string
            workingText = this.cleanupWhitespace(workingText.replace(dateText, ''));

        } catch (error) {
            console.debug('Chrono-node parsing failed:', error);
        }

        return workingText;
    }

    /**
     * Ensures the final parsed data is valid and clean.
     */
    private validateAndCleanupResult(result: ParsedTaskData): ParsedTaskData {
        // If title becomes empty after parsing, use a default
        if (!result.title.trim()) {
            result.title = 'Untitled Task';
        }

        // Sanitize and remove duplicates from arrays
        result.tags = [...new Set(result.tags.filter(Boolean))];
        result.contexts = [...new Set(result.contexts.filter(Boolean))];
        result.projects = [...new Set(result.projects.filter(Boolean))];

        // Ensure date and time strings are valid formats (defensive check)
        if (result.dueDate && !this.isValidDateString(result.dueDate)) delete result.dueDate;
        if (result.scheduledDate && !this.isValidDateString(result.scheduledDate)) delete result.scheduledDate;
        if (result.dueTime && !this.isValidTimeString(result.dueTime)) delete result.dueTime;
        if (result.scheduledTime && !this.isValidTimeString(result.scheduledTime)) delete result.scheduledTime;
        
        return result;
    }

    private isValidDateString = (dateString: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(dateString);
    private isValidTimeString = (timeString: string): boolean => /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeString);
    private escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    /** Cleans up whitespace after text extraction */
    private cleanupWhitespace = (text: string): string => {
        return text.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '').trim();
    };

    /**
     * Generates a user-friendly preview of the parsed data.
     * Icons are placeholders for the UI layer to interpret.
     */
    public getPreviewData(parsed: ParsedTaskData): Array<{ icon: string; text: string }> {
        const parts: Array<{ icon: string; text: string }> = [];
        
        if (parsed.title) parts.push({ icon: 'edit-3', text: `"${parsed.title}"` });
        if (parsed.details) parts.push({ icon: 'file-text', text: `Details: "${parsed.details.substring(0, 50)}${parsed.details.length > 50 ? '...' : ''}"` });
        if (parsed.dueDate) {
            const dateStr = parsed.dueTime ? `${parsed.dueDate} at ${parsed.dueTime}` : parsed.dueDate;
            parts.push({ icon: 'calendar', text: `Due: ${dateStr}` });
        }
        if (parsed.scheduledDate) {
            const dateStr = parsed.scheduledTime ? `${parsed.scheduledDate} at ${parsed.scheduledTime}` : parsed.scheduledDate;
            parts.push({ icon: 'calendar-clock', text: `Scheduled: ${dateStr}` });
        }
        if (parsed.priority) parts.push({ icon: 'alert-triangle', text: `Priority: ${parsed.priority}` });
        if (parsed.status) parts.push({ icon: 'activity', text: `Status: ${parsed.status}` });
        if (parsed.contexts.length > 0) parts.push({ icon: 'map-pin', text: `Contexts: ${parsed.contexts.map(c => '@' + c).join(', ')}` });
        if (parsed.projects.length > 0) parts.push({ icon: 'folder', text: `Projects: ${parsed.projects.map(p => '+' + p).join(', ')}` });
        if (parsed.tags.length > 0) parts.push({ icon: 'tag', text: `Tags: ${parsed.tags.map(t => '#' + t).join(', ')}` });
        if (parsed.recurrence) {
            let recurrenceText = 'Invalid recurrence';
            try {
                // Ensure it's a valid RRule before trying to parse
                if (parsed.recurrence.includes('FREQ=') && this.isValidRRuleString(parsed.recurrence)) {
                    recurrenceText = RRule.fromString(parsed.recurrence).toText();
                }
            } catch (error) {
                console.debug('Error parsing rrule for preview:', error);
            }
            parts.push({ icon: 'repeat', text: `Recurrence: ${recurrenceText}` });
        }
        if (parsed.estimate) parts.push({ icon: 'clock', text: `Estimate: ${parsed.estimate} min` });
        
        return parts;
    }

    /**
     * Generates a simple text-only preview of the parsed data.
     */
    public getPreviewText(parsed: ParsedTaskData): string {
        return this.getPreviewData(parsed).map(part => part.text).join(' • ');
    }
}