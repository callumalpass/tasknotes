import {
	App,
	Notice,
	setIcon,
	AbstractInputSuggest,
	setTooltip,
	parseFrontMatterAliases,
	TFile,
} from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskModal } from "./TaskModal";
import { TaskInfo, TaskCreationData, TaskDependency } from "../types";
import { getCurrentTimestamp } from "../utils/dateUtils";
import { generateTaskFilename, FilenameContext } from "../utils/filenameGenerator";
import { calculateDefaultDate, sanitizeTags } from "../utils/helpers";
import {
	NaturalLanguageParser,
	ParsedTaskData as NLParsedTaskData,
} from "../services/NaturalLanguageParser";
// StatusSuggestion kept for backward compatibility with old NLPSuggest
export interface StatusSuggestion {
	value: string;
	label: string;
	display: string;
	type: "status";
	toString(): string;
}
import { combineDateAndTime } from "../utils/dateUtils";
import { splitListPreservingLinksAndQuotes } from "../utils/stringSplit";
import { ProjectMetadataResolver, ProjectEntry } from "../utils/projectMetadataResolver";
import { parseDisplayFieldsRow } from "../utils/projectAutosuggestDisplayFieldsParser";
import { EmbeddableMarkdownEditor } from "../editor/EmbeddableMarkdownEditor";
import { createNLPAutocomplete } from "../editor/NLPCodeMirrorAutocomplete";


export interface TaskCreationOptions {
	prePopulatedValues?: Partial<TaskInfo>;
	onTaskCreated?: (task: TaskInfo) => void;
}

/**
 * Auto-suggestion provider for NLP textarea with @, #, and + triggers
 * @ = contexts, # = tags, + = wikilinks to vault files
 */
interface ProjectSuggestion {
	basename: string;
	displayName: string;
	type: "project";
	toString(): string;
}

interface TagSuggestion {
	value: string;
	display: string;
	type: "tag";
	toString(): string;
}

interface ContextSuggestion {
	value: string;
	display: string;
	type: "context";
	toString(): string;
}

class NLPSuggest extends AbstractInputSuggest<
	TagSuggestion | ContextSuggestion | ProjectSuggestion | StatusSuggestion
