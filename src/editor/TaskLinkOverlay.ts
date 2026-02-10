import { Extension, RangeSetBuilder, StateEffect } from "@codemirror/state";
import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate,
	WidgetType,
} from "@codemirror/view";
import { editorInfoField, editorLivePreviewField, EventRef, MarkdownView, parseLinktext } from "obsidian";
import TaskNotesPlugin from "../main";
import {
	EVENT_DATA_CHANGED,
	EVENT_TASK_DELETED,
	EVENT_TASK_UPDATED,
	EVENT_DATE_CHANGED,
	TaskInfo,
} from "../types";
import { TaskLinkDetectionService } from "../services/TaskLinkDetectionService";
import { TaskLinkWidget } from "./TaskLinkWidget";

// Define a state effect for task updates
const taskUpdateEffect = StateEffect.define<{ taskPath?: string }>();

// Create a ViewPlugin factory that takes the plugin as a parameter
export function createTaskLinkViewPlugin(plugin: TaskNotesPlugin) {
	// Track widget instances for updates
	const activeWidgets = new Map<string, TaskLinkWidget>();
	// Fallback cache keyed by resolvedPath only — survives position shifts and activeWidgets.clear()
	const lastKnownWidgets = new Map<string, TaskLinkWidget>();

	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			private eventListeners: EventRef[] = [];
			private view: EditorView;

			constructor(view: EditorView) {
				this.view = view;
				this.decorations = this.buildDecorations(view);
				this.setupEventListeners();
			}

			destroy() {
				// Clean up event listeners
				this.eventListeners.forEach((listener) => {
					plugin.emitter.offref(listener);
				});
				this.eventListeners = [];
			}

			setupEventListeners() {
				// Listen for data changes that might affect task link widgets
				const dataChangeListener = plugin.emitter.on(EVENT_DATA_CHANGED, () => {
					this.refreshDecorations();
				});

				const taskUpdateListener = plugin.emitter.on(EVENT_TASK_UPDATED, () => {
					this.refreshDecorations();
				});

				const taskDeleteListener = plugin.emitter.on(EVENT_TASK_DELETED, (data?: { path?: string }) => {
					if (data?.path) {
						lastKnownWidgets.delete(data.path);
					}
					this.refreshDecorations();
				});

				const dateChangeListener = plugin.emitter.on(EVENT_DATE_CHANGED, () => {
					this.refreshDecorations();
				});

				// Listen for settings changes
				const settingsChangeListener = plugin.emitter.on("settings-changed", () => {
					this.refreshDecorations();
				});

				this.eventListeners.push(
					dataChangeListener,
					taskUpdateListener,
					taskDeleteListener,
					dateChangeListener,
					settingsChangeListener
				);
			}

			refreshDecorations() {
				// Dispatch an update effect to trigger decoration rebuild
				if (this.view && typeof this.view.dispatch === "function") {
					queueMicrotask(() => {
						try {
							// Clear all widgets to force fresh recreation with updated data
							activeWidgets.clear();

							this.view.dispatch({
								effects: [taskUpdateEffect.of({ })],
							});
						} catch (error) {
							console.error("Error dispatching task link update:", error);
						}
					});
				}
			}

			update(update: ViewUpdate) {
				// Store the updated view reference
				this.view = update.view;

				// Only process if overlay is enabled in settings
				if (!plugin?.settings?.enableTaskLinkOverlay) {
					this.decorations = Decoration.none;
					return;
				}

				// Only process in Live Preview mode
				try {
					const isLivePreview = update.state.field(editorLivePreviewField);
					if (!isLivePreview) {
						this.decorations = Decoration.none;
						return;
					}
				} catch (error) {
					this.decorations = Decoration.none;
					return;
				}

				// Check for task update effects
				const hasTaskUpdateEffect = update.transactions.some((tr) =>
					tr.effects.some((effect) => effect.is(taskUpdateEffect))
				);

				// Rebuild decorations on document changes, task updates, or selection changes
				if (update.docChanged || update.selectionSet || hasTaskUpdateEffect) {
					// Clear active widgets cache on task updates to ensure fresh widgets are created
					if (hasTaskUpdateEffect) {
						// Get the specific task path that was updated
						const taskUpdateData = update.transactions
							.flatMap((tr) => tr.effects)
							.find((effect) => effect.is(taskUpdateEffect))?.value;

						if (taskUpdateData?.taskPath) {
							// Clear only widgets for the specific task that was updated
							for (const [key] of activeWidgets.entries()) {
								if (key.includes(taskUpdateData.taskPath)) {
									activeWidgets.delete(key);
								}
							}
						} else {
							// If no specific path, clear all widgets
							activeWidgets.clear();
						}
					}
					this.decorations = this.buildDecorations(update.view);
				}
			}

			buildDecorations(view: EditorView): DecorationSet {
				try {
					if (!plugin?.settings?.enableTaskLinkOverlay) {
						return Decoration.none;
					}

					// Only process in Live Preview mode
					const isLivePreview = view.state.field(editorLivePreviewField);
					if (!isLivePreview) {
						return Decoration.none;
					}

					// Get the file for this specific view
					const editorInfo = view.state.field(editorInfoField, false);
					const currentFile = editorInfo?.file?.path;

					return buildTaskLinkDecorations(view.state, plugin, activeWidgets, currentFile, lastKnownWidgets);
				} catch (error) {
					console.error("Error building task link decorations:", error);
					return Decoration.none;
				}
			}
		},
		{
			decorations: (v) => v.decorations,
		}
	);
}

