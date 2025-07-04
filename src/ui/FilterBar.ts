import { FilterQuery, FilterBarConfig, TaskSortKey, TaskGroupKey, SortDirection } from '../types';
import { EventEmitter } from '../utils/EventEmitter';
import { setIcon, DropdownComponent } from 'obsidian';

/**
 * Reusable filtering UI component that provides consistent filtering controls
 * across all task views. Emits FilterQuery updates when user interacts with controls.
 */
export class FilterBar extends EventEmitter {
    private container: HTMLElement;
    private config: FilterBarConfig;
    private currentQuery: FilterQuery;
    private filterOptions: {
        statuses: string[];
        priorities: string[];
        contexts: string[];
        projects: string[];
    };

    // UI Elements
    private searchInput?: HTMLInputElement;
    private sortDropdown?: DropdownComponent;
    private groupDropdown?: DropdownComponent;
    private advancedFiltersButton?: HTMLButtonElement;
    private advancedFiltersPanel?: HTMLElement;
    private archivedToggle?: HTMLInputElement;
    private activeFiltersIndicator?: HTMLElement;
    private dateRangeStartInput?: HTMLInputElement;
    private dateRangeEndInput?: HTMLInputElement;
    private controlsContainer?: HTMLElement;
    private settingsButton?: HTMLButtonElement;
    private viewOptionsDropdown?: HTMLElement;
    private viewOptionsButton?: HTMLButtonElement;
    private viewOptionsConfig?: { id: string; label: string; value: boolean }[];
    private viewOptionsCallback?: (optionId: string, enabled: boolean) => void;
    
    // Show dropdown elements (new unified dropdown)
    private showDropdown?: HTMLElement;
    private showButton?: HTMLButtonElement;
    private showDropdownConfig?: { id: keyof FilterQuery; label: string; value: boolean }[];
    private showDropdownCallback?: (optionId: keyof FilterQuery, enabled: boolean) => void;

    constructor(
        container: HTMLElement,
        initialQuery: FilterQuery,
        filterOptions: { statuses: string[]; priorities: string[]; contexts: string[]; projects: string[] },
        config: FilterBarConfig = {}
    ) {
        super();
        this.container = container;
        this.currentQuery = { ...initialQuery };
        this.filterOptions = {
            statuses: filterOptions.statuses || [],
            priorities: filterOptions.priorities || [],
            contexts: filterOptions.contexts || [],
            projects: filterOptions.projects || []
        };
        this.config = {
            showSearch: true,
            showGroupBy: true,
            showSortBy: true,
            showAdvancedFilters: true,
            showDateRangePicker: false, // Default to false to avoid breaking existing views
            showViewOptions: false, // Default to false to avoid breaking existing views
            showShowDropdown: false, // Default to false to avoid breaking existing views
            allowedSortKeys: ['due', 'priority', 'title'],
            allowedGroupKeys: ['none', 'status', 'priority', 'context', 'due'],
            ...config
        };

        this.render();
        this.updateUI();
    }

    /**
     * Async initialization method that waits for cache readiness
     * Call this after constructor to ensure filter options are populated
     */
    async initialize(): Promise<void> {
        // This method can be used by views to ensure cache-dependent initialization
        // is complete before showing the FilterBar
        return Promise.resolve();
    }

    /**
     * Set up refresh mechanism to update filter options when cache changes
     * Should be called by views that want FilterBar to auto-refresh
     */
    setupCacheRefresh(cacheManager: any, filterService: any): void {
        // Listen for cache initialization events (for delayed initialization)
        const cacheListener = cacheManager.subscribe('cache-initialized', async () => {
            try {
                const newFilterOptions = await filterService.getFilterOptions();
                this.updateFilterOptions(newFilterOptions);
            } catch (error) {
                console.error('FilterBar: Error refreshing filter options after cache initialization:', error);
            }
        });

        // Listen for filter service data changes
        const filterDataListener = filterService.on('data-changed', async () => {
            try {
                const newFilterOptions = await filterService.getFilterOptions();
                this.updateFilterOptions(newFilterOptions);
            } catch (error) {
                console.error('FilterBar: Error refreshing filter options after data change:', error);
            }
        });

        // Store listeners for cleanup
        if (!this.cacheRefreshListeners) {
            this.cacheRefreshListeners = [];
        }
        this.cacheRefreshListeners.push(cacheListener, filterDataListener);
    }

    private cacheRefreshListeners: (() => void)[] = [];

    /**
     * Update the current query and refresh UI
     */
    updateQuery(query: FilterQuery): void {
        this.currentQuery = { ...query };
        this.updateUI();
    }

    /**
     * Update available filter options
     */
    updateFilterOptions(options: { statuses: string[]; priorities: string[]; contexts: string[]; projects: string[] }): void {
        this.filterOptions = {
            statuses: options.statuses || [],
            priorities: options.priorities || [],
            contexts: options.contexts || [],
            projects: options.projects || []
        };
        this.rebuildAdvancedFilters();
    }

    /**
     * Get the current query
     */
    getCurrentQuery(): FilterQuery {
        return { ...this.currentQuery };
    }

