import { TFile, ItemView, WorkspaceLeaf, EventRef, Notice, setIcon } from 'obsidian';
import TaskNotesPlugin from '../main';
import {
    TASK_LIST_VIEW_TYPE,
    TaskInfo,
    EVENT_DATA_CHANGED,
    EVENT_TASK_UPDATED,
    EVENT_DATE_CHANGED,
    FilterQuery,
    SavedView
} from '../types';
// No helper functions needed from helpers
import { perfMonitor } from '../utils/PerformanceMonitor';
import { createTaskCard, updateTaskCard, refreshParentTaskSubtasks } from '../ui/TaskCard';
import { FilterBar } from '../ui/FilterBar';
import { GroupingUtils } from '../utils/GroupingUtils';
import { FilterHeading } from '../ui/FilterHeading';
import { GroupCountUtils } from '../utils/GroupCountUtils';

export class TaskListView extends ItemView {
    plugin: TaskNotesPlugin;
    
    // UI elements
    private taskListContainer: HTMLElement | null = null;
    private loadingIndicator: HTMLElement | null = null;
    
    // Removed redundant local caching - CacheManager is the single source of truth
    
    // Loading states
    private isTasksLoading = false;
    
    // Filter system
    private filterBar: FilterBar | null = null;
    private filterHeading: FilterHeading | null = null;
    private currentQuery: FilterQuery;
    
    // Task item tracking for dynamic updates
    private taskElements: Map<string, HTMLElement> = new Map();
    
    // Event listeners
    private listeners: EventRef[] = [];
    private functionListeners: (() => void)[] = [];
    
    constructor(leaf: WorkspaceLeaf, plugin: TaskNotesPlugin) {
        super(leaf);
        this.plugin = plugin;
        
        // Initialize with default query - will be properly set when plugin services are ready
        this.currentQuery = {
            type: 'group',
            id: 'temp',
            conjunction: 'and',
            children: [],
            sortKey: 'due',
            sortDirection: 'asc',
            groupKey: 'none'
        };
        
        // Register event listeners
        this.registerEvents();
    }
    
    getViewType(): string {
        return TASK_LIST_VIEW_TYPE;
    }
    
    getDisplayText(): string {
        return 'Tasks';
    }
    
    getIcon(): string {
        return 'check-square';
    }
    
    registerEvents(): void {
        // Clean up any existing listeners
        this.listeners.forEach(listener => this.plugin.emitter.offref(listener));
        this.listeners = [];
        this.functionListeners.forEach(unsubscribe => unsubscribe());
        this.functionListeners = [];
        
        // Listen for data changes
        const dataListener = this.plugin.emitter.on(EVENT_DATA_CHANGED, async () => {
            this.refresh();
            // Update FilterBar options when data changes (new properties, contexts, etc.)
            if (this.filterBar) {
                const updatedFilterOptions = await this.plugin.filterService.getFilterOptions();
                this.filterBar.updateFilterOptions(updatedFilterOptions);
            }
        });
        this.listeners.push(dataListener);
        
        // Listen for date changes to refresh recurring task states
        const dateChangeListener = this.plugin.emitter.on(EVENT_DATE_CHANGED, async () => {
            this.refresh();
        });
        this.listeners.push(dateChangeListener);
        
        // Listen for individual task updates
        const taskUpdateListener = this.plugin.emitter.on(EVENT_TASK_UPDATED, async ({ path, originalTask, updatedTask }) => {
            if (!path || !updatedTask) {
                console.error('EVENT_TASK_UPDATED received invalid data:', { path, originalTask, updatedTask });
                return;
            }
            
            // Check if any parent task cards need their subtasks refreshed
            await refreshParentTaskSubtasks(updatedTask, this.plugin, this.contentEl);
            
            // Check if this task is currently visible in our view
            const taskElement = this.taskElements.get(path);
            if (taskElement) {
                // Task is visible - update it in place using TaskCard's update function
                try {
                    const visibleProperties = this.getCurrentVisibleProperties();
                    updateTaskCard(taskElement, updatedTask, this.plugin, visibleProperties, {
                        showDueDate: true,
                        showCheckbox: false,
                        showArchiveButton: true,
                        showTimeTracking: true,
                        showRecurringControls: true,
                        groupByDate: false
                    });
                    
                    // Add update animation for real user updates
                    taskElement.classList.add('task-updated');
                    setTimeout(() => {
                        taskElement.classList.remove('task-updated');
                    }, 1000);
                } catch (error) {
                    console.error('Error updating task card:', error);
                    // Fallback to refresh if update fails
                    this.refreshTasks();
                }
            } else {
                // Task not currently visible - it might now match our filters, so refresh
                this.refreshTasks();
            }
            
            // Update FilterBar options when tasks are updated (may have new properties, contexts, etc.)
            if (this.filterBar) {
                const updatedFilterOptions = await this.plugin.filterService.getFilterOptions();
                this.filterBar.updateFilterOptions(updatedFilterOptions);
            }
        });
        this.listeners.push(taskUpdateListener);
        
        // Listen for filter service data changes
        const filterDataListener = this.plugin.filterService.on('data-changed', () => {
            this.refreshTasks();
        });
        this.functionListeners.push(filterDataListener);
    }
    
