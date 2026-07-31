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

import { EditorView, PluginValue, ViewPlugin, ViewUpdate } from "@codemirror/view";
import {
	EVENT_DATA_CHANGED,
	EVENT_TASK_DELETED,
	EVENT_TASK_UPDATED,
	EVENT_DATE_CHANGED,
	TaskInfo,
} from "../types";
import { Component, EventRef, TFile, editorInfoField, MarkdownView, WorkspaceLeaf } from "obsidian";
import { Extension } from "@codemirror/state";

import TaskNotesPlugin from "../main";
import { createTaskCard } from "../ui/TaskCard";
import { convertInternalToUserProperties } from "../utils/propertyMapping";
import {
	ReadingModeInjectionContext,
	ReadingModeInjectionScheduler,
} from "./ReadingModeInjectionScheduler";
import {
	shouldSkipMarkdownWidgetEditor,
	shouldSkipMarkdownWidgetLeaf,
} from "./MarkdownWidgetContext";
import { insertAfterMetadataOrHeader } from "./MarkdownWidgetInsertion";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Editor/TaskCardNoteDecorations" });

// CSS class for identifying plugin-generated elements
const CSS_TASK_CARD_WIDGET = "tasknotes-task-card-note-widget";

// Event emitted when task card widget is injected
const EVENT_TASK_CARD_INJECTED = "task-card-injected";

// Interface to track component lifecycle
interface HTMLElementWithComponent extends HTMLElement {
	component?: Component;
}

interface CanvasNodeLike {
	file?: OneOf<string, TFile>;
	filePath?: string;
	contentEl?: HTMLElement;
	isEditing?: boolean;
}

type OneOf<T, U> = T | U;

interface CanvasLike {
	nodes?: {
		values?: () => Iterable<CanvasNodeLike>;
	};
}

interface CanvasViewLike {
	canvas?: CanvasLike;
}

/**
 * Helper function to create the task card widget
 * Now includes Component lifecycle management for proper cleanup
 */
