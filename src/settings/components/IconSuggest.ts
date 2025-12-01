/**
 * Icon suggestion component for settings inputs
 *
 * Uses Obsidian's getIconIds() API to provide autosuggestion for Lucide icons.
 * Icons are displayed with a visual preview alongside the icon name.
 */

import { App, AbstractInputSuggest, getIconIds, setIcon } from "obsidian";

interface IconSuggestion {
	id: string;
	display: string;
}

/**
 * Icon suggestion provider using AbstractInputSuggest
 */
export class IconSuggest extends AbstractInputSuggest<IconSuggestion> {
	private input: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.input = inputEl;
	}

	protected getSuggestions(query: string): IconSuggestion[] {
		const icons = getIconIds();
		const lowerQuery = query.toLowerCase().trim();

		if (!lowerQuery) {
			// Show some common/popular icons when empty
			const popularIcons = [
				"check",
				"circle",
				"clock",
				"star",
				"flag",
				"alert-circle",
				"calendar",
				"bookmark",
				"play",
				"pause",
				"square",
				"x",
				"check-circle",
				"minus-circle",
				"plus-circle",
				"loader",
			];
			return popularIcons
				.filter((id) => icons.includes(id as any))
				.map((id) => ({
					id,
					display: id,
				}));
		}

		return icons
			.filter((icon) => icon.toLowerCase().includes(lowerQuery))
			.map((id) => ({
				id,
				display: id,
			}));
	}

	public renderSuggestion(suggestion: IconSuggestion, el: HTMLElement): void {
		el.addClass("icon-suggestion-item");

		// Create icon preview
		const iconEl = el.createSpan("icon-suggestion-preview");
		setIcon(iconEl, suggestion.id);

		// Create text label
		el.createSpan({
			text: suggestion.display,
			cls: "icon-suggestion-text",
		});
	}

	public selectSuggestion(suggestion: IconSuggestion): void {
		this.input.value = suggestion.id;
		this.input.dispatchEvent(new Event("input", { bubbles: true }));
		this.input.dispatchEvent(new Event("change", { bubbles: true }));
		this.close();
	}
}

/**
 * Creates an icon input with autosuggestion and live preview
 */
export function createIconInput(
	app: App,
	placeholder: string,
	value?: string,
	onChange?: (value: string) => void
): { container: HTMLElement; input: HTMLInputElement } {
	const container = document.createElement("div");
	container.addClass("icon-input-container");

	// Create preview element
	const preview = document.createElement("span");
	preview.addClass("icon-input-preview");
	container.appendChild(preview);

	// Create input
	const input = document.createElement("input");
	input.type = "text";
	input.addClass("tasknotes-settings__card-input");
	input.addClass("icon-input");
	input.placeholder = placeholder;
	if (value) {
		input.value = value;
		setIcon(preview, value);
		preview.style.display = "flex";
	}
	container.appendChild(input);

	// Update preview on input change
	const updatePreview = () => {
		const iconName = input.value.trim();
		if (iconName && getIconIds().includes(iconName as any)) {
			preview.empty();
			setIcon(preview, iconName);
			preview.style.display = "flex";
		} else {
			preview.style.display = "none";
		}
	};

	input.addEventListener("input", () => {
		updatePreview();
		if (onChange) {
			onChange(input.value);
		}
	});

	// Initialize suggester
	new IconSuggest(app, input);

	return { container, input };
}