    async onOpen() {
        console.log('TaskListView: onOpen() called');
        try {
            console.log('TaskListView: Waiting for plugin to be ready...');
            // Wait for the plugin to be fully initialized before proceeding
            await this.plugin.onReady();
            console.log('TaskListView: Plugin ready, waiting for migration...');
            
            // Wait for migration to complete before initializing UI
            await this.plugin.waitForMigration();
            console.log('TaskListView: Migration complete, initializing query...');
            
            // Initialize with default query from FilterService
            this.currentQuery = this.plugin.filterService.createDefaultQuery();
            console.log('TaskListView: Default query created:', this.currentQuery);
            
            // Load saved filter state if it exists (will be empty after migration)
            const savedQuery = this.plugin.viewStateManager.getFilterState(TASK_LIST_VIEW_TYPE);
            if (savedQuery) {
                console.log('TaskListView: Loaded saved query:', savedQuery);
                this.currentQuery = savedQuery;
            }
            
            console.log('TaskListView: Calling refresh()...');
            await this.refresh();
        } catch (error) {
            console.error('TaskListView: Error during onOpen:', error);
            // Fall back to the old polling approach if onReady fails
            this.fallbackToPolling();
        }
    }

    private async fallbackToPolling() {
        // Show loading state
        this.contentEl.empty();
        const loadingEl = this.contentEl.createDiv({ cls: 'task-list-view__loading' });
        loadingEl.createSpan({ text: 'Initializing...' });
        
        // Poll for cache to be ready (with timeout)
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max
        const checkReady = async () => {
            attempts++;
            if (this.plugin.cacheManager && this.plugin.cacheManager.isInitialized()) {
                await this.refresh();
            } else if (attempts < maxAttempts) {
                setTimeout(checkReady, 100);
            } else {
                // Timeout - try to refresh anyway
                console.warn('TaskListView: Cache initialization timeout, attempting to load anyway');
                await this.refresh();
            }
        };
        checkReady();
    }
    
    async onClose() {
        // Remove event listeners
        this.listeners.forEach(listener => this.plugin.emitter.offref(listener));
        this.functionListeners.forEach(unsubscribe => unsubscribe());
        
        // Clean up FilterBar
        if (this.filterBar) {
            this.filterBar.destroy();
            this.filterBar = null;
        }

        // Clean up FilterHeading
        if (this.filterHeading) {
            this.filterHeading.destroy();
            this.filterHeading = null;
        }
        
        this.contentEl.empty();
    }
    
    async refresh(forceFullRefresh = false) {
        return perfMonitor.measure('task-list-refresh', async () => {
            // If forcing a full refresh, clear the task elements tracking
            if (forceFullRefresh) {
                this.taskElements.clear();
            }
            
            // Clear and prepare the content element for full refresh
            this.contentEl.empty();
            this.taskElements.clear();
            await this.render();
        });
    }
    
    
    async render() {
        const container = this.contentEl.createDiv({ cls: 'tasknotes-plugin tasknotes-container task-list-view-container' });
        
        // Create header with current date information
        this.createHeader(container);
        
        // Create task list content
        await this.createTasksContent(container);
    }
    