> {
	private plugin: TaskNotesPlugin;
	private textarea: HTMLTextAreaElement;
	private currentTrigger: "@" | "#" | "+" | "status" | null = null;
	// Store app reference explicitly to avoid relying on plugin.app in tests and runtime
	private obsidianApp: App;
	// Cache ProjectMetadataResolver to avoid recreating it for each suggestion
	private projectMetadataResolver: ProjectMetadataResolver | null = null;

	constructor(app: App, textareaEl: HTMLTextAreaElement, plugin: TaskNotesPlugin) {
		super(app, textareaEl as unknown as HTMLInputElement);
		this.plugin = plugin;
		this.textarea = textareaEl;
		this.obsidianApp = app;
	}

	/**
	 * Helper: Check if index is at a word boundary
	 */
	private isBoundary(textBeforeCursor: string, index: number): boolean {
		if (index === -1) return false;
		if (index === 0) return true;
		const prev = textBeforeCursor[index - 1];
		return !/\w/.test(prev);
	}

	/**
	 * Find the most recent valid trigger before cursor
	 */
	private findActiveTrigger(textBeforeCursor: string): {
		trigger: "@" | "#" | "+" | "status" | null;
		triggerIndex: number;
		queryAfterTrigger: string;
	} {
		const lastAtIndex = textBeforeCursor.lastIndexOf("@");
		const lastHashIndex = textBeforeCursor.lastIndexOf("#");
		const lastPlusIndex = textBeforeCursor.lastIndexOf("+");
		const statusTrig = (this.plugin.settings.statusSuggestionTrigger || "").trim();
		const lastStatusIndex = statusTrig ? textBeforeCursor.lastIndexOf(statusTrig) : -1;

		// Determine most recent valid trigger by index
		const candidates: Array<{ type: "@" | "#" | "+" | "status"; index: number }> = [
			{ type: "@" as const, index: lastAtIndex },
			{ type: "#" as const, index: lastHashIndex },
			{ type: "+" as const, index: lastPlusIndex },
			{ type: "status" as const, index: lastStatusIndex },
		].filter((c) => this.isBoundary(textBeforeCursor, c.index));

		if (candidates.length === 0) {
			return { trigger: null, triggerIndex: -1, queryAfterTrigger: "" };
		}

		candidates.sort((a, b) => b.index - a.index);
		const triggerIndex = candidates[0].index;
		const trigger = candidates[0].type;

		// Extract the query after the trigger (respect multi-char trigger for status)
		const offset = trigger === "status" ? statusTrig?.length || 0 : 1;
		const queryAfterTrigger = textBeforeCursor.slice(triggerIndex + offset);

		return { trigger, triggerIndex, queryAfterTrigger };
	}

	/**
	 * Check if the query context should end suggestion display
	 */
	private shouldEndSuggestionContext(
		trigger: "@" | "#" | "+" | "status",
		queryAfterTrigger: string
	): boolean {
		// If '+' trigger already has a completed wikilink (+[[...]]), do not suggest again
		if (trigger === "+" && /^\[\[[^\]]*\]\]/.test(queryAfterTrigger)) {
			return true;
		}

		// Check if there's a space in the query (which would end the suggestion context)
		// For '+' (projects/wikilinks), allow spaces for multi-word fuzzy queries
		if (
			(trigger === "@" || trigger === "#" || trigger === "status") &&
			(queryAfterTrigger.includes(" ") || queryAfterTrigger.includes("\n"))
		) {
			return true;
		}

		return false;
	}

	/**
	 * Get context suggestions
	 */
	private getContextSuggestions(query: string): ContextSuggestion[] {
		const contexts = this.plugin.cacheManager.getAllContexts();
		return contexts
			.filter((context) => context && typeof context === "string")
			.filter((context) =>
				context.toLowerCase().includes(query.toLowerCase())
			)
			.slice(0, 10)
			.map((context) => ({
				value: context,
				display: context,
				type: "context" as const,
				toString() {
					return this.value;
				},
			}));
	}

	/**
	 * Get status suggestions
	 */
	private getStatusSuggestions(query: string): StatusSuggestion[] {
		const parser = NaturalLanguageParser.fromPlugin(this.plugin);
		return parser.getStatusSuggestions(query, 10).map(s => ({
			...s,
			type: "status" as const,
			toString() {
				return this.value;
			},
		}));
	}

	/**
	 * Get tag suggestions
	 */
	private getTagSuggestions(query: string): TagSuggestion[] {
		const tags = this.plugin.cacheManager.getAllTags();
		return tags
			.filter((tag) => tag && typeof tag === "string")
			.filter((tag) => tag.toLowerCase().includes(query.toLowerCase()))
			.slice(0, 10)
			.map((tag) => ({
				value: tag,
				display: tag,
				type: "tag" as const,
				toString() {
					return this.value;
				},
			}));
	}

	/**
	 * Get or create the cached ProjectMetadataResolver
	 */
	private getProjectMetadataResolver(): ProjectMetadataResolver {
		if (!this.projectMetadataResolver) {
			const appRef: App | undefined =
				(this as any).obsidianApp ?? (this as any).app ?? this.plugin?.app;
			this.projectMetadataResolver = new ProjectMetadataResolver({
				getFrontmatter: (entry) => {
					const file = appRef?.vault.getAbstractFileByPath(entry.path);
					const cache = file
						? appRef?.metadataCache.getFileCache(file as any)
						: undefined;
					return cache?.frontmatter || {};
				},
			});
		}
		return this.projectMetadataResolver;
	}

	/**
	 * Get project suggestions (file-based)
	 */
	private async getProjectSuggestions(query: string): Promise<ProjectSuggestion[]> {
		// Use FileSuggestHelper for multi-word support with enhanced project autosuggest cards and |s flag support
		const { FileSuggestHelper } = await import("../suggest/FileSuggestHelper");

		// Apply excluded folders filter to FileSuggestHelper
		const excluded = (this.plugin.settings.excludedFolders || "")
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);

		// Get suggestions using FileSuggestHelper with explicit project filter configuration
		const list = await FileSuggestHelper.suggest(
			this.plugin,
			query,
			20,
			this.plugin.settings.projectAutosuggest
		);

		// Filter out excluded folders
		const appRef: App | undefined =
			(this as any).obsidianApp ?? (this as any).app ?? this.plugin?.app;
		const filteredList = list.filter((item) => {
			const file = appRef?.vault
				.getMarkdownFiles()
				.find((f) => f.basename === item.insertText);
			if (!file) return true;
			return !excluded.some((folder) => file.path.startsWith(folder));
		});

		try {
			// Use cached resolver instead of creating a new one
			const resolver = this.getProjectMetadataResolver();

			const rowConfigs = (this.plugin.settings?.projectAutosuggest?.rows ?? []).slice(0, 3);

			return filteredList.map((item) => {
				const file = appRef?.vault
					.getMarkdownFiles()
					.find((f) => f.basename === item.insertText);
				if (!file) {
					return {
						basename: item.insertText,
						displayName: item.displayText,
						type: "project" as const,
						toString() {
							return this.basename;
						},
					};
				}

				const cache = appRef?.metadataCache.getFileCache(file);
				const frontmatter = cache?.frontmatter || {};
				const mapped = this.plugin.fieldMapper.mapFromFrontmatter(
					frontmatter,
					file.path,
					this.plugin.settings.storeTitleInFilename
				);

				const title = typeof mapped.title === "string" ? mapped.title : "";
				const aliasesFm = parseFrontMatterAliases(frontmatter) || [];
				const aliases = Array.isArray(aliasesFm)
					? (aliasesFm.filter((a) => typeof a === "string") as string[])
					: [];

				const fileData = {
					basename: file.basename,
					name: file.name,
					path: file.path,
					parent: file.parent?.path || "",
					title,
					aliases,
					frontmatter: frontmatter,
				};

				const displayName = this.generateProjectDisplayName(rowConfigs, fileData, resolver, file.basename);

				return {
					basename: item.insertText,
					displayName: displayName,
					type: "project" as const,
					entry: {
						basename: fileData.basename,
						name: fileData.name,
						path: fileData.path,
						parent: fileData.parent,
						title: fileData.title,
						aliases: fileData.aliases,
						frontmatter: fileData.frontmatter,
					},
					toString() {
						return this.basename;
					},
				} as ProjectSuggestion;
			});
		} catch (err) {
			console.error(
				"Enhanced project autosuggest failed, falling back to basic suggestions",
				err
			);
			return filteredList.map((item) => ({
				basename: item.insertText,
				displayName: item.displayText,
				type: "project" as const,
				toString() {
					return this.basename;
				},
			}));
		}
	}

	/**
	 * Generate enhanced display name for project suggestions
	 */
	private generateProjectDisplayName(
		rows: string[],
		item: any,
		resolver: ProjectMetadataResolver,
		fallback: string
	): string {
		const lines: string[] = [];
		for (const row of rows) {
			try {
				const tokens = parseDisplayFieldsRow(row);
				const parts: string[] = [];
				for (const token of tokens) {
					if (token.property.startsWith("literal:")) {
						parts.push(token.property.slice(8));
						continue;
					}
					const value = resolver.resolve(token.property, item) || "";
					if (!value) continue;
					if (token.showName) {
						const label = token.displayName ?? token.property;
						parts.push(`${label}: ${value}`);
					} else {
						parts.push(value);
					}
				}
				const line = parts.join(" ");
				if (line.trim()) lines.push(line);
			} catch {
				// Skip invalid rows
			}
		}
		return lines.join(" | ") || fallback;
	}

	protected async getSuggestions(
		query: string
	): Promise<(TagSuggestion | ContextSuggestion | ProjectSuggestion | StatusSuggestion)[]> {
		// Get cursor position and text around it
		const cursorPos = this.textarea.selectionStart;
		const textBeforeCursor = this.textarea.value.slice(0, cursorPos);

		// Find the active trigger
		const { trigger, triggerIndex, queryAfterTrigger } = this.findActiveTrigger(textBeforeCursor);

		if (!trigger || triggerIndex === -1) {
			this.currentTrigger = null;
			return [];
		}

		// Check if we should end the suggestion context
		if (this.shouldEndSuggestionContext(trigger, queryAfterTrigger)) {
			this.currentTrigger = null;
			return [];
		}

		this.currentTrigger = trigger;

		// Get suggestions based on trigger type
		switch (trigger) {
			case "@":
				return this.getContextSuggestions(queryAfterTrigger);
			case "status":
				return this.getStatusSuggestions(queryAfterTrigger);
			case "#":
				return this.getTagSuggestions(queryAfterTrigger);
			case "+":
				return await this.getProjectSuggestions(queryAfterTrigger);
			default:
				return [];
		}
	}

	public renderSuggestion(
		suggestion: TagSuggestion | ContextSuggestion | ProjectSuggestion | StatusSuggestion,
		el: HTMLElement
	): void {
		// Add ARIA attributes for accessibility
		el.setAttribute("role", "option");
		// Get display text - ProjectSuggestion uses displayName, others use display
		const displayText = suggestion.type === "project"
			? (suggestion as ProjectSuggestion).displayName
			: (suggestion as TagSuggestion | ContextSuggestion | StatusSuggestion).display;
		el.setAttribute("aria-label", `${suggestion.type}: ${displayText}`);

		const icon = el.createSpan("nlp-suggest-icon");
		icon.textContent =
			this.currentTrigger === "status"
				? this.plugin.settings.statusSuggestionTrigger || ""
				: this.currentTrigger || "";
		icon.setAttribute("aria-hidden", "true");

		const text = el.createSpan("nlp-suggest-text");

		// Helper: highlight all occurrences (multi-word)
		const highlightOccurrences = (container: HTMLElement, query: string) => {
			if (!query) return;
			const words = query.toLowerCase().split(/\s+/).filter(Boolean);
			if (!words.length) return;
			const walk = (node: Node) => {
				if (node.nodeType === Node.TEXT_NODE) {
					const original = node.nodeValue || "";
					const lower = original.toLowerCase();
					const matches: Array<{ start: number; end: number }> = [];
					for (const w of words) {
						let idx = lower.indexOf(w);
						while (idx !== -1) {
							matches.push({ start: idx, end: idx + w.length });
							idx = lower.indexOf(w, idx + 1);
						}
					}
					matches.sort((a, b) => a.start - b.start);
					const filtered: typeof matches = [];
					for (const m of matches) {
						if (!filtered.length || m.start >= filtered[filtered.length - 1].end)
							filtered.push(m);
					}
					if (!filtered.length) return;
					const frag = document.createDocumentFragment();
					let last = 0;
					for (const m of filtered) {
						if (m.start > last)
							frag.appendChild(
								document.createTextNode(original.slice(last, m.start))
							);
						const mark = document.createElement("mark");
						mark.textContent = original.slice(m.start, m.end);
						frag.appendChild(mark);
						last = m.end;
					}
					if (last < original.length)
						frag.appendChild(document.createTextNode(original.slice(last)));
					node.parentNode?.replaceChild(frag, node);
				} else if (
					node.nodeType === Node.ELEMENT_NODE &&
					(node as Element).tagName !== "MARK"
				) {
					const children = Array.from(node.childNodes);
					for (const c of children) walk(c);
				}
			};
			walk(container);
		};

		// Determine active +query to highlight
		let activeQuery = "";
		if (this.currentTrigger === "+") {
			const cursorPos = this.textarea.selectionStart;
			const before = this.textarea.value.slice(0, cursorPos);
			const lastPlus = before.lastIndexOf("+");
			if (lastPlus !== -1) {
				const after = before.slice(lastPlus + 1);
				if (after && !after.includes("\n")) activeQuery = after.trim();
			}
		}

		if (suggestion.type === "project") {
			// Multi-line card: first line = filename, extra lines from config
			const filenameRow = text.createDiv({
				cls: "nlp-suggest-project__filename",
				text: suggestion.basename,
			});
			if (activeQuery) highlightOccurrences(filenameRow, activeQuery);

			const cfg = (this.plugin.settings?.projectAutosuggest?.rows ?? []).slice(0, 3);
			if (Array.isArray(cfg) && cfg.length > 0 && (suggestion as any).entry) {
				// Use cached resolver for rendering too
				const resolver = this.getProjectMetadataResolver();
				for (let i = 0; i < Math.min(cfg.length, 3); i++) {
					const row = cfg[i];
					if (!row) continue;
					try {
						const tokens = parseDisplayFieldsRow(row);
						const metaRow = text.createDiv({ cls: "nlp-suggest-project__meta" });
						const ALWAYS = new Set(["title", "aliases", "file.basename"]);
						let appended = false;
						for (const t of tokens) {
							if (t.property.startsWith("literal:")) {
								const lit = t.property.slice(8);
								if (lit) {
									if (metaRow.childNodes.length)
										metaRow.appendChild(document.createTextNode(" "));
									metaRow.appendChild(document.createTextNode(lit));
									appended = true;
								}
								continue;
							}
							const value = resolver.resolve(t.property, (suggestion as any).entry);
							if (!value) continue;
							if (metaRow.childNodes.length)
								metaRow.appendChild(document.createTextNode(" "));
							if (t.showName) {
								const labelSpan = document.createElement("span");
								labelSpan.className = "nlp-suggest-project__meta-label";
								labelSpan.textContent = `${t.displayName ?? t.property}:`;
								metaRow.appendChild(labelSpan);
								metaRow.appendChild(document.createTextNode(" "));
							}
							const valueSpan = document.createElement("span");
							valueSpan.className = "nlp-suggest-project__meta-value";
							valueSpan.textContent = value;
							metaRow.appendChild(valueSpan);
							appended = true;
							const searchable =
								(t as any).searchable === true || ALWAYS.has(t.property);
							if (activeQuery && searchable)
								highlightOccurrences(valueSpan, activeQuery);
						}
						if (!appended || metaRow.textContent?.trim().length === 0) metaRow.remove();
					} catch {
						/* ignore row parse errors */
					}
				}
			}
		} else if (suggestion.type === "status") {
			text.textContent = suggestion.display;
		} else {
			text.textContent = suggestion.display;
		}
	}

	public selectSuggestion(
		suggestion: TagSuggestion | ContextSuggestion | ProjectSuggestion | StatusSuggestion
	): void {
		if (!this.currentTrigger) return;

		const cursorPos = this.textarea.selectionStart;
		const textBeforeCursor = this.textarea.value.slice(0, cursorPos);
		const textAfterCursor = this.textarea.value.slice(cursorPos);

		// Find the last trigger position (handle custom status trigger length)
		let lastTriggerIndex = -1;
		const statusTrig = (this.plugin.settings.statusSuggestionTrigger || "").trim();
		if (this.currentTrigger === "@") {
			lastTriggerIndex = textBeforeCursor.lastIndexOf("@");
		} else if (this.currentTrigger === "#") {
			lastTriggerIndex = textBeforeCursor.lastIndexOf("#");
		} else if (this.currentTrigger === "+") {
			lastTriggerIndex = textBeforeCursor.lastIndexOf("+");
		} else if (this.currentTrigger === "status" && statusTrig) {
			lastTriggerIndex = textBeforeCursor.lastIndexOf(statusTrig);
		}

		if (lastTriggerIndex === -1) return;

		// Get the actual suggestion text to insert
		const suggestionText =
			suggestion.type === "project" ? suggestion.basename : suggestion.value;

		// Replace the trigger and partial text with the full suggestion
		const beforeTrigger = textBeforeCursor.slice(0, lastTriggerIndex);
		let replacement = "";

		if (this.currentTrigger === "+") {
			// For project (+) trigger, wrap in wikilink syntax but keep the + sign
			replacement = "+[[" + suggestionText + "]]";
		} else if (this.currentTrigger === "status") {
			// For status: insert the label text (like other suggestions)
			replacement = suggestion.type === "status" ? suggestion.label : suggestionText;
		} else {
			// For @ and #, keep the trigger and the suggestion
			replacement = this.currentTrigger + suggestionText;
		}

		const newText = beforeTrigger + replacement + (replacement ? " " : "") + textAfterCursor;

		this.textarea.value = newText;

		// Set cursor position after the inserted suggestion
		const newCursorPos = beforeTrigger.length + replacement.length + (replacement ? 1 : 0);
		this.textarea.setSelectionRange(newCursorPos, newCursorPos);

		// Trigger input event to update preview
		this.textarea.dispatchEvent(new Event("input", { bubbles: true }));
		this.textarea.focus();
	}
}

