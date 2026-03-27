/**
 * Tag suggestion component for settings inputs
 *
 * Provides autocomplete for vault tags.
 * Used in settings where users need to select a single tag (e.g., person tag filter).
 * Note: This is different from TaskModal's TagSuggest which handles comma-separated lists.
 */

import { App, AbstractInputSuggest, setIcon } from "obsidian";

/**
 * Tag suggestion provider using AbstractInputSuggest
 * Returns tags without the # prefix
 */
export class TagSuggest extends AbstractInputSuggest<string> {
	private input: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.input = inputEl;
	}

	protected getSuggestions(query: string): string[] {
		// Get all tags from metadata cache
		const tagCounts = this.app.metadataCache.getTags() || {};
		const tags = Object.keys(tagCounts)
			.map((t) => t.replace(/^#/, "")) // Remove # prefix
			.filter((t) => t.length > 0);

		// Remove # from query if user typed it
		const lowerQuery = query.toLowerCase().trim().replace(/^#/, "");

		if (!lowerQuery) {
			// Show popular tags when empty (sorted by count)
			return Object.entries(tagCounts)
				.sort(([, a], [, b]) => (b as number) - (a as number))
				.slice(0, 20)
				.map(([tag]) => tag.replace(/^#/, ""));
		}

		// Filter and sort by relevance
		return tags
			.filter((tag) => tag.toLowerCase().includes(lowerQuery))
			.sort((a, b) => {
				// Prefer tags that start with the query
				const aStarts = a.toLowerCase().startsWith(lowerQuery);
				const bStarts = b.toLowerCase().startsWith(lowerQuery);
				if (aStarts && !bStarts) return -1;
				if (!aStarts && bStarts) return 1;

				// Then by popularity (tag count)
				const aCount = tagCounts[`#${a}`] || 0;
				const bCount = tagCounts[`#${b}`] || 0;
				if (aCount !== bCount) return (bCount as number) - (aCount as number);

				// Finally alphabetically
				return a.localeCompare(b);
			})
			.slice(0, 20);
	}

	public renderSuggestion(tag: string, el: HTMLElement): void {
		el.addClass("tag-suggestion-item");

		// Create tag icon
		const iconEl = el.createSpan("tag-suggestion-icon");
		setIcon(iconEl, "hash");

		// Create text label with # prefix for display
		el.createSpan({
			text: tag,
			cls: "tag-suggestion-text",
		});
	}

	public selectSuggestion(tag: string): void {
		// Store without # prefix
		this.input.value = tag.replace(/^#/, "");
		this.input.dispatchEvent(new Event("input", { bubbles: true }));
		this.input.dispatchEvent(new Event("change", { bubbles: true }));
		this.close();
	}
}

/**
 * Creates a tag input with autosuggestion
 */
export function createTagInput(
	app: App,
	placeholder: string,
	value?: string,
	onChange?: (value: string) => void
): { container: HTMLElement; input: HTMLInputElement } {
	const container = document.createElement("div");
	container.addClass("tag-input-container");

	// Create input
	const input = document.createElement("input");
	input.type = "text";
	input.addClass("tasknotes-settings__card-input");
	input.addClass("tag-input");
	input.placeholder = placeholder;
	if (value) {
		input.value = value;
	}
	container.appendChild(input);

	input.addEventListener("input", () => {
		// Strip # if user types it
		const cleaned = input.value.replace(/^#/, "");
		if (input.value !== cleaned) {
			input.value = cleaned;
		}
		if (onChange) {
			onChange(cleaned);
		}
	});

	// Initialize suggester
	new TagSuggest(app, input);

	return { container, input };
}
