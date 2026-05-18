/**
 * Relationships Decorations
 *
 * ARCHITECTURAL NOTE:
 * This implementation uses direct DOM manipulation to inject relationships widgets into
 * the CodeMirror editor, rather than using CodeMirror's official Panel or Decoration APIs.
 *
 * WHY THIS APPROACH:
 * - CodeMirror Panel API: Designed for editor chrome (toolbars, status bars), always positions
 *   content at the very top or bottom of the editor, cannot be positioned within document flow
 * - CodeMirror Decoration API: Had cursor interaction issues where widgets interfered with
 *   text editing and cursor positioning
 * - DOM Manipulation: Allows precise positioning within document (after frontmatter/task card
 *   or before backlinks) without interfering with CodeMirror's text editing
 *
 * RISKS & LIMITATIONS:
 * - Relies on undocumented DOM structure (.cm-sizer, .metadata-container classes)
 * - May break with CodeMirror or Obsidian updates
 * - Bypasses CodeMirror's rendering pipeline
 * - No automatic cleanup from CodeMirror
 * - Widget ordering depends on finding sibling elements in DOM
 *
 * MITIGATION:
 * - Comprehensive null checks and error handling
 * - Defensive DOM queries with fallbacks
 * - Manual cleanup in destroy() lifecycle
 * - Orphaned widget cleanup
 * - CSS classes instead of inline styles for theme compatibility
 * - Event coordination with task card widget for consistent ordering
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
	Component,
	EventRef,
	MarkdownView,
	TFile,
	editorInfoField,
	MarkdownRenderer,
	WorkspaceLeaf,
} from "obsidian";
import { Extension } from "@codemirror/state";

import TaskNotesPlugin from "../main";
import { EVENT_DEPENDENCY_CACHE_CHANGED } from "../utils/DependencyCache";
import {
	ReadingModeInjectionContext,
	ReadingModeInjectionScheduler,
} from "./ReadingModeInjectionScheduler";
import {
	shouldSkipMarkdownWidgetEditor,
	shouldSkipMarkdownWidgetLeaf,
} from "./MarkdownWidgetContext";
import { insertAfterElement, insertAfterMetadataOrHeader } from "./MarkdownWidgetInsertion";
import { FilterUtils } from "../utils/FilterUtils";
import { collectCacheTags } from "../utils/tagExtraction";
import { getProjectPropertyFilter, matchesProjectProperty } from "../utils/projectFilterUtils";

// CSS class for identifying plugin-generated elements
const CSS_RELATIONSHIPS_WIDGET = "tasknotes-relationships-widget";

// Event to listen for task card injection
const EVENT_TASK_CARD_INJECTED = "task-card-injected";

// Interface to track component lifecycle
interface HTMLElementWithComponent extends HTMLElement {
	component?: Component;
}

function getHTMLElementChildren(element: HTMLElement): HTMLElement[] {
	return Array.from(element.children).filter(
		(child): child is HTMLElement => child.instanceOf(HTMLElement)
	);
}

type ProjectMarkerMetadata = {
	frontmatter?: Record<string, unknown> | null;
	tags?: Array<{ tag?: string }>;
};

export function isProjectNoteByAutosuggestMarkers(
	plugin: TaskNotesPlugin,
	metadata: ProjectMarkerMetadata | null | undefined
): boolean {
	const projectAutosuggest = plugin.settings.projectAutosuggest;
	if (!projectAutosuggest) {
		return false;
	}

	const requiredTags = projectAutosuggest.requiredTags ?? [];
	const hasPositiveTagRequirement = requiredTags.some((tag) => !tag.trim().startsWith("-"));
	if (
		hasPositiveTagRequirement &&
		FilterUtils.matchesTagConditions(collectCacheTags(metadata), requiredTags)
	) {
		return true;
	}

	const propertyFilter = getProjectPropertyFilter(projectAutosuggest);
	return propertyFilter.enabled && matchesProjectProperty(metadata?.frontmatter, propertyFilter);
}

function isProjectNoteForRelationships(
	plugin: TaskNotesPlugin,
	file: TFile,
	metadata: ProjectMarkerMetadata | null | undefined
): boolean {
	return Boolean(
		plugin.dependencyCache?.isFileUsedAsProject(file.path) ||
			isProjectNoteByAutosuggestMarkers(plugin, metadata)
	);
}

export function findRelationshipsBottomAnchor(container: HTMLElement): HTMLElement | null {
	const cmContent = container.querySelector<HTMLElement>(".cm-content");
	if (cmContent) {
		return cmContent.closest<HTMLElement>(".cm-contentContainer") ?? cmContent;
	}

	const children = getHTMLElementChildren(container).filter(
		(child) =>
			!child.classList.contains(CSS_RELATIONSHIPS_WIDGET) &&
			!child.classList.contains("embedded-backlinks") &&
			!child.classList.contains("markdown-preview-pusher") &&
			!child.classList.contains("mod-footer")
	);

	return children.length > 0 ? children[children.length - 1] : null;
}

export function applyRelationshipsBottomOffset(container: HTMLElement, widget: HTMLElement): void {
	const cmContent = container.querySelector<HTMLElement>(".cm-content");
	if (!cmContent) {
		widget.style.removeProperty("--tn-relationships-widget-margin-top");
		return;
	}

	const lines = getHTMLElementChildren(cmContent).filter((child) =>
		child.classList.contains("cm-line")
	);
	const lastLine = lines.length > 0 ? lines[lines.length - 1] : null;
	const contentContainer = cmContent.closest<HTMLElement>(".cm-contentContainer");
	if (!lastLine || !contentContainer) {
		widget.style.removeProperty("--tn-relationships-widget-margin-top");
		return;
	}

	const spacerGap = Math.max(
		0,
		Math.round(
			contentContainer.getBoundingClientRect().bottom -
				lastLine.getBoundingClientRect().bottom
		)
	);
	if (spacerGap > 0) {
		widget.style.setProperty("--tn-relationships-widget-margin-top", `-${spacerGap}px`);
	} else {
		widget.style.removeProperty("--tn-relationships-widget-margin-top");
	}
}

export function insertRelationshipsWidgetAtBottom(
	container: HTMLElement,
	widget: HTMLElement
): void {
	const anchor = findRelationshipsBottomAnchor(container);
	applyRelationshipsBottomOffset(container, widget);
	if (anchor) {
		insertAfterElement(anchor, widget);
	} else {
		container.appendChild(widget);
	}
}

/**
 * Helper function to create and render the relationships widget content
 */
