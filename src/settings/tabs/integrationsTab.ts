import { Notice, Platform } from 'obsidian';
import TaskNotesPlugin from '../../main';
// import { WebhookConfig } from '../../types';
import { 
    createSectionHeader, 
    createTextSetting, 
    createToggleSetting, 
    createDropdownSetting,
    createNumberSetting,
    createHelpText,
    createButtonSetting,
    // createValidationNote
} from '../components/settingHelpers';
// import { ListEditorComponent, ListEditorItem } from '../components/ListEditorComponent';
import { showConfirmationModal } from '../../modals/ConfirmationModal';

// interface WebhookItem extends ListEditorItem, WebhookConfig {}
// interface ICSSubscriptionItem extends ListEditorItem {
//     id: string;
//     name: string;
//     url: string;
//     enabled: boolean;
//     color: string;
//     lastSync?: string;
// }

/**
 * Renders the Integrations tab - external connections and API settings
 */
export function renderIntegrationsTab(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void): void {
    container.empty();

    // Calendar Subscriptions Section (ICS)
    createSectionHeader(container, 'Calendar Subscriptions');
    createHelpText(container, 'Subscribe to external calendars via ICS/iCal URLs to view events alongside your tasks.');

    // Default settings for ICS integration
    createTextSetting(container, {
        name: 'Default note template',
        desc: 'Path to template file for notes created from ICS events',
        placeholder: 'Templates/Event Template.md',
        getValue: () => plugin.settings.icsIntegration.defaultNoteTemplate,
        setValue: async (value: string) => {
            plugin.settings.icsIntegration.defaultNoteTemplate = value;
            save();
        }
    });

    createTextSetting(container, {
        name: 'Default note folder',
        desc: 'Folder for notes created from ICS events',
        placeholder: 'Calendar/Events',
        getValue: () => plugin.settings.icsIntegration.defaultNoteFolder,
        setValue: async (value: string) => {
            plugin.settings.icsIntegration.defaultNoteFolder = value;
            save();
        }
    });

    createDropdownSetting(container, {
        name: 'ICS note filename format',
        desc: 'How filenames are generated for notes created from ICS events',
        options: [
            { value: 'title', label: 'Event title' },
            { value: 'zettel', label: 'Zettelkasten format' },
            { value: 'timestamp', label: 'Timestamp' },
            { value: 'custom', label: 'Custom template' }
        ],
        getValue: () => plugin.settings.icsIntegration.icsNoteFilenameFormat,
        setValue: async (value: string) => {
            plugin.settings.icsIntegration.icsNoteFilenameFormat = value as any;
            save();
            // Re-render to show custom template field if needed
            renderIntegrationsTab(container, plugin, save);
        }
    });

    if (plugin.settings.icsIntegration.icsNoteFilenameFormat === 'custom') {
        createTextSetting(container, {
            name: 'Custom ICS filename template',
            desc: 'Template for custom ICS event filenames',
            placeholder: '{date}-{title}',
            getValue: () => plugin.settings.icsIntegration.customICSNoteFilenameTemplate,
            setValue: async (value: string) => {
                plugin.settings.icsIntegration.customICSNoteFilenameTemplate = value;
                save();
            }
        });
    }

    // ICS Subscriptions List
    const icsContainer = container.createDiv('ics-subscriptions-container');
    renderICSSubscriptionsList(icsContainer, plugin, save);

    // Add subscription form
    const addICSContainer = container.createDiv('add-ics-container');
    renderAddICSForm(addICSContainer, plugin, save);

    // Refresh all subscriptions button
    createButtonSetting(container, {
        name: 'Refresh all subscriptions',
        desc: 'Manually refresh all enabled calendar subscriptions',
        buttonText: 'Refresh All',
        onClick: async () => {
            if (plugin.icsSubscriptionService) {
                try {
                    await plugin.icsSubscriptionService.refreshAllSubscriptions();
                    new Notice('All calendar subscriptions refreshed successfully');
                } catch (error) {
                    console.error('Error refreshing subscriptions:', error);
                    new Notice('Failed to refresh some calendar subscriptions');
                }
            }
        }
    });

    // HTTP API Section (Skip on mobile)
    if (!Platform.isMobile) {
        createSectionHeader(container, 'HTTP API');
        createHelpText(container, 'Enable HTTP API for external integrations and automations.');

        createToggleSetting(container, {
            name: 'Enable HTTP API',
            desc: 'Start local HTTP server for API access',
            getValue: () => plugin.settings.enableAPI,
            setValue: async (value: boolean) => {
                plugin.settings.enableAPI = value;
                save();
                // Re-render to show API settings
                renderIntegrationsTab(container, plugin, save);
            }
        });

        if (plugin.settings.enableAPI) {
            createNumberSetting(container, {
                name: 'API port',
                desc: 'Port number for the HTTP API server',
                placeholder: '3000',
                min: 1024,
                max: 65535,
                getValue: () => plugin.settings.apiPort,
                setValue: async (value: number) => {
                    plugin.settings.apiPort = value;
                    save();
                }
            });

            createTextSetting(container, {
                name: 'API authentication token',
                desc: 'Token required for API authentication (leave empty for no auth)',
                placeholder: 'your-secret-token',
                getValue: () => plugin.settings.apiAuthToken,
                setValue: async (value: string) => {
                    plugin.settings.apiAuthToken = value;
                    save();
                }
            });

            // API endpoint info
            const apiInfoContainer = container.createDiv('settings-help-section');
            apiInfoContainer.createEl('h4', { text: 'API Endpoints:' });
            const endpointsList = apiInfoContainer.createEl('ul');
            endpointsList.createEl('li', { text: 'GET /tasks - List all tasks' });
            endpointsList.createEl('li', { text: 'POST /tasks - Create a new task' });
            endpointsList.createEl('li', { text: 'PUT /tasks/:id - Update a task' });
            endpointsList.createEl('li', { text: 'DELETE /tasks/:id - Delete a task' });
        }

        // Webhooks Section
        createSectionHeader(container, 'Webhooks');
        
        // Webhook description
        const webhookDescEl = container.createDiv('setting-item-description');
        webhookDescEl.createEl('p', { text: 'Webhooks send real-time notifications to external services when TaskNotes events occur.' });
        webhookDescEl.createEl('p', { text: 'Configure webhooks to integrate with automation tools, sync services, or custom applications.' });

        // Webhook management
        renderWebhookList(container, plugin, save);
        
        // Add webhook button
        createButtonSetting(container, {
            name: 'Add Webhook',
            desc: 'Register a new webhook endpoint',
            buttonText: 'Add Webhook',
            onClick: async () => {
                // For now, show a notice that this feature is coming soon
                // The full modal implementation would be quite complex
                new Notice('Webhook configuration modal coming soon. Use the API tab to configure webhooks manually for now.');
            }
        });
    }

    // Other Integrations Section
    createSectionHeader(container, 'Plugin Integrations');
    createHelpText(container, 'Configure integrations with other Obsidian plugins.');

    // Bases integration (commented out for now due to type issues)
    // const basesFiles = (plugin.app as any).plugins?.plugins?.['bases']?.settings?.files || [];
    // if (basesFiles.length > 0) {
    //     createDropdownSetting(container, {
    //         name: 'Bases integration',
    //         desc: 'Integrate with Bases plugin for enhanced data management',
    //         options: [
    //             { value: '', label: 'Disabled' },
    //             ...basesFiles.map((file: any) => ({
    //                 value: file.path,
    //                 label: file.name || file.path
    //             }))
    //         ],
    //         getValue: () => (plugin.settings.icsIntegration as any).basesIntegration || '',
    //         setValue: async (value: string) => {
    //             (plugin.settings.icsIntegration as any).basesIntegration = value;
    //             save();
    //         }
    //     });
    // } else {
    //     createHelpText(container, 'Install the Bases plugin to enable enhanced data management features.');
    // }
}

