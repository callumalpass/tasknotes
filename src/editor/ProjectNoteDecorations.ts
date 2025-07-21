import { Decoration, DecorationSet, EditorView, PluginSpec, PluginValue, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { Extension, RangeSetBuilder, StateEffect } from '@codemirror/state';
import { TFile, editorLivePreviewField, editorInfoField, EventRef } from 'obsidian';
import TaskNotesPlugin from '../main';
import { TaskInfo, EVENT_DATA_CHANGED, EVENT_TASK_UPDATED, EVENT_TASK_DELETED } from '../types';
import { createTaskCard } from '../ui/TaskCard';
import { ProjectSubtasksService } from '../services/ProjectSubtasksService';

// Define a state effect for project subtasks updates
const projectSubtasksUpdateEffect = StateEffect.define<{ forceUpdate?: boolean }>();

class ProjectSubtasksWidget extends WidgetType {
    constructor(private plugin: TaskNotesPlugin, private tasks: TaskInfo[], private version: number = 0) {
        super();
    }
    
    // Override eq to ensure widget updates when tasks change
    eq(other: ProjectSubtasksWidget): boolean {
        return this.version === other.version && 
               this.tasks.length === other.tasks.length &&
               this.tasks.every((task, index) => {
                   const otherTask = other.tasks[index];
                   return task.title === otherTask.title && 
                          task.status === otherTask.status &&
                          task.priority === otherTask.priority &&
                          task.due === otherTask.due &&
                          task.scheduled === otherTask.scheduled &&
                          task.path === otherTask.path &&
                          JSON.stringify(task.contexts || []) === JSON.stringify(otherTask.contexts || []) &&
                          JSON.stringify(task.projects || []) === JSON.stringify(otherTask.projects || []) &&
                          JSON.stringify(task.tags || []) === JSON.stringify(otherTask.tags || []) &&
                          task.timeEstimate === otherTask.timeEstimate &&
                          task.recurrence === otherTask.recurrence &&
                          JSON.stringify(task.complete_instances || []) === JSON.stringify(otherTask.complete_instances || []);
               });
    }

    toDOM(view: EditorView): HTMLElement {
        const container = document.createElement('div');
        container.className = 'tasknotes-plugin project-note-subtasks project-subtasks-widget';
        
        container.setAttribute('contenteditable', 'false');
        container.setAttribute('spellcheck', 'false');
        container.setAttribute('data-widget-type', 'project-subtasks');
        
        // Add title with collapsible functionality
        const titleContainer = container.createEl('div', {
            cls: 'project-note-subtasks__header'
        });
        
        const titleEl = titleContainer.createEl('h3', {
            text: `Subtasks (${this.tasks.length})`,
            cls: 'project-note-subtasks__title'
        });
        
        // Add new subtask button
        const newSubtaskBtn = titleContainer.createEl('button', {
            text: 'New',
            cls: 'project-note-subtasks__new-btn'
        });
        
        newSubtaskBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.createNewSubtask();
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

    private createNewSubtask(): void {
        // Get current file to use as project reference
        const currentFile = this.plugin.app.workspace.getActiveFile();
        if (!currentFile) {
            return;
        }
        
        // Create wikilink format for the project reference
        const projectReference = `[[${currentFile.basename}]]`;
        
        // Open task creation modal with project pre-populated
        this.plugin.openTaskCreationModal({
            projects: [projectReference]
        });
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
    private version = 0;
    
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
        
        // Check for project subtasks update effects
        const hasUpdateEffect = update.transactions.some(tr => 
            tr.effects.some(effect => effect.is(projectSubtasksUpdateEffect))
        );
        
        if (update.docChanged || update.viewportChanged || hasUpdateEffect) {
            this.decorations = this.buildDecorations(update.view);
        }
        
        // Check if file changed for this specific view
        const newFile = this.getFileFromView(update.view);
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
    
    private dispatchUpdate() {
        // Increment version and dispatch update effect
        this.version++;
        if (this.view && typeof this.view.dispatch === 'function') {
            try {
                this.view.dispatch({
                    effects: [projectSubtasksUpdateEffect.of({ forceUpdate: true })]
                });
            } catch (error) {
                console.error('Error dispatching project subtasks update:', error);
            }
        }
    }
    
    private async loadTasksForCurrentFile(view: EditorView) {
        const file = this.getFileFromView(view);
        
        if (file instanceof TFile) {
            try {
                const newTasks = await this.projectService.getTasksLinkedToProject(file);
                
                // Check if tasks actually changed
                const tasksChanged = newTasks.length !== this.cachedTasks.length ||
                    newTasks.some((newTask, index) => {
                        const oldTask = this.cachedTasks[index];
                        return !oldTask || 
                               newTask.title !== oldTask.title ||
                               newTask.status !== oldTask.status ||
                               newTask.priority !== oldTask.priority ||
                               newTask.due !== oldTask.due ||
                               newTask.path !== oldTask.path;
                    });
                
                if (tasksChanged) {
                    this.cachedTasks = newTasks;
                    this.dispatchUpdate();
                }
            } catch (error) {
                console.error('Error loading tasks for project note:', error);
            }
        } else {
            if (this.cachedTasks.length > 0) {
                this.cachedTasks = [];
                this.dispatchUpdate();
            }
        }
    }
    
    private getFileFromView(view: EditorView): TFile | null {
        // Get the file associated with this specific editor view
        const editorInfo = view.state.field(editorInfoField, false);
        return editorInfo?.file || null;
    }
    
    private isTableCellEditor(view: EditorView): boolean {
        try {
            // Check if the editor is inside a table cell using DOM inspection
            const editorElement = view.dom;
            const tableCell = editorElement.closest('td, th');
            
            if (tableCell) {
                return true;
            }
            
            // Also check for Obsidian-specific table widget classes
            const obsidianTableWidget = editorElement.closest('.cm-table-widget');
            if (obsidianTableWidget) {
                return true;
            }
            
            // Additional check: inline editors without file association
            const editorInfo = view.state.field(editorInfoField, false);
            if (!editorInfo?.file) {
                // This might be an inline editor - check if parent is table-related
                let parent = editorElement.parentElement;
                while (parent && parent !== document.body) {
                    if (parent.tagName === 'TABLE' || 
                        parent.tagName === 'TD' || 
                        parent.tagName === 'TH' ||
                        parent.classList.contains('markdown-rendered')) {
                        return true;
                    }
                    parent = parent.parentElement;
                }
            }
            
            return false;
        } catch (error) {
            console.debug('Error detecting table cell editor:', error);
            return false;
        }
    }

    private buildDecorations(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        
        try {
            // Don't show widget in table cell editors
            if (this.isTableCellEditor(view)) {
                return builder.finish();
            }
            
            // Check if project subtasks widget is enabled
            if (!this.plugin.settings.showProjectSubtasks) {
                return builder.finish();
            }
            
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
                widget: new ProjectSubtasksWidget(this.plugin, this.cachedTasks, this.version),
                side: 1  // Place widget after the position so cursor can't go past it
            });
            
            builder.add(insertPos, insertPos, widget);
            
        } catch (error) {
            console.error('Error building project note decorations:', error);
        }
        
        return builder.finish();
    }


    private findInsertionPosition(view: EditorView, doc: any): number {
        if (doc.lines === 0) return 0;
        
        // Insert at the very end of the document
        return doc.length;
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

/**
 * Helper function to dispatch project subtasks update effects to an editor view
 */
export function dispatchProjectSubtasksUpdate(view: EditorView): void {
    // Validate that view is a proper EditorView with dispatch method
    if (!view || typeof view.dispatch !== 'function') {
        console.warn('Invalid EditorView passed to dispatchProjectSubtasksUpdate:', view);
        return;
    }
    
    try {
        view.dispatch({
            effects: [projectSubtasksUpdateEffect.of({ forceUpdate: true })]
        });
    } catch (error) {
        console.error('Error dispatching project subtasks update:', error);
    }
}
