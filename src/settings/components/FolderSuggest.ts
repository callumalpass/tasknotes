/**
 * Folder suggestion component for settings inputs
 *
 * Provides autocomplete for vault folder paths.
 * Used in settings where users need to select a folder (e.g., person notes folder).
 */

import { App, AbstractInputSuggest, TFolder, setIcon } from "obsidian";

/**
 * Folder suggestion provider using AbstractInputSuggest
 */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	private input: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.input = inputEl;
	}

	protected getSuggestions(query: string): TFolder[] {
		const folders = this.app.vault
			.getAllLoadedFiles()
			.filter((f): f is TFolder => f instanceof TFolder);

		const lowerQuery = query.toLowerCase().trim();

		if (!lowerQuery) {
			// Show root-level folders when empty
			return folders
				.filter((f) => !f.path.includes("/"))
				.sort((a, b) => a.path.localeCompare(b.path))
				.slice(0, 20);
		}

		// Filter and sort by relevance
		return folders
			.filter((folder) => folder.path.toLowerCase().includes(lowerQuery))
			.sort((a, b) => {
				// Prefer folders that start with the query
				const aStarts = a.path.toLowerCase().startsWith(lowerQuery);
				const bStarts = b.path.toLowerCase().startsWith(lowerQuery);
				if (aStarts && !bStarts) return -1;
				if (!aStarts && bStarts) return 1;

				// Then by path depth (shorter paths first)
				const aDepth = a.path.split("/").length;
				const bDepth = b.path.split("/").length;
				if (aDepth !== bDepth) return aDepth - bDepth;

				// Finally alphabetically
				return a.path.localeCompare(b.path);
			})
			.slice(0, 20);
	}

	public renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.addClass("folder-suggestion-item");

		// Create folder icon
		const iconEl = el.createSpan("folder-suggestion-icon");
		setIcon(iconEl, "folder");

		// Create text label with path
		el.createSpan({
			text: folder.path,
			cls: "folder-suggestion-text",
		});
	}

	public selectSuggestion(folder: TFolder): void {
		// Add trailing slash for clarity (indicates it's a folder path)
		this.input.value = folder.path + "/";
		this.input.dispatchEvent(new Event("change", { bubbles: true }));

		// Check if selected folder has subfolders
		const hasSubfolders = this.app.vault
			.getAllLoadedFiles()
			.some(
				(f) =>
					f instanceof TFolder &&
					f.path.startsWith(folder.path + "/") &&
					f.path !== folder.path
			);

		if (hasSubfolders) {
			// Keep dropdown open and refresh suggestions to show subfolders
			// Use setTimeout to allow the value to update first
			setTimeout(() => {
				this.input.dispatchEvent(new Event("input", { bubbles: true }));
			}, 0);
		} else {
			// No subfolders, close the dropdown
			this.input.dispatchEvent(new Event("input", { bubbles: true }));
			this.close();
		}
	}
}

/**
 * Creates a folder input with autosuggestion
 */
export function createFolderInput(
	app: App,
	placeholder: string,
	value?: string,
	onChange?: (value: string) => void
): { container: HTMLElement; input: HTMLInputElement } {
	const container = document.createElement("div");
	container.addClass("folder-input-container");

	// Create input
	const input = document.createElement("input");
	input.type = "text";
	input.addClass("tasknotes-settings__card-input");
	input.addClass("folder-input");
	input.placeholder = placeholder;
	if (value) {
		input.value = value;
	}
	container.appendChild(input);

	input.addEventListener("input", () => {
		if (onChange) {
			onChange(input.value);
		}
	});

	// Initialize suggester
	new FolderSuggest(app, input);

	return { container, input };
}
