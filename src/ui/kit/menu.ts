import type { Menu, MenuItem } from "obsidian";
import { keyLabel, TASK_KEYBOARD_MAP } from "./keyHint";
import { priorityGlyphState, renderPriorityGlyph, unconfiguredValueLabel } from "./glyphs";
import type { PriorityConfig } from "../../types";

export function renderPriorityMenuGlyph(
	item: MenuItem,
	priority: { value?: string; icon?: string; color?: string },
	priorities: readonly PriorityConfig[]
): void {
	item.setIcon(priority.icon || "signal");
	window.setTimeout(() => {
		const nativeItem = item as unknown as { dom?: HTMLElement; domEl?: HTMLElement };
		const host = (nativeItem.dom ?? nativeItem.domEl)?.querySelector<HTMLElement>(
			".menu-item-icon"
		);
		if (!host) return;
		host.classList.add("tasknotes-plugin");
		host.style.color = priority.color || "var(--text-muted)";
		if (!priority.icon)
			renderPriorityGlyph(host, priorityGlyphState(priority.value, priorities));
	}, 10);
}

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
	menu.addItem((item) =>
		item
			.setTitle(unconfiguredValueLabel(value))
			.setIcon("badge-help")
			.setChecked(true)
			.setDisabled(true)
	);
	menu.addSeparator();
}