async function createRelationshipsWidget(
	plugin: TaskNotesPlugin,
	notePath: string
): Promise<HTMLElementWithComponent> {
	const container = activeDocument.createElement("div") as HTMLElementWithComponent;
	container.className = `tasknotes-plugin ${CSS_RELATIONSHIPS_WIDGET}`;

	container.setAttribute("contenteditable", "false");
	container.setAttribute("spellcheck", "false");
	container.setAttribute("data-widget-type", "relationships");

	// Create container for embedded Bases view
	const basesContainer = activeDocument.createElement("div");
	basesContainer.className = "relationships__bases-container";
	container.appendChild(basesContainer);

	// Create component for lifecycle management
	const component = new Component();
	component.load();
	container.component = component;

	try {
		// Get the Bases file path from settings
		const basesFilePath = plugin.settings.commandFileMapping["relationships"];
		if (!basesFilePath) {
			const errorDiv = activeDocument.createElement("div");
			errorDiv.className = "relationships__error";
			errorDiv.textContent = "Relationships view not configured";
			basesContainer.appendChild(errorDiv);
			return container;
		}

		// Create an embed link to the Bases file
		const embedMarkdown = `![[${basesFilePath}]]`;

		await MarkdownRenderer.render(
			plugin.app,
			embedMarkdown,
			basesContainer,
			notePath, // Source path provides context for 'this' keyword
			component
		);
	} catch (error) {
		console.error("[TaskNotes] Error rendering Bases view in relationships widget:", error);
		const errorDiv = activeDocument.createElement("div");
		errorDiv.className = "relationships__error";
		errorDiv.textContent = "Failed to load relationships view";
		basesContainer.appendChild(errorDiv);
	}

	return container;
}

class RelationshipsDecorationsPlugin implements PluginValue {
	private currentFile: unknown = null;
	private view: EditorView;
	private currentWidget: HTMLElementWithComponent | null = null;
	private widgetContainer: HTMLElement | null = null;
	private debounceTimer: number | null = null;
	private eventListeners: EventRef[] = [];
	private dependencyCacheEventListeners: EventRef[] = [];
	private injectionRunId = 0;
	private bottomOffsetFrame: number | null = null;

	constructor(
		view: EditorView,
		private plugin: TaskNotesPlugin
	) {
		this.view = view;
		this.currentFile = this.getFileFromView(view);

		// Set up event listeners for coordination
		this.setupEventListeners();

		// Inject widget asynchronously after construction to avoid overlapping startup updates.
		this.debouncedInjectWidget(view);
	}

