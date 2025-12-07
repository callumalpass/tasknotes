/**
 * Task Card Note Decorations
 *
 * ARCHITECTURAL NOTE:
 * This implementation uses direct DOM manipulation to inject task card widgets into
 * the CodeMirror editor, rather than using CodeMirror's official Panel or Decoration APIs.
 *
 * WHY THIS APPROACH:
 * - CodeMirror Panel API: Designed for editor chrome (toolbars, status bars), always positions
 *   content at the very top or bottom of the editor, cannot be positioned within document flow
 * - CodeMirror Decoration API: Had cursor interaction issues where widgets interfered with
 *   text editing and cursor positioning
 * - DOM Manipulation: Allows precise positioning within document (after frontmatter, before content)
 *   without interfering with CodeMirror's text editing
 *
 * RISKS & LIMITATIONS:
 * - Relies on undocumented DOM structure (.cm-sizer, .metadata-container classes)
 * - May break with CodeMirror or Obsidian updates
 * - Bypasses CodeMirror's rendering pipeline
 * - No automatic cleanup from CodeMirror
 *
 * MITIGATION:
 * - Comprehensive null checks and error handling
 * - Defensive DOM queries with fallbacks
 * - Manual cleanup in destroy() lifecycle
 * - Orphaned widget cleanup
 * - CSS classes instead of inline styles for theme compatibility
 *
 * ALTERNATIVES CONSIDERED:
 * - Panel API: Would position above all content including properties (not suitable)
 * - Decoration API: Caused cursor interaction problems (original issue)
 * - Markdown Post-Processor: Only works in reading mode, not live preview
 *
 * If this breaks in future, consider:
 * 1. Engaging with Obsidian/CodeMirror community for proper API
 * 2. Creating feature request for "content panels" in CodeMirror
 * 3. Using Obsidian's registerMarkdownPostProcessor for reading mode only
 */

import {
	EditorView,
	PluginValue,
	ViewPlugin,
	ViewUpdate,
} from "@codemirror/view";
import {
	EVENT_DATA_CHANGED,
	EVENT_TASK_DELETED,
	EVENT_TASK_UPDATED,
	EVENT_DATE_CHANGED,
	TaskInfo,
} from "../types";
import {
	Component,
	EventRef,
	TFile,
	editorInfoField,
	editorLivePreviewField,
	MarkdownView,
	WorkspaceLeaf,
} from "obsidian";
import { Extension } from "@codemirror/state";

import TaskNotesPlugin from "../main";
import { createTaskCard } from "../ui/TaskCard";
import { convertInternalToUserProperties } from "../utils/propertyMapping";

// CSS class for identifying plugin-generated elements
const CSS_TASK_CARD_WIDGET = 'tasknotes-task-card-note-widget';

// Event emitted when task card widget is injected
const EVENT_TASK_CARD_INJECTED = 'task-card-injected';

// Interface to track component lifecycle
interface HTMLElementWithComponent extends HTMLElement {
	component?: Component;
}

/**
 * Helper function to create the task card widget
 * Now includes Component lifecycle management for proper cleanup
 */
function createTaskCardWidget(
	plugin: TaskNotesPlugin,
	task: TaskInfo
): HTMLElementWithComponent {
	const container = document.createElement("div") as HTMLElementWithComponent;
	container.className = `tasknotes-plugin task-card-note-widget ${CSS_TASK_CARD_WIDGET}`;

	container.setAttribute("contenteditable", "false");
	container.setAttribute("spellcheck", "false");
	container.setAttribute("data-widget-type", "task-card");

	// Create component for lifecycle management
	const component = new Component();
	component.load();
	container.component = component;

	// Get the visible properties from settings and convert internal names to user-configured names
	const visibleProperties = plugin.settings.defaultVisibleProperties
		? convertInternalToUserProperties(plugin.settings.defaultVisibleProperties, plugin)
		: undefined;

	// Create the task card
	const taskCard = createTaskCard(task, plugin, visibleProperties);

	// Add specific styling for the note widget
	taskCard.classList.add("task-card-note-widget__card");

	container.appendChild(taskCard);

	return container;
}

export class TaskCardNoteDecorationsPlugin implements PluginValue {
	private cachedTask: TaskInfo | null = null;
	private currentFile: TFile | null = null;
	private eventListeners: EventRef[] = [];
	private view: EditorView;
	private currentWidget: HTMLElementWithComponent | null = null;
	private widgetContainer: HTMLElement | null = null;
	private debounceTimer: number | null = null;

	constructor(
		view: EditorView,
		private plugin: TaskNotesPlugin
	) {
		this.view = view;
		this.currentFile = this.getFileFromView(view);

		// Set up event listeners for data changes
		this.setupEventListeners();

		// Load task for current file and inject widget
		this.loadTaskForCurrentFile(view);
	}

