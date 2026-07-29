import type { Modifier } from "obsidian";

export const TASK_LIST_KEYBOARD_ACTIONS = [
	"navigate-next",
	"navigate-previous",
	"jump-first",
	"jump-last",
	"clear-focus-and-selection",
	"toggle-select",
	"select-all",
	"copy-task-titles",
	"toggle-archive",
	"create-task",
	"focus-search",
	"edit-task",
	"open-task-notes",
	"edit-due",
	"edit-scheduled",
	"edit-priority",
	"edit-status",
	"edit-recurrence",
	"add-tags",
	"add-context",
	"add-project",
	"delete-tasks",
] as const;

export type TaskListKeyboardAction = (typeof TASK_LIST_KEYBOARD_ACTIONS)[number];
export type TaskListShortcutMap = Record<TaskListKeyboardAction, string[]>;

export type TaskListScopeBinding = {
	modifiers: Modifier[];
	key: string;
};

export const DEFAULT_TASK_LIST_SHORTCUTS: TaskListShortcutMap = {
	"navigate-next": ["arrowdown"],
	"navigate-previous": ["arrowup"],
	"jump-first": ["home"],
	"jump-last": ["end"],
	"clear-focus-and-selection": ["escape", "backspace"],
	"toggle-select": ["space"],
	"select-all": ["mod+a"],
	"copy-task-titles": ["mod+c"],
	"toggle-archive": ["y"],
	"create-task": ["c"],
	"focus-search": ["slash"],
	"edit-task": ["enter"],
	"open-task-notes": ["shift+enter"],
	"edit-due": ["d"],
	"edit-scheduled": ["shift+s"],
	"edit-priority": ["p"],
	"edit-status": ["s"],
	"edit-recurrence": ["r"],
	"add-tags": ["shift+#"],
	"add-context": ["shift+@"],
	"add-project": ["shift+plus"],
	"delete-tasks": ["mod+delete"],
};

const MODIFIER_ALIASES: Record<string, "mod" | "ctrl" | "meta" | "alt" | "shift"> = {
	mod: "mod",
	ctrl: "mod",
	control: "mod",
	cmd: "mod",
	command: "mod",
	meta: "mod",
	alt: "alt",
	option: "alt",
	shift: "shift",
};

const KEY_ALIASES: Record<string, string> = {
	"/": "slash",
	"+": "plus",
	" ": "space",
	spacebar: "space",
	esc: "escape",
	del: "delete",
	return: "enter",
	"arrow down": "arrowdown",
	"arrow up": "arrowup",
};

const MODIFIER_ORDER = ["mod", "ctrl", "meta", "alt", "shift"] as const;

function normalizeKey(rawKey: string): string {
	if (rawKey === " ") return "space";
	const key = rawKey.trim().toLowerCase();
	return KEY_ALIASES[key] ?? key;
}

export function normalizeTaskListShortcut(raw: string): string | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;

	const rawParts = trimmed === "+" ? ["+"] : trimmed.split("+");
	const modifiers = new Set<(typeof MODIFIER_ORDER)[number]>();
	let key = "";

	for (const rawPart of rawParts) {
		const part = rawPart.trim().toLowerCase();
		const modifier = MODIFIER_ALIASES[part];
		if (modifier) {
			modifiers.add(modifier);
		} else if (part || rawPart === "") {
			key = normalizeKey(part || "+");
		}
	}

	if (!key || KEY_ALIASES[key] === "") return null;
	const orderedModifiers = MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier));
	return [...orderedModifiers, key].join("+");
}

export function keyboardEventToTaskListShortcut(
	event: Pick<
		KeyboardEvent,
		"key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "isComposing"
	>
): string | null {
	if (
		event.isComposing ||
		event.key === "Process" ||
		["Shift", "Control", "Alt", "Meta"].includes(event.key)
	) {
		return null;
	}

	const modifiers: string[] = [];
	if (event.ctrlKey || event.metaKey) modifiers.push("mod");
	if (event.altKey) modifiers.push("alt");
	if (event.shiftKey) modifiers.push("shift");
	return normalizeTaskListShortcut([...modifiers, normalizeKey(event.key)].join("+"));
}

