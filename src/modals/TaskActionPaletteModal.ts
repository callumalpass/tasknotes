import { App, FuzzySuggestModal, FuzzyMatch, setIcon, Notice } from 'obsidian';
import { TaskInfo } from '../types';
import TaskNotesPlugin from '../main';

export interface TaskAction {
    id: string;
    title: string;
    description: string;
    icon: string;
    category: 'status' | 'priority' | 'dates' | 'tracking' | 'organization' | 'other';
    keywords: string[];
    isApplicable: (task: TaskInfo, plugin: TaskNotesPlugin, targetDate: Date) => boolean;
    execute: (task: TaskInfo, plugin: TaskNotesPlugin, targetDate: Date) => Promise<void>;
}

export class TaskActionPaletteModal extends FuzzySuggestModal<TaskAction> {
    private task: TaskInfo;
    private plugin: TaskNotesPlugin;
    private targetDate: Date;
    private actions: TaskAction[];

    constructor(app: App, task: TaskInfo, plugin: TaskNotesPlugin, targetDate: Date) {
        super(app);
        this.task = task;
        this.plugin = plugin;
        this.targetDate = targetDate;
        this.actions = this.buildActionsList();
        
        this.setPlaceholder('Type to search for an action...');
        this.setInstructions([
            { command: '↑↓', purpose: 'to navigate' },
            { command: '↵', purpose: 'to execute' },
            { command: 'esc', purpose: 'to dismiss' },
        ]);
        
        // Set modal title for accessibility
        this.titleEl.setText(`Quick Actions: ${task.title}`);
        this.titleEl.setAttribute('id', 'task-action-palette-title');
        
        // Set aria attributes on the modal
        this.containerEl.setAttribute('aria-labelledby', 'task-action-palette-title');
        this.containerEl.setAttribute('role', 'dialog');
        this.containerEl.setAttribute('aria-modal', 'true');
        this.containerEl.addClass('task-action-palette-modal');
    }

