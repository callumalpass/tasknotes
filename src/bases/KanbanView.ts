/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Notice, TFile } from "obsidian";
import TaskNotesPlugin from "../main";
import { BasesViewBase } from "./BasesViewBase";
import { TaskInfo } from "../types";
import { identifyTaskNotesFromBasesData } from "./helpers";
import { createTaskCard } from "../ui/TaskCard";
import { renderGroupTitle } from "./groupTitleRenderer";
import { type LinkServices } from "../ui/renderers/linkRenderer";
import { VirtualScroller } from "../utils/VirtualScroller";
import { getDatePart, parseDateToUTC, createUTCDateFromLocalCalendarDate } from "../utils/dateUtils";

export class KanbanView extends BasesViewBase {
	type = "tasknoteKanban";
	private boardEl: HTMLElement | null = null;
	private basesController: any; // Store controller for accessing query.views
	private currentTaskElements = new Map<string, HTMLElement>();
	private draggedTaskPath: string | null = null;
	private draggedTaskPaths: string[] = []; // For batch drag operations
	private draggedFromColumn: string | null = null; // Track source column for list property handling
	private draggedFromSwimlane: string | null = null; // Track source swimlane for list property handling
	private draggedSourceColumns: Map<string, string> = new Map(); // Track source column per task for batch operations
	private draggedSourceSwimlanes: Map<string, string> = new Map(); // Track source swimlane per task for batch operations
	private taskInfoCache = new Map<string, TaskInfo>();
	private containerListenersRegistered = false;
	private columnScrollers = new Map<string, VirtualScroller<TaskInfo>>(); // columnKey -> scroller

	// View options (accessed via BasesViewConfig)
	private swimLanePropertyId: string | null = null;
	private columnWidth = 280;
	private maxSwimlaneHeight = 600;
	private hideEmptyColumns = false;
	private explodeListColumns = true; // Show items with list properties in multiple columns
	private columnOrders: Record<string, string[]> = {};
	private configLoaded = false; // Track if we've successfully loaded config
	/**
	 * Threshold for enabling virtual scrolling in kanban columns/swimlane cells.
	 * Virtual scrolling activates when a column or cell has >= 15 cards.
	 * Lower than TaskListView (100) because kanban cards are typically larger with more
	 * visible properties, and columns are narrower (more constrained viewport).
	 * Benefits: ~85% memory reduction, smooth 60fps scrolling for columns with 200+ cards.
	 */
	private readonly VIRTUAL_SCROLL_THRESHOLD = 15;

	constructor(controller: any, containerEl: HTMLElement, plugin: TaskNotesPlugin) {
		super(controller, containerEl, plugin);
		this.basesController = controller; // Store for groupBy detection
		// BasesView now provides this.data, this.config, and this.app directly
		(this.dataAdapter as any).basesView = this;
		// Note: Don't read config here - this.config is not set until after construction
		// readViewOptions() will be called in onload()
	}

	/**
	 * Component lifecycle: Called when view is first loaded.
	 * Override from Component base class.
	 */
	onload(): void {
		// Read view options now that config is available
		this.readViewOptions();
		// Call parent onload which sets up container and listeners
		super.onload();
	}

	/**
	 * BasesView lifecycle: Called when Bases data changes.
	 * Override to preserve scroll position during re-renders.
	 */
	onDataUpdated(): void {
		// Save scroll state before re-render
		const savedState = this.getEphemeralState();

		try {
			this.render();
		} catch (error) {
			console.error(`[TaskNotes][${this.type}] Render error:`, error);
			this.renderError(error as Error);
		}

		// Restore scroll state after render
		this.setEphemeralState(savedState);
	}

	/**
	 * Read view configuration options from BasesViewConfig.
	 */
	private readViewOptions(): void {
		// Guard: config may not be set yet if called too early
		if (!this.config || typeof this.config.get !== 'function') {
			return;
		}

		try {
			this.swimLanePropertyId = this.config.getAsPropertyId('swimLane');
			this.columnWidth = (this.config.get('columnWidth') as number) || 280;
			this.maxSwimlaneHeight = (this.config.get('maxSwimlaneHeight') as number) || 600;
			this.hideEmptyColumns = (this.config.get('hideEmptyColumns') as boolean) || false;

			// Read explodeListColumns option (defaults to true)
			const explodeValue = this.config.get('explodeListColumns');
			this.explodeListColumns = explodeValue !== false; // Default to true if not set

			// Read column orders
			const columnOrderStr = (this.config.get('columnOrder') as string) || '{}';
			this.columnOrders = JSON.parse(columnOrderStr);

			// Read enableSearch toggle (default: false for backward compatibility)
			const enableSearchValue = this.config.get('enableSearch');
			this.enableSearch = (enableSearchValue as boolean) ?? false;

			// Mark config as successfully loaded
			this.configLoaded = true;
		} catch (e) {
			// Use defaults
			console.warn('[KanbanView] Failed to parse config:', e);
		}
	}

	/**
	 * Save ephemeral state including scroll positions for all columns.
	 * This preserves scroll position when the view is re-rendered (e.g., after task updates).
	 */
	getEphemeralState(): any {
		const columnScroll: Record<string, number> = {};

		// Save scroll position for virtual scrolling columns (from VirtualScroller)
		for (const [columnKey, scroller] of this.columnScrollers) {
			const scrollContainer = (scroller as any).scrollContainer as HTMLElement | undefined;
			if (scrollContainer) {
				columnScroll[columnKey] = scrollContainer.scrollTop;
			}
		}

		// Save scroll position for non-virtual columns (direct DOM elements)
		if (this.boardEl) {
			const columns = this.boardEl.querySelectorAll('.kanban-view__column');
			columns.forEach((column) => {
				const groupKey = column.getAttribute('data-group');
				const cardsContainer = column.querySelector('.kanban-view__cards') as HTMLElement;
				if (groupKey && cardsContainer && !(groupKey in columnScroll)) {
					columnScroll[groupKey] = cardsContainer.scrollTop;
				}
			});

			// Also save swimlane cell scroll positions (class is kanban-view__swimlane-column)
			const swimlaneCells = this.boardEl.querySelectorAll('.kanban-view__swimlane-column');
			swimlaneCells.forEach((cell) => {
				const columnKey = cell.getAttribute('data-column');
				const swimlaneKey = cell.getAttribute('data-swimlane');
				if (columnKey && swimlaneKey) {
					const cellKey = `${swimlaneKey}:${columnKey}`;
					const tasksContainer = cell.querySelector('.kanban-view__tasks-container') as HTMLElement;
					if (tasksContainer && !(cellKey in columnScroll)) {
						columnScroll[cellKey] = tasksContainer.scrollTop;
					}
				}
			});
		}

		return {
			scrollTop: this.rootElement?.scrollTop || 0,
			columnScroll,
		};
	}

	/**
	 * Restore ephemeral state including scroll positions for all columns.
	 */
	setEphemeralState(state: any): void {
		if (!state) return;

		// Restore board-level horizontal scroll
		if (state.scrollTop !== undefined && this.rootElement) {
			requestAnimationFrame(() => {
				if (this.rootElement && this.rootElement.isConnected) {
					this.rootElement.scrollTop = state.scrollTop;
				}
			});
		}

		// Restore column scroll positions after render completes
		if (state.columnScroll && typeof state.columnScroll === 'object') {
			// Use requestAnimationFrame to ensure DOM and VirtualScrollers are ready
			requestAnimationFrame(() => {
				// Restore virtual scroller positions
				for (const [columnKey, scroller] of this.columnScrollers) {
					const scrollTop = state.columnScroll[columnKey];
					if (scrollTop !== undefined) {
						const scrollContainer = (scroller as any).scrollContainer as HTMLElement | undefined;
						if (scrollContainer) {
							scrollContainer.scrollTop = scrollTop;
						}
					}
				}

				// Restore non-virtual column positions
				if (this.boardEl) {
					const columns = this.boardEl.querySelectorAll('.kanban-view__column');
					columns.forEach((column) => {
						const groupKey = column.getAttribute('data-group');
						if (groupKey && state.columnScroll[groupKey] !== undefined) {
							const cardsContainer = column.querySelector('.kanban-view__cards') as HTMLElement;
							if (cardsContainer && !this.columnScrollers.has(groupKey)) {
								cardsContainer.scrollTop = state.columnScroll[groupKey];
							}
						}
					});

					// Restore swimlane cell positions (class is kanban-view__swimlane-column)
					const swimlaneCells = this.boardEl.querySelectorAll('.kanban-view__swimlane-column');
					swimlaneCells.forEach((cell) => {
						const columnKey = cell.getAttribute('data-column');
						const swimlaneKey = cell.getAttribute('data-swimlane');
						if (columnKey && swimlaneKey) {
							const cellKey = `${swimlaneKey}:${columnKey}`;
							if (state.columnScroll[cellKey] !== undefined) {
								const tasksContainer = cell.querySelector('.kanban-view__tasks-container') as HTMLElement;
								if (tasksContainer && !this.columnScrollers.has(cellKey)) {
									tasksContainer.scrollTop = state.columnScroll[cellKey];
								}
							}
						}
					});
				}
			});
		}
	}

