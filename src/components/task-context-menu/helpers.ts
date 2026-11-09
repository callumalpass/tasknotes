import { Menu, TFile, type MenuItem } from "obsidian";

type SubmenuMenuItem = {
	setSubmenu(): Menu;
	dom?: HTMLElement;
	domEl?: HTMLElement;
};
export type FileExplorerView = {
	revealInFolder(file: TFile): void;
};
export type TaskStatusOption = {
	label: string;
	value: string;
	color?: string;
	icon?: string;
};
function normalizeContextValue(value: string): string {
	return value.trim();
}
export function normalizeContextList(contexts: string[] | undefined): string[] {
	const seen = new Set<string>();
	const normalized: string[] = [];

	for (const context of contexts ?? []) {
		if (typeof context !== "string") continue;
		const value = normalizeContextValue(context);
		if (!value || seen.has(value)) continue;
		seen.add(value);
		normalized.push(value);
	}

	return normalized;
}
export function addContextToList(
	contexts: string[] | undefined,
	context: string
): string[] | undefined {
	const value = normalizeContextValue(context);
	const current = normalizeContextList(contexts);
	if (!value) return current.length > 0 ? current : undefined;
	if (current.includes(value)) return current;
	return [...current, value];
}
export function removeContextFromList(
	contexts: string[] | undefined,
	context: string
): string[] | undefined {
	const value = normalizeContextValue(context);
	const remaining = normalizeContextList(contexts).filter((entry) => entry !== value);
	return remaining.length > 0 ? remaining : undefined;
}
export function toggleContextInList(
	contexts: string[] | undefined,
	context: string
): string[] | undefined {
	const value = normalizeContextValue(context);
	const current = normalizeContextList(contexts);
	if (!value) return current.length > 0 ? current : undefined;
	return current.includes(value)
		? removeContextFromList(current, value)
		: addContextToList(current, value);
}
export function getSubmenu(item: MenuItem): Menu {
	return (item as unknown as SubmenuMenuItem).setSubmenu();
}
export function getMenuItemElement(item: MenuItem): HTMLElement | null {
	const menuItem = item as unknown as SubmenuMenuItem;
	return menuItem.dom ?? menuItem.domEl ?? null;
}
export function toMenuTitle(value: unknown, fallback = ""): string {
	const text =
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean" ||
		typeof value === "bigint"
			? String(value)
			: "";
	const trimmed = text.trim();
	return trimmed.length > 0 ? trimmed : fallback;
}
