import { format } from 'date-fns';
import { normalizePath } from 'obsidian';
import { TaskNotesSettings } from '../settings/settings';

export interface FilenameContext {
    title: string;
    priority: string;
    status: string;
    date?: Date;
}

/**
 * Generates a filename based on the configured format and context
 */
export function generateTaskFilename(
    context: FilenameContext, 
    settings: TaskNotesSettings
): string {
    // Validate inputs
    if (!context || !settings) {
        throw new Error('Invalid context or settings provided');
    }
    
    if (!context.title || typeof context.title !== 'string') {
        throw new Error('Context must have a valid title');
    }
    
    // Validate title content
    if (context.title.trim().length === 0) {
        throw new Error('Title cannot be empty');
    }
    
    if (context.title.length > 200) {
        throw new Error('Title too long for filename generation');
    }
    
    const now = context.date || new Date();
    
    // Validate date
    if (!(now instanceof Date) || isNaN(now.getTime())) {
        throw new Error('Invalid date provided in context');
    }
    
    try {
        switch (settings.taskFilenameFormat) {
            case 'title':
                return sanitizeForFilename(context.title);
                
            case 'zettel':
                return generateZettelId(now);
                
            case 'timestamp':
                return generateTimestampFilename(now);
                
            case 'custom':
                return generateCustomFilename(context, settings.customFilenameTemplate, now);
                
            default:
                // Fallback to zettel format
                return generateZettelId(now);
        }
    } catch (error) {
        console.error('Error generating filename:', error);
        // Fallback to safe zettel format
        return generateZettelId(now);
    }
}

/**
 * Generates the traditional zettelkasten ID (YYMMDD + base36 seconds since midnight)
 */
function generateZettelId(date: Date): string {
    const datePart = format(date, 'yyMMdd');
    
    // Calculate seconds since midnight
    const midnight = new Date(date);
    midnight.setHours(0, 0, 0, 0);
    const secondsSinceMidnight = Math.floor((date.getTime() - midnight.getTime()) / 1000);
    
    // Convert to base36 for compactness
    const randomPart = secondsSinceMidnight.toString(36);
    
    return `${datePart}${randomPart}`;
}

/**
 * Generates a timestamp-based filename (YYYY-MM-DD-HHMMSS)
 */
function generateTimestampFilename(date: Date): string {
    return format(date, 'yyyy-MM-dd-HHmmss');
}

/**
 * Generates a filename based on a custom template
 */
function generateCustomFilename(
    context: FilenameContext, 
    template: string, 
    date: Date
): string {
    // Validate inputs
    if (!context || !template || !date) {
        throw new Error('Invalid inputs for custom filename generation');
    }
    
    if (typeof template !== 'string' || template.trim().length === 0) {
        throw new Error('Template must be a non-empty string');
    }
    
    if (!(date instanceof Date) || isNaN(date.getTime())) {
        throw new Error('Invalid date for filename generation');
    }
    
    try {
        // Validate and sanitize context values
        const sanitizedTitle = sanitizeForFilename(context.title);
        const sanitizedPriority = (context.priority && ['low', 'normal', 'medium', 'high'].includes(context.priority)) ? context.priority : 'normal';
        const sanitizedStatus = (context.status && ['open', 'in-progress', 'done', 'scheduled'].includes(context.status)) ? context.status : 'open';
        
        const variables: Record<string, string> = {
            title: sanitizedTitle,
            date: format(date, 'yyyy-MM-dd'),
            time: format(date, 'HHmmss'),
            priority: sanitizedPriority,
            status: sanitizedStatus,
            timestamp: format(date, 'yyyy-MM-dd-HHmmss'),
            dateTime: format(date, 'yyyy-MM-dd-HHmm'),
            year: format(date, 'yyyy'),
            month: format(date, 'MM'),
            day: format(date, 'dd'),
            hour: format(date, 'HH'),
            minute: format(date, 'mm'),
            second: format(date, 'ss')
        };
        
        let result = template;
        
        // Validate template length
        if (template.length > 500) {
            throw new Error('Template too long');
        }
        
        // Replace all variables in the template
        Object.entries(variables).forEach(([key, value]) => {
            try {
                const regex = new RegExp(`\\{${key}\\}`, 'g');
                result = result.replace(regex, value);
            } catch (regexError) {
                console.warn(`Error replacing template variable ${key}:`, regexError);
            }
        });
        
        // Clean up any remaining unreplaced variables
        result = result.replace(/\{[^}]+\}/g, '');
        
        // Ensure we have a valid filename
        if (!result.trim()) {
            result = sanitizedTitle || generateZettelId(date);
        }
        
        return sanitizeForFilename(result);
    } catch (error) {
        console.error('Error generating custom filename:', error);
        // Fallback to safe title-based filename
        return sanitizeForFilename(context.title) || generateZettelId(date);
    }
}