export function buildTaskLinkDecorations(
	state: {
		doc: { toString(): string; length: number };
		selection?: { main: { head: number; anchor: number } };
	},
	plugin: TaskNotesPlugin,
	activeWidgets: Map<string, TaskLinkWidget>,
	currentFile?: string,
	lastKnownWidgets?: Map<string, TaskLinkWidget>
): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();

	// Validate inputs
	if (!state || !plugin || !activeWidgets) {
		return builder.finish();
	}

	const doc = state.doc;
	if (!doc) {
		return builder.finish();
	}

	// Validate plugin components
	if (!plugin.app || !plugin.app.workspace) {
		return builder.finish();
	}

	const detectionService =
		plugin.taskLinkDetectionService || new TaskLinkDetectionService(plugin);

	// Use provided currentFile, or fall back to getting active view
	if (!currentFile) {
		const activeMarkdownView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeMarkdownView) {
			return builder.finish();
		}
		currentFile = activeMarkdownView.file?.path;
	}

	if (!currentFile) {
		return builder.finish();
	}

	// Validate current file path
	if (typeof currentFile !== "string" || currentFile.length === 0) {
		return builder.finish();
	}

	try {
		// Process the entire document text for wikilinks
		const text = doc.toString();

		// Validate document text
		if (typeof text !== "string") {
			return builder.finish();
		}

		// Performance safeguard: skip processing extremely large documents
		if (text.length > 100000) {
			return builder.finish();
		}

		// Get cursor position to check if it overlaps with any wikilinks
		const cursorPos = state.selection?.main.head;

		const links = detectionService.findWikilinks(text);

		// Validate links result
		if (!Array.isArray(links)) {
			return builder.finish();
		}

		// Process each link and check if it's a valid task link
		// Note: In State Field, we need to do this synchronously, so we'll use cached results
		for (const link of links) {
			try {
				// Validate link object
				if (
					!link ||
					typeof link.match !== "string" ||
					typeof link.start !== "number" ||
					typeof link.end !== "number"
				) {
					continue;
				}

				// Validate positions
				if (
					link.start < 0 ||
					link.end <= link.start ||
					link.start >= text.length ||
					link.end > text.length
				) {
					continue;
				}

				// Check for alias exclusion
				if (plugin.settings.disableOverlayOnAlias) {
					// Skip Wikilinks with pipes [[Path|Alias]]
					if (link.type === "wikilink" && link.match.includes("|")) {
						continue;
					}
				}

				// Parse the link to get the link path (handle both wikilinks and markdown links)
				const parsed =
					link.type === "wikilink"
						? parseWikilinkSync(link.match)
						: parseMarkdownLinkSync(link.match);
				if (!parsed) continue;

				const { linkPath } = parsed;

				// Validate link path
				if (!linkPath || typeof linkPath !== "string" || linkPath.trim().length === 0) {
					continue;
				}

				// Resolve the link path
				const resolvedPath = resolveLinkPathSync(linkPath, currentFile, plugin);
				if (!resolvedPath) continue;

				// Check if we have cached task info for this file
				const taskInfo = getTaskInfoSync(resolvedPath, plugin);
				if (taskInfo) {
					// Validate task info
					if (!taskInfo.title || typeof taskInfo.title !== "string") {
						continue;
					}

					// Check if cursor is within link range - if so, skip decoration to show plain text
					// Fix: exclude position immediately after ]] to keep overlay visible for right-click context menu
					if (
						cursorPos !== undefined &&
						cursorPos >= link.start &&
						cursorPos < link.end
					) {
						continue;
					}

					// Create or reuse widget instance
					const widgetKey = `${resolvedPath}-${link.start}-${link.end}`;

					// Always create a new widget with the current task info
					const newWidget = new TaskLinkWidget(
						taskInfo,
						plugin,
						link.match,
						parsed.displayText
					);

					// Check if we need to update the cached widget
					const cachedWidget = activeWidgets.get(widgetKey);
					if (!cachedWidget || !cachedWidget.eq(newWidget)) {
						activeWidgets.set(widgetKey, newWidget);
					}

					// Store in fallback cache so transient cache misses reuse this widget
					lastKnownWidgets?.set(resolvedPath, newWidget);

					// Create a replacement decoration that replaces the wikilink with our widget
					const decoration = Decoration.replace({
						widget: activeWidgets.get(widgetKey) as WidgetType,
						inclusive: true,
					});

					builder.add(link.start, link.end, decoration);
				} else if (lastKnownWidgets?.has(resolvedPath)) {
					// Cache miss (transient invalidation) — reuse the last-known widget
					// Check if cursor is within link range
					if (
						cursorPos !== undefined &&
						cursorPos >= link.start &&
						cursorPos < link.end
					) {
						continue;
					}

					const fallbackWidget = lastKnownWidgets.get(resolvedPath)!;
					const widgetKey = `${resolvedPath}-${link.start}-${link.end}`;
					activeWidgets.set(widgetKey, fallbackWidget);

					const decoration = Decoration.replace({
						widget: fallbackWidget as WidgetType,
						inclusive: true,
					});

					builder.add(link.start, link.end, decoration);
				}
			} catch (error) {
				// If there's any error, skip this link
				continue;
			}
		}
	} catch (error) {
		console.error("Error in buildTaskLinkDecorations:", error);
	}

	return builder.finish();
}

