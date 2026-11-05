import { msg } from "@lingui/core/macro";
import { Scope, Notice, setIcon } from "obsidian";
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
	horizontal?: (path: string | null, direction: number) => string | null;
	horizontalLabel?: string;
	groupForPath?: (path: string) => { key: string; paths: string[] } | undefined;
	elementForPath?: (path: string) => HTMLElement | undefined;
	pathFromElement?: (element: HTMLElement) => string | null;
	taskForPath?: (path: string) => Promise<TaskInfo | null>;
	selectionPath?: (path: string) => string | undefined;
	open?: (path: string) => Promise<void>;
	targetDate?: (path: string) => Date;
	shortcuts?: { key: string; label: string; run: (path: string | null) => void; when?: (path: string | null) => boolean }[];
}

export function installTaskViewKeyboard(options: TaskViewKeyboardOptions): () => void {
	const { plugin, root } = options;
	let focusedPath: string | null = null;
	let rangeAnchor: string | null = null;
	let rangeBase: string[] = [];
	let keyboardFocus = false;
	let pointerFocus = false;
	let focusedControl: HTMLElement | null = null;
	let paintedCard: HTMLElement | undefined;
	let highlightTimer: number | undefined;
	let arrivalPath: string | undefined;
	let revealFrame: number | undefined;
	let pending = false;
	let triage: { path: string; key: string; candidates: string[] } | undefined;
	const selection = plugin.taskSelectionService;
	const propertyKeys = PROPERTY_KEYS;
	const taskFor = (path: string) => options.taskForPath?.(path) ?? plugin.cacheManager.getTaskInfo(path);
	const selectionPath = (path: string) => options.selectionPath ? options.selectionPath(path) : path;
	const selector = options.elementForPath ? "[data-keyboard-id]" : ".task-card[data-task-path]";
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
		focusedControl = target as HTMLElement;
		reconcileFocus(target as HTMLElement);
		plugin.app.keymap.pushScope(scope);
		scoped = true;
	};
	const cardFor = (path: string) => options.elementForPath ? options.elementForPath(path) :
		Array.from(root.querySelectorAll<HTMLElement>(".task-card[data-task-path]")).find(
			(card) => card.dataset.taskPath === path
		);
	const highlightArrival = (card: HTMLElement) => {
		card.classList.add("tn-task-arrived");
		if (highlightTimer !== undefined) return;
		highlightTimer = root.ownerDocument.defaultView?.setTimeout(() => {
			card.classList.remove("tn-task-arrived");
			if (arrivalPath) cardFor(arrivalPath)?.classList.remove("tn-task-arrived");
			arrivalPath = undefined;
			highlightTimer = undefined;
		}, 1200);
	};
	const paint = () => {
		options.refreshSelection();
		if (triage) {
			const moved = options.groupForPath?.(triage.path);
			if (!moved || moved.key !== triage.key) {
				const paths = options.paths();
				focusedPath = triage.candidates.find((path) => paths.includes(path)) ?? paths[0] ?? null;
				if (focusedPath) options.reveal(focusedPath);
				triage = undefined;
			}
		}
		if (arrivalPath && arrivalPath !== focusedPath) {
			const arrived = cardFor(arrivalPath);
			if (arrived) highlightArrival(arrived);
		}
		root.querySelectorAll(".tn-task-focused").forEach((card) =>
			card.classList.remove("tn-task-focused")
		);
		if (!focusedPath) return;
		const card = cardFor(focusedPath);
		if (card && focusedControl && !focusedControl.isConnected && root.ownerDocument.activeElement === root.ownerDocument.body) {
			const previousControl = focusedControl;
			const controlClass = [...previousControl.classList].find(name => name.startsWith("task-card__") && !name.includes("--"));
			const replacements = controlClass
				? [...card.getElementsByClassName(controlClass)].filter(element =>
					element.tagName === previousControl.tagName &&
					element.getAttribute("data-tn-date-type") === previousControl.getAttribute("data-tn-date-type"))
				: [];
			focusedControl = null;
			const target = replacements.length === 1 ? replacements[0] as HTMLElement : root;
			target.focus({ preventScroll: true });
			if (root.ownerDocument.activeElement !== target) root.focus({ preventScroll: true });
		}
		if (arrivalPath === focusedPath && !card && revealFrame === undefined) {
			revealFrame = root.ownerDocument.defaultView?.requestAnimationFrame(() => {
				revealFrame = undefined;
				if (focusedPath) options.reveal(focusedPath);
			});
		}
		if (keyboardFocus) {
			const active = root.ownerDocument.activeElement;
			if (!active || active === card || !card?.contains(active)) card?.classList.add("tn-task-focused");
			if (card && paintedCard && card !== paintedCard && paintedCard.dataset.taskPath === focusedPath) {
				if (arrivalPath === focusedPath) {
					options.reveal(focusedPath);
					card.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
				}
				highlightArrival(card);
			}
		}
		if (card) paintedCard = card;
	};
	const observer = new MutationObserver(paint);
	const blurScope = (event: FocusEvent) => {
		const previousControl = focusedControl;
		if (event.relatedTarget && !root.contains(event.relatedTarget as Node)) focusedControl = null;
		else if (!event.relatedTarget) queueMicrotask(() => {
			if (previousControl?.isConnected && focusedControl === previousControl && !root.contains(root.ownerDocument.activeElement)) focusedControl = null;
		});
		releaseScope();
	};
	const reconcileFocus = (target: HTMLElement) => {
		const card = target.closest<HTMLElement>(selector);
		if (!card || !root.contains(card)) return;
		const path = options.pathFromElement?.(card) ?? card.dataset.taskPath ?? null;
		if (path !== focusedPath) rangeAnchor = null;
		focusedPath = path;
		keyboardFocus = !pointerFocus;
		paint();
	};
	observer.observe(root, { childList: true, subtree: true });
	const taskUpdated = plugin.emitter.on("task-updated", (event: { originalTask?: TaskInfo; updatedTask?: TaskInfo }) => {
		if (!focusedPath || event.originalTask?.path !== selectionPath(focusedPath) || !event.updatedTask) return;
		const group = options.groupForPath?.(focusedPath);
		if (group) {
			const index = group.paths.indexOf(focusedPath);
			triage = { path: event.updatedTask.path, key: group.key, candidates: [...group.paths.slice(index + 1), ...group.paths.slice(0, index).reverse()] };
		}
		if (!options.selectionPath) focusedPath = event.updatedTask.path;
		root.ownerDocument.defaultView?.clearTimeout(highlightTimer);
		highlightTimer = undefined;
		root.querySelectorAll(".tn-task-arrived").forEach((card) => card.classList.remove("tn-task-arrived"));
		arrivalPath = focusedPath;
	});
	const pointer = (event: PointerEvent) => {
		pointerFocus = true;
		const target = event.target as HTMLElement;
		const card = target.closest<HTMLElement>(selector);
		if (!card) return;
		focusedPath = options.pathFromElement?.(card) ?? card.dataset.taskPath ?? null;
		rangeAnchor = null;
		keyboardFocus = false;
		paint();
		if (!target.closest("button, a, input, textarea, select, [contenteditable], [role=button]"))
			root.focus({ preventScroll: true });
	};
	const help = () => {
		const overlay = openPopover({ anchor: helpButton, app: plugin.app, onClose: () => root.focus({ preventScroll: true }) });
		overlay.el.setAttribute("role", "dialog");
		overlay.el.setAttribute(
			"aria-label",
			uiText(msg({ message: "Keyboard shortcuts", context: "interaction help" }))
		);
		overlay.el.createDiv({ cls: "tn-popover__title", text: uiText(msg({ message: "Keyboard shortcuts", context: "interaction help" })) });
		const list = overlay.el.createDiv({ cls: "tn-picker__list" });
		for (const [key, label] of [
			["ArrowUp+ArrowDown+K+J", uiText(msg({ message: "Move focus", context: "interaction shortcut" }))],
			...(options.horizontal ? [
				["ArrowLeft+ArrowRight+H+L", options.horizontalLabel ?? uiText(msg({ message: "Move between columns", context: "interaction shortcut" }))],
			] : []),
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
			...(options.shortcuts && !focusedPath ? [] : Object.entries(propertyKeys)).map(([key, property]) => [
				property === "scheduled" ? "Shift+H" : key,
				taskPropertyLabel(property),
			]),
			["C", uiText(msg({ message: "Create task", context: "interaction shortcut" }))],
			["/", uiText(msg({ message: "Search", context: "interaction shortcut" }))],
			["Mod+K", uiText(msg({ message: "Actions", context: "interaction shortcut" }))],
			["Mod+Z", uiText(msg({ message: "Undo", context: "interaction undo" }))],
			...(options.shortcuts ?? []).filter((shortcut) => shortcut.key !== "c" && (!shortcut.when || shortcut.when(focusedPath))).map((shortcut) => [shortcut.key, shortcut.label]),
		]) {
			const row = list.createDiv({ cls: "tn-shortcut-row" });
			row.createSpan({ text: label });
			renderKeyHint(row, key, true);
		}
		list.tabIndex = 0;
		list.focus();
		overlay.reposition();
	};
	const helpButton = root.ownerDocument.win.createEl("button");
	helpButton.className = "tn-shortcut-help clickable-icon";
	helpButton.type = "button";
	helpButton.setAttribute("aria-label", uiText(msg({ message: "Keyboard shortcuts", context: "interaction help" })));
	setIcon(helpButton, "circle-help");
	const chrome = root.closest(".bases-view")?.parentElement;
	const placeHelp = () => {
		const toolbar = chrome?.querySelector(".bases-toolbar");
		const newTask = toolbar?.querySelector(".tn-bases-new-task-btn");
		if (newTask && helpButton.nextElementSibling !== newTask) newTask.before(helpButton);
		else if (!newTask && helpButton.parentElement !== (toolbar ?? root)) (toolbar ?? root).appendChild(helpButton);
	};
	placeHelp();
	const chromeObserver = new MutationObserver(placeHelp);
	if (chrome) chromeObserver.observe(chrome, { childList: true, subtree: true });
	helpButton.addEventListener("click", help);
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
		reconcileFocus(target);
		const key = event.key.toLowerCase();
		const mod = event.metaKey || event.ctrlKey;
		if (!mod && target.closest("button, a, [role=button]") && ["enter", " "].includes(key)) return;
		if (mod && key !== "k" && key !== "a") return;
		const shortcut = !mod && !event.shiftKey && options.shortcuts?.find((shortcut) => shortcut.key === key && (!shortcut.when || shortcut.when(focusedPath)));
		if (shortcut) {
			event.preventDefault();
			event.stopPropagation();
			root.focus({ preventScroll: true });
			shortcut.run(focusedPath);
			if (key !== "c") {
				focusedPath = null;
				keyboardFocus = false;
				paint();
			}
			return;
		}
		if (
			event.shiftKey &&
			key !== "h" &&
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
				...(options.horizontal ? ["l"] : []),
				"t",
				"c",
				"/",
				"?",
			].includes(key)
		)
			return;
		if (!mod && key === "h" && !event.shiftKey && !options.horizontal) return;
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
			selection.selectAll(paths.flatMap((path) => selectionPath(path) ?? []));
			return;
		}
		if (!mod && !event.shiftKey && options.horizontal && ["arrowleft", "arrowright", "h", "l"].includes(key)) {
			const next = options.horizontal(focusedPath, ["arrowleft", "h"].includes(key) ? -1 : 1);
			if (next) {
				focusedPath = next;
				keyboardFocus = true;
				rangeAnchor = null;
				options.reveal(next);
				cardFor(next)?.scrollIntoView({ block: "nearest", inline: "nearest" });
				paint();
			}
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
						).flatMap((path) => selectionPath(path) ?? []),
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
			const path = selectionPath(focusedPath);
			if (path) selection.toggleSelection(path);
			paint();
			return;
		}
		if (pending || event.repeat) return;
		pending = true;
		const actionPath = focusedPath;
		try {
			if (key === "enter" && options.open) {
				await options.open(actionPath);
				return;
			}
			const selected = paths.filter((path) => {
				const taskPath = selectionPath(path);
				return taskPath && selection.getSelectedPaths().includes(taskPath);
			});
			const taskPaths = selected.length ? selected : [actionPath];
			const fetchedTasks = (
				await Promise.all(taskPaths.map(taskFor))
			).filter((task): task is TaskInfo => !!task);
			const tasks = [...new Map(fetchedTasks.map((task) => [task.path, task])).values()];
			const task = await taskFor(actionPath);
			if (!task || focusedPath !== actionPath) return;
			const anchor = cardFor(actionPath) ?? root;
			if (mod && key === "k") {
				const targetDate = options.targetDate?.(actionPath) ?? (task.recurrence
					? await plugin.taskService.resolveRecurringTaskActionDate(task)
					: new Date());
				new TaskActionPaletteModal(plugin.app, task, plugin, targetDate, (existing) => {
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
							keyHint: (() => {
								const key = Object.entries(propertyKeys).find(([, candidate]) => candidate === property)?.[0];
								return property === "scheduled" ? "Shift+H" : key;
							})(),
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
							category: "organization",
							keywords: [],
							isApplicable: () => true,
							execute: () => archiveTasksWithUndo(plugin, tasks, !task.archived),
						},
						...existing
							.filter(
								(action) =>
									tasks.length === 1 &&
									(!["status", "priority", "dates"].includes(action.category) ||
										["complete-recurring-instance", "open-or-create-occurrence-note"].includes(action.id)) &&
									!action.id.includes("archive")
							)
							.map((action) => ({
								...action,
								keyHint: action.id === "edit-task" ? "E" : action.id === "open-task-file" ? "Enter" : action.keyHint,
							})),
					];
				}).open();
			} else if (propertyKeys[key])
				await openTaskPropertyPicker(plugin, propertyKeys[key], tasks, anchor);
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
		pointerFocus = false;
		void handle(event);
	};
	const keyboard = () => { pointerFocus = false; };
	root.ownerDocument.addEventListener("keydown", keyboard, true);
	const searchExit = (event: Event) => {
		if ((event as CustomEvent<boolean>).detail) {
			focusedPath = options.paths()[0] ?? null;
			keyboardFocus = !!focusedPath;
		}
		root.focus({ preventScroll: true });
		if (focusedPath) options.reveal(focusedPath);
		paint();
	};
	scope.register(["Mod"], "k", (event) => {
		void handle(event);
		return false;
	});
	root.addEventListener("focusin", focusScope);
	root.addEventListener("focusout", blurScope);
	root.addEventListener("keydown", listener);
	root.addEventListener("tn-search-exit", searchExit);
	root.addEventListener("pointerdown", pointer);
	return () => {
		helpButton.remove();
		root.ownerDocument.defaultView?.clearTimeout(highlightTimer);
		if (revealFrame !== undefined) root.ownerDocument.defaultView?.cancelAnimationFrame(revealFrame);
		plugin.emitter.offref(taskUpdated);
		releaseScope();
		root.removeEventListener("focusin", focusScope);
		root.removeEventListener("focusout", blurScope);
		observer.disconnect();
		chromeObserver.disconnect();
		root.removeEventListener("keydown", listener);
		root.removeEventListener("tn-search-exit", searchExit);
		root.removeEventListener("pointerdown", pointer);
		root.ownerDocument.removeEventListener("keydown", keyboard, true);
	};
}