    /**
     * Render the complete FilterBar UI
     */
    private render(): void {
        this.container.empty();
        this.container.addClass('filter-bar');

        // Search input (outside of any cards)
        if (this.config.showSearch) {
            this.renderSearchInput(this.container);
        }

        // Controls container (sort, group, filter) - hidden by default
        this.controlsContainer = this.container.createDiv('filter-bar__controls-container filter-bar__controls-container--hidden');
        const controlsGroup = this.controlsContainer.createDiv('filter-bar__controls');
        
        // Left side controls (sort and group)
        const controlsLeft = controlsGroup.createDiv('filter-bar__controls-left');
        
        if (this.config.showSortBy) {
            this.renderSortControls(controlsLeft);
        }

        if (this.config.showGroupBy) {
            this.renderGroupControls(controlsLeft);
        }
        
        if (this.config.showShowDropdown) {
            this.renderShowDropdownControls(controlsLeft);
        }
        
        if (this.config.showViewOptions) {
            this.renderViewOptionsControls(controlsLeft);
        }

        // Advanced filters button (anchored to right)
        if (this.config.showAdvancedFilters) {
            this.renderAdvancedFiltersButton(controlsGroup);
        }

        // Advanced filters panel (initially hidden)
        if (this.config.showAdvancedFilters) {
            this.renderAdvancedFiltersPanel();
        }
    }

    /**
     * Render search input
     */
    private renderSearchInput(parent: HTMLElement): void {
        // Create flexbox container for search bar and settings button
        const searchRow = parent.createDiv('filter-bar__search-row');
        
        const searchContainer = searchRow.createDiv('filter-bar__search');
        
        // Add search icon to the left
        const searchIcon = searchContainer.createEl('span', {
            cls: 'filter-bar__search-icon'
        });
        setIcon(searchIcon, 'search');
        
        this.searchInput = searchContainer.createEl('input', {
            type: 'text',
            placeholder: 'Search tasks...',
            cls: 'filter-bar__search-input'
        });

        this.searchInput.addEventListener('input', () => {
            this.updateQueryField('searchQuery', this.searchInput!.value || undefined);
        });

        // Right side buttons container
        const rightButtonsContainer = searchRow.createDiv('filter-bar__right-buttons');

        // Render custom buttons first
        if (this.config.customButtons) {
            for (const customButton of this.config.customButtons) {
                customButton.onCreate(rightButtonsContainer);
            }
        }

        // Settings button for controls - positioned to the right of search bar
        this.settingsButton = rightButtonsContainer.createEl('button', {
            cls: 'filter-bar__settings-button',
            attr: { 'aria-label': 'Toggle filter settings' }
        });

        // Add settings icon to button using Obsidian's setIcon
        setIcon(this.settingsButton, 'sliders-horizontal');

        // Active filters indicator on settings button
        this.activeFiltersIndicator = this.settingsButton.createSpan({
            cls: 'filter-bar__active-indicator filter-bar__active-indicator--hidden'
        });

        this.settingsButton.addEventListener('click', () => {
            this.toggleControlsVisibility();
        });
    }

    /**
     * Render sort controls
     */
    private renderSortControls(parent: HTMLElement): void {
        const sortContainer = parent.createDiv('filter-bar__sort');
        
        // Add label first
        sortContainer.createSpan({ text: 'Sort:', cls: 'filter-bar__label' });
        
        // Create dropdown container for proper styling
        const dropdownContainer = sortContainer.createDiv('filter-bar__dropdown-container');
        
        // Sort key dropdown using DropdownComponent
        this.sortDropdown = new DropdownComponent(dropdownContainer);
        
        const sortKeys = this.config.allowedSortKeys || ['due', 'priority', 'title'];
        const sortOptions: Record<string, string> = {};
        sortKeys.forEach(key => {
            sortOptions[key] = this.getSortKeyLabel(key);
        });
        
        this.sortDropdown
            .addOptions(sortOptions)
            .setValue(this.currentQuery.sortKey)
            .onChange((value) => {
                this.updateQueryField('sortKey', value as TaskSortKey);
            });

        // Sort direction button
        const sortDirectionBtn = sortContainer.createEl('button', {
            cls: 'filter-bar__sort-direction',
            attr: { 'aria-label': 'Toggle sort direction' }
        });

        sortDirectionBtn.addEventListener('click', () => {
            const newDirection: SortDirection = this.currentQuery.sortDirection === 'asc' ? 'desc' : 'asc';
            this.updateQueryField('sortDirection', newDirection);
        });
    }

    /**
     * Render group controls
     */
    private renderGroupControls(parent: HTMLElement): void {
        const groupContainer = parent.createDiv('filter-bar__group');
        
        groupContainer.createSpan({ text: 'Group:', cls: 'filter-bar__label' });

        // Create dropdown container for proper styling
        const dropdownContainer = groupContainer.createDiv('filter-bar__dropdown-container');
        
        // Group dropdown using DropdownComponent
        this.groupDropdown = new DropdownComponent(dropdownContainer);
        
        const groupKeys = this.config.allowedGroupKeys || ['none', 'status', 'priority', 'context', 'due'];
        const groupOptions: Record<string, string> = {};
        groupKeys.forEach(key => {
            groupOptions[key] = this.getGroupKeyLabel(key);
        });
        
        this.groupDropdown
            .addOptions(groupOptions)
            .setValue(this.currentQuery.groupKey)
            .onChange((value) => {
                this.updateQueryField('groupKey', value as TaskGroupKey);
            });
    }

