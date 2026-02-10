import {
	App,
	SuggestModal,
	TAbstractFile,
	TFile,
	parseFrontMatterAliases,
	Notice,
} from "obsidian";
import type TaskNotesPlugin from "../main";

export type FileSelectorResult =
	| { type: "selected"; file: TAbstractFile }
	| { type: "created"; file: TFile }
	| { type: "cancelled" };

export interface FileSelectorOptions {
	/** Callback when a file is selected or created */
	onResult: (result: FileSelectorResult) => void;
	/** Optional placeholder text */
	placeholder?: string;
	/** Optional title */
	title?: string;
	/** Filter to apply to files (default: markdown files only) */
	filter?: "markdown" | "all" | ((file: TAbstractFile) => boolean);
	/** Folder to create new files in (default: vault root) */
	newFileFolder?: string;
}

/**
 * A generic file selector modal that allows users to:
 * 1. Select an existing file from a fuzzy search
 * 2. Create a new file by pressing Shift+Enter
 */
export class FileSelectorModal extends SuggestModal<TAbstractFile> {
	private plugin: TaskNotesPlugin;
	private options: FileSelectorOptions;
	private currentQuery: string = "";
	private resultHandled: boolean = false;
	private createFooterEl: HTMLElement | null = null;

	constructor(
		app: App,
		plugin: TaskNotesPlugin,
		options: FileSelectorOptions
	) {
		super(app);
		this.plugin = plugin;
		this.options = options;

		// Set placeholder
		this.setPlaceholder(
			options.placeholder || "Search files or type to create new..."
		);

		// Set instructions
		this.setInstructions([
			{ command: "↑↓", purpose: "to navigate" },
			{ command: "↵", purpose: "to select" },
			{ command: "⇧↵", purpose: "to create new" },
			{ command: "esc", purpose: "to cancel" },
		]);

		// Set modal title
		if (options.title) {
			this.titleEl.setText(options.title);
		}

		// Add classes for styling
		this.containerEl.addClass("file-selector-modal");
		this.containerEl.addClass("tasknotes-plugin");
	}

	onOpen(): void {
		super.onOpen();

		// Register Shift+Enter for creating new file
		this.scope.register(["Shift"], "Enter", (e: KeyboardEvent) => {
			e.preventDefault();
			e.stopPropagation();
			this.createNewFile();
			return false;
		});

		// Track input changes for the footer preview
		this.inputEl.addEventListener("input", this.handleInputChange);

		// Create footer after DOM is ready.
		// SuggestModal builds its DOM asynchronously, so we defer to the next tick.
		setTimeout(() => this.createFooter(), 0);
	}

	private handleInputChange = (): void => {
		this.currentQuery = this.inputEl.value.trim();
		this.updateCreateFooter();
	};

	private createFooter(): void {
		const promptEl = this.modalEl.querySelector(".prompt");
		if (!promptEl) return;

		this.createFooterEl = promptEl.parentElement?.createDiv({
			cls: "file-selector-create-footer",
		}) || null;

		if (this.createFooterEl) {
			this.createFooterEl.style.display = "none";
		}
	}

	private updateCreateFooter(): void {
		if (!this.createFooterEl) return;

		if (!this.currentQuery) {
			this.createFooterEl.style.display = "none";
			return;
		}

		this.createFooterEl.empty();
		this.createFooterEl.style.display = "flex";

		// Content
		const contentDiv = this.createFooterEl.createDiv({
			cls: "file-selector-create-footer__content",
		});

		// Title line
		const titleLine = contentDiv.createDiv({
			cls: "file-selector-create-footer__title-line",
		});

		const shortcut = titleLine.createSpan({
			cls: "file-selector-create-footer__shortcut",
			text: "⇧↵",
		});

		titleLine.createSpan({
			cls: "file-selector-create-footer__hint-text",
			text: " to create: ",
		});

		titleLine.createSpan({
			cls: "file-selector-create-footer__filename",
			text: this.getNewFileName(),
		});
	}

	private getNewFileName(): string {
		let name = this.currentQuery;
		// Remove .md extension if user typed it
		if (name.toLowerCase().endsWith(".md")) {
			name = name.slice(0, -3);
		}
		return name + ".md";
	}

