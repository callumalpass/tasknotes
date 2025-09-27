import { Setting } from 'obsidian';
import TaskNotesPlugin from '../../main';
import type { TranslationKey } from '../../i18n';
import {
    createSectionHeader,
    createTextSetting,
    createToggleSetting,
    createDropdownSetting,
    createNumberSetting,
    createHelpText
} from '../components/settingHelpers';

/**
 * Renders the Appearance & UI tab - visual customization settings
 */
export function renderAppearanceTab(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void): void {
    container.empty();

    const translate = (key: TranslationKey, params?: Record<string, string | number>) => plugin.i18n.translate(key, params);

    // Task Cards Section
    createSectionHeader(container, translate('settings.appearance.taskCards.header'));
    createHelpText(container, translate('settings.appearance.taskCards.description'));

    // Default visible properties
    const visiblePropsContainer = container.createDiv('visible-properties-container');
    const visiblePropsSetting = visiblePropsContainer.createDiv();
    
    new Setting(visiblePropsSetting)
        .setName(translate('settings.appearance.taskCards.defaultVisibleProperties.name'))
        .setDesc(translate('settings.appearance.taskCards.defaultVisibleProperties.description'));

    // Create property toggles organized by category like PropertyVisibilityDropdown
    const propertyGroups: Record<string, Array<{key: string, label: string}>> = {
        core: [
            { key: 'status', label: translate('settings.appearance.taskCards.properties.status') },
            { key: 'priority', label: translate('settings.appearance.taskCards.properties.priority') },
            { key: 'due', label: translate('settings.appearance.taskCards.properties.due') },
            { key: 'scheduled', label: translate('settings.appearance.taskCards.properties.scheduled') },
            { key: 'timeEstimate', label: translate('settings.appearance.taskCards.properties.timeEstimate') },
            { key: 'totalTrackedTime', label: translate('settings.appearance.taskCards.properties.totalTrackedTime') },
            { key: 'recurrence', label: translate('settings.appearance.taskCards.properties.recurrence') },
            { key: 'completedDate', label: translate('settings.appearance.taskCards.properties.completedDate') },
            { key: 'file.ctime', label: translate('settings.appearance.taskCards.properties.createdDate') },
            { key: 'file.mtime', label: translate('settings.appearance.taskCards.properties.modifiedDate') }
        ],
        organization: [
            { key: 'projects', label: translate('settings.appearance.taskCards.properties.projects') },
            { key: 'contexts', label: translate('settings.appearance.taskCards.properties.contexts') },
            { key: 'tags', label: translate('settings.appearance.taskCards.properties.tags') }
        ],
        user: []
    };

    // Add user fields to options
    if (plugin.settings.userFields) {
        plugin.settings.userFields.forEach(field => {
            if (field.displayName && field.key) {
                propertyGroups.user.push({
                    key: `user:${field.id}`,
                    label: field.displayName
                });
            }
        });
    }

    const defaultVisible = plugin.settings.defaultVisibleProperties || [];
    const propertyTogglesContainer = visiblePropsContainer.createDiv('tasknotes-settings__properties-container');
    
    // Render each property group
    const renderPropertyGroup = (groupName: string, properties: {key: string, label: string}[]) => {
        if (properties.length === 0) return;
        
        const groupContainer = propertyTogglesContainer.createDiv('tasknotes-settings__property-group');
        const groupHeader = groupContainer.createDiv('tasknotes-settings__property-group-header');
        groupHeader.textContent = groupName;
        
        const groupToggles = groupContainer.createDiv('tasknotes-settings__property-toggles');
        
        properties.forEach(prop => {
            const toggleContainer = groupToggles.createDiv('tasknotes-settings__property-toggle');
            const checkbox = toggleContainer.createEl('input', {
                type: 'checkbox',
                cls: 'tasknotes-settings__property-checkbox',
                attr: {
                    'id': `visible-prop-${prop.key}`,
                    'aria-label': `Show ${prop.label} on task cards`
                }
            });
            
            checkbox.checked = defaultVisible.includes(prop.key);
            
            const label = toggleContainer.createEl('label', {
                text: prop.label,
                cls: 'tasknotes-settings__property-label',
                attr: { 'for': `visible-prop-${prop.key}` }
            });

            checkbox.addEventListener('change', () => {
                let updatedVisible = [...defaultVisible];
                if (checkbox.checked) {
                    if (!updatedVisible.includes(prop.key)) {
                        updatedVisible.push(prop.key);
                    }
                } else {
                    updatedVisible = updatedVisible.filter(key => key !== prop.key);
                }
                plugin.settings.defaultVisibleProperties = updatedVisible;
                save();
            });
        });
    };
    
    // Render groups in order
    renderPropertyGroup(translate('settings.appearance.taskCards.propertyGroups.coreProperties'), propertyGroups.core);
    renderPropertyGroup(translate('settings.appearance.taskCards.propertyGroups.organization'), propertyGroups.organization);
    if (propertyGroups.user.length > 0) {
        renderPropertyGroup(translate('settings.appearance.taskCards.propertyGroups.customProperties'), propertyGroups.user);
    }

    // Task Filenames Section
    createSectionHeader(container, translate('settings.appearance.taskFilenames.header'));
    createHelpText(container, translate('settings.appearance.taskFilenames.description'));

    createToggleSetting(container, {
        name: translate('settings.appearance.taskFilenames.storeTitleInFilename.name'),
        desc: translate('settings.appearance.taskFilenames.storeTitleInFilename.description'),
        getValue: () => plugin.settings.storeTitleInFilename,
        setValue: async (value: boolean) => {
            plugin.settings.storeTitleInFilename = value;
            save();
            // Re-render to show/hide other options
            renderAppearanceTab(container, plugin, save);
        }
    });

    if (!plugin.settings.storeTitleInFilename) {
        createDropdownSetting(container, {
            name: translate('settings.appearance.taskFilenames.filenameFormat.name'),
            desc: translate('settings.appearance.taskFilenames.filenameFormat.description'),
            options: [
                { value: 'title', label: translate('settings.appearance.taskFilenames.filenameFormat.options.title') },
                { value: 'zettel', label: translate('settings.appearance.taskFilenames.filenameFormat.options.zettel') },
                { value: 'timestamp', label: translate('settings.appearance.taskFilenames.filenameFormat.options.timestamp') },
                { value: 'custom', label: translate('settings.appearance.taskFilenames.filenameFormat.options.custom') }
            ],
            getValue: () => plugin.settings.taskFilenameFormat,
            setValue: async (value: string) => {
                plugin.settings.taskFilenameFormat = value as any;
                save();
                // Re-render to update visibility
                renderAppearanceTab(container, plugin, save);
            },
            ariaLabel: 'Task filename generation format'
        });

        if (plugin.settings.taskFilenameFormat === 'custom') {
            createTextSetting(container, {
                name: translate('settings.appearance.taskFilenames.customTemplate.name'),
                desc: translate('settings.appearance.taskFilenames.customTemplate.description'),
                placeholder: translate('settings.appearance.taskFilenames.customTemplate.placeholder'),
                getValue: () => plugin.settings.customFilenameTemplate,
                setValue: async (value: string) => {
                    plugin.settings.customFilenameTemplate = value;
                    save();
                },
                ariaLabel: 'Custom filename template with variables'
            });

            createHelpText(container, translate('settings.appearance.taskFilenames.customTemplate.helpText'));
        }
    }

    // Display Formatting Section
    createSectionHeader(container, translate('settings.appearance.displayFormatting.header'));
    createHelpText(container, translate('settings.appearance.displayFormatting.description'));

    createDropdownSetting(container, {
        name: translate('settings.appearance.displayFormatting.timeFormat.name'),
        desc: translate('settings.appearance.displayFormatting.timeFormat.description'),
        options: [
            { value: '12', label: translate('settings.appearance.displayFormatting.timeFormat.options.twelveHour') },
            { value: '24', label: translate('settings.appearance.displayFormatting.timeFormat.options.twentyFourHour') }
        ],
        getValue: () => plugin.settings.calendarViewSettings.timeFormat,
        setValue: async (value: string) => {
            plugin.settings.calendarViewSettings.timeFormat = value as '12' | '24';
            save();
        }
    });

    // Calendar View Section
    createSectionHeader(container, translate('settings.appearance.calendarView.header'));
    createHelpText(container, translate('settings.appearance.calendarView.description'));

    createDropdownSetting(container, {
        name: translate('settings.appearance.calendarView.defaultView.name'),
        desc: translate('settings.appearance.calendarView.defaultView.description'),
        options: [
            { value: 'dayGridMonth', label: translate('settings.appearance.calendarView.defaultView.options.monthGrid') },
            { value: 'timeGridWeek', label: translate('settings.appearance.calendarView.defaultView.options.weekTimeline') },
            { value: 'timeGridDay', label: translate('settings.appearance.calendarView.defaultView.options.dayTimeline') },
            { value: 'multiMonthYear', label: translate('settings.appearance.calendarView.defaultView.options.yearView') },
            { value: 'timeGridCustom', label: translate('settings.appearance.calendarView.defaultView.options.customMultiDay') }
        ],
        getValue: () => plugin.settings.calendarViewSettings.defaultView,
        setValue: async (value: string) => {
            plugin.settings.calendarViewSettings.defaultView = value as any;
            save();
            // Re-render to show custom day count if needed
            renderAppearanceTab(container, plugin, save);
        }
    });

    if (plugin.settings.calendarViewSettings.defaultView === 'timeGridCustom') {
        createNumberSetting(container, {
            name: translate('settings.appearance.calendarView.customDayCount.name'),
            desc: translate('settings.appearance.calendarView.customDayCount.description'),
            placeholder: translate('settings.appearance.calendarView.customDayCount.placeholder'),
            min: 2,
            max: 10,
            getValue: () => plugin.settings.calendarViewSettings.customDayCount,
            setValue: async (value: number) => {
                plugin.settings.calendarViewSettings.customDayCount = value;
                save();
            }
        });
    }

    createDropdownSetting(container, {
        name: translate('settings.appearance.calendarView.firstDayOfWeek.name'),
        desc: translate('settings.appearance.calendarView.firstDayOfWeek.description'),
        options: [
            { value: '0', label: translate('common.weekdays.sunday') },
            { value: '1', label: translate('common.weekdays.monday') },
            { value: '2', label: translate('common.weekdays.tuesday') },
            { value: '3', label: translate('common.weekdays.wednesday') },
            { value: '4', label: translate('common.weekdays.thursday') },
            { value: '5', label: translate('common.weekdays.friday') },
            { value: '6', label: translate('common.weekdays.saturday') }
        ],
        getValue: () => plugin.settings.calendarViewSettings.firstDay.toString(),
        setValue: async (value: string) => {
            plugin.settings.calendarViewSettings.firstDay = parseInt(value) as any;
            save();
        }
    });


    createToggleSetting(container, {
        name: translate('settings.appearance.calendarView.showWeekends.name'),
        desc: translate('settings.appearance.calendarView.showWeekends.description'),
        getValue: () => plugin.settings.calendarViewSettings.showWeekends,
        setValue: async (value: boolean) => {
            plugin.settings.calendarViewSettings.showWeekends = value;
            save();
        }
    });

    createToggleSetting(container, {
        name: translate('settings.appearance.calendarView.showWeekNumbers.name'),
        desc: translate('settings.appearance.calendarView.showWeekNumbers.description'),
        getValue: () => plugin.settings.calendarViewSettings.weekNumbers,
        setValue: async (value: boolean) => {
            plugin.settings.calendarViewSettings.weekNumbers = value;
            save();
        }
    });

    createToggleSetting(container, {
        name: translate('settings.appearance.calendarView.showTodayHighlight.name'),
        desc: translate('settings.appearance.calendarView.showTodayHighlight.description'),
        getValue: () => plugin.settings.calendarViewSettings.showTodayHighlight,
        setValue: async (value: boolean) => {
            plugin.settings.calendarViewSettings.showTodayHighlight = value;
            save();
        }
    });

    createToggleSetting(container, {
        name: translate('settings.appearance.calendarView.showCurrentTimeIndicator.name'),
        desc: translate('settings.appearance.calendarView.showCurrentTimeIndicator.description'),
        getValue: () => plugin.settings.calendarViewSettings.nowIndicator,
        setValue: async (value: boolean) => {
            plugin.settings.calendarViewSettings.nowIndicator = value;
            save();
        }
    });

    createToggleSetting(container, {
        name: translate('settings.appearance.calendarView.selectionMirror.name'),
        desc: translate('settings.appearance.calendarView.selectionMirror.description'),
        getValue: () => plugin.settings.calendarViewSettings.selectMirror,
        setValue: async (value: boolean) => {
            plugin.settings.calendarViewSettings.selectMirror = value;
            save();
        }
    });

    createTextSetting(container, {
        name: translate('settings.appearance.calendarView.calendarLocale.name'),
        desc: translate('settings.appearance.calendarView.calendarLocale.description'),
        placeholder: translate('settings.appearance.calendarView.calendarLocale.placeholder'),
        getValue: () => plugin.settings.calendarViewSettings.locale || '',
        setValue: async (value: string) => {
            plugin.settings.calendarViewSettings.locale = value;
            save();
        }
    });

    // Default event visibility section
    createSectionHeader(container, translate('settings.appearance.defaultEventVisibility.header'));
    createHelpText(container, translate('settings.appearance.defaultEventVisibility.description'));

    createToggleSetting(container, {
        name: translate('settings.appearance.defaultEventVisibility.showScheduledTasks.name'),
        desc: translate('settings.appearance.defaultEventVisibility.showScheduledTasks.description'),
        getValue: () => plugin.settings.calendarViewSettings.defaultShowScheduled,
        setValue: async (value: boolean) => {
            plugin.settings.calendarViewSettings.defaultShowScheduled = value;
            save();
        }
    });

    createToggleSetting(container, {
        name: translate('settings.appearance.defaultEventVisibility.showDueDates.name'),
        desc: translate('settings.appearance.defaultEventVisibility.showDueDates.description'),
        getValue: () => plugin.settings.calendarViewSettings.defaultShowDue,
        setValue: async (value: boolean) => {
            plugin.settings.calendarViewSettings.defaultShowDue = value;
            save();
        }
    });

    createToggleSetting(container, {
        name: translate('settings.appearance.defaultEventVisibility.showDueWhenScheduled.name'),
        desc: translate('settings.appearance.defaultEventVisibility.showDueWhenScheduled.description'),
        getValue: () => plugin.settings.calendarViewSettings.defaultShowDueWhenScheduled,
        setValue: async (value: boolean) => {
            plugin.settings.calendarViewSettings.defaultShowDueWhenScheduled = value;
            save();
        }
    });

    createToggleSetting(container, {
        name: translate('settings.appearance.defaultEventVisibility.showTimeEntries.name'),
        desc: translate('settings.appearance.defaultEventVisibility.showTimeEntries.description'),
        getValue: () => plugin.settings.calendarViewSettings.defaultShowTimeEntries,
        setValue: async (value: boolean) => {
            plugin.settings.calendarViewSettings.defaultShowTimeEntries = value;
            save();
        }
    });

    createToggleSetting(container, {
        name: translate('settings.appearance.defaultEventVisibility.showRecurringTasks.name'),
        desc: translate('settings.appearance.defaultEventVisibility.showRecurringTasks.description'),
        getValue: () => plugin.settings.calendarViewSettings.defaultShowRecurring,
        setValue: async (value: boolean) => {
            plugin.settings.calendarViewSettings.defaultShowRecurring = value;
            save();
        }
    });

    createToggleSetting(container, {
        name: translate('settings.appearance.defaultEventVisibility.showICSEvents.name'),
        desc: translate('settings.appearance.defaultEventVisibility.showICSEvents.description'),
        getValue: () => plugin.settings.calendarViewSettings.defaultShowICSEvents,
        setValue: async (value: boolean) => {
            plugin.settings.calendarViewSettings.defaultShowICSEvents = value;
            save();
        }
    });


    // Time Settings
    createSectionHeader(container, translate('settings.appearance.timeSettings.header'));
    createHelpText(container, translate('settings.appearance.timeSettings.description'));

    createDropdownSetting(container, {
        name: translate('settings.appearance.timeSettings.timeSlotDuration.name'),
        desc: translate('settings.appearance.timeSettings.timeSlotDuration.description'),
        options: [
            { value: '00:15:00', label: translate('settings.appearance.timeSettings.timeSlotDuration.options.fifteenMinutes') },
            { value: '00:30:00', label: translate('settings.appearance.timeSettings.timeSlotDuration.options.thirtyMinutes') },
            { value: '01:00:00', label: translate('settings.appearance.timeSettings.timeSlotDuration.options.sixtyMinutes') }
        ],
        getValue: () => plugin.settings.calendarViewSettings.slotDuration,
        setValue: async (value: string) => {
            plugin.settings.calendarViewSettings.slotDuration = value as any;
            save();
        }
    });

    createTextSetting(container, {
        name: translate('settings.appearance.timeSettings.startTime.name'),
        desc: translate('settings.appearance.timeSettings.startTime.description'),
        placeholder: translate('settings.appearance.timeSettings.startTime.placeholder'),
        getValue: () => plugin.settings.calendarViewSettings.slotMinTime.slice(0, 5), // Remove seconds
        setValue: async (value: string) => {
            plugin.settings.calendarViewSettings.slotMinTime = value + ':00';
            save();
        }
    });

    createTextSetting(container, {
        name: translate('settings.appearance.timeSettings.endTime.name'),
        desc: translate('settings.appearance.timeSettings.endTime.description'),
        placeholder: translate('settings.appearance.timeSettings.endTime.placeholder'),
        getValue: () => plugin.settings.calendarViewSettings.slotMaxTime.slice(0, 5), // Remove seconds
        setValue: async (value: string) => {
            plugin.settings.calendarViewSettings.slotMaxTime = value + ':00';
            save();
        }
    });

    createTextSetting(container, {
        name: translate('settings.appearance.timeSettings.initialScrollTime.name'),
        desc: translate('settings.appearance.timeSettings.initialScrollTime.description'),
        placeholder: translate('settings.appearance.timeSettings.initialScrollTime.placeholder'),
        getValue: () => plugin.settings.calendarViewSettings.scrollTime.slice(0, 5), // Remove seconds
        setValue: async (value: string) => {
            plugin.settings.calendarViewSettings.scrollTime = value + ':00';
            save();
        }
    });

    // UI Elements Section
    createSectionHeader(container, translate('settings.appearance.uiElements.header'));
    createHelpText(container, translate('settings.appearance.uiElements.description'));

    createToggleSetting(container, {
        name: translate('settings.appearance.uiElements.showTrackedTasksInStatusBar.name'),
        desc: translate('settings.appearance.uiElements.showTrackedTasksInStatusBar.description'),
        getValue: () => plugin.settings.showTrackedTasksInStatusBar,
        setValue: async (value: boolean) => {
            plugin.settings.showTrackedTasksInStatusBar = value;
            save();
        }
    });

    createToggleSetting(container, {
        name: translate('settings.appearance.uiElements.showProjectSubtasksWidget.name'),
        desc: translate('settings.appearance.uiElements.showProjectSubtasksWidget.description'),
        getValue: () => plugin.settings.showProjectSubtasks,
        setValue: async (value: boolean) => {
            plugin.settings.showProjectSubtasks = value;
            save();
            // Re-render to show position setting
            renderAppearanceTab(container, plugin, save);
        }
    });

    if (plugin.settings.showProjectSubtasks) {
        createDropdownSetting(container, {
            name: translate('settings.appearance.uiElements.projectSubtasksPosition.name'),
            desc: translate('settings.appearance.uiElements.projectSubtasksPosition.description'),
            options: [
                { value: 'top', label: translate('settings.appearance.uiElements.projectSubtasksPosition.options.top') },
                { value: 'bottom', label: translate('settings.appearance.uiElements.projectSubtasksPosition.options.bottom') }
            ],
            getValue: () => plugin.settings.projectSubtasksPosition,
            setValue: async (value: string) => {
                plugin.settings.projectSubtasksPosition = value as 'top' | 'bottom';
                save();
            }
        });
    }

    createToggleSetting(container, {
        name: translate('settings.appearance.uiElements.showExpandableSubtasks.name'),
        desc: translate('settings.appearance.uiElements.showExpandableSubtasks.description'),
        getValue: () => plugin.settings.showExpandableSubtasks,
        setValue: async (value: boolean) => {
            plugin.settings.showExpandableSubtasks = value;
            save();
            // Re-render to show chevron position setting
            renderAppearanceTab(container, plugin, save);
        }
    });

    if (plugin.settings.showExpandableSubtasks) {
        createDropdownSetting(container, {
            name: translate('settings.appearance.uiElements.subtaskChevronPosition.name'),
            desc: translate('settings.appearance.uiElements.subtaskChevronPosition.description'),
            options: [
                { value: 'left', label: translate('settings.appearance.uiElements.subtaskChevronPosition.options.left') },
                { value: 'right', label: translate('settings.appearance.uiElements.subtaskChevronPosition.options.right') }
            ],
            getValue: () => plugin.settings.subtaskChevronPosition,
            setValue: async (value: string) => {
                plugin.settings.subtaskChevronPosition = value as 'left' | 'right';
                save();
            }
        });
    }

    createDropdownSetting(container, {
        name: translate('settings.appearance.uiElements.viewsButtonAlignment.name'),
        desc: translate('settings.appearance.uiElements.viewsButtonAlignment.description'),
        options: [
            { value: 'left', label: translate('settings.appearance.uiElements.viewsButtonAlignment.options.left') },
            { value: 'right', label: translate('settings.appearance.uiElements.viewsButtonAlignment.options.right') }
        ],
        getValue: () => plugin.settings.viewsButtonAlignment,
        setValue: async (value: string) => {
            plugin.settings.viewsButtonAlignment = value as 'left' | 'right';
            save();
        }
    });

    // Project Autosuggest Section
    createSectionHeader(container, translate('settings.appearance.projectAutosuggest.header'));
    createHelpText(container, translate('settings.appearance.projectAutosuggest.description'));

    // Tag filtering
    createTextSetting(container, {
        name: translate('settings.appearance.projectAutosuggest.requiredTags.name'),
        desc: translate('settings.appearance.projectAutosuggest.requiredTags.description'),
        placeholder: translate('settings.appearance.projectAutosuggest.requiredTags.placeholder'),
        getValue: () => plugin.settings.projectAutosuggest?.requiredTags?.join(', ') ?? '',
        setValue: async (value: string) => {
            if (!plugin.settings.projectAutosuggest) {
                plugin.settings.projectAutosuggest = { enableFuzzy: false, rows: [], showAdvanced: false, requiredTags: [], includeFolders: [], propertyKey: '', propertyValue: '' };
            }
            plugin.settings.projectAutosuggest.requiredTags = value
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0);
            save();
        },
        ariaLabel: 'Required tags for project suggestions'
    });

    // Folder filtering  
    createTextSetting(container, {
        name: translate('settings.appearance.projectAutosuggest.includeFolders.name'),
        desc: translate('settings.appearance.projectAutosuggest.includeFolders.description'),
        placeholder: translate('settings.appearance.projectAutosuggest.includeFolders.placeholder'),
        getValue: () => plugin.settings.projectAutosuggest?.includeFolders?.join(', ') ?? '',
        setValue: async (value: string) => {
            if (!plugin.settings.projectAutosuggest) {
                plugin.settings.projectAutosuggest = { enableFuzzy: false, rows: [], showAdvanced: false, requiredTags: [], includeFolders: [], propertyKey: '', propertyValue: '' };
            }
            plugin.settings.projectAutosuggest.includeFolders = value
                .split(',')
                .map(folder => folder.trim())
                .filter(folder => folder.length > 0);
            save();
        },
        ariaLabel: 'Include folders for project suggestions'
    });

    // Property filtering
    createTextSetting(container, {
        name: translate('settings.appearance.projectAutosuggest.requiredPropertyKey.name'),
        desc: translate('settings.appearance.projectAutosuggest.requiredPropertyKey.description'),
        placeholder: translate('settings.appearance.projectAutosuggest.requiredPropertyKey.placeholder'),
        getValue: () => plugin.settings.projectAutosuggest?.propertyKey ?? '',
        setValue: async (value: string) => {
            if (!plugin.settings.projectAutosuggest) {
                plugin.settings.projectAutosuggest = { enableFuzzy: false, rows: [], showAdvanced: false, requiredTags: [], includeFolders: [], propertyKey: '', propertyValue: '' };
            }
            plugin.settings.projectAutosuggest.propertyKey = value.trim();
            save();
        },
        ariaLabel: 'Required frontmatter property key for project suggestions',
        debounceMs: 500 // Prevent rapid save calls while typing
    });

    createTextSetting(container, {
        name: translate('settings.appearance.projectAutosuggest.requiredPropertyValue.name'),
        desc: translate('settings.appearance.projectAutosuggest.requiredPropertyValue.description'),
        placeholder: translate('settings.appearance.projectAutosuggest.requiredPropertyValue.placeholder'),
        getValue: () => plugin.settings.projectAutosuggest?.propertyValue ?? '',
        setValue: async (value: string) => {
            if (!plugin.settings.projectAutosuggest) {
                plugin.settings.projectAutosuggest = { enableFuzzy: false, rows: [], showAdvanced: false, requiredTags: [], includeFolders: [], propertyKey: '', propertyValue: '' };
            }
            plugin.settings.projectAutosuggest.propertyValue = value.trim();
            save();
        },
        ariaLabel: 'Required frontmatter property value for project suggestions',
        debounceMs: 500 // Prevent rapid save calls while typing
    });

    createToggleSetting(container, {
        name: translate('settings.appearance.projectAutosuggest.customizeDisplay.name'),
        desc: translate('settings.appearance.projectAutosuggest.customizeDisplay.description'),
        getValue: () => plugin.settings.projectAutosuggest?.showAdvanced ?? false,
        setValue: async (value: boolean) => {
            if (!plugin.settings.projectAutosuggest) {
                plugin.settings.projectAutosuggest = { enableFuzzy: false, rows: [], showAdvanced: false, requiredTags: [], includeFolders: [], propertyKey: '', propertyValue: '' };
            }
            plugin.settings.projectAutosuggest.showAdvanced = value;
            save();
            // Refresh the settings display
            renderAppearanceTab(container, plugin, save);
        }
    });

    // Only show advanced settings if enabled
    if (plugin.settings.projectAutosuggest?.showAdvanced) {
        createToggleSetting(container, {
            name: translate('settings.appearance.projectAutosuggest.enableFuzzyMatching.name'),
            desc: translate('settings.appearance.projectAutosuggest.enableFuzzyMatching.description'),
            getValue: () => plugin.settings.projectAutosuggest?.enableFuzzy ?? false,
        setValue: async (value: boolean) => {
            if (!plugin.settings.projectAutosuggest) {
                plugin.settings.projectAutosuggest = { enableFuzzy: false, rows: [], showAdvanced: false, requiredTags: [], includeFolders: [], propertyKey: '', propertyValue: '' };
            }
            plugin.settings.projectAutosuggest.enableFuzzy = value;
            save();
        }
    });

        // Display rows configuration
        createHelpText(container, translate('settings.appearance.projectAutosuggest.displayRowsHelp'));
        
        const getRows = (): string[] => (plugin.settings.projectAutosuggest?.rows ?? []).slice(0, 3);
        
        const setRow = async (idx: number, value: string) => {
            if (!plugin.settings.projectAutosuggest) {
                plugin.settings.projectAutosuggest = { enableFuzzy: false, rows: [], showAdvanced: false, requiredTags: [], includeFolders: [], propertyKey: '', propertyValue: '' };
            }
            const current = plugin.settings.projectAutosuggest.rows ?? [];
            const next = [...current];
            next[idx] = value;
            plugin.settings.projectAutosuggest.rows = next.slice(0, 3);
            save();
        };

        createTextSetting(container, {
            name: translate('settings.appearance.projectAutosuggest.displayRows.row1.name'),
            desc: translate('settings.appearance.projectAutosuggest.displayRows.row1.description'),
            placeholder: translate('settings.appearance.projectAutosuggest.displayRows.row1.placeholder'),
            getValue: () => getRows()[0] || '',
            setValue: async (value: string) => setRow(0, value),
            ariaLabel: 'Project autosuggest display row 1'
        });

        createTextSetting(container, {
            name: translate('settings.appearance.projectAutosuggest.displayRows.row2.name'),
            desc: translate('settings.appearance.projectAutosuggest.displayRows.row2.description'),
            placeholder: translate('settings.appearance.projectAutosuggest.displayRows.row2.placeholder'),
            getValue: () => getRows()[1] || '',
            setValue: async (value: string) => setRow(1, value),
            ariaLabel: 'Project autosuggest display row 2'
        });

        createTextSetting(container, {
            name: translate('settings.appearance.projectAutosuggest.displayRows.row3.name'),
            desc: translate('settings.appearance.projectAutosuggest.displayRows.row3.description'),
            placeholder: translate('settings.appearance.projectAutosuggest.displayRows.row3.placeholder'),
            getValue: () => getRows()[2] || '',
            setValue: async (value: string) => setRow(2, value),
            ariaLabel: 'Project autosuggest display row 3'
        });

        // Concise help section
        const helpContainer = container.createDiv('tasknotes-settings__help-section');
        helpContainer.createEl('h4', { text: translate('settings.appearance.projectAutosuggest.quickReference.header') });
        const helpList = helpContainer.createEl('ul');
        helpList.createEl('li', { text: translate('settings.appearance.projectAutosuggest.quickReference.properties') });
        helpList.createEl('li', { text: translate('settings.appearance.projectAutosuggest.quickReference.labels') });
        helpList.createEl('li', { text: translate('settings.appearance.projectAutosuggest.quickReference.searchable') });
        helpList.createEl('li', { text: translate('settings.appearance.projectAutosuggest.quickReference.staticText') });
        helpContainer.createEl('p', {
            text: translate('settings.appearance.projectAutosuggest.quickReference.alwaysSearchable'),
            cls: 'settings-help-note'
        });
    }
}
