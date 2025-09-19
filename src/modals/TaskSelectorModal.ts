import { App, FuzzySuggestModal, FuzzyMatch, TFile, Notice } from 'obsidian';
import { TaskInfo } from '../types';
import { isPastDate, isToday } from '../utils/dateUtils';
import { filterEmptyProjects } from '../utils/helpers';
import type TaskNotesPlugin from '../main';
import { TranslationKey } from '../i18n/types';

export class TaskSelectorModal extends FuzzySuggestModal<TaskInfo> {
    private tasks: TaskInfo[];
    private onChooseTask: (task: TaskInfo | null) => void;
    private plugin: TaskNotesPlugin;
    private translate: (key: TranslationKey, variables?: Record<string, any>) => string;

    constructor(app: App, plugin: TaskNotesPlugin, tasks: TaskInfo[], onChooseTask: (task: TaskInfo | null) => void) {
        super(app);
        this.plugin = plugin;
        this.tasks = tasks;
        this.onChooseTask = onChooseTask;
        this.translate = plugin.i18n.translate;
        
        this.setPlaceholder(this.translate('modals.taskSelector.placeholder'));
        this.setInstructions([
            { command: '↑↓', purpose: this.translate('modals.taskSelector.instructions.navigate') },
            { command: '↵', purpose: this.translate('modals.taskSelector.instructions.select') },
            { command: 'esc', purpose: this.translate('modals.taskSelector.instructions.dismiss') },
        ]);
        
        // Set modal title for accessibility
        this.titleEl.setText(this.translate('modals.taskSelector.title'));
        this.titleEl.setAttribute('id', 'task-selector-title');
        
        // Set aria attributes on the modal
        this.containerEl.setAttribute('aria-labelledby', 'task-selector-title');
        this.containerEl.setAttribute('role', 'dialog');
        this.containerEl.setAttribute('aria-modal', 'true');
    }

    getItems(): TaskInfo[] {
        // Filter  archived tasks, sort by completion status first, then by due date and priority
        return this.tasks
            .filter(task => !task.archived)
            .sort((a, b) => {
                // Sort by completion status first (incomplete tasks come first)
                const aCompleted = this.plugin.statusManager.isCompletedStatus(a.status);
                const bCompleted = this.plugin.statusManager.isCompletedStatus(b.status);
                if (aCompleted !== bCompleted) {
                    return aCompleted ? 1 : -1; // Incomplete (false) comes before completed (true)
                }
                
                // Sort by due date second (tasks with due dates come first)
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
        const filteredProjects = filterEmptyProjects(task.projects || []);
        if (filteredProjects.length > 0) {
            text += ` ${filteredProjects.join(' ')}`;
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
                dueDateText = this.translate('modals.taskSelector.dueDate.overdue', { date: task.due });
                dueDateClass += ' task-selector-modal__due-date--overdue';
            } else if (isDueToday) {
                dueDateText = this.translate('modals.taskSelector.dueDate.today');
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
                    text: `${context}` 
                });
            });
        }
        
        // Projects
        const filteredProjects = filterEmptyProjects(task.projects || []);
        if (filteredProjects.length > 0) {
            const projectsSpan = metaDiv.createSpan({ cls: 'task-selector-modal__projects' });
            filteredProjects.forEach((project, index) => {
                if (index > 0) projectsSpan.createSpan({ text: ', ' });
                
                const plusText = document.createTextNode('+');
                projectsSpan.appendChild(plusText);
                
                if (isWikilinkProject(project)) {
                    // Extract the note name from [[Note Name]]
                    const noteName = project.slice(2, -2);
                    
                    // Create a clickable link
                    const linkEl = projectsSpan.createEl('a', {
                        cls: 'task-selector-modal__project-link internal-link',
                        text: noteName,
                        attr: { 'data-href': noteName }
                    });
                    
                    // Add click handler to open the note
                    linkEl.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Resolve the link to get the actual file
                        const file = this.plugin.app.metadataCache.getFirstLinkpathDest(noteName, '');
                        if (file instanceof TFile) {
                            // Open the file in the current leaf
                            await this.plugin.app.workspace.getLeaf(false).openFile(file);
                            // Close this modal after opening the file
                            this.close();
                        } else {
                            // File not found, show notice
                            new Notice(this.translate('modals.taskSelector.notices.noteNotFound', { name: noteName }));
                        }
                    });
                } else {
                    // Plain text project
                    projectsSpan.createSpan({ 
                        cls: 'task-selector-modal__project-tag',
                        text: project
                    });
                }
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

/**
 * Check if a project string is in wikilink format [[Note Name]]
 */
function isWikilinkProject(project: string): boolean {
    return Boolean(project && typeof project === 'string' && project.startsWith('[[') && project.endsWith(']]'));
}
