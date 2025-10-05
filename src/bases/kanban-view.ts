import TaskNotesPlugin from "../main";
import { BasesDataItem, identifyTaskNotesFromBasesData, getBasesVisibleProperties } from "./helpers";
import { TaskInfo } from "../types";
import { getBasesGroupByConfig, BasesGroupByConfig } from "./group-by";
import { getGroupNameComparator } from "./group-ordering";
import { getBasesSortComparator } from "./sorting";
import { createTaskCard } from "../ui/TaskCard";
// Removed unused imports - using local BasesContainerLike interface for compatibility

// Use the same interface as base-view-factory for compatibility
interface BasesContainerLike {
	results?: Map<any, any>;
	query?: {
		on?: (event: string, cb: () => void) => void;
		off?: (event: string, cb: () => void) => void;
		getViewConfig?: (key: string) => any;
	};
	viewContainerEl?: HTMLElement;
	controller?: {
		runQuery?: () => Promise<void>;
		getViewConfig?: () => any;
	};
}

export function buildTasknotesKanbanViewFactory(plugin: TaskNotesPlugin) {
	return function tasknotesKanbanViewFactory(basesContainer: BasesContainerLike, containerEl?: HTMLElement) {
		let currentRoot: HTMLElement | null = null;

		// Detect which API is being used
		// Public API (1.10.0+): (controller, containerEl)
		// Legacy API: (container) where container.viewContainerEl exists
		const viewContainerEl = containerEl || basesContainer.viewContainerEl;

		// For public API, basesContainer is actually the QueryController/BasesView instance
		// For legacy API, basesContainer is the BasesContainer
		const controller = basesContainer as any;

		if (!viewContainerEl) {
			console.error("[TaskNotes][Bases] No viewContainerEl found");
			return {
				destroy: () => {},
				load: () => {},
				unload: () => {},
				refresh: () => {},
				onDataUpdated: () => {},
				onResize: () => {},
				getEphemeralState: () => ({ scrollTop: 0 }),
				setEphemeralState: () => {},
			};
		}

		// Clear container
		viewContainerEl.innerHTML = "";

		// Root container
		const root = document.createElement("div");
		root.className = "tn-bases-integration tasknotes-plugin kanban-view";
		root.tabIndex = -1; // Make focusable without adding to tab order
		viewContainerEl.appendChild(root);
		currentRoot = root;

		// Board container
		const board = document.createElement("div");
		board.className = "kanban-view__board";
		root.appendChild(board);

		// Uses public API (1.10.0+) when available, falls back to internal API
		const extractDataItems = (viewContext?: any): BasesDataItem[] => {
			const dataItems: BasesDataItem[] = [];
			const ctx = viewContext || controller;

			// Try public API first (1.10.0+) - viewContext.data.data contains BasesEntry[]
			if (ctx.data?.data && Array.isArray(ctx.data.data)) {
				// Use BasesEntry objects from public API
				for (const entry of ctx.data.data) {
					dataItems.push({
						key: entry.file?.path || "",
						data: entry,
						file: entry.file,
						path: entry.file?.path,
						properties: (entry as any).frontmatter || (entry as any).properties,
					});
				}
				return dataItems;
			}

			// Fallback to internal API for older versions
			const results = ctx.results || basesContainer.results;
			if (results && results instanceof Map) {
				for (const [, value] of results.entries()) {
					dataItems.push({
						key: value?.file?.path || value?.path,
						data: value,
						file: value?.file,
						path: value?.file?.path || value?.path,
						properties: value?.properties || value?.frontmatter,
					});
				}
			}
			return dataItems;
		};

		const render = async function(this: any) {
			if (!currentRoot) return;

			try {
				// For public API (1.10.0+), 'this' is the BasesView with data/config
				// For legacy API, use controller/basesContainer
				const viewContext = this?.data ? this : controller;

				console.log("[TaskNotes][Bases] Kanban render context:", {
					hasThisData: !!this?.data,
					hasThisConfig: !!this?.config,
					hasControllerData: !!controller?.data,
					usingContext: viewContext === this ? 'this' : 'controller',
					groupedDataLength: viewContext?.data?.groupedData?.length
				});

				// Skip rendering if we have no data yet (prevents flickering during data updates)
				if (!viewContext.data?.data && !viewContext.data?.groupedData && !viewContext.results) {
					console.log("[TaskNotes][Bases] Skipping render - no data available");
					return;
				}

				const dataItems = extractDataItems(viewContext);
				const taskNotes = await identifyTaskNotesFromBasesData(dataItems, plugin);

				// Clear board
				board.innerHTML = "";

				if (taskNotes.length === 0) {
					const empty = document.createElement("div");
					empty.className = "tn-bases-empty";
					empty.style.cssText =
						"padding: 20px; text-align: center; color: var(--text-muted);";
					empty.textContent = "No TaskNotes tasks found for this Base.";
					board.appendChild(empty);
					return;
				}

				// Build path -> props map for dynamic property access
				const pathToProps = new Map<string, Record<string, any>>(
					dataItems.filter((i) => !!i.path).map((i) => [i.path || "", i.properties || {}])
				);

				// Group tasks
				const groups = new Map<string, TaskInfo[]>();
				let groupByPropertyId: string | null = null;

				// Try to use public API (1.10.0+) data.groupedData
				if (viewContext.data?.groupedData && Array.isArray(viewContext.data.groupedData)) {
					console.log("[TaskNotes][Bases] Using public API groupedData", {
						groupCount: viewContext.data.groupedData.length,
						hasConfig: !!viewContext.config
					});

					// Try different ways to get groupBy from config
					let groupByAttempts: any = {};
					try {
						groupByAttempts.get = viewContext.config?.get?.("groupBy");
					} catch (e) { }
					try {
						groupByAttempts.getAsPropertyId = viewContext.config?.getAsPropertyId?.("groupBy");
					} catch (e) { }

					console.log("[TaskNotes][Bases] GroupBy attempts:", groupByAttempts);

					// Get the groupBy property from config using public API
					if (viewContext.config && typeof viewContext.config.getAsPropertyId === "function") {
						try {
							groupByPropertyId = viewContext.config.getAsPropertyId("groupBy");
							console.log("[TaskNotes][Bases] GroupBy property from getAsPropertyId:", groupByPropertyId);
						} catch (e) {
							console.warn("[TaskNotes][Bases] Error getting groupBy via getAsPropertyId:", e);
							// Fallback to get() method
							if (typeof viewContext.config.get === "function") {
								groupByPropertyId = viewContext.config.get("groupBy");
								console.log("[TaskNotes][Bases] GroupBy property from get():", groupByPropertyId);
							}
						}
					}

					// If still null, infer from the grouped data
					if (!groupByPropertyId && viewContext.data.groupedData.length > 0) {
						// Check the group values to infer the property type
						const firstGroup = viewContext.data.groupedData[0];
						const keyData = firstGroup.key?.data;

						console.log("[TaskNotes][Bases] Inferring groupBy from data:", {
							hasKey: !!firstGroup.key,
							keyData,
							keyType: typeof keyData
						});

						// Try to infer property type from the values
						const allKeys = viewContext.data.groupedData
							.map((g: any) => String(g.key?.data || '').toLowerCase())
							.filter((k: string) => k && k !== 'none');

						// Check if values match known status values
						const statusValues = new Set(['done', 'open', 'in-progress', 'waiting', 'todo', 'complete']);
						const isProbablyStatus = allKeys.some((k: string) => statusValues.has(k));

						// Check if values match known priority values
						const priorityValues = new Set(['high', 'medium', 'low', 'urgent', 'normal']);
						const isProbablyPriority = allKeys.some((k: string) => priorityValues.has(k));

						if (isProbablyStatus) {
							groupByPropertyId = "note.status";
							console.log("[TaskNotes][Bases] Inferred groupBy: note.status");
						} else if (isProbablyPriority) {
							groupByPropertyId = "note.priority";
							console.log("[TaskNotes][Bases] Inferred groupBy: note.priority");
						} else {
							// Default to status for kanban views
							groupByPropertyId = "note.status";
							console.log("[TaskNotes][Bases] Using default groupBy: note.status");
						}
					}

					// Use pre-grouped data from Bases
					for (const group of viewContext.data.groupedData) {
						// Get the key value (it's a Value object with .data property)
						const keyValue = group.key?.data ?? "none";
						const keyString = String(keyValue);

						console.log("[TaskNotes][Bases] Processing group:", {
							keyString,
							entryCount: group.entries?.length
						});

						// Convert BasesEntry objects to TaskInfo
						const groupTasks: TaskInfo[] = [];
						for (const entry of group.entries) {
							const task = taskNotes.find((t) => t.path === entry.file?.path);
							if (task) groupTasks.push(task);
						}

						if (groupTasks.length > 0) {
							groups.set(keyString, groupTasks);
						}
					}
					console.log("[TaskNotes][Bases] Final groups:", Array.from(groups.keys()));
				} else {
					console.log("[TaskNotes][Bases] No groupedData available, using fallback grouping", {
						hasData: !!viewContext.data,
						hasGroupedData: !!viewContext.data?.groupedData,
						isArray: Array.isArray(viewContext.data?.groupedData)
					});
					// Fallback to manual grouping for older versions
					const groupByConfig = getBasesGroupByConfig(basesContainer, pathToProps);

					if (groupByConfig) {
						groupByPropertyId = groupByConfig.normalizedId;
						// Use dynamic groupBy from Bases configuration
						for (const task of taskNotes) {
							const groupValues = groupByConfig.getGroupValues(task.path);

							// Tasks can belong to multiple groups (e.g., multiple tags)
							for (const groupValue of groupValues) {
								if (!groups.has(groupValue)) {
									groups.set(groupValue, []);
								}
								groups.get(groupValue)?.push(task);
							}
						}
					} else {
						// Fallback to status grouping when no groupBy is configured
						groupByPropertyId = "status";
						for (const task of taskNotes) {
							const groupValue = task.status || "open";
							if (!groups.has(groupValue)) {
								groups.set(groupValue, []);
							}
							groups.get(groupValue)?.push(task);
						}

						// Add empty status columns
						plugin.statusManager.getAllStatuses().forEach((status) => {
							if (!groups.has(status.value)) {
								groups.set(status.value, []);
							}
						});
					}
				}

				// Get visible properties from Bases
				const basesVisibleProps = getBasesVisibleProperties(basesContainer);
				const visiblePropsIds = basesVisibleProps.length > 0
					? basesVisibleProps.map((p) => {
							// Map Bases property IDs to TaskNotes internal names
							let mapped = p.id;
							if (mapped.startsWith("note.")) {
								mapped = mapped.substring(5);
							} else if (mapped.startsWith("task.")) {
								mapped = mapped.substring(5);
							}
							return mapped;
						})
					: (plugin.settings.defaultVisibleProperties || []);

				// Get sorting configuration
				const sortComparator = getBasesSortComparator(viewContext, pathToProps);

				// Sort tasks within each group if sorting is configured
				if (sortComparator) {
					for (const [groupId, tasks] of groups.entries()) {
						tasks.sort(sortComparator);
					}
				}

				// Get group name ordering
				const firstSortEntry = sortComparator
					? { id: groupByPropertyId || "status", direction: "ASC" as const }
					: null;
				const groupNameComparator = getGroupNameComparator(firstSortEntry);

				// Create columns with proper ordering
				const columnIds = Array.from(groups.keys()).sort(groupNameComparator);

				for (const columnId of columnIds) {
					const tasks = groups.get(columnId) || [];
					const columnEl = createColumnElement(columnId, tasks, groupByPropertyId, visiblePropsIds);
					board.appendChild(columnEl);
				}
			} catch (error) {
				console.error("[TaskNotes][Bases] Error rendering Kanban:", error);
			}
		};

		// Reuse existing kanban column creation logic
		const createColumnElement = (
			columnId: string,
			tasks: TaskInfo[],
			groupByPropertyId: string | null,
			visibleProperties: string[]
		): HTMLElement => {
			const columnEl = document.createElement("div");
			columnEl.className = "kanban-view__column";
			columnEl.dataset.columnId = columnId;

			// Column header
			const headerEl = columnEl.createDiv({ cls: "kanban-view__column-header" });

			// Title - format based on property type and use TaskNotes display values
			let title: string;

			if (groupByPropertyId) {
				const propertyId = groupByPropertyId.toLowerCase();

				// Map Bases property IDs to TaskNotes native properties and use display values
				if (propertyId === "status" || propertyId === "note.status") {
					const statusConfig = plugin.statusManager.getStatusConfig(columnId);
					title = statusConfig?.label || columnId;
				} else if (propertyId === "priority" || propertyId === "note.priority") {
					const priorityConfig = plugin.priorityManager.getPriorityConfig(columnId);
					title = priorityConfig?.label || columnId;
				} else if (
					propertyId === "projects" ||
					propertyId === "project" ||
					propertyId === "note.projects" ||
					propertyId === "note.project"
				) {
					title = columnId === "none" ? "No Project" : columnId;
				} else if (
					propertyId === "contexts" ||
					propertyId === "context" ||
					propertyId === "note.contexts" ||
					propertyId === "note.context"
				) {
					title = columnId === "none" ? "Uncategorized" : `@${columnId}`;
				} else if (propertyId.includes("tag")) {
					// Handle tags properties
					title = columnId === "none" ? "Untagged" : `#${columnId}`;
				} else {
					// For custom properties, show the value directly (not prefixed)
					title = columnId === "none" ? "None" : columnId;
				}
			} else {
				// Fallback for status grouping
				const statusConfig = plugin.statusManager.getStatusConfig(columnId);
				title = statusConfig?.label || columnId;
			}
			headerEl.createEl("div", { cls: "kanban-view__column-title", text: title });

			// Count
			headerEl.createEl("div", {
				text: `${tasks.length} tasks`,
				cls: "kanban-view__column-count",
			});

			// Column body
			const bodyEl = columnEl.createDiv({ cls: "kanban-view__column-body" });
			const tasksContainer = bodyEl.createDiv({ cls: "kanban-view__tasks-container" });

			// Render tasks using existing TaskCard system
			tasks.forEach((task) => {
				const taskCard = createTaskCard(task, plugin, visibleProperties, {
					showDueDate: true,
					showCheckbox: false,
					showTimeTracking: true,
				});

				// Make draggable
				taskCard.draggable = true;
				taskCard.addEventListener("dragstart", (e: DragEvent) => {
					if (e.dataTransfer) {
						e.dataTransfer.setData("text/plain", task.path);
						e.dataTransfer.effectAllowed = "move";
					}
				});

				tasksContainer.appendChild(taskCard);
			});

			// Add drop handlers - enhanced for dynamic groupBy
			addColumnDropHandlers(columnEl, async (taskPath: string, targetColumnId: string) => {
				try {
					const task = await plugin.cacheManager.getCachedTaskInfo(taskPath);
					if (task && groupByPropertyId) {
						// Map Bases property IDs to TaskNotes native properties for updates
						const originalPropertyId = groupByPropertyId;
						const propertyId = originalPropertyId.toLowerCase();

						// Handle different property types
						let valueToSet: any;
						if (targetColumnId === "none" || targetColumnId === "uncategorized") {
							valueToSet = null; // Clear the property
						} else {
							// For most properties, set the single value
							// For array properties, determine if we should use array or single value
							valueToSet = targetColumnId;
						}

						// For native TaskNotes properties, use TaskNotes update methods directly
						if (propertyId === "status" || propertyId === "note.status") {
							await plugin.updateTaskProperty(task, "status", valueToSet, {
								silent: true,
							});
						} else if (propertyId === "priority" || propertyId === "note.priority") {
							await plugin.updateTaskProperty(task, "priority", valueToSet, {
								silent: true,
							});
						} else if (
							propertyId === "projects" ||
							propertyId === "project" ||
							propertyId === "note.projects" ||
							propertyId === "note.project"
						) {
							const projectValue = valueToSet
								? Array.isArray(valueToSet)
									? valueToSet
									: [valueToSet]
								: [];
							await plugin.updateTaskProperty(task, "projects", projectValue, {
								silent: true,
							});
						} else if (
							propertyId === "contexts" ||
							propertyId === "context" ||
							propertyId === "note.contexts" ||
							propertyId === "note.context"
						) {
							const contextValue = valueToSet
								? Array.isArray(valueToSet)
									? valueToSet
									: [valueToSet]
								: [];
							await plugin.updateTaskProperty(task, "contexts", contextValue, {
								silent: true,
							});
						} else {
							// For custom properties, update frontmatter directly
							try {
								const file = plugin.app.vault.getAbstractFileByPath(task.path);
								if (file && "stat" in file) {
									// Check if it's a TFile
									await plugin.app.fileManager.processFrontMatter(
										file as any,
										(frontmatter: any) => {
											// Extract the actual property name from Bases property ID
											// e.g., "note.note.projects" -> "projects"
											const propertyName = originalPropertyId.includes(".")
												? originalPropertyId.split(".").pop() || originalPropertyId
												: originalPropertyId;
											frontmatter[propertyName] = valueToSet;
										}
									);
								}
							} catch (frontmatterError) {
								console.warn(
									"[TaskNotes][Bases] Frontmatter update failed for custom property:",
									frontmatterError
								);
							}
						}

						// Refresh the view
						await render();
					} else if (task && !groupByPropertyId) {
						// Fallback to status update when no groupBy config
						await plugin.updateTaskProperty(task, "status", targetColumnId, {
							silent: true,
						});
						await render();
					}
				} catch (e) {
					console.error("[TaskNotes][Bases] Move failed:", e);
				}
			});

			return columnEl;
		};

		// Column title formatting now handled in createColumnElement with groupBy config

		// Reuse existing drop handler logic
		const addColumnDropHandlers = (
			columnEl: HTMLElement,
			onDropTask: (taskPath: string, targetColumnId: string) => void | Promise<void>
		) => {
			columnEl.addEventListener("dragover", (e) => {
				e.preventDefault();
				if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
				columnEl.classList.add("kanban-view__column--dragover");
			});

			columnEl.addEventListener("dragleave", (e) => {
				if (!columnEl.contains(e.relatedTarget as Node)) {
					columnEl.classList.remove("kanban-view__column--dragover");
				}
			});

			columnEl.addEventListener("drop", async (e) => {
				e.preventDefault();
				e.stopPropagation();
				columnEl.classList.remove("kanban-view__column--dragover");
				const data = e.dataTransfer?.getData("text/plain");
				const taskPath = data;
				const targetColumnId = columnEl.getAttribute("data-column-id") || "";
				if (taskPath && targetColumnId) {
					await onDropTask(taskPath, targetColumnId);
				}
			});
		};

		// Kick off initial async render
		void render();

		// Set up lifecycle following the working pattern from base-view-factory
		let queryListener: (() => void) | null = null;

		const component = {
			focus() {
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
			load() {
				// Set up query listener
				const query = controller.query || basesContainer.query;
				if (query?.on && !queryListener) {
					queryListener = () => void render.call(this);
					try {
						query.on("change", queryListener);
					} catch (e) {
						// Query listener registration may fail for various reasons
						console.debug("[TaskNotes][Bases] Query listener registration failed:", e);
					}
				}

				// Initial render - data will be available via this.data (public API) or controller (legacy)
				// onDataUpdated() will be called by the framework when data changes
				void render.call(this);
			},
			unload() {
				// Cleanup query listener
				const query = controller.query || basesContainer.query;
				if (queryListener && query?.off) {
					try {
						query.off("change", queryListener);
					} catch (e) {
						// Query listener removal may fail if already disposed
						console.debug("[TaskNotes][Bases] Query listener cleanup failed:", e);
					}
				}
				queryListener = null;
			},
			refresh() {
				void render.call(this);
			},
			onDataUpdated() {
				void render.call(this);
			},
			onResize() {
				// Handle resize - no-op for now
			},
			getEphemeralState() {
				return { scrollTop: currentRoot?.scrollTop || 0 };
			},
			setEphemeralState(state: any) {
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
			destroy() {
				const query = controller.query || basesContainer.query;
				if (queryListener && query?.off) {
					try {
						query.off("change", queryListener);
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

		return component;
	};
}
