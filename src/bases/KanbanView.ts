/* eslint-disable @typescript-eslint/no-non-null-assertion -- Legacy Bases view rendering narrows DOM references through lifecycle checks. */
import { Notice, Platform, setIcon, setTooltip, TFile } from "obsidian";
import type { BasesView, BasesViewFactory } from "obsidian";
import TaskNotesPlugin from "../main";
import { BasesViewBase } from "./BasesViewBase";
import type { StatusConfig, TaskInfo } from "../types";
import { identifyTaskNotesFromBasesData } from "./helpers";
import { createTaskCard, showTaskContextMenu, type TaskCardOptions } from "../ui/TaskCard";
import { renderGroupTitle } from "./groupTitleRenderer";
import { type LinkServices } from "../ui/renderers/linkRenderer";
import { showConfirmationModal } from "../modals/ConfirmationModal";
import { VirtualScroller } from "../utils/VirtualScroller";
import { getCurrentTimestamp } from "../utils/dateUtils";
import { getProjectDisplayName } from "../utils/linkUtils";
import { stringifyUnknown } from "../utils/stringUtils";
import {
	stripPropertyPrefix,
	isSortOrderInSortConfig,
	prepareSortOrderUpdate,
	applySortOrderPlan,
	DropOperationQueue,
	type SortOrderPlan,
} from "./sortOrderUtils";
import {
	applySortOrderUpdatesToItems,
	applySortOrderUpdatesToTaskCache,
	buildSortOrderUpdateMap,
	movePathsRelativeToTarget,
} from "./manualOrderState";
import { getKanbanTaskActionDate, handleKanbanCardAction } from "./kanbanCardActions";
import { clearStaticStyleClasses } from "../utils/staticStyleClasses";
import { setElementDragImage } from "../utils/dragImage";
import {
	applyKanbanTaskDropFrontmatterPlan,
	createKanbanDropTarget,
	getKanbanCardDropTargetFromClientY,
	getKanbanDraggedPaths,
	kanbanDropPlanNeedsWrite,
	performKanbanOptimisticReorder,
	planKanbanDropSideEffect,
	planKanbanStatusDerivativeUpdate,
	planKanbanTaskDropUpdate,
	reconstructKanbanDropTargetFromContainer,
	resolveKanbanContainerDropTarget,
	resolveNestedTaskCardDragSource,
	type KanbanDropTarget,
	type KanbanTaskDragSource,
} from "./kanbanDragUtils";
import {
	buildBasesPathProperties,
	computeBasesFormulas,
	isObsidianListProperty,
} from "./basesViewAdapters";
import { applyKanbanCreationDefault } from "./kanbanCreationDefaults";
import { coerceGroupKeyForFrontmatter as coercePropertyGroupKeyForFrontmatter } from "./propertyValueCoercion";
import {
	buildKanbanTaskGroups,
	applyKanbanColumnOrder,
	applyKanbanSwimLaneOrder,
	applyKanbanSwimLaneOrderToMap,
	buildKanbanSwimlaneColumns,
	canonicalizeKanbanConfiguredGroupKey,
	findKanbanStatusConfigForGroupKey,
	formatKanbanColumnCount,
	getKanbanColumnTaskCounts,
	getKanbanListPropertyValue,
	getKanbanStatusGroupKeyAliases,
	getKanbanSwimLaneKeys,
	isKanbanListTypeProperty,
	isKanbanPriorityGroupingProperty,
	isKanbanStatusGroupingProperty,
	normalizeKanbanOrderConfig,
	normalizeKanbanWipLimitsConfig,
	normalizePinnedColumnConfig,
	shouldRenderKanbanColumn,
} from "./kanbanGrouping";

export {
	addPinnedColumnGroups,
	formatKanbanColumnCount,
	normalizeKanbanWipLimitsConfig,
	normalizePinnedColumnConfig,
	orderColumnsWithPinnedColumns,
	shouldRenderKanbanColumn,
} from "./kanbanGrouping";

type KanbanDataAdapterWithView = {
	basesView: KanbanView;
};

type KanbanControllerView = {
	name?: string;
	groupBy?: string | { property?: string };
};

type KanbanController = {
	query?: { views?: KanbanControllerView[] };
	viewName?: string;
};

type VirtualScrollerWithContainer = {
	scrollContainer?: HTMLElement;
};

type KanbanEphemeralState = {
	scrollTop?: unknown;
	columnScroll?: unknown;
};

