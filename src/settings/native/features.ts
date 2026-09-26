import { Notice } from "obsidian";
import type TaskNotesPlugin from "../../main";
import { showStorageLocationConfirmationModal } from "../../modals/StorageLocationConfirmationModal";
import { getAvailableLanguages } from "../../locales";
import type { TranslationKey } from "../../i18n";
import { propertySelectionPage } from "./propertySelection";
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
import { SettingsContext } from "../native/SettingsContext";
import type { SettingDefinitionGroup } from "obsidian";

export function featuresDefinitions(ctx: SettingsContext): SettingDefinitionGroup[] {
	const { plugin, save } = ctx;
	const translate = (key: TranslationKey, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key, params);
	return [
		{
			type: "group",
			heading: translate("settings.features.inlineTasks.header"),
			items: [
				ctx.toggle("enableTaskLinkOverlay", {
					name: translate("settings.features.overlays.taskLinkToggle.name"),
					desc: translate("settings.features.overlays.taskLinkToggle.description"),
					getValue: () => plugin.settings.enableTaskLinkOverlay,
					setValue: async (value: boolean) => {
						plugin.settings.enableTaskLinkOverlay = value;
						save();
						ctx.refresh();
					},
				}),
				ctx.toggle(
					"disableOverlayOnAlias",
					{
						name: translate("settings.features.overlays.aliasExclusion.name"),
						desc: translate("settings.features.overlays.aliasExclusion.description"),
						getValue: () => plugin.settings.disableOverlayOnAlias,
						setValue: async (value: boolean) => {
							plugin.settings.disableOverlayOnAlias = value;
							save();
						},
					},
					() => !plugin.settings.enableTaskLinkOverlay
				),
				propertySelectionPage(
					ctx,
					"inlineVisibleProperties",
					ctx.t("settings.native.inlineTaskCardProperties"),
					ctx.t("settings.native.selectWhichPropertiesToShowInInlineTaskCards")
				),
				ctx.toggle("enableInstantTaskConvert", {
					name: translate("settings.features.instantConvert.toggle.name"),
					desc: translate("settings.features.instantConvert.toggle.description"),
					getValue: () => plugin.settings.enableInstantTaskConvert,
					setValue: async (value: boolean) => {
						plugin.settings.enableInstantTaskConvert = value;
						save();
						ctx.refresh();
					},
				}),
				ctx.toggle(
					"preserveCheckboxOnConvert",
					{
						name: translate("settings.features.instantConvert.preserveCheckbox.name"),
						desc: translate(
							"settings.features.instantConvert.preserveCheckbox.description"
						),
						getValue: () => plugin.settings.preserveCheckboxOnConvert,
						setValue: async (value: boolean) => {
							plugin.settings.preserveCheckboxOnConvert = value;
							save();
						},
					},
					() => !plugin.settings.enableInstantTaskConvert
				),
			],
		},
		{
			type: "group",
			heading: translate("settings.features.nlp.header"),
			items: [
				ctx.toggle("enableNaturalLanguageInput", {
					name: translate("settings.features.nlp.enable.name"),
					desc: translate("settings.features.nlp.enable.description"),
					getValue: () => plugin.settings.enableNaturalLanguageInput,
					setValue: async (value: boolean) => {
						plugin.settings.enableNaturalLanguageInput = value;
						save();
						ctx.refresh();
					},
				}),
				ctx.toggle(
					"nlpDefaultToScheduled",
					{
						name: translate("settings.features.nlp.defaultToScheduled.name"),
						desc: translate("settings.features.nlp.defaultToScheduled.description"),
						getValue: () => plugin.settings.nlpDefaultToScheduled,
						setValue: async (value: boolean) => {
							plugin.settings.nlpDefaultToScheduled = value;
							save();
						},
					},
					() => !plugin.settings.enableNaturalLanguageInput
				),
				ctx.dropdown(
					"nlpLanguage",
					{
						name: translate("settings.features.nlp.language.name"),
						desc: translate("settings.features.nlp.language.description"),
						options: getAvailableLanguages(),
						getValue: () => plugin.settings.nlpLanguage,
						setValue: async (value: string) => {
							plugin.settings.nlpLanguage = value;
							save();
						},
					},
					() => !plugin.settings.enableNaturalLanguageInput
				),
			],
		},
		{
			type: "group",
			heading: translate("settings.features.taskCreation.header"),
			items: [
				ctx.dropdown("openTaskAfterCreation", {
					name: translate("settings.features.taskCreation.openAfterCreate.name"),
					desc: translate("settings.features.taskCreation.openAfterCreate.description"),
					options: [
						{
							value: "none",
							label: translate(
								"settings.features.taskCreation.openAfterCreate.options.none"
							),
						},
						{
							value: "same-tab",
							label: translate(
								"settings.features.taskCreation.openAfterCreate.options.sameTab"
							),
						},
						{
							value: "new-tab",
							label: translate(
								"settings.features.taskCreation.openAfterCreate.options.newTab"
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
				}),
			],
		},
		{
			type: "group",
			heading: translate("settings.defaults.header.bodyTemplate"),
			items: [
				ctx.toggle("taskCreationDefaults.useBodyTemplate", {
					name: translate("settings.defaults.bodyTemplate.useBodyTemplate.name"),
					desc: translate("settings.defaults.bodyTemplate.useBodyTemplate.description"),
					getValue: () => plugin.settings.taskCreationDefaults.useBodyTemplate,
					setValue: async (value: boolean) => {
						plugin.settings.taskCreationDefaults.useBodyTemplate = value;
						save();
						ctx.refresh();
					},
				}),
				ctx.text(
					"taskCreationDefaults.bodyTemplate",
					{
						name: translate("settings.defaults.bodyTemplate.bodyTemplateFile.name"),
						desc: translate(
							"settings.defaults.bodyTemplate.bodyTemplateFile.description"
						),
						placeholder: translate(
							"settings.defaults.bodyTemplate.bodyTemplateFile.placeholder"
						),
						getValue: () => plugin.settings.taskCreationDefaults.bodyTemplate,
						setValue: async (value: string) => {
							plugin.settings.taskCreationDefaults.bodyTemplate = value;
							save();
						},
					},
					() => !plugin.settings.taskCreationDefaults.useBodyTemplate
				),
				ctx.toggle("taskCreationDefaults.useOccurrenceBodyTemplate", {
					name: translate(
						"settings.defaults.bodyTemplate.useOccurrenceBodyTemplate.name"
					),
					desc: translate(
						"settings.defaults.bodyTemplate.useOccurrenceBodyTemplate.description"
					),
					getValue: () => plugin.settings.taskCreationDefaults.useOccurrenceBodyTemplate,
					setValue: async (value: boolean) => {
						plugin.settings.taskCreationDefaults.useOccurrenceBodyTemplate = value;
						save();
						ctx.refresh();
					},
				}),
				ctx.text(
					"taskCreationDefaults.occurrenceBodyTemplate",
					{
						name: translate(
							"settings.defaults.bodyTemplate.occurrenceBodyTemplateFile.name"
						),
						desc: translate(
							"settings.defaults.bodyTemplate.occurrenceBodyTemplateFile.description"
						),
						placeholder: translate(
							"settings.defaults.bodyTemplate.occurrenceBodyTemplateFile.placeholder"
						),
						getValue: () => plugin.settings.taskCreationDefaults.occurrenceBodyTemplate,
						setValue: async (value: string) => {
							plugin.settings.taskCreationDefaults.occurrenceBodyTemplate = value;
							save();
						},
					},
					() => !plugin.settings.taskCreationDefaults.useOccurrenceBodyTemplate
				),
				{
					name: translate("settings.defaults.bodyTemplate.variablesHeader"),
					visible: () =>
						plugin.settings.taskCreationDefaults.useBodyTemplate ||
						plugin.settings.taskCreationDefaults.useOccurrenceBodyTemplate,
					render: (setting) => {
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
						setting.setName(
							translate("settings.defaults.bodyTemplate.variablesHeader")
						);
						setting.setDesc(variables.join(" • "));
					},
				},
				ctx.toggle("useDefaultsOnInstantConvert", {
					name: translate(
						"settings.defaults.instantConversion.useDefaultsOnInstantConvert.name"
					),
					desc: translate(
						"settings.defaults.instantConversion.useDefaultsOnInstantConvert.description"
					),
					getValue: () => plugin.settings.useDefaultsOnInstantConvert,
					setValue: async (value: boolean) => {
						plugin.settings.useDefaultsOnInstantConvert = value;
						save();
					},
				}),
			],
		},
		{
			type: "group",
			heading: translate("settings.features.pomodoro.header"),
			items: [
				ctx.number("pomodoroWorkDuration", {
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
				}),
				ctx.number("pomodoroShortBreakDuration", {
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
				}),
				ctx.number("pomodoroLongBreakDuration", {
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
				}),
				ctx.number("pomodoroLongBreakInterval", {
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
				}),
				ctx.toggle("pomodoroAutoStartBreaks", {
					name: translate("settings.features.pomodoro.autoStartBreaks.name"),
					desc: translate("settings.features.pomodoro.autoStartBreaks.description"),
					getValue: () => plugin.settings.pomodoroAutoStartBreaks,
					setValue: async (value: boolean) => {
						plugin.settings.pomodoroAutoStartBreaks = value;
						save();
					},
				}),
				ctx.toggle("pomodoroAutoStartWork", {
					name: translate("settings.features.pomodoro.autoStartWork.name"),
					desc: translate("settings.features.pomodoro.autoStartWork.description"),
					getValue: () => plugin.settings.pomodoroAutoStartWork,
					setValue: async (value: boolean) => {
						plugin.settings.pomodoroAutoStartWork = value;
						save();
					},
				}),
				ctx.toggle("pomodoroNotifications", {
					name: translate("settings.features.pomodoro.notifications.name"),
					desc: translate("settings.features.pomodoro.notifications.description"),
					getValue: () => plugin.settings.pomodoroNotifications,
					setValue: async (value: boolean) => {
						plugin.settings.pomodoroNotifications = value;
						save();
					},
				}),
				ctx.toggle("showPomodoroInStatusBar", {
					name: translate("settings.features.pomodoro.statusBar.name"),
					desc: translate("settings.features.pomodoro.statusBar.description"),
					getValue: () => plugin.settings.showPomodoroInStatusBar,
					setValue: async (value: boolean) => {
						plugin.settings.showPomodoroInStatusBar = value;
						save();
						plugin.statusBarService?.updateVisibility();
					},
				}),
				ctx.toggle("pomodoroSoundEnabled", {
					name: translate("settings.features.pomodoroSound.enabledName"),
					desc: translate("settings.features.pomodoroSound.enabledDesc"),
					getValue: () => plugin.settings.pomodoroSoundEnabled,
					setValue: async (value: boolean) => {
						plugin.settings.pomodoroSoundEnabled = value;
						save();
						ctx.refresh();
					},
				}),
				ctx.number(
					"pomodoroSoundVolume",
					{
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
					},
					() => !plugin.settings.pomodoroSoundEnabled
				),
				ctx.dropdown("pomodoroStorageLocation", {
					name: translate("settings.features.dataStorage.name"),
					desc: translate("settings.features.dataStorage.description"),
					options: [
						{
							value: "plugin",
							label: translate("settings.features.dataStorage.pluginData"),
						},
						{
							value: "daily-notes",
							label: translate("settings.features.dataStorage.dailyNotes"),
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
											"settings.features.dataStorage.notices.locationChanged",
											{
												location:
													newLocation === "plugin"
														? translate(
																"settings.features.dataStorage.pluginData"
															)
														: translate(
																"settings.features.dataStorage.dailyNotes"
															),
											}
										)
									);
								} catch (error) {
									ctx.rebuild();
									throw error;
								}
							} else {
								ctx.rebuild();
							}
						}
					},
				}),
				ctx.dropdown("pomodoroMobileSidebar", {
					name: translate("settings.features.pomodoro.mobileSidebar.name"),
					desc: translate("settings.features.pomodoro.mobileSidebar.description"),
					options: [
						{
							value: "tab",
							label: translate("settings.features.pomodoro.mobileSidebar.tab"),
						},
						{
							value: "left",
							label: translate("settings.features.pomodoro.mobileSidebar.left"),
						},
						{
							value: "right",
							label: translate("settings.features.pomodoro.mobileSidebar.right"),
						},
					],
					getValue: () => plugin.settings.pomodoroMobileSidebar,
					setValue: async (value: string) => {
						plugin.settings.pomodoroMobileSidebar = value as "tab" | "left" | "right";
						save();
					},
				}),
			],
		},
		{
			type: "group",
			heading: translate("settings.features.notifications.header"),
			items: [
				ctx.toggle("enableNotifications", {
					name: translate("settings.features.notifications.enableName"),
					desc: translate("settings.features.notifications.enableDesc"),
					getValue: () => plugin.settings.enableNotifications,
					setValue: async (value: boolean) => {
						plugin.settings.enableNotifications = value;
						save();
						ctx.refresh();
					},
				}),
				ctx.dropdown(
					"notificationType",
					{
						name: translate("settings.features.notifications.typeName"),
						desc: translate("settings.features.notifications.typeDesc"),
						options: [
							{
								value: "in-app",
								label: translate("settings.features.notifications.inAppLabel"),
							},
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
					},
					() => !plugin.settings.enableNotifications
				),
				ctx.button(
					"features.action.30",
					{
						name: translate("settings.features.notifications.testReminderName"),
						desc: translate("settings.features.notifications.testReminderDesc"),
						buttonText: translate("settings.features.notifications.testReminderButton"),
						onClick: async () => {
							await plugin.notificationService?.sendTestReminderNotification();
						},
					},
					() => !plugin.settings.enableNotifications
				),
				ctx.toggle(
					"notificationSoundEnabled",
					{
						name: translate("settings.features.notifications.soundEnabledName"),
						desc: translate("settings.features.notifications.soundEnabledDesc"),
						getValue: () => plugin.settings.notificationSoundEnabled,
						setValue: async (value: boolean) => {
							plugin.settings.notificationSoundEnabled = value;
							save();
							ctx.refresh();
						},
					},
					() => !plugin.settings.enableNotifications
				),
				ctx.number(
					"notificationSoundVolume",
					{
						name: translate("settings.features.notifications.soundVolumeName"),
						desc: translate("settings.features.notifications.soundVolumeDesc"),
						placeholder: "50",
						min: 0,
						max: 100,
						getValue: () => plugin.settings.notificationSoundVolume,
						setValue: async (value: number) => {
							plugin.settings.notificationSoundVolume = value;
							save();
						},
					},
					() =>
						!(
							plugin.settings.enableNotifications &&
							plugin.settings.notificationSoundEnabled
						)
				),
				ctx.button(
					"features.action.33",
					{
						name: translate("settings.features.notifications.soundPreviewName"),
						desc: translate("settings.features.notifications.soundPreviewDesc"),
						buttonText: translate("settings.features.notifications.soundPreviewButton"),
						onClick: () => {
							plugin.notificationService?.playNotificationSound();
						},
					},
					() =>
						!(
							plugin.settings.enableNotifications &&
							plugin.settings.notificationSoundEnabled
						)
				),
			],
		},
		{
			type: "group",
			heading: translate("settings.features.performance.header"),
			items: [
				ctx.toggle("hideCompletedFromOverdue", {
					name: translate("settings.features.overdue.hideCompletedName"),
					desc: translate("settings.features.overdue.hideCompletedDesc"),
					getValue: () => plugin.settings.hideCompletedFromOverdue,
					setValue: async (value: boolean) => {
						plugin.settings.hideCompletedFromOverdue = value;
						save();
					},
				}),
				ctx.toggle("disableNoteIndexing", {
					name: translate("settings.features.indexing.disableName"),
					desc: translate("settings.features.indexing.disableDesc"),
					getValue: () => plugin.settings.disableNoteIndexing,
					setValue: async (value: boolean) => {
						plugin.settings.disableNoteIndexing = value;
						save();
					},
				}),
				ctx.number("suggestionDebounceMs", {
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
				}),
			],
		},
		{
			type: "group",
			heading: translate("settings.features.timeTrackingSection.header"),
			items: [
				ctx.toggle("autoStopTimeTrackingOnComplete", {
					name: translate("settings.features.timeTracking.autoStopName"),
					desc: translate("settings.features.timeTracking.autoStopDesc"),
					getValue: () => plugin.settings.autoStopTimeTrackingOnComplete,
					setValue: async (value: boolean) => {
						plugin.settings.autoStopTimeTrackingOnComplete = value;
						save();
					},
				}),
				ctx.toggle("autoStopTimeTrackingNotification", {
					name: translate("settings.features.timeTracking.stopNotificationName"),
					desc: translate("settings.features.timeTracking.stopNotificationDesc"),
					getValue: () => plugin.settings.autoStopTimeTrackingNotification,
					setValue: async (value: boolean) => {
						plugin.settings.autoStopTimeTrackingNotification = value;
						save();
					},
				}),
			],
		},
		{
			type: "group",
			heading: translate("settings.features.recurringSection.header"),
			items: [
				ctx.toggle("maintainDueDateOffsetInRecurring", {
					name: translate("settings.features.recurring.maintainOffsetName"),
					desc: translate("settings.features.recurring.maintainOffsetDesc"),
					getValue: () => plugin.settings.maintainDueDateOffsetInRecurring,
					setValue: async (value: boolean) => {
						plugin.settings.maintainDueDateOffsetInRecurring = value;
						save();
					},
				}),
				ctx.toggle("resetCheckboxesOnRecurrence", {
					name: translate("settings.features.recurring.resetCheckboxesName"),
					desc: translate("settings.features.recurring.resetCheckboxesDesc"),
					getValue: () => plugin.settings.resetCheckboxesOnRecurrence,
					setValue: async (value: boolean) => {
						plugin.settings.resetCheckboxesOnRecurrence = value;
						save();
					},
				}),
			],
		},
		{
			type: "group",
			heading: translate("settings.features.timeblocking.header"),
			items: [
				ctx.toggle("calendarViewSettings.enableTimeblocking", {
					name: translate("settings.features.timeblocking.enableName"),
					desc: translate("settings.features.timeblocking.enableDesc"),
					getValue: () => plugin.settings.calendarViewSettings.enableTimeblocking,
					setValue: async (value: boolean) => {
						plugin.settings.calendarViewSettings.enableTimeblocking = value;
						save();
						ctx.refresh();
					},
				}),
				ctx.dropdown(
					"calendarViewSettings.timeblockAttachmentSearchOrder",
					{
						name: ctx.t("settings.native.attachmentSearchOrder"),
						desc: ctx.t("settings.native.controlsHowFilesAreOrderedInTheAddAttachment"),
						options: [
							{ value: "name-asc", label: ctx.t("settings.native.nameAToZ") },
							{ value: "name-desc", label: ctx.t("settings.native.nameZToA") },
							{ value: "path-asc", label: ctx.t("settings.native.pathAToZ") },
							{ value: "path-desc", label: ctx.t("settings.native.pathZToA") },
							{
								value: "created-recent",
								label: ctx.t("settings.native.createdNewestFirst"),
							},
							{
								value: "created-oldest",
								label: ctx.t("settings.native.createdOldestFirst"),
							},
							{
								value: "modified-recent",
								label: ctx.t("settings.native.modifiedNewestFirst"),
							},
							{
								value: "modified-oldest",
								label: ctx.t("settings.native.modifiedOldestFirst"),
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
					},
					() => !plugin.settings.calendarViewSettings.enableTimeblocking
				),
				ctx.toggle(
					"calendarViewSettings.defaultShowTimeblocks",
					{
						name: translate("settings.features.timeblocking.showBlocksName"),
						desc: translate("settings.features.timeblocking.showBlocksDesc"),
						getValue: () => plugin.settings.calendarViewSettings.defaultShowTimeblocks,
						setValue: async (value: boolean) => {
							plugin.settings.calendarViewSettings.defaultShowTimeblocks = value;
							save();
						},
					},
					() => !plugin.settings.calendarViewSettings.enableTimeblocking
				),
				{
					name: translate("settings.features.timeblocking.defaultColorName"),
					desc: translate("settings.features.timeblocking.defaultColorDesc"),
					visible: () => plugin.settings.calendarViewSettings.enableTimeblocking,
					render: (setting) => {
						setting
							.setName(translate("settings.features.timeblocking.defaultColorName"))
							.setDesc(translate("settings.features.timeblocking.defaultColorDesc"))
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
											plugin.settings.calendarViewSettings
												.defaultTimeblockColor
										);
									save();
								});
							});
					},
				},
				{
					name: "",
					desc: translate("settings.features.timeblocking.usage"),
					visible: () => plugin.settings.calendarViewSettings.enableTimeblocking,
					render: (setting) => {
						setting.setDesc(translate("settings.features.timeblocking.usage"));
						setting.settingEl.addClass("settings-view__group-description");
					},
				},
			],
		},
		{
			type: "group",
			heading: translate("settings.features.debugLogging.header"),
			items: [
				ctx.toggle("enableDebugLogging", {
					name: translate("settings.features.debugLogging.enableName"),
					desc: translate("settings.features.debugLogging.enableDesc"),
					getValue: () => plugin.settings.enableDebugLogging,
					setValue: async (value: boolean) => {
						plugin.settings.enableDebugLogging = value;
						save();
					},
				}),
			],
		},
	];
}