    private buildActionsList(): TaskAction[] {
        const actions: TaskAction[] = [];
        
        // Status actions
        const availableStatuses = this.task.recurrence 
            ? this.plugin.statusManager.getNonCompletionStatuses()
            : this.plugin.statusManager.getAllStatuses();
            
        availableStatuses.forEach(statusConfig => {
            const isCurrentStatus = this.task.status === statusConfig.value;
            actions.push({
                id: `status-${statusConfig.value}`,
                title: `Change status to "${statusConfig.label}"`,
                description: `Set task status to ${statusConfig.label}`,
                icon: isCurrentStatus ? 'check' : 'circle',
                category: 'status',
                keywords: ['status', statusConfig.value, statusConfig.label, 'change', 'set'],
                isApplicable: () => !isCurrentStatus,
                execute: async (task) => {
                    await this.plugin.updateTaskProperty(task, 'status', statusConfig.value);
                    new Notice(`Status changed to ${statusConfig.label}`);
                }
            });
        });

        // Priority actions
        this.plugin.priorityManager.getAllPriorities().forEach(priorityConfig => {
            const isCurrentPriority = this.task.priority === priorityConfig.value;
            actions.push({
                id: `priority-${priorityConfig.value}`,
                title: `Set priority to "${priorityConfig.label}"`,
                description: `Change task priority to ${priorityConfig.label}`,
                icon: isCurrentPriority ? 'check' : 'flag',
                category: 'priority',
                keywords: ['priority', priorityConfig.value, priorityConfig.label, 'change', 'set'],
                isApplicable: () => !isCurrentPriority,
                execute: async (task) => {
                    await this.plugin.updateTaskProperty(task, 'priority', priorityConfig.value);
                    new Notice(`Priority changed to ${priorityConfig.label}`);
                }
            });
        });

        // Date actions
        actions.push(
            {
                id: 'set-due-date',
                title: 'Set due date',
                description: 'Set or change the task due date',
                icon: 'calendar',
                category: 'dates',
                keywords: ['due', 'date', 'deadline', 'set', 'change'],
                isApplicable: () => true,
                execute: async (task) => {
                    this.plugin.openDueDateModal(task);
                }
            },
            {
                id: 'set-scheduled-date',
                title: 'Set scheduled date',
                description: 'Set or change when the task is scheduled',
                icon: 'calendar-clock',
                category: 'dates',
                keywords: ['scheduled', 'date', 'schedule', 'set', 'change'],
                isApplicable: () => true,
                execute: async (task) => {
                    this.plugin.openScheduledDateModal(task);
                }
            },
            {
                id: 'clear-due-date',
                title: 'Clear due date',
                description: 'Remove the due date from this task',
                icon: 'calendar-x',
                category: 'dates',
                keywords: ['clear', 'remove', 'due', 'date'],
                isApplicable: (task) => !!task.due,
                execute: async (task) => {
                    await this.plugin.updateTaskProperty(task, 'due', undefined);
                    new Notice('Due date cleared');
                }
            },
            {
                id: 'clear-scheduled-date',
                title: 'Clear scheduled date',
                description: 'Remove the scheduled date from this task',
                icon: 'calendar-x',
                category: 'dates',
                keywords: ['clear', 'remove', 'scheduled', 'date'],
                isApplicable: (task) => !!task.scheduled,
                execute: async (task) => {
                    await this.plugin.updateTaskProperty(task, 'scheduled', undefined);
                    new Notice('Scheduled date cleared');
                }
            }
        );

        // Time tracking actions
        const activeSession = this.plugin.getActiveTimeSession(this.task);
        actions.push({
            id: 'toggle-time-tracking',
            title: activeSession ? 'Stop time tracking' : 'Start time tracking',
            description: activeSession ? 'Stop tracking time for this task' : 'Start tracking time for this task',
            icon: activeSession ? 'pause' : 'play',
            category: 'tracking',
            keywords: ['time', 'tracking', 'timer', activeSession ? 'stop' : 'start'],
            isApplicable: () => true,
            execute: async (task) => {
                const currentSession = this.plugin.getActiveTimeSession(task);
                if (currentSession) {
                    await this.plugin.stopTimeTracking(task);
                    new Notice('Time tracking stopped');
                } else {
                    await this.plugin.startTimeTracking(task);
                    new Notice('Time tracking started');
                }
            }
        });

        // Organization actions
        actions.push(
            {
                id: 'toggle-archive',
                title: this.task.archived ? 'Unarchive task' : 'Archive task',
                description: this.task.archived ? 'Move task back to active tasks' : 'Archive this task',
                icon: this.task.archived ? 'archive-restore' : 'archive',
                category: 'organization',
                keywords: ['archive', this.task.archived ? 'unarchive' : 'archive', 'organize'],
                isApplicable: () => true,
                execute: async (task) => {
                    await this.plugin.toggleTaskArchive(task);
                    new Notice(task.archived ? 'Task unarchived' : 'Task archived');
                }
            }
        );

        // Recurring task actions (only for recurring tasks)
        if (this.task.recurrence) {
            actions.push({
                id: 'complete-recurring-instance',
                title: 'Complete this occurrence',
                description: 'Mark this specific instance of the recurring task as complete',
                icon: 'check-circle',
                category: 'status',
                keywords: ['complete', 'done', 'finish', 'recurring', 'instance', 'occurrence'],
                isApplicable: (task, plugin, targetDate) => {
                    return !plugin.statusManager.isCompletedStatus(task.status);
                },
                execute: async (task, plugin, targetDate) => {
                    await plugin.toggleRecurringTaskComplete(task, targetDate);
                    new Notice('Recurring task instance completed');
                }
            });
        }

        // Other actions
        actions.push(
            {
                id: 'edit-task',
                title: 'Edit task details',
                description: 'Open the full task editor',
                icon: 'edit',
                category: 'other',
                keywords: ['edit', 'modify', 'details', 'properties'],
                isApplicable: () => true,
                execute: async (task) => {
                    await this.plugin.openTaskEditModal(task);
                }
            },
            {
                id: 'open-task-file',
                title: 'Open task file',
                description: 'Open the task file in the editor',
                icon: 'file-text',
                category: 'other',
                keywords: ['open', 'file', 'editor', 'edit'],
                isApplicable: () => true,
                execute: async (task) => {
                    const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
                    if (file) {
                        await this.plugin.app.workspace.getLeaf(true).openFile(file as any);
                    }
                }
            },
            {
                id: 'copy-task-title',
                title: 'Copy task title',
                description: 'Copy the task title to clipboard',
                icon: 'copy',
                category: 'other',
                keywords: ['copy', 'clipboard', 'title'],
                isApplicable: () => true,
                execute: async (task) => {
                    try {
                        await navigator.clipboard.writeText(task.title);
                        new Notice('Task title copied to clipboard');
                    } catch (error) {
                        new Notice('Failed to copy to clipboard');
                    }
                }
            },
            {
                id: 'copy-task-link',
                title: 'Copy task link',
                description: 'Copy a wikilink to this task',
                icon: 'link',
                category: 'other',
                keywords: ['copy', 'link', 'wikilink', 'reference'],
                isApplicable: () => true,
                execute: async (task) => {
                    try {
                        const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
                        if (file) {
                            const linkText = this.plugin.app.metadataCache.fileToLinktext(file as any, '');
                            await navigator.clipboard.writeText(`[[${linkText}]]`);
                            new Notice('Task link copied to clipboard');
                        }
                    } catch (error) {
                        new Notice('Failed to copy to clipboard');
                    }
                }
            },
            {
                id: 'delete-task',
                title: 'Delete task',
                description: 'Permanently delete this task',
                icon: 'trash',
                category: 'other',
                keywords: ['delete', 'remove', 'trash'],
                isApplicable: () => true,
                execute: async (task) => {
                    // Close the action palette first
                    this.close();
                    
                    // Show confirmation and delete if confirmed
                    const { showDeleteConfirmationModal } = await import('../ui/TaskCard');
                    await showDeleteConfirmationModal(task, this.plugin);
                }
            }
        );

        return actions;
    }

