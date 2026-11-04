import { msg } from "@lingui/core/macro";
import { Platform } from "obsidian";
import { uiText } from "../../i18n/runtime";

const MAC_KEYS: Record<string, string> = { Mod: "⌘", Alt: "⌥", Shift: "⇧", Ctrl: "⌃" };
const SYMBOL_KEYS: Record<string, string> = {
	Enter: "↵",
	ArrowUp: "↑",
	ArrowDown: "↓",
	Backspace: "⌫",
};

export const TASK_KEYBOARD_MAP = {
	open: "Enter",
	edit: "E",
	status: "S",
	priority: "P",
	due: "D",
	scheduled: "H",
	tags: "T",
	create: "C",
	actions: "Mod+K",
	save: "Mod+Enter",
	createMore: "Mod+Shift+Enter",
} as const;

/** Key names read at call time so they follow the active locale. */
function namedKey(key: string): string | undefined {
	switch (key) {
		case "Mod":
		case "Ctrl":
			return uiText(msg({ message: "Ctrl", context: "keyboard key name" }));
		case "Alt":
			return uiText(msg({ message: "Alt", context: "keyboard key name" }));
		case "Shift":
			return uiText(msg({ message: "Shift", context: "keyboard key name" }));
		case "Escape":
			return uiText(msg({ message: "Esc", context: "keyboard key name" }));
		case "Space":
			return uiText(msg({ message: "Space", context: "keyboard key name" }));
		default:
			return undefined;
	}
}

export function keyLabel(key: string): string {
	const mac = Platform.isMacOS ? MAC_KEYS[key] : undefined;
	return mac ?? SYMBOL_KEYS[key] ?? namedKey(key) ?? (key.length === 1 ? key.toUpperCase() : key);
}

/** Renders keycaps for a combo such as "Mod+K" or "Shift+J". */
export function renderKeyHint(container: HTMLElement, combo: string): HTMLElement {
	const hint = container.createSpan({ cls: "tn-key-hint", attr: { "aria-hidden": "true" } });
	for (const key of combo.split("+")) {
		hint.createEl("kbd", { cls: "tn-key", text: keyLabel(key) });
	}
	return hint;
}
