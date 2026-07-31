import { App, AbstractInputSuggest, parseFrontMatterAliases, TFile } from "obsidian";
import TaskNotesPlugin from "../main";
import { NaturalLanguageParser } from "../services/NaturalLanguageParser";
import { ProjectEntry, ProjectMetadataResolver } from "../utils/projectMetadataResolver";
import { parseDisplayFieldsRow } from "../utils/projectAutosuggestDisplayFieldsParser";
import { filterTagsForTaskModalSuggestions } from "../utils/taskTagFiltering";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Modals/TaskCreationSuggest" });

/**
 * Auto-suggestion provider for NLP textarea with @, #, and + triggers
 * @ = contexts, # = tags, + = wikilinks to vault files
 */
interface ProjectSuggestion {
	basename: string;
	displayName: string;
	linkText: string;
	type: "project";
	entry?: ProjectEntry;
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

// Kept exported for backward compatibility with older tests/imports.
export interface StatusSuggestion {
	value: string;
	label: string;
	display: string;
	type: "status";
	toString(): string;
}

export class NLPSuggest extends AbstractInputSuggest<
	TagSuggestion | ContextSuggestion | ProjectSuggestion | StatusSuggestion
> {
	private plugin: TaskNotesPlugin;
	private textarea: HTMLInputElement | HTMLTextAreaElement;
	private currentTrigger: "@" | "#" | "+" | "status" | null = null;
	// Store app reference explicitly to avoid relying on plugin.app in tests and runtime
	private obsidianApp: App;
	// Cache ProjectMetadataResolver to avoid recreating it for each suggestion
	private projectMetadataResolver: ProjectMetadataResolver | null = null;

	constructor(
		app: App,
		textareaEl: HTMLInputElement | HTMLTextAreaElement,
		plugin: TaskNotesPlugin
	) {
		super(app, textareaEl as unknown as HTMLInputElement);
		this.plugin = plugin;
		this.textarea = textareaEl;
		this.obsidianApp = app;
	}

	private getCursorPosition(): number {
		return this.textarea.selectionStart ?? this.textarea.value.length;
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
			.filter((context) => context.toLowerCase().includes(query.toLowerCase()))
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
		return parser.getStatusSuggestions(query, 10).map((s) => ({
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
		const tags = filterTagsForTaskModalSuggestions(
			this.plugin.cacheManager.getAllTags(),
			this.plugin.settings
		);
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
			const appRef = this.obsidianApp ?? this.plugin.app;
			this.projectMetadataResolver = new ProjectMetadataResolver({
				getFrontmatter: (entry) => {
					const file = appRef?.vault.getAbstractFileByPath(entry.path);
					const cache =
						file instanceof TFile
							? appRef?.metadataCache.getFileCache(file)
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

		// Get suggestions using FileSuggestHelper with explicit project filter configuration
		const list = await FileSuggestHelper.suggest(
			this.plugin,
			query,
			20,
			this.plugin.settings.projectAutosuggest
		);

		const appRef = this.obsidianApp ?? this.plugin.app;

		try {
			// Use cached resolver instead of creating a new one
			const resolver = this.getProjectMetadataResolver();

			const rowConfigs = (this.plugin.settings?.projectAutosuggest?.rows ?? []).slice(0, 3);

			return list.map((item): ProjectSuggestion => {
				const file = appRef?.vault
					.getMarkdownFiles()
					.find((f) => f.path === item.path);
				if (!file) {
					return {
						basename: item.insertText,
						displayName: item.displayText,
						linkText: item.insertText,
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
					? aliasesFm.filter((a) => typeof a === "string")
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

				const displayName = this.generateProjectDisplayName(
					rowConfigs,
					fileData,
					resolver,
					file.basename
				);

				return {
					basename: file.basename,
					displayName: displayName,
					linkText: item.insertText,
					type: "project",
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
				};
			});
		} catch (err) {
			tasknotesLogger.error(
				"Enhanced project autosuggest failed, falling back to basic suggestions",
				{
					category: "persistence",
					operation: "enhanced-project-autosuggest-falling-back-basic-suggestions",
					error: err,
				}
			);
			return list.map((item) => ({
				basename: item.insertText,
				displayName: item.displayText,
				linkText: item.insertText,
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
		item: ProjectEntry,
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
		const cursorPos = this.getCursorPosition();
		const textBeforeCursor = this.textarea.value.slice(0, cursorPos);

		// Find the active trigger
		const { trigger, triggerIndex, queryAfterTrigger } =
			this.findActiveTrigger(textBeforeCursor);

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
		const displayText =
			suggestion.type === "project" ? suggestion.displayName : suggestion.display;
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
					const frag = activeDocument.createDocumentFragment();
					let last = 0;
					for (const m of filtered) {
						if (m.start > last)
							frag.appendChild(
								activeDocument.createTextNode(original.slice(last, m.start))
							);
						const mark = activeDocument.createElement("mark");
						mark.textContent = original.slice(m.start, m.end);
						frag.appendChild(mark);
						last = m.end;
					}
					if (last < original.length)
						frag.appendChild(activeDocument.createTextNode(original.slice(last)));
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
			const cursorPos = this.getCursorPosition();
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
			if (Array.isArray(cfg) && cfg.length > 0 && suggestion.entry) {
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
										metaRow.appendChild(activeDocument.createTextNode(" "));
									metaRow.appendChild(activeDocument.createTextNode(lit));
									appended = true;
								}
								continue;
							}
							const value = resolver.resolve(t.property, suggestion.entry);
							if (!value) continue;
							if (metaRow.childNodes.length)
								metaRow.appendChild(activeDocument.createTextNode(" "));
							if (t.showName) {
								const labelSpan = activeDocument.createElement("span");
								labelSpan.className = "nlp-suggest-project__meta-label";
								labelSpan.textContent = `${t.displayName ?? t.property}:`;
								metaRow.appendChild(labelSpan);
								metaRow.appendChild(activeDocument.createTextNode(" "));
							}
							const valueSpan = activeDocument.createElement("span");
							valueSpan.className = "nlp-suggest-project__meta-value";
							valueSpan.textContent = value;
							metaRow.appendChild(valueSpan);
							appended = true;
							const searchable = t.searchable === true || ALWAYS.has(t.property);
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

		const cursorPos = this.getCursorPosition();
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
			suggestion.type === "project" ? suggestion.linkText : suggestion.value;

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