	async render(): Promise<void> {
		if (!this.boardEl || !this.rootElement) return;
		if (!this.data?.data) return;

		// Ensure view options are read (in case config wasn't available in onload)
		if (!this.configLoaded && this.config) {
			this.readViewOptions();
		}

		// Now that config is loaded, setup search (idempotent: will only create once)
		if (this.rootElement) {
			this.setupSearch(this.rootElement);
		}

		try {
			const dataItems = this.dataAdapter.extractDataItems();
			const taskNotes = await identifyTaskNotesFromBasesData(dataItems, this.plugin);

			// Apply search filter
			const filteredTasks = this.applySearchFilter(taskNotes);

			// Clear board and cleanup scrollers
			this.destroyColumnScrollers();
			this.boardEl.empty();

			if (filteredTasks.length === 0) {
				// Show "no results" if search returned empty but we had tasks
				if (this.isSearchWithNoResults(filteredTasks, taskNotes.length)) {
					this.renderSearchNoResults(this.boardEl);
				} else {
					this.renderEmptyState();
				}
				return;
			}

			// Build path -> props map for dynamic property access
			const pathToProps = this.buildPathToPropsMap();

			// Determine groupBy property ID
			const groupByPropertyId = this.getGroupByPropertyId();

			if (!groupByPropertyId) {
				// No groupBy - show error
				this.renderNoGroupByError();
				return;
			}

			// Group tasks
			const groups = this.groupTasks(filteredTasks, groupByPropertyId, pathToProps);

			// Render swimlanes if configured
			if (this.swimLanePropertyId) {
				await this.renderWithSwimLanes(groups, filteredTasks, pathToProps, groupByPropertyId);
			} else {
				await this.renderFlat(groups);
			}
		} catch (error: any) {
			console.error("[TaskNotes][KanbanView] Error rendering:", error);
			this.renderError(error);
		}
	}

	private getGroupByPropertyId(): string | null {
		// IMPORTANT: Public API doesn't expose groupBy property!
		// Must use internal API to detect if groupBy is configured.
		// We can't rely on isGrouped() because it returns false when all items have null values.

		const controller = this.basesController;

		// Try to get groupBy from internal API (controller.query.views)
		if (controller?.query?.views && controller?.viewName) {
			const views = controller.query.views;
			const viewName = controller.viewName;

			for (let i = 0; i < 20; i++) {
				const view = views[i];
				if (view && view.name === viewName) {
					if (view.groupBy) {
						if (typeof view.groupBy === 'object' && view.groupBy.property) {
							return view.groupBy.property;
						} else if (typeof view.groupBy === 'string') {
							return view.groupBy;
						}
					}

					// View found but no groupBy configured
					return null;
				}
			}
		}

		return null;
	}

	private groupTasks(
		taskNotes: TaskInfo[],
		groupByPropertyId: string,
		pathToProps: Map<string, Record<string, any>>
	): Map<string, TaskInfo[]> {
		const groups = new Map<string, TaskInfo[]>();

		// Check if we should explode list properties into multiple columns
		const cleanGroupBy = this.stripPropertyPrefix(groupByPropertyId);
		const shouldExplode = this.explodeListColumns && this.isListTypeProperty(cleanGroupBy);

		if (shouldExplode) {
			// For list properties (contexts, tags, projects, etc.), "explode" so tasks appear
			// in each individual column rather than a single combined column.
			// This matches user expectations: a task with contexts ["work", "call"]
			// should appear in both the "work" column AND the "call" column.
			for (const task of taskNotes) {
				// Get value from TaskInfo directly (already properly mapped) or fall back to pathToProps
				const value = this.getListPropertyValue(task, cleanGroupBy, pathToProps);

				if (Array.isArray(value) && value.length > 0) {
					// Add task to each individual value's column
					for (const item of value) {
						const columnKey = String(item) || "None";
						if (!groups.has(columnKey)) {
							groups.set(columnKey, []);
						}
						groups.get(columnKey)!.push(task);
					}
				} else {
					// No values or not an array - put in "None" column
					const columnKey = "None";
					if (!groups.has(columnKey)) {
						groups.set(columnKey, []);
					}
					groups.get(columnKey)!.push(task);
				}
			}
		} else {
			// For non-list properties (or when explode is disabled), use Bases grouped data directly
			// Note: We can't rely on isGrouped() because it returns false when all items have null values
			const basesGroups = this.dataAdapter.getGroupedData();
			const tasksByPath = new Map(taskNotes.map(t => [t.path, t]));

			for (const group of basesGroups) {
				const groupKey = this.dataAdapter.convertGroupKeyToString(group.key);
				const groupTasks: TaskInfo[] = [];

				for (const entry of group.entries) {
					const task = tasksByPath.get(entry.file.path);
					if (task) groupTasks.push(task);
				}

				groups.set(groupKey, groupTasks);
			}
		}

		// Augment with empty status columns if grouping by status
		this.augmentWithEmptyStatusColumns(groups, groupByPropertyId);

		// Augment with empty priority columns if grouping by priority
		this.augmentWithEmptyPriorityColumns(groups, groupByPropertyId);

		return groups;
	}

	/**
	 * Check if a property is a list-type that should show tasks in multiple columns.
	 * Uses Obsidian's metadataTypeManager to dynamically detect property types.
	 */
	private isListTypeProperty(propertyName: string): boolean {
		// Check Obsidian's property type registry
		const metadataTypeManager = (this.plugin.app as any).metadataTypeManager;
		if (metadataTypeManager?.properties) {
			const propertyInfo = metadataTypeManager.properties[propertyName.toLowerCase()];
			if (propertyInfo?.type) {
				// Obsidian list types: "multitext", "tags", "aliases"
				const listTypes = new Set(['multitext', 'tags', 'aliases']);
				if (listTypes.has(propertyInfo.type)) {
					return true;
				}
			}
		}

		// Fallback: check against known TaskNotes list properties
		// (in case metadataTypeManager doesn't have the property registered)
		const contextsField = this.plugin.fieldMapper.toUserField('contexts');
		const projectsField = this.plugin.fieldMapper.toUserField('projects');

		const knownListProperties = new Set([
			'contexts', contextsField,
			'projects', projectsField,
			'tags', 'aliases'
		]);

		return knownListProperties.has(propertyName);
	}

	/**
	 * Get the value of a list property from a task.
	 * Tries TaskInfo properties first (already properly mapped), then falls back to pathToProps.
	 */
	private getListPropertyValue(
		task: TaskInfo,
		propertyName: string,
		pathToProps: Map<string, Record<string, any>>
	): any {
		// Map user field names to TaskInfo property names
		const contextsField = this.plugin.fieldMapper.toUserField('contexts');
		const projectsField = this.plugin.fieldMapper.toUserField('projects');

		// Check if property matches known TaskInfo list properties
		if (propertyName === 'contexts' || propertyName === contextsField) {
			return task.contexts;
		}
		if (propertyName === 'projects' || propertyName === projectsField) {
			return task.projects;
		}
		if (propertyName === 'tags') {
			return task.tags;
		}

		// Fall back to pathToProps for custom list properties
		const props = pathToProps.get(task.path) || {};
		return props[propertyName];
	}

