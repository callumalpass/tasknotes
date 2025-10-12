import type { TranslationKey } from "../../i18n";
import type { FileFilterConfig } from "../../suggest/FileSuggestHelper";
import { createCardInput } from "./CardComponent";

/**
 * Creates filter settings inputs (tags, folders, property key/value)
 * Reusable across project autosuggest and custom field filters
 */
export function createFilterSettingsInputs(
	container: HTMLElement,
	currentConfig: FileFilterConfig | undefined,
	onChange: (updated: FileFilterConfig) => void,
	translate: (key: TranslationKey) => string
): void {
	const config = currentConfig || {
		requiredTags: [],
		includeFolders: [],
		propertyKey: "",
		propertyValue: "",
	};

	// Helper to update config and trigger onChange
	const updateConfig = (updates: Partial<FileFilterConfig>) => {
		onChange({ ...config, ...updates });
	};

	// Required Tags input
	const tagsInput = createCardInput(
		"text",
		translate("settings.appearance.projectAutosuggest.requiredTags.placeholder"),
		config.requiredTags?.join(", ") || ""
	);
	tagsInput.addEventListener("change", () => {
		const tags = tagsInput.value
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean);
		updateConfig({ requiredTags: tags });
	});

	// Include Folders input
	const foldersInput = createCardInput(
		"text",
		translate("settings.appearance.projectAutosuggest.includeFolders.placeholder"),
		config.includeFolders?.join(", ") || ""
	);
	foldersInput.addEventListener("change", () => {
		const folders = foldersInput.value
			.split(",")
			.map((f) => f.trim())
			.filter(Boolean);
		updateConfig({ includeFolders: folders });
	});

	// Property Key input
	const keyInput = createCardInput(
		"text",
		translate("settings.appearance.projectAutosuggest.requiredPropertyKey.placeholder"),
		config.propertyKey || ""
	);
	keyInput.addEventListener("change", () => {
		updateConfig({ propertyKey: keyInput.value.trim() });
	});

	// Property Value input
	const valueInput = createCardInput(
		"text",
		translate("settings.appearance.projectAutosuggest.requiredPropertyValue.placeholder"),
		config.propertyValue || ""
	);
	valueInput.addEventListener("change", () => {
		updateConfig({ propertyValue: valueInput.value.trim() });
	});

	// Create rows
	const createRow = (label: string, input: HTMLElement) => {
		const row = container.createDiv("tasknotes-settings__card-config-row");
		const labelEl = row.createSpan("tasknotes-settings__card-config-label");
		labelEl.textContent = label;
		row.appendChild(input);
	};

	createRow(translate("settings.appearance.projectAutosuggest.requiredTags.name"), tagsInput);
	createRow(
		translate("settings.appearance.projectAutosuggest.includeFolders.name"),
		foldersInput
	);
	createRow(
		translate("settings.appearance.projectAutosuggest.requiredPropertyKey.name"),
		keyInput
	);
	createRow(
		translate("settings.appearance.projectAutosuggest.requiredPropertyValue.name"),
		valueInput
	);
}

