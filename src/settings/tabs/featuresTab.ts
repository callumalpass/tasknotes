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
				group.addSetting((setting) =>
					configureToggleSetting(setting, {
						name: translate("settings.features.overlays.aliasExclusion.name"),
						desc: translate("settings.features.overlays.aliasExclusion.description"),
						getValue: () => plugin.settings.disableOverlayOnAlias,
						setValue: async (value: boolean) => {
							plugin.settings.disableOverlayOnAlias = value;
							save();
						},
					})
				);

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

	// Notifications Section (reorganized: General → Task → Base)
	createSettingGroup(
		container,
		{
			heading: translate("settings.features.notifications.header"),
			description: "Configure how notifications behave across the plugin",
		},
		(group) => {
			// ─────────────────────────────────────────────────────────────
			// General (applies to all notification types)
			// ─────────────────────────────────────────────────────────────
			group.addSetting((setting) => {
				setting.setName("General").setHeading();
				setting.setDesc("Settings that apply to all notification types");
			});

			// Toast click behavior (per-device setting)
			group.addSetting((setting) =>
				configureDropdownSetting(setting, {
					name: "Toast click behavior",
					desc: "What happens when you click on the notification toast",
					options: [
						{
							value: "view",
							label: "Open Upcoming View (recommended)",
						},
						{
							value: "expand",
							label: "Expand item list",
						},
					],
					getValue: () => plugin.devicePrefs?.getToastClickBehavior() ?? "view",
					setValue: async (value: string) => {
						plugin.devicePrefs?.setToastClickBehavior(value as "view" | "expand");
					},
				})
			);

			// Status bar click behavior (per-device setting)
			group.addSetting((setting) =>
				configureDropdownSetting(setting, {
					name: "Status bar click behavior",
					desc: "What happens when you click the notification bell in the status bar",
					options: [
						{
							value: "view",
							label: "Open Upcoming View (recommended)",
						},
						{
							value: "toast",
							label: "Show notification toast",
						},
					],
					getValue: () => plugin.devicePrefs?.getStatusBarClickBehavior() ?? "view",
					setValue: async (value: string) => {
						plugin.devicePrefs?.setStatusBarClickBehavior(value as "view" | "toast");
					},
				})
			);

			group.addSetting((setting) =>
				configureNumberSetting(setting, {
					name: "Check interval (minutes)",
					desc: "How often to check for new notification items",
					placeholder: "5",
					min: 1,
					max: 60,
					getValue: () => plugin.settings.vaultWideNotifications?.checkInterval ?? 5,
					setValue: async (value: number) => {
						if (!plugin.settings.vaultWideNotifications) {
							plugin.settings.vaultWideNotifications = {
								enabled: true,
								showOnStartup: false,
								checkInterval: 5,
								enabledSources: {
									bases: true,
									reminderViews: true,
									upstreamReminders: true,
									viewEntry: true,
								},
								defaultReminderTime: "09:00",
								onlyNotifyIfAssignedToMe: false,
								notifyForUnassignedTasks: true,
								baseNotificationDisplay: "individual",
							};
						}
						plugin.settings.vaultWideNotifications.checkInterval = value;
						save();
					},
				})
			);

			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: "Show on startup",
					desc: "Show notifications when Obsidian starts",
					getValue: () => plugin.settings.vaultWideNotifications?.showOnStartup ?? false,
					setValue: async (value: boolean) => {
						if (!plugin.settings.vaultWideNotifications) {
							plugin.settings.vaultWideNotifications = {
								enabled: true,
								showOnStartup: false,
								checkInterval: 5,
								enabledSources: {
									bases: true,
									reminderViews: true,
									upstreamReminders: true,
									viewEntry: true,
								},
								defaultReminderTime: "09:00",
								onlyNotifyIfAssignedToMe: false,
								notifyForUnassignedTasks: true,
								baseNotificationDisplay: "individual",
							};
						}
						plugin.settings.vaultWideNotifications.showOnStartup = value;
						save();
					},
				})
			);

			// Reminder behavior by category (collapsible advanced section)
			group.addSetting((setting) => {
				const descEl = setting.descEl;
				setting.setName("");
				descEl.empty();
				const detailsEl = descEl.createEl("details");
				detailsEl.addClass("reminder-behavior-details");
				const summaryEl = detailsEl.createEl("summary", {
					text: "Reminder behavior by category (advanced)",
				});
				summaryEl.style.cursor = "pointer";
				summaryEl.style.fontWeight = "500";
				summaryEl.style.marginBottom = "8px";

				const contentEl = detailsEl.createEl("div");
				contentEl.style.marginTop = "12px";

				// Import defaults for fallback
				const { DEFAULT_REMINDER_TYPE_SETTINGS } = require("../../settings/defaults");
				const currentSettings = plugin.settings.vaultWideNotifications?.reminderTypeSettings ?? DEFAULT_REMINDER_TYPE_SETTINGS;

				// Get default dismiss behavior for a category
				const getDefaultDismiss = (key: string): string => {
					return (DEFAULT_REMINDER_TYPE_SETTINGS as any)[key]?.dismissBehavior ?? "until-restart";
				};

				// Helper to create category settings
				const createCategorySettings = (
					categoryContainer: HTMLElement,
					categoryKey: string,
					categoryLabel: string,
					categoryDesc: string
				) => {
					const defaultDismiss = getDefaultDismiss(categoryKey);
					const categoryEl = categoryContainer.createEl("div");
					categoryEl.addClass("reminder-category-settings");
					categoryEl.style.marginBottom = "16px";
					categoryEl.style.paddingLeft = "12px";
					categoryEl.style.borderLeft = "2px solid var(--background-modifier-border)";

					const headerEl = categoryEl.createEl("div");
					headerEl.style.fontWeight = "500";
					headerEl.style.marginBottom = "4px";
					headerEl.textContent = categoryLabel;

					const descriptionEl = categoryEl.createEl("div");
					descriptionEl.style.fontSize = "var(--font-ui-smaller)";
					descriptionEl.style.color = "var(--text-muted)";
					descriptionEl.style.marginBottom = "8px";
					descriptionEl.textContent = categoryDesc;

					const controlsEl = categoryEl.createEl("div");
					controlsEl.style.display = "flex";
					controlsEl.style.flexWrap = "wrap";
					controlsEl.style.gap = "12px";
					controlsEl.style.alignItems = "center";

					// Dismiss behavior dropdown
					const dismissGroup = controlsEl.createEl("div");
					dismissGroup.style.display = "flex";
					dismissGroup.style.alignItems = "center";
					dismissGroup.style.gap = "6px";
					dismissGroup.createEl("span", { text: "After 'Got it':", cls: "setting-item-name" });
					const dismissDropdown = dismissGroup.createEl("select");
					dismissDropdown.addClass("dropdown");
					const dismissOptions = [
						{ value: "until-restart", label: "Until restart" },
						{ value: "snooze-1h", label: "Snooze 1 hour" },
						{ value: "snooze-4h", label: "Snooze 4 hours" },
						{ value: "snooze-1d", label: "Snooze 1 day" },
						{ value: "until-data-change", label: "Until data changes" },
						{ value: "until-next-reminder", label: "Until next reminder" },
						{ value: "until-complete", label: "Until completed" },
						{ value: "permanent", label: "Permanently" },
					];
					for (const opt of dismissOptions) {
						// Add "(default)" label if this is the default for this category
						const isDefault = opt.value === defaultDismiss;
						const displayLabel = isDefault ? `${opt.label} (default)` : opt.label;
						const optionEl = dismissDropdown.createEl("option", { value: opt.value, text: displayLabel });
						if ((currentSettings as any)[categoryKey]?.dismissBehavior === opt.value) {
							optionEl.selected = true;
						}
					}
					dismissDropdown.addEventListener("change", async () => {
						const settings = plugin.settings.vaultWideNotifications?.reminderTypeSettings ?? { ...DEFAULT_REMINDER_TYPE_SETTINGS };
						(settings as any)[categoryKey] = {
							...(settings as any)[categoryKey],
							dismissBehavior: dismissDropdown.value,
						};
						if (!plugin.settings.vaultWideNotifications) {
							plugin.settings.vaultWideNotifications = { ...DEFAULT_REMINDER_TYPE_SETTINGS };
						}
						plugin.settings.vaultWideNotifications.reminderTypeSettings = settings;
						save();
					});

					// Show in bell checkbox
					const bellGroup = controlsEl.createEl("label");
					bellGroup.style.display = "flex";
					bellGroup.style.alignItems = "center";
					bellGroup.style.gap = "4px";
					bellGroup.style.cursor = "pointer";
					const bellCheckbox = bellGroup.createEl("input", { type: "checkbox" });
					bellCheckbox.checked = (currentSettings as any)[categoryKey]?.showInBellCount ?? true;
					bellGroup.createEl("span", { text: "Show in bell count" });
					bellCheckbox.addEventListener("change", async () => {
						const settings = plugin.settings.vaultWideNotifications?.reminderTypeSettings ?? { ...DEFAULT_REMINDER_TYPE_SETTINGS };
						(settings as any)[categoryKey] = {
							...(settings as any)[categoryKey],
							showInBellCount: bellCheckbox.checked,
						};
						if (!plugin.settings.vaultWideNotifications) {
							plugin.settings.vaultWideNotifications = { ...DEFAULT_REMINDER_TYPE_SETTINGS };
						}
						plugin.settings.vaultWideNotifications.reminderTypeSettings = settings;
						save();
					});

					// Show toast checkbox
					const toastGroup = controlsEl.createEl("label");
					toastGroup.style.display = "flex";
					toastGroup.style.alignItems = "center";
					toastGroup.style.gap = "4px";
					toastGroup.style.cursor = "pointer";
					const toastCheckbox = toastGroup.createEl("input", { type: "checkbox" });
					toastCheckbox.checked = (currentSettings as any)[categoryKey]?.showToast ?? true;
					toastGroup.createEl("span", { text: "Show popup" });
					toastCheckbox.addEventListener("change", async () => {
						const settings = plugin.settings.vaultWideNotifications?.reminderTypeSettings ?? { ...DEFAULT_REMINDER_TYPE_SETTINGS };
						(settings as any)[categoryKey] = {
							...(settings as any)[categoryKey],
							showToast: toastCheckbox.checked,
						};
						if (!plugin.settings.vaultWideNotifications) {
							plugin.settings.vaultWideNotifications = { ...DEFAULT_REMINDER_TYPE_SETTINGS };
						}
						plugin.settings.vaultWideNotifications.reminderTypeSettings = settings;
						save();
					});

					// Dynamic help text that explains what the current dismiss behavior does
					const helpText = categoryEl.createEl("div");
					helpText.addClass("reminder-behavior-help");

					const updateHelpText = (behavior: string) => {
						// Template: static text with <span class="value"> for dynamic parts
						const templates: Record<string, string> = {
							"until-restart": 'Removed from bell until <span class="reminder-help-value">Obsidian restarts</span>',
							"snooze-1h": 'Removed from bell for <span class="reminder-help-value">1 hour</span>, then returns',
							"snooze-4h": 'Removed from bell for <span class="reminder-help-value">4 hours</span>, then returns',
							"snooze-1d": 'Removed from bell for <span class="reminder-help-value">1 day</span>, then returns',
							"until-data-change": 'Removed from bell until <span class="reminder-help-value">item\'s data changes</span>',
							"until-next-reminder": 'Removed until <span class="reminder-help-value">next scheduled reminder</span>',
							"until-complete": 'Removed from bell until <span class="reminder-help-value">task is completed</span>',
							"permanent": '<span class="reminder-help-value">Permanently removed</span> (never returns)',
						};
						helpText.innerHTML = templates[behavior] || "";
					};

					// Set initial help text
					updateHelpText(dismissDropdown.value);

					// Update help text when dropdown changes
					dismissDropdown.addEventListener("change", () => {
						updateHelpText(dismissDropdown.value);
					});
				};

				// Create settings for each category
				createCategorySettings(contentEl, "overdue", "Overdue", "Items past their due date — typically most persistent");
				createCategorySettings(contentEl, "today", "Due today", "Items due today — urgent, but less persistent than overdue");
				createCategorySettings(contentEl, "tomorrow", "Due tomorrow", "Items due tomorrow — heads up, awareness only");
				createCategorySettings(contentEl, "thisWeek", "This week", "Items due this week — planning horizon");
				createCategorySettings(contentEl, "scheduled", "Scheduled/start date", "Items with scheduled start dates — awareness reminders");
				createCategorySettings(contentEl, "queryBased", "Query-based (Bases)", "Items from Bases views — notification returns when query results change");

				// Add explanation
				const explanationEl = contentEl.createEl("div");
				explanationEl.style.marginTop = "16px";
				explanationEl.style.padding = "8px 12px";
				explanationEl.style.backgroundColor = "var(--background-secondary)";
				explanationEl.style.borderRadius = "4px";
				explanationEl.style.fontSize = "var(--font-ui-smaller)";

				const explanationHeader = explanationEl.createEl("div");
				explanationHeader.style.fontWeight = "500";
				explanationHeader.style.marginBottom = "6px";
				explanationHeader.textContent = "How these settings work:";

				const explanationList = explanationEl.createEl("ul");
				explanationList.style.margin = "0";
				explanationList.style.paddingLeft = "16px";
				explanationList.createEl("li", {
					text: '"Show in bell count" — If unchecked, these items won\'t appear in the status bar count',
				});
				explanationList.createEl("li", {
					text: '"Show popup" — If unchecked, these items won\'t trigger toast notifications',
				});
				explanationList.createEl("li", {
					text: '"After \'Got it\'" — When you dismiss the toast, items are temporarily removed from the bell. This setting controls when they return.',
				});

				setting.settingEl.addClass("settings-view__group-description");
			});

			// ─────────────────────────────────────────────────────────────
			// Task Notifications (upstream reminders based on due/scheduled)
			// ─────────────────────────────────────────────────────────────
			group.addSetting((setting) => {
				setting.setName("Task notifications").setHeading();
				setting.setDesc("Upstream reminders based on task due/scheduled dates");
			});

			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.features.notifications.enableName"),
					desc: "Get notified when tasks are due or scheduled",
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
							{ value: "both", label: "Both (system + in-app)" },
						],
						getValue: () => plugin.settings.notificationType,
						setValue: async (value: string) => {
							plugin.settings.notificationType = value as "in-app" | "system" | "both";
							save();
						},
					})
				);

				// Test notification button
				group.addSetting((setting) => {
					setting
						.setName("Test notification")
						.setDesc("Send a test notification using the delivery type above")
						.addButton((button) =>
							button
								.setButtonText("Send test")
								.onClick(() => {
									const type = plugin.settings.notificationType || "in-app";
									sendTestNotification(type, plugin);
								})
						);
				});

				// System notification troubleshooting (show when system or both selected)
				if (plugin.settings.notificationType === "system" || plugin.settings.notificationType === "both") {
					group.addSetting((setting) => {
						const descEl = setting.descEl;
						setting.setName("System notification troubleshooting");
						const permStatus = "Notification" in window ? Notification.permission : "unavailable";
						descEl.appendText(`Browser permission: ${permStatus}. `);

						const detailsEl = descEl.createEl("details");
						detailsEl.createEl("summary", {
							text: "Not seeing system notifications?",
						});
						const list = detailsEl.createEl("ul");
						list.style.marginTop = "4px";
						list.style.paddingLeft = "16px";
						list.createEl("li", {
							text: "Windows: Settings \u2192 System \u2192 Notifications. Make sure Obsidian is listed and allowed, banners are enabled, and Do Not Disturb / Focus Assist is off.",
						});
						list.createEl("li", {
							text: "macOS: System Settings \u2192 Notifications \u2192 Obsidian. Ensure alerts are enabled and Focus is off.",
						});
						list.createEl("li", {
							text: "Linux: Check your desktop environment's notification daemon is running.",
						});

						const knownIssueLi = list.createEl("li");
						knownIssueLi.appendText("Known Electron limitation: On Windows, Obsidian may not register as a notification sender with the OS. If Obsidian does not appear in your Windows notification settings, system notifications will silently fail. This is an ");
						knownIssueLi.createEl("a", {
							text: "upstream Electron issue",
							href: "https://github.com/electron/electron/issues/4973",
						});
						knownIssueLi.appendText(" that requires a fix from the Obsidian team (");
						knownIssueLi.createEl("a", {
							text: "related discussion",
							href: "https://github.com/uphy/obsidian-reminder/issues/73",
						});
						knownIssueLi.appendText("). Use \"In-app\" or \"Both\" as a workaround.");

						list.createEl("li", {
							text: "Obsidian cannot detect if your OS silently suppressed a notification (e.g., via Do Not Disturb). If the test fires but nothing appears, the OS is blocking it.",
						});
					});
				}

				// Cross-link to per-device scope settings
				group.addSetting((setting) => {
					const descEl = setting.descEl;
					setting.setName("Per-device scope");
					descEl.appendText("In shared vaults, each device can override the notification type and filter by assignment. ");
					const linkEl = descEl.createEl("a", {
						text: "Team & Attribution \u2192",
						href: "#",
					});
					linkEl.addEventListener("click", (e) => {
						e.preventDefault();
						navigateToNotificationScope(plugin);
					});
				});

				// Cross-link to reminder configuration
				group.addSetting((setting) => {
					const descEl = setting.descEl;
					setting.setName("Reminder configuration");
					descEl.appendText("Configure default and global reminders for new and existing tasks. ");
					const reminderLink = descEl.createEl("a", {
						text: "Task Properties \u2192 Reminders \u2192",
						href: "#",
					});
					reminderLink.addEventListener("click", (e) => {
						e.preventDefault();
						navigateToRemindersProperty(plugin);
					});
				});
			}

			// ─────────────────────────────────────────────────────────────
			// Base Notifications (Bases views with notify: true)
			// ─────────────────────────────────────────────────────────────
			group.addSetting((setting) => {
				setting.setName("Base notifications").setHeading();
				setting.setDesc("Notifications from Bases views with notify: true in their YAML");
			});

			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: "Enable base notifications",
					desc: "Show notifications when items match your notify-enabled Bases views",
					getValue: () => plugin.settings.vaultWideNotifications?.enabled ?? true,
					setValue: async (value: boolean) => {
						if (!plugin.settings.vaultWideNotifications) {
							plugin.settings.vaultWideNotifications = {
								enabled: true,
								showOnStartup: false,
								checkInterval: 5,
								enabledSources: {
									bases: true,
									reminderViews: true,
									upstreamReminders: true,
									viewEntry: true,
								},
								defaultReminderTime: "09:00",
								onlyNotifyIfAssignedToMe: false,
								notifyForUnassignedTasks: true,
								baseNotificationDisplay: "individual",
							};
						}
						plugin.settings.vaultWideNotifications.enabled = value;
						save();
						renderFeaturesTab(container, plugin, save);
					},
				})
			);

			if (plugin.settings.vaultWideNotifications?.enabled !== false) {
				group.addSetting((setting) =>
					configureDropdownSetting(setting, {
						name: "Display mode",
						desc: "How to show notifications from Bases views",
						options: [
							{
								value: "individual",
								label: "Show individual items (recommended)",
							},
							{
								value: "rollup",
								label: "Roll up to base level",
							},
						],
						getValue: () =>
							plugin.settings.vaultWideNotifications?.baseNotificationDisplay || "individual",
						setValue: async (value: string) => {
							if (!plugin.settings.vaultWideNotifications) {
								plugin.settings.vaultWideNotifications = {
									enabled: true,
									showOnStartup: false,
									checkInterval: 5,
									enabledSources: {
										bases: true,
										reminderViews: true,
										upstreamReminders: true,
										viewEntry: true,
									},
									defaultReminderTime: "09:00",
									onlyNotifyIfAssignedToMe: false,
									notifyForUnassignedTasks: true,
									baseNotificationDisplay: "individual",
								};
							}
							plugin.settings.vaultWideNotifications.baseNotificationDisplay = value as
								| "rollup"
								| "individual";
							save();
						},
					})
				);

				// Explanation of modes
				group.addSetting((setting) => {
					const descEl = setting.descEl;
					setting.setName("");
					descEl.empty();
					const detailsEl = descEl.createEl("details");
					detailsEl.createEl("summary", {
						text: "What do these modes mean?",
					});
					const list = detailsEl.createEl("ul");
					list.style.marginTop = "4px";
					list.style.paddingLeft = "16px";
					list.createEl("li", {
						text: 'Roll up: Shows one notification per base with a count (e.g., "Documents Coming Due (3 items)"). Best for dynamic queries where items flow in and out.',
					});
					list.createEl("li", {
						text: "Individual: Shows each matching item separately. Better when you want to track and dismiss specific items.",
					});
					setting.settingEl.addClass("settings-view__group-description");
				});
			}
		}
	);

	// Bases Views Section
	createSettingGroup(
		container,
		{
			heading: "Bases views",
			description: "Settings for Bases view integration and toolbar buttons",
		},
		(group) => {
			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: "Bulk tasking button",
					desc: "Show the bulk tasking button in Bases view toolbars",
					getValue: () => plugin.settings.enableBulkActionsButton,
					setValue: async (value: boolean) => {
						plugin.settings.enableBulkActionsButton = value;
						save();
					},
				})
			);

			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: "Universal view buttons",
					desc: "Show New Task and Bulk tasking buttons on all Bases views, not just TaskNotes view types (Table, Board, etc.)",
					getValue: () => plugin.settings.enableUniversalBasesButtons,
					setValue: async (value: boolean) => {
						plugin.settings.enableUniversalBasesButtons = value;
						save();
					},
				})
			);

			group.addSetting((setting) =>
				setting
					.setName("Default bulk mode")
					.setDesc("Choose which tab the bulk tasking modal opens to by default")
					.addDropdown((dropdown) =>
						dropdown
							.addOption("convert", "Convert")
							.addOption("bulkEdit", "Edit")
							.addOption("generate", "Generate")
							.setValue(plugin.settings.defaultBulkMode || "convert")
							.onChange(async (value) => {
								plugin.settings.defaultBulkMode = value as "generate" | "convert" | "bulkEdit";
								save();
							})
					)
			);

			// Cross-link to Base notifications settings
			group.addSetting((setting) => {
				const descEl = setting.descEl;
				setting.setName("Notification settings");
				descEl.appendText("Configure notifications for Bases with notify: true. ");
				const linkEl = descEl.createEl("a", {
					text: "Base notifications \u2192",
					href: "#",
				});
				linkEl.addEventListener("click", (e) => {
					e.preventDefault();
					scrollToBaseNotifications(container);
				});
			});
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
			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.features.recurring.resetCheckboxesName"),
					desc: translate("settings.features.recurring.resetCheckboxesDesc"),
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
					setting
						.setName(translate("settings.features.timeblocking.defaultColorName"))
						.setDesc(translate("settings.features.timeblocking.defaultColorDesc"))
						.addText((text) => {
							text.inputEl.type = "color";
							text.setValue(plugin.settings.calendarViewSettings.defaultTimeblockColor);
							text.onChange(async (value) => {
								plugin.settings.calendarViewSettings.defaultTimeblockColor = value;
								await save();
							});
						});
				});

				group.addSetting((setting) => {
					setting.setDesc(translate("settings.features.timeblocking.usage"));
					setting.settingEl.addClass("settings-view__group-description");
				});
			}
		}
	);
}