    /**
     * Render date range filter in advanced filters panel
     */
    private renderDateRangeFilter(): void {
        const dateRangeContainer = this.advancedFiltersPanel!.createDiv('filter-bar__advanced-item');
        dateRangeContainer.createSpan({ text: 'Date range:', cls: 'filter-bar__label' });

        const dateInputsContainer = dateRangeContainer.createDiv('filter-bar__date-inputs');

        // Start date input
        const startContainer = dateInputsContainer.createDiv('filter-bar__date-input-container');
        startContainer.createSpan({ text: 'From:', cls: 'filter-bar__date-label' });
        this.dateRangeStartInput = startContainer.createEl('input', {
            type: 'date',
            cls: 'filter-bar__date-input'
        });

        // End date input
        const endContainer = dateInputsContainer.createDiv('filter-bar__date-input-container');
        endContainer.createSpan({ text: 'To:', cls: 'filter-bar__date-label' });
        this.dateRangeEndInput = endContainer.createEl('input', {
            type: 'date',
            cls: 'filter-bar__date-input'
        });

        // Clear button
        const clearButton = dateInputsContainer.createEl('button', {
            cls: 'filter-bar__date-clear',
            text: 'Clear',
            attr: { 'aria-label': 'Clear date range' }
        });

        // Event listeners
        this.dateRangeStartInput.addEventListener('change', () => {
            this.updateDateRange();
        });

        this.dateRangeEndInput.addEventListener('change', () => {
            this.updateDateRange();
        });

        clearButton.addEventListener('click', () => {
            this.clearDateRange();
        });
    }

    /**
     * Update date range in query
     */
    private updateDateRange(): void {
        const startDate = this.dateRangeStartInput?.value;
        const endDate = this.dateRangeEndInput?.value;

        if (startDate && endDate) {
            this.updateQueryField('dateRange', {
                start: startDate,
                end: endDate
            });
        } else if (!startDate && !endDate) {
            this.updateQueryField('dateRange', undefined);
        }
        // If only one date is set, don't update the range yet
    }

    /**
     * Clear date range inputs and query
     */
    private clearDateRange(): void {
        if (this.dateRangeStartInput) {
            this.dateRangeStartInput.value = '';
        }
        if (this.dateRangeEndInput) {
            this.dateRangeEndInput.value = '';
        }
        this.updateQueryField('dateRange', undefined);
    }

    /**
     * Render advanced filters button
     */
    private renderAdvancedFiltersButton(parent: HTMLElement): void {
        this.advancedFiltersButton = parent.createEl('button', {
            cls: 'filter-bar__advanced-toggle',
            attr: { 'aria-label': 'Toggle advanced filters' }
        });

        // Add funnel icon to advanced filters button using Obsidian's setIcon
        setIcon(this.advancedFiltersButton, 'filter');

        this.activeFiltersIndicator = this.advancedFiltersButton.createSpan({
            cls: 'filter-bar__active-indicator filter-bar__active-indicator--hidden'
        });

        this.advancedFiltersButton.addEventListener('click', () => {
            this.toggleAdvancedFilters();
        });
    }

    /**
     * Render advanced filters panel
     */
    private renderAdvancedFiltersPanel(): void {
        // Render the advanced panel inside the controls container
        this.advancedFiltersPanel = this.controlsContainer!.createDiv('filter-bar__advanced');
        this.advancedFiltersPanel.addClass('filter-bar__advanced--hidden');

        // Status filter
        this.renderStatusFilter();

        // Priority filter
        this.renderPriorityFilter();

        // Context filter
        this.renderContextFilter();

        // Project filter
        this.renderProjectFilter();

        // Date range filter
        if (this.config.showDateRangePicker) {
            this.renderDateRangeFilter();
        }

        // Archived toggle (after date range) - only if not using show dropdown
        if (!this.config.showShowDropdown) {
            this.renderArchivedToggle();
        }
    }

    /**
     * Render status filter
     */
    private renderStatusFilter(): void {
        const statusContainer = this.advancedFiltersPanel!.createDiv('filter-bar__advanced-item');
        statusContainer.createSpan({ text: 'Status:', cls: 'filter-bar__label' });

        const statusCheckboxContainer = statusContainer.createDiv('filter-bar__checkbox-group');


        // Add specific status options
        this.filterOptions.statuses.forEach(status => {
            const checkboxWrapper = statusCheckboxContainer.createDiv('filter-bar__checkbox-wrapper');
            
            const label = checkboxWrapper.createEl('label', {
                cls: 'filter-bar__checkbox-label'
            });

            const checkbox = label.createEl('input', {
                type: 'checkbox',
                value: status,
                cls: 'filter-bar__checkbox'
            });

            label.createSpan({ text: status });

            checkbox.addEventListener('change', () => {
                this.updateStatusFilter();
            });
        });
    }

    /**
     * Update status filter based on checkbox selections
     */
    private updateStatusFilter(): void {
        const statusContainer = this.advancedFiltersPanel?.querySelector('.filter-bar__advanced-item:nth-child(1)');
        const checkboxes = statusContainer?.querySelectorAll('input[type="checkbox"]:checked') as NodeListOf<HTMLInputElement>;
        const selectedStatuses = Array.from(checkboxes || []).map(cb => cb.value);
        
        // If no statuses selected, show all (undefined). Otherwise, filter by selected statuses.
        this.updateQueryField('statuses', selectedStatuses.length > 0 ? selectedStatuses : undefined);
    }


