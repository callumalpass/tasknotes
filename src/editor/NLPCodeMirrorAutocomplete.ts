import {
	autocompletion,
	CompletionContext,
	Completion,
	acceptCompletion,
	moveCompletionSelection,
	closeCompletion,
} from "@codemirror/autocomplete";
import { Extension, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import TaskNotesPlugin from "../main";
import { NaturalLanguageParser } from "../services/NaturalLanguageParser";
import { TriggerConfigService } from "../services/TriggerConfigService";
import { FileSuggestHelper } from "../suggest/FileSuggestHelper";
import { ProjectMetadataResolver, ProjectEntry } from "../utils/projectMetadataResolver";
import { parseDisplayFieldsRow } from "../utils/projectAutosuggestDisplayFieldsParser";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Editor/NLPCodeMirrorAutocomplete" });

type ProjectCompletion = {
	projectMetadata?: ProjectCompletionMetadata;
	projectQuery?: string;
};
type CompletionSourceResult = {
	from: number;
	to?: number;
	options: Completion[];
	validFor?: RegExp;
};

type ProjectCompletionMetadataPart = {
	text: string;
	searchable: boolean;
	kind: "label" | "literal" | "value";
};

type ProjectCompletionMetadataRow = ProjectCompletionMetadataPart[];

export type ProjectCompletionMetadata = ProjectCompletionMetadataRow[];

const DEFAULT_SEARCHABLE_PROJECT_FIELDS = new Set(["title", "aliases", "file.basename"]);

/**
 * CodeMirror autocomplete extension for NLP triggers with configurable trigger support
 *
 * Supports customizable triggers for:
 * - Tags (default: #, uses native suggester when #)
 * - Contexts (default: @)
 * - Projects (default: +)
 * - Status (default: *)
 * - Priority (optional, default: !)
 * - User-defined properties
 *
 * Note: [[ wikilink autocomplete uses Obsidian's native suggester
 *
 * Replaces the old NLPSuggest system for use with EmbeddableMarkdownEditor
 */
export function createNLPAutocomplete(plugin: TaskNotesPlugin): Extension[] {
	const autocomplete = autocompletion({
		override: [createNLPCompletionSource(plugin)],
		// Show autocomplete immediately when typing after trigger
		activateOnTyping: true,
		// Close on blur
		closeOnBlur: true,
		// Max options to show
		maxRenderedOptions: 10,
		// Custom rendering for project suggestions with metadata
		addToOptions: [
			{
				render: (completion: Completion, _state: unknown, view: EditorView) =>
					renderProjectCompletionMetadata(completion, view.dom.ownerDocument),
				position: 100, // After label (50) and detail (80)
			},
		],
	});

	// Add explicit keyboard navigation for autocomplete with high priority
	// This ensures our autocomplete takes precedence over Obsidian's native ones
	const autocompleteKeymap = Prec.high(
		keymap.of([
			{ key: "ArrowDown", run: moveCompletionSelection(true) },
			{ key: "ArrowUp", run: moveCompletionSelection(false) },
			{ key: "Enter", run: acceptCompletion },
			{ key: "Tab", run: acceptCompletion },
			{ key: "Escape", run: closeCompletion },
		])
	);

	return [Prec.high(autocomplete), autocompleteKeymap];
}

export function createNLPCompletionSource(
	plugin: TaskNotesPlugin
): (context: CompletionContext) => Promise<CompletionSourceResult | null> {
	return async (context: CompletionContext): Promise<CompletionSourceResult | null> => {
		const triggerConfig = new TriggerConfigService(
			plugin.settings.nlpTriggers,
			plugin.settings.userFields || []
		);

		const line = context.state.doc.lineAt(context.pos);
		const textBeforeCursor = line.text.slice(0, context.pos - line.from);

		const isBoundary = (index: number, text: string) => {
			if (index === -1) return false;
			if (index === 0) return true;
			const prev = text[index - 1];
			return !/\w/.test(prev);
		};

		const enabledTriggers = triggerConfig.getTriggersOrderedByLength();
		const candidates: Array<{
			propertyId: string;
			trigger: string;
			index: number;
			triggerLength: number;
		}> = [];

		for (const triggerDef of enabledTriggers) {
			// Skip native tag suggester (# trigger) - Obsidian handles that
			if (triggerDef.propertyId === "tags" && triggerDef.trigger === "#") {
				continue;
			}

			const lastIndex = textBeforeCursor.lastIndexOf(triggerDef.trigger);
			if (isBoundary(lastIndex, textBeforeCursor)) {
				candidates.push({
					propertyId: triggerDef.propertyId,
					trigger: triggerDef.trigger,
					index: lastIndex,
					triggerLength: triggerDef.trigger.length,
				});
			}
		}

		if (candidates.length === 0) return null;

		candidates.sort((a, b) => b.index - a.index);
		const active = candidates[0];

		const queryStart = active.index + active.triggerLength;
		const query = textBeforeCursor.slice(queryStart);

		if (active.propertyId === "projects" && /^\[\[[^\]]*\]\]/.test(query)) {
			return null;
		}

		if (active.propertyId !== "projects" && (query.includes(" ") || query.includes("\n"))) {
			return null;
		}

		const options = await getSuggestionsForProperty(
			active.propertyId,
			query,
			plugin,
			triggerConfig
		);

		if (!options || options.length === 0) {
			return null;
		}

		let to = context.pos;
		const textAfterCursor = line.text.slice(context.pos - line.from);
		if (active.propertyId === "status" && textAfterCursor.startsWith(active.trigger)) {
			to = Math.min(line.to, context.pos + active.triggerLength);
		}

		return {
			from: line.from + active.index + active.triggerLength,
			to,
			options,
			validFor: /^[\w\s-]*$/,
		};
	};
}