	/**
	 * Augment groups with empty columns for user-defined statuses.
	 * Only applies when grouping by status property.
	 */
	private augmentWithEmptyStatusColumns(
		groups: Map<string, TaskInfo[]>,
		groupByPropertyId: string
	): void {
		// Check if we're grouping by status
		// Compare the groupBy property against the user's configured status field name
		const statusPropertyName = this.plugin.fieldMapper.toUserField('status');

		// The groupByPropertyId from Bases might have a prefix (e.g., "note.status")
		// Strip the prefix to compare against the field name
		const cleanGroupBy = groupByPropertyId.replace(/^(note\.|file\.|task\.)/, '');

		if (cleanGroupBy !== statusPropertyName) {
			return; // Not grouping by status, don't augment
		}

		// Get all user-defined statuses from settings
		const customStatuses = this.plugin.settings.customStatuses;
		if (!customStatuses || customStatuses.length === 0) {
			return; // No custom statuses defined
		}

		// Add empty groups for any status values not already present
		for (const statusConfig of customStatuses) {
			// Use the status value (what gets written to YAML) as the group key
			const statusValue = statusConfig.value;

			if (!groups.has(statusValue)) {
				// This status has no tasks - add an empty group
				groups.set(statusValue, []);
			}
		}
	}

	/**
	 * Augment groups with empty columns for user-defined priorities.
	 * Only applies when grouping by priority property.
	 */
	private augmentWithEmptyPriorityColumns(
		groups: Map<string, TaskInfo[]>,
		groupByPropertyId: string
	): void {
		// Check if we're grouping by priority
		// Compare the groupBy property against the user's configured priority field name
		const priorityPropertyName = this.plugin.fieldMapper.toUserField('priority');

		// The groupByPropertyId from Bases might have a prefix (e.g., "note.priority" or "task.priority")
		// Strip the prefix to compare against the field name
		const cleanGroupBy = groupByPropertyId.replace(/^(note\.|file\.|task\.)/, '');

		if (cleanGroupBy !== priorityPropertyName) {
			return; // Not grouping by priority, don't augment
		}

		// Get all user-defined priorities from the priority manager
		const customPriorities = this.plugin.priorityManager.getAllPriorities();
		if (!customPriorities || customPriorities.length === 0) {
			return; // No custom priorities defined
		}

		// Add empty groups for any priority values not already present
		for (const priorityConfig of customPriorities) {
			// Use the priority value (what gets written to YAML) as the group key
			const priorityValue = priorityConfig.value;

			if (!groups.has(priorityValue)) {
				// This priority has no tasks - add an empty group
				groups.set(priorityValue, []);
			}
		}
	}

	private async renderFlat(
		groups: Map<string, TaskInfo[]>
	): Promise<void> {
		if (!this.boardEl) return;

		// Set CSS variable for column width (allows responsive override)
		this.boardEl.style.setProperty('--kanban-column-width', `${this.columnWidth}px`);

		// Render columns without swimlanes
		const visibleProperties = this.getVisibleProperties();

		// Note: tasks are already sorted by Bases within each group
		// No manual sorting needed - Bases provides pre-sorted data

		// Get groupBy property ID
		const groupByPropertyId = this.getGroupByPropertyId();

		// Get column keys and apply ordering
		const columnKeys = Array.from(groups.keys());
		const orderedKeys = groupByPropertyId
			? this.applyColumnOrder(groupByPropertyId, columnKeys)
			: columnKeys;

		for (const groupKey of orderedKeys) {
			const tasks = groups.get(groupKey) || [];

			// Filter empty columns if option enabled
			if (this.hideEmptyColumns && tasks.length === 0) {
				continue;
			}

			// Create column
			const column = await this.createColumn(groupKey, tasks, visibleProperties);
			if (this.boardEl) {
				this.boardEl.appendChild(column);
			}
		}
	}

	private async renderWithSwimLanes(
		groups: Map<string, TaskInfo[]>,
		allTasks: TaskInfo[],
		pathToProps: Map<string, Record<string, any>>,
		groupByPropertyId: string
	): Promise<void> {
		if (!this.swimLanePropertyId) return;

		// Group by swimlane first, then by column within each swimlane
		const swimLanes = new Map<string, Map<string, TaskInfo[]>>();

		// Get all unique swimlane values
		const swimLaneValues = new Set<string>();

		for (const task of allTasks) {
			const props = pathToProps.get(task.path) || {};
			const swimLaneValue = this.getPropertyValue(props, this.swimLanePropertyId);
			const swimLaneKey = this.valueToString(swimLaneValue);
			swimLaneValues.add(swimLaneKey);
		}

		// Initialize swimlane -> column -> tasks structure
		// Note: groups already includes empty status columns from augmentWithEmptyStatusColumns()
		for (const swimLaneKey of swimLaneValues) {
			const swimLaneMap = new Map<string, TaskInfo[]>();
			swimLanes.set(swimLaneKey, swimLaneMap);

			// Initialize each column in this swimlane (including empty status columns)
			for (const [columnKey] of groups) {
				swimLaneMap.set(columnKey, []);
			}
		}

		// Check if we should explode list properties into multiple columns
		const cleanGroupBy = this.stripPropertyPrefix(groupByPropertyId);
		const shouldExplode = this.explodeListColumns && this.isListTypeProperty(cleanGroupBy);

		// Distribute tasks into swimlane + column cells
		for (const task of allTasks) {
			const props = pathToProps.get(task.path) || {};

			// Determine swimlane
			const swimLaneValue = this.getPropertyValue(props, this.swimLanePropertyId);
			const swimLaneKey = this.valueToString(swimLaneValue);

			const swimLane = swimLanes.get(swimLaneKey);
			if (!swimLane) continue;

			if (shouldExplode) {
				// For list properties, add task to each individual column
				const value = this.getListPropertyValue(task, cleanGroupBy, pathToProps);

				if (Array.isArray(value) && value.length > 0) {
					for (const item of value) {
						const columnKey = String(item) || "None";
						if (swimLane.has(columnKey)) {
							swimLane.get(columnKey)!.push(task);
						}
					}
				} else {
					// No values - put in "None" column
					if (swimLane.has("None")) {
						swimLane.get("None")!.push(task);
					}
				}
			} else {
				// For non-list properties, use single column
				const columnValue = this.getPropertyValue(props, groupByPropertyId);
				const columnKey = this.valueToString(columnValue);

				if (swimLane.has(columnKey)) {
					swimLane.get(columnKey)!.push(task);
				}
			}
		}

		// Apply column ordering
		const columnKeys = Array.from(groups.keys());
		const orderedKeys = this.applyColumnOrder(groupByPropertyId, columnKeys);

		// Render swimlane table
		await this.renderSwimLaneTable(swimLanes, orderedKeys, pathToProps);
	}

