import { Notice, Setting } from "obsidian";
import TaskNotesPlugin from "../../main";
import {
	createSectionHeader,
	createTextSetting,
	createToggleSetting,
	createDropdownSetting,
	createNumberSetting,
	createHelpText,
	// createButtonSetting
} from "../components/settingHelpers";
import { showStorageLocationConfirmationModal } from "../../modals/StorageLocationConfirmationModal";
import { getAvailableLanguages } from "../../locales";
import type { TranslationKey } from "../../i18n";
import { PropertySelectorModal } from "../../modals/PropertySelectorModal";
import { getAvailableProperties, getPropertyLabels } from "../../utils/propertyHelpers";

/**
 * Renders the Features tab - optional plugin modules and their configuration
 */
export function renderFeaturesTab(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void
): void {
	container.empty();

	const translate = (key: TranslationKey, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key, params);

	// Inline Tasks Section
	createSectionHeader(container, translate("settings.features.inlineTasks.header"));
	createHelpText(container, translate("settings.features.inlineTasks.description"));

	createToggleSetting(container, {
		name: translate("settings.features.overlays.taskLinkToggle.name"),
		desc: translate("settings.features.overlays.taskLinkToggle.description"),
		getValue: () => plugin.settings.enableTaskLinkOverlay,
		setValue: async (value: boolean) => {
			plugin.settings.enableTaskLinkOverlay = value;
			save();
			// Re-render to show/hide inline properties setting
			renderFeaturesTab(container, plugin, save);
		},
	});

	// Inline task card visible properties (shown when task link overlay is enabled)
	if (plugin.settings.enableTaskLinkOverlay) {
		const availableProperties = getAvailableProperties(plugin);

		const currentProperties = plugin.settings.inlineVisibleProperties || [
			"status",
			"priority",
			"due",
			"scheduled",
			"recurrence",
		];

		new Setting(container)
			.setName("Inline Task Card Properties")
			.setDesc(
				"Select which properties to show in inline task cards (task links in editor). Fewer properties = more compact display."
			)
			.addButton((button) => {
				button.setButtonText("Configure").onClick(() => {
					const modal = new PropertySelectorModal(
						plugin.app,
						availableProperties,
						currentProperties,
						async (selected) => {
							plugin.settings.inlineVisibleProperties = selected;
							save();
							new Notice("Inline task card properties updated");
							// Re-render to update display
							renderFeaturesTab(container, plugin, save);
						},
						"Select Inline Task Card Properties",
						"Choose which properties to display in inline task cards. Selected properties will appear in the order shown below."
					);
					modal.open();
				});
			});

		const currentLabels = getPropertyLabels(plugin, currentProperties);
		createHelpText(container, `Currently showing: ${currentLabels.join(", ")}`);
	}

	createToggleSetting(container, {
		name: translate("settings.features.instantConvert.toggle.name"),
		desc: translate("settings.features.instantConvert.toggle.description"),
		getValue: () => plugin.settings.enableInstantTaskConvert,
		setValue: async (value: boolean) => {
			plugin.settings.enableInstantTaskConvert = value;
			save();
			// Re-render to show additional settings
			renderFeaturesTab(container, plugin, save);
		},
	});

	createTextSetting(container, {
		name: translate("settings.features.instantConvert.folder.name"),
		desc: translate("settings.features.instantConvert.folder.description"),
		placeholder: "TaskNotes",
		getValue: () => plugin.settings.inlineTaskConvertFolder,
		setValue: async (value: string) => {
			plugin.settings.inlineTaskConvertFolder = value;
			save();
		},
	});

	createToggleSetting(container, {
		name: translate("settings.features.instantConvert.toggleCustomFileName.name"),
		desc: translate("settings.features.instantConvert.toggleCustomFileName.description"),
		getValue: () => plugin.settings.toggleCustomFileName,
		setValue: async (value: boolean) => {
			plugin.settings.toggleCustomFileName = value;
			save();
			// Re-render to show/hide filename input
			renderFeaturesTab(container, plugin, save);
		},
	});

	// Show filename input only when toggle is ON
	if (plugin.settings.toggleCustomFileName) {
		createTextSetting(container, {
			name: translate("settings.features.instantConvert.customFileName.name"),
			desc: translate("settings.features.instantConvert.customFileName.description"),
			placeholder: "{{title}}",
			getValue: () => plugin.settings.customFileName,
			setValue: async (value: string) => {
				plugin.settings.customFileName = value;
				save();
			},
		});
	}

	// Natural Language Processing Section
	createSectionHeader(container, translate("settings.features.nlp.header"));
	createHelpText(container, translate("settings.features.nlp.description"));

	createToggleSetting(container, {
		name: translate("settings.features.nlp.enable.name"),
		desc: translate("settings.features.nlp.enable.description"),
		getValue: () => plugin.settings.enableNaturalLanguageInput,
		setValue: async (value: boolean) => {
			plugin.settings.enableNaturalLanguageInput = value;
			save();
			// Re-render to show NLP settings
			renderFeaturesTab(container, plugin, save);
		},
	});

	if (plugin.settings.enableNaturalLanguageInput) {
		createToggleSetting(container, {
			name: translate("settings.features.nlp.defaultToScheduled.name"),
			desc: translate("settings.features.nlp.defaultToScheduled.description"),
			getValue: () => plugin.settings.nlpDefaultToScheduled,
			setValue: async (value: boolean) => {
				plugin.settings.nlpDefaultToScheduled = value;
				save();
			},
		});

		createDropdownSetting(container, {
			name: translate("settings.features.nlp.language.name"),
			desc: translate("settings.features.nlp.language.description"),
			options: getAvailableLanguages(),
			getValue: () => plugin.settings.nlpLanguage,
			setValue: async (value: string) => {
				plugin.settings.nlpLanguage = value;
				save();
			},
		});

		// Deprecated: Old status trigger setting (kept for backward compatibility during migration)
		// New trigger configuration UI below replaces this

		// NLP Triggers Configuration
		createSectionHeader(container, "NLP Triggers");
		createHelpText(
			container,
			"Configure trigger characters or strings for each property type. When you type a trigger followed by text, autocomplete suggestions will appear."
		);

		// Helper function to render a trigger setting
		const renderTriggerSetting = (
			propertyId: string,
			displayName: string,
			description: string,
			defaultTrigger: string
		) => {
			const triggerConfig = plugin.settings.nlpTriggers.triggers.find(
				(t) => t.propertyId === propertyId
			);
			const currentTrigger = triggerConfig?.trigger || defaultTrigger;
			const isEnabled = triggerConfig?.enabled ?? true;

			const setting = new Setting(container)
				.setName(displayName)
				.setDesc(description)
				.addToggle((toggle) => {
					toggle.setValue(isEnabled).onChange(async (enabled) => {
						// Update or create trigger config
						const index = plugin.settings.nlpTriggers.triggers.findIndex(
							(t) => t.propertyId === propertyId
						);
						if (index !== -1) {
							plugin.settings.nlpTriggers.triggers[index].enabled = enabled;
						} else {
							plugin.settings.nlpTriggers.triggers.push({
								propertyId,
								trigger: defaultTrigger,
								enabled,
							});
						}
						save();
						// Re-render to show/hide trigger input
						renderFeaturesTab(container, plugin, save);
					});
				});

			if (isEnabled) {
				setting.addText((text) => {
					text.setValue(currentTrigger)
						.setPlaceholder(defaultTrigger)
						.onChange(async (value) => {
							// Validate trigger (allow trailing/leading spaces for triggers like "def: ")
							if (value.trim().length === 0) {
								new Notice("Trigger cannot be empty");
								return;
							}
							if (value.length > 10) {
								new Notice("Trigger is too long (max 10 characters)");
								return;
							}

							// Update trigger (use raw value, don't trim)
							const index = plugin.settings.nlpTriggers.triggers.findIndex(
								(t) => t.propertyId === propertyId
							);
							if (index !== -1) {
								plugin.settings.nlpTriggers.triggers[index].trigger = value;
							} else {
								plugin.settings.nlpTriggers.triggers.push({
									propertyId,
									trigger: value,
									enabled: true,
								});
							}
							save();
						});
					text.inputEl.style.width = "100px";
				});

				// Add special note for tags trigger
				if (propertyId === "tags" && currentTrigger !== "#") {
					setting.descEl.createDiv({
						text: "⚠️ Using custom tag trigger - Obsidian's native tag suggester will be disabled.",
						cls: "setting-item-description",
					});
				}
			}
		};

		// Built-in triggers
		renderTriggerSetting(
			"tags",
			"Tags Trigger",
			"Trigger for #tags. When set to '#', uses Obsidian's native tag suggester.",
			"#"
		);

		renderTriggerSetting(
			"contexts",
			"Contexts Trigger",
			"Trigger for @contexts. Type this character followed by a context name.",
			"@"
		);

		renderTriggerSetting(
			"projects",
			"Projects Trigger",
			"Trigger for +projects. Supports wikilinks for multi-word projects.",
			"+"
		);

		renderTriggerSetting(
			"status",
			"Status Trigger",
			"Trigger for status suggestions. Type this to see available statuses.",
			"*"
		);

		renderTriggerSetting(
			"priority",
			"Priority Trigger",
			"Trigger for priority suggestions. Disabled by default (priority uses keyword matching).",
			"!"
		);

		// User-defined field triggers
		if (plugin.settings.userFields && plugin.settings.userFields.length > 0) {
			createHelpText(
				container,
				"User-Defined Fields: Configure triggers for your custom fields below."
			);

			for (const userField of plugin.settings.userFields) {
				const triggerConfig = plugin.settings.nlpTriggers.triggers.find(
					(t) => t.propertyId === userField.id
				);
				const isEnabled = triggerConfig?.enabled ?? false;
				const currentTrigger = triggerConfig?.trigger || `${userField.id}:`;

				const setting = new Setting(container)
					.setName(`${userField.displayName} Trigger`)
					.setDesc(`Trigger for custom field "${userField.displayName}" (${userField.type})`)
					.addToggle((toggle) => {
						toggle.setValue(isEnabled).onChange(async (enabled) => {
							const index = plugin.settings.nlpTriggers.triggers.findIndex(
								(t) => t.propertyId === userField.id
							);
							if (index !== -1) {
								plugin.settings.nlpTriggers.triggers[index].enabled = enabled;
							} else {
								plugin.settings.nlpTriggers.triggers.push({
									propertyId: userField.id,
									trigger: currentTrigger,
									enabled,
								});
							}
							save();
							renderFeaturesTab(container, plugin, save);
						});
					});

				if (isEnabled) {
					setting.addText((text) => {
						text.setValue(currentTrigger)
							.setPlaceholder(`${userField.id}:`)
							.onChange(async (value) => {
								// Validate trigger (allow trailing/leading spaces)
								if (value.trim().length === 0) {
									new Notice("Trigger cannot be empty");
									return;
								}
								if (value.length > 10) {
									new Notice("Trigger is too long (max 10 characters)");
									return;
								}

								const index = plugin.settings.nlpTriggers.triggers.findIndex(
									(t) => t.propertyId === userField.id
								);
								if (index !== -1) {
									plugin.settings.nlpTriggers.triggers[index].trigger = value;
								} else {
									plugin.settings.nlpTriggers.triggers.push({
										propertyId: userField.id,
										trigger: value,
										enabled: true,
									});
								}
								save();
							});
						text.inputEl.style.width = "100px";
					});
				}
			}
		}
	}

	// Pomodoro Timer Section
	createSectionHeader(container, translate("settings.features.pomodoro.header"));
	createHelpText(container, translate("settings.features.pomodoro.description"));

	// Work duration
	createNumberSetting(container, {
		name: translate("settings.features.pomodoro.workDuration.name"),
		desc: translate("settings.features.pomodoro.workDuration.description"),
		placeholder: "25",
		min: 1,
		max: 120,
		getValue: () => plugin.settings.pomodoroWorkDuration,
		setValue: async (value: number) => {
			plugin.settings.pomodoroWorkDuration = value;
			save();
		},
	});

	// Short break duration
	createNumberSetting(container, {
		name: translate("settings.features.pomodoro.shortBreak.name"),
		desc: translate("settings.features.pomodoro.shortBreak.description"),
		placeholder: "5",
		min: 1,
		max: 60,
		getValue: () => plugin.settings.pomodoroShortBreakDuration,
		setValue: async (value: number) => {
			plugin.settings.pomodoroShortBreakDuration = value;
			save();
		},
	});

	// Long break duration
	createNumberSetting(container, {
		name: translate("settings.features.pomodoro.longBreak.name"),
		desc: translate("settings.features.pomodoro.longBreak.description"),
		placeholder: "15",
		min: 1,
		max: 120,
		getValue: () => plugin.settings.pomodoroLongBreakDuration,
		setValue: async (value: number) => {
			plugin.settings.pomodoroLongBreakDuration = value;
			save();
		},
	});

	// Long break interval
	createNumberSetting(container, {
		name: translate("settings.features.pomodoro.longBreakInterval.name"),
		desc: translate("settings.features.pomodoro.longBreakInterval.description"),
		placeholder: "4",
		min: 1,
		max: 10,
		getValue: () => plugin.settings.pomodoroLongBreakInterval,
		setValue: async (value: number) => {
			plugin.settings.pomodoroLongBreakInterval = value;
			save();
		},
	});

	// Auto-start options
	createToggleSetting(container, {
		name: translate("settings.features.pomodoro.autoStartBreaks.name"),
		desc: translate("settings.features.pomodoro.autoStartBreaks.description"),
		getValue: () => plugin.settings.pomodoroAutoStartBreaks,
		setValue: async (value: boolean) => {
			plugin.settings.pomodoroAutoStartBreaks = value;
			save();
		},
	});

	createToggleSetting(container, {
		name: translate("settings.features.pomodoro.autoStartWork.name"),
		desc: translate("settings.features.pomodoro.autoStartWork.description"),
		getValue: () => plugin.settings.pomodoroAutoStartWork,
		setValue: async (value: boolean) => {
			plugin.settings.pomodoroAutoStartWork = value;
			save();
		},
	});

	// Notification settings
	createToggleSetting(container, {
		name: translate("settings.features.pomodoro.notifications.name"),
		desc: translate("settings.features.pomodoro.notifications.description"),
		getValue: () => plugin.settings.pomodoroNotifications,
		setValue: async (value: boolean) => {
			plugin.settings.pomodoroNotifications = value;
			save();
		},
	});

	// Sound settings
	createToggleSetting(container, {
		name: translate("settings.features.pomodoroSound.enabledName"),
		desc: translate("settings.features.pomodoroSound.enabledDesc"),
		getValue: () => plugin.settings.pomodoroSoundEnabled,
		setValue: async (value: boolean) => {
			plugin.settings.pomodoroSoundEnabled = value;
			save();
			// Re-render to show volume setting
			renderFeaturesTab(container, plugin, save);
		},
	});

	if (plugin.settings.pomodoroSoundEnabled) {
		createNumberSetting(container, {
			name: translate("settings.features.pomodoroSound.volumeName"),
			desc: translate("settings.features.pomodoroSound.volumeDesc"),
			placeholder: "50",
			min: 0,
			max: 100,
			getValue: () => plugin.settings.pomodoroSoundVolume,
			setValue: async (value: number) => {
				plugin.settings.pomodoroSoundVolume = value;
				save();
			},
		});
	}

	// Storage location setting
	createDropdownSetting(container, {
		name: translate("settings.features.dataStorage.name"),
		desc: translate("settings.features.dataStorage.description"),
		options: [
			{ value: "plugin", label: translate("settings.features.dataStorage.pluginData") },
			{ value: "daily-notes", label: translate("settings.features.dataStorage.dailyNotes") },
		],
		getValue: () => plugin.settings.pomodoroStorageLocation,
		setValue: async (value: string) => {
			const newLocation = value as "plugin" | "daily-notes";
			if (newLocation !== plugin.settings.pomodoroStorageLocation) {
				// Check if there's existing data to migrate
				const data = await plugin.loadData();
				const hasExistingData =
					data?.pomodoroHistory &&
					Array.isArray(data.pomodoroHistory) &&
					data.pomodoroHistory.length > 0;

				// Show confirmation modal for storage location change
				const confirmed = await showStorageLocationConfirmationModal(
					plugin,
					hasExistingData
				);

				if (confirmed) {
					plugin.settings.pomodoroStorageLocation = newLocation;
					save();
					new Notice(
						translate("settings.features.dataStorage.notices.locationChanged", {
							location:
								newLocation === "plugin"
									? translate("settings.features.dataStorage.pluginData")
									: translate("settings.features.dataStorage.dailyNotes"),
						})
					);
				} else {
					// Reset the dropdown to the current value
					renderFeaturesTab(container, plugin, save);
				}
			}
		},
	});

	// Notifications Section
	createSectionHeader(container, translate("settings.features.notifications.header"));
	createHelpText(container, translate("settings.features.notifications.description"));

	createToggleSetting(container, {
		name: translate("settings.features.notifications.enableName"),
		desc: translate("settings.features.notifications.enableDesc"),
		getValue: () => plugin.settings.enableNotifications,
		setValue: async (value: boolean) => {
			plugin.settings.enableNotifications = value;
			save();
			// Re-render to show notification type setting
			renderFeaturesTab(container, plugin, save);
		},
	});

	if (plugin.settings.enableNotifications) {
		createDropdownSetting(container, {
			name: translate("settings.features.notifications.typeName"),
			desc: translate("settings.features.notifications.typeDesc"),
			options: [
				{ value: "in-app", label: translate("settings.features.notifications.inAppLabel") },
				{
					value: "system",
					label: translate("settings.features.notifications.systemLabel"),
				},
			],
			getValue: () => plugin.settings.notificationType,
			setValue: async (value: string) => {
				plugin.settings.notificationType = value as "in-app" | "system";
				save();
			},
		});
	}

	// Performance & Behavior Section
	createSectionHeader(container, translate("settings.features.performance.header"));
	createHelpText(container, translate("settings.features.performance.description"));

	createToggleSetting(container, {
		name: translate("settings.features.overdue.hideCompletedName"),
		desc: translate("settings.features.overdue.hideCompletedDesc"),
		getValue: () => plugin.settings.hideCompletedFromOverdue,
		setValue: async (value: boolean) => {
			plugin.settings.hideCompletedFromOverdue = value;
			save();
		},
	});

	createToggleSetting(container, {
		name: translate("settings.features.indexing.disableName"),
		desc: translate("settings.features.indexing.disableDesc"),
		getValue: () => plugin.settings.disableNoteIndexing,
		setValue: async (value: boolean) => {
			plugin.settings.disableNoteIndexing = value;
			save();
		},
	});

	// Suggestion debounce setting
	if (plugin.settings.suggestionDebounceMs !== undefined) {
		createNumberSetting(container, {
			name: translate("settings.features.suggestions.debounceName"),
			desc: translate("settings.features.suggestions.debounceDesc"),
			placeholder: "300",
			min: 0,
			max: 2000,
			getValue: () => plugin.settings.suggestionDebounceMs || 0,
			setValue: async (value: number) => {
				plugin.settings.suggestionDebounceMs = value > 0 ? value : undefined;
				save();
			},
		});
	}

	// Time Tracking Section
	createSectionHeader(container, translate("settings.features.timeTrackingSection.header"));
	createHelpText(container, translate("settings.features.timeTrackingSection.description"));

	createToggleSetting(container, {
		name: translate("settings.features.timeTracking.autoStopName"),
		desc: translate("settings.features.timeTracking.autoStopDesc"),
		getValue: () => plugin.settings.autoStopTimeTrackingOnComplete,
		setValue: async (value: boolean) => {
			plugin.settings.autoStopTimeTrackingOnComplete = value;
			save();
		},
	});

	createToggleSetting(container, {
		name: translate("settings.features.timeTracking.stopNotificationName"),
		desc: translate("settings.features.timeTracking.stopNotificationDesc"),
		getValue: () => plugin.settings.autoStopTimeTrackingNotification,
		setValue: async (value: boolean) => {
			plugin.settings.autoStopTimeTrackingNotification = value;
			save();
		},
	});

	// Recurring Tasks Section
	createSectionHeader(container, translate("settings.features.recurringSection.header"));
	createHelpText(container, translate("settings.features.recurringSection.description"));

	createToggleSetting(container, {
		name: translate("settings.features.recurring.maintainOffsetName"),
		desc: translate("settings.features.recurring.maintainOffsetDesc"),
		getValue: () => plugin.settings.maintainDueDateOffsetInRecurring,
		setValue: async (value: boolean) => {
			plugin.settings.maintainDueDateOffsetInRecurring = value;
			save();
		},
	});

	// Timeblocking Section
	createSectionHeader(container, translate("settings.features.timeblocking.header"));
	createHelpText(container, translate("settings.features.timeblocking.description"));

	createToggleSetting(container, {
		name: translate("settings.features.timeblocking.enableName"),
		desc: translate("settings.features.timeblocking.enableDesc"),
		getValue: () => plugin.settings.calendarViewSettings.enableTimeblocking,
		setValue: async (value: boolean) => {
			plugin.settings.calendarViewSettings.enableTimeblocking = value;
			save();
			// Re-render to show/hide timeblocks visibility setting
			renderFeaturesTab(container, plugin, save);
		},
	});

	if (plugin.settings.calendarViewSettings.enableTimeblocking) {
		createToggleSetting(container, {
			name: translate("settings.features.timeblocking.showBlocksName"),
			desc: translate("settings.features.timeblocking.showBlocksDesc"),
			getValue: () => plugin.settings.calendarViewSettings.defaultShowTimeblocks,
			setValue: async (value: boolean) => {
				plugin.settings.calendarViewSettings.defaultShowTimeblocks = value;
				save();
			},
		});

		createHelpText(container, translate("settings.features.timeblocking.usage"));
	}
}