function renderICSSubscriptionsList(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void): void {
    container.empty();

    if (!plugin.icsSubscriptionService) {
        createHelpText(container, 'ICS subscription service not available.');
        return;
    }

    const subscriptions = plugin.icsSubscriptionService.getSubscriptions();
    if (subscriptions.length === 0) {
        // Empty state with consistent styling
        const emptyState = container.createDiv('tasknotes-webhooks-empty-state');
        emptyState.createSpan('tasknotes-webhooks-empty-icon');
        emptyState.createSpan({
            text: 'No calendar subscriptions configured. Add a subscription to sync external calendars.',
            cls: 'tasknotes-webhooks-empty-text'
        });
        return;
    }

    // Create subscription cards container
    const subscriptionsContainer = container.createDiv('tasknotes-webhooks-container');
    
    subscriptions.forEach(subscription => {
        const subscriptionCard = subscriptionsContainer.createDiv('tasknotes-subscription-card');
        
        // Header section with name, URL and status
        const subscriptionHeader = subscriptionCard.createDiv('tasknotes-subscription-header');
        
        const urlSection = subscriptionHeader.createDiv('tasknotes-webhook-url-section');
        const colorIndicator = urlSection.createDiv('tasknotes-subscription-color-indicator');
        colorIndicator.style.setProperty('--subscription-color', subscription.color);
        colorIndicator.style.backgroundColor = subscription.color;
        
        const subscriptionInfo = urlSection.createDiv('tasknotes-subscription-info');
        subscriptionInfo.createSpan({
            text: subscription.name,
            cls: 'tasknotes-subscription-name-text'
        });
        subscriptionInfo.createSpan({
            text: subscription.url,
            cls: 'tasknotes-subscription-url-text'
        });

        // Status section
        const statusSection = subscriptionHeader.createDiv('tasknotes-webhook-status-section');
        const statusIndicator = statusSection.createSpan({
            cls: `tasknotes-webhook-status-indicator ${subscription.enabled ? 'active' : 'inactive'}`
        });
        statusIndicator.createSpan({
            text: subscription.enabled ? 'Enabled' : 'Disabled',
            cls: 'tasknotes-webhook-status-text'
        });

        // Config section with enable/disable toggle
        const subscriptionConfig = subscriptionCard.createDiv('tasknotes-subscription-config');
        
        const enabledRow = subscriptionConfig.createDiv('tasknotes-subscription-config-row');
        const enabledLabel = enabledRow.createSpan({
            text: 'Enabled:',
            cls: 'tasknotes-webhook-detail-label'
        });
        const enabledToggle = enabledRow.createEl('input', {
            type: 'checkbox',
            cls: 'tasknotes-status-input'
        });
        enabledToggle.checked = subscription.enabled;
        enabledToggle.addEventListener('change', async () => {
            try {
                await plugin.icsSubscriptionService!.updateSubscription(subscription.id, {
                    enabled: enabledToggle.checked
                });
                save();
                // Update status indicator
                if (enabledToggle.checked) {
                    statusIndicator.className = 'tasknotes-webhook-status-indicator active';
                    statusIndicator.querySelector('.tasknotes-webhook-status-text')!.textContent = 'Enabled';
                } else {
                    statusIndicator.className = 'tasknotes-webhook-status-indicator inactive';
                    statusIndicator.querySelector('.tasknotes-webhook-status-text')!.textContent = 'Disabled';
                }
            } catch (error) {
                console.error('Error toggling subscription:', error);
                new Notice('Failed to update subscription');
                // Revert toggle on error
                enabledToggle.checked = !enabledToggle.checked;
            }
        });

        // Actions section
        const subscriptionActions = subscriptionCard.createDiv('tasknotes-subscription-actions');
        
        // Refresh button
        const refreshBtn = subscriptionActions.createEl('button', {
            cls: 'tasknotes-subscription-action-btn',
            attr: {
                'aria-label': 'Refresh subscription'
            }
        });
        refreshBtn.createSpan({
            text: 'Refresh',
            cls: 'tasknotes-webhook-action-text'
        });
        
        refreshBtn.onclick = async () => {
            if (!subscription.enabled) {
                new Notice('Enable the subscription first');
                return;
            }
            
            const originalText = refreshBtn.querySelector('.tasknotes-webhook-action-text')!.textContent;
            refreshBtn.querySelector('.tasknotes-webhook-action-text')!.textContent = 'Refreshing...';
            refreshBtn.setAttribute('disabled', 'true');
            
            try {
                await plugin.icsSubscriptionService!.refreshSubscription(subscription.id);
                new Notice(`Refreshed "${subscription.name}"`);
            } catch (error) {
                console.error('Error refreshing subscription:', error);
                new Notice('Failed to refresh subscription');
            } finally {
                refreshBtn.querySelector('.tasknotes-webhook-action-text')!.textContent = originalText;
                refreshBtn.removeAttribute('disabled');
            }
        };

        // Delete button
        const deleteBtn = subscriptionActions.createEl('button', {
            cls: 'tasknotes-subscription-action-btn delete',
            attr: {
                'aria-label': 'Delete subscription'
            }
        });
        deleteBtn.createSpan({
            text: 'Delete',
            cls: 'tasknotes-webhook-action-text'
        });
        
        deleteBtn.onclick = async () => {
            const confirmed = await showConfirmationModal(plugin.app, {
                title: 'Delete Subscription',
                message: `Are you sure you want to delete the subscription "${subscription.name}"? This action cannot be undone.`,
                confirmText: 'Delete',
                cancelText: 'Cancel',
                isDestructive: true
            });

            if (confirmed) {
                try {
                    // Note: deleteSubscription method needs to be implemented
                    // await plugin.icsSubscriptionService!.deleteSubscription(subscription.id);
                    new Notice('Delete subscription functionality coming soon');
                    // renderIntegrationsTab(container.parentElement!, plugin, save);
                } catch (error) {
                    console.error('Error deleting subscription:', error);
                    new Notice('Failed to delete subscription');
                }
            }
        };
    });
}

