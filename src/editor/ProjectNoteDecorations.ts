import { Decoration, DecorationSet, EditorView, PluginSpec, PluginValue, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { Extension, RangeSetBuilder } from '@codemirror/state';
import { TFile, editorLivePreviewField, EventRef } from 'obsidian';
import TaskNotesPlugin from '../main';
import { TaskInfo, EVENT_DATA_CHANGED, EVENT_TASK_UPDATED, EVENT_TASK_DELETED } from '../types';
import { createTaskCard } from '../ui/TaskCard';
import { ProjectSubtasksService } from '../services/ProjectSubtasksService';

class ProjectSubtasksWidget extends WidgetType {
    constructor(private plugin: TaskNotesPlugin, private tasks: TaskInfo[]) {
        super();
    }

    toDOM(view: EditorView): HTMLElement {
        const container = document.createElement('div');
        container.className = 'tasknotes-plugin project-note-subtasks';
        
        // Force block display and full width for inline widget
        container.style.display = 'block';
        container.style.width = '100%';
        container.style.clear = 'both';
        container.style.position = 'relative';
        
        // Add title with collapsible functionality
        const titleEl = container.createEl('h3', {
            text: `Subtasks (${this.tasks.length})`,
            cls: 'project-note-subtasks__title'
        });
        
        // Create task list container
        const taskListContainer = container.createEl('div', {
            cls: 'project-note-subtasks__list'
        });
        
        // Add collapsible functionality
        const isCollapsed = this.getCollapsedState();
        if (isCollapsed) {
            titleEl.classList.add('collapsed');
            taskListContainer.classList.add('collapsed');
        }
        
        // Add click handler for collapsing/expanding
        titleEl.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const isCurrentlyCollapsed = titleEl.classList.contains('collapsed');
            
            if (isCurrentlyCollapsed) {
                titleEl.classList.remove('collapsed');
                taskListContainer.classList.remove('collapsed');
                this.setCollapsedState(false);
            } else {
                titleEl.classList.add('collapsed');
                taskListContainer.classList.add('collapsed');
                this.setCollapsedState(true);
            }
        });
        
        // Sort and render tasks (use static method to avoid creating new service instance)
        const sortedTasks = this.sortTasks(this.tasks);
        sortedTasks.forEach(task => {
            const taskCard = createTaskCard(task, this.plugin, {
                showDueDate: true,
                showCheckbox: false,
                showArchiveButton: false,
                showTimeTracking: false,
                showRecurringControls: true,
                groupByDate: false
            });
            
            taskCard.classList.add('project-note-subtasks__task');
            taskListContainer.appendChild(taskCard);
        });
        
        return container;
    }

    private sortTasks(tasks: TaskInfo[]): TaskInfo[] {
        return tasks.sort((a, b) => {
            // First sort by completion status (incomplete first)
            const aCompleted = this.plugin.statusManager.isCompletedStatus(a.status);
            const bCompleted = this.plugin.statusManager.isCompletedStatus(b.status);
            
            if (aCompleted !== bCompleted) {
                return aCompleted ? 1 : -1;
            }
            
            // Then sort by priority
            const aPriorityWeight = this.plugin.priorityManager.getPriorityWeight(a.priority);
            const bPriorityWeight = this.plugin.priorityManager.getPriorityWeight(b.priority);
            
            if (aPriorityWeight !== bPriorityWeight) {
                return bPriorityWeight - aPriorityWeight; // Higher priority first
            }
            
            // Then sort by due date (earliest first)
            if (a.due && b.due) {
                return new Date(a.due).getTime() - new Date(b.due).getTime();
            } else if (a.due) {
                return -1; // Tasks with due dates come first
            } else if (b.due) {
                return 1;
            }
            
            // Finally sort by title
            return a.title.localeCompare(b.title);
        });
    }

    /**
     * Get the collapsed state for project subtasks from localStorage
     */
    private getCollapsedState(): boolean {
        try {
            const stored = localStorage.getItem('tasknotes-project-subtasks-collapsed');
            return stored === 'true';
        } catch (error) {
            return false;
        }
    }

    /**
     * Set the collapsed state for project subtasks in localStorage
     */
    private setCollapsedState(collapsed: boolean): void {
        try {
            if (collapsed) {
                localStorage.setItem('tasknotes-project-subtasks-collapsed', 'true');
            } else {
                localStorage.removeItem('tasknotes-project-subtasks-collapsed');
            }
        } catch (error) {
            // Ignore localStorage errors
        }
    }

}

class ProjectNoteDecorationsPlugin implements PluginValue {
    decorations: DecorationSet;
    private cachedTasks: TaskInfo[] = [];
    private currentFile: TFile | null = null;
    private projectService: ProjectSubtasksService;
    private eventListeners: EventRef[] = [];
    private view: EditorView;
    
    constructor(view: EditorView, private plugin: TaskNotesPlugin) {
        this.view = view;
        this.projectService = new ProjectSubtasksService(plugin);
        this.decorations = this.buildDecorations(view);
        
        // Set up event listeners for data changes
        this.setupEventListeners();
        
        // Load tasks for current file asynchronously
        this.loadTasksForCurrentFile(view);
    }

    update(update: ViewUpdate) {
        // Store the updated view reference
        this.view = update.view;
        
        if (update.docChanged || update.viewportChanged) {
            this.decorations = this.buildDecorations(update.view);
        }
        
        // Check if file changed
        const newFile = this.plugin.app.workspace.getActiveFile();
        if (newFile !== this.currentFile) {
            this.currentFile = newFile;
            this.loadTasksForCurrentFile(update.view);
        }
    }
    
