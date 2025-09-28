import { GroupCountUtils } from "../utils/GroupCountUtils";
import { SavedView } from "../types";
import TaskNotesPlugin from "../main";

/**
 * Utility class for creating and managing filter heading displays
 * Shows the current saved view name and completion count
 */
export class FilterHeading {
	private container: HTMLElement;
	private headingElement: HTMLElement | null = null;
	private countElement: HTMLElement | null = null;
	private dividerElement: HTMLElement | null = null;
	private instanceId: string;
	private plugin: TaskNotesPlugin;

	constructor(container: HTMLElement, plugin: TaskNotesPlugin) {
		this.container = container;
		this.plugin = plugin;
		this.instanceId = "fh-" + Math.random().toString(36).substr(2, 9);
		this.render();
	}

	/**
	 * Render the filter heading structure
	 */
	private render(): void {
		// Create main heading container
		const headingContainer = this.container.createDiv("filter-heading");

		// Create heading content wrapper
		const headingContent = headingContainer.createDiv("filter-heading__content");

		// View name element
		this.headingElement = headingContent.createEl("h2", {
			cls: "filter-heading__title",
			text: this.plugin.i18n.translate("ui.filterHeading.allViewName"),
		});

		// Count element
		this.countElement = headingContent.createDiv(
			"filter-heading__count agenda-view__item-count"
		);

		// Divider line
		this.dividerElement = headingContainer.createDiv("filter-heading__divider");
	}

	/**
	 * Update the heading with current filter information
	 */
	update(activeSavedView: SavedView | null, completed: number, total: number): void {
		if (!this.headingElement || !this.countElement) return;

		// Update view name
		const viewName =
			activeSavedView?.name || this.plugin.i18n.translate("ui.filterHeading.allViewName");
		this.headingElement.textContent = viewName;

		// Update count
		const countText = GroupCountUtils.formatGroupCount(completed, total).text;
		this.countElement.textContent = countText;
	}

	/**
	 * Remove the filter heading from the DOM
	 */
	destroy(): void {
		const headingContainer = this.container.querySelector(".filter-heading");
		if (headingContainer) {
			headingContainer.remove();
		}
	}
}
