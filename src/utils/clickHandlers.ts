import { TFile } from "obsidian";
import { TaskInfo } from "../types";
import TaskNotesPlugin from "../main";

export interface ClickHandlerOptions {
	task: TaskInfo;
	plugin: TaskNotesPlugin;
	excludeSelector?: string; // CSS selector for elements that should not trigger click behavior
	onSingleClick?: (e: MouseEvent) => Promise<void>; // Optional override for single click
	onDoubleClick?: (e: MouseEvent) => Promise<void>; // Optional override for double click
	contextMenuHandler?: (e: MouseEvent) => Promise<void>; // Optional context menu handler
}

/**
 * Creates a reusable click handler that supports single/double click distinction
 * based on user settings.
 * Ctrl/Cmd + Click: Opens source note immediately
 */
export function createTaskClickHandler(options: ClickHandlerOptions) {
	const { task, plugin, excludeSelector, onSingleClick, onDoubleClick, contextMenuHandler } =
		options;

	let clickTimeout: ReturnType<typeof setTimeout> | null = null;

	const openNote = (newTab = false) => {
		const file = plugin.app.vault.getAbstractFileByPath(task.path);
		if (file instanceof TFile) {
			if (newTab) {
				plugin.app.workspace.openLinkText(task.path, "", true);
			} else {
				plugin.app.workspace.getLeaf(false).openFile(file);
			}
		}
	};

	const editTask = async () => {
		await plugin.openTaskEditModal(task);
	};

	const handleSingleClick = async (e: MouseEvent) => {
		if (onSingleClick) {
			await onSingleClick(e);
			return;
		}

		if (e.ctrlKey || e.metaKey) {
			openNote(true); // Open in new tab
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

	const clickHandler = async (e: MouseEvent) => {
		if (excludeSelector) {
			const target = e.target as HTMLElement;
			if (target.closest(excludeSelector)) {
				return;
			}
		}

		// Check for selection mode - handle shift/ctrl/cmd clicks for task selection
		const selectionService = plugin.taskSelectionService;
		if (selectionService) {
			const isSelectionClick = e.shiftKey || e.ctrlKey || e.metaKey || selectionService.isSelectionModeActive();

			if (isSelectionClick) {
				e.stopPropagation();

				// Enter selection mode if shift is pressed
				if (e.shiftKey && !selectionService.isSelectionModeActive()) {
					selectionService.enterSelectionMode();
				}

				// Handle selection
				if (e.shiftKey) {
					// Range selection - need to get visible paths from the view
					// For now, just toggle since we don't have access to visible paths here
					selectionService.toggleSelection(task.path);
				} else {
					// Toggle individual selection (ctrl/cmd click or selection mode click)
					selectionService.toggleSelection(task.path);
				}

				return;
			}
		}

		// Stop propagation to prevent clicks from bubbling to parent cards
		e.stopPropagation();

		if (plugin.settings.doubleClickAction === "none") {
			await handleSingleClick(e);
			return;
		}

		if (clickTimeout) {
			clearTimeout(clickTimeout);
			clickTimeout = null;
			await handleDoubleClick(e);
		} else {
			clickTimeout = setTimeout(() => {
				clickTimeout = null;
				handleSingleClick(e);
			}, 250);
		}
	};

	const dblclickHandler = async (e: MouseEvent) => {
		// This is handled by the clickHandler to distinguish single/double clicks
	};

	const contextmenuHandler = async (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation(); // Prevent event from bubbling to parent cards

		// Check if multiple tasks are selected - show batch context menu
		const selectionService = plugin.taskSelectionService;
		if (selectionService && selectionService.getSelectionCount() > 1) {
			// Ensure the right-clicked task is in the selection
			if (!selectionService.isSelected(task.path)) {
				selectionService.addToSelection(task.path);
			}

			// Import and show batch context menu
			const { BatchContextMenu } = require("../components/BatchContextMenu");
			const menu = new BatchContextMenu({
				plugin,
				selectedPaths: selectionService.getSelectedPaths(),
				onUpdate: () => {
					// Views will refresh via events
				},
			});
			menu.show(e);
			return;
		}

		if (contextMenuHandler) {
			await contextMenuHandler(e);
		}
	};

	return {
		clickHandler,
		dblclickHandler,
		contextmenuHandler,
		cleanup: () => {
			if (clickTimeout) {
				clearTimeout(clickTimeout);
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
const calendarClickTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Handle calendar event clicks with single/double click detection
 * This is designed to be used in FullCalendar's eventClick handler
 */
export async function handleCalendarTaskClick(
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	jsEvent: MouseEvent,
	eventId: string
) {
	const openNote = (newTab = false) => {
		const file = plugin.app.vault.getAbstractFileByPath(task.path);
		if (file instanceof TFile) {
			if (newTab) {
				plugin.app.workspace.openLinkText(task.path, "", true);
			} else {
				plugin.app.workspace.getLeaf(false).openFile(file);
			}
		}
	};

	const editTask = async () => {
		await plugin.openTaskEditModal(task);
	};

	const handleSingleClick = async (e: MouseEvent) => {
		if (e.ctrlKey || e.metaKey) {
			openNote(true); // Open in new tab
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
		const action = plugin.settings.doubleClickAction;
		if (action === "edit") {
			await editTask();
		} else if (action === "openNote") {
			openNote();
		}
	};

	// If double-click is disabled, handle single click immediately
	if (plugin.settings.doubleClickAction === "none") {
		await handleSingleClick(jsEvent);
		return;
	}

	// Check if we have a pending click for this event
	const existingTimeout = calendarClickTimeouts.get(eventId);

	if (existingTimeout) {
		// This is a double-click
		clearTimeout(existingTimeout);
		calendarClickTimeouts.delete(eventId);
		await handleDoubleClick(jsEvent);
	} else {
		// This might be a single-click, wait to see if double-click follows
		const timeout = setTimeout(() => {
			calendarClickTimeouts.delete(eventId);
			handleSingleClick(jsEvent);
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
		clearTimeout(timeout);
		calendarClickTimeouts.delete(eventId);
	}
}
