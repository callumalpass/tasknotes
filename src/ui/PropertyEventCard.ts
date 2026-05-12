import { setIcon } from "obsidian";
import type { BasesEntry, BasesPropertyId, BasesViewConfig } from "obsidian";
import TaskNotesPlugin from "../main";
import { isEmptyCardDisplayValue, renderBasesValue } from "./taskCardPresentation";

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

	const card = activeDocument.createElement("div");
	card.className = "task-card task-card--property-event";

	const file = entry.file;
	if (!file) {
		card.textContent = plugin.i18n.translate("ui.propertyEventCard.unknownFile");
		return card;
	}

	(card as any).dataset.key = `property-${file.path}`;
	card.dataset.filePath = file.path;

	// Main row
	const mainRow = card.createEl("div", { cls: "task-card__main-row" });

	// Left indicator area: file icon
	const leftIconWrap = mainRow.createEl("span", { cls: "property-event-card__icon" });
	const leftIcon = leftIconWrap.createDiv();
	setIcon(leftIcon, "file-text");

	// Styling for icon area
	leftIconWrap.classList.remove(
		"tn-static-display-block-2a1b75c9",
		"tn-static-display-flex-4d51fc62",
		"tn-static-display-flex-75816cae",
		"tn-static-display-flex-8bb39979",
		"tn-static-display-inline-block-60e32dcb",
		"tn-static-display-inline-cccfa456",
		"tn-static-display-none-6b99de8b",
		"tn-static-min-height-800px-997b4c8c"
	);
	leftIconWrap.classList.add("tn-static-display-inline-flex-f984c520");
	leftIconWrap.classList.remove(
		"tn-static-width-100-0466783d",
		"tn-static-width-12px-fbf353fb",
		"tn-static-width-1px-aa77e27e",
		"tn-static-width-200px-2acaf3b5",
		"tn-static-width-60px-bd09c419",
		"tn-static-width-80px-8573bae3"
	);
	leftIconWrap.classList.add("tn-static-width-16px-7375d50b");
	leftIconWrap.classList.remove(
		"tn-static-display-flex-4d51fc62",
		"tn-static-height-0-7a31cef0",
		"tn-static-height-100-62264068",
		"tn-static-height-12px-06c0747e",
		"tn-static-height-24px-29a11d37",
		"tn-static-min-height-800px-997b4c8c"
	);
	leftIconWrap.classList.add("tn-static-height-16px-30de4aee");
	leftIconWrap.classList.remove("tn-static-margin-right-4px-c6b76b85");
	leftIconWrap.classList.add("tn-static-margin-right-8px-539fa9a0");
	leftIconWrap.classList.remove(
		"tn-static-align-items-baseline-4b95b5c7",
		"tn-static-align-items-flex-start-0486f781"
	);
	leftIconWrap.classList.add("tn-static-align-items-center-7c619740");
	leftIconWrap.classList.remove(
		"tn-static-justify-content-flex-end-455f8cca",
		"tn-static-justify-content-space-between-a562f4fd"
	);
	leftIconWrap.classList.add("tn-static-justify-content-center-03c4bb6f");
	leftIconWrap.classList.add("tn-static-flex-shrink-0-6ee0661e");
	leftIcon.classList.remove(
		"tn-static-width-12px-fbf353fb",
		"tn-static-width-16px-7375d50b",
		"tn-static-width-1px-aa77e27e",
		"tn-static-width-200px-2acaf3b5",
		"tn-static-width-60px-bd09c419",
		"tn-static-width-80px-8573bae3"
	);
	leftIcon.classList.add("tn-static-width-100-0466783d");
	leftIcon.classList.remove(
		"tn-static-display-flex-4d51fc62",
		"tn-static-height-0-7a31cef0",
		"tn-static-height-12px-06c0747e",
		"tn-static-height-16px-30de4aee",
		"tn-static-height-24px-29a11d37",
		"tn-static-min-height-800px-997b4c8c"
	);
	leftIcon.classList.add("tn-static-height-100-62264068");
	leftIcon.classList.remove(
		"tn-static-color-var-text-accent-65b47ee3",
		"tn-static-color-var-text-muted-5872de20",
		"tn-static-color-var-text-on-accent-f3e1679d",
		"tn-static-color-var-text-warning-783d5f03",
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
	leftIcon.classList.add("tn-static-color-var-color-accent-d2cad743");

	// Content
	const content = mainRow.createEl("div", { cls: "task-card__content" });

	// Title
	content.createEl("div", {
		cls: "task-card__title",
		text: file.basename || file.name,
	});

	// Metadata line: show visible properties from Bases view
	if (opts.showProperties && viewConfig) {
		const metadata = content.createEl("div", { cls: "task-card__metadata" });
		let renderedProperties = 0;

		try {
			const doc = metadata.ownerDocument;
			// Get visible properties from Bases view configuration
			const visibleProperties = viewConfig.getOrder?.() || [];

			// Get date property IDs to skip
			const startDatePropertyId = viewConfig.getAsPropertyId?.("startDateProperty");
			const endDatePropertyId = viewConfig.getAsPropertyId?.("endDateProperty");

			// Show all non-date visible properties
			for (const propertyId of visibleProperties) {
				// Skip the properties used for calendar dates (start/end)
				if (propertyId === startDatePropertyId || propertyId === endDatePropertyId) {
					continue;
				}

				// Get property value from Bases entry
				const value = entry.getValue(propertyId as BasesPropertyId);

				if (!isEmptyCardDisplayValue(value)) {
					if (renderedProperties > 0) {
						metadata.appendChild(doc.createTextNode(" • "));
					}

					// Get user-friendly property name
					const displayName =
						viewConfig.getDisplayName(propertyId as BasesPropertyId) || propertyId;

					const propertyEl = metadata.createSpan({
						cls: "property-event-card__metadata-property",
					});
					propertyEl.createSpan({ text: `${displayName}: ` });
					const valueEl = propertyEl.createSpan({
						cls: "property-event-card__metadata-value",
					});
					renderBasesValue(valueEl, value, plugin.app.renderContext);

					renderedProperties++;
				}
			}
		} catch (error) {
			console.debug("[TaskNotes][PropertyEventCard] Error reading properties:", error);
		}

		if (renderedProperties === 0) {
			// Fallback: show file path if no properties
			metadata.textContent = file.path;
		}
	}

	// Click handler to open file
	card.addEventListener("click", (e) => {
		const openInNewTab = e.ctrlKey || e.metaKey;
		plugin.app.workspace.openLinkText(file.path, "", openInNewTab);
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
