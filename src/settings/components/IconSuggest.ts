/**
 * Lucide icon suggestions for settings inputs, from Obsidian's getIconIds().
 */

import { App, AbstractInputSuggest, getIconIds, setIcon } from "obsidian";

const LUCIDE_PREFIX = "lucide-";

/** Icons offered before the user types: shapes that suit statuses and priorities. */
const STARTER_ICONS = [
	"circle",
	"circle-dot",
	"circle-dashed",
	"circle-check",
	"circle-x",
	"circle-pause",
	"circle-alert",
	"flag",
	"star",
	"flame",
	"zap",
	"arrow-up",
	"arrow-down",
	"chevrons-up",
	"chevron-up",
	"minus",
	"clock",
	"hourglass",
	"eye",
	"ban",
];

/** Settings store Lucide names without Obsidian's "lucide-" prefix; setIcon accepts both. */
export function iconSettingName(id: string): string {
	return id.startsWith(LUCIDE_PREFIX) ? id.slice(LUCIDE_PREFIX.length) : id;
}

/** Every icon name the setting accepts, without duplicates. */
function availableIconNames(): string[] {
	return Array.from(new Set(getIconIds().map(iconSettingName)));
}

export function isKnownIcon(name: string): boolean {
	const trimmed = iconSettingName(name.trim());
	return trimmed !== "" && availableIconNames().includes(trimmed);
}

/** Matches by name, with names that start with the query first. */
export function matchIconNames(query: string, names: readonly string[]): string[] {
	const needle = iconSettingName(query.trim().toLowerCase());
	if (!needle) {
		const available = new Set(names);
		return STARTER_ICONS.filter((name) => available.has(name));
	}
	const prefix: string[] = [];
	const contains: string[] = [];
	for (const name of names) {
		const lower = name.toLowerCase();
		if (lower.startsWith(needle)) prefix.push(name);
		else if (lower.includes(needle)) contains.push(name);
	}
	const byName = (a: string, b: string) => a.length - b.length || a.localeCompare(b);
	return [...prefix.sort(byName), ...contains.sort(byName)];
}

export class IconSuggest extends AbstractInputSuggest<string> {
	constructor(
		app: App,
		private readonly inputEl: HTMLInputElement
	) {
		super(app, inputEl);
		this.limit = 50;
	}

	protected getSuggestions(query: string): string[] {
		return matchIconNames(query, availableIconNames());
	}

	renderSuggestion(name: string, el: HTMLElement): void {
		el.addClass("tn-icon-suggestion");
		setIcon(el.createSpan({ cls: "tn-icon-suggestion__icon" }), name);
		el.createSpan({ cls: "tn-icon-suggestion__name", text: name });
	}

	selectSuggestion(name: string): void {
		this.setValue(name);
		this.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
		this.close();
	}
}
