import { 
    format, 
    parseISO, 
    isSameDay, 
    isBefore, 
    isValid, 
    startOfDay, 
    addDays as addDaysFns, 
    endOfDay,
    addWeeks,
    addMonths,
    addYears,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    startOfYear,
    endOfYear,
    // subDays, subWeeks, subMonths, subYears - removed unused imports
} from 'date-fns';

/**
 * Smart date parsing that detects timezone info and handles appropriately
 * Supports various date formats including space-separated datetime and ISO week formats
 * 
 * @deprecated Use parseDateToUTC for internal logic or parseDateToLocal for UI
 * This function will be renamed to parseDateToLocal to make its behavior explicit.
 */
export function parseDate(dateString: string): Date {
    if (!dateString) {
        const error = new Error('Date string cannot be empty');
        console.error('Date parsing error:', { dateString, error: error.message });
        throw error;
    }
    
    // Trim whitespace
    const trimmed = dateString.trim();
    
    try {
        // Handle incomplete time format (e.g., "T00:00" without date)
        if (trimmed.startsWith('T') && /^T\d{2}:\d{2}(:\d{2})?/.test(trimmed)) {
            const error = new Error(`Invalid date format - time without date: ${dateString}`);
            console.warn('Date parsing error - incomplete time format:', { 
                original: dateString, 
                trimmed, 
                error: error.message 
            });
            throw error;
        }
        
        // Handle ISO week format (e.g., "2025-W02")
        if (/^\d{4}-W\d{2}$/.test(trimmed)) {
            const [year, week] = trimmed.split('-W');
            const yearNum = parseInt(year, 10);
            const weekNum = parseInt(week, 10);
            
            if (isNaN(yearNum) || isNaN(weekNum)) {
                const error = new Error(`Invalid numeric values in ISO week format: ${dateString}`);
                console.warn('Date parsing error - invalid ISO week numbers:', { 
                    original: dateString, 
                    year, 
                    week, 
                    yearNum, 
                    weekNum 
                });
                throw error;
            }
            
            if (weekNum < 1 || weekNum > 53) {
                const error = new Error(`Invalid week number in ISO week format: ${dateString} (week must be 1-53)`);
                console.warn('Date parsing error - week number out of range:', { 
                    original: dateString, 
                    weekNum, 
                    error: error.message 
                });
                throw error;
            }
            
            // Calculate the date of the first day of the specified week
            // ISO week starts on Monday
            const jan4 = new Date(yearNum, 0, 4); // January 4th is always in week 1
            const jan4Day = jan4.getDay(); // 0 = Sunday, 1 = Monday, etc.
            const mondayOfWeek1 = new Date(jan4);
            mondayOfWeek1.setDate(jan4.getDate() - (jan4Day === 0 ? 6 : jan4Day - 1));
            
            const targetWeekMonday = new Date(mondayOfWeek1);
            targetWeekMonday.setDate(mondayOfWeek1.getDate() + (weekNum - 1) * 7);
            
            if (!isValid(targetWeekMonday)) {
                const error = new Error(`Failed to calculate date from ISO week format: ${dateString}`);
                console.error('Date parsing error - ISO week calculation failed:', { 
                    original: dateString, 
                    yearNum, 
                    weekNum, 
                    jan4: jan4.toISOString(), 
                    targetWeekMonday: targetWeekMonday.toString() 
                });
                throw error;
            }
            
            // Successfully parsed ISO week format
            return targetWeekMonday;
        }
        
        // Handle space-separated datetime format (e.g., "2025-02-23 20:28:49")
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?/.test(trimmed)) {
            // Convert space to 'T' to make it ISO format
            const isoFormat = trimmed.replace(' ', 'T');
            const parsed = parseISO(isoFormat);
            
            if (!isValid(parsed)) {
                const error = new Error(`Invalid space-separated datetime: ${dateString}`);
                console.warn('Date parsing error - space-separated datetime invalid:', { 
                    original: dateString, 
                    converted: isoFormat, 
                    error: error.message 
                });
                throw error;
            }
            
            // Successfully parsed space-separated datetime
            return parsed;
        }
        
        // Check if the string contains timezone information (original logic)
        if (trimmed.includes('T') || trimmed.includes('Z') || trimmed.match(/[+-]\d{2}:\d{2}$/)) {
            // Has timezone info - parse as-is to preserve timezone
            const parsed = parseISO(trimmed);
            if (!isValid(parsed)) {
                const error = new Error(`Invalid timezone-aware date: ${dateString}`);
                console.warn('Date parsing error - timezone-aware format invalid:', { 
                    original: dateString, 
                    trimmed, 
                    error: error.message 
                });
                throw error;
            }
            
            // Successfully parsed timezone-aware date
            return parsed;
        } else {
            // Date-only string - parse in local timezone
            // Use direct Date constructor to avoid timezone issues
            const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!dateMatch) {
                const error = new Error(`Invalid date-only string: ${dateString} (expected format: yyyy-MM-dd)`);
                console.warn('Date parsing error - date-only format invalid:', { 
                    original: dateString, 
                    trimmed, 
                    expectedFormat: 'yyyy-MM-dd', 
                    error: error.message 
                });
                throw error;
            }
            
            const [, year, month, day] = dateMatch;
            const parsed = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
            
            if (!isValid(parsed) || parsed.getFullYear() !== parseInt(year, 10) || 
                parsed.getMonth() !== parseInt(month, 10) - 1 || parsed.getDate() !== parseInt(day, 10)) {
                const error = new Error(`Invalid date values: ${dateString}`);
                console.warn('Date parsing error - invalid date values:', { 
                    original: dateString, 
                    year, month, day,
                    error: error.message 
                });
                throw error;
            }
            
            // Successfully parsed date-only string
            return parsed;
        }
    } catch (error) {
        // If error is already one of our custom errors, re-throw it
        if (error instanceof Error && error.message.includes('Invalid date')) {
            throw error;
        }
        
        // For unexpected errors, wrap them with context
        const wrappedError = new Error(`Unexpected error parsing date "${dateString}": ${error instanceof Error ? error.message : String(error)}`);
        console.error('Unexpected date parsing error:', { 
            original: dateString, 
            trimmed, 
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        throw wrappedError;
    }
}

/**
 * Parses a date string into a Date object anchored to UTC.
 * - 'YYYY-MM-DD' becomes midnight UTC of that day.
 * - Full ISO strings are parsed as-is.
 * 
 * This is the new standard for internal date representation to ensure
 * timezone-independent logic throughout the application.
 * 
 * @param dateString The date string to parse
 * @returns A Date object representing the UTC anchor for that date
 */
export function parseDateToUTC(dateString: string): Date {
    if (!dateString) {
        const error = new Error('Date string cannot be empty');
        console.error('Date parsing error:', { dateString, error: error.message });
        throw error;
    }
    
    // Trim whitespace
    const trimmed = dateString.trim();
    
    try {
        // For date-only strings (YYYY-MM-DD), create a Date at UTC midnight
        const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateOnlyMatch) {
            const [, year, month, day] = dateOnlyMatch;
            const yearNum = parseInt(year, 10);
            const monthNum = parseInt(month, 10);
            const dayNum = parseInt(day, 10);
            
            // Validate date components
            if (monthNum < 1 || monthNum > 12) {
                throw new Error(`Invalid month in date: ${dateString}`);
            }
            
            if (dayNum < 1 || dayNum > 31) {
                throw new Error(`Invalid day in date: ${dateString}`);
            }
            
            // Create Date object at UTC midnight for this calendar day
            const parsed = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));
            
            // Validate that the date didn't roll over (e.g., Feb 31 -> March 3)
            if (parsed.getUTCFullYear() !== yearNum || 
                parsed.getUTCMonth() !== monthNum - 1 || 
                parsed.getUTCDate() !== dayNum) {
                throw new Error(`Invalid date values: ${dateString}`);
            }
            
            return parsed;
        }
        
        // For datetime strings, ISO week format, or any other format,
        // delegate to parseDateToLocal to handle the complexity
        // This maintains backward compatibility for complex formats
        return parseDateToLocal(trimmed);
        
    } catch (error) {
        const wrappedError = new Error(`Failed to parse date to UTC: ${trimmed}`);
        console.error('Date parsing error:', { 
            dateString, 
            trimmed, 
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        throw wrappedError;
    }
}

/**
 * Parses a date string into a Date object in the user's local timezone.
 * - 'YYYY-MM-DD' becomes midnight in the user's local timezone
 * - Full ISO strings are parsed according to their timezone info
 * 
 * Use this for UI display and user-facing date operations.
 * For internal logic, prefer parseDateToUTC.
 */
export const parseDateToLocal = parseDate;

/**
 * Safe date comparison that handles mixed timezone contexts
 */
export function isSameDateSafe(date1: string, date2: string): boolean {
    try {
        // For date-only comparisons, we need to extract the date parts
        // and compare them as calendar dates
        const date1Part = getDatePart(date1);
        const date2Part = getDatePart(date2);
        
        // Use UTC anchors for consistent comparison
        const d1 = parseDateToUTC(date1Part);
        const d2 = parseDateToUTC(date2Part);
        return d1.getTime() === d2.getTime();
    } catch (error) {
        console.error('Error comparing dates:', { date1, date2, error });
        return false;
    }
}

/**
 * Safe date comparison for before/after relationships
 */
export function isBeforeDateSafe(date1: string, date2: string): boolean {
    try {
        // For date-only comparisons, use UTC anchors
        const date1Part = getDatePart(date1);
        const date2Part = getDatePart(date2);
        
        const d1 = parseDateToUTC(date1Part);
        const d2 = parseDateToUTC(date2Part);
        return d1.getTime() < d2.getTime();
    } catch (error) {
        console.error('Error comparing dates for before:', { date1, date2, error });
        return false;
    }
}

/**
 * Get today in appropriate format for comparison
 */
export function getTodayString(): string {
    return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Get today's date as a Date object set to midnight local time.
 * This represents "today" from the user's perspective.
 */
export function getTodayLocal(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Parse a date string into a Date object that represents the calendar day
 * from the user's perspective. For date-only strings (YYYY-MM-DD), this
 * creates a date at midnight local time to ensure consistent behavior.
 */
export function parseDateAsLocal(dateString: string): Date {
    if (!dateString) {
        throw new Error('Date string cannot be empty');
    }
    
    const trimmed = dateString.trim();
    
    // For date-only strings, create a date at midnight local time
    const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateMatch) {
        const [, year, month, day] = dateMatch;
        const parsed = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
        
        if (!isValid(parsed) || parsed.getFullYear() !== parseInt(year, 10) || 
            parsed.getMonth() !== parseInt(month, 10) - 1 || parsed.getDate() !== parseInt(day, 10)) {
            throw new Error(`Invalid date values: ${dateString}`);
        }
        
        return parsed;
    }
    
    // For datetime strings, use the existing parseDate logic
    return parseDate(dateString);
}

/**
 * Normalize a date string to YYYY-MM-DD format for storage/comparison
 */
export function normalizeDateString(dateString: string): string {
    if (!dateString) {
        return dateString;
    }
    
    try {
        // For timezone-aware strings, extract just the date part directly
        if (dateString.includes('T') || dateString.includes('Z') || dateString.match(/[+-]\d{2}:\d{2}$/)) {
            // Extract date part before 'T' or timezone marker
            const datePart = dateString.split('T')[0];
            // Validate that it's a proper YYYY-MM-DD format
            if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                return datePart;
            }
        }
        
        // For non-timezone strings, parse and format
        const parsed = parseDate(dateString);
        if (isValid(parsed)) {
            return format(parsed, 'yyyy-MM-dd');
        }
        return dateString;
    } catch (error) {
        console.error('Error normalizing date string:', { dateString, error });
        return dateString; // Return original if parsing fails
    }
}

/**
 * Create a safe Date object for a specific year/month/day in local timezone
 */
export function createSafeDate(year: number, month: number, day: number): Date {
    // Note: month is 0-based in Date constructor
    return new Date(year, month, day);
}

/**
 * Create a safe UTC Date object for a specific year/month/day
 */
export function createSafeUTCDate(year: number, month: number, day: number): Date {
    // Note: month is 0-based in Date constructor
    return new Date(Date.UTC(year, month, day));
}

/**
 * Enhanced date validation that accepts both date-only and timezone-aware formats
 */
export function validateDateInput(dateValue: string): boolean {
    if (!dateValue || dateValue.trim() === '') {
        return true; // Empty is valid (optional field)
    }
    
    try {
        parseDate(dateValue);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Add days to a date string, returning a date string
 */
export function addDaysToDateString(dateString: string, days: number): string {
    try {
        const parsed = parseDate(dateString);
        const result = addDaysFns(parsed, days);
        return format(result, 'yyyy-MM-dd');
    } catch (error) {
        console.error('Error adding days to date string:', { dateString, days, error });
        throw error;
    }
}

/**
 * Add weeks to a date string, returning a date string
 */
export function addWeeksToDateString(dateString: string, weeks: number): string {
    try {
        const parsed = parseDate(dateString);
        const result = addWeeks(parsed, weeks);
        return format(result, 'yyyy-MM-dd');
    } catch (error) {
        console.error('Error adding weeks to date string:', { dateString, weeks, error });
        throw error;
    }
}

/**
 * Add months to a date string, returning a date string
 */
export function addMonthsToDateString(dateString: string, months: number): string {
    try {
        const parsed = parseDate(dateString);
        const result = addMonths(parsed, months);
        return format(result, 'yyyy-MM-dd');
    } catch (error) {
        console.error('Error adding months to date string:', { dateString, months, error });
        throw error;
    }
}

/**
 * Add years to a date string, returning a date string
 */
export function addYearsToDateString(dateString: string, years: number): string {
    try {
        const parsed = parseDate(dateString);
        const result = addYears(parsed, years);
        return format(result, 'yyyy-MM-dd');
    } catch (error) {
        console.error('Error adding years to date string:', { dateString, years, error });
        throw error;
    }
}

/**
 * Get start of week for today, returning a date string
 */
export function getStartOfWeekString(weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1): string {
    try {
        const result = startOfWeek(new Date(), { weekStartsOn });
        return format(result, 'yyyy-MM-dd');
    } catch (error) {
        console.error('Error getting start of week:', { error });
        throw error;
    }
}

/**
 * Get end of week for today, returning a date string
 */
export function getEndOfWeekString(weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1): string {
    try {
        const result = endOfWeek(new Date(), { weekStartsOn });
        return format(result, 'yyyy-MM-dd');
    } catch (error) {
        console.error('Error getting end of week:', { error });
        throw error;
    }
}

/**
 * Get start of month for today, returning a date string
 */
export function getStartOfMonthString(): string {
    try {
        const result = startOfMonth(new Date());
        return format(result, 'yyyy-MM-dd');
    } catch (error) {
        console.error('Error getting start of month:', { error });
        throw error;
    }
}

/**
 * Get end of month for today, returning a date string
 */
export function getEndOfMonthString(): string {
    try {
        const result = endOfMonth(new Date());
        return format(result, 'yyyy-MM-dd');
    } catch (error) {
        console.error('Error getting end of month:', { error });
        throw error;
    }
}

/**
 * Get start of year for today, returning a date string
 */
export function getStartOfYearString(): string {
    try {
        const result = startOfYear(new Date());
        return format(result, 'yyyy-MM-dd');
    } catch (error) {
        console.error('Error getting start of year:', { error });
        throw error;
    }
}

/**
 * Get end of year for today, returning a date string
 */
export function getEndOfYearString(): string {
    try {
        const result = endOfYear(new Date());
        return format(result, 'yyyy-MM-dd');
    } catch (error) {
        console.error('Error getting end of year:', { error });
        throw error;
    }
}

/**
 * Get start of day for a date string, preserving the date format
 */
export function startOfDayForDateString(dateString: string): Date {
    try {
        const parsed = parseDate(dateString);
        return startOfDay(parsed);
    } catch (error) {
        console.error('Error getting start of day for date string:', { dateString, error });
        throw error;
    }
}

/**
 * Check if a date string represents today
 */
export function isToday(dateString: string): boolean {
    if (!dateString) return false;
    try {
        const date = parseDateAsLocal(dateString);
        const today = getTodayLocal();
        return isSameDay(date, today);
    } catch (error) {
        console.error('Error checking if date is today:', { dateString, error });
        return false;
    }
}

/**
 * Check if a date string represents a past date (before today)
 */
export function isPastDate(dateString: string): boolean {
    return isBeforeDateSafe(dateString, getTodayString());
}

/**
 * Format a date string for user display
 */
export function formatDateForDisplay(dateString: string, formatString = 'MMM d, yyyy'): string {
    try {
        const parsed = parseDate(dateString);
        return format(parsed, formatString);
    } catch (error) {
        console.error('Error formatting date for display:', { dateString, error });
        return dateString; // Return original if formatting fails
    }
}

/**
 * Get current timestamp in local timezone ISO format for consistent timestamp generation
 */
export function getCurrentTimestamp(): string {
    const now = new Date();
    const tzOffset = -now.getTimezoneOffset();
    const diff = tzOffset >= 0 ? '+' : '-';
    const pad = (num: number) => String(Math.abs(num)).padStart(2, '0');
    
    const tzOffsetHours = pad(Math.floor(Math.abs(tzOffset) / 60));
    const tzOffsetMinutes = pad(Math.abs(tzOffset) % 60);
    
    // Get local date/time components
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${diff}${tzOffsetHours}:${tzOffsetMinutes}`;
}

/**
 * Get current date in YYYY-MM-DD format for completion dates
 */
export function getCurrentDateString(): string {
    return formatDateForStorage(new Date());
}

/**
 * Safe timestamp parsing for display and comparison
 */
export function parseTimestamp(timestampString: string): Date {
    try {
        if (!timestampString) {
            throw new Error('Timestamp string cannot be empty');
        }
        
        // Always use parseISO for timestamps as they should be in ISO format
        const parsed = parseISO(timestampString);
        if (!isValid(parsed)) {
            throw new Error(`Invalid timestamp: ${timestampString}`);
        }
        return parsed;
    } catch (error) {
        console.error('Error parsing timestamp:', { timestampString, error });
        throw error;
    }
}

/**
 * Format timestamp for display in user's timezone
 */
export function formatTimestampForDisplay(timestampString: string, formatString = 'MMM d, yyyy h:mm a'): string {
    if (!timestampString) {
        return timestampString;
    }
    
    try {
        const parsed = parseTimestamp(timestampString);
        if (isValid(parsed)) {
            return format(parsed, formatString);
        }
        return timestampString;
    } catch (error) {
        console.error('Error formatting timestamp for display:', { timestampString, error });
        return timestampString; // Return original if formatting fails
    }
}

// ==========================================
// TIME-AWARE DATE UTILITIES
// ==========================================

/**
 * Check if a date string contains time information
 */
export function hasTimeComponent(dateString: string): boolean {
    if (!dateString) return false;
    // Check for 'T' followed by time pattern (HH:mm or HH:mm:ss)
    return /T\d{2}:\d{2}/.test(dateString);
}

/**
 * Extract just the date part from a date or datetime string
 */
export function getDatePart(dateString: string): string {
    if (!dateString) return '';
    
    try {
        // If it's already a date-only string (YYYY-MM-DD), return as-is
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            return dateString;
        }
        
        // For datetime strings, extract just the date part
        const tIndex = dateString.indexOf('T');
        if (tIndex > -1) {
            return dateString.substring(0, tIndex);
        }
        
        // For other formats, parse and format using local date
        const parsed = parseDate(dateString);
        return format(parsed, 'yyyy-MM-dd');
    } catch (error) {
        console.error('Error extracting date part:', { dateString, error });
        return dateString;
    }
}

/**
 * Extract just the time part from a datetime string, returns null if no time
 */
export function getTimePart(dateString: string): string | null {
    if (!dateString || !hasTimeComponent(dateString)) {
        return null;
    }
    
    try {
        const parsed = parseDate(dateString);
        return format(parsed, 'HH:mm');
    } catch (error) {
        console.error('Error extracting time part:', { dateString, error });
        return null;
    }
}

/**
 * Combine a date and time into a datetime string
 */
export function combineDateAndTime(dateString: string, timeString: string): string {
    if (!dateString) return '';
    if (!timeString) return dateString;
    
    try {
        // For date-only strings (YYYY-MM-DD), use them directly without parsing
        // This avoids timezone shifts when parsing and reformatting
        const dateOnlyMatch = dateString.match(/^(\d{4}-\d{2}-\d{2})$/);
        if (dateOnlyMatch) {
            // Validate time format (HH:mm)
            if (!/^\d{2}:\d{2}$/.test(timeString)) {
                console.warn('Invalid time format, expected HH:mm:', timeString);
                return dateString;
            }
            return `${dateOnlyMatch[1]}T${timeString}`;
        }
        
        // For datetime strings, extract the date part
        const datePart = getDatePart(dateString);
        
        // Validate that we got a valid date part (YYYY-MM-DD format)
        if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
            console.warn('Invalid date part from dateString:', { dateString, datePart });
            return dateString;
        }
        
        // Validate time format (HH:mm)
        if (!/^\d{2}:\d{2}$/.test(timeString)) {
            console.warn('Invalid time format, expected HH:mm:', timeString);
            return dateString;
        }
        
        return `${datePart}T${timeString}`;
    } catch (error) {
        console.error('Error combining date and time:', { dateString, timeString, error });
        return dateString;
    }
}

/**
 * Format a date/datetime string for display, showing time if available
 */
export function formatDateTimeForDisplay(dateString: string, options: {
    dateFormat?: string;
    timeFormat?: string;
    showTime?: boolean;
} = {}): string {
    if (!dateString) return '';
    
    const {
        dateFormat = 'MMM d, yyyy',
        timeFormat = 'h:mm a',
        showTime = true
    } = options;
    
    try {
        const parsed = parseDate(dateString);
        const hasTime = hasTimeComponent(dateString);
        
        if (hasTime && showTime) {
            // Handle empty dateFormat case (e.g., for "Today at" scenarios)
            if (!dateFormat || dateFormat.trim() === '') {
                return format(parsed, timeFormat);
            } else {
                return format(parsed, `${dateFormat} ${timeFormat}`);
            }
        } else {
            // For date-only, return the dateFormat or fallback
            if (!dateFormat || dateFormat.trim() === '') {
                return ''; // Return empty for time-only requests when no time available
            } else {
                return format(parsed, dateFormat);
            }
        }
    } catch (error) {
        console.error('Error formatting datetime for display:', { dateString, error });
        return dateString;
    }
}

/**
 * Time-aware comparison for before/after relationships
 * For date-only strings, treats them as end-of-day for sorting purposes
 */
export function isBeforeDateTimeAware(date1: string, date2: string): boolean {
    try {
        // Use appropriate parsing based on whether the string has time
        const d1 = hasTimeComponent(date1) ? parseDateToLocal(date1) : parseDateToUTC(date1);
        const d2 = hasTimeComponent(date2) ? parseDateToLocal(date2) : parseDateToUTC(date2);
        
        // If both have time, direct comparison
        if (hasTimeComponent(date1) && hasTimeComponent(date2)) {
            return d1.getTime() < d2.getTime();
        }
        
        // If neither has time, compare UTC anchors directly
        if (!hasTimeComponent(date1) && !hasTimeComponent(date2)) {
            return d1.getTime() < d2.getTime();
        }
        
        // Mixed case: treat date-only as end-of-day for sorting
        const d1Normalized = hasTimeComponent(date1) ? d1 : endOfDay(parseDateToLocal(date1));
        const d2Normalized = hasTimeComponent(date2) ? d2 : endOfDay(parseDateToLocal(date2));
        
        return d1Normalized.getTime() < d2Normalized.getTime();
    } catch (error) {
        console.error('Error comparing dates time-aware:', { date1, date2, error });
        return false;
    }
}

/**
 * Check if a date/datetime is overdue (past current date/time)
 * Uses UTC anchor principle for consistent comparisons
 */
export function isOverdueTimeAware(dateString: string, isCompleted?: boolean, hideCompletedFromOverdue?: boolean): boolean {
    if (!dateString) return false;
    
    // If the setting is enabled and task is completed, don't consider it overdue
    if (hideCompletedFromOverdue && isCompleted) {
        return false;
    }
    
    try {
        const now = new Date();
        const taskDateUTC = parseDateToUTC(dateString); // Task's UTC anchor
        
        if (hasTimeComponent(dateString)) {
            // Task has a specific time; it's overdue if that moment has passed
            return isBefore(taskDateUTC, now);
        } else {
            // Task is date-only. It's overdue if the UTC anchor is before
            // the start of the user's current local day
            const todayLocalStart = startOfDay(new Date()); // User's midnight
            return isBefore(taskDateUTC, todayLocalStart);
        }
    } catch (error) {
        console.error('Error checking overdue status:', { dateString, error });
        return false;
    }
}

/**
 * Check if a date/datetime represents today (time-aware)
 */
export function isTodayTimeAware(dateString: string): boolean {
    if (!dateString) return false;
    
    try {
        const taskDate = hasTimeComponent(dateString) ? parseDate(dateString) : parseDateAsLocal(dateString);
        const now = new Date();
        
        return isSameDay(taskDate, now);
    } catch (error) {
        console.error('Error checking if today:', { dateString, error });
        return false;
    }
}

/**
 * Validate datetime input (supports both date-only and date+time)
 */
export function validateDateTimeInput(dateValue: string, timeValue?: string): boolean {
    if (!dateValue || dateValue.trim() === '') {
        return true; // Empty is valid (optional field)
    }
    
    try {
        // Validate date part
        if (!validateDateInput(dateValue)) {
            return false;
        }
        
        // If time is provided, validate it
        if (timeValue && timeValue.trim() !== '') {
            // Check for HH:mm format
            if (!/^\d{2}:\d{2}$/.test(timeValue)) {
                return false;
            }
            
            // Validate the combined datetime
            const combined = combineDateAndTime(dateValue, timeValue);
            return validateDateInput(combined);
        }
        
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Validates and filters a complete_instances array to contain only valid YYYY-MM-DD dates
 * This prevents issues with invalid time-only entries like "T00:00"
 */
export function validateCompleteInstances(instances: any[]): string[] {
    if (!Array.isArray(instances)) {
        return [];
    }
    
    return instances
        .filter(instance => {
            // Must be a non-empty string
            if (typeof instance !== 'string' || !instance.trim()) {
                return false;
            }
            
            const trimmed = instance.trim();
            
            // Skip obviously invalid time-only formats like "T00:00" before regex check
            if (trimmed.startsWith('T') && /^T\d{2}:\d{2}(:\d{2})?/.test(trimmed)) {
                // Skipping invalid time-only entry
                return false;
            }
            
            // Must match YYYY-MM-DD format exactly
            if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                // Invalid entry (not YYYY-MM-DD format)
                return false;
            }
            
            // Must be a valid date (this should not fail for YYYY-MM-DD format, but check anyway)
            try {
                parseDate(trimmed);
                return true;
            } catch (error) {
                console.warn('Invalid complete_instances entry (date parsing failed):', instance, error);
                return false;
            }
        })
        .map(instance => instance.trim());
}

/**
 * Get current date+time in local timezone as YYYY-MM-DDTHH:mm format
 */
export function getCurrentDateTimeString(): string {
    const now = new Date();
    return format(now, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Add days to a date/datetime string, preserving time if present
 */
export function addDaysToDateTime(dateString: string, days: number): string {
    try {
        const parsed = parseDate(dateString);
        const result = addDaysFns(parsed, days);
        
        // Preserve time format if original had time
        if (hasTimeComponent(dateString)) {
            return format(result, "yyyy-MM-dd'T'HH:mm");
        } else {
            return format(result, 'yyyy-MM-dd');
        }
    } catch (error) {
        console.error('Error adding days to datetime:', { dateString, days, error });
        throw error;
    }
}

/**
 * Create a UTC date at midnight for RRULE dtstart to avoid timezone issues
 * This ensures that the day of the week is preserved correctly for recurrence calculations
 */
export function createUTCDateForRRule(dateString: string): Date {
    try {
        // Extract just the date part directly from the string
        // Don't use getDatePart as it can cause timezone shifts
        const dateOnlyMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!dateOnlyMatch) {
            throw new Error(`Invalid date format for RRULE: ${dateString}`);
        }
        
        const [, year, month, day] = dateOnlyMatch;
        const yearNum = parseInt(year, 10);
        const monthNum = parseInt(month, 10);
        const dayNum = parseInt(day, 10);
        
        // Validate date values
        if (monthNum < 1 || monthNum > 12) {
            throw new Error(`Invalid month in date: ${dateString}`);
        }
        
        if (dayNum < 1 || dayNum > 31) {
            throw new Error(`Invalid day in date: ${dateString}`);
        }
        
        // Create UTC date at midnight to preserve the correct day of week
        const utcDate = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));
        
        // Additional validation: check if the resulting date matches input
        // This catches cases like Feb 30th, which would roll over to March
        if (utcDate.getUTCFullYear() !== yearNum || 
            utcDate.getUTCMonth() !== monthNum - 1 || 
            utcDate.getUTCDate() !== dayNum) {
            throw new Error(`Invalid date values: ${dateString}`);
        }
        
        return utcDate;
    } catch (error) {
        console.error('Error creating UTC date for RRULE:', { dateString, error });
        throw error;
    }
}

/**
 * Create a UTC date that represents the start of a calendar day
 * This is used when converting user-selected dates to UTC for storage
 * @param localDate - A date object representing a calendar date in local time
 * @returns A UTC date representing midnight UTC on that calendar date
 */
export function createUTCDateFromLocalCalendarDate(localDate: Date): Date {
    // Extract the local date components
    const year = localDate.getFullYear();
    const month = localDate.getMonth();
    const day = localDate.getDate();
    
    // Create a UTC date for that calendar date
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

/**
 * Checks if a UTC-anchored date object represents the user's local "today".
 * This is timezone-safe unlike date-fns isToday() which can give wrong results
 * for UTC-anchored dates in non-UTC timezones.
 * 
 * @param date - A UTC-anchored Date object (e.g., 2024-10-26T00:00:00.000Z)
 * @returns true if the date represents today's calendar date for the user
 */
export function isTodayUTC(date: Date): boolean {
    try {
        // Get today's calendar date in the user's local timezone
        const todayLocal = getTodayLocal();
        
        // Convert today to a UTC anchor for comparison
        const todayUTCAnchor = createUTCDateFromLocalCalendarDate(todayLocal);
        
        // Compare the UTC date components (timezone-safe)
        return date.getUTCFullYear() === todayUTCAnchor.getUTCFullYear() &&
               date.getUTCMonth() === todayUTCAnchor.getUTCMonth() &&
               date.getUTCDate() === todayUTCAnchor.getUTCDate();
    } catch (error) {
        console.error('Error in isTodayUTC:', error);
        return false;
    }
}

/**
 * Convert FullCalendar's date boundaries to UTC for consistent RRULE processing
 * This prevents off-by-one errors when calendar view boundaries don't align with RRule timezone
 */
export function normalizeCalendarBoundariesToUTC(startDate: Date, endDate: Date): { utcStart: Date, utcEnd: Date } {
    try {
        // Convert calendar boundaries to YYYY-MM-DD format first to normalize
        const startDateStr = format(startDate, 'yyyy-MM-dd');
        const endDateStr = format(endDate, 'yyyy-MM-dd');
        
        // Create UTC dates at midnight for consistent boundary handling
        const utcStart = createUTCDateForRRule(startDateStr);
        const utcEnd = createUTCDateForRRule(endDateStr);
        
        return { utcStart, utcEnd };
    } catch (error) {
        console.error('Error normalizing calendar boundaries to UTC:', { startDate, endDate, error });
        throw error;
    }
}


/**
 * Format a date as UTC YYYY-MM-DD for RRule operations
 * This is specifically for RRule which requires UTC dates
 */
export function formatDateAsUTCString(date: Date): string {
    try {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error('Error formatting date as UTC string:', { date, error });
        // Fallback to ISO string date part
        return date.toISOString().split('T')[0];
    }
}

/**
 * Format a date to YYYY-MM-DD string using local time methods
 * This ensures consistent date representation across all timezones.
 * 
 * IMPORTANT: This function now uses UTC methods to prevent timezone-dependent
 * date shifts. A task due at "2024-10-01T23:00:00Z" will always format as
 * "2024-10-01" regardless of the user's timezone.
 * 
 * @param date - Date object (can represent any moment in time)
 * @returns YYYY-MM-DD string representing the UTC calendar date
 */
export function formatDateForStorage(date: Date): string {
    try {
        // Validate input
        if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
            console.warn('formatDateForStorage received invalid date:', date);
            return '';
        }
        
        // Use UTC methods to extract date components
        // This ensures the same date string regardless of user timezone
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error('Error formatting date for storage:', { date, error });
        // Return empty string for invalid dates rather than potentially incorrect fallback
        return '';
    }
}

/**
 * Generate UTC dates for calendar display, avoiding timezone issues
 * This replaces date-fns calendar generation with consistent UTC dates
 */
export function generateUTCCalendarDates(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    
    // Convert to UTC date strings and back to ensure consistent UTC dates
    const startDateStr = formatDateForStorage(startDate);
    const endDateStr = formatDateForStorage(endDate);
    
    const current = createUTCDateForRRule(startDateStr);
    const end = createUTCDateForRRule(endDateStr);
    
    while (current <= end) {
        dates.push(new Date(current));
        current.setUTCDate(current.getUTCDate() + 1);
    }
    
    return dates;
}

/**
 * Get the start of week for a UTC date, returning a UTC date
 */
export function getUTCStartOfWeek(date: Date, weekStartsOn = 1): Date {
    const utcDate = createUTCDateForRRule(formatDateForStorage(date));
    const dayOfWeek = utcDate.getUTCDay();
    const diff = (dayOfWeek - weekStartsOn + 7) % 7;
    const startOfWeek = new Date(utcDate);
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - diff);
    return startOfWeek;
}

/**
 * Get the end of week for a UTC date, returning a UTC date
 */
export function getUTCEndOfWeek(date: Date, weekStartsOn = 1): Date {
    const startOfWeek = getUTCStartOfWeek(date, weekStartsOn);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setUTCDate(endOfWeek.getUTCDate() + 6);
    return endOfWeek;
}

/**
 * Get the start of month for a UTC date, returning a UTC date
 */
export function getUTCStartOfMonth(date: Date): Date {
    const utcDate = createUTCDateForRRule(formatDateForStorage(date));
    return new Date(Date.UTC(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), 1));
}

/**
 * Get the end of month for a UTC date, returning a UTC date
 */
export function getUTCEndOfMonth(date: Date): Date {
    const utcDate = createUTCDateForRRule(formatDateForStorage(date));
    return new Date(Date.UTC(utcDate.getUTCFullYear(), utcDate.getUTCMonth() + 1, 0));
}

/**
 * Natural language date terms that can be resolved to actual dates
 */
export const NATURAL_LANGUAGE_DATE_PATTERNS = {
    // Common relative days - most frequently used patterns
    'today': () => getTodayString(),
    'tomorrow': () => addDaysToDateString(getTodayString(), 1),
    'yesterday': () => addDaysToDateString(getTodayString(), -1),
    
    // Simple week patterns - simplified to avoid date-fns boundary functions
    'next week': () => addDaysToDateString(getTodayString(), 7),
    'last week': () => addDaysToDateString(getTodayString(), -7)
} as const;

/**
 * Check if a string is a natural language date pattern
 */
export function isNaturalLanguageDate(value: string): boolean {
    if (!value || typeof value !== 'string') {
        return false;
    }
    
    const normalized = value.toLowerCase().trim().replace(/\s+/g, ' ');
    
    // Check exact matches
    if (normalized in NATURAL_LANGUAGE_DATE_PATTERNS) {
        return true;
    }
    
    // Check relative patterns like "in 3 days", "2 weeks ago"
    const relativePatterns = [
        /^in\s+(\d+)\s+(days?)$/,
        /^(\d+)\s+(days?)\s+ago$/,
        /^in\s+(\d+)\s+(weeks?)$/,
        /^(\d+)\s+(weeks?)\s+ago$/
    ];
    
    return relativePatterns.some(pattern => pattern.test(normalized));
}

/**
 * Check if a date input string is valid (either natural language or ISO date)
 */
export function isValidDateInput(value: string): boolean {
    if (typeof value !== 'string') {
        return false;
    }
    
    const trimmed = value.trim();
    if (trimmed === '') {
        return true; // Empty is valid (no filter)
    }
    
    // Check if it's a natural language date
    if (isNaturalLanguageDate(trimmed)) {
        return true;
    }
    
    // Check if it's a valid ISO date format
    try {
        const parsed = parseDate(trimmed);
        return isValid(parsed);
    } catch {
        return false;
    }
}

/**
 * Resolve a natural language date string to an actual date string (YYYY-MM-DD format)
 * Returns the original string if it's not a recognized natural language pattern
 */
export function resolveNaturalLanguageDate(value: string): string {
    if (!value || typeof value !== 'string') {
        return value;
    }
    
    const normalized = value.toLowerCase().trim().replace(/\s+/g, ' ');
    
    // Check exact matches first
    if (normalized in NATURAL_LANGUAGE_DATE_PATTERNS) {
        try {
            return NATURAL_LANGUAGE_DATE_PATTERNS[normalized as keyof typeof NATURAL_LANGUAGE_DATE_PATTERNS]();
        } catch (error) {
            console.error('Error resolving natural language date:', { value, error });
            return value;
        }
    }
    
    // Handle relative patterns like "in 3 days", "2 weeks ago"
    try {
        // "in X days" pattern (handle flexible whitespace)
        let match = normalized.match(/^in\s+(\d+)\s+(days?)$/);
        if (match) {
            const days = parseInt(match[1], 10);
            return addDaysToDateString(getTodayString(), days);
        }
        
        // "X days ago" pattern (handle flexible whitespace)
        match = normalized.match(/^(\d+)\s+(days?)\s+ago$/);
        if (match) {
            const days = parseInt(match[1], 10);
            return addDaysToDateString(getTodayString(), -days);
        }
        
        // "in X weeks" pattern (handle flexible whitespace)
        match = normalized.match(/^in\s+(\d+)\s+(weeks?)$/);
        if (match) {
            const weeks = parseInt(match[1], 10);
            return addWeeksToDateString(getTodayString(), weeks);
        }
        
        // "X weeks ago" pattern (handle flexible whitespace)
        match = normalized.match(/^(\d+)\s+(weeks?)\s+ago$/);
        if (match) {
            const weeks = parseInt(match[1], 10);
            return addWeeksToDateString(getTodayString(), -weeks);
        }
        
    } catch (error) {
        console.error('Error parsing relative natural language date:', { value, error });
    }
    
    // Return original value if not a natural language pattern
    return value;
}

/**
 * Get all supported natural language date patterns for UI suggestions
 */
export function getNaturalLanguageDateSuggestions(): string[] {
    const exactPatterns = Object.keys(NATURAL_LANGUAGE_DATE_PATTERNS);
    const relativeExamples = [
        'in 3 days',
        '2 days ago', 
        'in 1 week',
        '2 weeks ago'
    ];
    
    return [...exactPatterns, ...relativeExamples].sort();
}