/**
 * Send a test notification with diagnostic feedback.
 * Shared by both Features and Team & Attribution test buttons.
 */
export function sendTestNotification(type: "in-app" | "system" | "both", plugin: TaskNotesPlugin): void {
	const message = "This is a test notification from TaskNotes.";
	const diagnostics: string[] = [];

	if (type === "system" || type === "both") {
		if (!("Notification" in window)) {
			diagnostics.push("System: Notification API not available in this environment.");
		} else {
			diagnostics.push(`System: permission=${Notification.permission}`);
			if (Notification.permission === "granted") {
				try {
					const n = new Notification("TaskNotes Test", { body: message });
					n.onshow = () => diagnostics.push("System: onshow fired");
					n.onerror = () => {
						new Notice("System notification error. Your OS may be blocking Obsidian notifications.");
					};
					diagnostics.push("System: Notification constructor succeeded. If nothing appeared, your OS is suppressing it (DND, Focus Assist, or app-level block).");
				} catch (err) {
					diagnostics.push(`System: constructor threw: ${err}`);
					new Notice(`System notification failed: ${err}`);
				}
			} else if (Notification.permission === "default") {
				Notification.requestPermission().then((perm) => {
					if (perm === "granted") {
						new Notification("TaskNotes Test", { body: message });
						new Notice("System: permission granted. Notification sent.");
					} else {
						new Notice(`System: permission ${perm}. Notifications won't work until allowed.`);
					}
				});
				return; // async flow, skip the summary notice
			} else {
				diagnostics.push("System: permission denied. Re-enable in OS settings for Obsidian.");
				new Notice("System notifications denied. Re-enable in your OS notification settings for Obsidian.");
			}
		}
	}

	if (type === "in-app" || type === "both") {
		// Use the enhanced toast with mock items showing both base notifications and tasks
		const mockItems = [
			// Base notifications (use layers icon)
			{
				path: "TaskNotes/Views/overdue-tasks.base",
				title: "Overdue tasks",
				isTask: false,
				isBaseNotification: true,
				timeCategory: "overdue" as const,
				timeContext: "3 items match",
				matchCount: 3,
				sourceBasePath: "TaskNotes/Views/overdue-tasks.base",
				sources: [{ type: "base" as const, name: "Overdue tasks" }],
			},
			{
				path: "TaskNotes/Views/documents-coming-due.base",
				title: "Documents coming due",
				isTask: false,
				isBaseNotification: true,
				timeCategory: "today" as const,
				timeContext: "5 items match",
				matchCount: 5,
				sourceBasePath: "TaskNotes/Views/documents-coming-due.base",
				sources: [{ type: "base" as const, name: "Documents coming due" }],
			},
			// Individual task items (use urgency-specific icons)
			{
				path: "TaskNotes/Tasks/test-task-1.md",
				title: "Submit quarterly report",
				isTask: true,
				isBaseNotification: false,
				timeCategory: "overdue" as const,
				timeContext: "Due yesterday",
				sources: [{ type: "base" as const, name: "Test" }],
			},
			{
				path: "TaskNotes/Tasks/test-task-2.md",
				title: "Review pull request",
				isTask: true,
				isBaseNotification: false,
				timeCategory: "today" as const,
				timeContext: "Due today",
				sources: [{ type: "base" as const, name: "Test" }],
			},
			{
				path: "TaskNotes/Tasks/test-task-3.md",
				title: "Update documentation",
				isTask: true,
				isBaseNotification: false,
				timeCategory: "thisWeek" as const,
				timeContext: "Due Friday",
				sources: [{ type: "base" as const, name: "Test" }],
			},
		];

		plugin.toastNotification.showAggregated({
			items: mockItems,
			counts: {
				total: 5,
				overdue: 2,
				today: 2,
				fromBases: 2,
			},
		});
		diagnostics.push("In-app: enhanced toast shown with mixed base + task items.");
	}

	// Show diagnostic summary
	if (diagnostics.length > 0) {
		plugin.debugLog.log('FeaturesTab', 'Test notification diagnostics:', diagnostics.join(" | "));
	}
}