type KanbanDropExecutionOptions = {
	optimisticReorderApplied?: boolean;
	draggedPaths?: readonly string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isKanbanEphemeralState(value: unknown): value is KanbanEphemeralState {
	return isRecord(value);
}

function getColumnScrollState(state: KanbanEphemeralState): Record<string, number> | null {
	if (!isRecord(state.columnScroll)) {
		return null;
	}
	const result: Record<string, number> = {};
	for (const [key, value] of Object.entries(state.columnScroll)) {
		if (typeof value === "number") {
			result[key] = value;
		}
	}
	return result;
}

function normalizeExpandedRelationshipFilterMode(value: unknown): "inherit" | "show-all" {
	if (typeof value === "number") {
		return value === 1 ? "show-all" : "inherit";
	}

	const normalized = stringifyUnknown(value)
		.trim()
		.toLowerCase()
		.replace(/^['"]|['"]$/g, "")
		.replace(/[_\s]+/g, "-");

	if (normalized === "show-all" || normalized === "1") {
		return "show-all";
	}

	if (normalized === "inherit" || normalized === "0") {
		return "inherit";
	}

	return "inherit";
}

type TouchDetectionNavigator = Pick<Navigator, "maxTouchPoints">;
type TouchDetectionWindow = Pick<Window, "matchMedia">;

export function shouldEnableKanbanTouchDrag(
	isMobile: boolean,
	navigatorLike: TouchDetectionNavigator | null | undefined = navigator,
	windowLike: TouchDetectionWindow | null | undefined = window
): boolean {
	if (isMobile) {
		return true;
	}

	if (typeof navigatorLike?.maxTouchPoints === "number" && navigatorLike.maxTouchPoints > 0) {
		return true;
	}

	return Boolean(
		windowLike?.matchMedia?.("(any-pointer: coarse)")?.matches ||
			windowLike?.matchMedia?.("(pointer: coarse)")?.matches
	);
}

function normalizeKanbanCardLayout(value: unknown): TaskCardOptions["layout"] {
	return value === "compact" ? "compact" : "default";
}

export class KanbanView extends BasesViewBase {
	type = "tasknotesKanban";

	private boardEl: HTMLElement | null = null;
	private basesController: KanbanController; // Store controller for accessing query.views
	private currentTaskElements = new Map<string, HTMLElement>();
	private draggedTaskPath: string | null = null;
	private draggedTaskPaths: string[] = []; // For batch drag operations
	private draggedFromColumn: string | null = null; // Track source column for list property handling
	private draggedFromSwimlane: string | null = null; // Track source swimlane for list property handling
	private dropTargetPath: string | null = null; // Card-level drop position tracking
	private pendingRender = false; // Deferred render while dragging
	private dropAbove = true; // Whether drop is above or below target card
	private dragOverRafId = 0; // rAF handle for throttled dragover
	private dragContainer: HTMLElement | null = null; // Container holding siblings during drag
	private currentInsertionIndex = -1; // Current gap/slot position
	private dragSourceColumnEl: HTMLElement | null = null; // Source column element (height-locked during drag)
	private dragTargetColumnEl: HTMLElement | null = null; // Target column element (max-height expanded during drag)
	private activeDragSourceElement: HTMLElement | null = null;
	private floatingDragPreviewEl: HTMLElement | null = null;
	private floatingDragPreviewDocument: Document | null = null;
	private floatingDragPreviewMoveHandler: ((event: DragEvent) => void) | null = null;
	private floatingDragPreviewRafId: number | null = null;
	private floatingDragPreviewWidth = 280;
	private floatingDragPreviewHeight = 40;
	private floatingDragPreviewPendingX = 0;
	private floatingDragPreviewPendingY = 0;
	private draggedSourceColumns: Map<string, string> = new Map(); // Track source column per task for batch operations
	private draggedSourceSwimlanes: Map<string, string> = new Map(); // Track source swimlane per task for batch operations
	private taskInfoCache = new Map<string, TaskInfo>();
	private sortScopeTaskPaths = new Map<string, string[]>();
	private sortScopeCandidateTaskPaths = new Map<string, string[]>();
	private containerListenersRegistered = false;
	private columnScrollers = new Map<string, VirtualScroller<TaskInfo>>(); // columnKey -> scroller
	private expandedRelationshipFilterMode: TaskCardOptions["expandedRelationshipFilterMode"] =
		"inherit";
	private currentVisibleTaskPaths = new Set<string>();
	private currentVisibleTaskOrder = new Map<string, number>();
	private suppressRenderUntil = 0;
	private postDropTimer: number | null = null;
	private dropQueue = new DropOperationQueue();
	private activeDropCount = 0;
	private postDropRefreshRequested = false;

	// Touch drag state for mobile
	private touchDragActive = false;
	private touchDragGhost: HTMLElement | null = null;
	private touchStartX = 0;
	private touchStartY = 0;
	private longPressTimer: number | null = null;
	private autoScrollTimer: number | null = null;
	private autoScrollDirection = 0;
	private readonly LONG_PRESS_DELAY = 350;
	private readonly TOUCH_MOVE_THRESHOLD = 10;
	private readonly AUTO_SCROLL_EDGE = 60;
	private readonly AUTO_SCROLL_SPEED = 8;
	private touchDragType: "task" | "column" | null = null;
	private draggedColumnKey: string | null = null;
	private boundContextMenuBlocker = (e: Event) => {
		e.preventDefault();
		e.stopPropagation();
	};
	private readonly LARGE_REORDER_WARNING_THRESHOLD = 10;

	// View options (accessed via BasesViewConfig)
	private swimLanePropertyId: string | null = null;
	private columnWidth = 280;
	private maxSwimlaneHeight = 600;
	private hideEmptyColumns = false;
	private explodeListColumns = true; // Show items with list properties in multiple columns
	private consolidateStatusIcon = false; // Show status icon in header only when grouped by status
	private columnOrders: Record<string, string[]> = {};
	private pinnedColumns: string[] = [];
	private wipLimits: Record<string, number> = {};
	private swimLaneOrders: Record<string, string[]> = {};
	private hideEmptySwimLanes = false;
	private cardLayout: TaskCardOptions["layout"] = "default";
	private configLoaded = false; // Track if we've successfully loaded config
	/**
	 * Threshold for enabling virtual scrolling in kanban columns/swimlane cells.
	 * Virtual scrolling activates when a column or cell has >= 15 cards.
	 * Lower than TaskListView (100) because kanban cards are typically larger with more
	 * visible properties, and columns are narrower (more constrained viewport).
	 * Benefits: ~85% memory reduction, smooth 60fps scrolling for columns with 200+ cards.
	 */
	private readonly VIRTUAL_SCROLL_THRESHOLD = 15;

	constructor(controller: unknown, containerEl: HTMLElement, plugin: TaskNotesPlugin) {
		super(controller, containerEl, plugin);
		this.basesController = controller as KanbanController; // Store for groupBy detection
		// BasesView now provides this.data, this.config, and this.app directly
		(this.dataAdapter as unknown as KanbanDataAdapterWithView).basesView = this;
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
		// During drag: defer render (destroying DOM kills drop events)
		if (this.draggedTaskPath) {
			this.debugLog("ON-DATA-UPDATED: deferred (drag active)", {
				draggedTask: this.draggedTaskPath.split("/").pop(),
			});
			this.pendingRender = true;
			return;
		}

		// Post-drop suppression: skip renders until metadataCache has settled.
		// postDropTimer will fire the guaranteed render.
		if (this.activeDropCount > 0 || Date.now() < this.suppressRenderUntil) {
			this.debugLog("ON-DATA-UPDATED: suppressed", {
				activeDropCount: this.activeDropCount,
				msRemaining: this.suppressRenderUntil - Date.now(),
			});
			return;
		}

		// If we're past the suppression window and Bases fires naturally,
		// cancel postDropTimer — Bases has fresh data, render now.
		if (this.postDropTimer) {
			this.debugLog(
				"ON-DATA-UPDATED: cancelling postDropTimer, rendering with fresh Bases data"
			);
			window.clearTimeout(this.postDropTimer);
			this.postDropTimer = null;
		} else {
			this.debugLog("ON-DATA-UPDATED: normal render (no suppression active)");
		}

		const savedState = this.getEphemeralState();
		try {
			void this.render();
		} catch (error) {
			console.error(`[TaskNotes][${this.type}] Render error:`, error);
			this.renderError(error as Error);
		}
		this.setEphemeralState(savedState);
	}

	/**
	 * Read view configuration options from BasesViewConfig.
	 */
	private readViewOptions(): void {
		// Guard: config may not be set yet if called too early
		if (!this.config || typeof this.config.get !== "function") {
			return;
		}

		try {
			this.swimLanePropertyId = this.config.getAsPropertyId("swimLane");
			this.columnWidth = (this.config.get("columnWidth") as number) || 280;
			this.maxSwimlaneHeight = (this.config.get("maxSwimlaneHeight") as number) || 600;
			this.hideEmptyColumns = (this.config.get("hideEmptyColumns") as boolean) || false;

			// Read explodeListColumns option (defaults to true)
			const explodeValue = this.config.get("explodeListColumns");
			this.explodeListColumns = explodeValue !== false; // Default to true if not set

			// Read consolidateStatusIcon option (defaults to false)
			const consolidateValue = this.config.get("consolidateStatusIcon");
			this.consolidateStatusIcon = consolidateValue === true; // Default to false if not set

			// Read column orders
			this.columnOrders = normalizeKanbanOrderConfig(this.config.get("columnOrder"));
			this.pinnedColumns = normalizePinnedColumnConfig(this.config.get("pinnedColumns"));
			this.wipLimits = normalizeKanbanWipLimitsConfig(this.config.get("wipLimits"));

			// Read swimlane orders. Support both the public singular key and the
			// originally proposed plural key for manually-authored Bases YAML.
			this.swimLaneOrders = normalizeKanbanOrderConfig(
				this.config.get("swimLaneOrder") ?? this.config.get("swimLaneOrders")
			);
			this.hideEmptySwimLanes = this.config.get("hideEmptySwimLanes") === true;
			this.cardLayout = normalizeKanbanCardLayout(this.config.get("cardLayout"));

			// Read enableSearch toggle (default: false for backward compatibility)
			const enableSearchValue = this.config.get("enableSearch");
			this.enableSearch = (enableSearchValue as boolean) ?? false;
			const expandedRelationshipFilterModeValue = this.config.get(
				"expandedRelationshipFilterMode"
			);
			this.expandedRelationshipFilterMode = normalizeExpandedRelationshipFilterMode(
				expandedRelationshipFilterModeValue
			);

			// Mark config as successfully loaded
			this.configLoaded = true;
		} catch (e) {
			// Use defaults
			console.warn("[KanbanView] Failed to parse config:", e);
		}
	}

	/**
	 * Save ephemeral state including scroll positions for all columns.
	 * This preserves scroll position when the view is re-rendered (e.g., after task updates).
	 */
	getEphemeralState(): unknown {
		const columnScroll: Record<string, number> = {};

		// Save scroll position for virtual scrolling columns (from VirtualScroller)
		for (const [columnKey, scroller] of this.columnScrollers) {
			const scrollContainer = (scroller as unknown as VirtualScrollerWithContainer)
				.scrollContainer;
			if (scrollContainer) {
				columnScroll[columnKey] = scrollContainer.scrollTop;
			}
		}

		// Save scroll position for non-virtual columns (direct DOM elements)
		if (this.boardEl) {
			const columns = this.boardEl.querySelectorAll(".kanban-view__column");
			columns.forEach((column) => {
				const groupKey = column.getAttribute("data-group");
				const cardsContainer = column.querySelector(".kanban-view__cards") as HTMLElement;
				if (groupKey && cardsContainer && !(groupKey in columnScroll)) {
					columnScroll[groupKey] = cardsContainer.scrollTop;
				}
			});

			// Also save swimlane cell scroll positions (class is kanban-view__swimlane-column)
			const swimlaneCells = this.boardEl.querySelectorAll(".kanban-view__swimlane-column");
			swimlaneCells.forEach((cell) => {
				const columnKey = cell.getAttribute("data-column");
				const swimlaneKey = cell.getAttribute("data-swimlane");
				if (columnKey && swimlaneKey) {
					const cellKey = `${swimlaneKey}:${columnKey}`;
					const tasksContainer = cell.querySelector(
						".kanban-view__tasks-container"
					) as HTMLElement;
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
	setEphemeralState(state: unknown): void {
		if (!isKanbanEphemeralState(state)) return;
		const columnScroll = getColumnScrollState(state);

		// Restore board-level horizontal scroll
		if (typeof state.scrollTop === "number" && this.rootElement) {
			const scrollTop = state.scrollTop;
			window.requestAnimationFrame(() => {
				if (this.rootElement && this.rootElement.isConnected) {
					this.rootElement.scrollTop = scrollTop;
				}
			});
		}

		// Restore column scroll positions after render completes
		if (columnScroll) {
			// Use requestAnimationFrame to ensure DOM and VirtualScrollers are ready
			window.requestAnimationFrame(() => {
				// Restore virtual scroller positions
				for (const [columnKey, scroller] of this.columnScrollers) {
					const scrollTop = columnScroll[columnKey];
					if (scrollTop !== undefined) {
						const scrollContainer = (
							scroller as unknown as VirtualScrollerWithContainer
						).scrollContainer;
						if (scrollContainer) {
							scrollContainer.scrollTop = scrollTop;
						}
					}
				}

				// Restore non-virtual column positions
				if (this.boardEl) {
					const columns = this.boardEl.querySelectorAll(".kanban-view__column");
					columns.forEach((column) => {
						const groupKey = column.getAttribute("data-group");
						if (groupKey && columnScroll[groupKey] !== undefined) {
							const cardsContainer = column.querySelector(
								".kanban-view__cards"
							) as HTMLElement;
							if (cardsContainer && !this.columnScrollers.has(groupKey)) {
								cardsContainer.scrollTop = columnScroll[groupKey];
							}
						}
					});

					// Restore swimlane cell positions (class is kanban-view__swimlane-column)
					const swimlaneCells = this.boardEl.querySelectorAll(
						".kanban-view__swimlane-column"
					);
					swimlaneCells.forEach((cell) => {
						const columnKey = cell.getAttribute("data-column");
						const swimlaneKey = cell.getAttribute("data-swimlane");
						if (columnKey && swimlaneKey) {
							const cellKey = `${swimlaneKey}:${columnKey}`;
							if (columnScroll[cellKey] !== undefined) {
								const tasksContainer = cell.querySelector(
									".kanban-view__tasks-container"
								) as HTMLElement;
								if (tasksContainer && !this.columnScrollers.has(cellKey)) {
									tasksContainer.scrollTop = columnScroll[cellKey];
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

		this.debugLog("RENDER-START", {
			activeDropCount: this.activeDropCount,
			suppressRenderRemaining: Math.max(0, this.suppressRenderUntil - Date.now()),
			draggedTaskPath: this.draggedTaskPath?.split("/").pop() || null,
			currentTaskElementsCount: this.currentTaskElements.size,
		});

		// Always re-read view options to catch config changes (e.g., toggling consolidateStatusIcon)
		if (this.config) {
			this.readViewOptions();
		}

		// Now that config is loaded, setup search (idempotent: will only create once)
		if (this.rootElement) {
			this.setupSearch(this.rootElement);
		}

		try {
			const dataItems = this.dataAdapter.extractDataItems();

			// Compute formulas before reading formula-based properties (swimlanes, etc.)
			computeBasesFormulas(this.data, dataItems);

			const taskNotes = await identifyTaskNotesFromBasesData(dataItems, this.plugin);

			// Apply search filter
			const filteredTasks = this.applySearchFilter(taskNotes);
			this.setCurrentVisibleTaskPaths(filteredTasks);

			// Clear board and cleanup scrollers
			this.destroyColumnScrollers();
			this.boardEl.empty();
			this.sortScopeTaskPaths.clear();
			this.sortScopeCandidateTaskPaths.clear();

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
			const pathToProps = buildBasesPathProperties(this.dataAdapter.extractDataItems());

			// Determine groupBy property ID
			const groupByPropertyId = this.getGroupByPropertyId();

			if (!groupByPropertyId) {
				// No groupBy - show error
				this.renderNoGroupByError();
				return;
			}

			// Group tasks
			const groups = this.groupTasks(filteredTasks, groupByPropertyId, pathToProps);
			const allGroups = this.groupTasks(taskNotes, groupByPropertyId, pathToProps);

			// Render swimlanes if configured
			if (this.swimLanePropertyId) {
				await this.renderWithSwimLanes(
					groups,
					filteredTasks,
					allGroups,
					taskNotes,
					pathToProps,
					groupByPropertyId
				);
			} else {
				await this.renderFlat(groups, allGroups);
			}
		} catch (error: unknown) {
			console.error("[TaskNotes][KanbanView] Error rendering:", error);
			this.renderError(error instanceof Error ? error : new Error(String(error)));
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

			for (let i = 0; i < views.length; i++) {
				const view = views[i];
				if (view && view.name === viewName) {
					if (view.groupBy) {
						if (typeof view.groupBy === "object" && view.groupBy.property) {
							return view.groupBy.property;
						} else if (typeof view.groupBy === "string") {
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

	private getSortScopeKey(groupKey: string, swimLaneKey: string | null = null): string {
		return swimLaneKey === null ? groupKey : `${swimLaneKey}::${groupKey}`;
	}

	private getColumnScrollerKey(groupKey: string, swimLaneKey: string | null = null): string {
		return swimLaneKey === null ? groupKey : `${swimLaneKey}:${groupKey}`;
	}

	private getVisibleSortScopePaths(
		groupKey: string,
		swimLaneKey: string | null = null
	): string[] | undefined {
		return this.sortScopeTaskPaths.get(this.getSortScopeKey(groupKey, swimLaneKey));
	}

	private getCandidateSortScopePaths(
		groupKey: string,
		swimLaneKey: string | null = null
	): string[] | undefined {
		return this.sortScopeCandidateTaskPaths.get(this.getSortScopeKey(groupKey, swimLaneKey));
	}

	private setSortScopePathsForScope(
		groupKey: string,
		swimLaneKey: string | null,
		paths: readonly string[]
	): void {
		this.sortScopeTaskPaths.set(this.getSortScopeKey(groupKey, swimLaneKey), [...paths]);
	}

	private hasVirtualScrollerForScope(groupKey: string, swimLaneKey: string | null): boolean {
		return this.columnScrollers.has(this.getColumnScrollerKey(groupKey, swimLaneKey));
	}

	private canFastPatchManualOrderDrop(
		options: KanbanDropExecutionOptions,
		dropTarget: KanbanDropTarget | undefined,
		pathsToUpdate: readonly string[],
		groupKey: string,
		swimLaneKey: string | null
	): boolean {
		const hasVirtualScroller = this.hasVirtualScrollerForScope(groupKey, swimLaneKey);
		return (
			!!dropTarget &&
			pathsToUpdate.length === 1 &&
			(options.draggedPaths?.length ?? 1) === 1 &&
			(options.optimisticReorderApplied === true || hasVirtualScroller)
		);
	}

	private setSortScopeCandidatePaths(entries: Iterable<[string, string[]]>): void {
		this.sortScopeCandidateTaskPaths.clear();
		for (const [scopeKey, paths] of entries) {
			this.sortScopeCandidateTaskPaths.set(scopeKey, [...paths]);
		}
	}

	private getCurrentVisibleTaskPathOrder(): string[] {
		return Array.from(this.currentVisibleTaskOrder.entries())
			.sort(([, leftIndex], [, rightIndex]) => leftIndex - rightIndex)
			.map(([path]) => path);
	}

	private setCurrentVisibleTaskPathOrder(paths: readonly string[]): void {
		this.currentVisibleTaskPaths.clear();
		this.currentVisibleTaskOrder.clear();
		paths.forEach((path, index) => {
			this.currentVisibleTaskPaths.add(path);
			this.currentVisibleTaskOrder.set(path, index);
		});
	}

	private applyOptimisticSortOrderResult(
		draggedPath: string,
		targetPath: string,
		above: boolean,
		groupKey: string,
		swimLaneKey: string | null,
		sortOrderPlan: SortOrderPlan
	): boolean {
		const scopePaths = this.getVisibleSortScopePaths(groupKey, swimLaneKey);
		if (!scopePaths) {
			return false;
		}

		const nextScopePaths = movePathsRelativeToTarget(
			scopePaths,
			[draggedPath],
			targetPath,
			above
		);
		if (!nextScopePaths) {
			return false;
		}

		const visiblePaths = this.getCurrentVisibleTaskPathOrder();
		const nextVisiblePaths = movePathsRelativeToTarget(
			visiblePaths,
			[draggedPath],
			targetPath,
			above
		);
		if (!nextVisiblePaths) {
			return false;
		}

		const scroller = this.columnScrollers.get(this.getColumnScrollerKey(groupKey, swimLaneKey));
		if (scroller) {
			const reordered = scroller.reorderItems({
				movedKeys: [draggedPath],
				targetKey: targetPath,
				position: above ? "before" : "after",
			});
			if (!reordered) {
				return false;
			}
		}

		const sortOrdersByPath = buildSortOrderUpdateMap(draggedPath, sortOrderPlan);
		applySortOrderUpdatesToTaskCache(this.taskInfoCache, sortOrdersByPath);
		if (scroller) {
			applySortOrderUpdatesToItems(
				scroller.getItems(),
				(task) => task,
				sortOrdersByPath,
				(task) => {
					this.taskInfoCache.set(task.path, task);
				}
			);
			scroller.invalidateItems([...sortOrdersByPath.keys()]);
		}
		this.setSortScopePathsForScope(groupKey, swimLaneKey, nextScopePaths);
		this.setCurrentVisibleTaskPathOrder(nextVisiblePaths);
		return true;
	}

	private async confirmLargeReorder(
		editCount: number,
		groupKey: string,
		swimLaneKey: string | null
	): Promise<boolean> {
		const sortOrderField = this.plugin.settings.fieldMapping.sortOrder;
		const scopeLabel =
			swimLaneKey === null
				? this.plugin.i18n.translate("views.kanban.reorder.scope.column", {
						group: groupKey,
					})
				: this.plugin.i18n.translate("views.kanban.reorder.scope.columnInSwimlane", {
						group: groupKey,
						swimlane: swimLaneKey,
					});

		return showConfirmationModal(this.plugin.app, {
			title: this.plugin.i18n.translate("common.reorder.confirmLargeTitle"),
			message: this.plugin.i18n.translate("common.reorder.confirmLargeMessage", {
				field: sortOrderField,
				count: editCount,
				scope: scopeLabel,
			}),
			confirmText: this.plugin.i18n.translate("common.reorder.confirmButton"),
			cancelText: this.plugin.i18n.translate("common.cancel"),
		});
	}

	private groupTasks(
		taskNotes: TaskInfo[],
		groupByPropertyId: string,
		pathToProps: Map<string, Record<string, unknown>>
	): Map<string, TaskInfo[]> {
		const sortOrderField = this.plugin.settings.fieldMapping.sortOrder;
		return buildKanbanTaskGroups({
			taskNotes,
			groupByPropertyId,
			pathToProps,
			explodeListColumns: this.explodeListColumns,
			groupedData: this.dataAdapter.getGroupedData(),
			convertGroupKeyToString: (key) => this.dataAdapter.convertGroupKeyToString(key),
			isListTypeProperty: (propertyName) => this.isListTypeProperty(propertyName),
			getListPropertyValue: (task, propertyName) =>
				this.getListPropertyValue(task, propertyName, pathToProps),
			canonicalizeGroupKey: (groupKey, propertyId) =>
				this.canonicalizeConfiguredGroupKey(groupKey, propertyId),
			sortOrderValues: isSortOrderInSortConfig(this.dataAdapter, sortOrderField)
				? this.getSortOrderValues(taskNotes, sortOrderField)
				: undefined,
			statusConfigs: this.plugin.settings.customStatuses || [],
			priorityConfigs:
				this.plugin.priorityManager?.getAllPriorities?.() ||
				this.plugin.settings.customPriorities ||
				[],
			isStatusGroupingProperty: (propertyId) => this.isStatusGroupingProperty(propertyId),
			isPriorityGroupingProperty: (propertyId) => this.isPriorityGroupingProperty(propertyId),
			getStatusGroupKeyAliases: (statusConfig) =>
				this.getStatusGroupKeyAliases(statusConfig),
			pinnedColumns: this.pinnedColumns,
		});
	}

	private getSortOrderValues(
		taskNotes: readonly TaskInfo[],
		sortOrderField: string
	): Map<string, unknown> {
		const sortOrderValues = new Map<string, unknown>();

		for (const task of taskNotes) {
			const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
			const frontmatter =
				file instanceof TFile
					? this.plugin.app.metadataCache.getFileCache(file)?.frontmatter
					: undefined;
			const sortOrder = frontmatter?.[sortOrderField];
			if (sortOrder != null) {
				sortOrderValues.set(task.path, sortOrder);
			}
		}

		return sortOrderValues;
	}

	/**
	 * Check if a property is a list-type that should show tasks in multiple columns.
	 * Uses Obsidian's metadataTypeManager to dynamically detect property types.
	 */
	private isListTypeProperty(propertyName: string): boolean {
		return isKanbanListTypeProperty(
			propertyName,
			{
				contextsField: this.plugin.fieldMapper.toUserField("contexts"),
				projectsField: this.plugin.fieldMapper.toUserField("projects"),
			},
			(name) => isObsidianListProperty(this.plugin.app, name)
		);
	}

	/**
	 * Get the value of a list property from a task.
	 * Tries TaskInfo properties first (already properly mapped), then falls back to pathToProps.
	 */
	private getListPropertyValue(
		task: TaskInfo,
		propertyName: string,
		pathToProps: Map<string, Record<string, unknown>>
	): unknown {
		return getKanbanListPropertyValue(task, propertyName, pathToProps, {
			contextsField: this.plugin.fieldMapper.toUserField("contexts"),
			projectsField: this.plugin.fieldMapper.toUserField("projects"),
		});
	}

	private getSwimLaneKeys(
		task: TaskInfo,
		pathToProps: Map<string, Record<string, unknown>>
	): string[] {
		return getKanbanSwimLaneKeys({
			task,
			pathToProps,
			swimLanePropertyId: this.swimLanePropertyId,
			explodeListColumns: this.explodeListColumns,
			isListTypeProperty: (propertyName) => this.isListTypeProperty(propertyName),
			getListPropertyValue: (sourceTask, propertyName) =>
				this.getListPropertyValue(sourceTask, propertyName, pathToProps),
			canonicalizeGroupKey: (groupKey, propertyId) =>
				this.canonicalizeConfiguredGroupKey(groupKey, propertyId),
		});
	}

	private isStatusGroupingProperty(propertyId: string): boolean {
		return isKanbanStatusGroupingProperty(
			propertyId,
			this.plugin.fieldMapper.toUserField("status")
		);
	}

	private isPriorityGroupingProperty(propertyId: string): boolean {
		return isKanbanPriorityGroupingProperty(
			propertyId,
			this.plugin.fieldMapper.toUserField("priority")
		);
	}

	private canonicalizeConfiguredGroupKey(groupKey: string, propertyId: string): string {
		const statusField = this.plugin.fieldMapper.toUserField("status");
		const priorityField = this.plugin.fieldMapper.toUserField("priority");
		return canonicalizeKanbanConfiguredGroupKey({
			groupKey,
			propertyId,
			fields: {
				statusField,
				priorityField,
			},
			statuses: isKanbanStatusGroupingProperty(propertyId, statusField)
				? this.plugin.statusManager?.getAllStatuses?.() || []
				: [],
			normalizeStatusValue: (value) =>
				this.plugin.statusManager?.normalizeStatusValue?.(value) ?? value,
			normalizePriorityValue: (value) =>
				this.plugin.priorityManager?.normalizePriorityValue?.(value) ?? value,
			getStatusGroupKeyAliases: (statusConfig) =>
				this.getStatusGroupKeyAliases(statusConfig),
		});
	}

	private findStatusConfigForGroupKey(groupKey: string): StatusConfig | undefined {
		return findKanbanStatusConfigForGroupKey(
			groupKey,
			this.plugin.statusManager?.getAllStatuses?.() || [],
			(value) => this.plugin.statusManager?.normalizeStatusValue?.(value) ?? value,
			(statusConfig) => this.getStatusGroupKeyAliases(statusConfig)
		);
	}

	private getStatusGroupKeyAliases(statusConfig: StatusConfig): Set<string> {
		return getKanbanStatusGroupKeyAliases(statusConfig, (value) =>
			getProjectDisplayName(value, this.plugin.app)
		);
	}

	private isUnknownStatusGroup(groupKey: string, groupByPropertyId: string | null): boolean {
		if (!groupByPropertyId || !this.isStatusGroupingProperty(groupByPropertyId)) {
			return false;
		}

		const normalizedGroupKey = groupKey.trim();
		if (!normalizedGroupKey || normalizedGroupKey === "None") {
			return false;
		}

		return !this.findStatusConfigForGroupKey(normalizedGroupKey);
	}

	private markUnknownStatusColumn(element: HTMLElement, groupKey: string): void {
		element.addClass("kanban-view__column--unknown-status");
		element.setAttribute("data-unknown-status", groupKey);
		setTooltip(element, "Status is not defined in TaskNotes settings");
	}

	private markUnknownStatusColumnHeader(element: HTMLElement, groupKey: string): void {
		element.addClass("kanban-view__column-header--unknown-status");
		element.setAttribute("data-unknown-status", groupKey);
		setTooltip(element, "Status is not defined in TaskNotes settings");
	}

	private async renderFlat(
		groups: Map<string, TaskInfo[]>,
		allGroups: Map<string, TaskInfo[]>
	): Promise<void> {
		if (!this.boardEl) return;
		this.sortScopeTaskPaths.clear();
		this.setSortScopeCandidatePaths(
			Array.from(allGroups.entries()).map(([groupKey, tasks]) => [
				this.getSortScopeKey(groupKey),
				tasks.map((task) => task.path),
			])
		);

		// Set CSS variable for column width (allows responsive override)
		this.boardEl.style.setProperty("--kanban-column-width", `${this.columnWidth}px`);

		// Render columns without swimlanes
		const visibleProperties = this.getVisibleProperties();

		// Tasks are re-sorted by sort_order in groupTasks() when configured,
		// ensuring correct order even if Bases' internal data hasn't refreshed yet.

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
			if (
				!shouldRenderKanbanColumn(
					this.hideEmptyColumns,
					groupKey,
					tasks,
					this.pinnedColumns
				)
			) {
				continue;
			}

			this.sortScopeTaskPaths.set(
				this.getSortScopeKey(groupKey),
				tasks.map((task) => task.path)
			);

			// Create column
			const column = await this.createColumn(
				groupKey,
				tasks,
				visibleProperties,
				groupByPropertyId
			);
			if (this.boardEl) {
				this.boardEl.appendChild(column);
			}
		}
	}

	private async renderWithSwimLanes(
		groups: Map<string, TaskInfo[]>,
		allTasks: TaskInfo[],
		allGroups: Map<string, TaskInfo[]>,
		allTasksForCandidateScopes: TaskInfo[],
		pathToProps: Map<string, Record<string, unknown>>,
		groupByPropertyId: string
	): Promise<void> {
		if (!this.swimLanePropertyId) return;
		this.sortScopeTaskPaths.clear();

		// Distribute tasks into swimlane + column cells from the already-built column
		// groups. This keeps swimlane mode aligned with flat mode and Bases grouping.
		const swimLanes = buildKanbanSwimlaneColumns(allTasks, groups, (task) =>
			this.getSwimLaneKeys(task, pathToProps)
		);
		const candidateSwimLanes = buildKanbanSwimlaneColumns(
			allTasksForCandidateScopes,
			allGroups,
			(task) => this.getSwimLaneKeys(task, pathToProps)
		);

		this.setSortScopeCandidatePaths(
			Array.from(candidateSwimLanes.entries()).flatMap(([swimLaneKey, columns]) =>
				Array.from(columns.entries()).map(
					([columnKey, tasks]) =>
						[
							this.getSortScopeKey(columnKey, swimLaneKey),
							tasks.map((task) => task.path),
						] as [string, string[]]
				)
			)
		);

		// Apply column ordering
		const columnKeys = Array.from(groups.keys());
		const orderedKeys = this.applyColumnOrder(groupByPropertyId, columnKeys);
		const orderedSwimLanes = this.applySwimLaneOrderToMap(
			this.swimLanePropertyId,
			swimLanes,
			columnKeys
		);

		// Render swimlane table
		await this.renderSwimLaneTable(
			orderedSwimLanes,
			orderedKeys,
			pathToProps,
			groupByPropertyId
		);
	}

	private async renderSwimLaneTable(
		swimLanes: Map<string, Map<string, TaskInfo[]>>,
		columnKeys: string[],
		pathToProps: Map<string, Record<string, unknown>>,
		groupByPropertyId: string
	): Promise<void> {
		if (!this.boardEl) return;

		// Set CSS variables for column width and swimlane max height
		this.boardEl.style.setProperty("--kanban-column-width", `${this.columnWidth}px`);
		this.boardEl.style.setProperty(
			"--kanban-swimlane-max-height",
			`${this.maxSwimlaneHeight}px`
		);

		// Add swimlanes class to board
		this.boardEl.addClass("kanban-view__board--swimlanes");

		// Create header row
		const headerRow = this.boardEl.createEl("div", {
			cls: "kanban-view__swimlane-row kanban-view__swimlane-row--header",
		});

		// Empty corner cell for swimlane label column
		headerRow.createEl("div", { cls: "kanban-view__swimlane-label" });

		// Column headers
		const columnTaskCounts = getKanbanColumnTaskCounts(swimLanes, columnKeys);
		for (const columnKey of columnKeys) {
			const headerCell = headerRow.createEl("div", {
				cls: "kanban-view__column-header-cell",
			});
			headerCell.setAttribute("draggable", "true");
			headerCell.setAttribute("data-column-key", columnKey);
			const isUnknownStatusColumn = this.isUnknownStatusGroup(columnKey, groupByPropertyId);
			if (isUnknownStatusColumn) {
				this.markUnknownStatusColumnHeader(headerCell, columnKey);
			}

			// Drag handle
			const dragHandle = headerCell.createSpan({ cls: "kanban-view__drag-handle" });
			dragHandle.setAttribute("aria-hidden", "true");
			setIcon(dragHandle, "grip-vertical");

			// Status icon (when consolidation enabled and grouped by status)
			if (this.consolidateStatusIcon && this.isGroupedByStatus()) {
				const statusConfig = this.plugin.statusManager.getStatusConfig(columnKey);
				if (statusConfig?.icon) {
					const iconEl = headerCell.createSpan({ cls: "kanban-view__column-icon" });
					iconEl.style.color = statusConfig.color;
					setIcon(iconEl, statusConfig.icon);
				}
			}

			const titleContainer = headerCell.createSpan({ cls: "kanban-view__column-title" });
			this.renderGroupTitleWrapper(titleContainer, columnKey, false, true);
			this.renderColumnCount(headerCell, columnKey, columnTaskCounts.get(columnKey) ?? 0);

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
			this.renderGroupTitleWrapper(titleEl, swimLaneKey, true);

			// Count total tasks in this swimlane
			const totalTasks = Array.from(columns.values()).reduce(
				(sum, tasks) => sum + tasks.length,
				0
			);
			labelCell.createEl("div", {
				cls: "kanban-view__swimlane-count",
				text: `${totalTasks}`,
			});

			// Render columns in this swimlane
			for (const columnKey of columnKeys) {
				const tasks = columns.get(columnKey) || [];
				const isUnknownStatusColumn = this.isUnknownStatusGroup(
					columnKey,
					groupByPropertyId
				);
				this.sortScopeTaskPaths.set(
					this.getSortScopeKey(columnKey, swimLaneKey),
					tasks.map((task) => task.path)
				);

				// Create cell
				const cell = row.createEl("div", {
					cls: "kanban-view__swimlane-column",
					attr: {
						"data-column": columnKey,
						"data-swimlane": swimLaneKey,
					},
				});
				if (isUnknownStatusColumn) {
					this.markUnknownStatusColumn(cell, columnKey);
				}

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
						const cardWrapper = tasksContainer.createDiv({
							cls: "kanban-view__card-wrapper",
						});
						cardWrapper.setAttribute("draggable", "true");
						cardWrapper.setAttribute("data-task-path", task.path);

						const card = createTaskCard(
							task,
							this.plugin,
							visibleProperties,
							cardOptions
						);

						cardWrapper.appendChild(card);
						this.currentTaskElements.set(task.path, cardWrapper);
						this.taskInfoCache.set(task.path, task);

						// Setup card drag handlers
						this.setupCardDragHandlers(cardWrapper, task);
					}
				}
				if (tasks.length === 0) {
					this.renderEmptyCellHint(tasksContainer, columnKey, swimLaneKey);
				}

				this.createAddTaskButton(cell, groupByPropertyId, columnKey, swimLaneKey);
			}
		}
	}

	private async createColumn(
		groupKey: string,
		tasks: TaskInfo[],
		visibleProperties: string[],
		groupByPropertyId: string | null
	): Promise<HTMLElement> {
		// Use containerEl.ownerDocument for pop-out window support
		const doc = this.containerEl.ownerDocument;
		const column = doc.createElement("div");
		column.className = "kanban-view__column";
		column.style.width = `${this.columnWidth}px`;
		column.setAttribute("data-group", groupKey);
		const isUnknownStatusColumn = this.isUnknownStatusGroup(groupKey, groupByPropertyId);
		if (isUnknownStatusColumn) {
			this.markUnknownStatusColumn(column, groupKey);
		}

		// Column header
		const header = column.createDiv({ cls: "kanban-view__column-header" });
		header.setAttribute("draggable", "true");
		header.setAttribute("data-column-key", groupKey);
		if (isUnknownStatusColumn) {
			this.markUnknownStatusColumnHeader(header, groupKey);
		}

		// Drag handle
		const dragHandle = header.createSpan({ cls: "kanban-view__drag-handle" });
		dragHandle.setAttribute("aria-hidden", "true");
		setIcon(dragHandle, "grip-vertical");

		// Status icon (when consolidation enabled and grouped by status)
		if (this.consolidateStatusIcon && this.isGroupedByStatus()) {
			const statusConfig = this.plugin.statusManager.getStatusConfig(groupKey);
			if (statusConfig?.icon) {
				const iconEl = header.createSpan({ cls: "kanban-view__column-icon" });
				iconEl.style.color = statusConfig.color;
				setIcon(iconEl, statusConfig.icon);
			}
		}

		const titleContainer = header.createSpan({ cls: "kanban-view__column-title" });
		this.renderGroupTitleWrapper(titleContainer, groupKey, false, true);

		this.renderColumnCount(header, groupKey, tasks.length);

		// Setup column header drag handlers
		this.setupColumnHeaderDragHandlers(header);

		// Cards container
		const cardsContainer = column.createDiv({ cls: "kanban-view__cards" });

		// Setup drag-and-drop for cards
		this.setupColumnDragDrop(column, cardsContainer, groupKey);

		const cardOptions = this.getCardOptions();

		// Use virtual scrolling for columns with many cards
		if (tasks.length >= this.VIRTUAL_SCROLL_THRESHOLD) {
			this.createVirtualColumn(
				cardsContainer,
				groupKey,
				tasks,
				visibleProperties,
				cardOptions
			);
		} else {
			this.createNormalColumn(cardsContainer, tasks, visibleProperties, cardOptions);
		}
		if (tasks.length === 0) {
			this.renderEmptyCellHint(cardsContainer, groupKey);
		}

		this.createAddTaskButton(column, groupByPropertyId, groupKey);

		return column;
	}

	private renderColumnCount(container: HTMLElement, groupKey: string, taskCount: number): void {
		const count = formatKanbanColumnCount(taskCount, this.wipLimits[groupKey]);
		const countEl = container.createSpan({
			cls: "kanban-view__column-count",
			text: count.text,
		});

		if (count.isExceeded) {
			countEl.addClass("kanban-view__column-count--exceeded");
		}
	}

	private createAddTaskButton(
		container: HTMLElement,
		groupByPropertyId: string | null,
		groupKey: string,
		swimLaneKey: string | null = null
	): void {
		const footer = container.createDiv({ cls: "kanban-view__add-task-footer" });
		const button = footer.createEl("button", {
			cls: "kanban-view__add-task-button clickable-icon",
			attr: {
				type: "button",
				"aria-label": this.getAddTaskLabel(groupKey, swimLaneKey),
			},
		});
		setIcon(button, "plus");
		setTooltip(button, this.getAddTaskLabel(groupKey, swimLaneKey));
		button.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			void this.openTaskCreationForKanbanCell(groupByPropertyId, groupKey, swimLaneKey);
		});
	}

	private getAddTaskLabel(groupKey: string, swimLaneKey: string | null): string {
		if (swimLaneKey) {
			return `Add task to ${groupKey} / ${swimLaneKey}`;
		}

		return `Add task to ${groupKey}`;
	}

	private renderEmptyCellHint(
		container: HTMLElement,
		groupKey: string,
		swimLaneKey: string | null = null
	): void {
		const noTasksLabel = this.plugin.i18n.translate("views.kanban.noTasks");
		const label = swimLaneKey
			? `${noTasksLabel}: ${groupKey} / ${swimLaneKey}`
			: `${noTasksLabel}: ${groupKey}`;
		const empty = container.createDiv({
			cls: "kanban-view__empty-cell",
			attr: {
				"aria-label": label,
			},
		});
		const icon = empty.createSpan({
			cls: "kanban-view__empty-cell-icon",
			attr: {
				"aria-hidden": "true",
			},
		});
		setIcon(icon, "plus-circle");
		empty.createSpan({
			cls: "kanban-view__empty-cell-text",
			text: noTasksLabel,
		});
	}

	private removeEmptyCellHint(container: HTMLElement | null | undefined): void {
		container?.querySelector<HTMLElement>(".kanban-view__empty-cell")?.remove();
	}

	private async openTaskCreationForKanbanCell(
		groupByPropertyId: string | null,
		groupKey: string,
		swimLaneKey: string | null = null
	): Promise<void> {
		await this.createFileForView(undefined, (frontmatter) => {
			const applyCreationDefault = (
				propertyId: string | null,
				defaultGroupKey: string | null
			): void => {
				applyKanbanCreationDefault({
					frontmatter,
					propertyId,
					groupKey: defaultGroupKey,
					propertyMapper: this.propertyMapper,
					fieldMapper: this.plugin.fieldMapper,
					userFields: this.plugin.settings.userFields,
					isListTypeProperty: (property) => this.isListTypeProperty(property),
					coerceGroupKeyForFrontmatter: (property, value) =>
						this.coerceGroupKeyForFrontmatter(property, value),
				});
			};

			applyCreationDefault(groupByPropertyId, groupKey);
			applyCreationDefault(this.swimLanePropertyId, swimLaneKey);
		});
	}

	private coerceGroupKeyForFrontmatter(
		property: string,
		groupKey: string
	): string | number | boolean {
		return coercePropertyGroupKeyForFrontmatter(
			this.plugin.app,
			property,
			groupKey,
			this.plugin.settings.userFields
		);
	}

	private createVirtualColumn(
		cardsContainer: HTMLElement,
		groupKey: string,
		tasks: TaskInfo[],
		visibleProperties: string[],
		cardOptions: TaskCardOptions
	): void {
		// Use semantic class instead of inline style for easier maintenance.
		cardsContainer.addClass("kanban-view__cards--virtual");

		// Use containerEl.ownerDocument for pop-out window support
		const doc = this.containerEl.ownerDocument;
		const scroller = new VirtualScroller<TaskInfo>({
			container: cardsContainer,
			items: tasks,
			// itemHeight omitted - automatically calculated from sample
			overscan: 3,
			renderItem: (task: TaskInfo) => {
				const cardWrapper = doc.createElement("div");
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
		// Use semantic class instead of inline style for easier maintenance.
		tasksContainer.addClass("kanban-view__tasks-container--virtual");

		const cardOptions = this.getCardOptions();

		// Use containerEl.ownerDocument for pop-out window support
		const doc = this.containerEl.ownerDocument;
		const scroller = new VirtualScroller<TaskInfo>({
			container: tasksContainer,
			items: tasks,
			// itemHeight omitted - automatically calculated from sample
			overscan: 3,
			renderItem: (task: TaskInfo) => {
				const cardWrapper = doc.createElement("div");
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
		cardOptions: TaskCardOptions
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
		const dragoverClass = isSwimlaneHeader
			? "kanban-view__column-header-cell--dragover"
			: "kanban-view__column-header--dragover";

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
			header.classList.add(dragoverClass);
		});

		header.addEventListener("dragleave", (e: DragEvent) => {
			// Only handle column drags
			if (!e.dataTransfer?.types.includes("text/x-kanban-column")) return;
			if (e.target === header) {
				header.classList.remove(dragoverClass);
			}
		});

		header.addEventListener("drop", (e: DragEvent) => {
			void (async () => {
				// Only handle column drags (not task drags)
				if (!e.dataTransfer?.types.includes("text/x-kanban-column")) return;
				e.preventDefault();
				e.stopPropagation();

				// Remove visual feedback
				header.classList.remove(dragoverClass);

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
					.map((el) => (el as HTMLElement).dataset.columnKey)
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
			})();
		});

		header.addEventListener("dragend", () => {
			header.classList.remove(draggingClass);
		});

		this.setupColumnHeaderTouchHandlers(header, columnKey, isSwimlaneHeader, draggingClass);
	}

	private setupColumnHeaderTouchHandlers(
		header: HTMLElement,
		columnKey: string,
		isSwimlaneHeader: boolean,
		draggingClass: string
	): void {
		if (!shouldEnableKanbanTouchDrag(Platform.isMobile)) return;

		header.addEventListener("contextmenu", (e: MouseEvent) => {
			if (this.longPressTimer || this.touchDragActive) {
				e.preventDefault();
				e.stopPropagation();
			}
		});

		header.addEventListener(
			"touchstart",
			(e: TouchEvent) => {
				if (e.touches.length !== 1) return;
				const touch = e.touches[0];
				this.touchStartX = touch.clientX;
				this.touchStartY = touch.clientY;
				this.longPressTimer = window.setTimeout(() => {
					this.touchDragActive = true;
					this.touchDragType = "column";
					this.draggedColumnKey = columnKey;
					// Use containerEl.ownerDocument to support pop-out windows
					this.containerEl.ownerDocument.addEventListener(
						"contextmenu",
						this.boundContextMenuBlocker,
						true
					);
					header.classList.add(draggingClass);
					this.touchDragGhost = this.createTouchDragGhost(
						header,
						touch.clientX,
						touch.clientY
					);
					navigator.vibrate?.(50);
				}, this.LONG_PRESS_DELAY);
			},
			{ passive: true }
		);

		header.addEventListener(
			"touchmove",
			(e: TouchEvent) => {
				if (e.touches.length !== 1) return;
				const touch = e.touches[0];

				if (!this.touchDragActive && this.longPressTimer) {
					const dx = Math.abs(touch.clientX - this.touchStartX);
					const dy = Math.abs(touch.clientY - this.touchStartY);
					if (dx > this.TOUCH_MOVE_THRESHOLD || dy > this.TOUCH_MOVE_THRESHOLD) {
						window.clearTimeout(this.longPressTimer);
						this.longPressTimer = null;
					}
					return;
				}

				if (this.touchDragActive && this.touchDragType === "column") {
					e.preventDefault();
					this.updateTouchDragGhost(touch.clientX, touch.clientY);
					this.updateDropTargetFeedback(touch.clientX, touch.clientY);
					this.handleAutoScroll(touch.clientX);
				}
			},
			{ passive: false }
		);

		header.addEventListener("touchend", (e: TouchEvent) => {
			void (async () => {
				if (this.longPressTimer) {
					window.clearTimeout(this.longPressTimer);
					this.longPressTimer = null;
				}
				header.classList.remove(draggingClass);

				if (!this.touchDragActive || this.touchDragType !== "column") return;

				const touch = e.changedTouches[0];
				if (!touch) {
					this.clearTouchDragState();
					return;
				}

				const target = this.findDropTargetAt(touch.clientX, touch.clientY);
				if (
					target.type &&
					target.groupKey &&
					this.draggedColumnKey &&
					target.groupKey !== this.draggedColumnKey
				) {
					const groupBy = this.getGroupByPropertyId();
					if (groupBy) {
						const selector = isSwimlaneHeader
							? ".kanban-view__column-header-cell"
							: ".kanban-view__column-header";
						const currentOrder = Array.from(this.boardEl!.querySelectorAll(selector))
							.map((el) => (el as HTMLElement).dataset.columnKey)
							.filter(Boolean) as string[];

						const dragIndex = currentOrder.indexOf(this.draggedColumnKey);
						const dropIndex = currentOrder.indexOf(target.groupKey);

						if (dragIndex !== -1 && dropIndex !== -1) {
							const newOrder = [...currentOrder];
							newOrder.splice(dragIndex, 1);
							newOrder.splice(dropIndex, 0, this.draggedColumnKey);

							await this.saveColumnOrder(groupBy, newOrder);
							await this.render();
						}
					}
				}

				this.clearTouchDragState();
			})();
		});

		header.addEventListener("touchcancel", () => {
			header.classList.remove(draggingClass);
			this.clearTouchDragState();
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
			const x = e.clientX;
			const y = e.clientY;

			if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
				column.classList.remove("kanban-view__column--dragover");
			}
		});

		// Drop handler
		column.addEventListener("drop", (e: DragEvent) => {
			void (async () => {
				// Only handle task drags (not column drags)
				if (e.dataTransfer?.types.includes("text/x-kanban-column")) return;
				e.preventDefault();
				e.stopPropagation();

				this.debugLog("COLUMN-DROP-EVENT-RECEIVED", {
					targetColumn: groupKey,
					draggedTaskPath: this.draggedTaskPath?.split("/").pop() || "(null)",
					dropTargetPath: this.dropTargetPath?.split("/").pop() || "(null)",
					eventTarget: (e.target as HTMLElement)?.className?.slice(0, 60),
				});

				if (!this.draggedTaskPath) {
					this.debugLog(
						"COLUMN-DROP: bail — draggedTaskPath is null (dragend already fired?)"
					);
					column.classList.remove("kanban-view__column--dragover");
					this.cleanupDragShift();
					return;
				}

				// For cross-column drops, the dropTarget may reference a card from
				// the source column (stale from last dragover). Validate that the
				// target card actually exists in the target column via DOM query.
				const initialDropTarget = createKanbanDropTarget(
					this.dropTargetPath,
					this.dropAbove
				);
				const cardsContainer = column.querySelector<HTMLElement>(".kanban-view__cards");
				const isCrossColumn = this.draggedFromColumn !== groupKey;
				const targetInColumn =
					!!initialDropTarget &&
					cardsContainer?.querySelector(
						`[data-task-path="${CSS.escape(initialDropTarget.taskPath)}"]`
					) != null;
				const coordinateDropTarget = cardsContainer
					? reconstructKanbanDropTargetFromContainer({
							cardsContainer,
							draggedTaskPaths: this.draggedTaskPaths,
							currentInsertionIndex: this.currentInsertionIndex,
							clientY: e.clientY,
						})
					: undefined;
				const dropTarget = resolveKanbanContainerDropTarget({
					dropTarget: coordinateDropTarget ?? initialDropTarget,
					isCrossScope: isCrossColumn,
					targetInDropScope: !!coordinateDropTarget || targetInColumn,
					fallbackDropTarget: !isCrossColumn ? coordinateDropTarget : undefined,
				});

				this.debugLog("COLUMN-DROP", {
					draggedTask: this.draggedTaskPath?.split("/").pop(),
					sourceColumn: this.draggedFromColumn,
					targetColumn: groupKey,
					isCrossColumn,
					dropTarget: dropTarget
						? { file: dropTarget.taskPath.split("/").pop(), above: dropTarget.above }
						: null,
					cardsContainerFound: !!cardsContainer,
					cardsContainerChildCount: cardsContainer?.childElementCount,
					draggedTaskPaths: this.draggedTaskPaths.map((p) => p.split("/").pop()),
				});

				// Optimistic DOM reorder: move card to correct position immediately
				const paths = getKanbanDraggedPaths(this.draggedTaskPaths, this.draggedTaskPath);
				const optimisticResult = this.performOptimisticReorder(paths, dropTarget, cardsContainer);
				this.debugLog("COLUMN-DROP-OPTIMISTIC-RESULT", { success: optimisticResult });

				// Now clean up shift CSS — no visual change since DOM is already correct
				column.classList.remove("kanban-view__column--dragover");
				this.cleanupDragShift();

				// Update the task's groupBy property in Bases
				await this.handleTaskDrop(this.draggedTaskPath, groupKey, null, dropTarget, {
					optimisticReorderApplied: optimisticResult,
					draggedPaths: paths,
				});

				this.draggedTaskPath = null;
				this.draggedFromColumn = null;
			})();
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
			const x = e.clientX;
			const y = e.clientY;

			if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
				cell.classList.remove("kanban-view__swimlane-column--dragover");
			}
		});

		// Drop handler
		cell.addEventListener("drop", (e: DragEvent) => {
			void (async () => {
				e.preventDefault();
				e.stopPropagation();

				this.debugLog("SWIMLANE-CELL-DROP-EVENT-RECEIVED", {
					targetColumn: columnKey,
					targetSwimlane: swimLaneKey,
					draggedTaskPath: this.draggedTaskPath?.split("/").pop() || "(null)",
					dropTargetPath: this.dropTargetPath?.split("/").pop() || "(null)",
					eventTarget: (e.target as HTMLElement)?.className?.slice(0, 60),
				});

				if (!this.draggedTaskPath) {
					this.debugLog(
						"SWIMLANE-CELL-DROP: bail — draggedTaskPath is null (dragend already fired?)"
					);
					cell.classList.remove("kanban-view__swimlane-column--dragover");
					this.cleanupDragShift();
					return;
				}

				// For cross-column/swimlane drops, validate dropTarget is in this cell via DOM query
				const initialDropTarget = createKanbanDropTarget(
					this.dropTargetPath,
					this.dropAbove
				);
				const cardsContainer = cell.querySelector<HTMLElement>(
					".kanban-view__tasks-container"
				);
				const isCrossColumn = this.draggedFromColumn !== columnKey;
				const isCrossSwimlane = this.draggedFromSwimlane !== swimLaneKey;
				const isCrossScope = isCrossColumn || isCrossSwimlane;
				const targetInCell =
					!!initialDropTarget &&
					cardsContainer?.querySelector(
						`[data-task-path="${CSS.escape(initialDropTarget.taskPath)}"]`
					) != null;
				const coordinateDropTarget = cardsContainer
					? reconstructKanbanDropTargetFromContainer({
							cardsContainer,
							draggedTaskPaths: this.draggedTaskPaths,
							currentInsertionIndex: this.currentInsertionIndex,
							clientY: e.clientY,
						})
					: undefined;
				const dropTarget = resolveKanbanContainerDropTarget({
					dropTarget: coordinateDropTarget ?? initialDropTarget,
					isCrossScope,
					targetInDropScope: !!coordinateDropTarget || targetInCell,
					fallbackDropTarget: !isCrossScope ? coordinateDropTarget : undefined,
				});

				// Optimistic DOM reorder: move card to correct position immediately
				const paths = getKanbanDraggedPaths(this.draggedTaskPaths, this.draggedTaskPath);
				this.debugLog("SWIMLANE-CELL-DROP", {
					draggedTask: this.draggedTaskPath?.split("/").pop(),
					isCrossColumn,
					isCrossSwimlane,
					dropTarget: dropTarget
						? { file: dropTarget.taskPath.split("/").pop(), above: dropTarget.above }
						: null,
					cardsContainerFound: !!cardsContainer,
					cardsContainerChildCount: cardsContainer?.childElementCount,
				});
				const optimisticResult = this.performOptimisticReorder(
					paths,
					dropTarget,
					cardsContainer
				);
				this.debugLog("SWIMLANE-CELL-DROP-OPTIMISTIC-RESULT", {
					success: optimisticResult,
				});

				// Now clean up shift CSS — no visual change since DOM is already correct
				cell.classList.remove("kanban-view__swimlane-column--dragover");
				this.cleanupDragShift();

				// Update both the groupBy property and swimlane property
				await this.handleTaskDrop(this.draggedTaskPath, columnKey, swimLaneKey, dropTarget, {
					optimisticReorderApplied: optimisticResult,
					draggedPaths: paths,
				});

				this.draggedTaskPath = null;
				this.draggedFromColumn = null;
			})();
		});

		// Drag end handler - cleanup in case drop doesn't fire
		cell.addEventListener("dragend", () => {
			cell.classList.remove("kanban-view__swimlane-column--dragover");
		});
	}

	private createTouchDragGhost(sourceEl: HTMLElement, x: number, y: number): HTMLElement {
		const ghost = sourceEl.cloneNode(true) as HTMLElement;
		ghost.classList.add("kanban-view__touch-ghost");
		ghost.style.cssText = `
			position: fixed;
			left: ${x}px;
			top: ${y}px;
			width: ${sourceEl.offsetWidth}px;
			pointer-events: none;
			z-index: 10000;
			opacity: 0.8;
			transform: translate(-50%, -50%) rotate(3deg);
			box-shadow: 0 8px 24px rgba(0,0,0,0.3);
		`;
		// Use containerEl.ownerDocument to support pop-out windows
		const doc = this.containerEl.ownerDocument;
		doc.body.appendChild(ghost);
		return ghost;
	}

	private updateTouchDragGhost(x: number, y: number): void {
		if (this.touchDragGhost) {
			this.touchDragGhost.style.left = `${x}px`;
			this.touchDragGhost.style.top = `${y}px`;
		}
	}

	private removeTouchDragGhost(): void {
		if (this.touchDragGhost) {
			this.touchDragGhost.remove();
			this.touchDragGhost = null;
		}
	}

	private findDropTargetAt(
		x: number,
		y: number
	): {
		type: "task" | "column" | "swimlane" | "columnHeader" | null;
		groupKey: string | null;
		swimLaneKey: string | null;
		element: HTMLElement | null;
		taskPath?: string;
		above?: boolean;
		cardsContainer?: HTMLElement | null;
	} {
		if (this.touchDragGhost) {
			this.touchDragGhost.classList.remove(
				"tn-static-display-block-2a1b75c9",
				"tn-static-display-flex-4d51fc62",
				"tn-static-display-flex-75816cae",
				"tn-static-display-flex-8bb39979",
				"tn-static-display-inline-block-60e32dcb",
				"tn-static-display-inline-cccfa456",
				"tn-static-display-inline-flex-f984c520",
				"tn-static-min-height-800px-997b4c8c"
			);
			this.touchDragGhost.classList.add("tn-static-display-none-6b99de8b");
		}
		// Use containerEl.ownerDocument to support pop-out windows
		const doc = this.containerEl.ownerDocument;
		const el = doc.elementFromPoint(x, y) as HTMLElement | null;
		if (this.touchDragGhost) {
			this.touchDragGhost.classList.remove(
				"tn-static-display-block-2a1b75c9",
				"tn-static-display-flex-4d51fc62",
				"tn-static-display-flex-75816cae",
				"tn-static-display-flex-8bb39979",
				"tn-static-display-inline-block-60e32dcb",
				"tn-static-display-inline-cccfa456",
				"tn-static-display-inline-flex-f984c520",
				"tn-static-display-none-6b99de8b",
				"tn-static-min-height-800px-997b4c8c"
			);
			this.touchDragGhost.style.removeProperty("display");
		}

		if (!el) return { type: null, groupKey: null, swimLaneKey: null, element: null };

		const card = el.closest<HTMLElement>(".kanban-view__card-wrapper");
		const taskPath = card?.dataset.taskPath;
		if (card && taskPath && !this.draggedTaskPaths.includes(taskPath)) {
			const column = card.closest<HTMLElement>("[data-group]");
			const swimCol = card.closest<HTMLElement>("[data-column]");
			const swimlaneRow = card.closest<HTMLElement>("[data-swimlane]");
			const groupKey = column?.dataset.group || swimCol?.dataset.column || null;
			const rect = card.getBoundingClientRect();

			return {
				type: "task",
				groupKey,
				swimLaneKey: swimlaneRow?.dataset.swimlane || null,
				element: card,
				taskPath,
				above: y < rect.top + rect.height / 2,
				cardsContainer: card.parentElement,
			};
		}

		const swimCell = el.closest("[data-column][data-swimlane]") as HTMLElement;
		if (swimCell) {
			return {
				type: "swimlane",
				groupKey: swimCell.dataset.column || null,
				swimLaneKey: swimCell.dataset.swimlane || null,
				element: swimCell,
			};
		}

		const column = el.closest("[data-group]") as HTMLElement;
		if (column) {
			return {
				type: "column",
				groupKey: column.dataset.group || null,
				swimLaneKey: null,
				element: column,
			};
		}

		const header = el.closest("[data-column-key]") as HTMLElement;
		if (header) {
			return {
				type: "columnHeader",
				groupKey: header.dataset.columnKey || null,
				swimLaneKey: null,
				element: header,
			};
		}

		return { type: null, groupKey: null, swimLaneKey: null, element: null };
	}

	private clearDragoverFeedback(): void {
		this.boardEl?.querySelectorAll(".kanban-view__column--dragover").forEach((el) => {
			el.classList.remove("kanban-view__column--dragover");
		});
		this.boardEl?.querySelectorAll(".kanban-view__swimlane-column--dragover").forEach((el) => {
			el.classList.remove("kanban-view__swimlane-column--dragover");
		});
		this.boardEl?.querySelectorAll(".kanban-view__column-header--dragover").forEach((el) => {
			el.classList.remove("kanban-view__column-header--dragover");
		});
		this.boardEl
			?.querySelectorAll(".kanban-view__column-header-cell--dragover")
			.forEach((el) => {
				el.classList.remove("kanban-view__column-header-cell--dragover");
			});
	}

	private updateDropTargetFeedback(x: number, y: number): void {
		this.clearDragoverFeedback();
		const target = this.findDropTargetAt(x, y);
		if (target.element) {
			if (target.type === "column") {
				target.element.classList.add("kanban-view__column--dragover");
			} else if (target.type === "swimlane") {
				target.element.classList.add("kanban-view__swimlane-column--dragover");
			} else if (target.type === "task") {
				const swimlaneColumn = target.element.closest(".kanban-view__swimlane-column");
				if (swimlaneColumn) {
					swimlaneColumn.classList.add("kanban-view__swimlane-column--dragover");
				} else {
					target.element
						.closest(".kanban-view__column")
						?.classList.add("kanban-view__column--dragover");
				}
			} else if (target.type === "columnHeader" && this.touchDragType === "column") {
				if (target.element.classList.contains("kanban-view__column-header-cell")) {
					target.element.classList.add("kanban-view__column-header-cell--dragover");
				} else {
					target.element.classList.add("kanban-view__column-header--dragover");
				}
			}
		}
	}

	private clearTouchDragState(): void {
		this.touchDragActive = false;
		// Use containerEl.ownerDocument to support pop-out windows
		this.containerEl.ownerDocument.removeEventListener(
			"contextmenu",
			this.boundContextMenuBlocker,
			true
		);
		this.removeTouchDragGhost();
		this.stopAutoScroll();

		if (this.longPressTimer) {
			window.clearTimeout(this.longPressTimer);
			this.longPressTimer = null;
		}

		this.clearDragoverFeedback();

		for (const path of this.draggedTaskPaths) {
			this.currentTaskElements.get(path)?.classList.remove("kanban-view__card--dragging");
		}
		this.activeDragSourceElement?.classList.remove("kanban-view__card--dragging");
		this.activeDragSourceElement = null;

		this.draggedTaskPath = null;
		this.draggedTaskPaths = [];
		this.draggedFromColumn = null;
		this.draggedFromSwimlane = null;
		this.draggedSourceColumns.clear();
		this.draggedSourceSwimlanes.clear();
		this.touchDragType = null;
		this.draggedColumnKey = null;
	}

	private handleAutoScroll(touchX: number): void {
		if (!this.boardEl) return;

		const rect = this.boardEl.getBoundingClientRect();
		const leftEdge = rect.left + this.AUTO_SCROLL_EDGE;
		const rightEdge = rect.right - this.AUTO_SCROLL_EDGE;

		let newDirection = 0;
		if (touchX < leftEdge) newDirection = -1;
		else if (touchX > rightEdge) newDirection = 1;

		if (newDirection !== this.autoScrollDirection) {
			this.stopAutoScroll();
			this.autoScrollDirection = newDirection;
			if (newDirection !== 0) {
				this.autoScrollTimer = window.setInterval(() => {
					if (this.boardEl) {
						this.boardEl.scrollLeft +=
							this.autoScrollDirection * this.AUTO_SCROLL_SPEED;
					}
				}, 16);
			}
		}
	}

	private stopAutoScroll(): void {
		if (this.autoScrollTimer) {
			window.clearInterval(this.autoScrollTimer);
			this.autoScrollTimer = null;
		}
		this.autoScrollDirection = 0;
	}

	private setupCardDragHandlers(cardWrapper: HTMLElement, task: TaskInfo): void {
		let dragSourceOverride: KanbanTaskDragSource | null = null;
		const resetDragSourceOverride = () => {
			dragSourceOverride = null;
		};

		cardWrapper.addEventListener(
			"mousedown",
			(e: MouseEvent) => {
				dragSourceOverride = resolveNestedTaskCardDragSource(e.target, cardWrapper);
			},
			{ capture: true }
		);
		cardWrapper.addEventListener("mouseup", resetDragSourceOverride);
		cardWrapper.addEventListener("click", resetDragSourceOverride, { capture: true });

		// Handle click for selection mode
		cardWrapper.addEventListener("click", (e: MouseEvent) => {
			// Check if this is a selection click
			if (this.handleSelectionClick(e, task.path)) {
				e.stopPropagation();
				return;
			}
		});

		// Handle right-click for context menu (skip if touch drag pending/active)
		cardWrapper.addEventListener("contextmenu", (e: MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();

			if (this.longPressTimer || this.touchDragActive) return;

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
			void showTaskContextMenu(e, task.path, this.plugin, new Date());
		});

		cardWrapper.addEventListener("dragover", (e: DragEvent) => {
			// Skip if dragging over self
			if (this.draggedTaskPath === task.path) return;
			// Must call preventDefault synchronously to keep the drop zone active
			e.preventDefault();
			e.stopPropagation();
			if (e.dataTransfer) e.dataTransfer.dropEffect = "move";

			// Throttle the visual update via rAF
			const clientY = e.clientY;
			if (!this.dragOverRafId) {
				this.dragOverRafId = window.requestAnimationFrame(() => {
					this.dragOverRafId = 0;

					const rect = cardWrapper.getBoundingClientRect();
					const isAbove = clientY < rect.top + rect.height / 2;

					this.dropTargetPath = task.path;
					this.dropAbove = isAbove;

					// Determine the container for this card
					const container = cardWrapper.parentElement;
					if (!container) return;

					// If the drag moved to a different container (cross-column),
					// clean up old container and set up the new one
					if (container !== this.dragContainer) {
						this.cleanupDragShift();

						// Measure the primary dragged card for gap sizing
						const primaryWrapper = this.currentTaskElements.get(
							this.draggedTaskPath || ""
						);
						const draggedHeight = primaryWrapper
							? primaryWrapper.getBoundingClientRect().height || 60
							: 60;
						const gapStr = getComputedStyle(container).gap;
						const gap = parseFloat(gapStr) || 4;
						const totalGap = draggedHeight + gap;
						container.style.setProperty("--tn-drag-gap", `${totalGap}px`);
						container.classList.remove("tn-static-margin-top-12px-91e0f558");
						// Padding grows the container's content box so
						// translateY-shifted cards have real layout space.
						// Also bump the column's max-height so it can grow
						// to accommodate the taller container.
						container.style.paddingBottom = `${totalGap}px`;
						const parentCol = container.closest<HTMLElement>(
							".kanban-view__column, .kanban-view__swimlane-column"
						);
						if (parentCol) {
							const currentHeight = parentCol.getBoundingClientRect().height;
							parentCol.style.maxHeight = `${currentHeight + totalGap}px`;
							this.dragTargetColumnEl = parentCol;
						}

						const siblings = container.querySelectorAll<HTMLElement>(
							".kanban-view__card-wrapper"
						);
						for (const sib of siblings) {
							if (!this.draggedTaskPaths.includes(sib.dataset.taskPath || "")) {
								sib.classList.add("kanban-view__card-wrapper--drag-shift");
							}
						}
						this.dragContainer = container;
					}

					// Compute insertion index among non-dragged siblings
					const siblings = Array.from(
						container.querySelectorAll<HTMLElement>(".kanban-view__card-wrapper")
					).filter((sib) => !this.draggedTaskPaths.includes(sib.dataset.taskPath || ""));

					let insertionIndex = siblings.length; // default: end
					for (let i = 0; i < siblings.length; i++) {
						if (siblings[i].dataset.taskPath === task.path) {
							insertionIndex = isAbove ? i : i + 1;
							break;
						}
					}

					if (insertionIndex !== this.currentInsertionIndex) {
						this.currentInsertionIndex = insertionIndex;
						for (let i = 0; i < siblings.length; i++) {
							siblings[i].classList.toggle(
								"kanban-view__card-wrapper--shift-down",
								i >= insertionIndex
							);
						}
					}
				});
			}
		});

		// dragleave: don't clear shifts — dragover on the container keeps them current
		cardWrapper.addEventListener("dragleave", () => {
			// No-op: shift state is managed by dragover
		});

		// Drop handler on card — handles drop at card level so it doesn't
		// depend on event bubbling to the column (which can fail if the column
		// is re-rendered during the drag)
		cardWrapper.addEventListener("drop", (e: DragEvent) => {
			void (async () => {
				// Only handle task drags (not column drags)
				if (e.dataTransfer?.types.includes("text/x-kanban-column")) return;
				e.preventDefault();
				e.stopPropagation();

				if (!this.draggedTaskPath) {
					return;
				}

				// Determine which column this card belongs to
				const col = cardWrapper.closest("[data-group]") as HTMLElement;
				const swimCol = cardWrapper.closest("[data-column]") as HTMLElement;
				const swimlaneRow = cardWrapper.closest("[data-swimlane]") as HTMLElement;
				const groupKey = col?.dataset.group || swimCol?.dataset.column;
				const swimLaneKey = swimlaneRow?.dataset.swimlane || null;

				if (!groupKey) return;

				// Resolve from the actual drop event so a queued dragover frame
				// cannot leave the final before/after side stale.
				const dropTarget = getKanbanCardDropTargetFromClientY(
					cardWrapper,
					task.path,
					e.clientY
				);

				this.debugLog("CARD-DROP (drop-on-card handler)", {
					draggedTask: this.draggedTaskPath?.split("/").pop(),
					targetCard: task.path.split("/").pop(),
					sourceColumn: this.draggedFromColumn,
					targetColumn: groupKey,
					isCrossColumn: this.draggedFromColumn !== groupKey,
					above: dropTarget.above,
					swimLaneKey,
				});

				// Optimistic DOM reorder: move card to correct position immediately
				const paths = getKanbanDraggedPaths(this.draggedTaskPaths, this.draggedTaskPath);
				const optimisticResult = this.performOptimisticReorder(paths, dropTarget);

				// Now clean up shift CSS — no visual change since DOM is already correct
				this.cleanupDragShift();
				col?.classList.remove("kanban-view__column--dragover");

				await this.handleTaskDrop(this.draggedTaskPath, groupKey, swimLaneKey, dropTarget, {
					optimisticReorderApplied: optimisticResult,
					draggedPaths: paths,
				});

				this.draggedTaskPath = null;
				this.draggedFromColumn = null;
			})();
		});

		cardWrapper.addEventListener("dragstart", (e: DragEvent) => {
			e.stopPropagation();
			const dragSource = dragSourceOverride ?? {
				taskPath: task.path,
				sourceElement: cardWrapper,
			};
			const draggedTaskPath = dragSource.taskPath;
			const dragImageSource = dragSource.sourceElement;

			this.debugLog("DRAGSTART", {
				task: draggedTaskPath.split("/").pop(),
				parentTask: task.path.split("/").pop(),
				inCurrentTaskElements: this.currentTaskElements.has(draggedTaskPath),
				isNestedSource: draggedTaskPath !== task.path,
			});
			setElementDragImage(e, dragImageSource, "kanban-view__drag-image");
			// Check if we're dragging selected tasks (batch drag)
			const selectionService = this.plugin.taskSelectionService;
			if (
				selectionService &&
				selectionService.isSelected(draggedTaskPath) &&
				selectionService.getSelectionCount() > 1
			) {
				// Batch drag - drag all selected tasks
				this.draggedTaskPaths = selectionService.getSelectedPaths();
				this.draggedTaskPath = draggedTaskPath;

				// Build source column and swimlane maps for all selected tasks
				this.draggedSourceColumns.clear();
				this.draggedSourceSwimlanes.clear();
				for (const path of this.draggedTaskPaths) {
					const wrapper = this.currentTaskElements.get(path);
					if (wrapper) {
						wrapper.classList.add("kanban-view__card--dragging");
						// Capture source column for each task
						const col = wrapper.closest("[data-group]") as HTMLElement;
						const swimCol = wrapper.closest("[data-column]") as HTMLElement;
						const swimlaneRow = wrapper.closest("[data-swimlane]") as HTMLElement;
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
				dragImageSource.classList.add("kanban-view__card--dragging");
			} else {
				// Single card drag
				this.draggedTaskPath = draggedTaskPath;
				this.draggedTaskPaths = [draggedTaskPath];
				dragImageSource.classList.add("kanban-view__card--dragging");

				if (e.dataTransfer) {
					e.dataTransfer.effectAllowed = "move";
					e.dataTransfer.setData("text/plain", draggedTaskPath);
				}
			}

			this.activeDragSourceElement = dragImageSource;
			this.showFloatingDragPreview(dragImageSource, e);

			// Capture the source column and swimlane for list property handling (single drag fallback)
			const column = cardWrapper.closest("[data-group]") as HTMLElement;
			const swimlaneColumn = cardWrapper.closest("[data-column]") as HTMLElement;
			const swimlaneRow = cardWrapper.closest("[data-swimlane]") as HTMLElement;
			this.draggedFromColumn =
				column?.dataset.group || swimlaneColumn?.dataset.column || null;
			this.draggedFromSwimlane = swimlaneRow?.dataset.swimlane || null;

			// Add body-level class to suppress hover lift on siblings
			this.containerEl.ownerDocument.body.classList.add("tn-drag-active");

			// Measure card height before collapse (for gap/slot sizing)
			const draggedHeight = dragImageSource.getBoundingClientRect().height;
			const container = cardWrapper.parentElement;

			// Lock the source column's height so it doesn't shrink when the
			// dragged card collapses.  Works for both regular columns and
			// swimlane cells.
			const sourceCol = cardWrapper.closest<HTMLElement>(
				".kanban-view__column, .kanban-view__swimlane-column"
			);
			if (sourceCol) {
				sourceCol.style.minHeight = `${sourceCol.offsetHeight}px`;
				this.dragSourceColumnEl = sourceCol;
			}

			// Collapse dragged cards on next frame (after browser captures drag image)
			window.requestAnimationFrame(() => {
				for (const path of this.draggedTaskPaths) {
					const wrapper = this.currentTaskElements.get(path);
					if (wrapper) {
						wrapper.classList.remove(
							"tn-static-display-flex-4d51fc62",
							"tn-static-height-100-62264068",
							"tn-static-height-12px-06c0747e",
							"tn-static-height-16px-30de4aee",
							"tn-static-height-24px-29a11d37",
							"tn-static-min-height-800px-997b4c8c"
						);
						wrapper.classList.add("tn-static-height-0-7a31cef0");
						wrapper.classList.remove("tn-static-flex-1-14e3b769");
						wrapper.classList.add("tn-static-overflow-hidden-69824400");
						wrapper.classList.remove(
							"tn-static-margin-8px-0-0-0-a2eb8382",
							"tn-static-padding-0-16px-16px-16px-f1aa998c",
							"tn-static-padding-12px-43bef435",
							"tn-static-padding-16px-287f770e",
							"tn-static-padding-20px-769fed37",
							"tn-static-padding-20px-7a035d95",
							"tn-static-padding-20px-ebe8e48c",
							"tn-static-padding-2px-8px-c8eea84a",
							"tn-static-padding-2rem-42aa6d9c"
						);
						wrapper.classList.add("tn-static-padding-0-41d7d7e2");
						wrapper.classList.remove(
							"tn-static-margin-0-auto-266e9b04",
							"tn-static-margin-0-db0d5f36",
							"tn-static-margin-0-var-size-4-2-77f7dc08",
							"tn-static-margin-2px-0-edce9b14",
							"tn-static-margin-8px-0-0-0-a2eb8382",
							"tn-static-padding-12px-43bef435",
							"tn-static-padding-20px-ebe8e48c"
						);
						wrapper.classList.add("tn-static-margin-0-11696618");
						wrapper.classList.remove(
							"tn-static-border-1px-solid-var-background-mo-b65b5121",
							"tn-static-padding-12px-43bef435"
						);
						wrapper.classList.add("tn-static-border-none-2eda1daa");
						wrapper.classList.remove(
							"tn-static-opacity-0-6-d95b59ac",
							"tn-static-opacity-1-c6e7979d"
						);
						wrapper.classList.add("tn-static-opacity-0-8d919cb5");
					}
				}

				// Set up gap/slot on siblings in the source container
				if (container) {
					const gapStr = getComputedStyle(container).gap;
					const gap = parseFloat(gapStr) || 4;
					container.style.setProperty("--tn-drag-gap", `${draggedHeight + gap}px`);
					// Keep the column scrollable while dragging long manual-order lists.
					container.classList.remove("tn-static-margin-top-12px-91e0f558");

					const siblings = container.querySelectorAll<HTMLElement>(
						".kanban-view__card-wrapper"
					);
					for (const sib of siblings) {
						if (!this.draggedTaskPaths.includes(sib.dataset.taskPath || "")) {
							sib.classList.add("kanban-view__card-wrapper--drag-shift");
						}
					}
					this.dragContainer = container;
					this.currentInsertionIndex = -1;
				}
			});
		});

		cardWrapper.addEventListener("dragend", (e: DragEvent) => {
			e.stopPropagation();
			this.debugLog("DRAGEND-FIRED", {
				draggedTask: task.path.split("/").pop(),
				draggedTaskPath: this.draggedTaskPath?.split("/").pop() || "(already null)",
				draggedTaskPathsCount: this.draggedTaskPaths.length,
				pendingRender: this.pendingRender,
				activeDropCount: this.activeDropCount,
				suppressRenderRemaining: Math.max(0, this.suppressRenderUntil - Date.now()),
			});

			this.cleanupFloatingDragPreview();

			// Restore collapsed dragged cards' inline styles
			for (const path of this.draggedTaskPaths) {
				const wrapper = this.currentTaskElements.get(path);
				if (wrapper) {
					const parentClass = wrapper.parentElement?.className || "(detached)";
					this.debugLog("DRAGEND-RESTORE-CARD", {
						path: path.split("/").pop(),
						parentClass,
						currentStyles: wrapper.style.cssText.slice(0, 80),
					});
					clearStaticStyleClasses(wrapper);
					wrapper.classList.remove("kanban-view__card--dragging");
				}
			}
			clearStaticStyleClasses(cardWrapper);
			cardWrapper.classList.remove("kanban-view__card--dragging");
			this.activeDragSourceElement?.classList.remove("kanban-view__card--dragging");
			this.activeDragSourceElement = null;
			resetDragSourceOverride();

			// Clean up gap/slot state and unlock source column height
			this.cleanupDragShift();
			if (this.dragSourceColumnEl) {
				this.dragSourceColumnEl.classList.remove(
					"tn-static-flex-1-14e3b769",
					"tn-static-min-height-800px-997b4c8c"
				);
				this.dragSourceColumnEl.style.removeProperty("min-height");
				this.dragSourceColumnEl = null;
			}
			this.containerEl.ownerDocument.body.classList.remove("tn-drag-active");

			// Clear drag state. The drop handler snapshots dropTargetPath and
			// clears it before its first await, so this is safe even if
			// handleTaskDrop is still running.
			this.draggedTaskPath = null;
			this.draggedFromColumn = null;
			this.draggedFromSwimlane = null;
			this.draggedTaskPaths = [];
			this.draggedSourceColumns.clear();
			this.draggedSourceSwimlanes.clear();

			// Clean up any lingering dragover classes
			this.boardEl?.querySelectorAll(".kanban-view__column--dragover").forEach((el) => {
				el.classList.remove("kanban-view__column--dragover");
			});
			this.boardEl
				?.querySelectorAll(".kanban-view__swimlane-column--dragover")
				.forEach((el) => {
					el.classList.remove("kanban-view__swimlane-column--dragover");
				});

			this.dropTargetPath = null;

			// Cancel any pending rAF
			if (this.dragOverRafId) {
				cancelAnimationFrame(this.dragOverRafId);
				this.dragOverRafId = 0;
			}

			// Flush any render that was deferred while dragging.
			// Use a short delay so the async drop handler can finish first.
			if (this.pendingRender) {
				this.debugLog(
					"DRAGEND-PENDING-RENDER: flushing deferred render via debouncedRefresh"
				);
				this.pendingRender = false;
				this.debouncedRefresh();
			} else {
				this.debugLog("DRAGEND: no pending render to flush");
			}
		});

		this.setupCardTouchHandlers(cardWrapper, task);
	}

	/**
	 * Reconstruct a drop target from the visible (non-dragged) cards in a container.
	 * Used as a fallback when the user drops in empty space where the card-level
	 * dragover never fired, so dropTargetPath is null.
	 */
	/**
	 * Move dragged card(s) to the correct DOM position immediately after drop,
	 * before CSS shift classes are removed. This prevents the visual flash
	 * where cards snap to their original position before the re-render.
	 * Returns false if optimistic reorder could not be performed (e.g. virtual-scrolled column).
	 */
	private performOptimisticReorder(
		draggedPaths: string[],
		dropTarget: { taskPath: string; above: boolean } | undefined,
		targetContainer?: HTMLElement | null
	): boolean {
		return performKanbanOptimisticReorder({
			draggedPaths,
			dropTarget,
			targetContainer,
			currentTaskElements: this.currentTaskElements,
			removeEmptyCellHint: (container) => this.removeEmptyCellHint(container),
			log: (message, data) => this.debugLog(message, data),
		});
	}

	/**
	 * Extract the current visual task order from a cards container's DOM children.
	 * Returns TaskInfo[] in display order with fresh sort_order values from metadataCache.
	 */

	/**
	 * Remove all gap/slot shift classes and custom properties from the current
	 * drag container (and any stale containers from cross-column drags).
	 */
	private cleanupDragShift(): void {
		// Clean current container
		if (this.dragContainer) {
			this.dragContainer.style.removeProperty("--tn-drag-gap");
			this.dragContainer.classList.remove(
				"tn-static-margin-top-12px-91e0f558",
				"tn-static-overflow-y-auto-03df744e",
				"tn-static-overflow-y-clip-c5043043"
			);
			this.dragContainer.style.removeProperty("overflow-y");
			this.dragContainer.style.removeProperty("padding-bottom");
			const wrappers = this.dragContainer.querySelectorAll<HTMLElement>(
				".kanban-view__card-wrapper--drag-shift, .kanban-view__card-wrapper--shift-down"
			);
			for (const w of wrappers) {
				w.classList.remove(
					"kanban-view__card-wrapper--drag-shift",
					"kanban-view__card-wrapper--shift-down"
				);
			}
			this.dragContainer = null;
		}

		// Reset target column max-height
		if (this.dragTargetColumnEl) {
			this.dragTargetColumnEl.classList.remove(
				"tn-static-margin-top-12px-91e0f558",
				"tn-static-max-height-400px-f0787633"
			);
			this.dragTargetColumnEl.style.removeProperty("max-height");
			this.dragTargetColumnEl = null;
		}

		// Also clean any wrappers on the entire board (safety net for cross-column)
		this.boardEl
			?.querySelectorAll<HTMLElement>(
				".kanban-view__card-wrapper--drag-shift, .kanban-view__card-wrapper--shift-down"
			)
			.forEach((w) => {
				w.classList.remove(
					"kanban-view__card-wrapper--drag-shift",
					"kanban-view__card-wrapper--shift-down"
				);
			});

		this.currentInsertionIndex = -1;
	}

	private showFloatingDragPreview(sourceElement: HTMLElement, event: DragEvent): void {
		this.cleanupFloatingDragPreview();

		const doc = sourceElement.ownerDocument;
		const body = doc.body;
		if (!body) return;

		const rect = sourceElement.getBoundingClientRect();
		const preview = doc.createElement("div");
		const title = this.getFloatingDragPreviewTitle(sourceElement);
		const titleEl = doc.createElement("span");

		titleEl.className = "kanban-view__floating-drag-preview-title";
		titleEl.textContent = title;

		preview.classList.add("tasknotes-plugin", "kanban-view__floating-drag-preview");
		preview.appendChild(titleEl);
		preview.setAttribute("aria-hidden", "true");
		preview.setAttribute("draggable", "false");
		if (this.draggedTaskPaths.length > 1) {
			preview.dataset.dragCount = `${this.draggedTaskPaths.length}`;
		}
		this.floatingDragPreviewWidth = Math.min(Math.max(rect.width, 180), 320);
		this.floatingDragPreviewHeight = 40;
		preview.setCssProps({
			"--tn-kanban-drag-preview-width": `${this.floatingDragPreviewWidth}px`,
			"--tn-kanban-drag-preview-transform": "translate3d(-9999px, -9999px, 0)",
		});

		body.appendChild(preview);
		this.floatingDragPreviewEl = preview;
		this.floatingDragPreviewDocument = doc;

		const handleMove = (dragEvent: DragEvent) => {
			this.positionFloatingDragPreview(dragEvent.clientX, dragEvent.clientY);
		};
		this.floatingDragPreviewMoveHandler = handleMove;
		doc.addEventListener("drag", handleMove, true);
		doc.addEventListener("dragover", handleMove, true);

		this.positionFloatingDragPreview(event.clientX, event.clientY);
	}

	private positionFloatingDragPreview(clientX: number, clientY: number): void {
		const preview = this.floatingDragPreviewEl;
		if (!preview || (clientX === 0 && clientY === 0)) return;

		const win = preview.ownerDocument.defaultView ?? window;
		const margin = 8;
		const offset = 14;
		const width = this.floatingDragPreviewWidth;
		const height = this.floatingDragPreviewHeight;
		let x = clientX + offset;
		let y = clientY + offset;

		if (x + width > win.innerWidth - margin) {
			x = clientX - width - offset;
		}
		if (y + height > win.innerHeight - margin) {
			y = clientY - height - offset;
		}

		x = Math.max(margin, Math.min(x, Math.max(margin, win.innerWidth - width - margin)));
		y = Math.max(margin, Math.min(y, Math.max(margin, win.innerHeight - height - margin)));
		x += win.scrollX;
		y += win.scrollY;
		this.floatingDragPreviewPendingX = x;
		this.floatingDragPreviewPendingY = y;

		if (this.floatingDragPreviewRafId !== null) {
			return;
		}

		this.floatingDragPreviewRafId = win.requestAnimationFrame(() => {
			this.floatingDragPreviewRafId = null;
			const pendingX = this.floatingDragPreviewPendingX;
			const pendingY = this.floatingDragPreviewPendingY;
			this.floatingDragPreviewEl?.setCssProps({
				"--tn-kanban-drag-preview-transform": `translate3d(${pendingX}px, ${pendingY}px, 0)`,
			});
		});
	}

	private getFloatingDragPreviewTitle(sourceElement: HTMLElement): string {
		const title =
			sourceElement.querySelector<HTMLElement>(".task-card__title-text")?.textContent ||
			sourceElement.querySelector<HTMLElement>(".task-card__title")?.textContent ||
			sourceElement.dataset.taskPath?.split("/").pop()?.replace(/\.md$/i, "") ||
			"Task";
		const normalized = title.trim().replace(/\s+/g, " ");
		return normalized.length > 80 ? `${normalized.slice(0, 77).trimEnd()}...` : normalized;
	}

	private cleanupFloatingDragPreview(): void {
		if (this.floatingDragPreviewRafId !== null) {
			const win = this.floatingDragPreviewDocument?.defaultView ?? window;
			win.cancelAnimationFrame(this.floatingDragPreviewRafId);
			this.floatingDragPreviewRafId = null;
		}
		if (this.floatingDragPreviewMoveHandler && this.floatingDragPreviewDocument) {
			this.floatingDragPreviewDocument.removeEventListener(
				"drag",
				this.floatingDragPreviewMoveHandler,
				true
			);
			this.floatingDragPreviewDocument.removeEventListener(
				"dragover",
				this.floatingDragPreviewMoveHandler,
				true
			);
		}
		this.floatingDragPreviewEl?.remove();
		this.floatingDragPreviewEl = null;
		this.floatingDragPreviewDocument = null;
		this.floatingDragPreviewMoveHandler = null;
		this.floatingDragPreviewWidth = 280;
		this.floatingDragPreviewHeight = 40;
		this.floatingDragPreviewPendingX = 0;
		this.floatingDragPreviewPendingY = 0;
	}

	private setupCardTouchHandlers(cardWrapper: HTMLElement, task: TaskInfo): void {
		if (!shouldEnableKanbanTouchDrag(Platform.isMobile)) return;

		let touchDragSourceOverride: KanbanTaskDragSource | null = null;
		const resetTouchDragSourceOverride = () => {
			touchDragSourceOverride = null;
		};

		cardWrapper.addEventListener(
			"touchstart",
			(e: TouchEvent) => {
				if (e.touches.length !== 1) return;
				touchDragSourceOverride = resolveNestedTaskCardDragSource(e.target, cardWrapper);
				const touch = e.touches[0];
				this.touchStartX = touch.clientX;
				this.touchStartY = touch.clientY;
				this.longPressTimer = window.setTimeout(() => {
					this.initiateTouchDrag(
						cardWrapper,
						task,
						touch.clientX,
						touch.clientY,
						touchDragSourceOverride
					);
				}, this.LONG_PRESS_DELAY);
			},
			{ passive: true }
		);

		cardWrapper.addEventListener(
			"touchmove",
			(e: TouchEvent) => {
				if (e.touches.length !== 1) return;
				const touch = e.touches[0];

				if (!this.touchDragActive && this.longPressTimer) {
					const dx = Math.abs(touch.clientX - this.touchStartX);
					const dy = Math.abs(touch.clientY - this.touchStartY);
					if (dx > this.TOUCH_MOVE_THRESHOLD || dy > this.TOUCH_MOVE_THRESHOLD) {
						window.clearTimeout(this.longPressTimer);
						this.longPressTimer = null;
					}
					return;
				}

				if (this.touchDragActive && this.touchDragType === "task") {
					e.preventDefault();
					this.updateTouchDragGhost(touch.clientX, touch.clientY);
					this.updateDropTargetFeedback(touch.clientX, touch.clientY);
					this.handleAutoScroll(touch.clientX);
				}
			},
			{ passive: false }
		);

		cardWrapper.addEventListener("touchend", (e: TouchEvent) => {
			void (async () => {
				if (this.longPressTimer) {
					window.clearTimeout(this.longPressTimer);
					this.longPressTimer = null;
				}

				if (!this.touchDragActive || this.touchDragType !== "task") return;

				const touch = e.changedTouches[0];
				if (!touch) {
					this.clearTouchDragState();
					return;
				}

				const target = this.findDropTargetAt(touch.clientX, touch.clientY);
				if (target.groupKey && this.draggedTaskPath) {
					const dropTarget =
						target.type === "task"
							? createKanbanDropTarget(target.taskPath, target.above ?? true)
							: undefined;
					const targetContainer =
						target.cardsContainer ??
						target.element?.querySelector<HTMLElement>(
							".kanban-view__cards, .kanban-view__tasks-container"
						) ??
						null;

					const paths = getKanbanDraggedPaths(
						this.draggedTaskPaths,
						this.draggedTaskPath
					);
					const optimisticResult = this.performOptimisticReorder(
						paths,
						dropTarget,
						targetContainer
					);
					this.cleanupDragShift();

					await this.handleTaskDrop(
						this.draggedTaskPath,
						target.groupKey,
						target.swimLaneKey,
						dropTarget,
						{
							optimisticReorderApplied: optimisticResult,
							draggedPaths: paths,
						}
					);
				}

				this.clearTouchDragState();
				resetTouchDragSourceOverride();
			})();
		});

		cardWrapper.addEventListener("touchcancel", () => {
			resetTouchDragSourceOverride();
			this.clearTouchDragState();
		});
	}

	private initiateTouchDrag(
		cardWrapper: HTMLElement,
		task: TaskInfo,
		x: number,
		y: number,
		dragSourceOverride: KanbanTaskDragSource | null = null
	): void {
		this.touchDragActive = true;
		this.touchDragType = "task";
		// Use containerEl.ownerDocument to support pop-out windows
		this.containerEl.ownerDocument.addEventListener(
			"contextmenu",
			this.boundContextMenuBlocker,
			true
		);

		const dragSource = dragSourceOverride ?? {
			taskPath: task.path,
			sourceElement: cardWrapper,
		};
		const draggedTaskPath = dragSource.taskPath;
		const dragImageSource = dragSource.sourceElement;
		const selectionService = this.plugin.taskSelectionService;
		if (
			selectionService?.isSelected(draggedTaskPath) &&
			selectionService.getSelectionCount() > 1
		) {
			this.draggedTaskPaths = selectionService.getSelectedPaths();
			this.draggedTaskPath = draggedTaskPath;
			this.draggedSourceColumns.clear();
			this.draggedSourceSwimlanes.clear();
			for (const path of this.draggedTaskPaths) {
				const wrapper = this.currentTaskElements.get(path);
				if (wrapper) {
					wrapper.classList.add("kanban-view__card--dragging");
					const col = wrapper.closest("[data-group]") as HTMLElement;
					const swimCol = wrapper.closest("[data-column]") as HTMLElement;
					const swimlaneRow = wrapper.closest("[data-swimlane]") as HTMLElement;
					const sourceCol = col?.dataset.group || swimCol?.dataset.column;
					const sourceSwimlane = swimlaneRow?.dataset.swimlane;
					if (sourceCol) this.draggedSourceColumns.set(path, sourceCol);
					if (sourceSwimlane) this.draggedSourceSwimlanes.set(path, sourceSwimlane);
				}
			}
			dragImageSource.classList.add("kanban-view__card--dragging");
		} else {
			this.draggedTaskPath = draggedTaskPath;
			this.draggedTaskPaths = [draggedTaskPath];
			dragImageSource.classList.add("kanban-view__card--dragging");
		}
		this.activeDragSourceElement = dragImageSource;

		const column = cardWrapper.closest("[data-group]") as HTMLElement;
		const swimlaneColumn = cardWrapper.closest("[data-column]") as HTMLElement;
		const swimlaneRow = cardWrapper.closest("[data-swimlane]") as HTMLElement;
		this.draggedFromColumn = column?.dataset.group || swimlaneColumn?.dataset.column || null;
		this.draggedFromSwimlane = swimlaneRow?.dataset.swimlane || null;

		this.touchDragGhost = this.createTouchDragGhost(dragImageSource, x, y);
		navigator.vibrate?.(50);
	}

	private async handleTaskDrop(
		taskPath: string,
		newGroupValue: string,
		newSwimLaneValue: string | null,
		dropTarget?: KanbanDropTarget,
		options: KanbanDropExecutionOptions = {}
	): Promise<void> {
		this.activeDropCount++;
		let dropRequiresPostDropRefresh = true;
		try {
			await this.dropQueue.enqueue(taskPath, async () => {
				// Suppress renders immediately — dragend clears draggedTaskPath
				// during our awaits, so onDataUpdated needs another way to know
				// not to render with stale data.
				this.suppressRenderUntil = Date.now() + 10000; // extended window, tightened at end

				// Get the groupBy property from the controller
				const groupByPropertyId = this.getGroupByPropertyId();
				if (!groupByPropertyId) return;

				// Check if groupBy is a formula - formulas are read-only
				if (groupByPropertyId.startsWith("formula.")) {
					new Notice(
						this.plugin.i18n.translate("views.kanban.errors.formulaGroupingReadOnly")
					);
					return;
				}

				// Check if swimlane is a formula - formulas are read-only
				if (newSwimLaneValue !== null && this.swimLanePropertyId?.startsWith("formula.")) {
					new Notice(
						this.plugin.i18n.translate("views.kanban.errors.formulaSwimlaneReadOnly")
					);
					return;
				}

				const cleanGroupBy = stripPropertyPrefix(groupByPropertyId);
				const isGroupByListProperty =
					this.explodeListColumns && this.isListTypeProperty(cleanGroupBy);

				// Check if swimlane property is also a list type
				const cleanSwimlane = this.swimLanePropertyId
					? stripPropertyPrefix(this.swimLanePropertyId)
					: null;
				const isSwimlaneListProperty =
					cleanSwimlane && this.isListTypeProperty(cleanSwimlane);

				// Snapshot drag state NOW — dragend fires during our awaits and
				// clears these instance properties out from under us.
				const snapshotFromColumn = this.draggedFromColumn;
				const snapshotFromSwimlane = this.draggedFromSwimlane;
				const snapshotSourceColumns = new Map(this.draggedSourceColumns);
				const snapshotSourceSwimlanes = new Map(this.draggedSourceSwimlanes);

				// Handle batch drag - update all dragged tasks
				const requestedDraggedPaths =
					options.draggedPaths && options.draggedPaths.length > 0
						? [...options.draggedPaths]
						: [...this.draggedTaskPaths];
				const pathsToUpdate =
					requestedDraggedPaths.length > 1 ? requestedDraggedPaths : [taskPath];
				const isBatchOperation = pathsToUpdate.length > 1;
				const canFastPatchManualOrder = this.canFastPatchManualOrderDrop(
					options,
					dropTarget,
					pathsToUpdate,
					newGroupValue,
					newSwimLaneValue
				);
				let fastPatchedManualOrder = false;

				// Pre-compute sort_order related state
				const hasSortOrder = isSortOrderInSortConfig(
					this.dataAdapter,
					this.plugin.settings.fieldMapping.sortOrder
				);
				const sortOrderField = this.plugin.settings.fieldMapping.sortOrder;
				const cleanGroupByForSort = stripPropertyPrefix(groupByPropertyId);
				const cleanSwimLaneForSort = this.swimLanePropertyId
					? stripPropertyPrefix(this.swimLanePropertyId)
					: null;
				const sortScopeFilters =
					newSwimLaneValue !== null && cleanSwimLaneForSort
						? [{ property: cleanSwimLaneForSort, value: newSwimLaneValue }]
						: undefined;
				const visibleTaskPaths = this.getVisibleSortScopePaths(
					newGroupValue,
					newSwimLaneValue
				);
				const candidateTaskPaths = this.getCandidateSortScopePaths(
					newGroupValue,
					newSwimLaneValue
				);

				this.debugLog("SORT-ORDER-CHECK", {
					hasDropTarget: !!dropTarget,
					hasSortOrder,
					dropTarget: dropTarget
						? { file: dropTarget.taskPath.split("/").pop(), above: dropTarget.above }
						: null,
				});

				// Detect if the groupBy / swimlane property maps to a known TaskInfo field
				// so we can fire side effects (completedDate, auto-archive, webhooks, etc.)
				const groupByTaskProp = this.plugin.fieldMapper.lookupMappingKey(cleanGroupBy);
				const swimlaneTaskProp = cleanSwimlane
					? this.plugin.fieldMapper.lookupMappingKey(cleanSwimlane)
					: null;

				for (const path of pathsToUpdate) {
					// Get the source column and swimlane for this specific task
					const sourceColumn = isBatchOperation
						? snapshotSourceColumns.get(path)
						: snapshotFromColumn;
					const sourceSwimlane = isBatchOperation
						? snapshotSourceSwimlanes.get(path)
						: snapshotFromSwimlane;
					const dropPlan = planKanbanTaskDropUpdate({
						path,
						sourceColumn,
						sourceSwimlane,
						newGroupValue,
						newSwimLaneValue,
						groupByPropertyId,
						swimLanePropertyId: this.swimLanePropertyId,
						groupByTaskProp,
						swimlaneTaskProp,
						isGroupByListProperty,
						isSwimlaneListProperty: !!isSwimlaneListProperty,
					});

					this.debugLog("HANDLE-DROP-TASK", {
						taskFile: path.split("/").pop(),
						sourceColumn,
						newGroupValue,
						isSameColumn: !dropPlan.needsGroupUpdate,
						isGroupByListProperty,
						sourceSwimlane,
						newSwimLaneValue,
					});

					// Compute sort_order first (read-only — no file writes yet)
					let sortOrderPlan = null;
					if (hasSortOrder) {
						if (dropTarget) {
							this.debugLog("COMPUTE-SORT-ORDER-CALL", {
								taskFile: path.split("/").pop(),
								targetFile: dropTarget.taskPath.split("/").pop(),
								above: dropTarget.above,
								groupKey: newGroupValue,
								cleanGroupBy: cleanGroupByForSort,
								cleanSwimLane: cleanSwimLaneForSort,
							});

							sortOrderPlan = await prepareSortOrderUpdate(
								dropTarget.taskPath,
								dropTarget.above,
								newGroupValue,
								cleanGroupByForSort,
								path,
								this.plugin,
								{
									scopeFilters: sortScopeFilters,
									taskInfoCache: this.taskInfoCache,
									visibleTaskPaths,
									candidateTaskPaths,
								}
							);
							if (sortOrderPlan.sortOrder === null) {
								continue;
							}

							const totalEditedNotes = sortOrderPlan.additionalWrites.length + 1;
							if (totalEditedNotes > this.LARGE_REORDER_WARNING_THRESHOLD) {
								const confirmed = await this.confirmLargeReorder(
									totalEditedNotes,
									newGroupValue,
									newSwimLaneValue
								);
								if (!confirmed) return;
							}
						} else {
							// No specific drop target (cross-column drop without card position).
							// Preserve the task's existing sort_order so it retains its
							// relative position when moved back.  The user can always drop
							// ON a specific card to choose a precise position.
							this.debugLog("SORT-ORDER-CROSS-COLUMN-PRESERVE", {
								taskFile: path.split("/").pop(),
								groupKey: newGroupValue,
							});
						}

						this.debugLog("SORT-ORDER-RESULT", {
							taskFile: path.split("/").pop(),
							newSortOrder: sortOrderPlan?.sortOrder ?? null,
							isNull: sortOrderPlan?.sortOrder === null,
							additionalWrites: sortOrderPlan?.additionalWrites.length ?? 0,
						});
					}

					// Skip file write if nothing to change
					const needsWrite = kanbanDropPlanNeedsWrite(dropPlan, sortOrderPlan !== null);
					if (!needsWrite) continue;

					const file = this.plugin.app.vault.getAbstractFileByPath(path);
					if (!file || !(file instanceof TFile)) continue;

					if (sortOrderPlan) {
						await applySortOrderPlan(path, sortOrderPlan, this.plugin, {
							includeDragged: false,
						});
					}

					// Single atomic write: groupBy + swimlane + sort_order
					await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
						applyKanbanTaskDropFrontmatterPlan(fm, dropPlan, {
							coerceGroupValue: (frontmatterKey, groupKey) =>
								this.coerceGroupKeyForFrontmatter(frontmatterKey, groupKey),
						});

						// Write sort_order
						if (sortOrderPlan?.sortOrder !== null && sortOrderPlan) {
							fm[sortOrderField] = sortOrderPlan.sortOrder;
						}

						const statusDerivativePlan = planKanbanStatusDerivativeUpdate({
							plan: dropPlan,
							task: this.taskInfoCache.get(path),
							dateModifiedField: this.plugin.fieldMapper.toUserField("dateModified"),
							dateModifiedValue: getCurrentTimestamp(),
						});
						if (statusDerivativePlan) {
							this.plugin.taskService.updateCompletedDateInFrontmatter(
								fm,
								statusDerivativePlan.statusValue,
								statusDerivativePlan.isRecurring
							);
							fm[statusDerivativePlan.dateModifiedField] =
								statusDerivativePlan.dateModifiedValue;
						}
					});

					this.debugLog("ATOMIC-WRITE-DONE", {
						taskFile: path.split("/").pop(),
						needsGroupUpdate: dropPlan.needsGroupUpdate,
						needsSwimlaneUpdate: dropPlan.needsSwimlaneUpdate,
						hasSortOrder: sortOrderPlan !== null,
					});

					if (
						canFastPatchManualOrder &&
						dropTarget &&
						sortOrderPlan &&
						!dropPlan.needsGroupUpdate &&
						!dropPlan.needsSwimlaneUpdate
					) {
						fastPatchedManualOrder = this.applyOptimisticSortOrderResult(
							path,
							dropTarget.taskPath,
							dropTarget.above,
							newGroupValue,
							newSwimLaneValue,
							sortOrderPlan
						);
					}

					// Fire post-write side effects for known TaskInfo property changes
					if (dropPlan.changedTaskProp) {
						try {
							const originalTask =
								this.taskInfoCache.get(path) ??
								(await this.plugin.cacheManager.getTaskInfo(path));
							const sideEffectPlan = planKanbanDropSideEffect({
								plan: dropPlan,
								originalTask,
								dateModifiedValue: getCurrentTimestamp(),
								isCompletedStatus: (status) =>
									this.plugin.statusManager.isCompletedStatus(status),
							});
							if (sideEffectPlan) {
								await this.plugin.taskService.applyPropertyChangeSideEffects(
									file,
									originalTask as TaskInfo,
									sideEffectPlan.updatedTask,
									sideEffectPlan.changedTaskProp,
									sideEffectPlan.oldPropValue,
									sideEffectPlan.newPropValue
								);
							}
						} catch (sideEffectError) {
							console.warn(
								"[TaskNotes][KanbanView] Side-effect error after drop:",
								sideEffectError
							);
						}
					}
				}

				// Clear selection after batch move
				if (isBatchOperation) {
					this.plugin.taskSelectionService?.clearSelection();
					this.plugin.taskSelectionService?.exitSelectionMode();
				}

				this.debugLog("HANDLE-DROP-COMPLETE", {
					pathsUpdated: pathsToUpdate.map((p) => p.split("/").pop()),
					fastPatchedManualOrder,
				});
				if (fastPatchedManualOrder) {
					this.pendingRender = false;
					dropRequiresPostDropRefresh = false;
				}
			}); // end dropQueue.enqueue
		} catch (error) {
			console.error("[TaskNotes][KanbanView] Error updating task:", error);
		} finally {
			this.activeDropCount--;
			if (dropRequiresPostDropRefresh) {
				this.postDropRefreshRequested = true;
			}
			if (this.activeDropCount === 0) {
				const shouldRefresh = this.postDropRefreshRequested;
				this.postDropRefreshRequested = false;
				if (shouldRefresh) {
					this.schedulePostDropRender();
				} else {
					this.finishFastPostDrop();
				}
			}
		}
	}

	protected setupContainer(): void {
		super.setupContainer();

		// Use containerEl.ownerDocument for pop-out window support
		const doc = this.containerEl.ownerDocument;
		const board = doc.createElement("div");
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
		if (this.updateDebounceTimer) {
			this.debugLog("DEBOUNCED-REFRESH: cancelling previous pending timer");
			window.clearTimeout(this.updateDebounceTimer);
		}

		this.debugLog("DEBOUNCED-REFRESH: scheduling render in 150ms", {
			activeDropCount: this.activeDropCount,
			suppressRenderRemaining: Math.max(0, this.suppressRenderUntil - Date.now()),
		});

		// Save current scroll state before the timer fires
		const savedState = this.getEphemeralState();

		// Use correct window for pop-out window support
		const win = this.containerEl.ownerDocument.defaultView || window;
		this.updateDebounceTimer = win.setTimeout(() => {
			void (async () => {
				// Respect render suppression — a drop is still in-flight.
				// The post-drop render (schedulePostDropRender) will fire the
				// guaranteed render once the writes have settled.
				if (this.activeDropCount > 0 || Date.now() < this.suppressRenderUntil) {
					this.debugLog("DEBOUNCED-REFRESH-TIMER-FIRED: SKIPPED (drop still in-flight)", {
						activeDropCount: this.activeDropCount,
						suppressRenderRemaining: Math.max(0, this.suppressRenderUntil - Date.now()),
					});
					this.updateDebounceTimer = null;
					return;
				}
				this.debugLog("DEBOUNCED-REFRESH-TIMER-FIRED: executing render now", {
					activeDropCount: this.activeDropCount,
					suppressRenderRemaining: Math.max(0, this.suppressRenderUntil - Date.now()),
				});
				await this.render();
				this.updateDebounceTimer = null;
				// Restore scroll state after render completes
				this.setEphemeralState(savedState);
			})();
		}, 150);
	}

	private static readonly POST_DROP_RENDER_DELAY = 500; // ms

	private debugLog(msg: string, data?: Record<string, unknown>): void {
		this.logger.debug(msg, {
			category: "internal",
			operation: "kanban-debug",
			details: data,
		});
	}

	private schedulePostDropRender(): void {
		this.debugLog("SCHEDULE-POST-DROP-RENDER", { delay: KanbanView.POST_DROP_RENDER_DELAY });
		this.suppressRenderUntil = Date.now() + KanbanView.POST_DROP_RENDER_DELAY;
		this.pendingRender = false;

		if (this.postDropTimer) window.clearTimeout(this.postDropTimer);

		const win = this.containerEl.ownerDocument.defaultView || window;
		this.postDropTimer = win.setTimeout(() => {
			this.debugLog("POST-DROP-TIMER-FIRED: rendering now");
			this.postDropTimer = null;
			this.suppressRenderUntil = 0;
			this.debouncedRefresh();
		}, KanbanView.POST_DROP_RENDER_DELAY);
	}

	private finishFastPostDrop(): void {
		this.debugLog("FAST-POST-DROP-COMPLETE");
		if (this.postDropTimer) {
			window.clearTimeout(this.postDropTimer);
			this.postDropTimer = null;
		}
		this.suppressRenderUntil = 0;
		this.pendingRender = false;
	}

	private renderEmptyState(): void {
		if (!this.boardEl) return;
		// Use containerEl.ownerDocument for pop-out window support
		const doc = this.containerEl.ownerDocument;
		const empty = doc.createElement("div");
		empty.className = "tn-bases-empty";
		empty.textContent = "No tasknotes tasks found for this base.";
		this.boardEl.appendChild(empty);
	}

	private renderNoGroupByError(): void {
		if (!this.boardEl) return;
		// Use containerEl.ownerDocument for pop-out window support
		const doc = this.containerEl.ownerDocument;
		const error = doc.createElement("div");
		error.className = "tn-bases-error";
		error.textContent = this.plugin.i18n.translate("views.kanban.errors.noGroupBy");
		this.boardEl.appendChild(error);
	}

	renderError(error: Error): void {
		if (!this.boardEl) return;
		// Use containerEl.ownerDocument for pop-out window support
		const doc = this.containerEl.ownerDocument;
		const errorEl = doc.createElement("div");
		errorEl.className = "tn-bases-error";
		errorEl.textContent = `Error loading kanban: ${error.message || "Unknown error"}`;
		this.boardEl.appendChild(errorEl);
	}

	private getGroupDisplayTitle(title: string, propertyId?: string | null): string {
		if (!propertyId) {
			return title;
		}

		const cleanProperty = stripPropertyPrefix(propertyId);

		const statusField = this.plugin.fieldMapper.toUserField("status");
		if (cleanProperty === statusField) {
			const statusConfig = this.plugin.statusManager.getStatusConfig(title);
			if (statusConfig?.label) {
				return statusConfig.label;
			}
		}

		const priorityField = this.plugin.fieldMapper.toUserField("priority");
		if (cleanProperty === priorityField) {
			const priorityConfig = this.plugin.priorityManager.getPriorityConfig(title);
			if (priorityConfig?.label) {
				return priorityConfig.label;
			}
		}

		return title;
	}

	private renderGroupTitleWrapper(
		container: HTMLElement,
		title: string,
		isSwimLane = false,
		skipIcon = false
	): void {
		// When grouped by status (column or swimlane), show label instead of raw value
		const isStatusGrouping = isSwimLane ? this.isSwimLaneByStatus() : this.isGroupedByStatus();
		if (isStatusGrouping) {
			const statusConfig = this.plugin.statusManager.getStatusConfig(title);
			if (statusConfig) {
				// Only show icon in title when consolidation is enabled
				if (this.consolidateStatusIcon && !skipIcon && statusConfig.icon) {
					const iconEl = container.createSpan({ cls: "kanban-view__column-icon" });
					iconEl.style.color = statusConfig.color;
					setIcon(iconEl, statusConfig.icon);
				}
				this.renderLinkAwareGroupTitle(container, statusConfig.label);
				return;
			}
		}

		// Default: use link-aware title rendering
		const propertyId = isSwimLane ? this.swimLanePropertyId : this.getGroupByPropertyId();
		const displayTitle = this.getGroupDisplayTitle(title, propertyId);
		this.renderLinkAwareGroupTitle(container, displayTitle);
	}

	private renderLinkAwareGroupTitle(container: HTMLElement, title: string): void {
		const app = this.app || this.plugin.app;
		const linkServices: LinkServices = {
			metadataCache: app.metadataCache,
			workspace: app.workspace,
		};
		renderGroupTitle(container, title, linkServices);
	}

	private applyColumnOrder(groupBy: string, actualKeys: string[]): string[] {
		return applyKanbanColumnOrder({
			groupBy,
			actualKeys,
			columnOrders: this.columnOrders,
			hideEmptyColumns: this.hideEmptyColumns,
			pinnedColumns: this.pinnedColumns,
			isPriorityField: (propertyId) => this.isPropertyField(propertyId, "priority"),
			isStatusField: (propertyId) => this.isPropertyField(propertyId, "status"),
			getPriorityWeight: (key) => this.plugin.priorityManager.getPriorityWeight(key),
			findStatusConfig: (key) => this.findStatusConfigForGroupKey(key),
		});
	}

	private applySwimLaneOrder(swimLanePropertyId: string | null, actualKeys: string[]): string[] {
		return applyKanbanSwimLaneOrder({
			swimLanePropertyId,
			actualKeys,
			swimLaneOrders: this.swimLaneOrders,
			hideEmptySwimLanes: this.hideEmptySwimLanes,
			isPriorityField: (propertyId) => this.isPropertyField(propertyId, "priority"),
			isStatusField: (propertyId) => this.isPropertyField(propertyId, "status"),
			getPriorityWeight: (key) => this.plugin.priorityManager.getPriorityWeight(key),
			getStatusOrder: (key) => this.plugin.statusManager.getStatusOrder(key),
		});
	}

	private isPropertyField(propertyId: string | null, field: "priority" | "status"): boolean {
		if (!propertyId) {
			return false;
		}

		return stripPropertyPrefix(propertyId) === this.plugin.fieldMapper.toUserField(field);
	}

	private applySwimLaneOrderToMap(
		swimLanePropertyId: string | null,
		swimLanes: Map<string, Map<string, TaskInfo[]>>,
		columnKeys: string[]
	): Map<string, Map<string, TaskInfo[]>> {
		return applyKanbanSwimLaneOrderToMap({
			swimLanePropertyId,
			swimLanes,
			columnKeys,
			swimLaneOrders: this.swimLaneOrders,
			hideEmptySwimLanes: this.hideEmptySwimLanes,
			isPriorityField: (propertyId) => this.isPropertyField(propertyId, "priority"),
			isStatusField: (propertyId) => this.isPropertyField(propertyId, "status"),
			getPriorityWeight: (key) => this.plugin.priorityManager.getPriorityWeight(key),
			getStatusOrder: (key) => this.plugin.statusManager.getStatusOrder(key),
		});
	}

	private async saveColumnOrder(groupBy: string, order: string[]): Promise<void> {
		// Update in-memory state
		this.columnOrders[groupBy] = order;

		try {
			// Serialize to JSON
			const orderJson = JSON.stringify(this.columnOrders);

			// Save to config using BasesViewConfig API
			this.config.set("columnOrder", orderJson);
		} catch (error) {
			console.error("[KanbanView] Failed to save column order:", error);
		}
	}

	/**
	 * Get consistent card rendering options for all kanban cards
	 */
	private getCardOptions(): TaskCardOptions {
		// Use UTC-anchored "today" for correct recurring task completion status
		const now = new Date();
		const targetDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

		// Hide status indicators on cards when consolidation is enabled and grouped by status
		const hideStatusIndicator = this.consolidateStatusIcon && this.isGroupedByStatus();

		return this.buildTaskCardOptions({
			layout: this.cardLayout,
			targetDate,
			hideStatusIndicator,
			expandedRelationshipFilterMode: this.expandedRelationshipFilterMode,
			resolveExpandedRelationshipFilterMode: (): "inherit" | "show-all" =>
				normalizeExpandedRelationshipFilterMode(
					this.config?.get("expandedRelationshipFilterMode")
				),
			expandedRelationshipTaskPaths: this.currentVisibleTaskPaths,
			expandedRelationshipTaskOrder: this.currentVisibleTaskOrder,
		});
	}

	private setCurrentVisibleTaskPaths(tasks: TaskInfo[]): void {
		this.currentVisibleTaskPaths.clear();
		this.currentVisibleTaskOrder.clear();
		tasks.forEach((task, index) => {
			this.currentVisibleTaskPaths.add(task.path);
			this.currentVisibleTaskOrder.set(task.path, index);
		});
	}

	/**
	 * Check if the view is currently grouped by the status property
	 */
	private isGroupedByStatus(): boolean {
		const groupByPropertyId = this.getGroupByPropertyId();
		if (!groupByPropertyId) return false;

		const statusPropertyName = this.plugin.fieldMapper.toUserField("status");
		const cleanGroupBy = groupByPropertyId.replace(/^(note\.|file\.|task\.)/, "");
		return cleanGroupBy === statusPropertyName;
	}

	/**
	 * Check if swimlanes are grouped by the status property
	 */
	private isSwimLaneByStatus(): boolean {
		if (!this.swimLanePropertyId) return false;

		const statusPropertyName = this.plugin.fieldMapper.toUserField("status");
		const cleanSwimLane = this.swimLanePropertyId.replace(/^(note\.|file\.|task\.)/, "");
		return cleanSwimLane === statusPropertyName;
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
		await showTaskContextMenu(
			event,
			context.task.path,
			this.plugin,
			getKanbanTaskActionDate(context.task)
		);
	};

	private async handleCardAction(
		action: string,
		task: TaskInfo,
		target: HTMLElement,
		event: MouseEvent
	): Promise<void> {
		await handleKanbanCardAction({
			action,
			task,
			target,
			event,
			plugin: this.plugin,
			app: this.app || this.plugin.app,
		});
	}

	private async handleToggleStatus(task: TaskInfo, event: MouseEvent): Promise<void> {
		await handleKanbanCardAction({
			action: "toggle-status",
			task,
			target: this.containerEl,
			event,
			plugin: this.plugin,
			app: this.app || this.plugin.app,
		});
	}

	private getTaskActionDate(task: TaskInfo): Date {
		return getKanbanTaskActionDate(task);
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
		if (this.postDropTimer) {
			window.clearTimeout(this.postDropTimer);
			this.postDropTimer = null;
		}
		this.suppressRenderUntil = 0;

		// Component.register() calls will be automatically cleaned up
		// We just need to clean up view-specific state
		this.unregisterBoardListeners();
		this.cleanupFloatingDragPreview();
		this.destroyColumnScrollers();
		this.currentTaskElements.clear();
		this.taskInfoCache.clear();
		this.sortScopeTaskPaths.clear();
		this.boardEl = null;
	}
}

/**
 * Factory function for Bases registration.
 * Returns an actual KanbanView instance adapted to the BasesView factory type.
 */
export function buildKanbanViewFactory(plugin: TaskNotesPlugin): BasesViewFactory {
	return function (controller: unknown, containerEl: HTMLElement): BasesView {
		if (!containerEl) {
			console.error("[TaskNotes][KanbanView] No containerEl provided");
			throw new Error("KanbanView requires a containerEl");
		}

		// Create and return the view instance directly; Bases assigns runtime view fields.
		return new KanbanView(controller, containerEl, plugin) as unknown as BasesView;
	};
}
