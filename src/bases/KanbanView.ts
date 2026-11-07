import { changeTaskProperty, showTaskUndo, taskMovementMessage, type TaskUndoFeedback } from "../ui/taskPropertyPickers";
import { openTaskPropertySettings } from "../settings/TaskNotesSettingTab";
import { unconfiguredValueLabel } from "../ui/kit/glyphs";
import { buildTaskMovementUndo, type TaskMovementUndoChange } from "./taskMovementUndo";
import { createFileUndo, type FileUndoReceipt } from "../ui/taskMutationUndo";
import { renderKanbanHeaderGlyph, resolveKanbanStatusColor } from "./kanbanStatusPresentation";
import { KanbanDragPreview } from "./kanbanDragPreview";
import { createKanbanCardScroller } from "./kanbanCardScroller";
import { displayError } from "../i18n/runtime";
import { configLabel } from "../i18n/configLabels";
import { uiText } from "../i18n/runtime";
import { msg } from "@lingui/core/macro";
/* eslint-disable @typescript-eslint/no-non-null-assertion -- Legacy Bases view rendering narrows DOM references through lifecycle checks. */
import { Notice, Platform, setIcon, setTooltip, TFile } from "obsidian";
import { openPopover } from "../ui/kit/popover";
import type { BasesView, BasesViewFactory } from "obsidian";
import TaskNotesPlugin from "../main";
import { BasesViewBase } from "./BasesViewBase";
import { readBasesViewConfigValue, readBasesViewPropertyId } from "./basesViewConfig";
import type { StatusConfig, TaskInfo } from "../types";
import { identifyTaskNotesFromBasesData } from "./helpers";
import { createTaskCard, showTaskContextMenu, type TaskCardOptions } from "../ui/TaskCard";
import { renderGroupTitle } from "./groupTitleRenderer";
import { groupKeyLabel, NONE_GROUP_KEY, TRUE_GROUP_KEY, FALSE_GROUP_KEY } from "./groupKeys";
import { type LinkServices } from "../ui/renderers/linkRenderer";
import { showConfirmationModal } from "../modals/ConfirmationModal";
import { VirtualScroller } from "../utils/VirtualScroller";
import { getCurrentTimestamp } from "../utils/dateUtils";
import { getProjectDisplayName } from "../utils/linkUtils";
import { stringifyUnknown } from "../utils/stringUtils";
import {
	stripPropertyPrefix,
	isSortOrderInSortConfig,
	getSortOrderDirection,
	prepareSortOrderUpdate,
	DropOperationQueue,
	type SortOrderPlan,
} from "./sortOrderUtils";
import {
	applySortOrderUpdatesToItems,
	applySortOrderUpdatesToTaskCache,
	buildSortOrderUpdateMap,
	captureTaskViewScroll,
	movePathsRelativeToTarget,
} from "./manualOrderState";
import { getKanbanTaskActionDate, handleKanbanCardAction } from "./kanbanCardActions";
import { clearStaticStyleClasses } from "../utils/staticStyleClasses";
import { setElementDragImage } from "../utils/dragImage";
import { createElementInDocument } from "../utils/documentDom";
import {
	applyKanbanTaskDropFrontmatterPlan,
	clearKanbanDropMarkers,
	createKanbanDropTarget,
	getKanbanCardDropTargetFromClientY,
	getKanbanDraggedPaths,
	getKanbanDropStatusValue,
	kanbanDropPlanNeedsWrite,
	performKanbanOptimisticReorder,
	planKanbanDropSideEffect,
	planKanbanStatusDerivativeUpdate,
	planKanbanTaskDropUpdate,
	reconstructKanbanDropTargetFromContainer,
	resolveKanbanContainerDropTarget,
	resolveNestedTaskCardDragSource,
	updateKanbanDropMarker,
	type KanbanDropTarget,
	type KanbanTaskDropUpdatePlan,
	type KanbanTaskDragSource,
} from "./kanbanDragUtils";
import {
	completeOccurrenceForStatusMove,
	getShownOccurrence,
	type ShownOccurrence,
} from "./recurringStatusMove";
import {
	buildBasesPathProperties,
	computeBasesFormulas,
	populateBasesFormulaProperty,
	isObsidianListProperty,
	getObsidianPropertyType,
} from "./basesViewAdapters";
import { applyKanbanCreationDefault } from "./kanbanCreationDefaults";
import { coerceGroupKeyForFrontmatter as coercePropertyGroupKeyForFrontmatter } from "./propertyValueCoercion";
import {
	buildKanbanTaskGroups,
	applyKanbanColumnOrder,
	applyKanbanSwimLaneOrder,
	reorderKanbanSwimLaneKeys,
	applyKanbanSwimLaneOrderToMap,
	buildKanbanSwimlaneColumns,
	canonicalizeKanbanConfiguredGroupKey,
	findKanbanStatusConfigForGroupKey,
	formatKanbanColumnCount,
	getKanbanColumnTaskCounts,
	getVisibleKanbanSwimLaneColumnKeys,
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
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import { TASK_PATH_DRAG_TYPE } from "../utils/DragDropManager";
import { isSupportedColorValue, normalizeThemeColor } from "../utils/themeColors";
import { processVaultFrontMatter } from "../services/VaultMutationService";

const SWIMLANE_DRAG_TYPE = "text/x-kanban-swimlane";

/** Swimlane row drags must not be handled as task drops. */
function isSwimLaneDrag(e: DragEvent): boolean {
	return e.dataTransfer?.types.includes(SWIMLANE_DRAG_TYPE) ?? false;
}

const tasknotesLogger = createTaskNotesLogger({ tag: "Bases/KanbanView" });

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
	boardScrollLeft?: unknown;
	boardScrollTop?: unknown;
	scrollTop?: unknown;
	columnScroll?: unknown;
};

type KanbanDropExecutionOptions = {
	optimisticReorderApplied?: boolean;
	draggedPaths?: readonly string[];
};

