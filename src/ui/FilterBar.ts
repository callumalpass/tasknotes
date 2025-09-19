import { App, ButtonComponent, DropdownComponent, Modal, TextComponent, debounce, setTooltip, setIcon, Menu } from 'obsidian';
import { FILTER_OPERATORS, FILTER_PROPERTIES, FilterCondition, FilterGroup, FilterNode, FilterOperator, FilterOptions, FilterProperty, FilterQuery, PropertyDefinition, SavedView, TaskGroupKey, TaskSortKey } from '../types';

import { DragDropHandler } from './DragDropHandler';
import { EventEmitter } from '../utils/EventEmitter';
import { FilterUtils } from '../utils/FilterUtils';
import { isValidDateInput } from '../utils/dateUtils';
import { showConfirmationModal } from '../modals/ConfirmationModal';
import { DateContextMenu } from '../components/DateContextMenu';
import { PropertyVisibilityDropdown } from './PropertyVisibilityDropdown';
import { SubgroupMenuBuilder } from '../components/SubgroupMenuBuilder';
import { TranslationKey } from '../i18n';

class SaveViewModal extends Modal {
    private name: string;
    private onSubmit: (name: string) => void;
    private translate: (key: TranslationKey, vars?: Record<string, string>) => string;

    constructor(app: App, onSubmit: (name: string) => void, translate: (key: TranslationKey, vars?: Record<string, string>) => string) {
        super(app);
        this.onSubmit = onSubmit;
        this.translate = translate;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: this.translate('ui.filterBar.saveView') });

        const textComponent = new TextComponent(contentEl)
            .setPlaceholder(this.translate('ui.filterBar.saveViewNamePlaceholder'))
            .onChange((value) => {
                this.name = value;
            });
        textComponent.inputEl.style.width = '100%';

        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
        new ButtonComponent(buttonContainer)
            .setButtonText(this.translate('ui.filterBar.saveButton'))
            .setCta()
            .onClick(() => {
                if (this.name) {
                    this.onSubmit(this.name);
                    this.close();
                }
            });
    }

    onClose() {
        this.contentEl.empty();
    }
}

/**
 * Advanced FilterBar component implementing the new query builder system
 * Provides hierarchical filtering with groups, conditions, and saved views
 */
export class FilterBar extends EventEmitter {
    private app: App;
    private plugin: any; // TaskNotesPlugin
    private container: HTMLElement;
    private currentQuery: FilterQuery;
    private savedViews: readonly SavedView[] = [];
    private filterOptions: FilterOptions;
    private activeSavedView: SavedView | null = null;
    private isLoadingSavedView = false;
    private isSettingSavedView = false;
    private temporaryVisibleProperties: string[] | null = null;

    // Debouncing for input fields
    private debouncedEmitQueryChange: () => void;
    private debouncedHandleSearchInput: () => void;

    // UI Elements
    private viewSelectorButton?: ButtonComponent;
    private viewSelectorDropdown?: HTMLElement;
    private filterBuilder?: HTMLElement;
    private displaySection?: HTMLElement;
    private viewOptionsContainer?: HTMLElement;
    private searchInput?: TextComponent;
    private viewsButtonAlignment: 'left' | 'right' = 'right';

    private isUserTyping = false;
    private viewOptionsConfig: Array<{id: string, label: string, value: boolean, onChange: (value: boolean) => void}> | null = null;
    private dragDropHandler: DragDropHandler;

    // Click-outside handling
    private mainFilterBox?: HTMLElement;
    private abortController?: AbortController;
    private ignoreNextClick = false;
    private ignoreClickTimeout?: number;

    // Collapse states
    private sectionStates = {
        filterBox: false,   // Entire filter box - collapsed by default
        filters: true,      // This view section - expanded by default
        display: true,      // Display & Organization - expanded by default
        viewOptions: false  // View Options - collapsed by default
    };

    private enableGroupExpandCollapse = true;
    private forceShowExpandCollapse = false;
    private viewType?: string;
    private translate: (key: TranslationKey, vars?: Record<string, string>) => string;

    constructor(
        app: App,
        plugin: any, // TaskNotesPlugin
        container: HTMLElement,
        initialQuery: FilterQuery,
        filterOptions: FilterOptions,
        viewsButtonAlignment: 'left' | 'right' = 'right',
        options?: { enableGroupExpandCollapse?: boolean; forceShowExpandCollapse?: boolean; viewType?: string }
    ) {
        super();
        this.app = app;
        this.plugin = plugin;
        this.container = container;
        this.currentQuery = FilterUtils.deepCloneFilterQuery(initialQuery);
        this.filterOptions = filterOptions;
        this.viewsButtonAlignment = viewsButtonAlignment;
        this.enableGroupExpandCollapse = options?.enableGroupExpandCollapse ?? true;
        this.forceShowExpandCollapse = options?.forceShowExpandCollapse ?? false;
        this.viewType = options?.viewType;
        this.translate = (key: TranslationKey, vars?: Record<string, string>) => this.plugin.i18n.translate(key, vars);

        // Initialize drag and drop handler
        this.dragDropHandler = new DragDropHandler((fromIndex, toIndex) => {
            this.emit('reorderViews', fromIndex, toIndex);
        });

        // Defensive migration fix: ensure query has proper structure
        this.ensureValidFilterQuery();

        // Initialize debounced query change emission (300ms delay)
        this.debouncedEmitQueryChange = debounce(() => {
            // Clear active saved view when user manually modifies filters (except during saved view loading)
            if (!this.isLoadingSavedView && this.activeSavedView) {
                this.clearActiveSavedView();
                // Re-render the filter section to remove the view name display
                this.updateFilterBuilder();
            }
            this.emit('queryChange', FilterUtils.deepCloneFilterQuery(this.currentQuery));
            this.updateFilterToggleBadge();
        }, 300);

        // Initialize debounced search input handling (800ms delay to reduce lag)
        this.debouncedHandleSearchInput = debounce(() => {
            this.handleSearchInput();
        }, 800);

        this.render();
        this.updateUI();
        this.setupClickOutsideHandlers();
    }

    /**
     * Ensure the current query has the proper FilterQuery structure
     * If it's from an old version (<3.13.0), replace with fresh default
     */
    private ensureValidFilterQuery(): void {
        // Check if query has the new FilterGroup structure
        if (!this.currentQuery ||
            typeof this.currentQuery !== 'object' ||
            this.currentQuery.type !== 'group' ||
            !Array.isArray(this.currentQuery.children) ||
            typeof this.currentQuery.conjunction !== 'string') {


            // Create a fresh default query, preserving any sort/group settings if valid
            const sortKey = (this.currentQuery?.sortKey && typeof this.currentQuery.sortKey === 'string') ? this.currentQuery.sortKey : 'due';
            const sortDirection = (this.currentQuery?.sortDirection && typeof this.currentQuery.sortDirection === 'string') ? this.currentQuery.sortDirection : 'asc';
            const groupKey = (this.currentQuery?.groupKey && typeof this.currentQuery.groupKey === 'string') ? this.currentQuery.groupKey : 'none';

            this.currentQuery = {
                type: 'group',
                id: FilterUtils.generateId(),
                conjunction: 'and',
                children: [],
                sortKey: sortKey as any,
                sortDirection: sortDirection as any,
                groupKey: groupKey as any
            };
        }
    }

    /**
     * Update the current query and refresh UI
     */
    updateQuery(query: FilterQuery): void {
        this.currentQuery = FilterUtils.deepCloneFilterQuery(query);
        // Ensure the updated query has proper structure
        this.ensureValidFilterQuery();
        // Detect if the updated query matches any saved view
        this.detectActiveSavedView();
        this.updateUI();
    }

    /**
     * Handle search input changes
     */
    private handleSearchInput(): void {
        try {
            const searchTerm = this.searchInput?.getValue().trim() || '';

            // Remove existing search conditions and reorganize query structure
            this.removeSearchConditions();

            // Add new search condition if term is not empty
            if (searchTerm) {
                this.addSearchConditionWithGrouping(searchTerm);
            }

            // Update only the filter builder to show the search condition
            this.updateFilterBuilder();

            // Emit query change (and update badge immediately)
            this.emitQueryChange();

            // Reset typing flag after a delay
            setTimeout(() => {
                this.isUserTyping = false;
            }, 1000);
        } catch (error) {
            console.error('Error handling search input:', error);
        }
    }

    /**
     * Remove existing search conditions from the query and restore original structure
     */
    private removeSearchConditions(): void {
        // Defensive check: ensure children array exists
        if (!Array.isArray(this.currentQuery.children)) {
            this.currentQuery.children = [];
            return;
        }

        // Find the search condition
        const searchConditionIndex = this.currentQuery.children.findIndex(child =>
            child.type === 'condition' &&
            child.property === 'title' &&
            child.operator === 'contains' &&
            child.id.startsWith('search_')
        );

        if (searchConditionIndex === -1) {
            // No search condition found, nothing to do
            return;
        }

        // Remove the search condition
        this.currentQuery.children.splice(searchConditionIndex, 1);

        // Check if we have a structure where the remaining child is a single group
        // that was created to preserve existing filters when search was added
        if (this.currentQuery.children.length === 1 &&
            this.currentQuery.children[0].type === 'group') {

            const remainingGroup = this.currentQuery.children[0] as FilterGroup;

            // Restore the original filter structure by moving the group's children up to the root
            this.currentQuery.children = remainingGroup.children;
            this.currentQuery.conjunction = remainingGroup.conjunction;
        }
    }