    createHeader(container: HTMLElement) {
        container.createDiv({ cls: 'detail-view-header task-list-header' });
        
        // // Display view title
        // headerContainer.createEl('h2', {
        //     text: 'All tasks',
        //     cls: 'task-list-view__title'
        // });
        
        // Actions container removed - no buttons needed
    }
    
    async createTasksContent(container: HTMLElement) {
        // Create FilterBar container
        const filterBarContainer = container.createDiv({ cls: 'filter-bar-container' });
        
        // Wait for cache to be initialized with actual data
        await this.waitForCacheReady();
        
        // Initialize with default query from FilterService
        this.currentQuery = this.plugin.filterService.createDefaultQuery();
        
        // Load saved filter state if it exists
        const savedQuery = this.plugin.viewStateManager.getFilterState(TASK_LIST_VIEW_TYPE);
        if (savedQuery) {
            this.currentQuery = savedQuery;
        }
        
        // Get filter options from FilterService
        const filterOptions = await this.plugin.filterService.getFilterOptions();
        
        // Create new FilterBar with simplified constructor
        this.filterBar = new FilterBar(
            this.app,
            this.plugin,
            filterBarContainer,
            this.currentQuery,
            filterOptions,
            this.plugin.settings.viewsButtonAlignment || 'right'
        );

        // Wire expand/collapse all (as in preview-all)
        this.filterBar.on('expandAllGroups', () => {
            const key = this.currentQuery.groupKey || 'none';
            GroupingUtils.expandAllGroups(TASK_LIST_VIEW_TYPE, key, this.plugin);
            // Update DOM
            this.contentEl.querySelectorAll('.task-group').forEach(section => {
                section.classList.remove('is-collapsed');
                const list = (section as HTMLElement).querySelector('.task-cards') as HTMLElement | null;
                if (list) list.style.display = '';
            });
        });
        this.filterBar.on('collapseAllGroups', () => {
            const key = this.currentQuery.groupKey || 'none';
            const groupNames: string[] = [];
            this.contentEl.querySelectorAll('.task-group').forEach(section => {
                const name = (section as HTMLElement).dataset.group;
                if (name) {
                    groupNames.push(name);
                    section.classList.add('is-collapsed');
                    const list = (section as HTMLElement).querySelector('.task-cards') as HTMLElement | null;
                    if (list) list.style.display = 'none';
                }
            });
            GroupingUtils.collapseAllGroups(TASK_LIST_VIEW_TYPE, key, groupNames, this.plugin);
        });

        // Get saved views for the FilterBar
        const savedViews = this.plugin.viewStateManager.getSavedViews();
        this.filterBar.updateSavedViews(savedViews);
        
        // Listen for saved view events
        this.filterBar.on('saveView', ({ name, query, viewOptions }) => {
            console.log('TaskListView: Received saveView event:', name, query, viewOptions); // Debug
            const savedView = this.plugin.viewStateManager.saveView(name, query, viewOptions);
            console.log('TaskListView: Saved view result:', savedView); // Debug
            // Don't update here - the ViewStateManager event will handle it
        });
        
        this.filterBar.on('deleteView', (viewId: string) => {
            console.log('TaskListView: Received deleteView event:', viewId); // Debug
            this.plugin.viewStateManager.deleteView(viewId);
            // Don't update here - the ViewStateManager event will handle it
        });

        // Listen for global saved views changes
        this.plugin.viewStateManager.on('saved-views-changed', (updatedViews: readonly SavedView[]) => {
            console.log('TaskListView: Received saved-views-changed event:', updatedViews); // Debug
            this.filterBar?.updateSavedViews(updatedViews);
        });
        
        this.filterBar.on('reorderViews', (fromIndex: number, toIndex: number) => {
            this.plugin.viewStateManager.reorderSavedViews(fromIndex, toIndex);
        });
        
        // Listen for filter changes
        this.filterBar.on('queryChange', async (newQuery: FilterQuery) => {
            this.currentQuery = newQuery;
            // Save the filter state
            this.plugin.viewStateManager.setFilterState(TASK_LIST_VIEW_TYPE, newQuery);
            await this.refreshTasks();
        });

        // Listen for properties changes
        this.filterBar.on('propertiesChanged', (properties: string[]) => {
            // Refresh the task display with new properties
            this.refreshTaskDisplay();
        });

        // Create filter heading
        this.filterHeading = new FilterHeading(container);

        // Task list container
        const taskList = container.createDiv({ cls: 'task-list' });
        
        // Add loading indicator
        this.loadingIndicator = taskList.createDiv({ cls: 'loading-indicator' });
        this.loadingIndicator.createDiv({ cls: 'loading-spinner' });
        this.loadingIndicator.createDiv({ cls: 'loading-text', text: 'Loading tasks...' });
        this.loadingIndicator.addClass('is-hidden');
        
        // Store reference to the task list container for future updates
        this.taskListContainer = taskList;
        
        // Show loading state if we're fetching data
        this.isTasksLoading = true;
        this.updateLoadingState();
        
        // Initial load with current query
        await this.refreshTasks();
        
        // Hide loading state when done
        this.isTasksLoading = false;
        this.updateLoadingState();
    }

