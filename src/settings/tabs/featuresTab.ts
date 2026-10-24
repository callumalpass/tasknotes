import { uiText } from "../../i18n/runtime";
import { uiData } from "../../i18n/dataText";
import { msg } from "@lingui/core/macro";
import { Notice } from "obsidian";
import TaskNotesPlugin from "../../main";
import {
	createSettingGroup,
	configureTextSetting,
	configureToggleSetting,
	configureDropdownSetting,
	configureNumberSetting,
	configureButtonSetting,
} from "../components/settingHelpers";
import { showStorageLocationConfirmationModal } from "../../modals/StorageLocationConfirmationModal";
import { getAvailableLanguages } from "../../locales";
import type { MessageDescriptor } from "../../i18n";
import { PropertySelectorModal } from "../../modals/PropertySelectorModal";
import { getAvailableProperties, getPropertyLabels } from "../../utils/propertyHelpers";
import { colorValueToInputValue, normalizeThemeColor } from "../../utils/themeColors";
import { configureThemeColorInput } from "../components/CardComponent";

async function getInitializedPomodoroService(plugin: TaskNotesPlugin) {
	if (!plugin.pomodoroService) {
		const { PomodoroService } = await import("../../services/PomodoroService");
		plugin.pomodoroService = new PomodoroService(plugin);
		await plugin.pomodoroService.initialize();
	}

	return plugin.pomodoroService;
}

/**
 * Renders the Features tab - optional plugin modules and their configuration
 */
