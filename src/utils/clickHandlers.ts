import { TFile } from 'obsidian';
import { TaskInfo } from '../types';
import TaskNotesPlugin from '../main';

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
 * Single click: Opens task edit modal
 * Double click: Opens source note (if enabled in settings)
 * Ctrl/Cmd + Click: Opens source note immediately
 */
export function createTaskClickHandler(options: ClickHandlerOptions) {
    const {
        task,
        plugin,
        excludeSelector,
        onSingleClick,
        onDoubleClick,
        contextMenuHandler
    } = options;

    let clickTimeout: NodeJS.Timeout | null = null;

    const handleSingleClick = async (e: MouseEvent) => {
        if (onSingleClick) {
            await onSingleClick(e);
            return;
        }

        if (e.ctrlKey || e.metaKey) {
            // Ctrl/Cmd + Click: Open source note immediately
            const file = plugin.app.vault.getAbstractFileByPath(task.path);
            if (file instanceof TFile) {
                plugin.app.workspace.getLeaf(false).openFile(file);
            }
        } else {
            // Single-click: Open edit modal
            await plugin.openTaskEditModal(task);
        }
    };

    const handleDoubleClick = async (e: MouseEvent) => {
        if (onDoubleClick) {
            await onDoubleClick(e);
            return;
        }

        // Double-click: Open source note
        const file = plugin.app.vault.getAbstractFileByPath(task.path);
        if (file instanceof TFile) {
            plugin.app.workspace.getLeaf(false).openFile(file);
        }
    };

    const clickHandler = async (e: MouseEvent) => {
        // Check if click is on excluded elements
        if (excludeSelector) {
            const target = e.target as HTMLElement;
            if (target.closest(excludeSelector)) {
                return; // Let the specific element handle its own click
            }
        }

        // If double-click feature is disabled, handle as immediate single click
        if (!plugin.settings.enableDoubleClickToOpenNote) {
            await handleSingleClick(e);
            return;
        }

        // Clear any existing timeout
        if (clickTimeout) {
            clearTimeout(clickTimeout);
            clickTimeout = null;
        }

        // Set a timeout to handle single click
        clickTimeout = setTimeout(() => {
            handleSingleClick(e);
            clickTimeout = null;
        }, 250); // 250ms delay to detect double click
    };

    const dblclickHandler = async (e: MouseEvent) => {
        // Check if click is on excluded elements
        if (excludeSelector) {
            const target = e.target as HTMLElement;
            if (target.closest(excludeSelector)) {
                return; // Let the specific element handle its own click
            }
        }

        // If double-click feature is disabled, do nothing
        if (!plugin.settings.enableDoubleClickToOpenNote) {
            return;
        }

        // Clear the single click timeout
        if (clickTimeout) {
            clearTimeout(clickTimeout);
            clickTimeout = null;
        }

        // Handle double click
        await handleDoubleClick(e);
    };

    const contextmenuHandler = async (e: MouseEvent) => {
        e.preventDefault();
        if (contextMenuHandler) {
            await contextMenuHandler(e);
        }
    };

    return {
        clickHandler,
        dblclickHandler,
        contextmenuHandler,
        // Cleanup function to clear any pending timeouts
        cleanup: () => {
            if (clickTimeout) {
                clearTimeout(clickTimeout);
                clickTimeout = null;
            }
        }
    };
}

/**
 * Creates a standard hover preview handler for task elements
 */
export function createTaskHoverHandler(task: TaskInfo, plugin: TaskNotesPlugin) {
    return (event: MouseEvent) => {
        const file = plugin.app.vault.getAbstractFileByPath(task.path);
        if (file) {
            plugin.app.workspace.trigger('hover-link', {
                event,
                source: 'tasknotes-task-card',
                hoverParent: event.currentTarget as HTMLElement,
                targetEl: event.currentTarget as HTMLElement,
                linktext: task.path,
                sourcePath: task.path
            });
        }
    };
}
