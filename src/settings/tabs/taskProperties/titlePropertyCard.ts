import { setIcon } from "obsidian";
import TaskNotesPlugin from "../../../main";
import {
	createCard,
	createCardInput,
	createCardSelect,
	createCardToggle,
	CardRow,
} from "../../components/CardComponent";
import { createPropertyDescription, TranslateFn } from "./helpers";

/**
 * Renders the Title property card with filename settings
 */
export function renderTitlePropertyCard(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: TranslateFn
): void {
	// Create a wrapper for the card so we can re-render it
	const cardWrapper = container.createDiv();
	// Track collapse state across re-renders
	let isCollapsed = true;

	function renderCard(): void {
		cardWrapper.empty();

		const propertyKeyInput = createCardInput(
			"text",
			"title",
			plugin.settings.fieldMapping.title
		);

		propertyKeyInput.addEventListener("change", () => {
			plugin.settings.fieldMapping.title = propertyKeyInput.value;
			save();
		});

		// Store title in filename toggle
		const storeTitleToggle = createCardToggle(plugin.settings.storeTitleInFilename, (value) => {
			plugin.settings.storeTitleInFilename = value;
			save();
			// Re-render the entire card to show/hide property key
			renderCard();
		});

		// Create nested content for filename settings
		const nestedContainer = activeDocument.createElement("div");
		nestedContainer.addClass("tasknotes-settings__nested-content");
		renderFilenameSettingsContent(nestedContainer, plugin, save, translate);

		// Create description element
		const descriptionEl = createPropertyDescription(
			translate("settings.taskProperties.properties.title.description")
		);

		const rows: CardRow[] = [{ label: "", input: descriptionEl, fullWidth: true }];

		// Only show property key when NOT storing title in filename
		if (!plugin.settings.storeTitleInFilename) {
			rows.push({
				label: translate("settings.taskProperties.propertyCard.propertyKey"),
				input: propertyKeyInput,
			});
		}

		rows.push(
			{
				label: translate("settings.taskProperties.titleCard.storeTitleInFilename"),
				input: storeTitleToggle,
			},
			{ label: "", input: nestedContainer, fullWidth: true }
		);

		createCard(cardWrapper, {
			id: "property-title",
			collapsible: true,
			defaultCollapsed: isCollapsed,
			onCollapseChange: (collapsed) => {
				isCollapsed = collapsed;
			},
			header: {
				primaryText: translate("settings.taskProperties.properties.title.name"),
				secondaryText: plugin.settings.storeTitleInFilename
					? translate("settings.taskProperties.titleCard.storedInFilename")
					: plugin.settings.fieldMapping.title,
			},
			content: {
				sections: [{ rows }],
			},
		});
	}

	renderCard();
}

/**
 * Renders the filename settings content inside the title card
 */
