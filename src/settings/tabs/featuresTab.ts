import { Notice } from 'obsidian';
import TaskNotesPlugin from '../../main';
import { 
    createSectionHeader, 
    createTextSetting, 
    createToggleSetting, 
    createDropdownSetting,
    createNumberSetting,
    createHelpText,
    // createButtonSetting
} from '../components/settingHelpers';
import { showStorageLocationConfirmationModal } from '../../modals/StorageLocationConfirmationModal';
import { getAvailableLanguages } from '../../locales';
import type { TranslationKey } from '../../i18n';

/**
 * Renders the Features tab - optional plugin modules and their configuration
 */
export function renderFeaturesTab(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void): void {
    container.empty();

    const translate = (key: TranslationKey, params?: Record<string, string | number>) => plugin.i18n.translate(key, params);

    const uiLanguageOptions = (() => {
        const options: Array<{ value: string; label: string }> = [
            { value: 'system', label: translate('common.systemDefault') }
        ];
        for (const code of plugin.i18n.getAvailableLocales()) {
            const label = plugin.i18n.resolveKey(`common.languages.${code}`) || code;
            options.push({ value: code, label });
        }
        return options;
    })();

    // Inline Tasks Section
    createSectionHeader(container, translate('settings.features.inlineTasks.header'));
    createHelpText(container, translate('settings.features.inlineTasks.description'));

    createToggleSetting(container, {
        name: translate('settings.features.overlays.taskLinkToggle.name'),
        desc: translate('settings.features.overlays.taskLinkToggle.description'),
        getValue: () => plugin.settings.enableTaskLinkOverlay,
        setValue: async (value: boolean) => {
            plugin.settings.enableTaskLinkOverlay = value;
            save();
        }
    });

    createToggleSetting(container, {
        name: translate('settings.features.instantConvert.toggle.name'),
        desc: translate('settings.features.instantConvert.toggle.description'),
        getValue: () => plugin.settings.enableInstantTaskConvert,
        setValue: async (value: boolean) => {
            plugin.settings.enableInstantTaskConvert = value;
            save();
            // Re-render to show additional settings
            renderFeaturesTab(container, plugin, save);
        }
    });

    if (plugin.settings.enableInstantTaskConvert) {
        createTextSetting(container, {
            name: translate('settings.features.instantConvert.folder.name'),
            desc: translate('settings.features.instantConvert.folder.description'),
            placeholder: 'TaskNotes',
            getValue: () => plugin.settings.inlineTaskConvertFolder,
            setValue: async (value: string) => {
                plugin.settings.inlineTaskConvertFolder = value;
                save();
            }
        });
    }

    // Natural Language Processing Section
    createSectionHeader(container, translate('settings.features.nlp.header'));
    createHelpText(container, translate('settings.features.nlp.description'));

    createToggleSetting(container, {
        name: translate('settings.features.nlp.enable.name'),
        desc: translate('settings.features.nlp.enable.description'),
        getValue: () => plugin.settings.enableNaturalLanguageInput,
        setValue: async (value: boolean) => {
            plugin.settings.enableNaturalLanguageInput = value;
            save();
            // Re-render to show NLP settings
            renderFeaturesTab(container, plugin, save);
        }
    });

    if (plugin.settings.enableNaturalLanguageInput) {
        createToggleSetting(container, {
            name: translate('settings.features.nlp.defaultToScheduled.name'),
            desc: translate('settings.features.nlp.defaultToScheduled.description'),
            getValue: () => plugin.settings.nlpDefaultToScheduled,
            setValue: async (value: boolean) => {
                plugin.settings.nlpDefaultToScheduled = value;
                save();
            }
        });

        createDropdownSetting(container, {
            name: translate('settings.features.nlp.language.name'),
            desc: translate('settings.features.nlp.language.description'),
            options: getAvailableLanguages(),
            getValue: () => plugin.settings.nlpLanguage,
            setValue: async (value: string) => {
                plugin.settings.nlpLanguage = value;
                save();
            }
        });

        createTextSetting(container, {
            name: translate('settings.features.nlp.statusTrigger.name'),
            desc: translate('settings.features.nlp.statusTrigger.description'),
            placeholder: '@',
            getValue: () => plugin.settings.statusSuggestionTrigger,
            setValue: async (value: string) => {
                plugin.settings.statusSuggestionTrigger = value;
                save();
            }
        });
    }

    // UI Language Section
    createSectionHeader(container, translate('settings.features.uiLanguage.header'));
    createHelpText(container, translate('settings.features.uiLanguage.description'));

    createDropdownSetting(container, {
        name: translate('settings.features.uiLanguage.dropdown.name'),
        desc: translate('settings.features.uiLanguage.dropdown.description'),
        options: uiLanguageOptions,
        getValue: () => plugin.settings.uiLanguage ?? 'system',
        setValue: async (value: string) => {
            plugin.settings.uiLanguage = value;
            plugin.i18n.setLocale(value);
            save();
            renderFeaturesTab(container, plugin, save);
        }
    });

    // Pomodoro Timer Section
    createSectionHeader(container, translate('settings.features.pomodoro.header'));
    createHelpText(container, translate('settings.features.pomodoro.description'));

    // Work duration
    createNumberSetting(container, {
        name: translate('settings.features.pomodoro.workDuration.name'),
        desc: translate('settings.features.pomodoro.workDuration.description'),
        placeholder: '25',
        min: 1,
        max: 120,
        getValue: () => plugin.settings.pomodoroWorkDuration,
        setValue: async (value: number) => {
            plugin.settings.pomodoroWorkDuration = value;
            save();
        }
    });

    // Short break duration  
    createNumberSetting(container, {
        name: translate('settings.features.pomodoro.shortBreak.name'),
        desc: translate('settings.features.pomodoro.shortBreak.description'),
        placeholder: '5',
        min: 1,
        max: 60,
        getValue: () => plugin.settings.pomodoroShortBreakDuration,
        setValue: async (value: number) => {
            plugin.settings.pomodoroShortBreakDuration = value;
            save();
        }
    });

    // Long break duration
    createNumberSetting(container, {
        name: translate('settings.features.pomodoro.longBreak.name'),
        desc: translate('settings.features.pomodoro.longBreak.description'),
        placeholder: '15',
        min: 1,
        max: 120,
        getValue: () => plugin.settings.pomodoroLongBreakDuration,
        setValue: async (value: number) => {
            plugin.settings.pomodoroLongBreakDuration = value;
            save();
        }
    });

    // Long break interval
    createNumberSetting(container, {
        name: translate('settings.features.pomodoro.longBreakInterval.name'),
        desc: translate('settings.features.pomodoro.longBreakInterval.description'),
        placeholder: '4',
        min: 1,
        max: 10,
        getValue: () => plugin.settings.pomodoroLongBreakInterval,
        setValue: async (value: number) => {
            plugin.settings.pomodoroLongBreakInterval = value;
            save();
        }
    });

    // Auto-start options
    createToggleSetting(container, {
        name: translate('settings.features.pomodoro.autoStartBreaks.name'),
        desc: translate('settings.features.pomodoro.autoStartBreaks.description'),
        getValue: () => plugin.settings.pomodoroAutoStartBreaks,
        setValue: async (value: boolean) => {
            plugin.settings.pomodoroAutoStartBreaks = value;
            save();
        }
    });

    createToggleSetting(container, {
        name: translate('settings.features.pomodoro.autoStartWork.name'),
        desc: translate('settings.features.pomodoro.autoStartWork.description'),
        getValue: () => plugin.settings.pomodoroAutoStartWork,
        setValue: async (value: boolean) => {
            plugin.settings.pomodoroAutoStartWork = value;
            save();
        }
    });

    // Notification settings
    createToggleSetting(container, {
        name: translate('settings.features.pomodoro.notifications.name'),
        desc: translate('settings.features.pomodoro.notifications.description'),
        getValue: () => plugin.settings.pomodoroNotifications,
        setValue: async (value: boolean) => {
            plugin.settings.pomodoroNotifications = value;
            save();
        }
    });

    // Sound settings
    createToggleSetting(container, {
        name: translate('settings.features.pomodoroSound.enabledName'),
        desc: translate('settings.features.pomodoroSound.enabledDesc'),
        getValue: () => plugin.settings.pomodoroSoundEnabled,
        setValue: async (value: boolean) => {
            plugin.settings.pomodoroSoundEnabled = value;
            save();
            // Re-render to show volume setting
            renderFeaturesTab(container, plugin, save);
        }
    });

    if (plugin.settings.pomodoroSoundEnabled) {
        createNumberSetting(container, {
            name: translate('settings.features.pomodoroSound.volumeName'),
            desc: translate('settings.features.pomodoroSound.volumeDesc'),
            placeholder: '50',
            min: 0,
            max: 100,
            getValue: () => plugin.settings.pomodoroSoundVolume,
            setValue: async (value: number) => {
                plugin.settings.pomodoroSoundVolume = value;
                save();
            }
        });
    }

    // Storage location setting
    createDropdownSetting(container, {
        name: translate('settings.features.dataStorage.name'),
        desc: 'Where to store Pomodoro session history',
        options: [
            { value: 'plugin', label: 'Plugin data (recommended)' },
            { value: 'daily-notes', label: translate('settings.features.dataStorage.dailyNotes') }
        ],
        getValue: () => plugin.settings.pomodoroStorageLocation,
        setValue: async (value: string) => {
            const newLocation = value as 'plugin' | 'daily-notes';
            if (newLocation !== plugin.settings.pomodoroStorageLocation) {
                // Check if there's existing data to migrate
                const data = await plugin.loadData();
                const hasExistingData = data?.pomodoroHistory && Array.isArray(data.pomodoroHistory) && data.pomodoroHistory.length > 0;
                
                // Show confirmation modal for storage location change
                const confirmed = await showStorageLocationConfirmationModal(plugin, hasExistingData);
                
                if (confirmed) {
                    plugin.settings.pomodoroStorageLocation = newLocation;
                    save();
                    new Notice(`Pomodoro storage location changed to ${newLocation === 'plugin' ? 'plugin data' : 'daily notes'}`);
                } else {
                    // Reset the dropdown to the current value
                    renderFeaturesTab(container, plugin, save);
                }
            }
        }
    });

    // Notifications Section
    createSectionHeader(container, translate('settings.features.notifications.header'));
    createHelpText(container, 'Configure task reminder notifications and alerts.');

    createToggleSetting(container, {
        name: translate('settings.features.notifications.enableName'),
        desc: translate('settings.features.notifications.enableDesc'),
        getValue: () => plugin.settings.enableNotifications,
        setValue: async (value: boolean) => {
            plugin.settings.enableNotifications = value;
            save();
            // Re-render to show notification type setting
            renderFeaturesTab(container, plugin, save);
        }
    });

    if (plugin.settings.enableNotifications) {
        createDropdownSetting(container, {
            name: translate('settings.features.notifications.typeName'),
            desc: translate('settings.features.notifications.typeDesc'),
            options: [
                { value: 'in-app', label: translate('settings.features.notifications.inAppLabel') },
                { value: 'system', label: translate('settings.features.notifications.systemLabel') }
            ],
            getValue: () => plugin.settings.notificationType,
            setValue: async (value: string) => {
                plugin.settings.notificationType = value as 'in-app' | 'system';
                save();
            }
        });
    }

    // Performance & Behavior Section
    createSectionHeader(container, translate('settings.features.performance.header'));
    createHelpText(container, 'Configure plugin performance and behavioral options.');

    createToggleSetting(container, {
        name: translate('settings.features.overdue.hideCompletedName'),
        desc: translate('settings.features.overdue.hideCompletedDesc'),
        getValue: () => plugin.settings.hideCompletedFromOverdue,
        setValue: async (value: boolean) => {
            plugin.settings.hideCompletedFromOverdue = value;
            save();
        }
    });

    createToggleSetting(container, {
        name: translate('settings.features.indexing.disableName'),
        desc: translate('settings.features.indexing.disableDesc'),
        getValue: () => plugin.settings.disableNoteIndexing,
        setValue: async (value: boolean) => {
            plugin.settings.disableNoteIndexing = value;
            save();
        }
    });

    // Suggestion debounce setting
    if (plugin.settings.suggestionDebounceMs !== undefined) {
        createNumberSetting(container, {
            name: translate('settings.features.suggestions.debounceName'),
            desc: translate('settings.features.suggestions.debounceDesc'),
            placeholder: '300',
            min: 0,
            max: 2000,
            getValue: () => plugin.settings.suggestionDebounceMs || 0,
            setValue: async (value: number) => {
                plugin.settings.suggestionDebounceMs = value > 0 ? value : undefined;
                save();
            }
        });
    }

    // Time Tracking Section
    createSectionHeader(container, translate('settings.features.timeTrackingSection.header'));
    createHelpText(container, 'Configure automatic time tracking behaviors.');

    createToggleSetting(container, {
        name: translate('settings.features.timeTracking.autoStopName'),
        desc: translate('settings.features.timeTracking.autoStopDesc'),
        getValue: () => plugin.settings.autoStopTimeTrackingOnComplete,
        setValue: async (value: boolean) => {
            plugin.settings.autoStopTimeTrackingOnComplete = value;
            save();
        }
    });

    createToggleSetting(container, {
        name: translate('settings.features.timeTracking.stopNotificationName'),
        desc: translate('settings.features.timeTracking.stopNotificationDesc'),
        getValue: () => plugin.settings.autoStopTimeTrackingNotification,
        setValue: async (value: boolean) => {
            plugin.settings.autoStopTimeTrackingNotification = value;
            save();
        }
    });

    // Recurring Tasks Section
    createSectionHeader(container, translate('settings.features.recurringSection.header'));
    createHelpText(container, 'Configure behavior for recurring task management.');

    createToggleSetting(container, {
        name: translate('settings.features.recurring.maintainOffsetName'),
        desc: translate('settings.features.recurring.maintainOffsetDesc'),
        getValue: () => plugin.settings.maintainDueDateOffsetInRecurring,
        setValue: async (value: boolean) => {
            plugin.settings.maintainDueDateOffsetInRecurring = value;
            save();
        }
    });

    // Timeblocking Section
    createSectionHeader(container, translate('settings.features.timeblocking.header'));
    createHelpText(container, 'Configure timeblock functionality for lightweight scheduling in daily notes.');

    createToggleSetting(container, {
        name: translate('settings.features.timeblocking.enableName'),
        desc: translate('settings.features.timeblocking.enableDesc'),
        getValue: () => plugin.settings.calendarViewSettings.enableTimeblocking,
        setValue: async (value: boolean) => {
            plugin.settings.calendarViewSettings.enableTimeblocking = value;
            save();
            // Re-render to show/hide timeblocks visibility setting
            renderFeaturesTab(container, plugin, save);
        }
    });

    if (plugin.settings.calendarViewSettings.enableTimeblocking) {
        createToggleSetting(container, {
            name: translate('settings.features.timeblocking.showBlocksName'),
            desc: translate('settings.features.timeblocking.showBlocksDesc'),
            getValue: () => plugin.settings.calendarViewSettings.defaultShowTimeblocks,
            setValue: async (value: boolean) => {
                plugin.settings.calendarViewSettings.defaultShowTimeblocks = value;
                save();
            }
        });

        createHelpText(container, 'Usage: In the advanced calendar view, hold Shift + drag to create timeblocks. Drag to move existing timeblocks. Resize edges to adjust duration.');
    }
}
