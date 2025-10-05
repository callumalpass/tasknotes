/**
 * Bases View Factory for TaskNotes Integration
 *
 * This module provides a factory function that creates TaskNotes views within the Bases plugin.
 * It handles formula computation, data transformation, and rendering of TaskNotes items in Bases views.
 *
 * Key features:
 * - Formula computation with access to TaskNote properties
 * - Proper handling of missing/empty formula values
 * - Integration with Bases' view lifecycle management
 */
import TaskNotesPlugin from "../main";
import {
	BasesDataItem,
	identifyTaskNotesFromBasesData,
	renderTaskNotesInBasesView,
} from "./helpers";
import { EVENT_TASK_UPDATED } from "../types";

export interface BasesContainerLike {
	results?: Map<any, any>;
	query?: {
		on?: (event: string, cb: () => void) => void;
		off?: (event: string, cb: () => void) => void;
	};
	viewContainerEl?: HTMLElement;
	controller?: { results?: Map<any, any>; runQuery?: () => Promise<any>; [key: string]: any };
}

export interface ViewConfig {
	errorPrefix: string;
}

export function buildTasknotesBaseViewFactory(plugin: TaskNotesPlugin, config: ViewConfig) {
	return function tasknotesBaseViewFactory(basesContainer: BasesContainerLike) {
		let currentRoot: HTMLElement | null = null;
		let eventListener: any = null;
		let updateDebounceTimer: number | null = null;
		let currentTaskElements = new Map<string, HTMLElement>();

		const viewContainerEl = (basesContainer as any)?.viewContainerEl as HTMLElement | undefined;
		if (!viewContainerEl) {
			console.error("[TaskNotes][BasesPOC] No viewContainerEl found");
			return { destroy: () => {} } as any;
		}

		viewContainerEl.innerHTML = "";

		// Root container for TaskNotes view
		const root = document.createElement("div");
		root.className = "tn-bases-integration tasknotes-plugin tasknotes-container";
		root.tabIndex = -1; // Make focusable without adding to tab order
		viewContainerEl.appendChild(root);
		currentRoot = root;

		const itemsContainer = document.createElement("div");
		itemsContainer.className = "tn-bases-items-container";
		itemsContainer.style.cssText = "margin-top: 12px;";
		root.appendChild(itemsContainer);

		// Helper to extract items from Bases results
		// Uses public API (1.10.0+) when available, falls back to internal API
		const extractDataItems = (): BasesDataItem[] => {
			const dataItems: BasesDataItem[] = [];

			// Try public API first (1.10.0+) - data is already filtered and sorted
			const viewObject = (basesContainer as any);
			if (viewObject.data?.data && Array.isArray(viewObject.data.data)) {
				// Use BasesEntry objects from public API
				for (const entry of viewObject.data.data) {
					const item = {
						key: entry.file?.path || "",
						data: entry,
						file: entry.file,
						path: entry.file?.path,
						properties: (entry as any).frontmatter || (entry as any).properties,
						basesData: entry,
					};
					dataItems.push(item);
				}
				return dataItems;
			}

			// Fallback to internal API for older versions
			const results = (basesContainer as any)?.results as Map<any, any> | undefined;

			if (results && results instanceof Map) {
				for (const [key, value] of results.entries()) {
					const item = {
						key,
						data: value,
						file: (value as any)?.file,
						path: (value as any)?.file?.path || (value as any)?.path,
						properties: (value as any)?.properties || (value as any)?.frontmatter,
						basesData: value,
					};

					dataItems.push(item);
				}
			}

			return dataItems;
		};

		const render = async () => {
			if (!currentRoot) return;
			try {
				const dataItems = extractDataItems();

				// Compute Bases formulas for TaskNotes items
				// This ensures formulas have access to TaskNote-specific properties
				const ctxFormulas = (basesContainer as any)?.ctx?.formulas;
				if (ctxFormulas && dataItems.length > 0) {
					for (let i = 0; i < dataItems.length; i++) {
						const item = dataItems[i];
						const itemFormulaResults = item.basesData?.formulaResults;
						if (!itemFormulaResults?.cachedFormulaOutputs) continue;

						for (const formulaName of Object.keys(ctxFormulas)) {
							const formula = ctxFormulas[formulaName];
							if (formula && typeof formula.getValue === "function") {
								try {
									const baseData = item.basesData;
									const taskProperties = item.properties || {};

									let result;

									// Temporarily merge TaskNote properties into frontmatter for formula access
									// This preserves Bases' internal object structure while providing item-specific data
									if (
										baseData.frontmatter &&
										Object.keys(taskProperties).length > 0
									) {
										const originalFrontmatter = baseData.frontmatter;
										baseData.frontmatter = {
											...originalFrontmatter,
											...taskProperties,
										};
										result = formula.getValue(baseData);
										baseData.frontmatter = originalFrontmatter; // Restore original state
									} else {
										result = formula.getValue(baseData);
									}

									// Store computed result for TaskCard rendering
									if (result !== undefined) {
										itemFormulaResults.cachedFormulaOutputs[formulaName] =
											result;
									}
								} catch (e) {
									// Formulas may fail for various reasons (missing data, syntax errors, etc.)
									// This is expected behavior and doesn't require action
								}
							}
						}
					}
				}

				const taskNotes = await identifyTaskNotesFromBasesData(dataItems, plugin);

				// Render body
				itemsContainer.innerHTML = "";
				if (taskNotes.length === 0) {
					const emptyEl = document.createElement("div");
					emptyEl.className = "tn-bases-empty";
					emptyEl.style.cssText = "padding: 20px; text-align: center; color: #666;";
					emptyEl.textContent = "No TaskNotes tasks found for this Base.";
					itemsContainer.appendChild(emptyEl);
				} else {
					// Build a map from task path to its properties/frontmatter
					const pathToProps = new Map<string, Record<string, any>>(
						dataItems
							.filter((i) => !!i.path)
							.map((i) => [
								i.path || "",
								(i as any).properties || (i as any).frontmatter || {},
							])
					);

					// Apply Bases sorting if configured (only needed for internal API)
					// Public API (1.10.0+) already provides sorted data via this.data.data
					const viewObject = (basesContainer as any);
					const usingPublicAPI = viewObject.data?.data && Array.isArray(viewObject.data.data);

					if (!usingPublicAPI) {
						const { getBasesSortComparator } = await import("./sorting");
						const sortComparator = getBasesSortComparator(basesContainer, pathToProps);
						if (sortComparator) {
							taskNotes.sort(sortComparator);
						}
					}

					// Render tasks using existing helper
					// Clear existing task elements tracking before re-render
					currentTaskElements.clear();
					await renderTaskNotesInBasesView(
						itemsContainer,
						taskNotes,
						plugin,
						basesContainer,
						currentTaskElements
					);
				}
			} catch (error: any) {
				console.error(
					`[TaskNotes][BasesPOC] Error rendering Bases ${config.errorPrefix}:`,
					error
				);
				const errorEl = document.createElement("div");
				errorEl.className = "tn-bases-error";
				errorEl.style.cssText =
					"padding: 20px; color: #d73a49; background: #ffeaea; border-radius: 4px; margin: 10px 0;";
				errorEl.textContent = `Error loading ${config.errorPrefix} tasks: ${error.message || "Unknown error"}`;
				itemsContainer.appendChild(errorEl);
			}
		};

		// Setup selective update handling for real-time task changes
		const setupTaskUpdateListener = () => {
			if (!eventListener) {
				eventListener = plugin.emitter.on(EVENT_TASK_UPDATED, async (eventData: any) => {
					try {
						const updatedTask = eventData?.task || eventData?.taskInfo;
						if (!updatedTask || !updatedTask.path) return;

						// Check if this task affects our current Bases view
						const currentTasks = extractDataItems();
						const relevantTask = currentTasks.find(
							(item) => item.path === updatedTask.path
						);

						if (relevantTask) {
							// Task is visible in this Bases view - perform selective update
							await selectiveUpdateTaskInBasesView(updatedTask);
						}
					} catch (error) {
						console.error("[TaskNotes][Bases] Error in selective task update:", error);
						// Fallback to full refresh
						debouncedFullRefresh();
					}
				});
			}
		};

		// Selective update for a single task within Bases view
		const selectiveUpdateTaskInBasesView = async (updatedTask: any) => {
			if (!currentRoot) return;

			try {
				const taskElement = currentTaskElements.get(updatedTask.path);
				if (taskElement) {
					// Update existing task element
					const { updateTaskCard } = await import("../ui/TaskCard");
					const basesProperties = (basesContainer as any)?.ctx?.formulas
						? Object.keys((basesContainer as any).ctx.formulas)
						: [];

					updateTaskCard(taskElement, updatedTask, plugin, basesProperties, {
						showDueDate: true,
						showCheckbox: false,
						showArchiveButton: false,
						showTimeTracking: false,
						showRecurringControls: true,
						targetDate: new Date(),
					});

					// Add update animation
					taskElement.classList.add("task-card--updated");
					window.setTimeout(() => {
						taskElement.classList.remove("task-card--updated");
					}, 1000);

					// eslint-disable-next-line no-console
			console.log(`[TaskNotes][Bases] Selectively updated task: ${updatedTask.path}`);
				} else {
					// Task not currently visible, might need to be added - refresh to be safe
					debouncedFullRefresh();
				}
			} catch (error) {
				console.error("[TaskNotes][Bases] Error in selective task update:", error);
				debouncedFullRefresh();
			}
		};

		// Debounced refresh to prevent multiple rapid refreshes
		const debouncedFullRefresh = () => {
			if (updateDebounceTimer) {
				clearTimeout(updateDebounceTimer);
			}

			updateDebounceTimer = window.setTimeout(async () => {
				// eslint-disable-next-line no-console
			console.log("[TaskNotes][Bases] Performing debounced full refresh");
				await render();
				updateDebounceTimer = null;
			}, 150);
		};

		// Kick off initial async render
		void render();

		// Setup real-time updates
		setupTaskUpdateListener();

		// Create view object with proper listener management
		let queryListener: (() => void) | null = null;

		const viewObject = {
			refresh: render,
			onResize: () => {
				// Handle resize - no-op for now
			},
			onDataUpdated: () => {
				void render();
			},
			getEphemeralState: () => {
				return { scrollTop: currentRoot?.scrollTop || 0 };
			},
			setEphemeralState: (state: any) => {
				if (!state) return;

				try {
					// Only set scroll if element exists and is connected to DOM
					if (currentRoot && currentRoot.isConnected && state.scrollTop !== undefined) {
						currentRoot.scrollTop = state.scrollTop;
					}
				} catch (e) {
					// Silently fail - ephemeral state restoration is non-critical
					console.debug("[TaskNotes][Bases] Failed to restore ephemeral state:", e);
				}
			},
			focus: () => {
				// Focus the root element if it exists and is connected
				try {
					if (currentRoot && currentRoot.isConnected && typeof currentRoot.focus === "function") {
						currentRoot.focus();
					}
				} catch (e) {
					// Silently fail - focus is non-critical
					console.debug("[TaskNotes][Bases] Failed to focus view:", e);
				}
			},
			destroy: () => {
				// Clean up task update listener
				if (eventListener) {
					plugin.emitter.offref(eventListener);
					eventListener = null;
				}

				// Clean up debounce timer
				if (updateDebounceTimer) {
					clearTimeout(updateDebounceTimer);
					updateDebounceTimer = null;
				}

				// Clean up query listener
				if (queryListener && (basesContainer as any)?.query?.off) {
					try {
						(basesContainer as any).query.off("change", queryListener);
					} catch (e) {
						// Query listener removal may fail if already disposed
					}
				}

				// Clean up DOM and state
				if (currentRoot) {
					currentRoot.remove();
					currentRoot = null;
				}
				currentTaskElements.clear();
				queryListener = null;

				// eslint-disable-next-line no-console
			console.log("[TaskNotes][Bases] Cleaned up view with real-time updates");
			},
			load: () => {
				if ((basesContainer as any)?.query?.on && !queryListener) {
					queryListener = () => void render();
					try {
						(basesContainer as any).query.on("change", queryListener);
					} catch (e) {
						// Query listener registration may fail for various reasons
					}
				}

				// Trigger initial formula computation on load
				const controller = (basesContainer as any)?.controller;
				if (controller?.runQuery) {
					controller
						.runQuery()
						.then(() => {
							void render(); // Re-render with computed formulas
						})
						.catch((e: any) => {
							console.warn(
								"[TaskNotes][Bases] Initial formula computation failed:",
								e
							);
						});
				}
			},
			unload: () => {
				if (queryListener && (basesContainer as any)?.query?.off) {
					try {
						(basesContainer as any).query.off("change", queryListener);
					} catch (e) {
						// Query listener removal may fail if already disposed
					}
				}
				if (currentRoot) {
					currentRoot.remove();
					currentRoot = null;
				}
				queryListener = null;
			},
		};

		return viewObject;
	};
}
