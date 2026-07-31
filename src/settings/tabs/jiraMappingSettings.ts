import { Notice, Setting, setIcon } from "obsidian";
import type TaskNotesPlugin from "../../main";
import type {
	JiraEnumRemap,
	JiraValueSource,
	JiraValueSourceMode,
} from "../../types/settings";
import {
	buildJiraMappingPreview,
	createDefaultJiraMappingSettings,
	JIRA_MAPPING_TARGETS,
} from "../../integrations/jira/JiraFieldMapping";
import {
	JiraIssueAdapter,
	type JiraIssue,
} from "../../integrations/jira/JiraIssueAdapter";

export const MAX_JIRA_RAW_PREVIEW_CHARS = 50_000;
const MAX_JIRA_VALUE_PREVIEW_CHARS = 500;

export function serializeJiraIssuePreview(
	issue: JiraIssue,
	maxChars = MAX_JIRA_RAW_PREVIEW_CHARS
): { text: string; truncated: boolean } {
	const json = JSON.stringify(issue, null, 2);
	if (json.length <= maxChars) return { text: json, truncated: false };
	return {
		text: `${json.slice(0, maxChars)}\n…`,
		truncated: true,
	};
}

function formatPreviewValue(value: unknown): string {
	const text =
		typeof value === "string"
			? value
			: JSON.stringify(value, null, Array.isArray(value) ? 0 : 2);
	if (text.length <= MAX_JIRA_VALUE_PREVIEW_CHARS) return text;
	return `${text.slice(0, MAX_JIRA_VALUE_PREVIEW_CHARS)}…`;
}

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
	let issueKey = "";
	let issueKeyInputEl: HTMLInputElement | null = null;
	let sampleIssue: JiraIssue | null = null;
	let previewStatus: "idle" | "loading" | "success" | "error" = "idle";
	let previewError = "";
	let rawExpanded = false;
	let refreshPreview = (): void => {};

	const fetchSampleIssue = async (): Promise<void> => {
		issueKey = issueKeyInputEl?.value.trim() ?? issueKey.trim();
		previewStatus = "loading";
		previewError = "";
		render();
		try {
			sampleIssue = await JiraIssueAdapter.fromApp(plugin.app).getIssue(issueKey);
			previewStatus = "success";
		} catch (error) {
			sampleIssue = null;
			previewStatus = "error";
			previewError =
				error instanceof Error
					? error.message
					: plugin.i18n.translate(
							"settings.integrations.jiraMapping.preview.unknownError"
						);
		}
		render();
	};

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
			.setName(
				plugin.i18n.translate(
					"settings.integrations.jiraMapping.preview.sampleIssue"
				)
			)
			.setDesc(
				plugin.i18n.translate(
					"settings.integrations.jiraMapping.preview.sampleIssueDescription"
				)
			)
			.addText((text) => {
				issueKeyInputEl = text.inputEl;
				text.inputEl.ariaLabel = plugin.i18n.translate(
					"settings.integrations.jiraMapping.preview.issueKey"
				);
				text
					.setPlaceholder(
						plugin.i18n.translate(
							"settings.integrations.jiraMapping.preview.issueKeyPlaceholder"
						)
					)
					.setValue(issueKey)
					.onChange((value) => {
						issueKey = value;
					});
				text.inputEl.addEventListener("keydown", (event) => {
					if (
						event.key === "Enter" &&
						text.inputEl.value.trim() &&
						previewStatus !== "loading"
					) {
						event.preventDefault();
						void fetchSampleIssue();
					}
				});
			})
			.addButton((button) =>
				button
					.setButtonText(
						previewStatus === "loading"
							? plugin.i18n.translate(
									"settings.integrations.jiraMapping.preview.loading"
								)
							: plugin.i18n.translate(
									"settings.integrations.jiraMapping.preview.fetch"
								)
					)
					.setDisabled(previewStatus === "loading")
					.onClick(() => void fetchSampleIssue())
			);

		const previewContainer = container.createDiv(
			"tasknotes-jira-mapping-preview"
		);
		refreshPreview = (): void => {
			previewContainer.empty();
			if (previewStatus === "error") {
				previewContainer.createDiv({
					cls: "tasknotes-jira-mapping-preview__error",
					text: previewError,
				});
				return;
			}
			if (!sampleIssue) return;

			new Setting(previewContainer)
				.setName(
					plugin.i18n.translate(
						"settings.integrations.jiraMapping.preview.resolvedValues"
					)
				)
				.setDesc(
					plugin.i18n.translate(
						"settings.integrations.jiraMapping.preview.resolvedValuesDescription"
					)
				)
				.setHeading();

			const values = previewContainer.createDiv(
				"tasknotes-jira-mapping-preview__values"
			);
			for (const entry of buildJiraMappingPreview(
				sampleIssue,
				plugin.settings.jiraMapping,
				plugin.settings.userFields ?? []
			)) {
				const row = values.createDiv("tasknotes-jira-mapping-preview__row");
				row.createDiv({
					cls: "tasknotes-jira-mapping-preview__label",
					text: humanizeFieldId(entry.label),
				});
				row.createEl("code", {
					cls: `tasknotes-jira-mapping-preview__value is-${entry.status}`,
					text:
						entry.status === "missing"
							? plugin.i18n.translate(
									"settings.integrations.jiraMapping.preview.missing"
								)
							: entry.status === "invalid"
								? plugin.i18n.translate(
										"settings.integrations.jiraMapping.preview.invalid"
									)
								: formatPreviewValue(entry.value),
				});
			}

			const raw = serializeJiraIssuePreview(sampleIssue);
			const details = previewContainer.createEl("details", {
				cls: "tasknotes-jira-mapping-preview__raw",
			});
			details.open = rawExpanded;
			details.addEventListener("toggle", () => {
				rawExpanded = details.open;
			});
			details.createEl("summary", {
				text: plugin.i18n.translate(
					"settings.integrations.jiraMapping.preview.rawJson"
				),
			});
			details.createDiv({
				cls: "setting-item-description",
				text: plugin.i18n.translate(
					"settings.integrations.jiraMapping.preview.rawJsonDescription"
				),
			});
			const rawToolbar = details.createDiv(
				"tasknotes-jira-mapping-preview__raw-toolbar"
			);
			const copyButton = rawToolbar.createEl("button", {
				cls: "clickable-icon",
				attr: {
					type: "button",
					"aria-label": plugin.i18n.translate(
						"settings.integrations.jiraMapping.preview.copyRawJson"
					),
				},
			});
			setIcon(copyButton, "copy");
			copyButton.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				// Copy the complete payload even when the on-screen preview is truncated.
				void navigator.clipboard
					.writeText(JSON.stringify(sampleIssue, null, 2))
					.then(() => {
						new Notice(
							plugin.i18n.translate(
								"settings.integrations.jiraMapping.preview.copySuccess"
							)
						);
					})
					.catch(() => {
						new Notice(
							plugin.i18n.translate(
								"settings.integrations.jiraMapping.preview.copyFailure"
							)
						);
					});
			});
			// Jira content is untrusted; textContent keeps markup inert in the settings DOM.
			details.createEl("pre", { text: raw.text });
			if (raw.truncated) {
				details.createDiv({
					cls: "setting-item-description",
					text: plugin.i18n.translate(
						"settings.integrations.jiraMapping.preview.truncated"
					),
				});
			}
		};
		refreshPreview();

		const saveAndRefreshPreview = (): void => {
			save();
			refreshPreview();
		};

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
				saveAndRefreshPreview,
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
					saveAndRefreshPreview,
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
				saveAndRefreshPreview();
			}
		);
		renderEnumRemapSetting(
			container,
			"Priority",
			"One mapping per line: TaskNotes value = Jira value, alternate Jira value.",
			remaps.priority,
			(value) => {
				remaps.priority = value;
				saveAndRefreshPreview();
			}
		);
		renderEnumRemapSetting(
			container,
			"Contexts",
			"Context mappings are applied after all configured list sources are merged.",
			remaps.contexts,
			(value) => {
				remaps.contexts = value;
				saveAndRefreshPreview();
			}
		);
	};

	render();
}
