import { msg } from "@lingui/core/macro";
import { Scope, Notice } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { uiText } from "../i18n/runtime";
import { TaskActionPaletteModal, type TaskAction } from "../modals/TaskActionPaletteModal";
import { openPopover } from "./kit/popover";
import { renderKeyHint } from "./kit/keyHint";
import {
	archiveTasksWithUndo,
	openTaskPropertyPicker,
	taskPropertyLabel,
	type TaskPickerProperty,
} from "./taskPropertyPickers";

const PROPERTY_KEYS: Record<string, TaskPickerProperty> = {
	s: "status",
	p: "priority",
	d: "due",
	h: "scheduled",
	t: "tags",
};

export interface TaskViewKeyboardOptions {
	plugin: TaskNotesPlugin;
	root: HTMLElement;
	paths: () => string[];
	reveal: (path: string) => void;
	create: () => void;
	search: () => void;
	refreshSelection: () => void;
}

export function installTaskViewKeyboard(options: TaskViewKeyboardOptions): () => void {
	const { plugin, root } = options;
	let focusedPath: string | null = null;
	let rangeAnchor: string | null = null;
	let rangeBase: string[] = [];
	let keyboardFocus = false;
	let pending = false;
	const selection = plugin.taskSelectionService;
	const scope = new Scope(plugin.app.scope);
	let scoped = false;
	const releaseScope = () => {
		if (scoped) plugin.app.keymap.popScope(scope);
		scoped = false;
	};
	const focusScope = () => {
		releaseScope();
		const target = root.ownerDocument.activeElement;
		if (
			!target ||
			!root.contains(target) ||
			target.closest("input, textarea, select, [contenteditable]")
		)
			return;
		plugin.app.keymap.pushScope(scope);
		scoped = true;
	};
	const cardFor = (path: string) =>
		Array.from(root.querySelectorAll<HTMLElement>(".task-card[data-task-path]")).find(
			(card) => card.dataset.taskPath === path
		);
	const paint = () => {
		options.refreshSelection();
		root.querySelectorAll(".tn-task-focused").forEach((card) =>
			card.classList.remove("tn-task-focused")
		);
		if (!focusedPath) return;
		const card = cardFor(focusedPath);
		if (keyboardFocus) card?.classList.add("tn-task-focused");
	};
	const observer = new MutationObserver(paint);
	observer.observe(root, { childList: true, subtree: true });
	const pointer = (event: PointerEvent) => {
		const target = event.target as HTMLElement;
		const card = target.closest<HTMLElement>(".task-card[data-task-path]");
		if (!card) return;
		focusedPath = card.dataset.taskPath ?? null;
		rangeAnchor = null;
		keyboardFocus = false;
		paint();
		if (!target.closest("button, a, input, textarea, select, [contenteditable], [role=button]"))
			root.focus({ preventScroll: true });
	};
	const help = () => {
		const overlay = openPopover({ anchor: root });
		overlay.el.setAttribute("role", "dialog");
		overlay.el.setAttribute(
			"aria-label",
			uiText(msg({ message: "Keyboard shortcuts", context: "interaction help" }))
		);
		const list = overlay.el.createDiv({ cls: "tn-picker__list" });
		for (const [key, label] of [
			["ArrowUp", uiText(msg({ message: "Move focus", context: "interaction shortcut" }))],
			["ArrowDown", uiText(msg({ message: "Move focus", context: "interaction shortcut" }))],
			["K", uiText(msg({ message: "Move focus", context: "interaction shortcut" }))],
			["J", uiText(msg({ message: "Move focus", context: "interaction shortcut" }))],
			[
				"Shift+ArrowDown",
				uiText(msg({ message: "Extend selection", context: "interaction shortcut" })),
			],
			["X", uiText(msg({ message: "Toggle selection", context: "interaction shortcut" }))],
			[
				"Escape",
				uiText(msg({ message: "Clear selection", context: "interaction shortcut" })),
			],
			["Enter", uiText(msg({ message: "Open task", context: "interaction shortcut" }))],
			["E", uiText(msg({ message: "Edit task", context: "interaction shortcut" }))],
			["Space", uiText(msg({ message: "Preview", context: "interaction shortcut" }))],
			...Object.entries(PROPERTY_KEYS).map(([key, property]) => [
				key,
				taskPropertyLabel(property),
			]),
			["C", uiText(msg({ message: "Create task", context: "interaction shortcut" }))],
			["/", uiText(msg({ message: "Search", context: "interaction shortcut" }))],
			["Mod+K", uiText(msg({ message: "Actions", context: "interaction shortcut" }))],
		]) {
			const row = list.createDiv({ cls: "tn-picker__row" });
			row.createSpan({ text: label });
			renderKeyHint(row, key);
		}
		list.tabIndex = 0;
		list.focus();
		overlay.reposition();
	};
	const handle = async (event: KeyboardEvent) => {
		const target = event.target as HTMLElement;
		if (
			event.defaultPrevented ||
			event.isComposing ||
			event.altKey ||
			target.closest(
				"input, textarea, select, [contenteditable]:not([contenteditable=false]), .cm-editor"
			)
		)
			return;
		const key = event.key.toLowerCase();
		const mod = event.metaKey || event.ctrlKey;
		if (mod && key !== "k" && key !== "a") return;
		if (
			event.shiftKey &&
			!["arrowup", "arrowdown", "arrowleft", "arrowright", "j", "k", "?"].includes(key)
		)
			return;
		if (
			!mod &&
			![
				"arrowup",
				"arrowdown",
				"arrowleft",
				"arrowright",
				"j",
				"k",
				"x",
				"escape",
				"enter",
				"e",
				" ",
				"s",
				"p",
				"d",
				"h",
				"t",
				"c",
				"/",
				"?",
			].includes(key)
		)
			return;
		event.preventDefault();
		event.stopPropagation();
		root.focus({ preventScroll: true });
		const paths = options.paths();
		if (key === "?" && !mod) {
			help();
			return;
		}
		if (key === "c" && !mod) {
			options.create();
			return;
		}
		if (key === "/") {
			options.search();
			return;
		}
		if (key === "escape") {
			if (selection.getSelectionCount()) {
				selection.clearSelection();
				selection.exitSelectionMode();
			} else {
				focusedPath = null;
				keyboardFocus = false;
			}
			rangeAnchor = null;
			paint();
			return;
		}
		if (mod && key === "a") {
			selection.enterSelectionMode();
			selection.selectAll(paths);
			return;
		}
		if (!mod && ["arrowup", "arrowdown", "arrowleft", "arrowright", "j", "k"].includes(key)) {
			const direction = ["arrowup", "arrowleft", "k"].includes(key) ? -1 : 1;
			const currentIndex = focusedPath ? paths.indexOf(focusedPath) : -1;
			const index =
				currentIndex < 0
					? direction > 0
						? 0
						: paths.length - 1
					: Math.max(0, Math.min(paths.length - 1, currentIndex + direction));
			const next = paths[index];
			if (!next) return;
			if (event.shiftKey) {
				if (!rangeAnchor) {
					rangeAnchor = focusedPath ?? next;
					rangeBase = selection.getSelectedPaths();
				}
				const anchorIndex = Math.max(0, paths.indexOf(rangeAnchor));
				selection.enterSelectionMode();
				selection.clearSelection();
				selection.selectAll([
					...new Set([
						...rangeBase,
						...paths.slice(
							Math.min(anchorIndex, index),
							Math.max(anchorIndex, index) + 1
						),
					]),
				]);
			} else rangeAnchor = null;
			focusedPath = next;
			keyboardFocus = true;
			options.reveal(next);
			cardFor(next)?.scrollIntoView({ block: "nearest", inline: "nearest" });
			paint();
			return;
		}
		focusedPath ??= paths[0] ?? null;
		if (!focusedPath) return;
		if (key === "x") {
			rangeAnchor = null;
			selection.toggleSelection(focusedPath);
			paint();
			return;
		}
		if (pending || event.repeat) return;
		pending = true;
		try {
			const selected = selection.getSelectedPaths().filter((path) => paths.includes(path));
			const taskPaths = selected.length ? selected : [focusedPath];
			const tasks = (
				await Promise.all(taskPaths.map((path) => plugin.cacheManager.getTaskInfo(path)))
			).filter((task): task is TaskInfo => !!task);
			const task = await plugin.cacheManager.getTaskInfo(focusedPath);
			if (!task) return;
			const anchor = cardFor(focusedPath) ?? root;
			if (mod && key === "k") {
				new TaskActionPaletteModal(plugin.app, task, plugin, new Date(), (existing) => {
					const properties: TaskAction[] = [
						"status",
						"priority",
						"due",
						"scheduled",
						"tags",
						"contexts",
						"projects",
					].map((value) => {
						const property = value as TaskPickerProperty;
						return {
							id: `picker-${property}`,
							title: taskPropertyLabel(property),
							description: "",
							icon: "list",
							category: "other",
							keywords: [property],
							keyHint: Object.entries(PROPERTY_KEYS).find(
								([, candidate]) => candidate === property
							)?.[0],
							isApplicable: () => true,
							execute: () => openTaskPropertyPicker(plugin, property, tasks, anchor),
						};
					});
					return [
						...properties,
						{
							id: "archive-selection",
							title: task.archived
								? uiText(
										msg({
											message: "Unarchive task",
											context:
												"modals/TaskActionPaletteModal: TaskActionPaletteModal.buildActionsList title",
										})
									)
								: uiText(
										msg({ message: "Archive", context: "interaction archive" })
									),
							description: "",
							icon: "archive",
							keyHint: "Enter",
							category: "organization",
							keywords: [],
							isApplicable: () => true,
							execute: () => archiveTasksWithUndo(plugin, tasks, !task.archived),
						},
						...existing
							.filter(
								(action) =>
									tasks.length === 1 &&
									!["status", "priority", "dates"].includes(action.category) &&
									!action.id.includes("archive")
							)
							.map((action) => ({
								...action,
								keyHint: action.id === "edit-task" ? "E" : "Enter",
							})),
					];
				}).open();
			} else if (PROPERTY_KEYS[key])
				await openTaskPropertyPicker(plugin, PROPERTY_KEYS[key], tasks, anchor);
			else if (key === "e") await plugin.openTaskEditModal(task);
			else if (key === "enter") await plugin.app.workspace.openLinkText(task.path, "", false);
			else if (key === " ") {
				plugin.app.workspace.trigger("hover-link", {
					event: new MouseEvent("mouseover"),
					source: "tasknotes-task-card",
					hoverParent: root,
					targetEl: anchor,
					linktext: task.path,
					sourcePath: task.path,
				});
			}
		} catch {
			new Notice(
				uiText(msg({ message: "Could not update tasks", context: "interaction failure" }))
			);
		} finally {
			pending = false;
		}
	};
	const listener = (event: KeyboardEvent) => {
		void handle(event);
	};
	scope.register(["Mod"], "k", (event) => {
		void handle(event);
		return false;
	});
	root.addEventListener("focusin", focusScope);
	root.addEventListener("focusout", releaseScope);
	root.addEventListener("keydown", listener);
	root.addEventListener("pointerdown", pointer);
	return () => {
		releaseScope();
		root.removeEventListener("focusin", focusScope);
		root.removeEventListener("focusout", releaseScope);
		observer.disconnect();
		root.removeEventListener("keydown", listener);
		root.removeEventListener("pointerdown", pointer);
	};
}