/**
 * Navigate to Team & Attribution tab and scroll to Notification scope section
 */
function navigateToNotificationScope(plugin: TaskNotesPlugin): void {
	const settingsTab = (plugin.app as any).setting?.activeTab;
	if (settingsTab?.containerEl) {
		const tabContent = settingsTab.containerEl.querySelector(
			"#tab-content-team-attribution"
		) as HTMLElement;
		if (tabContent) {
			tabContent.empty();
		}
		const tabButton = settingsTab.containerEl.querySelector(
			"#tab-button-team-attribution"
		) as HTMLElement;
		if (tabButton) {
			tabButton.click();
			setTimeout(() => {
				const headings = settingsTab.containerEl.querySelectorAll(
					".setting-item-heading .setting-item-name"
				);
				for (const heading of headings) {
					if (heading.textContent?.toLowerCase().includes("notification scope")) {
						(heading as HTMLElement).scrollIntoView({ behavior: "smooth", block: "start" });
						break;
					}
				}
			}, 200);
		}
	}
}

/**
 * Scroll to Base notifications sub-section within the current tab
 */
function scrollToBaseNotifications(container: HTMLElement): void {
	// Find the "Base notifications" heading within the settings container
	const headings = container.querySelectorAll(".setting-item-heading .setting-item-name");
	for (const heading of headings) {
		if (heading.textContent?.toLowerCase().includes("base notifications")) {
			(heading as HTMLElement).scrollIntoView({ behavior: "smooth", block: "start" });
			break;
		}
	}
}

/**
 * Navigate to Task Properties tab and scroll to the Reminders property card.
 */
function navigateToRemindersProperty(plugin: TaskNotesPlugin): void {
	const settingsTab = (plugin.app as any).setting?.activeTab;
	if (settingsTab?.containerEl) {
		const tabButton = settingsTab.containerEl.querySelector(
			"#tab-button-task-properties"
		) as HTMLElement;
		if (tabButton) {
			tabButton.click();
			setTimeout(() => {
				const card = settingsTab.containerEl.querySelector(
					"[data-card-id='property-reminders']"
				) as HTMLElement;
				if (card) {
					// Expand card if collapsed
					if (card.classList.contains("tasknotes-settings__card--collapsed")) {
						const header = card.querySelector(".tasknotes-settings__card-header") as HTMLElement;
						header?.click();
					}
					setTimeout(() => {
						card.scrollIntoView({ behavior: "smooth", block: "start" });
					}, 100);
				}
			}, 200);
		}
	}
}