function createTaskCardWidget(plugin: TaskNotesPlugin, task: TaskInfo): HTMLElementWithComponent {
	const container = activeDocument.createElement("div") as HTMLElementWithComponent;
	container.className = `tasknotes-plugin task-card-note-widget ${CSS_TASK_CARD_WIDGET}`;

	container.setAttribute("contenteditable", "false");
	container.setAttribute("spellcheck", "false");
	container.setAttribute("data-widget-type", "task-card");
	container.setAttribute("data-task-path", task.path);

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

function removeTaskCardWidgets(container: ParentNode): void {
	container.querySelectorAll(`.${CSS_TASK_CARD_WIDGET}`).forEach((el) => {
		const holder = el as HTMLElementWithComponent;
		holder.component?.unload();
		el.remove();
	});
}

function findCanvasEmbedTaskCardContainer(el: HTMLElement): HTMLElement | null {
	return el.querySelector<HTMLElement>(".markdown-preview-sizer");
}

function isElementHidden(element: HTMLElement): boolean {
	let current: HTMLElement | null = element;
	const view = element.ownerDocument.defaultView;

	while (current) {
		const style = view?.getComputedStyle(current);
		if (
			current.style.display === "none" ||
			style?.display === "none" ||
			style?.visibility === "hidden"
		) {
			return true;
		}

		current = current.parentElement;
	}

	return false;
}

function isCanvasNodeEditing(node: CanvasNodeLike, contentEl: HTMLElement): boolean {
	if (node.isEditing) {
		return true;
	}

	if (contentEl.querySelector(".markdown-source-view, .cm-editor")) {
		return true;
	}

	const previewSizer = findCanvasEmbedTaskCardContainer(contentEl);
	return Boolean(previewSizer && isElementHidden(previewSizer));
}

function canvasNodeNeedsWidgetRefresh(node: CanvasNodeLike, contentEl: HTMLElement): boolean {
	const widgets = Array.from(contentEl.querySelectorAll(`.${CSS_TASK_CARD_WIDGET}`));
	if (widgets.length === 0) {
		return true;
	}

	const hasDirectWidget = widgets.some((widget) => widget.parentElement === contentEl);
	const hasPreviewWidget = widgets.some((widget) =>
		Boolean(widget.closest(".markdown-preview-sizer"))
	);

	return isCanvasNodeEditing(node, contentEl)
		? !hasDirectWidget
		: hasDirectWidget || !hasPreviewWidget;
}

function getCanvasNodes(leaf: WorkspaceLeaf): CanvasNodeLike[] {
	const canvas = (leaf.view as CanvasViewLike | undefined)?.canvas;
	const nodes = canvas?.nodes;
	const values = nodes?.values;

	if (typeof values !== "function") {
		return [];
	}

	return Array.from(values.call(nodes));
}

function getCanvasNodeFilePath(node: CanvasNodeLike): string | null {
	if (typeof node.filePath === "string" && node.filePath.trim()) {
		return node.filePath;
	}

	if (typeof node.file === "string" && node.file.trim()) {
		return node.file;
	}

	if (node.file instanceof TFile) {
		return node.file.path;
	}

	return null;
}

export class TaskCardNoteDecorationsPlugin implements PluginValue {
	private cachedTask: TaskInfo | null = null;
	private currentFile: unknown = null;
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
			window.clearTimeout(this.debounceTimer);
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
			if (this.debounceTimer) window.clearTimeout(this.debounceTimer);
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
			const container =
				view.dom.closest(".canvas-node-content") ??
				view.dom.closest(".workspace-leaf-content");
			if (!container) {
				tasknotesLogger.debug(
					"[TaskNotes] Could not find workspace-leaf-content for orphan cleanup",
					{
						category: "stale-data",
						operation: "find-workspace-leaf-content-orphan-cleanup",
					}
				);
				return;
			}

			container.querySelectorAll(`.${CSS_TASK_CARD_WIDGET}`).forEach((el) => {
				if (el !== this.currentWidget) {
					const holder = el as HTMLElementWithComponent;
					holder.component?.unload();
					el.remove();
				}
			});
		} catch (error) {
			tasknotesLogger.error("[TaskNotes] Error cleaning up orphaned task card widgets:", {
				category: "stale-data",
				operation: "cleaning-up-orphaned-task-card-widgets",
				error: error,
			});
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
				tasknotesLogger.error("[TaskNotes] Error loading task for task note:", {
					category: "persistence",
					operation: "loading-task-task-note",
					error: error,
				});
			}
		} else {
			if (this.cachedTask !== null) {
				this.cachedTask = null;
				this.injectWidget(view);
			}
		}
	}

	private getFileFromView(view: EditorView): unknown {
		try {
			// Get the file associated with this specific editor view
			const editorInfo = view.state.field(editorInfoField, false);
			return editorInfo?.file || null;
		} catch (error) {
			tasknotesLogger.debug("[TaskNotes] Error getting file from editor view:", {
				category: "persistence",
				operation: "getting-file-editor-view",
				error: error,
			});
			return null;
		}
	}

	private isTableCellEditor(view: EditorView): boolean {
		try {
			// Check if the editor is inside a table cell using DOM inspection
			const editorElement = view.dom;
			if (!editorElement) return false;

			if (shouldSkipMarkdownWidgetEditor(view)) return true;

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

				while (parent && parent !== activeDocument.body && depth < MAX_DEPTH) {
					if (
						parent.tagName === "TABLE" ||
						parent.tagName === "TD" ||
						parent.tagName === "TH" ||
						parent.classList.contains("markdown-rendered")
					) {
						return true;
					}
					if (
						parent.classList.contains("popover") ||
						parent.classList.contains("hover-popover")
					) {
						return true;
					}
					if (
						parent.classList.contains("markdown-embed") &&
						parent.getAttribute("data-type") === "footnote"
					) {
						return true;
					}
					parent = parent.parentElement;
					depth++;
				}
			}

			return false;
		} catch (error) {
			tasknotesLogger.debug("[TaskNotes] Error detecting table cell editor:", {
				category: "persistence",
				operation: "detecting-table-cell-editor",
				error: error,
			});
			return false;
		}
	}

	private injectWidget(view: EditorView): void {
		// Remove any existing widget first
		this.removeWidget();

		// Don't show note-level widgets in embedded or detached markdown editors
		if (this.isTableCellEditor(view)) {
			if (view.dom.closest(".canvas-node-content")) {
				window.setTimeout(() => {
					injectCanvasTaskCardWidgets(this.plugin, { force: true });
				}, 0);
			}
			return;
		}

		// Also clean up any orphaned widgets
		this.cleanupOrphanedWidgets(view);

		try {
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
			const targetContainer = view.dom
				.closest(".markdown-source-view")
				?.querySelector<HTMLElement>(".cm-sizer");
			if (!targetContainer) {
				tasknotesLogger.warn(
					"[TaskNotes] Could not find .cm-sizer container for task card widget",
					{
						category: "stale-data",
						operation: "find-cm-sizer-container-task-card-widget",
					}
				);
				return;
			}

			// Create the widget
			const widget = createTaskCardWidget(this.plugin, this.cachedTask);

			// Store references
			this.currentWidget = widget;
			this.widgetContainer = targetContainer;

			insertAfterMetadataOrHeader(targetContainer, widget);

			// Emit event for coordination with other widgets (e.g., relationships)
			this.plugin.emitter.trigger(EVENT_TASK_CARD_INJECTED, { container: targetContainer });
		} catch (error) {
			tasknotesLogger.error("[TaskNotes] Error injecting task card widget:", {
				category: "persistence",
				operation: "injecting-task-card-widget",
				error: error,
			});
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
	plugin: TaskNotesPlugin,
	context?: ReadingModeInjectionContext
): Promise<void> {
	const view = leaf.view;
	if (!(view instanceof MarkdownView) || view.getMode() !== "preview") {
		return;
	}

	if (shouldSkipMarkdownWidgetLeaf(leaf)) {
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
			removeTaskCardWidgets(containerEl);
		} catch (error) {
			tasknotesLogger.debug("[TaskNotes] Error cleaning up task card in reading mode:", {
				category: "persistence",
				operation: "cleaning-up-task-card-reading-mode",
				error: error,
			});
		}
		return;
	}

	try {
		// Remove any existing widgets first
		const previewView = view.previewMode;
		const containerEl = previewView.containerEl;
		removeTaskCardWidgets(containerEl);

		// Create the widget
		const widget = createTaskCardWidget(plugin, task);
		if (context && !context.isCurrent()) {
			widget.component?.unload();
			widget.remove();
			return;
		}

		// Find the markdown-preview-sizer
		// RISK: Relies on Obsidian's internal DOM structure
		const sizer = containerEl.querySelector<HTMLElement>(".markdown-preview-sizer");
		if (!sizer) {
			tasknotesLogger.warn(
				"[TaskNotes] Could not find .markdown-preview-sizer for task card in reading mode",
				{
					category: "stale-data",
					operation: "find-markdown-preview-sizer-task-card-reading-mode",
				}
			);
			return;
		}

		insertAfterMetadataOrHeader(sizer, widget);
	} catch (error) {
		tasknotesLogger.error("[TaskNotes] Error injecting task card widget in reading mode:", {
			category: "persistence",
			operation: "injecting-task-card-widget-reading-mode",
			error: error,
		});
	}
}

