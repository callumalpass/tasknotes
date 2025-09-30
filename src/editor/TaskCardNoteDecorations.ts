import {
	Decoration,
	DecorationSet,
	EditorView,
	PluginSpec,
	PluginValue,
	ViewPlugin,
	ViewUpdate,
	WidgetType,
} from "@codemirror/view";
import {
	EVENT_DATA_CHANGED,
	EVENT_TASK_DELETED,
	EVENT_TASK_UPDATED,
	EVENT_DATE_CHANGED,
	TaskInfo,
} from "../types";
import { EventRef, TFile, editorInfoField, editorLivePreviewField } from "obsidian";
import { Extension, RangeSetBuilder, StateEffect } from "@codemirror/state";

import TaskNotesPlugin from "../main";
import { createTaskCard } from "../ui/TaskCard";

// Define a state effect for task card updates
const taskCardUpdateEffect = StateEffect.define<{ forceUpdate?: boolean }>();

export class TaskCardWidget extends WidgetType {
	constructor(
		private plugin: TaskNotesPlugin,
		private task: TaskInfo,
		private version: number = 0
	) {
		super();
	}

	// Override eq to ensure widget updates when task changes
	eq(other: TaskCardWidget): boolean {
		// Check if the task data has changed
		const taskEqual =
			this.task.title === other.task.title &&
			this.task.status === other.task.status &&
			this.task.priority === other.task.priority &&
			this.task.due === other.task.due &&
			this.task.scheduled === other.task.scheduled &&
			this.task.path === other.task.path &&
			JSON.stringify(this.task.contexts || []) ===
				JSON.stringify(other.task.contexts || []) &&
			JSON.stringify(this.task.projects || []) ===
				JSON.stringify(other.task.projects || []) &&
			JSON.stringify(this.task.tags || []) === JSON.stringify(other.task.tags || []) &&
			this.task.timeEstimate === other.task.timeEstimate &&
			this.task.recurrence === other.task.recurrence &&
			JSON.stringify(this.task.complete_instances || []) ===
				JSON.stringify(other.task.complete_instances || []);

		return this.version === other.version && taskEqual;
	}

	destroy(): void {
		// Nothing to clean up for now
	}

	toDOM(view: EditorView): HTMLElement {
		const container = document.createElement("div");
		container.className = "tasknotes-plugin task-card-note-widget cm-widget-cursor-fix";

		container.setAttribute("contenteditable", "false");
		container.setAttribute("spellcheck", "false");
		container.setAttribute("data-widget-type", "task-card");

		// Get the visible properties from settings
		const visibleProperties = this.plugin.settings.defaultVisibleProperties;

		// Create the task card
		const taskCard = createTaskCard(this.task, this.plugin, visibleProperties, {
			showDueDate: true,
			showCheckbox: false,
			showArchiveButton: false,
			showTimeTracking: true,
			showRecurringControls: true,
			groupByDate: false,
		});

		// Add specific styling for the note widget
		taskCard.classList.add("task-card-note-widget__card");

		container.appendChild(taskCard);

		return container;
	}
}

class TaskCardNoteDecorationsPlugin implements PluginValue {
	decorations: DecorationSet;
	private cachedTask: TaskInfo | null = null;
	private currentFile: TFile | null = null;
	private eventListeners: EventRef[] = [];
	private view: EditorView;
	private version = 0;

	constructor(
		view: EditorView,
		private plugin: TaskNotesPlugin
	) {
		this.view = view;
		this.decorations = this.buildDecorations(view);

		// Set up event listeners for data changes
		this.setupEventListeners();

		// Load task for current file asynchronously
		this.loadTaskForCurrentFile(view);
	}

	update(update: ViewUpdate) {
		// Store the updated view reference
		this.view = update.view;

		// Check for task card update effects
		const hasUpdateEffect = update.transactions.some((tr) =>
			tr.effects.some((effect) => effect.is(taskCardUpdateEffect))
		);

		if (update.docChanged || update.viewportChanged || hasUpdateEffect) {
			// If our custom effect is present, bump version so widgets are recreated
			if (hasUpdateEffect) {
				this.version++;
			}
			this.decorations = this.buildDecorations(update.view);
		}

		// Check if file changed for this specific view
		const newFile = this.getFileFromView(update.view);
		if (newFile !== this.currentFile) {
			this.currentFile = newFile;
			this.loadTaskForCurrentFile(update.view);
		}
	}

	destroy() {
		// Clean up event listeners
		this.eventListeners.forEach((listener) => {
			this.plugin.emitter.offref(listener);
		});
		this.eventListeners = [];
	}

	private setupEventListeners() {
		// Listen for data changes that might affect the task card
		const dataChangeListener = this.plugin.emitter.on(EVENT_DATA_CHANGED, () => {
			this.loadTaskForCurrentFile(this.view);
		});

		const taskUpdateListener = this.plugin.emitter.on(EVENT_TASK_UPDATED, () => {
			this.loadTaskForCurrentFile(this.view);
		});

		const taskDeleteListener = this.plugin.emitter.on(EVENT_TASK_DELETED, () => {
			this.loadTaskForCurrentFile(this.view);
		});

		const dateChangeListener = this.plugin.emitter.on(EVENT_DATE_CHANGED, () => {
			this.loadTaskForCurrentFile(this.view);
		});

		// Listen for settings changes
		const settingsChangeListener = this.plugin.emitter.on("settings-changed", () => {
			this.loadTaskForCurrentFile(this.view);
		});

		this.eventListeners.push(
			dataChangeListener,
			taskUpdateListener,
			taskDeleteListener,
			dateChangeListener,
			settingsChangeListener
		);
	}

