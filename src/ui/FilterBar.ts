import { App, ButtonComponent, debounce, DropdownComponent, Modal, TextComponent } from 'obsidian';
import { FilterCondition, FilterGroup, FilterNode, FilterOptions, FilterOperator, FilterProperty, FilterQuery, FILTER_OPERATORS, FILTER_PROPERTIES, PropertyDefinition, SavedView, TaskGroupKey, TaskSortKey } from '../types';
import { EventEmitter } from '../utils/EventEmitter';
import { FilterUtils } from '../utils/FilterUtils';
import { showConfirmationModal } from '../modals/ConfirmationModal';

class SaveViewModal extends Modal {
    private name: string;
    private onSubmit: (name: string) => void;

    constructor(app: App, onSubmit: (name: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Save view' });

        const textComponent = new TextComponent(contentEl)
            .setPlaceholder('Enter view name...')
            .onChange((value) => {
                this.name = value;
            });
        textComponent.inputEl.style.width = '100%';

        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
        new ButtonComponent(buttonContainer)
            .setButtonText('Save')
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
    private container: HTMLElement;
    private currentQuery: FilterQuery;
    private savedViews: readonly SavedView[] = [];
    private filterOptions: FilterOptions;

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
    private isUserTyping = false;
    private viewOptionsConfig: Array<{id: string, label: string, value: boolean, onChange: (value: boolean) => void}> | null = null;

    // Collapse states
    private sectionStates = {
        filterBox: false,   // Entire filter box - collapsed by default
        filters: true,      // This view section - expanded by default
        display: true,      // Display & Organization - expanded by default
        viewOptions: false  // View Options - collapsed by default
    };

    constructor(
        app: App,
        container: HTMLElement,
        initialQuery: FilterQuery,
        filterOptions: FilterOptions
    ) {
        super();
        this.app = app;
        this.container = container;
        this.currentQuery = { ...initialQuery };
        this.filterOptions = filterOptions;

        // Initialize debounced query change emission (300ms delay)
        this.debouncedEmitQueryChange = debounce(() => {
            this.emit('queryChange', { ...this.currentQuery });
        }, 300);

        // Initialize debounced search input handling (800ms delay to reduce lag)
        this.debouncedHandleSearchInput = debounce(() => {
            this.handleSearchInput();
        }, 800);

        this.render();
        this.updateUI();
    }

    /**
     * Update the current query and refresh UI
     */
    updateQuery(query: FilterQuery): void {
        this.currentQuery = { ...query };
        this.updateUI();
    }

    /**
     * Handle search input changes
     */
    private handleSearchInput(): void {
        try {
            const searchTerm = this.searchInput?.getValue().trim() || '';
            
            // Remove existing search conditions
            this.removeSearchConditions();
            
            // Add new search condition if term is not empty
            if (searchTerm) {
                this.addSearchCondition(searchTerm);
            }
            
            // Update only the filter builder to show the search condition
            this.updateFilterBuilder();
            
            // Emit query change 
            this.emit('queryChange', { ...this.currentQuery });
            
            // Reset typing flag after a delay
            setTimeout(() => {
                this.isUserTyping = false;
            }, 1000);
        } catch (error) {
            console.error('Error handling search input:', error);
        }
    }

    /**
     * Remove existing search conditions from the query
     */
    private removeSearchConditions(): void {
        this.currentQuery.children = this.currentQuery.children.filter(child => {
            if (child.type === 'condition') {
                return !(child.property === 'title' && child.operator === 'contains' && 
                        child.id.startsWith('search_'));
            }
            return true;
        });
    }

    /**
     * Add a search condition to the query
     */
    private addSearchCondition(searchTerm: string): void {
        const searchCondition: FilterCondition = {
            type: 'condition',
            id: `search_${FilterUtils.generateId()}`,
            property: 'title',
            operator: 'contains',
            value: searchTerm
        };
        
        // Add search condition at the beginning
        this.currentQuery.children.unshift(searchCondition);
    }

    /**
     * Update saved views list
     */
    updateSavedViews(views: readonly SavedView[]): void {
        this.savedViews = views;
        this.renderViewSelectorDropdown();
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
        try {
            this.container.empty();
            this.container.addClass('advanced-filter-bar');

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
                this.container.addClass('advanced-filter-bar');
                const errorDiv = this.container.createDiv({ cls: 'filter-bar-error' });
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

        // Filter toggle icon
        new ButtonComponent(topControls)
            .setIcon('list-filter')
            .setTooltip('Toggle filter')
            .setClass('filter-bar__filter-toggle')
            .onClick(() => {
                this.toggleMainFilterBox();
            });

        // Search input
        this.searchInput = new TextComponent(topControls)
            .setPlaceholder('Search tasks...');
        this.searchInput.inputEl.addClass('filter-bar__search-input');
        this.searchInput.onChange(() => {
            this.isUserTyping = true;
            this.debouncedHandleSearchInput();
        });

        // Templates button
        this.viewSelectorButton = new ButtonComponent(topControls)
            .setButtonText('Views')
            .setClass('filter-bar__templates-button')
            .onClick(() => {
                this.toggleViewSelectorDropdown();
            });

        // Main filter box (now rendered within top-controls for positioning)
        this.renderMainFilterBox(topControls);

        // Templates dropdown
        this.viewSelectorDropdown = topControls.createDiv({
            cls: 'filter-bar__view-selector-dropdown filter-bar__view-selector-dropdown--hidden',
        });

        // Populate the dropdown with saved views
        this.renderViewSelectorDropdown();
    }

    /**
     * Render the main filter box (collapsible)
     */
    private renderMainFilterBox(container: HTMLElement): void {
        const mainFilterBox = container.createDiv('filter-bar__main-box');
        if (!this.sectionStates.filterBox) {
            mainFilterBox.addClass('filter-bar__main-box--collapsed');
        }

        // 1. Filter Builder (This view section)
        this.renderFilterBuilder(mainFilterBox);

        // 2. Display & Organization
        this.renderDisplaySection(mainFilterBox);

        // 3. View-Specific Options
        this.renderViewOptions(mainFilterBox);
    }

    // Removed handleDocumentClick - filter box now stays open until button is clicked again

    /**
     * Toggle the main filter box (only closes/opens via button click)
     */
    private toggleMainFilterBox(): void {
        this.sectionStates.filterBox = !this.sectionStates.filterBox;
        const mainBox = this.container.querySelector('.filter-bar__main-box');
        const filterToggle = this.container.querySelector('.filter-bar__filter-toggle');
        
        if (mainBox) {
            mainBox.classList.toggle('filter-bar__main-box--collapsed', !this.sectionStates.filterBox);
        }
        
        if (filterToggle) {
            filterToggle.classList.toggle('filter-bar__filter-toggle--active', this.sectionStates.filterBox);
        }

        // No document click listener - filter stays open until button is clicked again
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
            savedViewsSection.createDiv({
                text: 'Saved views',
                cls: 'filter-bar__view-section-header'
            });

            this.savedViews.forEach(view => {
                const viewItemContainer = savedViewsSection.createDiv({
                    cls: 'filter-bar__view-item-container'
                });
                
                new ButtonComponent(viewItemContainer)
                    .setButtonText(view.name)
                    .setClass('filter-bar__view-item')
                    .onClick(() => {
                        this.loadSavedView(view);
                    });

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
            });
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

        const actionsWrapper = header.createDiv('filter-bar__section-header-actions');
        new ButtonComponent(actionsWrapper)
            .setIcon('save')
            .setTooltip('Save current filter as view')
            .setClass('filter-bar__save-button')
            .onClick(() => {
                this.showSaveViewDialog();
            });

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
        const groupContainer = parent.createDiv('filter-bar__group');
        
        // Group header with conjunction and delete button
        const groupHeader = groupContainer.createDiv('filter-bar__group-header');
        
        // Conjunction dropdown
        const conjunctionContainer = groupHeader.createDiv('filter-bar__conjunction');
        
        new DropdownComponent(conjunctionContainer)
            .addOption('and', depth === 0 ? 'All' : 'All')
            .addOption('or', depth === 0 ? 'Any' : 'Any')
            .setValue(group.conjunction)
            .onChange((value) => {
                group.conjunction = value as 'and' | 'or';
                this.updateUI();
                this.emitQueryChange();
            });

        conjunctionContainer.createSpan({
            text: 'of the following are true:',
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
            .onClick(() => {
                this.addFilterCondition(group);
            });

        new ButtonComponent(actionsContainer)
            .setIcon('plus-circle')
            .setButtonText('Add filter group')
            .setClass('filter-bar__action-button')
            .setClass('filter-bar__add-group')
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
            text: index === 0 ? 'where' : parentGroup.conjunction,
            cls: 'filter-bar__condition-prefix'
        });

        // Property dropdown
        new DropdownComponent(conditionContainer)
            .addOptions(Object.fromEntries(FILTER_PROPERTIES.map(p => [p.id, p.label])))
            .setValue(condition.property)
            .onChange((newPropertyId: FilterProperty) => {
                condition.property = newPropertyId;

                const propertyDef = FILTER_PROPERTIES.find(p => p.id === newPropertyId);
                if (propertyDef && propertyDef.supportedOperators.length > 0) {
                    const newOperator = propertyDef.supportedOperators[0];
                    condition.operator = newOperator;

                    const operatorDef = FILTER_OPERATORS.find(op => op.id === newOperator);
                    condition.value = operatorDef?.requiresValue ? '' : null;
                }
                
                this.updateUI();
                this.emitQueryChange();
            });

        // Operator dropdown
        const operatorDropdown = new DropdownComponent(conditionContainer);
        this.updateOperatorOptions(operatorDropdown, condition.property as FilterProperty);
        operatorDropdown.setValue(condition.operator);
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
        
        const propertyDef = FILTER_PROPERTIES.find(p => p.id === property);
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

        const propertyDef = FILTER_PROPERTIES.find(p => p.id === condition.property);
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
        new TextComponent(container)
            .setValue(String(condition.value || ''))
            .onChange((value) => {
                condition.value = value || null;
                this.debouncedEmitQueryChange();
            });
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
                this.filterOptions.contexts.forEach(option => {
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
        }

        // Handle project link syntax for setting the initial value
        if (propertyDef.id === 'projects') {
            const currentValue = String(condition.value || '');
            if (currentValue.startsWith('[[') && currentValue.endsWith(']]')) {
                const cleanValue = currentValue.substring(2, currentValue.length - 2);
                dropdown.setValue(cleanValue);
            } else {
                dropdown.setValue(currentValue);
            }
        } else {
            dropdown.setValue(String(condition.value || ''));
        }

        dropdown.onChange((value) => {
            if (propertyDef.id === 'projects' && value) {
                condition.value = `[[${value}]]`;
            } else {
                condition.value = value || null;
            }
            this.emitQueryChange();
        });
    }

    /**
     * Render date input
     */
    private renderDateInput(container: HTMLElement, condition: FilterCondition): void {
        const textInput = new TextComponent(container)
            .setValue(String(condition.value || ''))
            .onChange((value) => {
                condition.value = value || null;
                this.emitQueryChange();
            });
        textInput.inputEl.type = 'date';
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

        new DropdownComponent(sortContainer)
            .addOptions({
                'due': 'Due Date',
                'scheduled': 'Scheduled Date',
                'priority': 'Priority',
                'title': 'Title'
            })
            .setValue(this.currentQuery.sortKey || 'due')
            .onChange((value: TaskSortKey) => {
                this.currentQuery.sortKey = value;
                this.emitQueryChange();
            });

        new ButtonComponent(sortContainer)
            .setClass('filter-bar__sort-direction')
            .setTooltip('Toggle sort direction')
            .onClick(() => {
                this.currentQuery.sortDirection = this.currentQuery.sortDirection === 'asc' ? 'desc' : 'asc';
                this.updateSortDirectionButton();
                this.emitQueryChange();
            });

        // Group control
        const groupContainer = controls.createDiv('filter-bar__group-container');
        groupContainer.createSpan({ text: 'Group by:', cls: 'filter-bar__label' });

        new DropdownComponent(groupContainer)
            .addOptions({
                'none': 'None',
                'status': 'Status',
                'priority': 'Priority',
                'context': 'Context',
                'project': 'Project',
                'due': 'Due Date',
                'scheduled': 'Scheduled Date'
            })
            .setValue(this.currentQuery.groupKey || 'none')
            .onChange((value: TaskGroupKey) => {
                this.currentQuery.groupKey = value;
                this.emitQueryChange();
            });

        this.updateSortDirectionButton();

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
        this.updateUI();
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
            property: 'title',
            operator: 'contains',
            value: ''
        };
        
        group.children.push(condition);
        this.render();
        this.emitQueryChange();
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
        this.render();
        this.emitQueryChange();
    }

    /**
     * Remove a filter condition from a group
     */
    private removeFilterCondition(group: FilterGroup, index: number): void {
        group.children.splice(index, 1);
        this.render();
        this.emitQueryChange();
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
     * Toggle view selector dropdown
     */
    private toggleViewSelectorDropdown(): void {
        if (!this.viewSelectorDropdown) return;
        
        const isHidden = this.viewSelectorDropdown.classList.contains('filter-bar__view-selector-dropdown--hidden');
        this.viewSelectorDropdown.classList.toggle('filter-bar__view-selector-dropdown--hidden', !isHidden);
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
            this.emit('saveView', { name, query: this.currentQuery });
            this.toggleViewSelectorDropdown();
        }).open();
    }


    /**
     * Load a saved view
     */
    private loadSavedView(view: SavedView): void {
        this.currentQuery = { ...view.query };
        this.render();
        this.emitQueryChange();
        this.toggleViewSelectorDropdown();
    }

    /**
     * Update UI to reflect current query state
     */
    private updateUI(): void {
        // Sync search input with current query
        this.syncSearchInput();
        
        // Re-render everything to ensure consistency
        this.render();
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
            }
        } catch (error) {
            console.error('Error updating filter builder:', error);
            // Don't re-throw to prevent cascading failures
        }
    }

    /**
     * Sync the search input with the current query state
     */
    private syncSearchInput(): void {
        if (!this.searchInput || this.isUserTyping) return;
        
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
     * Emit query change event
     */
    private emitQueryChange(): void {
        this.emit('queryChange', { ...this.currentQuery });
    }

    /**
     * Update filter options (called when new properties/contexts/tags are added)
     */
    updateFilterOptions(newFilterOptions: FilterOptions): void {
        this.filterOptions = newFilterOptions;
        // Re-render the UI to pick up new options
        this.updateUI();
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
            // No document click listener to remove anymore
        } catch (error) {
            console.error('Error destroying FilterBar:', error);
            // Still try to clean up listeners even if DOM cleanup fails
            try {
                this.removeAllListeners();
            } catch (cleanupError) {
                console.error('Error during FilterBar cleanup fallback:', cleanupError);
            }
        }
    }
}