export function normalizeTaskListShortcutMap(
	shortcuts: Partial<Record<TaskListKeyboardAction, readonly string[]>> | null | undefined
): TaskListShortcutMap {
	return Object.fromEntries(
		TASK_LIST_KEYBOARD_ACTIONS.map((action) => {
			const configured = shortcuts?.[action];
			const values = Array.isArray(configured)
				? configured
				: DEFAULT_TASK_LIST_SHORTCUTS[action];
			const normalized = values
				.map(normalizeTaskListShortcut)
				.filter((shortcut): shortcut is string => Boolean(shortcut));
			return [action, [...new Set(normalized)]];
		})
	) as TaskListShortcutMap;
}

export function findTaskListShortcutConflicts(
	shortcuts: TaskListShortcutMap
): Map<string, TaskListKeyboardAction[]> {
	const actionsByShortcut = new Map<string, TaskListKeyboardAction[]>();
	for (const action of TASK_LIST_KEYBOARD_ACTIONS) {
		for (const shortcut of shortcuts[action]) {
			const actions = actionsByShortcut.get(shortcut) ?? [];
			actions.push(action);
			actionsByShortcut.set(shortcut, actions);
		}
	}
	return new Map([...actionsByShortcut].filter(([, actions]) => actions.length > 1));
}

export function findTaskListShortcutOwners(
	shortcuts: TaskListShortcutMap,
	shortcut: string,
	excludeAction?: TaskListKeyboardAction
): TaskListKeyboardAction[] {
	return TASK_LIST_KEYBOARD_ACTIONS.filter(
		(action) => action !== excludeAction && shortcuts[action].includes(shortcut)
	);
}

export function replaceTaskListShortcut(
	shortcuts: TaskListShortcutMap,
	action: TaskListKeyboardAction,
	shortcut: string
): TaskListShortcutMap {
	return Object.fromEntries(
		TASK_LIST_KEYBOARD_ACTIONS.map((candidate) => [
			candidate,
			candidate === action
				? [...new Set([...shortcuts[candidate], shortcut])]
				: shortcuts[candidate].filter((value) => value !== shortcut),
		])
	) as TaskListShortcutMap;
}

export function resolveTaskListKeyboardAction(
	event: Pick<
		KeyboardEvent,
		"key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "isComposing"
	>,
	shortcuts: TaskListShortcutMap = DEFAULT_TASK_LIST_SHORTCUTS
): TaskListKeyboardAction | null {
	const shortcut = keyboardEventToTaskListShortcut(event);
	if (!shortcut) return null;

	for (const action of TASK_LIST_KEYBOARD_ACTIONS) {
		if (shortcuts[action]?.includes(shortcut)) return action;
	}
	return null;
}

export function taskListShortcutToScopeBinding(
	shortcut: string
): TaskListScopeBinding | null {
	const normalized = normalizeTaskListShortcut(shortcut);
	if (!normalized) return null;

	const parts = normalized.split("+");
	const keyPart = parts.pop();
	if (!keyPart) return null;

	const modifierNames: Record<string, Modifier> = {
		mod: "Mod",
		ctrl: "Ctrl",
		meta: "Meta",
		alt: "Alt",
		shift: "Shift",
	};
	const modifiers: Modifier[] = [];
	for (const part of parts) {
		const modifier = modifierNames[part];
		if (!modifier) return null;
		modifiers.push(modifier);
	}

	const keyNames: Record<string, string> = {
		slash: "/",
		plus: "+",
		space: " ",
		enter: "Enter",
		delete: "Delete",
		escape: "Escape",
		home: "Home",
		end: "End",
		arrowdown: "ArrowDown",
		arrowup: "ArrowUp",
	};
	return {
		modifiers,
		key: keyNames[keyPart] ?? keyPart,
	};
}

/** Kept as a compatibility alias for tests and callers from the earlier port slices. */
export const resolveDefaultTaskListKeyboardAction = resolveTaskListKeyboardAction;

export function formatTaskListShortcut(shortcut: string, isMacOS: boolean): string {
	const symbols: Record<string, string> = isMacOS
		? { mod: "⌘", ctrl: "⌃", meta: "⌘", alt: "⌥", shift: "⇧" }
		: { mod: "Ctrl", ctrl: "Ctrl", meta: "Meta", alt: "Alt", shift: "Shift" };
	const keyLabels: Record<string, string> = {
		slash: "/",
		plus: "+",
		space: "Space",
		enter: "Enter",
		delete: "Delete",
		escape: "Esc",
		home: "Home",
		end: "End",
		arrowdown: "↓",
		arrowup: "↑",
	};
	const separator = isMacOS ? "" : "+";
	return shortcut
		.split("+")
		.map((part) => symbols[part] ?? keyLabels[part] ?? part.toUpperCase())
		.join(separator);
}