    /**
     * Add a search condition to the query, preserving existing filters by grouping them
     */
    private addSearchConditionWithGrouping(searchTerm: string): void {
        // Defensive check: ensure children array exists
        if (!Array.isArray(this.currentQuery.children)) {
            this.currentQuery.children = [];
        }

        const searchCondition: FilterCondition = {
            type: 'condition',
            id: `search_${FilterUtils.generateId()}`,
            property: 'title',
            operator: 'contains',
            value: searchTerm
        };

        // Get existing non-search filters
        const existingFilters = this.currentQuery.children.filter(child => {
            return !(child.type === 'condition' &&
                    child.property === 'title' &&
                    child.operator === 'contains' &&
                    child.id.startsWith('search_'));
        });

        if (existingFilters.length === 0) {
            // No existing filters, just add the search condition
            this.currentQuery.children = [searchCondition];
        } else {
            // Create a group containing all existing filters
            const existingFiltersGroup: FilterGroup = {
                type: 'group',
                id: FilterUtils.generateId(),
                conjunction: this.currentQuery.conjunction, // Preserve the current conjunction
                children: existingFilters
            };

            // Replace query children with the search condition AND the existing filters group
            this.currentQuery.children = [searchCondition, existingFiltersGroup];
            this.currentQuery.conjunction = 'and'; // Connect search with existing filters using AND
        }
    }

    /**
     * Update saved views list
     */
    updateSavedViews(views: readonly SavedView[]): void {
        this.savedViews = views;
        this.renderViewSelectorDropdown();
        // Check if current query matches any saved view
        this.detectActiveSavedView();
    }

    /**
     * Detect if the current query matches any saved view and set activeSavedView accordingly
     */
    private detectActiveSavedView(): void {
        if (this.isLoadingSavedView || this.isSettingSavedView) return; // Don't interfere when explicitly loading/setting a view

        // Find a saved view that matches the current query (prefer the most recently created)
        let matchingView = null;
        for (let i = this.savedViews.length - 1; i >= 0; i--) {
            const view = this.savedViews[i];
            if (this.queriesMatch(this.currentQuery, view.query)) {
                matchingView = view;
                break;
            }
        }

        if (matchingView && this.activeSavedView?.id !== matchingView.id) {
            this.activeSavedView = matchingView;

            // Clear temporary properties if they match the saved view's properties
            if (this.temporaryVisibleProperties && matchingView.visibleProperties) {
                const tempPropsSet = new Set(this.temporaryVisibleProperties);
                const savedPropsSet = new Set(matchingView.visibleProperties);

                // Check if the sets are equal (same properties)
                if (tempPropsSet.size === savedPropsSet.size &&
                    [...tempPropsSet].every(prop => savedPropsSet.has(prop))) {
                    this.temporaryVisibleProperties = null;
                }
            }

            this.updateViewSelectorButtonState();
            // Emit event when active saved view changes
            this.emit('activeSavedViewChanged', matchingView);
        } else if (!matchingView && this.activeSavedView) {
            this.activeSavedView = null;
            this.updateViewSelectorButtonState();
            // Emit event when active saved view is cleared
            this.emit('activeSavedViewChanged', null);
        }
    }

    /**
     * Check if two queries are functionally equivalent
     */
    private queriesMatch(query1: FilterQuery, query2: FilterQuery): boolean {
        // Deep comparison of filter queries (excluding sort/group which might differ)
        const normalize = (query: FilterQuery) => {
            const normalized = FilterUtils.deepCloneFilterQuery(query);
            // Remove sort/group for comparison as they might be view-specific
            delete (normalized as any).sortKey;
            delete (normalized as any).sortDirection;
            delete (normalized as any).groupKey;
            return normalized;
        };

        try {
            const norm1 = normalize(query1);
            const norm2 = normalize(query2);
            return JSON.stringify(norm1) === JSON.stringify(norm2);
        } catch (error) {
            console.warn('Error comparing queries:', error);
            return false;
        }
    }

    /**
     * Get the current query
     */
    getCurrentQuery(): FilterQuery {
        return FilterUtils.deepCloneFilterQuery(this.currentQuery);
    }

    /**
     * Clear the active saved view indicator (called when filters are manually modified)
     */
    private clearActiveSavedView(): void {
        this.activeSavedView = null;
        this.updateViewSelectorButtonState();
    }


    /**
     * Render the complete FilterBar UI
     */
    private render(): void {
        try {
            if (typeof this.container.empty === 'function') {
                this.container.empty();
            } else {
                this.container.innerHTML = '';
            }
            if (typeof this.container.addClass === 'function') {
                this.container.addClass('advanced-filter-bar');
            } else if (this.container.classList) {
                this.container.classList.add('advanced-filter-bar');
            }

            // 1. Top Controls (Filter Icon + Templates Button)
            this.renderTopControls();
        } catch (error) {
            console.error('Error rendering FilterBar:', error);
            // Create minimal fallback UI
            this.renderFallbackUI();
        }
    }

    /**
     * Render a minimal fallback UI in case of errors
     */
    private renderFallbackUI(): void {
        try {
            if (this.container.children.length === 0) {
                if (typeof this.container.addClass === 'function') {
                    this.container.addClass('advanced-filter-bar');
                } else if (this.container.classList) {
                    this.container.classList.add('advanced-filter-bar');
                }
                let errorDiv: HTMLElement;
                if (typeof this.container.createDiv === 'function') {
                    errorDiv = this.container.createDiv({ cls: 'filter-bar-error' });
                } else {
                    errorDiv = document.createElement('div');
                    errorDiv.className = 'filter-bar-error';
                    this.container.appendChild(errorDiv);
                }
                errorDiv.textContent = 'Filter bar temporarily unavailable';
            }
        } catch (error) {
            console.error('Error rendering fallback FilterBar UI:', error);
        }
    }