export class TaskCreationModal extends TaskModal {
	private options: TaskCreationOptions;
	private nlParser: NaturalLanguageParser;
	private nlInput: HTMLTextAreaElement; // Legacy - keeping for compatibility
	private nlMarkdownEditor: EmbeddableMarkdownEditor | null = null;
	private nlPreviewContainer: HTMLElement;
	private nlButtonContainer: HTMLElement;
	private nlpSuggest: NLPSuggest | null = null; // Will be replaced with CodeMirror autocomplete

	// Track event listeners for cleanup
	private eventListeners: Array<{
		element: HTMLElement | HTMLTextAreaElement;
		event: string;
		handler: EventListener;
	}> = [];

	constructor(
		app: App,
		plugin: TaskNotesPlugin,
		options: TaskCreationOptions = {}
	) {
		super(app, plugin);
		this.options = options;
		this.nlParser = NaturalLanguageParser.fromPlugin(plugin);
	}

	getModalTitle(): string {
		return this.t("modals.taskCreation.title");
	}

	protected isCreationMode(): boolean {
		return true;
	}

	/**
	 * Add an event listener and track it for cleanup
	 */
	private addTrackedEventListener(
		element: HTMLElement | HTMLTextAreaElement,
		event: string,
		handler: EventListener
	): void {
		element.addEventListener(event, handler);
		this.eventListeners.push({ element, event, handler });
	}