	update(update: ViewUpdate) {
		// Store the updated view reference
		this.view = update.view;

		// Check if file changed for this specific view
		const newFile = this.getFileFromView(update.view);
		if (newFile !== this.currentFile) {
			this.currentFile = newFile;
			this.loadTaskForCurrentFile(update.view);
		}
	}

	destroy() {
		// Clean up debounce timer
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}

		// Clean up widget
		this.removeWidget();

		// Clean up event listeners
		this.eventListeners.forEach((listener) => {
			this.plugin.emitter.offref(listener);
		});
		this.eventListeners = [];
	}

	private setupEventListeners() {
		// Debounced refresh to prevent excessive re-renders
		const debouncedRefresh = () => {
			if (this.debounceTimer) clearTimeout(this.debounceTimer);
			this.debounceTimer = window.setTimeout(() => {
				this.loadTaskForCurrentFile(this.view);
			}, 100);
		};

		// Listen for data changes that might affect the task card
		const dataChangeListener = this.plugin.emitter.on(EVENT_DATA_CHANGED, debouncedRefresh);
		const taskUpdateListener = this.plugin.emitter.on(EVENT_TASK_UPDATED, debouncedRefresh);
		const taskDeleteListener = this.plugin.emitter.on(EVENT_TASK_DELETED, debouncedRefresh);
		const dateChangeListener = this.plugin.emitter.on(EVENT_DATE_CHANGED, debouncedRefresh);
		const settingsChangeListener = this.plugin.emitter.on("settings-changed", debouncedRefresh);

		this.eventListeners.push(
			dataChangeListener,
			taskUpdateListener,
			taskDeleteListener,
			dateChangeListener,
			settingsChangeListener
		);
	}

	private removeWidget(): void {
		if (this.currentWidget) {
			// Unload the component for proper cleanup
			this.currentWidget.component?.unload();
			this.currentWidget.remove();
			this.currentWidget = null;
		}
		this.widgetContainer = null;
	}

	private cleanupOrphanedWidgets(view: EditorView): void {
		try {
			// Remove any orphaned widgets that might exist from previous instances
			const container = view.dom.closest('.workspace-leaf-content');
			if (!container) {
				console.debug('[TaskNotes] Could not find workspace-leaf-content for orphan cleanup');
				return;
			}

			container.querySelectorAll(`.${CSS_TASK_CARD_WIDGET}`).forEach(el => {
				if (el !== this.currentWidget) {
					const holder = el as HTMLElementWithComponent;
					holder.component?.unload();
					el.remove();
				}
			});
		} catch (error) {
			console.error('[TaskNotes] Error cleaning up orphaned task card widgets:', error);
		}
	}

	private loadTaskForCurrentFile(view: EditorView) {
		const file = this.getFileFromView(view);

		if (file instanceof TFile) {
			try {
				// Use getCachedTaskInfoSync which includes the isTaskFile check
				// This will return null if the file is not a task note
				const newTask = this.plugin.cacheManager.getCachedTaskInfoSync(file.path);

				// Helper to check if task has active time tracking session
				const hasActiveSession = (task: TaskInfo | null): boolean => {
					if (!task?.timeEntries || task.timeEntries.length === 0) return false;
					const lastEntry = task.timeEntries[task.timeEntries.length - 1];
					return !lastEntry.endTime;
				};

				// Check if task actually changed - must check all properties that affect widget display
				const taskChanged =
					this.cachedTask?.title !== newTask?.title ||
					this.cachedTask?.status !== newTask?.status ||
					this.cachedTask?.priority !== newTask?.priority ||
					this.cachedTask?.due !== newTask?.due ||
					this.cachedTask?.scheduled !== newTask?.scheduled ||
					this.cachedTask?.path !== newTask?.path ||
					this.cachedTask?.archived !== newTask?.archived ||
					this.cachedTask?.timeEstimate !== newTask?.timeEstimate ||
					this.cachedTask?.recurrence !== newTask?.recurrence ||
					hasActiveSession(this.cachedTask) !== hasActiveSession(newTask) ||
					JSON.stringify(this.cachedTask?.tags || []) !==
						JSON.stringify(newTask?.tags || []) ||
					JSON.stringify(this.cachedTask?.contexts || []) !==
						JSON.stringify(newTask?.contexts || []) ||
					JSON.stringify(this.cachedTask?.projects || []) !==
						JSON.stringify(newTask?.projects || []) ||
					JSON.stringify(this.cachedTask?.complete_instances || []) !==
						JSON.stringify(newTask?.complete_instances || []);

				if (taskChanged) {
					this.cachedTask = newTask;
					this.injectWidget(view);
				}
			} catch (error) {
				console.error("[TaskNotes] Error loading task for task note:", error);
			}
		} else {
			if (this.cachedTask !== null) {
				this.cachedTask = null;
				this.injectWidget(view);
			}
		}
	}

	private getFileFromView(view: EditorView): TFile | null {
		try {
			// Get the file associated with this specific editor view
			const editorInfo = view.state.field(editorInfoField, false);
			return editorInfo?.file || null;
		} catch (error) {
			console.debug('[TaskNotes] Error getting file from editor view:', error);
			return null;
		}
	}

	private isTableCellEditor(view: EditorView): boolean {
		try {
			// Check if the editor is inside a table cell using DOM inspection
			const editorElement = view.dom;
			if (!editorElement) return false;

			const tableCell = editorElement.closest("td, th");
			if (tableCell) return true;

			const obsidianTableWidget = editorElement.closest(".cm-table-widget");
			if (obsidianTableWidget) return true;

			const popover = editorElement.closest(".popover.hover-popover");
			if (popover) return true;

			const footnoteEmbed = editorElement.closest(".markdown-embed[data-type='footnote']");
			if (footnoteEmbed) return true;

			const editorInfo = view.state.field(editorInfoField, false);
			if (!editorInfo?.file) {
				let parent = editorElement.parentElement;
				let depth = 0;
				const MAX_DEPTH = 20; // Prevent infinite loops

				while (parent && parent !== document.body && depth < MAX_DEPTH) {
					if (
						parent.tagName === "TABLE" ||
						parent.tagName === "TD" ||
						parent.tagName === "TH" ||
						parent.classList.contains("markdown-rendered")
					) {
						return true;
					}
					if (parent.classList.contains("popover") || parent.classList.contains("hover-popover")) {
						return true;
					}
					if (parent.classList.contains("markdown-embed") &&
					    parent.getAttribute("data-type") === "footnote") {
						return true;
					}
					parent = parent.parentElement;
					depth++;
				}
			}

			return false;
		} catch (error) {
			console.debug("[TaskNotes] Error detecting table cell editor:", error);
			return false;
		}
	}

	private injectWidget(view: EditorView): void {
		// Remove any existing widget first
		this.removeWidget();

		// Also clean up any orphaned widgets
		this.cleanupOrphanedWidgets(view);

		try {
			// Don't show widget in table cell editors
			if (this.isTableCellEditor(view)) {
				return;
			}

			// Check if task card widget is enabled
			if (!this.plugin.settings.showTaskCardInNote) {
				return;
			}

			// Only inject if we have a cached task
			if (!this.cachedTask) {
				return;
			}

			// Find .cm-sizer which contains the scrollable content area
			// RISK: This relies on CodeMirror's internal DOM structure
			const targetContainer = view.dom.closest('.markdown-source-view')?.querySelector<HTMLElement>('.cm-sizer');
			if (!targetContainer) {
				console.warn('[TaskNotes] Could not find .cm-sizer container for task card widget');
				return;
			}

			// Create the widget
			const widget = createTaskCardWidget(this.plugin, this.cachedTask);

			// Store references
			this.currentWidget = widget;
			this.widgetContainer = targetContainer;

			// Insert after properties/frontmatter if present, otherwise at the beginning
			// RISK: Relies on .metadata-container class from Obsidian
			const metadataContainer = targetContainer.querySelector('.metadata-container');
			if (metadataContainer?.nextSibling) {
				metadataContainer.parentElement?.insertBefore(widget, metadataContainer.nextSibling);
			} else {
				targetContainer.insertBefore(widget, targetContainer.firstChild);
			}

			// Emit event for coordination with other widgets (e.g., relationships)
			this.plugin.emitter.trigger(EVENT_TASK_CARD_INJECTED, { container: targetContainer });

		} catch (error) {
			console.error("[TaskNotes] Error injecting task card widget:", error);
			// Clean up on error
			this.removeWidget();
		}
	}
}

