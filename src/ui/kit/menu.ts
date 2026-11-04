import type { Menu, MenuItem } from "obsidian";
import { keyLabel, shouldShowKeyHints, TASK_KEYBOARD_MAP } from "./keyHint";
import { renderPriorityGlyph, priorityGlyphState } from "./glyphs";
import type { PriorityConfig } from "../../types";

export function renderPriorityMenuGlyph(item: MenuItem, value: string | undefined, priorities: readonly PriorityConfig[]): void {
	item.setIcon("signal");
	const nativeItem = item as unknown as { dom?: HTMLElement; domEl?: HTMLElement };
	const host = (nativeItem.dom ?? nativeItem.domEl)?.querySelector<HTMLElement>(".menu-item-icon");
	if (!host) return;
	const config = priorities.find((priority) => priority.value === value);
	if (!config?.icon) renderPriorityGlyph(host, priorityGlyphState(value, priorities));
	else item.setIcon(config.icon);
	if (config?.color) host.style.color = config.color;
}

export function renderTaskMenuKeyHint(
	item: MenuItem,
	action: keyof typeof TASK_KEYBOARD_MAP
): void {
	const nativeItem = item as unknown as { dom?: HTMLElement; domEl?: HTMLElement };
	const element = nativeItem.dom ?? nativeItem.domEl;
	if (!element) return;
	if (!shouldShowKeyHints(element.ownerDocument)) return;
	const shortcut =
		element.querySelector<HTMLElement>(".menu-item-shortcut") ??
		element.createDiv({ cls: "menu-item-shortcut" });
	shortcut.textContent = TASK_KEYBOARD_MAP[action].split("+").map(keyLabel).join("");
}

export function renderUnconfiguredMenuValue(
	menu: Menu,
	value: string | undefined,
	options: readonly { value: string }[]
): void {
	if (!value || options.some((option) => option.value === value)) return;
	menu.addItem((item) => item.setTitle(value).setChecked(true).setDisabled(true));
	menu.addSeparator();
}
