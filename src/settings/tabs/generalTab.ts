// import { TAbstractFile } from 'obsidian';
import { Setting } from "obsidian";
import TaskNotesPlugin from "../../main";
import {
	createSectionHeader,
	createTextSetting,
	createToggleSetting,
	createDropdownSetting,
	createHelpText,
} from "../components/settingHelpers";
import { TranslationKey } from "../../i18n";

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
	createSectionHeader(container, translate("settings.general.taskStorage.header"));
	createHelpText(container, translate("settings.general.taskStorage.description"));

	createTextSetting(container, {
		name: translate("settings.general.taskStorage.defaultFolder.name"),
		desc: translate("settings.general.taskStorage.defaultFolder.description"),
		placeholder: "TaskNotes",
		getValue: () => plugin.settings.tasksFolder,
		setValue: async (value: string) => {
			plugin.settings.tasksFolder = value;
			save();
		},
		ariaLabel: "Default folder path for new tasks",
	});

	createToggleSetting(container, {
		name: translate("settings.general.taskStorage.moveArchived.name"),
		desc: translate("settings.general.taskStorage.moveArchived.description"),
		getValue: () => plugin.settings.moveArchivedTasks,
		setValue: async (value: boolean) => {
			plugin.settings.moveArchivedTasks = value;
			save();
			// Re-render to show/hide archive folder setting
			renderGeneralTab(container, plugin, save);
		},
	});

	if (plugin.settings.moveArchivedTasks) {
		createTextSetting(container, {
			name: translate("settings.general.taskStorage.archiveFolder.name"),
			desc: translate("settings.general.taskStorage.archiveFolder.description"),
			placeholder: "TaskNotes/Archive",
			getValue: () => plugin.settings.archiveFolder,
			setValue: async (value: string) => {
				plugin.settings.archiveFolder = value;
				save();
			},
			ariaLabel: "Archive folder path",
		});
	}

	// Task Identification Section
	createSectionHeader(container, translate("settings.general.taskIdentification.header"));
	createHelpText(container, translate("settings.general.taskIdentification.description"));

	createDropdownSetting(container, {
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
	});

	if (plugin.settings.taskIdentificationMethod === "tag") {
		createTextSetting(container, {
			name: translate("settings.general.taskIdentification.taskTag.name"),
			desc: translate("settings.general.taskIdentification.taskTag.description"),
			placeholder: "task",
			getValue: () => plugin.settings.taskTag,
			setValue: async (value: string) => {
				plugin.settings.taskTag = value;
				save();
			},
			ariaLabel: "Task identification tag",
		});

		createToggleSetting(container, {
			name: translate("settings.general.taskIdentification.hideIdentifyingTags.name"),
			desc: translate("settings.general.taskIdentification.hideIdentifyingTags.description"),
			getValue: () => plugin.settings.hideIdentifyingTagsInCards,
			setValue: async (value: boolean) => {
				plugin.settings.hideIdentifyingTagsInCards = value;
				save();
			},
		});
	} else {
		createTextSetting(container, {
			name: translate("settings.general.taskIdentification.taskProperty.name"),
			desc: translate("settings.general.taskIdentification.taskProperty.description"),
			placeholder: "category",
			getValue: () => plugin.settings.taskPropertyName,
			setValue: async (value: string) => {
				plugin.settings.taskPropertyName = value;
				save();
			},
		});

		createTextSetting(container, {
			name: translate("settings.general.taskIdentification.taskPropertyValue.name"),
			desc: translate("settings.general.taskIdentification.taskPropertyValue.description"),
			placeholder: "task",
			getValue: () => plugin.settings.taskPropertyValue,
			setValue: async (value: string) => {
				plugin.settings.taskPropertyValue = value;
				save();
			},
		});
	}

	// Folder Management Section
	createSectionHeader(container, translate("settings.general.folderManagement.header"));

	createTextSetting(container, {
		name: translate("settings.general.folderManagement.excludedFolders.name"),
		desc: translate("settings.general.folderManagement.excludedFolders.description"),
		placeholder: "Templates, Archive",
		getValue: () => plugin.settings.excludedFolders,
		setValue: async (value: string) => {
			plugin.settings.excludedFolders = value;
			save();
		},
		ariaLabel: "Excluded folder paths",
	});

	// UI Language Section
	createSectionHeader(container, translate("settings.features.uiLanguage.header"));
	createHelpText(container, translate("settings.features.uiLanguage.description"));

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

	createDropdownSetting(container, {
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
	});

	// Frontmatter Section - only show if user has markdown links enabled globally
	const useMarkdownLinks = plugin.app.vault.getConfig('useMarkdownLinks');
	if (useMarkdownLinks) {
		createSectionHeader(container, translate("settings.general.frontmatter.header"));
		createHelpText(container, translate("settings.general.frontmatter.description"));

		createToggleSetting(container, {
			name: translate("settings.general.frontmatter.useMarkdownLinks.name"),
			desc: translate("settings.general.frontmatter.useMarkdownLinks.description"),
			getValue: () => plugin.settings.useFrontmatterMarkdownLinks,
			setValue: async (value: boolean) => {
				plugin.settings.useFrontmatterMarkdownLinks = value;
				save();
			},
		});
	}

	// Task Interaction Section
	createSectionHeader(container, translate("settings.general.taskInteraction.header"));
	createHelpText(container, translate("settings.general.taskInteraction.description"));

	createDropdownSetting(container, {
		name: translate("settings.general.taskInteraction.singleClick.name"),
		desc: translate("settings.general.taskInteraction.singleClick.description"),
		options: [
			{ value: "edit", label: translate("settings.general.taskInteraction.actions.edit") },
			{
				value: "openNote",
				label: translate("settings.general.taskInteraction.actions.openNote"),
			},
		],
		getValue: () => plugin.settings.singleClickAction,
		setValue: async (value: string) => {
			plugin.settings.singleClickAction = value as "edit" | "openNote";
			save();
		},
	});

	createDropdownSetting(container, {
		name: translate("settings.general.taskInteraction.doubleClick.name"),
		desc: translate("settings.general.taskInteraction.doubleClick.description"),
		options: [
			{ value: "edit", label: translate("settings.general.taskInteraction.actions.edit") },
			{
				value: "openNote",
				label: translate("settings.general.taskInteraction.actions.openNote"),
			},
			{ value: "none", label: translate("settings.general.taskInteraction.actions.none") },
		],
		getValue: () => plugin.settings.doubleClickAction,
		setValue: async (value: string) => {
			plugin.settings.doubleClickAction = value as "edit" | "openNote" | "none";
			save();
		},
	});

	// Release Notes Section
	createSectionHeader(container, translate("settings.general.releaseNotes.header"));
	createHelpText(container, translate("settings.general.releaseNotes.description", { version: plugin.manifest.version }));

	createToggleSetting(container, {
		name: translate("settings.general.releaseNotes.showOnUpdate.name"),
		desc: translate("settings.general.releaseNotes.showOnUpdate.description"),
		getValue: () => plugin.settings.showReleaseNotesOnUpdate ?? true,
		setValue: async (value: boolean) => {
			plugin.settings.showReleaseNotesOnUpdate = value;
			save();
		},
	});

	new Setting(container)
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
}
