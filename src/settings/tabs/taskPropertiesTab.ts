import { Notice, setTooltip, Setting } from 'obsidian';
import TaskNotesPlugin from '../../main';
import { StatusConfig, FieldMapping } from '../../types';
// import { UserMappedField } from '../../types/settings';
import { 
    createSectionHeader, 
    createHelpText,
    createValidationNote,
    // createListHeaders,
    createButtonSetting
} from '../components/settingHelpers';
// import { ListEditorComponent, ListEditorItem } from '../components/ListEditorComponent';

// interface StatusItem extends ListEditorItem, StatusConfig {}
// interface PriorityItem extends ListEditorItem, PriorityConfig {}
// interface UserFieldItem extends ListEditorItem, UserMappedField {}

/**
 * Renders the Task Properties tab - custom statuses, priorities, and user fields
 */
export function renderTaskPropertiesTab(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void): void {
    container.empty();

    // Custom Statuses Section
    createSectionHeader(container, 'Task Statuses');
    createHelpText(container, 'Customize the status options available for your tasks. These statuses control the task lifecycle and determine when tasks are considered complete.');

    // Status help section
    const statusHelpContainer = container.createDiv('settings-help-section');
    statusHelpContainer.createEl('h4', { text: 'How statuses work:' });
    const statusHelpList = statusHelpContainer.createEl('ul');
    statusHelpList.createEl('li', { text: 'Value: The internal identifier stored in your task files (e.g., "in-progress")' });
    statusHelpList.createEl('li', { text: 'Label: The display name shown in the interface (e.g., "In Progress")' });
    statusHelpList.createEl('li', { text: 'Color: Visual indicator color for the status dot and badges' });
    statusHelpList.createEl('li', { text: 'Completed: When checked, tasks with this status are considered finished and may be filtered differently' });
    statusHelpContainer.createEl('p', {
        text: 'The order below determines the sequence when cycling through statuses by clicking on task status badges.',
        cls: 'settings-help-note'
    });

    // Status list container - using card layout like webhooks
    const statusList = container.createDiv('tasknotes-statuses-container');
    renderStatusList(statusList, plugin, save);
    
    // Add status button
    new Setting(container)
        .setName('Add new status')
        .setDesc('Create a new status option for your tasks')
        .addButton(button => button
            .setButtonText('Add status')
            .onClick(async () => {
                const newId = `status_${Date.now()}`;
                const newStatus = {
                    id: newId,
                    value: '',
                    label: '',
                    color: '#6366f1',
                    completed: false,
                    isCompleted: false,
                    order: plugin.settings.customStatuses.length
                };
                plugin.settings.customStatuses.push(newStatus);
                save();
                renderStatusList(statusList, plugin, save);
            }));

    createValidationNote(container, 'Note: You must have at least 2 statuses, and at least one status must be marked as "Completed".');

    // Custom Priorities Section
    createSectionHeader(container, 'Task Priorities');
    createHelpText(container, 'Customize the priority levels available for your tasks. Priority weights determine sorting order and visual hierarchy in your task views.');

    // Priority help section
    const priorityHelpContainer = container.createDiv('settings-help-section');
    priorityHelpContainer.createEl('h4', { text: 'How priorities work:' });
    const priorityHelpList = priorityHelpContainer.createEl('ul');
    priorityHelpList.createEl('li', { text: 'Value: The internal identifier stored in your task files (e.g., "high")' });
    priorityHelpList.createEl('li', { text: 'Display Label: The display name shown in the interface (e.g., "High Priority")' });
    priorityHelpList.createEl('li', { text: 'Color: Visual indicator color for the priority dot and badges' });
    priorityHelpList.createEl('li', { text: 'Weight: Numeric value for sorting (higher weights appear first in lists)' });
    priorityHelpContainer.createEl('p', {
        text: 'Tasks are automatically sorted by priority weight in descending order (highest weight first). Weights can be any positive number.',
        cls: 'settings-help-note'
    });

    // Priority list container - using card layout
    const priorityList = container.createDiv('tasknotes-priorities-container');
    renderPriorityList(priorityList, plugin, save);
    
    // Add priority button
    new Setting(container)
        .setName('Add new priority')
        .setDesc('Create a new priority level for your tasks')
        .addButton(button => button
            .setButtonText('Add priority')
            .onClick(async () => {
                const newId = `priority_${Date.now()}`;
                const newPriority = {
                    id: newId,
                    value: '',
                    label: '',
                    color: '#6366f1',
                    weight: 1
                };
                plugin.settings.customPriorities.push(newPriority);
                save();
                renderPriorityList(priorityList, plugin, save);
            }));

    createValidationNote(container, 'Note: You must have at least 1 priority. Higher weights take precedence in sorting and visual hierarchy.');

    // Field Mapping Section
    createSectionHeader(container, 'Field Mapping');
    
    // Warning message
    const warning = container.createDiv('settings-warning');
    warning.createEl('strong', { text: '⚠️ Warning: ' });
    warning.appendText('TaskNotes will read AND write using these property names. Changing these after creating tasks may cause inconsistencies.');
    
    createHelpText(container, 'Configure which frontmatter properties TaskNotes should use for each field.');

    renderFieldMappingTable(container, plugin, save);

    createButtonSetting(container, {
        name: 'Reset field mappings',
        desc: 'Reset all field mappings to default values',
        buttonText: 'Reset to Defaults',
        onClick: async () => {
            // Import the DEFAULT_FIELD_MAPPING - we'll need to check if this is accessible
            try {
                const { DEFAULT_FIELD_MAPPING } = await import('../../settings/defaults');
                plugin.settings.fieldMapping = { ...DEFAULT_FIELD_MAPPING };
                save();
                renderTaskPropertiesTab(container.parentElement!, plugin, save);
                new Notice('Field mappings reset to defaults');
            } catch (error) {
                console.error('Error resetting field mappings:', error);
                new Notice('Failed to reset field mappings');
            }
        }
    });

    // Custom User Fields Section
    createSectionHeader(container, 'Custom User Fields');
    createHelpText(container, 'Define custom frontmatter properties to appear as type-aware filter options across views. Each row: Display Name, Property Name, Type.');

    // Ensure user fields array exists
    if (!Array.isArray(plugin.settings.userFields)) {
        plugin.settings.userFields = [];
    }

    // Migrate legacy single field if present
    if (plugin.settings.userField && plugin.settings.userField.enabled) {
        const legacy = plugin.settings.userField;
        const id = (legacy.displayName || legacy.key || 'field').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        if (!plugin.settings.userFields.find(f => (f.id === id) || (f.key === legacy.key))) {
            plugin.settings.userFields.push({ 
                id, 
                displayName: legacy.displayName || '', 
                key: legacy.key || '', 
                type: legacy.type || 'text' 
            });
            save();
        }
    }

    // User fields list - using card layout
    const userFieldsContainer = container.createDiv('tasknotes-user-fields-container');
    renderUserFieldsList(userFieldsContainer, plugin, save);
    
    // Add user field button
    new Setting(container)
        .setName('Add new user field')
        .setDesc('Create a new custom field that will appear in filters and views')
        .addButton(button => button
            .setButtonText('Add user field')
            .onClick(async () => {
                const newId = `field_${Date.now()}`;
                const newField = {
                    id: newId,
                    displayName: '',
                    key: '',
                    type: 'text' as const
                };
                plugin.settings.userFields = plugin.settings.userFields || [];
                plugin.settings.userFields.push(newField);
                save();
                renderUserFieldsList(userFieldsContainer, plugin, save);
            }));

}

