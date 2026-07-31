import { Setting } from "obsidian";
import type TaskNotesPlugin from "../../main";
import type {
	JiraEnumRemap,
	JiraValueSource,
	JiraValueSourceMode,
} from "../../types/settings";
import {
	createDefaultJiraMappingSettings,
	JIRA_MAPPING_TARGETS,
} from "../../integrations/jira/JiraFieldMapping";

const MODE_OPTIONS: Record<JiraValueSourceMode, string> = {
	path: "Jira path",
	template: "Template",
	fixed: "Fixed value",
	off: "Disabled",
};

function humanizeFieldId(fieldId: string): string {
	return fieldId
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/^./, (value) => value.toLocaleUpperCase());
}

function sourcePlaceholder(mode: JiraValueSourceMode): string {
	switch (mode) {
		case "path":
			return "fields.components[].name";
		case "template":
			return "$key $fields.summary";
		case "fixed":
			return "Fixed TaskNotes value";
		case "off":
			return "";
	}
}

function formatEnumRemaps(remaps: JiraEnumRemap[]): string {
	return remaps
		.map((entry) => `${entry.taskValue} = ${entry.jiraValues.join(", ")}`)
		.join("\n");
}

export function parseJiraEnumRemaps(value: string): JiraEnumRemap[] {
	return value
		.split(/\r?\n/)
		.map((line) => {
			const separator = line.indexOf("=");
			if (separator < 0) return null;
			const taskValue = line.slice(0, separator).trim();
			const jiraValues = line
				.slice(separator + 1)
				.split(",")
				.map((item) => item.trim())
				.filter(Boolean);
			return taskValue && jiraValues.length ? { taskValue, jiraValues } : null;
		})
		.filter((entry): entry is JiraEnumRemap => !!entry);
}

function renderSourceSetting(
	container: HTMLElement,
	label: string,
	source: JiraValueSource,
	options: {
		canRemove: boolean;
		onChange: () => void;
		onRemove: () => void;
		save: () => void;
	}
): void {
	const setting = new Setting(container).setName(label);
	setting.addDropdown((dropdown) => {
		for (const [mode, modeLabel] of Object.entries(MODE_OPTIONS)) {
			dropdown.addOption(mode, modeLabel);
		}
		dropdown.setValue(source.mode).onChange((mode) => {
			source.mode = mode as JiraValueSourceMode;
			options.save();
			options.onChange();
		});
	});
	setting.addText((text) => {
		text.inputEl.ariaLabel = `${label} mapping value`;
		text
			.setValue(source.value)
			.setPlaceholder(sourcePlaceholder(source.mode))
			.setDisabled(source.mode === "off")
			.onChange((value) => {
				source.value = value;
				options.save();
			});
	});
	if (options.canRemove) {
		setting.addExtraButton((button) => {
			button
				.setIcon("trash-2")
				.setTooltip("Remove source")
				.onClick(options.onRemove);
		});
	}
}

function renderFieldSources(
	container: HTMLElement,
	fieldId: string,
	sources: JiraValueSource[],
	isList: boolean,
	save: () => void,
	rerender: () => void
): void {
	if (!isList && sources.length === 0) {
		sources.push({ mode: "off", value: "" });
	}

	if (sources.length === 0) {
		new Setting(container)
			.setName(humanizeFieldId(fieldId))
			.setDesc("No sources configured.")
			.addButton((button) =>
				button.setButtonText("Add source").onClick(() => {
					sources.push({ mode: "path", value: "" });
					save();
					rerender();
				})
			);
		return;
	}

	sources.forEach((source, index) => {
		renderSourceSetting(
			container,
			index === 0 ? humanizeFieldId(fieldId) : `${humanizeFieldId(fieldId)} source ${index + 1}`,
			source,
			{
				canRemove: isList,
				onChange: rerender,
				onRemove: () => {
					sources.splice(index, 1);
					save();
					rerender();
				},
				save,
			}
		);
	});

	if (isList) {
		new Setting(container).addButton((button) =>
			button.setButtonText("Add source").onClick(() => {
				sources.push({ mode: "path", value: "" });
				save();
				rerender();
			})
		);
	}
}

