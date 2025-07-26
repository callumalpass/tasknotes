import { Decoration, DecorationSet, EditorView, PluginSpec, PluginValue, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { Extension, RangeSetBuilder, StateEffect } from '@codemirror/state';
import { TFile, editorLivePreviewField, editorInfoField, EventRef } from 'obsidian';
import TaskNotesPlugin from '../main';
import { TaskInfo, EVENT_DATA_CHANGED, EVENT_TASK_UPDATED, EVENT_TASK_DELETED, FilterQuery } from '../types';
import { createTaskCard } from '../ui/TaskCard';
import { ProjectSubtasksService } from '../services/ProjectSubtasksService';
import { FilterBar } from '../ui/FilterBar';
import { FilterService } from '../services/FilterService';

// Define a state effect for project subtasks updates
const projectSubtasksUpdateEffect = StateEffect.define<{ forceUpdate?: boolean }>();

class ProjectSubtasksWidget extends WidgetType {
    private groupedTasks: Map<string, TaskInfo[]> = new Map();
    private filterBar: FilterBar | null = null;
    private filterService: FilterService;
    private currentQuery: FilterQuery;
    private savedViewsUnsubscribe: (() => void) | null = null;

    constructor(private plugin: TaskNotesPlugin, private tasks: TaskInfo[], private version: number = 0) {
        super();
        // Initialize with ungrouped tasks
        this.groupedTasks.set('all', [...tasks]);
        this.filterService = new FilterService(
            plugin.cacheManager,
            plugin.statusManager, 
            plugin.priorityManager
        );
        
        // Initialize with default filter query
        this.currentQuery = {
            type: 'group',
            id: 'root',
            conjunction: 'and',
            children: [],
            sortKey: 'priority',
            sortDirection: 'desc',
            groupKey: 'none'
        };
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

    destroy(): void {
        // Clean up the filter bar
        if (this.filterBar) {
            this.filterBar.destroy();
            this.filterBar = null;
        }
        
        // Clean up ViewStateManager event listeners
        if (this.savedViewsUnsubscribe) {
            this.savedViewsUnsubscribe();
            this.savedViewsUnsubscribe = null;
        }
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
        
        // Create content container that will hold both filter bar and task list
        const contentContainer = container.createEl('div', {
            cls: 'project-note-subtasks__content'
        });
        
        // Add collapsible functionality
        const isCollapsed = this.getCollapsedState();
        if (isCollapsed) {
            titleEl.classList.add('collapsed');
            contentContainer.classList.add('collapsed');
        }
        
        // Add click handler for collapsing/expanding
        titleEl.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const isCurrentlyCollapsed = titleEl.classList.contains('collapsed');
            
            if (isCurrentlyCollapsed) {
                titleEl.classList.remove('collapsed');
                contentContainer.classList.remove('collapsed');
                this.setCollapsedState(false);
            } else {
                titleEl.classList.add('collapsed');
                contentContainer.classList.add('collapsed');
                this.setCollapsedState(true);
            }
        });
        
        // Create filter bar container
        const filterContainer = contentContainer.createEl('div', {
            cls: 'project-note-subtasks__filter'
        });
        
        // Create task list container
        const taskListContainer = contentContainer.createEl('div', {
            cls: 'project-note-subtasks__list'
        });
        
        // Initialize the filter bar asynchronously
        this.initializeFilterBar(filterContainer).then(() => {
            this.applyFiltersAndRender(taskListContainer);
        });
        
        // Initial render of tasks
        this.renderTaskGroups(taskListContainer);
        
        return container;
    }

    private async initializeFilterBar(container: HTMLElement): Promise<void> {
        try {
            const filterOptions = await this.filterService.getFilterOptions();
            
            this.filterBar = new FilterBar(
                this.plugin.app,
                container,
                this.currentQuery,
                filterOptions
            );
            
            // Load saved views from the main ViewStateManager
            const savedViews = this.plugin.viewStateManager.getSavedViews();
            this.filterBar.updateSavedViews(savedViews);
            
            // Listen for filter changes
            this.filterBar.on('queryChange', (query: FilterQuery) => {
                this.currentQuery = query;
                this.applyFiltersAndRender();
            });
            
            // Listen for saved view operations
            this.filterBar.on('saveView', (data: { name: string, query: FilterQuery }) => {
                this.plugin.viewStateManager.saveView(data.name, data.query);
            });
            
            this.filterBar.on('deleteView', (viewId: string) => {
                this.plugin.viewStateManager.deleteView(viewId);
            });
            
            this.filterBar.on('reorderViews', (fromIndex: number, toIndex: number) => {
                this.plugin.viewStateManager.reorderSavedViews(fromIndex, toIndex);
            });
            
            // Listen for saved views changes from ViewStateManager
            this.savedViewsUnsubscribe = this.plugin.viewStateManager.on('saved-views-changed', (updatedViews) => {
                if (this.filterBar) {
                    this.filterBar.updateSavedViews(updatedViews);
                }
            });
            
        } catch (error) {
            console.error('Error initializing filter bar for subtasks:', error);
        }
    }

    private async applyFiltersAndRender(taskListContainer?: HTMLElement): Promise<void> {
        try {
            // Apply filters to get grouped tasks
            const allGroupedTasks = await this.filterService.getGroupedTasks(this.currentQuery);
            
            // Filter grouped tasks to only include our original subtasks
            const originalTaskPaths = new Set(this.tasks.map(t => t.path));
            this.groupedTasks.clear();
            
            for (const [groupKey, tasks] of allGroupedTasks) {
                const filteredGroupTasks = tasks.filter(task => originalTaskPaths.has(task.path));
                if (filteredGroupTasks.length > 0) {
                    this.groupedTasks.set(groupKey, filteredGroupTasks);
                }
            }
            
            // Re-render tasks if container is provided
            if (taskListContainer) {
                this.renderTaskGroups(taskListContainer);
            } else {
                // Find the task list container if not provided
                const container = document.querySelector('.project-note-subtasks__list');
                if (container) {
                    this.renderTaskGroups(container as HTMLElement);
                }
            }
        } catch (error) {
            console.error('Error applying filters to subtasks:', error);
            // Fallback to unfiltered, ungrouped tasks
            this.groupedTasks.clear();
            this.groupedTasks.set('all', [...this.tasks]);
        }
    }

    private renderTaskGroups(taskListContainer: HTMLElement): void {
        // Clear existing tasks
        taskListContainer.empty();
        
        // Calculate total filtered tasks for count display
        let totalFilteredTasks = 0;
        for (const tasks of this.groupedTasks.values()) {
            totalFilteredTasks += tasks.length;
        }
        
        // Render groups
        if (this.currentQuery.groupKey === 'none' || this.groupedTasks.size <= 1) {
            // No grouping - render tasks directly
            const tasks = this.groupedTasks.size === 1 
                ? Array.from(this.groupedTasks.values())[0] 
                : this.groupedTasks.get('all') || [];
            tasks.forEach(task => {
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
        } else {
            // Render grouped tasks with group headers
            for (const [groupKey, tasks] of this.groupedTasks.entries()) {
                if (tasks.length === 0) continue;
                
                // Create group header
                const groupHeader = taskListContainer.createEl('div', {
                    cls: 'project-note-subtasks__group-header'
                });
                
                groupHeader.createEl('h4', {
                    cls: 'project-note-subtasks__group-title',
                    text: this.getGroupDisplayName(groupKey, tasks.length)
                });
                
                // Create group container
                const groupContainer = taskListContainer.createEl('div', {
                    cls: 'project-note-subtasks__group'
                });
                
                // Render tasks in this group
                tasks.forEach(task => {
                    const taskCard = createTaskCard(task, this.plugin, {
                        showDueDate: true,
                        showCheckbox: false,
                        showArchiveButton: false,
                        showTimeTracking: false,
                        showRecurringControls: true,
                        groupByDate: false
                    });
                    
                    taskCard.classList.add('project-note-subtasks__task');
                    groupContainer.appendChild(taskCard);
                });
            }
        }

        // Update count in title if it exists
        const titleEl = taskListContainer.parentElement?.parentElement?.querySelector('.project-note-subtasks__title');
        if (titleEl) {
            titleEl.textContent = `Subtasks (${totalFilteredTasks}${totalFilteredTasks !== this.tasks.length ? ` of ${this.tasks.length}` : ''})`;
        }
    }

    private getGroupDisplayName(groupKey: string, taskCount: number): string {
        // Handle different group types with user-friendly names
        switch (groupKey) {
            case 'none':
            case 'all':
                return `All Tasks (${taskCount})`;
            case 'No Status':
                return `No Status (${taskCount})`;
            case 'No Priority':
                return `No Priority (${taskCount})`;
            case 'No Context':
                return `No Context (${taskCount})`;
            case 'No Project':
                return `No Project (${taskCount})`;
            case 'No Due Date':
                return `No Due Date (${taskCount})`;
            case 'No Scheduled Date':
                return `No Scheduled Date (${taskCount})`;
            default:
                return `${groupKey} (${taskCount})`;
        }
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
