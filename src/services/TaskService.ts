import { TFile, Notice, normalizePath, stringifyYaml } from 'obsidian';
import TaskNotesPlugin from '../main';
import { TaskInfo, TimeEntry, EVENT_TASK_UPDATED, EVENT_TASK_DELETED, TaskCreationData } from '../types';
import { getCurrentTimestamp, getCurrentDateString, formatUTCDateForCalendar } from '../utils/dateUtils';
import { generateTaskFilename, generateUniqueFilename, FilenameContext } from '../utils/filenameGenerator';
import { ensureFolderExists } from '../utils/helpers';
import { processTemplate, mergeTemplateFrontmatter, TemplateData } from '../utils/templateProcessor';

export class TaskService {
    constructor(private plugin: TaskNotesPlugin) {}

    /**
     * Create a new task file with all the necessary setup
     * This is the central method for task creation used by all components
     */
    async createTask(taskData: TaskCreationData): Promise<{ file: TFile; taskInfo: TaskInfo }> {
        try {
            // Validate required fields
            if (!taskData.title || !taskData.title.trim()) {
                throw new Error('Title is required');
            }

            if (taskData.title.length > 200) {
                throw new Error('Title is too long (max 200 characters)');
            }

            // Apply defaults for missing fields
            const title = taskData.title.trim();
            const priority = taskData.priority || this.plugin.settings.defaultTaskPriority;
            const status = taskData.status || this.plugin.settings.defaultTaskStatus;
            const dateCreated = taskData.dateCreated || getCurrentTimestamp();
            const dateModified = taskData.dateModified || getCurrentTimestamp();

            // Prepare contexts, projects, and tags arrays
            const contextsArray = taskData.contexts || [];
            const projectsArray = taskData.projects || [];
            const tagsArray = taskData.tags || [this.plugin.settings.taskTag];
            
            // Ensure task tag is always included
            if (!tagsArray.includes(this.plugin.settings.taskTag)) {
                tagsArray.unshift(this.plugin.settings.taskTag);
            }

            // Generate filename
            const filenameContext: FilenameContext = {
                title: title,
                priority: priority,
                status: status,
                date: new Date(),
                dueDate: taskData.due,
                scheduledDate: taskData.scheduled
            };

            const baseFilename = generateTaskFilename(filenameContext, this.plugin.settings);
            
            // Determine folder based on creation context
            let folder = '';
            if (taskData.creationContext === 'inline-conversion') {
                // For inline conversion, use the inline task folder setting with variable support
                const inlineFolder = this.plugin.settings.inlineTaskConvertFolder || '';
                if (inlineFolder.trim()) {
                    // Inline folder is configured, use it
                    if (inlineFolder.includes('{{currentNotePath}}')) {
                        // Get current file's folder path
                        const currentFile = this.plugin.app.workspace.getActiveFile();
                        const currentFolderPath = currentFile?.parent?.path || '';
                        folder = inlineFolder.replace(/\{\{currentNotePath\}\}/g, currentFolderPath);
                    } else {
                        folder = inlineFolder;
                    }
                } else {
                    // Fallback to default tasks folder when inline folder is empty (#128)
                    folder = this.plugin.settings.tasksFolder || '';
                }
            } else {
                // For manual creation and other contexts, use the general tasks folder
                folder = this.plugin.settings.tasksFolder || '';
            }
            
            // Ensure folder exists
            if (folder) {
                await ensureFolderExists(this.plugin.app.vault, folder);
            }
            
            // Generate unique filename
            const uniqueFilename = await generateUniqueFilename(baseFilename, folder, this.plugin.app.vault);
            const fullPath = folder ? `${folder}/${uniqueFilename}.md` : `${uniqueFilename}.md`;

            // Create complete TaskInfo object with all the data
            const completeTaskData: Partial<TaskInfo> = {
                title: title,
                status: status,
                priority: priority,
                due: taskData.due || undefined,
                scheduled: taskData.scheduled || undefined,
                contexts: contextsArray.length > 0 ? contextsArray : undefined,
                projects: projectsArray.length > 0 ? projectsArray : undefined,
                timeEstimate: taskData.timeEstimate && taskData.timeEstimate > 0 ? taskData.timeEstimate : undefined,
                dateCreated: dateCreated,
                dateModified: dateModified,
                recurrence: taskData.recurrence || undefined,
                icsEventId: taskData.icsEventId || undefined
            };

            // Use field mapper to convert to frontmatter with proper field mapping
            const frontmatter = this.plugin.fieldMapper.mapToFrontmatter(completeTaskData, this.plugin.settings.taskTag, this.plugin.settings.storeTitleInFilename);
            
            // Tags are handled separately (not via field mapper)
            frontmatter.tags = tagsArray;

            // Apply template processing (both frontmatter and body)
            const templateResult = await this.applyTemplate(taskData);
            
            // Merge template frontmatter with base frontmatter
            // User-defined values take precedence over template frontmatter
            const finalFrontmatter = mergeTemplateFrontmatter(frontmatter, templateResult.frontmatter);
            
            // Prepare file content
            const yamlHeader = stringifyYaml(finalFrontmatter);
            let content = `---\n${yamlHeader}---\n\n`;
            
            // Add processed body content if any
            if (templateResult.body && templateResult.body.trim()) {
                content += `${templateResult.body.trim()}\n\n`;
            }

            // Create the file
            const file = await this.plugin.app.vault.create(fullPath, content);

            // Create final TaskInfo object for cache and events
            // Ensure required fields are present by using the complete task data as base
            const taskInfo: TaskInfo = {
                ...completeTaskData,
                ...finalFrontmatter,
                // Ensure required fields are always defined
                title: finalFrontmatter.title || completeTaskData.title || title,
                status: finalFrontmatter.status || completeTaskData.status || status,
                priority: finalFrontmatter.priority || completeTaskData.priority || priority,
                path: file.path,
                tags: tagsArray,
                archived: false
            };

            // Update cache proactively
            this.plugin.cacheManager.updateTaskInfoInCache(file.path, taskInfo);

            // Emit task created event
            this.plugin.emitter.trigger(EVENT_TASK_UPDATED, {
                path: file.path,
                updatedTask: taskInfo
            });

            return { file, taskInfo };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Error creating task:', {
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
                taskData
            });
            
