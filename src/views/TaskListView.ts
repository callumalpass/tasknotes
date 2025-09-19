import { TFile, ItemView, WorkspaceLeaf, EventRef, Notice, setIcon, ButtonComponent } from 'obsidian';
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
import { initializeViewPerformance, cleanupViewPerformance, OptimizedView, selectiveUpdateForListView } from '../utils/viewOptimizations';
import { FilterBar } from '../ui/FilterBar';
import { GroupingUtils } from '../utils/GroupingUtils';
import { FilterHeading } from '../ui/FilterHeading';
import { GroupCountUtils } from '../utils/GroupCountUtils';

export class TaskListView extends ItemView implements OptimizedView {
    plugin: TaskNotesPlugin;

    // Performance optimization properties
    viewPerformanceService?: import('../services/ViewPerformanceService').ViewPerformanceService;
    performanceConfig?: import('../services/ViewPerformanceService').ViewPerformanceConfig;

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
    taskElements: Map<string, HTMLElement> = new Map();

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
        return this.plugin.i18n.translate('views.taskList.title');
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

        // Performance optimization: Use ViewPerformanceService instead of direct task listeners
        // The service will handle debouncing and selective updates

        // Listen for filter service data changes
        const filterDataListener = this.plugin.filterService.on('data-changed', () => {
            this.refreshTasks();
        });
        this.functionListeners.push(filterDataListener);
    }

    async onOpen() {
        try {
            // Wait for the plugin to be fully initialized before proceeding
            await this.plugin.onReady();

            // Wait for migration to complete before initializing UI
            await this.plugin.waitForMigration();

            // Initialize with default query from FilterService
            this.currentQuery = this.plugin.filterService.createDefaultQuery();

            // Load saved filter state if it exists (will be empty after migration)
            const savedQuery = this.plugin.viewStateManager.getFilterState(TASK_LIST_VIEW_TYPE);
            if (savedQuery) {
                this.currentQuery = savedQuery;
            }

            await this.refresh();

            // Initialize performance optimizations
            initializeViewPerformance(this, {
                viewId: TASK_LIST_VIEW_TYPE,
                debounceDelay: 100,
                maxBatchSize: 8,
                changeDetectionEnabled: true
            });
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
                await this.refresh();
            }
        };
        checkReady();
    }

    async onClose() {
        // Clean up performance optimizations
        cleanupViewPerformance(this);

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

    // OptimizedView interface implementation
    async updateForTask(taskPath: string, operation: 'update' | 'delete' | 'create'): Promise<void> {
        // Use the generic list view selective update implementation
        await selectiveUpdateForListView(this, taskPath, operation);
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
            this.plugin.settings.viewsButtonAlignment || 'right',
            { enableGroupExpandCollapse: false, forceShowExpandCollapse: false, viewType: 'task-list' }
        );


        // Get saved views for the FilterBar
        const savedViews = this.plugin.viewStateManager.getSavedViews();
        this.filterBar.updateSavedViews(savedViews);

        // Listen for saved view events
        this.filterBar.on('saveView', ({ name, query, viewOptions, visibleProperties }) => {
            const savedView = this.plugin.viewStateManager.saveView(name, query, viewOptions, visibleProperties);
            // Set the newly saved view as active to prevent incorrect view matching
            this.filterBar!.setActiveSavedView(savedView);
        });

        this.filterBar.on('deleteView', (viewId: string) => {
            this.plugin.viewStateManager.deleteView(viewId);
            // Don't update here - the ViewStateManager event will handle it
        });

        // Listen for global saved views changes
        this.plugin.viewStateManager.on('saved-views-changed', (updatedViews: readonly SavedView[]) => {
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
            // Update expand/collapse buttons visibility
            const controlsContainer = this.contentEl.querySelector('.filter-heading__controls') as HTMLElement;
            if (controlsContainer) {
                this.createExpandCollapseButtons(controlsContainer);
            }
            await this.refreshTasks();
        });

        // Listen for properties changes
        this.filterBar.on('propertiesChanged', (properties: string[]) => {
            // Refresh the task display with new properties
            this.refreshTaskDisplay();
        });

        // Create filter heading with integrated controls
        this.filterHeading = new FilterHeading(container);

        // Add expand/collapse controls to the heading container
        const headingContainer = container.querySelector('.filter-heading') as HTMLElement;
        if (headingContainer) {
            const headingContent = headingContainer.querySelector('.filter-heading__content') as HTMLElement;
            if (headingContent) {
                // Add controls to the right side of the heading
                const controlsContainer = headingContent.createDiv({ cls: 'filter-heading__controls' });
                this.createExpandCollapseButtons(controlsContainer);
            }
        }

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

        // Update expand/collapse buttons after initial load
        const controlsContainer = this.contentEl.querySelector('.filter-heading__controls') as HTMLElement;
        if (controlsContainer) {
            this.createExpandCollapseButtons(controlsContainer);
        }
    }

    /**
     * Create expand/collapse buttons for grouped views
     */
    private createExpandCollapseButtons(container: HTMLElement): void {
        const isGrouped = (this.currentQuery.groupKey || 'none') !== 'none';

        if (!isGrouped) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';
        container.empty();

        // Expand all button
        const expandAllBtn = new ButtonComponent(container)
            .setIcon('list-tree')
            .setTooltip(this.plugin.i18n.translate('views.taskList.expandAllGroups'))
            .setClass('task-view-control-button')
            .onClick(() => {
                const key = this.currentQuery.groupKey || 'none';
                this.contentEl.querySelectorAll('.task-group').forEach(section => {
                    section.classList.remove('is-collapsed');
                    const list = (section as HTMLElement).querySelector('.task-cards') as HTMLElement | null;
                    if (list) list.style.display = '';
                });
                GroupingUtils.expandAllGroups(TASK_LIST_VIEW_TYPE, key, this.plugin);
            });
        expandAllBtn.buttonEl.addClass('clickable-icon');

        // Collapse all button
        const collapseAllBtn = new ButtonComponent(container)
            .setIcon('list-collapse')
            .setTooltip(this.plugin.i18n.translate('views.taskList.collapseAllGroups'))
            .setClass('task-view-control-button')
            .onClick(() => {
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
        collapseAllBtn.buttonEl.addClass('clickable-icon');
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
        if (!this.taskListContainer) {
            return;
        }

        try {
            this.isTasksLoading = true;
            this.updateLoadingState();

            // Prefer hierarchical grouping when subgroup is active; fall back to flat groups
            const { groups, hierarchicalGroups } = await this.plugin.filterService.getHierarchicalGroupedTasks(this.currentQuery);

            const hasPrimary = (this.currentQuery.groupKey || 'none') !== 'none';
            const subKey = (this.currentQuery as any).subgroupKey as string | undefined;
            const hasSubgroup = !!subKey && subKey !== 'none';

            if (hasPrimary && hasSubgroup && hierarchicalGroups) {
                this.renderHierarchicalTasks(this.taskListContainer, hierarchicalGroups);
            } else {
                // Render the (possibly flat) grouped tasks
                this.renderTaskItems(this.taskListContainer, groups);
            }

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
        // Check if there are any tasks across all groups
        const totalTasks = Array.from(groupedTasks.values()).reduce((total, tasks) => total + tasks.length, 0);

        if (totalTasks === 0) {
            // Clear everything and show placeholder
            container.empty();
            this.taskElements.clear();
            container.createEl('p', { text: this.plugin.i18n.translate('views.taskList.noTasksFound') });
            return;
        }

        // Handle grouped vs non-grouped rendering differently
        if (this.currentQuery.groupKey === 'none' && groupedTasks.has('all')) {
            // Non-grouped: use DOMReconciler for the flat task list
            const allTasks = groupedTasks.get('all') || [];
            this.renderTaskListWithReconciler(container, allTasks);
        } else {
            // Grouped: render groups normally (groups change less frequently than individual tasks)
            this.renderGroupedTasksWithReconciler(container, groupedTasks);
        }
    }

    /**
     * Render a flat task list using DOMReconciler for optimal performance
     */
    private renderTaskListWithReconciler(container: HTMLElement, tasks: TaskInfo[]) {

        // Clear any elements without proper keys to avoid DOMReconciler confusion
        Array.from(container.children).forEach(child => {
            const element = child as HTMLElement;
            if (!element.dataset.key) {
                element.remove();
            }
        });


        try {

            this.plugin.domReconciler.updateList<TaskInfo>(
                container,
                tasks,
                (task) => {
                    return task.path;
                }, // Unique key
                (task) => {
                    return this.createTaskCardForReconciler(task);
                }, // Render new item
                (element, task) => {
                    return this.updateTaskCardForReconciler(element, task);
                } // Update existing item
            );

        } catch (error) {
            console.error('TaskListView: Error in renderTaskListWithReconciler:', error);
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

    /**
     * Render hierarchical tasks: Map<Primary, Map<Subgroup, TaskInfo[]>>
     */
    private renderHierarchicalTasks(container: HTMLElement, hierarchical: Map<string, Map<string, TaskInfo[]>>) {
        // Save scroll position
        const scrollTop = container.scrollTop;

        // Compute total tasks to handle empty state
        const totalTasks = Array.from(hierarchical.values())
            .reduce((sum, subMap) => sum + Array.from(subMap.values()).reduce((s, arr) => s + arr.length, 0), 0);
        if (totalTasks === 0) {
            container.empty();
            this.taskElements.clear();
            container.createEl('p', { text: 'No tasks found for the selected filters.' });
            return;
        }

        // Clear container and tracking
        container.empty();
        this.taskElements.clear();

        const groupingKey = this.currentQuery.groupKey || 'none';
        const subgroupKey = ((this.currentQuery as any).subgroupKey as string) || 'none';

        // Render each primary group
        hierarchical.forEach((subgroups, primaryName) => {
            // Skip empty primary entirely
            const subtotal = Array.from(subgroups.values()).reduce((acc, arr) => acc + arr.length, 0);
            if (subtotal === 0) return;

            const groupSection = container.createDiv({ cls: 'task-section task-group' });
            groupSection.setAttribute('data-group', primaryName);

            const collapsedInitially = this.isGroupCollapsed(groupingKey, primaryName);

            // Group header
            const headerElement = groupSection.createEl('h3', {
                cls: 'task-group-header task-list-view__group-header'
            });

            // Toggle button
            const toggleBtn = headerElement.createEl('button', { cls: 'task-group-toggle', attr: { 'aria-label': 'Toggle group' } });
            try { setIcon(toggleBtn, 'chevron-right'); } catch (_) { /* ignore */ }
            const svg = toggleBtn.querySelector('svg');
            if (svg) { svg.classList.add('chevron'); svg.setAttr('width', '16'); svg.setAttr('height', '16'); }
            else { toggleBtn.textContent = '▸'; toggleBtn.addClass('chevron-text'); }

            // Label
            headerElement.createSpan({ text: this.formatGroupName(primaryName) });

            // Right side container: subgroup actions then count (EXACT order like feat/subgroups): Expand, Collapse, Count
            const groupStats = GroupCountUtils.calculateGroupStats(
                Array.from(subgroups.values()).flat(),
                this.plugin
            );
            const rightSide = headerElement.createDiv({ cls: 'task-group-right' });
            const subgroupActions = rightSide.createDiv({ cls: 'task-subgroup-actions' });
            const expandAllBtn = subgroupActions.createEl('button', { cls: 'task-subgroup-action clickable-icon', attr: { 'aria-label': 'Expand all subgroups' } });
            try { setIcon(expandAllBtn, 'list-tree'); } catch (_) { expandAllBtn.textContent = '+'; }
            const collapseAllBtn = subgroupActions.createEl('button', { cls: 'task-subgroup-action clickable-icon', attr: { 'aria-label': 'Collapse all subgroups' } });
            try { setIcon(collapseAllBtn, 'list-collapse'); } catch (_) { collapseAllBtn.textContent = '−'; }
            const countEl = rightSide.createSpan({
                text: ` ${GroupCountUtils.formatGroupCount(groupStats.completed, groupStats.total).text}`,
                cls: 'agenda-view__item-count'
            });

            // Toggle behavior (primary)
            this.registerDomEvent(headerElement, 'click', (e: MouseEvent) => {
                const target = e.target as HTMLElement;
                if (target.closest('a')) return;
                if (target.closest('.task-subgroup-action')) return; // ignore clicks on subgroup action buttons
                const willCollapse = !groupSection.hasClass('is-collapsed');
                this.setGroupCollapsed(groupingKey, primaryName, willCollapse);
                groupSection.toggleClass('is-collapsed', willCollapse);
                toggleBtn.setAttr('aria-expanded', String(!willCollapse));
            });
            this.registerDomEvent(toggleBtn, 'click', (e: MouseEvent) => {
                e.preventDefault(); e.stopPropagation();
                const willCollapse = !groupSection.hasClass('is-collapsed');
                this.setGroupCollapsed(groupingKey, primaryName, willCollapse);
                groupSection.toggleClass('is-collapsed', willCollapse);
                toggleBtn.setAttr('aria-expanded', String(!willCollapse));
            });
            toggleBtn.setAttr('aria-expanded', String(!collapsedInitially));

            // Wire subgroup actions
            this.registerDomEvent(expandAllBtn, 'click', (e: MouseEvent) => {
                e.preventDefault(); e.stopPropagation();
                GroupingUtils.expandAllSubgroups(TASK_LIST_VIEW_TYPE, primaryName, subgroupKey, this.plugin);
                // Update DOM
                const sections = groupSection.querySelectorAll('.task-subgroup');
                sections.forEach(sec => {
                    sec.classList.remove('is-collapsed');
                    const list = sec.querySelector('.task-cards') as HTMLElement | null;
                    if (list) list.style.display = '';
                    const subT = sec.querySelector('.task-subgroup-toggle') as HTMLElement | null;
                    if (subT) subT.setAttr('aria-expanded', 'true');
                });
            });
            this.registerDomEvent(collapseAllBtn, 'click', (e: MouseEvent) => {
                e.preventDefault(); e.stopPropagation();
                const names = Array.from(subgroups.keys());
                GroupingUtils.collapseAllSubgroups(TASK_LIST_VIEW_TYPE, primaryName, subgroupKey, names, this.plugin);
                const sections = groupSection.querySelectorAll('.task-subgroup');
                sections.forEach(sec => {
                    sec.classList.add('is-collapsed');
                    const list = sec.querySelector('.task-cards') as HTMLElement | null;
                    if (list) list.style.display = 'none';
                    const subT = sec.querySelector('.task-subgroup-toggle') as HTMLElement | null;
                    if (subT) subT.setAttr('aria-expanded', 'false');
                });
            });

            // Apply initial collapsed state for primary
            if (collapsedInitially) {
                groupSection.addClass('is-collapsed');
            }

            // Subgroups container
            const subgroupsContainer = groupSection.createDiv({ cls: 'task-subgroups-container' });

            // Render each subgroup under this primary
            subgroups.forEach((tasks, subgroupName) => {
                if (!tasks || tasks.length === 0) return;

                const subgroupSection = subgroupsContainer.createDiv({ cls: 'task-subgroup' });
                subgroupSection.setAttribute('data-subgroup', subgroupName);

                const subgroupHeader = subgroupSection.createEl('h4', { cls: 'task-subgroup-header' });
                const subToggle = subgroupHeader.createEl('button', { cls: 'task-subgroup-toggle', attr: { 'aria-label': 'Toggle subgroup' } });
                try { setIcon(subToggle, 'chevron-right'); } catch (_) { /* ignore */ }
                const ssvg = subToggle.querySelector('svg');
                if (ssvg) { ssvg.classList.add('chevron'); ssvg.setAttr('width', '14'); ssvg.setAttr('height', '14'); }
                else { subToggle.textContent = '▸'; subToggle.addClass('chevron-text'); }

                const subStats = GroupCountUtils.calculateGroupStats(tasks, this.plugin);
                subgroupHeader.createSpan({ text: this.formatGroupName(subgroupName) });
                subgroupHeader.createSpan({
                    text: ` ${GroupCountUtils.formatGroupCount(subStats.completed, subStats.total).text}`,
                    cls: 'agenda-view__item-count'
                });

                const collapsedSubInitially = GroupingUtils.isSubgroupCollapsed(
                    TASK_LIST_VIEW_TYPE,
                    subgroupKey,
                    primaryName,
                    subgroupName,
                    this.plugin
                );

                // Cards container for this subgroup
                const taskCardsContainer = subgroupSection.createDiv({ cls: 'tasks-container task-cards' });

                // Apply initial collapsed state
                if (collapsedSubInitially) {
                    subgroupSection.addClass('is-collapsed');
                    taskCardsContainer.style.display = 'none';
                }

                // Toggle behavior for subgroup
                this.registerDomEvent(subgroupHeader, 'click', (e: MouseEvent) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('a')) return;
                    const willCollapse = !subgroupSection.hasClass('is-collapsed');
                    GroupingUtils.setSubgroupCollapsed(
                        TASK_LIST_VIEW_TYPE,
                        subgroupKey,
                        primaryName,
                        subgroupName,
                        willCollapse,
                        this.plugin
                    );
                    subgroupSection.toggleClass('is-collapsed', willCollapse);
                    taskCardsContainer.style.display = willCollapse ? 'none' : '';
                    subToggle.setAttr('aria-expanded', String(!willCollapse));
                });
                this.registerDomEvent(subToggle, 'click', (e: MouseEvent) => {
                    e.preventDefault(); e.stopPropagation();
                    const willCollapse = !subgroupSection.hasClass('is-collapsed');
                    GroupingUtils.setSubgroupCollapsed(
                        TASK_LIST_VIEW_TYPE,
                        subgroupKey,
                        primaryName,
                        subgroupName,
                        willCollapse,
                        this.plugin
                    );
                    subgroupSection.toggleClass('is-collapsed', willCollapse);
                    taskCardsContainer.style.display = willCollapse ? 'none' : '';
                    subToggle.setAttr('aria-expanded', String(!willCollapse));
                });
                subToggle.setAttr('aria-expanded', String(!collapsedSubInitially));

                // Render tasks within this subgroup using reconciler
                this.plugin.domReconciler.updateList<TaskInfo>(
                    taskCardsContainer,
                    tasks,
                    (task) => task.path,
                    (task) => this.createTaskCardForReconciler(task),
                    (element, task) => this.updateTaskCardForReconciler(element, task)
                );

                // Track task elements
                Array.from(taskCardsContainer.children).forEach(child => {
                    const taskPath = (child as HTMLElement).dataset.key;
                    if (taskPath) {
                        this.taskElements.set(taskPath, child as HTMLElement);
                    }
                });
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
        try {
            const visibleProperties = this.getCurrentVisibleProperties();
            const taskCard = createTaskCard(task, this.plugin, visibleProperties, {
                showDueDate: true,
                showCheckbox: false, // TaskListView doesn't use checkboxes
                showArchiveButton: true,
                showTimeTracking: true,
                showRecurringControls: true,
                groupByDate: false
            });

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
