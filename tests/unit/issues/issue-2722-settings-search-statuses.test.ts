import type { SettingDefinition, SettingDefinitionItem } from "obsidian";
import { settingsFixture, list } from "../../helpers/native-settings";

interface IndexedEntry {
	definition: SettingDefinition;
	pagePath: string[];
}

function isEnabled(flag: boolean | (() => boolean) | undefined): boolean {
	if (flag === undefined) return true;
	return typeof flag === "function" ? flag() : flag;
}

/**
 * Mirrors Obsidian's native settings search indexer:
 * - Recurses into visible pages, groups, and lists
 * - Indexes only visible, searchable leaf SettingDefinitions (name, desc, aliases)
 * - Does NOT index group/list headings, list addItem labels, or page descriptions
 */
function collectSearchableDefinitions(
	items: SettingDefinitionItem[],
	pagePath: string[] = []
): IndexedEntry[] {
	const results: IndexedEntry[] = [];
	for (const item of items) {
		if ("type" in item && item.type === "page") {
			if (!isEnabled(item.visible)) continue;
			if (item.items) {
				results.push(...collectSearchableDefinitions(item.items, [...pagePath, item.name]));
			}
		} else if ("type" in item && (item.type === "group" || item.type === "list")) {
			if (!isEnabled(item.visible)) continue;
			if (item.items) {
				results.push(...collectSearchableDefinitions(item.items, pagePath));
			}
		} else {
			if (!isEnabled(item.visible) || !isEnabled(item.searchable)) continue;
			results.push({ definition: item, pagePath });
		}
	}
	return results;
}

function matchesSimpleSearch(text: string, query: string): boolean {
	const haystack = text.toLowerCase();
	const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	return tokens.length > 0 && tokens.every((token) => haystack.includes(token));
}

function searchDefinitions(items: SettingDefinitionItem[], query: string): IndexedEntry[] {
	return collectSearchableDefinitions(items).filter(({ definition }) => {
		const desc =
			typeof definition.desc === "string"
				? definition.desc
				: definition.desc?.textContent ?? "";
		const fields = [definition.name, desc, ...(definition.aliases ?? [])];
		return fields.some((field) => matchesSimpleSearch(field, query));
	});
}

describe("issue #2722 settings search indexes statuses and priorities", () => {
	test.each([
		"status",
		"statuses",
		"task statuses",
		"custom statuses",
		"status list",
		"add status",
	])("indexes the status settings section for query %j", (query) => {
		const { tab } = settingsFixture();
		const matches = searchDefinitions(tab.getSettingDefinitions(), query);
		expect(matches).toContainEqual(
			expect.objectContaining({
				pagePath: ["Properties", "Status"],
				definition: expect.objectContaining({ name: "Task statuses" }),
			})
		);
	});

	test.each([
		"priority",
		"priorities",
		"task priorities",
		"custom priorities",
		"priority list",
		"add priority",
	])("indexes the priority settings section for query %j", (query) => {
		const { tab } = settingsFixture();
		const matches = searchDefinitions(tab.getSettingDefinitions(), query);
		expect(matches).toContainEqual(
			expect.objectContaining({
				pagePath: ["Properties", "Priority"],
				definition: expect.objectContaining({ name: "Task priorities" }),
			})
		);
	});

	test("keeps status and priority sections searchable even with a single configured value", () => {
		const { plugin, tab } = settingsFixture();
		plugin.settings.customStatuses = [plugin.settings.customStatuses[0]];
		plugin.settings.customPriorities = [plugin.settings.customPriorities[0]];
		const definitions = tab.getSettingDefinitions();

		expect(searchDefinitions(definitions, "statuses")).toContainEqual(
			expect.objectContaining({
				pagePath: ["Properties", "Status"],
				definition: expect.objectContaining({ name: "Task statuses" }),
			})
		);
		expect(searchDefinitions(definitions, "priorities")).toContainEqual(
			expect.objectContaining({
				pagePath: ["Properties", "Priority"],
				definition: expect.objectContaining({ name: "Task priorities" }),
			})
		);
	});

	test("indexes localized status and priority headings and names", () => {
		const { plugin, tab } = settingsFixture();
		plugin.i18n.setLocale("de");
		const definitions = tab.getSettingDefinitions();

		expect(searchDefinitions(definitions, "Statuswerte")).toContainEqual(
			expect.objectContaining({
				definition: expect.objectContaining({ name: "Aufgabenstatus" }),
			})
		);
		expect(searchDefinitions(definitions, "Prioritäten")).toContainEqual(
			expect.objectContaining({
				definition: expect.objectContaining({ name: "Aufgabenprioritäten" }),
			})
		);
	});

	test("preserves page-only list entries for statuses and priorities", () => {
		const { plugin, tab } = settingsFixture();
		const definitions = tab.getSettingDefinitions();

		const statusesList = list(definitions, "Statuses");
		expect(statusesList.items).toHaveLength(plugin.settings.customStatuses.length);
		expect(statusesList.items?.every((item) => "type" in item && item.type === "page")).toBe(
			true
		);

		const prioritiesList = list(definitions, "Priorities");
		expect(prioritiesList.items).toHaveLength(plugin.settings.customPriorities.length);
		expect(prioritiesList.items?.every((item) => "type" in item && item.type === "page")).toBe(
			true
		);
	});
});
