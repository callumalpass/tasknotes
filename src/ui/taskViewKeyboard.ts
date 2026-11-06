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

export function revealTaskViewCard(card: HTMLElement, root: HTMLElement): void {
	card.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
	const headers = Array.from(root.querySelectorAll<HTMLElement>(
		".task-list-virtual-sticky-header__group, .task-group, .kanban-view__column-header, .kanban-view__column-header-cell"
	)).filter(header => header.closest(".task-list-virtual-sticky-header") ||
		header.ownerDocument.defaultView?.getComputedStyle(header).position === "sticky");
	for (let scroller = card.parentElement; scroller && root.contains(scroller); scroller = scroller.parentElement) {
		if (scroller.scrollHeight <= scroller.clientHeight) continue;
		const overflow = scroller.ownerDocument.defaultView?.getComputedStyle(scroller).overflowY;
		if (overflow !== "auto" && overflow !== "scroll") continue;
		const viewport = scroller.getBoundingClientRect();
		const target = card.getBoundingClientRect();
		let top = viewport.top;
		for (const bounds of headers.map(header => header.getBoundingClientRect()).sort((first, second) => first.top - second.top)) {
			if (bounds.height && bounds.left < target.right && bounds.right > target.left && bounds.top <= top + 1) {
				top = Math.max(top, bounds.bottom);
			}
		}
		if (target.top < top) scroller.scrollTop -= top - target.top;
	}
}

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
	let visibilityFrame: number | undefined;
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
			root.ownerDocument.querySelector(".modal-container") ||
			root.ownerDocument.querySelector(".menu") ||
			target.closest("input, textarea, select, [contenteditable]")
		)
			return;
		focusedControl = target as HTMLElement;
		reconcileFocus(target as HTMLElement);
		if (keyboardFocus && focusedPath) reveal(focusedPath);
		plugin.app.keymap.pushScope(scope);
		scoped = true;
	};
	const cardFor = (path: string) => options.elementForPath ? options.elementForPath(path) :
		Array.from(root.querySelectorAll<HTMLElement>(".task-card[data-task-path]")).find(
			(card) => card.dataset.taskPath === path
		);
	const reveal = (path: string) => {
		options.reveal(path);
		const show = () => {
			const card = cardFor(path);
			if (card) revealTaskViewCard(card, root);
		};
		show();
		if (visibilityFrame !== undefined) root.ownerDocument.defaultView?.cancelAnimationFrame(visibilityFrame);
		visibilityFrame = root.ownerDocument.defaultView?.requestAnimationFrame(() => {
			visibilityFrame = undefined;
			if (keyboardFocus && focusedPath === path) show();
		});
	};
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
					reveal(focusedPath);
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
		const anchor = helpButton.closest(".tn-bases-toolbar-overflow-panel")
			? chrome?.querySelector<HTMLElement>(".tn-bases-toolbar-more") ?? helpButton : helpButton;
		const overlay = openPopover({ anchor, app: plugin.app, onClose: () => root.focus({ preventScroll: true }) });
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
		if (helpButton.closest(".tn-bases-toolbar-overflow-panel")) return;
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
			root.ownerDocument.querySelector(".modal-container") ||
			root.ownerDocument.querySelector(".menu") ||
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
				reveal(next);
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
			reveal(next);
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
			if (!task || focusedPath !== actionPath || root.ownerDocument.querySelector(".modal-container")) return;
			const card = cardFor(actionPath);
			const anchor = card?.querySelector<HTMLElement>(".task-card__status-dot") ?? card ?? root;
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
	const keyboard = (event: KeyboardEvent) => {
		pointerFocus = false;
		if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k" ||
			!root.contains(event.target as Node) || (event.target as HTMLElement).closest("input, textarea, select, [contenteditable], .cm-editor")) return;
		for (const element of [root, ...Array.from(root.querySelectorAll<HTMLElement>(".task-card"))]) {
			(element as HTMLElement & { hoverPopover?: { hide(): void } }).hoverPopover?.hide();
		}
		void handle(event);
		if (event.defaultPrevented) event.stopImmediatePropagation();
	};
	root.ownerDocument.addEventListener("keydown", keyboard, true);
	const searchExit = (event: Event) => {
		if ((event as CustomEvent<boolean>).detail) {
			focusedPath = options.paths()[0] ?? null;
			keyboardFocus = !!focusedPath;
		}
		root.focus({ preventScroll: true });
		if (focusedPath) reveal(focusedPath);
		paint();
	};
	scope.register(["Mod"], "k", (event) => {
		void handle(event);
		return false;
	});
	root.addEventListener("focusin", focusScope);
	root.ownerDocument.addEventListener("tn-modal-opening", releaseScope);
	root.addEventListener("focusout", blurScope);
	root.addEventListener("keydown", listener);
	root.addEventListener("tn-search-exit", searchExit);
	root.addEventListener("pointerdown", pointer);
	return () => {
		helpButton.remove();
		root.ownerDocument.defaultView?.clearTimeout(highlightTimer);
		if (revealFrame !== undefined) root.ownerDocument.defaultView?.cancelAnimationFrame(revealFrame);
		if (visibilityFrame !== undefined) root.ownerDocument.defaultView?.cancelAnimationFrame(visibilityFrame);
		plugin.emitter.offref(taskUpdated);
		releaseScope();
		root.removeEventListener("focusin", focusScope);
		root.ownerDocument.removeEventListener("tn-modal-opening", releaseScope);
		root.removeEventListener("focusout", blurScope);
		observer.disconnect();
		chromeObserver.disconnect();
		root.removeEventListener("keydown", listener);
		root.removeEventListener("tn-search-exit", searchExit);
		root.removeEventListener("pointerdown", pointer);
		root.ownerDocument.removeEventListener("keydown", keyboard, true);
	};
}
