import { Notice, TFile } from "obsidian";
import { TranslationKey } from "../../i18n";
import { showConfirmationModal } from "../../modals/ConfirmationModal";
import type { HideIdentifyingTagsMode } from "../../types/settings";
import { createTaskNotesLogger } from "../../utils/tasknotesLogger";
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
	const translate = (key: TranslationKey, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key, params);
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
			id: "relationships",
			nameKey: "relationships" as const,
			defaultPath: "TaskNotes/Views/relationships.base",
		},
	];
	const uiLanguageOptions = (() => {
		const options: Array<{ value: string; label: string }> = [
			{ value: "system", label: translate("common.systemDefault") },
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
			heading: translate("settings.general.taskStorage.header"),
			items: [
				ctx.text("tasksFolder", {
					name: translate("settings.general.taskStorage.defaultFolder.name"),
					desc: translate("settings.general.taskStorage.defaultFolder.description"),
					placeholder: "TaskNotes",
					getValue: () => plugin.settings.tasksFolder,
					setValue: async (value: string) => {
						plugin.settings.tasksFolder = value;
						save();
					},
					ariaLabel: "Default folder path for new tasks",
				}),
				ctx.text("inlineTaskConvertFolder", {
					name: translate("settings.features.instantConvert.folder.name"),
					desc: translate("settings.features.instantConvert.folder.description"),
					placeholder: "{{currentNotePath}}",
					getValue: () => plugin.settings.inlineTaskConvertFolder,
					setValue: async (value: string) => {
						plugin.settings.inlineTaskConvertFolder = value;
						save();
					},
					ariaLabel: "Folder for inline-created tasks",
				}),
				ctx.toggle("moveArchivedTasks", {
					name: translate("settings.general.taskStorage.moveArchived.name"),
					desc: translate("settings.general.taskStorage.moveArchived.description"),
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
						name: translate("settings.general.taskStorage.archiveFolder.name"),
						desc: translate("settings.general.taskStorage.archiveFolder.description"),
						placeholder: "TaskNotes/Archive",
						getValue: () => plugin.settings.archiveFolder,
						setValue: async (value: string) => {
							plugin.settings.archiveFolder = value;
							save();
						},
						ariaLabel: "Archive folder path",
					},
					() => !plugin.settings.moveArchivedTasks
				),
			],
		},
		{
			type: "group",
			heading: translate("settings.general.taskIdentification.header"),
			items: [
				ctx.dropdown("taskIdentificationMethod", {
					name: translate("settings.general.taskIdentification.identifyBy.name"),
					desc: translate("settings.general.taskIdentification.identifyBy.description"),
					options: [
						{
							value: "tag",
							label: translate(
								"settings.general.taskIdentification.identifyBy.options.tag"
							),
						},
						{
							value: "property",
							label: translate(
								"settings.general.taskIdentification.identifyBy.options.property"
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
					ariaLabel: "Task identification method",
				}),
				ctx.text(
					"taskTag",
					{
						name: translate("settings.general.taskIdentification.taskTag.name"),
						desc: translate("settings.general.taskIdentification.taskTag.description"),
						placeholder: "task",
						getValue: () => plugin.settings.taskTag,
						setValue: async (value: string) => {
							plugin.settings.taskTag = value;
							save();
						},
						ariaLabel: "Task identification tag",
					},
					() => !(plugin.settings.taskIdentificationMethod === "tag")
				),
				ctx.toggle(
					"hideIdentifyingTagsInCards",
					{
						name: translate(
							"settings.general.taskIdentification.hideIdentifyingTags.name"
						),
						desc: translate(
							"settings.general.taskIdentification.hideIdentifyingTags.description"
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
							"settings.general.taskIdentification.hideIdentifyingTagsMode.name"
						),
						desc: translate(
							"settings.general.taskIdentification.hideIdentifyingTagsMode.description"
						),
						options: [
							{
								value: "all",
								label: translate(
									"settings.general.taskIdentification.hideIdentifyingTagsMode.options.all"
								),
							},
							{
								value: "exact-only",
								label: translate(
									"settings.general.taskIdentification.hideIdentifyingTagsMode.options.exactOnly"
								),
							},
						],
						getValue: () => plugin.settings.hideIdentifyingTagsMode,
						setValue: async (value: string) => {
							plugin.settings.hideIdentifyingTagsMode =
								value as HideIdentifyingTagsMode;
							save();
						},
						ariaLabel: "Hidden identification tag scope",
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
						name: translate("settings.general.taskIdentification.taskProperty.name"),
						desc: translate(
							"settings.general.taskIdentification.taskProperty.description"
						),
						placeholder: "category",
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
							"settings.general.taskIdentification.taskPropertyValue.name"
						),
						desc: translate(
							"settings.general.taskIdentification.taskPropertyValue.description"
						),
						placeholder: "task",
						getValue: () => plugin.settings.taskPropertyValue,
						setValue: async (value: string) => {
							plugin.settings.taskPropertyValue = value;
							save();
						},
					},
					() => !!(plugin.settings.taskIdentificationMethod === "tag")
				),
			],
		},
		{
			type: "group",
			heading: translate("settings.integrations.basesIntegration.viewCommands.header"),
			items: [
				{
					name: "",
					desc: translate(
						"settings.integrations.basesIntegration.viewCommands.descriptionRegen"
					),
					render: (setting) => {
						setting.setDesc(
							translate(
								"settings.integrations.basesIntegration.viewCommands.descriptionRegen"
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
								"settings.integrations.basesIntegration.viewCommands.docsLink"
							),
							href: translate(
								"settings.integrations.basesIntegration.viewCommands.docsLinkUrl"
							),
						});
						docsLink.setAttr("target", "_blank");
						setting.settingEl.addClass("settings-view__group-description");
					},
				},
				...commandMappings.map(({ id, nameKey, defaultPath }) => ({
					type: "page" as const,
					name: translate(
						`settings.integrations.basesIntegration.viewCommands.commands.${nameKey}`
					),
					displayValue: () => plugin.settings.commandFileMapping[id],
					items: [
						ctx.field(
							plugin.settings.commandFileMapping,
							id,
							`commandFileMapping.${id}`,
							ctx.t("settings.native.baseFile"),
							{
								type: "file",
								validate: (value) =>
									value.endsWith(".base") ? undefined : "Choose a .base file.",
							}
						),
						ctx.button(`commandFileMapping.${id}.reset`, {
							name: ctx.t("settings.native.resetFileMapping"),
							buttonText: ctx.t(
								"settings.integrations.basesIntegration.viewCommands.resetButton"
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
						"settings.integrations.basesIntegration.autoCreateDefaultFiles.name"
					),
					desc: translate(
						"settings.integrations.basesIntegration.autoCreateDefaultFiles.description"
					),
					render: (setting) => {
						setting
							.setName(
								translate(
									"settings.integrations.basesIntegration.autoCreateDefaultFiles.name"
								)
							)
							.setDesc(
								translate(
									"settings.integrations.basesIntegration.autoCreateDefaultFiles.description"
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
						"settings.integrations.basesIntegration.createDefaultFiles.name"
					),
					desc: translate(
						"settings.integrations.basesIntegration.createDefaultFiles.description"
					),
					render: (setting) => {
						setting
							.setName(
								translate(
									"settings.integrations.basesIntegration.createDefaultFiles.name"
								)
							)
							.setDesc(
								translate(
									"settings.integrations.basesIntegration.createDefaultFiles.description"
								)
							)
							.addButton((button) => {
								button
									.setButtonText(
										translate(
											"settings.integrations.basesIntegration.createDefaultFiles.buttonText"
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
						"settings.integrations.basesIntegration.updateDefaultFiles.name"
					),
					desc: translate(
						"settings.integrations.basesIntegration.updateDefaultFiles.description"
					),
					render: (setting) => {
						setting
							.setName(
								translate(
									"settings.integrations.basesIntegration.updateDefaultFiles.name"
								)
							)
							.setDesc(
								translate(
									"settings.integrations.basesIntegration.updateDefaultFiles.description"
								)
							)
							.addButton((button) => {
								button
									.setButtonText(
										translate(
											"settings.integrations.basesIntegration.updateDefaultFiles.buttonText"
										)
									)
									.onClick(async () => {
										const confirmed = await showConfirmationModal(plugin.app, {
											title: translate(
												"settings.integrations.basesIntegration.updateDefaultFiles.confirmTitle"
											),
											message: translate(
												"settings.integrations.basesIntegration.updateDefaultFiles.confirmMessage"
											),
											confirmText: translate(
												"settings.integrations.basesIntegration.updateDefaultFiles.confirmText"
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
					name: translate("settings.integrations.basesIntegration.exportV3Views.name"),
					desc: translate(
						"settings.integrations.basesIntegration.exportV3Views.description"
					),
					render: (setting) => {
						setting
							.setName(
								translate(
									"settings.integrations.basesIntegration.exportV3Views.name"
								)
							)
							.setDesc(
								translate(
									"settings.integrations.basesIntegration.exportV3Views.description"
								)
							)
							.addButton((button) => {
								button
									.setButtonText(
										translate(
											"settings.integrations.basesIntegration.exportV3Views.buttonText"
										)
									)
									.onClick(async () => {
										try {
											const savedViews =
												plugin.viewStateManager.getSavedViews();

											if (savedViews.length === 0) {
												new Notice(
													translate(
														"settings.integrations.basesIntegration.exportV3Views.noViews"
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
															"settings.integrations.basesIntegration.exportV3Views.fileExists"
														),
														message: translate(
															"settings.integrations.basesIntegration.exportV3Views.confirmOverwrite",
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
													"settings.integrations.basesIntegration.exportV3Views.success",
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
													"settings.integrations.basesIntegration.exportV3Views.error",
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
			heading: translate("settings.general.folderManagement.header"),
			items: [
				ctx.text("excludedFolders", {
					name: translate("settings.general.folderManagement.excludedFolders.name"),
					desc: translate(
						"settings.general.folderManagement.excludedFolders.description"
					),
					placeholder: "Templates, Archive",
					getValue: () => plugin.settings.excludedFolders,
					setValue: async (value: string) => {
						plugin.settings.excludedFolders = value;
						save();
					},
					ariaLabel: "Excluded folder paths",
				}),
			],
		},
		{
			type: "group",
			heading: translate("settings.features.uiLanguage.header"),
			items: [
				ctx.dropdown("uiLanguage", {
					name: translate("settings.features.uiLanguage.dropdown.name"),
					desc: translate("settings.features.uiLanguage.dropdown.description"),
					options: uiLanguageOptions,
					getValue: () => plugin.settings.uiLanguage ?? "system",
					setValue: async (value: string) => {
						plugin.settings.uiLanguage = value;
						plugin.i18n.setLocale(value);
						save();
						ctx.refresh();
					},
				}),
			],
		},
		{
			type: "group",
			heading: translate("settings.general.frontmatter.header"),
			items: [
				ctx.toggle("useFrontmatterMarkdownLinks", {
					name: translate("settings.general.frontmatter.useMarkdownLinks.name"),
					desc: translate("settings.general.frontmatter.useMarkdownLinks.description"),
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
			heading: translate("settings.general.releaseNotes.header"),
			items: [
				ctx.toggle("showReleaseNotesOnUpdate", {
					name: translate("settings.general.releaseNotes.showOnUpdate.name"),
					desc: translate("settings.general.releaseNotes.showOnUpdate.description"),
					getValue: () => plugin.settings.showReleaseNotesOnUpdate ?? true,
					setValue: async (value: boolean) => {
						plugin.settings.showReleaseNotesOnUpdate = value;
						save();
					},
				}),
				ctx.toggle("checkForUpdatesOnStartup", {
					name: translate("settings.general.releaseNotes.checkForUpdates.name"),
					desc: translate("settings.general.releaseNotes.checkForUpdates.description"),
					getValue: () => plugin.settings.checkForUpdatesOnStartup ?? true,
					setValue: async (value: boolean) => {
						plugin.settings.checkForUpdatesOnStartup = value;
						save();
					},
				}),
				{
					name: translate("settings.general.releaseNotes.viewButton.name"),
					desc: translate("settings.general.releaseNotes.viewButton.description"),
					render: (setting) => {
						setting
							.setName(translate("settings.general.releaseNotes.viewButton.name"))
							.setDesc(
								translate("settings.general.releaseNotes.viewButton.description")
							)
							.addButton((button) =>
								button
									.setButtonText(
										translate(
											"settings.general.releaseNotes.viewButton.buttonText"
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
