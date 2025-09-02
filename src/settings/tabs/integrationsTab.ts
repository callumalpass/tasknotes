import { Notice, Platform, Modal, Setting, setIcon, App } from 'obsidian';
import TaskNotesPlugin from '../../main';
import { WebhookConfig } from '../../types';
import { loadAPIEndpoints } from '../../api/loadAPIEndpoints';
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
import { 
    createCard, 
    createStatusBadge, 
    createCardInput, 
    createDeleteHeaderButton,
    createCardUrlInput,
    createCardNumberInput,
    createInfoBadge,
    createEditHeaderButton,
    showCardEmptyState
} from '../components/CardComponent';

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
 * Helper function to format relative time (e.g., "2 hours ago", "5 minutes ago")
 */
function getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
        return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else {
        return 'Just now';
    }
}

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

    // ICS Subscriptions List - Add proper section header
    createSectionHeader(container, 'Calendar Subscriptions List');
    const icsContainer = container.createDiv('ics-subscriptions-container');
    renderICSSubscriptionsList(icsContainer, plugin, save);

    // Add subscription button
    createButtonSetting(container, {
        name: 'Add Calendar Subscription',
        desc: 'Add a new calendar subscription from ICS/iCal URL or local file',
        buttonText: 'Add Subscription',
        onClick: async () => {
            // Create a new subscription with temporary values
            const newSubscription = {
                name: 'New Calendar',
                url: '',
                color: '#6366f1',
                enabled: false, // Start disabled until user fills in details
                type: 'remote' as const,
                refreshInterval: 60
            };

            if (!plugin.icsSubscriptionService) {
                new Notice('ICS subscription service not available');
                return;
            }

            try {
                await plugin.icsSubscriptionService.addSubscription(newSubscription);
                new Notice('New calendar subscription added - please configure the details');
                // Re-render to show the new subscription card
                renderICSSubscriptionsList(icsContainer, plugin, save);
            } catch (error) {
                console.error('Error adding subscription:', error);
                new Notice('Failed to add subscription');
            }
        }
    });

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
            const apiInfoContainer = container.createDiv('tasknotes-settings__help-section');
            const apiHeader = apiInfoContainer.createDiv('tasknotes-settings__collapsible-header');
            const apiHeaderContent = apiHeader.createDiv('tasknotes-settings__collapsible-header-content');
            const apiToggleIcon = apiHeaderContent.createSpan('tasknotes-settings__collapsible-icon');
            apiToggleIcon.textContent = '▶';
            apiHeaderContent.createSpan({ text: 'Available API Endpoints', cls: 'tasknotes-settings__collapsible-title' });
            
            const apiEndpointsContent = apiInfoContainer.createDiv('tasknotes-settings__collapsible-content');
            apiEndpointsContent.style.display = 'none'; // Start collapsed
            
            // Toggle functionality
            apiHeader.addEventListener('click', () => {
                const isExpanded = apiEndpointsContent.style.display !== 'none';
                apiEndpointsContent.style.display = isExpanded ? 'none' : 'block';
                apiToggleIcon.textContent = isExpanded ? '▶' : '▼';
            });

            // Fetch live API documentation
            loadAPIEndpoints(apiEndpointsContent, plugin.settings.apiPort);
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
                const modal = new WebhookModal(plugin.app, async (webhookConfig: Partial<WebhookConfig>) => {
                    // Generate ID and secret
                    const webhook: WebhookConfig = {
                        id: `wh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                        url: webhookConfig.url || '',
                        events: webhookConfig.events || [],
                        secret: generateWebhookSecret(),
                        active: true,
                        createdAt: new Date().toISOString(),
                        failureCount: 0,
                        successCount: 0,
                        transformFile: webhookConfig.transformFile,
                        corsHeaders: webhookConfig.corsHeaders
                    };

                    if (!plugin.settings.webhooks) {
                        plugin.settings.webhooks = [];
                    }

                    plugin.settings.webhooks.push(webhook);
                    save();
                    
                    // Re-render webhook list to show the new webhook
                    renderWebhookList(container.querySelector('.tasknotes-webhooks-container')?.parentElement || container, plugin, save);
                    
                    // Show success message with secret
                    new SecretNoticeModal(plugin.app, webhook.secret).open();
                    new Notice('Webhook created successfully');
                });
                modal.open();
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

    subscriptions.forEach(subscription => {
        // Create input elements
        const enabledToggle = createCardInput('checkbox');
        enabledToggle.checked = subscription.enabled;
        
        const nameInput = createCardInput('text', 'Calendar name', subscription.name);
        
        // Create type dropdown
        const typeSelect = document.createElement('select');
        typeSelect.className = 'tasknotes-settings__card-input';
        typeSelect.innerHTML = `
            <option value="remote" ${subscription.type === 'remote' ? 'selected' : ''}>Remote URL</option>
            <option value="local" ${subscription.type === 'local' ? 'selected' : ''}>Local File</option>
        `;
        
        // Create input based on type
        let sourceInput: HTMLElement;
        if (subscription.type === 'remote') {
            sourceInput = createCardUrlInput('ICS/iCal URL', subscription.url);
        } else {
            const fileInput = createCardInput('text', 'Local file path (e.g., Calendar.ics)', subscription.filePath || '');
            fileInput.setAttribute('placeholder', 'Calendar.ics');
            sourceInput = fileInput;
        }
        
        const colorInput = createCardInput('color', '', subscription.color);
        const refreshInput = createCardNumberInput(5, 1440, 5, subscription.refreshInterval || 60);
        
        // Update handlers
        const updateSubscription = async (updates: Partial<typeof subscription>) => {
            try {
                await plugin.icsSubscriptionService!.updateSubscription(subscription.id, updates);
                save();
                renderICSSubscriptionsList(container, plugin, save);
            } catch (error) {
                console.error('Error updating subscription:', error);
                new Notice('Failed to update subscription');
                // Revert changes if needed
                renderICSSubscriptionsList(container, plugin, save);
            }
        };
        
        // Update handlers
        enabledToggle.addEventListener('change', () => updateSubscription({ enabled: enabledToggle.checked }));
        nameInput.addEventListener('blur', () => updateSubscription({ name: nameInput.value.trim() }));
        colorInput.addEventListener('change', () => updateSubscription({ color: colorInput.value }));
        refreshInput.addEventListener('blur', () => {
            const minutes = parseInt(refreshInput.value) || 60;
            updateSubscription({ refreshInterval: minutes });
        });

        // Type change handler - re-render the subscription list to update input type
        typeSelect.addEventListener('change', async () => {
            const newType = typeSelect.value as 'remote' | 'local';
            const oldType = subscription.type;
            
            // Update the subscription object
            subscription.type = newType;
            if (newType === 'remote') {
                subscription.url = subscription.filePath || ''; // Transfer old local path to url if exists
                subscription.filePath = undefined;
            } else {
                subscription.filePath = subscription.url || ''; // Transfer old url to local path if exists
                subscription.url = undefined;
            }
            save();

            // Dynamically replace the source input element
            const card = typeSelect.closest('.tasknotes-settings__card');
            if (card) {
                const sourceInputContainer = card.querySelector('.tasknotes-settings__card-config-row:nth-child(4)'); // Assuming it's the 4th row
                if (sourceInputContainer) {
                    const oldSourceInput = sourceInputContainer.querySelector('input');
                    if (oldSourceInput) {
                        oldSourceInput.remove();
                    }

                    let newSourceInput: HTMLElement;
                    if (newType === 'remote') {
                        newSourceInput = createCardUrlInput('ICS/iCal URL', subscription.url);
                    } else {
                        const fileInput = createCardInput('text', 'Local file path (e.g., Calendar.ics)', subscription.filePath || '');
                        fileInput.setAttribute('placeholder', 'Calendar.ics');
                        newSourceInput = fileInput;
                    }

                    // Re-add event listener for the new input
                    newSourceInput.addEventListener('blur', () => {
                        const value = (newSourceInput as HTMLInputElement).value.trim();
                        if (subscription.type === 'remote') {
                            updateSubscription({ url: value });
                        } else {
                            updateSubscription({ filePath: value });
                        }
                    });

                    sourceInputContainer.appendChild(newSourceInput);

                    // Update the label for the source input
                    const labelElement = sourceInputContainer.querySelector('.tasknotes-settings__card-config-label');
                    if (labelElement) {
                        labelElement.textContent = newType === 'remote' ? 'URL:' : 'File Path:';
                    }

                    // Update the secondary text in the header
                    const secondaryText = card.querySelector('.tasknotes-settings__card-secondary-text');
                    if (secondaryText) {
                        secondaryText.textContent = newType === 'remote' ? 'Remote Calendar' : 'Local File';
                    }

                    // Update the type badge
                    const typeBadge = card.querySelector('.tasknotes-settings__card-meta .info-badge'); // Assuming info-badge is the class for type badge
                    if (typeBadge) {
                        typeBadge.textContent = newType === 'remote' ? 'Remote' : 'Local File';
                    }
                }
            }
        });

        // Source input handler (URL or file path)
        sourceInput.addEventListener('blur', () => {
            const value = (sourceInput as HTMLInputElement).value.trim();
            if (subscription.type === 'remote') {
                updateSubscription({ url: value });
            } else {
                updateSubscription({ filePath: value });
            }
        });

        // Create meta badges
        const statusBadge = createStatusBadge(
            subscription.enabled ? 'Enabled' : 'Disabled',
            subscription.enabled ? 'active' : 'inactive'
        );
        
        const typeBadge = createInfoBadge(
            subscription.type === 'remote' ? 'Remote' : 'Local File'
        );
        
        const metaBadges = [statusBadge, typeBadge];
        
        // Add last sync badge if available
        if (subscription.lastFetched) {
            const lastSyncDate = new Date(subscription.lastFetched);
            const timeAgo = getRelativeTime(lastSyncDate);
            const syncBadge = createInfoBadge(`Synced ${timeAgo}`);
            metaBadges.push(syncBadge);
        }
        
        // Add error badge if there's an error
        if (subscription.lastError) {
            const errorBadge = createStatusBadge('Error', 'inactive');
            errorBadge.title = subscription.lastError; // Show error on hover
            metaBadges.push(errorBadge);
        }

        // Build content rows
        const contentRows: { label: string; input: HTMLElement; fullWidth?: boolean; }[] = [
            { label: 'Enabled:', input: enabledToggle },
            { label: 'Name:', input: nameInput },
            { label: 'Type:', input: typeSelect },
            { 
                label: subscription.type === 'remote' ? 'URL:' : 'File Path:', 
                input: sourceInput, 
            },
            { label: 'Color:', input: colorInput },
            { label: 'Refresh (min):', input: refreshInput }
        ];

        const card = createCard(container, {
            id: subscription.id,
            colorIndicator: {
                color: subscription.color
            },
            header: {
                primaryText: subscription.name,
                secondaryText: subscription.type === 'remote' ? 'Remote Calendar' : 'Local File',
                meta: metaBadges,
                actions: [
                    createEditHeaderButton(() => {
                        // Toggle between edit and view mode by focusing the name input
                        nameInput.focus();
                        nameInput.select();
                    }, 'Edit subscription'),
                    createDeleteHeaderButton(async () => {
                        const confirmed = await showConfirmationModal(plugin.app, {
                            title: 'Delete Subscription',
                            message: `Are you sure you want to delete the subscription "${subscription.name}"? This action cannot be undone.`, 
                            confirmText: 'Delete',
                            cancelText: 'Cancel',
                            isDestructive: true
                        });

                        if (confirmed) {
                            try {
                                await plugin.icsSubscriptionService!.removeSubscription(subscription.id);
                                new Notice(`Deleted subscription "${subscription.name}"`);
                                save();
                                renderICSSubscriptionsList(container, plugin, save);
                            } catch (error) {
                                console.error('Error deleting subscription:', error);
                                new Notice('Failed to delete subscription');
                            }
                        }
                    }, 'Delete subscription')
                ]
            },
            content: {
                sections: [{ rows: contentRows }]
            },
            actions: {
                buttons: [{
                    text: 'Refresh Now',
                    icon: 'refresh-cw',
                    variant: subscription.enabled ? 'primary' : 'secondary',
                    disabled: !subscription.enabled,
                    onClick: async () => {
                        if (!subscription.enabled) {
                            new Notice('Enable the subscription first');
                            return;
                        }
                        
                        try {
                            await plugin.icsSubscriptionService!.refreshSubscription(subscription.id);
                            new Notice(`Refreshed "${subscription.name}"`);
                            // Re-render to show updated sync time
                            renderICSSubscriptionsList(container, plugin, save);
                        } catch (error) {
                            console.error('Error refreshing subscription:', error);
                            new Notice('Failed to refresh subscription');
                        }
                    }
                }]
            }
        });
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
        showCardEmptyState(
            webhooksContainer,
            'No webhooks configured. Add a webhook to receive real-time notifications.',
            'Add Webhook',
            () => {
                // This is a bit of a hack, but it's the easiest way to trigger the add webhook modal
                const addWebhookButton = container.closest('.settings-tab-content')?.querySelector('button.tn-btn--primary');
                if (addWebhookButton) {
                    (addWebhookButton as HTMLElement).click();
                }
            }
        );
        return;
    }

    plugin.settings.webhooks.forEach((webhook, index) => {
        const statusBadge = createStatusBadge(
            webhook.active ? 'Active' : 'Inactive',
            webhook.active ? 'active' : 'inactive'
        );

        const successBadge = createInfoBadge(`✓ ${webhook.successCount || 0}`);
        const failureBadge = createInfoBadge(`✗ ${webhook.failureCount || 0}`);
        
        // Create inputs for inline editing
        const urlInput = createCardUrlInput('Webhook URL', webhook.url);
        const activeToggle = createCardInput('checkbox');
        activeToggle.checked = webhook.active;
        
        // Update handlers
        urlInput.addEventListener('blur', () => {
            if (urlInput.value.trim() !== webhook.url) {
                webhook.url = urlInput.value.trim();
                save();
                new Notice('Webhook URL updated');
            }
        });
        
        activeToggle.addEventListener('change', () => {
            webhook.active = activeToggle.checked;
            save();
            
            // Update the status badge in place instead of re-rendering entire list
            const card = activeToggle.closest('.tasknotes-settings__card');
            if (card) {
                const statusBadge = card.querySelector('.tasknotes-settings__card-status-badge--active, .tasknotes-settings__card-status-badge--inactive');
                if (statusBadge) {
                    statusBadge.textContent = webhook.active ? 'Active' : 'Inactive';
                    statusBadge.className = webhook.active ? 
                        'tasknotes-settings__card-status-badge tasknotes-settings__card-status-badge--active' : 
                        'tasknotes-settings__card-status-badge tasknotes-settings__card-status-badge--inactive';
                }
                
                // Update test button disabled state
                const testButton = card.querySelector('[aria-label*="Test"]') as HTMLButtonElement;
                if (testButton) {
                    testButton.disabled = !webhook.active || !webhook.url;
                }
            }
            
            new Notice(`Webhook ${webhook.active ? 'enabled' : 'disabled'}`);
        });
        
        // Format webhook creation date
        const createdDate = webhook.createdAt ? new Date(webhook.createdAt) : null;
        const createdText = createdDate ? `Created ${getRelativeTime(createdDate)}` : 'Creation date unknown';
        
        // Create events display as a formatted string
        const eventsDisplay = document.createElement('div');
        eventsDisplay.style.display = 'flex';
        eventsDisplay.style.flexWrap = 'wrap';
        eventsDisplay.style.gap = '0.5rem';
        eventsDisplay.style.alignItems = 'center';
        eventsDisplay.style.minHeight = '1.5rem';
        eventsDisplay.style.lineHeight = '1.5rem';
        
        if (webhook.events.length === 0) {
            const noEventsSpan = document.createElement('span');
            noEventsSpan.textContent = 'No events selected';
            noEventsSpan.style.color = 'var(--text-muted)';
            noEventsSpan.style.fontStyle = 'italic';
            noEventsSpan.style.lineHeight = '1.5rem';
            eventsDisplay.appendChild(noEventsSpan);
        } else {
            webhook.events.forEach((event, i) => {
                const eventBadge = createInfoBadge(event);
                eventBadge.style.marginBottom = '0';
                eventBadge.style.flexShrink = '0';
                eventsDisplay.appendChild(eventBadge);
            });
        }
        
        // Create transform file display if exists
        const transformDisplay = webhook.transformFile ? 
            (() => {
                const span = document.createElement('span');
                span.textContent = webhook.transformFile;
                span.style.fontFamily = 'monospace';
                span.style.fontSize = '0.85rem';
                span.style.color = 'var(--text-muted)';
                span.style.lineHeight = '1.5rem';
                span.style.padding = '0.25rem 0.5rem';
                span.style.background = 'var(--background-modifier-form-field)';
                span.style.borderRadius = '4px';
                span.style.border = '1px solid var(--background-modifier-border)';
                return span;
            })() : 
            (() => {
                const span = document.createElement('span');
                span.textContent = 'Raw payload (no transform)';
                span.style.color = 'var(--text-muted)';
                span.style.fontStyle = 'italic';
                span.style.lineHeight = '1.5rem';
                return span;
            })();

        createCard(webhooksContainer, {
            id: webhook.id,
            header: {
                primaryText: 'Webhook',
                secondaryText: createdText,
                meta: [statusBadge, successBadge, failureBadge],
                actions: [
                    createDeleteHeaderButton(async () => {
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
                    })
                ]
            },
            content: {
                sections: [
                    {
                        rows: [
                            { label: 'Active:', input: activeToggle },
                            { label: 'URL:', input: urlInput },
                            { label: 'Events:', input: eventsDisplay },
                            { label: 'Transform:', input: transformDisplay }
                        ]
                    }
                ]
            },
            actions: {
                buttons: [
                    {
                        text: 'Edit Events',
                        icon: 'settings',
                        variant: 'secondary',
                        onClick: async () => {
                            const modal = new WebhookEditModal(plugin.app, webhook, async (updatedConfig: Partial<WebhookConfig>) => {
                                Object.assign(webhook, updatedConfig);
                                save();
                                renderWebhookList(container, plugin, save);
                                new Notice('Webhook updated');
                            });
                            modal.open();
                        }
                    },
                    
                ]
            }
        });
    });
}

/**
 * Generate secure webhook secret
 */
function generateWebhookSecret(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Modal for displaying webhook secret after creation
 */
class SecretNoticeModal extends Modal {
    private secret: string;
    
    constructor(app: App, secret: string) {
        super(app);
        this.secret = secret;
    }
    
    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('tasknotes-webhook-modal');
        
        const notice = contentEl.createDiv({ cls: 'tasknotes-webhook-secret-notice' });
        
        const title = notice.createDiv({ cls: 'tasknotes-webhook-secret-title' });
        const titleIcon = title.createSpan();
        setIcon(titleIcon, 'shield-check');
        title.createSpan({ text: 'Webhook Secret Generated' });
        
        const content = notice.createDiv({ cls: 'tasknotes-webhook-secret-content' });
        content.createEl('p', { text: 'Your webhook secret has been generated. Save this secret as you won\'t be able to view it again:' });
        content.createEl('code', { text: this.secret, cls: 'tasknotes-webhook-secret-code' });
        content.createEl('p', { text: 'Use this secret to verify webhook payloads in your receiving application.' });
        
        const buttonContainer = contentEl.createDiv({ cls: 'tasknotes-webhook-modal-buttons' });
        const closeBtn = buttonContainer.createEl('button', {
            text: 'Got it',
            cls: 'tasknotes-webhook-modal-btn save'
        });
        closeBtn.onclick = () => this.close();
    }
    
    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Modal for editing existing webhooks
 */
class WebhookEditModal extends Modal {
    private webhook: WebhookConfig;
    private selectedEvents: string[];
    private transformFile: string;
    private corsHeaders: boolean;
    private onSubmit: (config: Partial<WebhookConfig>) => void;

    constructor(app: App, webhook: WebhookConfig, onSubmit: (config: Partial<WebhookConfig>) => void) {
        super(app);
        this.webhook = webhook;
        this.selectedEvents = [...webhook.events];
        this.transformFile = webhook.transformFile || '';
        this.corsHeaders = webhook.corsHeaders ?? true;
        this.onSubmit = onSubmit;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('tasknotes-webhook-modal');

        // Modal header with icon
        const header = contentEl.createDiv({ cls: 'tasknotes-webhook-modal-header' });
        const headerIcon = header.createSpan({ cls: 'tasknotes-webhook-modal-icon' });
        setIcon(headerIcon, 'webhook');
        header.createEl('h2', { text: 'Edit Webhook', cls: 'tasknotes-webhook-modal-title' });

        // Events selection section
        const eventsSection = contentEl.createDiv({ cls: 'tasknotes-webhook-modal-section' });
        const eventsHeader = eventsSection.createDiv({ cls: 'tasknotes-webhook-modal-subsection-header' });
        const eventsIcon = eventsHeader.createSpan();
        setIcon(eventsIcon, 'zap');
        eventsHeader.createEl('h3', { text: 'Events to subscribe to' });

        const eventsGrid = eventsSection.createDiv({ cls: 'tasknotes-webhook-events-list' });
        const availableEvents = [
            { id: 'task.created', label: 'Task Created', desc: 'When new tasks are created' },
            { id: 'task.updated', label: 'Task Updated', desc: 'When tasks are modified' },
            { id: 'task.completed', label: 'Task Completed', desc: 'When tasks are marked complete' },
            { id: 'task.deleted', label: 'Task Deleted', desc: 'When tasks are deleted' },
            { id: 'task.archived', label: 'Task Archived', desc: 'When tasks are archived' },
            { id: 'task.unarchived', label: 'Task Unarchived', desc: 'When tasks are unarchived' },
            { id: 'time.started', label: 'Time Started', desc: 'When time tracking starts' },
            { id: 'time.stopped', label: 'Time Stopped', desc: 'When time tracking stops' },
            { id: 'pomodoro.started', label: 'Pomodoro Started', desc: 'When pomodoro sessions begin' },
            { id: 'pomodoro.completed', label: 'Pomodoro Completed', desc: 'When pomodoro sessions finish' },
            { id: 'pomodoro.interrupted', label: 'Pomodoro Interrupted', desc: 'When pomodoro sessions are stopped' },
            { id: 'recurring.instance.completed', label: 'Recurring Instance Completed', desc: 'When recurring task instances complete' },
            { id: 'reminder.triggered', label: 'Reminder Triggered', desc: 'When task reminders activate' }
        ];

        availableEvents.forEach(event => {
            new Setting(eventsGrid)
                .setName(event.label)
                .setDesc(event.desc)
                .addToggle(toggle => {
                    toggle.toggleEl.setAttribute('aria-label', `Subscribe to ${event.label} events`);
                    return toggle
                        .setValue(this.selectedEvents.includes(event.id))
                        .onChange((value) => {
                            if (value) {
                                this.selectedEvents.push(event.id);
                            } else {
                                const index = this.selectedEvents.indexOf(event.id);
                                if (index > -1) {
                                    this.selectedEvents.splice(index, 1);
                                }
                            }
                        });
                });
        });

        // Transform file section
        const transformSection = contentEl.createDiv({ cls: 'tasknotes-webhook-modal-section' });
        const transformHeader = transformSection.createDiv({ cls: 'tasknotes-webhook-modal-subsection-header' });
        const transformIcon = transformHeader.createSpan();
        setIcon(transformIcon, 'file-code');
        transformHeader.createEl('h3', { text: 'Transform Configuration (Optional)' });

        new Setting(transformSection)
            .setName('Transform File')
            .setDesc('Path to a .js or .json file in your vault that transforms webhook payloads')
            .addText(text => {
                text.inputEl.setAttribute('aria-label', 'Transform file path');
                return text
                    .setPlaceholder('discord-transform.js')
                    .setValue(this.transformFile)
                    .onChange((value) => {
                        this.transformFile = value;
                    });
            });

        // CORS headers section
        const corsSection = contentEl.createDiv({ cls: 'tasknotes-webhook-modal-section' });
        const corsHeader = corsSection.createDiv({ cls: 'tasknotes-webhook-modal-subsection-header' });
        const corsIcon = corsHeader.createSpan();
        setIcon(corsIcon, 'settings');
        corsHeader.createEl('h3', { text: 'Headers Configuration' });

        new Setting(corsSection)
            .setName('Include custom headers')
            .setDesc('Include TaskNotes headers (event type, signature, delivery ID). Turn off for Discord, Slack, and other services with strict CORS policies.')
            .addToggle(toggle => {
                toggle.toggleEl.setAttribute('aria-label', 'Include custom headers');
                return toggle
                    .setValue(this.corsHeaders)
                    .onChange((value) => {
                        this.corsHeaders = value;
                    });
            });

        // Buttons section
        const buttonContainer = contentEl.createDiv({ cls: 'tasknotes-webhook-modal-buttons' });

        const cancelBtn = buttonContainer.createEl('button', {
            text: 'Cancel',
            cls: 'tasknotes-webhook-modal-btn cancel',
            attr: { 'aria-label': 'Cancel webhook editing' }
        });
        const cancelIcon = cancelBtn.createSpan({ cls: 'tasknotes-webhook-modal-btn-icon' });
        setIcon(cancelIcon, 'x');
        cancelBtn.onclick = () => this.close();

        const saveBtn = buttonContainer.createEl('button', {
            text: 'Save Changes',
            cls: 'tasknotes-webhook-modal-btn save mod-cta',
            attr: { 'aria-label': 'Save webhook changes' }
        });
        const saveIcon = saveBtn.createSpan({ cls: 'tasknotes-webhook-modal-btn-icon' });
        setIcon(saveIcon, 'save');

        saveBtn.onclick = () => {
            if (this.selectedEvents.length === 0) {
                new Notice('Please select at least one event');
                return;
            }

            this.onSubmit({
                events: this.selectedEvents as any[],
                transformFile: this.transformFile.trim() || undefined,
                corsHeaders: this.corsHeaders
            });

            this.close();
        };
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Modal for adding/editing webhooks
 */
class WebhookModal extends Modal {
    private url = '';
    private selectedEvents: string[] = [];
    private transformFile = '';
    private corsHeaders = true;
    private onSubmit: (config: Partial<WebhookConfig>) => void;

    constructor(app: App, onSubmit: (config: Partial<WebhookConfig>) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('tasknotes-webhook-modal');

        // Modal header with icon
        const header = contentEl.createDiv({ cls: 'tasknotes-webhook-modal-header' });
        const headerIcon = header.createSpan({ cls: 'tasknotes-webhook-modal-icon' });
        setIcon(headerIcon, 'webhook');
        header.createEl('h2', { text: 'Add Webhook', cls: 'tasknotes-webhook-modal-title' });

        // URL input section
        const urlSection = contentEl.createDiv({ cls: 'tasknotes-webhook-modal-section' });
        new Setting(urlSection)
            .setName('Webhook URL')
            .setDesc('The endpoint where webhook payloads will be sent')
            .addText(text => {
                text.inputEl.setAttribute('aria-label', 'Webhook URL');
                return text
                    .setPlaceholder('https://your-service.com/webhook')
                    .setValue(this.url)
                    .onChange((value) => {
                        this.url = value;
                    });
            });

        // Events selection section
        const eventsSection = contentEl.createDiv({ cls: 'tasknotes-webhook-modal-section' });
        const eventsHeader = eventsSection.createDiv({ cls: 'tasknotes-webhook-modal-subsection-header' });
        const eventsIcon = eventsHeader.createSpan();
        setIcon(eventsIcon, 'zap');
        eventsHeader.createEl('h3', { text: 'Events to subscribe to' });

        const eventsGrid = eventsSection.createDiv({ cls: 'tasknotes-webhook-events-list' });
        const availableEvents = [
            { id: 'task.created', label: 'Task Created', desc: 'When new tasks are created' },
            { id: 'task.updated', label: 'Task Updated', desc: 'When tasks are modified' },
            { id: 'task.completed', label: 'Task Completed', desc: 'When tasks are marked complete' },
            { id: 'task.deleted', label: 'Task Deleted', desc: 'When tasks are deleted' },
            { id: 'task.archived', label: 'Task Archived', desc: 'When tasks are archived' },
            { id: 'task.unarchived', label: 'Task Unarchived', desc: 'When tasks are unarchived' },
            { id: 'time.started', label: 'Time Started', desc: 'When time tracking starts' },
            { id: 'time.stopped', label: 'Time Stopped', desc: 'When time tracking stops' },
            { id: 'pomodoro.started', label: 'Pomodoro Started', desc: 'When pomodoro sessions begin' },
            { id: 'pomodoro.completed', label: 'Pomodoro Completed', desc: 'When pomodoro sessions finish' },
            { id: 'pomodoro.interrupted', label: 'Pomodoro Interrupted', desc: 'When pomodoro sessions are stopped' },
            { id: 'recurring.instance.completed', label: 'Recurring Instance Completed', desc: 'When recurring task instances complete' },
            { id: 'reminder.triggered', label: 'Reminder Triggered', desc: 'When task reminders activate' }
        ];

        availableEvents.forEach(event => {
            new Setting(eventsGrid)
                .setName(event.label)
                .setDesc(event.desc)
                .addToggle(toggle => {
                    toggle.toggleEl.setAttribute('aria-label', `Subscribe to ${event.label} events`);
                    return toggle
                        .setValue(this.selectedEvents.includes(event.id))
                        .onChange((value) => {
                            if (value) {
                                this.selectedEvents.push(event.id);
                            } else {
                                const index = this.selectedEvents.indexOf(event.id);
                                if (index > -1) {
                                    this.selectedEvents.splice(index, 1);
                                }
                            }
                        });
                });
        });

        // Transform file section
        const transformSection = contentEl.createDiv({ cls: 'tasknotes-webhook-modal-section' });
        const transformHeader = transformSection.createDiv({ cls: 'tasknotes-webhook-modal-subsection-header' });
        const transformIcon = transformHeader.createSpan();
        setIcon(transformIcon, 'file-code');
        transformHeader.createEl('h3', { text: 'Transform Configuration (Optional)' });

        new Setting(transformSection)
            .setName('Transform File')
            .setDesc('Path to a .js or .json file in your vault that transforms webhook payloads')
            .addText(text => {
                text.inputEl.setAttribute('aria-label', 'Transform file path');
                return text
                    .setPlaceholder('discord-transform.js')
                    .setValue(this.transformFile)
                    .onChange((value) => {
                        this.transformFile = value;
                    });
            });

        // Transform help section
        const transformHelp = transformSection.createDiv({ cls: 'tasknotes-webhook-transform-help' });
        const helpHeader = transformHelp.createDiv({ cls: 'tasknotes-webhook-help-header' });
        const helpIcon = helpHeader.createSpan();
        setIcon(helpIcon, 'info');
        helpHeader.createSpan({ text: 'Transform files allow you to customize webhook payloads:' });

        const helpList = transformHelp.createEl('ul', { cls: 'tasknotes-webhook-help-list' });
        const jsLi = helpList.createEl('li');
        jsLi.createEl('strong', { text: '.js files:' });
        jsLi.appendText(' Custom JavaScript transforms');

        const jsonLi = helpList.createEl('li');
        jsonLi.createEl('strong', { text: '.json files:' });
        jsonLi.appendText(' Templates with ');
        jsonLi.createEl('code', { text: '${data.task.title}' });

        const emptyLi = helpList.createEl('li');
        emptyLi.createEl('strong', { text: 'Leave empty:' });
        emptyLi.appendText(' Send raw data');

        const helpExample = transformHelp.createDiv({ cls: 'tasknotes-webhook-help-example' });
        helpExample.createEl('strong', { text: 'Example:' });
        helpExample.appendText(' ');
        helpExample.createEl('code', { text: 'discord-transform.js' });

        // CORS headers section
        const corsSection = contentEl.createDiv({ cls: 'tasknotes-webhook-modal-section' });
        const corsHeader = corsSection.createDiv({ cls: 'tasknotes-webhook-modal-subsection-header' });
        const corsIcon = corsHeader.createSpan();
        setIcon(corsIcon, 'settings');
        corsHeader.createEl('h3', { text: 'Headers Configuration' });

        new Setting(corsSection)
            .setName('Include custom headers')
            .setDesc('Include TaskNotes headers (event type, signature, delivery ID). Turn off for Discord, Slack, and other services with strict CORS policies.')
            .addToggle(toggle => {
                toggle.toggleEl.setAttribute('aria-label', 'Include custom headers');
                return toggle
                    .setValue(this.corsHeaders)
                    .onChange((value) => {
                        this.corsHeaders = value;
                    });
            });

        // Buttons section
        const buttonContainer = contentEl.createDiv({ cls: 'tasknotes-webhook-modal-buttons' });

        const cancelBtn = buttonContainer.createEl('button', {
            text: 'Cancel',
            cls: 'tasknotes-webhook-modal-btn cancel',
            attr: { 'aria-label': 'Cancel webhook creation' }
        });
        const cancelIcon = cancelBtn.createSpan({ cls: 'tasknotes-webhook-modal-btn-icon' });
        setIcon(cancelIcon, 'x');
        cancelBtn.onclick = () => this.close();

        const saveBtn = buttonContainer.createEl('button', {
            text: 'Add Webhook',
            cls: 'tasknotes-webhook-modal-btn save mod-cta',
            attr: { 'aria-label': 'Create webhook' }
        });
        const saveIcon = saveBtn.createSpan({ cls: 'tasknotes-webhook-modal-btn-icon' });
        setIcon(saveIcon, 'plus');

        saveBtn.onclick = () => {
            if (!this.url.trim()) {
                new Notice('Webhook URL is required');
                return;
            }

            if (this.selectedEvents.length === 0) {
                new Notice('Please select at least one event');
                return;
            }

            this.onSubmit({
                url: this.url.trim(),
                events: this.selectedEvents as any[],
                transformFile: this.transformFile.trim() || undefined,
                corsHeaders: this.corsHeaders
            });

            this.close();
        };
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