    /**
     * Update the filter heading with current saved view and completion count
     */
    private async updateFilterHeading(): Promise<void> {
        if (!this.filterHeading || !this.filterBar) return;

        try {
            // Get all filtered tasks to calculate completion stats
            const groupedTasks = await this.plugin.filterService.getGroupedTasks(this.currentQuery);
            const allTasks = Array.from(groupedTasks.values()).flat();

            // Calculate completion stats
            const stats = GroupCountUtils.calculateGroupStats(allTasks, this.plugin);

            // Get current saved view from FilterBar
            const activeSavedView = (this.filterBar as any).activeSavedView || null;

            // Update the filter heading
            this.filterHeading.update(activeSavedView, stats.completed, stats.total);
        } catch (error) {
            console.error('Error updating filter heading in TaskListView:', error);
        }
    }

    /**
     * Refresh tasks using FilterService
     */
    private async refreshTasks(): Promise<void> {
        console.log('TaskListView: Starting refreshTasks()');
        
        if (!this.taskListContainer) {
            console.log('TaskListView: No taskListContainer, returning');
            return;
        }
        
        console.log('TaskListView: Current query:', this.currentQuery);
        console.log('TaskListView: Visible properties:', this.getCurrentVisibleProperties());
        
        try {
            this.isTasksLoading = true;
            this.updateLoadingState();
            
            console.log('TaskListView: Calling filterService.getGroupedTasks()');
            // Get grouped tasks from FilterService
            const groupedTasks = await this.plugin.filterService.getGroupedTasks(this.currentQuery);
            console.log('TaskListView: Got grouped tasks:', groupedTasks.size, 'groups');
            
            // Render the grouped tasks
            this.renderTaskItems(this.taskListContainer, groupedTasks);
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('TaskListView: Error refreshing tasks:', {
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
                query: this.currentQuery,
                cacheInitialized: this.plugin.cacheManager?.isInitialized() || false,
                visibleProperties: this.getCurrentVisibleProperties(),
                filterServiceQuery: JSON.stringify(this.currentQuery, null, 2)
            });
            
            // Additional debugging info
            console.error('TaskListView: Detailed error context:', {
                pluginInitialized: !!this.plugin,
                filterServiceInitialized: !!this.plugin?.filterService,
                containerExists: !!this.taskListContainer
            });
            
            // Clear existing content and show error message
            this.taskListContainer.empty();
            const errorContainer = this.taskListContainer.createDiv({ cls: 'error-container' });
            errorContainer.createEl('p', { 
                text: 'Error loading tasks. Please try refreshing.', 
                cls: 'error-message' 
            });
            
            // Add retry button for better UX
            const retryButton = errorContainer.createEl('button', {
                text: 'Retry',
                cls: 'mod-cta'
            });
            retryButton.addEventListener('click', () => {
                this.refreshTasks();
            });
        } finally {
            this.isTasksLoading = false;
            this.updateLoadingState();
            // Update filter heading with current data
            await this.updateFilterHeading();
        }
    }