    /**
     * Render priority filter
     */
    private renderPriorityFilter(): void {
        const priorityContainer = this.advancedFiltersPanel!.createDiv('filter-bar__advanced-item');
        priorityContainer.createSpan({ text: 'Priority:', cls: 'filter-bar__label' });

        const priorityCheckboxContainer = priorityContainer.createDiv('filter-bar__checkbox-group');

        this.filterOptions.priorities.forEach(priority => {
            const checkboxWrapper = priorityCheckboxContainer.createDiv('filter-bar__checkbox-wrapper');
            
            const label = checkboxWrapper.createEl('label', {
                cls: 'filter-bar__checkbox-label'
            });

            const checkbox = label.createEl('input', {
                type: 'checkbox',
                value: priority,
                cls: 'filter-bar__checkbox'
            });

            label.createSpan({ text: priority });

            checkbox.addEventListener('change', () => {
                this.updatePriorityFilter();
            });
        });
    }

    /**
     * Update priority filter based on checkbox selections
     */
    private updatePriorityFilter(): void {
        const priorityContainer = this.advancedFiltersPanel?.querySelector('.filter-bar__advanced-item:nth-child(2)');
        const checkboxes = priorityContainer?.querySelectorAll('input[type="checkbox"]:checked') as NodeListOf<HTMLInputElement>;
        const selectedPriorities = Array.from(checkboxes || []).map(cb => cb.value);
        this.updateQueryField('priorities', selectedPriorities.length > 0 ? selectedPriorities : undefined);
    }

    /**
     * Render context filter
     */
    private renderContextFilter(): void {
        const contextContainer = this.advancedFiltersPanel!.createDiv('filter-bar__advanced-item');
        contextContainer.createSpan({ text: 'Context:', cls: 'filter-bar__label' });

        const contextCheckboxContainer = contextContainer.createDiv('filter-bar__checkbox-group');

        this.filterOptions.contexts.forEach(context => {
            const checkboxWrapper = contextCheckboxContainer.createDiv('filter-bar__checkbox-wrapper');
            
            const label = checkboxWrapper.createEl('label', {
                cls: 'filter-bar__checkbox-label'
            });

            const checkbox = label.createEl('input', {
                type: 'checkbox',
                value: context,
                cls: 'filter-bar__checkbox'
            });

            label.createSpan({ text: context });

            checkbox.addEventListener('change', () => {
                this.updateContextFilter();
            });
        });
    }

    /**
     * Update context filter based on checkbox selections
     */
    private updateContextFilter(): void {
        const contextContainer = this.advancedFiltersPanel?.querySelector('.filter-bar__advanced-item:nth-child(3)');
        const checkboxes = contextContainer?.querySelectorAll('input[type="checkbox"]:checked') as NodeListOf<HTMLInputElement>;
        const selectedContexts = Array.from(checkboxes || []).map(cb => cb.value);
        this.updateQueryField('contexts', selectedContexts.length > 0 ? selectedContexts : undefined);
    }

    /**
     * Render project filter
     */
    private renderProjectFilter(): void {
        const projectContainer = this.advancedFiltersPanel!.createDiv('filter-bar__advanced-item');
        projectContainer.createSpan({ text: 'Project:', cls: 'filter-bar__label' });

        const projectCheckboxContainer = projectContainer.createDiv('filter-bar__checkbox-group');

        // Debug: Log project options
        console.debug('FilterBar: Rendering project filter with options:', this.filterOptions.projects);

        this.filterOptions.projects.forEach(project => {
            const checkboxWrapper = projectCheckboxContainer.createDiv('filter-bar__checkbox-wrapper');
            
            const label = checkboxWrapper.createEl('label', {
                cls: 'filter-bar__checkbox-label'
            });

            const checkbox = label.createEl('input', {
                type: 'checkbox',
                value: project,
                cls: 'filter-bar__checkbox'
            });

            label.createSpan({ text: project });

            checkbox.addEventListener('change', () => {
                this.updateProjectFilter();
            });
        });
    }

    /**
     * Update project filter based on checkbox selections
     */
    private updateProjectFilter(): void {
        const projectContainer = this.advancedFiltersPanel?.querySelector('.filter-bar__advanced-item:nth-child(4)');
        const checkboxes = projectContainer?.querySelectorAll('input[type="checkbox"]:checked') as NodeListOf<HTMLInputElement>;
        const selectedProjects = Array.from(checkboxes || []).map(cb => cb.value);
        this.updateQueryField('projects', selectedProjects.length > 0 ? selectedProjects : undefined);
    }

    /**
     * Render archived toggle
     */
    private renderArchivedToggle(): void {
        const archivedContainer = this.advancedFiltersPanel!.createDiv('filter-bar__advanced-item');
        
        const label = archivedContainer.createEl('label', {
            cls: 'filter-bar__checkbox-label'
        });

        this.archivedToggle = label.createEl('input', {
            type: 'checkbox',
            cls: 'filter-bar__checkbox'
        });

        label.createSpan({ text: 'Show archived' });

        this.archivedToggle.addEventListener('change', () => {
            this.updateQueryField('showArchived', this.archivedToggle!.checked);
        });
    }