	private async renderSwimLaneTable(
		swimLanes: Map<string, Map<string, TaskInfo[]>>,
		columnKeys: string[],
		pathToProps: Map<string, Record<string, any>>
	): Promise<void> {
		if (!this.boardEl) return;

		// Set CSS variables for column width and swimlane max height
		this.boardEl.style.setProperty('--kanban-column-width', `${this.columnWidth}px`);
		this.boardEl.style.setProperty('--kanban-swimlane-max-height', `${this.maxSwimlaneHeight}px`);

		// Add swimlanes class to board
		this.boardEl.addClass("kanban-view__board--swimlanes");

		// Create header row
		const headerRow = this.boardEl.createEl("div", {
			cls: "kanban-view__swimlane-row kanban-view__swimlane-row--header"
		});

		// Empty corner cell for swimlane label column
		headerRow.createEl("div", { cls: "kanban-view__swimlane-label" });

		// Column headers
		for (const columnKey of columnKeys) {
			const headerCell = headerRow.createEl("div", {
				cls: "kanban-view__column-header-cell"
			});
			headerCell.setAttribute("draggable", "true");
			headerCell.setAttribute("data-column-key", columnKey);

			// Drag handle icon
			const dragHandle = headerCell.createSpan({ cls: "kanban-view__drag-handle" });
			dragHandle.textContent = "⋮⋮";

			const titleContainer = headerCell.createSpan({ cls: "kanban-view__column-title" });
			this.renderGroupTitleWrapper(titleContainer, columnKey);

			// Setup column header drag handlers for swimlane mode
			this.setupColumnHeaderDragHandlers(headerCell);
		}

		// Get visible properties for cards
		const visibleProperties = this.getVisibleProperties();

		// Note: tasks are already sorted by Bases
		// No manual sorting needed - Bases provides pre-sorted data

		// Render each swimlane row
		for (const [swimLaneKey, columns] of swimLanes) {
			const row = this.boardEl.createEl("div", { cls: "kanban-view__swimlane-row" });

			// Swimlane label cell
			const labelCell = row.createEl("div", { cls: "kanban-view__swimlane-label" });

			// Add swimlane title and count
			const titleEl = labelCell.createEl("div", { cls: "kanban-view__swimlane-title" });
			this.renderGroupTitleWrapper(titleEl, swimLaneKey);

			// Count total tasks in this swimlane
			const totalTasks = Array.from(columns.values()).reduce((sum, tasks) => sum + tasks.length, 0);
			labelCell.createEl("div", {
				cls: "kanban-view__swimlane-count",
				text: `${totalTasks}`
			});

			// Render columns in this swimlane
			for (const columnKey of columnKeys) {
				const tasks = columns.get(columnKey) || [];

				// Create cell
				const cell = row.createEl("div", {
					cls: "kanban-view__swimlane-column",
					attr: {
						"data-column": columnKey,
						"data-swimlane": swimLaneKey
					}
				});

				// Setup drop handlers for this cell
				this.setupSwimLaneCellDragDrop(cell, columnKey, swimLaneKey);

				// Create tasks container inside the cell
				const tasksContainer = cell.createDiv({ cls: "kanban-view__tasks-container" });

				// Use virtual scrolling for cells with 30+ tasks
				if (tasks.length >= this.VIRTUAL_SCROLL_THRESHOLD) {
					await this.createVirtualSwimLaneCell(
						tasksContainer,
						`${swimLaneKey}:${columnKey}`,
						tasks,
						visibleProperties
					);
				} else {
					// Render tasks normally for smaller cells
					const cardOptions = this.getCardOptions();
					for (const task of tasks) {
						const cardWrapper = tasksContainer.createDiv({ cls: "kanban-view__card-wrapper" });
						cardWrapper.setAttribute("draggable", "true");
						cardWrapper.setAttribute("data-task-path", task.path);

						const card = createTaskCard(task, this.plugin, visibleProperties, cardOptions);

						cardWrapper.appendChild(card);
						this.currentTaskElements.set(task.path, cardWrapper);
						this.taskInfoCache.set(task.path, task);

						// Setup card drag handlers
						this.setupCardDragHandlers(cardWrapper, task);
					}
				}
			}
		}
	}

	private async createColumn(
		groupKey: string,
		tasks: TaskInfo[],
		visibleProperties: string[]
	): Promise<HTMLElement> {
		const column = document.createElement("div");
		column.className = "kanban-view__column";
		column.style.width = `${this.columnWidth}px`;
		column.setAttribute("data-group", groupKey);

		// Column header
		const header = column.createDiv({ cls: "kanban-view__column-header" });
		header.setAttribute("draggable", "true");
		header.setAttribute("data-column-key", groupKey);

		// Drag handle icon
		const dragHandle = header.createSpan({ cls: "kanban-view__drag-handle" });
		dragHandle.textContent = "⋮⋮";

		const titleContainer = header.createSpan({ cls: "kanban-view__column-title" });
		this.renderGroupTitleWrapper(titleContainer, groupKey);

		header.createSpan({
			cls: "kanban-view__column-count",
			text: ` (${tasks.length})`
		});

		// Setup column header drag handlers
		this.setupColumnHeaderDragHandlers(header);

		// Cards container
		const cardsContainer = column.createDiv({ cls: "kanban-view__cards" });

		// Setup drag-and-drop for cards
		this.setupColumnDragDrop(column, cardsContainer, groupKey);

		const cardOptions = this.getCardOptions();

		// Use virtual scrolling for columns with many cards
		if (tasks.length >= this.VIRTUAL_SCROLL_THRESHOLD) {
			this.createVirtualColumn(cardsContainer, groupKey, tasks, visibleProperties, cardOptions);
		} else {
			this.createNormalColumn(cardsContainer, tasks, visibleProperties, cardOptions);
		}

		return column;
	}

	private createVirtualColumn(
		cardsContainer: HTMLElement,
		groupKey: string,
		tasks: TaskInfo[],
		visibleProperties: string[],
		cardOptions: any
	): void {
		// Make container scrollable with full viewport height
		cardsContainer.style.cssText = "overflow-y: auto; max-height: 100vh; position: relative;";

		const scroller = new VirtualScroller<TaskInfo>({
			container: cardsContainer,
			items: tasks,
			// itemHeight omitted - automatically calculated from sample
			overscan: 3,
			renderItem: (task: TaskInfo) => {
				const cardWrapper = document.createElement("div");
				cardWrapper.className = "kanban-view__card-wrapper";
				cardWrapper.setAttribute("draggable", "true");
				cardWrapper.setAttribute("data-task-path", task.path);

				const card = createTaskCard(task, this.plugin, visibleProperties, cardOptions);
				cardWrapper.appendChild(card);

				this.taskInfoCache.set(task.path, task);
				this.setupCardDragHandlers(cardWrapper, task);

				return cardWrapper;
			},
			getItemKey: (task: TaskInfo) => task.path,
		});

		this.columnScrollers.set(groupKey, scroller);
	}

	private async createVirtualSwimLaneCell(
		tasksContainer: HTMLElement,
		cellKey: string,
		tasks: TaskInfo[],
		visibleProperties: string[]
	): Promise<void> {
		// Make container scrollable and fill the cell
		tasksContainer.style.cssText = "overflow-y: auto; height: 100%; position: relative;";

		const cardOptions = this.getCardOptions();

		const scroller = new VirtualScroller<TaskInfo>({
			container: tasksContainer,
			items: tasks,
			// itemHeight omitted - automatically calculated from sample
			overscan: 3,
			renderItem: (task: TaskInfo) => {
				const cardWrapper = document.createElement("div");
				cardWrapper.className = "kanban-view__card-wrapper";
				cardWrapper.setAttribute("draggable", "true");
				cardWrapper.setAttribute("data-task-path", task.path);

				const card = createTaskCard(task, this.plugin, visibleProperties, cardOptions);

				cardWrapper.appendChild(card);

				this.taskInfoCache.set(task.path, task);
				this.setupCardDragHandlers(cardWrapper, task);

				return cardWrapper;
			},
			getItemKey: (task: TaskInfo) => task.path,
		});

		this.columnScrollers.set(cellKey, scroller);
	}

	private createNormalColumn(
		cardsContainer: HTMLElement,
		tasks: TaskInfo[],
		visibleProperties: string[],
		cardOptions: any
	): void {
		for (const task of tasks) {
			const cardWrapper = cardsContainer.createDiv({ cls: "kanban-view__card-wrapper" });
			cardWrapper.setAttribute("draggable", "true");
			cardWrapper.setAttribute("data-task-path", task.path);

			const card = createTaskCard(task, this.plugin, visibleProperties, cardOptions);

			cardWrapper.appendChild(card);
			this.currentTaskElements.set(task.path, cardWrapper);
			this.taskInfoCache.set(task.path, task);

			// Setup card drag handlers
			this.setupCardDragHandlers(cardWrapper, task);
		}
	}