function renderStatusList(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void): void {
    container.empty();
    
    if (!plugin.settings.customStatuses || plugin.settings.customStatuses.length === 0) {
        const emptyState = container.createDiv('tasknotes-statuses-empty-state');
        emptyState.createSpan('tasknotes-statuses-empty-icon');
        emptyState.createSpan({
            text: 'No custom statuses configured. Add a status to get started.',
            cls: 'tasknotes-statuses-empty-text'
        });
        return;
    }

    // Get sorted statuses
    const sortedStatuses = [...plugin.settings.customStatuses].sort((a, b) => a.order - b.order);

    sortedStatuses.forEach((status, index) => {
        const statusCard = container.createDiv('tasknotes-status-card');
        statusCard.setAttribute('data-status-id', status.id);
        
        // Drag handle
        const dragHandle = statusCard.createDiv('tasknotes-status-drag-handle');
        dragHandle.textContent = '⋮⋮';
        dragHandle.draggable = true;
        setTooltip(dragHandle, 'Drag to reorder', { placement: 'top' });

        // Header section with color indicator and main info
        const statusHeader = statusCard.createDiv('tasknotes-status-header');
        
        // Color indicator
        const colorIndicator = statusHeader.createDiv('tasknotes-status-color-indicator');
        colorIndicator.style.setProperty('--status-color', status.color);
        
        const statusInfo = statusHeader.createDiv('tasknotes-status-info');
        
        // Status value and label in header
        statusInfo.createSpan({
            text: status.value || 'untitled',
            cls: 'tasknotes-status-value-text'
        });
        
        statusInfo.createSpan({
            text: status.label || 'No label',
            cls: 'tasknotes-status-label-text'
        });

        // Completed status indicator
        const statusMeta = statusHeader.createDiv('tasknotes-status-meta');
        if (status.isCompleted) {
            statusMeta.createSpan({
                text: 'Completed',
                cls: 'tasknotes-status-completed-indicator'
            });
        }

        // Status configuration section
        const statusConfig = statusCard.createDiv('tasknotes-status-config');
        
        // Value input row
        const valueRow = statusConfig.createDiv('tasknotes-status-config-row');
        valueRow.createSpan({
            text: 'Value:',
            cls: 'tasknotes-status-config-label'
        });
        const valueInput = valueRow.createEl('input', {
            type: 'text',
            value: status.value,
            cls: 'tasknotes-status-input',
            attr: {
                'placeholder': 'in-progress',
                'aria-label': `Status value for ${status.label || 'status'}`
            }
        });
        
        // Label input row
        const labelRow = statusConfig.createDiv('tasknotes-status-config-row');
        labelRow.createSpan({
            text: 'Label:',
            cls: 'tasknotes-status-config-label'
        });
        const labelInput = labelRow.createEl('input', {
            type: 'text',
            value: status.label,
            cls: 'tasknotes-status-input',
            attr: {
                'placeholder': 'In Progress',
                'aria-label': `Status label for ${status.value || 'status'}`
            }
        });

        // Options row (color and completed)
        const optionsRow = statusConfig.createDiv('tasknotes-status-options-row');
        
        // Color picker
        const colorSection = optionsRow.createDiv('tasknotes-status-color-section');
        colorSection.createSpan({
            text: 'Color:',
            cls: 'tasknotes-status-option-label'
        });
        const colorInput = colorSection.createEl('input', {
            type: 'color',
            value: status.color,
            cls: 'tasknotes-status-color-input',
            attr: {
                'aria-label': `Color for status ${status.label || status.value}`
            }
        });
        
        // Completed toggle
        const completedSection = optionsRow.createDiv('tasknotes-status-completed-section');
        const completedLabel = completedSection.createEl('label', {
            cls: 'tasknotes-status-completed-label'
        });
        const completedToggle = completedLabel.createEl('input', {
            type: 'checkbox',
            cls: 'tasknotes-status-completed-checkbox',
            attr: {
                'aria-label': `Mark status ${status.label || status.value} as completed`
            }
        });
        completedLabel.createSpan({
            text: 'Completed',
            cls: 'tasknotes-status-completed-text'
        });

        // Actions section
        const statusActions = statusCard.createDiv('tasknotes-status-actions');
        
        const deleteBtn = statusActions.createEl('button', {
            cls: 'tasknotes-status-action-btn delete',
            attr: {
                'aria-label': `Delete status ${status.label || status.value}`,
                'title': 'Delete status'
            }
        });
        deleteBtn.createSpan({
            text: 'Delete',
            cls: 'tasknotes-status-action-text'
        });

        if (plugin.settings.customStatuses.length <= 1) {
            deleteBtn.disabled = true;
            deleteBtn.style.opacity = '0.3';
        }

        // Event listeners
        valueInput.addEventListener('input', () => {
            status.value = valueInput.value;
            statusInfo.querySelector('.tasknotes-status-value-text')!.textContent = status.value || 'untitled';
            save();
        });

        labelInput.addEventListener('input', () => {
            status.label = labelInput.value;
            statusInfo.querySelector('.tasknotes-status-label-text')!.textContent = status.label || 'No label';
            save();
        });

        colorInput.addEventListener('input', () => {
            status.color = colorInput.value;
            colorIndicator.style.setProperty('--status-color', status.color);
            save();
        });

        completedToggle.checked = status.isCompleted;
        completedToggle.addEventListener('change', () => {
            status.isCompleted = completedToggle.checked;
            // Update completed indicator
            if (status.isCompleted && !statusMeta.querySelector('.tasknotes-status-completed-indicator')) {
                statusMeta.createSpan({
                    text: 'Completed',
                    cls: 'tasknotes-status-completed-indicator'
                });
            } else if (!status.isCompleted) {
                const indicator = statusMeta.querySelector('.tasknotes-status-completed-indicator');
                if (indicator) indicator.remove();
            }
            save();
        });
        
        deleteBtn.addEventListener('click', () => {
            if (plugin.settings.customStatuses.length <= 1) {
                new Notice('You must have at least one status');
                return;
            }
            
            plugin.settings.customStatuses = plugin.settings.customStatuses.filter(s => s.id !== status.id);
            save();
            renderStatusList(container, plugin, save);
        });

        // Add drag and drop functionality
        setupStatusDragAndDrop(statusCard, status, container, plugin, save);
    });
}