	update(update: ViewUpdate) {
		// Store the updated view reference
		this.view = update.view;

		// Check if file changed for this specific view
		const newFile = this.getFileFromView(update.view);
		if (newFile !== this.currentFile) {
			this.currentFile = newFile;
			this.debouncedInjectWidget(update.view);
		} else if (update.docChanged || update.geometryChanged || update.viewportChanged) {
			this.scheduleBottomOffsetRefresh();
		}
	}

	destroy() {
		this.injectionRunId++;

		// Clean up debounce timer
		if (this.debounceTimer) {
			window.clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
		if (this.bottomOffsetFrame !== null) {
			window.cancelAnimationFrame(this.bottomOffsetFrame);
			this.bottomOffsetFrame = null;
		}

		// Clean up the widget and its component
		this.removeWidget();

		// Clean up event listeners
		this.eventListeners.forEach((listener) => {
			this.plugin.emitter.offref(listener);
		});
		this.eventListeners = [];

		this.dependencyCacheEventListeners.forEach((listener) => {
			this.plugin.dependencyCache?.offref(listener);
		});
		this.dependencyCacheEventListeners = [];
	}

	private setupEventListeners() {
		// Listen for task card injection to maintain proper widget order
		const taskCardListener = this.plugin.emitter.on(EVENT_TASK_CARD_INJECTED, () => {
			// Task card was injected, re-inject relationships to maintain order
			this.debouncedInjectWidget(this.view);
		});
		this.eventListeners.push(taskCardListener);

		// Listen for settings changes (might affect position or visibility)
		const settingsListener = this.plugin.emitter.on("settings-changed", () => {
			this.debouncedInjectWidget(this.view);
		});
		this.eventListeners.push(settingsListener);

		const dependencyCacheListener = this.plugin.dependencyCache?.on(
			EVENT_DEPENDENCY_CACHE_CHANGED,
			() => {
				this.debouncedInjectWidget(this.view);
			}
		);
		if (dependencyCacheListener) {
			this.dependencyCacheEventListeners.push(dependencyCacheListener);
		}
	}

	private debouncedInjectWidget(view: EditorView): void {
		if (this.debounceTimer) window.clearTimeout(this.debounceTimer);
		this.debounceTimer = window.setTimeout(() => {
			this.debounceTimer = null;
			void this.injectWidget(view);
		}, 100);
	}

	private scheduleBottomOffsetRefresh(): void {
		if (
			!this.currentWidget ||
			!this.widgetContainer ||
			(this.plugin.settings.relationshipsPosition || "bottom") !== "bottom"
		) {
			return;
		}

		if (this.bottomOffsetFrame !== null) {
			window.cancelAnimationFrame(this.bottomOffsetFrame);
		}

		this.bottomOffsetFrame = window.requestAnimationFrame(() => {
			this.bottomOffsetFrame = null;
			if (this.currentWidget?.isConnected && this.widgetContainer?.isConnected) {
				applyRelationshipsBottomOffset(this.widgetContainer, this.currentWidget);
			}
		});
	}

	private getFileFromView(view: EditorView): unknown {
		try {
			// Get the file associated with this specific editor view
			const editorInfo = view.state.field(editorInfoField, false);
			return editorInfo?.file || null;
		} catch (error) {
			console.debug("[TaskNotes] Error getting file from editor view:", error);
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
			console.debug("[TaskNotes] Error detecting table cell editor:", error);
			return false;
		}
	}

	private removeWidget(): void {
		if (this.bottomOffsetFrame !== null) {
			window.cancelAnimationFrame(this.bottomOffsetFrame);
			this.bottomOffsetFrame = null;
		}
		if (this.currentWidget) {
			// Unload the component
			this.currentWidget.component?.unload();
			// Remove from DOM
			this.currentWidget.remove();
			this.currentWidget = null;
		}
		this.widgetContainer = null;
	}

	private cleanupOrphanedWidgets(view: EditorView): void {
		try {
			// Remove any widget DOM that might exist from previous or overlapping instances.
			const container = view.dom.closest(".workspace-leaf-content");
			if (!container) {
				console.debug(
					"[TaskNotes] Could not find workspace-leaf-content for orphan cleanup"
				);
				return;
			}

			container.querySelectorAll(`.${CSS_RELATIONSHIPS_WIDGET}`).forEach((el) => {
				const holder = el as HTMLElementWithComponent;
				holder.component?.unload();
				el.remove();
			});
			this.currentWidget = null;
			this.widgetContainer = null;
		} catch (error) {
			console.error("[TaskNotes] Error cleaning up orphaned relationships widgets:", error);
		}
	}

	private async injectWidget(view: EditorView): Promise<void> {
		const runId = ++this.injectionRunId;

		// Remove any existing widget first
		this.removeWidget();

		// Don't show note-level widgets in embedded or detached markdown editors
		if (this.isTableCellEditor(view)) {
			return;
		}

		// Also clean up any orphaned widgets
		this.cleanupOrphanedWidgets(view);

		try {
			// Check if relationships widget is enabled
			if (!this.plugin.settings.showRelationships) {
				return;
			}

			// Get the current file
			const file = this.currentFile || this.getFileFromView(view);
			if (!(file instanceof TFile)) {
				return;
			}

			// Show widget in task notes OR project notes.
			// Get the file's frontmatter to check if it's a task or project
			let isTaskNote = false;
			let isProjectNote = false;
			const metadata = this.plugin.app.metadataCache.getFileCache(file);
			if (!metadata?.frontmatter) {
				isProjectNote = isProjectNoteForRelationships(this.plugin, file, metadata);
			} else {
				// Check if this is a task note
				isTaskNote = this.plugin.cacheManager.isTaskFile(metadata.frontmatter);
				isProjectNote = isProjectNoteForRelationships(this.plugin, file, metadata);
			}

			// Only show widget if it's either a task note or a project note
			if (!isTaskNote && !isProjectNote) {
				// Not a task or project note - don't show relationships widget
				return;
			}

			const notePath = file.path;
			const position = this.plugin.settings.relationshipsPosition || "bottom";

			// Find .cm-sizer which contains the scrollable content area
			// RISK: This relies on CodeMirror's internal DOM structure
			const targetContainer = view.dom
				.closest(".markdown-source-view")
				?.querySelector<HTMLElement>(".cm-sizer");

			if (!targetContainer) {
				console.warn(
					"[TaskNotes] Could not find .cm-sizer container for relationships widget"
				);
				return;
			}

			// Create the widget
			const widget = await createRelationshipsWidget(this.plugin, notePath);
			if (runId !== this.injectionRunId) {
				widget.component?.unload();
				widget.remove();
				return;
			}

			// A previous async run may have inserted after this run started.
			this.cleanupOrphanedWidgets(view);

			// Store references
			this.currentWidget = widget;
			this.widgetContainer = targetContainer;

			// For "top" position, insert after properties/frontmatter (and after task card if present)
			// For "bottom" position, insert after the last actual content element.
			if (position === "top") {
				// Try to find task card widget first (should come before relationships)
				// RISK: Relies on task card widget class name
				const taskCardWidget = targetContainer.querySelector(
					".tasknotes-task-card-note-widget"
				);
				if (taskCardWidget) {
					// Insert after task card widget to maintain order
					insertAfterElement(taskCardWidget, widget);
				} else {
					insertAfterMetadataOrHeader(targetContainer, widget);
				}
			} else {
				insertRelationshipsWidgetAtBottom(targetContainer, widget);
			}
		} catch (error) {
			console.error("[TaskNotes] Error injecting relationships widget:", error);
			// Clean up on error
			this.removeWidget();
		}
	}
}

/**
 * Create the relationships decorations extension for live preview mode
 */
export function createRelationshipsDecorations(plugin: TaskNotesPlugin): Extension {
	return ViewPlugin.fromClass(
		class extends RelationshipsDecorationsPlugin {
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
 * Inject relationships widget into reading mode view
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

	// Check if relationships widget is enabled
	if (!plugin.settings.showRelationships) {
		return;
	}

	// Show widget in task notes OR project notes.
	// Get the file's frontmatter to check if it's a task or project
	let isTaskNote = false;
	let isProjectNote = false;
	const metadata = plugin.app.metadataCache.getFileCache(file);
	if (!metadata?.frontmatter) {
		isProjectNote = isProjectNoteForRelationships(plugin, file, metadata);
	} else {
		// Check if this is a task note
		isTaskNote = plugin.cacheManager.isTaskFile(metadata.frontmatter);
		isProjectNote = isProjectNoteForRelationships(plugin, file, metadata);
	}

	if (!isTaskNote && !isProjectNote) {
		// Remove any existing widgets if conditions no longer met
		try {
			const previewView = view.previewMode;
			const containerEl = previewView.containerEl;
			containerEl.querySelectorAll(`.${CSS_RELATIONSHIPS_WIDGET}`).forEach((el) => {
				const holder = el as HTMLElementWithComponent;
				holder.component?.unload();
				el.remove();
			});
		} catch (error) {
			console.debug(
				"[TaskNotes] Error cleaning up relationships widget in reading mode:",
				error
			);
		}
		return;
	}

	try {
		// Remove any existing widgets first
		const previewView = view.previewMode;
		const containerEl = previewView.containerEl;
		containerEl.querySelectorAll(`.${CSS_RELATIONSHIPS_WIDGET}`).forEach((el) => {
			const holder = el as HTMLElementWithComponent;
			holder.component?.unload();
			el.remove();
		});

		const position = plugin.settings.relationshipsPosition || "bottom";
		const notePath = file.path;

		// Create the widget
		const widget = await createRelationshipsWidget(plugin, notePath);
		if (context && !context.isCurrent()) {
			widget.component?.unload();
			widget.remove();
			return;
		}

		// Find the markdown-preview-sizer or markdown-preview-section
		// RISK: Relies on Obsidian's internal DOM structure
		const sizer = containerEl.querySelector<HTMLElement>(".markdown-preview-sizer");
		if (!sizer) {
			console.warn(
				"[TaskNotes] Could not find .markdown-preview-sizer for relationships in reading mode"
			);
			return;
		}

		// Position the widget
		if (position === "top") {
			// Try to find task card widget first (should come before relationships)
			const taskCardWidget = sizer.querySelector(".tasknotes-task-card-note-widget");
			if (taskCardWidget) {
				// Insert after task card widget to maintain order
				insertAfterElement(taskCardWidget, widget);
			} else {
				insertAfterMetadataOrHeader(sizer, widget);
			}
		} else {
			insertRelationshipsWidgetAtBottom(sizer, widget);
		}
	} catch (error) {
		console.error("[TaskNotes] Error injecting relationships widget in reading mode:", error);
	}
}

/**
 * Setup reading mode handlers for relationships widget
 * Returns cleanup function to remove handlers
 */
export function setupReadingModeHandlers(plugin: TaskNotesPlugin): () => void {
	// Track event refs by source for proper cleanup
	const workspaceRefs: EventRef[] = [];
	const metadataCacheRefs: EventRef[] = [];
	const dependencyCacheRefs: EventRef[] = [];
	const scheduler = new ReadingModeInjectionScheduler();
	const scheduleInjection = (leaf: WorkspaceLeaf) => {
		scheduler.schedule(leaf, (context) => injectReadingModeWidget(leaf, plugin, context));
	};

	// Debounce to prevent excessive re-renders
	let debounceTimer: number | null = null;
	const debouncedRefresh = () => {
		if (debounceTimer) window.clearTimeout(debounceTimer);
		debounceTimer = window.setTimeout(() => {
			const leaves = plugin.app.workspace.getLeavesOfType("markdown");
			leaves.forEach((leaf) => {
				scheduleInjection(leaf);
			});
		}, 100);
	};

	// Inject widget when layout changes (file opened, switched, etc.)
	const layoutChangeRef = plugin.app.workspace.on("layout-change", debouncedRefresh);
	workspaceRefs.push(layoutChangeRef);

	// Inject widget when active leaf changes
	const activeLeafChangeRef = plugin.app.workspace.on("active-leaf-change", (leaf) => {
		if (leaf) {
			scheduleInjection(leaf);
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
		}, 500);
		metadataDebounceTimers.set(file.path, timer);
	});
	metadataCacheRefs.push(metadataChangeRef);

	const dependencyCacheChangeRef = plugin.dependencyCache?.on(
		EVENT_DEPENDENCY_CACHE_CHANGED,
		debouncedRefresh
	);
	if (dependencyCacheChangeRef) {
		dependencyCacheRefs.push(dependencyCacheChangeRef);
	}

	// Initial injection for any already-open reading views
	const leaves = plugin.app.workspace.getLeavesOfType("markdown");
	leaves.forEach((leaf) => {
		scheduleInjection(leaf);
	});

	// Return cleanup function
	return () => {
		if (debounceTimer) window.clearTimeout(debounceTimer);

		// Clean up each type of event ref with the correct method
		workspaceRefs.forEach((ref) => plugin.app.workspace.offref(ref));
		metadataCacheRefs.forEach((ref) => plugin.app.metadataCache.offref(ref));
		dependencyCacheRefs.forEach((ref) => plugin.dependencyCache?.offref(ref));
	};
}
