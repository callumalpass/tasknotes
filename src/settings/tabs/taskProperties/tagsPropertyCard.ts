import TaskNotesPlugin from "../../../main";
import {
	createCard,
	createCardInput,
	CardRow,
} from "../../components/CardComponent";
import { createNLPTriggerRows, TranslateFn } from "./helpers";

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
		translate("settings.defaults.basicDefaults.defaultTags.placeholder"),
		plugin.settings.taskCreationDefaults.defaultTags
	);

	defaultInput.addEventListener("change", () => {
		plugin.settings.taskCreationDefaults.defaultTags = defaultInput.value;
		save();
	});

	const nlpRows = createNLPTriggerRows(plugin, "tags", "#", save, translate);

	const rows: CardRow[] = [
		{ label: translate("settings.taskProperties.propertyCard.default"), input: defaultInput },
		...nlpRows,
	];

	createCard(container, {
		id: "property-tags",
		collapsible: true,
		defaultCollapsed: true,
		header: {
			primaryText: translate("settings.taskProperties.properties.tags.name"),
			secondaryText: translate("settings.taskProperties.tagsCard.nativeObsidianTags"),
		},
		content: {
			sections: [{ rows }],
		},
	});
}