function renderPriorityList(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void): void {
    container.empty();
    
    if (!plugin.settings.customPriorities || plugin.settings.customPriorities.length === 0) {
        const emptyState = container.createDiv('tasknotes-priorities-empty-state');
        emptyState.createSpan('tasknotes-priorities-empty-icon');
        emptyState.createSpan({
            text: 'No custom priorities configured. Add a priority to get started.',
            cls: 'tasknotes-priorities-empty-text'
        });
        return;
    }
    
    const sortedPriorities = [...plugin.settings.customPriorities].sort((a, b) => b.weight - a.weight);
    
    sortedPriorities.forEach((priority, index) => {
        const priorityCard = container.createDiv('tasknotes-priority-card');
        
        // Header section with color indicator and main info
        const priorityHeader = priorityCard.createDiv('tasknotes-priority-header');
        
        // Color indicator
        const colorIndicator = priorityHeader.createDiv('tasknotes-priority-color-indicator');
        colorIndicator.style.setProperty('--priority-color', priority.color);
        
        const priorityInfo = priorityHeader.createDiv('tasknotes-priority-info');
        
        // Priority value and label in header
        priorityInfo.createSpan({
            text: priority.value || 'untitled',
            cls: 'tasknotes-priority-value-text'
        });
        
        priorityInfo.createSpan({
            text: priority.label || 'No label',
            cls: 'tasknotes-priority-label-text'
        });

        // Weight indicator in header
        const priorityMeta = priorityHeader.createDiv('tasknotes-priority-meta');
        priorityMeta.createSpan({
            text: `Weight: ${priority.weight}`,
            cls: 'tasknotes-priority-weight-indicator'
        });

        // Priority configuration section
        const priorityConfig = priorityCard.createDiv('tasknotes-priority-config');
        
        // Value input row
        const valueRow = priorityConfig.createDiv('tasknotes-priority-config-row');
        valueRow.createSpan({
            text: 'Value:',
            cls: 'tasknotes-priority-config-label'
        });
        const valueInput = valueRow.createEl('input', {
            type: 'text',
            value: priority.value,
            cls: 'tasknotes-priority-input',
            attr: {
                'placeholder': 'high',
                'aria-label': `Priority value for ${priority.label || 'priority'}`
            }
        });
        
        // Label input row
        const labelRow = priorityConfig.createDiv('tasknotes-priority-config-row');
        labelRow.createSpan({
            text: 'Label:',
            cls: 'tasknotes-priority-config-label'
        });
        const labelInput = labelRow.createEl('input', {
            type: 'text',
            value: priority.label,
            cls: 'tasknotes-priority-input',
            attr: {
                'placeholder': 'High Priority',
                'aria-label': `Priority label for ${priority.value || 'priority'}`
            }
        });

        // Options row (color and weight)
        const optionsRow = priorityConfig.createDiv('tasknotes-priority-options-row');
        
        // Color picker
        const colorSection = optionsRow.createDiv('tasknotes-priority-color-section');
        colorSection.createSpan({
            text: 'Color:',
            cls: 'tasknotes-priority-option-label'
        });
        const colorInput = colorSection.createEl('input', {
            type: 'color',
            value: priority.color,
            cls: 'tasknotes-priority-color-input',
            attr: {
                'aria-label': `Color for priority ${priority.label || priority.value}`
            }
        });
        
        // Weight input
        const weightSection = optionsRow.createDiv('tasknotes-priority-weight-section');
        weightSection.createSpan({
            text: 'Weight:',
            cls: 'tasknotes-priority-option-label'
        });
        const weightInput = weightSection.createEl('input', {
            type: 'number',
            value: priority.weight.toString(),
            cls: 'tasknotes-priority-weight-input',
            attr: {
                'placeholder': '10',
                'min': '0',
                'aria-label': `Weight for priority ${priority.label || priority.value}`
            }
        });

        // Actions section
        const priorityActions = priorityCard.createDiv('tasknotes-priority-actions');
        
        const deleteBtn = priorityActions.createEl('button', {
            cls: 'tasknotes-priority-action-btn delete',
            attr: {
                'aria-label': `Delete priority ${priority.label || priority.value}`,
                'title': 'Delete priority'
            }
        });
        deleteBtn.createSpan({
            text: 'Delete',
            cls: 'tasknotes-priority-action-text'
        });

        if (plugin.settings.customPriorities.length <= 1) {
            deleteBtn.disabled = true;
            deleteBtn.style.opacity = '0.3';
        }

        // Event listeners
        valueInput.addEventListener('input', () => {
            priority.value = valueInput.value;
            priorityInfo.querySelector('.tasknotes-priority-value-text')!.textContent = priority.value || 'untitled';
            save();
        });

        labelInput.addEventListener('input', () => {
            priority.label = labelInput.value;
            priorityInfo.querySelector('.tasknotes-priority-label-text')!.textContent = priority.label || 'No label';
            save();
        });

        colorInput.addEventListener('input', () => {
            priority.color = colorInput.value;
            colorIndicator.style.setProperty('--priority-color', priority.color);
            save();
        });

        weightInput.addEventListener('input', () => {
            const weight = parseInt(weightInput.value);
            if (!isNaN(weight) && weight >= 0) {
                priority.weight = weight;
                priorityMeta.querySelector('.tasknotes-priority-weight-indicator')!.textContent = `Weight: ${priority.weight}`;
                save();
                // Re-render to maintain weight-based sorting
                renderPriorityList(container, plugin, save);
            }
        });
        
        deleteBtn.addEventListener('click', () => {
            if (plugin.settings.customPriorities.length <= 1) {
                new Notice('You must have at least one priority');
                return;
            }
            
            plugin.settings.customPriorities = plugin.settings.customPriorities.filter(p => p.id !== priority.id);
            save();
            renderPriorityList(container, plugin, save);
        });
    });
}

