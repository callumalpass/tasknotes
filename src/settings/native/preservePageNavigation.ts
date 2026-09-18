import type { App, SettingDefinitionItem, SettingTab } from "obsidian";

type IndexedPage = { path: string[]; keys: string };

/** Native paths ignore groups, so identically named entries need distinct labels. */
export function makePageNamesUnique(items: SettingDefinitionItem[]): void {
	const pages: Extract<SettingDefinitionItem, { type: "page" }>[] = [];
	const collect = (entries: SettingDefinitionItem[]) =>
		entries.forEach((item) => {
			if (!("items" in item)) return;
			if (item.type === "page") pages.push(item);
			else collect(item.items ?? []);
		});
	collect(items);
	const used = new Set(pages.map((page) => page.name));
	const counts = new Map<string, number>();
	pages.forEach((page) => counts.set(page.name, (counts.get(page.name) ?? 0) + 1));
	for (const page of pages) {
		if ((counts.get(page.name) ?? 0) > 1) {
			let suffix = 1;
			while (used.has(`${page.name} (${suffix})`)) suffix++;
			page.name = `${page.name} (${suffix})`;
			used.add(page.name);
		}
		makePageNamesUnique(page.items ?? []);
	}
}
function indexPages(items: SettingDefinitionItem[], path: string[] = []): IndexedPage[] {
	const controls = (entries: SettingDefinitionItem[]): string[] =>
		entries.flatMap((item) =>
			"control" in item && item.control
				? [item.control.key]
				: "items" in item
					? controls(item.items ?? [])
					: []
		);
	return items.flatMap((item) => {
		if (!("items" in item)) return [];
		if (item.type !== "page") return indexPages(item.items ?? [], path);
		const pagePath = [...path, item.name];
		return [
			{
				path: pagePath,
				keys: controls(item.items ?? [])
					.sort()
					.join("\0"),
			},
			...indexPages(item.items ?? [], pagePath),
		];
	});
}

/**
 * Compatibility adapter for Obsidian 1.13's name-based declarative page paths.
 * The public API has no stable page IDs or navigation method. Without this,
 * update() while renaming a collection entry renders an empty current page.
 * Keep this internal dependency isolated and guarded; remove it when native
 * pages support stable IDs. SettingPage DOM and title are public API.
 */
export function preservePageNavigation(
	app: App,
	tab: SettingTab,
	previous: SettingDefinitionItem[],
	next: SettingDefinitionItem[]
): void {
	const settings = (
		app as unknown as {
			setting?: {
				activeTab?: SettingTab;
				pageStack?: {
					page?: { pagePath?: unknown; title: string; titlebarEl?: HTMLElement };
				}[];
			};
		}
	).setting;
	if (settings?.activeTab !== tab || !Array.isArray(settings.pageStack)) return;
	const before = indexPages(previous);
	const after = indexPages(next);
	for (const { page } of settings.pageStack) {
		if (
			!page ||
			!Array.isArray(page.pagePath) ||
			!page.pagePath.every((part) => typeof part === "string")
		)
			continue;
		const path = JSON.stringify(page.pagePath);
		const old = before.find((entry) => JSON.stringify(entry.path) === path);
		if (!old?.keys) continue;
		const candidates = after.filter(
			(entry) => entry.keys === old.keys && entry.path.length === old.path.length
		);
		const replacement =
			candidates.find((entry) => JSON.stringify(entry.path) === path) ??
			(candidates.length === 1 ? candidates[0] : undefined);
		if (!replacement || JSON.stringify(replacement.path) === path) continue;
		page.pagePath = [...replacement.path];
		page.title = replacement.path[replacement.path.length - 1];
		page.titlebarEl?.querySelector(".setting-page-title")?.setText(page.title);
	}
}