    /**
     * Update a specific field in the query and emit change event
     */
    private updateQueryField<K extends keyof FilterQuery>(field: K, value: FilterQuery[K]): void {
        this.currentQuery[field] = value;
        
        // Update specific UI elements based on the field that changed
        if (field === 'sortDirection') {
            this.updateSortDirectionButton();
        }
        
        this.updateActiveFiltersIndicator();
        this.emit('queryChange', { ...this.currentQuery });
    }

    /**
     * Update UI elements to reflect current query
     */
    private updateUI(): void {
        if (this.searchInput) {
            this.searchInput.value = this.currentQuery.searchQuery || '';
        }

        if (this.sortDropdown) {
            this.sortDropdown.setValue(this.currentQuery.sortKey);
        }

        if (this.groupDropdown) {
            this.groupDropdown.setValue(this.currentQuery.groupKey);
        }

        // Update date range inputs
        if (this.dateRangeStartInput && this.dateRangeEndInput) {
            if (this.currentQuery.dateRange) {
                this.dateRangeStartInput.value = this.currentQuery.dateRange.start;
                this.dateRangeEndInput.value = this.currentQuery.dateRange.end;
            } else {
                this.dateRangeStartInput.value = '';
                this.dateRangeEndInput.value = '';
            }
        }

        // Update status checkboxes
        const statusContainer = this.advancedFiltersPanel?.querySelector('.filter-bar__advanced-item:nth-child(1)');
        const statusCheckboxes = statusContainer?.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
        statusCheckboxes?.forEach(checkbox => {
            if (this.currentQuery.statuses) {
                checkbox.checked = this.currentQuery.statuses.includes(checkbox.value);
            } else {
                // If no statuses selected, no checkboxes should be checked (show all)
                checkbox.checked = false;
            }
        });

        // Update priority checkboxes
        const priorityContainer = this.advancedFiltersPanel?.querySelector('.filter-bar__advanced-item:nth-child(2)');
        const priorityCheckboxes = priorityContainer?.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
        priorityCheckboxes?.forEach(checkbox => {
            checkbox.checked = (this.currentQuery.priorities || []).includes(checkbox.value);
        });

        // Update context checkboxes
        const contextContainer = this.advancedFiltersPanel?.querySelector('.filter-bar__advanced-item:nth-child(3)');
        const contextCheckboxes = contextContainer?.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
        contextCheckboxes?.forEach(checkbox => {
            checkbox.checked = (this.currentQuery.contexts || []).includes(checkbox.value);
        });

        // Update project checkboxes
        const projectContainer = this.advancedFiltersPanel?.querySelector('.filter-bar__advanced-item:nth-child(4)');
        const projectCheckboxes = projectContainer?.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
        projectCheckboxes?.forEach(checkbox => {
            checkbox.checked = (this.currentQuery.projects || []).includes(checkbox.value);
        });

        if (this.archivedToggle) {
            this.archivedToggle.checked = this.currentQuery.showArchived;
        }

        // Update show dropdown checkboxes
        this.updateShowDropdownCheckboxes();

        this.updateSortDirectionButton();
        this.updateActiveFiltersIndicator();
    }

    /**
     * Update show dropdown checkboxes to reflect current query
     */
    private updateShowDropdownCheckboxes(): void {
        if (!this.showDropdown || !this.showDropdownConfig) return;

        // Update checkboxes based on current query values
        this.showDropdownConfig.forEach(option => {
            const checkbox = this.showDropdown!.querySelector(`input[data-option-id="${option.id}"]`) as HTMLInputElement;
            if (checkbox) {
                // Get the current value from the query (only for show options which are boolean)
                const currentValue = this.currentQuery[option.id] as boolean | undefined;
                
                // Set checkbox state based on current query value
                if (option.id === 'showRecurrent') {
                    checkbox.checked = currentValue ?? true;
                } else if (option.id === 'showNotes') {
                    checkbox.checked = currentValue ?? true;
                } else {
                    checkbox.checked = currentValue ?? false;
                }
            }
        });

        // Update the button text
        this.updateShowButtonText();
    }

    /**
     * Update sort direction button appearance
     */
    private updateSortDirectionButton(): void {
        const button = this.container.querySelector('.filter-bar__sort-direction') as HTMLElement;
        if (button) {
            button.textContent = this.currentQuery.sortDirection === 'asc' ? '↑' : '↓';
            button.title = `Sort ${this.currentQuery.sortDirection === 'asc' ? 'Ascending' : 'Descending'}`;
        }
    }

    /**
     * Update active filters indicator
     */
    private updateActiveFiltersIndicator(): void {
        if (!this.activeFiltersIndicator) return;

        let activeCount = 0;
        
        if (this.currentQuery.searchQuery) activeCount++;
        if (this.currentQuery.statuses && this.currentQuery.statuses.length > 0) activeCount++;
        if (this.currentQuery.priorities && this.currentQuery.priorities.length > 0) activeCount++;
        if (this.currentQuery.contexts && this.currentQuery.contexts.length > 0) activeCount++;
        if (this.currentQuery.projects && this.currentQuery.projects.length > 0) activeCount++;
        if (this.currentQuery.showArchived) activeCount++;
        if (this.currentQuery.dateRange) activeCount++;
        
        // Count show options (only if not default values)
        if (this.currentQuery.showRecurrent) activeCount++;
        if (this.currentQuery.showCompleted) activeCount++;
        if (this.currentQuery.showNotes) activeCount++;
        if (this.currentQuery.showOverdueOnToday) activeCount++;

        if (activeCount > 0) {
            this.activeFiltersIndicator.textContent = `${activeCount}`;
            this.activeFiltersIndicator.classList.remove('filter-bar__active-indicator--hidden');
        } else {
            this.activeFiltersIndicator.classList.add('filter-bar__active-indicator--hidden');
        }
    }

