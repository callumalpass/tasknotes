import { Editor, TFile, Notice, EditorPosition } from 'obsidian';
import TaskNotesPlugin from '../main';
import { TasksPluginParser, ParsedTaskData } from '../utils/TasksPluginParser';
import { getCurrentTimestamp } from '../utils/dateUtils';
import { calculateDefaultDate } from '../utils/helpers';
import { StatusManager } from './StatusManager';
import { PriorityManager } from './PriorityManager';

export class InstantTaskConvertService {
    private plugin: TaskNotesPlugin;
    private statusManager: StatusManager;
    private priorityManager: PriorityManager;

    constructor(
        plugin: TaskNotesPlugin,
        statusManager: StatusManager,
        priorityManager: PriorityManager
    ) {
        this.plugin = plugin;
        this.statusManager = statusManager;
        this.priorityManager = priorityManager;
    }

    /**
     * Instantly convert a checkbox task to a TaskNote without showing the modal
     * Supports multi-line selection where additional lines become task details
     */
    async instantConvertTask(editor: Editor, lineNumber: number): Promise<void> {
        try {
            // Validate input parameters
            const validationResult = this.validateInputParameters(editor, lineNumber);
            if (!validationResult.isValid) {
                new Notice(validationResult.error || 'Invalid input parameters.');
                return;
            }

            // Check for multi-line selection and extract details
            const selectionInfo = this.extractSelectionInfo(editor, lineNumber);
            const currentLine = selectionInfo.taskLine;
            const details = selectionInfo.details;
            
            
            // Parse the current line for Tasks plugin format
            const taskLineInfo = TasksPluginParser.parseTaskLine(currentLine);
            
            if (!taskLineInfo.isTaskLine) {
                new Notice('Current line is not a task.');
                return;
            }
            
            if (taskLineInfo.error) {
                new Notice(`Error parsing task: ${taskLineInfo.error}`);
                return;
            }
            
            if (!taskLineInfo.parsedData) {
                new Notice('Failed to parse task data from current line.');
                return;
            }

            // Validate task data before proceeding
            const taskValidation = this.validateTaskData(taskLineInfo.parsedData);
            if (!taskValidation.isValid) {
                new Notice(taskValidation.error || 'Invalid task data.');
                return;
            }

            // Create the task file with default settings and details
            const file = await this.createTaskFile(taskLineInfo.parsedData, details);
            
            // Replace the original line(s) with a link (includes race condition protection)
            const replaceResult = await this.replaceOriginalTaskLines(editor, selectionInfo, file, taskLineInfo.parsedData.title);
            
            if (!replaceResult.success) {
                new Notice(replaceResult.error || 'Failed to replace task line.');
                // Clean up the created file since replacement failed
                try {
                    await this.plugin.app.vault.delete(file);
                } catch (cleanupError) {
                    console.warn('Failed to clean up created file after replacement failure:', cleanupError);
                }
                return;
            }
            
            new Notice(`Task converted: ${taskLineInfo.parsedData.title}`);
            
        } catch (error) {
            console.error('Error during instant task conversion:', error);
            if (error.message.includes('file already exists')) {
                new Notice('A file with this name already exists. Please try again or rename the task.');
            } else if (error.message.includes('invalid characters')) {
                new Notice('Task title contains invalid characters for filename.');
            } else {
                new Notice('Failed to convert task. Please try again.');
            }
        }
    }

    /**
     * Extract selection information including task line and details from additional lines
     */
    private extractSelectionInfo(editor: Editor, lineNumber: number): { taskLine: string; details: string; startLine: number; endLine: number; originalContent: string[] } {
        const selection = editor.getSelection();
        
        // If there's a selection, check if the specified lineNumber is within it
        if (selection && selection.trim()) {
            const selectionRange = editor.listSelections()[0];
            const startLine = Math.min(selectionRange.anchor.line, selectionRange.head.line);
            const endLine = Math.max(selectionRange.anchor.line, selectionRange.head.line);
            
            // Only use selection if the specified lineNumber is within the selection range
            // This handles cases where instant convert button is clicked with an active selection
            if (lineNumber >= startLine && lineNumber <= endLine) {
                // Extract all lines in the selection
                const selectedLines: string[] = [];
                for (let i = startLine; i <= endLine; i++) {
                    selectedLines.push(editor.getLine(i));
                }
                
                // First line should be the task, rest become details
                const taskLine = selectedLines[0];
                const detailLines = selectedLines.slice(1);
                // Join without trimming to preserve indentation, but remove trailing whitespace only
                const details = detailLines.join('\n').trimEnd();
                
                return {
                    taskLine,
                    details,
                    startLine,
                    endLine,
                    originalContent: selectedLines
                };
            }
        }
        
        // No relevant selection, just use the specified line
        const taskLine = editor.getLine(lineNumber);
        return {
            taskLine,
            details: '',
            startLine: lineNumber,
            endLine: lineNumber,
            originalContent: [taskLine]
        };
    }

