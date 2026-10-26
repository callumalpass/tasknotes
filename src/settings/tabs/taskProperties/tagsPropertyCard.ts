import { msg } from "@lingui/core/macro";
import TaskNotesPlugin from "../../../main";
import {
	createCard,
	createCardInput,
	CardRow,
} from "../../components/CardComponent";
import { createNLPTriggerRows, createPropertyDescription, TranslateFn } from "./helpers";

/**
 * Renders the Tags property card (special - uses native Obsidian tags, no property key)
 */
export function renderTagsPropertyCard(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: TranslateFn
): void {
	const defaultInput = createCardInput(
		"text",
		translate(msg({ message: "important, urgent", context: "settings.defaults.basicDefaults.defaultTags.placeholder" })),
		plugin.settings.taskCreationDefaults.defaultTags
	);

	defaultInput.addEventListener("change", () => {
		plugin.settings.taskCreationDefaults.defaultTags = defaultInput.value;
		save();
	});

	const nlpRows = createNLPTriggerRows(plugin, "tags", "#", save, translate);

	// Create description element
	const descriptionEl = createPropertyDescription(
		translate(msg({ message: "Native Obsidian tags for categorizing tasks. These are stored in the tags frontmatter property and work with Obsidian''s tag features.", context: "settings.taskProperties.properties.tags.description" }))
	);

	const rows: CardRow[] = [
		{ label: "", input: descriptionEl, fullWidth: true },
		{ label: translate(msg({ message: "Default:", context: "settings.taskProperties.propertyCard.default" })), input: defaultInput },
		...nlpRows,
	];

	createCard(container, {
		id: "property-tags",
		collapsible: true,
		defaultCollapsed: true,
		header: {
			primaryText: translate(msg({ message: "Tags", context: "settings.taskProperties.properties.tags.name" })),
			secondaryText: translate(msg({ message: "Uses native Obsidian tags", context: "settings.taskProperties.tagsCard.nativeObsidianTags" })),
		},
		content: {
			sections: [{ rows }],
		},
	});
}