/**
 * Create the task card note decorations extension
 */
export function createTaskCardNoteDecorations(plugin: TaskNotesPlugin): Extension {
	return ViewPlugin.fromClass(
		class extends TaskCardNoteDecorationsPlugin {
			constructor(view: EditorView) {
				super(view, plugin);
			}

			destroy() {
				super.destroy();
			}
		}
	);
}

/**
 * Inject task card widget into reading mode view
 */
async function injectReadingModeWidget(
	leaf: WorkspaceLeaf,
	plugin: TaskNotesPlugin
): Promise<void> {
	const view = leaf.view;
	if (!(view instanceof MarkdownView) || view.getMode() !== 'preview') {
		return;
	}

	const file = view.file;
	if (!file) {
		return;
	}

	// Check if task card widget is enabled
	if (!plugin.settings.showTaskCardInNote) {
		return;
	}

	// Get task info for this file
	const task = plugin.cacheManager.getCachedTaskInfoSync(file.path);
	if (!task) {
		// Not a task note - remove any existing widgets
		try {
			const previewView = view.previewMode;
			const containerEl = previewView.containerEl;
			containerEl.querySelectorAll(`.${CSS_TASK_CARD_WIDGET}`).forEach(el => {
				const holder = el as HTMLElementWithComponent;
				holder.component?.unload();
				el.remove();
			});
		} catch (error) {
			console.debug('[TaskNotes] Error cleaning up task card in reading mode:', error);
		}
		return;
	}

	try {
		// Remove any existing widgets first
		const previewView = view.previewMode;
		const containerEl = previewView.containerEl;
		containerEl.querySelectorAll(`.${CSS_TASK_CARD_WIDGET}`).forEach(el => {
			const holder = el as HTMLElementWithComponent;
			holder.component?.unload();
			el.remove();
		});

		// Create the widget
		const widget = createTaskCardWidget(plugin, task);

		// Find the markdown-preview-sizer
		// RISK: Relies on Obsidian's internal DOM structure
		const sizer = containerEl.querySelector<HTMLElement>('.markdown-preview-sizer');
		if (!sizer) {
			console.warn('[TaskNotes] Could not find .markdown-preview-sizer for task card in reading mode');
			return;
		}

		// Insert after properties/frontmatter if present, otherwise at the beginning
		const metadataContainer = sizer.querySelector('.metadata-container');
		if (metadataContainer?.nextSibling) {
			sizer.insertBefore(widget, metadataContainer.nextSibling);
		} else {
			sizer.insertBefore(widget, sizer.firstChild);
		}
	} catch (error) {
		console.error('[TaskNotes] Error injecting task card widget in reading mode:', error);
	}
}