    getItems(): TaskAction[] {
        // Filter to only applicable actions and sort by category and title
        return this.actions
            .filter(action => action.isApplicable(this.task, this.plugin, this.targetDate))
            .sort((a, b) => {
                // Sort by category first
                const categoryOrder = {
                    'status': 0,
                    'priority': 1,
                    'dates': 2,
                    'tracking': 3,
                    'organization': 4,
                    'other': 5
                };
                
                const categoryA = categoryOrder[a.category] ?? 999;
                const categoryB = categoryOrder[b.category] ?? 999;
                
                if (categoryA !== categoryB) {
                    return categoryA - categoryB;
                }
                
                // Then by title
                return a.title.localeCompare(b.title);
            });
    }

    getItemText(action: TaskAction): string {
        // Include title, description, and keywords in searchable text
        return [
            action.title,
            action.description,
            action.category,
            ...action.keywords
        ].join(' ');
    }

    renderSuggestion(item: FuzzyMatch<TaskAction>, el: HTMLElement) {
        const action = item.item;
        const container = el.createDiv({ cls: 'task-action-palette__suggestion' });
        
        // Icon
        const iconEl = container.createDiv({ cls: 'task-action-palette__icon' });
        setIcon(iconEl, action.icon);
        
        // Content
        const contentEl = container.createDiv({ cls: 'task-action-palette__content' });
        
        // Title
        contentEl.createDiv({ 
            cls: 'task-action-palette__title',
            text: action.title 
        });
        
        // Description
        contentEl.createDiv({ 
            cls: 'task-action-palette__description',
            text: action.description 
        });
        
        // Category badge
        const badgeEl = container.createDiv({ cls: 'task-action-palette__badge' });
        badgeEl.createSpan({ 
            cls: `task-action-palette__category task-action-palette__category--${action.category}`,
            text: action.category 
        });
    }

    async onChooseItem(action: TaskAction, evt: MouseEvent | KeyboardEvent) {
        try {
            // Refresh task data to ensure we have the latest information
            const freshTask = await this.plugin.cacheManager.getTaskInfo(this.task.path);
            if (!freshTask) {
                new Notice('Task not found');
                return;
            }
            
            await action.execute(freshTask, this.plugin, this.targetDate);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Error executing action:', {
                error: errorMessage,
                actionId: action.id,
                taskPath: this.task.path
            });
            new Notice(`Failed to execute action: ${errorMessage}`);
        }
    }
}