	private dispatchUpdate() {
		// Increment version and dispatch update effect
		this.version++;
		if (this.view && typeof this.view.dispatch === "function") {
			try {
				this.view.dispatch({
					effects: [taskCardUpdateEffect.of({ forceUpdate: true })],
				});
			} catch (error) {
				console.error("Error dispatching task card update:", error);
			}
		}
	}

	private loadTaskForCurrentFile(view: EditorView) {
		const file = this.getFileFromView(view);

		if (file instanceof TFile) {
			try {
				// Use getCachedTaskInfoSync which includes the isTaskFile check
				// This will return null if the file is not a task note
				const newTask = this.plugin.cacheManager.getCachedTaskInfoSync(file.path);

				// Check if task actually changed
				const taskChanged =
					this.cachedTask?.title !== newTask?.title ||
					this.cachedTask?.status !== newTask?.status ||
					this.cachedTask?.priority !== newTask?.priority ||
					this.cachedTask?.due !== newTask?.due ||
					this.cachedTask?.scheduled !== newTask?.scheduled ||
					this.cachedTask?.path !== newTask?.path;

				if (taskChanged) {
					this.cachedTask = newTask;
					this.dispatchUpdate();
				}
			} catch (error) {
				console.error("Error loading task for task note:", error);
			}
		} else {
			if (this.cachedTask !== null) {
				this.cachedTask = null;
				this.dispatchUpdate();
			}
		}
	}

	private getFileFromView(view: EditorView): TFile | null {
		// Get the file associated with this specific editor view
		const editorInfo = view.state.field(editorInfoField, false);
		return editorInfo?.file || null;
	}

	private isTableCellEditor(view: EditorView): boolean {
		try {
			// Check if the editor is inside a table cell using DOM inspection
			const editorElement = view.dom;
			const tableCell = editorElement.closest("td, th");

			if (tableCell) {
				return true;
			}

			// Also check for Obsidian-specific table widget classes
			const obsidianTableWidget = editorElement.closest(".cm-table-widget");
			if (obsidianTableWidget) {
				return true;
			}

			// Additional check: inline editors without file association
			const editorInfo = view.state.field(editorInfoField, false);
			if (!editorInfo?.file) {
				// This might be an inline editor - check if parent is table-related
				let parent = editorElement.parentElement;
				while (parent && parent !== document.body) {
					if (
						parent.tagName === "TABLE" ||
						parent.tagName === "TD" ||
						parent.tagName === "TH" ||
						parent.classList.contains("markdown-rendered")
					) {
						return true;
					}
					parent = parent.parentElement;
				}
			}

			return false;
		} catch (error) {
			console.debug("Error detecting table cell editor:", error);
			return false;
		}
	}

	private buildDecorations(view: EditorView): DecorationSet {
		const builder = new RangeSetBuilder<Decoration>();

		try {
			// Don't show widget in table cell editors
			if (this.isTableCellEditor(view)) {
				return builder.finish();
			}

			// Check if task card widget is enabled
			if (!this.plugin.settings.showTaskCardInNote) {
				return builder.finish();
			}

			// Only show in live preview mode, not source mode
			if (!view.state.field(editorLivePreviewField)) {
				return builder.finish();
			}

			// Only build decorations if we have a cached task
			if (!this.cachedTask) {
				return builder.finish();
			}

			const doc = view.state.doc;

			// Ensure document has content
			if (doc.length === 0) {
				return builder.finish();
			}

			// Find insertion position based on settings
			let insertPos = this.findInsertionPosition(view, doc);

			// Ensure position is valid
			if (insertPos < 0 || insertPos > doc.length) {
				insertPos = 0;
			}

			const widget = Decoration.widget({
				widget: new TaskCardWidget(this.plugin, this.cachedTask, this.version),
				side: 1,
			});

			builder.add(insertPos, insertPos, widget);
		} catch (error) {
			console.error("Error building task card note decorations:", error);
		}

		return builder.finish();
	}

	private findInsertionPosition(view: EditorView, doc: any): number {
		if (doc.lines === 0) return 0;

		// Always position at top - after frontmatter if present
		const docText = doc.toString();
		const frontmatterRegex = /^---\n[\s\S]*?\n---\n/;
		const match = frontmatterRegex.exec(docText);

		if (match) {
			// Place after frontmatter
			return match[0].length;
		} else {
			// No frontmatter, place at beginning
			return 0;
		}
	}
}

const taskCardNoteDecorationsSpec: PluginSpec<TaskCardNoteDecorationsPlugin> = {
	decorations: (plugin: TaskCardNoteDecorationsPlugin) => plugin.decorations,
};

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
		},
		taskCardNoteDecorationsSpec
	);
}

/**
 * Helper function to dispatch task card update effects to an editor view
 */
export function dispatchTaskCardUpdate(view: EditorView): void {
	// Validate that view is a proper EditorView with dispatch method
	if (!view || typeof view.dispatch !== "function") {
		console.warn("Invalid EditorView passed to dispatchTaskCardUpdate:", view);
		return;
	}

	try {
		view.dispatch({
			effects: [taskCardUpdateEffect.of({ forceUpdate: true })],
		});
	} catch (error) {
		console.error("Error dispatching task card update:", error);
	}
}