	/**
	 * Remove all tracked event listeners
	 */
	private removeAllEventListeners(): void {
		for (const { element, event, handler } of this.eventListeners) {
			element.removeEventListener(event, handler);
		}
		this.eventListeners = [];
	}

	protected createModalContent(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Create main container
		const container = contentEl.createDiv("minimalist-modal-container");

		// Create NLP input as primary interface (if enabled)
		if (this.plugin.settings.enableNaturalLanguageInput) {
			this.createNaturalLanguageInput(container);
		} else {
			// Fall back to regular title input
			this.createTitleInput(container);
			// When NLP is disabled, start with the modal expanded
			this.isExpanded = true;
			this.containerEl.addClass("expanded");
		}

		// Create action bar with icons
		this.createActionBar(container);

		// Create collapsible details section
		this.createDetailsSection(container);

		// Re-render projects list if pre-populated values were applied or defaults are set
		if (
			(this.options.prePopulatedValues && this.options.prePopulatedValues.projects) ||
			this.selectedProjectItems.length > 0
		) {
			this.renderProjectsList();
		}

		// Create save/cancel buttons
		this.createActionButtons(container);
	}

	private createNaturalLanguageInput(container: HTMLElement): void {
		const nlContainer = container.createDiv("nl-input-container");

		// Create markdown editor container
		const editorContainer = nlContainer.createDiv("nl-markdown-editor");
		editorContainer.setAttribute("role", "textbox");
		editorContainer.setAttribute("aria-label", this.t("modals.taskCreation.nlPlaceholder"));
		editorContainer.setAttribute("aria-multiline", "true");

		// Preview container
		this.nlPreviewContainer = nlContainer.createDiv("nl-preview-container");
		this.nlPreviewContainer.setAttribute("role", "status");
		this.nlPreviewContainer.setAttribute("aria-live", "polite");
		this.nlPreviewContainer.setAttribute("aria-label", "Task preview");

		try {
			// Create NLP autocomplete extension for @, #, +, status triggers
			// Returns array: [autocomplete, keymap]
			const nlpAutocomplete = createNLPAutocomplete(this.plugin);

			// Create embeddable markdown editor with autocomplete
			this.nlMarkdownEditor = new EmbeddableMarkdownEditor(this.app, editorContainer, {
				value: "",
				placeholder: this.t("modals.taskCreation.nlPlaceholder"),
				cls: "nlp-editor",
				extensions: nlpAutocomplete, // Add autocomplete extensions (array)
				onChange: (value) => {
					// Update preview as user types
					if (value.trim()) {
						this.updateNaturalLanguagePreview(value.trim());
					} else {
						this.clearNaturalLanguagePreview();
					}
				},
				onSubmit: () => {
					// Ctrl+Enter - save the task
					this.handleSave();
				},
				onEscape: () => {
					// ESC - close the modal (only when not in vim insert mode)
					// Vim mode will handle its own ESC to exit insert mode
					this.close();
				},
				onTab: () => {
					// Tab - jump to title input (expand form if needed)
					if (!this.isExpanded) {
						this.expandModal();
					}
					// Focus title input
					setTimeout(() => {
						const titleInput = this.modalEl.querySelector(".title-input-detailed") as HTMLInputElement;
						if (titleInput) {
							titleInput.focus();
						}
					}, 50);
					return true; // Prevent default tab behavior
				},
				onEnter: (editor, mod, shift) => {
					if (shift) {
						// Shift+Enter - allow newline
						return false;
					}
					if (mod) {
						// Ctrl/Cmd+Enter - save (already handled by onSubmit)
						return true;
					}
					// Normal Enter - allow new line
					return false;
				},
			});

			// Focus the editor after a short delay and reset scroll position
			setTimeout(() => {
				if (this.nlMarkdownEditor) {
					const cm = this.nlMarkdownEditor.editor?.cm;
					if (cm) {
						cm.focus();
						// Reset scroll to top to prevent auto-scroll down
						cm.scrollDOM.scrollTop = 0;
					}
				}
			}, 100);
		} catch (error) {
			console.error("Failed to create NLP markdown editor:", error);
			// Fallback to textarea if editor creation fails
			this.nlInput = editorContainer.createEl("textarea", {
				cls: "nl-input",
				attr: {
					placeholder: this.t("modals.taskCreation.nlPlaceholder"),
					rows: "3",
				},
			});

			// Event listeners for fallback - track them for cleanup
			const inputHandler = () => {
				const input = this.nlInput.value.trim();
				if (input) {
					this.updateNaturalLanguagePreview(input);
				} else {
					this.clearNaturalLanguagePreview();
				}
			};
			this.addTrackedEventListener(this.nlInput, "input", inputHandler);

			const keydownHandler = (e: Event) => {
				const input = this.nlInput.value.trim();
				if (!input) return;

				const keyEvent = e as KeyboardEvent;
				if (keyEvent.key === "Enter" && (keyEvent.ctrlKey || keyEvent.metaKey)) {
					keyEvent.preventDefault();
					this.handleSave();
				} else if (keyEvent.key === "Tab" && keyEvent.shiftKey) {
					keyEvent.preventDefault();
					this.parseAndFillForm(input);
				}
			};
			this.addTrackedEventListener(this.nlInput, "keydown", keydownHandler);

			// Initialize auto-suggestion for fallback
			this.nlpSuggest = new NLPSuggest(this.app, this.nlInput, this.plugin);

			setTimeout(() => {
				this.nlInput.focus();
			}, 100);
		}
	}

