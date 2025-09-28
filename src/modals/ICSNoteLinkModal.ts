import {
	App,
	FuzzySuggestModal,
	TAbstractFile,
	TFile,
	SearchResult,
	parseFrontMatterAliases,
} from "obsidian";
import type TaskNotesPlugin from "../main";

/**
 * Modal for selecting notes to link to ICS events using fuzzy search
 * Based on the existing ProjectSelectModal pattern
 */
export class ICSNoteLinkModal extends FuzzySuggestModal<TAbstractFile> {
	private onChoose: (file: TAbstractFile) => void;
	private plugin: TaskNotesPlugin;

	constructor(app: App, plugin: TaskNotesPlugin, onChoose: (file: TAbstractFile) => void) {
		super(app);
		this.plugin = plugin;
		this.onChoose = onChoose;
		this.setPlaceholder("Type to search for notes to link...");
		this.setInstructions([
			{ command: "↑↓", purpose: "to navigate" },
			{ command: "↵", purpose: "to select" },
			{ command: "esc", purpose: "to cancel" },
		]);
	}

	getItems(): TAbstractFile[] {
		return this.app.vault
			.getAllLoadedFiles()
			.filter(
				(file) =>
					file instanceof TFile &&
					file.extension === "md" &&
					!file.path.includes(".trash")
			);
	}

	getItemText(file: TAbstractFile): string {
		let text = `${file.name} ${file.path}`;

		// Add aliases to searchable text
		if (file instanceof TFile) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter) {
				const aliases = parseFrontMatterAliases(cache.frontmatter);
				if (aliases && aliases.length > 0) {
					text += ` ${aliases.join(" ")}`;
				}
			}
		}

		return text;
	}

	renderSuggestion(value: { item: TAbstractFile; match: SearchResult }, el: HTMLElement) {
		const file = value.item;
		el.empty();

		const container = el.createDiv({ cls: "ics-note-link-suggestion" });

		// File name (main line)
		const nameEl = container.createSpan({ cls: "note-link-name" });
		nameEl.textContent = file.name;

		// Title or aliases (second line)
		if (file instanceof TFile) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter) {
				const titleField = this.plugin.fieldMapper.toUserField("title");
				const title = cache.frontmatter[titleField];

				if (title) {
					const titleEl = container.createDiv({ cls: "note-link-title" });
					titleEl.textContent = title;
				} else {
					const aliases = parseFrontMatterAliases(cache.frontmatter);
					if (aliases && aliases.length > 0) {
						const aliasEl = container.createDiv({ cls: "note-link-aliases" });
						aliasEl.textContent = aliases.join(", ");
					}
				}
			}
		}

		// File path (if different from name)
		if (file.path !== file.name) {
			const pathEl = container.createDiv({ cls: "note-link-path" });
			pathEl.textContent = file.path;
		}
	}

	onChooseItem(file: TAbstractFile, evt: MouseEvent | KeyboardEvent) {
		this.onChoose(file);
	}
}