type SuccessfulKanbanDropLocalPatchInput = {
	path: string;
	dropPlan: KanbanTaskDropUpdatePlan;
	dropTarget?: KanbanDropTarget;
	sortOrderPlan: SortOrderPlan | null;
	updatedTask?: TaskInfo | null;
	optimisticReorderApplied: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isKanbanEphemeralState(value: unknown): value is KanbanEphemeralState {
	return isRecord(value);
}

function escapeAttributeSelectorValue(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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
	private columnNav: HTMLElement | null = null;
	private activeNavigatorColumn: string | null = null;
	private columnSelect: HTMLSelectElement | null = null;
	private previousColumn: HTMLButtonElement | null = null;
	private nextColumn: HTMLButtonElement | null = null;
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
	private taskDropAccepted = false;
	private structureDragActive = false;
	private dragTargetColumnEl: HTMLElement | null = null; // Target column element (max-height expanded during drag)
	private activeDragSourceElement: HTMLElement | null = null;
	private dragPreview = new KanbanDragPreview();
	private draggedSourceColumns: Map<string, string> = new Map(); // Track source column per task for batch operations
	private draggedSourceSwimlanes: Map<string, string> = new Map(); // Track source swimlane per task for batch operations
	private taskInfoCache = new Map<string, TaskInfo>();
	private sortScopeTaskPaths = new Map<string, string[]>();
	private sortScopeCandidateTaskPaths = new Map<string, string[]>();
	private containerListenersRegistered = false;
	private columnScrollers = new Map<string, VirtualScroller<TaskInfo>>(); // columnKey -> scroller
	/** Collapsed column values keyed by grouping property, saved in the .base view config. */
	private collapsedColumns: Record<string, string[]> = {};
	private expandedEmptyColumns = new Set<string>();
	private expandedRelationshipFilterMode: TaskCardOptions["expandedRelationshipFilterMode"] =
		"inherit";
	private currentVisibleTaskPaths = new Set<string>();
	private currentVisibleTaskOrder = new Map<string, number>();
	private expandedRelationshipTaskPaths = new Set<string>();
	private expandedRelationshipTaskOrder = new Map<string, number>();
	private hideTopLevelSubtasks = false;
	private suppressRenderUntil = 0;
	private postDropTimer: number | null = null;
	private dropQueue = new DropOperationQueue();
	private activeDropCount = 0;
	private postDropRefreshRequested = false;

	// Touch drag state for mobile
	private touchDragActive = false;
	private touchDragGhost: HTMLElement | null = null;
	// Retain references so even moved or detached sources regain hit-testing.
	private touchDragSources = new Set<HTMLElement>();
	private touchStartX = 0;
	private touchStartY = 0;
	private longPressTimer: number | null = null;
	private autoScrollTimer: number | null = null;
	private autoScrollDirection = 0;
	private autoScrollVertical = 0;
	private autoScrollContainer: HTMLElement | null = null;
	private autoScrollPointerX = 0;
	private autoScrollPointerY = 0;
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
	/** Full swimlane order at the last render, including rows that are not shown. */
	private currentSwimLaneOrder: string[] = [];
	private hideEmptySwimLanes = false;
	private cardLayout: TaskCardOptions["layout"] = "default";
	private configLoaded = false; // Track if we've successfully loaded config
	private restoreDragScroll: (() => void) | null = null;
	private renderRevision = 0;
	private renderingBoard = false;
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
		this.registerEvent(this.plugin.emitter.on("settings-changed", () => this.debouncedRefresh()));
		this.registerEvent(this.plugin.app.workspace.on("css-change", () => this.debouncedRefresh()));
	}

	/**
	 * BasesView lifecycle: Called when Bases data changes.
	 * Override to preserve scroll position during re-renders.
	 */
	onDataUpdated(): void {
		// During drag: defer render (destroying DOM kills drop events)
		if (this.draggedTaskPath || this.structureDragActive || this.touchDragActive) {
			this.debugLog("ON-DATA-UPDATED: deferred (drag active)", {
				draggedTask: this.draggedTaskPath?.split("/").pop(),
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

		try {
			void this.render();
		} catch (error) {
			tasknotesLogger.error(`[TaskNotes][${this.type}] Render error:`, {
				category: "internal",
				operation: "render-kanban-view",
				error: error,
			});
			this.renderError(error as Error);
		}
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
			const get = (key: string): unknown => readBasesViewConfigValue(this.config, key);
			this.swimLanePropertyId = readBasesViewPropertyId(this.config, "swimLane");
			this.columnWidth = (get("columnWidth") as number) || 280;
			this.maxSwimlaneHeight = (get("maxSwimlaneHeight") as number) || 600;
			this.hideEmptyColumns = get("hideEmptyColumns") === true;

			// Read explodeListColumns option (defaults to true)
			const explodeValue = get("explodeListColumns");
			this.explodeListColumns = explodeValue !== false; // Default to true if not set

			// Read consolidateStatusIcon option (defaults to false)
			const consolidateValue = get("consolidateStatusIcon");
			this.consolidateStatusIcon = consolidateValue === true; // Default to false if not set

			// Read column orders
			this.columnOrders = normalizeKanbanOrderConfig(get("columnOrder"));
			this.collapsedColumns = normalizeKanbanOrderConfig(get("collapsedColumns"));
			this.pinnedColumns = normalizePinnedColumnConfig(get("pinnedColumns"));
			this.wipLimits = normalizeKanbanWipLimitsConfig(get("wipLimits"));

			// Read swimlane orders. Support both the public singular key and the
			// originally proposed plural key for manually-authored Bases YAML.
			this.swimLaneOrders = normalizeKanbanOrderConfig(
				get("swimLaneOrder") ?? get("swimLaneOrders")
			);
			this.hideEmptySwimLanes = get("hideEmptySwimLanes") === true;
			this.cardLayout = normalizeKanbanCardLayout(get("cardLayout"));

			// Read enableSearch toggle (default: false for backward compatibility)
			const enableSearchValue = get("enableSearch");
			this.updateSearchConfiguration((enableSearchValue as boolean) ?? false);
			const expandedRelationshipFilterModeValue = get("expandedRelationshipFilterMode");
			this.expandedRelationshipFilterMode = normalizeExpandedRelationshipFilterMode(
				expandedRelationshipFilterModeValue
			);
			this.hideTopLevelSubtasks = get("hideTopLevelSubtasks") === true;

			// Mark config as successfully loaded
			this.configLoaded = true;
		} catch (e) {
			// Use defaults
			tasknotesLogger.warn("[KanbanView] Failed to parse config:", {
				category: "configuration",
				operation: "parse-config",
				error: e,
			});
		}
	}

	/**
	 * Save ephemeral state including scroll positions for all columns.
	 * This preserves scroll position when the view is re-rendered (e.g., after task updates).
	 */
	getEphemeralState(): unknown {
		const baseState = super.getEphemeralState();
		const baseStateObject = isRecord(baseState) ? baseState : {};
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
			...baseStateObject,
			scrollTop: this.rootElement?.scrollTop || 0,
			boardScrollLeft: this.boardEl?.scrollLeft || 0,
			boardScrollTop: this.boardEl?.scrollTop || 0,
			columnScroll,
		};
	}

	/**
	 * Restore ephemeral state including scroll positions for all columns.
	 */
	setEphemeralState(state: unknown): void {
		if (!isKanbanEphemeralState(state)) return;
		super.setEphemeralState(state);
		const columnScroll = getColumnScrollState(state);
		if (this.boardEl) {
			if (typeof state.boardScrollLeft === "number") this.boardEl.scrollLeft = state.boardScrollLeft;
			if (typeof state.boardScrollTop === "number") this.boardEl.scrollTop = state.boardScrollTop;
		}

		if (typeof state.scrollTop === "number" && this.rootElement) {
			this.rootElement.scrollTop = state.scrollTop;
		}

		// Restore column scroll positions after render completes
		if (columnScroll) {
			for (const [columnKey, scroller] of this.columnScrollers) {
				const scrollTop = columnScroll[columnKey];
				if (scrollTop !== undefined) {
					const scrollContainer = (
						scroller as unknown as VirtualScrollerWithContainer
					).scrollContainer;
					if (scrollContainer) scrollContainer.scrollTop = scrollTop;
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
		}
	}

	async render(): Promise<void> {
		if (!this.boardEl || !this.rootElement) return;
		const navigatorColumn = this.activeNavigatorColumn;
		if (!this.data?.data) return;
		if (this.draggedTaskPath || this.structureDragActive || this.touchDragActive) {
			this.pendingRender = true;
			return;
		}

		const revision = ++this.renderRevision;
		let savedState: unknown;
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
			if (revision !== this.renderRevision) return;
			if (this.draggedTaskPath || this.structureDragActive || this.touchDragActive) {
				this.pendingRender = true;
				return;
			}

			// Apply search filter
			const filteredTasks = this.applySearchFilter(taskNotes);
			this.setExpandedRelationshipTaskScope(filteredTasks);
			const renderTasks = this.getTopLevelRenderTasks(filteredTasks);
			const candidateTasks = this.getTopLevelRenderTasks(taskNotes);
			this.setCurrentVisibleTaskPaths(renderTasks);

			// Saving a collapse toggle re-renders the board; keep keyboard focus on that toggle.
			const focusedCollapseColumn = this.getFocusedCollapseColumn();
			savedState = this.getEphemeralState();
			this.renderingBoard = true;

			// Clear board and cleanup scrollers
			this.destroyColumnScrollers();
			this.boardEl.empty();
			this.sortScopeTaskPaths.clear();
			this.sortScopeCandidateTaskPaths.clear();

			if (
				renderTasks.length === 0 &&
				!(
					filteredTasks.length > 0 &&
					!this.hideEmptySwimLanes &&
					this.isPropertyField(this.swimLanePropertyId, "priority")
				)
			) {
				// Show "no results" if search returned empty but we had tasks
				if (this.isSearchWithNoResults(filteredTasks, taskNotes.length)) {
					this.renderSearchNoResults(this.boardEl);
				} else {
					this.renderEmptyState();
				}
				return;
			}

			// Build path -> props map for dynamic property access
			const pathToProps = buildBasesPathProperties(dataItems);
			if (this.swimLanePropertyId) {
				populateBasesFormulaProperty(dataItems, pathToProps, this.swimLanePropertyId);
			}

			// Determine groupBy property ID
			const groupByPropertyId = this.getGroupByPropertyId();

			if (!groupByPropertyId) {
				// No groupBy - show error
				this.renderNoGroupByError();
				return;
			}

			// Group tasks
			const groups = this.groupTasks(renderTasks, groupByPropertyId, pathToProps);
			const allGroups = this.groupTasks(candidateTasks, groupByPropertyId, pathToProps);

			// Render swimlanes if configured
			if (this.swimLanePropertyId) {
				await this.renderWithSwimLanes(
					groups,
					renderTasks,
					allGroups,
					candidateTasks,
					pathToProps,
					groupByPropertyId
				);
			} else {
				await this.renderFlat(groups, allGroups);
			}
			if (revision !== this.renderRevision) return;
			this.renderingBoard = false;
			this.updateBoardLayout();
			this.setEphemeralState(savedState);
			this.activeNavigatorColumn = navigatorColumn;
			this.updateColumnNavigator();
			this.restoreCollapseButtonFocus(focusedCollapseColumn);
		} catch (error: unknown) {
			tasknotesLogger.error("[TaskNotes][KanbanView] Error rendering:", {
				category: "internal",
				operation: "rendering",
				error: error,
			});
			this.renderError(error instanceof Error ? error : new Error(String(error)));
		} finally {
			if (revision === this.renderRevision) this.renderingBoard = false;
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

	private canFastPatchCrossScopeDrop(
		options: KanbanDropExecutionOptions,
		pathsToUpdate: readonly string[]
	): boolean {
		return pathsToUpdate.length === 1 && (options.draggedPaths?.length ?? 1) === 1;
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
		if (!this.hideTopLevelSubtasks) {
			this.expandedRelationshipTaskPaths.clear();
			this.expandedRelationshipTaskOrder.clear();
			paths.forEach((path, index) => {
				this.expandedRelationshipTaskPaths.add(path);
				this.expandedRelationshipTaskOrder.set(path, index);
			});
		}
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

	private applySuccessfulKanbanDropLocally({
		path,
		dropPlan,
		dropTarget,
		sortOrderPlan,
		updatedTask,
		optimisticReorderApplied,
	}: SuccessfulKanbanDropLocalPatchInput): boolean {
		if (
			(!dropPlan.needsGroupUpdate && !dropPlan.needsSwimlaneUpdate) ||
			dropPlan.isGroupByListProperty ||
			dropPlan.isSwimlaneListProperty
		) {
			return false;
		}

		const sourceGroupKey = dropPlan.sourceColumn;
		if (!sourceGroupKey) {
			return false;
		}

		const sourceSwimLaneKey = this.swimLanePropertyId
			? (dropPlan.sourceSwimlane ?? null)
			: null;
		const targetGroupKey = dropPlan.newGroupValue;
		const targetSwimLaneKey = this.swimLanePropertyId ? dropPlan.newSwimLaneValue : null;
		const sourceScopePaths = this.getVisibleSortScopePaths(sourceGroupKey, sourceSwimLaneKey);
		const targetScopePaths = this.getVisibleSortScopePaths(targetGroupKey, targetSwimLaneKey);
		if (!sourceScopePaths || !targetScopePaths || !sourceScopePaths.includes(path)) {
			return false;
		}

		const nextSourceScopePaths = sourceScopePaths.filter((scopePath) => scopePath !== path);
		const nextTargetScopePaths = this.insertPathIntoDropScope(
			targetScopePaths,
			path,
			dropTarget
		);
		if (!nextTargetScopePaths) {
			return false;
		}

		const nextVisiblePaths = this.moveVisiblePathForDrop(path, dropTarget);
		if (!nextVisiblePaths) {
			return false;
		}

		const task =
			updatedTask ?? this.buildTaskInfoForLocalDropPatch(path, dropPlan, sortOrderPlan);
		if (!task) {
			return false;
		}
		const sortOrdersByPath = sortOrderPlan
			? buildSortOrderUpdateMap(path, sortOrderPlan)
			: new Map<string, string>();
		const draggedSortOrder = sortOrdersByPath.get(path);
		if (draggedSortOrder) {
			task.sortOrder = draggedSortOrder;
		}

		const sourceScroller = this.columnScrollers.get(
			this.getColumnScrollerKey(sourceGroupKey, sourceSwimLaneKey)
		);
		const targetScroller = this.columnScrollers.get(
			this.getColumnScrollerKey(targetGroupKey, targetSwimLaneKey)
		);
		const targetInsertOptions = {
			items: [task],
			targetKey: dropTarget?.taskPath,
			position: dropTarget ? (dropTarget.above ? "before" : "after") : "end",
		} as const;

		if (sourceScroller && !sourceScroller.canRemoveItems([path])) {
			return false;
		}
		if (targetScroller && !targetScroller.canInsertItems(targetInsertOptions)) {
			return false;
		}
		if (!targetScroller && !this.getTaskContainerForScope(targetGroupKey, targetSwimLaneKey)) {
			return false;
		}
		if (!targetScroller && !optimisticReorderApplied && !dropTarget) {
			return false;
		}

		if (sourceScroller && !sourceScroller.removeItems([path])) {
			return false;
		}
		if (targetScroller) {
			if (!targetScroller.insertItems(targetInsertOptions)) {
				return false;
			}
			targetScroller.invalidateItems([path]);
			this.removeNormalRenderedTask(path);
		} else if (
			!this.renderNormalTaskInDropScope(task, targetGroupKey, targetSwimLaneKey, dropTarget)
		) {
			return false;
		}

		this.taskInfoCache.set(path, task);
		applySortOrderUpdatesToTaskCache(this.taskInfoCache, sortOrdersByPath);
		for (const scroller of [sourceScroller, targetScroller]) {
			if (!scroller) continue;
			const scrollerItems = scroller.getItems();
			applySortOrderUpdatesToItems(
				scrollerItems,
				(item) => item,
				sortOrdersByPath,
				(updated) => {
					this.taskInfoCache.set(updated.path, updated);
				}
			);
			const scrollerPaths = new Set(scrollerItems.map((item) => item.path));
			const keysToInvalidate = [...sortOrdersByPath.keys()].filter((key) =>
				scrollerPaths.has(key)
			);
			scroller.invalidateItems(keysToInvalidate);
		}

		this.setSortScopePathsForScope(sourceGroupKey, sourceSwimLaneKey, nextSourceScopePaths);
		this.setSortScopePathsForScope(targetGroupKey, targetSwimLaneKey, nextTargetScopePaths);
		this.setCurrentVisibleTaskPathOrder(nextVisiblePaths);
		this.updateScopeEmptyHint(sourceGroupKey, sourceSwimLaneKey);
		this.updateScopeEmptyHint(targetGroupKey, targetSwimLaneKey);
		this.updateCountDisplaysForScope(sourceGroupKey, sourceSwimLaneKey);
		this.updateCountDisplaysForScope(targetGroupKey, targetSwimLaneKey);
		return true;
	}

	private insertPathIntoDropScope(
		scopePaths: readonly string[],
		path: string,
		dropTarget?: KanbanDropTarget
	): string[] | null {
		const withoutPath = scopePaths.filter((scopePath) => scopePath !== path);
		if (!dropTarget) {
			return [...withoutPath, path];
		}
		if (!withoutPath.includes(dropTarget.taskPath)) {
			return null;
		}
		return movePathsRelativeToTarget(
			[...withoutPath, path],
			[path],
			dropTarget.taskPath,
			dropTarget.above
		);
	}

	private moveVisiblePathForDrop(path: string, dropTarget?: KanbanDropTarget): string[] | null {
		const visiblePaths = this.getCurrentVisibleTaskPathOrder();
		if (!visiblePaths.includes(path)) {
			return null;
		}
		if (!dropTarget) {
			return [...visiblePaths.filter((visiblePath) => visiblePath !== path), path];
		}
		if (!visiblePaths.includes(dropTarget.taskPath)) {
			return null;
		}
		return movePathsRelativeToTarget(
			visiblePaths,
			[path],
			dropTarget.taskPath,
			dropTarget.above
		);
	}

	private buildTaskInfoForLocalDropPatch(
		path: string,
		dropPlan: KanbanTaskDropUpdatePlan,
		sortOrderPlan: SortOrderPlan | null
	): TaskInfo | null {
		const cachedTask = this.taskInfoCache.get(path);
		if (!cachedTask) {
			return null;
		}

		const task: TaskInfo = {
			...cachedTask,
			customProperties: { ...(cachedTask.customProperties ?? {}) },
		};
		if (dropPlan.needsGroupUpdate) {
			this.applyLocalDropValue(
				task,
				dropPlan.groupByTaskProp,
				dropPlan.groupByFrontmatterKey,
				dropPlan.newGroupValue
			);
		}
		if (
			dropPlan.needsSwimlaneUpdate &&
			dropPlan.swimlaneFrontmatterKey &&
			dropPlan.newSwimLaneValue !== null
		) {
			this.applyLocalDropValue(
				task,
				dropPlan.swimlaneTaskProp,
				dropPlan.swimlaneFrontmatterKey,
				dropPlan.newSwimLaneValue
			);
		}
		if (sortOrderPlan?.sortOrder) {
			task.sortOrder = sortOrderPlan.sortOrder;
		}
		return task;
	}

	private applyLocalDropValue(
		task: TaskInfo,
		taskProp: string | null,
		frontmatterKey: string,
		value: string
	): void {
		const localValue = value === NONE_GROUP_KEY ? null : value;
		if (taskProp) {
			(task as unknown as Record<string, unknown>)[taskProp] = localValue;
		}
		task.customProperties = {
			...(task.customProperties ?? {}),
			[frontmatterKey]: localValue,
		};
	}

	private createRenderedTaskWrapper(task: TaskInfo): HTMLElement {
		const doc = this.containerEl.ownerDocument;
		const cardWrapper = createElementInDocument(doc, "div");
		cardWrapper.className = "kanban-view__card-wrapper";
		cardWrapper.setAttribute("draggable", "true");
		cardWrapper.setAttribute("data-task-path", task.path);
		const card = createTaskCard(
			task,
			this.plugin,
			this.getVisibleProperties(),
			this.getCardOptions()
		);
		cardWrapper.appendChild(card);
		this.setupCardDragHandlers(cardWrapper, task);
		return cardWrapper;
	}

	private renderNormalTaskInDropScope(
		task: TaskInfo,
		groupKey: string,
		swimLaneKey: string | null,
		dropTarget?: KanbanDropTarget
	): boolean {
		const targetContainer = this.getTaskContainerForScope(groupKey, swimLaneKey);
		if (!targetContainer) {
			return false;
		}

		const existingWrapper = this.currentTaskElements.get(task.path);
		const nextWrapper = this.createRenderedTaskWrapper(task);
		this.removeEmptyCellHint(targetContainer);

		if (existingWrapper && targetContainer.contains(existingWrapper)) {
			existingWrapper.replaceWith(nextWrapper);
		} else {
			const targetWrapper = dropTarget
				? this.currentTaskElements.get(dropTarget.taskPath)
				: null;
			if (targetWrapper && targetContainer.contains(targetWrapper)) {
				if (dropTarget?.above) {
					targetContainer.insertBefore(nextWrapper, targetWrapper);
				} else {
					targetContainer.insertBefore(nextWrapper, targetWrapper.nextSibling);
				}
			} else {
				targetContainer.appendChild(nextWrapper);
			}
			existingWrapper?.remove();
		}

		this.currentTaskElements.set(task.path, nextWrapper);
		return true;
	}

	private removeNormalRenderedTask(path: string): void {
		const existingWrapper = this.currentTaskElements.get(path);
		existingWrapper?.remove();
		this.currentTaskElements.delete(path);
	}

	private getTaskContainerForScope(
		groupKey: string,
		swimLaneKey: string | null
	): HTMLElement | null {
		if (!this.boardEl) {
			return null;
		}

		const groupSelector = escapeAttributeSelectorValue(groupKey);
		if (swimLaneKey === null) {
			return this.boardEl.querySelector<HTMLElement>(
				`.kanban-view__column[data-group="${groupSelector}"] .kanban-view__cards`
			);
		}

		const swimLaneSelector = escapeAttributeSelectorValue(swimLaneKey);
		return this.boardEl.querySelector<HTMLElement>(
			`.kanban-view__swimlane-column[data-column="${groupSelector}"][data-swimlane="${swimLaneSelector}"] .kanban-view__tasks-container`
		);
	}

	private updateScopeEmptyHint(groupKey: string, swimLaneKey: string | null): void {
		const container = this.getTaskContainerForScope(groupKey, swimLaneKey);
		if (!container) {
			return;
		}

		const scopePaths = this.getVisibleSortScopePaths(groupKey, swimLaneKey) ?? [];
		this.removeEmptyCellHint(container);
		if (scopePaths.length === 0) {
			this.renderEmptyCellHint(container, groupKey, swimLaneKey);
		}
	}

	private updateCountDisplaysForScope(groupKey: string, swimLaneKey: string | null): void {
		this.updateColumnCountDisplay(groupKey);
		if (swimLaneKey !== null) {
			this.updateSwimLaneCountDisplay(swimLaneKey);
		}
	}

	private updateColumnCountDisplay(groupKey: string): void {
		const count = this.getVisibleColumnTaskCount(groupKey);
		const formatted = formatKanbanColumnCount(count, this.wipLimits[groupKey]);
		const groupSelector = escapeAttributeSelectorValue(groupKey);
		const countEl = this.boardEl?.querySelector<HTMLElement>(
			`.kanban-view__column[data-group="${groupSelector}"] .kanban-view__column-count, .kanban-view__column-header-cell[data-column-key="${groupSelector}"] .kanban-view__column-count`
		);
		if (!countEl) {
			return;
		}

		countEl.textContent = formatted.text;
		countEl.classList.toggle("kanban-view__column-count--exceeded", formatted.isExceeded);
		this.updateColumnNavigator();
	}

	private getVisibleColumnTaskCount(groupKey: string): number {
		if (!this.swimLanePropertyId) {
			return this.getVisibleSortScopePaths(groupKey, null)?.length ?? 0;
		}

		const suffix = `::${groupKey}`;
		let count = 0;
		for (const [scopeKey, paths] of this.sortScopeTaskPaths) {
			if (scopeKey.endsWith(suffix)) {
				count += paths.length;
			}
		}
		return count;
	}

	private updateSwimLaneCountDisplay(swimLaneKey: string): void {
		const swimLaneSelector = escapeAttributeSelectorValue(swimLaneKey);
		const row = this.boardEl
			?.querySelector<HTMLElement>(
				`.kanban-view__swimlane-column[data-swimlane="${swimLaneSelector}"]`
			)
			?.closest<HTMLElement>(".kanban-view__swimlane-row");
		const countEl = row?.querySelector<HTMLElement>(".kanban-view__swimlane-count");
		if (!countEl) {
			return;
		}

		const prefix = `${swimLaneKey}::`;
		let count = 0;
		for (const [scopeKey, paths] of this.sortScopeTaskPaths) {
			if (scopeKey.startsWith(prefix)) {
				count += paths.length;
			}
		}
		countEl.textContent = `${count}`;
		row?.classList.toggle("kanban-view__swimlane-row--empty", count === 0);
	}

	private async confirmLargeReorder(
		editCount: number,
		groupKey: string,
		swimLaneKey: string | null
	): Promise<boolean> {
		const scopeLabel =
			swimLaneKey === null
				? this.plugin.i18n.translate(msg({ message: "column \"{group}\"", context: "views.kanban.reorder.scope.column" }), {
						group: groupKey,
					})
				: this.plugin.i18n.translate(msg({ message: "column \"{group}\" in swimlane \"{swimlane}\"", context: "views.kanban.reorder.scope.columnInSwimlane" }), {
						group: groupKey,
						swimlane: swimLaneKey,
					});

		return showConfirmationModal(this.plugin.app, {
			title: this.plugin.i18n.translate(msg({ message: "Save this order?", context: "common.reorder.confirmLargeTitle" })),
			message: this.plugin.i18n.translate(msg({ message: "To keep this order, {count} notes in {scope} need to be updated. You can undo this change.", context: "common.reorder.confirmLargeMessage" }), {
				count: editCount,
				scope: scopeLabel,
			}),
			confirmText: this.plugin.i18n.translate(msg({ message: "Reorder notes", context: "common.reorder.confirmButton" })),
			cancelText: this.plugin.i18n.translate(msg({ message: "Cancel", context: "common.cancel" })),
			defaultToConfirm: true,
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
			sortOrderDirection: getSortOrderDirection(this.dataAdapter, sortOrderField),
			statusConfigs: this.plugin.settings.customStatuses || [],
			priorityConfigs:
				this.plugin.priorityManager?.getAllPriorities?.() ||
				this.plugin.settings.customPriorities ||
				[],
			isStatusGroupingProperty: (propertyId) => this.isStatusGroupingProperty(propertyId),
			isPriorityGroupingProperty: (propertyId) => this.isPriorityGroupingProperty(propertyId),
			getStatusGroupKeyAliases: (statusConfig) => this.getStatusGroupKeyAliases(statusConfig),
			pinnedColumns: this.pinnedColumns,
		});
	}

	private getSortOrderValues(
		taskNotes: readonly TaskInfo[],
		sortOrderField: string
	): Map<string, unknown> {
		const sortOrderValues = new Map<string, unknown>();

		for (const task of taskNotes) {
			const current = this.plugin.cacheManager.getCachedTaskInfoSync(task.path);
			if (current) {
				if (current.sortOrder != null) sortOrderValues.set(task.path, current.sortOrder);
				continue;
			}
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
			getStatusGroupKeyAliases: (statusConfig) => this.getStatusGroupKeyAliases(statusConfig),
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

	private applyStatusColor(
		element: HTMLElement,
		groupKey: string,
		groupByPropertyId: string | null,
		modifierClass: string
	): void {
		if (!groupByPropertyId || !this.isStatusGroupingProperty(groupByPropertyId)) return;

		const status = this.findStatusConfigForGroupKey(groupKey);
		if (!status || !isSupportedColorValue(status.color)) return;

		const color = resolveKanbanStatusColor(element, normalizeThemeColor(status.color));
		if (!color) return;

		element.addClass(modifierClass);
		element.style.setProperty("--tn-kanban-status-color", color);
	}

	private isUnknownStatusGroup(groupKey: string, groupByPropertyId: string | null): boolean {
		if (!groupByPropertyId || !this.isStatusGroupingProperty(groupByPropertyId)) {
			return false;
		}

		const normalizedGroupKey = groupKey.trim();
		if (!normalizedGroupKey || normalizedGroupKey === NONE_GROUP_KEY) {
			return false;
		}

		return !this.findStatusConfigForGroupKey(normalizedGroupKey);
	}

	private markUnknownStatusColumn(element: HTMLElement, groupKey: string): void {
		element.addClass("kanban-view__column--unknown-status");
		element.setAttribute("data-unknown-status", groupKey);
		setTooltip(element, uiText(msg({ message: "Status is not defined in TaskNotes settings", context: "bases/KanbanView: KanbanView.markUnknownStatusColumn display" })));
	}

	private markUnknownStatusColumnHeader(element: HTMLElement, groupKey: string): void {
		element.addClass("kanban-view__column-header--unknown-status");
		element.setAttribute("data-unknown-status", groupKey);
		setTooltip(element, uiText(msg({ message: "Status is not defined in TaskNotes settings", context: "bases/KanbanView: KanbanView.markUnknownStatusColumnHeader display" })));
	}

	private renderUnknownGroupRecovery(element: HTMLElement, groupKey: string, propertyId: string | null): void {
		if (!propertyId || !groupKey.trim() || groupKey === NONE_GROUP_KEY) return;
		const property = this.isStatusGroupingProperty(propertyId)
			? "status"
			: this.isPropertyField(propertyId, "priority") ? "priority" : null;
		if (!property) return;
		const configured = property === "status"
			? this.findStatusConfigForGroupKey(groupKey)
			: this.plugin.priorityManager.getPriorityConfig(groupKey);
		if (configured) return;
		const explanation = unconfiguredValueLabel(groupKey);
		const recovery = element.createEl("button", {
			cls: "tn-btn tn-btn--ghost tn-btn--icon",
			attr: { type: "button", "aria-label": uiText(msg({ message: "Task settings", context: "picker recovery action" })), "aria-description": explanation, title: explanation },
		});
		setIcon(recovery, "circle-help");
		recovery.addEventListener("click", event => {
			event.stopPropagation();
			openTaskPropertySettings(this.plugin, property);
		});
	}

	private async renderFlat(
		groups: Map<string, TaskInfo[]>,
		allGroups: Map<string, TaskInfo[]>
	): Promise<void> {
		if (!this.boardEl) return;
		this.boardEl.classList.remove("kanban-view__board--swimlanes");
		this.sortScopeTaskPaths.clear();
		this.setSortScopeCandidatePaths(
			Array.from(allGroups.entries()).map(([groupKey, tasks]) => [
				this.getSortScopeKey(groupKey),
				tasks.map((task) => task.path),
			])
		);

		// Set CSS variable for column width (allows responsive override)
		this.boardEl.style.setProperty("--kanban-column-width", this.getRenderedColumnWidth());

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
		// Hide columns that are empty across every swimlane (matches flat mode's
		// shouldRenderKanbanColumn behavior). Uses the filtered `swimLanes` map so
		// counts reflect the active filter.
		const visibleColumnKeys = getVisibleKanbanSwimLaneColumnKeys(
			orderedKeys,
			swimLanes,
			this.hideEmptyColumns,
			this.pinnedColumns
		);
		const searchHiddenKeys = new Set(
			Array.from(candidateSwimLanes.keys()).filter((key) => !swimLanes.has(key))
		);
		const orderedSwimLanes = this.applySwimLaneOrderToMap(
			this.swimLanePropertyId,
			swimLanes,
			columnKeys,
			searchHiddenKeys
		);
		// Candidate lanes come first so the default (Bases sort) order is the unfiltered one.
		const priorityKeys = this.isPropertyField(this.swimLanePropertyId, "priority")
			? this.plugin.priorityManager.getAllPriorities().map((priority) => priority.value)
			: [];
		this.currentSwimLaneOrder = applyKanbanSwimLaneOrder({
			swimLanePropertyId: this.swimLanePropertyId,
			actualKeys: Array.from(
				new Set([
					...candidateSwimLanes.keys(),
					...orderedSwimLanes.keys(),
					...priorityKeys,
				])
			),
			swimLaneOrders: this.swimLaneOrders,
			hideEmptySwimLanes: false,
			isPriorityField: (propertyId) => this.isPropertyField(propertyId, "priority"),
			isStatusField: (propertyId) => this.isPropertyField(propertyId, "status"),
			getPriorityWeight: (key) => this.plugin.priorityManager.getPriorityWeight(key),
			getStatusOrder: (key) => this.plugin.statusManager.getStatusOrder(key),
		});

		// Render swimlane table
		await this.renderSwimLaneTable(
			orderedSwimLanes,
			visibleColumnKeys,
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
		this.boardEl.style.setProperty("--kanban-column-width", this.getRenderedColumnWidth());
		this.boardEl.style.setProperty(
			"--kanban-swimlane-max-height",
			`${this.maxSwimlaneHeight}px`
		);

		// Add swimlanes class to board
		this.boardEl.addClass("kanban-view__board--swimlanes");

		// Create header row
		const headerRow = this.boardEl.createDiv({
			cls: "kanban-view__swimlane-row kanban-view__swimlane-row--header",
		});

		// Empty corner cell for swimlane label column
		headerRow.createDiv({ cls: "kanban-view__swimlane-label" });

		// Column headers
		const columnTaskCounts = getKanbanColumnTaskCounts(swimLanes, columnKeys);
		for (const columnKey of columnKeys) {
			const headerCell = headerRow.createDiv({
				cls: "kanban-view__column-header-cell",
			});
			headerCell.setAttribute("draggable", "true");
			headerCell.setAttribute("data-column-key", columnKey);
			this.applyStatusColor(
				headerCell,
				columnKey,
				groupByPropertyId,
				"kanban-view__column-header-cell--status-colored"
			);
			const isUnknownStatusColumn = this.isUnknownStatusGroup(columnKey, groupByPropertyId);
			if (isUnknownStatusColumn) {
				this.markUnknownStatusColumnHeader(headerCell, columnKey);
			}

			// Drag handle
			const dragHandle = headerCell.createSpan({ cls: "kanban-view__drag-handle" });
			dragHandle.setAttribute("aria-hidden", "true");
			setIcon(dragHandle, "grip-vertical");

			if (groupByPropertyId && this.isStatusGroupingProperty(groupByPropertyId)) {
				renderKanbanHeaderGlyph(
					headerCell,
					this.findStatusConfigForGroupKey(columnKey),
					this.plugin.statusManager.getAllStatuses()
				);
			}

			const titleContainer = headerCell.createSpan({ cls: "kanban-view__column-title" });
			this.renderGroupTitleWrapper(titleContainer, columnKey, false, true);
			setTooltip(titleContainer, this.getGroupDisplayTitle(columnKey, groupByPropertyId));
			this.renderUnknownGroupRecovery(headerCell, columnKey, groupByPropertyId);
			headerCell.dataset.empty = String((columnTaskCounts.get(columnKey) ?? 0) === 0);
			this.renderColumnCount(headerCell, columnKey, columnTaskCounts.get(columnKey) ?? 0);
			this.createColumnCollapseButton(headerCell, headerCell, columnKey, groupByPropertyId);
			this.createAddTaskButton(headerCell, groupByPropertyId, columnKey);

			// Setup column header drag handlers for swimlane mode
			this.setupColumnHeaderDragHandlers(headerCell);
		}

		// Get visible properties for cards
		const visibleProperties = this.getVisibleProperties();

		// Note: tasks are already sorted by Bases
		// No manual sorting needed - Bases provides pre-sorted data

		// Render each swimlane row
		for (const [swimLaneKey, columns] of swimLanes) {
			const row = this.boardEl.createDiv({ cls: "kanban-view__swimlane-row" });

			// Swimlane label cell, draggable to reorder rows
			const labelCell = row.createDiv({
				cls: "kanban-view__swimlane-label",
				attr: { draggable: "true", "data-swimlane-key": swimLaneKey },
			});
			const labelDragHandle = labelCell.createSpan({
				cls: "kanban-view__drag-handle kanban-view__swimlane-drag-handle",
			});
			labelDragHandle.setAttribute("aria-hidden", "true");
			setIcon(labelDragHandle, "grip-vertical");
			this.setupSwimLaneLabelDragHandlers(labelCell, swimLaneKey);

			// Add swimlane title and count
			const titleEl = labelCell.createDiv({ cls: "kanban-view__swimlane-title" });
			this.renderGroupTitleWrapper(titleEl, swimLaneKey, true);

			// Count total tasks in this swimlane
			const totalTasks = Array.from(columns.values()).reduce(
				(sum, tasks) => sum + tasks.length,
				0
			);
			row.classList.toggle("kanban-view__swimlane-row--empty", totalTasks === 0);
			labelCell.createDiv({
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
				const cell = row.createDiv({
					cls: "kanban-view__swimlane-column",
					attr: {
						"data-column": columnKey,
						"data-swimlane": swimLaneKey,
					},
				});
				this.applyStatusColor(
					cell,
					columnKey,
					groupByPropertyId,
					"kanban-view__swimlane-column--status-colored"
				);
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
		const column = createElementInDocument(doc, "div");
		column.className = "kanban-view__column";
		column.style.width = this.getRenderedColumnWidth();
		column.setAttribute("data-group", groupKey);
		column.dataset.empty = String(tasks.length === 0);
		this.applyStatusColor(
			column,
			groupKey,
			groupByPropertyId,
			"kanban-view__column--status-colored"
		);
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

		if (groupByPropertyId && this.isStatusGroupingProperty(groupByPropertyId)) {
			renderKanbanHeaderGlyph(
				header,
				this.findStatusConfigForGroupKey(groupKey),
				this.plugin.statusManager.getAllStatuses()
			);
		}

		const titleContainer = header.createSpan({ cls: "kanban-view__column-title" });
		this.renderGroupTitleWrapper(titleContainer, groupKey, false, true);
		setTooltip(titleContainer, this.getGroupDisplayTitle(groupKey, groupByPropertyId));
		this.renderUnknownGroupRecovery(header, groupKey, groupByPropertyId);

		this.renderColumnCount(header, groupKey, tasks.length);
		this.createColumnCollapseButton(header, column, groupKey, groupByPropertyId);
		this.createAddTaskButton(header, groupByPropertyId, groupKey);

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

	private createColumnCollapseButton(
		header: HTMLElement,
		column: HTMLElement,
		groupKey: string,
		groupByPropertyId: string | null
	): void {
		const collapseLabel = this.plugin.i18n.translate(msg({ message: "Toggle {column} column", context: "views.kanban.toggleColumn" }), {
			column: this.getGroupDisplayTitle(groupKey, groupByPropertyId),
		});
		const button = header.createEl("button", {
			cls: "kanban-view__column-collapse-button",
			attr: {
				type: "button",
				"aria-label": collapseLabel,
			},
		});

		const collapseProperty = groupByPropertyId ?? "";
		setTooltip(button, collapseLabel);
		column.dataset.collapseProperty = collapseProperty;
		column.dataset.collapseValue = groupKey;
		this.applyColumnCollapsedState(column);

		for (const eventName of ["mousedown", "pointerdown", "touchstart"]) {
			button.addEventListener(eventName, (event) => event.stopPropagation());
		}
		button.addEventListener("dragstart", (event) => {
			event.preventDefault();
			event.stopPropagation();
		});
		button.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			const collapsed = !column.classList.contains("kanban-view__column--collapsed");
			const expansionKey = JSON.stringify([collapseProperty, groupKey]);
			if (collapsed) this.expandedEmptyColumns.delete(expansionKey);
			else this.expandedEmptyColumns.add(expansionKey);
			this.saveColumnCollapsed(collapseProperty, groupKey, collapsed);
			this.applyColumnCollapsedState(column);
			this.updateBoardLayout();
			if (!collapsed) this.columnScrollers.get(groupKey)?.recalculate();
		});
	}

	private getFocusedCollapseColumn(): { property: string; value: string } | null {
		const board = this.boardEl;
		const focused = board?.ownerDocument.activeElement;
		if (!board || !focused?.matches(".kanban-view__column-collapse-button") || !board.contains(focused)) {
			return null;
		}
		const column = focused.closest<HTMLElement>(".kanban-view__column, .kanban-view__column-header-cell");
		if (!column) return null;
		return {
			property: column.dataset.collapseProperty ?? "",
			value: column.dataset.collapseValue ?? "",
		};
	}

	private restoreCollapseButtonFocus(target: { property: string; value: string } | null): void {
		if (!target || !this.boardEl) return;
		for (const column of Array.from(
			this.boardEl.querySelectorAll<HTMLElement>(".kanban-view__column, .kanban-view__column-header-cell")
		)) {
			if (
				column.dataset.collapseProperty === target.property &&
				column.dataset.collapseValue === target.value
			) {
				column.querySelector<HTMLElement>(".kanban-view__column-collapse-button")?.focus();
				return;
			}
		}
	}

	private applyColumnCollapsedState(column: HTMLElement): void {
		const button = column.querySelector<HTMLElement>(".kanban-view__column-collapse-button");
		if (!button) return;
		const expansionKey = JSON.stringify([column.dataset.collapseProperty ?? "", column.dataset.collapseValue ?? ""]);
		const collapsed = (column.dataset.empty === "true" && !this.expandedEmptyColumns.has(expansionKey) && !this.pinnedColumns.includes(column.dataset.collapseValue ?? "")) || this.isColumnCollapsed(
			column.dataset.collapseProperty ?? "",
			column.dataset.collapseValue ?? ""
		);
		column.classList.toggle("kanban-view__column--collapsed", collapsed);
		column.classList.toggle("kanban-view__column--empty-rail", collapsed && column.dataset.empty === "true");
		column.dataset.collapsed = String(collapsed);
		column.style.width = collapsed
			? "var(--tn-kanban-collapsed-column-width, 48px)"
			: this.getRenderedColumnWidth();
		button.setAttribute("aria-expanded", String(!collapsed));
		setIcon(button, collapsed ? "chevron-right" : "chevron-left");
	}

	private getRenderedColumnWidth(): string {
		return this.boardEl?.style.getPropertyValue("--kanban-column-width") || `${this.columnWidth}px`;
	}

	private updateBoardLayout(): void {
		const board = this.boardEl;
		if (!board || this.renderingBoard || this.draggedTaskPath || this.structureDragActive || this.touchDragActive) return;
		const swimlanes = board.classList.contains("kanban-view__board--swimlanes");
		const columns = Array.from(board.querySelectorAll<HTMLElement>(
			swimlanes ? ".kanban-view__column-header-cell" : ".kanban-view__column"
		));
		const labelWidth = swimlanes ? (board.clientWidth < 480 ? 72 : 96) : 0;
		const collapsedColumns = columns.filter(column => column.classList.contains("kanban-view__column--collapsed"));
		const collapsedCount = collapsedColumns.length;
		const collapsedWidth = collapsedColumns.reduce((total, column) => total + (column.getBoundingClientRect().width || 48), 0);
		const openCount = columns.length - collapsedCount;
		const available = board.clientWidth - labelWidth - 16 - collapsedWidth - Math.max(0, columns.length - 1) * (swimlanes ? 0 : 8);
		const width = board.clientWidth < 480
			? Math.max(0, Math.min(this.columnWidth, board.clientWidth - labelWidth - 16))
			: Math.max(320, Math.min(this.columnWidth, available / Math.max(1, openCount)));
		const tracks = columns.map(column => {
			const collapsed = column.classList.contains("kanban-view__column--collapsed");
			const track = collapsed ? "var(--tn-kanban-collapsed-column-width, 48px)" : `${width}px`;
			column.style.width = track;
			return track;
		});
		board.style.setProperty("--kanban-swimlane-label-width", `${labelWidth}px`);
		board.style.setProperty("--kanban-column-width", `${width}px`);
		if (swimlanes) {
			for (const row of Array.from(board.querySelectorAll<HTMLElement>(".kanban-view__swimlane-row"))) {
				row.style.gridTemplateColumns = `${labelWidth}px ${tracks.join(" ")}`;
				Array.from(row.querySelectorAll<HTMLElement>(".kanban-view__swimlane-column")).forEach((cell, index) => {
					cell.classList.toggle("kanban-view__column--collapsed", columns[index]?.classList.contains("kanban-view__column--collapsed") ?? false);
				});
			}
		}
		board.classList.toggle("kanban-view__board--overflow", board.scrollWidth > board.clientWidth + 1);
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
			return uiText(msg({ message: "Add task to {groupKey} / {swimLaneKey}", context: "bases/KanbanView: KanbanView.getAddTaskLabel display" }), { groupKey: this.getGroupDisplayTitle(groupKey, this.getGroupByPropertyId()), swimLaneKey: this.getGroupDisplayTitle(swimLaneKey, this.swimLanePropertyId) });
		}

		return uiText(msg({ message: "Add task to {groupKey}", context: "bases/KanbanView: KanbanView.getAddTaskLabel display" }), { groupKey: this.getGroupDisplayTitle(groupKey, this.getGroupByPropertyId()) });
	}

	private renderEmptyCellHint(
		container: HTMLElement,
		groupKey: string,
		swimLaneKey: string | null = null
	): void {
		const noTasksLabel = this.plugin.i18n.translate(msg({ message: "No tasks", context: "views.kanban.noTasks" }));
		const label = swimLaneKey
			? `${noTasksLabel}: ${this.getGroupDisplayTitle(groupKey, this.getGroupByPropertyId())} / ${this.getGroupDisplayTitle(swimLaneKey, this.swimLanePropertyId)}`
			: `${noTasksLabel}: ${this.getGroupDisplayTitle(groupKey, this.getGroupByPropertyId())}`;
		const empty = container.createDiv({
			cls: "kanban-view__empty-cell",
			attr: {
				"aria-label": label,
			},
		});
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
		cardsContainer.addClass("kanban-view__cards--virtual");
		this.columnScrollers.set(groupKey, this.createCardScroller(cardsContainer, tasks, visibleProperties, cardOptions));
	}

	private async createVirtualSwimLaneCell(
		tasksContainer: HTMLElement,
		cellKey: string,
		tasks: TaskInfo[],
		visibleProperties: string[]
	): Promise<void> {
		tasksContainer.addClass("kanban-view__tasks-container--virtual");
		this.columnScrollers.set(cellKey, this.createCardScroller(tasksContainer, tasks, visibleProperties, this.getCardOptions()));
	}

	private createCardScroller(container: HTMLElement, tasks: TaskInfo[], visibleProperties: string[], cardOptions: TaskCardOptions): VirtualScroller<TaskInfo> {
		return createKanbanCardScroller({
			container, tasks, visibleProperties, cardOptions, plugin: this.plugin,
			document: this.containerEl.ownerDocument,
			onRender: (wrapper, task) => {
				this.currentTaskElements.set(task.path, wrapper);
				if (this.draggedTaskPaths.includes(task.path)) {
					wrapper.classList.add("kanban-view__card--dragging");
				}
				this.taskInfoCache.set(task.path, task);
				this.setupCardDragHandlers(wrapper, task);
			},
		});
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

	private setupSwimLaneLabelDragHandlers(label: HTMLElement, swimLaneKey: string): void {
		const draggingClass = "kanban-view__swimlane-label--dragging";
		const dragoverClass = "kanban-view__swimlane-label--dragover";

		label.addEventListener("dragstart", (e: DragEvent) => {
			if (!e.dataTransfer) return;
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData(SWIMLANE_DRAG_TYPE, swimLaneKey);
			label.classList.add(draggingClass);
			this.startStructureDrag(label, e, this.getGroupDisplayTitle(swimLaneKey, this.swimLanePropertyId));
		});

		label.addEventListener("dragover", (e: DragEvent) => {
			if (!isSwimLaneDrag(e)) return;
			e.preventDefault();
			e.stopPropagation();
			if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
			label.classList.add(dragoverClass);
		});

		label.addEventListener("dragleave", (e: DragEvent) => {
			if (!isSwimLaneDrag(e)) return;
			if (!(e.relatedTarget instanceof Node && label.contains(e.relatedTarget))) {
				label.classList.remove(dragoverClass);
			}
		});

		label.addEventListener("drop", (e: DragEvent) => {
			if (!isSwimLaneDrag(e)) return;
			e.preventDefault();
			e.stopPropagation();
			label.classList.remove(dragoverClass);

			const draggedKey = e.dataTransfer?.getData(SWIMLANE_DRAG_TYPE);
			if (!draggedKey) return;
			this.endStructureDrag();
			void this.moveSwimLane(draggedKey, swimLaneKey);
		});

		label.addEventListener("dragend", () => {
			this.endStructureDrag();
			label.classList.remove(draggingClass);
			this.boardEl
				?.querySelectorAll(`.${dragoverClass}`)
				.forEach((el) => el.classList.remove(dragoverClass));
		});
	}

	private async moveSwimLane(draggedKey: string, targetKey: string): Promise<void> {
		const swimLanePropertyId = this.swimLanePropertyId;
		if (!swimLanePropertyId || !this.boardEl) return;

		const visibleOrder = Array.from(
			this.boardEl.querySelectorAll<HTMLElement>(
				".kanban-view__swimlane-label[data-swimlane-key]"
			)
		)
			.map((el) => el.dataset.swimlaneKey)
			.filter((key): key is string => !!key);

		const newOrder = reorderKanbanSwimLaneKeys({
			currentOrder: this.currentSwimLaneOrder,
			visibleOrder,
			draggedKey,
			targetKey,
		});
		if (!newOrder) return;

		this.saveSwimLaneOrder(swimLanePropertyId, newOrder);
		await this.render();
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
			this.startStructureDrag(header, e, this.getGroupDisplayTitle(columnKey, this.getGroupByPropertyId()));
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
				this.endStructureDrag();

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
			this.endStructureDrag();
		});

		this.setupColumnHeaderTouchHandlers(header, columnKey, isSwimlaneHeader, draggingClass);
	}

	private startStructureDrag(source: HTMLElement, event: DragEvent, title: string): void {
		this.structureDragActive = true;
		this.containerEl.ownerDocument.body.classList.add("tn-drag-active");
		setElementDragImage(event, source, "kanban-view__drag-image");
		this.dragPreview.show(source, event, 1, title);
	}

	private endStructureDrag(): void {
		this.structureDragActive = false;
		this.cleanupFloatingDragPreview();
		this.stopAutoScroll();
		this.clearDragoverFeedback();
		this.containerEl.ownerDocument.body.classList.remove("tn-drag-active", "tn-drag-invalid");
		if (this.pendingRender) {
			this.pendingRender = false;
			this.debouncedRefresh();
		}
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
					this.markTouchDragSource(header, draggingClass);
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
					this.handleAutoScroll(touch.clientX, touch.clientY);
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

				if (!this.touchDragActive || this.touchDragType !== "column") return;

				try {
					const touch = e.changedTouches[0];
					if (!touch) {
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
							const currentOrder = Array.from(
								this.boardEl!.querySelectorAll(selector)
							)
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
				} catch (error) {
					tasknotesLogger.error("[TaskNotes][KanbanView] Error completing touch drag:", {
						category: "persistence",
						operation: "touch-column-drop",
						error,
					});
				} finally {
					this.clearTouchDragState();
				}
			})();
		});

		header.addEventListener("touchcancel", () => {
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
			if (isSwimLaneDrag(e)) return;
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
				if (isSwimLaneDrag(e)) return;
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
				const optimisticResult = this.performOptimisticReorder(
					paths,
					dropTarget,
					cardsContainer
				);
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
			if (isSwimLaneDrag(e)) return;
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
				if (isSwimLaneDrag(e)) return;
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
				await this.handleTaskDrop(
					this.draggedTaskPath,
					columnKey,
					swimLaneKey,
					dropTarget,
					{
						optimisticReorderApplied: optimisticResult,
						draggedPaths: paths,
					}
				);

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
		const doc = this.containerEl.ownerDocument;
		const ghost = createElementInDocument(doc, "div");
		ghost.className = "tasknotes-plugin kanban-view__touch-ghost";
		ghost.inert = true;
		ghost.setAttribute("aria-hidden", "true");
		const clone = sourceEl.cloneNode(true) as HTMLElement;
		clone.classList.remove("kanban-view__card--dragging", "kanban-view__touch-drag-source");
		clone.classList.remove("kanban-view__card-wrapper--selected", "kanban-view__card-wrapper--selected-primary", "tn-task-focused");
		clone.querySelectorAll(".tn-task-focused, .task-card--selected, .task-card--selected-primary").forEach(element => element.classList.remove("tn-task-focused", "task-card--selected", "task-card--selected-primary"));
		clone.querySelectorAll("[id]").forEach(element => element.removeAttribute("id"));
		clone.removeAttribute("id");
		clone.removeAttribute("data-task-path");
		clone.removeAttribute("draggable");
		clone.querySelectorAll("[data-task-path], [data-keyboard-id]").forEach(element => {
			element.removeAttribute("data-task-path");
			element.removeAttribute("data-keyboard-id");
		});
		ghost.appendChild(clone);
		ghost.style.left = `${x + (doc.defaultView?.scrollX ?? 0)}px`;
		ghost.style.top = `${y + (doc.defaultView?.scrollY ?? 0)}px`;
		ghost.style.width = `${Math.min(sourceEl.offsetWidth, 320)}px`;
		if (this.draggedTaskPaths.length > 1) ghost.dataset.dragCount = `${this.draggedTaskPaths.length}`;
		doc.body.appendChild(ghost);
		return ghost;
	}

	private updateTouchDragGhost(x: number, y: number): void {
		if (this.touchDragGhost) {
			const win = this.touchDragGhost.ownerDocument.defaultView;
			this.touchDragGhost.style.left = `${x + (win?.scrollX ?? 0)}px`;
			this.touchDragGhost.style.top = `${y + (win?.scrollY ?? 0)}px`;
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
		this.cleanupDragShift();
		const restriction = this.touchDragType === "task" ? this.getDropRestriction() : null;
		if (restriction && this.touchDragGhost) {
			this.touchDragGhost.classList.add("kanban-view__floating-drag-preview--invalid");
			let feedback = this.touchDragGhost.querySelector<HTMLElement>(".kanban-view__drag-feedback");
			feedback ??= this.touchDragGhost.createDiv({ cls: "kanban-view__drag-feedback" });
			feedback.textContent = restriction;
			return;
		}
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
		if (this.touchDragType === "task" && target.element) {
			const container = target.cardsContainer ?? target.element.querySelector<HTMLElement>(".kanban-view__cards, .kanban-view__tasks-container");
			if (container && isSortOrderInSortConfig(this.dataAdapter, this.plugin.settings.fieldMapping.sortOrder)) {
				const siblings = Array.from(container.querySelectorAll<HTMLElement>(".kanban-view__card-wrapper"))
					.filter(card => !this.draggedTaskPaths.includes(card.dataset.taskPath || ""));
				const index = siblings.findIndex(card => y < card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2);
				this.dragContainer = container;
				this.currentInsertionIndex = index < 0 ? siblings.length : index;
				updateKanbanDropMarker(container, siblings, this.currentInsertionIndex);
			}
		}
	}

	private markTouchDragSource(element: HTMLElement, draggingClass: string): void {
		element.classList.add(draggingClass, "kanban-view__touch-drag-source");
		this.touchDragSources.add(element);
	}

	private clearTouchDragState(): void {
		const restoreScroll = !this.taskDropAccepted ? this.restoreDragScroll : null;
		this.restoreDragScroll = null;
		for (const scroller of this.columnScrollers.values()) scroller.setPinnedItemKeys([]);
		this.boardEl?.classList.remove("kanban-view__board--task-dragging");
		for (const element of this.touchDragSources) {
			element.classList.remove(
				"kanban-view__touch-drag-source",
				"kanban-view__card--dragging",
				"kanban-view__column-header--dragging",
				"kanban-view__column-header-cell--dragging"
			);
		}
		this.touchDragSources.clear();
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
		this.cleanupDragShift();

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
		this.containerEl.ownerDocument.body.classList.remove("tn-drag-active", "tn-drag-invalid");
		restoreScroll?.();
		if (this.pendingRender) {
			this.pendingRender = false;
			this.debouncedRefresh();
		}
	}

	private handleAutoScroll(touchX: number, clientY?: number): void {
		if (!this.boardEl) return;
		this.autoScrollPointerX = touchX;
		this.autoScrollPointerY = clientY ?? 0;

		const rect = this.boardEl.getBoundingClientRect();
		const leftEdge = rect.left + this.AUTO_SCROLL_EDGE;
		const rightEdge = rect.right - this.AUTO_SCROLL_EDGE;

		let newDirection = 0;
		if (touchX < leftEdge) newDirection = -1;
		else if (touchX > rightEdge) newDirection = 1;

		let verticalDirection = 0;
		let scrollContainer: HTMLElement | null = null;
		if (clientY !== undefined) {
			const target = this.boardEl.ownerDocument.elementFromPoint(touchX, clientY);
			const cards = target?.closest<HTMLElement>(".kanban-view__cards, .kanban-view__tasks-container");
			scrollContainer = cards && cards.scrollHeight > cards.clientHeight ? cards : this.boardEl;
			const bounds = scrollContainer.getBoundingClientRect();
			const edge = Math.min(this.AUTO_SCROLL_EDGE, bounds.height / 4);
			if (clientY < bounds.top + edge) verticalDirection = -1;
			else if (clientY > bounds.bottom - edge) verticalDirection = 1;
		}
		if (newDirection !== this.autoScrollDirection || verticalDirection !== this.autoScrollVertical || scrollContainer !== this.autoScrollContainer) {
			this.stopAutoScroll();
			this.autoScrollDirection = newDirection;
			this.autoScrollVertical = verticalDirection;
			this.autoScrollContainer = scrollContainer;
			if (newDirection !== 0 || verticalDirection !== 0) {
				this.autoScrollTimer = window.setInterval(() => {
					if (this.boardEl) {
						this.boardEl.scrollLeft +=
							this.autoScrollDirection * this.AUTO_SCROLL_SPEED;
					}
					if (this.autoScrollContainer) this.autoScrollContainer.scrollTop += this.autoScrollVertical * this.AUTO_SCROLL_SPEED;
					if (this.touchDragActive) this.updateDropTargetFeedback(this.autoScrollPointerX, this.autoScrollPointerY);
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
		this.autoScrollVertical = 0;
		this.autoScrollContainer = null;
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
			if (!this.draggedTaskPath) return;
			// Skip if dragging over self
			if (this.draggedTaskPath === task.path) return;
			if (isSwimLaneDrag(e)) return;
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
					if (!isSortOrderInSortConfig(this.dataAdapter, this.plugin.settings.fieldMapping.sortOrder)) {
						this.cleanupDragShift();
						this.dropTargetPath = null;
						return;
					}

					// If the drag moved to a different container (cross-column),
					// clean up old container and set up the new one
					if (container !== this.dragContainer) {
						this.cleanupDragShift();
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
						updateKanbanDropMarker(container, siblings, insertionIndex);
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
				if (isSwimLaneDrag(e)) return;
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
			this.restoreDragScroll = captureTaskViewScroll(this.rootElement ?? this.containerEl);
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
			this.taskDropAccepted = false;
			this.boardEl?.classList.add("kanban-view__board--task-dragging");
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
					// copyMove: Calendar views accept the task path as a copy-style drop
					e.dataTransfer.effectAllowed = "copyMove";
					e.dataTransfer.setData("text/plain", draggedTaskPath);
					e.dataTransfer.setData(TASK_PATH_DRAG_TYPE, draggedTaskPath);
				}
			}

			this.activeDragSourceElement = dragImageSource;
			for (const scroller of this.columnScrollers.values()) scroller.setPinnedItemKeys(this.draggedTaskPaths);
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

			if (container) {
				container.style.setProperty("--tn-drag-gap", `${draggedHeight}px`);
				this.dragContainer = container;
				this.currentInsertionIndex = -1;
			}
		});

		cardWrapper.addEventListener("dragend", (e: DragEvent) => {
			e.stopPropagation();
			for (const scroller of this.columnScrollers.values()) scroller.setPinnedItemKeys([]);
			this.boardEl?.classList.remove("kanban-view__board--task-dragging");
			this.debugLog("DRAGEND-FIRED", {
				draggedTask: task.path.split("/").pop(),
				draggedTaskPath: this.draggedTaskPath?.split("/").pop() || "(already null)",
				draggedTaskPathsCount: this.draggedTaskPaths.length,
				pendingRender: this.pendingRender,
				activeDropCount: this.activeDropCount,
				suppressRenderRemaining: Math.max(0, this.suppressRenderUntil - Date.now()),
			});

			this.cleanupFloatingDragPreview();
			this.stopAutoScroll();

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
			if (!this.taskDropAccepted && !cardWrapper.ownerDocument.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
				cardWrapper.classList.add("kanban-view__card--returned");
				cardWrapper.addEventListener("animationend", () => {
					cardWrapper.classList.remove("kanban-view__card--returned");
				}, { once: true });
			}
			if (!this.taskDropAccepted) this.restoreDragScroll?.();
			this.restoreDragScroll = null;
			this.containerEl.ownerDocument.body.classList.remove("tn-drag-active", "tn-drag-invalid");

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
			this.clearDragoverFeedback();
			this.boardEl?.classList.remove("kanban-view__board--invalid-drop");

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
			clearKanbanDropMarkers(this.dragContainer);
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
		if (this.boardEl) {
			clearKanbanDropMarkers(this.boardEl);
		}
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
		this.dragPreview.show(sourceElement, event, this.draggedTaskPaths.length,
			uiText(msg({ message: "Task", context: "bases/KanbanView: KanbanView.getFloatingDragPreviewTitle display" })));
	}

	private cleanupFloatingDragPreview(): void {
		this.dragPreview.destroy();
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
					this.handleAutoScroll(touch.clientX, touch.clientY);
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

				try {
					const touch = e.changedTouches[0];
					if (!touch) {
						return;
					}
					const restriction = this.getDropRestriction();
					if (restriction) {
						new Notice(restriction);
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
				} catch (error) {
					tasknotesLogger.error("[TaskNotes][KanbanView] Error completing touch drag:", {
						category: "persistence",
						operation: "touch-task-drop",
						error,
					});
				} finally {
					this.clearTouchDragState();
					resetTouchDragSourceOverride();
				}
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
		this.taskDropAccepted = false;
		this.restoreDragScroll = captureTaskViewScroll(this.rootElement ?? this.containerEl);
		this.touchDragActive = true;
		this.touchDragType = "task";
		this.boardEl?.classList.add("kanban-view__board--task-dragging");
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
					this.markTouchDragSource(wrapper, "kanban-view__card--dragging");
					const col = wrapper.closest("[data-group]") as HTMLElement;
					const swimCol = wrapper.closest("[data-column]") as HTMLElement;
					const swimlaneRow = wrapper.closest("[data-swimlane]") as HTMLElement;
					const sourceCol = col?.dataset.group || swimCol?.dataset.column;
					const sourceSwimlane = swimlaneRow?.dataset.swimlane;
					if (sourceCol) this.draggedSourceColumns.set(path, sourceCol);
					if (sourceSwimlane) this.draggedSourceSwimlanes.set(path, sourceSwimlane);
				}
			}
			this.markTouchDragSource(dragImageSource, "kanban-view__card--dragging");
		} else {
			this.draggedTaskPath = draggedTaskPath;
			this.draggedTaskPaths = [draggedTaskPath];
			this.markTouchDragSource(dragImageSource, "kanban-view__card--dragging");
		}
		this.activeDragSourceElement = dragImageSource;
		for (const scroller of this.columnScrollers.values()) scroller.setPinnedItemKeys(this.draggedTaskPaths);

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
		this.taskDropAccepted = true;
		this.activeDropCount++;
		let dropRequiresPostDropRefresh = true;
		// Read before queueing: a drop acts on the occurrence its card showed, not
		// on whatever the series has advanced to by the time the queue reaches it.
		const droppedOccurrences = this.getDroppedOccurrences(taskPath, options);
		const pendingPaths = getKanbanDraggedPaths(options.draggedPaths ?? this.draggedTaskPaths, taskPath);
		const pendingElements = pendingPaths.map(path => this.currentTaskElements.get(path));
		for (const element of pendingElements) {
			element?.classList.add("kanban-view__card--pending");
			element?.setAttribute("aria-busy", "true");
		}
		const feedback: TaskUndoFeedback = { undo: [], failed: false };
		let reorderConfirmed = false;
		let recurringMessage: string | undefined;
		const rewritten = new Set<string>();
		const failedTitles: string[] = [];
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
						this.plugin.i18n.translate(msg({ message: "Cannot move tasks between formula-based columns. Formula values are computed and cannot be directly modified.", context: "views.kanban.errors.formulaGroupingReadOnly" }))
					);
					return;
				}

				// Check if swimlane is a formula - formulas are read-only
				if (newSwimLaneValue !== null && this.swimLanePropertyId?.startsWith("formula.")) {
					new Notice(
						this.plugin.i18n.translate(msg({ message: "Cannot move tasks between formula-based swimlanes. Formula values are computed and cannot be directly modified.", context: "views.kanban.errors.formulaSwimlaneReadOnly" }))
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
				const canFastPatchCrossScopeDrop = this.canFastPatchCrossScopeDrop(
					options,
					pathsToUpdate
				);
				let fastPatchedManualOrder = false;
				let fastPatchedCrossScopeDrop = false;

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

					const isSettled = await completeOccurrenceForStatusMove({
						plugin: this.plugin,
						path,
						status: getKanbanDropStatusValue(dropPlan),
						shownOccurrence: droppedOccurrences.get(path),
						getOccurrenceDate: getKanbanTaskActionDate,
						onUndo: (undo, message) => {
							if (pathsToUpdate.length === 1) recurringMessage = message;
							feedback.undo.push(async () => {
								if (!(await undo())) throw new Error("Occurrence changed since drop");
							});
						},
					});
					if (isSettled) continue;
					const taskUndo: TaskUndoFeedback = { undo: [], failed: false };
					let registeredTaskUndo = false;
					const finishTaskUndo = () => {
						if (!taskUndo.undo.length || registeredTaskUndo) return;
						registeredTaskUndo = true;
						const pending = taskUndo.undo;
						feedback.undo.push(async () => {
							while (pending.length) {
								await pending[pending.length - 1]();
								pending.pop();
								}
						});
					};

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
									sortDirection: getSortOrderDirection(
										this.dataAdapter,
										sortOrderField
									),
								}
							);
							if (sortOrderPlan.sortOrder === null) {
								continue;
							}

							const totalEditedNotes = sortOrderPlan.additionalWrites.length + 1;
							if (totalEditedNotes > this.LARGE_REORDER_WARNING_THRESHOLD && !reorderConfirmed) {
								const confirmed = await this.confirmLargeReorder(
									totalEditedNotes,
									newGroupValue,
									newSwimLaneValue
								);
								if (!confirmed) return;
								reorderConfirmed = true;
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

					const currentTask = await this.plugin.cacheManager.getTaskInfo(path);
					if (currentTask?.recurrence_parent && getKanbanDropStatusValue(dropPlan) !== null) {
						await changeTaskProperty(this.plugin, [currentTask], "status", getKanbanDropStatusValue(dropPlan) ?? "", taskUndo);
						finishTaskUndo();
						feedback.failed ||= taskUndo.failed;
						if (taskUndo.failed) {
							failedTitles.push(currentTask.title);
							continue;
						}
						if (dropPlan.groupByTaskProp === "status") dropPlan.needsGroupUpdate = false;
						if (dropPlan.swimlaneTaskProp === "status") dropPlan.needsSwimlaneUpdate = false;
					}

					// Skip file write if nothing to change
					const needsWrite = kanbanDropPlanNeedsWrite(dropPlan, sortOrderPlan !== null);
					if (!needsWrite) {
						finishTaskUndo();
						continue;
					}

					const file = this.plugin.app.vault.getAbstractFileByPath(path);
					if (!file || !(file instanceof TFile)) continue;

					const receipts: FileUndoReceipt[] = [];
					const record = (target: TFile, changes: TaskMovementUndoChange[]) => {
						if (!changes.length) return;
						rewritten.add(target.path);
						receipts.push({ file: target, content: { changes, beforeBody: "", afterBody: "" } });
						if (receipts.length === 1) {
							taskUndo.undo.push(createFileUndo(this.plugin, receipts, async () => {
								await this.render();
							}));
							finishTaskUndo();
						}
					};
					if (sortOrderPlan) {
						for (const write of sortOrderPlan.additionalWrites) {
							const target = this.plugin.app.vault.getAbstractFileByPath(write.path);
							if (!(target instanceof TFile)) throw new Error(`Missing task: ${write.path}`);
							let neighborChanges: TaskMovementUndoChange[] = [];
							await processVaultFrontMatter(this.plugin.app, target, frontmatter => {
								const before = structuredClone(frontmatter);
								frontmatter[sortOrderField] = write.sortOrder;
								neighborChanges = buildTaskMovementUndo(before, frontmatter, this.plugin.fieldMapper.toUserField("dateModified"));
							});
							record(target, neighborChanges);
						}
					}

					// Single atomic write: groupBy + swimlane + sort_order
					let changes: TaskMovementUndoChange[] = [];
					await processVaultFrontMatter(this.plugin.app, file, (fm) => {
						const before = structuredClone(fm);
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
						changes = buildTaskMovementUndo(before, fm, this.plugin.fieldMapper.toUserField("dateModified"));
					});
					record(file, changes);
					finishTaskUndo();

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
					let sideEffectFailed = false;
					let sideEffectUpdatedTask: TaskInfo | null = null;
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
								sideEffectUpdatedTask = sideEffectPlan.updatedTask;
							}
						} catch (sideEffectError) {
							sideEffectFailed = true;
							tasknotesLogger.warn(
								"[TaskNotes][KanbanView] Side-effect error after drop:",
								{
									category: "configuration",
									operation: "side-effect-drop",
									error: sideEffectError,
								}
							);
						}
					}

					if (
						canFastPatchCrossScopeDrop &&
						!sideEffectFailed &&
						(dropPlan.needsGroupUpdate || dropPlan.needsSwimlaneUpdate)
					) {
						fastPatchedCrossScopeDrop = this.applySuccessfulKanbanDropLocally({
							path,
							dropPlan,
							dropTarget,
							sortOrderPlan,
							updatedTask: sideEffectUpdatedTask,
							optimisticReorderApplied: options.optimisticReorderApplied === true,
						});
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
					fastPatchedCrossScopeDrop,
				});
				if (fastPatchedManualOrder || fastPatchedCrossScopeDrop) {
					this.pendingRender = false;
					dropRequiresPostDropRefresh = false;
				}
			}); // end dropQueue.enqueue
		} catch (error) {
			feedback.failed = true;
			for (const path of pendingPaths) {
				if (rewritten.has(path)) continue;
				failedTitles.push(this.currentTaskElements.get(path)?.querySelector(".task-card__title-text")?.textContent || path);
			}
			if (!feedback.failedPaths?.length) feedback.failedPaths = [taskPath];
			tasknotesLogger.error("[TaskNotes][KanbanView] Error updating task:", {
				category: "persistence",
				operation: "updating-task",
				error: error,
			});
		} finally {
			for (const element of pendingElements) {
				element?.classList.remove("kanban-view__card--pending");
				element?.removeAttribute("aria-busy");
			}
			for (const path of rewritten) {
				const element = this.currentTaskElements.get(path);
				if (!element || element.ownerDocument.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches) continue;
				element.classList.add("kanban-view__card--settled");
				element.addEventListener("animationend", () => element.classList.remove("kanban-view__card--settled"), { once: true });
			}
			const destination = [this.getGroupDisplayTitle(newGroupValue, this.getGroupByPropertyId()), newSwimLaneValue === null ? "" : this.getGroupDisplayTitle(newSwimLaneValue, this.swimLanePropertyId)].filter(Boolean).join(" · ");
			showTaskUndo(feedback.undo, feedback.failed, feedback.undo.length, this.plugin.app.vault, feedback.failed ? failedTitles.join(", ") || destination : recurringMessage ?? taskMovementMessage(feedback.undo.length, destination), undefined, undefined,
				feedback.failedPaths?.length ? {
					label: uiText(msg({ message: "Open task", context: "interaction shortcut" })),
					run: async () => { await this.app.workspace.openLinkText(feedback.failedPaths![0], "", false); },
				} : undefined);
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

	private getDroppedOccurrences(
		taskPath: string,
		options: KanbanDropExecutionOptions
	): Map<string, ShownOccurrence> {
		const occurrences = new Map<string, ShownOccurrence>();
		for (const path of [taskPath, ...(options.draggedPaths ?? []), ...this.draggedTaskPaths]) {
			const occurrence = getShownOccurrence(
				this.taskInfoCache.get(path),
				getKanbanTaskActionDate
			);
			if (occurrence) occurrences.set(path, occurrence);
		}
		return occurrences;
	}

	protected setupContainer(): void {
		super.setupContainer();

		// Use containerEl.ownerDocument for pop-out window support
		const doc = this.containerEl.ownerDocument;
		const board = createElementInDocument(doc, "div");
		board.className = "kanban-view__board";
		this.rootElement?.appendChild(board);
		this.boardEl = board;
		const nav = this.rootElement?.createEl("nav", {
			cls: "kanban-view__column-nav",
			attr: { "aria-label": uiText(msg({ message: "Move between columns", context: "interaction shortcut" })) },
		});
		if (nav) {
			board.before(nav);
			this.columnNav = nav;
			this.previousColumn = nav.createEl("button", { cls: "clickable-icon", attr: { type: "button" } });
			setIcon(this.previousColumn, "chevron-left");
			const picker = nav.createDiv({ cls: "kanban-view__column-picker" });
			this.columnSelect = picker.createEl("select", { cls: "tn-select", attr: { "aria-label": nav.getAttribute("aria-label") ?? "" } });
			setIcon(picker.createSpan({ cls: "kanban-view__column-picker-icon", attr: { "aria-hidden": "true" } }), "chevron-down");
			this.nextColumn = nav.createEl("button", { cls: "clickable-icon", attr: { type: "button" } });
			setIcon(this.nextColumn, "chevron-right");
			this.previousColumn.addEventListener("click", () => this.revealNavigatorColumn((this.columnSelect?.selectedIndex ?? 0) - 1));
			this.nextColumn.addEventListener("click", () => this.revealNavigatorColumn((this.columnSelect?.selectedIndex ?? 0) + 1));
			this.columnSelect.addEventListener("change", () => this.revealNavigatorColumn(this.columnSelect?.selectedIndex ?? 0));
			this.registerDomEvent(board, "scroll", () => this.updateColumnNavigator());
		}
		this.registerBoardListeners();
		const observer = new ResizeObserver(() => {
			this.updateBoardLayout();
			this.updateColumnNavigator();
		});
		observer.observe(board);
		this.register(() => observer.disconnect());
	}

	private navigatorColumns(): HTMLElement[] {
		return Array.from(this.boardEl?.querySelectorAll<HTMLElement>(".kanban-view__column, .kanban-view__column-header-cell") ?? []);
	}

	private revealNavigatorColumn(index: number): void {
		const column = this.navigatorColumns()[index];
		if (!column) return;
		this.activeNavigatorColumn = column.dataset.group ?? column.dataset.columnKey ?? null;
		column.scrollIntoView({ block: "nearest", inline: "start", behavior: this.containerEl.ownerDocument.defaultView?.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
	}

	private updateColumnNavigator(restoreAlignment = false): void {
		const select = this.columnSelect;
		if (!select || !this.boardEl || !this.previousColumn || !this.nextColumn) return;
		const columns = this.navigatorColumns();
		if (!columns.length) return;
		const keys = columns.map(column => column.dataset.group ?? column.dataset.columnKey ?? "");
		const labels = columns.map(column => `${column.querySelector(".kanban-view__column-title")?.textContent ?? column.dataset.group ?? column.dataset.columnKey ?? ""} · ${column.querySelector(".kanban-view__column-count")?.textContent ?? "0"}`);
		if (Array.from(select.options).map(option => `${option.value}:${option.text}`).join("\n") !== labels.map((label, index) => `${keys[index]}:${label}`).join("\n")) {
			select.empty();
			labels.forEach((label, index) => select.createEl("option", { text: label, value: keys[index] }));
		}
		if (this.columnNav) this.columnNav.hidden = columns.length < 2;
		const padding = parseFloat(this.containerEl.ownerDocument.defaultView?.getComputedStyle(this.boardEl).paddingLeft ?? "0") || 0;
		const left = this.boardEl.getBoundingClientRect().left + padding;
		if (restoreAlignment && this.columnNav?.offsetWidth) {
			let target = keys.indexOf(this.activeNavigatorColumn ?? "");
			if (target < 0) target = columns.findIndex(column => column.querySelector(".task-card") !== null);
			const column = columns[Math.max(0, target)];
			this.boardEl.scrollLeft += column.getBoundingClientRect().left - left;
		}
		let closest = 0;
		for (let index = 1; index < columns.length; index++) if (Math.abs(columns[index].getBoundingClientRect().left - left) < Math.abs(columns[closest].getBoundingClientRect().left - left)) closest = index;
		select.value = keys[closest];
		if (this.columnNav?.offsetWidth) this.activeNavigatorColumn = keys[closest];
		select.title = labels[closest] ?? "";
		this.previousColumn.disabled = closest === 0;
		this.nextColumn.disabled = closest >= columns.length - 1;
		this.previousColumn.setAttribute("aria-label", labels[Math.max(0, closest - 1)] ?? select.getAttribute("aria-label") ?? "");
		this.nextColumn.setAttribute("aria-label", labels[Math.min(columns.length - 1, closest + 1)] ?? select.getAttribute("aria-label") ?? "");
	}

	protected async handleTaskUpdate(task: TaskInfo): Promise<void> {
		// For kanban, just do full refresh since cards might move columns
		this.debouncedRefresh();
	}

	protected debouncedRefresh(): void {
		if (this.updateDebounceTimer) {
			this.debugLog("DEBOUNCED-REFRESH: cancelling previous pending timer");
			window.clearTimeout(this.updateDebounceTimer);
		}

		this.debugLog("DEBOUNCED-REFRESH: scheduling render in 150ms", {
			activeDropCount: this.activeDropCount,
			suppressRenderRemaining: Math.max(0, this.suppressRenderUntil - Date.now()),
		});

		// Use correct window for pop-out window support
		const win = this.containerEl.ownerDocument.defaultView || window;
		this.updateDebounceTimer = win.setTimeout(() => {
			void (async () => {
				if (this.draggedTaskPath || this.structureDragActive || this.touchDragActive) {
					this.pendingRender = true;
					this.updateDebounceTimer = null;
					return;
				}
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
		this.renderTaskEmptyState(this.boardEl);
	}

	private renderNoGroupByError(): void {
		if (!this.boardEl) return;
		// Use containerEl.ownerDocument for pop-out window support
		const doc = this.containerEl.ownerDocument;
		const error = createElementInDocument(doc, "div");
		error.className = "tn-bases-error";
		error.textContent = this.plugin.i18n.translate(msg({ message: "Kanban view requires a ''group by'' property to be configured. Click the ''sort'' button and select a property under ''group by''.", context: "views.kanban.errors.noGroupBy" }));
		this.boardEl.appendChild(error);
	}

	renderError(error: Error): void {
		if (!this.boardEl) return;
		// Use containerEl.ownerDocument for pop-out window support
		const doc = this.containerEl.ownerDocument;
		const errorEl = createElementInDocument(doc, "div");
		errorEl.className = "tn-bases-error";
		errorEl.textContent = uiText(msg({ message: "Error loading kanban: {message}", context: "bases/KanbanView: KanbanView.renderError display" }), { message: displayError(error.message || "Unknown error") });
		this.boardEl.appendChild(errorEl);
	}

	private getGroupDisplayTitle(title: string, propertyId?: string | null): string {
		if ([NONE_GROUP_KEY, TRUE_GROUP_KEY, FALSE_GROUP_KEY].some(key => key === title)) {
			const sources = title === NONE_GROUP_KEY && propertyId === this.getGroupByPropertyId() ? this.dataAdapter?.getGroupedData().filter(group => this.dataAdapter.convertGroupKeyToString(group.key) === title).map(group => group.key) : [];
			const label = groupKeyLabel(title, { values: sources, propertyType: propertyId && this.plugin.app ? getObsidianPropertyType(this.plugin.app, stripPropertyPrefix(propertyId)) : undefined });
			if (label !== title) return label;
		}
		if (!propertyId) {
			return title;
		}

		const cleanProperty = stripPropertyPrefix(propertyId);

		const statusField = this.plugin.fieldMapper.toUserField("status");
		if (cleanProperty === statusField) {
			const statusConfig = this.plugin.statusManager.getStatusConfig(title);
			if (configLabel(statusConfig)) {
				return configLabel(statusConfig);
			}
		}

		const priorityField = this.plugin.fieldMapper.toUserField("priority");
		if (cleanProperty === priorityField) {
			const priorityConfig = this.plugin.priorityManager.getPriorityConfig(title);
			if (configLabel(priorityConfig)) {
				return configLabel(priorityConfig);
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
		if (isStatusGrouping && title !== NONE_GROUP_KEY) {
			const statusConfig = this.plugin.statusManager.getStatusConfig(title);
			if (statusConfig) {
				// Only show icon in title when consolidation is enabled
				if (this.consolidateStatusIcon && !skipIcon && statusConfig.icon) {
					const iconEl = container.createSpan({ cls: "kanban-view__column-icon" });
					iconEl.style.color = statusConfig.color;
					setIcon(iconEl, statusConfig.icon);
				}
				this.renderLinkAwareGroupTitle(container, configLabel(statusConfig));
				return;
			}
		}

		// Default: use link-aware title rendering
		const propertyId = isSwimLane ? this.swimLanePropertyId : this.getGroupByPropertyId();
		const linkTitle = isSwimLane ? null : this.dataAdapter?.getGroupLinkTitle(title);
		this.renderLinkAwareGroupTitle(container, linkTitle ?? this.getGroupDisplayTitle(title, propertyId));
	}

	private renderLinkAwareGroupTitle(container: HTMLElement, title: string): void {
		container.title = title;
		const app = this.app || this.plugin.app;
		const linkServices: LinkServices = {
			translate: this.plugin.i18n.translate.bind(this.plugin.i18n),
			metadataCache: app.metadataCache,
			workspace: app.workspace,
		};
		renderGroupTitle(container, title, linkServices);
		container.tabIndex = 0;
		if (!container.querySelector("a")) container.setAttribute("role", "button");
		container.setAttribute("aria-label", container.textContent || title);
		container.setAttribute("aria-haspopup", "dialog");
		container.setAttribute("aria-expanded", "false");
		const reveal = () => {
			if (container.getAttribute("aria-expanded") === "true") return;
			const popover = openPopover({ anchor: container, app,
				onClose: () => container.setAttribute("aria-expanded", "false"),
			});
			popover.el.setAttribute("role", "dialog");
			popover.el.setAttribute("aria-label", container.textContent || title);
			popover.el.createDiv({ cls: "tn-popover__title", text: container.textContent || title });
			container.setAttribute("aria-expanded", "true");
			popover.reposition();
		};
		container.addEventListener("click", event => {
			if ((event.target as HTMLElement).closest("a")) return;
			event.stopPropagation();
			reveal();
		});
		container.addEventListener("keydown", event => {
			if (event.target !== container || (event.key !== "Enter" && event.key !== " ")) return;
			event.preventDefault();
			event.stopPropagation();
			reveal();
		});
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
		columnKeys: string[],
		searchHiddenKeys?: ReadonlySet<string>
	): Map<string, Map<string, TaskInfo[]>> {
		return applyKanbanSwimLaneOrderToMap({
			swimLanePropertyId,
			swimLanes,
			columnKeys,
			swimLaneOrders: this.swimLaneOrders,
			hideEmptySwimLanes: this.hideEmptySwimLanes,
			searchHiddenKeys,
			priorityKeys: this.plugin.priorityManager
				.getAllPriorities()
				.map((priority) => priority.value),
			isPriorityField: (propertyId) => this.isPropertyField(propertyId, "priority"),
			isStatusField: (propertyId) => this.isPropertyField(propertyId, "status"),
			getPriorityWeight: (key) => this.plugin.priorityManager.getPriorityWeight(key),
			getStatusOrder: (key) => this.plugin.statusManager.getStatusOrder(key),
		});
	}

	private saveSwimLaneOrder(swimLanePropertyId: string, order: string[]): void {
		this.swimLaneOrders[swimLanePropertyId] = order;

		try {
			this.config.set("swimLaneOrder", JSON.stringify(this.swimLaneOrders));
		} catch (error) {
			tasknotesLogger.error("[KanbanView] Failed to save swimlane order:", {
				category: "persistence",
				operation: "save-swimlane-order",
				error: error,
			});
		}
	}

	private isColumnCollapsed(propertyId: string, groupKey: string): boolean {
		return this.collapsedColumns[propertyId]?.includes(groupKey) ?? false;
	}

	private saveColumnCollapsed(propertyId: string, groupKey: string, collapsed: boolean): void {
		const values = (this.collapsedColumns[propertyId] ?? []).filter((value) => value !== groupKey);
		if (collapsed) values.push(groupKey);
		if (values.length > 0) {
			this.collapsedColumns[propertyId] = values;
		} else {
			delete this.collapsedColumns[propertyId];
		}

		try {
			this.config.set("collapsedColumns", JSON.stringify(this.collapsedColumns));
		} catch (error) {
			tasknotesLogger.error("[KanbanView] Failed to save collapsed columns:", {
				category: "persistence",
				operation: "save-collapsed-columns",
				error: error,
			});
		}
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
			tasknotesLogger.error("[KanbanView] Failed to save column order:", {
				category: "persistence",
				operation: "save-column-order",
				error: error,
			});
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
			usePendingOccurrenceIdentity: true,
			onSelectionClick: (event, path) => this.handleSelectionClick(event, path),
			hideStatusIndicator,
			expandedRelationshipFilterMode: this.expandedRelationshipFilterMode,
			resolveExpandedRelationshipFilterMode: (): "inherit" | "show-all" =>
				normalizeExpandedRelationshipFilterMode(
					this.config?.get("expandedRelationshipFilterMode")
				),
			expandedRelationshipTaskPaths: this.expandedRelationshipTaskPaths,
			expandedRelationshipTaskOrder: this.expandedRelationshipTaskOrder,
		});
	}

	private getTopLevelRenderTasks(tasks: readonly TaskInfo[]): TaskInfo[] {
		return this.hideTopLevelSubtasks ? this.filterTopLevelSubtasks(tasks) : [...tasks];
	}

	private setExpandedRelationshipTaskScope(tasks: readonly TaskInfo[]): void {
		this.expandedRelationshipTaskPaths.clear();
		this.expandedRelationshipTaskOrder.clear();
		tasks.forEach((task, index) => {
			this.expandedRelationshipTaskPaths.add(task.path);
			this.expandedRelationshipTaskOrder.set(task.path, index);
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

	protected getVisibleTaskPaths(): string[] {
		const paths: string[] = [];
		const containers =
			this.rootElement?.querySelectorAll<HTMLElement>(
				".kanban-view__cards, .kanban-view__tasks-container"
			) ?? [];
		for (const container of containers) {
			if (container.closest(".kanban-view__column--collapsed")) continue;
			const column = container.closest<HTMLElement>(
				"[data-group], [data-column][data-swimlane]"
			);
			const key =
				column?.dataset.group ??
				this.getColumnScrollerKey(
					column?.dataset.column ?? "",
					column?.dataset.swimlane ?? null
				);
			const scroller = this.columnScrollers.get(key);
			if (scroller) paths.push(...scroller.getItems().map((task) => task.path));
			else
				paths.push(
					...Array.from(
						container.querySelectorAll<HTMLElement>(".task-card[data-task-path]")
					).flatMap((card) => (card.dataset.taskPath ? [card.dataset.taskPath] : []))
				);
		}
		return [...new Set(paths)];
	}

	protected revealKeyboardTask(path: string): void {
		for (const scroller of this.columnScrollers.values()) {
			const index = scroller.getItems().findIndex((task) => task.path === path);
			if (index >= 0) {
				scroller.scrollToIndex(index, "instant");
				return;
			}
		}
	}

	protected getHorizontalTaskPath(path: string | null, direction: number): string | null {
		const board = this.boardEl;
		if (!board) return null;
		const initialPath = path ?? this.getVisibleTaskPaths()[direction > 0 ? 0 : this.getVisibleTaskPaths().length - 1];
		const source = initialPath ? this.currentTaskElements.get(initialPath) : null;
		if (!path && initialPath) return initialPath;
		const sourceCell = source?.closest<HTMLElement>(".kanban-view__column, .kanban-view__swimlane-column");
		const row = sourceCell?.parentElement ?? board;
		const columns = Array.from(row.querySelectorAll<HTMLElement>(":scope > .kanban-view__column, :scope > .kanban-view__swimlane-column"));
		let index = sourceCell ? columns.indexOf(sourceCell) + direction : direction > 0 ? 0 : columns.length - 1;
		while (index >= 0 && index < columns.length) {
			const column = columns[index];
			if (!column.classList.contains("kanban-view__column--collapsed")) {
				const destinations = column.classList.contains("kanban-view__swimlane-column")
					? Array.from(board.querySelectorAll<HTMLElement>(".kanban-view__swimlane-column")).filter(cell => cell.dataset.column === column.dataset.column)
					: [column];
				const cards = destinations.flatMap(cell => Array.from(cell.querySelectorAll<HTMLElement>(".kanban-view__card-wrapper[data-task-path]")));
				const sourceY = source?.getBoundingClientRect().top ?? 0;
				cards.sort((first, second) => Math.abs(first.getBoundingClientRect().top - sourceY) - Math.abs(second.getBoundingClientRect().top - sourceY));
				if (cards[0]?.dataset.taskPath) return cards[0].dataset.taskPath;
				for (const destination of destinations) {
					const key = destination.dataset.group ?? this.getColumnScrollerKey(destination.dataset.column ?? "", destination.dataset.swimlane ?? null);
					const virtual = this.columnScrollers.get(key)?.getItems();
					if (virtual?.length) return virtual[0].path;
				}
			}
			index += direction;
		}
		return path;
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
		if (!this.boardEl) return;
		for (const eventName of ["dragenter", "dragover"] as const) {
			this.registerDomEvent(this.boardEl.ownerDocument, eventName, event => {
				if (!this.draggedTaskPath || this.boardEl?.contains(event.target as Node)) return;
				this.boardEl?.classList.add("kanban-view__board--invalid-drop");
				this.boardEl?.ownerDocument.body.classList.add("tn-drag-invalid");
				this.dragPreview.setInvalid(uiText(msg({ message: "Drop on a task row or group destination.", context: "task list drop restriction" })));
				this.clearDragoverFeedback();
				this.cleanupDragShift();
				this.stopAutoScroll();
			}, { capture: true });
		}
		this.registerDomEvent(this.boardEl, "pointerdown", () => {
			this.rootElement?.classList.add("kanban-view--pointer");
		}, { capture: true });
		for (const eventName of ["dragenter", "dragover"] as const) {
			this.registerDomEvent(this.boardEl, eventName, event => {
				if (this.structureDragActive) {
					this.handleAutoScroll(event.clientX, event.clientY);
					return;
				}
				if (!this.draggedTaskPath) return;
				this.handleAutoScroll(event.clientX, event.clientY);
				this.updateNativeDropFeedback(event);
			}, { capture: true });
		}
		this.registerDomEvent(this.boardEl, "drop", event => {
			if (this.draggedTaskPath && this.getDropRestriction()) {
				event.preventDefault();
				event.stopImmediatePropagation();
			}
		}, { capture: true });
		this.registerDomEvent(this.boardEl, "dragleave", event => {
			if (!this.boardEl?.contains(event.relatedTarget as Node | null)) {
				this.stopAutoScroll();
				this.clearDragoverFeedback();
				this.cleanupDragShift();
			}
		});
		this.registerDomEvent(this.boardEl.ownerDocument, "keydown", event => {
			this.rootElement?.classList.remove("kanban-view--pointer");
			if (event.key === "Escape" && (this.touchDragActive || this.draggedTaskPath)) {
				event.preventDefault();
				event.stopImmediatePropagation();
				this.cleanupFloatingDragPreview();
				this.clearTouchDragState();
				if (this.pendingRender) {
					this.pendingRender = false;
					this.debouncedRefresh();
				}
			}
		}, { capture: true });
	}

	private getDropRestriction(): string | null {
		if (this.getGroupByPropertyId()?.startsWith("formula.")) {
			return this.plugin.i18n.translate(msg({ message: "Cannot move tasks between formula-based columns. Formula values are computed and cannot be directly modified.", context: "views.kanban.errors.formulaGroupingReadOnly" }));
		}
		if (this.swimLanePropertyId?.startsWith("formula.")) {
			return this.plugin.i18n.translate(msg({ message: "Cannot move tasks between formula-based swimlanes. Formula values are computed and cannot be directly modified.", context: "views.kanban.errors.formulaSwimlaneReadOnly" }));
		}
		return null;
	}

	private updateNativeDropFeedback(event: DragEvent): void {
		const restriction = this.getDropRestriction();
		const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(".kanban-view__column, .kanban-view__swimlane-column");
		this.boardEl?.classList.toggle("kanban-view__board--invalid-drop", restriction !== null || !target);
		this.boardEl?.ownerDocument.body.classList.toggle("tn-drag-invalid", restriction !== null || !target);
		this.dragPreview.setInvalid(restriction ?? (target ? null : uiText(msg({ message: "Drop on a task row or group destination.", context: "task list drop restriction" }))));
		this.clearDragoverFeedback();
		if (restriction) {
			if (event.dataTransfer) event.dataTransfer.dropEffect = "none";
			event.preventDefault();
			event.stopImmediatePropagation();
			this.cleanupDragShift();
			return;
		}
		if (!target) {
			if (event.dataTransfer) event.dataTransfer.dropEffect = "none";
			this.cleanupDragShift();
			return;
		}
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
		target.classList.add(target.matches(".kanban-view__column") ? "kanban-view__column--dragover" : "kanban-view__swimlane-column--dragover");
		const container = target.querySelector<HTMLElement>(".kanban-view__cards, .kanban-view__tasks-container");
		if (!container || !isSortOrderInSortConfig(this.dataAdapter, this.plugin.settings.fieldMapping.sortOrder)) return;
		if (this.dragOverRafId) {
			cancelAnimationFrame(this.dragOverRafId);
			this.dragOverRafId = 0;
		}
		if (container !== this.dragContainer) {
			this.cleanupDragShift();
			this.dragContainer = container;
		}
		const siblings = Array.from(container.querySelectorAll<HTMLElement>(".kanban-view__card-wrapper"))
			.filter(card => !this.draggedTaskPaths.includes(card.dataset.taskPath || ""));
		const insertionIndex = siblings.findIndex(card => event.clientY < card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2);
		this.currentInsertionIndex = insertionIndex < 0 ? siblings.length : insertionIndex;
		const next = siblings[this.currentInsertionIndex];
		const last = siblings[siblings.length - 1];
		this.dropTargetPath = next?.dataset.taskPath ?? last?.dataset.taskPath ?? null;
		this.dropAbove = !!next;
		updateKanbanDropMarker(container, siblings, this.currentInsertionIndex);
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
		this.pendingRender = false;
		this.structureDragActive = false;
		this.containerEl.ownerDocument.body.classList.remove("tn-drag-active", "tn-drag-invalid");
		this.clearTouchDragState();
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
		this.columnNav?.remove();
		this.columnNav = null;
		this.columnSelect = null;
		this.previousColumn = null;
		this.nextColumn = null;
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
			tasknotesLogger.error("[TaskNotes][KanbanView] No containerEl provided", {
				category: "stale-data",
				operation: "no-containerel-provided",
			});
			throw new Error("KanbanView requires a containerEl");
		}

		// Create and return the view instance directly; Bases assigns runtime view fields.
		return new KanbanView(controller, containerEl, plugin) as unknown as BasesView;
	};
}

/* eslint-enable @typescript-eslint/no-non-null-assertion -- Re-enable after the legacy view implementation. */