	private updateNaturalLanguagePreview(input: string): void {
		if (!this.nlPreviewContainer) return;

		const parsed = this.nlParser.parseInput(input);
		const previewData = this.nlParser.getPreviewData(parsed);

		if (previewData.length > 0 && parsed.title) {
			this.nlPreviewContainer.empty();
			this.nlPreviewContainer.style.display = "block";

			previewData.forEach((item) => {
				const previewItem = this.nlPreviewContainer.createDiv("nl-preview-item");
				previewItem.textContent = item.text;
			});
		} else {
			this.clearNaturalLanguagePreview();
		}
	}

	private clearNaturalLanguagePreview(): void {
		if (this.nlPreviewContainer) {
			this.nlPreviewContainer.empty();
			this.nlPreviewContainer.style.display = "none";
		}
	}

	/**
	 * Get the current NLP input value from either markdown editor or fallback textarea
	 */
	private getNLPInputValue(): string {
		if (this.nlMarkdownEditor) {
			return this.nlMarkdownEditor.value;
		} else if (this.nlInput) {
			return this.nlInput.value;
		}
		return "";
	}

	protected createActionBar(container: HTMLElement): void {
		this.actionBar = container.createDiv("action-bar");

		// NLP-specific icons (only if NLP is enabled)
		if (this.plugin.settings.enableNaturalLanguageInput) {
			// Fill form icon
			this.createActionIcon(
				this.actionBar,
				"wand",
				this.t("modals.taskCreation.actions.fillFromNaturalLanguage"),
				(icon, event) => {
					const input = this.getNLPInputValue().trim();
					if (input) {
						this.parseAndFillForm(input);
					}
				}
			);

			// Expand/collapse icon
			this.createActionIcon(
				this.actionBar,
				this.isExpanded ? "chevron-up" : "chevron-down",
				this.isExpanded
					? this.t("modals.taskCreation.actions.hideDetailedOptions")
					: this.t("modals.taskCreation.actions.showDetailedOptions"),
				(icon, event) => {
					this.toggleDetailedForm();
					// Update icon and tooltip
					const iconEl = icon.querySelector(".icon");
					if (iconEl) {
						setIcon(
							iconEl as HTMLElement,
							this.isExpanded ? "chevron-up" : "chevron-down"
						);
					}
					setTooltip(
						icon,
						this.isExpanded
							? this.t("modals.taskCreation.actions.hideDetailedOptions")
							: this.t("modals.taskCreation.actions.showDetailedOptions"),
						{ placement: "top" }
					);
				}
			);

			// Add separator
			const separator = this.actionBar.createDiv("action-separator");
			separator.style.width = "1px";
			separator.style.height = "24px";
			separator.style.backgroundColor = "var(--background-modifier-border)";
			separator.style.margin = "0 var(--size-4-2)";
		}

		// Due date icon
		this.createActionIcon(
			this.actionBar,
			"calendar",
			this.t("modals.task.actions.due"),
			(icon, event) => {
				this.showDateContextMenu(event, "due");
			},
			"due-date"
		);

		// Scheduled date icon
		this.createActionIcon(
			this.actionBar,
			"calendar-clock",
			this.t("modals.task.actions.scheduled"),
			(icon, event) => {
				this.showDateContextMenu(event, "scheduled");
			},
			"scheduled-date"
		);

		// Status icon
		this.createActionIcon(
			this.actionBar,
			"dot-square",
			this.t("modals.task.actions.status"),
			(icon, event) => {
				this.showStatusContextMenu(event);
			},
			"status"
		);

		// Priority icon
		this.createActionIcon(
			this.actionBar,
			"star",
			this.t("modals.task.actions.priority"),
			(icon, event) => {
				this.showPriorityContextMenu(event);
			},
			"priority"
		);

		// Recurrence icon
		this.createActionIcon(
			this.actionBar,
			"refresh-ccw",
			this.t("modals.task.actions.recurrence"),
			(icon, event) => {
				this.showRecurrenceContextMenu(event);
			},
			"recurrence"
		);

		// Reminder icon
		this.createActionIcon(
			this.actionBar,
			"bell",
			this.t("modals.task.actions.reminders"),
			(icon, event) => {
				this.showReminderContextMenu(event);
			},
			"reminders"
		);

		// Update icon states based on current values
		this.updateIconStates();
	}