export function renderProjectCompletionMetadata(
	completion: Completion,
	doc: Document = activeDocument
): HTMLElement | null {
	const projectCompletion = completion as unknown as ProjectCompletion;
	if (!projectCompletion.projectMetadata) return null;

	const container = doc.createElement("div");
	container.className = "cm-project-suggestion__metadata";

	for (const row of projectCompletion.projectMetadata) {
		const metaRow = doc.createElement("div");
		metaRow.className = "cm-project-suggestion__meta";

		row.forEach((part, index) => {
			if (index > 0) {
				metaRow.appendChild(doc.createTextNode(" "));
			}

			const span = doc.createElement("span");
			span.className =
				part.kind === "value"
					? "cm-project-suggestion__meta-value"
					: part.kind === "label"
						? "cm-project-suggestion__meta-label"
						: "cm-project-suggestion__meta-literal";
			if (part.searchable) {
				span.classList.add("cm-project-suggestion__meta-searchable");
			}

			if (part.searchable && projectCompletion.projectQuery) {
				appendHighlightedText(span, part.text, projectCompletion.projectQuery);
			} else {
				span.textContent = part.text;
			}

			metaRow.appendChild(span);
		});

		container.appendChild(metaRow);
	}

	return container;
}

/**
 * Get autocomplete suggestions for a specific property
 */
async function getSuggestionsForProperty(
	propertyId: string,
	query: string,
	plugin: TaskNotesPlugin,
	triggerConfig: TriggerConfigService
): Promise<Completion[] | null> {
	const suggesterType = triggerConfig.getSuggesterType(propertyId);

	switch (suggesterType) {
		case "list":
			return getListSuggestions(propertyId, query, plugin);

		case "file":
			return getFileSuggestions(propertyId, query, plugin, triggerConfig);

		case "status":
			return getStatusSuggestions(query, plugin);

		case "priority":
			return getPrioritySuggestions(query, plugin);

		case "boolean":
			return getBooleanSuggestions(query);

		case "native-tag":
			// Native tag suggester handles this
			return null;

		default:
			return null;
	}
}

/**
 * Get list-based suggestions (tags, contexts, or simple text lists)
 */