export function injectCanvasTaskCardWidgets(
	plugin: TaskNotesPlugin,
	options: { force?: boolean } = {}
): void {
	if (!plugin.settings.showTaskCardInNote) {
		return;
	}

	for (const leaf of plugin.app.workspace.getLeavesOfType("canvas")) {
		for (const node of getCanvasNodes(leaf)) {
			const filePath = getCanvasNodeFilePath(node);
			const contentEl = node.contentEl;
			if (!filePath || !contentEl) {
				continue;
			}

			const isEditing = isCanvasNodeEditing(node, contentEl);
			const sourceEditor = contentEl.querySelector<HTMLElement>(
				".markdown-source-view, .cm-editor"
			);
			if (sourceEditor?.querySelector(`.${CSS_TASK_CARD_WIDGET}`)) {
				continue;
			}

			const targetContainer = findCanvasEmbedTaskCardContainer(contentEl);
			if (!isEditing && !targetContainer) {
				continue;
			}

			if (!options.force && !canvasNodeNeedsWidgetRefresh(node, contentEl)) {
				continue;
			}

			const task = plugin.cacheManager.getCachedTaskInfoSync(filePath);
			removeTaskCardWidgets(contentEl);

			if (!task) {
				continue;
			}

			const widget = createTaskCardWidget(plugin, task);
			if (isEditing) {
				contentEl.insertBefore(widget, contentEl.firstChild);
			} else if (targetContainer) {
				insertAfterMetadataOrHeader(targetContainer, widget);
			}
		}
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
	const canvasObservers: MutationObserver[] = [];
	const canvasInteractionCleanups: Array<() => void> = [];
	const observedCanvasContainers = new WeakSet<HTMLElement>();
	const scheduler = new ReadingModeInjectionScheduler();
	const scheduleInjection = (leaf: WorkspaceLeaf) => {
		scheduler.schedule(leaf, (context) => injectReadingModeWidget(leaf, plugin, context));
	};

	// Debounce to prevent excessive re-renders
	let debounceTimer: number | null = null;
	let canvasDebounceTimer: number | null = null;
	const debouncedCanvasRefresh = (options: { force?: boolean } = {}) => {
		if (canvasDebounceTimer) window.clearTimeout(canvasDebounceTimer);
		canvasDebounceTimer = window.setTimeout(() => {
			injectCanvasTaskCardWidgets(plugin, options);
			canvasDebounceTimer = null;
		}, 100);
	};
	const observeCanvasLeaves = () => {
		for (const leaf of plugin.app.workspace.getLeavesOfType("canvas")) {
			const containerEl = (leaf.view as { containerEl?: HTMLElement }).containerEl;
			if (!containerEl || observedCanvasContainers.has(containerEl)) {
				continue;
			}

			const observer = new MutationObserver(() => {
				debouncedCanvasRefresh();
			});
			observer.observe(containerEl, {
				attributes: true,
				attributeFilter: ["class", "style"],
				childList: true,
				subtree: true,
			});

			const handleCanvasInteraction = () => {
				debouncedCanvasRefresh({ force: true });
			};
			containerEl.addEventListener("pointerdown", handleCanvasInteraction, true);
			containerEl.addEventListener("focusin", handleCanvasInteraction, true);
			canvasInteractionCleanups.push(() => {
				containerEl.removeEventListener("pointerdown", handleCanvasInteraction, true);
				containerEl.removeEventListener("focusin", handleCanvasInteraction, true);
			});

			observedCanvasContainers.add(containerEl);
			canvasObservers.push(observer);
		}
	};
	const debouncedRefresh = () => {
		if (debounceTimer) window.clearTimeout(debounceTimer);
		debounceTimer = window.setTimeout(() => {
			const leaves = plugin.app.workspace.getLeavesOfType("markdown");
			leaves.forEach((leaf) => {
				scheduleInjection(leaf);
			});
			observeCanvasLeaves();
			debouncedCanvasRefresh({ force: true });
		}, 100);
	};

	// Inject widget when layout changes (file opened, switched, etc.)
	const layoutChangeRef = plugin.app.workspace.on("layout-change", debouncedRefresh);
	workspaceRefs.push(layoutChangeRef);

	// Inject widget when active leaf changes
	const activeLeafChangeRef = plugin.app.workspace.on("active-leaf-change", (leaf) => {
		if (leaf) {
			scheduleInjection(leaf);
			observeCanvasLeaves();
			debouncedCanvasRefresh();
		}
	});
	workspaceRefs.push(activeLeafChangeRef);

	// Inject widget when file is modified (metadata changes) - debounced per file
	const metadataDebounceTimers = new Map<string, number>();
	const metadataChangeRef = plugin.app.metadataCache.on("changed", (file) => {
		// Clear existing timer for this file
		const existingTimer = metadataDebounceTimers.get(file.path);
		if (existingTimer) window.clearTimeout(existingTimer);

		// Debounce per file to avoid freezing during typing
		const timer = window.setTimeout(() => {
			metadataDebounceTimers.delete(file.path);
			const leaves = plugin.app.workspace.getLeavesOfType("markdown");
			leaves.forEach((leaf) => {
				const view = leaf.view;
				if (view instanceof MarkdownView && view.file === file) {
					scheduleInjection(leaf);
				}
			});
			debouncedCanvasRefresh({ force: true });
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
	const leaves = plugin.app.workspace.getLeavesOfType("markdown");
	leaves.forEach((leaf) => {
		scheduleInjection(leaf);
	});
	observeCanvasLeaves();
	debouncedCanvasRefresh({ force: true });

	// Return cleanup function
	return () => {
		if (debounceTimer) window.clearTimeout(debounceTimer);
		if (canvasDebounceTimer) window.clearTimeout(canvasDebounceTimer);
		canvasObservers.forEach((observer) => observer.disconnect());
		canvasInteractionCleanups.forEach((cleanup) => cleanup());

		// Clean up each type of event ref with the correct method
		workspaceRefs.forEach((ref) => plugin.app.workspace.offref(ref));
		metadataCacheRefs.forEach((ref) => plugin.app.metadataCache.offref(ref));
		emitterRefs.forEach((ref) => plugin.emitter.offref(ref));
	};
}