	private parseAndFillForm(input: string): void {
		const parsed = this.nlParser.parseInput(input);
		this.applyParsedData(parsed);

		// Expand the form to show filled fields
		if (!this.isExpanded) {
			this.expandModal();
		}
	}

	private applyParsedData(parsed: NLParsedTaskData): void {
		if (parsed.title) this.title = parsed.title;
		if (parsed.status) this.status = parsed.status;
		if (parsed.priority) this.priority = parsed.priority;

		// Handle due date with time
		if (parsed.dueDate) {
			this.dueDate = parsed.dueTime
				? combineDateAndTime(parsed.dueDate, parsed.dueTime)
				: parsed.dueDate;
		}

		// Handle scheduled date with time
		if (parsed.scheduledDate) {
			this.scheduledDate = parsed.scheduledTime
				? combineDateAndTime(parsed.scheduledDate, parsed.scheduledTime)
				: parsed.scheduledDate;
		}

		if (parsed.contexts && parsed.contexts.length > 0)
			this.contexts = parsed.contexts.join(", ");
		// Projects will be handled in the form input update section below
		if (parsed.tags && parsed.tags.length > 0) this.tags = sanitizeTags(parsed.tags.join(", "));
		if (parsed.details) this.details = parsed.details;
		if (parsed.recurrence) this.recurrenceRule = parsed.recurrence;
		if (parsed.estimate !== undefined) {
			this.timeEstimate = parsed.estimate > 0 ? parsed.estimate : 0;
			if (this.timeEstimateInput) {
				this.timeEstimateInput.value =
					this.timeEstimate > 0 ? this.timeEstimate.toString() : "";
			}
		}

		// Update form inputs if they exist
		if (this.titleInput) this.titleInput.value = this.title;
		if (this.detailsInput) this.detailsInput.value = this.details;
		if (this.detailsMarkdownEditor) this.detailsMarkdownEditor.setValue(this.details);
		if (this.contextsInput) this.contextsInput.value = this.contexts;
		if (this.tagsInput) this.tagsInput.value = this.tags;

		// Handle projects differently - they use file selection, not text input
		if (parsed.projects && parsed.projects.length > 0) {
			this.initializeProjectsFromStrings(parsed.projects);
			this.renderProjectsList();
		}

		// Handle user-defined fields
		if (parsed.userFields) {
			console.debug("[TaskCreationModal] applyParsedData - parsed.userFields:", parsed.userFields);
			console.debug("[TaskCreationModal] applyParsedData - available user field definitions:", this.plugin.settings.userFields);

			for (const [fieldId, value] of Object.entries(parsed.userFields)) {
				// Find the user field definition
				const userField = this.plugin.settings.userFields?.find((f) => f.id === fieldId);
				console.debug(`[TaskCreationModal] Looking for field ${fieldId}, found:`, userField);

				if (userField) {
					// Store in userFields using the frontmatter key
					if (Array.isArray(value)) {
						this.userFields[userField.key] = value.join(", ");
					} else {
						this.userFields[userField.key] = value;
					}
					console.debug(`[TaskCreationModal] Applied user field ${userField.displayName} (key: ${userField.key}): ${value}`);
					console.debug(`[TaskCreationModal] Current this.userFields:`, this.userFields);
				} else {
					console.warn(`[TaskCreationModal] No user field definition found for field ID: ${fieldId}`);
				}
			}
		} else {
			console.debug("[TaskCreationModal] applyParsedData - NO parsed.userFields");
		}

		// Update icon states
		this.updateIconStates();
	}