function renderEnumRemapSetting(
	container: HTMLElement,
	label: string,
	description: string,
	remaps: JiraEnumRemap[],
	onChange: (remaps: JiraEnumRemap[]) => void
): void {
	new Setting(container)
		.setName(label)
		.setDesc(description)
		.addTextArea((text) => {
			text.inputEl.rows = 4;
			text.inputEl.ariaLabel = `${label} mappings`;
			text
				.setPlaceholder("In-progress = doing, in progress")
				.setValue(formatEnumRemaps(remaps))
				.onChange((value) => onChange(parseJiraEnumRemaps(value)));
		});
}

/**
 * Renders the configurable Jira-to-TaskNotes transformation independently of core
 * field mapping. The section rerenders locally when its dynamic source lists change.
 */
export function renderJiraMappingSettings(
	parent: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void
): void {
	const container = parent.createDiv("tasknotes-jira-mapping-settings");

	const render = (): void => {
		container.empty();
		new Setting(container)
			.setName(plugin.i18n.translate("settings.integrations.jiraMapping.header"))
			.setDesc(plugin.i18n.translate("settings.integrations.jiraMapping.description"))
			.setHeading()
			.addButton((button) =>
				button
					.setButtonText(
						plugin.i18n.translate("settings.integrations.jiraMapping.reset")
					)
					.onClick(() => {
						plugin.settings.jiraMapping = createDefaultJiraMappingSettings();
						save();
						render();
					})
			);

		new Setting(container)
			.setName(plugin.i18n.translate("settings.integrations.jiraMapping.sourcesHeader"))
			.setDesc(plugin.i18n.translate("settings.integrations.jiraMapping.sourcesDescription"))
			.setHeading();

		for (const target of JIRA_MAPPING_TARGETS) {
			const sources = (plugin.settings.jiraMapping.fields[target.id] ??= []);
			renderFieldSources(
				container,
				target.id,
				sources,
				target.kind === "list",
				save,
				render
			);
		}

		if ((plugin.settings.userFields ?? []).length > 0) {
			new Setting(container)
				.setName(plugin.i18n.translate("settings.integrations.jiraMapping.userFieldsHeader"))
				.setDesc(
					plugin.i18n.translate("settings.integrations.jiraMapping.userFieldsDescription")
				)
				.setHeading();
			for (const userField of plugin.settings.userFields ?? []) {
				const sources = (plugin.settings.jiraMapping.userFields[userField.id] ??= []);
				renderFieldSources(
					container,
					userField.displayName,
					sources,
					userField.type === "list",
					save,
					render
				);
			}
		}

		new Setting(container)
			.setName(plugin.i18n.translate("settings.integrations.jiraMapping.remapsHeader"))
			.setDesc(plugin.i18n.translate("settings.integrations.jiraMapping.remapsDescription"))
			.setHeading();
		const remaps = plugin.settings.jiraMapping.enumRemaps;
		renderEnumRemapSetting(
			container,
			"Status",
			"One mapping per line: TaskNotes value = Jira value, alternate Jira value.",
			remaps.status,
			(value) => {
				remaps.status = value;
				save();
			}
		);
		renderEnumRemapSetting(
			container,
			"Priority",
			"One mapping per line: TaskNotes value = Jira value, alternate Jira value.",
			remaps.priority,
			(value) => {
				remaps.priority = value;
				save();
			}
		);
		renderEnumRemapSetting(
			container,
			"Contexts",
			"Context mappings are applied after all configured list sources are merged.",
			remaps.contexts,
			(value) => {
				remaps.contexts = value;
				save();
			}
		);
	};

	render();
}