function renderAddICSForm(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void): void {
    container.empty();

    const formContainer = container.createDiv('add-ics-form');
    const nameInput = formContainer.createEl('input', {
        type: 'text',
        placeholder: 'Calendar name',
        cls: 'settings-input ics-name-input'
    });

    const urlInput = formContainer.createEl('input', {
        type: 'url',
        placeholder: 'ICS/iCal URL',
        cls: 'settings-input ics-url-input'
    });

    const colorInput = formContainer.createEl('input', {
        type: 'color',
        value: '#6366f1',
        cls: 'settings-color-picker ics-color-input'
    });

    const addButton = formContainer.createEl('button', {
        text: 'Add Subscription',
        cls: 'tn-btn tn-btn--primary'
    });

    addButton.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        const url = urlInput.value.trim();
        const color = colorInput.value;

        if (!name || !url) {
            new Notice('Please provide both name and URL');
            return;
        }

        if (!plugin.icsSubscriptionService) {
            new Notice('ICS subscription service not available');
            return;
        }

        addButton.textContent = 'Adding...';
        addButton.disabled = true;

        try {
            await plugin.icsSubscriptionService.addSubscription({
                name,
                url,
                color,
                enabled: true,
                type: 'remote',
                refreshInterval: 3600000 // 1 hour
            });
            new Notice(`Added subscription "${name}"`);
            nameInput.value = '';
            urlInput.value = '';
            colorInput.value = '#6366f1';
            renderIntegrationsTab(container.parentElement!.parentElement!, plugin, save);
        } catch (error) {
            console.error('Error adding subscription:', error);
            new Notice('Failed to add subscription');
        } finally {
            addButton.textContent = 'Add Subscription';
            addButton.disabled = false;
        }
    });
}