	private toggleDetailedForm(): void {
		if (this.isExpanded) {
			// Collapse
			this.isExpanded = false;
			this.detailsContainer.style.display = "none";
			this.containerEl.removeClass("expanded");
		} else {
			// Expand
			this.expandModal();
		}
	}

	async initializeFormData(): Promise<void> {
		// Initialize with default values from settings
		this.priority = this.plugin.settings.defaultTaskPriority;
		this.status = this.plugin.settings.defaultTaskStatus;

		// Apply task creation defaults
		const defaults = this.plugin.settings.taskCreationDefaults;

		// Apply default due date
		this.dueDate = calculateDefaultDate(defaults.defaultDueDate);

		// Apply default scheduled date based on user settings
		this.scheduledDate = calculateDefaultDate(defaults.defaultScheduledDate);

		// Apply default contexts, tags, and projects
		this.contexts = defaults.defaultContexts || "";
		this.tags = defaults.defaultTags || "";

		// Apply default projects
		if (defaults.defaultProjects) {
			const projectStrings = splitListPreservingLinksAndQuotes(defaults.defaultProjects);
			if (projectStrings.length > 0) {
				this.initializeProjectsFromStrings(projectStrings);
			}
		}

		// Apply default time estimate
		if (defaults.defaultTimeEstimate && defaults.defaultTimeEstimate > 0) {
			this.timeEstimate = defaults.defaultTimeEstimate;
		}

		// Apply default reminders
		if (defaults.defaultReminders && defaults.defaultReminders.length > 0) {
			// Import the conversion function
			const { convertDefaultRemindersToReminders } = await import("../utils/settingsUtils");
			this.reminders = convertDefaultRemindersToReminders(defaults.defaultReminders);
		}

		// Apply pre-populated values if provided (overrides defaults)
		if (this.options.prePopulatedValues) {
			this.applyPrePopulatedValues(this.options.prePopulatedValues);
		}

		this.details = this.normalizeDetails(this.details);
		this.originalDetails = this.details;
	}

	private applyPrePopulatedValues(values: Partial<TaskInfo>): void {
		if (values.title !== undefined) this.title = values.title;
		if (values.due !== undefined) this.dueDate = values.due;
		if (values.scheduled !== undefined) this.scheduledDate = values.scheduled;
		if (values.priority !== undefined) this.priority = values.priority;
		if (values.status !== undefined) this.status = values.status;
		if (values.contexts !== undefined) {
			this.contexts = values.contexts.join(", ");
		}
		if (values.projects !== undefined) {
			// Filter out null, undefined, or empty strings before checking if we have valid projects
			const validProjects = values.projects.filter(
				(p) => p && typeof p === "string" && p.trim() !== ""
			);
			if (validProjects.length > 0) {
				this.initializeProjectsFromStrings(values.projects);
			}
			this.renderProjectsList();
		}
		if (values.tags !== undefined) {
			this.tags = sanitizeTags(
				values.tags.filter((tag) => tag !== this.plugin.settings.taskTag).join(", ")
			);
		}
		if (values.timeEstimate !== undefined) this.timeEstimate = values.timeEstimate;
		if (values.recurrence !== undefined && typeof values.recurrence === "string") {
			this.recurrenceRule = values.recurrence;
		}
		if (values.recurrence_anchor !== undefined) {
			this.recurrenceAnchor = values.recurrence_anchor;
		}
	}

