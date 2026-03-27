/**
 * Property key suggestion component for settings inputs
 *
 * Provides autocomplete for frontmatter property names found across the vault.
 * Uses a simple dropdown rendered inside the modal (avoids AbstractInputSuggest
 * z-index/focus issues with Obsidian modals).
 */

import { App } from "obsidian";

/**
 * Attach property key autocomplete to an input element.
 * Renders a dropdown list below the input inside the same container.
 */
export class PropertySuggest {
	private app: App;
	private input: HTMLInputElement;
	private dropdown: HTMLElement | null = null;
	private allKeys: string[] = [];
	private keysLoaded = false;

	constructor(app: App, inputEl: HTMLInputElement) {
		this.app = app;
		this.input = inputEl;

		this.input.addEventListener("input", () => this.onInput());
		this.input.addEventListener("focus", () => this.onInput());
		this.input.addEventListener("blur", () => {
			// Delay to allow click on dropdown item
			setTimeout(() => this.closeDropdown(), 200);
		});
	}

	private loadKeys(): void {
		if (this.keysLoaded) return;
		const keys = new Set<string>();
		for (const file of this.app.vault.getMarkdownFiles()) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter) {
				for (const key of Object.keys(cache.frontmatter)) {
					if (key !== "position") keys.add(key);
				}
			}
		}
		this.allKeys = [...keys].sort();
		this.keysLoaded = true;
	}

	private onInput(): void {
		this.loadKeys();
		const query = this.input.value.toLowerCase().trim();

		const matches = query
			? this.allKeys
				.filter((k) => k.toLowerCase().includes(query))
				.sort((a, b) => {
					const aStarts = a.toLowerCase().startsWith(query);
					const bStarts = b.toLowerCase().startsWith(query);
					if (aStarts && !bStarts) return -1;
					if (!aStarts && bStarts) return 1;
					return a.localeCompare(b);
				})
				.slice(0, 20)
			: this.allKeys.slice(0, 20);

		if (matches.length === 0 || (matches.length === 1 && matches[0] === this.input.value)) {
			this.closeDropdown();
			return;
		}

		this.renderDropdown(matches);
	}

	private renderDropdown(items: string[]): void {
		this.closeDropdown();

		const dropdown = document.createElement("div");
		dropdown.className = "suggestion-container";
		// Position below the input, left-aligned, matching input width
		const inputRect = this.input.getBoundingClientRect();
		const modalEl = this.input.closest(".modal") as HTMLElement;
		const modalRect = modalEl?.getBoundingClientRect() || { left: 0, top: 0 };
		dropdown.style.cssText =
			`position: absolute; z-index: 1000; background: var(--background-secondary); ` +
			`border: 1px solid var(--background-modifier-border); border-radius: 6px; ` +
			`max-height: 200px; overflow-y: auto; box-shadow: var(--shadow-s); ` +
			`left: ${inputRect.left - modalRect.left}px; ` +
			`top: ${inputRect.bottom - modalRect.top}px; ` +
			`width: ${inputRect.width}px;`;

		for (const item of items) {
			const option = dropdown.createDiv({ cls: "suggestion-item" });
			option.style.cssText =
				"padding: 6px 10px; cursor: pointer; font-size: var(--font-ui-small);";
			option.textContent = item;

			option.addEventListener("mousedown", (e) => {
				e.preventDefault(); // Prevent blur
				this.input.value = item;
				this.input.dispatchEvent(new Event("input", { bubbles: true }));
				this.input.dispatchEvent(new Event("change", { bubbles: true }));
				this.closeDropdown();
				this.input.focus();
			});

			option.addEventListener("mouseenter", () => {
				option.style.background = "var(--background-modifier-hover)";
			});
			option.addEventListener("mouseleave", () => {
				option.style.background = "";
			});
		}

		// Append to modal so absolute positioning is relative to modal
		if (modalEl) {
			modalEl.style.position = "relative";
			modalEl.appendChild(dropdown);
		}

		this.dropdown = dropdown;
	}

	private closeDropdown(): void {
		if (this.dropdown) {
			this.dropdown.remove();
			this.dropdown = null;
		}
	}
}
