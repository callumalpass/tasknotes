import { Notice } from "obsidian";
import TaskNotesPlugin from "../../../main";
import { FieldMapping } from "../../../types";
import type { TranslationKey } from "../../../i18n";
import {
	createCard,
	createCardInput,
	createCardSelect,
	createCardNumberInput,
	createCardToggle,
	CardRow,
} from "../../components/CardComponent";

// ===== TYPES =====

export type TranslateFn = (key: TranslationKey, params?: Record<string, string | number>) => string;

export interface NLPTriggerConfig {
	propertyId: string;
	enabled: boolean;
	trigger: string;
}

export interface SimplePropertyCardConfig {
	propertyId: keyof FieldMapping;
	displayName: string;
	description?: string;
	hasDefault?: boolean;
	defaultType?: "text" | "number" | "dropdown" | "date-preset";
	defaultPlaceholder?: string;
	defaultOptions?: Array<{ value: string; label: string }>;
	getDefaultValue?: () => string;
	setDefaultValue?: (value: string) => void;
	hasNLPTrigger?: boolean;
	nlpDefaultTrigger?: string;
}

// ===== NLP TRIGGER HELPERS =====

/**
 * Gets the NLP trigger configuration for a property
 */
export function getNLPTrigger(
	plugin: TaskNotesPlugin,
	propertyId: string,
	defaultTrigger: string
): NLPTriggerConfig {
	const triggerConfig = plugin.settings.nlpTriggers.triggers.find(
		(t) => t.propertyId === propertyId
	);
	return {
		propertyId,
		enabled: triggerConfig?.enabled ?? (propertyId !== "priority"), // priority disabled by default
		trigger: triggerConfig?.trigger || defaultTrigger,
	};
}

/**
 * Updates the NLP trigger configuration for a property
 */
export function updateNLPTrigger(
	plugin: TaskNotesPlugin,
	propertyId: string,
	updates: Partial<{ enabled: boolean; trigger: string }>,
	defaultTrigger: string,
	save: () => void
): void {
	const index = plugin.settings.nlpTriggers.triggers.findIndex(
		(t) => t.propertyId === propertyId
	);
	if (index !== -1) {
		if (updates.enabled !== undefined) {
			plugin.settings.nlpTriggers.triggers[index].enabled = updates.enabled;
		}
		if (updates.trigger !== undefined) {
			plugin.settings.nlpTriggers.triggers[index].trigger = updates.trigger;
		}
	} else {
		plugin.settings.nlpTriggers.triggers.push({
			propertyId,
			trigger: updates.trigger ?? defaultTrigger,
			enabled: updates.enabled ?? true,
		});
	}
	save();
}

/**
 * Creates NLP trigger input rows for a property card
 */
export function createNLPTriggerRows(
	plugin: TaskNotesPlugin,
	propertyId: string,
	defaultTrigger: string,
	save: () => void,
	translate: TranslateFn,
	onRerender?: () => void
): CardRow[] {
	const config = getNLPTrigger(plugin, propertyId, defaultTrigger);

	const triggerToggle = createCardToggle(config.enabled, (enabled) => {
		updateNLPTrigger(plugin, propertyId, { enabled }, defaultTrigger, save);
		if (onRerender) onRerender();
	});

	const rows: CardRow[] = [
		{
			label: translate("settings.taskProperties.propertyCard.nlpTrigger"),
			input: triggerToggle,
		},
	];

	if (config.enabled) {
		const triggerInput = createCardInput("text", defaultTrigger, config.trigger);
		triggerInput.style.width = "80px";
		triggerInput.addEventListener("change", () => {
			const value = triggerInput.value;
			if (value.trim().length === 0) {
				new Notice(translate("settings.taskProperties.propertyCard.triggerEmpty"));
				return;
			}
			if (value.length > 10) {
				new Notice(translate("settings.taskProperties.propertyCard.triggerTooLong"));
				return;
			}
			updateNLPTrigger(plugin, propertyId, { trigger: value }, defaultTrigger, save);
		});
		rows.push({
			label: translate("settings.taskProperties.propertyCard.triggerChar"),
			input: triggerInput,
		});
	}

	return rows;
}

// ===== SIMPLE PROPERTY CARD =====

/**
 * Renders a simple property card (property key + optional default + optional NLP trigger)
 */
export function renderSimplePropertyCard(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: TranslateFn,
	config: SimplePropertyCardConfig
): void {
	const propertyKeyInput = createCardInput(
		"text",
		config.propertyId,
		plugin.settings.fieldMapping[config.propertyId]
	);

	propertyKeyInput.addEventListener("change", () => {
		plugin.settings.fieldMapping[config.propertyId] = propertyKeyInput.value;
		save();
	});

	const rows: CardRow[] = [
		{ label: translate("settings.taskProperties.propertyCard.propertyKey"), input: propertyKeyInput },
	];

	// Add default value input if configured
	if (config.hasDefault && config.getDefaultValue && config.setDefaultValue) {
		let defaultInput: HTMLElement;

		if (config.defaultType === "dropdown" || config.defaultType === "date-preset") {
			defaultInput = createCardSelect(config.defaultOptions || [], config.getDefaultValue());
			(defaultInput as HTMLSelectElement).addEventListener("change", () => {
				config.setDefaultValue!((defaultInput as HTMLSelectElement).value);
			});
		} else if (config.defaultType === "number") {
			defaultInput = createCardNumberInput(0, undefined, 1, parseInt(config.getDefaultValue()) || 0);
			defaultInput.addEventListener("change", () => {
				config.setDefaultValue!((defaultInput as HTMLInputElement).value);
			});
		} else {
			defaultInput = createCardInput("text", config.defaultPlaceholder || "", config.getDefaultValue());
			defaultInput.addEventListener("change", () => {
				config.setDefaultValue!((defaultInput as HTMLInputElement).value);
			});
		}

		rows.push({
			label: translate("settings.taskProperties.propertyCard.default"),
			input: defaultInput,
		});
	}

	// Add NLP trigger if configured
	if (config.hasNLPTrigger && config.nlpDefaultTrigger) {
		const nlpRows = createNLPTriggerRows(
			plugin,
			config.propertyId,
			config.nlpDefaultTrigger,
			save,
			translate
		);
		rows.push(...nlpRows);
	}

	createCard(container, {
		id: `property-${config.propertyId}`,
		collapsible: true,
		defaultCollapsed: true,
		header: {
			primaryText: config.displayName,
			secondaryText: plugin.settings.fieldMapping[config.propertyId],
		},
		content: {
			sections: [{ rows }],
		},
	});
}

// ===== METADATA PROPERTY CARD =====

/**
 * Renders a metadata-only property card (just property key)
 */
export function renderMetadataPropertyCard(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: TranslateFn,
	propertyId: keyof FieldMapping,
	displayName: string,
	_description?: string
): void {
	const propertyKeyInput = createCardInput(
		"text",
		propertyId,
		plugin.settings.fieldMapping[propertyId]
	);

	propertyKeyInput.addEventListener("change", () => {
		plugin.settings.fieldMapping[propertyId] = propertyKeyInput.value;
		save();
	});

	createCard(container, {
		id: `property-${propertyId}`,
		collapsible: true,
		defaultCollapsed: true,
		header: {
			primaryText: displayName,
			secondaryText: plugin.settings.fieldMapping[propertyId],
		},
		content: {
			sections: [{
				rows: [
					{ label: translate("settings.taskProperties.propertyCard.propertyKey"), input: propertyKeyInput },
				],
			}],
		},
	});
}