function getListSuggestions(
	propertyId: string,
	query: string,
	plugin: TaskNotesPlugin
): Completion[] {
	let items: string[] = [];
	let label: string = propertyId;

	switch (propertyId) {
		case "tags":
			items = plugin.cacheManager.getAllTags();
			label = "Tag";
			break;

		case "contexts":
			items = plugin.cacheManager.getAllContexts();
			label = "Context";
			break;

		default:
			// User-defined list field - would need to fetch values from cache
			// For now, return empty
			items = [];
			label = propertyId;
			break;
	}

	return items
		.filter((item) => item && typeof item === "string")
		.filter((item) => item.toLowerCase().includes(query.toLowerCase()))
		.slice(0, 10)
		.map((item) => ({
			label: item,
			apply: item + " ",
			type: "text",
			info: label,
		}));
}

/**
 * Get file-based suggestions (projects or user fields with autosuggest)
 */
async function getFileSuggestions(
	propertyId: string,
	query: string,
	plugin: TaskNotesPlugin,
	triggerConfig: TriggerConfigService
): Promise<Completion[]> {
	try {
		// Get autosuggest config - use projectAutosuggest for projects,
		// or user field's autosuggestFilter for user fields
		let autosuggestConfig;
		if (propertyId === "projects") {
			autosuggestConfig = plugin.settings.projectAutosuggest;
		} else {
			const userField = triggerConfig.getUserField(propertyId);
			autosuggestConfig = userField?.autosuggestFilter;
		}

		const list = await FileSuggestHelper.suggest(plugin, query, 20, autosuggestConfig);

		// For projects, add rich metadata rendering
		if (propertyId === "projects") {
			const resolver = new ProjectMetadataResolver({
				getFrontmatter: (entry) => entry.frontmatter,
			});
			const rowConfigs = (plugin.settings?.projectAutosuggest?.rows ?? []).slice(0, 3);

			return list.map((item) => {
				const displayText = item.displayText || item.insertText;
				const insertText = item.insertText;

				// Get file metadata for rendering
				const file = plugin.app.vault
					.getMarkdownFiles()
					.find((f) => f.path === item.path);

				// Build metadata rows using shared utility
				let metadataRows: ProjectCompletionMetadata = [];
				if (file && rowConfigs.length > 0) {
					const cache = plugin.app.metadataCache.getFileCache(file);
					const frontmatter: Record<string, unknown> = cache?.frontmatter || {};
					const mapped = plugin.fieldMapper.mapFromFrontmatter(
						frontmatter,
						file.path,
						plugin.settings.storeTitleInFilename
					);

					const title = typeof mapped.title === "string" ? mapped.title : "";
					const aliases = Array.isArray(frontmatter["aliases"])
						? frontmatter["aliases"].filter((a: unknown) => typeof a === "string")
						: [];

					const fileData: ProjectEntry = {
						basename: file.basename,
						name: file.name,
						path: file.path,
						parent: file.parent?.path || "",
						title,
						aliases,
						frontmatter,
					};

					metadataRows = buildProjectMetadataRows(rowConfigs, fileData, resolver);
				}

				return {
					label: displayText,
					apply: `[[${insertText}]] `,
					type: "text",
					info: "Project",
					// Add metadata as a custom property for the render function
					projectMetadata: metadataRows.length > 0 ? metadataRows : undefined,
					projectQuery: query,
				};
			});
		}

		// For non-project file suggestions, use simple rendering
		return list.map((item) => {
			const displayText = item.displayText || item.insertText;
			const insertText = item.insertText;

			return {
				label: displayText,
				apply: `[[${insertText}]] `,
				type: "text",
				info: propertyId === "projects" ? "Project" : propertyId,
			};
		});
	} catch (error) {
		tasknotesLogger.error(`Error getting file suggestions for ${propertyId}:`, {
			category: "persistence",
			operation: "getting-file-suggestions",
			error: error,
		});
		return [];
	}
}