    /**
     * Validate input parameters for task conversion
     */
    private validateInputParameters(editor: Editor, lineNumber: number): { isValid: boolean; error?: string } {
        if (!editor) {
            return { isValid: false, error: 'Editor is not available.' };
        }

        const totalLines = editor.lineCount();
        if (lineNumber < 0 || lineNumber >= totalLines) {
            return { isValid: false, error: `Line number ${lineNumber} is out of bounds (0-${totalLines - 1}).` };
        }

        const line = editor.getLine(lineNumber);
        if (line === null || line === undefined) {
            return { isValid: false, error: `Cannot read line ${lineNumber}.` };
        }

        return { isValid: true };
    }

    /**
     * Validate parsed task data
     */
    private validateTaskData(parsedData: ParsedTaskData): { isValid: boolean; error?: string } {
        if (!parsedData.title || parsedData.title.trim().length === 0) {
            return { isValid: false, error: 'Task title cannot be empty.' };
        }

        if (parsedData.title.length > 200) {
            return { isValid: false, error: 'Task title is too long (max 200 characters).' };
        }

        // Validate against dangerous characters for file operations
        const dangerousChars = /[<>:"/\\|?*\x00-\x1f\x7f]/;
        if (dangerousChars.test(parsedData.title)) {
            return { isValid: false, error: 'Task title contains invalid characters for file operations.' };
        }

        // Validate date formats if present
        const dateFields = ['dueDate', 'scheduledDate', 'startDate', 'createdDate', 'doneDate'];
        for (const field of dateFields) {
            const dateValue = parsedData[field as keyof ParsedTaskData] as string;
            if (dateValue && !this.isValidDateFormat(dateValue)) {
                return { isValid: false, error: `Invalid date format in ${field}: ${dateValue}` };
            }
        }

        return { isValid: true };
    }

    /**
     * Validate date format (YYYY-MM-DD)
     */
    private isValidDateFormat(dateString: string): boolean {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateString)) {
            return false;
        }

        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateString;
    }

    /**
     * Create a task file using default settings and parsed data
     */
    private async createTaskFile(parsedData: ParsedTaskData, details: string = ''): Promise<TFile> {
        // Sanitize and validate input data
        const title = this.sanitizeTitle(parsedData.title) || 'Untitled Task';
        
        // Capture parent note information (current active file)
        const currentFile = this.plugin.app.workspace.getActiveFile();
        const parentNote = currentFile ? this.plugin.app.fileManager.generateMarkdownLink(currentFile, currentFile.path) : '';
        
        // Parse due and scheduled dates from task (if present)
        const parsedDueDate = this.sanitizeDate(parsedData.dueDate);
        const parsedScheduledDate = this.sanitizeDate(parsedData.scheduledDate);
        
        // Apply task creation defaults if setting is enabled
        let priority: string | undefined;
        let status: string | undefined;
        let dueDate: string | undefined;
        let scheduledDate: string | undefined;
        let contextsArray: string[] = [];
        let tagsArray = [this.plugin.settings.taskTag];
        let timeEstimate: number | undefined;
        let recurrence: import('../types').RecurrenceInfo | undefined;
        
        if (this.plugin.settings.useDefaultsOnInstantConvert) {
            const defaults = this.plugin.settings.taskCreationDefaults;
            
            // Apply priority and status from parsed data or defaults
            priority = (parsedData.priority ? this.sanitizePriority(parsedData.priority) : '') || this.plugin.settings.defaultTaskPriority;
            status = (parsedData.status ? this.sanitizeStatus(parsedData.status) : '') || this.plugin.settings.defaultTaskStatus;
            
            // Apply due date: parsed date takes priority, then defaults
            if (parsedDueDate) {
                dueDate = parsedDueDate;
            } else if (defaults.defaultDueDate !== 'none') {
                dueDate = calculateDefaultDate(defaults.defaultDueDate);
            }
            
            // Apply scheduled date: parsed date takes priority, then defaults
            if (parsedScheduledDate) {
                scheduledDate = parsedScheduledDate;
            } else if (defaults.defaultScheduledDate !== 'none') {
                scheduledDate = calculateDefaultDate(defaults.defaultScheduledDate);
            }
            
            // Apply default contexts
            if (defaults.defaultContexts) {
                contextsArray = defaults.defaultContexts.split(',').map(s => s.trim()).filter(s => s);
            }
            
            // Apply default tags (add to existing task tag)
            if (defaults.defaultTags) {
                const defaultTagsArray = defaults.defaultTags.split(',').map(s => s.trim()).filter(s => s);
                tagsArray = [...tagsArray, ...defaultTagsArray];
            }
            
            // Apply time estimate
            if (defaults.defaultTimeEstimate && defaults.defaultTimeEstimate > 0) {
                timeEstimate = defaults.defaultTimeEstimate;
            }
            
            // Apply recurrence
            if (defaults.defaultRecurrence && defaults.defaultRecurrence !== 'none') {
                recurrence = {
                    frequency: defaults.defaultRecurrence
                };
            }
        } else {
            // Minimal behavior: only use parsed data, use "none" for unset values
            priority = (parsedData.priority ? this.sanitizePriority(parsedData.priority) : '') || 'none';
            status = (parsedData.status ? this.sanitizeStatus(parsedData.status) : '') || 'none';
            dueDate = parsedDueDate || undefined;
            scheduledDate = parsedScheduledDate || undefined;
            // Keep minimal tags (just the task tag)
            tagsArray = [this.plugin.settings.taskTag];
        }

        // Create TaskCreationData object with all the data
        const taskData: import('./TaskService').TaskCreationData = {
            title: title,
            status: status,
            priority: priority,
            due: dueDate,
            scheduled: scheduledDate,
            contexts: contextsArray.length > 0 ? contextsArray : undefined,
            tags: tagsArray,
            timeEstimate: timeEstimate,
            recurrence: recurrence,
            details: details, // Use provided details from selection
            parentNote: parentNote, // Include parent note for template variable
            dateCreated: getCurrentTimestamp(),
            dateModified: getCurrentTimestamp()
        };

        // Use the centralized task creation service
        const { file } = await this.plugin.taskService.createTask(taskData);

        return file;
    }

    /**
     * Sanitize title input
     */
    private sanitizeTitle(title: string): string {
        if (!title) return '';
        return title.trim().substring(0, 200);
    }

    /**
     * Sanitize priority input
     */
    private sanitizePriority(priority: string): string {
        const validPriorities = this.priorityManager.getAllConfigs().map(p => p.value);
        return validPriorities.includes(priority) ? priority : '';
    }

    /**
     * Sanitize status input
     */
    private sanitizeStatus(status: string): string {
        const validStatuses = this.statusManager.getAllConfigs().map(s => s.value);
        return validStatuses.includes(status) ? status : '';
    }

    /**
     * Sanitize date input
     */
    private sanitizeDate(dateString: string | undefined): string {
        if (!dateString || !this.isValidDateFormat(dateString)) {
            return '';
        }
        return dateString;
    }


    /**
     * Replace the original Tasks Plugin line with a link to the new TaskNote
     * Includes race condition protection and validation
     */
    private async replaceOriginalTaskLine(
        editor: Editor, 
        lineNumber: number, 
        file: TFile, 
        title: string,
        originalLineContent: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Validate inputs
            if (!editor || !file) {
                return { success: false, error: 'Invalid editor or file reference.' };
            }

            // Check if line number is still valid (race condition protection)
            const currentLineCount = editor.lineCount();
            if (lineNumber < 0 || lineNumber >= currentLineCount) {
                return { success: false, error: `Line number ${lineNumber} is no longer valid (current line count: ${currentLineCount}).` };
            }

            // Verify the line content hasn't changed (race condition protection)
            const currentLineContent = editor.getLine(lineNumber);
            if (currentLineContent !== originalLineContent) {
                return { success: false, error: 'Line content has changed since parsing. Please try again.' };
            }

            // Re-validate that the line is still a task (additional safety)
            const taskLineInfo = TasksPluginParser.parseTaskLine(currentLineContent);
            if (!taskLineInfo.isTaskLine) {
                return { success: false, error: 'Line is no longer a valid task.' };
            }

            // Create link text with hyphen prefix (preserve original indentation)
            const originalIndentation = currentLineContent.match(/^(\s*)/)?.[1] || '';
            
            // Get the current file context for relative link generation
            const currentFile = this.plugin.app.workspace.getActiveFile();
            const sourcePath = currentFile?.path || '';
            
            // Use Obsidian's native link text generation - this handles all edge cases
            // including proper path resolution, user preferences, and avoids nested link issues
            // The third parameter (omitMdExtension) set to true removes the .md extension
            const obsidianLinkText = this.plugin.app.metadataCache.fileToLinktext(file, sourcePath, true);
            
            // Create the final line with proper indentation
            const linkText = `${originalIndentation}- [[${obsidianLinkText}]]`;
            
            // Validate the generated link text
            if (linkText.length > 500) { // Reasonable limit for link text
                return { success: false, error: 'Generated link text is too long.' };
            }
            
            // Replace the entire line with the link
            const lineStart: EditorPosition = { line: lineNumber, ch: 0 };
            const lineEnd: EditorPosition = { line: lineNumber, ch: currentLineContent.length };
            
            editor.replaceRange(linkText, lineStart, lineEnd);
            
            return { success: true };
            
        } catch (error) {
            console.error('Error replacing task line:', error);
            return { success: false, error: `Failed to replace line: ${error.message}` };
        }
    }

    /**
     * Replace the original task lines (including multi-line selection) with a link to the new TaskNote
     */
    private async replaceOriginalTaskLines(
        editor: Editor, 
        selectionInfo: { taskLine: string; details: string; startLine: number; endLine: number; originalContent: string[] },
        file: TFile, 
        title: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Validate inputs
            if (!editor || !file) {
                return { success: false, error: 'Invalid editor or file reference.' };
            }

            const { startLine, endLine, originalContent } = selectionInfo;

            // Check if line numbers are still valid (race condition protection)
            const currentLineCount = editor.lineCount();
            if (startLine < 0 || endLine >= currentLineCount) {
                return { success: false, error: `Line range ${startLine}-${endLine} is no longer valid (current line count: ${currentLineCount}).` };
            }

            // Verify the content hasn't changed (race condition protection)
            for (let i = 0; i < originalContent.length; i++) {
                const currentLineContent = editor.getLine(startLine + i);
                if (currentLineContent !== originalContent[i]) {
                    return { success: false, error: 'Content has changed since parsing. Please try again.' };
                }
            }

            // Re-validate that the first line is still a task (additional safety)
            const taskLineInfo = TasksPluginParser.parseTaskLine(originalContent[0]);
            if (!taskLineInfo.isTaskLine) {
                return { success: false, error: 'First line is no longer a valid task.' };
            }

            // Create link text with proper indentation from the first line
            const originalIndentation = originalContent[0].match(/^(\s*)/)?.[1] || '';
            
            // Get the current file context for relative link generation
            const currentFile = this.plugin.app.workspace.getActiveFile();
            const sourcePath = currentFile?.path || '';
            
            // Use Obsidian's native link text generation
            const obsidianLinkText = this.plugin.app.metadataCache.fileToLinktext(file, sourcePath, true);
            
            // Create the final line with proper indentation
            const linkText = `${originalIndentation}- [[${obsidianLinkText}]]`;
            
            // Validate the generated link text
            if (linkText.length > 500) { // Reasonable limit for link text
                return { success: false, error: 'Generated link text is too long.' };
            }
            
            // Replace the entire selection with the link
            const rangeStart: EditorPosition = { line: startLine, ch: 0 };
            const rangeEnd: EditorPosition = { line: endLine, ch: editor.getLine(endLine).length };
            
            editor.replaceRange(linkText, rangeStart, rangeEnd);
            
            return { success: true };
            
        } catch (error) {
            console.error('Error replacing task lines:', error);
            return { success: false, error: `Failed to replace lines: ${error.message}` };
        }
    }
}