/**
 * Setup reading mode handlers for task card widget
 * Returns cleanup function to remove handlers
 */
export function setupReadingModeHandlers(plugin: TaskNotesPlugin): () => void {
	// Track event refs by source for proper cleanup
	const workspaceRefs: EventRef[] = [];
	const metadataCacheRefs: EventRef[] = [];
	const emitterRefs: EventRef[] = [];

	// Debounce to prevent excessive re-renders
	let debounceTimer: number | null = null;
	const debouncedRefresh = () => {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = window.setTimeout(() => {
			const leaves = plugin.app.workspace.getLeavesOfType('markdown');
			leaves.forEach(leaf => {
				injectReadingModeWidget(leaf, plugin);
			});
		}, 100);
	};

	// Inject widget when layout changes (file opened, switched, etc.)
	const layoutChangeRef = plugin.app.workspace.on('layout-change', debouncedRefresh);
	workspaceRefs.push(layoutChangeRef);

	// Inject widget when active leaf changes
	const activeLeafChangeRef = plugin.app.workspace.on('active-leaf-change', (leaf) => {
		if (leaf) {
			injectReadingModeWidget(leaf, plugin);
		}
	});
	workspaceRefs.push(activeLeafChangeRef);

	// Inject widget when file is modified (metadata changes) - debounced per file
	const metadataDebounceTimers = new Map<string, number>();
	const metadataChangeRef = plugin.app.metadataCache.on('changed', (file) => {
		// Clear existing timer for this file
		const existingTimer = metadataDebounceTimers.get(file.path);
		if (existingTimer) clearTimeout(existingTimer);

		// Debounce per file to avoid freezing during typing
		const timer = window.setTimeout(() => {
			metadataDebounceTimers.delete(file.path);
			const leaves = plugin.app.workspace.getLeavesOfType('markdown');
			leaves.forEach(leaf => {
				const view = leaf.view;
				if (view instanceof MarkdownView && view.file === file) {
					injectReadingModeWidget(leaf, plugin);
				}
			});
		}, 500);
		metadataDebounceTimers.set(file.path, timer);
	});
	metadataCacheRefs.push(metadataChangeRef);

	// Listen for task updates to refresh the widget
	const taskUpdateListener = plugin.emitter.on(EVENT_TASK_UPDATED, debouncedRefresh);
	emitterRefs.push(taskUpdateListener);

	const dataChangeListener = plugin.emitter.on(EVENT_DATA_CHANGED, debouncedRefresh);
	emitterRefs.push(dataChangeListener);

	// Initial injection for any already-open reading views
	const leaves = plugin.app.workspace.getLeavesOfType('markdown');
	leaves.forEach(leaf => {
		injectReadingModeWidget(leaf, plugin);
	});

	// Return cleanup function
	return () => {
		if (debounceTimer) clearTimeout(debounceTimer);

		// Clean up each type of event ref with the correct method
		workspaceRefs.forEach(ref => plugin.app.workspace.offref(ref));
		metadataCacheRefs.forEach(ref => plugin.app.metadataCache.offref(ref));
		emitterRefs.forEach(ref => plugin.emitter.offref(ref));
	};
}