    // Helper method to render task items with grouping support using DOMReconciler or Virtual Scrolling
    renderTaskItems(container: HTMLElement, groupedTasks: Map<string, TaskInfo[]>) {
        console.log('TaskListView: Starting renderTaskItems(), groups:', Array.from(groupedTasks.keys()));
        
        // Check if there are any tasks across all groups
        const totalTasks = Array.from(groupedTasks.values()).reduce((total, tasks) => total + tasks.length, 0);
        console.log('TaskListView: Total tasks to render:', totalTasks);
        
        if (totalTasks === 0) {
            // Clear everything and show placeholder
            container.empty();
            this.taskElements.clear();
            container.createEl('p', { text: 'No tasks found for the selected filters.' });
            return;
        }
        
        // Handle grouped vs non-grouped rendering differently
        if (this.currentQuery.groupKey === 'none' && groupedTasks.has('all')) {
            // Non-grouped: use DOMReconciler for the flat task list
            const allTasks = groupedTasks.get('all') || [];
            console.log('TaskListView: Using non-grouped rendering with', allTasks.length, 'tasks');
            this.renderTaskListWithReconciler(container, allTasks);
        } else {
            // Grouped: render groups normally (groups change less frequently than individual tasks)
            console.log('TaskListView: Using grouped rendering');
            this.renderGroupedTasksWithReconciler(container, groupedTasks);
        }
    }

    /**
     * Render a flat task list using DOMReconciler for optimal performance
     */
    private renderTaskListWithReconciler(container: HTMLElement, tasks: TaskInfo[]) {
        console.log('TaskListView: Starting renderTaskListWithReconciler with', tasks.length, 'tasks');
        console.log('TaskListView: Container has', container.children.length, 'existing children');
        console.log('TaskListView: Existing keys:', Array.from(container.children).map(child => (child as HTMLElement).dataset.key));
        
        // Clear any elements without proper keys to avoid DOMReconciler confusion
        Array.from(container.children).forEach(child => {
            const element = child as HTMLElement;
            if (!element.dataset.key) {
                console.log('TaskListView: Removing element without key:', element);
                element.remove();
            }
        });
        
        console.log('TaskListView: After cleanup - Container has', container.children.length, 'children');
        
        try {
            console.log('TaskListView: About to call DOMReconciler.updateList');
            console.log('TaskListView: DOMReconciler exists:', !!this.plugin.domReconciler);
            console.log('TaskListView: updateList method exists:', typeof this.plugin.domReconciler.updateList);
            
            const result = this.plugin.domReconciler.updateList<TaskInfo>(
                container,
                tasks,
                (task) => {
                    console.log('TaskListView: DOMReconciler requesting key for:', task.path);
                    return task.path;
                }, // Unique key
                (task) => {
                    console.log('TaskListView: DOMReconciler requesting creation of:', task.path);
                    return this.createTaskCardForReconciler(task);
                }, // Render new item
                (element, task) => {
                    console.log('TaskListView: DOMReconciler requesting update of:', task.path);
                    return this.updateTaskCardForReconciler(element, task);
                } // Update existing item
            );
            
            console.log('TaskListView: DOMReconciler.updateList returned:', result);
            console.log('TaskListView: DOMReconciler.updateList completed successfully');
            console.log('TaskListView: Final DOM children count:', container.children.length);
        } catch (error) {
            console.error('TaskListView: Error in renderTaskListWithReconciler:', error);
            console.error('TaskListView: DOM children count at error:', container.children.length);
            throw error;
        }
        
        // Update task elements tracking
        this.taskElements.clear();
        Array.from(container.children).forEach(child => {
            const taskPath = (child as HTMLElement).dataset.key;
            if (taskPath) {
                this.taskElements.set(taskPath, child as HTMLElement);
            }
        });
    }
    
    // Virtual scrolling methods removed for compliance verification