    /**
     * Toggle advanced filters panel visibility
     */
    private toggleAdvancedFilters(): void {
        if (!this.advancedFiltersPanel) return;

        const isVisible = !this.advancedFiltersPanel.classList.contains('filter-bar__advanced--hidden');
        this.advancedFiltersPanel.classList.toggle('filter-bar__advanced--hidden', isVisible);
        
        if (this.advancedFiltersButton) {
            this.advancedFiltersButton.classList.toggle('filter-bar__advanced-toggle--active', !isVisible);
        }
    }

    /**
     * Rebuild advanced filters when options change
     */
    private rebuildAdvancedFilters(): void {
        if (!this.advancedFiltersPanel) return;

        // Rebuild status checkboxes
        this.rebuildStatusCheckboxes();

        // Rebuild priority checkboxes
        this.rebuildPriorityCheckboxes();
        
        // Rebuild context checkboxes
        this.rebuildContextCheckboxes();
        
        // Rebuild project checkboxes
        this.rebuildProjectCheckboxes();
    }


    /**
     * Rebuild status checkboxes while preserving selection
     */
    private rebuildStatusCheckboxes(): void {
        const statusContainer = this.advancedFiltersPanel?.querySelector('.filter-bar__advanced-item:nth-child(1) .filter-bar__checkbox-group');
        if (!statusContainer) return;

        const selectedStatuses = this.currentQuery.statuses || [];
        statusContainer.empty();


        // Add specific status options
        this.filterOptions.statuses.forEach(status => {
            const checkboxWrapper = statusContainer.createDiv('filter-bar__checkbox-wrapper');
            
            const label = checkboxWrapper.createEl('label', {
                cls: 'filter-bar__checkbox-label'
            });

            const checkbox = label.createEl('input', {
                type: 'checkbox',
                value: status,
                cls: 'filter-bar__checkbox'
            });

            checkbox.checked = selectedStatuses.includes(status);

            label.createSpan({ text: status });

            checkbox.addEventListener('change', () => {
                this.updateStatusFilter();
            });
        });
    }

    /**
     * Rebuild priority checkboxes while preserving selection
     */
    private rebuildPriorityCheckboxes(): void {
        const priorityContainer = this.advancedFiltersPanel?.querySelector('.filter-bar__advanced-item:nth-child(2) .filter-bar__checkbox-group');
        if (!priorityContainer) return;

        const selectedPriorities = this.currentQuery.priorities || [];
        priorityContainer.empty();

        this.filterOptions.priorities.forEach(priority => {
            const checkboxWrapper = priorityContainer.createDiv('filter-bar__checkbox-wrapper');
            
            const label = checkboxWrapper.createEl('label', {
                cls: 'filter-bar__checkbox-label'
            });

            const checkbox = label.createEl('input', {
                type: 'checkbox',
                value: priority,
                cls: 'filter-bar__checkbox'
            });

            checkbox.checked = selectedPriorities.includes(priority);

            label.createSpan({ text: priority });

            checkbox.addEventListener('change', () => {
                this.updatePriorityFilter();
            });
        });
    }

    /**
     * Rebuild context checkboxes while preserving selection
     */
    private rebuildContextCheckboxes(): void {
        const contextContainer = this.advancedFiltersPanel?.querySelector('.filter-bar__advanced-item:nth-child(3) .filter-bar__checkbox-group');
        if (!contextContainer) return;

        const selectedContexts = this.currentQuery.contexts || [];
        contextContainer.empty();

        this.filterOptions.contexts.forEach(context => {
            const checkboxWrapper = contextContainer.createDiv('filter-bar__checkbox-wrapper');
            
            const label = checkboxWrapper.createEl('label', {
                cls: 'filter-bar__checkbox-label'
            });

            const checkbox = label.createEl('input', {
                type: 'checkbox',
                value: context,
                cls: 'filter-bar__checkbox'
            });

            checkbox.checked = selectedContexts.includes(context);

            label.createSpan({ text: context });

            checkbox.addEventListener('change', () => {
                this.updateContextFilter();
            });
        });
    }

    /**
     * Rebuild project checkboxes while preserving selection
     */
    private rebuildProjectCheckboxes(): void {
        const projectContainer = this.advancedFiltersPanel?.querySelector('.filter-bar__advanced-item:nth-child(4) .filter-bar__checkbox-group');
        if (!projectContainer) return;

        const selectedProjects = this.currentQuery.projects || [];
        projectContainer.empty();

        this.filterOptions.projects.forEach(project => {
            const checkboxWrapper = projectContainer.createDiv('filter-bar__checkbox-wrapper');
            
            const label = checkboxWrapper.createEl('label', {
                cls: 'filter-bar__checkbox-label'
            });

            const checkbox = label.createEl('input', {
                type: 'checkbox',
                value: project,
                cls: 'filter-bar__checkbox'
            });

            checkbox.checked = selectedProjects.includes(project);

            label.createSpan({ text: project });

            checkbox.addEventListener('change', () => {
                this.updateProjectFilter();
            });
        });
    }