/**
 * Sanitizes a string to be safe for use as a filename
 */
function sanitizeForFilename(input: string): string {
    if (!input || typeof input !== 'string') {
        return 'untitled';
    }
    
    try {
        // Remove or replace problematic characters
        let sanitized = input
            .trim()
            // Replace multiple spaces with single space
            .replace(/\s+/g, ' ')
            // Remove characters that are problematic in filenames (but keep spaces!)
            .replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '')
            // Remove control characters and other dangerous chars
            .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
            // Remove leading/trailing dots
            .replace(/^\.+|\.+$/g, '')
            // Limit length to reasonable size (100 chars leaves room for extensions)
            .substring(0, 100)
            // Final trim in case we removed characters at the edges
            .trim();
        
        // Additional validation
        if (!sanitized || sanitized.length === 0) {
            sanitized = 'untitled';
        }
        
        // Validate against reserved names (Windows)
        const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
        if (reservedNames.includes(sanitized.toUpperCase())) {
            sanitized = `task-${sanitized}`;
        }
        
        return sanitized;
    } catch (error) {
        console.error('Error sanitizing filename:', error);
        return 'untitled';
    }
}

/**
 * Checks if a filename would be valid and unique
 */
export function validateFilename(filename: string): {
    isValid: boolean;
    error?: string;
    sanitized?: string;
} {
    if (!filename || !filename.trim()) {
        return {
            isValid: false,
            error: 'Filename cannot be empty'
        };
    }
    
    const sanitized = sanitizeForFilename(filename);
    
    if (!sanitized) {
        return {
            isValid: false,
            error: 'Filename contains only invalid characters'
        };
    }
    
    if (sanitized.length > 255) {
        return {
            isValid: false,
            error: 'Filename is too long (max 255 characters)'
        };
    }
    
    return {
        isValid: true,
        sanitized
    };
}

/**
 * Generates a unique filename by appending a number if needed
 */
export async function generateUniqueFilename(
    baseFilename: string,
    folderPath: string,
    vault: any // Obsidian Vault
): Promise<string> {
    // Validate inputs
    if (!baseFilename || typeof baseFilename !== 'string') {
        throw new Error('Base filename must be a non-empty string');
    }
    
    if (typeof folderPath !== 'string') {
        throw new Error('Folder path must be a string');
    }
    
    if (!vault) {
        throw new Error('Vault must be provided');
    }
    
    // Sanitize inputs
    const sanitizedFilename = sanitizeForFilename(baseFilename);
    if (!sanitizedFilename) {
        throw new Error('Base filename cannot be sanitized to a valid name');
    }
    
    // Validate folder path
    const sanitizedFolderPath = folderPath.replace(/\.\./g, '').trim();
    
    try {
        const basePath = normalizePath(`${sanitizedFolderPath}/${sanitizedFilename}.md`);
        
        // Validate path length
        if (basePath.length > 260) { // Windows path limit
            throw new Error('Generated path too long');
        }
        
        // Check if the base filename is available
        if (!vault.getAbstractFileByPath(basePath)) {
            return sanitizedFilename;
        }
        
        // If not, try appending numbers
        for (let i = 2; i <= 999; i++) {
            const candidateFilename = `${sanitizedFilename}-${i}`;
            const candidatePath = normalizePath(`${sanitizedFolderPath}/${candidateFilename}.md`);
            
            // Check path length for each candidate
            if (candidatePath.length > 260) {
                break; // Stop if paths become too long
            }
            
            if (!vault.getAbstractFileByPath(candidatePath)) {
                return candidateFilename;
            }
        }
        
        // If we get here, generate a unique ID fallback
        const timestamp = Date.now().toString(36);
        const fallbackFilename = `${sanitizedFilename.substring(0, 50)}-${timestamp}`;
        
        return sanitizeForFilename(fallbackFilename);
    } catch (error) {
        console.error('Error generating unique filename:', error);
        // Final fallback with timestamp
        const timestamp = Date.now().toString(36);
        return `task-${timestamp}`;
    }
}