// Synchronous helper functions for State Field context
function parseWikilinkSync(
	wikilinkText: string
): { linkPath: string; displayText?: string } | null {
	// Validate input
	if (!wikilinkText || typeof wikilinkText !== "string") {
		return null;
	}

	// Validate wikilink format
	if (wikilinkText.length < 4 || !wikilinkText.startsWith("[[") || !wikilinkText.endsWith("]]")) {
		return null;
	}

	const content = wikilinkText.slice(2, -2).trim();
	if (!content || content.length === 0) {
		return null;
	}

	// Prevent processing of extremely long links
	if (content.length > 500) {
		return null;
	}

	// First check for alias syntax: [[path|alias]]
	const pipeIndex = content.indexOf("|");
	if (pipeIndex !== -1) {
		const pathPart = content.slice(0, pipeIndex).trim();
		const aliasPart = content.slice(pipeIndex + 1).trim();

		if (!pathPart || !aliasPart) {
			return null;
		}

		// Parse the path part for subpaths/headings
		const parsed = parseLinktext(pathPart);

		// Validate the path
		if (!parsed.path) {
			return null;
		}

		return {
			linkPath: parsed.path,
			displayText: aliasPart,
		};
	}

	// No alias, use parseLinktext for path and subpath
	const parsed = parseLinktext(content);

	// Validate the path
	if (!parsed.path) {
		return null;
	}

	return {
		linkPath: parsed.path,
		displayText: parsed.subpath || undefined,
	};
}

