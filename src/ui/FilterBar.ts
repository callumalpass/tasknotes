import { FilterQuery, SavedView, FilterCondition, FilterGroup, TaskSortKey, TaskGroupKey, SortDirection, FilterProperty, FilterOperator, FILTER_PROPERTIES, FILTER_OPERATORS, PropertyDefinition, OperatorDefinition } from '../types';
import { EventEmitter } from '../utils/EventEmitter';
import { setIcon, DropdownComponent, debounce } from 'obsidian';

/**
 * Advanced FilterBar component implementing the new query builder system
 * Provides hierarchical filtering with groups, conditions, and saved views
 */
export class FilterBar extends EventEmitter {
    private container: HTMLElement;
    private currentQuery: FilterQuery;
    private savedViews: SavedView[] = [];
    private filterOptions: {
        statuses: string[];
        priorities: string[];
        contexts: string[];
        projects: string[];
    };

    // Debouncing for input fields
    private debouncedEmitQueryChange: () => void;

    // UI Elements
    private viewSelectorButton?: HTMLButtonElement;
    private viewSelectorDropdown?: HTMLElement;
    private filterBuilder?: HTMLElement;
    private displaySection?: HTMLElement;
    private viewOptionsContainer?: HTMLElement;

    // Collapse states
    private sectionStates = {
        filterBox: true,    // Entire filter box - expanded by default
        filters: true,      // This view section - expanded by default
        display: true,      // Display & Organization - expanded by default
        viewOptions: false  // View Options - collapsed by default
    };

