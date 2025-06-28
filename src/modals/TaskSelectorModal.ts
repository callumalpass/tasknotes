import { App, FuzzySuggestModal, FuzzyMatch } from 'obsidian';
import { TaskInfo } from '../types';
import { isPastDate, isToday } from '../utils/dateUtils';
import type TaskNotesPlugin from '../main';

export class TaskSelectorModal extends FuzzySuggestModal<TaskInfo> {
    private tasks: TaskInfo[];
    private onChooseTask: (task: TaskInfo | null) => void;
    private plugin: TaskNotesPlugin;

    constructor(app: App, plugin: TaskNotesPlugin, tasks: TaskInfo[], onChooseTask: (task: TaskInfo | null) => void) {
        super(app);
        this.plugin = plugin;
        this.tasks = tasks;
        this.onChooseTask = onChooseTask;
        
        this.setPlaceholder('Type to search for a task...');
        this.setInstructions([
            { command: '↑↓', purpose: 'to navigate' },
            { command: '↵', purpose: 'to select' },
            { command: 'esc', purpose: 'to dismiss' },
        ]);
        
        // Set modal title for accessibility
        this.titleEl.setText('Select Task');
        this.titleEl.setAttribute('id', 'task-selector-title');
        
        // Set aria attributes on the modal
        this.containerEl.setAttribute('aria-labelledby', 'task-selector-title');
        this.containerEl.setAttribute('role', 'dialog');
        this.containerEl.setAttribute('aria-modal', 'true');
    }

    getItems(): TaskInfo[] {
        // Filter  archived tasks, sort by due date and priority
        return this.tasks
            .filter(task => !task.archived)
            .sort((a, b) => {
                // Sort by due date first (tasks with due dates come first)
                if (a.due && !b.due) return -1;
                if (!a.due && b.due) return 1;
                if (a.due && b.due) {
                    const dateCompare = a.due.localeCompare(b.due);
                    if (dateCompare !== 0) return dateCompare;
                }
                
                // Then by priority (high -> normal -> low)
                const priorityOrder: Record<string, number> = { high: 0, normal: 1, low: 2 };
                const aPriority = priorityOrder[a.priority] ?? 1;
                const bPriority = priorityOrder[b.priority] ?? 1;
                if (aPriority !== bPriority) return aPriority - bPriority;
                
                // Finally by title
                return a.title.localeCompare(b.title);
            });
    }

    getItemText(task: TaskInfo): string {
        // Include title, due date, and priority in searchable text
        let text = task.title;
        if (task.due) {
            text += ` ${task.due}`;
        }
        if (task.priority !== 'normal') {
            text += ` ${task.priority}`;
        }
        if (task.contexts && task.contexts.length > 0) {
            text += ` ${task.contexts.join(' ')}`;
        }
        return text;
    }

    renderSuggestion(item: FuzzyMatch<TaskInfo>, el: HTMLElement) {
        const task = item.item;
        const container = el.createDiv({ cls: 'task-selector-modal__suggestion' });
        
        // Title with priority indicator
        const titleDiv = container.createDiv({ cls: 'task-selector-modal__title' });
        const priorityClass = task.priority !== 'normal' ? `task-selector-modal__task-title--${task.priority}-priority` : '';
        titleDiv.createSpan({ 
            cls: `task-selector-modal__task-title ${priorityClass}`,
            text: task.title 
        });
        
        // Metadata line
        const metaDiv = container.createDiv({ cls: 'task-selector-modal__meta' });
        
        // Due date
        if (task.due) {
            const isOverdue = isPastDate(task.due);
            const isDueToday = isToday(task.due);
            
            let dueDateText = task.due;
            let dueDateClass = 'task-selector-modal__due-date';
            
            if (isOverdue) {
                dueDateText = `Overdue (${task.due})`;
                dueDateClass += ' task-selector-modal__due-date--overdue';
            } else if (isDueToday) {
                dueDateText = 'Due today';
                dueDateClass += ' task-selector-modal__due-date--today';
            }
            
            metaDiv.createSpan({ 
                cls: dueDateClass,
                text: dueDateText 
            });
        }
        
        // Contexts
        if (task.contexts && task.contexts.length > 0) {
            const contextsSpan = metaDiv.createSpan({ cls: 'task-selector-modal__contexts' });
            task.contexts.forEach((context, index) => {
                if (index > 0) contextsSpan.createSpan({ text: ', ' });
                contextsSpan.createSpan({ 
                    cls: 'task-selector-modal__context-tag',
                    text: context 
                });
            });
        }
        
        // Status
        if (task.status !== 'open') {
            const statusConfig = this.plugin.statusManager.getStatusConfig(task.status);
            metaDiv.createSpan({ 
                cls: `task-selector-modal__status`,
                text: statusConfig ? statusConfig.label : task.status 
            });
        }
    }

    onChooseItem(item: TaskInfo, evt: MouseEvent | KeyboardEvent) {
        this.onChooseTask(item);
    }

    onClose() {
        super.onClose();
        // If user closed without selecting, call callback with null
        // Note: This will be called even after selection, but the callback should handle that gracefully
    }
}
