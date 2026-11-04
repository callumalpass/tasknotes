import type { Menu, MenuItem } from "obsidian";
import { keyLabel, TASK_KEYBOARD_MAP } from "./keyHint";

export function renderTaskMenuKeyHint(
	item: MenuItem,
	action: keyof typeof TASK_KEYBOARD_MAP
): void {
	const nativeItem = item as unknown as { dom?: HTMLElement; domEl?: HTMLElement };
	const element = nativeItem.dom ?? nativeItem.domEl;
	if (!element) return;
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
