import { Notice, Setting } from "obsidian";
import TaskNotesPlugin from "../../main";
import {
	createSettingGroup,
	configureTextSetting,
	configureToggleSetting,
	configureDropdownSetting,
} from "../components/settingHelpers";
import { FolderSuggest } from "../components/FolderSuggest";
import { TranslationKey } from "../../i18n";
import { showConfirmationModal } from "../../modals/ConfirmationModal";
import { migrateTag, migratePropertyValue, migratePropertyName } from "../../utils/settingsMigration";
import { LOG_CATEGORY_GROUPS } from "../../utils/DebugLog";

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
			heading: translate("settings.general.taskStorage.header"),
			description: translate("settings.general.taskStorage.description"),
		},
		(group) => {
			group.addSetting((setting) => {
				setting
					.setName(translate("settings.general.taskStorage.defaultFolder.name"))
					.setDesc(translate("settings.general.taskStorage.defaultFolder.description"));

				// Create text input with folder suggest
				const inputEl = setting.controlEl.createEl("input", {
					type: "text",
					cls: "tasknotes-settings__card-input folder-suggest-input",
					attr: { placeholder: "TaskNotes" },
				});
				inputEl.value = plugin.settings.tasksFolder;

				// Attach folder suggester
				new FolderSuggest(plugin.app, inputEl);

				inputEl.addEventListener("input", () => {
					plugin.settings.tasksFolder = inputEl.value.trim();
					save();
				});
			});

			// Folder for converted inline tasks (only shown when instant convert is enabled)
			if (plugin.settings.enableInstantTaskConvert) {
				group.addSetting((setting) =>
					configureTextSetting(setting, {
						name: translate("settings.features.instantConvert.folder.name"),
						desc: translate("settings.features.instantConvert.folder.description"),
						placeholder: "{{currentNotePath}}",
						getValue: () => plugin.settings.inlineTaskConvertFolder,
						setValue: async (value: string) => {
							plugin.settings.inlineTaskConvertFolder = value;
							save();
						},
						ariaLabel: "Folder for converted inline tasks",
					})
				);
			}

			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.general.taskStorage.moveArchived.name"),
					desc: translate("settings.general.taskStorage.moveArchived.description"),
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
				group.addSetting((setting) => {
					setting
						.setName(translate("settings.general.taskStorage.archiveFolder.name"))
						.setDesc(translate("settings.general.taskStorage.archiveFolder.description"));

					// Create text input with folder suggest
					const inputEl = setting.controlEl.createEl("input", {
						type: "text",
						cls: "tasknotes-settings__card-input folder-suggest-input",
						attr: { placeholder: "TaskNotes/Archive" },
					});
					inputEl.value = plugin.settings.archiveFolder;

					// Attach folder suggester
					new FolderSuggest(plugin.app, inputEl);

					inputEl.addEventListener("input", () => {
						plugin.settings.archiveFolder = inputEl.value.trim();
						save();
					});
				});
			}
		}
	);

	// Task Identification Section
	createSettingGroup(
		container,
		{
			heading: translate("settings.general.taskIdentification.header"),
			description: translate("settings.general.taskIdentification.description"),
		},
		(group) => {
			group.addSetting((setting) =>
				configureDropdownSetting(setting, {
					name: translate("settings.general.taskIdentification.identifyBy.name"),
					desc: translate("settings.general.taskIdentification.identifyBy.description"),
					options: [
						{
							value: "tag",
							label: translate("settings.general.taskIdentification.identifyBy.options.tag"),
						},
						{
							value: "property",
							label: translate("settings.general.taskIdentification.identifyBy.options.property"),
						},
					],
					getValue: () => plugin.settings.taskIdentificationMethod,
					setValue: async (value: string) => {
						plugin.settings.taskIdentificationMethod = value as "tag" | "property";
						save();
						// Re-render to show/hide conditional fields
						renderGeneralTab(container, plugin, save);
					},
					ariaLabel: "Task identification method",
				})
			);

			if (plugin.settings.taskIdentificationMethod === "tag") {
				group.addSetting((setting) =>
					configureTextSetting(setting, {
						name: translate("settings.general.taskIdentification.taskTag.name"),
						desc: translate("settings.general.taskIdentification.taskTag.description"),
						placeholder: "task",
						commitOnBlur: true,
						getValue: () => plugin.settings.taskTag,
						setValue: async (value: string) => {
							const newVal = value.trim();
							const oldVal = plugin.settings.taskTag;
							if (newVal === oldVal || !oldVal) {
								plugin.settings.taskTag = newVal;
								save();
								return;
							}

							const result = await migrateTag({
								app: plugin.app,
								plugin,
								oldTag: oldVal,
								newTag: newVal,
								description: "task notes",
							});

							if (result === "cancelled") {
								const inputEl = setting.controlEl.querySelector("input");
								if (inputEl) (inputEl as HTMLInputElement).value = oldVal;
								return;
							}
							plugin.settings.taskTag = newVal;
							save();
						},
						ariaLabel: "Task identification tag",
					})
				);

				group.addSetting((setting) =>
					configureToggleSetting(setting, {
						name: translate("settings.general.taskIdentification.hideIdentifyingTags.name"),
						desc: translate("settings.general.taskIdentification.hideIdentifyingTags.description"),
						getValue: () => plugin.settings.hideIdentifyingTagsInCards,
						setValue: async (value: boolean) => {
							plugin.settings.hideIdentifyingTagsInCards = value;
							save();
						},
					})
				);
			} else {
				group.addSetting((setting) =>
					configureTextSetting(setting, {
						name: translate("settings.general.taskIdentification.taskProperty.name"),
						desc: translate("settings.general.taskIdentification.taskProperty.description"),
						placeholder: "category",
						commitOnBlur: true,
						getValue: () => plugin.settings.taskPropertyName,
						setValue: async (value: string) => {
							const newVal = value.trim();
							const oldVal = plugin.settings.taskPropertyName;
							if (newVal === oldVal || !oldVal) {
								plugin.settings.taskPropertyName = newVal;
								save();
								return;
							}

							const result = await migratePropertyName({
								app: plugin.app,
								plugin,
								oldPropertyName: oldVal,
								newPropertyName: newVal,
								description: "task notes",
							});

							if (result === "cancelled") {
								const inputEl = setting.controlEl.querySelector("input");
								if (inputEl) (inputEl as HTMLInputElement).value = oldVal;
								return;
							}
							plugin.settings.taskPropertyName = newVal;
							save();
						},
					})
				);

				group.addSetting((setting) =>
					configureTextSetting(setting, {
						name: translate("settings.general.taskIdentification.taskPropertyValue.name"),
						desc: translate("settings.general.taskIdentification.taskPropertyValue.description"),
						placeholder: "task",
						commitOnBlur: true,
						getValue: () => plugin.settings.taskPropertyValue,
						setValue: async (value: string) => {
							const newVal = value.trim();
							const oldVal = plugin.settings.taskPropertyValue;
							if (newVal === oldVal || !oldVal) {
								plugin.settings.taskPropertyValue = newVal;
								save();
								return;
							}

							const propName = plugin.settings.taskPropertyName;
							if (!propName) {
								plugin.settings.taskPropertyValue = newVal;
								save();
								return;
							}

							const result = await migratePropertyValue({
								app: plugin.app,
								plugin,
								propertyName: propName,
								oldValue: oldVal,
								newValue: newVal,
								description: "task notes",
							});

							if (result === "cancelled") {
								const inputEl = setting.controlEl.querySelector("input");
								if (inputEl) (inputEl as HTMLInputElement).value = oldVal;
								return;
							}
							plugin.settings.taskPropertyValue = newVal;
							save();
						},
					})
				);
			}
		}
	);

	// Views & Base Files Section (moved above Folder Management)
	// Command file mappings data
	const commandMappings = [
		{
			id: 'open-calendar-view',
			nameKey: 'miniCalendar' as const,
			defaultPath: 'TaskNotes/Views/mini-calendar-default.base',
		},
		{
			id: 'open-kanban-view',
			nameKey: 'kanban' as const,
			defaultPath: 'TaskNotes/Views/kanban-default.base',
		},
		{
			id: 'open-tasks-view',
			nameKey: 'tasks' as const,
			defaultPath: 'TaskNotes/Views/tasks-default.base',
		},
		{
			id: 'open-advanced-calendar-view',
			nameKey: 'advancedCalendar' as const,
			defaultPath: 'TaskNotes/Views/calendar-default.base',
		},
		{
			id: 'open-agenda-view',
			nameKey: 'agenda' as const,
			defaultPath: 'TaskNotes/Views/agenda-default.base',
		},
		{
			id: 'relationships',
			nameKey: 'relationships' as const,
			defaultPath: 'TaskNotes/Views/relationships.base',
		},
		{
			id: 'open-upcoming-view',
			nameKey: 'upcoming' as const,
			defaultPath: 'TaskNotes/Views/upcoming-default.base',
		},
	];

	createSettingGroup(
		container,
		{
			heading: translate("settings.integrations.basesIntegration.viewCommands.header"),
			description: translate("settings.integrations.basesIntegration.viewCommands.description"),
		},
		(group) => {
			// Additional description
			group.addSetting((setting) => {
				setting.setDesc(translate("settings.integrations.basesIntegration.viewCommands.descriptionRegen"));
				setting.settingEl.addClass("settings-view__group-description");
			});

			// Documentation link
			group.addSetting((setting) => {
				const descEl = setting.descEl;
				const docsLink = descEl.createEl("a", {
					text: translate("settings.integrations.basesIntegration.viewCommands.docsLink"),
					href: translate("settings.integrations.basesIntegration.viewCommands.docsLinkUrl"),
				});
				docsLink.setAttr("target", "_blank");
				setting.settingEl.addClass("settings-view__group-description");
			});

			// Command file mappings
			commandMappings.forEach(({ id, nameKey, defaultPath }) => {
				group.addSetting((setting) => {
					const commandName = translate(`settings.integrations.basesIntegration.viewCommands.commands.${nameKey}` as any);
					setting.setName(commandName);
					setting.setDesc(translate("settings.integrations.basesIntegration.viewCommands.fileLabel", {
						path: plugin.settings.commandFileMapping[id]
					}));

					// Text input for file path
					setting.addText(text => {
						text.setPlaceholder(defaultPath)
							.setValue(plugin.settings.commandFileMapping[id])
							.onChange(async (value) => {
								plugin.settings.commandFileMapping[id] = value;
								await save();
								// Update description
								setting.setDesc(translate("settings.integrations.basesIntegration.viewCommands.fileLabel", {
									path: value
								}));
							});
						text.inputEl.style.width = '100%';
						return text;
					});

					// Reset button
					setting.addButton(button => {
						button.setButtonText(translate("settings.integrations.basesIntegration.viewCommands.resetButton"))
							.setTooltip(translate("settings.integrations.basesIntegration.viewCommands.resetTooltip"))
							.onClick(async () => {
								plugin.settings.commandFileMapping[id] = defaultPath;
								await save();
								// Refresh the entire settings display
								if (app.setting.activeTab) {
									app.setting.openTabById(app.setting.activeTab.id);
								}
							});
						return button;
					});
				});
			});

			// Auto-create default files toggle
			group.addSetting((setting) => {
				setting
					.setName(translate("settings.integrations.basesIntegration.autoCreateDefaultFiles.name"))
					.setDesc(translate("settings.integrations.basesIntegration.autoCreateDefaultFiles.description"))
					.addToggle(toggle => {
						toggle.setValue(plugin.settings.autoCreateDefaultBasesFiles)
							.onChange(async (value) => {
								plugin.settings.autoCreateDefaultBasesFiles = value;
								await save();
							});
						return toggle;
					});
			});

			// Create Default Files button
			group.addSetting((setting) => {
				setting
					.setName(translate("settings.integrations.basesIntegration.createDefaultFiles.name"))
					.setDesc(translate("settings.integrations.basesIntegration.createDefaultFiles.description"))
					.addButton(button => {
						button.setButtonText(translate("settings.integrations.basesIntegration.createDefaultFiles.buttonText"))
							.setCta()
							.onClick(async () => {
								await plugin.createDefaultBasesFiles();
							});
						return button;
					});
			});

			// Export All Saved Views button
			group.addSetting((setting) => {
				setting
					.setName(translate("settings.integrations.basesIntegration.exportV3Views.name"))
					.setDesc(translate("settings.integrations.basesIntegration.exportV3Views.description"))
					.addButton(button => {
						button.setButtonText(translate("settings.integrations.basesIntegration.exportV3Views.buttonText"))
							.onClick(async () => {
								try {
									const savedViews = plugin.viewStateManager.getSavedViews();

									if (savedViews.length === 0) {
										new Notice(translate("settings.integrations.basesIntegration.exportV3Views.noViews"));
										return;
									}

									const basesContent = plugin.basesFilterConverter.convertAllSavedViewsToBasesFile(savedViews);
									const fileName = 'all-saved-views.base';
									const filePath = `TaskNotes/Views/${fileName}`;

									// Create folder if needed (check on-disk via adapter, not in-memory cache)
									if (!(await plugin.app.vault.adapter.exists('TaskNotes/Views'))) {
										await plugin.app.vault.createFolder('TaskNotes/Views');
									}

									// Handle file overwrite confirmation
									const existingFile = plugin.app.vault.getAbstractFileByPath(filePath);
									if (existingFile) {
										const confirmed = await showConfirmationModal(plugin.app, {
											title: translate("settings.integrations.basesIntegration.exportV3Views.fileExists"),
											message: translate("settings.integrations.basesIntegration.exportV3Views.confirmOverwrite", { fileName }),
											isDestructive: false,
										});
										if (!confirmed) return;
										await plugin.app.vault.modify(existingFile as any, basesContent);
									} else {
										await plugin.app.vault.create(filePath, basesContent);
									}

									new Notice(translate("settings.integrations.basesIntegration.exportV3Views.success", {
										count: savedViews.length.toString(),
										filePath
									}));
									await plugin.app.workspace.openLinkText(filePath, '', true);
								} catch (error) {
									console.error('Error exporting all views to Bases:', error);
									new Notice(translate("settings.integrations.basesIntegration.exportV3Views.error", {
										message: error.message
									}));
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
		{ heading: translate("settings.general.folderManagement.header") },
		(group) => {
			group.addSetting((setting) =>
				configureTextSetting(setting, {
					name: translate("settings.general.folderManagement.excludedFolders.name"),
					desc: translate("settings.general.folderManagement.excludedFolders.description"),
					placeholder: "Templates, Archive",
					getValue: () => plugin.settings.excludedFolders,
					setValue: async (value: string) => {
						plugin.settings.excludedFolders = value;
						save();
					},
					ariaLabel: "Excluded folder paths",
				})
			);
		}
	);

	// UI Language Section
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

	createSettingGroup(
		container,
		{
			heading: translate("settings.features.uiLanguage.header"),
			description: translate("settings.features.uiLanguage.description"),
		},
		(group) => {
			group.addSetting((setting) =>
				configureDropdownSetting(setting, {
					name: translate("settings.features.uiLanguage.dropdown.name"),
					desc: translate("settings.features.uiLanguage.dropdown.description"),
					options: uiLanguageOptions,
					getValue: () => plugin.settings.uiLanguage ?? "system",
					setValue: async (value: string) => {
						plugin.settings.uiLanguage = value;
						plugin.i18n.setLocale(value);
						save();
						renderGeneralTab(container, plugin, save);
					},
				})
			);
		}
	);

	// Frontmatter Section - only show if user has markdown links enabled globally
	const useMarkdownLinks = plugin.app.vault.getConfig('useMarkdownLinks');
	if (useMarkdownLinks) {
		createSettingGroup(
			container,
			{
				heading: translate("settings.general.frontmatter.header"),
				description: translate("settings.general.frontmatter.description"),
			},
			(group) => {
				group.addSetting((setting) =>
					configureToggleSetting(setting, {
						name: translate("settings.general.frontmatter.useMarkdownLinks.name"),
						desc: translate("settings.general.frontmatter.useMarkdownLinks.description"),
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
			heading: translate("settings.general.releaseNotes.header"),
			description: translate("settings.general.releaseNotes.description", { version: plugin.manifest.version }),
		},
		(group) => {
			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: translate("settings.general.releaseNotes.showOnUpdate.name"),
					desc: translate("settings.general.releaseNotes.showOnUpdate.description"),
					getValue: () => plugin.settings.showReleaseNotesOnUpdate ?? true,
					setValue: async (value: boolean) => {
						plugin.settings.showReleaseNotesOnUpdate = value;
						save();
					},
				})
			);

			group.addSetting((setting) => {
				setting
					.setName(translate("settings.general.releaseNotes.viewButton.name"))
					.setDesc(translate("settings.general.releaseNotes.viewButton.description"))
					.addButton((button) =>
						button
							.setButtonText(translate("settings.general.releaseNotes.viewButton.buttonText"))
							.setCta()
							.onClick(async () => {
								await plugin.activateReleaseNotesView();
							})
					);
			});
		}
	);

	// Developer Options Section
	createSettingGroup(
		container,
		{
			heading: "Developer options",
			description: "Settings for debugging and development. Enable debug logging to write diagnostics to debug.log in your vault root.",
		},
		(group) => {
			// Container for the category filters (shown/hidden with toggle)
			let categoryContainer: HTMLElement | null = null;

			const renderCategories = (parentEl: HTMLElement, show: boolean): void => {
				categoryContainer?.remove();
				categoryContainer = null;
				if (!show) return;

				categoryContainer = parentEl.createDiv({ cls: "tn-debug-categories" });
				const cats: Record<string, boolean> = { ...(plugin.settings.debugLogCategories ?? {}) };

				// "Select all" / "Deselect all" controls
				const controlRow = categoryContainer.createDiv({ cls: "setting-item" });
				controlRow.style.cssText = "padding: 4px 0; border: none; display: flex; gap: 8px;";
				const selectAll = controlRow.createEl("a", { text: "Select all" });
				selectAll.style.cssText = "cursor: pointer; color: var(--text-accent); font-size: var(--font-ui-small);";
				const deselectAll = controlRow.createEl("a", { text: "Deselect all" });
				deselectAll.style.cssText = "cursor: pointer; color: var(--text-accent); font-size: var(--font-ui-small);";

				const allCheckboxes: HTMLInputElement[] = [];

				// Render each group
				for (const [groupName, tags] of Object.entries(LOG_CATEGORY_GROUPS)) {
					const groupEl = categoryContainer.createDiv();
					groupEl.createEl("div", {
						text: groupName,
						cls: "setting-item-name",
					}).style.cssText = "font-size: var(--font-ui-small); font-weight: var(--font-semibold); margin: 8px 0 4px; color: var(--text-muted);";

					const tagGrid = groupEl.createDiv();
					tagGrid.style.cssText = "display: flex; flex-wrap: wrap; gap: 4px 12px;";

					for (const tag of tags) {
						const label = tagGrid.createEl("label");
						label.style.cssText = "display: flex; align-items: center; gap: 4px; font-size: var(--font-ui-small); cursor: pointer;";
						const cb = label.createEl("input", { type: "checkbox" });
						cb.checked = cats[tag] !== false;
						label.appendText(tag);
						allCheckboxes.push(cb);

						cb.addEventListener("change", () => {
							if (cb.checked) {
								delete cats[tag]; // Remove = default enabled
							} else {
								cats[tag] = false;
							}
							plugin.settings.debugLogCategories = { ...cats };
							plugin.debugLog.setCategories(plugin.settings.debugLogCategories);
							save();
						});
					}
				}

				selectAll.addEventListener("click", (e) => {
					e.preventDefault();
					allCheckboxes.forEach(cb => { cb.checked = true; cb.dispatchEvent(new Event("change")); });
				});
				deselectAll.addEventListener("click", (e) => {
					e.preventDefault();
					allCheckboxes.forEach(cb => { cb.checked = false; cb.dispatchEvent(new Event("change")); });
				});
			};

			group.addSetting((setting) =>
				configureToggleSetting(setting, {
					name: "Enable debug logging",
					desc: "When ON, diagnostic logs go to both the developer console (Ctrl+Shift+I) and a debug.log file in your vault root. When OFF, all info/warning logs are silenced — only errors reach the console. Use the category filters below to focus on specific subsystems.",
					getValue: () => plugin.settings.enableDebugLogging ?? false,
					setValue: async (value: boolean) => {
						plugin.settings.enableDebugLogging = value;
						plugin.debugLog.setEnabled(value);
						save();
						new Notice(`Debug logging ${value ? "enabled" : "disabled"}`);
						// Show/hide category filters
						renderCategories(setting.settingEl.parentElement!, value);
					},
				})
			);

			// Show categories on initial render if logging is already on
			group.addSetting((setting) => {
				setting.settingEl.style.display = "none"; // Invisible anchor
				if (plugin.settings.enableDebugLogging) {
					renderCategories(setting.settingEl.parentElement!, true);
				}
			});

			group.addSetting((setting) => {
				setting
					.setName("Clear debug log")
					.setDesc("Clear the contents of the debug.log file")
					.addButton((button) =>
						button
							.setButtonText("Clear log")
							.onClick(async () => {
								await plugin.debugLog.clear();
								new Notice("Debug log cleared");
							})
					);
			});
		}
	);
}