function renderFilenameSettingsContent(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: TranslateFn
): void {
	container.empty();

	// Only show filename format settings when storeTitleInFilename is off
	if (plugin.settings.storeTitleInFilename) {
		container.createDiv({
			text: translate("settings.taskProperties.titleCard.filenameUpdatesWithTitle"),
			cls: "setting-item-description",
		});
		return;
	}

	// Filename format dropdown
	const formatContainer = container.createDiv("tasknotes-settings__card-config-row");
	formatContainer.createSpan({
		text: translate("settings.taskProperties.titleCard.filenameFormat"),
		cls: "tasknotes-settings__card-config-label",
	});

	const formatSelect = createCardSelect(
		[
			{
				value: "title",
				label: translate("settings.appearance.taskFilenames.filenameFormat.options.title"),
			},
			{
				value: "zettel",
				label: translate("settings.appearance.taskFilenames.filenameFormat.options.zettel"),
			},
			{
				value: "timestamp",
				label: translate(
					"settings.appearance.taskFilenames.filenameFormat.options.timestamp"
				),
			},
			{
				value: "custom",
				label: translate("settings.appearance.taskFilenames.filenameFormat.options.custom"),
			},
		],
		plugin.settings.taskFilenameFormat
	);
	formatSelect.addEventListener("change", () => {
		plugin.settings.taskFilenameFormat = formatSelect.value as
			| "title"
			| "zettel"
			| "timestamp"
			| "custom";
		save();
		renderFilenameSettingsContent(container, plugin, save, translate);
	});
	formatContainer.appendChild(formatSelect);

	// Custom template input (shown only when format is custom)
	if (plugin.settings.taskFilenameFormat === "custom") {
		const templateContainer = container.createDiv("tasknotes-settings__card-config-row");
		templateContainer.createSpan({
			text: translate("settings.taskProperties.titleCard.customTemplate"),
			cls: "tasknotes-settings__card-config-label",
		});

		const templateInput = createCardInput(
			"text",
			translate("settings.appearance.taskFilenames.customTemplate.placeholder"),
			plugin.settings.customFilenameTemplate
		);
		templateInput.classList.remove(
			"tn-static-width-12px-fbf353fb",
			"tn-static-width-16px-7375d50b",
			"tn-static-width-1px-aa77e27e",
			"tn-static-width-200px-2acaf3b5",
			"tn-static-width-60px-bd09c419",
			"tn-static-width-80px-8573bae3"
		);
		templateInput.classList.add("tn-static-width-100-0466783d");

		// Warning container for legacy syntax
		const warningContainer = container.createDiv();

		const updateWarning = () => {
			warningContainer.empty();
			// Check for single-brace syntax that isn't part of double-brace
			// Match {word} but not {{word}}
			// Avoid lookbehind for iOS compatibility (iOS < 16.4 doesn't support lookbehind)
			const template = templateInput.value;
			// First check if there are any single braces at all
			const singleBracePattern = /\{[a-zA-Z]+\}/g;
			const doubleBracePattern = /\{\{[a-zA-Z]+\}\}/g;
			// Remove all double-brace patterns, then check for remaining single-brace
			const withoutDoubleBraces = template.replace(doubleBracePattern, "");
			const hasLegacySyntax = singleBracePattern.test(withoutDoubleBraces);

			if (hasLegacySyntax) {
				const warningEl = warningContainer.createDiv({
					cls: "setting-item-description mod-warning",
				});
				warningEl.classList.remove(
					"tn-static-color-var-color-accent-d2cad743",
					"tn-static-color-var-text-accent-65b47ee3",
					"tn-static-color-var-text-muted-5872de20",
					"tn-static-color-var-text-on-accent-f3e1679d",
					"tn-static-color-var-tn-text-muted-a90fb6f3",
					"tn-static-color-white-0a43e56a",
					"tn-static-cursor-pointer-2723efcc",
					"tn-static-font-size-12px-65574819",
					"tn-static-font-weight-bold-0fe8c30d",
					"tn-static-font-weight-bold-e0b452bd",
					"tn-static-margin-2px-0-edce9b14",
					"tn-static-padding-20px-7a035d95",
					"tn-static-padding-20px-ebe8e48c"
				);
				warningEl.classList.add("tn-static-color-var-text-warning-783d5f03");
				warningEl.classList.remove(
					"tn-static-font-size-12px-b0cc7e05",
					"tn-static-margin-top-0-5rem-3dc98b5e",
					"tn-static-margin-top-0-d462248a",
					"tn-static-margin-top-12px-91e0f558",
					"tn-static-margin-top-16px-1b0f4999",
					"tn-static-margin-top-1rem-2239d6d5",
					"tn-static-margin-top-20px-a26bda7d",
					"tn-static-margin-top-30px-2fbbbcd4",
					"tn-static-margin-top-4px-96ad6099",
					"tn-static-margin-top-8px-f4f01e68"
				);
				warningEl.classList.add("tn-static-margin-top-8px-8a77e5a3");
				warningEl.classList.remove(
					"tn-static-display-block-2a1b75c9",
					"tn-static-display-flex-4d51fc62",
					"tn-static-display-flex-8bb39979",
					"tn-static-display-inline-block-60e32dcb",
					"tn-static-display-inline-cccfa456",
					"tn-static-display-inline-flex-f984c520",
					"tn-static-display-none-6b99de8b",
					"tn-static-min-height-800px-997b4c8c"
				);
				warningEl.classList.add("tn-static-display-flex-75816cae");
				warningEl.classList.remove(
					"tn-static-align-items-baseline-4b95b5c7",
					"tn-static-align-items-center-7c619740"
				);
				warningEl.classList.add("tn-static-align-items-flex-start-0486f781");
				warningEl.classList.remove(
					"tn-static-display-flex-8bb39979",
					"tn-static-gap-0-5rem-ce2fca4d",
					"tn-static-gap-10px-f3d7ce77",
					"tn-static-gap-12px-ed7b3d87",
					"tn-static-gap-8px-33fcd4c3"
				);
				warningEl.classList.add("tn-static-gap-6px-f0abc1db");

				const iconEl = warningEl.createSpan();
				setIcon(iconEl, "alert-triangle");
				iconEl.classList.add("tn-static-flex-shrink-0-6ee0661e");

				const textEl = warningEl.createSpan();
				textEl.textContent = translate(
					"settings.taskProperties.titleCard.legacySyntaxWarning"
				);
			}
		};

		templateInput.addEventListener("change", () => {
			plugin.settings.customFilenameTemplate = templateInput.value;
			save();
			updateWarning();
		});
		templateInput.addEventListener("input", updateWarning);
		templateContainer.appendChild(templateInput);

		// Help text for template variables
		container.createDiv({
			text: translate("settings.appearance.taskFilenames.customTemplate.helpText"),
			cls: "setting-item-description",
		});

		// Initial warning check
		updateWarning();
	}
}