	private setupColumnHeaderDragHandlers(header: HTMLElement): void {
		const columnKey = header.dataset.columnKey;
		if (!columnKey) return;

		// Determine if this is a swimlane header or regular column header
		const isSwimlaneHeader = header.classList.contains("kanban-view__column-header-cell");
		const draggingClass = isSwimlaneHeader
			? "kanban-view__column-header-cell--dragging"
			: "kanban-view__column-header--dragging";

		header.addEventListener("dragstart", (e: DragEvent) => {
			if (!e.dataTransfer) return;
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData("text/x-kanban-column", columnKey);
			header.classList.add(draggingClass);
		});

		header.addEventListener("dragover", (e: DragEvent) => {
			// Only handle column drags (not task drags)
			if (!e.dataTransfer?.types.includes("text/x-kanban-column")) return;
			e.preventDefault();
			e.stopPropagation();
			e.dataTransfer.dropEffect = "move";

			// Add visual feedback for drop target
			header.classList.add("kanban-view__column-header--dragover");
		});

		header.addEventListener("dragleave", (e: DragEvent) => {
			// Only handle column drags
			if (!e.dataTransfer?.types.includes("text/x-kanban-column")) return;
			if (e.target === header) {
				header.classList.remove("kanban-view__column-header--dragover");
			}
		});

		header.addEventListener("drop", async (e: DragEvent) => {
			// Only handle column drags (not task drags)
			if (!e.dataTransfer?.types.includes("text/x-kanban-column")) return;
			e.preventDefault();
			e.stopPropagation();

			// Remove visual feedback
			header.classList.remove("kanban-view__column-header--dragover");

			const draggedKey = e.dataTransfer.getData("text/x-kanban-column");
			const targetKey = header.dataset.columnKey;
			if (!targetKey || !draggedKey || draggedKey === targetKey) return;

			// Get current groupBy property
			const groupBy = this.getGroupByPropertyId();
			if (!groupBy) return;

			// Get current column order from DOM (supports both flat and swimlane modes)
			const selector = isSwimlaneHeader
				? ".kanban-view__column-header-cell"
				: ".kanban-view__column-header";
			const currentOrder = Array.from(this.boardEl!.querySelectorAll(selector))
				.map(el => (el as HTMLElement).dataset.columnKey)
				.filter(Boolean) as string[];

			// Calculate new order
			const dragIndex = currentOrder.indexOf(draggedKey);
			const dropIndex = currentOrder.indexOf(targetKey);

			const newOrder = [...currentOrder];
			newOrder.splice(dragIndex, 1);
			newOrder.splice(dropIndex, 0, draggedKey);

			// Save new order
			await this.saveColumnOrder(groupBy, newOrder);

			// Re-render
			await this.render();
		});

		header.addEventListener("dragend", () => {
			header.classList.remove(draggingClass);
		});
	}

	private setupColumnDragDrop(
		column: HTMLElement,
		cardsContainer: HTMLElement,
		groupKey: string
	): void {
		// Drag over handler
		column.addEventListener("dragover", (e: DragEvent) => {
			// Only handle task drags (not column drags)
			if (e.dataTransfer?.types.includes("text/x-kanban-column")) return;
			e.preventDefault();
			e.stopPropagation();
			if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
			column.classList.add("kanban-view__column--dragover");
		});

		// Drag leave handler
		column.addEventListener("dragleave", (e: DragEvent) => {
			// Only remove if we're actually leaving the column (not just moving to a child)
			const rect = column.getBoundingClientRect();
			const x = (e as any).clientX;
			const y = (e as any).clientY;

			if (
				x < rect.left || x >= rect.right ||
				y < rect.top || y >= rect.bottom
			) {
				column.classList.remove("kanban-view__column--dragover");
			}
		});

		// Drop handler
		column.addEventListener("drop", async (e: DragEvent) => {
			// Only handle task drags (not column drags)
			if (e.dataTransfer?.types.includes("text/x-kanban-column")) return;
			e.preventDefault();
			e.stopPropagation();
			column.classList.remove("kanban-view__column--dragover");

			if (!this.draggedTaskPath) return;

			// Update the task's groupBy property in Bases
			await this.handleTaskDrop(this.draggedTaskPath, groupKey, null);

			this.draggedTaskPath = null;
			this.draggedFromColumn = null;
		});

		// Drag end handler - cleanup in case drop doesn't fire
		column.addEventListener("dragend", () => {
			column.classList.remove("kanban-view__column--dragover");
		});
	}

	private setupSwimLaneCellDragDrop(
		cell: HTMLElement,
		columnKey: string,
		swimLaneKey: string
	): void {
		// Drag over handler
		cell.addEventListener("dragover", (e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
			cell.classList.add("kanban-view__swimlane-column--dragover");
		});

		// Drag leave handler
		cell.addEventListener("dragleave", (e: DragEvent) => {
			// Only remove if we're actually leaving the cell (not just moving to a child)
			const rect = cell.getBoundingClientRect();
			const x = (e as any).clientX;
			const y = (e as any).clientY;

			if (
				x < rect.left || x >= rect.right ||
				y < rect.top || y >= rect.bottom
			) {
				cell.classList.remove("kanban-view__swimlane-column--dragover");
			}
		});

		// Drop handler
		cell.addEventListener("drop", async (e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			cell.classList.remove("kanban-view__swimlane-column--dragover");

			if (!this.draggedTaskPath) return;

			// Update both the groupBy property and swimlane property
			await this.handleTaskDrop(this.draggedTaskPath, columnKey, swimLaneKey);

			this.draggedTaskPath = null;
			this.draggedFromColumn = null;
		});

		// Drag end handler - cleanup in case drop doesn't fire
		cell.addEventListener("dragend", () => {
			cell.classList.remove("kanban-view__swimlane-column--dragover");
		});
	}

	private setupCardDragHandlers(cardWrapper: HTMLElement, task: TaskInfo): void {
		// Handle click for selection mode
		cardWrapper.addEventListener("click", (e: MouseEvent) => {
			// Check if this is a selection click
			if (this.handleSelectionClick(e, task.path)) {
				e.stopPropagation();
				return;
			}
		});

		// Handle right-click for context menu
		cardWrapper.addEventListener("contextmenu", (e: MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();

			// If multiple tasks are selected, show batch context menu
			const selectionService = this.plugin.taskSelectionService;
			if (selectionService && selectionService.getSelectionCount() > 1) {
				// Ensure the right-clicked task is in the selection
				if (!selectionService.isSelected(task.path)) {
					selectionService.addToSelection(task.path);
				}
				this.showBatchContextMenu(e);
				return;
			}

			// Show single task context menu
			const { showTaskContextMenu } = require("../ui/TaskCard");
			showTaskContextMenu(e, task.path, this.plugin, new Date());
		});

		cardWrapper.addEventListener("dragstart", (e: DragEvent) => {
			// Check if we're dragging selected tasks (batch drag)
			const selectionService = this.plugin.taskSelectionService;
			if (selectionService && selectionService.isSelected(task.path) && selectionService.getSelectionCount() > 1) {
				// Batch drag - drag all selected tasks
				this.draggedTaskPaths = selectionService.getSelectedPaths();
				this.draggedTaskPath = task.path;

				// Build source column and swimlane maps for all selected tasks
				this.draggedSourceColumns.clear();
				this.draggedSourceSwimlanes.clear();
				for (const path of this.draggedTaskPaths) {
					const wrapper = this.currentTaskElements.get(path);
					if (wrapper) {
						wrapper.classList.add("kanban-view__card--dragging");
						// Capture source column for each task
						const col = wrapper.closest('[data-group]') as HTMLElement;
						const swimCol = wrapper.closest('[data-column]') as HTMLElement;
						const swimlaneRow = wrapper.closest('[data-swimlane]') as HTMLElement;
						const sourceCol = col?.dataset.group || swimCol?.dataset.column;
						const sourceSwimlane = swimlaneRow?.dataset.swimlane;
						if (sourceCol) {
							this.draggedSourceColumns.set(path, sourceCol);
						}
						if (sourceSwimlane) {
							this.draggedSourceSwimlanes.set(path, sourceSwimlane);
						}
					}
				}

				if (e.dataTransfer) {
					e.dataTransfer.effectAllowed = "move";
					e.dataTransfer.setData("text/plain", this.draggedTaskPaths.join(","));
					e.dataTransfer.setData("text/x-batch-drag", "true");
				}
			} else {
				// Single card drag
				this.draggedTaskPath = task.path;
				this.draggedTaskPaths = [task.path];
				cardWrapper.classList.add("kanban-view__card--dragging");

				if (e.dataTransfer) {
					e.dataTransfer.effectAllowed = "move";
					e.dataTransfer.setData("text/plain", task.path);
				}
			}

			// Capture the source column and swimlane for list property handling (single drag fallback)
			const column = cardWrapper.closest('[data-group]') as HTMLElement;
			const swimlaneColumn = cardWrapper.closest('[data-column]') as HTMLElement;
			const swimlaneRow = cardWrapper.closest('[data-swimlane]') as HTMLElement;
			this.draggedFromColumn = column?.dataset.group || swimlaneColumn?.dataset.column || null;
			this.draggedFromSwimlane = swimlaneRow?.dataset.swimlane || null;
		});

		cardWrapper.addEventListener("dragend", () => {
			// Remove dragging class from all dragged cards
			for (const path of this.draggedTaskPaths) {
				const wrapper = this.currentTaskElements.get(path);
				if (wrapper) {
					wrapper.classList.remove("kanban-view__card--dragging");
				}
			}
			cardWrapper.classList.remove("kanban-view__card--dragging");
			this.draggedFromColumn = null;
			this.draggedFromSwimlane = null;
			this.draggedTaskPaths = [];
			this.draggedSourceColumns.clear();
			this.draggedSourceSwimlanes.clear();

			// Clean up any lingering dragover classes
			this.boardEl?.querySelectorAll('.kanban-view__column--dragover').forEach(el => {
				el.classList.remove('kanban-view__column--dragover');
			});
			this.boardEl?.querySelectorAll('.kanban-view__swimlane-column--dragover').forEach(el => {
				el.classList.remove('kanban-view__swimlane-column--dragover');
			});
		});
	}