    /**
     * Get human-readable label for sort key
     */
    private getSortKeyLabel(key: TaskSortKey): string {
        const labels: Record<TaskSortKey, string> = {
            'due': 'Due date',
            'scheduled': 'Scheduled date',
            'priority': 'Priority',
            'title': 'Title'
        };
        return labels[key] || key;
    }

    /**
     * Get human-readable label for group key
     */
    private getGroupKeyLabel(key: TaskGroupKey): string {
        const labels: Record<TaskGroupKey, string> = {
            'none': 'None',
            'status': 'Status',
            'priority': 'Priority',
            'context': 'Context',
            'project': 'Project',
            'due': 'Due date',
            'scheduled': 'Scheduled date'
        };
        return labels[key] || key;
    }


    /**
     * Toggle controls container visibility
     */
    private toggleControlsVisibility(): void {
        if (!this.controlsContainer) return;

        const isVisible = !this.controlsContainer.classList.contains('filter-bar__controls-container--hidden');
        this.controlsContainer.classList.toggle('filter-bar__controls-container--hidden', isVisible);
        
        if (this.settingsButton) {
            this.settingsButton.classList.toggle('filter-bar__settings-button--active', !isVisible);
        }
    }

    /**
     * Set up view options configuration
     */
    setViewOptions(
        options: { id: string; label: string; value: boolean }[],
        callback: (optionId: string, enabled: boolean) => void
    ): void {
        this.viewOptionsConfig = options;
        this.viewOptionsCallback = callback;
        
        // Update the dropdown if it exists
        if (this.viewOptionsDropdown) {
            this.updateViewOptionsDropdown();
        }
    }

    /**
     * Render view options controls
     */
    private renderViewOptionsControls(parent: HTMLElement): void {
        const viewContainer = parent.createDiv('filter-bar__view-options');
        
        viewContainer.createSpan({ text: 'View:', cls: 'filter-bar__label' });
        
        // Create dropdown button
        this.viewOptionsButton = viewContainer.createEl('button', {
            text: 'Options',
            cls: 'filter-bar__view-options-btn'
        });
        
        // Create dropdown menu (initially hidden)
        this.viewOptionsDropdown = viewContainer.createDiv({ 
            cls: 'filter-bar__view-options-menu filter-bar__view-options-menu--hidden' 
        });
        
        // Toggle dropdown on button click
        this.viewOptionsButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = this.viewOptionsDropdown!.classList.contains('filter-bar__view-options-menu--hidden');
            if (isHidden) {
                this.viewOptionsDropdown!.classList.remove('filter-bar__view-options-menu--hidden');
            } else {
                this.viewOptionsDropdown!.classList.add('filter-bar__view-options-menu--hidden');
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (viewContainer && !viewContainer.contains(e.target as Node)) {
                this.viewOptionsDropdown?.classList.add('filter-bar__view-options-menu--hidden');
            }
        });
        