function setupStatusDragAndDrop(statusRow: HTMLElement, status: StatusConfig, container: HTMLElement, plugin: TaskNotesPlugin, save: () => void): void {
    statusRow.addEventListener('dragstart', (e) => {
        if (e.dataTransfer) {
            e.dataTransfer.setData('text/plain', status.id);
            statusRow.classList.add('dragging');
        }
    });

    statusRow.addEventListener('dragend', () => {
        statusRow.classList.remove('dragging');
        // Clean up all drag indicators
        container.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
            el.classList.remove('drag-over-top', 'drag-over-bottom');
        });
    });

    statusRow.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingRow = container.querySelector('.dragging') as HTMLElement;
        if (draggingRow && draggingRow !== statusRow) {
            const rect = statusRow.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            if (e.clientY < midpoint) {
                statusRow.classList.add('drag-over-top');
                statusRow.classList.remove('drag-over-bottom');
            } else {
                statusRow.classList.add('drag-over-bottom');
                statusRow.classList.remove('drag-over-top');
            }
        }
    });

    statusRow.addEventListener('dragleave', () => {
        statusRow.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    statusRow.addEventListener('drop', (e) => {
        e.preventDefault();
        const draggedId = e.dataTransfer?.getData('text/plain');
        if (!draggedId || draggedId === status.id) return;

        // Clear drag visual indicators
        statusRow.classList.remove('drag-over-top', 'drag-over-bottom');

        // Find the dragged and target statuses
        const draggedIndex = plugin.settings.customStatuses.findIndex(s => s.id === draggedId);
        const targetIndex = plugin.settings.customStatuses.findIndex(s => s.id === status.id);
        
        if (draggedIndex === -1 || targetIndex === -1) return;

        // Determine insertion point based on drop position
        const rect = statusRow.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const insertBefore = e.clientY < midpoint;
        
        // Reorder statuses array
        const reorderedStatuses = [...plugin.settings.customStatuses];
        const [draggedStatus] = reorderedStatuses.splice(draggedIndex, 1);
        
        let insertIndex = targetIndex;
        if (draggedIndex < targetIndex && !insertBefore) {
            insertIndex = targetIndex; // Already adjusted due to removal
        } else if (draggedIndex < targetIndex && insertBefore) {
            insertIndex = targetIndex - 1;
        } else if (draggedIndex > targetIndex && insertBefore) {
            insertIndex = targetIndex;
        } else if (draggedIndex > targetIndex && !insertBefore) {
            insertIndex = targetIndex + 1;
        }

        reorderedStatuses.splice(insertIndex, 0, draggedStatus);
        
        // Update order property based on new array position
        reorderedStatuses.forEach((s, i) => {
            s.order = i;
        });
        
        plugin.settings.customStatuses = reorderedStatuses;
        save();
        renderStatusList(container, plugin, save);
    });
}

function renderFieldMappingTable(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void): void {
    // Create mapping table
    const table = container.createEl('table', { cls: 'settings-table' });
    const header = table.createEl('tr');
    header.createEl('th', { cls: 'settings-table-header', text: 'TaskNotes field' });
    header.createEl('th', { cls: 'settings-table-header', text: 'Your property name' });

    const fieldMappings: Array<[keyof FieldMapping, string]> = [
        ['title', 'Title'],
        ['status', 'Status'],
        ['priority', 'Priority'],
        ['due', 'Due date'],
        ['scheduled', 'Scheduled date'],
        ['contexts', 'Contexts'],
        ['projects', 'Projects'],
        ['timeEstimate', 'Time estimate'],
        ['recurrence', 'Recurrence'],
        ['dateCreated', 'Created date'],
        ['completedDate', 'Completed date'],
        ['dateModified', 'Modified date'],
        ['archiveTag', 'Archive tag'],
        ['timeEntries', 'Time entries'],
        ['completeInstances', 'Complete instances'],
        ['pomodoros', 'Pomodoros'],
        ['icsEventId', 'ICS Event ID'],
        ['icsEventTag', 'ICS Event Tag'],
        ['reminders', 'Reminders']
    ];

    fieldMappings.forEach(([field, label]) => {
        const row = table.createEl('tr', { cls: 'settings-table-row' });
        const labelCell = row.createEl('td', { cls: 'settings-table-cell' });
        labelCell.textContent = label;
        const inputCell = row.createEl('td', { cls: 'settings-table-cell' });
        
        const input = inputCell.createEl('input', {
            type: 'text',
            cls: 'settings-input field-mapping-input',
            value: plugin.settings.fieldMapping[field] || '',
            attr: {
                'placeholder': field,
                'aria-label': `Property name for ${label}`
            }
        });

        input.addEventListener('change', async () => {
            try {
                plugin.settings.fieldMapping[field] = input.value;
                save();
            } catch (error) {
                console.error(`Error updating field mapping for ${field}:`, error);
                new Notice(`Failed to update field mapping for ${label}. Please try again.`);
            }
        });
    });
}

function renderUserFieldsList(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void): void {
    container.empty();
    
    if (!plugin.settings.userFields || plugin.settings.userFields.length === 0) {
        const emptyState = container.createDiv('tasknotes-user-fields-empty-state');
        emptyState.createSpan('tasknotes-user-fields-empty-icon');
        emptyState.createSpan({
            text: 'No custom user fields configured. Add a field to create custom properties for your tasks.',
            cls: 'tasknotes-user-fields-empty-text'
        });
        return;
    }

    plugin.settings.userFields.forEach((field, index) => {
        const fieldCard = container.createDiv('tasknotes-user-field-card');
        
        // Header section with field info
        const fieldHeader = fieldCard.createDiv('tasknotes-user-field-header');
        
        const fieldInfo = fieldHeader.createDiv('tasknotes-user-field-info');
        
        // Display name (primary)
        fieldInfo.createSpan({
            text: field.displayName || 'Unnamed Field',
            cls: 'tasknotes-user-field-name-text'
        });
        
        // Property key (secondary)
        fieldInfo.createSpan({
            text: field.key || 'no-key',
            cls: 'tasknotes-user-field-key-text'
        });

        // Type indicator
        const fieldMeta = fieldHeader.createDiv('tasknotes-user-field-meta');
        fieldMeta.createSpan({
            text: field.type.charAt(0).toUpperCase() + field.type.slice(1),
            cls: 'tasknotes-user-field-type-indicator'
        });

        // Field configuration section
        const fieldConfig = fieldCard.createDiv('tasknotes-user-field-config');
        
        // Display name input row
        const nameRow = fieldConfig.createDiv('tasknotes-user-field-config-row');
        nameRow.createSpan({
            text: 'Display Name:',
            cls: 'tasknotes-user-field-config-label'
        });
        const nameInput = nameRow.createEl('input', {
            type: 'text',
            value: field.displayName || '',
            cls: 'tasknotes-user-field-input',
            attr: {
                'placeholder': 'Display Name',
                'aria-label': 'Field display name'
            }
        });
        
        // Property key input row
        const keyRow = fieldConfig.createDiv('tasknotes-user-field-config-row');
        keyRow.createSpan({
            text: 'Property Key:',
            cls: 'tasknotes-user-field-config-label'
        });
        const keyInput = keyRow.createEl('input', {
            type: 'text',
            value: field.key || '',
            cls: 'tasknotes-user-field-input',
            attr: {
                'placeholder': 'property-name',
                'aria-label': 'Frontmatter property key'
            }
        });

        // Type selector row
        const typeRow = fieldConfig.createDiv('tasknotes-user-field-config-row');
        typeRow.createSpan({
            text: 'Type:',
            cls: 'tasknotes-user-field-config-label'
        });
        const typeSelect = typeRow.createEl('select', {
            cls: 'tasknotes-user-field-type-select',
            attr: {
                'aria-label': 'Field data type'
            }
        });
        
        const options = [
            { value: 'text', label: 'Text' },
            { value: 'number', label: 'Number' },
            { value: 'boolean', label: 'Boolean' },
            { value: 'date', label: 'Date' }
        ];
        options.forEach(option => {
            const opt = typeSelect.createEl('option', { value: option.value, text: option.label });
            if (field.type === option.value) opt.selected = true;
        });

        // Actions section
        const fieldActions = fieldCard.createDiv('tasknotes-user-field-actions');
        
        const deleteBtn = fieldActions.createEl('button', {
            cls: 'tasknotes-user-field-action-btn delete',
            attr: {
                'aria-label': `Delete field ${field.displayName || field.key}`,
                'title': 'Delete field'
            }
        });
        deleteBtn.createSpan({
            text: 'Delete',
            cls: 'tasknotes-user-field-action-text'
        });

        // Event listeners
        nameInput.addEventListener('input', () => {
            field.displayName = nameInput.value;
            fieldInfo.querySelector('.tasknotes-user-field-name-text')!.textContent = field.displayName || 'Unnamed Field';
            save();
        });

        keyInput.addEventListener('input', () => {
            field.key = keyInput.value;
            fieldInfo.querySelector('.tasknotes-user-field-key-text')!.textContent = field.key || 'no-key';
            save();
        });

        typeSelect.addEventListener('change', () => {
            field.type = typeSelect.value as any;
            fieldMeta.querySelector('.tasknotes-user-field-type-indicator')!.textContent = 
                field.type.charAt(0).toUpperCase() + field.type.slice(1);
            save();
        });
        
        deleteBtn.addEventListener('click', () => {
            plugin.settings.userFields = (plugin.settings.userFields || []).filter(f => f.id !== field.id);
            save();
            renderUserFieldsList(container, plugin, save);
        });
    });
}