	private async handleTaskDrop(
		taskPath: string,
		newGroupValue: string,
		newSwimLaneValue: string | null
	): Promise<void> {
		try {
			// Get the groupBy property from the controller
			const groupByPropertyId = this.getGroupByPropertyId();
			if (!groupByPropertyId) return;

			// Check if groupBy is a formula - formulas are read-only
			if (groupByPropertyId.startsWith('formula.')) {
				new Notice(
					this.plugin.i18n.translate("views.kanban.errors.formulaGroupingReadOnly") ||
					"Cannot move tasks between formula-based columns. Formula values are computed and cannot be directly modified."
				);
				return;
			}

			// Check if swimlane is a formula - formulas are read-only
			if (newSwimLaneValue !== null && this.swimLanePropertyId?.startsWith('formula.')) {
				new Notice(
					this.plugin.i18n.translate("views.kanban.errors.formulaSwimlaneReadOnly") ||
					"Cannot move tasks between formula-based swimlanes. Formula values are computed and cannot be directly modified."
				);
				return;
			}

			const cleanGroupBy = this.stripPropertyPrefix(groupByPropertyId);
			const isGroupByListProperty = this.explodeListColumns && this.isListTypeProperty(cleanGroupBy);

			// Check if swimlane property is also a list type
			const cleanSwimlane = this.swimLanePropertyId ? this.stripPropertyPrefix(this.swimLanePropertyId) : null;
			const isSwimlaneListProperty = cleanSwimlane && this.isListTypeProperty(cleanSwimlane);

			// Handle batch drag - update all dragged tasks
			const pathsToUpdate = this.draggedTaskPaths.length > 1 ? this.draggedTaskPaths : [taskPath];
			const isBatchOperation = pathsToUpdate.length > 1;

			for (const path of pathsToUpdate) {
				// Get the source column and swimlane for this specific task
				const sourceColumn = isBatchOperation
					? this.draggedSourceColumns.get(path)
					: this.draggedFromColumn;
				const sourceSwimlane = isBatchOperation
					? this.draggedSourceSwimlanes.get(path)
					: this.draggedFromSwimlane;

				// Update groupBy property
				if (isGroupByListProperty && sourceColumn) {
					// For list properties, remove the source value and add the target value
					await this.updateListPropertyOnDrop(path, groupByPropertyId, sourceColumn, newGroupValue);
				} else {
					// For non-list properties, simply replace the value
					await this.updateTaskFrontmatterProperty(path, groupByPropertyId, newGroupValue);
				}

				// Update swimlane property if applicable
				if (newSwimLaneValue !== null && this.swimLanePropertyId) {
					if (isSwimlaneListProperty && sourceSwimlane) {
						// For list swimlane properties, remove source and add target
						await this.updateListPropertyOnDrop(path, this.swimLanePropertyId, sourceSwimlane, newSwimLaneValue);
					} else {
						// For non-list swimlane properties, simply replace the value
						await this.updateTaskFrontmatterProperty(path, this.swimLanePropertyId, newSwimLaneValue);
					}
				}
			}

			// Clear selection after batch move
			if (isBatchOperation) {
				this.plugin.taskSelectionService?.clearSelection();
				this.plugin.taskSelectionService?.exitSelectionMode();
			}

			// Refresh to show updated position
			this.debouncedRefresh();
		} catch (error) {
			console.error("[TaskNotes][KanbanView] Error updating task:", error);
		}
	}