        // Initial update
        this.updateViewOptionsDropdown();
    }
    
    /**
     * Update view options dropdown with current config
     */
    private updateViewOptionsDropdown(): void {
        if (!this.viewOptionsDropdown || !this.viewOptionsConfig) return;
        
        this.viewOptionsDropdown.empty();
        
        // Create checkboxes for each option
        this.viewOptionsConfig.forEach(option => {
            const optionContainer = this.viewOptionsDropdown!.createDiv({ cls: 'filter-bar__view-option' });
            
            const label = optionContainer.createEl('label', {
                cls: 'filter-bar__view-option-label'
            });

            const checkbox = label.createEl('input', {
                type: 'checkbox',
                cls: 'filter-bar__view-option-checkbox'
            });
            checkbox.checked = option.value;
            
            label.createSpan({ text: option.label });
            
            checkbox.addEventListener('change', () => {
                if (this.viewOptionsCallback) {
                    this.viewOptionsCallback(option.id, checkbox.checked);
                }
                this.updateViewOptionsButtonText();
            });
            
            // Allow clicking anywhere on the option to toggle
            optionContainer.addEventListener('click', (e) => {
                // Prevent double-toggle when clicking directly on the checkbox
                if (e.target === checkbox) {
                    return;
                }
                
                // If clicking on the label or its children, let the native label behavior handle it
                if (e.target === label || label.contains(e.target as Node)) {
                    // The native label behavior will toggle the checkbox and trigger the change event
                    return;
                }
                
                // For clicks outside the label (but inside the container), manually toggle
                checkbox.checked = !checkbox.checked;
                
                // Trigger the change event
                checkbox.dispatchEvent(new Event('change'));
            });
        });
        
        this.updateViewOptionsButtonText();
    }
    
    /**
     * Update view options button text based on active options
     */
    private updateViewOptionsButtonText(): void {
        if (!this.viewOptionsButton || !this.viewOptionsConfig) return;
        
        const activeOptions = this.viewOptionsConfig.filter(option => option.value);
        
        if (activeOptions.length === 0) {
            this.viewOptionsButton.textContent = 'Options (None)';
        } else if (activeOptions.length === 1) {
            // Shorten common labels for button display
            const shortLabel = activeOptions[0].label
                .replace('Scheduled tasks', 'Scheduled')
                .replace('Calendar subscriptions', 'Subscriptions')
                .replace('Time entries', 'Time');
            this.viewOptionsButton.textContent = `Options (${shortLabel})`;
        } else {
            this.viewOptionsButton.textContent = `Options (${activeOptions.length} selected)`;
        }
    }

    /**
     * Render show dropdown controls
     */
    private renderShowDropdownControls(parent: HTMLElement): void {
        const showContainer = parent.createDiv('filter-bar__show-options');
        
        showContainer.createSpan({ text: 'Show:', cls: 'filter-bar__label' });
        
        // Create dropdown button
        this.showButton = showContainer.createEl('button', {
            text: 'Options',
            cls: 'filter-bar__show-options-btn'
        });
        
        // Create dropdown menu (initially hidden)
        this.showDropdown = showContainer.createDiv({ 
            cls: 'filter-bar__show-options-menu filter-bar__show-options-menu--hidden' 
        });
        
        // Toggle dropdown on button click
        this.showButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = this.showDropdown!.classList.contains('filter-bar__show-options-menu--hidden');
            if (isHidden) {
                this.showDropdown!.classList.remove('filter-bar__show-options-menu--hidden');
            } else {
                this.showDropdown!.classList.add('filter-bar__show-options-menu--hidden');
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (showContainer && !showContainer.contains(e.target as Node)) {
                this.showDropdown?.classList.add('filter-bar__show-options-menu--hidden');
            }
        });
        
        // Initial update
        this.updateShowDropdown();
    }
    
    /**
     * Update show dropdown with current config
     */
    private updateShowDropdown(): void {
        if (!this.showDropdown || !this.showDropdownConfig) return;
        
        this.showDropdown.empty();
        
        // Create checkboxes for each option
        this.showDropdownConfig.forEach(option => {
            const optionContainer = this.showDropdown!.createDiv({ cls: 'filter-bar__show-option' });
            
            const label = optionContainer.createEl('label', {
                cls: 'filter-bar__show-option-label'
            });

            const checkbox = label.createEl('input', {
                type: 'checkbox',
                cls: 'filter-bar__show-option-checkbox'
            });
            checkbox.setAttribute('data-option-id', option.id);
            checkbox.checked = option.value;
            
            label.createSpan({ text: option.label });
            
            checkbox.addEventListener('change', () => {
                // Update the config value to match checkbox state
                option.value = checkbox.checked;
                
                if (this.showDropdownCallback) {
                    this.showDropdownCallback(option.id, checkbox.checked);
                }
                this.updateShowButtonText();
            });
            
            // Allow clicking anywhere on the option to toggle
            optionContainer.addEventListener('click', (e) => {
                // Prevent double-toggle when clicking directly on the checkbox
                if (e.target === checkbox) {
                    return;
                }
                
                // If clicking on the label or its children, let the native label behavior handle it
                if (e.target === label || label.contains(e.target as Node)) {
                    // The native label behavior will toggle the checkbox and trigger the change event
                    return;
                }
                
                // For clicks outside the label (but inside the container), manually toggle
                checkbox.checked = !checkbox.checked;
                
                // Trigger the change event
                checkbox.dispatchEvent(new Event('change'));
            });
        });
        
        this.updateShowButtonText();
    }
    
    /**
     * Update show dropdown button text based on active options
     */
    private updateShowButtonText(): void {
        if (!this.showButton || !this.showDropdownConfig) return;
        
        // Get active options by checking actual checkbox states
        const activeOptions = this.showDropdownConfig.filter(option => {
            const checkbox = this.showDropdown?.querySelector(`input[data-option-id="${option.id}"]`) as HTMLInputElement;
            return checkbox?.checked || false;
        });
        
        if (activeOptions.length === 0) {
            this.showButton.textContent = 'Show (None)';
        } else if (activeOptions.length === 1) {
            // Shorten common labels for button display
            const shortLabel = activeOptions[0].label
                .replace('Archived tasks', 'Archived')
                .replace('Recurrent tasks', 'Recurrent')
                .replace('Completed tasks', 'Completed')
                .replace('Show notes', 'Notes')
                .replace('Overdue on today', 'Overdue');
            this.showButton.textContent = `Show (${shortLabel})`;
        } else {
            this.showButton.textContent = `Show (${activeOptions.length} selected)`;
        }
    }
    
    /**
     * Set up show dropdown configuration
     */
    setShowOptions(
        options: { id: keyof FilterQuery; label: string; value: boolean }[],
        callback: (optionId: keyof FilterQuery, enabled: boolean) => void
    ): void {
        this.showDropdownConfig = options;
        this.showDropdownCallback = callback;
        
        // Update the dropdown if it exists
        if (this.showDropdown) {
            this.updateShowDropdown();
        }
    }

    /**
     * Destroy and clean up the FilterBar
     */
    destroy(): void {
        // Clean up cache refresh listeners
        if (this.cacheRefreshListeners) {
            this.cacheRefreshListeners.forEach(unsubscribe => unsubscribe());
            this.cacheRefreshListeners = [];
        }
        
        this.container.empty();
        this.removeAllListeners();
    }
}