	private async createNewFile(): Promise<void> {
		if (!this.currentQuery) {
			new Notice("Please enter a file name");
			return;
		}

		try {
			let fileName = this.currentQuery;
			// Remove .md extension if user typed it (we'll add it back)
			if (fileName.toLowerCase().endsWith(".md")) {
				fileName = fileName.slice(0, -3);
			}

			// Determine the folder
			const folderPath = this.options.newFileFolder || "";
			const filePath = folderPath
				? `${folderPath}/${fileName}.md`
				: `${fileName}.md`;

			// Check if file already exists
			const existingFile = this.app.vault.getAbstractFileByPath(filePath);
			if (existingFile) {
				new Notice(`File "${filePath}" already exists`);
				return;
			}

			// Ensure folder exists (check on-disk via adapter, not in-memory cache)
			if (folderPath && !(await this.app.vault.adapter.exists(folderPath))) {
				await this.app.vault.createFolder(folderPath);
			}

			// Create the file
			const newFile = await this.app.vault.create(filePath, "");

			this.resultHandled = true;
			this.close();
			this.options.onResult({ type: "created", file: newFile });
		} catch (error) {
			console.error("Error creating file:", error);
			new Notice("Failed to create file");
		}
	}

	getSuggestions(query: string): TAbstractFile[] {
		this.currentQuery = query.trim();
		this.updateCreateFooter();

		const allFiles = this.app.vault.getAllLoadedFiles();
		const lowerQuery = query.toLowerCase();

		// Apply filter
		let filtered: TAbstractFile[];
		const filter = this.options.filter || "markdown";

		if (typeof filter === "function") {
			filtered = allFiles.filter(filter);
		} else if (filter === "markdown") {
			filtered = allFiles.filter(
				(file) =>
					file instanceof TFile &&
					file.extension === "md" &&
					!file.path.includes(".trash")
			);
		} else {
			filtered = allFiles.filter(
				(file) =>
					file instanceof TFile && !file.path.includes(".trash")
			);
		}

		// Filter by query
		if (!query) {
			return filtered.slice(0, 50); // Limit initial results
		}

		return filtered
			.filter((file) => {
				const searchText = this.getSearchText(file).toLowerCase();
				return searchText.includes(lowerQuery);
			})
			.slice(0, 50);
	}

	private getSearchText(file: TAbstractFile): string {
		let text = `${file.name} ${file.path}`;

		if (file instanceof TFile) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter) {
				// Add title
				const titleField = this.plugin.fieldMapper.toUserField("title");
				const title = cache.frontmatter[titleField];
				if (title) {
					text += ` ${title}`;
				}

				// Add aliases
				const aliases = parseFrontMatterAliases(cache.frontmatter);
				if (aliases && aliases.length > 0) {
					text += ` ${aliases.join(" ")}`;
				}
			}
		}

		return text;
	}

	renderSuggestion(file: TAbstractFile, el: HTMLElement): void {
		const container = el.createDiv({ cls: "file-selector-suggestion" });

		// File name
		container.createDiv({
			cls: "file-selector-suggestion__name",
			text: file.name,
		});

		// Title or aliases (for markdown files)
		if (file instanceof TFile) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter) {
				const titleField = this.plugin.fieldMapper.toUserField("title");
				const title = cache.frontmatter[titleField];

				if (title) {
					container.createDiv({
						cls: "file-selector-suggestion__title",
						text: title,
					});
				} else {
					const aliases = parseFrontMatterAliases(cache.frontmatter);
					if (aliases && aliases.length > 0) {
						container.createDiv({
							cls: "file-selector-suggestion__aliases",
							text: aliases.join(", "),
						});
					}
				}
			}
		}

		// Path (if not in root)
		if (file.parent && file.parent.path !== "/") {
			container.createDiv({
				cls: "file-selector-suggestion__path",
				text: file.parent.path,
			});
		}
	}

	onChooseSuggestion(file: TAbstractFile, evt: MouseEvent | KeyboardEvent): void {
		this.resultHandled = true;
		this.options.onResult({ type: "selected", file });
	}

	onClose(): void {
		this.inputEl.removeEventListener("input", this.handleInputChange);

		if (this.createFooterEl) {
			this.createFooterEl.remove();
			this.createFooterEl = null;
		}

		// Obsidian's SuggestModal calls onClose() BEFORE onChooseSuggestion().
		// Defer the cancelled check to the next tick so onChooseSuggestion() can set resultHandled first.
		setTimeout(() => {
			if (!this.resultHandled) {
				this.options.onResult({ type: "cancelled" });
			}
		}, 0);

		super.onClose();
	}
}

/**
 * Helper function to open a file selector modal
 */
export function openFileSelector(
	plugin: TaskNotesPlugin,
	onChoose: (file: TAbstractFile | null) => void,
	options?: {
		placeholder?: string;
		title?: string;
		filter?: "markdown" | "all" | ((file: TAbstractFile) => boolean);
		newFileFolder?: string;
	}
): void {
	const modal = new FileSelectorModal(plugin.app, plugin, {
		placeholder: options?.placeholder,
		title: options?.title,
		filter: options?.filter,
		newFileFolder: options?.newFileFolder,
		onResult: (result) => {
			if (result.type === "selected" || result.type === "created") {
				onChoose(result.file);
			} else {
				onChoose(null);
			}
		},
	});
	modal.open();
}
