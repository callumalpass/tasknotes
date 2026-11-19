import { Keymap, TFile, type App } from "obsidian";
import { TaskInfo } from "../types";
import TaskNotesPlugin from "../main";

/** Where Obsidian opens a link: a new tab, a split or a window. */
export type NotePaneType = "tab" | "split" | "window";

/**
 * Obsidian's link convention for a click: Ctrl/Cmd+click or middle-click opens
 * a new tab, Ctrl/Cmd+Alt a split, Ctrl/Cmd+Alt+Shift a window. Returns false
 * for a click that should follow the task-interaction settings.
 */
export function getModifierPaneType(
	event: MouseEvent | KeyboardEvent | null | undefined
): NotePaneType | false {
	if (!event) return false;
	const paneType = Keymap.isModEvent(event);
	return paneType === true ? "tab" : paneType;
}

/** Opens a task's note in the current tab, or in the pane a modifier asked for. */
export function openTaskNote(
	app: App,
	path: string,
	paneType: NotePaneType | false = false,
	subpath = ""
): void {
	const file = app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) return;
	if (paneType || subpath) {
		void app.workspace.openLinkText(path + subpath, "", paneType);
	} else {
		void app.workspace.getLeaf(false).openFile(file);
	}
}

export interface ClickHandlerOptions {
	task: TaskInfo;
	plugin: TaskNotesPlugin;
	excludeSelector?: string; // CSS selector for elements that should not trigger click behavior
	onSingleClick?: (e: MouseEvent) => void | Promise<void>; // Optional override for single click
	onDoubleClick?: (e: MouseEvent) => void | Promise<void>; // Optional override for double click
	/** A view can consume selection before standalone card navigation runs. */
	onSelectionClick?: (e: MouseEvent) => boolean;
	/** Legacy view callback for clicks that toggle keyboard selection. */
	selectionClickHandler?: (e: MouseEvent) => void;
	/** Opens the menu for a right-click; `openTaskMenu` handles batch selection. */
	contextMenuHandler?: (e: MouseEvent) => void | Promise<void>;
	navigationSubpath?: string;
}

export const DEFAULT_TASK_CLICK_EXCLUDE_SELECTOR = [
	"a",
	"button",
	"input",
	"textarea",
	"select",
	'[role="button"]',
	'[data-tn-no-drag="true"]',
	'[data-tn-click-exclude="true"]',
	".tag",
].join(", ");

/**
 * Creates a reusable click handler that supports single/double click distinction
 * based on user settings.
 * Ctrl/Cmd + Click: Opens source note immediately
 */
export function createTaskClickHandler(options: ClickHandlerOptions) {
	const {
		task,
		plugin,
		excludeSelector,
		onSingleClick,
		onDoubleClick,
		contextMenuHandler,
		onSelectionClick,
		selectionClickHandler,
		navigationSubpath,
	} = options;
	const clickExcludeSelector = excludeSelector
		? `${DEFAULT_TASK_CLICK_EXCLUDE_SELECTOR}, ${excludeSelector}`
		: DEFAULT_TASK_CLICK_EXCLUDE_SELECTOR;

	let clickTimeout: number | null = null;

	const openNote = (paneType: NotePaneType | false = false) =>
		openTaskNote(plugin.app, task.path, paneType, navigationSubpath);

	const editTask = async () => {
		await plugin.openTaskEditModal(task);
	};

	const handleSingleClick = async (e: MouseEvent) => {
		if (onSingleClick) {
			await onSingleClick(e);
			return;
		}

		const action = plugin.settings.singleClickAction;
		if (action === "edit") {
			await editTask();
		} else if (action === "openNote") {
			openNote(false); // Open in current tab
		}
	};

	const handleDoubleClick = async (e: MouseEvent) => {
		if (onDoubleClick) {
			await onDoubleClick(e);
			return;
		}

		const action = plugin.settings.doubleClickAction;
		if (action === "edit") {
			await editTask();
		} else if (action === "openNote") {
			openNote();
		}
	};

	const handleClick = async (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		if (target.closest(clickExcludeSelector)) {
			return;
		}

		if (onSelectionClick?.(e)) {
			e.preventDefault();
			e.stopPropagation();
			if (clickTimeout) {
				window.clearTimeout(clickTimeout);
				clickTimeout = null;
			}
			return;
		}

		// Standalone cards keep Shift-selection and Ctrl/Cmd source navigation.
		const selectionService = plugin.taskSelectionService;
		if (selectionService) {
			if (e.shiftKey && selectionClickHandler) {
				e.stopPropagation();
				selectionClickHandler(e);
				return;
			}

			if (e.shiftKey) {
				e.stopPropagation();

				// Enter selection mode if not already active
				if (!selectionService.isSelectionModeActive()) {
					selectionService.enterSelectionMode();
				}

				// Toggle selection for this task
				selectionService.toggleSelection(task.path);
				return;
			}

			// Regular click without shift exits selection mode
			if (selectionService.isSelectionModeActive()) {
				selectionService.clearSelection();
				selectionService.exitSelectionMode();
			}
		}

		// Stop propagation to prevent clicks from bubbling to parent cards
		e.stopPropagation();

		// Ctrl/Cmd+click opens the note in a new tab at once, whatever the click settings.
		const paneType = getModifierPaneType(e);
		if (paneType) {
			if (clickTimeout) {
				window.clearTimeout(clickTimeout);
				clickTimeout = null;
			}
			openNote(paneType);
			return;
		}

		if (plugin.settings.doubleClickAction === "none") {
			await handleSingleClick(e);
			return;
		}

		if (clickTimeout) {
			window.clearTimeout(clickTimeout);
			clickTimeout = null;
			await handleDoubleClick(e);
		} else {
			clickTimeout = window.setTimeout(() => {
				clickTimeout = null;
				void handleSingleClick(e);
			}, 250);
		}
	};

	const clickHandler = (event: MouseEvent) => {
		void handleClick(event);
	};

	const handleAuxClick = (e: MouseEvent) => {
		if (e.button !== 1) {
			return;
		}

		const target = e.target as HTMLElement;
		if (target.closest(clickExcludeSelector)) {
			return;
		}

		e.preventDefault();
		e.stopPropagation();
		if (clickTimeout) {
			window.clearTimeout(clickTimeout);
			clickTimeout = null;
		}
		openNote("tab");
	};

	const auxclickHandler = (event: MouseEvent) => {
		handleAuxClick(event);
	};

	const dblclickHandler = (_event: MouseEvent) => {
		// This is handled by the clickHandler to distinguish single/double clicks
	};

	const handleContextMenu = async (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation(); // Prevent event from bubbling to parent cards
		if (contextMenuHandler) {
			await contextMenuHandler(e);
		}
	};

	const contextmenuHandler = (event: MouseEvent) => {
		void handleContextMenu(event);
	};

	return {
		clickHandler,
		auxclickHandler,
		dblclickHandler,
		contextmenuHandler,
		cleanup: () => {
			if (clickTimeout) {
				window.clearTimeout(clickTimeout);
				clickTimeout = null;
			}
		},
	};
}

