import { displayError } from "../../i18n/runtime";
import { uiData } from "../../i18n/dataText";
import { uiText } from "../../i18n/runtime";
import { messageForKey } from "../../i18n/messages";
import { msg } from "@lingui/core/macro";
import { Notice, TFile } from "obsidian";
import TaskNotesPlugin from "../../main";
import {
	createSettingGroup,
	configureTextSetting,
	configureToggleSetting,
	configureDropdownSetting,
} from "../components/settingHelpers";
import { TranslationKey } from "../../i18n";
import { languagePackConfig } from "../../i18n/languagePackConfig";
import { showConfirmationModal } from "../../modals/ConfirmationModal";
import type { HideIdentifyingTagsMode } from "../../types/settings";
import { createTaskNotesLogger } from "../../utils/tasknotesLogger";
import { hasCompletePropertyTaskIdentification } from "../../utils/taskIdentification";
import {
	createVaultFile,
	createVaultFolder,
	modifyVaultFile,
} from "../../services/VaultMutationService";

const tasknotesLogger = createTaskNotesLogger({ tag: "Settings/Tabs/GeneralTab" });

/**
 * Renders the General tab - foundational settings for task identification and storage
 */
export function renderGeneralTab(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void
): void {
	container.empty();

	const translate = (key: TranslationKey, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key, params);

	// Tasks Storage Section
	createSettingGroup(
		container,
		{
			heading: translate(msg({ message: "Task storage", context: "settings.general.taskStorage.header" })),
			description: translate(msg({ message: "Configure where tasks are stored and how they are identified.", context: "settings.general.taskStorage.description" })),
		},
		(group) => {
			group.addSetting(
				(setting) =>
					void configureTextSetting(setting, {
						name: translate(msg({ message: "Default tasks folder", context: "settings.general.taskStorage.defaultFolder.name" })),
						desc: translate(msg({ message: "Default location for new tasks. Supports folder template variables like '{{currentNotePath}}', '{{currentNoteTitle}}', and '{{projectFilePath}}', plus Daily Notes-style date tokens like YYYY/MM/DD.", context: "settings.general.taskStorage.defaultFolder.description" })),
						placeholder: uiData("TaskNotes", "Example vault folder path, tag identifier or filename-template syntax; preserve the entered data contract"),
						getValue: () => plugin.settings.tasksFolder,
						setValue: async (value: string) => {
							plugin.settings.tasksFolder = value;
							save();
						},
						ariaLabel: uiText(msg({ message: "Default folder path for new tasks", context: "settings/tabs/generalTab: renderGeneralTab ariaLabel" })),
					})
			);

			group.addSetting(
				(setting) =>
					void configureTextSetting(setting, {
						name: translate(msg({ message: "Folder for inline-created tasks", context: "settings.features.instantConvert.folder.name" })),
						desc: translate(msg({ message: "Folder where tasks created from inline commands or checkbox conversion will be created. Leave empty to use the default tasks folder. Use '{{currentNotePath}}' for the current note''s folder, or '{{currentNoteTitle}}' for a subfolder named after the current note.", context: "settings.features.instantConvert.folder.description" })),
						placeholder: uiData("{{currentNotePath}}", "Example vault folder path, tag identifier or filename-template syntax; preserve the entered data contract"),
						getValue: () => plugin.settings.inlineTaskConvertFolder,
						setValue: async (value: string) => {
							plugin.settings.inlineTaskConvertFolder = value;
							save();
						},
						ariaLabel: uiText(msg({ message: "Folder for inline-created tasks", context: "settings/tabs/generalTab: renderGeneralTab ariaLabel" })),
					})
			);

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Move archived tasks to folder", context: "settings.general.taskStorage.moveArchived.name" })),
						desc: translate(msg({ message: "Automatically move archived tasks to an archive folder", context: "settings.general.taskStorage.moveArchived.description" })),
						getValue: () => plugin.settings.moveArchivedTasks,
						setValue: async (value: boolean) => {
							plugin.settings.moveArchivedTasks = value;
							save();
							// Re-render to show/hide archive folder setting
							renderGeneralTab(container, plugin, save);
						},
					})
			);

			if (plugin.settings.moveArchivedTasks) {
				group.addSetting(
					(setting) =>
						void configureTextSetting(setting, {
							name: translate(msg({ message: "Archive folder", context: "settings.general.taskStorage.archiveFolder.name" })),
							desc: translate(
								msg({ message: "Folder to move tasks to when archived. Supports template variables like '{{year}}', '{{month}}', '{{priority}}', etc.", context: "settings.general.taskStorage.archiveFolder.description" })
							),
							placeholder: uiData("TaskNotes/Archive", "Example vault folder path, tag identifier or filename-template syntax; preserve the entered data contract"),
							getValue: () => plugin.settings.archiveFolder,
							setValue: async (value: string) => {
								plugin.settings.archiveFolder = value;
								save();
							},
							ariaLabel: uiText(msg({ message: "Archive folder path", context: "settings/tabs/generalTab: renderGeneralTab ariaLabel" })),
						})
				);
			}
		}
	);

	// Task Identification Section
	createSettingGroup(
		container,
		{
			heading: translate(msg({ message: "Task identification", context: "settings.general.taskIdentification.header" })),
			description: translate(msg({ message: "Choose how TaskNotes identifies notes as tasks.", context: "settings.general.taskIdentification.description" })),
		},
		(group) => {
			group.addSetting(
				(setting) =>
					void configureDropdownSetting(setting, {
						name: translate(msg({ message: "Identify tasks by", context: "settings.general.taskIdentification.identifyBy.name" })),
						desc: translate(
							msg({ message: "Choose whether to identify tasks by tag or by a frontmatter property", context: "settings.general.taskIdentification.identifyBy.description" })
						),
						options: [
							{
								value: "tag",
								label: translate(
									msg({ message: "Tag", context: "settings.general.taskIdentification.identifyBy.options.tag" })
								),
							},
							{
								value: "property",
								label: translate(
									msg({ message: "Property", context: "settings.general.taskIdentification.identifyBy.options.property" })
								),
							},
						],
						getValue: () => plugin.settings.taskIdentificationMethod,
						setValue: async (value: string) => {
							plugin.settings.taskIdentificationMethod = value as "tag" | "property";
							save();
							// Re-render to show/hide conditional fields
							renderGeneralTab(container, plugin, save);
						},
						ariaLabel: uiText(msg({ message: "Task identification method", context: "settings/tabs/generalTab: renderGeneralTab ariaLabel" })),
					})
			);

			if (plugin.settings.taskIdentificationMethod === "tag") {
				group.addSetting(
					(setting) =>
						void configureTextSetting(setting, {
							name: translate(msg({ message: "Task tag", context: "settings.general.taskIdentification.taskTag.name" })),
							desc: translate(
								msg({ message: "Tag that identifies notes as tasks (without #). Existing .base view filters keep their old tag when this changes; update default Base files or edit those filters.", context: "settings.general.taskIdentification.taskTag.description" })
							),
							placeholder: uiData("task", "Example vault folder path, tag identifier or filename-template syntax; preserve the entered data contract"),
							getValue: () => plugin.settings.taskTag,
							setValue: async (value: string) => {
								plugin.settings.taskTag = value;
								save();
							},
							ariaLabel: uiText(msg({ message: "Task identification tag", context: "settings/tabs/generalTab: renderGeneralTab ariaLabel" })),
						})
				);

				group.addSetting(
					(setting) =>
						void configureToggleSetting(setting, {
							name: translate(
								msg({ message: "Hide identification tags in task cards", context: "settings.general.taskIdentification.hideIdentifyingTags.name" })
							),
							desc: translate(
								msg({ message: "When enabled, tags matching the task identification tag (including hierarchical matches like ''task/project'') will be hidden from task card displays", context: "settings.general.taskIdentification.hideIdentifyingTags.description" })
							),
							getValue: () => plugin.settings.hideIdentifyingTagsInCards,
							setValue: async (value: boolean) => {
								plugin.settings.hideIdentifyingTagsInCards = value;
								save();
								renderGeneralTab(container, plugin, save);
							},
						})
				);

				if (plugin.settings.hideIdentifyingTagsInCards) {
					group.addSetting(
						(setting) =>
							void configureDropdownSetting(setting, {
								name: translate(
									msg({ message: "Hidden tag scope", context: "settings.general.taskIdentification.hideIdentifyingTagsMode.name" })
								),
								desc: translate(
									msg({ message: "Choose whether hiding identification tags also hides nested tags.", context: "settings.general.taskIdentification.hideIdentifyingTagsMode.description" })
								),
								options: [
									{
										value: "all",
										label: translate(
											msg({ message: "Task tag and nested tags", context: "settings.general.taskIdentification.hideIdentifyingTagsMode.options.all" })
										),
									},
									{
										value: "exact-only",
										label: translate(
											msg({ message: "Exact task tag only", context: "settings.general.taskIdentification.hideIdentifyingTagsMode.options.exactOnly" })
										),
									},
								],
								getValue: () => plugin.settings.hideIdentifyingTagsMode,
								setValue: async (value: string) => {
									plugin.settings.hideIdentifyingTagsMode =
										value as HideIdentifyingTagsMode;
									save();
								},
								ariaLabel: uiText(msg({ message: "Hidden identification tag scope", context: "settings/tabs/generalTab: renderGeneralTab ariaLabel" })),
							})
					);
				}
			} else {
				type IdentificationSetting = {
					settingEl: HTMLElement;
					controlEl: HTMLElement;
					descEl: HTMLElement;
				};
				let nameSetting: IdentificationSetting | undefined;
				let valueSetting: IdentificationSetting | undefined;
				let warningSetting: IdentificationSetting | undefined;
				const updateValidation = () => {
					if (warningSetting) {
						warningSetting.settingEl.hidden = hasCompletePropertyTaskIdentification(plugin.settings);
					}
					nameSetting?.controlEl.querySelector("input")?.setAttribute(
						"aria-invalid", String(!plugin.settings.taskPropertyName.trim())
					);
					valueSetting?.controlEl.querySelector("input")?.setAttribute(
						"aria-invalid", String(!plugin.settings.taskPropertyValue.trim())
					);
				};
				group.addSetting(
					(setting) => {
						nameSetting = setting;
						configureTextSetting(setting, {
							name: translate(
								msg({ message: "Task property name", context: "settings.general.taskIdentification.taskProperty.name" })
							),
							desc: translate(
								msg({ message: "The frontmatter property name (e.g., \"category\")", context: "settings.general.taskIdentification.taskProperty.description" })
							),
							placeholder: translate(msg({ message: "Enter property name", context: "settings.general.taskIdentification.propertyNamePlaceholder" })),
							getValue: () => plugin.settings.taskPropertyName,
							setValue: async (value: string) => {
								plugin.settings.taskPropertyName = value;
								updateValidation();
								save();
							},
						});
					}
				);

				group.addSetting(
					(setting) => {
						valueSetting = setting;
						configureTextSetting(setting, {
							name: translate(
								msg({ message: "Task property value", context: "settings.general.taskIdentification.taskPropertyValue.name" })
							),
							desc: translate(
								msg({ message: "The value that identifies a note as a task (e.g., \"task\")", context: "settings.general.taskIdentification.taskPropertyValue.description" })
							),
							placeholder: translate(msg({ message: "Enter property value", context: "settings.general.taskIdentification.propertyValuePlaceholder" })),
							getValue: () => plugin.settings.taskPropertyValue,
							setValue: async (value: string) => {
								plugin.settings.taskPropertyValue = value;
								updateValidation();
								save();
							},
						});
					}
				);
				group.addSetting((setting) => {
					warningSetting = setting;
					setting.settingEl.addClass("settings-view__identification-warning");
					setting.setDesc(translate(msg({ message: "Enter both a property name and value. Example text is not saved configuration. TaskNotes cannot identify tasks until both are set. Existing .base filters must match these settings.", context: "settings.general.taskIdentification.incompletePropertyWarning" })));
					setting.descEl.addClass("mod-warning");
					setting.descEl.setAttribute("role", "status");
					setting.descEl.id = "tasknotes-property-identification-warning";
					for (const field of [nameSetting, valueSetting]) {
						field?.controlEl.querySelector("input")?.setAttribute("aria-describedby", setting.descEl.id);
					}
				});
				updateValidation();
			}
		}
	);

	// Views & Base Files Section (moved above Folder Management)
	// Command file mappings data
	const commandMappings = [
		{
			id: "open-calendar-view",
			nameKey: "miniCalendar" as const,
			defaultPath: "TaskNotes/Views/mini-calendar-default.base",
		},
		{
			id: "open-kanban-view",
			nameKey: "kanban" as const,
			defaultPath: "TaskNotes/Views/kanban-default.base",
		},
		{
			id: "open-tasks-view",
			nameKey: "tasks" as const,
			defaultPath: "TaskNotes/Views/tasks-default.base",
		},
		{
			id: "open-advanced-calendar-view",
			nameKey: "advancedCalendar" as const,
			defaultPath: "TaskNotes/Views/calendar-default.base",
		},
		{
			id: "open-agenda-view",
			nameKey: "agenda" as const,
			defaultPath: "TaskNotes/Views/agenda-default.base",
		},
		{
			id: "pomodoro-stats-base",
			nameKey: "pomodoroStats" as const,
			defaultPath: "TaskNotes/Views/pomodoro-stats.base",
		},
		{
			id: "relationships",
			nameKey: "relationships" as const,
			defaultPath: "TaskNotes/Views/relationships.base",
		},
	];

	createSettingGroup(
		container,
		{
			heading: translate(msg({ message: "Views & base files", context: "settings.integrations.basesIntegration.viewCommands.header" })),
			description: translate(
				msg({ message: "TaskNotes uses Obsidian Bases files (.base) to power its views. These files are generated automatically on startup if they don''t exist, configured with your current settings (task identification, field mappings, statuses, etc.).", context: "settings.integrations.basesIntegration.viewCommands.description" })
			),
		},
		(group) => {
			// Additional description
			group.addSetting((setting) => {
				setting.setDesc(
					translate(
						msg({ message: "Base files are not automatically updated when you change settings. To apply new settings, use \"Update files\" below, delete the existing .base files and restart Obsidian, or edit them manually.", context: "settings.integrations.basesIntegration.viewCommands.descriptionRegen" })
					)
				);
				setting.settingEl.addClass("settings-view__group-description");
			});

			group.addSetting((setting) => {
				setting.setDesc(
					translate(
						msg({ message: "The generated Pomodoro statistics base reads Pomodoro history from daily notes; if your history is still stored in plugin data, migrate it in settings before using that base file.", context: "settings.integrations.basesIntegration.viewCommands.pomodoroDailyNotesHint" })
					)
				);
				setting.settingEl.addClass("settings-view__group-description");
			});

			// Documentation link
			group.addSetting((setting) => {
				const descEl = setting.descEl;
				const docsLink = descEl.createEl("a", {
					text: translate(msg({ message: "View documentation for available formulas and customization options", context: "settings.integrations.basesIntegration.viewCommands.docsLink" })),
					href: "https://tasknotes.dev/views/default-base-templates",
				});
				docsLink.setAttr("target", "_blank");
				setting.settingEl.addClass("settings-view__group-description");
			});

			// Command file mappings
			commandMappings.forEach(({ id, nameKey, defaultPath }) => {
				group.addSetting((setting) => {
					const commandName = translate(
						messageForKey(`settings.integrations.basesIntegration.viewCommands.commands.${nameKey}`)
					);
					setting.setName(commandName);
					setting.setDesc(
						translate(msg({ message: "File: {path}", context: "settings.integrations.basesIntegration.viewCommands.fileLabel" }), {
							path: plugin.settings.commandFileMapping[id],
						})
					);

					// Text input for file path
					setting.addText((text) => {
						text.setPlaceholder(defaultPath)
							.setValue(plugin.settings.commandFileMapping[id])
							.onChange((value) => {
								plugin.settings.commandFileMapping[id] = value;
								save();
								// Update description
								setting.setDesc(
									translate(
										msg({ message: "File: {path}", context: "settings.integrations.basesIntegration.viewCommands.fileLabel" }),
										{
											path: value,
										}
									)
								);
							});
						text.inputEl.classList.remove(
							"tn-static-width-12px-fbf353fb",
							"tn-static-width-16px-7375d50b",
							"tn-static-width-1px-aa77e27e",
							"tn-static-width-200px-2acaf3b5",
							"tn-static-width-60px-bd09c419",
							"tn-static-width-80px-8573bae3"
						);
						text.inputEl.classList.add("tn-static-width-100-0466783d");
						return text;
					});

					// Reset button
					setting.addButton((button) => {
						button
							.setButtonText(
								translate(
									msg({ message: "Reset", context: "settings.integrations.basesIntegration.viewCommands.resetButton" })
								)
							)
							.setTooltip(
								translate(
									msg({ message: "Reset to default path", context: "settings.integrations.basesIntegration.viewCommands.resetTooltip" })
								)
							)
							.onClick(() => {
								plugin.settings.commandFileMapping[id] = defaultPath;
								save();
								// Refresh the entire settings display
								if (plugin.app.setting.activeTab) {
									plugin.app.setting.openTabById(plugin.app.setting.activeTab.id);
								}
							});
						return button;
					});
				});
			});

			// Auto-create default files toggle
			group.addSetting((setting) => {
				setting
					.setName(
						translate(
							msg({ message: "Auto-create default files", context: "settings.integrations.basesIntegration.autoCreateDefaultFiles.name" })
						)
					)
					.setDesc(
						translate(
							msg({ message: "Automatically create missing default base view files on startup. Disable to prevent deleted sample files from being recreated.", context: "settings.integrations.basesIntegration.autoCreateDefaultFiles.description" })
						)
					)
					.addToggle((toggle) => {
						toggle
							.setValue(plugin.settings.autoCreateDefaultBasesFiles)
							.onChange((value) => {
								plugin.settings.autoCreateDefaultBasesFiles = value;
								save();
							});
						return toggle;
					});
			});

			// Create Default Files button
			group.addSetting((setting) => {
				setting
					.setName(
						translate(msg({ message: "Create default files", context: "settings.integrations.basesIntegration.createDefaultFiles.name" }))
					)
					.setDesc(
						translate(
							msg({ message: "Create the default .base files in TaskNotes/Views/ directory. Existing files will not be overwritten.", context: "settings.integrations.basesIntegration.createDefaultFiles.description" })
						)
					)
					.addButton((button) => {
						button
							.setButtonText(
								translate(
									msg({ message: "Create files", context: "settings.integrations.basesIntegration.createDefaultFiles.buttonText" })
								)
							)
							.setCta()
							.onClick(async () => {
								await plugin.createDefaultBasesFiles();
							});
						return button;
					});
			});

			// Update Default Files button
			group.addSetting((setting) => {
				setting
					.setName(
						translate(msg({ message: "Update default files", context: "settings.integrations.basesIntegration.updateDefaultFiles.name" }))
					)
					.setDesc(
						translate(
							msg({ message: "Overwrite the configured default .base files with templates generated from your current TaskNotes settings.", context: "settings.integrations.basesIntegration.updateDefaultFiles.description" })
						)
					)
					.addButton((button) => {
						button
							.setButtonText(
								translate(
									msg({ message: "Update files", context: "settings.integrations.basesIntegration.updateDefaultFiles.buttonText" })
								)
							)
							.onClick(async () => {
								const confirmed = await showConfirmationModal(plugin.app, {
									title: translate(
										msg({ message: "Update default base files", context: "settings.integrations.basesIntegration.updateDefaultFiles.confirmTitle" })
									),
									message: translate(
										msg({ message: "This will overwrite the configured default .base files with freshly generated templates. Any manual edits in those files will be replaced.", context: "settings.integrations.basesIntegration.updateDefaultFiles.confirmMessage" })
									),
									confirmText: translate(
										msg({ message: "Update files", context: "settings.integrations.basesIntegration.updateDefaultFiles.confirmText" })
									),
									isDestructive: false,
								});
								if (!confirmed) {
									return;
								}

								await plugin.createDefaultBasesFiles({ overwriteExisting: true });
							});
						return button;
					});
			});

			// Export All Saved Views button
			group.addSetting((setting) => {
				setting
					.setName(translate(msg({ message: "Export v3 saved views to Bases", context: "settings.integrations.basesIntegration.exportV3Views.name" })))
					.setDesc(
						translate(
							msg({ message: "Convert all your saved views from TaskNotes v3 into a single .base file with multiple views. This helps migrate your v3 filter configurations to the new Bases system.", context: "settings.integrations.basesIntegration.exportV3Views.description" })
						)
					)
					.addButton((button) => {
						button
							.setButtonText(
								translate(
									msg({ message: "Export v3 views", context: "settings.integrations.basesIntegration.exportV3Views.buttonText" })
								)
							)
							.onClick(async () => {
								try {
									const savedViews = plugin.viewStateManager.getSavedViews();

									if (savedViews.length === 0) {
										new Notice(
											translate(
												msg({ message: "No saved views to export", context: "settings.integrations.basesIntegration.exportV3Views.noViews" })
											)
										);
										return;
									}

									const basesContent =
										plugin.basesFilterConverter.convertAllSavedViewsToBasesFile(
											savedViews
										);
									const fileName = "all-saved-views.base";
									const filePath = `TaskNotes/Views/${fileName}`;

									// Create folder if needed (check on-disk via adapter, not in-memory cache)
									if (
										!(await plugin.app.vault.adapter.exists("TaskNotes/Views"))
									) {
										await createVaultFolder(plugin.app, "TaskNotes/Views");
									}

									// Handle file overwrite confirmation
									const existingFile =
										plugin.app.vault.getAbstractFileByPath(filePath);
									if (existingFile) {
										if (!(existingFile instanceof TFile)) {
											throw new Error(`${filePath} exists but is not a file`);
										}
										const confirmed = await showConfirmationModal(plugin.app, {
											title: translate(
												msg({ message: "File already exists", context: "settings.integrations.basesIntegration.exportV3Views.fileExists" })
											),
											message: translate(
												msg({ message: "A file named \"{fileName}\" already exists. Overwrite it?", context: "settings.integrations.basesIntegration.exportV3Views.confirmOverwrite" }),
												{ fileName }
											),
											isDestructive: false,
										});
										if (!confirmed) return;
										await modifyVaultFile(plugin.app, existingFile, basesContent);
									} else {
										await createVaultFile(plugin.app, filePath, basesContent);
									}

									new Notice(
										translate(
											msg({ message: "Exported {count} saved views to {filePath}", context: "settings.integrations.basesIntegration.exportV3Views.success" }),
											{
												count: savedViews.length.toString(),
												filePath,
											}
										)
									);
									await plugin.app.workspace.openLinkText(filePath, "", true);
								} catch (error) {
									tasknotesLogger.error("Error exporting all views to Bases:", {
										category: "provider",
										operation: "exporting-all-views-bases",
										error: error,
									});
									new Notice(
										translate(
											msg({ message: "Failed to export views: {message}", context: "settings.integrations.basesIntegration.exportV3Views.error" }),
											{
												message: displayError(error.message),
											}
										)
									);
								}
							});
						return button;
					});
			});
		}
	);

	// Folder Management Section
	createSettingGroup(
		container,
		{ heading: translate(msg({ message: "Folder management", context: "settings.general.folderManagement.header" })) },
		(group) => {
			group.addSetting(
				(setting) =>
					void configureTextSetting(setting, {
						name: translate(msg({ message: "Excluded folders", context: "settings.general.folderManagement.excludedFolders.name" })),
						desc: translate(
							msg({ message: "Comma-separated list of folders to exclude from task indexing and project suggestions", context: "settings.general.folderManagement.excludedFolders.description" })
						),
						placeholder: uiData("Templates, Archive", "Example vault folder path, tag identifier or filename-template syntax; preserve the entered data contract"),
						getValue: () => plugin.settings.excludedFolders,
						setValue: async (value: string) => {
							plugin.settings.excludedFolders = value;
							save();
						},
						ariaLabel: uiText(msg({ message: "Excluded folder paths", context: "settings/tabs/generalTab: renderGeneralTab ariaLabel" })),
					})
			);
		}
	);

	// UI Language Section
	const uiLanguageOptions = (() => {
		const options: Array<{ value: string; label: string }> = [
			{ value: "system", label: translate(msg({ message: "System default", context: "common.systemDefault" })) },
		];
		for (const code of plugin.i18n.getAvailableLocales()) {
			// Use native language names (endonyms) for better UX
			const label = plugin.i18n.getNativeLanguageName(code);
			options.push({ value: code, label });
		}
		return options;
	})();

	createSettingGroup(
		container,
		{
			heading: translate(msg({ message: "Interface language", context: "settings.features.uiLanguage.header" })),
			description: languagePackConfig
				? `${translate(msg({ message: "Change the language of TaskNotes menus, notices, and views.", context: "settings.features.uiLanguage.description" }))} ${translate(msg({ message: "Other interface languages are downloaded and cached locally for offline use. No vault content is sent.", context: "settings.features.uiLanguage.downloadDescription" }))}`
				: translate(msg({ message: "Change the language of TaskNotes menus, notices, and views.", context: "settings.features.uiLanguage.description" })),
		},
		(group) => {
			group.addSetting((setting) => {
				configureDropdownSetting(setting, {
					name: translate(msg({ message: "UI language", context: "settings.features.uiLanguage.dropdown.name" })),
					desc: translate(msg({ message: "Select the language used for TaskNotes interface text", context: "settings.features.uiLanguage.dropdown.description" })),
					options: uiLanguageOptions,
					getValue: () => plugin.settings.uiLanguage ?? "system",
					setValue: async (value: string) => {
						plugin.settings.uiLanguage = value;
						save();
						await plugin.setUILanguage(value);
						renderGeneralTab(container, plugin, save);
					},
				});
				if (languagePackConfig) {
					setting.addButton(button => button
						.setButtonText(translate(msg({ message: "Retry language download", context: "settings.features.uiLanguage.retryDownload" })))
						.onClick(async () => {
							button.setDisabled(true);
							try {
								await plugin.setUILanguage(plugin.settings.uiLanguage ?? "system");
							} finally {
								button.setDisabled(false);
							}
						}));
				}
			});
		}
	);

	// Frontmatter Section - only show if user has markdown links enabled globally
	const useMarkdownLinks = plugin.app.vault.getConfig("useMarkdownLinks");
	if (useMarkdownLinks) {
		createSettingGroup(
			container,
			{
				heading: translate(msg({ message: "Frontmatter", context: "settings.general.frontmatter.header" })),
				description: translate(msg({ message: "Configure how links are formatted in frontmatter properties.", context: "settings.general.frontmatter.description" })),
			},
			(group) => {
				group.addSetting(
					(setting) =>
						void configureToggleSetting(setting, {
							name: translate(msg({ message: "Use Markdown links in frontmatter", context: "settings.general.frontmatter.useMarkdownLinks.name" })),
							desc: translate(
								msg({ message: "Generate markdown links ([text](path)) instead of wikilinks ([[link]]) in frontmatter properties.\n\n⚠️ Requires the ''obsidian-frontmatter-markdown-links'' plugin to work correctly.", context: "settings.general.frontmatter.useMarkdownLinks.description" })
							),
							getValue: () => plugin.settings.useFrontmatterMarkdownLinks,
							setValue: async (value: boolean) => {
								plugin.settings.useFrontmatterMarkdownLinks = value;
								save();
							},
						})
				);
			}
		);
	}

	// Release Notes Section
	createSettingGroup(
		container,
		{
			heading: translate(msg({ message: "Release notes", context: "settings.general.releaseNotes.header" })),
			description: translate(msg({ message: "Current version: {version}", context: "settings.general.releaseNotes.description" }), {
				version: plugin.manifest.version,
			}),
		},
		(group) => {
			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Show release notes after update", context: "settings.general.releaseNotes.showOnUpdate.name" })),
						desc: translate(msg({ message: "Automatically open release notes when TaskNotes is updated to a new version", context: "settings.general.releaseNotes.showOnUpdate.description" })),
						getValue: () => plugin.settings.showReleaseNotesOnUpdate ?? true,
						setValue: async (value: boolean) => {
							plugin.settings.showReleaseNotesOnUpdate = value;
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Check for new releases on startup", context: "settings.general.releaseNotes.checkForUpdates.name" })),
						desc: translate(
							msg({ message: "Check GitHub once when TaskNotes starts and show a notice when a newer compatible release is available", context: "settings.general.releaseNotes.checkForUpdates.description" })
						),
						getValue: () => plugin.settings.checkForUpdatesOnStartup ?? true,
						setValue: async (value: boolean) => {
							plugin.settings.checkForUpdatesOnStartup = value;
							save();
						},
					})
			);

			group.addSetting((setting) => {
				setting
					.setName(translate(msg({ message: "View release notes", context: "settings.general.releaseNotes.viewButton.name" })))
					.setDesc(translate(msg({ message: "See what''s new in the latest version of TaskNotes", context: "settings.general.releaseNotes.viewButton.description" })))
					.addButton((button) =>
						button
							.setButtonText(
								translate(msg({ message: "View release notes", context: "settings.general.releaseNotes.viewButton.buttonText" }))
							)
							.setCta()
							.onClick(async () => {
								await plugin.activateReleaseNotesView();
							})
					);
			});
		}
	);
}