function renderWebhookList(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void): void {
    // Clear existing webhook content
    const existingContainer = container.querySelector('.tasknotes-webhooks-container');
    if (existingContainer) {
        existingContainer.remove();
    }
    
    const webhooksContainer = container.createDiv('tasknotes-webhooks-container');
    
    if (!plugin.settings.webhooks || plugin.settings.webhooks.length === 0) {
        const emptyState = webhooksContainer.createDiv('tasknotes-webhooks-empty-state');
        emptyState.createSpan('tasknotes-webhooks-empty-icon');
        emptyState.createSpan({
            text: 'No webhooks configured. Add a webhook to receive real-time notifications.',
            cls: 'tasknotes-webhooks-empty-text'
        });
        return;
    }

    plugin.settings.webhooks.forEach((webhook, index) => {
        const webhookCard = webhooksContainer.createDiv('tasknotes-webhook-card');
        
        // Header section with URL and status
        const webhookHeader = webhookCard.createDiv('tasknotes-webhook-header');
        const urlSection = webhookHeader.createDiv('tasknotes-webhook-url-section');
        urlSection.createSpan('tasknotes-webhook-url-icon');
        urlSection.createSpan({
            text: webhook.url,
            cls: 'tasknotes-webhook-url'
        });

        const statusSection = webhookHeader.createDiv('tasknotes-webhook-status-section');
        const statusIndicator = statusSection.createSpan({
            cls: `tasknotes-webhook-status-indicator ${webhook.active ? 'active' : 'inactive'}`
        });
        statusIndicator.createSpan({
            text: webhook.active ? 'Active' : 'Inactive',
            cls: 'tasknotes-webhook-status-text'
        });

        // Content section with details
        const webhookContent = webhookCard.createDiv('tasknotes-webhook-content');
        
        // Events row
        const eventsRow = webhookContent.createDiv('tasknotes-webhook-detail-row');
        eventsRow.createSpan({
            text: 'Events:',
            cls: 'tasknotes-webhook-detail-label'
        });
        eventsRow.createSpan({
            text: webhook.events.join(', '),
            cls: 'tasknotes-webhook-detail-value'
        });

        // Statistics row
        const statsRow = webhookContent.createDiv('tasknotes-webhook-detail-row');
        statsRow.createSpan({
            text: 'Statistics:',
            cls: 'tasknotes-webhook-detail-label'
        });
        const statsValue = statsRow.createSpan('tasknotes-webhook-stats');
        const successSpan = statsValue.createSpan('tasknotes-webhook-stat-success');
        successSpan.createSpan({ text: `✓ ${webhook.successCount || 0}` });
        const failureSpan = statsValue.createSpan('tasknotes-webhook-stat-failure');
        failureSpan.createSpan({ text: `✗ ${webhook.failureCount || 0}` });

        // Actions section
        const webhookActions = webhookCard.createDiv('tasknotes-webhook-actions');
        
        // Toggle button
        const toggleBtn = webhookActions.createEl('button', {
            cls: `tasknotes-webhook-action-btn ${webhook.active ? 'disable' : 'enable'}`,
            attr: {
                'aria-label': webhook.active ? 'Disable webhook' : 'Enable webhook'
            }
        });
        toggleBtn.createSpan({
            text: webhook.active ? 'Disable' : 'Enable',
            cls: 'tasknotes-webhook-action-text'
        });
        
        toggleBtn.onclick = async () => {
            webhook.active = !webhook.active;
            save();
            renderWebhookList(container, plugin, save);
            new Notice(`Webhook ${webhook.active ? 'enabled' : 'disabled'}`);
        };

        // Delete button
        const deleteBtn = webhookActions.createEl('button', {
            cls: 'tasknotes-webhook-action-btn delete',
            attr: {
                'aria-label': 'Delete webhook'
            }
        });
        deleteBtn.createSpan({
            text: 'Delete',
            cls: 'tasknotes-webhook-action-text'
        });
        
        deleteBtn.onclick = async () => {
            const confirmed = await showConfirmationModal(plugin.app, {
                title: 'Delete Webhook',
                message: `Are you sure you want to delete this webhook?\n\nURL: ${webhook.url}\n\nThis action cannot be undone.`,
                confirmText: 'Delete',
                cancelText: 'Cancel',
                isDestructive: true
            });
            
            if (confirmed) {
                plugin.settings.webhooks.splice(index, 1);
                save();
                renderWebhookList(container, plugin, save);
                new Notice('Webhook deleted');
            }
        };
    });
}