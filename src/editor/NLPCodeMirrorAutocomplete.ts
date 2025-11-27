import {
	autocompletion,
	CompletionContext,
	CompletionResult,
	Completion,
	acceptCompletion,
	moveCompletionSelection,
	closeCompletion
} from "@codemirror/autocomplete";
import { Extension, Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import TaskNotesPlugin from "../main";
import { NaturalLanguageParser } from "../services/NaturalLanguageParser";
import { TriggerConfigService } from "../services/TriggerConfigService";
import { FileSuggestHelper } from "../suggest/FileSuggestHelper";
import { ProjectMetadataResolver, ProjectEntry } from "../utils/projectMetadataResolver";
import { parseDisplayFieldsRow } from "../utils/projectAutosuggestDisplayFieldsParser";

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
		override: [
			async (context: CompletionContext): Promise<CompletionResult | null> => {
				// Initialize trigger config service
				const triggerConfig = new TriggerConfigService(
					plugin.settings.nlpTriggers,
					plugin.settings.userFields || []
				);

				// Get text before cursor
				const line = context.state.doc.lineAt(context.pos);
				const textBeforeCursor = line.text.slice(0, context.pos - line.from);

				// Helper: check if index is at a word boundary
				const isBoundary = (index: number, text: string) => {
					if (index === -1) return false;
					if (index === 0) return true;
					const prev = text[index - 1];
					return !/\w/.test(prev);
				};

				// Find all enabled triggers and their positions
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

				// Sort by position (most recent first)
				candidates.sort((a, b) => b.index - a.index);
				const active = candidates[0];

				// Extract query after trigger
				const queryStart = active.index + active.triggerLength;
				const query = textBeforeCursor.slice(queryStart);

				// Don't suggest if there's already a completed wikilink for projects
				if (active.propertyId === "projects" && /^\[\[[^\]]*\]\]/.test(query)) {
					return null;
				}

				// Don't suggest if there's a space (except for projects which allow multi-word)
				if (
					active.propertyId !== "projects" &&
					(query.includes(" ") || query.includes("\n"))
				) {
					return null;
				}

				// Get suggestions based on property type
				const options = await getSuggestionsForProperty(
					active.propertyId,
					query,
					plugin,
					triggerConfig
				);

				// Return null if no options (let native suggesters handle their triggers)
				if (!options || options.length === 0) {
					return null;
				}

				const from = line.from + active.index + active.triggerLength;
				const to = context.pos;

				return {
					from,
					to,
					options,
					validFor: /^[\w\s-]*$/,
				};
			},
		],
		// Show autocomplete immediately when typing after trigger
		activateOnTyping: true,
		// Close on blur
		closeOnBlur: true,
		// Max options to show
		maxRenderedOptions: 10,
		// Custom rendering for project suggestions with metadata
		addToOptions: [
			{
				render: (completion: any, _state: any, _view: any) => {
					// Only render custom content for project suggestions with metadata
					if (!completion.projectMetadata) return null;

					const container = document.createElement("div");
					container.className = "cm-project-suggestion__metadata";

					const metadata = completion.projectMetadata;
					for (const row of metadata) {
						const metaRow = document.createElement("div");
						metaRow.className = "cm-project-suggestion__meta";
						metaRow.textContent = row;
						container.appendChild(metaRow);
					}

					return container;
				},
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

		const excluded = (plugin.settings.excludedFolders || "")
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);

		const list = await FileSuggestHelper.suggest(plugin, query, 20, autosuggestConfig);

		// Filter out excluded folders
		const filteredList = list.filter((item) => {
			const file = plugin.app.vault
				.getMarkdownFiles()
				.find((f) => f.basename === item.insertText);
			if (!file) return true;
			return !excluded.some((ex) => file.path.startsWith(ex));
		});

		// For projects, add rich metadata rendering
		if (propertyId === "projects") {
			const resolver = new ProjectMetadataResolver({
				getFrontmatter: (entry) => entry.frontmatter,
			});
			const rowConfigs = (plugin.settings?.projectAutosuggest?.rows ?? []).slice(0, 3);

			return filteredList.map((item) => {
				const displayText = item.displayText || item.insertText;
				const insertText = item.insertText;

				// Get file metadata for rendering
				const file = plugin.app.vault
					.getMarkdownFiles()
					.find((f) => f.basename === item.insertText);

				// Build metadata rows using shared utility
				let metadataRows: string[] = [];
				if (file && rowConfigs.length > 0) {
					const cache = plugin.app.metadataCache.getFileCache(file);
					const frontmatter: Record<string, any> = cache?.frontmatter || {};
					const mapped = plugin.fieldMapper.mapFromFrontmatter(
						frontmatter,
						file.path,
						plugin.settings.storeTitleInFilename
					);

					const title = typeof mapped.title === "string" ? mapped.title : "";
					const aliases = Array.isArray(frontmatter["aliases"])
						? (frontmatter["aliases"] as any[]).filter((a: any) => typeof a === "string")
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

					metadataRows = resolver.buildMetadataRows(rowConfigs, fileData, parseDisplayFieldsRow);
				}

				return {
					label: displayText,
					apply: `[[${insertText}]] `,
					type: "text",
					info: "Project",
					// Add metadata as a custom property for the render function
					projectMetadata: metadataRows.length > 0 ? metadataRows : undefined,
				} as any;
			});
		}

		// For non-project file suggestions, use simple rendering
		return filteredList.map((item) => {
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
		console.error(`Error getting file suggestions for ${propertyId}:`, error);
		return [];
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