	async handleSave(): Promise<void> {
		// If NLP is enabled and there's content in the NL field, parse it first
		if (this.plugin.settings.enableNaturalLanguageInput) {
			const nlContent = this.getNLPInputValue().trim();
			if (nlContent && !this.title.trim()) {
				// Only auto-parse if no title has been manually entered
				const parsed = this.nlParser.parseInput(nlContent);
				this.applyParsedData(parsed);
			}
		}

		if (!this.validateForm()) {
			new Notice(this.t("modals.taskCreation.notices.titleRequired"));
			return;
		}

		try {
			const taskData = this.buildTaskData();
			const result = await this.plugin.taskService.createTask(taskData);
			let createdTask = result.taskInfo;

			// Check if filename was changed due to length constraints
			const expectedFilename = result.taskInfo.title.replace(/[<>:"/\\|?*]/g, "").trim();
			const actualFilename = result.file.basename;

			if (actualFilename.startsWith("task-") && actualFilename !== expectedFilename) {
				new Notice(
					this.t("modals.taskCreation.notices.successShortened", {
						title: createdTask.title,
					})
				);
			} else {
				new Notice(
					this.t("modals.taskCreation.notices.success", { title: createdTask.title })
				);
			}

			if (this.blockingItems.length > 0) {
				const addedPaths: string[] = [];
				const rawMap: Record<string, TaskDependency> = {};
				const unresolved: string[] = [];

				this.blockingItems.forEach((item) => {
					if (item.path) {
						if (!addedPaths.includes(item.path)) {
							addedPaths.push(item.path);
							rawMap[item.path] = { ...item.dependency };
						}
					} else {
						unresolved.push(item.dependency.uid);
					}
				});

				if (addedPaths.length > 0) {
					await this.plugin.taskService.updateBlockingRelationships(
						createdTask,
						addedPaths,
						[],
						rawMap
					);
					const refreshed = await this.plugin.cacheManager.getTaskInfo(createdTask.path);
					if (refreshed) {
						createdTask = refreshed;
					}
				}

				if (unresolved.length > 0) {
					new Notice(
						this.t("modals.taskCreation.notices.blockingUnresolved", {
							entries: unresolved.join(", "),
						})
					);
				}

				this.blockingItems = [];
			}

			// Handle subtask assignments
			if (this.selectedSubtaskFiles.length > 0) {
				await this.applySubtaskAssignments(createdTask);
			}

			if (this.options.onTaskCreated) {
				this.options.onTaskCreated(createdTask);
			}

			this.close();
		} catch (error) {
			console.error("Failed to create task:", error);
			const message = error instanceof Error && error.message ? error.message : String(error);
			new Notice(this.t("modals.taskCreation.notices.failure", { message }));
		}
	}

	private buildTaskData(): Partial<TaskInfo> {
		const now = getCurrentTimestamp();

		// Parse contexts, projects, and tags
		const contextList = this.contexts
			.split(",")
			.map((c) => c.trim())
			.filter((c) => c.length > 0);

		const projectList = splitListPreservingLinksAndQuotes(this.projects);
		const tagList = sanitizeTags(this.tags)
			.split(",")
			.map((t) => t.trim())
			.filter((t) => t.length > 0);

		// Add the task tag if using tag-based identification and it's not already present
		if (
			this.plugin.settings.taskIdentificationMethod === 'tag' &&
			this.plugin.settings.taskTag &&
			!tagList.includes(this.plugin.settings.taskTag)
		) {
			tagList.push(this.plugin.settings.taskTag);
		}

		const taskData: TaskCreationData = {
			title: this.title.trim(),
			due: this.dueDate || undefined,
			scheduled: this.scheduledDate || undefined,
			priority: this.priority,
			status: this.status,
			contexts: contextList.length > 0 ? contextList : undefined,
			projects: projectList.length > 0 ? projectList : undefined,
			tags: tagList.length > 0 ? tagList : undefined,
			timeEstimate: this.timeEstimate > 0 ? this.timeEstimate : undefined,
			recurrence: this.recurrenceRule || undefined,
			recurrence_anchor: this.recurrenceRule ? this.recurrenceAnchor : undefined,
			reminders: this.reminders.length > 0 ? this.reminders : undefined,
			creationContext: "manual-creation", // Mark as manual creation for folder logic
			dateCreated: now,
			dateModified: now,
			// Add user fields as custom frontmatter properties
			customFrontmatter: this.buildCustomFrontmatter(),
		};

		const blockedDependencies = this.blockedByItems.map((item) => ({
			...item.dependency,
		}));
		if (blockedDependencies.length > 0) {
			taskData.blockedBy = blockedDependencies;
		}

		// Add details if provided
		const normalizedDetails = this.normalizeDetails(this.details).trimEnd();
		if (normalizedDetails.length > 0) {
			taskData.details = normalizedDetails;
		}

		return taskData;
	}

	private buildCustomFrontmatter(): Record<string, any> {
		const customFrontmatter: Record<string, any> = {};

		console.debug("[TaskCreationModal] Building custom frontmatter from userFields:", this.userFields);

		// Add user field values to frontmatter
		for (const [fieldKey, fieldValue] of Object.entries(this.userFields)) {
			if (fieldValue !== null && fieldValue !== undefined && fieldValue !== "") {
				customFrontmatter[fieldKey] = fieldValue;
				console.debug(`[TaskCreationModal] Adding to frontmatter: ${fieldKey} = ${fieldValue}`);
			}
		}

		console.debug("[TaskCreationModal] Final custom frontmatter:", customFrontmatter);
		return customFrontmatter;
	}

	private generateFilename(taskData: TaskCreationData): string {
		const context: FilenameContext = {
			title: taskData.title || "",
			status: taskData.status || "open",
			priority: taskData.priority || "normal",
			dueDate: taskData.due,
			scheduledDate: taskData.scheduled,
		};

		return generateTaskFilename(context, this.plugin.settings);
	}

	// Override to prevent creating duplicate title input when NLP is enabled
	protected createTitleInput(container: HTMLElement): void {
		// Only create title input if NLP is disabled
		if (!this.plugin.settings.enableNaturalLanguageInput) {
			super.createTitleInput(container);
		}
	}

	protected async applySubtaskAssignments(createdTask: TaskInfo): Promise<void> {
		const currentTaskFile = this.app.vault.getAbstractFileByPath(createdTask.path);
		if (!(currentTaskFile instanceof TFile)) return;

		for (const subtaskFile of this.selectedSubtaskFiles) {
			try {
				const subtaskInfo = await this.plugin.cacheManager.getTaskInfo(subtaskFile.path);
				if (!subtaskInfo) continue;

				const projectReference = this.buildProjectReference(currentTaskFile, subtaskFile.path);
				const legacyReference = `[[${currentTaskFile.basename}]]`;
				const currentProjects = Array.isArray(subtaskInfo.projects) ? subtaskInfo.projects : [];

				if (
					currentProjects.includes(projectReference) ||
					currentProjects.includes(legacyReference)
				) {
					continue;
				}

				const sanitizedProjects = currentProjects.filter((entry) => entry !== legacyReference);
				const updatedProjects = [...sanitizedProjects, projectReference];
				await this.plugin.updateTaskProperty(subtaskInfo, "projects", updatedProjects);
			} catch (error) {
				console.error("Failed to assign subtask:", error);
			}
		}
	}

	onClose(): void {
		// Clean up markdown editor if it exists
		if (this.nlMarkdownEditor) {
			this.nlMarkdownEditor.destroy();
			this.nlMarkdownEditor = null;
		}

		// Clean up NLP suggest
		if (this.nlpSuggest) {
			// NLPSuggest extends AbstractInputSuggest which has a close method
			this.nlpSuggest.close();
			this.nlpSuggest = null;
		}

		// Remove all tracked event listeners
		this.removeAllEventListeners();

		super.onClose();
	}
}