    destroy() {
        // Clean up event listeners
        this.eventListeners.forEach(listener => {
            this.plugin.emitter.offref(listener);
        });
        this.eventListeners = [];
    }
    
    private setupEventListeners() {
        // Listen for data changes that might affect project subtasks
        const dataChangeListener = this.plugin.emitter.on(EVENT_DATA_CHANGED, () => {
            // Refresh tasks for current file when data changes
            this.loadTasksForCurrentFile(this.view);
        });
        
        const taskUpdateListener = this.plugin.emitter.on(EVENT_TASK_UPDATED, () => {
            // Refresh tasks for current file when tasks are updated
            this.loadTasksForCurrentFile(this.view);
        });
        
        const taskDeleteListener = this.plugin.emitter.on(EVENT_TASK_DELETED, () => {
            // Refresh tasks for current file when tasks are deleted
            this.loadTasksForCurrentFile(this.view);
        });
        
        // Listen for settings changes that might affect project subtasks
        const settingsChangeListener = this.plugin.emitter.on('settings-changed', () => {
            // Refresh tasks when settings change (e.g., custom fields, statuses)
            this.loadTasksForCurrentFile(this.view);
        });
        
        // Listen for cache events that might affect project subtasks
        const fileUpdateListener = this.plugin.emitter.on('file-updated', (data: { path: string }) => {
            // Refresh if the updated file might contain project references
            this.loadTasksForCurrentFile(this.view);
        });
        
        const fileDeleteListener = this.plugin.emitter.on('file-deleted', (data: { path: string }) => {
            // Refresh if a file was deleted that might have affected project references
            this.loadTasksForCurrentFile(this.view);
        });
        
        const fileRenameListener = this.plugin.emitter.on('file-renamed', (data: { oldPath: string, newPath: string }) => {
            // Refresh if a file was renamed that might have affected project references
            this.loadTasksForCurrentFile(this.view);
        });
        
        this.eventListeners.push(
            dataChangeListener, 
            taskUpdateListener, 
            taskDeleteListener,
            settingsChangeListener,
            fileUpdateListener,
            fileDeleteListener,
            fileRenameListener
        );
    }
    
    private async loadTasksForCurrentFile(view: EditorView) {
        const file = this.plugin.app.workspace.getActiveFile();
        
        if (file instanceof TFile) {
            try {
                this.cachedTasks = await this.projectService.getTasksLinkedToProject(file);
                
                this.decorations = this.buildDecorations(view);
                view.requestMeasure();
            } catch (error) {
                console.error('Error loading tasks for project note:', error);
            }
        } else {
            this.cachedTasks = [];
        }
    }

    private buildDecorations(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        
        try {
            // Only show in live preview mode, not source mode
            if (!view.state.field(editorLivePreviewField)) {
                return builder.finish();
            }
            
            // Only build decorations if we have cached tasks
            if (this.cachedTasks.length === 0) {
                return builder.finish();
            }
            
            const doc = view.state.doc;
            
            // Ensure document has content
            if (doc.length === 0) {
                return builder.finish();
            }
            
            // Find insertion position after frontmatter/properties
            let insertPos = this.findInsertionPosition(view, doc);
            
            // Ensure position is valid
            if (insertPos < 0 || insertPos > doc.length) {
                insertPos = 0;
            }
            
            const widget = Decoration.widget({
                widget: new ProjectSubtasksWidget(this.plugin, this.cachedTasks),
                side: 1  // Place widget after the position
            });
            
            builder.add(insertPos, insertPos, widget);
            
        } catch (error) {
            console.error('Error building project note decorations:', error);
        }
        
        return builder.finish();
    }


    private findInsertionPosition(view: EditorView, doc: any): number {
        if (doc.lines === 0) return 0;
        
        // Find the end of frontmatter if it exists
        let insertionPos = 0;
        let inFrontmatter = false;
        
        for (let lineNum = 1; lineNum <= Math.min(doc.lines, 20); lineNum++) {
            try {
                const line = doc.line(lineNum);
                const text = line.text.trim();
                
                // Check for frontmatter start
                if (lineNum === 1 && text === '---') {
                    inFrontmatter = true;
                    insertionPos = line.to;
                    continue;
                }
                
                // Check for frontmatter end
                if (inFrontmatter && text === '---') {
                    insertionPos = line.to;
                    inFrontmatter = false;
                    
                    // Look for next line to insert after frontmatter
                    if (lineNum < doc.lines) {
                        const nextLine = doc.line(lineNum + 1);
                        if (nextLine.text.trim() === '') {
                            insertionPos = nextLine.to;
                        }
                    }
                    break;
                }
                
                // If we're in frontmatter, continue
                if (inFrontmatter) {
                    insertionPos = line.to;
                    continue;
                }
                
                // If no frontmatter, insert at the beginning
                if (lineNum === 1) {
                    insertionPos = 0;
                    break;
                }
                
            } catch (error) {
                // If we can't read a line, fall back to previous position
                break;
            }
        }
        
        // If we went through all lines or hit an error, insert at the end of processed content
        return Math.max(0, insertionPos);
    }

}

const projectNoteDecorationsSpec: PluginSpec<ProjectNoteDecorationsPlugin> = {
    decorations: (plugin: ProjectNoteDecorationsPlugin) => plugin.decorations
};

/**
 * Create the project note decorations extension
 */
export function createProjectNoteDecorations(plugin: TaskNotesPlugin): Extension {
    return ViewPlugin.fromClass(
        class extends ProjectNoteDecorationsPlugin {
            constructor(view: EditorView) {
                super(view, plugin);
            }
            
            destroy() {
                super.destroy();
            }
        },
        projectNoteDecorationsSpec
    );
}