	/**
	 * Update a list property when dragging between columns.
	 * Removes the source column's value and adds the target column's value.
	 */
	private async updateListPropertyOnDrop(
		taskPath: string,
		basesPropertyId: string,
		sourceValue: string,
		targetValue: string
	): Promise<void> {
		// If dropping on the same column, do nothing
		if (sourceValue === targetValue) return;

		const file = this.plugin.app.vault.getAbstractFileByPath(taskPath);
		if (!file || !(file instanceof TFile)) {
			throw new Error(`Cannot find task file: ${taskPath}`);
		}

		const frontmatterKey = basesPropertyId.replace(/^(note\.|file\.|task\.)/, '');

		await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			let currentValue = frontmatter[frontmatterKey];

			// Ensure we're working with an array
			if (!Array.isArray(currentValue)) {
				currentValue = currentValue ? [currentValue] : [];
			}

			// Create new array: remove source value, add target value (if not already present)
			const newValue = currentValue.filter((v: string) => v !== sourceValue);
			if (!newValue.includes(targetValue) && targetValue !== "None") {
				newValue.push(targetValue);
			}

			// Update the frontmatter
			frontmatter[frontmatterKey] = newValue.length > 0 ? newValue : [];
		});
	}

	/**
	 * Update a frontmatter property for any property (built-in or user-defined)
	 */
	private async updateTaskFrontmatterProperty(
		taskPath: string,
		basesPropertyId: string,
		value: any
	): Promise<void> {
		const file = this.plugin.app.vault.getAbstractFileByPath(taskPath);
		if (!file || !(file instanceof TFile)) {
			throw new Error(`Cannot find task file: ${taskPath}`);
		}

		// Strip Bases prefix to get the frontmatter key
		const frontmatterKey = basesPropertyId.replace(/^(note\.|file\.|task\.)/, '');

		const task = await this.plugin.cacheManager.getTaskInfo(taskPath);
		const taskProperty = this.plugin.fieldMapper.lookupMappingKey(frontmatterKey);

		if (task && taskProperty) {
			// Update the task property using updateProperty to ensure all business logic runs
			// (e.g., completedDate updates, auto-archive queueing, webhooks, etc.)
			await this.plugin.taskService.updateProperty(task, taskProperty as keyof TaskInfo, value);
		} else {
			// Update the frontmatter directly for custom/unrecognized properties
			await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
				frontmatter[frontmatterKey] = value;
			});
		}
	}

	protected setupContainer(): void {
		super.setupContainer();

		const board = document.createElement("div");
		board.className = "kanban-view__board";
		this.rootElement?.appendChild(board);
		this.boardEl = board;
		this.registerBoardListeners();
	}

	protected async handleTaskUpdate(task: TaskInfo): Promise<void> {
		// For kanban, just do full refresh since cards might move columns
		this.debouncedRefresh();
	}

	/**
	 * Override debouncedRefresh to preserve scroll positions during re-renders.
	 * Saves ephemeral state before render and restores it after.
	 */
	protected debouncedRefresh(): void {
		if ((this as any).updateDebounceTimer) {
			clearTimeout((this as any).updateDebounceTimer);
		}

		// Save current scroll state before the timer fires
		const savedState = this.getEphemeralState();

		(this as any).updateDebounceTimer = window.setTimeout(async () => {
			await this.render();
			(this as any).updateDebounceTimer = null;
			// Restore scroll state after render completes
			this.setEphemeralState(savedState);
		}, 150);
	}

	private renderEmptyState(): void {
		if (!this.boardEl) return;
		const empty = document.createElement("div");
		empty.className = "tn-bases-empty";
		empty.style.cssText = "padding: 20px; text-align: center; color: var(--text-muted);";
		empty.textContent = "No TaskNotes tasks found for this Base.";
		this.boardEl.appendChild(empty);
	}

	private renderNoGroupByError(): void {
		if (!this.boardEl) return;
		const error = document.createElement("div");
		error.className = "tn-bases-error";
		error.style.cssText = "padding: 20px; text-align: center; color: var(--text-error);";
		error.textContent = this.plugin.i18n.translate("views.kanban.errors.noGroupBy");
		this.boardEl.appendChild(error);
	}

	renderError(error: Error): void {
		if (!this.boardEl) return;
		const errorEl = document.createElement("div");
		errorEl.className = "tn-bases-error";
		errorEl.style.cssText =
			"padding: 20px; color: #d73a49; background: #ffeaea; border-radius: 4px; margin: 10px 0;";
		errorEl.textContent = `Error loading kanban: ${error.message || "Unknown error"}`;
		this.boardEl.appendChild(errorEl);
	}

	private buildPathToPropsMap(): Map<string, Record<string, any>> {
		const dataItems = this.dataAdapter.extractDataItems();
		const map = new Map<string, Record<string, any>>();

		for (const item of dataItems) {
			if (!item.path) continue;

			// Merge regular properties with formula results
			const props = { ...(item.properties || {}) };

			// Add formula results if available
			const formulaOutputs = item.basesData?.formulaResults?.cachedFormulaOutputs;
			if (formulaOutputs && typeof formulaOutputs === 'object') {
				for (const [formulaName, value] of Object.entries(formulaOutputs)) {
					// Store with formula. prefix for easy lookup
					props[`formula.${formulaName}`] = value;
				}
			}

			map.set(item.path, props);
		}

		return map;
	}

	private getPropertyValue(props: Record<string, any>, propertyId: string): any {
		// Formula properties are stored with their full prefix (formula.NAME)
		if (propertyId.startsWith('formula.')) {
			return props[propertyId] ?? null;
		}

		// Strip prefix from property ID if present
		const cleanId = this.stripPropertyPrefix(propertyId);

		// Try exact match first
		if (props[propertyId] !== undefined) return props[propertyId];
		if (props[cleanId] !== undefined) return props[cleanId];

		return null;
	}

	private stripPropertyPrefix(propertyId: string): string {
		const parts = propertyId.split(".");
		if (parts.length > 1 && ["note", "file", "formula", "task"].includes(parts[0])) {
			return parts.slice(1).join(".");
		}
		return propertyId;
	}

	private valueToString(value: any): string {
		if (value === null || value === undefined) return "None";

		// Handle Bases Value objects (they have a toString() method and often a type property)
		// Check for Bases Value object by duck-typing (has toString and is an object with constructor)
		if (typeof value === "object" && value !== null && typeof value.toString === "function") {
			// Check if it's a Bases NullValue
			if (value.constructor?.name === "NullValue" || (value.isTruthy && !value.isTruthy())) {
				return "None";
			}

			// Check if it's a Bases ListValue (array-like)
			if (value.constructor?.name === "ListValue" || (Array.isArray(value.value))) {
				const arr = value.value || [];
				if (arr.length === 0) return "None";
				// Recursively convert each item
				return arr.map((v: any) => this.valueToString(v)).join(", ");
			}

			// For other Bases Value types (StringValue, NumberValue, BooleanValue, DateValue, etc.)
			// Use their toString() method
			const str = value.toString();
			return str || "None";
		}

		if (typeof value === "string") return value || "None";
		if (typeof value === "number") return String(value);
		if (typeof value === "boolean") return value ? "True" : "False";
		if (Array.isArray(value)) return value.length > 0 ? value.map((v) => this.valueToString(v)).join(", ") : "None";
		return String(value);
	}

	private renderGroupTitleWrapper(container: HTMLElement, title: string): void {
		// Use this.app if available (set by Bases), otherwise fall back to plugin.app
		const app = this.app || this.plugin.app;

		const linkServices: LinkServices = {
			metadataCache: app.metadataCache,
			workspace: app.workspace,
		};
		renderGroupTitle(container, title, linkServices);
	}

	private applyColumnOrder(groupBy: string, actualKeys: string[]): string[] {
		// Get saved order for this grouping property
		const savedOrder = this.columnOrders[groupBy];

		if (!savedOrder || savedOrder.length === 0) {
			// No saved order - use natural order (alphabetical)
			return actualKeys.sort();
		}

		const ordered: string[] = [];
		const unsorted: string[] = [];

		// First, add keys in saved order
		for (const key of savedOrder) {
			if (actualKeys.includes(key)) {
				ordered.push(key);
			}
		}

		// Then, add any new keys not in saved order
		for (const key of actualKeys) {
			if (!savedOrder.includes(key)) {
				unsorted.push(key);
			}
		}

		// Return saved order + new keys (alphabetically sorted)
		return [...ordered, ...unsorted.sort()];
	}

	private async saveColumnOrder(groupBy: string, order: string[]): Promise<void> {
		// Update in-memory state
		this.columnOrders[groupBy] = order;

		try {
			// Serialize to JSON
			const orderJson = JSON.stringify(this.columnOrders);

			// Save to config using BasesViewConfig API
			this.config.set('columnOrder', orderJson);
		} catch (error) {
			console.error('[KanbanView] Failed to save column order:', error);
		}
	}

	/**
	 * Get consistent card rendering options for all kanban cards
	 */
	private getCardOptions() {
		// Use UTC-anchored "today" for correct recurring task completion status
		const now = new Date();
		const targetDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
		return {
			targetDate,
		};
	}

	private registerBoardListeners(): void {
		// Task cards now handle their own events - no delegation needed
	}

	private unregisterBoardListeners(): void {
		// No listeners to unregister
	}

	private getTaskContextFromEvent(event: Event): { task: TaskInfo; card: HTMLElement } | null {
		const target = event.target as HTMLElement | null;
		if (!target) return null;
		const card = target.closest<HTMLElement>(".task-card");
		if (!card) return null;
		const wrapper = card.closest<HTMLElement>(".kanban-view__card-wrapper");
		if (!wrapper) return null;
		const path = wrapper.dataset.taskPath;
		if (!path) return null;
		const task = this.taskInfoCache.get(path);
		if (!task) return null;
		return { task, card };
	}

	private handleBoardClick = async (event: MouseEvent) => {
		const context = this.getTaskContextFromEvent(event);
		if (!context) return;

		const { task, card } = context;
		const target = event.target as HTMLElement;
		const actionEl = target.closest<HTMLElement>("[data-tn-action]");

		if (actionEl && actionEl !== card) {
			const action = actionEl.dataset.tnAction;
			if (action) {
				event.preventDefault();
				event.stopPropagation();
				await this.handleCardAction(action, task, actionEl, event);
				return;
			}
		}
	};

	private handleBoardContextMenu = async (event: MouseEvent) => {
		const context = this.getTaskContextFromEvent(event);
		if (!context) return;
		event.preventDefault();
		event.stopPropagation();

		const { showTaskContextMenu } = await import("../ui/TaskCard");
		await showTaskContextMenu(event, context.task.path, this.plugin, this.getTaskActionDate(context.task));
	};

	private async handleCardAction(
		action: string,
		task: TaskInfo,
		target: HTMLElement,
		event: MouseEvent
	): Promise<void> {
		// Import handlers dynamically to avoid circular dependencies
		const [
			{ DateContextMenu },
			{ PriorityContextMenu },
			{ RecurrenceContextMenu },
			{ ReminderModal },
			{ showTaskContextMenu }
		] = await Promise.all([
			import("../components/DateContextMenu"),
			import("../components/PriorityContextMenu"),
			import("../components/RecurrenceContextMenu"),
			import("../modals/ReminderModal"),
			import("../ui/TaskCard")
		]);

		switch (action) {
			case "toggle-status":
				await this.handleToggleStatus(task, event);
				return;
			case "priority-menu":
				this.showPriorityMenu(task, event, PriorityContextMenu);
				return;
			case "recurrence-menu":
				this.showRecurrenceMenu(task, event, RecurrenceContextMenu);
				return;
			case "reminder-menu":
				this.showReminderModal(task, ReminderModal);
				return;
			case "task-context-menu":
				await showTaskContextMenu(event, task.path, this.plugin, this.getTaskActionDate(task));
				return;
			case "edit-date":
				await this.openDateContextMenu(task, target.dataset.tnDateType as "due" | "scheduled" | undefined, event, DateContextMenu);
				return;
			case "toggle-subtasks":
				await this.handleToggleSubtasks(task, target);
				return;
			case "toggle-blocking-tasks":
				await this.handleToggleBlockingTasks(task, target);
				return;
		}
	}

	private async handleToggleStatus(task: TaskInfo, event: MouseEvent): Promise<void> {
		try {
			if (task.recurrence) {
				const actionDate = this.getTaskActionDate(task);
				await this.plugin.toggleRecurringTaskComplete(task, actionDate);
			} else {
				await this.plugin.toggleTaskStatus(task);
			}
		} catch (error) {
			console.error("[TaskNotes][KanbanView] Failed to toggle status", error);
		}
	}

	/**
	 * Determine the date to use when completing a recurring task from Bases.
	 * Prefers the task's scheduled (or due) date to avoid marking the wrong instance.
	 */
	private getTaskActionDate(task: TaskInfo): Date {
		const dateStr = getDatePart(task.scheduled || task.due || "");
		if (dateStr) {
			return parseDateToUTC(dateStr);
		}

		// Fallback to today's date, UTC-anchored to preserve local calendar day
		return createUTCDateFromLocalCalendarDate(new Date());
	}

	private showPriorityMenu(task: TaskInfo, event: MouseEvent, PriorityContextMenu: any): void {
		const menu = new PriorityContextMenu({
			currentValue: task.priority,
			onSelect: async (newPriority: any) => {
				try {
					await this.plugin.updateTaskProperty(task, "priority", newPriority);
				} catch (error) {
					console.error("[TaskNotes][KanbanView] Failed to update priority", error);
				}
			},
			plugin: this.plugin,
		});
		menu.show(event);
	}

	private showRecurrenceMenu(task: TaskInfo, event: MouseEvent, RecurrenceContextMenu: any): void {
		const menu = new RecurrenceContextMenu({
			currentValue: typeof task.recurrence === "string" ? task.recurrence : undefined,
			currentAnchor: task.recurrence_anchor || 'scheduled',
			onSelect: async (newRecurrence: string | null, anchor?: 'scheduled' | 'completion') => {
				try {
					await this.plugin.updateTaskProperty(task, "recurrence", newRecurrence || undefined);
					if (anchor !== undefined) {
						await this.plugin.updateTaskProperty(task, "recurrence_anchor", anchor);
					}
				} catch (error) {
					console.error("[TaskNotes][KanbanView] Failed to update recurrence", error);
				}
			},
			app: this.plugin.app,
			plugin: this.plugin,
		});
		menu.show(event);
	}

	private showReminderModal(task: TaskInfo, ReminderModal: any): void {
		const modal = new ReminderModal(this.plugin.app, this.plugin, task, async (reminders: any) => {
			try {
				await this.plugin.updateTaskProperty(task, "reminders", reminders.length > 0 ? reminders : undefined);
			} catch (error) {
				console.error("[TaskNotes][KanbanView] Failed to update reminders", error);
			}
		});
		modal.open();
	}

	private async openDateContextMenu(
		task: TaskInfo,
		dateType: "due" | "scheduled" | undefined,
		event: MouseEvent,
		DateContextMenu: any
	): Promise<void> {
		if (!dateType) return;

		const { getDatePart, getTimePart } = await import("../utils/dateUtils");
		const currentValue = dateType === "due" ? task.due : task.scheduled;

		const menu = new DateContextMenu({
			currentValue: getDatePart(currentValue || ""),
			currentTime: getTimePart(currentValue || ""),
			onSelect: async (dateValue: string, timeValue: string) => {
				try {
					let finalValue: string | undefined;
					if (!dateValue) {
						finalValue = undefined;
					} else if (timeValue) {
						finalValue = `${dateValue}T${timeValue}`;
					} else {
						finalValue = dateValue;
					}
					await this.plugin.updateTaskProperty(task, dateType, finalValue);
				} catch (error) {
					console.error("[TaskNotes][KanbanView] Failed to update date", error);
				}
			},
			plugin: this.plugin,
			app: this.app || this.plugin.app,
		});
		menu.show(event);
	}

	private async handleToggleSubtasks(task: TaskInfo, chevronElement: HTMLElement): Promise<void> {
		const { toggleSubtasks } = await import("../ui/TaskCard");
		const card = chevronElement.closest<HTMLElement>(".task-card");
		if (!card) return;

		// Toggle expansion state
		const isExpanded = this.plugin.expandedProjectsService?.isExpanded(task.path) || false;
		const newExpanded = !isExpanded;

		if (newExpanded) {
			this.plugin.expandedProjectsService?.setExpanded(task.path, true);
		} else {
			this.plugin.expandedProjectsService?.setExpanded(task.path, false);
		}

		// Update chevron rotation
		chevronElement.classList.toggle("is-rotated", newExpanded);

		// Toggle subtasks display
		await toggleSubtasks(card, task, this.plugin, newExpanded);
	}

	private async handleToggleBlockingTasks(task: TaskInfo, toggleElement: HTMLElement): Promise<void> {
		const { toggleBlockingTasks } = await import("../ui/TaskCard");
		const card = toggleElement.closest<HTMLElement>(".task-card");
		if (!card) return;

		// Toggle expansion state via CSS class
		const expanded = toggleElement.classList.toggle("task-card__blocking-toggle--expanded");

		// Toggle blocking tasks display
		await toggleBlockingTasks(card, task, this.plugin, expanded);
	}

	private destroyColumnScrollers(): void {
		for (const scroller of this.columnScrollers.values()) {
			scroller.destroy();
		}
		this.columnScrollers.clear();
	}

	/**
	 * Component lifecycle: Called when component is unloaded.
	 * Override from Component base class.
	 */
	onunload(): void {
		// Component.register() calls will be automatically cleaned up
		// We just need to clean up view-specific state
		this.unregisterBoardListeners();
		this.destroyColumnScrollers();
		this.currentTaskElements.clear();
		this.taskInfoCache.clear();
		this.boardEl = null;
	}
}

/**
 * Factory function for Bases registration.
 * Returns an actual KanbanView instance (extends BasesView).
 */
export function buildKanbanViewFactory(plugin: TaskNotesPlugin) {
	return function (controller: any, containerEl: HTMLElement): KanbanView {
		if (!containerEl) {
			console.error("[TaskNotes][KanbanView] No containerEl provided");
			throw new Error("KanbanView requires a containerEl");
		}

		// Create and return the view instance directly
		// KanbanView now properly extends BasesView, so Bases can call its methods directly
		return new KanbanView(controller, containerEl, plugin);
	};
}
