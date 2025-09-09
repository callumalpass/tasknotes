import { Setting } from 'obsidian';
import TaskNotesPlugin from '../../main';
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

    // Task Cards Section
    createSectionHeader(container, 'Task Cards');
    createHelpText(container, 'Configure how task cards are displayed across all views.');

    // Default visible properties
    const visiblePropsContainer = container.createDiv('visible-properties-container');
    const visiblePropsSetting = visiblePropsContainer.createDiv();
    
    new Setting(visiblePropsSetting)
        .setName('Default visible properties')
        .setDesc('Choose which properties appear on task cards by default.');

    // Create property toggles organized by category like PropertyVisibilityDropdown
    const propertyGroups: Record<string, Array<{key: string, label: string}>> = {
        core: [
            { key: 'status', label: 'Status Dot' },
            { key: 'priority', label: 'Priority Dot' },
            { key: 'due', label: 'Due Date' },
            { key: 'scheduled', label: 'Scheduled Date' },
            { key: 'timeEstimate', label: 'Time Estimate' },
            { key: 'totalTrackedTime', label: 'Total Tracked Time' },
            { key: 'recurrence', label: 'Recurrence' },
            { key: 'completedDate', label: 'Completed Date' },
            { key: 'file.ctime', label: 'Created Date' },
            { key: 'file.mtime', label: 'Modified Date' }
        ],
        organization: [
            { key: 'projects', label: 'Projects' },
            { key: 'contexts', label: 'Contexts' },
            { key: 'tags', label: 'Tags' }
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
    renderPropertyGroup('CORE PROPERTIES', propertyGroups.core);
    renderPropertyGroup('ORGANIZATION', propertyGroups.organization);
    if (propertyGroups.user.length > 0) {
        renderPropertyGroup('CUSTOM PROPERTIES', propertyGroups.user);
    }

    // Task Filenames Section
    createSectionHeader(container, 'Task Filenames');
    createHelpText(container, 'Configure how task files are named when created.');

    createToggleSetting(container, {
        name: 'Store title in filename',
        desc: 'Use the task title as the filename. Filename will update when the task title is changed (Recommended).',
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
            name: 'Filename format',
            desc: 'How task filenames should be generated',
            options: [
                { value: 'title', label: 'Task title (Non-updating)' },
                { value: 'zettel', label: 'Zettelkasten format (YYMMDD + base36 seconds since midnight)' },
                { value: 'timestamp', label: 'Full timestamp (YYYY-MM-DD-HHMMSS)' },
                { value: 'custom', label: 'Custom template' }
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
                name: 'Custom filename template',
                desc: 'Template for custom filenames. Available variables: {title}, {titleLower}, {titleUpper}, {titleSnake}, {titleKebab}, {titleCamel}, {titlePascal}, {date}, {shortDate}, {time}, {time12}, {time24}, {timestamp}, {dateTime}, {year}, {month}, {monthName}, {monthNameShort}, {day}, {dayName}, {dayNameShort}, {hour}, {hour12}, {minute}, {second}, {milliseconds}, {ms}, {ampm}, {week}, {quarter}, {unix}, {unixMs}, {timezone}, {timezoneShort}, {utcOffset}, {utcOffsetShort}, {utcZ}, {zettel}, {nano}, {priority}, {priorityShort}, {status}, {statusShort}, {dueDate}, {scheduledDate}',
                placeholder: '{date}-{title}-{dueDate}',
                getValue: () => plugin.settings.customFilenameTemplate,
                setValue: async (value: string) => {
                    plugin.settings.customFilenameTemplate = value;
                    save();
                },
                ariaLabel: 'Custom filename template with variables'
            });

            createHelpText(container, 'Note: {dueDate} and {scheduledDate} are in YYYY-MM-DD format and will be empty if not set.');
        }
    }

    // Display Formatting Section
    createSectionHeader(container, 'Display Formatting');
    createHelpText(container, 'Configure how dates, times, and other data are displayed across the plugin.');

    createDropdownSetting(container, {
        name: 'Time format',
        desc: 'Display time in 12-hour or 24-hour format throughout the plugin',
        options: [
            { value: '12', label: '12-hour (AM/PM)' },
            { value: '24', label: '24-hour' }
        ],
        getValue: () => plugin.settings.calendarViewSettings.timeFormat,
        setValue: async (value: string) => {
            plugin.settings.calendarViewSettings.timeFormat = value as '12' | '24';
            save();
        }
    });

    // Calendar View Section
    createSectionHeader(container, 'Calendar View');
    createHelpText(container, 'Customize the appearance and behavior of the calendar view.');

    createDropdownSetting(container, {
        name: 'Default view',
        desc: 'The calendar view shown when opening the calendar tab',
        options: [
            { value: 'dayGridMonth', label: 'Month Grid' },
            { value: 'timeGridWeek', label: 'Week Timeline' },
            { value: 'timeGridDay', label: 'Day Timeline' },
            { value: 'multiMonthYear', label: 'Year View' },
            { value: 'timeGridCustom', label: 'Custom Multi-Day' }
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
            name: 'Custom view day count',
            desc: 'Number of days to show in custom multi-day view',
            placeholder: '3',
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
        name: 'First day of week',
        desc: 'Which day should be the first column in week views',
        options: [
            { value: '0', label: 'Sunday' },
            { value: '1', label: 'Monday' },
            { value: '2', label: 'Tuesday' },
            { value: '3', label: 'Wednesday' },
            { value: '4', label: 'Thursday' },
            { value: '5', label: 'Friday' },
            { value: '6', label: 'Saturday' }
        ],
        getValue: () => plugin.settings.calendarViewSettings.firstDay.toString(),
        setValue: async (value: string) => {
            plugin.settings.calendarViewSettings.firstDay = parseInt(value) as any;
            save();
        }
    });


    createToggleSetting(container, {
        name: 'Show weekends',
        desc: 'Display weekends in calendar views',
        getValue: () => plugin.settings.calendarViewSettings.showWeekends,
        setValue: async (value: boolean) => {
            plugin.settings.calendarViewSettings.showWeekends = value;
            save();
        }
    });

    createToggleSetting(container, {
        name: 'Show week numbers',
        desc: 'Display week numbers in calendar views',
        getValue: () => plugin.settings.calendarViewSettings.weekNumbers,
        setValue: async (value: boolean) => {
            plugin.settings.calendarViewSettings.weekNumbers = value;
            save();
        }
    });

    createToggleSetting(container, {
        name: 'Show today highlight',
        desc: 'Highlight the current day in calendar views',
        getValue: () => plugin.settings.calendarViewSettings.showTodayHighlight,
        setValue: async (value: boolean) => {
            plugin.settings.calendarViewSettings.showTodayHighlight = value;
            save();
        }
    });

    createToggleSetting(container, {
        name: 'Show current time indicator',
        desc: 'Display a line showing the current time in timeline views',
        getValue: () => plugin.settings.calendarViewSettings.nowIndicator,
        setValue: async (value: boolean) => {
            plugin.settings.calendarViewSettings.nowIndicator = value;
            save();
        }
    });

    createToggleSetting(container, {
        name: 'Selection mirror',
        desc: 'Show a visual preview while dragging to select time ranges',
        getValue: () => plugin.settings.calendarViewSettings.selectMirror,
        setValue: async (value: boolean) => {
            plugin.settings.calendarViewSettings.selectMirror = value;
            save();
        }
    });

    createTextSetting(container, {
        name: 'Calendar locale',
        desc: 'Calendar locale for date formatting and calendar system (e.g., "en", "fa" for Farsi/Persian, "de" for German). Leave empty to auto-detect from browser.',
        placeholder: 'Auto-detect',
        getValue: () => plugin.settings.calendarViewSettings.locale || '',
        setValue: async (value: string) => {
            plugin.settings.calendarViewSettings.locale = value;
            save();
        }
    });

    // Default event visibility section
    createSectionHeader(container, 'Default Event Visibility');
    createHelpText(container, 'Configure which event types are visible by default when opening the Advanced Calendar. Users can still toggle these on/off in the calendar view.');

    createToggleSetting(container, {
        name: 'Show scheduled tasks',
        desc: 'Display tasks with scheduled dates by default',
        getValue: () => plugin.settings.calendarViewSettings.defaultShowScheduled,
        setValue: async (value: boolean) => {
            plugin.settings.calendarViewSettings.defaultShowScheduled = value;
            save();
        }
    });

    createToggleSetting(container, {
        name: 'Show due dates',
        desc: 'Display task due dates by default',
        getValue: () => plugin.settings.calendarViewSettings.defaultShowDue,
        setValue: async (value: boolean) => {
            plugin.settings.calendarViewSettings.defaultShowDue = value;
            save();
        }
    });

    createToggleSetting(container, {
        name: 'Show due dates when scheduled',
        desc: 'Display due dates even for tasks that already have scheduled dates',
        getValue: () => plugin.settings.calendarViewSettings.defaultShowDueWhenScheduled,
        setValue: async (value: boolean) => {
            plugin.settings.calendarViewSettings.defaultShowDueWhenScheduled = value;
            save();
        }
    });

    createToggleSetting(container, {
        name: 'Show time entries',
        desc: 'Display completed time tracking entries by default',
        getValue: () => plugin.settings.calendarViewSettings.defaultShowTimeEntries,
        setValue: async (value: boolean) => {
            plugin.settings.calendarViewSettings.defaultShowTimeEntries = value;
            save();
        }
    });

    createToggleSetting(container, {
        name: 'Show recurring tasks',
        desc: 'Display recurring task instances by default',
        getValue: () => plugin.settings.calendarViewSettings.defaultShowRecurring,
        setValue: async (value: boolean) => {
            plugin.settings.calendarViewSettings.defaultShowRecurring = value;
            save();
        }
    });

    createToggleSetting(container, {
        name: 'Show ICS events',
        desc: 'Display events from ICS subscriptions by default',
        getValue: () => plugin.settings.calendarViewSettings.defaultShowICSEvents,
        setValue: async (value: boolean) => {
            plugin.settings.calendarViewSettings.defaultShowICSEvents = value;
            save();
        }
    });

    // Timeblocking section
    createSectionHeader(container, 'Timeblocking');
    createHelpText(container, 'Configure timeblock functionality for lightweight scheduling in daily notes.');

    createToggleSetting(container, {
        name: 'Enable timeblocking',
        desc: 'Enable timeblock functionality for lightweight scheduling in daily notes',
        getValue: () => plugin.settings.calendarViewSettings.enableTimeblocking,
        setValue: async (value: boolean) => {
            plugin.settings.calendarViewSettings.enableTimeblocking = value;
            save();
            // Re-render to show/hide timeblocks visibility setting
            renderAppearanceTab(container, plugin, save);
        }
    });

    if (plugin.settings.calendarViewSettings.enableTimeblocking) {
        createToggleSetting(container, {
            name: 'Show timeblocks',
            desc: 'Display timeblocks from daily notes by default',
            getValue: () => plugin.settings.calendarViewSettings.defaultShowTimeblocks,
            setValue: async (value: boolean) => {
                plugin.settings.calendarViewSettings.defaultShowTimeblocks = value;
                save();
            }
        });
    }

    // Time Settings
    createSectionHeader(container, 'Time Settings');
    createHelpText(container, 'Configure time-related display settings for timeline views.');

    createDropdownSetting(container, {
        name: 'Time slot duration',
        desc: 'Duration of each time slot in timeline views',
        options: [
            { value: '00:15:00', label: '15 minutes' },
            { value: '00:30:00', label: '30 minutes' },
            { value: '01:00:00', label: '60 minutes' }
        ],
        getValue: () => plugin.settings.calendarViewSettings.slotDuration,
        setValue: async (value: string) => {
            plugin.settings.calendarViewSettings.slotDuration = value as any;
            save();
        }
    });

    createTextSetting(container, {
        name: 'Start time',
        desc: 'Earliest time shown in timeline views (HH:MM format)',
        placeholder: '06:00',
        getValue: () => plugin.settings.calendarViewSettings.slotMinTime.slice(0, 5), // Remove seconds
        setValue: async (value: string) => {
            plugin.settings.calendarViewSettings.slotMinTime = value + ':00';
            save();
        }
    });

    createTextSetting(container, {
        name: 'End time',
        desc: 'Latest time shown in timeline views (HH:MM format)',
        placeholder: '22:00',
        getValue: () => plugin.settings.calendarViewSettings.slotMaxTime.slice(0, 5), // Remove seconds
        setValue: async (value: string) => {
            plugin.settings.calendarViewSettings.slotMaxTime = value + ':00';
            save();
        }
    });

    createTextSetting(container, {
        name: 'Initial scroll time',
        desc: 'Time to scroll to when opening timeline views (HH:MM format)',
        placeholder: '09:00',
        getValue: () => plugin.settings.calendarViewSettings.scrollTime.slice(0, 5), // Remove seconds
        setValue: async (value: string) => {
            plugin.settings.calendarViewSettings.scrollTime = value + ':00';
            save();
        }
    });

    // UI Elements Section
    createSectionHeader(container, 'UI Elements');
    createHelpText(container, 'Configure the display of various UI elements.');

    createToggleSetting(container, {
        name: 'Show tracked tasks in status bar',
        desc: 'Display currently tracked tasks in Obsidian\'s status bar',
        getValue: () => plugin.settings.showTrackedTasksInStatusBar,
        setValue: async (value: boolean) => {
            plugin.settings.showTrackedTasksInStatusBar = value;
            save();
        }
    });

    createToggleSetting(container, {
        name: 'Show project subtasks widget',
        desc: 'Display a widget showing subtasks for the current project note',
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
            name: 'Project subtasks position',
            desc: 'Where to position the project subtasks widget',
            options: [
                { value: 'top', label: 'Top of note' },
                { value: 'bottom', label: 'Bottom of note' }
            ],
            getValue: () => plugin.settings.projectSubtasksPosition,
            setValue: async (value: string) => {
                plugin.settings.projectSubtasksPosition = value as 'top' | 'bottom';
                save();
            }
        });
    }

    createToggleSetting(container, {
        name: 'Show expandable subtasks',
        desc: 'Allow expanding/collapsing subtask sections in task cards',
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
            name: 'Subtask chevron position',
            desc: 'Position of expand/collapse chevrons in task cards',
            options: [
                { value: 'left', label: 'Left side' },
                { value: 'right', label: 'Right side' }
            ],
            getValue: () => plugin.settings.subtaskChevronPosition,
            setValue: async (value: string) => {
                plugin.settings.subtaskChevronPosition = value as 'left' | 'right';
                save();
            }
        });
    }

    createDropdownSetting(container, {
        name: 'Views button alignment',
        desc: 'Alignment of the views/filters button in the task interface',
        options: [
            { value: 'left', label: 'Left side' },
            { value: 'right', label: 'Right side' }
        ],
        getValue: () => plugin.settings.viewsButtonAlignment,
        setValue: async (value: string) => {
            plugin.settings.viewsButtonAlignment = value as 'left' | 'right';
            save();
        }
    });

    // Project Autosuggest Section
    createSectionHeader(container, 'Project Autosuggest');
    createHelpText(container, 'Customize how project suggestions display during task creation.');

    // Tag filtering
    createTextSetting(container, {
        name: 'Required tags',
        desc: 'Show only notes with any of these tags (comma-separated). Leave empty to show all notes.',
        placeholder: 'project, active, important',
        getValue: () => plugin.settings.projectAutosuggest?.requiredTags?.join(', ') ?? '',
        setValue: async (value: string) => {
            if (!plugin.settings.projectAutosuggest) {
                plugin.settings.projectAutosuggest = { enableFuzzy: false, rows: [], showAdvanced: false, requiredTags: [], includeFolders: [] };
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
        name: 'Include folders',
        desc: 'Show only notes in these folders (comma-separated paths). Leave empty to show all folders.',
        placeholder: 'Projects/, Work/Active, Personal',
        getValue: () => plugin.settings.projectAutosuggest?.includeFolders?.join(', ') ?? '',
        setValue: async (value: string) => {
            if (!plugin.settings.projectAutosuggest) {
                plugin.settings.projectAutosuggest = { enableFuzzy: false, rows: [], showAdvanced: false, requiredTags: [], includeFolders: [] };
            }
            plugin.settings.projectAutosuggest.includeFolders = value
                .split(',')
                .map(folder => folder.trim())
                .filter(folder => folder.length > 0);
            save();
        },
        ariaLabel: 'Include folders for project suggestions'
    });

    createToggleSetting(container, {
        name: 'Customize suggestion display',
        desc: 'Show advanced options to configure how project suggestions appear and what information they display.',
        getValue: () => plugin.settings.projectAutosuggest?.showAdvanced ?? false,
        setValue: async (value: boolean) => {
            if (!plugin.settings.projectAutosuggest) {
                plugin.settings.projectAutosuggest = { enableFuzzy: false, rows: [], showAdvanced: false };
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
            name: 'Enable fuzzy matching',
            desc: 'Allow typos and partial matches in project search. May be slower in large vaults.',
            getValue: () => plugin.settings.projectAutosuggest?.enableFuzzy ?? false,
            setValue: async (value: boolean) => {
                if (!plugin.settings.projectAutosuggest) {
                    plugin.settings.projectAutosuggest = { enableFuzzy: false, rows: [], showAdvanced: false };
                }
                plugin.settings.projectAutosuggest.enableFuzzy = value;
                save();
            }
        });

        // Display rows configuration
        createHelpText(container, 'Configure up to 3 lines of information to show for each project suggestion.');
        
        const getRows = (): string[] => (plugin.settings.projectAutosuggest?.rows ?? []).slice(0, 3);
        
        const setRow = async (idx: number, value: string) => {
            if (!plugin.settings.projectAutosuggest) {
                plugin.settings.projectAutosuggest = { enableFuzzy: false, rows: [], showAdvanced: false };
            }
            const current = plugin.settings.projectAutosuggest.rows ?? [];
            const next = [...current];
            next[idx] = value;
            plugin.settings.projectAutosuggest.rows = next.slice(0, 3);
            save();
        };

        createTextSetting(container, {
            name: 'Row 1',
            desc: 'Format: {property|flags}. Properties: title, aliases, file.path, file.parent. Flags: n(Label) shows label, s makes searchable. Example: {title|n(Title)|s}',
            placeholder: '{title|n(Title)}',
            getValue: () => getRows()[0] || '',
            setValue: async (value: string) => setRow(0, value),
            ariaLabel: 'Project autosuggest display row 1'
        });

        createTextSetting(container, {
            name: 'Row 2 (optional)',
            desc: 'Common patterns: {aliases|n(Aliases)}, {file.parent|n(Folder)}, literal:Custom Text',
            placeholder: '{aliases|n(Aliases)}',
            getValue: () => getRows()[1] || '',
            setValue: async (value: string) => setRow(1, value),
            ariaLabel: 'Project autosuggest display row 2'
        });

        createTextSetting(container, {
            name: 'Row 3 (optional)',
            desc: 'Additional info like {file.path|n(Path)} or custom frontmatter fields',
            placeholder: '{file.path|n(Path)}',
            getValue: () => getRows()[2] || '',
            setValue: async (value: string) => setRow(2, value),
            ariaLabel: 'Project autosuggest display row 3'
        });

        // Concise help section
        const helpContainer = container.createDiv('tasknotes-settings__help-section');
        helpContainer.createEl('h4', { text: 'Quick Reference' });
        const helpList = helpContainer.createEl('ul');
        helpList.createEl('li', { text: 'Available properties: title, aliases, file.path, file.parent, or any frontmatter field' });
        helpList.createEl('li', { text: 'Add labels: {title|n(Title)} → "Title: My Project"' });
        helpList.createEl('li', { text: 'Make searchable: {description|s} includes description in + search' });
        helpList.createEl('li', { text: 'Static text: literal:My Custom Label' });
        helpContainer.createEl('p', {
            text: 'Filename, title, and aliases are always searchable by default.',
            cls: 'settings-help-note'
        });
    }
}