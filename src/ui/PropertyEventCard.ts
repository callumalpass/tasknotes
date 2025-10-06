import { TFile, setIcon } from "obsidian";
import TaskNotesPlugin from "../main";

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
	entry: any, // BasesEntry from Bases
	plugin: TaskNotesPlugin,
	viewConfig?: any, // BasesViewConfig
	options: Partial<PropertyEventCardOptions> = {}
): HTMLElement {
	const opts = { ...DEFAULT_PROPERTY_EVENT_CARD_OPTIONS, ...options };

	const card = document.createElement("div");
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
	leftIconWrap.style.display = "inline-flex";
	leftIconWrap.style.width = "16px";
	leftIconWrap.style.height = "16px";
	leftIconWrap.style.marginRight = "8px";
	leftIconWrap.style.alignItems = "center";
	leftIconWrap.style.justifyContent = "center";
	leftIconWrap.style.flexShrink = "0";
	leftIcon.style.width = "100%";
	leftIcon.style.height = "100%";
	leftIcon.style.color = "var(--color-accent)";

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
		const parts: string[] = [];

		try {
			// Get visible properties from Bases view configuration
			const visibleProperties = viewConfig.getOrder?.() || [];

			// Get date property IDs to skip
			const startDatePropertyId = viewConfig.getAsPropertyId?.('startDateProperty');
			const endDatePropertyId = viewConfig.getAsPropertyId?.('endDateProperty');

			// Show all non-date visible properties
			for (const propertyId of visibleProperties) {
				// Skip the properties used for calendar dates (start/end)
				if (propertyId === startDatePropertyId || propertyId === endDatePropertyId) {
					continue;
				}

				// Get property value from Bases entry
				const value = entry.getValue?.(propertyId);

				if (value && value.data !== null && value.data !== undefined) {
					// Get user-friendly property name
					const displayName = viewConfig.getDisplayName?.(propertyId) || propertyId;

					// Format the value
					let displayValue = String(value.data);

					// Truncate long values
					if (displayValue.length > 30) {
						displayValue = displayValue.substring(0, 27) + "...";
					}

					parts.push(`${displayName}: ${displayValue}`);
				}
			}
		} catch (error) {
			console.debug("[TaskNotes][PropertyEventCard] Error reading properties:", error);
		}

		if (parts.length > 0) {
			metadata.textContent = parts.join(" • ");
		} else {
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
	card.style.setProperty("--current-status-color", "var(--color-accent)");

	return card;
}
