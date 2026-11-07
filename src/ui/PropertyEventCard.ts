import { uiText } from "../i18n/runtime";
import { msg } from "@lingui/core/macro";
import { setIcon } from "obsidian";
import type { BasesEntry, BasesViewConfig } from "obsidian";
import TaskNotesPlugin from "../main";
import { isEmptyCardDisplayValue, renderBasesValue } from "./taskCardPresentation";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import { fitTaskCardMetadata } from "./taskCardMetadata";

const tasknotesLogger = createTaskNotesLogger({ tag: "Ui/PropertyEventCard" });

export interface PropertyEventCardOptions {
	showProperties: boolean;
}

export const DEFAULT_PROPERTY_EVENT_CARD_OPTIONS: PropertyEventCardOptions = {
	showProperties: true,
};

/**
 * Create a property-based event card for Bases calendar list view
 * Shows file title and Bases properties configured as visible in the view
 */
export function createPropertyEventCard(
	entry: BasesEntry,
	plugin: TaskNotesPlugin,
	viewConfig?: BasesViewConfig,
	options: Partial<PropertyEventCardOptions> = {}
): HTMLElement {
	const opts = { ...DEFAULT_PROPERTY_EVENT_CARD_OPTIONS, ...options };

	const card = activeWindow.createDiv();
	card.className = "task-card task-card--property-event";

	const file = entry.file;
	if (!file) {
		card.textContent = plugin.i18n.translate(
			msg({ message: "Unknown file", context: "ui.propertyEventCard.unknownFile" })
		);
		return card;
	}

	card.dataset.key = `property-${file.path}`;
	card.dataset.filePath = file.path;

	// Main row
	const mainRow = card.createDiv({ cls: "task-card__main-row" });

	// File icon in the status glyph's place
	setIcon(mainRow.createSpan({ cls: "property-event-card__icon" }), "file-text");

	// Content
	const content = mainRow.createDiv({ cls: "task-card__content" });

	// Title
	content.createDiv({ cls: "task-card__title" }).createSpan({
		cls: "task-card__title-text",
		text: file.basename || file.name,
	});

	// Metadata line: show visible properties from Bases view
	if (opts.showProperties && viewConfig) {
		const metadata = content.createDiv({ cls: "task-card__metadata" });
		const values = metadata.createSpan({ cls: "task-card__metadata-values" });
		let renderedProperties = 0;

		try {
			// Get visible properties from Bases view configuration
			const visibleProperties = viewConfig.getOrder?.() || [];

			// Get date property IDs to skip
			const startDatePropertyId =
				viewConfig.getAsPropertyId?.("startDateProperty") ??
				viewConfig.get("startDateProperty");
			const endDatePropertyId =
				viewConfig.getAsPropertyId?.("endDateProperty") ??
				viewConfig.get("endDateProperty");

			// Show all non-date visible properties
			for (const propertyId of visibleProperties) {
				// Skip the properties used for calendar dates (start/end)
				if (propertyId === startDatePropertyId || propertyId === endDatePropertyId) {
					continue;
				}

				// Get property value from Bases entry
				const value = entry.getValue(propertyId);

				if (!isEmptyCardDisplayValue(value)) {
					// Get user-friendly property name
					const displayName = viewConfig.getDisplayName(propertyId) || propertyId;

					const propertyEl = values.createSpan({
						cls: "property-event-card__metadata-property task-card__metadata-property",
					});
					propertyEl.createSpan({
						text: uiText(
							msg({
								message: "{displayName}: ",
								context: "ui/PropertyEventCard: createPropertyEventCard text",
							}),
							{ displayName: displayName }
						),
					});
					const valueEl = propertyEl.createSpan({
						cls: "property-event-card__metadata-value",
					});
					renderBasesValue(valueEl, value, plugin.app.renderContext);

					renderedProperties++;
				}
			}
		} catch (error) {
			tasknotesLogger.debug("[TaskNotes][PropertyEventCard] Error reading properties:", {
				category: "persistence",
				operation: "reading-properties",
				error: error,
			});
		}

		if (renderedProperties === 0) {
			// Fallback: show file path if no properties
			values.createSpan({ text: file.path });
		}
		fitTaskCardMetadata(values, metadata);
	}

	// Click handler to open file
	card.addEventListener("click", (e) => {
		const openInNewTab = e.ctrlKey || e.metaKey;
		void plugin.app.workspace.openLinkText(file.path, "", openInNewTab);
	});

	// Hover preview
	card.addEventListener("mouseover", (event) => {
		plugin.app.workspace.trigger("hover-link", {
			event,
			source: "tasknotes-property-event-card",
			hoverParent: card,
			targetEl: card,
			linktext: file.path,
			sourcePath: file.path,
		});
	});

	// Apply accent color
	card.setCssProps({ "--current-status-color": "var(--color-accent)" });

	return card;
}