function buildProjectMetadataRows(
	rowConfigs: string[],
	fileData: ProjectEntry,
	resolver: ProjectMetadataResolver
): ProjectCompletionMetadata {
	const metadataRows: ProjectCompletionMetadata = [];
	const maxRows = Math.min(rowConfigs.length, 3);

	for (let i = 0; i < maxRows; i++) {
		const row = rowConfigs[i];
		if (!row) continue;

		try {
			const tokens = parseDisplayFieldsRow(row);
			const parts: ProjectCompletionMetadataPart[] = [];

			for (const token of tokens) {
				if (token.property.startsWith("literal:")) {
					const text = token.property.slice(8);
					if (text) {
						parts.push({ text, searchable: false, kind: "literal" });
					}
					continue;
				}

				const value = resolver.resolve(token.property, fileData);
				if (!value) continue;

				if (token.showName) {
					parts.push({
						text: `${token.displayName ?? token.property}:`,
						searchable: false,
						kind: "label",
					});
				}

				parts.push({
					text: value,
					searchable:
						token.searchable === true ||
						DEFAULT_SEARCHABLE_PROJECT_FIELDS.has(token.property),
					kind: "value",
				});
			}

			if (parts.some((part) => part.text.trim().length > 0)) {
				metadataRows.push(parts);
			}
		} catch {
			// Ignore invalid project metadata rows.
		}
	}

	return metadataRows;
}

function appendHighlightedText(container: HTMLElement, text: string, query: string): void {
	const doc = container.ownerDocument;
	const words = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (words.length === 0) {
		container.textContent = text;
		return;
	}

	const lowerText = text.toLowerCase();
	const matches: Array<{ start: number; end: number }> = [];
	for (const word of words) {
		let index = lowerText.indexOf(word);
		while (index !== -1) {
			matches.push({ start: index, end: index + word.length });
			index = lowerText.indexOf(word, index + 1);
		}
	}

	matches.sort((a, b) => a.start - b.start);
	const nonOverlappingMatches: typeof matches = [];
	for (const match of matches) {
		const previous = nonOverlappingMatches[nonOverlappingMatches.length - 1];
		if (!previous || match.start >= previous.end) {
			nonOverlappingMatches.push(match);
		}
	}

	if (nonOverlappingMatches.length === 0) {
		container.textContent = text;
		return;
	}

	let lastIndex = 0;
	for (const match of nonOverlappingMatches) {
		if (match.start > lastIndex) {
			container.appendChild(doc.createTextNode(text.slice(lastIndex, match.start)));
		}

		const mark = doc.createElement("mark");
		mark.textContent = text.slice(match.start, match.end);
		container.appendChild(mark);
		lastIndex = match.end;
	}

	if (lastIndex < text.length) {
		container.appendChild(doc.createTextNode(text.slice(lastIndex)));
	}
}

/**
 * Get status suggestions
 */
function getStatusSuggestions(query: string, plugin: TaskNotesPlugin): Completion[] {
	const parser = NaturalLanguageParser.fromPlugin(plugin);
	const statusSuggestions = parser.getStatusSuggestions(query, 10);

	return statusSuggestions.map((s) => ({
		label: s.display,
		apply: s.value + " ",
		type: "text",
		info: "Status",
	}));
}

/**
 * Get priority suggestions
 */
function getPrioritySuggestions(query: string, plugin: TaskNotesPlugin): Completion[] {
	const priorities = plugin.settings.customPriorities || [];

	return priorities
		.filter((p) => p.label.toLowerCase().includes(query.toLowerCase()))
		.slice(0, 10)
		.map((p) => ({
			label: p.label,
			apply: p.value + " ",
			type: "text",
			info: "Priority",
		}));
}

/**
 * Get boolean suggestions (true/false)
 */
function getBooleanSuggestions(query: string): Completion[] {
	const options = ["true", "false"];

	return options
		.filter((opt) => opt.toLowerCase().includes(query.toLowerCase()))
		.map((opt) => ({
			label: opt,
			apply: opt + " ",
			type: "text",
			info: "Boolean",
		}));
}
