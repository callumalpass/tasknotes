import { AbstractInputSuggest, App } from "obsidian";
import TaskNotesPlugin from "../main";

interface ContextSuggestion {
	value: string;
	display: string;
	type: "context";
	toString(): string;
}

export class ContextSuggest extends AbstractInputSuggest<ContextSuggestion> {
	private plugin: TaskNotesPlugin;
	private input: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement, plugin: TaskNotesPlugin) {
		super(app, inputEl);
		this.plugin = plugin;
		this.input = inputEl;
	}

	protected async getSuggestions(_: string): Promise<ContextSuggestion[]> {
		const currentValues = this.input.value.split(",").map((value: string) => value.trim());
		const currentQuery = currentValues[currentValues.length - 1];

		const contexts = this.plugin.cacheManager.getAllContexts();
		const alreadySelected = currentValues.slice(0, -1);
		return contexts
			.filter((context) => context && typeof context === "string")
			.filter(
				(context) =>
					!alreadySelected.includes(context) &&
					(!currentQuery || context.toLowerCase().includes(currentQuery.toLowerCase()))
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

	public renderSuggestion(contextSuggestion: ContextSuggestion, el: HTMLElement): void {
		el.textContent = contextSuggestion.display;
	}

	public selectSuggestion(contextSuggestion: ContextSuggestion): void {
		const currentValues = this.input.value.split(",").map((value: string) => value.trim());
		currentValues[currentValues.length - 1] = contextSuggestion.value;
		this.input.value = currentValues.join(", ") + ", ";
		this.input.dispatchEvent(new Event("input", { bubbles: true }));
		this.input.focus();
	}
}

interface TagSuggestion {
	value: string;
	display: string;
	type: "tag";
	toString(): string;
}

export class TagSuggest extends AbstractInputSuggest<TagSuggestion> {
	private plugin: TaskNotesPlugin;
	private input: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement, plugin: TaskNotesPlugin) {
		super(app, inputEl);
		this.plugin = plugin;
		this.input = inputEl;
	}

	protected async getSuggestions(_: string): Promise<TagSuggestion[]> {
		const currentValues = this.input.value.split(",").map((value: string) => value.trim());
		const currentQuery = currentValues[currentValues.length - 1];

		const tags = this.plugin.cacheManager.getAllTags();
		const alreadySelected = currentValues.slice(0, -1);
		return tags
			.filter((tag) => tag && typeof tag === "string")
			.filter(
				(tag) =>
					!alreadySelected.includes(tag) &&
					(!currentQuery || tag.toLowerCase().includes(currentQuery.toLowerCase()))
			)
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

	public renderSuggestion(tagSuggestion: TagSuggestion, el: HTMLElement): void {
		el.textContent = tagSuggestion.display;
	}

	public selectSuggestion(tagSuggestion: TagSuggestion): void {
		const currentValues = this.input.value.split(",").map((value: string) => value.trim());
		currentValues[currentValues.length - 1] = tagSuggestion.value;
		this.input.value = currentValues.join(", ") + ", ";
		this.input.dispatchEvent(new Event("input", { bubbles: true }));
		this.input.focus();
	}
}

interface UserFieldSuggestion {
	value: string;
	display: string;
	type: "user-field";
	fieldKey: string;
	toString(): string;
}

export class UserFieldSuggest extends AbstractInputSuggest<UserFieldSuggestion> {
	private plugin: TaskNotesPlugin;
	private input: HTMLInputElement;
	private fieldConfig: any;

	constructor(app: App, inputEl: HTMLInputElement, plugin: TaskNotesPlugin, fieldConfig: any) {
		super(app, inputEl);
		this.plugin = plugin;
		this.input = inputEl;
		this.fieldConfig = fieldConfig;
	}

	protected async getSuggestions(_: string): Promise<UserFieldSuggestion[]> {
		const isListField = this.fieldConfig.type === "list";
		let currentQuery = "";
		let currentValues: string[] = [];

		if (isListField) {
			currentValues = this.input.value.split(",").map((value: string) => value.trim());
			currentQuery = currentValues[currentValues.length - 1] || "";
		} else {
			currentQuery = this.input.value.trim();
		}
		if (!currentQuery) return [];

		const wikiMatch = currentQuery.match(/\[\[([^\]]*)$/);
		if (wikiMatch) {
			const partial = wikiMatch[1] || "";
			const { FileSuggestHelper } = await import("../suggest/FileSuggestHelper");
			const list = await FileSuggestHelper.suggest(
				this.plugin,
				partial,
				20,
				this.fieldConfig.autosuggestFilter
			);
			return list.map((item) => ({
				value: item.insertText,
				display: item.displayText,
				type: "user-field" as const,
				fieldKey: this.fieldConfig.key,
				toString() {
					return this.value;
				},
			}));
		}

		const existingValues = await this.getExistingUserFieldValues(this.fieldConfig.key);
		return existingValues
			.filter((value) => value && typeof value === "string")
			.filter(
				(value) =>
					value.toLowerCase().includes(currentQuery.toLowerCase()) &&
					(!isListField || !currentValues.slice(0, -1).includes(value))
			)
			.slice(0, 10)
			.map((value) => ({
				value,
				display: value,
				type: "user-field" as const,
				fieldKey: this.fieldConfig.key,
				toString() {
					return this.value;
				},
			}));
	}

	private async getExistingUserFieldValues(fieldKey: string): Promise<string[]> {
		const run = async (): Promise<string[]> => {
			try {
				const allFiles = this.plugin.app.vault.getMarkdownFiles();
				const values = new Set<string>();

				for (const file of allFiles) {
					try {
						const metadata = this.plugin.app.metadataCache.getFileCache(file);
						const frontmatter = metadata?.frontmatter;

						if (frontmatter && frontmatter[fieldKey] !== undefined) {
							const value = frontmatter[fieldKey];

							if (Array.isArray(value)) {
								value.forEach((item) => {
									if (typeof item === "string" && item.trim()) {
										values.add(item.trim());
									}
								});
							} else if (typeof value === "string" && value.trim()) {
								values.add(value.trim());
							} else if (typeof value === "number" || typeof value === "boolean") {
								values.add(value.toString());
							}
						}

						if (values.size >= 200) {
							break;
						}
					} catch {
						continue;
					}
				}

				return Array.from(values).sort();
			} catch (error) {
				console.error("Error getting user field values:", error);
				return [];
			}
		};

		const debounceMs = this.plugin.settings?.suggestionDebounceMs ?? 0;
		if (!debounceMs) {
			return run();
		}

		return new Promise<string[]>((resolve) => {
			const pluginWithTimer = this.plugin as unknown as { __userFieldSuggestTimer?: number };
			if (pluginWithTimer.__userFieldSuggestTimer) {
				window.clearTimeout(pluginWithTimer.__userFieldSuggestTimer);
			}
			pluginWithTimer.__userFieldSuggestTimer = window.setTimeout(async () => {
				resolve(await run());
			}, debounceMs);
		});
	}

	public renderSuggestion(suggestion: UserFieldSuggestion, el: HTMLElement): void {
		el.textContent = suggestion.display;
	}

	public selectSuggestion(suggestion: UserFieldSuggestion): void {
		const isListField = this.fieldConfig.type === "list";

		if (isListField) {
			const parts = this.input.value.split(",");
			const last = parts.pop() ?? "";
			const before = parts.join(",");
			const trimmed = last.trim();
			const replacement = /\[\[/.test(trimmed)
				? trimmed.replace(/\[\[[^\]]*$/, `[[${suggestion.value}]]`)
				: suggestion.value;
			const rebuilt = (before ? before + ", " : "") + replacement;
			this.input.value = rebuilt.endsWith(",") ? rebuilt + " " : rebuilt + ", ";
		} else {
			const value = this.input.value;
			const replaced = value.replace(/\[\[[^\]]*$/, `[[${suggestion.value}]]`);
			this.input.value = replaced === value ? suggestion.value : replaced;
		}

		this.input.dispatchEvent(new Event("input", { bubbles: true }));
		this.input.focus();
	}
}
