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
		const storeTitleToggle = createCardToggle(
			plugin.settings.storeTitleInFilename,
			(value) => {
				plugin.settings.storeTitleInFilename = value;
				save();
				// Re-render the entire card to show/hide property key
				renderCard();
			}
		);

		// Create nested content for filename settings
		const nestedContainer = document.createElement("div");
		nestedContainer.addClass("tasknotes-settings__nested-content");
		renderFilenameSettingsContent(nestedContainer, plugin, save, translate);

		// Create description element
		const descriptionEl = createPropertyDescription(
			translate("settings.taskProperties.properties.title.description")
		);

		const rows: CardRow[] = [
			{ label: "", input: descriptionEl, fullWidth: true },
		];

		// Only show property key when NOT storing title in filename
		if (!plugin.settings.storeTitleInFilename) {
			rows.push({
				label: translate("settings.taskProperties.propertyCard.propertyKey"),
				input: propertyKeyInput,
			});
		}

		rows.push(
			{ label: translate("settings.taskProperties.titleCard.storeTitleInFilename"), input: storeTitleToggle },
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
			{ value: "title", label: translate("settings.appearance.taskFilenames.filenameFormat.options.title") },
			{ value: "zettel", label: translate("settings.appearance.taskFilenames.filenameFormat.options.zettel") },
			{ value: "timestamp", label: translate("settings.appearance.taskFilenames.filenameFormat.options.timestamp") },
			{ value: "custom", label: translate("settings.appearance.taskFilenames.filenameFormat.options.custom") },
		],
		plugin.settings.taskFilenameFormat
	);
	formatSelect.addEventListener("change", () => {
		plugin.settings.taskFilenameFormat = formatSelect.value as "title" | "zettel" | "timestamp" | "custom";
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
		templateInput.style.width = "100%";

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
				warningEl.style.color = "var(--text-warning)";
				warningEl.style.marginTop = "8px";
				warningEl.style.display = "flex";
				warningEl.style.alignItems = "flex-start";
				warningEl.style.gap = "6px";

				const iconEl = warningEl.createSpan();
				setIcon(iconEl, "alert-triangle");
				iconEl.style.flexShrink = "0";

				const textEl = warningEl.createSpan();
				textEl.textContent = translate("settings.taskProperties.titleCard.legacySyntaxWarning");
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