/**
 * Creates a standard hover preview handler for task elements
 */
export function createTaskHoverHandler(task: TaskInfo, plugin: TaskNotesPlugin) {
	return (event: MouseEvent) => {
		const file = plugin.app.vault.getAbstractFileByPath(task.path);
		if (file) {
			plugin.app.workspace.trigger("hover-link", {
				event,
				source: "tasknotes-task-card",
				hoverParent: event.currentTarget as HTMLElement,
				targetEl: event.currentTarget as HTMLElement,
				linktext: task.path,
				sourcePath: task.path,
			});
		}
	};
}

/**
 * Calendar click timeout tracker to distinguish single/double clicks
 */
const calendarClickTimeouts = new Map<string, number>();

/**
 * Handle calendar event clicks with single/double click detection
 * This is designed to be used in FullCalendar's eventClick handler
 */
export async function handleCalendarTaskClick(
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	jsEvent: MouseEvent,
	eventId: string,
	onTaskUpdated?: () => void
) {
	const openNote = () => openTaskNote(plugin.app, task.path);

	const editTask = async () => {
		await plugin.openTaskEditModal(task, onTaskUpdated ? () => onTaskUpdated() : undefined);
	};

	const handleSingleClick = async (_e: MouseEvent) => {
		const action = plugin.settings.singleClickAction;
		if (action === "edit") {
			await editTask();
		} else if (action === "openNote") {
			openNote();
		}
	};

	const handleDoubleClick = async (_e: MouseEvent) => {
		const action = plugin.settings.doubleClickAction;
		if (action === "edit") {
			await editTask();
		} else if (action === "openNote") {
			openNote();
		}
	};

	// Ctrl/Cmd+click opens the note in a new tab at once, whatever the click settings.
	const paneType = getModifierPaneType(jsEvent);
	if (paneType) {
		cleanupCalendarClickTimeout(eventId);
		openTaskNote(plugin.app, task.path, paneType);
		return;
	}

	// If double-click is disabled, handle single click immediately
	if (plugin.settings.doubleClickAction === "none") {
		await handleSingleClick(jsEvent);
		return;
	}

	// Check if we have a pending click for this event
	const existingTimeout = calendarClickTimeouts.get(eventId);

	if (existingTimeout) {
		// This is a double-click
		window.clearTimeout(existingTimeout);
		calendarClickTimeouts.delete(eventId);
		await handleDoubleClick(jsEvent);
	} else {
		// This might be a single-click, wait to see if double-click follows
		const timeout = window.setTimeout(() => {
			calendarClickTimeouts.delete(eventId);
			void handleSingleClick(jsEvent);
		}, 250);
		calendarClickTimeouts.set(eventId, timeout);
	}
}

/**
 * Clean up any pending click timeouts for a specific event
 */
export function cleanupCalendarClickTimeout(eventId: string) {
	const timeout = calendarClickTimeouts.get(eventId);
	if (timeout) {
		window.clearTimeout(timeout);
		calendarClickTimeouts.delete(eventId);
	}
}