    /**
     * Render the top controls (filter toggle + search + templates button)
     */
    private renderTopControls(): void {
        const topControls = this.container.createDiv('filter-bar__top-controls');

        const makeViewsButton = () => {
            this.viewSelectorButton = new ButtonComponent(topControls)
                .setButtonText(this.plugin.i18n.translate('ui.filterBar.views'))
                .setClass('filter-bar__templates-button')
                .setTooltip(this.plugin.i18n.translate('ui.filterBar.savedFilterViews'))
                .onClick(() => {
                    this.toggleViewSelectorDropdown();
                });
            this.viewSelectorButton.buttonEl.addClass('clickable-icon');

            // Add chevrons-up-down icon
            const chevronContainer = this.viewSelectorButton.buttonEl.createDiv('filter-bar__chevron-container');
            setIcon(chevronContainer, 'chevrons-up-down');

            this.updateViewSelectorButtonState();
        };
        const makeFilterToggle = () => {
            const filterToggle = new ButtonComponent(topControls)
                .setTooltip(this.plugin.i18n.translate('ui.filterBar.toggleFilter'))
                .setClass('filter-bar__filter-toggle')
                .onClick(() => {
                    this.toggleMainFilterBox();
                });
            filterToggle.buttonEl.addClass('clickable-icon');
            filterToggle.buttonEl.addClass('has-text-icon');

            // Clear any existing content and build manually
            filterToggle.buttonEl.empty();

            // Add icon
            const iconEl = filterToggle.buttonEl.createSpan({ cls: 'button-icon' });
            setIcon(iconEl, 'list-filter');

            // Add text
            const textEl = filterToggle.buttonEl.createSpan({ cls: 'button-text', text: this.plugin.i18n.translate('ui.filterBar.filters') });
            // Right-click quick clear
            filterToggle.buttonEl.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.hasActiveFilters()) {
                    this.clearAllFilters();
                }
            });
        };
        const makePropertiesButton = () => {
            const propertiesButton = new ButtonComponent(topControls)
                .setTooltip('Configure visible properties')
                .setClass('filter-bar__properties-button')
                .onClick((event) => {
                    // Ensure we have a proper MouseEvent
                    const mouseEvent = event instanceof MouseEvent ? event :
                        new MouseEvent('click', { bubbles: true, cancelable: true });
                    this.showPropertiesDropdown(mouseEvent);
                });
            propertiesButton.buttonEl.addClass('clickable-icon');
            propertiesButton.buttonEl.addClass('has-text-icon');

            // Clear any existing content and build manually
            propertiesButton.buttonEl.empty();

            // Add icon
            const iconEl = propertiesButton.buttonEl.createSpan({ cls: 'button-icon' });
            setIcon(iconEl, 'list');

            // Add text
            const textEl = propertiesButton.buttonEl.createSpan({ cls: 'button-text', text: 'Properties' });
        };
        const makeSearchInput = () => {
            this.searchInput = new TextComponent(topControls)
                .setPlaceholder('Search tasks...');
            this.searchInput.inputEl.addClass('filter-bar__search-input');
            setTooltip(this.searchInput.inputEl, 'Search task titles', { placement: 'top' });
            this.searchInput.onChange(() => {
                this.isUserTyping = true;
                this.debouncedHandleSearchInput();
            });
        };
        const makeSortGroupButton = () => {
            // Don't show sort/group button on advanced calendar view
            if (this.viewType === 'advanced-calendar') return;

            // Wrap button in a container so tests and CSS can target the wrapper
            const wrapper = topControls.createDiv('filter-bar__sort-group-button');

            const sortGroupButton = new ButtonComponent(wrapper)
                .setTooltip('Sort and group options')
                .onClick((event) => {
                    this.showSortGroupContextMenu(event);
                });
            sortGroupButton.buttonEl.addClass('clickable-icon');
            sortGroupButton.buttonEl.addClass('has-text-icon');

            // Clear any existing content and build manually
            sortGroupButton.buttonEl.empty();

            // Add icon
            const iconEl = sortGroupButton.buttonEl.createSpan({ cls: 'button-icon' });
            setIcon(iconEl, 'arrow-up-down');

            // Add text
            sortGroupButton.buttonEl.createSpan({ cls: 'button-text', text: 'Sort' });
        };
        const makeNewTaskButton = () => {
            // Don't show new task button on subtask widget
            if (this.viewType === 'subtask-widget') return;

            const newTaskButton = new ButtonComponent(topControls)
                .setTooltip('Create new task')
                .setClass('filter-bar__new-task-button')
                .onClick(() => {
                    this.createNewTask();
                });
            newTaskButton.buttonEl.addClass('clickable-icon');
            newTaskButton.buttonEl.addClass('has-text-icon');

            // Clear any existing content and build manually
            if ((newTaskButton.buttonEl as any).empty) { (newTaskButton.buttonEl as any).empty(); } else { newTaskButton.buttonEl.innerHTML = ''; }

            // Add icon
            const iconEl = newTaskButton.buttonEl.createSpan({ cls: 'button-icon' });
            setIcon(iconEl, 'plus');

            // Add text
            const textEl = newTaskButton.buttonEl.createSpan({ cls: 'button-text', text: 'New' });
        };

        // Create expand/collapse button functions
        const makeExpandCollapseButtons = () => {
            const isGrouped = (this.currentQuery.groupKey || 'none') !== 'none';
            const shouldShow = this.enableGroupExpandCollapse && (isGrouped || this.forceShowExpandCollapse);
            if (shouldShow) {
                // Expand button first (always to the left of collapse)
                const expandAllBtn = new ButtonComponent(topControls)
                    .setIcon('list-tree')
                    .setTooltip('Expand All Groups')
                    .setClass('filter-bar__expand-groups')
                    .onClick(() => this.emit('expandAllGroups'));
                expandAllBtn.buttonEl.addClass('clickable-icon');

                // Collapse button second
                const collapseAllBtn = new ButtonComponent(topControls)
                    .setIcon('list-collapse')
                    .setTooltip('Collapse All Groups')
                    .setClass('filter-bar__collapse-groups')
                    .onClick(() => this.emit('collapseAllGroups'));
                collapseAllBtn.buttonEl.addClass('clickable-icon');
            }
        };

        // Order controls based on alignment preference
        if (this.viewsButtonAlignment === 'left') {
            // Left: Views -> Search Box -> Sort -> Filter -> Properties -> New
            makeViewsButton();
            makeSearchInput();
            makeSortGroupButton();
            makeFilterToggle();
            makePropertiesButton();
            makeNewTaskButton();
        } else {
            // Right (default): Search Box -> Sort -> Filter -> Properties -> New -> Views
            makeSearchInput();
            makeSortGroupButton();
            makeFilterToggle();
            makePropertiesButton();
            makeNewTaskButton();
            makeViewsButton();
        }

        // Update button state based on active saved view
        this.updateViewSelectorButtonState();

        // Main filter box (now rendered within top-controls for positioning)
        this.renderMainFilterBox(topControls);

        // Views dropdown; add left modifier when aligning left
        const dropdownClass = this.viewsButtonAlignment === 'left'
            ? 'filter-bar__view-selector-dropdown filter-bar__view-selector-dropdown--hidden filter-bar__view-selector-dropdown--left'
            : 'filter-bar__view-selector-dropdown filter-bar__view-selector-dropdown--hidden';
        this.viewSelectorDropdown = topControls.createDiv({ cls: dropdownClass });

        // Populate the dropdown with saved views
        this.renderViewSelectorDropdown();
    }

    /**
     * Render the main filter box (collapsible)
     */
    private renderMainFilterBox(container: HTMLElement): void {
        this.mainFilterBox = container.createDiv('filter-bar__main-box');
        if (!this.sectionStates.filterBox) {
            this.mainFilterBox.addClass('filter-bar__main-box--collapsed');
        }

        // Position the filter box relative to the filter button
        this.positionFilterBox();

        // 1. Filter Builder (This view section)
        this.renderFilterBuilder(this.mainFilterBox);

        // 2. View-Specific Options
        this.renderViewOptions(this.mainFilterBox);
    }

    /**
     * Position the filter box relative to the filter toggle button
     */
    private positionFilterBox(): void {
        if (!this.mainFilterBox) return;

        // Find the filter button to position relative to it
        const filterButton = this.container.querySelector('.filter-bar__filter-toggle') as HTMLElement;
        if (filterButton) {
            const containerRect = this.container.getBoundingClientRect();
            const buttonRect = filterButton.getBoundingClientRect();
            const filterBoxRect = this.mainFilterBox.getBoundingClientRect();

            // Calculate ideal position aligned with filter button
            let leftOffset = buttonRect.left - containerRect.left;

            // Find the parent pane/leaf to get the actual available space
            const parentLeaf = this.container.closest('.workspace-leaf');
            if (parentLeaf) {
                const leafRect = parentLeaf.getBoundingClientRect();
                const margin = 30; // generous margin from pane edge

                // Calculate how far right the popup would extend
                const popupRightEdge = containerRect.left + leftOffset + filterBoxRect.width;
                const maxAllowedRight = leafRect.right - margin;

                if (popupRightEdge > maxAllowedRight) {
                    // Calculate how much we need to shift left
                    const overflow = popupRightEdge - maxAllowedRight;
                    leftOffset = leftOffset - overflow;

                    // Ensure it doesn't go off the left edge of the container
                    if (leftOffset < 0) {
                        leftOffset = 0;
                    }
                }
            }

            // Position the filter box
            this.mainFilterBox.style.left = `${leftOffset}px`;
        }
    }

    /**
     * Setup click-outside and keyboard handlers for filter box and views dropdown
     */
    private setupClickOutsideHandlers(): void {
        // Create AbortController for clean event management
        this.abortController = new AbortController();
        const { signal } = this.abortController;

        // Click outside handler with passive option for better performance
        document.addEventListener('click', (event: MouseEvent) => {
            this.handleDocumentClick(event);
        }, { signal, passive: true });

        // Keyboard escape handler for accessibility
        document.addEventListener('keydown', (event: KeyboardEvent) => {
            this.handleKeyDown(event);
        }, { signal });
    }

    /**
     * Temporarily ignore the next click to prevent closing after UI updates
     */
    private ignoreNextClickOutside(): void {
        this.ignoreNextClick = true;

        // Clear any existing timeout
        if (this.ignoreClickTimeout) {
            window.clearTimeout(this.ignoreClickTimeout);
        }

        // Reset the flag after a short delay as a safety measure
        this.ignoreClickTimeout = window.setTimeout(() => {
            this.ignoreNextClick = false;
            this.ignoreClickTimeout = undefined;
        }, 100);
    }

    /**
     * Handle keyboard events for accessibility
     */
    private handleKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            // Close filter box if open
            if (this.sectionStates.filterBox) {
                this.sectionStates.filterBox = false;
                this.updateFilterBoxState();
                event.preventDefault();
                return;
            }

            // Close view selector dropdown if open
            if (this.viewSelectorDropdown && !this.viewSelectorDropdown.classList.contains('filter-bar__view-selector-dropdown--hidden')) {
                this.viewSelectorDropdown.classList.add('filter-bar__view-selector-dropdown--hidden');
                if (this.viewSelectorButton?.buttonEl) {
                    this.viewSelectorButton.buttonEl.classList.remove('filter-bar__templates-button--active');
                }
                event.preventDefault();
            }
        }
    }

    /**
     * Handle document clicks to close dropdowns and filter box when clicking outside
     */
    private handleDocumentClick(event: MouseEvent): void {
        // Ignore clicks that happen immediately after UI updates
        if (this.ignoreNextClick) {
            this.ignoreNextClick = false;
            return;
        }

        const target = event.target as HTMLElement;
        if (!target) return;

        // Check if click is outside the main filter box
        if (this.sectionStates.filterBox && this.mainFilterBox && this.container) {
            const filterToggleButton = this.container.querySelector('.filter-bar__filter-toggle');

            // Check if the click is inside the entire filter bar container
            const isInsideFilterBar = this.container.contains(target);
            const isFilterToggleButton = filterToggleButton && filterToggleButton.contains(target);

            // Only close if clicking completely outside the filter bar, but not on the toggle button
            if (!isInsideFilterBar && !isFilterToggleButton) {
                this.sectionStates.filterBox = false;
                this.updateFilterBoxState();
            }
        }

        // Check if click is outside the view selector dropdown
        if (this.viewSelectorDropdown && this.viewSelectorButton?.buttonEl) {
            const isDropdownHidden = this.viewSelectorDropdown.classList.contains('filter-bar__view-selector-dropdown--hidden');

            // Don't close if clicking on the views button or inside the dropdown
            if (!isDropdownHidden &&
                !this.viewSelectorButton.buttonEl.contains(target) &&
                !this.viewSelectorDropdown.contains(target)) {
                this.viewSelectorDropdown.classList.add('filter-bar__view-selector-dropdown--hidden');
                this.viewSelectorButton.buttonEl.classList.remove('filter-bar__templates-button--active');
            }
        }
    }

    /**
     * Toggle the main filter box (closes/opens via button click or click-outside)
     */
    private toggleMainFilterBox(): void {
        this.sectionStates.filterBox = !this.sectionStates.filterBox;
        // Re-position the filter box each time it's toggled
        this.positionFilterBox();
        this.updateFilterBoxState();
    }

    /**
     * Update the filter box and button state
     */
    private updateFilterBoxState(): void {
        const mainBox = this.container.querySelector('.filter-bar__main-box');
        const filterToggle = this.container.querySelector('.filter-bar__filter-toggle');

        if (mainBox) {
            mainBox.classList.toggle('filter-bar__main-box--collapsed', !this.sectionStates.filterBox);
        }

        if (filterToggle) {
            filterToggle.classList.toggle('filter-bar__filter-toggle--active', this.sectionStates.filterBox);
        }
    }

    private async deleteView(view: SavedView): Promise<void> {
        const confirmed = await showConfirmationModal(this.app, {
            title: 'Delete View',
            message: `Are you sure you want to delete the view "${view.name}"?`,
            isDestructive: true
        });
        if (confirmed) {
            this.emit('deleteView', view.id);
        }
    }

    /**
     * Render the view selector dropdown content
     */
    private renderViewSelectorDropdown(): void {
        if (!this.viewSelectorDropdown) return;

        this.viewSelectorDropdown.empty();

        // Saved views section
        if (this.savedViews.length === 0) {
            this.viewSelectorDropdown.createDiv({
                text: 'No saved views',
                cls: 'filter-bar__view-empty-message'
            });
        } else {
            const savedViewsSection = this.viewSelectorDropdown.createDiv('filter-bar__view-section');
            const savedViewsHeader = savedViewsSection.createDiv({
                text: 'Saved views',
                cls: 'filter-bar__view-section-header'
            });
            setTooltip(savedViewsHeader, 'Your saved filter configurations', { placement: 'top' });

            this.savedViews.forEach((view, index) => {
                const viewItemContainer = savedViewsSection.createDiv({
                    cls: 'filter-bar__view-item-container'
                });

                // Make the container draggable
                viewItemContainer.draggable = true;
                viewItemContainer.setAttribute('data-view-index', index.toString());

                // Add drag handle
                const dragHandle = viewItemContainer.createDiv({
                    cls: 'filter-bar__view-drag-handle'
                });
                setTooltip(dragHandle, 'Drag to reorder views', { placement: 'top' });

                const viewItemButton = new ButtonComponent(viewItemContainer)
                    .setButtonText(view.name)
                    .setClass('filter-bar__view-item')
                    .setTooltip(`Load saved view: ${view.name}`)
                    .onClick(() => {
                        // If this view is already active, clear all filters instead of reloading
                        if (this.activeSavedView && this.activeSavedView.id === view.id) {
                            this.clearAllFilters();
                        } else {
                            this.loadSavedView(view);
                        }
                    });

                // Add active state styling if this is the current active view
                if (this.activeSavedView && this.activeSavedView.id === view.id) {
                    viewItemButton.buttonEl.classList.add('filter-bar__view-item--active');
                    viewItemContainer.classList.add('filter-bar__view-item-container--active');
                }

                new ButtonComponent(viewItemContainer)
                    .setIcon('trash-2')
                    .setClass('filter-bar__view-delete')
                    .setTooltip('Delete view')
                    .onClick(async () => {
                        const confirmed = await showConfirmationModal(this.app, {
                            title: 'Delete View',
                            message: `Are you sure you want to delete the view "${view.name}"?`,
                            isDestructive: true
                        });
                        if (confirmed) {
                            this.emit('deleteView', view.id);
                        }
                    });

                // Add drag and drop event handlers
                this.dragDropHandler.setupDragAndDrop(viewItemContainer, index);
            });

            // Add global handlers to ensure drop events work reliably
            this.dragDropHandler.setupGlobalHandlers(savedViewsSection);
        }
    }

    /**
     * Render the filter builder section
     */
    private renderFilterBuilder(container: HTMLElement): void {
        const section = container.createDiv('filter-bar__section');

        // Collapsible header
        const header = section.createDiv('filter-bar__section-header');

        const titleWrapper = header.createDiv('filter-bar__section-header-main');
        titleWrapper.createSpan({
            text: 'Filter',
            cls: 'filter-bar__section-title'
        });
        setTooltip(titleWrapper, 'Click to expand/collapse filter conditions', { placement: 'top' });

        // Show active saved view name if one is loaded
        if (this.activeSavedView) {
            titleWrapper.createSpan({
                text: `(${this.activeSavedView.name})`,
                cls: 'filter-bar__active-view-name'
            });
        }

        const actionsWrapper = header.createDiv('filter-bar__section-header-actions');

        // Clear all filters button (always visible in modal)
        const clearButton = new ButtonComponent(actionsWrapper)
            .setIcon('eraser')
            .setTooltip('Clear all filters and groups')
            .setClass('filter-bar__clear-all-button')
            .onClick(() => {
                this.clearAllFiltersKeepModalOpen();
            });
        clearButton.buttonEl.addClass('clickable-icon');

        const saveButton = new ButtonComponent(actionsWrapper)
            .setIcon('save')
            .setTooltip('Save current filter as view')
            .setClass('filter-bar__save-button')
            .onClick(() => {
                this.showSaveViewDialog();
            });
        saveButton.buttonEl.addClass('clickable-icon');

        // Close modal button
        const closeButton = new ButtonComponent(actionsWrapper)
            .setIcon('x')
            .setTooltip('Close filter modal')
            .setClass('filter-bar__close-modal-button')
            .onClick(() => {
                this.closeFilterModal();
            });
        closeButton.buttonEl.addClass('clickable-icon');

        // Content
        const content = section.createDiv('filter-bar__section-content');
        if (!this.sectionStates.filters) {
            content.addClass('filter-bar__section-content--collapsed');
        }

        this.filterBuilder = content.createDiv('filter-bar__filter-builder');

        // Render the root group
        this.renderFilterGroup(this.filterBuilder, this.currentQuery, 0);

        // Add click handlers
        titleWrapper.addEventListener('click', () => {
            this.toggleSection('filters', header, content);
        });
    }

    /**
     * Render a filter group (recursive)
     */
    private renderFilterGroup(parent: HTMLElement, group: FilterGroup, depth: number, parentGroup?: FilterGroup, groupIndex?: number): void {
        // Defensive check: ensure group has required properties
        if (!group || typeof group !== 'object') {
            console.error('FilterBar: Invalid group object provided to renderFilterGroup');
            return;
        }

        // Ensure children array exists (defensive migration fix)
        if (!Array.isArray(group.children)) {
            group.children = [];
        }

        const groupContainer = parent.createDiv('filter-bar__group');

        // Group header with conjunction and delete button
        const groupHeader = groupContainer.createDiv('filter-bar__group-header');

        // Conjunction dropdown
        const conjunctionContainer = groupHeader.createDiv('filter-bar__conjunction');
        setTooltip(conjunctionContainer, 'Choose whether ALL or ANY of the conditions must match', { placement: 'top' });

        new DropdownComponent(conjunctionContainer)
            .addOption('and', depth === 0 ? this.plugin.i18n.translate('ui.filterBar.all') : this.plugin.i18n.translate('ui.filterBar.all'))
            .addOption('or', depth === 0 ? this.plugin.i18n.translate('ui.filterBar.any') : this.plugin.i18n.translate('ui.filterBar.any'))
            .setValue(group.conjunction || 'and') // Defensive fallback
            .onChange((value) => {
                group.conjunction = value as 'and' | 'or';
                this.updateUI();
                this.emitQueryChange();
            });

        conjunctionContainer.createSpan({
            text: this.plugin.i18n.translate('ui.filterBar.followingAreTrue'),
            cls: 'filter-bar__conjunction-text'
        });

        // Delete button for non-root groups
        if (depth > 0 && parentGroup && groupIndex !== undefined) {
            new ButtonComponent(groupHeader)
                .setIcon('trash-2')
                .setClass('filter-bar__delete-button')
                .setTooltip('Delete filter group')
                .onClick(() => {
                    this.removeFilterGroup(parentGroup, groupIndex);
                });
        }

        // Render children
        const childrenContainer = groupContainer.createDiv('filter-bar__children');
        group.children.forEach((child, index) => {
            this.renderFilterNode(childrenContainer, child, group, index, depth + 1);
        });

        // Action buttons
        const actionsContainer = groupContainer.createDiv('filter-bar__group-actions');

        new ButtonComponent(actionsContainer)
            .setIcon('plus')
            .setButtonText('Add filter')
            .setClass('filter-bar__action-button')
            .setClass('filter-bar__add-filter')
            .setTooltip('Add a new filter condition')
            .onClick(() => {
                this.addFilterCondition(group);
            });

        new ButtonComponent(actionsContainer)
            .setIcon('plus-circle')
            .setButtonText('Add filter group')
            .setClass('filter-bar__action-button')
            .setClass('filter-bar__add-group')
            .setTooltip('Add a nested filter group')
            .onClick(() => {
                this.addFilterGroup(group);
            });
    }

    /**
     * Render a filter node (condition or group)
     */
    private renderFilterNode(parent: HTMLElement, node: FilterNode, parentGroup: FilterGroup, index: number, depth: number): void {
        if (node.type === 'condition') {
            this.renderFilterCondition(parent, node, parentGroup, index, depth);
        } else if (node.type === 'group') {
            this.renderFilterGroup(parent, node, depth, parentGroup, index);
        }
    }

    /**
     * Render a filter condition
     */
    private renderFilterCondition(parent: HTMLElement, condition: FilterCondition, parentGroup: FilterGroup, index: number, depth: number): void {
        const conditionContainer = parent.createDiv('filter-bar__condition');

        // Prefix (where/and/or)
        conditionContainer.createSpan({
            text: index === 0 ? this.plugin.i18n.translate('ui.filterBar.where') : parentGroup.conjunction,
            cls: 'filter-bar__condition-prefix'
        });

        // Property dropdown
        const propertyOptions = Object.fromEntries([
            ['', 'Select...'], // Placeholder option
            ...FILTER_PROPERTIES.map(p => [p.id, p.label]),
            ...(this.filterOptions.userProperties?.map(p => [p.id, p.label]) || [])
        ] as [string, string][]);
        const propertyDropdown = new DropdownComponent(conditionContainer)
            .addOptions(propertyOptions)
            .setValue(condition.property);
        setTooltip(propertyDropdown.selectEl, 'Choose which task property to filter by', { placement: 'top' });
        propertyDropdown.onChange((newPropertyId: FilterProperty) => {
                condition.property = newPropertyId;

                // Handle placeholder selection
                if (newPropertyId === '') {
                    // Keep current operator and value when "Select..." is chosen
                    // The condition will be incomplete and won't trigger filtering
                } else {
                    const propertyDef = FILTER_PROPERTIES.find(p => p.id === newPropertyId);
                    if (propertyDef && propertyDef.supportedOperators.length > 0) {
                        const newOperator = propertyDef.supportedOperators[0];
                        condition.operator = newOperator;

                        const operatorDef = FILTER_OPERATORS.find(op => op.id === newOperator);
                        condition.value = operatorDef?.requiresValue ? '' : null;
                    }
                }

                this.updateUI();
                this.emitQueryChange();
            });

        // Operator dropdown
        const operatorDropdown = new DropdownComponent(conditionContainer);
        this.updateOperatorOptions(operatorDropdown, condition.property as FilterProperty);
        operatorDropdown.setValue(condition.operator);
        setTooltip(operatorDropdown.selectEl, 'Choose how to compare the property value', { placement: 'top' });
        operatorDropdown.onChange((newOperator: FilterOperator) => {
            condition.operator = newOperator;
            this.updateUI(); // Re-render to show/hide value input
            this.emitQueryChange();
        });

        // Value input
        const valueContainer = conditionContainer.createDiv('filter-bar__value-container');
        this.renderValueInput(valueContainer, condition);

        // Delete button
        new ButtonComponent(conditionContainer)
            .setIcon('trash-2')
            .setClass('filter-bar__delete-button')
            .setTooltip('Delete condition')
            .onClick(() => {
                this.removeFilterCondition(parentGroup, index);
            });
    }

    /**
     * Update operator options based on selected property
     */
    private updateOperatorOptions(dropdown: DropdownComponent, property: FilterProperty): void {
        dropdown.selectEl.empty();

        const propertyDef = FILTER_PROPERTIES.find(p => p.id === property) || this.filterOptions.userProperties?.find(p => p.id === property);
        if (!propertyDef) return;

        propertyDef.supportedOperators.forEach(operatorId => {
            const operatorDef = FILTER_OPERATORS.find(op => op.id === operatorId);
            if (operatorDef) {
                dropdown.addOption(operatorDef.id, operatorDef.label);
            }
        });
    }

    /**
     * Render value input based on property and operator
     */
    private renderValueInput(container: HTMLElement, condition: FilterCondition): void {
        container.empty();

        const propertyDef = FILTER_PROPERTIES.find(p => p.id === condition.property) || this.filterOptions.userProperties?.find(p => p.id === condition.property);
        const operatorDef = FILTER_OPERATORS.find(op => op.id === condition.operator);

        if (!propertyDef || !operatorDef || !operatorDef.requiresValue) {
            return; // No value input needed
        }

        switch (propertyDef.valueInputType) {
            case 'text':
                this.renderTextInput(container, condition);
                break;
            case 'select':
                this.renderSelectInput(container, condition, propertyDef);
                break;
            case 'date':
                this.renderDateInput(container, condition);
                break;
            case 'number':
                this.renderNumberInput(container, condition);
                break;
        }
    }

    /**
     * Render text input
     */
    private renderTextInput(container: HTMLElement, condition: FilterCondition): void {
        const textInput = new TextComponent(container)
            .setValue(String(condition.value || ''))
            .onChange((value) => {
                condition.value = value || null;
                this.debouncedEmitQueryChange();
            });
        setTooltip(textInput.inputEl, 'Enter the value to filter by', { placement: 'top' });
    }

    /**
     * Render multi-select input
     */
    private renderSelectInput(container: HTMLElement, condition: FilterCondition, propertyDef: PropertyDefinition): void {
        const dropdown = new DropdownComponent(container)
            .addOption('', 'Select...');

        switch (propertyDef.id) {
            case 'status':
                this.filterOptions.statuses.forEach(statusConfig => {
                    dropdown.addOption(statusConfig.value, statusConfig.label);
                });
                break;
            case 'priority':
                this.filterOptions.priorities.forEach(priorityConfig => {
                    dropdown.addOption(priorityConfig.value, priorityConfig.label);
                });
                break;
            case 'tags':
                this.filterOptions.tags.forEach(option => {
                    dropdown.addOption(option, option);
                });
                break;
            case 'contexts':
                this.filterOptions.contexts.forEach(option => {
                    dropdown.addOption(option, option);
                });
                break;
            case 'projects':
                this.filterOptions.projects.forEach(option => {
                    dropdown.addOption(option, option);
                });
                break;
            case 'path':
                this.filterOptions.folders.forEach(option => {
                    dropdown.addOption(option, option);
                });
                break;
        }

        setTooltip(dropdown.selectEl, `Select a ${propertyDef.label.toLowerCase()} to filter by`, { placement: 'top' });

        // Handle project link syntax for setting the initial value
        if (propertyDef.id === 'projects') {
            const currentValue = String(condition.value || '');
            if (currentValue.startsWith('[[') && currentValue.endsWith(']]')) {
                const cleanValue = currentValue.substring(2, currentValue.length - 2);
                dropdown.setValue(cleanValue);
            } else {
                dropdown.setValue(currentValue);
            }
        } else if (propertyDef.id === 'path') {
            const currentValue = String(condition.value || '');
            // Show "(Root)" for empty string path
            dropdown.setValue(currentValue === '' ? '(Root)' : currentValue);
        } else {
            dropdown.setValue(String(condition.value || ''));
        }

        dropdown.onChange((value) => {
            if (propertyDef.id === 'projects' && value) {
                condition.value = `[[${value}]]`;
            } else if (propertyDef.id === 'path' && value === '(Root)') {
                condition.value = '';
            } else {
                condition.value = value || null;
            }
            this.emitQueryChange();
        });
    }

    /**
     * Render enhanced date input with natural language support
     */
    private renderDateInput(container: HTMLElement, condition: FilterCondition): void {
        const dateContainer = container.createDiv('filter-date-input-container');

        // Main text input for both natural language and date entry
        const textInput = new TextComponent(dateContainer)
            .setValue(String(condition.value || ''))
            .onChange((value) => {
                condition.value = value || null;
                this.updateDateInputValidation(textInput, value);

                // Only emit query change if input is valid or empty
                const trimmedValue = (value || '').trim();
                if (trimmedValue === '' || isValidDateInput(trimmedValue)) {
                    // FIX: Use the debounced version for performance
                    this.debouncedEmitQueryChange();
                }
            });

        // Set placeholder to guide users
        textInput.setPlaceholder('today, 2024-12-25, next week...');
        textInput.inputEl.addClass('filter-date-text-input');
        setTooltip(textInput.inputEl, 'Enter a date using natural language or ISO format', { placement: 'top' });

        // Set initial validation state
        this.updateDateInputValidation(textInput, String(condition.value || ''));

        // Date picker icon button
        const pickerButton = dateContainer.createEl('button', { cls: 'filter-date-picker-button' });
        setTooltip(pickerButton, 'Pick date & time', { placement: 'top' });
        setIcon(pickerButton, 'calendar');
        pickerButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const menu = new DateContextMenu({
                currentValue: String(condition.value || undefined),
                onSelect: (value: string | null) => {
                    textInput.setValue(value || '');
                    condition.value = value || null;
                    this.updateDateInputValidation(textInput, textInput.getValue());
                    this.debouncedEmitQueryChange();
                }
            });
            menu.showAtElement(pickerButton);
        });

        // Add a small help button showing natural language examples
        const helpButton = dateContainer.createEl('button', {
            cls: 'filter-date-help-button',
            text: '?'
        });
        setTooltip(helpButton, 'Show natural language date examples', { placement: 'top' });

        helpButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showNaturalLanguageDateHelp(helpButton);
        });
    }

    /**
     * Update date input validation styling based on the current value
     */
    private updateDateInputValidation(textInput: TextComponent, value: string): void {
        const inputEl = textInput.inputEl;

        // Remove all validation classes
        inputEl.removeClass('is-valid', 'is-invalid', 'is-empty');

        const trimmedValue = value.trim();

        if (trimmedValue === '') {
            inputEl.addClass('is-empty');
        } else if (isValidDateInput(trimmedValue)) {
            inputEl.addClass('is-valid');
        } else {
            inputEl.addClass('is-invalid');
        }
    }

    /**
     * Show natural language date help tooltip
     */
    private showNaturalLanguageDateHelp(button: HTMLElement): void {
        // Remove existing tooltip
        document.querySelectorAll('.filter-date-help-tooltip').forEach(el => el.remove());

        const tooltip = document.body.createDiv('filter-date-help-tooltip');
        // const suggestions = getNaturalLanguageDateSuggestions(); // Not currently used in tooltip

        tooltip.createEl('h4', { text: 'Natural Language Dates' });
        const examplesList = tooltip.createEl('ul');

        // Show the actual available patterns from our simplified implementation
        const availablePatterns = [
            'today', 'tomorrow', 'yesterday',
            'next week', 'last week',
            'in 3 days', '2 days ago',
            'in 1 week', '2 weeks ago',
            '2024-12-25', '2024-12-25T14:30:00'
        ];

        availablePatterns.forEach(example => {
            examplesList.createEl('li', { text: example });
        });

        // Position tooltip near the button
        const buttonRect = button.getBoundingClientRect();
        tooltip.style.position = 'absolute';
        tooltip.style.top = `${buttonRect.bottom + 5}px`;
        tooltip.style.left = `${buttonRect.left}px`;
        tooltip.style.zIndex = '1000';

        // Remove tooltip when clicking elsewhere
        const removeTooltip = () => {
            tooltip.remove();
            document.removeEventListener('click', removeTooltip);
        };

        // Add delay to prevent immediate removal
        setTimeout(() => {
            document.addEventListener('click', removeTooltip);
        }, 100);
    }

    /**
     * Render number input
     */
    private renderNumberInput(container: HTMLElement, condition: FilterCondition): void {
        const textInput = new TextComponent(container)
            .setValue(String(condition.value || ''))
            .onChange((value) => {
                condition.value = value ? parseFloat(value) : null;
                this.debouncedEmitQueryChange();
            });
        textInput.inputEl.type = 'number';
        setTooltip(textInput.inputEl, 'Enter a numeric value to filter by', { placement: 'top' });
    }

    /**
     * Render display & organization section
     */
    private renderDisplaySection(container: HTMLElement): void {
        const section = container.createDiv('filter-bar__section');

        // Collapsible header
        const header = section.createDiv('filter-bar__section-header');

        const titleWrapper = header.createDiv('filter-bar__section-header-main');
        titleWrapper.createSpan({
            text: 'Display & Organization',
            cls: 'filter-bar__section-title'
        });
        setTooltip(titleWrapper, 'Click to expand/collapse sorting and grouping options', { placement: 'top' });


        // Content
        const content = section.createDiv('filter-bar__section-content');
        if (!this.sectionStates.display) {
            content.addClass('filter-bar__section-content--collapsed');
        }

        this.displaySection = content;
        const controls = this.displaySection.createDiv('filter-bar__display-controls');

        // Sort control
        const sortContainer = controls.createDiv('filter-bar__sort-container');
        sortContainer.createSpan({ text: 'Sort by:', cls: 'filter-bar__label' });

        new ButtonComponent(sortContainer)
            .setClass('filter-bar__sort-direction')
            .setTooltip('Toggle sort direction')
            .onClick(() => {
                this.currentQuery.sortDirection = this.currentQuery.sortDirection === 'asc' ? 'desc' : 'asc';
                this.emitImmediateQueryChange();
            });

        // Build sort dropdown options, including dynamic user fields
        const builtInSortOptions: Record<string, string> = {
            'due': this.translate('ui.filterBar.sortOptions.dueDate'),
            'scheduled': this.translate('ui.filterBar.sortOptions.scheduledDate'),
            'priority': this.translate('ui.filterBar.sortOptions.priority'),
            'title': this.translate('ui.filterBar.sortOptions.title'),
            'dateCreated': this.translate('ui.filterBar.sortOptions.createdDate'),
            'tags': this.translate('ui.filterBar.sortOptions.tags')
        };
        const sortOptions: Record<string, string> = { ...builtInSortOptions };
        const sortUserProps = this.filterOptions.userProperties || [];
        for (const p of sortUserProps) {
            if (!p?.id || !p?.label) continue;
            if (typeof p.id === 'string' && p.id.startsWith('user:')) {
                sortOptions[p.id] = `${p.label}`;
            }
        }

        const sortDropdown = new DropdownComponent(sortContainer)
            .addOptions(sortOptions)
            .setValue(this.currentQuery.sortKey || 'due')
            .onChange((value: TaskSortKey) => {
                this.currentQuery.sortKey = value;
                this.emitImmediateQueryChange();
            });
        setTooltip(sortDropdown.selectEl, 'Choose how to sort tasks', { placement: 'top' });

        // Group control
        const groupContainer = controls.createDiv('filter-bar__group-container');
        groupContainer.createSpan({ text: 'Group by:', cls: 'filter-bar__label' });

        // Build group dropdown options, including dynamic user fields
        const builtInGroupOptions: Record<string, string> = {
            'none': 'None',
            'status': 'Status',
            'priority': 'Priority',
            'context': 'Context',
            'project': 'Project',
            'due': 'Due Date',
            'scheduled': 'Scheduled Date',
            'tags': 'Tags'
        };

        const options: Record<string, string> = { ...builtInGroupOptions };
        const userProps = this.filterOptions.userProperties || [];
        for (const p of userProps) {
            if (!p?.id || !p?.label) continue;
            // Only add if it is a user property id pattern
            if (typeof p.id === 'string' && p.id.startsWith('user:')) {
                options[p.id] = p.label;
            }
        }

        const groupDropdown = new DropdownComponent(groupContainer)
            .addOptions(options)
            .setValue(this.currentQuery.groupKey || 'none')
            .onChange((value: TaskGroupKey) => {
                this.currentQuery.groupKey = value;
                // Update expand/collapse buttons visibility immediately
                this.updateExpandCollapseButtons();
                // Update only display section and badge to avoid destroying DOM (keeps toggle element stable for tests)
                this.updateDisplaySection();
                this.updateFilterToggleBadge();
                this.emitImmediateQueryChange();
            });
        setTooltip(groupDropdown.selectEl, 'Group tasks by a common property', { placement: 'top' });

        // Add click handler for toggle
        titleWrapper.addEventListener('click', () => {
            this.toggleSection('display', header, content);
        });
    }

    /**
     * Remove a filter group from its parent
     */
    private removeFilterGroup(parentGroup: FilterGroup, index: number): void {
        parentGroup.children.splice(index, 1);
        this.ignoreNextClickOutside();
        // FIX: Re-render the UI completely before emitting the change.
        this.updateFilterBuilderComplete();
        this.emitQueryChange();
    }

    /**
     * Render view-specific options
     */
    private renderViewOptions(container: HTMLElement): void {
        const section = container.createDiv('filter-bar__section');
        this.viewOptionsContainer = section.createDiv('filter-bar__view-options-container');

        // Initial population of view options
        this.populateViewOptions();
    }

    /**
     * Set view-specific options (called by view components)
     */
    setViewOptions(options: Array<{id: string, label: string, value: boolean, onChange: (value: boolean) => void}>): void {
        this.viewOptionsConfig = options;
        this.populateViewOptions();
    }

    /**
     * Populate the view options container with the stored config
     */
    private populateViewOptions(): void {
        if (!this.viewOptionsContainer) return;

        this.viewOptionsContainer.empty();
        const options = this.viewOptionsConfig;

        if (!options || options.length === 0) {
            this.viewOptionsContainer.addClass('filter-bar__section--hidden');
            return;
        }

        this.viewOptionsContainer.removeClass('filter-bar__section--hidden');

        const header = this.viewOptionsContainer.createDiv('filter-bar__section-header');
        const titleWrapper = header.createDiv('filter-bar__section-header-main');
        titleWrapper.createSpan({
            text: 'View Options',
            cls: 'filter-bar__section-title'
        });
        setTooltip(titleWrapper, 'Click to expand/collapse view-specific options', { placement: 'top' });

        const content = this.viewOptionsContainer.createDiv('filter-bar__section-content');
        if (!this.sectionStates.viewOptions) {
            content.addClass('filter-bar__section-content--collapsed');
        }

        options.forEach(option => {
            const optionContainer = content.createDiv('filter-bar__view-option');

            const label = optionContainer.createEl('label', {
                cls: 'filter-bar__view-option-label'
            });

            const checkbox = label.createEl('input', {
                type: 'checkbox',
                cls: 'filter-bar__view-option-checkbox'
            });
            checkbox.checked = option.value;
            setTooltip(checkbox, `Toggle ${option.label.toLowerCase()}`, { placement: 'top' });

            label.createSpan({
                text: option.label,
                cls: 'filter-bar__view-option-text'
            });

            checkbox.addEventListener('change', () => {
                option.onChange(checkbox.checked);
            });
        });

        titleWrapper.addEventListener('click', () => {
            this.toggleSection('viewOptions', header, content);
        });
    }

    /**
     * Add a new filter condition to a group
     */
    private addFilterCondition(group: FilterGroup): void {
        const condition: FilterCondition = {
            type: 'condition',
            id: FilterUtils.generateId(),
            property: '',
            operator: 'contains',
            value: ''
        };

        group.children.push(condition);
        this.ignoreNextClickOutside();
        this.updateFilterBuilderComplete();
        // Don't emit queryChange - new condition is incomplete until property is selected
    }

    /**
     * Add a new filter group to a group
     */
    private addFilterGroup(group: FilterGroup): void {
        const newGroup: FilterGroup = {
            type: 'group',
            id: FilterUtils.generateId(),
            conjunction: 'and',
            children: []
        };

        group.children.push(newGroup);
        this.ignoreNextClickOutside();
        this.updateFilterBuilderComplete();
        // Don't emit queryChange - new group is empty and won't affect filtering
    }

    /**
     * Remove a filter condition from a group
     */
    private removeFilterCondition(group: FilterGroup, index: number): void {
        group.children.splice(index, 1);
        this.ignoreNextClickOutside();
        // FIX: Re-render the UI completely before emitting the change.
        this.updateFilterBuilderComplete();
        this.emitQueryChange();
    }


    /**
     * Update view selector button state based on active saved view
     */
    private updateViewSelectorButtonState(): void {
        if (!this.viewSelectorButton?.buttonEl) return;

        // Add/remove active state class
        if (this.activeSavedView) {
            this.viewSelectorButton.buttonEl.classList.add('filter-bar__templates-button--saved-view-active');
        } else {
            this.viewSelectorButton.buttonEl.classList.remove('filter-bar__templates-button--saved-view-active');
        }
    }

    /**
     * Toggle view selector dropdown
     */
    private toggleViewSelectorDropdown(): void {
        if (!this.viewSelectorDropdown || !this.viewSelectorButton) return;

        const isHidden = this.viewSelectorDropdown.classList.contains('filter-bar__view-selector-dropdown--hidden');
        this.viewSelectorDropdown.classList.toggle('filter-bar__view-selector-dropdown--hidden', !isHidden);

        // Toggle active state on the button
        if (isHidden) {
            // Opening dropdown - add active class
            this.viewSelectorButton.buttonEl.classList.add('filter-bar__templates-button--active');
        } else {
            // Closing dropdown - remove active class
            this.viewSelectorButton.buttonEl.classList.remove('filter-bar__templates-button--active');
        }
    }

    /**
     * Show sort and group context menu
     */
    private showSortGroupContextMenu(event: MouseEvent): void {
        try {
            const menu = new Menu();

            // Build sort options
            const builtInSortOptions: Record<string, string> = {
                'due': this.translate('ui.filterBar.sortOptions.dueDate'),
                'scheduled': this.translate('ui.filterBar.sortOptions.scheduledDate'),
                'priority': this.translate('ui.filterBar.sortOptions.priority'),
                'title': this.translate('ui.filterBar.sortOptions.title'),
                'dateCreated': this.translate('ui.filterBar.sortOptions.createdDate'),
                'tags': this.translate('ui.filterBar.sortOptions.tags')
            };
            const sortOptions: Record<string, string> = { ...builtInSortOptions };
            const sortUserProps = this.filterOptions.userProperties || [];
            for (const p of sortUserProps) {
                if (!p?.id || !p?.label) continue;
                if (typeof p.id === 'string' && p.id.startsWith('user:')) {
                    sortOptions[p.id] = `${p.label}`;
                }
            }

            // Sort section
            menu.addItem(item => {
                item.setTitle('SORT');
                item.setDisabled(true);
            });

            Object.entries(sortOptions).forEach(([key, label]) => {
                menu.addItem(item => {
                    item.setTitle(label);
                    if (this.currentQuery.sortKey === key) {
                        item.setIcon('check');
                    }
                    item.onClick(() => {
                        this.currentQuery.sortKey = key as any;
                        this.emitImmediateQueryChange();
                        this.updateDisplaySection();
                    });
                });
            });

            // Order section
            menu.addSeparator();
            menu.addItem(item => {
                item.setTitle('ORDER');
                item.setDisabled(true);
            });

            menu.addItem(item => {
                item.setTitle('Ascending');
                if (this.currentQuery.sortDirection === 'asc') {
                    item.setIcon('check');
                }
                item.onClick(() => {
                    this.currentQuery.sortDirection = 'asc';
                    this.emitImmediateQueryChange();
                    this.updateDisplaySection();
                });
            });

            menu.addItem(item => {
                item.setTitle('Descending');
                if (this.currentQuery.sortDirection === 'desc') {
                    item.setIcon('check');
                }
                item.onClick(() => {
                    this.currentQuery.sortDirection = 'desc';
                    this.emitImmediateQueryChange();
                    this.updateDisplaySection();
                });
            });

            // Group section (hidden on agenda view)
            if (this.viewType !== 'agenda') {
                const builtInGroupOptions: Record<string, string> = {
                    'none': 'None',
                    'status': 'Status',
                    'priority': 'Priority',
                    'context': 'Context',
                    'project': 'Project',
                    'due': 'Due Date',
                    'scheduled': 'Scheduled Date',
                    'tags': 'Tags'
                };

                const groupOptions: Record<string, string> = { ...builtInGroupOptions };
                const userProps = this.filterOptions.userProperties || [];
                for (const p of userProps) {
                    if (!p?.id || !p?.label) continue;
                    if (typeof p.id === 'string' && p.id.startsWith('user:')) {
                        groupOptions[p.id] = p.label;
                    }
                }

                menu.addSeparator();
                menu.addItem(item => {
                    item.setTitle('GROUP');
                    item.setDisabled(true);
                });

                Object.entries(groupOptions).forEach(([key, label]) => {
                    menu.addItem(item => {
                        item.setTitle(label);
                        if (this.currentQuery.groupKey === key) {
                            item.setIcon('check');
                        }
                        item.onClick(() => {
                            this.currentQuery.groupKey = key as any;
                            // Reset subgroup when primary group changes (backward-compatible default)
                            (this.currentQuery as any).subgroupKey = 'none' as any;
                            this.updateExpandCollapseButtons();
                            this.updateDisplaySection();
                            this.updateFilterToggleBadge();
                            this.emitImmediateQueryChange();

                        });
                    });
                });
            }


            // SUBGROUP section (always available; Agenda hides GROUP but still shows SUBGROUP)
            SubgroupMenuBuilder.addToMenu(
                menu,
                this.currentQuery as any,
                this.filterOptions,
                (key) => {
                    (this.currentQuery as any).subgroupKey = key as any;
                    this.emitImmediateQueryChange();
                    this.updateDisplaySection();
                }
            );

            // Show menu at mouse position
            menu.showAtMouseEvent(event);

        } catch (error) {
            console.error('FilterBar: Error showing sort/group context menu:', error);
        }
    }

    /**
     * Create a new task
     */

    private createNewTask(): void {
        try {
            // Use the plugin's existing task creation functionality
            if (this.plugin && typeof this.plugin.openTaskCreationModal === 'function') {
                this.plugin.openTaskCreationModal();
            } else if (this.plugin && typeof this.plugin.createTask === 'function') {
                this.plugin.createTask();
            } else {
                // Fallback: emit an event that views can listen for
                this.emit('createNewTask');
            }
        } catch (error) {
            console.error('FilterBar: Error creating new task:', error);
        }
    }

    /**
     * Show properties visibility dropdown with simplified error handling
     */
    private showPropertiesDropdown(event: MouseEvent): void {
        try {
            const dropdown = new PropertyVisibilityDropdown(
                this.getCurrentVisibleProperties(),
                this.plugin,
                this.handlePropertiesUpdate.bind(this)
            );
            dropdown.show(event);
        } catch (error) {
            console.error('FilterBar: Error showing properties dropdown:', error);
            // Show user-friendly error message
            this.plugin.app.workspace.trigger('notice', 'Failed to show properties menu');
        }
    }

    /**
     * Handle properties update with validation
     */
    private handlePropertiesUpdate(properties: string[]): void {
        if (!Array.isArray(properties)) {
            console.warn('FilterBar: Invalid properties array received:', properties);
            return;
        }

        this.temporaryVisibleProperties = properties;
        this.emit('propertiesChanged', properties);
    }

    /**
     * Get current effective visible properties with fallback chain
     */
    public getCurrentVisibleProperties(): string[] {
        return this.temporaryVisibleProperties ||
               this.activeSavedView?.visibleProperties ||
               this.plugin.settings.defaultVisibleProperties ||
               this.getDefaultFallbackProperties();
    }

    /**
     * Get default fallback properties when no configuration exists
     */
    private getDefaultFallbackProperties(): string[] {
        return ['status', 'priority', 'due', 'scheduled', 'projects', 'contexts', 'tags'];
    }

    /**
     * Get the currently active saved view (for external use)
     */
    public getCurrentSavedView(): SavedView | null {
        return this.activeSavedView;
    }

    /**
     * Set the active saved view (for external use, e.g., after saving a view)
     */
    public setActiveSavedView(view: SavedView | null): void {
        this.isSettingSavedView = true;
        this.activeSavedView = view;

        // Clear temporary properties when setting a saved view as active
        if (view && this.temporaryVisibleProperties && view.visibleProperties) {
            const tempPropsSet = new Set(this.temporaryVisibleProperties);
            const savedPropsSet = new Set(view.visibleProperties);

            // Check if the sets are equal (same properties)
            if (tempPropsSet.size === savedPropsSet.size &&
                [...tempPropsSet].every(prop => savedPropsSet.has(prop))) {
                this.temporaryVisibleProperties = null;
            }
        }

        this.updateViewSelectorButtonState();
        this.emit('activeSavedViewChanged', view);
        this.isSettingSavedView = false;
    }

    /**
     * Toggle a collapsible section
     */
    private toggleSection(sectionKey: 'filterBox' | 'filters' | 'display' | 'viewOptions', header: HTMLElement, content: HTMLElement): void {
        this.sectionStates[sectionKey] = !this.sectionStates[sectionKey];
        const isExpanded = this.sectionStates[sectionKey];

        header.classList.toggle('filter-bar__section-header--collapsed', !isExpanded);
        content.classList.toggle('filter-bar__section-content--collapsed', !isExpanded);
    }

    /**
     * Show save view dialog
     */
    private showSaveViewDialog(): void {
        new SaveViewModal(this.app, (name) => {
            const currentViewOptions = this.getCurrentViewOptions();
            const currentProperties = this.getCurrentVisibleProperties();
            this.emit('saveView', {
                name,
                query: this.currentQuery,
                viewOptions: currentViewOptions,
                visibleProperties: currentProperties
            });
            this.toggleViewSelectorDropdown();
        }, this.plugin.i18n.translate).open();
    }

    /**
     * Get current view options as a simple object
     */
    private getCurrentViewOptions(): {[key: string]: boolean} | undefined {
        if (!this.viewOptionsConfig || this.viewOptionsConfig.length === 0) {
            return undefined;
        }

        const options: {[key: string]: boolean} = {};
        this.viewOptionsConfig.forEach(option => {
            options[option.id] = option.value;
        });
        return options;
    }


    /**
     * Clear all filters and reset to default state
     */
    private clearAllFilters(): void {
        // Create a fresh default query with preserved sort/group settings
        this.currentQuery = {
            type: 'group',
            id: FilterUtils.generateId(),
            conjunction: 'and',
            children: [],
            sortKey: this.currentQuery.sortKey || 'due',
            sortDirection: this.currentQuery.sortDirection || 'asc',
            groupKey: 'none'
        };

        // Clear the active saved view
        this.activeSavedView = null;

        // Clear temporary properties
        this.temporaryVisibleProperties = null;

        // Clear the search input
        if (this.searchInput) {
            this.searchInput.setValue('');
        }

        // Update only the filter builder to avoid collapsing the filter box
        this.updateFilterBuilder();
        this.updateDisplaySection();
        this.updateViewSelectorButtonState();
        this.emitQueryChange();

        // Close the dropdown if it's open (do not toggle open on clear)
        if (this.viewSelectorDropdown && !this.viewSelectorDropdown.classList.contains('filter-bar__view-selector-dropdown--hidden')) {
            this.viewSelectorDropdown.classList.add('filter-bar__view-selector-dropdown--hidden');
            if (this.viewSelectorButton?.buttonEl) {
                this.viewSelectorButton.buttonEl.classList.remove('filter-bar__templates-button--active');
            }
        }
    }

    /**
     * Clear all filters but keep the modal open (for Clear button in modal)
     */
    private clearAllFiltersKeepModalOpen(): void {
        // Create a fresh default query with preserved sort/group settings
        this.currentQuery = {
            type: 'group',
            id: FilterUtils.generateId(),
            conjunction: 'and',
            children: [],
            sortKey: this.currentQuery.sortKey || 'due',
            sortDirection: this.currentQuery.sortDirection || 'asc',
            groupKey: 'none'
        };

        // Clear the active saved view
        this.activeSavedView = null;

        // Clear temporary properties
        this.temporaryVisibleProperties = null;

        // Clear the search input
        if (this.searchInput) {
            this.searchInput.setValue('');
        }

        // Update only the filter builder to avoid collapsing the filter box
        this.updateFilterBuilder();
        this.updateDisplaySection();
        this.updateViewSelectorButtonState();

        // Don't emit query change immediately to prevent modal closure
        // Instead, just update the badge and emit after a delay
        this.updateFilterToggleBadge();
        setTimeout(() => {
            this.emitQueryChangeIfComplete();
        }, 100);

        // Close the dropdown if it's open (do not toggle open on clear)
        if (this.viewSelectorDropdown && !this.viewSelectorDropdown.classList.contains('filter-bar__view-selector-dropdown--hidden')) {
            this.viewSelectorDropdown.classList.add('filter-bar__view-selector-dropdown--hidden');
            if (this.viewSelectorButton?.buttonEl) {
                this.viewSelectorButton.buttonEl.classList.remove('filter-bar__templates-button--active');
            }
        }
    }

    /**
     * Close the filter modal
     */
    private closeFilterModal(): void {
        this.sectionStates.filterBox = false;
        this.updateFilterBoxState();
    }

    /**
     * Load a saved view
     */
    private loadSavedView(view: SavedView): void {
        this.isLoadingSavedView = true;
        this.currentQuery = FilterUtils.deepCloneFilterQuery(view.query);
        this.activeSavedView = view;

        // Clear temporary properties when loading a saved view
        this.temporaryVisibleProperties = null;

        this.render();
        this.emitQueryChange();

        // Emit viewOptions event if they exist
        if (view.viewOptions) {
            this.emit('loadViewOptions', view.viewOptions);
        }

        // Emit properties change if the saved view has visible properties
        if (view.visibleProperties) {
            this.emit('propertiesChanged', view.visibleProperties);
        }

        // Emit activeSavedViewChanged event
        this.emit('activeSavedViewChanged', view);

        this.toggleViewSelectorDropdown();
        this.updateViewSelectorButtonState();
        this.isLoadingSavedView = false;
    }

    /**
     * Update UI to reflect current query state
     */
    private updateUI(): void {
        // Sync search input with current query
        this.syncSearchInput();

        // Re-render everything to ensure consistency
        this.render();

        // Update button state after render
        this.updateViewSelectorButtonState();
        this.updateFilterToggleBadge();
    }

    /**
     * Update only the display section (sort/group controls)
     */
    private updateDisplaySection(): void {
        try {
            // Note: With context menu approach, we don't need to update UI elements
            // as the context menu is rebuilt each time it's shown.
            // Just update expand/collapse buttons visibility which is still relevant.

            // Update expand/collapse buttons visibility
            this.updateExpandCollapseButtons();
        } catch (error) {
            console.error('Error updating display section:', error);
        }
    }

    /**
     * Update expand/collapse buttons visibility based on current grouping state
     */
    private updateExpandCollapseButtons(): void {
        try {
            const isGrouped = (this.currentQuery.groupKey || 'none') !== 'none';
            const shouldShow = this.enableGroupExpandCollapse && (isGrouped || this.forceShowExpandCollapse);

            // Find existing expand/collapse buttons
            const expandBtn = this.container.querySelector('.filter-bar__expand-groups') as HTMLElement;
            const collapseBtn = this.container.querySelector('.filter-bar__collapse-groups') as HTMLElement;

            if (expandBtn) {
                expandBtn.style.display = shouldShow ? '' : 'none';
            }
            if (collapseBtn) {
                collapseBtn.style.display = shouldShow ? '' : 'none';
            }
        } catch (error) {
            console.error('Error updating expand/collapse buttons:', error);
        }
    }

    /**
     * Update only the filter builder section without re-rendering search input
     */
    private updateFilterBuilder(): void {
        try {
            if (this.filterBuilder && this.filterBuilder.isConnected) {
                // Store current search input value and focus state
                const currentValue = this.searchInput?.getValue();
                const hasFocus = this.searchInput?.inputEl === document.activeElement;

                this.filterBuilder.empty();
                this.renderFilterGroup(this.filterBuilder, this.currentQuery, 0);

                // Restore search input value and focus if needed
                if (this.searchInput && currentValue !== undefined) {
                    this.searchInput.setValue(currentValue);
                    if (hasFocus) {
                        this.searchInput.inputEl.focus();
                    }
                }

                // Maintain filter button active state
                this.updateFilterBoxState();
            }
        } catch (error) {
            console.error('Error updating filter builder:', error);
            // Don't re-throw to prevent cascading failures
        }
    }



    /**
     * Update filter builder ensuring all conjunction buttons and UI elements are properly rendered
     * This is more efficient than full render() but ensures all parts are updated correctly
     */
    private updateFilterBuilderComplete(): void {
        try {
            if (this.filterBuilder && this.filterBuilder.isConnected) {
                // Store current search input value and focus state
                const currentValue = this.searchInput?.getValue();
                const hasFocus = this.searchInput?.inputEl === document.activeElement;

                // Update the filter content
                this.filterBuilder.empty();
                this.renderFilterGroup(this.filterBuilder, this.currentQuery, 0);



                // Note: Display section doesn't need updating for filter changes

                // Restore search input value and focus if needed
                if (this.searchInput && currentValue !== undefined) {
                    this.searchInput.setValue(currentValue);
                    if (hasFocus) {
                        this.searchInput.inputEl.focus();
                    }
                }

                // Maintain filter button active state
                this.updateFilterBoxState();
            }
        } catch (error) {
            console.error('Error updating filter builder completely:', error);
            // Fallback to full render if partial update fails
            this.render();
        }
    }

    /**
     * Sync the search input with the current query state
     */
    private syncSearchInput(): void {
        if (!this.searchInput || this.isUserTyping) return;

        // Defensive check: ensure currentQuery has children array
        if (!this.currentQuery || !Array.isArray(this.currentQuery.children)) {
            this.searchInput.setValue('');
            return;
        }

        // Find search condition in current query
        const searchCondition = this.currentQuery.children.find(child =>
            child.type === 'condition' &&
            child.property === 'title' &&
            child.operator === 'contains' &&
            child.id.startsWith('search_')
        ) as FilterCondition | undefined;

        // Update search input value only if user is not actively typing
        this.searchInput.setValue(String(searchCondition?.value || ''));
    }

    /**
     * Emit query change event only if the query is complete and meaningful
     * This prevents expensive filter operations when users are still building filters
     */
    private emitQueryChange(): void {
        // Clear active saved view when user manually modifies filters (except during saved view loading)
        if (!this.isLoadingSavedView && this.activeSavedView) {
            this.clearActiveSavedView();
            // Re-render the filter section to remove the view name display
            this.updateFilterBuilder();
        }

        // Always emit for sort/group changes and structural operations
        // Also update the filter toggle badge instantly
        this.updateFilterToggleBadge();
        this.emitQueryChangeIfComplete();
    }

    /** Emit immediately regardless of filter completeness (for sort/group changes) */
    private emitImmediateQueryChange(): void {
        // Clear active saved view when user manually modifies filters (except during saved view loading)
        if (!this.isLoadingSavedView && this.activeSavedView) {
            this.clearActiveSavedView();
            this.updateFilterBuilder();
        }
        this.updateFilterToggleBadge();
        this.emit('queryChange', FilterUtils.deepCloneFilterQuery(this.currentQuery));
    }


    /**
     * Check if the current query is complete and meaningful, then emit if so
     */
    private emitQueryChangeIfComplete(): void {
        if (this.isQueryMeaningful(this.currentQuery)) {
            this.emit('queryChange', FilterUtils.deepCloneFilterQuery(this.currentQuery));
        }
    }

    /**
     * Check if a query is meaningful (has complete conditions or no conditions)
     * Incomplete conditions (missing required values) should not trigger filtering
     */
    private isQueryMeaningful(query: FilterGroup): boolean {
        // Empty query is meaningful (shows all tasks)
        if (query.children.length === 0) {
            return true;
        }

        // Check if query has at least one complete condition or group
        return this.hasCompleteConditions(query);
    }

    /**
     * Recursively check if a group has any complete conditions
     */
    private hasCompleteConditions(group: FilterGroup): boolean {
        for (const child of group.children) {
            if (child.type === 'condition') {
                // Check if this condition is complete using FilterUtils
                if (FilterUtils.isFilterNodeComplete(child)) {
                    return true;
                }
            } else if (child.type === 'group') {
                // Recursively check child groups
                if (this.hasCompleteConditions(child)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Update filter options (called when new properties/contexts/tags are added)
     */
    updateFilterOptions(newFilterOptions: FilterOptions): void {
        this.filterOptions = newFilterOptions;
        // Re-render the UI to pick up new options
        this.updateUI();
    }

    /** True if a saved view is active OR any complete filter condition exists */
    private hasActiveFilters(): boolean {
        try {
            if (this.activeSavedView) return true;
            // Active if any complete filter condition exists OR any grouping is applied
            const hasFilters = this.isQueryMeaningful(this.currentQuery) && this.currentQuery.children.length > 0;
            const hasGrouping = (this.currentQuery.groupKey ?? 'none') !== 'none';
            return hasFilters || !!hasGrouping;
        } catch {
            return false;
        }
    }

    /** Update filter toggle badge and tooltip */
    private updateFilterToggleBadge(): void {
        let el: HTMLElement | null = null;
        if (typeof this.container.querySelector === 'function') {
            el = this.container.querySelector('.filter-bar__filter-toggle') as HTMLElement | null;
        }
        if (!el) return;
        const active = this.hasActiveFilters();
        el.classList.toggle('has-active-filters', active);
        setTooltip(el, active ? 'Active filters – Click to modify, right-click to clear' : 'Toggle filter', { placement: 'top' });


    }

    /**
     * Get current filter options (for debugging)
     */
    getCurrentFilterOptions(): FilterOptions {
        return this.filterOptions;
    }

    /**
     * Force refresh filter options from the cache (for debugging)
     */
    async forceRefreshOptions(filterService: { getFilterOptions: () => Promise<FilterOptions>; }): Promise<void> {
        const newOptions = await filterService.getFilterOptions();
        this.updateFilterOptions(newOptions);
    }


    /**
     * Destroy and clean up the FilterBar
     */
    destroy(): void {
        try {
            if (this.container && this.container.isConnected) {
                this.container.empty();
            }
            this.removeAllListeners();

            // Clean up event listeners and timeout
            if (this.abortController) {
                this.abortController.abort();
                this.abortController = undefined;
            }

            if (this.ignoreClickTimeout) {
                window.clearTimeout(this.ignoreClickTimeout);
                this.ignoreClickTimeout = undefined;
            }
        } catch (error) {
            console.error('Error destroying FilterBar:', error);
            // Still try to clean up listeners even if DOM cleanup fails
            try {
                this.removeAllListeners();
                if (this.abortController) {
                    this.abortController.abort();
                    this.abortController = undefined;
                }

                if (this.ignoreClickTimeout) {
                    window.clearTimeout(this.ignoreClickTimeout);
                    this.ignoreClickTimeout = undefined;
                }
            } catch (cleanupError) {
                console.error('Error during FilterBar cleanup fallback:', cleanupError);
            }
        }
    }
}