function parseMarkdownLinkSync(
	markdownLinkText: string
): { linkPath: string; displayText?: string } | null {
	// Validate input
	if (!markdownLinkText || typeof markdownLinkText !== "string") {
		return null;
	}

	// Parse markdown link: [text](path)
	const match = markdownLinkText.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
	if (!match) return null;

	const displayText = match[1].trim();
	let linkPath = match[2].trim();

	// Strip angle brackets used to escape special characters or spaces
	if (linkPath.startsWith("<") && linkPath.endsWith(">")) {
		linkPath = linkPath.slice(1, -1).trim();
	}

	if (!linkPath || linkPath.length === 0) {
		return null;
	}

	// Prevent processing of extremely long links
	if (linkPath.length > 500) {
		return null;
	}

	// URL decode the link path - this is crucial for markdown links
	try {
		linkPath = decodeURIComponent(linkPath);
	} catch (error) {
		// If decoding fails, use the original path
	}

	// Use Obsidian's parseLinktext to handle any subpaths/headings
	const parsed = parseLinktext(linkPath);

	// Validate the path
	if (!parsed.path) {
		return null;
	}

	return {
		linkPath: parsed.path,
		displayText: displayText || parsed.subpath || undefined,
	};
}

function resolveLinkPathSync(
	linkPath: string,
	sourcePath: string,
	plugin: TaskNotesPlugin
): string | null {
	// Validate inputs
	if (!linkPath || typeof linkPath !== "string" || linkPath.trim().length === 0) {
		return null;
	}

	if (!sourcePath || typeof sourcePath !== "string") {
		return null;
	}

	if (!plugin || !plugin.app || !plugin.app.metadataCache) {
		return null;
	}

	try {
		// Use Obsidian's API to resolve the link path - it handles relative paths safely
		const file = plugin.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);

		// Validate result
		if (!file || !file.path || typeof file.path !== "string") {
			return null;
		}

		return file.path;
	} catch (error) {
		return null;
	}
}

function getTaskInfoSync(filePath: string, plugin: TaskNotesPlugin): TaskInfo | null {
	// Validate inputs
	if (!filePath || typeof filePath !== "string" || filePath.trim().length === 0) {
		return null;
	}

	if (!plugin) {
		return null;
	}

	try {
		// Check for invalid characters
		const basicInvalidChars = /[<>:"|?*]/;
		const hasControlChars = filePath.split("").some((char) => {
			const code = char.charCodeAt(0);
			return code <= 31 || code === 127;
		});

		if (basicInvalidChars.test(filePath) || hasControlChars) {
			return null;
		}

		// Use the same cached data access pattern as the views
		// This gets the most up-to-date cached task info (updated immediately after any changes)
		const cacheManager = plugin.cacheManager;
		if (!cacheManager || !cacheManager.getCachedTaskInfoSync) {
			return null;
		}

		const taskInfo = cacheManager.getCachedTaskInfoSync(filePath);

		// Basic validation of task info structure
		if (taskInfo && typeof taskInfo === "object" && taskInfo.title) {
			return taskInfo;
		}

		return null;
	} catch (error) {
		return null;
	}
}

export function createTaskLinkOverlay(plugin: TaskNotesPlugin): Extension {
	const viewPlugin = createTaskLinkViewPlugin(plugin);

	return viewPlugin;
}

/**
 * Stub function for clearing cursor hide state.
 * In the simplified implementation, there's no state to clear since we use immediate cursor detection.
 * This function exists for backward compatibility with tests.
 */
export function clearCursorHideState(): void {
	// No-op: simplified implementation doesn't maintain cursor hide state
}

// Export the effect and utility function for triggering updates
export { taskUpdateEffect };

// Helper function to dispatch task update effects to an editor view
export function dispatchTaskUpdate(view: EditorView, taskPath?: string): void {
	// Validate that view is a proper EditorView with dispatch method
	if (!view || typeof view.dispatch !== "function") {
		console.warn("Invalid EditorView passed to dispatchTaskUpdate:", view);
		return;
	}

	try {
		view.dispatch({
			effects: [taskUpdateEffect.of({ taskPath })],
		});
	} catch (error) {
		console.error("Error dispatching task update:", error);
	}
}

// Export the service for use elsewhere
export { TaskLinkDetectionService };
