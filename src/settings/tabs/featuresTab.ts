import { Notice } from "obsidian";
import TaskNotesPlugin from "../../main";
import {
	createSettingGroup,
	configureTextSetting,
	configureToggleSetting,
	configureDropdownSetting,
	configureNumberSetting,
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
	const availableProperties = getAvailableProperties(plugin);
	const currentInlineProperties = plugin.settings.inlineVisibleProperties || [
		"status", "priority", "due", "scheduled", "recurrence",
	];
	const currentInlineLabels = getPropertyLabels(plugin, currentInlineProperties);

	createSettingGroup(
		container,
		{
			heading: translate("settings.features.inlineTasks.header"),
			description: translate("settings.features.inlineTasks.description"),
		},
		(group) => {
			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.features.overlays.taskLinkToggle.name"),
					desc: translate("settings.features.overlays.taskLinkToggle.description"),
					getValue: () => plugin.settings.enableTaskLinkOverlay,
					setValue: async (value: boolean) => {
						plugin.settings.enableTaskLinkOverlay = value;
						save();
						renderFeaturesTab(container, plugin, save);
					},
				})
			);

			if (plugin.settings.enableTaskLinkOverlay) {
				group.addSetting((setting) => {
					setting
						.setName("Inline Task Card Properties")
						.setDesc("Select which properties to show in inline task cards.")
						.addButton((button) => {
							button.setButtonText("Configure").onClick(() => {
								const modal = new PropertySelectorModal(
									plugin.app,
									availableProperties,
									currentInlineProperties,
									async (selected) => {
										plugin.settings.inlineVisibleProperties = selected;
										save();
										new Notice("Inline task card properties updated");
										renderFeaturesTab(container, plugin, save);
									},
									"Select Inline Task Card Properties",
									"Choose which properties to display in inline task cards."
								);
								modal.open();
							});
						});
				});

				group.addSetting((setting) => {
					setting.setDesc(`Currently showing: ${currentInlineLabels.join(", ")}`);
					setting.settingEl.addClass("settings-view__group-description");
				});
			}

			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.features.instantConvert.toggle.name"),
					desc: translate("settings.features.instantConvert.toggle.description"),
					getValue: () => plugin.settings.enableInstantTaskConvert,
					setValue: async (value: boolean) => {
						plugin.settings.enableInstantTaskConvert = value;
						save();
						renderFeaturesTab(container, plugin, save);
					},
				})
			);
		}
	);

	// Natural Language Processing Section
	createSettingGroup(
		container,
		{
			heading: translate("settings.features.nlp.header"),
			description: translate("settings.features.nlp.description"),
		},
		(group) => {
			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.features.nlp.enable.name"),
					desc: translate("settings.features.nlp.enable.description"),
					getValue: () => plugin.settings.enableNaturalLanguageInput,
					setValue: async (value: boolean) => {
						plugin.settings.enableNaturalLanguageInput = value;
						save();
						renderFeaturesTab(container, plugin, save);
					},
				})
			);

			if (plugin.settings.enableNaturalLanguageInput) {
				group.addSetting((setting) =>
					configureToggleSetting(setting, {
						name: translate("settings.features.nlp.defaultToScheduled.name"),
						desc: translate("settings.features.nlp.defaultToScheduled.description"),
						getValue: () => plugin.settings.nlpDefaultToScheduled,
						setValue: async (value: boolean) => {
							plugin.settings.nlpDefaultToScheduled = value;
							save();
						},
					})
				);

				group.addSetting((setting) =>
					configureDropdownSetting(setting, {
						name: translate("settings.features.nlp.language.name"),
						desc: translate("settings.features.nlp.language.description"),
						options: getAvailableLanguages(),
						getValue: () => plugin.settings.nlpLanguage,
						setValue: async (value: string) => {
							plugin.settings.nlpLanguage = value;
							save();
						},
					})
				);
			}
		}
	);

	// Task Creation Section (Body Templates)
	createSettingGroup(
		container,
		{
			heading: translate("settings.defaults.header.bodyTemplate"),
			description: translate("settings.defaults.description.bodyTemplate"),
		},
		(group) => {
			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.defaults.bodyTemplate.useBodyTemplate.name"),
					desc: translate("settings.defaults.bodyTemplate.useBodyTemplate.description"),
					getValue: () => plugin.settings.taskCreationDefaults.useBodyTemplate,
					setValue: async (value: boolean) => {
						plugin.settings.taskCreationDefaults.useBodyTemplate = value;
						save();
						renderFeaturesTab(container, plugin, save);
					},
				})
			);

			if (plugin.settings.taskCreationDefaults.useBodyTemplate) {
				group.addSetting((setting) =>
					configureTextSetting(setting, {
						name: translate("settings.defaults.bodyTemplate.bodyTemplateFile.name"),
						desc: translate("settings.defaults.bodyTemplate.bodyTemplateFile.description"),
						placeholder: translate("settings.defaults.bodyTemplate.bodyTemplateFile.placeholder"),
						getValue: () => plugin.settings.taskCreationDefaults.bodyTemplate,
						setValue: async (value: string) => {
							plugin.settings.taskCreationDefaults.bodyTemplate = value;
							save();
						},
					})
				);

				// Template Variables Help (rendered as description text)
				group.addSetting((setting) => {
					const variables = [
						translate("settings.defaults.bodyTemplate.variables.title"),
						translate("settings.defaults.bodyTemplate.variables.details"),
						translate("settings.defaults.bodyTemplate.variables.date"),
						translate("settings.defaults.bodyTemplate.variables.time"),
						translate("settings.defaults.bodyTemplate.variables.priority"),
						translate("settings.defaults.bodyTemplate.variables.status"),
						translate("settings.defaults.bodyTemplate.variables.contexts"),
						translate("settings.defaults.bodyTemplate.variables.tags"),
						translate("settings.defaults.bodyTemplate.variables.projects"),
					];
					setting.setName(translate("settings.defaults.bodyTemplate.variablesHeader"));
					setting.setDesc(variables.join(" • "));
				});
			}

			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.defaults.instantConversion.useDefaultsOnInstantConvert.name"),
					desc: translate("settings.defaults.instantConversion.useDefaultsOnInstantConvert.description"),
					getValue: () => plugin.settings.useDefaultsOnInstantConvert,
					setValue: async (value: boolean) => {
						plugin.settings.useDefaultsOnInstantConvert = value;
						save();
					},
				})
			);
		}
	);

	// Pomodoro Timer Section
	createSettingGroup(
		container,
		{
			heading: translate("settings.features.pomodoro.header"),
			description: translate("settings.features.pomodoro.description"),
		},
		(group) => {
			group.addSetting((setting) =>
				configureNumberSetting(setting, {
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
				})
			);

			group.addSetting((setting) =>
				configureNumberSetting(setting, {
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
				})
			);

			group.addSetting((setting) =>
				configureNumberSetting(setting, {
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
				})
			);

			group.addSetting((setting) =>
				configureNumberSetting(setting, {
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
				})
			);

			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.features.pomodoro.autoStartBreaks.name"),
					desc: translate("settings.features.pomodoro.autoStartBreaks.description"),
					getValue: () => plugin.settings.pomodoroAutoStartBreaks,
					setValue: async (value: boolean) => {
						plugin.settings.pomodoroAutoStartBreaks = value;
						save();
					},
				})
			);

			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.features.pomodoro.autoStartWork.name"),
					desc: translate("settings.features.pomodoro.autoStartWork.description"),
					getValue: () => plugin.settings.pomodoroAutoStartWork,
					setValue: async (value: boolean) => {
						plugin.settings.pomodoroAutoStartWork = value;
						save();
					},
				})
			);

			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.features.pomodoro.notifications.name"),
					desc: translate("settings.features.pomodoro.notifications.description"),
					getValue: () => plugin.settings.pomodoroNotifications,
					setValue: async (value: boolean) => {
						plugin.settings.pomodoroNotifications = value;
						save();
					},
				})
			);

			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.features.pomodoroSound.enabledName"),
					desc: translate("settings.features.pomodoroSound.enabledDesc"),
					getValue: () => plugin.settings.pomodoroSoundEnabled,
					setValue: async (value: boolean) => {
						plugin.settings.pomodoroSoundEnabled = value;
						save();
						renderFeaturesTab(container, plugin, save);
					},
				})
			);

			if (plugin.settings.pomodoroSoundEnabled) {
				group.addSetting((setting) =>
					configureNumberSetting(setting, {
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
					})
				);
			}

			group.addSetting((setting) =>
				configureDropdownSetting(setting, {
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
							const data = await plugin.loadData();
							const hasExistingData =
								data?.pomodoroHistory &&
								Array.isArray(data.pomodoroHistory) &&
								data.pomodoroHistory.length > 0;

							const confirmed = await showStorageLocationConfirmationModal(plugin, hasExistingData);

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
								renderFeaturesTab(container, plugin, save);
							}
						}
					},
				})
			);

			group.addSetting((setting) =>
				configureDropdownSetting(setting, {
					name: translate("settings.features.pomodoro.mobileSidebar.name"),
					desc: translate("settings.features.pomodoro.mobileSidebar.description"),
					options: [
						{ value: "tab", label: translate("settings.features.pomodoro.mobileSidebar.tab") },
						{ value: "left", label: translate("settings.features.pomodoro.mobileSidebar.left") },
						{ value: "right", label: translate("settings.features.pomodoro.mobileSidebar.right") },
					],
					getValue: () => plugin.settings.pomodoroMobileSidebar,
					setValue: async (value: string) => {
						plugin.settings.pomodoroMobileSidebar = value as "tab" | "left" | "right";
						save();
					},
				})
			);
		}
	);

	// Notifications Section
	createSettingGroup(
		container,
		{
			heading: translate("settings.features.notifications.header"),
			description: translate("settings.features.notifications.description"),
		},
		(group) => {
			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.features.notifications.enableName"),
					desc: translate("settings.features.notifications.enableDesc"),
					getValue: () => plugin.settings.enableNotifications,
					setValue: async (value: boolean) => {
						plugin.settings.enableNotifications = value;
						save();
						renderFeaturesTab(container, plugin, save);
					},
				})
			);

			if (plugin.settings.enableNotifications) {
				group.addSetting((setting) =>
					configureDropdownSetting(setting, {
						name: translate("settings.features.notifications.typeName"),
						desc: translate("settings.features.notifications.typeDesc"),
						options: [
							{ value: "in-app", label: translate("settings.features.notifications.inAppLabel") },
							{ value: "system", label: translate("settings.features.notifications.systemLabel") },
						],
						getValue: () => plugin.settings.notificationType,
						setValue: async (value: string) => {
							plugin.settings.notificationType = value as "in-app" | "system";
							save();
						},
					})
				);
			}
		}
	);

	// Performance & Behavior Section
	createSettingGroup(
		container,
		{
			heading: translate("settings.features.performance.header"),
			description: translate("settings.features.performance.description"),
		},
		(group) => {
			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.features.overdue.hideCompletedName"),
					desc: translate("settings.features.overdue.hideCompletedDesc"),
					getValue: () => plugin.settings.hideCompletedFromOverdue,
					setValue: async (value: boolean) => {
						plugin.settings.hideCompletedFromOverdue = value;
						save();
					},
				})
			);

			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.features.indexing.disableName"),
					desc: translate("settings.features.indexing.disableDesc"),
					getValue: () => plugin.settings.disableNoteIndexing,
					setValue: async (value: boolean) => {
						plugin.settings.disableNoteIndexing = value;
						save();
					},
				})
			);

			if (plugin.settings.suggestionDebounceMs !== undefined) {
				group.addSetting((setting) =>
					configureNumberSetting(setting, {
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
					})
				);
			}
		}
	);

	// Time Tracking Section
	createSettingGroup(
		container,
		{
			heading: translate("settings.features.timeTrackingSection.header"),
			description: translate("settings.features.timeTrackingSection.description"),
		},
		(group) => {
			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.features.timeTracking.autoStopName"),
					desc: translate("settings.features.timeTracking.autoStopDesc"),
					getValue: () => plugin.settings.autoStopTimeTrackingOnComplete,
					setValue: async (value: boolean) => {
						plugin.settings.autoStopTimeTrackingOnComplete = value;
						save();
					},
				})
			);

			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.features.timeTracking.stopNotificationName"),
					desc: translate("settings.features.timeTracking.stopNotificationDesc"),
					getValue: () => plugin.settings.autoStopTimeTrackingNotification,
					setValue: async (value: boolean) => {
						plugin.settings.autoStopTimeTrackingNotification = value;
						save();
					},
				})
			);
		}
	);

	// Recurring Tasks Section
	createSettingGroup(
		container,
		{
			heading: translate("settings.features.recurringSection.header"),
			description: translate("settings.features.recurringSection.description"),
		},
		(group) => {
			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.features.recurring.maintainOffsetName"),
					desc: translate("settings.features.recurring.maintainOffsetDesc"),
					getValue: () => plugin.settings.maintainDueDateOffsetInRecurring,
					setValue: async (value: boolean) => {
						plugin.settings.maintainDueDateOffsetInRecurring = value;
						save();
					},
				})
			);
		}
	);

	// Timeblocking Section
	createSettingGroup(
		container,
		{
			heading: translate("settings.features.timeblocking.header"),
			description: translate("settings.features.timeblocking.description"),
		},
		(group) => {
			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.features.timeblocking.enableName"),
					desc: translate("settings.features.timeblocking.enableDesc"),
					getValue: () => plugin.settings.calendarViewSettings.enableTimeblocking,
					setValue: async (value: boolean) => {
						plugin.settings.calendarViewSettings.enableTimeblocking = value;
						save();
						renderFeaturesTab(container, plugin, save);
					},
				})
			);

			if (plugin.settings.calendarViewSettings.enableTimeblocking) {
				group.addSetting((setting) =>
					configureToggleSetting(setting, {
						name: translate("settings.features.timeblocking.showBlocksName"),
						desc: translate("settings.features.timeblocking.showBlocksDesc"),
						getValue: () => plugin.settings.calendarViewSettings.defaultShowTimeblocks,
						setValue: async (value: boolean) => {
							plugin.settings.calendarViewSettings.defaultShowTimeblocks = value;
							save();
						},
					})
				);

				group.addSetting((setting) => {
					setting.setDesc(translate("settings.features.timeblocking.usage"));
					setting.settingEl.addClass("settings-view__group-description");
				});
			}
		}
	);
}