            throw new Error(`Failed to create task: ${errorMessage}`);
        }
    }

    /**
     * Apply template to task (both frontmatter and body) if enabled in settings
     */
    private async applyTemplate(taskData: TaskCreationData): Promise<{ frontmatter: Record<string, any>; body: string }> {
        const defaults = this.plugin.settings.taskCreationDefaults;
        
        // Check if body template is enabled and configured
        if (!defaults.useBodyTemplate || !defaults.bodyTemplate?.trim()) {
            // No template configured, return empty frontmatter and details as body
            return {
                frontmatter: {},
                body: taskData.details?.trim() || ''
            };
        }
        
        try {
            // Normalize the template path and ensure it has .md extension
            let templatePath = normalizePath(defaults.bodyTemplate.trim());
            if (!templatePath.endsWith('.md')) {
                templatePath += '.md';
            }
            
            // Try to load the template file
            const templateFile = this.plugin.app.vault.getAbstractFileByPath(templatePath);
            if (templateFile instanceof TFile) {
                const templateContent = await this.plugin.app.vault.read(templateFile);
                
                // Prepare task data for template variables (with all final values)
                const templateTaskData: TemplateData = {
                    title: taskData.title || '',
                    priority: taskData.priority || '',
                    status: taskData.status || '',
                    contexts: Array.isArray(taskData.contexts) ? taskData.contexts : [],
                    tags: Array.isArray(taskData.tags) ? taskData.tags : [],
                    timeEstimate: taskData.timeEstimate || 0,
                    dueDate: taskData.due || '',
                    scheduledDate: taskData.scheduled || '',
                    details: taskData.details || '',
                    parentNote: taskData.parentNote || ''
                };
                
                // Process the complete template (frontmatter + body)
                return processTemplate(templateContent, templateTaskData);
            } else {
                // Template file not found, log error and return details as-is
                console.warn(`Task body template not found: ${templatePath}`);
                new Notice(`Task body template not found: ${templatePath}`);
                return {
                    frontmatter: {},
                    body: taskData.details?.trim() || ''
                };
            }
        } catch (error) {
            // Error reading template, log error and return details as-is
            console.error('Error reading task body template:', error);
            new Notice(`Error reading task body template: ${defaults.bodyTemplate}`);
            return {
                frontmatter: {},
                body: taskData.details?.trim() || ''
            };
        }
    }

    /**
     * Toggle the status of a task between completed and open
     */
    async toggleStatus(task: TaskInfo): Promise<TaskInfo> {
        try {
            // Determine new status
            const isCurrentlyCompleted = this.plugin.statusManager.isCompletedStatus(task.status);
            const newStatus = isCurrentlyCompleted 
                ? this.plugin.settings.defaultTaskStatus // Revert to default open status
                : this.plugin.statusManager.getCompletedStatuses()[0] || 'done'; // Set to first completed status

            return await this.updateProperty(task, 'status', newStatus);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Error toggling task status:', {
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
                taskPath: task.path,
                currentStatus: task.status
            });
            
            throw new Error(`Failed to toggle task status: ${errorMessage}`);
        }
    }

    /**
     * Update a single property of a task following the deterministic data flow pattern
     */
    async updateProperty(task: TaskInfo, property: keyof TaskInfo, value: any, options: { silent?: boolean } = {}): Promise<TaskInfo> {
        try {
            const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
            if (!(file instanceof TFile)) {
                throw new Error(`Cannot find task file: ${task.path}`);
            }
            
            // Get fresh task data to prevent overwrites
            const freshTask = await this.plugin.cacheManager.getTaskInfo(task.path) || task;
            
            // Step 1: Construct new state in memory using fresh data
            const updatedTask = { ...freshTask } as Record<string, any>;
            updatedTask[property] = value;
            updatedTask.dateModified = getCurrentTimestamp();
            
            // Handle derivative changes for status updates
            if (property === 'status' && !freshTask.recurrence) {
                if (this.plugin.statusManager.isCompletedStatus(value)) {
                    updatedTask.completedDate = getCurrentDateString();
                } else {
                    updatedTask.completedDate = undefined;
                }
            }
            
            // Step 2: Persist to file
            await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
                // Use field mapper to get the correct frontmatter property name
                const fieldName = this.plugin.fieldMapper.toUserField(property as keyof import('../types').FieldMapping);
                
                if (property === 'status') {
                    frontmatter[fieldName] = value;
                    
                    // Update completed date when marking as complete (non-recurring tasks only)
                    if (!task.recurrence) {
                        const completedDateField = this.plugin.fieldMapper.toUserField('completedDate');
                        if (this.plugin.statusManager.isCompletedStatus(value)) {
                            frontmatter[completedDateField] = getCurrentDateString();
                        } else {
                            // Remove completed date when marking as incomplete
                            if (frontmatter[completedDateField]) {
                                delete frontmatter[completedDateField];
                            }
                        }
                    }
                } else if ((property === 'due' || property === 'scheduled') && !value) {
                    // Remove empty due/scheduled dates
                    delete frontmatter[fieldName];
                } else {
                    frontmatter[fieldName] = value;
                }
                
                // Always update the modification timestamp using field mapper
                const dateModifiedField = this.plugin.fieldMapper.toUserField('dateModified');
                frontmatter[dateModifiedField] = updatedTask.dateModified;
            });
            
            // Step 3: Proactively update cache
            try {
                await this.plugin.cacheManager.updateTaskInfoInCache(task.path, updatedTask as TaskInfo);
            } catch (cacheError) {
                // Cache errors shouldn't break the operation, just log them
                console.error('Error updating task cache:', {
                    error: cacheError instanceof Error ? cacheError.message : String(cacheError),
                    taskPath: task.path
                });
            }
            
            // Step 4: Notify system of change
            try {
                this.plugin.emitter.trigger(EVENT_TASK_UPDATED, {
                    path: task.path,
                    originalTask: task,
                    updatedTask: updatedTask as TaskInfo
                });
            } catch (eventError) {
                console.error('Error emitting task update event:', {
                    error: eventError instanceof Error ? eventError.message : String(eventError),
                    taskPath: task.path
                });
                // Event emission errors shouldn't break the operation
            }
            
            // Step 5: Return authoritative data
            return updatedTask as TaskInfo;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Error updating task property:', {
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
                taskPath: task.path,
                property: String(property),
                value
            });
            
            throw new Error(`Failed to update task property: ${errorMessage}`);
        }
    }

    /**
     * Toggle the archive status of a task
     */
    async toggleArchive(task: TaskInfo): Promise<TaskInfo> {
        const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
        if (!(file instanceof TFile)) {
            throw new Error(`Cannot find task file: ${task.path}`);
        }

        const archiveTag = this.plugin.fieldMapper.getMapping().archiveTag;
        const isCurrentlyArchived = task.archived;
        
        // Step 1: Construct new state in memory
        const updatedTask = { ...task };
        updatedTask.archived = !isCurrentlyArchived;
        updatedTask.dateModified = getCurrentTimestamp();
        
        // Update tags array to include/exclude archive tag
        if (!updatedTask.tags) {
            updatedTask.tags = [];
        }
        
        if (isCurrentlyArchived) {
            // Remove archive tag
            updatedTask.tags = updatedTask.tags.filter(tag => tag !== archiveTag);
        } else {
            // Add archive tag if not present
            if (!updatedTask.tags.includes(archiveTag)) {
                updatedTask.tags = [...updatedTask.tags, archiveTag];
            }
        }
        
        // Step 2: Persist to file
        await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
            const dateModifiedField = this.plugin.fieldMapper.toUserField('dateModified');
            
            // Toggle archived property (note: archived is handled via tags, not as a separate field)
            if (isCurrentlyArchived) {
                // Remove archive tag from tags array if present
                if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
                    frontmatter.tags = frontmatter.tags.filter((tag: string) => tag !== archiveTag);
                    if (frontmatter.tags.length === 0) {
                        delete frontmatter.tags;
                    }
                }
            } else {
                // Add archive tag to tags array
                if (!frontmatter.tags) {
                    frontmatter.tags = [];
                } else if (!Array.isArray(frontmatter.tags)) {
                    frontmatter.tags = [frontmatter.tags];
                }
                
                if (!frontmatter.tags.includes(archiveTag)) {
                    frontmatter.tags.push(archiveTag);
                }
            }
            
            // Always update the modification timestamp using field mapper
            frontmatter[dateModifiedField] = updatedTask.dateModified;
        });
        
        // Step 3: Proactively update cache
        await this.plugin.cacheManager.updateTaskInfoInCache(task.path, updatedTask);
        
        // Step 4: Notify system of change
        this.plugin.emitter.trigger(EVENT_TASK_UPDATED, {
            path: task.path,
            originalTask: task,
            updatedTask: updatedTask
        });
        
        // Step 5: Return authoritative data
        return updatedTask;
    }

    /**
     * Start time tracking for a task
     */
    async startTimeTracking(task: TaskInfo): Promise<TaskInfo> {
        const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
        if (!(file instanceof TFile)) {
            throw new Error(`Cannot find task file: ${task.path}`);
        }

        // Check if already tracking
        const activeSession = this.plugin.getActiveTimeSession(task);
        if (activeSession) {
            throw new Error('Time tracking is already active for this task');
        }

        // Step 1: Construct new state in memory
        const updatedTask = { ...task };
        updatedTask.dateModified = getCurrentTimestamp();
        
        if (!updatedTask.timeEntries) {
            updatedTask.timeEntries = [];
        }
        
        const newEntry: TimeEntry = {
            startTime: getCurrentTimestamp(),
            description: 'Work session'
        };
        updatedTask.timeEntries = [...updatedTask.timeEntries, newEntry];

        // Step 2: Persist to file
        await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
            const timeEntriesField = this.plugin.fieldMapper.toUserField('timeEntries');
            const dateModifiedField = this.plugin.fieldMapper.toUserField('dateModified');
            
            if (!frontmatter[timeEntriesField]) {
                frontmatter[timeEntriesField] = [];
            }

            // Add new time entry with start time
            frontmatter[timeEntriesField].push(newEntry);
            frontmatter[dateModifiedField] = updatedTask.dateModified;
        });

        // Step 3: Proactively update cache
        await this.plugin.cacheManager.updateTaskInfoInCache(task.path, updatedTask);
        
        // Step 4: Notify system of change
        this.plugin.emitter.trigger(EVENT_TASK_UPDATED, {
            path: task.path,
            originalTask: task,
            updatedTask: updatedTask
        });
        
        // Step 5: Return authoritative data
        return updatedTask;
    }

    /**
     * Stop time tracking for a task
     */
    async stopTimeTracking(task: TaskInfo): Promise<TaskInfo> {
        const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
        if (!(file instanceof TFile)) {
            throw new Error(`Cannot find task file: ${task.path}`);
        }

        const activeSession = this.plugin.getActiveTimeSession(task);
        if (!activeSession) {
            throw new Error('No active time tracking session for this task');
        }

        // Step 1: Construct new state in memory
        const updatedTask = { ...task };
        updatedTask.dateModified = getCurrentTimestamp();
        
        if (updatedTask.timeEntries && Array.isArray(updatedTask.timeEntries)) {
            const entryIndex = updatedTask.timeEntries.findIndex((entry: TimeEntry) => 
                entry.startTime === activeSession.startTime && !entry.endTime
            );
            if (entryIndex !== -1) {
                updatedTask.timeEntries = [...updatedTask.timeEntries];
                updatedTask.timeEntries[entryIndex] = {
                    ...updatedTask.timeEntries[entryIndex],
                    endTime: getCurrentTimestamp()
                };
            }
        }

        // Step 2: Persist to file
        await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
            const timeEntriesField = this.plugin.fieldMapper.toUserField('timeEntries');
            const dateModifiedField = this.plugin.fieldMapper.toUserField('dateModified');
            
            if (frontmatter[timeEntriesField] && Array.isArray(frontmatter[timeEntriesField])) {
                // Find and update the active session
                const entryIndex = frontmatter[timeEntriesField].findIndex((entry: TimeEntry) => 
                    entry.startTime === activeSession.startTime && !entry.endTime
                );

                if (entryIndex !== -1) {
                    frontmatter[timeEntriesField][entryIndex].endTime = getCurrentTimestamp();
                }
            }
            frontmatter[dateModifiedField] = updatedTask.dateModified;
        });

        // Step 3: Proactively update cache
        await this.plugin.cacheManager.updateTaskInfoInCache(task.path, updatedTask);
        
        // Step 4: Notify system of change
        this.plugin.emitter.trigger(EVENT_TASK_UPDATED, {
            path: task.path,
            originalTask: task,
            updatedTask: updatedTask
        });
        
        // Step 5: Return authoritative data
        return updatedTask;
    }

    /**
     * Update a task with multiple property changes following the deterministic data flow pattern
     * This is the centralized method for bulk task updates used by the TaskEditModal
     */
    async updateTask(originalTask: TaskInfo, updates: Partial<TaskInfo>): Promise<TaskInfo> {
        try {
            const file = this.plugin.app.vault.getAbstractFileByPath(originalTask.path);
            if (!(file instanceof TFile)) {
                throw new Error(`Cannot find task file: ${originalTask.path}`);
            }

            const isRenameNeeded = this.plugin.settings.storeTitleInFilename && updates.title && updates.title !== originalTask.title;
            let newPath = originalTask.path;

            if (isRenameNeeded) {
                const parentPath = file.parent ? file.parent.path : '';
                const newFilename = await generateUniqueFilename(updates.title!, parentPath, this.plugin.app.vault);
                newPath = parentPath ? `${parentPath}/${newFilename}.md` : `${newFilename}.md`;
            }

            // Step 1: Persist frontmatter changes to the file at its original path
            await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
                const completeTaskData: Partial<TaskInfo> = {
                    ...originalTask,
                    ...updates,
                    dateModified: getCurrentTimestamp()
                };

                const mappedFrontmatter = this.plugin.fieldMapper.mapToFrontmatter(
                    completeTaskData,
                    this.plugin.settings.taskTag,
                    this.plugin.settings.storeTitleInFilename
                );

                Object.keys(mappedFrontmatter).forEach(key => {
                    if (mappedFrontmatter[key] !== undefined) {
                        frontmatter[key] = mappedFrontmatter[key];
                    }
                });

                if (updates.hasOwnProperty('due') && updates.due === undefined) delete frontmatter[this.plugin.fieldMapper.toUserField('due')];
                if (updates.hasOwnProperty('scheduled') && updates.scheduled === undefined) delete frontmatter[this.plugin.fieldMapper.toUserField('scheduled')];
                if (updates.hasOwnProperty('contexts') && updates.contexts === undefined) delete frontmatter[this.plugin.fieldMapper.toUserField('contexts')];
                if (updates.hasOwnProperty('timeEstimate') && updates.timeEstimate === undefined) delete frontmatter[this.plugin.fieldMapper.toUserField('timeEstimate')];
                if (updates.hasOwnProperty('completedDate') && updates.completedDate === undefined) delete frontmatter[this.plugin.fieldMapper.toUserField('completedDate')];
                if (updates.hasOwnProperty('recurrence') && updates.recurrence === undefined) delete frontmatter[this.plugin.fieldMapper.toUserField('recurrence')];

                if (isRenameNeeded) {
                    delete frontmatter[this.plugin.fieldMapper.toUserField('title')];
                }

                if (updates.hasOwnProperty('tags')) {
                    frontmatter.tags = updates.tags;
                } else if (originalTask.tags) {
                    frontmatter.tags = originalTask.tags;
                }
            });

            // Step 2: Rename the file if needed, after frontmatter is updated
            if (isRenameNeeded) {
                await this.plugin.app.fileManager.renameFile(file, newPath);
            }

            // Step 3: Construct the final authoritative state
            const updatedTask: TaskInfo = {
                ...originalTask,
                ...updates,
                path: newPath,
                dateModified: getCurrentTimestamp()
            };

            if (updates.status !== undefined && !originalTask.recurrence) {
                if (this.plugin.statusManager.isCompletedStatus(updates.status)) {
                    if (!originalTask.completedDate) {
                        updatedTask.completedDate = getCurrentDateString();
                    }
                } else {
                    updatedTask.completedDate = undefined;
                }
            }

            // Step 4: Update cache
            if (isRenameNeeded) {
                this.plugin.cacheManager.clearCacheEntry(originalTask.path);
            }
            try {
                await this.plugin.cacheManager.updateTaskInfoInCache(newPath, updatedTask);
            } catch (cacheError) {
                // Cache errors shouldn't break the operation, just log them
                console.error('Error updating task cache:', {
                    error: cacheError instanceof Error ? cacheError.message : String(cacheError),
                    taskPath: newPath
                });
            }

            // Step 5: Notify system of change
            try {
                this.plugin.emitter.trigger(EVENT_TASK_UPDATED, {
                    path: newPath,
                    originalTask: originalTask,
                    updatedTask: updatedTask
                });
            } catch (eventError) {
                console.error('Error emitting task update event:', {
                    error: eventError instanceof Error ? eventError.message : String(eventError),
                    taskPath: newPath
                });
                // Event emission errors shouldn't break the operation
            }

            return updatedTask;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Error updating task:', {
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
                taskPath: originalTask.path,
                updates
            });
            
            throw new Error(`Failed to update task: ${errorMessage}`);
        }
    }

    /**
     * Delete a task file and remove it from all caches and indexes
     */
    async deleteTask(task: TaskInfo): Promise<void> {
        try {
            const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
            if (!(file instanceof TFile)) {
                throw new Error(`Cannot find task file: ${task.path}`);
            }

            // Step 1: Delete the file from the vault
            await this.plugin.app.vault.delete(file);

            // Step 2: Remove from cache and indexes (this will be done by the file delete event)
            // But we'll also do it proactively to ensure immediate UI updates
            this.plugin.cacheManager.clearCacheEntry(task.path);

            // Step 3: Emit task deleted event
            this.plugin.emitter.trigger(EVENT_TASK_DELETED, {
                path: task.path,
                deletedTask: task
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Error deleting task:', {
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
                taskPath: task.path
            });
            
            throw new Error(`Failed to delete task: ${errorMessage}`);
        }
    }

    /**
     * Toggle completion status for recurring tasks on a specific date
     */
    async toggleRecurringTaskComplete(task: TaskInfo, date?: Date): Promise<TaskInfo> {
        const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
        if (!(file instanceof TFile)) {
            throw new Error(`Cannot find task file: ${task.path}`);
        }

        // Get fresh task data to ensure we have the latest completion state
        const freshTask = await this.plugin.cacheManager.getTaskInfo(task.path) || task;
        
        if (!freshTask.recurrence) {
            throw new Error('Task is not recurring');
        }

        // Use the provided date or fall back to the currently selected date
        const targetDate = date || this.plugin.selectedDate;
        const dateStr = formatUTCDateForCalendar(targetDate);
        
        // Check current completion status for this date using fresh data
        const completeInstances = Array.isArray(freshTask.complete_instances) ? freshTask.complete_instances : [];
        const currentComplete = completeInstances.includes(dateStr);
        const newComplete = !currentComplete;
        
        // Step 1: Construct new state in memory using fresh data
        const updatedTask = { ...freshTask };
        updatedTask.dateModified = getCurrentTimestamp();
        
        if (newComplete) {
            // Add date to completed instances if not already present
            if (!completeInstances.includes(dateStr)) {
                updatedTask.complete_instances = [...completeInstances, dateStr];
            }
        } else {
            // Remove date from completed instances
            updatedTask.complete_instances = completeInstances.filter(d => d !== dateStr);
        }
        
        // Step 2: Persist to file
        await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
            const completeInstancesField = this.plugin.fieldMapper.toUserField('completeInstances');
            const dateModifiedField = this.plugin.fieldMapper.toUserField('dateModified');
            
            // Ensure complete_instances array exists
            if (!frontmatter[completeInstancesField]) {
                frontmatter[completeInstancesField] = [];
            }
            
            const completeDates: string[] = frontmatter[completeInstancesField];
            
            if (newComplete) {
                // Add date to completed instances if not already present
                if (!completeDates.includes(dateStr)) {
                    frontmatter[completeInstancesField] = [...completeDates, dateStr];
                }
            } else {
                // Remove date from completed instances
                frontmatter[completeInstancesField] = completeDates.filter(d => d !== dateStr);
            }
            
            frontmatter[dateModifiedField] = updatedTask.dateModified;
        });
        
        // Step 3: Proactively update cache
        await this.plugin.cacheManager.updateTaskInfoInCache(freshTask.path, updatedTask);
        
        // Step 4: Notify system of change
        this.plugin.emitter.trigger(EVENT_TASK_UPDATED, {
            path: freshTask.path,
            originalTask: freshTask,
            updatedTask: updatedTask
        });
        
        // Step 5: Return authoritative data
        return updatedTask;
    }

    /**
     * Delete a specific time entry from a task
     */
    async deleteTimeEntry(task: TaskInfo, timeEntryIndex: number): Promise<TaskInfo> {
        const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
        if (!(file instanceof TFile)) {
            throw new Error(`Cannot find task file: ${task.path}`);
        }

        if (!task.timeEntries || !Array.isArray(task.timeEntries)) {
            throw new Error('Task has no time entries');
        }

        if (timeEntryIndex < 0 || timeEntryIndex >= task.timeEntries.length) {
            throw new Error('Invalid time entry index');
        }

        // Step 1: Construct new state in memory
        const updatedTask = { ...task };
        updatedTask.dateModified = getCurrentTimestamp();
        
        // Remove the time entry at the specified index
        updatedTask.timeEntries = task.timeEntries.filter((_, index) => index !== timeEntryIndex);

        // Step 2: Persist to file
        await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
            const timeEntriesField = this.plugin.fieldMapper.toUserField('timeEntries');
            const dateModifiedField = this.plugin.fieldMapper.toUserField('dateModified');
            
            if (frontmatter[timeEntriesField] && Array.isArray(frontmatter[timeEntriesField])) {
                // Remove the time entry at the specified index
                frontmatter[timeEntriesField] = frontmatter[timeEntriesField].filter((_: any, index: number) => index !== timeEntryIndex);
            }
            
            frontmatter[dateModifiedField] = updatedTask.dateModified;
        });

        // Step 3: Proactively update cache
        await this.plugin.cacheManager.updateTaskInfoInCache(task.path, updatedTask);
        
        // Step 4: Notify system of change
        this.plugin.emitter.trigger(EVENT_TASK_UPDATED, {
            path: task.path,
            originalTask: task,
            updatedTask: updatedTask
        });
        
        // Step 5: Return authoritative data
        return updatedTask;
    }
}