    /**
     * Render grouped tasks with reconciler optimization for individual groups
     */
    private renderGroupedTasksWithReconciler(container: HTMLElement, groupedTasks: Map<string, TaskInfo[]>) {
        // Save scroll position
        const scrollTop = container.scrollTop;
        
        // Clear container but preserve structure for groups that haven't changed
        const existingGroups = new Map<string, HTMLElement>();
        Array.from(container.children).forEach(child => {
            const groupKey = (child as HTMLElement).dataset.group;
            if (groupKey) {
                existingGroups.set(groupKey, child as HTMLElement);
            }
        });
        
        // Clear container
        container.empty();
        this.taskElements.clear();
        
        // Render each group
        groupedTasks.forEach((tasks, groupName) => {
            if (tasks.length === 0) return;
            
            // Create group section
            const groupSection = container.createDiv({ cls: 'task-section task-group' });
            groupSection.setAttribute('data-group', groupName);
            
            const groupingKey = this.currentQuery.groupKey || 'none';
            const isAllGroup = groupingKey === 'none' && groupName === 'all';
            const collapsedInitially = this.isGroupCollapsed(groupingKey, groupName);

            // Add group header (skip only if grouping is 'none' and group name is 'all')
            if (!isAllGroup) {
                const headerElement = groupSection.createEl('h3', {
                    cls: 'task-group-header task-list-view__group-header'
                });

                // Create toggle button first (exactly as in preview-all)
                const toggleBtn = headerElement.createEl('button', { cls: 'task-group-toggle', attr: { 'aria-label': 'Toggle group' } });
                try { setIcon(toggleBtn, 'chevron-right'); } catch (_) { /* Ignore setIcon errors */ }
                const svg = toggleBtn.querySelector('svg');
                if (svg) { svg.classList.add('chevron'); svg.setAttr('width', '16'); svg.setAttr('height', '16'); }
                else { toggleBtn.textContent = '▸'; toggleBtn.addClass('chevron-text'); }

                // Calculate completion stats for this group
                const groupStats = GroupCountUtils.calculateGroupStats(tasks, this.plugin);

                // Label: project path -> clickable, else plain text span
                if (groupingKey === 'project' && this.isClickableProject(groupName)) {
                    this.createClickableProjectHeader(headerElement, groupName, groupStats);
                } else {
                    headerElement.createSpan({ text: this.formatGroupName(groupName) });

                    // Add count with agenda-view__item-count styling
                    headerElement.createSpan({
                        text: ` ${GroupCountUtils.formatGroupCount(groupStats.completed, groupStats.total).text}`,
                        cls: 'agenda-view__item-count'
                    });
                }

                // Click handlers (match preview-all semantics; ignore link clicks inside header)
                this.registerDomEvent(headerElement, 'click', (e: MouseEvent) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('a')) return;
                    const willCollapse = !groupSection.hasClass('is-collapsed');
                    this.setGroupCollapsed(groupingKey, groupName, willCollapse);
                    groupSection.toggleClass('is-collapsed', willCollapse);
                    const list = groupSection.querySelector('.task-cards') as HTMLElement | null;
                    if (list) list.style.display = willCollapse ? 'none' : '';
                    toggleBtn.setAttr('aria-expanded', String(!willCollapse));
                });
                this.registerDomEvent(toggleBtn, 'click', (e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const willCollapse = !groupSection.hasClass('is-collapsed');
                    this.setGroupCollapsed(groupingKey, groupName, willCollapse);
                    groupSection.toggleClass('is-collapsed', willCollapse);
                    const list = groupSection.querySelector('.task-cards') as HTMLElement | null;
                    if (list) list.style.display = willCollapse ? 'none' : '';
                    toggleBtn.setAttr('aria-expanded', String(!willCollapse));
                });

                // Initial ARIA state set after list container is created below
                toggleBtn.setAttr('aria-expanded', String(!collapsedInitially));
            }

            // Create task cards container
            const taskCardsContainer = groupSection.createDiv({ cls: 'tasks-container task-cards' });

            // Apply initial collapsed state
            if (collapsedInitially && !isAllGroup) {
                groupSection.addClass('is-collapsed');
                taskCardsContainer.style.display = 'none';
            }

            // Use reconciler for this group's task list
            this.plugin.domReconciler.updateList<TaskInfo>(
                taskCardsContainer,
                tasks,
                (task) => task.path, // Unique key
                (task) => this.createTaskCardForReconciler(task), // Render new item
                (element, task) => this.updateTaskCardForReconciler(element, task) // Update existing item
            );
            
            // Update task elements tracking for this group
            Array.from(taskCardsContainer.children).forEach(child => {
                const taskPath = (child as HTMLElement).dataset.key;
                if (taskPath) {
                    this.taskElements.set(taskPath, child as HTMLElement);
                }
            });
        });

        // Restore scroll position
        container.scrollTop = scrollTop;
    }

    // Persist and restore collapsed state per grouping key and group name
    private isGroupCollapsed(groupingKey: string, groupName: string): boolean {
        return GroupingUtils.isGroupCollapsed(TASK_LIST_VIEW_TYPE, groupingKey, groupName, this.plugin);
    }

    private setGroupCollapsed(groupingKey: string, groupName: string, collapsed: boolean): void {
        GroupingUtils.setGroupCollapsed(TASK_LIST_VIEW_TYPE, groupingKey, groupName, collapsed, this.plugin);
    }

    /**
     * Get current visible properties for task cards
     */
    private getCurrentVisibleProperties(): string[] | undefined {
        // Use the FilterBar's method which handles temporary state
        return this.filterBar?.getCurrentVisibleProperties();
    }

    /**
     * Refresh task display with current properties (without refetching data)
     */
    private refreshTaskDisplay(): void {
        if (!this.taskListContainer) return;
        
        // Get all existing task cards
        const taskCards = this.taskListContainer.querySelectorAll('.task-card');
        const visibleProperties = this.getCurrentVisibleProperties();
        
        taskCards.forEach(card => {
            const taskPath = (card as HTMLElement).dataset.taskPath;
            if (!taskPath) return;
            
            // Get task data from cache
            this.plugin.cacheManager.getTaskInfo(taskPath).then(task => {
                if (task) {
                    updateTaskCard(card as HTMLElement, task, this.plugin, visibleProperties);
                }
            });
        });
    }

    /**
     * Create a task card for use with DOMReconciler
     */
    private createTaskCardForReconciler(task: TaskInfo): HTMLElement {
        console.log('TaskListView: Creating task card for:', task.path);
        try {
            const visibleProperties = this.getCurrentVisibleProperties();
            console.log('TaskListView: Using visible properties:', visibleProperties);
            const taskCard = createTaskCard(task, this.plugin, visibleProperties, {
                showDueDate: true,
                showCheckbox: false, // TaskListView doesn't use checkboxes 
                showArchiveButton: true,
                showTimeTracking: true,
                showRecurringControls: true,
                groupByDate: false
            });
            console.log('TaskListView: Task card created successfully for:', task.path);
            
            // Ensure the key is set for reconciler
            taskCard.dataset.key = task.path;
            
            // Add drag functionality
            this.addDragHandlers(taskCard, task);
            
            return taskCard;
        } catch (error) {
            console.error('TaskListView: Error creating task card for', task.path, ':', error);
            throw error;
        }
    }

    /**
     * Update an existing task card for use with DOMReconciler
     */
    private updateTaskCardForReconciler(element: HTMLElement, task: TaskInfo): void {
        const visibleProperties = this.getCurrentVisibleProperties();
        updateTaskCard(element, task, this.plugin, visibleProperties, {
            showDueDate: true,
            showCheckbox: false, // TaskListView doesn't use checkboxes
            showArchiveButton: true,
            showTimeTracking: true,
            showRecurringControls: true,
            groupByDate: false
        });
    }

    /**
     * Add drag handlers to task cards for dragging to calendar
     */
    private addDragHandlers(card: HTMLElement, task: TaskInfo): void {
        // Use the centralized drag drop manager for FullCalendar compatibility
        this.plugin.dragDropManager.makeTaskCardDraggable(card, task.path);
    }
    
    
    /**
     * Create SVG icon element safely without innerHTML
     */
    private createSVGIcon(viewBox: string, width: number, height: number, pathData: string): SVGElement {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', viewBox);
        svg.setAttribute('width', width.toString());
        svg.setAttribute('height', height.toString());
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('fill', 'currentColor');
        path.setAttribute('d', pathData);
        
        svg.appendChild(path);
        return svg;
    }

    /**
     * Format group name for display
     */
    private formatGroupName(groupName: string): string {
        return GroupingUtils.formatGroupName(groupName, this.plugin);
    }
    
    
    /**
     * Helper method to update the loading indicator visibility
     */
    private updateLoadingState(): void {
        if (!this.loadingIndicator) return;
        
        if (this.isTasksLoading) {
            this.loadingIndicator.removeClass('is-hidden');
        } else {
            this.loadingIndicator.addClass('is-hidden');
        }
    }
    
            
    
    
    
    
    
    
    
    
    openTask(path: string) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
            this.app.workspace.getLeaf(false).openFile(file);
        }
    }
    
    /**
     * Wait for cache to be ready with actual data
     */
    private async waitForCacheReady(): Promise<void> {
        // First check if cache is already initialized
        if (this.plugin.cacheManager.isInitialized()) {
            return;
        }
        
        // If not initialized, wait for the cache-initialized event
        return new Promise((resolve) => {
            const unsubscribe = this.plugin.cacheManager.subscribe('cache-initialized', () => {
                unsubscribe();
                resolve();
            });
        });
    }

    /**
     * Check if a project string is a file path that should be made clickable
     */
    private isClickableProject(project: string): boolean {
        if (!project || typeof project !== 'string') {
            return false;
        }
        
        // Wikilink format
        if (project.startsWith('[[') && project.endsWith(']]')) {
            return true;
        }
        
        // File path (contains slash) or could be a resolved file
        if (project.includes('/')) {
            return true;
        }
        
        // Check if it's a resolved file path by trying to find the file
        if (this.plugin?.app) {
            const file = this.plugin.app.vault.getAbstractFileByPath(project + '.md');
            if (file instanceof TFile) {
                return true;
            }
            
            const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(project, '');
            return !!resolvedFile;
        }
        
        return false;
    }

    /**
     * Create a clickable project header for project file paths
     */
    private createClickableProjectHeader(headerElement: HTMLElement, projectName: string, groupStats?: { completed: number; total: number }): void {
        if (!projectName || typeof projectName !== 'string') {
            return;
        }
        
        let filePath = projectName;
        let displayName = projectName;
        
        // Handle wikilink format
        if (projectName.startsWith('[[') && projectName.endsWith(']]')) {
            const linkContent = projectName.slice(2, -2);
            filePath = linkContent;
            displayName = linkContent;
        }
        
        // Create a clickable link
        const linkEl = headerElement.createEl('a', {
            cls: 'internal-link task-list-view__project-link',
            text: displayName
        });
        
        // Add click handler to open the file
        this.registerDomEvent(linkEl, 'click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            try {
                // First try to get file by direct path
                const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
                if (file instanceof TFile) {
                    await this.plugin.app.workspace.getLeaf(false).openFile(file);
                    return;
                }
                
                // If not found, try to resolve using metadata cache
                const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(filePath, '');
                if (resolvedFile) {
                    await this.plugin.app.workspace.getLeaf(false).openFile(resolvedFile);
                } else {
                    new Notice(`Project file not found: ${displayName}`);
                }
            } catch (error) {
                console.error('Error opening project file:', error);
                new Notice(`Error opening project: ${displayName}`);
            }
        });
        
        // Add hover preview functionality
        this.addHoverPreview(linkEl, filePath);

        // Add count with agenda-view__item-count styling if stats provided
        if (groupStats) {
            headerElement.createSpan({
                text: ` ${GroupCountUtils.formatGroupCount(groupStats.completed, groupStats.total).text}`,
                cls: 'agenda-view__item-count'
            });
        }
    }

    /**
     * Add hover preview functionality to an element
     */
    private addHoverPreview(element: HTMLElement, filePath: string) {
        element.addEventListener('mouseover', (event) => {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file) {
                this.app.workspace.trigger('hover-link', {
                    event,
                    source: 'tasknotes-tasklistview',
                    hoverParent: this,
                    targetEl: element,
                    linktext: filePath,
                    sourcePath: filePath
                });
            }
        });
    }
}
