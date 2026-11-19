import { Menu, type MenuItem } from "obsidian";

type SubmenuMenuItem = {
	setSubmenu(): Menu;
	dom?: HTMLElement;
	domEl?: HTMLElement;
};
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
/**
 * Where to open a picker chosen from a menu item: over the item, which the
 * menu removes as it closes, else at the pointer.
 */
export function menuItemAnchor(item: MenuItem, event: MouseEvent | KeyboardEvent): { x: number; y: number } {
	const rect = getMenuItemElement(item)?.getBoundingClientRect();
	if (rect && (rect.width || rect.height)) return { x: rect.left, y: rect.top };
	if ("clientX" in event && (event.clientX || event.clientY)) return { x: event.clientX, y: event.clientY };
	const selected = activeDocument.querySelector(".menu .menu-item.selected")?.getBoundingClientRect();
	return selected ? { x: selected.left, y: selected.top } : { x: activeWindow.innerWidth / 3, y: activeWindow.innerHeight / 3 };
}
