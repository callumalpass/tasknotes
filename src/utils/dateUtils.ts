import { format, parseISO, isSameDay, isBefore, isValid, startOfDay, addDays as addDaysFns, endOfDay } from 'date-fns';

/**
 * Smart date parsing that detects timezone info and handles appropriately
 * Supports various date formats including space-separated datetime and ISO week formats
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
            
            console.debug('Successfully parsed ISO week format:', { 
                original: dateString, 
                result: targetWeekMonday.toISOString() 
            });
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
            
            console.debug('Successfully parsed space-separated datetime:', { 
                original: dateString, 
                converted: isoFormat, 
                result: parsed.toISOString() 
            });
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
            
            console.debug('Successfully parsed timezone-aware date:', { 
                original: dateString, 
                result: parsed.toISOString() 
            });
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
            
            console.debug('Successfully parsed date-only string:', { 
                original: dateString, 
                result: parsed.toISOString() 
            });
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
 * Safe date comparison that handles mixed timezone contexts
 */
export function isSameDateSafe(date1: string, date2: string): boolean {
    try {
        const d1 = parseDate(date1);
        const d2 = parseDate(date2);
        return isSameDay(d1, d2);
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
        const d1 = startOfDay(parseDate(date1));
        const d2 = startOfDay(parseDate(date2));
        return isBefore(d1, d2);
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
    return isSameDateSafe(dateString, getTodayString());
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
    return format(new Date(), 'yyyy-MM-dd');
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
        // Parse the date part
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
        const d1 = parseDate(date1);
        const d2 = parseDate(date2);
        
        // If both have time, direct comparison
        if (hasTimeComponent(date1) && hasTimeComponent(date2)) {
            return isBefore(d1, d2);
        }
        
        // If neither has time, compare dates only
        if (!hasTimeComponent(date1) && !hasTimeComponent(date2)) {
            return isBefore(startOfDay(d1), startOfDay(d2));
        }
        
        // Mixed case: treat date-only as end-of-day for sorting
        const d1Normalized = hasTimeComponent(date1) ? d1 : endOfDay(d1);
        const d2Normalized = hasTimeComponent(date2) ? d2 : endOfDay(d2);
        
        return isBefore(d1Normalized, d2Normalized);
    } catch (error) {
        console.error('Error comparing dates time-aware:', { date1, date2, error });
        return false;
    }
}

/**
 * Check if a date/datetime is overdue (past current date/time)
 */
export function isOverdueTimeAware(dateString: string): boolean {
    if (!dateString) return false;
    
    try {
        const taskDate = parseDate(dateString);
        const now = new Date();
        
        // If task has time, compare with current date/time
        if (hasTimeComponent(dateString)) {
            return isBefore(taskDate, now);
        }
        
        // If task is date-only, it's overdue if the date is before today
        const today = startOfDay(now);
        const taskDateStart = startOfDay(taskDate);
        return isBefore(taskDateStart, today);
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
        const taskDate = parseDate(dateString);
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
            
            // Must match YYYY-MM-DD format exactly
            if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                console.warn('Invalid complete_instances entry (not YYYY-MM-DD format):', instance);
                return false;
            }
            
            // Must be a valid date
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
        // Extract just the date part to avoid any time/timezone complications
        const datePart = getDatePart(dateString);
        const dateMatch = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        
        if (!dateMatch) {
            throw new Error(`Invalid date format for RRULE: ${dateString}`);
        }
        
        const [, year, month, day] = dateMatch;
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
 * Format a UTC date from RRule back to YYYY-MM-DD string without timezone conversion
 * This prevents the date from shifting when displayed on calendar
 */
export function formatUTCDateForCalendar(utcDate: Date): string {
    try {
        // Use UTC methods to extract date components without timezone conversion
        const year = utcDate.getUTCFullYear();
        const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(utcDate.getUTCDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error('Error formatting UTC date for calendar:', { utcDate, error });
        // Fallback to ISO string date part extraction
        return utcDate.toISOString().split('T')[0];
    }
}