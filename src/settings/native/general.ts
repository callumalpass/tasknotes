import { uiData } from "../../i18n/dataText";
import { msg } from "@lingui/core/macro";
import { languagePackConfig } from "../../i18n/languagePackConfig";
import { Notice, TFile } from "obsidian";
import { MessageDescriptor } from "../../i18n";
import { showConfirmationModal } from "../../modals/ConfirmationModal";
import type { HideIdentifyingTagsMode } from "../../types/settings";
import { createTaskNotesLogger } from "../../utils/tasknotesLogger";
import { hasUsablePropertyTaskIdentification } from "../../utils/taskIdentification";
import {
	createVaultFile,
	createVaultFolder,
	modifyVaultFile,
} from "../../services/VaultMutationService";
const tasknotesLogger = createTaskNotesLogger({ tag: "Settings/Tabs/GeneralTab" });
import { SettingsContext } from "../native/SettingsContext";
import type { SettingDefinitionGroup } from "obsidian";

export function generalDefinitions(ctx: SettingsContext): SettingDefinitionGroup[] {
	const { plugin, save } = ctx;
	const translate = (key: MessageDescriptor, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key, params);
	const commandMappings = [
		{
			id: "open-calendar-view",
			name: msg({ message: "Open mini calendar view", context: "settings.integrations.basesIntegration.viewCommands.commands.miniCalendar" }),
			defaultPath: "TaskNotes/Views/mini-calendar-default.base",
		},
		{
			id: "open-kanban-view",
			name: msg({ message: "Open Kanban view", context: "settings.integrations.basesIntegration.viewCommands.commands.kanban" }),
			defaultPath: "TaskNotes/Views/kanban-default.base",
		},
		{
			id: "open-tasks-view",
			name: msg({ message: "Open tasks view", context: "settings.integrations.basesIntegration.viewCommands.commands.tasks" }),
			defaultPath: "TaskNotes/Views/tasks-default.base",
		},
		{
			id: "open-advanced-calendar-view",
			name: msg({ message: "Open advanced calendar view", context: "settings.integrations.basesIntegration.viewCommands.commands.advancedCalendar" }),
			defaultPath: "TaskNotes/Views/calendar-default.base",
		},
		{
			id: "open-agenda-view",
			name: msg({ message: "Open agenda view", context: "settings.integrations.basesIntegration.viewCommands.commands.agenda" }),
			defaultPath: "TaskNotes/Views/agenda-default.base",
		},
		{
			id: "relationships",
			name: msg({ message: "Relationships widget", context: "settings.integrations.basesIntegration.viewCommands.commands.relationships" }),
			defaultPath: "TaskNotes/Views/relationships.base",
		},
	];
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
	return [
		{
			type: "group",
			heading: translate(msg({ message: "Task storage", context: "settings.general.taskStorage.header" })),
			items: [
				ctx.text("tasksFolder", {
					name: translate(msg({ message: "Default tasks folder", context: "settings.general.taskStorage.defaultFolder.name" })),
					desc: translate(msg({ message: "Default location for new tasks. Supports folder template variables like '{{currentNotePath}}', '{{currentNoteTitle}}', and '{{projectFilePath}}', plus Daily Notes-style date tokens like YYYY/MM/DD.", context: "settings.general.taskStorage.defaultFolder.description" })),
					placeholder: "TaskNotes",
					getValue: () => plugin.settings.tasksFolder,
					setValue: async (value: string) => {
						plugin.settings.tasksFolder = value;
						save();
					},
				}),
				ctx.text("inlineTaskConvertFolder", {
					name: translate(msg({ message: "Folder for inline-created tasks", context: "settings.features.instantConvert.folder.name" })),
					desc: translate(msg({ message: "Folder where tasks created from inline commands or checkbox conversion will be created. Leave empty to use the default tasks folder. Use '{{currentNotePath}}' for the current note''s folder, or '{{currentNoteTitle}}' for a subfolder named after the current note.", context: "settings.features.instantConvert.folder.description" })),
					placeholder: "{{currentNotePath}}",
					getValue: () => plugin.settings.inlineTaskConvertFolder,
					setValue: async (value: string) => {
						plugin.settings.inlineTaskConvertFolder = value;
						save();
					},
				}),
				ctx.toggle("moveArchivedTasks", {
					name: translate(msg({ message: "Move archived tasks to folder", context: "settings.general.taskStorage.moveArchived.name" })),
					desc: translate(msg({ message: "Automatically move archived tasks to an archive folder", context: "settings.general.taskStorage.moveArchived.description" })),
					getValue: () => plugin.settings.moveArchivedTasks,
					setValue: async (value: boolean) => {
						plugin.settings.moveArchivedTasks = value;
						save();
						// Re-render to show/hide archive folder setting
						ctx.refresh();
					},
				}),
				ctx.text(
					"archiveFolder",
					{
						name: translate(msg({ message: "Archive folder", context: "settings.general.taskStorage.archiveFolder.name" })),
						desc: translate(msg({ message: "Folder to move tasks to when archived. Supports template variables like '{{year}}', '{{month}}', '{{priority}}', etc.", context: "settings.general.taskStorage.archiveFolder.description" })),
						placeholder: "TaskNotes/Archive",
						getValue: () => plugin.settings.archiveFolder,
						setValue: async (value: string) => {
							plugin.settings.archiveFolder = value;
							save();
						},
					},
					() => !plugin.settings.moveArchivedTasks
				),
			],
		},
		{
			type: "group",
			heading: translate(msg({ message: "Task identification", context: "settings.general.taskIdentification.header" })),
			items: [
				ctx.dropdown("taskIdentificationMethod", {
					name: translate(msg({ message: "Identify tasks by", context: "settings.general.taskIdentification.identifyBy.name" })),
					desc: translate(msg({ message: "Choose whether to identify tasks by tag or by a frontmatter property", context: "settings.general.taskIdentification.identifyBy.description" })),
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
						ctx.refresh();
					},
				}),
				ctx.text(
					"taskTag",
					{
						name: translate(msg({ message: "Task tag", context: "settings.general.taskIdentification.taskTag.name" })),
						desc: translate(msg({ message: "Tag that identifies notes as tasks (without #). Existing .base view filters keep their old tag when this changes; update default Base files or edit those filters.", context: "settings.general.taskIdentification.taskTag.description" })),
						placeholder: "task",
						getValue: () => plugin.settings.taskTag,
						setValue: async (value: string) => {
							plugin.settings.taskTag = value;
							save();
						},
					},
					() => !(plugin.settings.taskIdentificationMethod === "tag")
				),
				ctx.toggle(
					"hideIdentifyingTagsInCards",
					{
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
							ctx.refresh();
						},
					},
					() => !(plugin.settings.taskIdentificationMethod === "tag")
				),
				ctx.dropdown(
					"hideIdentifyingTagsMode",
					{
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
					},
					() =>
						!(
							plugin.settings.taskIdentificationMethod === "tag" &&
							plugin.settings.hideIdentifyingTagsInCards
						)
				),
				ctx.text(
					"taskPropertyName",
					{
						name: translate(msg({ message: "Task property name", context: "settings.general.taskIdentification.taskProperty.name" })),
						desc: translate(
							msg({ message: "The frontmatter property name (e.g., \"category\")", context: "settings.general.taskIdentification.taskProperty.description" })
						),
						placeholder: translate(
							msg({ message: "Enter property name", context: "settings.general.taskIdentification.propertyNamePlaceholder" })
						),
						getValue: () => plugin.settings.taskPropertyName,
						setValue: async (value: string) => {
							plugin.settings.taskPropertyName = value;
							save();
						},
					},
					() => !!(plugin.settings.taskIdentificationMethod === "tag")
				),
				ctx.text(
					"taskPropertyValue",
					{
						name: translate(
							msg({ message: "Task property value", context: "settings.general.taskIdentification.taskPropertyValue.name" })
						),
						desc: translate(
							msg({ message: "The value that identifies a note as a task (e.g., \"task\"). Leave empty to treat every note that has this property as a task, whatever its value.", context: "settings.general.taskIdentification.taskPropertyValue.description" })
						),
						placeholder: translate(
							msg({ message: "Enter property value", context: "settings.general.taskIdentification.propertyValuePlaceholder" })
						),
						getValue: () => plugin.settings.taskPropertyValue,
						setValue: async (value: string) => {
							plugin.settings.taskPropertyValue = value;
							save();
						},
					},
					() => !!(plugin.settings.taskIdentificationMethod === "tag")
				),
				{
					name: "",
					visible: () =>
						plugin.settings.taskIdentificationMethod === "property" &&
						!hasUsablePropertyTaskIdentification(plugin.settings),
					render: (setting) => {
						setting.settingEl.addClass("settings-view__identification-warning");
						setting.setDesc(
							translate(msg({ message: "Enter a property name. Example text is not saved configuration. TaskNotes cannot identify tasks until a property name is set. Existing .base filters must match these settings.", context: "settings.general.taskIdentification.incompletePropertyWarning" }))
						);
						setting.descEl.addClass("mod-warning");
						setting.descEl.setAttribute("role", "status");
					},
				},
			],
		},
		{
			type: "group",
			heading: translate(msg({ message: "Views & base files", context: "settings.integrations.basesIntegration.viewCommands.header" })),
			items: [
				{
					name: "",
					desc: translate(
						msg({ message: "Base files are not automatically updated when you change settings. To apply new settings, use \"Update files\" below, delete the existing .base files and restart Obsidian, or edit them manually.", context: "settings.integrations.basesIntegration.viewCommands.descriptionRegen" })
					),
					render: (setting) => {
						setting.setDesc(
							translate(
								msg({ message: "Base files are not automatically updated when you change settings. To apply new settings, use \"Update files\" below, delete the existing .base files and restart Obsidian, or edit them manually.", context: "settings.integrations.basesIntegration.viewCommands.descriptionRegen" })
							)
						);
						setting.settingEl.addClass("settings-view__group-description");
					},
				},
				{
					name: "",
					render: (setting) => {
						const descEl = setting.descEl;
						const docsLink = descEl.createEl("a", {
							text: translate(
								msg({ message: "View documentation for available formulas and customization options", context: "settings.integrations.basesIntegration.viewCommands.docsLink" })
							),
							href: "https://tasknotes.dev/views/default-base-templates",
						});
						docsLink.setAttr("target", "_blank");
						setting.settingEl.addClass("settings-view__group-description");
					},
				},
				...commandMappings.map(({ id, name, defaultPath }) => ({
					type: "page" as const,
					name: translate(name),
					displayValue: () => plugin.settings.commandFileMapping[id],
					items: [
						ctx.field(
							plugin.settings.commandFileMapping,
							id,
							`commandFileMapping.${id}`,
							ctx.t(msg({ message: "Base file", context: "settings.native.baseFile" })),
							{
								type: "file",
								validate: (value) =>
									value.endsWith(".base") ? undefined : translate(msg({ message: "Choose a .base file.", context: "settings.native.chooseBaseFile" })),
							}
						),
						ctx.button(`commandFileMapping.${id}.reset`, {
							name: ctx.t(msg({ message: "Reset file mapping", context: "settings.native.resetFileMapping" })),
							buttonText: ctx.t(
								msg({ message: "Reset", context: "settings.integrations.basesIntegration.viewCommands.resetButton" })
							),
							onClick: () => {
								plugin.settings.commandFileMapping[id] = defaultPath;
								save();
								ctx.rebuild();
							},
						}),
					],
				})),
				{
					name: translate(
						msg({ message: "Auto-create default files", context: "settings.integrations.basesIntegration.autoCreateDefaultFiles.name" })
					),
					desc: translate(
						msg({ message: "Automatically create missing default base view files on startup. Disable to prevent deleted sample files from being recreated.", context: "settings.integrations.basesIntegration.autoCreateDefaultFiles.description" })
					),
					render: (setting) => {
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
					},
				},
				{
					name: translate(
						msg({ message: "Create default files", context: "settings.integrations.basesIntegration.createDefaultFiles.name" })
					),
					desc: translate(
						msg({ message: "Create the default .base files in TaskNotes/Views/ directory. Existing files will not be overwritten.", context: "settings.integrations.basesIntegration.createDefaultFiles.description" })
					),
					render: (setting) => {
						setting
							.setName(
								translate(
									msg({ message: "Create default files", context: "settings.integrations.basesIntegration.createDefaultFiles.name" })
								)
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
					},
				},
				{
					name: translate(
						msg({ message: "Update default files", context: "settings.integrations.basesIntegration.updateDefaultFiles.name" })
					),
					desc: translate(
						msg({ message: "Overwrite the configured default .base files with templates generated from your current TaskNotes settings.", context: "settings.integrations.basesIntegration.updateDefaultFiles.description" })
					),
					render: (setting) => {
						setting
							.setName(
								translate(
									msg({ message: "Update default files", context: "settings.integrations.basesIntegration.updateDefaultFiles.name" })
								)
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

										await plugin.createDefaultBasesFiles({
											overwriteExisting: true,
										});
									});
								return button;
							});
					},
				},
				{
					name: translate(msg({ message: "Export v3 saved views to Bases", context: "settings.integrations.basesIntegration.exportV3Views.name" })),
					desc: translate(
						msg({ message: "Convert all your saved views from TaskNotes v3 into a single .base file with multiple views. This helps migrate your v3 filter configurations to the new Bases system.", context: "settings.integrations.basesIntegration.exportV3Views.description" })
					),
					render: (setting) => {
						setting
							.setName(
								translate(
									msg({ message: "Export v3 saved views to Bases", context: "settings.integrations.basesIntegration.exportV3Views.name" })
								)
							)
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
											const savedViews =
												plugin.viewStateManager.getSavedViews();

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
											const filePath = uiData(`TaskNotes/Views/${fileName}`, "Generated default Base path, not UI prose");

											// Create folder if needed (check on-disk via adapter, not in-memory cache)
											if (
												!(await plugin.app.vault.adapter.exists(
													"TaskNotes/Views"
												))
											) {
												await createVaultFolder(
													plugin.app,
													"TaskNotes/Views"
												);
											}

											// Handle file overwrite confirmation
											const existingFile =
												plugin.app.vault.getAbstractFileByPath(filePath);
											if (existingFile) {
												if (!(existingFile instanceof TFile)) {
													throw new Error(
														`${filePath} exists but is not a file`
													);
												}
												const confirmed = await showConfirmationModal(
													plugin.app,
													{
														title: translate(
															msg({ message: "File already exists", context: "settings.integrations.basesIntegration.exportV3Views.fileExists" })
														),
														message: translate(
															msg({ message: "A file named \"{fileName}\" already exists. Overwrite it?", context: "settings.integrations.basesIntegration.exportV3Views.confirmOverwrite" }),
															{ fileName }
														),
														isDestructive: false,
													}
												);
												if (!confirmed) return;
												await modifyVaultFile(
													plugin.app,
													existingFile,
													basesContent
												);
											} else {
												await createVaultFile(
													plugin.app,
													filePath,
													basesContent
												);
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
											await plugin.app.workspace.openLinkText(
												filePath,
												"",
												true
											);
										} catch (error) {
											tasknotesLogger.error(
												"Error exporting all views to Bases:",
												{
													category: "provider",
													operation: "exporting-all-views-bases",
													error: error,
												}
											);
											new Notice(
												translate(
													msg({ message: "Failed to export views: {message}", context: "settings.integrations.basesIntegration.exportV3Views.error" }),
													{
														message: error.message,
													}
												)
											);
										}
									});
								return button;
							});
					},
				},
			],
		},
		{
			type: "group",
			heading: translate(msg({ message: "Folder management", context: "settings.general.folderManagement.header" })),
			items: [
				ctx.text("excludedFolders", {
					name: translate(msg({ message: "Excluded folders", context: "settings.general.folderManagement.excludedFolders.name" })),
					desc: translate(
						msg({ message: "Comma-separated list of folders to exclude from task indexing and project suggestions", context: "settings.general.folderManagement.excludedFolders.description" })
					),
					placeholder: "Templates, Archive",
					getValue: () => plugin.settings.excludedFolders,
					setValue: async (value: string) => {
						plugin.settings.excludedFolders = value;
						save();
					},
				}),
			],
		},
		{
			type: "group",
			heading: translate(msg({ message: "Interface language", context: "settings.features.uiLanguage.header" })),
			items: [
				...(languagePackConfig ? [ctx.button("uiLanguage.retry", {
					name: translate(msg({ message: "Retry language download", context: "settings.features.uiLanguage.retryDownload" })),
					buttonText: translate(msg({ message: "Retry language download", context: "settings.features.uiLanguage.retryDownload" })),
					onClick: async () => { await plugin.setUILanguage(plugin.settings.uiLanguage ?? "system"); ctx.refresh(); },
				})] : []),
				ctx.dropdown("uiLanguage", {
					name: translate(msg({ message: "UI language", context: "settings.features.uiLanguage.dropdown.name" })),
					desc: [translate(msg({ message: "Select the language used for TaskNotes interface text", context: "settings.features.uiLanguage.dropdown.description" })), languagePackConfig ? translate(msg({ message: "Other interface languages are downloaded and cached locally for offline use. No vault content is sent.", context: "settings.features.uiLanguage.downloadDescription" })) : ""].filter(Boolean).join(" "),
					options: uiLanguageOptions,
					getValue: () => plugin.settings.uiLanguage ?? "system",
					setValue: async (value: string) => {
						plugin.settings.uiLanguage = value;
						save();
						await plugin.setUILanguage(value);
						ctx.refresh();
					},
				}),
			],
		},
		{
			type: "group",
			heading: translate(msg({ message: "Frontmatter", context: "settings.general.frontmatter.header" })),
			items: [
				ctx.toggle("useFrontmatterMarkdownLinks", {
					name: translate(msg({ message: "Use Markdown links in frontmatter", context: "settings.general.frontmatter.useMarkdownLinks.name" })),
					desc: translate(msg({ message: "Generate markdown links ([text](path)) instead of wikilinks ([[link]]) in frontmatter properties.\n\n⚠️ Requires the ''obsidian-frontmatter-markdown-links'' plugin to work correctly.", context: "settings.general.frontmatter.useMarkdownLinks.description" })),
					getValue: () => plugin.settings.useFrontmatterMarkdownLinks,
					setValue: async (value: boolean) => {
						plugin.settings.useFrontmatterMarkdownLinks = value;
						save();
					},
				}),
			],
		},
		{
			type: "group",
			heading: translate(msg({ message: "Release notes", context: "settings.general.releaseNotes.header" })),
			items: [
				ctx.toggle("showReleaseNotesOnUpdate", {
					name: translate(msg({ message: "Show release notes after update", context: "settings.general.releaseNotes.showOnUpdate.name" })),
					desc: translate(msg({ message: "Automatically open release notes when TaskNotes is updated to a new version", context: "settings.general.releaseNotes.showOnUpdate.description" })),
					getValue: () => plugin.settings.showReleaseNotesOnUpdate ?? true,
					setValue: async (value: boolean) => {
						plugin.settings.showReleaseNotesOnUpdate = value;
						save();
					},
				}),
				ctx.toggle("checkForUpdatesOnStartup", {
					name: translate(msg({ message: "Check for new releases on startup", context: "settings.general.releaseNotes.checkForUpdates.name" })),
					desc: translate(msg({ message: "Check GitHub once when TaskNotes starts and show a notice when a newer compatible release is available", context: "settings.general.releaseNotes.checkForUpdates.description" })),
					getValue: () => plugin.settings.checkForUpdatesOnStartup ?? true,
					setValue: async (value: boolean) => {
						plugin.settings.checkForUpdatesOnStartup = value;
						save();
					},
				}),
				{
					name: translate(msg({ message: "View release notes", context: "settings.general.releaseNotes.viewButton.name" })),
					desc: translate(msg({ message: "See what''s new in the latest version of TaskNotes", context: "settings.general.releaseNotes.viewButton.description" })),
					render: (setting) => {
						setting
							.setName(translate(msg({ message: "View release notes", context: "settings.general.releaseNotes.viewButton.name" })))
							.setDesc(
								translate(msg({ message: "See what''s new in the latest version of TaskNotes", context: "settings.general.releaseNotes.viewButton.description" }))
							)
							.addButton((button) =>
								button
									.setButtonText(
										translate(
											msg({ message: "View release notes", context: "settings.general.releaseNotes.viewButton.buttonText" })
										)
									)
									.setCta()
									.onClick(async () => {
										await plugin.activateReleaseNotesView();
									})
							);
					},
				},
			],
		},
	];
}