    constructor(
        container: HTMLElement,
        initialQuery: FilterQuery,
        filterOptions: { statuses: string[]; priorities: string[]; contexts: string[]; projects: string[] }
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

        // Initialize debounced query change emission (300ms delay)
        this.debouncedEmitQueryChange = debounce(() => {
            this.emit('queryChange', { ...this.currentQuery });
        }, 300);

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
     * Update saved views list
     */
    updateSavedViews(views: SavedView[]): void {
        console.log('FilterBar: Updating saved views:', views); // Debug
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
     * Generate a unique ID for filter nodes
     */
    private generateId(): string {
        return Math.random().toString(36).substr(2, 9);
    }

    /**
     * Render the complete FilterBar UI
     */
    private render(): void {
        this.container.empty();
        this.container.addClass('advanced-filter-bar');

        // 1. Top Controls (Filter Icon + Templates Button)
        this.renderTopControls();

        // 2. Main Filter Box (collapsible)
        this.renderMainFilterBox();
    }

    /**
     * Render the top controls (filter toggle + templates button)
     */
    private renderTopControls(): void {
        const topControls = this.container.createDiv('filter-bar__top-controls');

        // Filter toggle icon
        const filterToggle = topControls.createEl('button', {
            cls: `filter-bar__filter-toggle ${this.sectionStates.filterBox ? 'filter-bar__filter-toggle--active' : ''}`,
            attr: { 'aria-label': 'Toggle filter' }
        });
        setIcon(filterToggle, 'filter');

        // Templates button
        this.viewSelectorButton = topControls.createEl('button', {
            text: 'Filter templates',
            cls: 'filter-bar__templates-button'
        });

        // Templates dropdown
        this.viewSelectorDropdown = topControls.createDiv({
            cls: 'filter-bar__view-selector-dropdown filter-bar__view-selector-dropdown--hidden'
        });

        // Event listeners
        filterToggle.addEventListener('click', () => {
            this.toggleMainFilterBox();
        });

        this.viewSelectorButton.addEventListener('click', () => {
            this.toggleViewSelectorDropdown();
        });

        this.renderViewSelectorDropdown();
    }

    /**
     * Render the main filter box (collapsible)
     */
    private renderMainFilterBox(): void {
        const mainFilterBox = this.container.createDiv('filter-bar__main-box');
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

    /**
     * Toggle the main filter box
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
    }

    /**
     * Render the view selector dropdown content
     */
    private renderViewSelectorDropdown(): void {
        if (!this.viewSelectorDropdown) return;

        this.viewSelectorDropdown.empty();

        // This view section
        const thisViewSection = this.viewSelectorDropdown.createDiv('filter-bar__view-section');
        thisViewSection.createDiv({
            text: 'Current filter',
            cls: 'filter-bar__view-section-header'
        });

        const saveCurrentButton = thisViewSection.createEl('button', {
            text: 'Save current view...',
            cls: 'filter-bar__view-action'
        });
        saveCurrentButton.addEventListener('click', () => {
            this.showSaveViewDialog();
        });

        // Saved views section
        if (this.savedViews.length > 0) {
            const savedViewsSection = this.viewSelectorDropdown.createDiv('filter-bar__view-section');
            savedViewsSection.createDiv({
                text: 'Saved views',
                cls: 'filter-bar__view-section-header'
            });

            this.savedViews.forEach(view => {
                const viewItemContainer = savedViewsSection.createDiv({
                    cls: 'filter-bar__view-item-container'
                });
                
                const viewItem = viewItemContainer.createEl('button', {
                    text: view.name,
                    cls: 'filter-bar__view-item'
                });
                viewItem.addEventListener('click', () => {
                    this.loadSavedView(view);
                });

                const deleteBtn = viewItemContainer.createEl('button', {
                    text: '×',
                    cls: 'filter-bar__view-delete'
                });
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete view "${view.name}"?`)) {
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
        if (!this.sectionStates.filters) {
            header.addClass('filter-bar__section-header--collapsed');
        }
        
        const title = header.createSpan({
            text: 'Filter',
            cls: 'filter-bar__section-title'
        });

        // Content
        const content = section.createDiv('filter-bar__section-content');
        if (!this.sectionStates.filters) {
            content.addClass('filter-bar__section-content--collapsed');
        }

        this.filterBuilder = content.createDiv('filter-bar__filter-builder');

        // Render the root group
        this.renderFilterGroup(this.filterBuilder, this.currentQuery, 0);

        // Add click handler for toggle
        header.addEventListener('click', () => {
            this.toggleSection('filters', header, content);
        });
    }

    /**
     * Render a filter group (recursive)
     */
    private renderFilterGroup(parent: HTMLElement, group: FilterGroup, depth: number, parentGroup?: FilterGroup, groupIndex?: number): void {
        const groupContainer = parent.createDiv('filter-bar__group');
        groupContainer.style.marginLeft = `${depth * 20}px`;

        // Group header with conjunction and delete button
        const groupHeader = groupContainer.createDiv('filter-bar__group-header');
        
        // Conjunction dropdown
        const conjunctionContainer = groupHeader.createDiv('filter-bar__conjunction');
        
        const conjunctionLabel = depth === 0 ? 'All' : (group.conjunction === 'and' ? 'All' : 'Any');
        const conjunctionSelect = conjunctionContainer.createEl('select', {
            cls: 'filter-bar__conjunction-select'
        });

        const allOption = conjunctionSelect.createEl('option', { value: 'and', text: depth === 0 ? 'All' : 'All' });
        const anyOption = conjunctionSelect.createEl('option', { value: 'or', text: depth === 0 ? 'Any' : 'Any' });
        conjunctionSelect.value = group.conjunction;

        conjunctionContainer.createSpan({
            text: 'of the following are true:',
            cls: 'filter-bar__conjunction-text'
        });

        conjunctionSelect.addEventListener('change', () => {
            group.conjunction = conjunctionSelect.value as 'and' | 'or';
            this.emitQueryChange();
        });

        // Delete button for non-root groups
        if (depth > 0 && parentGroup && groupIndex !== undefined) {
            const deleteGroupButton = groupHeader.createEl('button', {
                cls: 'filter-bar__delete-button',
                attr: { 'aria-label': 'Delete filter group' }
            });
            setIcon(deleteGroupButton, 'trash-2');
            
            deleteGroupButton.addEventListener('click', () => {
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
        
        const addFilterButton = actionsContainer.createEl('button', {
            text: '+ Add filter',
            cls: 'filter-bar__action-button'
        });
        addFilterButton.addEventListener('click', () => {
            this.addFilterCondition(group);
        });

        const addGroupButton = actionsContainer.createEl('button', {
            text: '+ Add filter group',
            cls: 'filter-bar__action-button'
        });
        addGroupButton.addEventListener('click', () => {
            this.addFilterGroup(group);
        });
    }

    /**
     * Render a filter node (condition or group)
     */
    private renderFilterNode(parent: HTMLElement, node: FilterCondition | FilterGroup, parentGroup: FilterGroup, index: number, depth: number): void {
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
        conditionContainer.style.marginLeft = `${depth * 20}px`;

        // Prefix (where/and/or)
        const prefix = conditionContainer.createSpan({
            text: index === 0 ? 'where' : parentGroup.conjunction,
            cls: 'filter-bar__condition-prefix'
        });

        // Property dropdown
        const propertySelect = conditionContainer.createEl('select', {
            cls: 'filter-bar__property-select'
        });
        
        FILTER_PROPERTIES.forEach(prop => {
            const option = propertySelect.createEl('option', {
                value: prop.id,
                text: prop.label
            });
        });
        propertySelect.value = condition.property;

        // Operator dropdown
        const operatorSelect = conditionContainer.createEl('select', {
            cls: 'filter-bar__operator-select'
        });
        this.updateOperatorOptions(operatorSelect, condition.property as FilterProperty);
        operatorSelect.value = condition.operator;

        // Value input
        const valueContainer = conditionContainer.createDiv('filter-bar__value-container');
        this.renderValueInput(valueContainer, condition);

        // Delete button
        const deleteButton = conditionContainer.createEl('button', {
            cls: 'filter-bar__delete-button',
            attr: { 'aria-label': 'Delete condition' }
        });
        setIcon(deleteButton, 'trash-2');

        // Event listeners
        propertySelect.addEventListener('change', () => {
            condition.property = propertySelect.value;
            this.updateOperatorOptions(operatorSelect, condition.property as FilterProperty);
            this.renderValueInput(valueContainer, condition);
            this.emitQueryChange();
        });

        operatorSelect.addEventListener('change', () => {
            condition.operator = operatorSelect.value;
            this.renderValueInput(valueContainer, condition);
            this.emitQueryChange();
        });

        deleteButton.addEventListener('click', () => {
            this.removeFilterCondition(parentGroup, index);
        });
    }

    /**
     * Update operator options based on selected property
     */
    private updateOperatorOptions(select: HTMLSelectElement, property: FilterProperty): void {
        select.empty();
        
        const propertyDef = FILTER_PROPERTIES.find(p => p.id === property);
        if (!propertyDef) return;

        propertyDef.supportedOperators.forEach(operatorId => {
            const operatorDef = FILTER_OPERATORS.find(op => op.id === operatorId);
            if (operatorDef) {
                select.createEl('option', {
                    value: operatorDef.id,
                    text: operatorDef.label
                });
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
            case 'multi-select':
                this.renderMultiSelectInput(container, condition, propertyDef);
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
        const input = container.createEl('input', {
            type: 'text',
            cls: 'filter-bar__value-input',
            value: condition.value || ''
        });

        input.addEventListener('input', () => {
            condition.value = input.value;
            this.debouncedEmitQueryChange();
        });
    }

    /**
     * Render multi-select input
     */
    private renderMultiSelectInput(container: HTMLElement, condition: FilterCondition, propertyDef: PropertyDefinition): void {
        const selectContainer = container.createDiv('filter-bar__multi-select');
        
        let options: string[] = [];
        switch (propertyDef.id) {
            case 'status':
                options = this.filterOptions.statuses;
                break;
            case 'priority':
                options = this.filterOptions.priorities;
                break;
            case 'contexts':
                options = this.filterOptions.contexts;
                break;
            case 'projects':
                options = this.filterOptions.projects;
                break;
        }

        options.forEach(option => {
            const checkboxWrapper = selectContainer.createDiv('filter-bar__checkbox-wrapper');
            
            const label = checkboxWrapper.createEl('label', {
                cls: 'filter-bar__checkbox-label'
            });

            const checkbox = label.createEl('input', {
                type: 'checkbox',
                value: option,
                cls: 'filter-bar__checkbox'
            });

            if (Array.isArray(condition.value)) {
                checkbox.checked = condition.value.includes(option);
            } else if (condition.value) {
                checkbox.checked = condition.value === option;
            }

            label.createSpan({ text: option });

            checkbox.addEventListener('change', () => {
                this.updateMultiSelectValue(condition, selectContainer);
                this.emitQueryChange();
            });
        });
    }

    /**
     * Update multi-select value based on checkbox states
     */
    private updateMultiSelectValue(condition: FilterCondition, container: HTMLElement): void {
        const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked') as NodeListOf<HTMLInputElement>;
        const selectedValues = Array.from(checkboxes).map(cb => cb.value);
        condition.value = selectedValues.length > 0 ? selectedValues : null;
    }

    /**
     * Render date input
     */
    private renderDateInput(container: HTMLElement, condition: FilterCondition): void {
        const input = container.createEl('input', {
            type: 'date',
            cls: 'filter-bar__value-input',
            value: condition.value || ''
        });

        input.addEventListener('change', () => {
            condition.value = input.value;
            this.emitQueryChange(); // Date changes are immediate, no need for debouncing
        });
    }

    /**
     * Render number input
     */
    private renderNumberInput(container: HTMLElement, condition: FilterCondition): void {
        const input = container.createEl('input', {
            type: 'number',
            cls: 'filter-bar__value-input',
            value: condition.value || ''
        });

        input.addEventListener('input', () => {
            condition.value = parseFloat(input.value) || null;
            this.debouncedEmitQueryChange();
        });
    }

    /**
     * Render display & organization section
     */
    private renderDisplaySection(container: HTMLElement): void {
        const section = container.createDiv('filter-bar__section');

        // Collapsible header
        const header = section.createDiv('filter-bar__section-header');
        if (!this.sectionStates.display) {
            header.addClass('filter-bar__section-header--collapsed');
        }
        
        const title = header.createSpan({
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

        const sortSelect = sortContainer.createEl('select', {
            cls: 'filter-bar__sort-select'
        });

        const sortOptions = [
            { value: 'due', label: 'Due Date' },
            { value: 'scheduled', label: 'Scheduled Date' },
            { value: 'priority', label: 'Priority' },
            { value: 'title', label: 'Title' }
        ];

        sortOptions.forEach(option => {
            sortSelect.createEl('option', {
                value: option.value,
                text: option.label
            });
        });

        sortSelect.value = this.currentQuery.sortKey || 'due';

        const sortDirectionButton = sortContainer.createEl('button', {
            cls: 'filter-bar__sort-direction',
            attr: { 'aria-label': 'Toggle sort direction' }
        });

        // Group control
        const groupContainer = controls.createDiv('filter-bar__group-container');
        groupContainer.createSpan({ text: 'Group by:', cls: 'filter-bar__label' });

        const groupSelect = groupContainer.createEl('select', {
            cls: 'filter-bar__group-select'
        });

        const groupOptions = [
            { value: 'none', label: 'None' },
            { value: 'status', label: 'Status' },
            { value: 'priority', label: 'Priority' },
            { value: 'context', label: 'Context' },
            { value: 'project', label: 'Project' },
            { value: 'due', label: 'Due Date' },
            { value: 'scheduled', label: 'Scheduled Date' }
        ];

        groupOptions.forEach(option => {
            groupSelect.createEl('option', {
                value: option.value,
                text: option.label
            });
        });

        groupSelect.value = this.currentQuery.groupKey || 'none';

        // Event listeners
        sortSelect.addEventListener('change', () => {
            this.currentQuery.sortKey = sortSelect.value as TaskSortKey;
            this.emitQueryChange();
        });

        sortDirectionButton.addEventListener('click', () => {
            this.currentQuery.sortDirection = this.currentQuery.sortDirection === 'asc' ? 'desc' : 'asc';
            this.updateSortDirectionButton();
            this.emitQueryChange();
        });

        groupSelect.addEventListener('change', () => {
            this.currentQuery.groupKey = groupSelect.value as TaskGroupKey;
            this.emitQueryChange();
        });

        this.updateSortDirectionButton();

        // Add click handler for toggle
        header.addEventListener('click', () => {
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

        // Collapsible header
        const header = section.createDiv('filter-bar__section-header');
        if (!this.sectionStates.viewOptions) {
            header.addClass('filter-bar__section-header--collapsed');
        }
        
        const title = header.createSpan({
            text: 'View Options',
            cls: 'filter-bar__section-title'
        });

        // Content
        const content = section.createDiv('filter-bar__section-content');
        if (!this.sectionStates.viewOptions) {
            content.addClass('filter-bar__section-content--collapsed');
        }

        // Store reference to content for view-specific population
        this.viewOptionsContainer = content.createDiv('filter-bar__view-options');

        // Add click handler for toggle
        header.addEventListener('click', () => {
            this.toggleSection('viewOptions', header, content);
        });

        // This will be populated by the view component as needed
    }

    /**
     * Set view-specific options (called by view components)
     */
    setViewOptions(options: Array<{id: string, label: string, value: boolean, onChange: (value: boolean) => void}>): void {
        if (!this.viewOptionsContainer) return;

        this.viewOptionsContainer.empty();

        if (options.length === 0) {
            // Hide the section if no options
            const section = this.viewOptionsContainer.parentElement?.parentElement;
            if (section) {
                section.style.setProperty('display', 'none');
            }
            return;
        } else {
            // Show the section if we have options
            const section = this.viewOptionsContainer.parentElement?.parentElement;
            if (section) {
                section.style.removeProperty('display');
            }
        }

        options.forEach(option => {
            const optionContainer = this.viewOptionsContainer!.createDiv('filter-bar__view-option');
            
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
    }

    /**
     * Add a new filter condition to a group
     */
    private addFilterCondition(group: FilterGroup): void {
        const condition: FilterCondition = {
            type: 'condition',
            id: this.generateId(),
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
            id: this.generateId(),
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
    private toggleSection(sectionKey: keyof typeof this.sectionStates, header: HTMLElement, content: HTMLElement): void {
        this.sectionStates[sectionKey] = !this.sectionStates[sectionKey];
        const isExpanded = this.sectionStates[sectionKey];
        
        header.classList.toggle('filter-bar__section-header--collapsed', !isExpanded);
        content.classList.toggle('filter-bar__section-content--collapsed', !isExpanded);
    }

    /**
     * Show save view dialog
     */
    private showSaveViewDialog(): void {
        // Create a simple modal for name input
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: var(--background-primary);
            padding: 20px;
            border-radius: 8px;
            box-shadow: var(--shadow-s);
            border: 1px solid var(--background-modifier-border);
            min-width: 300px;
        `;

        const title = document.createElement('h3');
        title.textContent = 'Save View';
        title.style.marginBottom = '16px';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Enter view name...';
        input.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            background: var(--background-primary);
            color: var(--text-normal);
            margin-bottom: 16px;
        `;

        const buttons = document.createElement('div');
        buttons.style.cssText = `
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        `;

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
            padding: 6px 12px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            background: var(--background-primary);
            color: var(--text-normal);
            cursor: pointer;
        `;

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.style.cssText = `
            padding: 6px 12px;
            border: 1px solid var(--color-accent);
            border-radius: 4px;
            background: var(--color-accent);
            color: white;
            cursor: pointer;
        `;

        const closeModal = () => {
            document.body.removeChild(modal);
        };

        const saveView = () => {
            const name = input.value.trim();
            if (name) {
                console.log('FilterBar: Emitting saveView event:', name, this.currentQuery); // Debug
                this.emit('saveView', { name, query: this.currentQuery });
                closeModal();
                // Close the dropdown as well
                this.toggleViewSelectorDropdown();
            } else {
                input.focus();
            }
        };

        cancelBtn.addEventListener('click', closeModal);
        saveBtn.addEventListener('click', saveView);
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveView();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeModal();
            }
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        buttons.appendChild(cancelBtn);
        buttons.appendChild(saveBtn);
        content.appendChild(title);
        content.appendChild(input);
        content.appendChild(buttons);
        modal.appendChild(content);
        document.body.appendChild(modal);

        // Focus the input
        setTimeout(() => input.focus(), 100);
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
        // Re-render everything to ensure consistency
        this.render();
    }

    /**
     * Emit query change event
     */
    private emitQueryChange(): void {
        this.emit('queryChange', { ...this.currentQuery });
    }

    /**
     * Destroy and clean up the FilterBar
     */
    destroy(): void {
        this.container.empty();
        this.removeAllListeners();
    }
}