export function renderFeaturesTab(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void
): void {
	container.empty();

	const translate = (key: MessageDescriptor, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key, params);

	// Inline Tasks Section
	const availableProperties = getAvailableProperties(plugin);
	const currentInlineProperties = plugin.settings.inlineVisibleProperties || [
		"status",
		"priority",
		"due",
		"scheduled",
		"recurrence",
	];
	const currentInlineLabels = getPropertyLabels(plugin, currentInlineProperties);

	createSettingGroup(
		container,
		{
			heading: translate(msg({ message: "Inline tasks", context: "settings.features.inlineTasks.header" })),
			description: translate(msg({ message: "Settings for task links and checkbox-to-task conversion in notes.", context: "settings.features.inlineTasks.description" })),
		},
		(group) => {
			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Task link overlay", context: "settings.features.overlays.taskLinkToggle.name" })),
						desc: translate(msg({ message: "Show interactive overlays when hovering over task links", context: "settings.features.overlays.taskLinkToggle.description" })),
						getValue: () => plugin.settings.enableTaskLinkOverlay,
						setValue: async (value: boolean) => {
							plugin.settings.enableTaskLinkOverlay = value;
							save();
							renderFeaturesTab(container, plugin, save);
						},
					})
			);

			if (plugin.settings.enableTaskLinkOverlay) {
				group.addSetting(
					(setting) =>
						void configureToggleSetting(setting, {
							name: translate(msg({ message: "Disable overlay for aliased links", context: "settings.features.overlays.aliasExclusion.name" })),
							desc: translate(
								msg({ message: "Do not show the task widget if the link contains an alias (e.g. [[Task|Alias]]).", context: "settings.features.overlays.aliasExclusion.description" })
							),
							getValue: () => plugin.settings.disableOverlayOnAlias,
							setValue: async (value: boolean) => {
								plugin.settings.disableOverlayOnAlias = value;
								save();
							},
						})
				);

				group.addSetting((setting) => {
					setting
						.setName(translate(msg({ message: "Inline task card properties", context: "settings.features.inlineTasks.cardProperties" })))
						.setDesc(translate(msg({ message: "Select which properties to show in inline task cards.", context: "settings.features.inlineTasks.cardPropertiesDesc" })))
						.addButton((button) => {
							button.setButtonText(translate(msg({ message: "Configure", context: "common.configure" }))).onClick(() => {
								const modal = new PropertySelectorModal(
									plugin.app,
									availableProperties,
									currentInlineProperties,
									async (selected) => {
										plugin.settings.inlineVisibleProperties = selected;
										save();
										new Notice(
											translate(
												msg({ message: "Inline task card properties updated", context: "settings.features.inlineTasks.cardPropertiesUpdated" })
											)
										);
										renderFeaturesTab(container, plugin, save);
									},
									translate(msg({ message: "Select inline task card properties", context: "modals.propertySelector.inlineTitle" })),
									translate(msg({ message: "Select which properties to show in inline task cards.", context: "settings.features.inlineTasks.cardPropertiesDesc" })),
									plugin
								);
								modal.open();
							});
						});
				});

				group.addSetting((setting) => {
					setting.setDesc(
						translate(msg({ message: "Currently showing: {properties}", context: "settings.appearance.taskCards.showing" }), {
							properties: currentInlineLabels.join(", "),
						})
					);
					setting.settingEl.addClass("settings-view__group-description");
				});
			}

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Show convert button next to checkboxes", context: "settings.features.instantConvert.toggle.name" })),
						desc: translate(msg({ message: "Display an inline button next to Markdown checkboxes that converts them to TaskNotes", context: "settings.features.instantConvert.toggle.description" })),
						getValue: () => plugin.settings.enableInstantTaskConvert,
						setValue: async (value: boolean) => {
							plugin.settings.enableInstantTaskConvert = value;
							save();
							renderFeaturesTab(container, plugin, save);
						},
					})
			);

			if (plugin.settings.enableInstantTaskConvert) {
				group.addSetting(
					(setting) =>
						void configureToggleSetting(setting, {
							name: translate(
								msg({ message: "Keep checkbox when converting", context: "settings.features.instantConvert.preserveCheckbox.name" })
							),
							desc: translate(
								msg({ message: "Leave the original Markdown checkbox marker in place when converting a checkbox to a TaskNote link", context: "settings.features.instantConvert.preserveCheckbox.description" })
							),
							getValue: () => plugin.settings.preserveCheckboxOnConvert,
							setValue: async (value: boolean) => {
								plugin.settings.preserveCheckboxOnConvert = value;
								save();
							},
						})
				);
			}
		}
	);

	// Natural Language Processing Section
	createSettingGroup(
		container,
		{
			heading: translate(msg({ message: "Natural language processing", context: "settings.features.nlp.header" })),
			description: translate(msg({ message: "Parse dates, priorities, and other properties from text input.", context: "settings.features.nlp.description" })),
		},
		(group) => {
			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Enable natural language task input", context: "settings.features.nlp.enable.name" })),
						desc: translate(msg({ message: "Parse due dates, priorities, and contexts from natural language when creating tasks", context: "settings.features.nlp.enable.description" })),
						getValue: () => plugin.settings.enableNaturalLanguageInput,
						setValue: async (value: boolean) => {
							plugin.settings.enableNaturalLanguageInput = value;
							save();
							renderFeaturesTab(container, plugin, save);
						},
					})
			);

			if (plugin.settings.enableNaturalLanguageInput) {
				group.addSetting(
					(setting) =>
						void configureToggleSetting(setting, {
							name: translate(msg({ message: "Default to scheduled", context: "settings.features.nlp.defaultToScheduled.name" })),
							desc: translate(msg({ message: "When NLP detects a date without context, treat it as scheduled rather than due", context: "settings.features.nlp.defaultToScheduled.description" })),
							getValue: () => plugin.settings.nlpDefaultToScheduled,
							setValue: async (value: boolean) => {
								plugin.settings.nlpDefaultToScheduled = value;
								save();
							},
						})
				);

				group.addSetting(
					(setting) =>
						void configureToggleSetting(setting, {
							name: translate(msg({ message: "Enter saves task", context: "settings.features.nlp.enterToSubmit.name" })),
							desc: translate(msg({ message: "In the natural language input, press Enter to save the task. Shift+Enter inserts a newline, and Ctrl/Cmd+Enter still saves.", context: "settings.features.nlp.enterToSubmit.description" })),
							getValue: () => plugin.settings.nlpEnterToSubmit,
							setValue: async (value: boolean) => {
								plugin.settings.nlpEnterToSubmit = value;
								save();
							},
						})
				);

				group.addSetting(
					(setting) =>
						void configureDropdownSetting(setting, {
							name: translate(msg({ message: "NLP language", context: "settings.features.nlp.language.name" })),
							desc: translate(msg({ message: "Language for natural language processing patterns and date parsing", context: "settings.features.nlp.language.description" })),
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

	// Task Creation Section
	createSettingGroup(
		container,
		{
			heading: translate(msg({ message: "Task creation", context: "settings.features.taskCreation.header" })),
			description: translate(msg({ message: "Configure what happens after tasks are created.", context: "settings.features.taskCreation.description" })),
		},
		(group) => {
			group.addSetting(
				(setting) =>
					void configureDropdownSetting(setting, {
						name: translate(msg({ message: "Open task after creation", context: "settings.features.taskCreation.openAfterCreate.name" })),
						desc: translate(
							msg({ message: "Choose whether the task creation modal opens the new task note after saving.", context: "settings.features.taskCreation.openAfterCreate.description" })
						),
						options: [
							{
								value: "none",
								label: translate(
									msg({ message: "Do not open", context: "settings.features.taskCreation.openAfterCreate.options.none" })
								),
							},
							{
								value: "same-tab",
								label: translate(
									msg({ message: "Open in the same tab", context: "settings.features.taskCreation.openAfterCreate.options.sameTab" })
								),
							},
							{
								value: "new-tab",
								label: translate(
									msg({ message: "Open in a new tab", context: "settings.features.taskCreation.openAfterCreate.options.newTab" })
								),
							},
						],
						getValue: () => plugin.settings.openTaskAfterCreation,
						setValue: async (value: string) => {
							plugin.settings.openTaskAfterCreation = value as
								| "none"
								| "same-tab"
								| "new-tab";
							save();
						},
					})
			);
		}
	);

	// Task Creation Section (Body Templates)
	createSettingGroup(
		container,
		{
			heading: translate(msg({ message: "Body template", context: "settings.defaults.header.bodyTemplate" })),
			description: translate(msg({ message: "Configure a template file to use for new task content.", context: "settings.defaults.description.bodyTemplate" })),
		},
		(group) => {
			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Use body template", context: "settings.defaults.bodyTemplate.useBodyTemplate.name" })),
						desc: translate(
							msg({ message: "Use a template file for task body content", context: "settings.defaults.bodyTemplate.useBodyTemplate.description" })
						),
						getValue: () => plugin.settings.taskCreationDefaults.useBodyTemplate,
						setValue: async (value: boolean) => {
							plugin.settings.taskCreationDefaults.useBodyTemplate = value;
							save();
							renderFeaturesTab(container, plugin, save);
						},
					})
			);

			if (plugin.settings.taskCreationDefaults.useBodyTemplate) {
				group.addSetting(
					(setting) =>
						void configureTextSetting(setting, {
							name: translate(msg({ message: "Body template file", context: "settings.defaults.bodyTemplate.bodyTemplateFile.name" })),
							desc: translate(
								msg({ message: "Path to template file for task body content. Supports template variables like '{{title}}', '{{date}}', '{{time}}', '{{priority}}', '{{status}}', etc.", context: "settings.defaults.bodyTemplate.bodyTemplateFile.description" })
							),
							placeholder: uiData("Templates/Task Template.md", "Literal vault-path example, not a translated default or a different template lookup location"),
							getValue: () => plugin.settings.taskCreationDefaults.bodyTemplate,
							setValue: async (value: string) => {
								plugin.settings.taskCreationDefaults.bodyTemplate = value;
								save();
							},
						})
				);
			}

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(
							msg({ message: "Use occurrence note template", context: "settings.defaults.bodyTemplate.useOccurrenceBodyTemplate.name" })
						),
						desc: translate(
							msg({ message: "Use a separate fallback template for materialized occurrence notes when the recurring task has no occurrence_template", context: "settings.defaults.bodyTemplate.useOccurrenceBodyTemplate.description" })
						),
						getValue: () =>
							plugin.settings.taskCreationDefaults.useOccurrenceBodyTemplate,
						setValue: async (value: boolean) => {
							plugin.settings.taskCreationDefaults.useOccurrenceBodyTemplate = value;
							save();
							renderFeaturesTab(container, plugin, save);
						},
					})
			);

			if (plugin.settings.taskCreationDefaults.useOccurrenceBodyTemplate) {
				group.addSetting(
					(setting) =>
						void configureTextSetting(setting, {
							name: translate(
								msg({ message: "Occurrence note template file", context: "settings.defaults.bodyTemplate.occurrenceBodyTemplateFile.name" })
							),
							desc: translate(
								msg({ message: "Path to template file for materialized occurrence notes. A recurring task''s occurrence_template field takes priority over this fallback.", context: "settings.defaults.bodyTemplate.occurrenceBodyTemplateFile.description" })
							),
							placeholder: uiData("Templates/Occurrence Template.md", "Literal vault-path example; persisted occurrence-template locations remain unchanged across locales"),
							getValue: () =>
								plugin.settings.taskCreationDefaults.occurrenceBodyTemplate,
							setValue: async (value: string) => {
								plugin.settings.taskCreationDefaults.occurrenceBodyTemplate = value;
								save();
							},
						})
				);
			}

			if (
				plugin.settings.taskCreationDefaults.useBodyTemplate ||
				plugin.settings.taskCreationDefaults.useOccurrenceBodyTemplate
			) {
				group.addSetting((setting) => {
					const variables = [
						translate(msg({ message: "'{{title}}' - Task title", context: "settings.defaults.bodyTemplate.variables.title" })),
						translate(msg({ message: "'{{details}}' - User-provided details from modal", context: "settings.defaults.bodyTemplate.variables.details" })),
						translate(msg({ message: "'{{date}}' - Current date (YYYY-MM-DD)", context: "settings.defaults.bodyTemplate.variables.date" })),
						translate(msg({ message: "'{{time}}' - Current time (HH:MM)", context: "settings.defaults.bodyTemplate.variables.time" })),
						translate(msg({ message: "'{{priority}}' - Task priority", context: "settings.defaults.bodyTemplate.variables.priority" })),
						translate(msg({ message: "'{{status}}' - Task status", context: "settings.defaults.bodyTemplate.variables.status" })),
						translate(msg({ message: "'{{contexts}}' - Task contexts", context: "settings.defaults.bodyTemplate.variables.contexts" })),
						translate(msg({ message: "'{{tags}}' - Task tags", context: "settings.defaults.bodyTemplate.variables.tags" })),
						translate(msg({ message: "'{{projects}}' - Task projects", context: "settings.defaults.bodyTemplate.variables.projects" })),
					];
					setting.setName(translate(msg({ message: "Template variables:", context: "settings.defaults.bodyTemplate.variablesHeader" })));
					setting.setDesc(variables.join(" • "));
				});
			}

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(
							msg({ message: "Use task defaults on instant convert", context: "settings.defaults.instantConversion.useDefaultsOnInstantConvert.name" })
						),
						desc: translate(
							msg({ message: "Apply default task settings when converting text to tasks instantly", context: "settings.defaults.instantConversion.useDefaultsOnInstantConvert.description" })
						),
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
			heading: translate(msg({ message: "Pomodoro timer", context: "settings.features.pomodoro.header" })),
			description: translate(msg({ message: "Configure work/break intervals for the Pomodoro timer.", context: "settings.features.pomodoro.description" })),
		},
		(group) => {
			group.addSetting(
				(setting) =>
					void configureNumberSetting(setting, {
						name: translate(msg({ message: "Work duration", context: "settings.features.pomodoro.workDuration.name" })),
						desc: translate(msg({ message: "Duration of work intervals in minutes", context: "settings.features.pomodoro.workDuration.description" })),
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

			group.addSetting(
				(setting) =>
					void configureNumberSetting(setting, {
						name: translate(msg({ message: "Short break duration", context: "settings.features.pomodoro.shortBreak.name" })),
						desc: translate(msg({ message: "Duration of short breaks in minutes", context: "settings.features.pomodoro.shortBreak.description" })),
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

			group.addSetting(
				(setting) =>
					void configureNumberSetting(setting, {
						name: translate(msg({ message: "Long break duration", context: "settings.features.pomodoro.longBreak.name" })),
						desc: translate(msg({ message: "Duration of long breaks in minutes", context: "settings.features.pomodoro.longBreak.description" })),
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

			group.addSetting(
				(setting) =>
					void configureNumberSetting(setting, {
						name: translate(msg({ message: "Long break interval", context: "settings.features.pomodoro.longBreakInterval.name" })),
						desc: translate(msg({ message: "Number of work sessions before a long break", context: "settings.features.pomodoro.longBreakInterval.description" })),
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

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Auto-start breaks", context: "settings.features.pomodoro.autoStartBreaks.name" })),
						desc: translate(msg({ message: "Automatically start break timers after work sessions", context: "settings.features.pomodoro.autoStartBreaks.description" })),
						getValue: () => plugin.settings.pomodoroAutoStartBreaks,
						setValue: async (value: boolean) => {
							plugin.settings.pomodoroAutoStartBreaks = value;
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Auto-start work", context: "settings.features.pomodoro.autoStartWork.name" })),
						desc: translate(msg({ message: "Automatically start work sessions after breaks", context: "settings.features.pomodoro.autoStartWork.description" })),
						getValue: () => plugin.settings.pomodoroAutoStartWork,
						setValue: async (value: boolean) => {
							plugin.settings.pomodoroAutoStartWork = value;
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Pomodoro notifications", context: "settings.features.pomodoro.notifications.name" })),
						desc: translate(msg({ message: "Show notifications when Pomodoro sessions end", context: "settings.features.pomodoro.notifications.description" })),
						getValue: () => plugin.settings.pomodoroNotifications,
						setValue: async (value: boolean) => {
							plugin.settings.pomodoroNotifications = value;
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Show Pomodoro in status bar", context: "settings.features.pomodoro.statusBar.name" })),
						desc: translate(msg({ message: "Display the active Pomodoro countdown in Obsidian''s status bar", context: "settings.features.pomodoro.statusBar.description" })),
						getValue: () => plugin.settings.showPomodoroInStatusBar,
						setValue: async (value: boolean) => {
							plugin.settings.showPomodoroInStatusBar = value;
							save();
							plugin.statusBarService?.updateVisibility();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Sound enabled", context: "settings.features.pomodoroSound.enabledName" })),
						desc: translate(msg({ message: "Play sound when Pomodoro sessions end", context: "settings.features.pomodoroSound.enabledDesc" })),
						getValue: () => plugin.settings.pomodoroSoundEnabled,
						setValue: async (value: boolean) => {
							plugin.settings.pomodoroSoundEnabled = value;
							save();
							renderFeaturesTab(container, plugin, save);
						},
					})
			);

			if (plugin.settings.pomodoroSoundEnabled) {
				group.addSetting(
					(setting) =>
						void configureNumberSetting(setting, {
							name: translate(msg({ message: "Sound volume", context: "settings.features.pomodoroSound.volumeName" })),
							desc: translate(msg({ message: "Volume for Pomodoro sounds (0-100)", context: "settings.features.pomodoroSound.volumeDesc" })),
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

			group.addSetting(
				(setting) =>
					void configureDropdownSetting(setting, {
						name: translate(msg({ message: "Pomodoro data storage", context: "settings.features.dataStorage.name" })),
						desc: translate(msg({ message: "Configure where Pomodoro session data is stored and how it''s managed.", context: "settings.features.dataStorage.description" })),
						options: [
							{
								value: "plugin",
								label: translate(msg({ message: "Plugin data", context: "settings.features.dataStorage.pluginData" })),
							},
							{
								value: "daily-notes",
								label: translate(msg({ message: "Daily notes", context: "settings.features.dataStorage.dailyNotes" })),
							},
						],
						getValue: () => plugin.settings.pomodoroStorageLocation,
						setValue: async (value: string) => {
							const newLocation = value as "plugin" | "daily-notes";
							if (newLocation !== plugin.settings.pomodoroStorageLocation) {
								const data = (await plugin.loadData()) as {
									pomodoroHistory?: unknown;
								} | null;
								const hasExistingData =
									Array.isArray(data?.pomodoroHistory) &&
									data.pomodoroHistory.length > 0;

								const confirmed = await showStorageLocationConfirmationModal(
									plugin,
									hasExistingData
								);

								if (confirmed) {
									try {
										if (newLocation === "daily-notes") {
											const pomodoroService =
												await getInitializedPomodoroService(plugin);
											await pomodoroService.migrateTodailyNotes();
										}

										plugin.settings.pomodoroStorageLocation = newLocation;
										save();
										new Notice(
											translate(
												msg({ message: "Pomodoro storage location changed to {location}", context: "settings.features.dataStorage.notices.locationChanged" }),
												{
													location:
														newLocation === "plugin"
															? translate(
																	msg({ message: "Plugin data", context: "settings.features.dataStorage.pluginData" })
																)
															: translate(
																	msg({ message: "Daily notes", context: "settings.features.dataStorage.dailyNotes" })
																),
												}
											)
										);
									} catch {
										renderFeaturesTab(container, plugin, save);
									}
								} else {
									renderFeaturesTab(container, plugin, save);
								}
							}
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureDropdownSetting(setting, {
						name: translate(msg({ message: "Mobile sidebar", context: "settings.features.pomodoro.mobileSidebar.name" })),
						desc: translate(msg({ message: "Where to open the Pomodoro timer on mobile devices", context: "settings.features.pomodoro.mobileSidebar.description" })),
						options: [
							{
								value: "tab",
								label: translate(msg({ message: "Note panel", context: "settings.features.pomodoro.mobileSidebar.tab" })),
							},
							{
								value: "left",
								label: translate(msg({ message: "Left sidebar", context: "settings.features.pomodoro.mobileSidebar.left" })),
							},
							{
								value: "right",
								label: translate(msg({ message: "Right sidebar", context: "settings.features.pomodoro.mobileSidebar.right" })),
							},
						],
						getValue: () => plugin.settings.pomodoroMobileSidebar,
						setValue: async (value: string) => {
							plugin.settings.pomodoroMobileSidebar = value as
								| "tab"
								| "left"
								| "right";
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
			heading: translate(msg({ message: "Notifications", context: "settings.features.notifications.header" })),
			description: translate(msg({ message: "Configure task reminder notifications and alerts.", context: "settings.features.notifications.description" })),
		},
		(group) => {
			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Enable notifications", context: "settings.features.notifications.enableName" })),
						desc: translate(msg({ message: "Enable task reminder notifications", context: "settings.features.notifications.enableDesc" })),
						getValue: () => plugin.settings.enableNotifications,
						setValue: async (value: boolean) => {
							plugin.settings.enableNotifications = value;
							save();
							renderFeaturesTab(container, plugin, save);
						},
					})
			);

			if (plugin.settings.enableNotifications) {
				group.addSetting(
					(setting) =>
						void configureDropdownSetting(setting, {
							name: translate(msg({ message: "Notification type", context: "settings.features.notifications.typeName" })),
							desc: translate(msg({ message: "Type of notifications to show", context: "settings.features.notifications.typeDesc" })),
							options: [
								{
									value: "in-app",
									label: translate(msg({ message: "In-app notifications", context: "settings.features.notifications.inAppLabel" })),
								},
								{
									value: "system",
									label: translate(msg({ message: "System notifications", context: "settings.features.notifications.systemLabel" })),
								},
							],
							getValue: () => plugin.settings.notificationType,
							setValue: async (value: string) => {
								plugin.settings.notificationType = value as "in-app" | "system";
								save();
							},
						})
				);

				group.addSetting(
					(setting) =>
						void configureButtonSetting(setting, {
							name: translate(msg({ message: "Send test reminder", context: "settings.features.notifications.testReminderName" })),
							desc: translate(msg({ message: "Send a test reminder using the current notification type and sound settings.", context: "settings.features.notifications.testReminderDesc" })),
							buttonText: translate(
								msg({ message: "Send test", context: "settings.features.notifications.testReminderButton" })
							),
							onClick: async () => {
								await plugin.notificationService?.sendTestReminderNotification();
							},
						})
				);

				group.addSetting(
					(setting) =>
						void configureToggleSetting(setting, {
							name: translate(msg({ message: "Notification sound", context: "settings.features.notifications.soundEnabledName" })),
							desc: translate(msg({ message: "Play a sound when task reminders trigger", context: "settings.features.notifications.soundEnabledDesc" })),
							getValue: () => plugin.settings.notificationSoundEnabled,
							setValue: async (value: boolean) => {
								plugin.settings.notificationSoundEnabled = value;
								save();
								renderFeaturesTab(container, plugin, save);
							},
						})
				);

				if (plugin.settings.notificationSoundEnabled) {
					group.addSetting(
						(setting) =>
							void configureNumberSetting(setting, {
								name: translate(msg({ message: "Sound volume", context: "settings.features.notifications.soundVolumeName" })),
								desc: translate(msg({ message: "Volume for task reminder sounds (0-100)", context: "settings.features.notifications.soundVolumeDesc" })),
								placeholder: "50",
								min: 0,
								max: 100,
								getValue: () => plugin.settings.notificationSoundVolume,
								setValue: async (value: number) => {
									plugin.settings.notificationSoundVolume = value;
									save();
								},
							})
					);

					group.addSetting(
						(setting) =>
							void configureButtonSetting(setting, {
								name: translate(msg({ message: "Preview notification sound", context: "settings.features.notifications.soundPreviewName" })),
								desc: translate(msg({ message: "Play the configured task reminder sound", context: "settings.features.notifications.soundPreviewDesc" })),
								buttonText: translate(
									msg({ message: "Preview", context: "settings.features.notifications.soundPreviewButton" })
								),
								onClick: () => {
									plugin.notificationService?.playNotificationSound();
								},
							})
					);
				}
			}
		}
	);

	// Performance & Behavior Section
	createSettingGroup(
		container,
		{
			heading: translate(msg({ message: "Performance & behavior", context: "settings.features.performance.header" })),
			description: translate(msg({ message: "Configure plugin performance and behavioral options.", context: "settings.features.performance.description" })),
		},
		(group) => {
			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Hide completed tasks from overdue", context: "settings.features.overdue.hideCompletedName" })),
						desc: translate(msg({ message: "Exclude completed tasks from overdue task calculations", context: "settings.features.overdue.hideCompletedDesc" })),
						getValue: () => plugin.settings.hideCompletedFromOverdue,
						setValue: async (value: boolean) => {
							plugin.settings.hideCompletedFromOverdue = value;
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Disable note indexing", context: "settings.features.indexing.disableName" })),
						desc: translate(msg({ message: "Disable automatic indexing of note content for better performance", context: "settings.features.indexing.disableDesc" })),
						getValue: () => plugin.settings.disableNoteIndexing,
						setValue: async (value: boolean) => {
							plugin.settings.disableNoteIndexing = value;
							save();
						},
					})
			);

			if (plugin.settings.suggestionDebounceMs !== undefined) {
				group.addSetting(
					(setting) =>
						void configureNumberSetting(setting, {
							name: translate(msg({ message: "Suggestion debounce", context: "settings.features.suggestions.debounceName" })),
							desc: translate(msg({ message: "Delay in milliseconds before showing suggestions", context: "settings.features.suggestions.debounceDesc" })),
							placeholder: "300",
							min: 0,
							max: 2000,
							getValue: () => plugin.settings.suggestionDebounceMs || 0,
							setValue: async (value: number) => {
								plugin.settings.suggestionDebounceMs =
									value > 0 ? value : undefined;
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
			heading: translate(msg({ message: "Time tracking", context: "settings.features.timeTrackingSection.header" })),
			description: translate(msg({ message: "Configure automatic time tracking behaviors.", context: "settings.features.timeTrackingSection.description" })),
		},
		(group) => {
			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Auto-stop time tracking", context: "settings.features.timeTracking.autoStopName" })),
						desc: translate(msg({ message: "Automatically stop time tracking when a task is marked complete", context: "settings.features.timeTracking.autoStopDesc" })),
						getValue: () => plugin.settings.autoStopTimeTrackingOnComplete,
						setValue: async (value: boolean) => {
							plugin.settings.autoStopTimeTrackingOnComplete = value;
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Time tracking stop notification", context: "settings.features.timeTracking.stopNotificationName" })),
						desc: translate(msg({ message: "Show notification when time tracking is automatically stopped", context: "settings.features.timeTracking.stopNotificationDesc" })),
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
			heading: translate(msg({ message: "Recurring tasks", context: "settings.features.recurringSection.header" })),
			description: translate(msg({ message: "Configure behavior for recurring task management.", context: "settings.features.recurringSection.description" })),
		},
		(group) => {
			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Maintain due date offset in recurring tasks", context: "settings.features.recurring.maintainOffsetName" })),
						desc: translate(msg({ message: "Keep the offset between due date and scheduled date when recurring tasks are completed", context: "settings.features.recurring.maintainOffsetDesc" })),
						getValue: () => plugin.settings.maintainDueDateOffsetInRecurring,
						setValue: async (value: boolean) => {
							plugin.settings.maintainDueDateOffsetInRecurring = value;
							save();
						},
					})
			);
			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Reset checkboxes on recurrence", context: "settings.features.recurring.resetCheckboxesName" })),
						desc: translate(msg({ message: "Reset all Markdown checkboxes in the task body when a recurring task is completed and rescheduled", context: "settings.features.recurring.resetCheckboxesDesc" })),
						getValue: () => plugin.settings.resetCheckboxesOnRecurrence,
						setValue: async (value: boolean) => {
							plugin.settings.resetCheckboxesOnRecurrence = value;
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
			heading: translate(msg({ message: "Timeblocking", context: "settings.features.timeblocking.header" })),
			description: translate(msg({ message: "Configure timeblock functionality for lightweight scheduling in daily notes. Drag on calendar views to create events - select ''Timeblock'' from the context menu.", context: "settings.features.timeblocking.description" })),
		},
		(group) => {
			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Enable timeblocking", context: "settings.features.timeblocking.enableName" })),
						desc: translate(msg({ message: "Enable timeblocking feature for lightweight scheduling in daily notes. When enabled, ''Timeblock'' option appears in the calendar drag context menu.", context: "settings.features.timeblocking.enableDesc" })),
						getValue: () => plugin.settings.calendarViewSettings.enableTimeblocking,
						setValue: async (value: boolean) => {
							plugin.settings.calendarViewSettings.enableTimeblocking = value;
							save();
							renderFeaturesTab(container, plugin, save);
						},
					})
			);

			if (plugin.settings.calendarViewSettings.enableTimeblocking) {
				group.addSetting(
					(setting) =>
						void configureDropdownSetting(setting, {
							name: translate(msg({ message: "Attachment search order", context: "settings.features.timeblocking.attachmentOrder" })),
							desc: uiText(msg({ message: "Controls how files are ordered in the Add Attachment search window for timeblocks.", context: "settings/tabs/featuresTab: renderFeaturesTab desc" })),
							options: [
								{
									value: "name-asc",
									label: translate(msg({ message: "Name (a to z)", context: "settings.features.timeblocking.nameAsc" })),
								},
								{
									value: "name-desc",
									label: translate(msg({ message: "Name (z to a)", context: "settings.features.timeblocking.nameDesc" })),
								},
								{
									value: "path-asc",
									label: translate(msg({ message: "Path (a to z)", context: "settings.features.timeblocking.pathAsc" })),
								},
								{
									value: "path-desc",
									label: translate(msg({ message: "Path (z to a)", context: "settings.features.timeblocking.pathDesc" })),
								},
								{
									value: "created-recent",
									label: translate(
										msg({ message: "Created (newest first)", context: "settings.features.timeblocking.createdNewest" })
									),
								},
								{
									value: "created-oldest",
									label: translate(
										msg({ message: "Created (oldest first)", context: "settings.features.timeblocking.createdOldest" })
									),
								},
								{
									value: "modified-recent",
									label: translate(
										msg({ message: "Modified (newest first)", context: "settings.features.timeblocking.modifiedNewest" })
									),
								},
								{
									value: "modified-oldest",
									label: translate(
										msg({ message: "Modified (oldest first)", context: "settings.features.timeblocking.modifiedOldest" })
									),
								},
							],
							getValue: () =>
								plugin.settings.calendarViewSettings.timeblockAttachmentSearchOrder,
							setValue: async (value: string) => {
								plugin.settings.calendarViewSettings.timeblockAttachmentSearchOrder =
									value as
										| "name-asc"
										| "name-desc"
										| "path-asc"
										| "path-desc"
										| "created-recent"
										| "created-oldest"
										| "modified-recent"
										| "modified-oldest";
								save();
							},
						})
				);

				group.addSetting(
					(setting) =>
						void configureToggleSetting(setting, {
							name: translate(msg({ message: "Show timeblocks", context: "settings.features.timeblocking.showBlocksName" })),
							desc: translate(msg({ message: "Display timeblocks from daily notes by default", context: "settings.features.timeblocking.showBlocksDesc" })),
							getValue: () =>
								plugin.settings.calendarViewSettings.defaultShowTimeblocks,
							setValue: async (value: boolean) => {
								plugin.settings.calendarViewSettings.defaultShowTimeblocks = value;
								save();
							},
						})
				);

				group.addSetting((setting) => {
					setting
						.setName(translate(msg({ message: "Default timeblock color", context: "settings.features.timeblocking.defaultColorName" })))
						.setDesc(translate(msg({ message: "The default color used when creating new timeblocks", context: "settings.features.timeblocking.defaultColorDesc" })))
						.addText((text) => {
							configureThemeColorInput(text.inputEl);
							text.setValue(
								colorValueToInputValue(
									plugin.settings.calendarViewSettings.defaultTimeblockColor
								)
							);
							text.onChange((value) => {
								plugin.settings.calendarViewSettings.defaultTimeblockColor =
									normalizeThemeColor(
										value,
										plugin.settings.calendarViewSettings.defaultTimeblockColor
									);
								save();
							});
						});
				});

				group.addSetting((setting) => {
					setting.setDesc(translate(msg({ message: "Usage: Drag on the calendar to create events. Select ''Timeblock'' from the context menu (only visible when timeblocking is enabled). Drag to move existing timeblocks. Resize edges to adjust duration.", context: "settings.features.timeblocking.usage" })));
					setting.settingEl.addClass("settings-view__group-description");
				});
			}
		}
	);

	// Debug Logging Section
	createSettingGroup(
		container,
		{
			heading: translate(msg({ message: "Debug logging", context: "settings.features.debugLogging.header" })),
			description: translate(msg({ message: "Configure debug log output for troubleshooting.", context: "settings.features.debugLogging.description" })),
		},
		(group) => {
			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Enable debug logging", context: "settings.features.debugLogging.enableName" })),
						desc: translate(msg({ message: "Log detailed drag-and-drop and view diagnostics to the developer console. Useful for troubleshooting.", context: "settings.features.debugLogging.enableDesc" })),
						getValue: () => plugin.settings.enableDebugLogging,
						setValue: async (value: boolean) => {
							plugin.settings.enableDebugLogging = value;
							save();
						},
					})
			);
		}
	);
}
