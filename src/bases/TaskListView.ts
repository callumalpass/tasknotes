/* eslint-disable @typescript-eslint/no-non-null-assertion -- Legacy Bases view rendering narrows DOM references through lifecycle checks. */
import { Menu, Notice, TFile, setIcon, type MenuItem } from "obsidian";
import type { BasesView, BasesViewFactory } from "obsidian";
import TaskNotesPlugin from "../main";
import { BasesViewBase } from "./BasesViewBase";
import { readBasesViewConfigValue, readBasesViewPropertyId } from "./basesViewConfig";
import { TaskInfo } from "../types";
import { identifyTaskNotesFromBasesData } from "./helpers";
import { createTaskCard, showTaskContextMenu, type TaskCardOptions } from "../ui/TaskCard";
import { getTaskCardPropertyValue } from "../ui/taskCardPropertyAccess";
import { normalizeTaskSignatureValue } from "./taskSignatureValue";
import { renderGroupTitle } from "./groupTitleRenderer";
import { type LinkServices } from "../ui/renderers/linkRenderer";
import { DateContextMenu } from "../components/DateContextMenu";
import { PriorityContextMenu } from "../components/PriorityContextMenu";
import { RecurrenceContextMenu } from "../components/RecurrenceContextMenu";
import { showConfirmationModal } from "../modals/ConfirmationModal";
import { ReminderModal } from "../modals/ReminderModal";
import {
	getDatePart,
	getTimePart,
	getCurrentTimestamp,
	parseDateToUTC,
	createUTCDateFromLocalCalendarDate,
} from "../utils/dateUtils";
import { stringifyUnknown } from "../utils/stringUtils";
import { VirtualScroller } from "../utils/VirtualScroller";
import {
	isSortOrderInSortConfig,
	getSortOrderDirection,
	prepareSortOrderUpdate,
	applySortOrderPlan,
	DropOperationQueue,
	type SortOrderPlan,
} from "./sortOrderUtils";
import { createElementInDocument } from "../utils/documentDom";
import {
	computeBasesFormulas,
	isObsidianListProperty,
	populateBasesFormulaProperty,
} from "./basesViewAdapters";
import { coerceGroupKeyForFrontmatter as coercePropertyGroupKeyForFrontmatter } from "./propertyValueCoercion";
import {
	getTaskListDropSegments,
	reconstructTaskListDropTarget,
	resolveTaskListInsertionSlot,
	type TaskListDropBaselineCard,
	type TaskListDropSegment,
	type TaskListInsertionSlot,
} from "./taskListDragGeometry";
import {
	buildTaskListGroupedRenderItems,
	buildTaskListGroupedScopePaths,
	buildTaskListPathProperties,
	buildTaskListSubPropertyRenderItems,
	buildTaskListSubPropertyScopePaths,
	groupTasksByTaskListSubProperty,
	getTaskListPropertyValue,
	stringifyTaskListGroupValue,
	type TaskListGroup,
	type TaskListHeaderItem,
	type TaskListRenderItem,
	type TaskListVirtualItem,
} from "./taskListGrouping";
import {
	applyTaskListDropFrontmatterMutation,
	buildTaskListDropSideEffectTask,
	buildTaskListGroupDropPlan,
	type TaskListGroupDropPlan,
} from "./taskListDropPlanning";
import {
	planTaskListMovement,
	taskListDestinationKey,
	type TaskListDestination,
	type TaskListMovementPlan,
} from "./taskListMovement";
import {
	buildTaskMovementUndo,
	applyTaskMovementUndo,
	type TaskMovementUndoChange,
} from "./taskMovementUndo";
import {
	getListMembers,
	getMovedListMembers,
	isWritableGroupingProperty,
	moveGroupListValue,
} from "./groupPropertyMutation";
import { TaskMovementTouch } from "./taskMovementTouch";
import { TaskMovementAutoScroll } from "./taskMovementAutoScroll";
import {
	applySortOrderUpdatesToItems,
	applySortOrderUpdatesToTaskCache,
	buildSortOrderUpdateMap,
	moveItemsRelativeToTarget,
} from "./manualOrderState";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import { processVaultFrontMatter } from "../services/VaultMutationService";
import {
	assignTaskParent,
	previewTaskParentAssignment,
	TaskParentAssignmentError,
	type TaskParentAssignmentState,
} from "../services/taskParentAssignment";
import { openTaskSelector } from "../modals/TaskSelectorWithCreateModal";

const tasknotesLogger = createTaskNotesLogger({ tag: "Bases/TaskListView" });

type TaskListDataAdapterWithView = {
	basesView: TaskListView;
};

type TaskListControllerView = {
	name?: string;
	groupBy?: string | { property?: string };
};

type TaskListController = {
	query?: { views?: TaskListControllerView[] };
	viewName?: string;
};

type TaskListEphemeralState = {
	collapsedGroups?: unknown;
	collapsedSubGroups?: unknown;
	itemsContainerScrollTop?: unknown;
	scrollTop?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isTaskListEphemeralState(value: unknown): value is TaskListEphemeralState {
	return isRecord(value);
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

type DefaultCollapsedState = "Expanded" | "Collapsed";
type TaskListDropIntent =
	| TaskListMovementPlan
	| { kind: "parent"; parentPath: string; state: TaskParentAssignmentState };

type GroupHierarchySnapshot = {
	primaryGroupKeys: string[];
	subGroupKeysByParent: Map<string, string[]>;
};

export class TaskListView extends BasesViewBase {
	type = "tasknotesTaskList";

	private configLoaded = false; // Track if we've successfully loaded config
	private itemsContainer: HTMLElement | null = null;
	private currentTaskElements = new Map<string, HTMLElement>();
	private lastRenderWasGrouped = false;
	private lastFlatPaths: string[] = [];
	private lastVirtualItems: TaskListVirtualItem[] = [];
	private lastTaskSignatures = new Map<string, string>();
	private lastCardRenderSignature = "";
	private taskInfoCache = new Map<string, TaskInfo>();
	private clickTimeouts = new Map<string, number>();
	private currentTargetDate = createUTCDateFromLocalCalendarDate(new Date());
	private containerListenersRegistered = false;
	private virtualScroller: VirtualScroller<TaskListVirtualItem> | null = null; // Can render TaskInfo or group headers
	private useVirtualScrolling = false;
	private collapsedGroups = new Set<string>(); // Track collapsed group keys
	private collapsedSubGroups = new Set<string>(); // Track collapsed sub-group keys
	private subGroupPropertyId: string | null = null; // Property ID for sub-grouping
	private defaultCollapsedState: DefaultCollapsedState = "Expanded";
	private expandedRelationshipFilterMode: TaskCardOptions["expandedRelationshipFilterMode"] =
		"inherit";
	private currentVisibleTaskPaths = new Set<string>();
	private currentVisibleTaskOrder = new Map<string, number>();
	private expandedRelationshipTaskPaths = new Set<string>();
	private expandedRelationshipTaskOrder = new Map<string, number>();
	private hideTopLevelSubtasks = false;
	private currentPrimaryGroupKeys: string[] = [];
	private currentSubGroupKeysByParent = new Map<string, string[]>();
	private initializedPrimaryGroupKeys = new Set<string>();
	private initializedSubGroupKeys = new Set<string>();
	private deferCollapseDefaultForNextSnapshot = false;

	// Drag-to-reorder state
	private basesController: TaskListController;
	private draggedTaskPath: string | null = null;
	private dragGroupKey: string | null = null;
	private currentInsertionGroupKey: string | null = null;
	private currentInsertionSegmentIndex = -1;
	private currentInsertionIndex = -1;
	private pendingDragClientY: number | null = null;
	private pendingDragTarget: EventTarget | null = null;
	private pendingRender = false;
	private taskGroupKeys = new Map<string, string>(); // task path → group key (set during grouped render)
	private sortScopeTaskPaths = new Map<string, string[]>();
	private sortScopeCandidateTaskPaths = new Map<string, string[]>();
	private dragOverRafId = 0; // rAF handle for throttled dragover
	private currentDropSlotElement: HTMLElement | null = null;
	private currentDropSlotPosition: "before" | "after" | null = null;
	private dragBaselineCards: TaskListDropBaselineCard[] = [];
	private dropQueue = new DropOperationQueue();
	private dragSourceDestination: TaskListDestination | null = null;
	private dropDestination: TaskListDestination | null = null;
	private dropIsHeader = false;
	/** Whether the last resolved target accepts a drop; dropEffect must be set synchronously. */
	private currentDropAllowed = false;
	private movementProperties = new Map<string, Record<string, unknown>>();
	private movementSubGroupKeys = new Map<string, string>();
	private elementDestinations = new WeakMap<HTMLElement, TaskListDestination>();
	private movementDestinations = new Map<string, TaskListDestination>();
	private movementFeedback: HTMLElement | null = null;
	private emptyDestinations: HTMLElement | null = null;
	private touchMovement: TaskMovementTouch | null = null;
	private edgeScroll: TaskMovementAutoScroll | null = null;
	private touchGhost: HTMLElement | null = null;

	/**
	 * Threshold for enabling virtual scrolling in task list view.
	 * Virtual scrolling activates when total items (tasks + group headers) >= 100.
	 * Benefits: ~90% memory reduction, eliminates UI lag for large lists.
	 * Lower than KanbanView (30) because task cards are simpler/smaller.
	 */
	private readonly VIRTUAL_SCROLL_THRESHOLD = 100;
	/** How far from a row edge an insertion line still applies when not over a row. */
	private readonly NEARBY_SLOT_TOLERANCE_PX = 24;
	private readonly LARGE_REORDER_WARNING_THRESHOLD = 10;
	private readonly UNGROUPED_SORT_SCOPE_KEY = "__ungrouped__";
	private readonly CARD_NO_DRAG_SELECTOR =
		'[data-tn-no-drag="true"], a, button, input, select, textarea, [contenteditable="true"]';
	private readonly CARD_DRAG_HANDLE_SELECTOR = '[data-tn-drag-handle="true"]';

	constructor(controller: unknown, containerEl: HTMLElement, plugin: TaskNotesPlugin) {
		super(controller, containerEl, plugin);
		this.basesController = controller as TaskListController;
		// BasesView now provides this.data, this.config, and this.app directly
		// Update the data adapter to use this BasesView instance
		(this.dataAdapter as unknown as TaskListDataAdapterWithView).basesView = this;
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
		this.registerGroupContextMenuListeners();
	}

	/**
	 * Register contextmenu listeners for group collapse actions.
	 * - Right-click on a primary group header → expand/collapse branch
	 * - Right-click on empty container area → expand/collapse all groups
	 */
	private registerGroupContextMenuListeners(): void {
		if (!this.rootElement) return;

		this.rootElement.addEventListener("contextmenu", (event: MouseEvent) => {
			const target = event.target as HTMLElement;

			// Check if right-clicking on a primary group header (not a subgroup)
			const groupHeader = target.closest<HTMLElement>(".task-group-header");
			if (groupHeader) {
				const groupSection = groupHeader.closest<HTMLElement>(".task-group");
				const groupKey = groupSection?.dataset.groupKey;
				if (groupKey && !this.isSubGroupKey(groupKey)) {
					event.preventDefault();
					this.showGroupHeaderContextMenu(event, groupKey);
					return;
				}
			}

			// Check if right-clicking on empty area (not on a task card or group header)
			const isOnTaskCard = target.closest(".task-card");
			if (!isOnTaskCard && !groupHeader && this.currentPrimaryGroupKeys.length > 0) {
				event.preventDefault();
				this.showContainerContextMenu(event);
			}
		});
	}

	private showGroupHeaderContextMenu(event: MouseEvent, groupKey: string): void {
		const subGroupKeys = this.currentSubGroupKeysByParent.get(groupKey);
		if (!subGroupKeys || subGroupKeys.length === 0) return;

		const allSubGroupsCollapsed = subGroupKeys.every((key) => this.collapsedSubGroups.has(key));
		const menu = new Menu();

		menu.addItem((item) => {
			item.setTitle(allSubGroupsCollapsed ? "Expand subgroups" : "Collapse subgroups")
				.setIcon(allSubGroupsCollapsed ? "list-tree" : "list-collapse")
				.onClick(() => void this.setSubGroupsCollapsed(groupKey, !allSubGroupsCollapsed));
		});

		menu.showAtMouseEvent(event);
	}

	private showContainerContextMenu(event: MouseEvent): void {
		const menu = new Menu();

		menu.addItem((item) => {
			item.setTitle("Expand all groups")
				.setIcon("chevrons-down")
				.onClick(() => void this.setAllPrimaryGroupsCollapsed(false));
		});

		menu.addItem((item) => {
			item.setTitle("Collapse all groups")
				.setIcon("chevrons-up")
				.onClick(() => void this.setAllPrimaryGroupsCollapsed(true));
		});

		menu.addItem((item) => {
			item.setTitle("Expand all groups and subgroups")
				.setIcon("list-tree")
				.onClick(() => void this.setAllGroupsAndSubGroupsCollapsed(false));
		});

		menu.addItem((item) => {
			item.setTitle("Collapse all groups and subgroups")
				.setIcon("list-collapse")
				.onClick(() => void this.setAllGroupsAndSubGroupsCollapsed(true));
		});

		menu.showAtMouseEvent(event);
	}

	/**
	 * Read view configuration options from BasesViewConfig.
	 */
	private readViewOptions(): void {
		// Guard: config may not be set yet if called too early
		if (!this.config || typeof this.config.get !== "function") {
			tasknotesLogger.debug("[TaskListView] Config not available yet in readViewOptions", {
				category: "configuration",
				operation: "config-not-yet-readviewoptions",
			});
			return;
		}

		try {
			const get = (key: string): unknown => readBasesViewConfigValue(this.config, key);
			this.subGroupPropertyId = readBasesViewPropertyId(this.config, "subGroup");
			// Read enableSearch toggle (default: false for backward compatibility)
			const enableSearchValue = get("enableSearch");
			this.enableSearch = (enableSearchValue as boolean) ?? false;
			const defaultCollapsedStateValue = get("defaultCollapsedState");

			this.defaultCollapsedState =
				defaultCollapsedStateValue === "Collapsed" || defaultCollapsedStateValue === "1"
					? "Collapsed"
					: "Expanded";
			const expandedRelationshipFilterModeValue = get("expandedRelationshipFilterMode");
			this.expandedRelationshipFilterMode = normalizeExpandedRelationshipFilterMode(
				expandedRelationshipFilterModeValue
			);
			this.hideTopLevelSubtasks = get("hideTopLevelSubtasks") === true;
			// Mark config as successfully loaded
			this.configLoaded = true;
		} catch (e) {
			// Use defaults
			tasknotesLogger.warn("[TaskListView] Failed to parse config:", {
				category: "configuration",
				operation: "parse-config",
				error: e,
			});
		}
	}

	private clearGroupingSnapshot(): void {
		this.currentPrimaryGroupKeys = [];
		this.currentSubGroupKeysByParent.clear();
	}

	private initializeCollapseStateForSnapshot(
		primaryGroupKeys: string[],
		subGroupKeysByParent: Map<string, string[]>
	): void {
		const shouldSeedCollapsedState =
			this.defaultCollapsedState === "Collapsed" && !this.deferCollapseDefaultForNextSnapshot;

		for (const primaryGroupKey of primaryGroupKeys) {
			if (this.initializedPrimaryGroupKeys.has(primaryGroupKey)) {
				continue;
			}

			this.initializedPrimaryGroupKeys.add(primaryGroupKey);
			if (shouldSeedCollapsedState) {
				this.collapsedGroups.add(primaryGroupKey);
			}
		}

		for (const subGroupKeys of subGroupKeysByParent.values()) {
			for (const subGroupKey of subGroupKeys) {
				if (this.initializedSubGroupKeys.has(subGroupKey)) {
					continue;
				}

				this.initializedSubGroupKeys.add(subGroupKey);
				if (shouldSeedCollapsedState) {
					this.collapsedSubGroups.add(subGroupKey);
				}
			}
		}

		this.deferCollapseDefaultForNextSnapshot = false;
	}

	private applyGroupingSnapshot(snapshot: GroupHierarchySnapshot): void {
		const subGroupKeysByParent = new Map<string, string[]>();
		for (const [primaryKey, subGroupKeys] of snapshot.subGroupKeysByParent.entries()) {
			subGroupKeysByParent.set(primaryKey, [...subGroupKeys]);
		}

		this.initializeCollapseStateForSnapshot(snapshot.primaryGroupKeys, subGroupKeysByParent);
		this.currentPrimaryGroupKeys = [...snapshot.primaryGroupKeys];
		this.currentSubGroupKeysByParent = subGroupKeysByParent;
	}

	private createGroupedHierarchySnapshot(
		groups: readonly TaskListGroup[],
		taskNotes: readonly TaskInfo[]
	): GroupHierarchySnapshot {
		const snapshot: GroupHierarchySnapshot = {
			primaryGroupKeys: [],
			subGroupKeysByParent: new Map<string, string[]>(),
		};
		const pathToProps = this.subGroupPropertyId
			? this.getGroupingPathProperties()
			: new Map<string, Record<string, unknown>>();

		for (const group of groups) {
			const primaryKey = this.dataAdapter.convertGroupKeyToString(group.key);
			const groupPaths = new Set(group.entries.map((entry) => entry.file?.path));
			const groupTasks = taskNotes.filter((task) => groupPaths.has(task.path));

			if (groupTasks.length === 0) {
				continue;
			}

			snapshot.primaryGroupKeys.push(primaryKey);
			if (!this.subGroupPropertyId) {
				continue;
			}

			const subGroupKeys: string[] = [];
			const subGroups = groupTasksByTaskListSubProperty(
				groupTasks,
				this.subGroupPropertyId,
				pathToProps
			);

			for (const [subKey, subTasks] of subGroups) {
				if (subTasks.length === 0) {
					continue;
				}
				subGroupKeys.push(`${primaryKey}:${subKey}`);
			}

			if (subGroupKeys.length > 0) {
				snapshot.subGroupKeysByParent.set(primaryKey, subGroupKeys);
			}
		}

		return snapshot;
	}

	private createSubPropertyHierarchySnapshot(
		groupedTasks: Map<string, TaskInfo[]>
	): GroupHierarchySnapshot {
		return {
			primaryGroupKeys: Array.from(groupedTasks.keys()),
			subGroupKeysByParent: new Map<string, string[]>(),
		};
	}

	protected setupContainer(): void {
		super.setupContainer();

		// Make rootElement fill its container and establish flex context
		if (this.rootElement) {
			this.rootElement.classList.remove(
				"tn-static-display-block-2a1b75c9",
				"tn-static-display-flex-75816cae",
				"tn-static-display-flex-8bb39979",
				"tn-static-display-inline-block-60e32dcb",
				"tn-static-display-inline-cccfa456",
				"tn-static-display-inline-flex-f984c520",
				"tn-static-display-none-6b99de8b",
				"tn-static-flex-direction-column-06c8b5ed",
				"tn-static-height-0-7a31cef0",
				"tn-static-height-100-62264068",
				"tn-static-height-12px-06c0747e",
				"tn-static-height-16px-30de4aee",
				"tn-static-height-24px-29a11d37",
				"tn-static-min-height-800px-997b4c8c"
			);
			this.rootElement.classList.add("tn-static-display-flex-4d51fc62");
		}

		// Use correct document for pop-out window support
		const doc = this.containerEl.ownerDocument;

		// Create items container
		const itemsContainer = createElementInDocument(doc, "div");
		itemsContainer.className = "tn-bases-items-container";
		// Use flex: 1 to fill available space in the rootElement flex container
		// max-height: 100vh prevents unbounded growth when embedded in notes
		// overflow-y: auto provides scrolling when content exceeds available height
		itemsContainer.classList.remove(
			"tn-static-flex-1-14e3b769",
			"tn-static-flex-1-97445a8d",
			"tn-static-font-size-12px-b0cc7e05",
			"tn-static-margin-top-0-5rem-3dc98b5e",
			"tn-static-margin-top-0-d462248a",
			"tn-static-margin-top-16px-1b0f4999",
			"tn-static-margin-top-1rem-2239d6d5",
			"tn-static-margin-top-20px-a26bda7d",
			"tn-static-margin-top-30px-2fbbbcd4",
			"tn-static-margin-top-4px-96ad6099",
			"tn-static-margin-top-8px-8a77e5a3",
			"tn-static-margin-top-8px-f4f01e68",
			"tn-static-max-height-400px-f0787633",
			"tn-static-overflow-y-auto-03df744e",
			"tn-static-overflow-y-clip-c5043043",
			"tn-static-position-relative-d461c96d"
		);
		itemsContainer.classList.add("tn-static-margin-top-12px-91e0f558");
		this.rootElement?.classList.add("task-list-view__movement-root");
		this.rootElement?.appendChild(itemsContainer);
		this.itemsContainer = itemsContainer;
		this.registerContainerListeners();
		this.setupContainerDragHandlers();
	}

	async render(): Promise<void> {
		if (!this.itemsContainer || !this.rootElement) return;

		// Defer re-render while a drag is in progress — re-rendering
		// destroys card elements and their event listeners, which
		// causes the drop event to never fire.
		if (this.draggedTaskPath) {
			this.pendingRender = true;
			return;
		}

		// Always re-read view options to catch config changes such as
		// switching expanded relationship filtering modes in Bases.
		if (this.config) {
			this.readViewOptions();
		}

		// Now that config is loaded, setup search (idempotent: will only create once)
		if (this.rootElement) {
			this.setupSearch(this.rootElement);
		}
		try {
			// Skip rendering if we have no data yet (prevents flickering during data updates)
			if (!this.data?.data) {
				this.clearGroupingSnapshot();
				return;
			}

			// Extract data using adapter (adapter now uses this as basesView)
			const dataItems = this.dataAdapter.extractDataItems();

			// Compute Bases formulas for TaskNotes items
			computeBasesFormulas(this.data, dataItems);

			const taskNotes = await identifyTaskNotesFromBasesData(dataItems, this.plugin);

			if (taskNotes.length === 0) {
				this.clearAllTaskElements();
				this.sortScopeTaskPaths.clear();
				this.sortScopeCandidateTaskPaths.clear();
				this.clearGroupingSnapshot();
				this.renderEmptyState();
				this.lastRenderWasGrouped = false;
				return;
			}

			const isGrouped = !!this.getGroupByPropertyId() || this.dataAdapter.isGrouped();

			// Special case: if sub-grouping is configured but primary grouping is not,
			// treat sub-group property as primary grouping
			if (!isGrouped && this.subGroupPropertyId) {
				if (!this.lastRenderWasGrouped) {
					this.clearAllTaskElements();
				}
				await this.renderGroupedBySubProperty(taskNotes);
				this.lastRenderWasGrouped = true;
			} else if (isGrouped) {
				if (!this.lastRenderWasGrouped) {
					this.clearAllTaskElements();
				}
				await this.renderGrouped(taskNotes);
				this.lastRenderWasGrouped = true;
			} else {
				if (this.lastRenderWasGrouped) {
					this.clearAllTaskElements();
				}
				this.clearGroupingSnapshot();
				await this.renderFlat(taskNotes);
				this.lastRenderWasGrouped = false;
			}
			// Check if we have grouped data
		} catch (error: unknown) {
			tasknotesLogger.error("[TaskNotes][TaskListView] Error rendering:", {
				category: "persistence",
				operation: "rendering",
				error: error,
			});
			this.clearAllTaskElements();
			this.sortScopeTaskPaths.clear();
			this.sortScopeCandidateTaskPaths.clear();
			this.renderError(error instanceof Error ? error : new Error(String(error)));
		}
	}

	// ── Drag-to-reorder ────────────────────────────────────────────────

	private getGroupByPropertyId(): string | null {
		const controller = this.basesController;
		if (controller?.query?.views && controller?.viewName) {
			for (const view of controller.query.views) {
				if (view?.name === controller.viewName) {
					if (view.groupBy) {
						if (typeof view.groupBy === "object" && view.groupBy.property)
							return view.groupBy.property;
						if (typeof view.groupBy === "string") return view.groupBy;
					}
					return null;
				}
			}
		}
		return null;
	}

	private getSortScopeKey(groupKey: string | null): string {
		return groupKey ?? this.UNGROUPED_SORT_SCOPE_KEY;
	}

	private getVisibleSortScopePaths(groupKey: string | null): string[] | undefined {
		return this.sortScopeTaskPaths.get(this.getSortScopeKey(groupKey));
	}

	private getCandidateSortScopePaths(groupKey: string | null): string[] | undefined {
		return this.sortScopeCandidateTaskPaths.get(this.getSortScopeKey(groupKey));
	}

	private setSortScopePaths(entries: Iterable<[string | null, string[]]>): void {
		this.sortScopeTaskPaths.clear();
		for (const [groupKey, paths] of entries) {
			this.sortScopeTaskPaths.set(this.getSortScopeKey(groupKey), [...paths]);
		}
	}

	private setSortScopeCandidatePaths(entries: Iterable<[string | null, string[]]>): void {
		this.sortScopeCandidateTaskPaths.clear();
		for (const [groupKey, paths] of entries) {
			this.sortScopeCandidateTaskPaths.set(this.getSortScopeKey(groupKey), [...paths]);
		}
	}

	private getVirtualItemTask(item: TaskListVirtualItem): TaskInfo | null {
		if ("type" in item) {
			return item.type === "task" ? item.task : null;
		}
		return item;
	}

	private getVirtualItemPath(item: TaskListVirtualItem): string | null {
		return this.getVirtualItemTask(item)?.path ?? null;
	}

	private getVirtualItemGroupKey(item: TaskListVirtualItem): string | null {
		if ("type" in item) {
			return item.type === "task" ? item.groupKey : null;
		}
		return null;
	}

	private rebuildSortScopesFromVirtualItems(items: TaskListVirtualItem[]): void {
		const groupedPaths = new Map<string | null, string[]>();
		const flatPaths: string[] = [];

		for (const item of items) {
			const task = this.getVirtualItemTask(item);
			if (!task) continue;

			flatPaths.push(task.path);
			const groupKey = this.getVirtualItemGroupKey(item);
			const paths = groupedPaths.get(groupKey) ?? [];
			paths.push(task.path);
			groupedPaths.set(groupKey, paths);
		}

		if (groupedPaths.size > 0) {
			this.setSortScopePaths(groupedPaths);
		} else {
			this.setSortScopePaths([[null, flatPaths]]);
		}
	}

	private applyOptimisticSortOrderResult(
		draggedPath: string,
		targetPath: string,
		above: boolean,
		targetGroupKey: string | null,
		sourceGroupKey: string | null,
		sortOrderPlan: SortOrderPlan
	): boolean {
		if (sourceGroupKey !== targetGroupKey) {
			return false;
		}

		const sortOrdersByPath = buildSortOrderUpdateMap(draggedPath, sortOrderPlan);
		applySortOrderUpdatesToTaskCache(this.taskInfoCache, sortOrdersByPath, (task) => {
			this.lastTaskSignatures.set(task.path, this.buildTaskSignature(task));
		});

		if (this.virtualScroller && this.lastVirtualItems.length > 0) {
			const items = moveItemsRelativeToTarget(
				this.lastVirtualItems,
				(item) => this.getVirtualItemPath(item),
				[draggedPath],
				targetPath,
				above
			);
			if (!items) {
				return false;
			}

			applySortOrderUpdatesToItems(
				items,
				(item) => this.getVirtualItemTask(item),
				sortOrdersByPath,
				(task) => {
					this.taskInfoCache.set(task.path, task);
					this.lastTaskSignatures.set(task.path, this.buildTaskSignature(task));
				}
			);

			this.lastVirtualItems = items;
			this.virtualScroller.updateItems(items);
			this.rebuildSortScopesFromVirtualItems(items);
			this.setCurrentVisibleTaskPaths(
				items
					.map((item) => this.getVirtualItemTask(item))
					.filter((task): task is TaskInfo => !!task)
			);
			this.lastFlatPaths = items
				.map((item) => this.getVirtualItemPath(item))
				.filter((path): path is string => !!path);
			return true;
		}

		const draggedCard = this.itemsContainer?.querySelector<HTMLElement>(
			`.task-card[data-task-path="${CSS.escape(draggedPath)}"]`
		);
		const targetCard = this.itemsContainer?.querySelector<HTMLElement>(
			`.task-card[data-task-path="${CSS.escape(targetPath)}"]`
		);
		if (!draggedCard || !targetCard) {
			return false;
		}

		if (above) {
			targetCard.before(draggedCard);
		} else {
			targetCard.after(draggedCard);
		}
		return true;
	}

	private isListTypeProperty(propertyName: string): boolean {
		if (isObsidianListProperty(this.plugin.app, propertyName)) {
			return true;
		}

		const contextsField = this.plugin.fieldMapper.toUserField("contexts");
		const projectsField = this.plugin.fieldMapper.toUserField("projects");

		return new Set([
			"contexts",
			contextsField,
			"projects",
			projectsField,
			"tags",
			"aliases",
		]).has(propertyName);
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

	private async confirmLargeReorder(
		editCount: number,
		targetGroupKey: string | null
	): Promise<boolean> {
		const sortOrderField = this.plugin.settings.fieldMapping.sortOrder;
		const scopeLabel =
			targetGroupKey === null
				? this.plugin.i18n.translate("views.taskList.reorder.scope.ungrouped")
				: this.plugin.i18n.translate("views.taskList.reorder.scope.group", {
						group: targetGroupKey,
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

	private getEventTargetElement(target: EventTarget | null): HTMLElement | null {
		const node = target as Node | null;
		if (!node || typeof node.nodeType !== "number") {
			return null;
		}

		return node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
	}

	private shouldSuppressCardDrag(target: EventTarget | null, cardEl: HTMLElement): boolean {
		const targetEl = this.getEventTargetElement(target);
		if (!targetEl || !cardEl.contains(targetEl)) {
			return false;
		}

		const noDragElement = targetEl.closest(this.CARD_NO_DRAG_SELECTOR);
		if (noDragElement && cardEl.contains(noDragElement)) {
			return true;
		}

		return (
			this.isMobileDragHandleOnlyMode(cardEl) &&
			!targetEl.closest(this.CARD_DRAG_HANDLE_SELECTOR)
		);
	}

	private isMobileDragHandleOnlyMode(cardEl: HTMLElement): boolean {
		return cardEl.ownerDocument.body.classList.contains("is-mobile");
	}

	private setupCardDragHandle(cardEl: HTMLElement, task: TaskInfo): void {
		cardEl.classList.add("task-card--reorderable");
		cardEl.classList.toggle(
			"task-card--drag-handle-only",
			this.isMobileDragHandleOnlyMode(cardEl)
		);

		const existingHandle = cardEl.querySelector<HTMLElement>(this.CARD_DRAG_HANDLE_SELECTOR);
		if (existingHandle) {
			existingHandle.setAttribute("draggable", "true");
			return;
		}

		const handle = createElementInDocument(cardEl.ownerDocument, "div");
		handle.className = "task-card__drag-handle";
		handle.dataset.tnDragHandle = "true";
		handle.setAttribute("draggable", "true");
		handle.setAttribute("role", "button");
		handle.setAttribute("aria-haspopup", "menu");
		handle.tabIndex = 0;
		handle.setAttribute(
			"aria-label",
			this.plugin.i18n.translate("views.taskList.movement.handle")
		);
		handle.setAttribute("title", this.plugin.i18n.translate("views.taskList.movement.handle"));
		setIcon(handle, "grip-vertical");
		handle.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.showTaskMovementMenu(task, cardEl);
		});
		handle.addEventListener("keydown", (event) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				event.stopPropagation();
				this.showTaskMovementMenu(task, cardEl);
			}
		});
		cardEl.insertBefore(handle, cardEl.firstChild);
	}

	/**
	 * Attach a dragstart handler to a single card element.
	 * Drop-target handling (dragover/drop) is done via container-level delegation
	 * in setupContainerDragHandlers() for robustness with virtual scrolling.
	 */
	private setupCardDragHandlers(
		cardEl: HTMLElement,
		task: TaskInfo,
		groupKey: string | null
	): void {
		let dragOriginTarget: EventTarget | null = null;
		let dragOriginSuppressed = false;
		const restoreCardDraggable = () => {
			cardEl.setAttribute(
				"draggable",
				this.isMobileDragHandleOnlyMode(cardEl) ? "false" : "true"
			);
			dragOriginTarget = null;
			dragOriginSuppressed = false;
		};
		const isPrimaryPress = (event: MouseEvent | PointerEvent) =>
			typeof event.button !== "number" || event.button === 0;
		const captureDragOrigin = (event: MouseEvent | PointerEvent) => {
			dragOriginTarget = event.target;
			dragOriginSuppressed = this.shouldSuppressCardDrag(event.target, cardEl);
			cardEl.setAttribute("draggable", dragOriginSuppressed ? "false" : "true");

			if (dragOriginSuppressed || !isPrimaryPress(event)) {
				return;
			}

			// Live Preview embeds sit inside CodeMirror. Keep reorder presses from
			// becoming editor selection gestures before the browser can start DnD.
			// Do not preventDefault: cancelling mousedown also cancels native dragging.
			event.stopPropagation();
		};

		this.setupCardDragHandle(cardEl, task);
		restoreCardDraggable();

		cardEl.addEventListener("pointerdown", captureDragOrigin, { capture: true });
		cardEl.addEventListener("mousedown", captureDragOrigin, { capture: true });
		cardEl.addEventListener("mouseup", (e: MouseEvent) => {
			if (!dragOriginSuppressed && isPrimaryPress(e)) {
				e.stopPropagation();
			}
			restoreCardDraggable();
		});
		cardEl.addEventListener("click", restoreCardDraggable, { capture: true });

		cardEl.addEventListener("dragstart", (e: DragEvent) => {
			if (this.shouldSuppressCardDrag(dragOriginTarget ?? e.target, cardEl)) {
				e.preventDefault();
				e.stopPropagation();
				restoreCardDraggable();
				return;
			}

			e.stopPropagation();
			this.beginTaskMovement(cardEl, task, groupKey);
			if (e.dataTransfer) {
				e.dataTransfer.effectAllowed = "move";
				e.dataTransfer.setData("text/plain", task.path);
			}
		});

		cardEl.addEventListener("dragend", () => {
			restoreCardDraggable();
			this.cancelTaskMovement();
		});
	}

	private beginTaskMovement(card: HTMLElement, task: TaskInfo, groupKey: string | null): void {
		this.draggedTaskPath = task.path;
		this.rootElement?.classList.add("task-list-view--moving");
		this.itemsContainer
			?.querySelectorAll<HTMLElement>(".task-card[data-task-path]")
			.forEach((element) => this.configureParentDropTarget(element));
		this.dragGroupKey = groupKey;
		this.dragSourceDestination = this.elementDestinations.get(card) ?? { groupKey };
		this.showEmptyMovementDestinations();
		card.classList.add("task-card--dragging", "task-list-view__drag-source");
		this.containerEl.ownerDocument.body.classList.add("tn-drag-active");
		// Keep the source row and target measurements stable throughout the gesture.
		this.currentInsertionGroupKey = groupKey;
		this.currentInsertionSegmentIndex = -1;
		this.currentInsertionIndex = -1;
		this.captureDropBaseline();
	}

	private updateTouchGhost(x: number, y: number): void {
		if (!this.touchGhost) return;
		const win = this.containerEl.ownerDocument.defaultView ?? window;
		const bounds = this.rootElement?.getBoundingClientRect();
		const left = Math.max(
			8,
			Math.min(
				x - (bounds?.left ?? 0) + 12,
				Math.min(bounds?.right ?? win.innerWidth, win.innerWidth) -
					(bounds?.left ?? 0) -
					this.touchGhost.offsetWidth -
					8
			)
		);
		const top =
			Math.max(
				8,
				Math.min(
					y - (bounds?.top ?? 0) + 12,
					Math.min(bounds?.bottom ?? win.innerHeight, win.innerHeight) -
						(bounds?.top ?? 0) -
						this.touchGhost.offsetHeight -
						8
				)
			) + (this.rootElement?.scrollTop ?? 0);
		this.touchGhost?.style.setProperty("--tn-movement-x", `${left}px`);
		this.touchGhost?.style.setProperty("--tn-movement-y", `${top}px`);
	}

	private async finishTaskMovement(target: EventTarget | null, clientY: number): Promise<void> {
		if (!this.draggedTaskPath) return;
		const plan = this.updateTaskMovementTarget(target, clientY);
		const path = this.draggedTaskPath;
		if (plan?.kind === "parent") {
			this.cancelTaskMovement();
			if (plan.state === "assign") await this.performParentAssignment(path, plan.parentPath);
			return;
		}
		const source = this.dragSourceDestination;
		const destination = this.dropDestination;
		const isHeader = this.dropIsHeader;
		const insertion = plan?.kind === "reorder" ? this.getCurrentInsertionTarget() : null;
		this.cancelTaskMovement();
		if (source && destination && plan && plan.kind !== "blocked" && plan.kind !== "none") {
			await this.performTaskMovement(path, source, destination, isHeader, insertion);
		}
	}

	private filterMovementSortScope(
		paths: string[] | undefined,
		destination?: TaskListDestination
	): string[] | undefined {
		if (
			!paths ||
			!destination ||
			destination.subGroupKey === undefined ||
			!this.subGroupPropertyId
		)
			return paths;
		return paths.filter(
			(path) => this.movementSubGroupKeys.get(path) === destination.subGroupKey
		);
	}

	private createMovementDestination(
		groupKey: string | null,
		subGroupKey?: string | null
	): TaskListDestination {
		const groupProperty = this.getGroupByPropertyId() ?? this.subGroupPropertyId;
		const isPrimitive = (value: unknown): value is string | number | boolean =>
			typeof value === "string" || typeof value === "number" || typeof value === "boolean";
		// Resolve a destination's actual list members from a task already in it. A populated
		// group whose members record no value (e.g. inline-only tags) cannot be resolved, and
		// must not fall back to writing its joined display label as a single member.
		const listValues = (
			property: string | null,
			key: string | null | undefined,
			primary = false
		): { values?: readonly unknown[]; unresolved?: boolean } => {
			if (!property || key === undefined) return {};
			let hasMembers = false;
			for (const [path, props] of this.movementProperties) {
				const inDestination = primary
					? this.taskGroupKeys.get(path) === key
					: this.taskGroupKeys.get(path) === groupKey &&
						this.movementSubGroupKeys.get(path) === key;
				if (!inDestination) continue;
				hasMembers = true;
				const value = getTaskListPropertyValue(props, property);
				if (Array.isArray(value) && value.length > 0 && value.every(isPrimitive))
					return { values: value };
				if (isPrimitive(value) && value !== "") return { values: [value] };
			}
			return { unresolved: hasMembers && key !== null && key !== "None" };
		};
		const group = listValues(groupProperty, groupKey, true);
		const subGroup = listValues(this.subGroupPropertyId, subGroupKey);
		return {
			groupKey,
			subGroupKey,
			groupValues: group.values,
			subGroupValues: subGroup.values,
			groupValuesUnresolved: group.unresolved,
			subGroupValuesUnresolved: subGroup.unresolved,
		};
	}

	private planMovement(
		source: TaskListDestination,
		target: TaskListDestination,
		isHeader: boolean
	): TaskListMovementPlan {
		return planTaskListMovement({
			groupByPropertyId: this.getGroupByPropertyId(),
			subGroupPropertyId: this.subGroupPropertyId,
			source,
			target,
			isHeader,
			canReorder: this.shouldEnableManualReordering(),
			lookupMappingKey: (property) => this.plugin.fieldMapper.lookupMappingKey(property),
			isListTypeProperty: (property) => this.isListTypeProperty(property),
		});
	}

	private getAvailableMovementDestinations(): TaskListDestination[] {
		const destinations = new Map(this.movementDestinations);
		const primaryProperty = this.getGroupByPropertyId();
		const effectiveProperty = primaryProperty ?? this.subGroupPropertyId;
		const knownValues = (property: string | null): string[] => {
			if (!property || !this.isMovableGroupingProperty(property)) return [];
			const taskProperty = this.plugin.fieldMapper.lookupMappingKey(
				property.replace(/^(note\.|task\.)/, "")
			);
			if (taskProperty === "status")
				return this.plugin.statusManager.getAllStatuses().map((status) => status.value);
			if (taskProperty === "priority")
				return this.plugin.priorityManager
					.getAllPriorities()
					.map((priority) => priority.value);
			return [];
		};
		const groupKeys = new Set(
			[...destinations.values()].map((destination) => destination.groupKey)
		);
		for (const key of knownValues(effectiveProperty)) groupKeys.add(key);
		if (effectiveProperty && this.isMovableGroupingProperty(effectiveProperty))
			groupKeys.add("None");
		for (const groupKey of groupKeys) {
			const primary = this.createMovementDestination(groupKey);
			destinations.set(taskListDestinationKey(primary), primary);
			if (primaryProperty && this.subGroupPropertyId) {
				for (const subGroupKey of [...knownValues(this.subGroupPropertyId), "None"]) {
					const child = this.createMovementDestination(groupKey, subGroupKey);
					destinations.set(taskListDestinationKey(child), child);
				}
			}
		}
		return [...destinations.values()];
	}

	private movementDestinationLabel(destination: TaskListDestination): string {
		return [destination.groupKey, destination.subGroupKey]
			.filter((value) => value !== undefined)
			.map((value) =>
				value === null || value === "None"
					? this.plugin.i18n.translate("views.taskList.movement.noValue")
					: value
			)
			.join(" / ");
	}

	private showEmptyMovementDestinations(): void {
		if (!this.itemsContainer || !this.dragSourceDestination) return;
		this.emptyDestinations?.remove();
		const missing = this.getAvailableMovementDestinations().filter(
			(destination) =>
				(destination.subGroupKey === undefined ||
					destination.groupKey === this.dragSourceDestination?.groupKey) &&
				!this.movementDestinations.has(taskListDestinationKey(destination)) &&
				this.planMovement(this.dragSourceDestination!, destination, true).kind === "move"
		);
		if (missing.length === 0) return;
		const shelf = createElementInDocument(this.containerEl.ownerDocument, "div");
		shelf.className = "task-list-view__empty-destinations";
		shelf.createDiv({
			cls: "task-list-view__destination-label",
			text: this.plugin.i18n.translate("views.taskList.movement.otherDestinations"),
		});
		for (const destination of missing) {
			const target = shelf.createDiv({
				cls: "task-list-view__destination",
				text: this.movementDestinationLabel(destination),
			});
			target.dataset.tnMovementDestination = "true";
			this.elementDestinations.set(target, destination);
		}
		const spacer = this.useVirtualScrolling
			? this.itemsContainer.querySelector<HTMLElement>(":scope > .virtual-scroller__spacer")
			: null;
		if (spacer) {
			// Virtual rows are translated within a spacer, so place the shelf after the last row.
			shelf.classList.add("task-list-view__empty-destinations--virtual");
			shelf.style.setProperty("--tn-shelf-top", `${spacer.offsetHeight}px`);
		}
		this.itemsContainer.appendChild(shelf);
		this.emptyDestinations = shelf;
	}

	private showTaskMovementMenu(task: TaskInfo, card: HTMLElement): void {
		const source = this.elementDestinations.get(card) ?? {
			groupKey: this.taskGroupKeys.get(task.path) ?? null,
		};
		const menu = new Menu();
		menu.addItem((item) =>
			item
				.setTitle(this.plugin.i18n.translate("views.taskList.movement.handle"))
				.setIsLabel(true)
		);
		menu.addItem((item) =>
			item
				.setTitle(this.plugin.i18n.translate("views.taskList.movement.parentChoose"))
				.setIcon("corner-down-right")
				.onClick(() => void this.showParentAssignmentSelector(task.path))
		);
		this.addReorderMenuItems(menu, task.path, source);
		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle(this.plugin.i18n.translate("views.taskList.movement.moveTo"))
				.setIsLabel(true)
		);
		const move = (target: TaskListDestination) => () =>
			void this.performTaskMovement(task.path, source, target, true, null);
		const destinations = this.getAvailableMovementDestinations();
		for (const destination of destinations.filter(
			(target) => target.subGroupKey === undefined
		)) {
			const children = destinations.filter(
				(target) =>
					target.groupKey === destination.groupKey &&
					target.subGroupKey !== undefined &&
					this.planMovement(source, target, true).kind === "move"
			);
			const canMove = this.planMovement(source, destination, true).kind === "move";
			if (!canMove && children.length === 0) continue;
			const label = this.movementDestinationLabel(destination);
			// Obsidian's own organization menus use this native submenu API, but it is not
			// part of the public typings, so fall back to flat items without it.
			const createSubmenu = (item: MenuItem): { menu: Menu } | undefined => {
				const setSubmenu = (item as unknown as { setSubmenu?: unknown }).setSubmenu;
				return typeof setSubmenu === "function"
					? { menu: (setSubmenu as (this: MenuItem) => Menu).call(item) }
					: undefined;
			};
			if (children.length === 0) {
				menu.addItem((item) =>
					item.setTitle(label).setIcon("move-right").onClick(move(destination))
				);
				continue;
			}
			const created: { submenu?: Menu } = {};
			menu.addItem((item) => {
				item.setTitle(label).setIcon("move-right");
				created.submenu = createSubmenu(item)?.menu;
				if (!created.submenu && canMove) item.onClick(move(destination));
			});
			const parentMenu = created.submenu;
			if (parentMenu) {
				if (canMove)
					parentMenu.addItem((child) =>
						child
							.setTitle(
								this.plugin.i18n.translate("views.taskList.movement.keepSubgroup")
							)
							.onClick(move(destination))
					);
				for (const target of children) {
					parentMenu.addItem((child) =>
						child
							.setTitle(
								this.movementDestinationLabel({
									groupKey: target.subGroupKey ?? null,
								})
							)
							.onClick(move(target))
					);
				}
			} else {
				for (const target of children) {
					menu.addItem((item) =>
						item
							.setTitle(this.movementDestinationLabel(target))
							.setIcon("move-right")
							.onClick(move(target))
					);
				}
			}
		}
		const rect =
			card
				.querySelector<HTMLElement>(this.CARD_DRAG_HANDLE_SELECTOR)
				?.getBoundingClientRect() ?? card.getBoundingClientRect();
		menu.showAtPosition({ x: rect.left, y: rect.bottom }, this.containerEl.ownerDocument);
	}

	/** Keyboard equivalent of dragging within the current destination. */
	private addReorderMenuItems(menu: Menu, path: string, source: TaskListDestination): void {
		if (!this.shouldEnableManualReordering()) return;
		const scope =
			this.filterMovementSortScope(this.getVisibleSortScopePaths(source.groupKey), source) ??
			[];
		const index = scope.indexOf(path);
		if (index < 0) return;
		const reorder = (neighbour: string, above: boolean) => () =>
			void this.handleSortOrderDrop(
				path,
				neighbour,
				above,
				source.groupKey,
				source.groupKey,
				scope,
				source
			).finally(() => this.debouncedRefresh());
		if (index > 0)
			menu.addItem((item) =>
				item
					.setTitle(this.plugin.i18n.translate("views.taskList.movement.moveUp"))
					.setIcon("arrow-up")
					.onClick(reorder(scope[index - 1], true))
			);
		if (index < scope.length - 1)
			menu.addItem((item) =>
				item
					.setTitle(this.plugin.i18n.translate("views.taskList.movement.moveDown"))
					.setIcon("arrow-down")
					.onClick(reorder(scope[index + 1], false))
			);
	}

	private clearMovementPreview(): void {
		this.itemsContainer
			?.querySelectorAll(
				".task-list-view__move-target, .task-list-view__move-target--blocked, .task-list-view__parent-target--active"
			)
			.forEach((element) =>
				element.classList.remove(
					"task-list-view__move-target",
					"task-list-view__move-target--blocked",
					"task-list-view__parent-target--active"
				)
			);
		this.movementFeedback?.remove();
		this.movementFeedback = null;
		this.dropDestination = null;
	}

	private clearMovementFeedback(): void {
		this.clearMovementPreview();
		this.emptyDestinations?.remove();
		this.emptyDestinations = null;
	}

	private showMovementPreview(
		plan: TaskListMovementPlan,
		destination: TaskListDestination,
		element: HTMLElement
	): void {
		this.clearDropIndicators();
		const names = (properties: readonly string[]) =>
			properties
				.map((property) => this.dataAdapter.getPropertyDisplayName(property))
				.join(", ");
		const text =
			plan.kind === "blocked"
				? plan.readOnlyProperties.length > 0
					? this.plugin.i18n.translate("views.taskList.movement.readOnly", {
							properties: names(plan.readOnlyProperties),
						})
					: this.plugin.i18n.translate("views.taskList.movement.unresolved", {
							properties: names(plan.unresolvedProperties),
						})
				: plan.kind === "move"
					? plan.changes.map((change) => this.describeMovementChange(change)).join(" · ")
					: this.plugin.i18n.translate("views.taskList.movement.noChange");
		this.setMovementFeedback(text);
		this.itemsContainer
			?.querySelectorAll<HTMLElement>(
				".task-card, .task-group, [data-tn-movement-destination]"
			)
			.forEach((candidate) => {
				const target = this.elementDestinations.get(candidate);
				const matches =
					plan.kind === "move" &&
					target?.groupKey === destination.groupKey &&
					(destination.subGroupKey === undefined ||
						target.subGroupKey === destination.subGroupKey);
				candidate.classList.toggle("task-list-view__move-target", matches);
				candidate.classList.toggle(
					"task-list-view__move-target--blocked",
					candidate === element && plan.kind === "blocked"
				);
			});
	}

	/** Lists are replaced as a whole, so show what the task holds before and after. */
	private describeMovementChange(change: TaskListGroupDropPlan): string {
		const name = this.dataAdapter.getPropertyDisplayName(change.groupByPropertyId!);
		const noValue = this.plugin.i18n.translate("views.taskList.movement.noValue");
		if (!change.isListGrouping || !change.frontmatterKey || !this.draggedTaskPath)
			return `${name} → ${change.normalizedTargetGroupKey ?? noValue}`;
		const current = this.movementProperties.get(this.draggedTaskPath)?.[change.frontmatterKey];
		const before = getListMembers(current);
		const after = moveGroupListValue(
			current,
			change.sourceGroupKey,
			change.normalizedTargetGroupKey,
			before,
			change.targetValues
		);
		const format = (values: unknown[]) =>
			values.length > 0 ? values.map((value) => String(value)).join(", ") : noValue;
		return `${name}: ${format(before)} → ${format(after)}`;
	}

	private setMovementFeedback(text: string): void {
		if (!this.movementFeedback) {
			this.movementFeedback = createElementInDocument(this.containerEl.ownerDocument, "div");
			this.movementFeedback.className = "task-list-view__movement-feedback";
			this.movementFeedback.setAttribute("role", "status");
			this.movementFeedback.setAttribute("aria-live", "polite");
			this.rootElement?.appendChild(this.movementFeedback);
		}
		if (this.movementFeedback.textContent !== text) this.movementFeedback.textContent = text;
	}

	private updateTaskMovementTarget(
		target: EventTarget | null,
		clientY: number
	): TaskListDropIntent | null {
		const intent = this.resolveTaskMovementTarget(target, clientY);
		this.currentDropAllowed =
			intent?.kind === "move" ||
			intent?.kind === "reorder" ||
			(intent?.kind === "parent" && intent.state === "assign");
		return intent;
	}

	private resolveTaskMovementTarget(
		target: EventTarget | null,
		clientY: number
	): TaskListDropIntent | null {
		if (!this.dragSourceDestination) return null;
		const targetElement = this.getEventTargetElement(target);
		if (!targetElement || !this.itemsContainer?.contains(targetElement)) {
			this.clearMovementPreview();
			this.clearDropIndicators();
			return null;
		}
		const parentTarget = targetElement.closest<HTMLElement>(".task-list-view__parent-target");
		const parentPath = parentTarget?.dataset.parentTaskPath;
		if (parentTarget && parentPath && this.draggedTaskPath) {
			const state = previewTaskParentAssignment(
				this.plugin,
				this.draggedTaskPath,
				parentPath
			);
			this.clearMovementPreview();
			this.clearDropIndicators();
			parentTarget.classList.toggle(
				"task-list-view__parent-target--active",
				state === "assign"
			);
			parentTarget.classList.toggle(
				"task-list-view__move-target--blocked",
				state !== "assign" && state !== "already"
			);
			this.setMovementFeedback(this.parentAssignmentMessage(state, parentPath));
			return { kind: "parent", parentPath, state };
		}
		this.itemsContainer
			?.querySelectorAll(
				".task-list-view__parent-target--active, .task-list-view__parent-target.task-list-view__move-target--blocked"
			)
			.forEach((element) =>
				element.classList.remove(
					"task-list-view__parent-target--active",
					"task-list-view__move-target--blocked"
				)
			);
		const clear = (): null => {
			this.clearMovementPreview();
			this.clearDropIndicators();
			return null;
		};
		const header = targetElement.closest<HTMLElement>(
			".task-group, [data-tn-movement-destination]"
		);
		const card = this.getTopLevelDropCard(targetElement);
		// Releasing on the original row (or its subtasks) cancels rather than guessing a neighbour.
		if (!header && card?.dataset.taskPath === this.draggedTaskPath) return clear();
		// The shelf's label and padding are not destinations.
		if (!header && targetElement.closest(".task-list-view__empty-destinations")) return clear();
		const visibleCard = card && this.getVisibleDropCards().includes(card) ? card : null;
		const slot = header || visibleCard ? null : this.resolveNearbyInsertionSlot(clientY);
		const element =
			header && this.itemsContainer?.contains(header)
				? header
				: (visibleCard ?? slot?.element);
		if (!element) return clear();
		const isHeader = !!header && element === header;
		const destination = this.elementDestinations.get(element) ?? {
			groupKey:
				slot?.groupKey ?? this.taskGroupKeys.get(element.dataset.taskPath ?? "") ?? null,
		};
		const plan = this.planMovement(this.dragSourceDestination, destination, isHeader);
		this.dropDestination = destination;
		this.dropIsHeader = isHeader;
		if (plan.kind === "reorder") {
			this.clearMovementPreview();
			this.dropDestination = destination;
			this.updateResolvedInsertionSlot(clientY);
		} else {
			this.showMovementPreview(plan, destination, element);
		}
		return plan;
	}

	/** Nested subtask cards belong to the visible row that contains them. */
	private getTopLevelDropCard(element: HTMLElement): HTMLElement | null {
		let card = element.closest<HTMLElement>(".task-card[data-task-path]");
		let parent = card?.parentElement?.closest<HTMLElement>(".task-card[data-task-path]");
		while (card && parent && this.itemsContainer?.contains(parent)) {
			card = parent;
			parent = card.parentElement?.closest<HTMLElement>(".task-card[data-task-path]");
		}
		return card;
	}

	/** The nearest insertion line, only when the pointer is actually beside it (between rows). */
	private resolveNearbyInsertionSlot(clientY: number): TaskListInsertionSlot | null {
		const slot = this.resolveClosestInsertionSlot(clientY);
		if (!slot) return null;
		const rect = slot.element.getBoundingClientRect();
		const edge = slot.position === "before" ? rect.top : rect.bottom;
		return Math.abs(clientY - edge) <= this.NEARBY_SLOT_TOLERANCE_PX ? slot : null;
	}

	private cancelTaskMovement(cancelTouch = true): void {
		if (cancelTouch) this.touchMovement?.cancel();
		this.edgeScroll?.stop();
		this.touchGhost?.remove();
		this.touchGhost = null;
		if (this.dragOverRafId) {
			(this.containerEl.ownerDocument.defaultView ?? window).cancelAnimationFrame(
				this.dragOverRafId
			);
			this.dragOverRafId = 0;
		}
		this.itemsContainer
			?.querySelectorAll<HTMLElement>(".task-card--dragging")
			.forEach((card) => {
				card.classList.remove("task-card--dragging", "task-list-view__drag-source");
				card.setAttribute(
					"draggable",
					this.isMobileDragHandleOnlyMode(card) ? "false" : "true"
				);
			});
		this.cleanupDragShift();
		this.clearDropIndicators();
		this.clearMovementFeedback();
		this.containerEl.ownerDocument.body.classList.remove("tn-drag-active");
		this.rootElement?.classList.remove("task-list-view--moving");
		this.draggedTaskPath = null;
		this.dragGroupKey = null;
		this.dragSourceDestination = null;
		this.pendingDragClientY = null;
		this.pendingDragTarget = null;
		this.currentDropAllowed = false;
		if (this.pendingRender) {
			this.pendingRender = false;
			this.debouncedRefresh();
		}
	}

	private async performTaskMovement(
		path: string,
		source: TaskListDestination,
		destination: TaskListDestination,
		isHeader: boolean,
		insertion: { taskPath: string; above: boolean } | null
	): Promise<void> {
		const plan = this.planMovement(source, destination, isHeader);
		// The members the user saw when acting. Values added by another edit before the
		// queued write lands are not part of the move and must survive it.
		const shown = this.movementProperties.get(path);
		try {
			if (plan.kind === "reorder" && insertion) {
				await this.handleSortOrderDrop(
					path,
					insertion.taskPath,
					insertion.above,
					destination.groupKey,
					source.groupKey,
					this.getVisibleSortScopePathsForDrag(destination.groupKey),
					destination
				);
			} else if (plan.kind === "move") {
				await this.dropQueue.enqueue(`move:${path}`, async () => {
					const file = this.plugin.app.vault.getAbstractFileByPath(path);
					if (!(file instanceof TFile)) throw new Error("Task file no longer exists");
					const originalTask =
						this.taskInfoCache.get(path) ??
						(await this.plugin.cacheManager.getTaskInfo(path));
					let undoChanges: TaskMovementUndoChange[] = [];
					let changes = plan.changes;
					await processVaultFrontMatter(this.plugin.app, file, (frontmatter) => {
						const before = structuredClone(frontmatter);
						// Lists group by their whole value, so the source membership is what this
						// task held when the user acted, not another group member's spelling of it.
						changes = plan.changes.map((change) => {
							if (!change.isListGrouping || !change.frontmatterKey) return change;
							const key = change.frontmatterKey;
							return {
								...change,
								sourceValues: getMovedListMembers(shown, key, frontmatter[key]),
							};
						});
						for (const change of changes) {
							applyTaskListDropFrontmatterMutation({
								frontmatter,
								plan: change,
								sortOrderField: this.plugin.settings.fieldMapping.sortOrder,
								sortOrder: null,
								isRecurring: !!originalTask?.recurrence,
								dateModifiedField:
									this.plugin.fieldMapper.toUserField("dateModified"),
								coerceGroupKeyForFrontmatter: (property, value) =>
									this.coerceGroupKeyForFrontmatter(property, value),
								updateCompletedDateInFrontmatter: (fm, status, recurring) =>
									this.plugin.taskService.updateCompletedDateInFrontmatter(
										fm,
										status,
										recurring
									),
								getTimestamp: getCurrentTimestamp,
							});
						}
						const modifiedProperty =
							this.plugin.fieldMapper.toUserField("dateModified");
						frontmatter[modifiedProperty] = getCurrentTimestamp();
						undoChanges = buildTaskMovementUndo(before, frontmatter, modifiedProperty);
					});
					let updatedTask = originalTask;
					if (originalTask) {
						updatedTask = originalTask;
						for (const change of changes) {
							updatedTask =
								buildTaskListDropSideEffectTask(updatedTask, {
									plan: change,
									isCompletedStatus: (status) =>
										this.plugin.statusManager.isCompletedStatus(status),
									getTimestamp: getCurrentTimestamp,
									getCompletedDate: () => new Date().toISOString().split("T")[0],
									coerceGroupKeyForTask: (property, value) =>
										this.coerceGroupKeyForFrontmatter(property, value),
									getClearedTaskValue: (property) =>
										this.getClearedTaskValue(property, file),
								}) ?? updatedTask;
						}
						for (const change of changes) {
							if (!change.groupByTaskProp) continue;
							// Side effects (status, webhooks, archive) need the real values, not group labels.
							const property = change.groupByTaskProp as keyof TaskInfo;
							await this.plugin.taskService.applyPropertyChangeSideEffects(
								file,
								originalTask,
								updatedTask,
								property,
								originalTask[property],
								updatedTask[property]
							);
						}
					}
					this.showTaskMovementUndo(
						file,
						undoChanges,
						originalTask ?? null,
						updatedTask ?? null,
						plan.changes
					);
				});
			}
		} catch (error) {
			tasknotesLogger.error("Task movement failed", {
				category: "persistence",
				operation: "task-movement",
				error,
			});
			new Notice(this.plugin.i18n.translate("views.taskList.movement.failed"));
		} finally {
			this.debouncedRefresh();
		}
	}

	private showTaskMovementUndo(
		file: TFile,
		changes: readonly TaskMovementUndoChange[],
		originalTask: TaskInfo | null,
		updatedTask: TaskInfo | null,
		propertyChanges: readonly Pick<TaskListGroupDropPlan, "groupByTaskProp">[],
		successMessage?: string
	): void {
		const t = (key: string) => this.plugin.i18n.translate(`views.taskList.movement.${key}`);
		// Recurring status changes can write other occurrence notes. Do not offer a
		// misleading single-note undo until those writes have a transaction ledger.
		if (
			changes.length === 0 ||
			((originalTask?.recurrence || originalTask?.recurrence_parent) &&
				propertyChanges.some((change) => change.groupByTaskProp === "status"))
		) {
			new Notice(successMessage ?? t("moved"));
			return;
		}
		const fragment = (this.containerEl.ownerDocument.defaultView ?? window).createFragment();
		fragment.append(`${successMessage ?? t("moved")} `);
		const button = createElementInDocument(this.containerEl.ownerDocument, "button");
		button.textContent = t("undo");
		fragment.append(button);
		const notice = new Notice(fragment, 8000);
		button.addEventListener("click", () => {
			button.disabled = true;
			void this.dropQueue.enqueue(`move:${file.path}`, async () => {
				try {
					if (this.plugin.app.vault.getAbstractFileByPath(file.path) !== file)
						throw new Error("Task file no longer exists");
					const currentTask = updatedTask
						? ((await this.plugin.cacheManager.getTaskInfo(file.path)) ?? updatedTask)
						: null;
					let restored = false;
					await processVaultFrontMatter(this.plugin.app, file, (frontmatter) => {
						restored = applyTaskMovementUndo(frontmatter, changes);
						if (restored)
							frontmatter[this.plugin.fieldMapper.toUserField("dateModified")] =
								getCurrentTimestamp();
					});
					if (!restored) {
						new Notice(t("undoConflict"));
						return;
					}
					if (originalTask && currentTask) {
						const revertedTask = {
							...currentTask,
							dateModified: getCurrentTimestamp(),
						};
						if (
							changes.some(
								(change) =>
									change.property ===
									this.plugin.fieldMapper.toUserField("completedDate")
							)
						)
							revertedTask.completedDate = originalTask.completedDate;
						for (const change of propertyChanges) {
							if (change.groupByTaskProp) {
								const property = change.groupByTaskProp as keyof TaskInfo;
								Object.assign(revertedTask, { [property]: originalTask[property] });
							}
						}
						for (const change of propertyChanges) {
							if (change.groupByTaskProp) {
								const property = change.groupByTaskProp as keyof TaskInfo;
								await this.plugin.taskService.applyPropertyChangeSideEffects(
									file,
									currentTask,
									revertedTask,
									property,
									currentTask[property],
									revertedTask[property]
								);
							}
						}
					}
				} catch (error) {
					tasknotesLogger.error("Task movement undo failed", {
						category: "persistence",
						operation: "task-movement-undo",
						error,
					});
					new Notice(t("undoFailed"));
				} finally {
					notice.hide();
					this.debouncedRefresh();
				}
			});
		});
	}

	private configureParentDropTarget(card: HTMLElement): void {
		const path = card.dataset.taskPath;
		if (!path) return;
		// Anchor to the row itself so expanded subtasks keep their own distinct targets.
		const anchor = card.querySelector<HTMLElement>(":scope > .task-card__main-row") ?? card;
		if (anchor.querySelector(":scope > .task-list-view__parent-target")) return;
		const target = createElementInDocument(card.ownerDocument, "div");
		target.className = "task-list-view__parent-target";
		target.dataset.parentTaskPath = path;
		const icon = target.createSpan();
		setIcon(icon, "corner-down-right");
		target.createSpan({
			text: this.plugin.i18n.translate("views.taskList.movement.parentAdd"),
		});
		anchor.appendChild(target);
	}

	private parentAssignmentMessage(state: TaskParentAssignmentState, parentPath: string): string {
		const key =
			state === "assign"
				? "parentPreview"
				: state === "self"
					? "parentSelf"
					: state === "cycle"
						? "parentCycle"
						: state === "already"
							? "parentAlready"
							: "parentUnavailable";
		const parent =
			this.taskInfoCache.get(parentPath)?.title ??
			this.plugin.app.vault.getAbstractFileByPath(parentPath)?.name.replace(/\.md$/, "") ??
			parentPath;
		return this.plugin.i18n.translate(`views.taskList.movement.${key}`, { parent });
	}

	private async showParentAssignmentSelector(sourcePath: string): Promise<void> {
		try {
			const tasks = await this.plugin.cacheManager.getAllTasks();
			const candidates = tasks.filter(
				(task) =>
					previewTaskParentAssignment(this.plugin, sourcePath, task.path) === "assign"
			);
			openTaskSelector(
				this.plugin,
				candidates,
				(parent) => {
					if (parent) void this.performParentAssignment(sourcePath, parent.path);
				},
				{
					allowCreate: false,
					placeholder: this.plugin.i18n.translate("views.taskList.movement.parentChoose"),
				}
			);
		} catch (error) {
			tasknotesLogger.error("Parent selector failed", {
				category: "internal",
				operation: "parent-selector",
				error,
			});
			new Notice(this.plugin.i18n.translate("views.taskList.movement.failed"));
		}
	}

	private async performParentAssignment(sourcePath: string, parentPath: string): Promise<void> {
		try {
			await this.dropQueue.enqueue(`move:${sourcePath}`, async () => {
				const result = await assignTaskParent(this.plugin, sourcePath, parentPath);
				const parent =
					this.taskInfoCache.get(parentPath)?.title ??
					this.plugin.app.vault
						.getAbstractFileByPath(parentPath)
						?.name.replace(/\.md$/, "") ??
					parentPath;
				this.showTaskMovementUndo(
					result.file,
					result.undoChanges,
					result.originalTask,
					result.updatedTask,
					[{ groupByTaskProp: "projects" }],
					this.plugin.i18n.translate("views.taskList.movement.parentAssigned", { parent })
				);
			});
		} catch (error) {
			if (error instanceof TaskParentAssignmentError)
				new Notice(this.parentAssignmentMessage(error.reason, parentPath));
			else {
				tasknotesLogger.error("Parent assignment failed", {
					category: "persistence",
					operation: "parent-assignment",
					error,
				});
				new Notice(this.plugin.i18n.translate("views.taskList.movement.failed"));
			}
		} finally {
			this.debouncedRefresh();
		}
	}

	private isMovableGroupingProperty(property: string): boolean {
		return isWritableGroupingProperty(
			property,
			this.plugin.fieldMapper.lookupMappingKey(property.replace(/^(note\.|task\.)/, ""))
		);
	}

	private getClearedTaskValue(property: string, file: TFile): unknown {
		if (property === "status") return this.plugin.settings.defaultTaskStatus;
		if (property === "priority") return this.plugin.settings.defaultTaskPriority;
		if (property === "title") return file.basename;
		if (property === "archived") return false;
		return undefined;
	}

	private shouldEnableManualReordering(): boolean {
		return isSortOrderInSortConfig(
			this.dataAdapter,
			this.plugin.settings.fieldMapping.sortOrder
		);
	}

	private configureCardForManualReordering(
		cardEl: HTMLElement,
		task: TaskInfo,
		groupKey: string | null
	): void {
		// Parent assignment remains available in ungrouped and read-only-grouped views.
		this.configureParentDropTarget(cardEl);
		cardEl.setAttribute("draggable", "true");
		this.setupCardDragHandlers(cardEl, task, groupKey);
	}

	private clearDropIndicators(): void {
		this.itemsContainer
			?.querySelectorAll(
				".task-card--drop-above, .task-card--drop-below, .task-list-view__drop-slot-before, .task-list-view__drop-slot-after"
			)
			.forEach((el) => {
				el.classList.remove(
					"task-card--drop-above",
					"task-card--drop-below",
					"task-list-view__drop-slot-before",
					"task-list-view__drop-slot-after"
				);
			});
		this.currentDropSlotElement = null;
		this.currentDropSlotPosition = null;
	}

	/**
	 * Remove all gap/slot shift classes and custom properties.
	 */
	private cleanupDragShift(): void {
		// Clean from entire items container (safety net)
		this.itemsContainer
			?.querySelectorAll<HTMLElement>(
				".task-card--drag-shift, .task-card--shift-down, .task-list-view__drop-slot-before, .task-list-view__drop-slot-after"
			)
			.forEach((el) => {
				el.classList.remove(
					"task-card--drag-shift",
					"task-card--shift-down",
					"task-list-view__drop-slot-before",
					"task-list-view__drop-slot-after"
				);
			});
		this.currentDropSlotElement = null;
		this.currentDropSlotPosition = null;
		this.currentInsertionGroupKey = null;
		this.currentInsertionSegmentIndex = -1;
		this.currentInsertionIndex = -1;
		this.dragBaselineCards = [];
	}

	private getDropSegments(): TaskListDropSegment[] {
		return getTaskListDropSegments(this.getDropBaselineCards());
	}

	private reconstructDropTargetFromInsertionSlot(
		segmentIndex: number,
		insertionIndex: number
	): { taskPath: string; above: boolean } | null {
		return reconstructTaskListDropTarget(this.getDropSegments(), segmentIndex, insertionIndex);
	}

	private getCurrentInsertionTarget(): { taskPath: string; above: boolean } | null {
		if (this.currentInsertionSegmentIndex < 0 || this.currentInsertionIndex < 0) return null;
		return this.reconstructDropTargetFromInsertionSlot(
			this.currentInsertionSegmentIndex,
			this.currentInsertionIndex
		);
	}

	private getVisibleSortScopePathsForDrag(groupKey: string | null): string[] | undefined {
		return this.getVisibleSortScopePaths(groupKey);
	}

	private getReorderScopeQueueKey(
		groupKey: string | null,
		groupByPropertyId: string | null
	): string {
		if (!groupByPropertyId) {
			return "manual-sort:list";
		}

		return `manual-sort:${groupByPropertyId}:${this.getSortScopeKey(groupKey)}`;
	}

	private getGroupingPathProperties(
		dataItems = this.dataAdapter.extractDataItems()
	): Map<string, Record<string, unknown>> {
		const properties = buildTaskListPathProperties(dataItems);
		if (this.subGroupPropertyId)
			populateBasesFormulaProperty(dataItems, properties, this.subGroupPropertyId);
		return properties;
	}

	private syncGroupedDragMetadata(items: TaskListRenderItem[]): void {
		this.taskGroupKeys.clear();
		this.movementSubGroupKeys.clear();
		this.movementProperties = this.getGroupingPathProperties();
		if (this.subGroupPropertyId) {
			for (const [path, properties] of this.movementProperties)
				this.movementSubGroupKeys.set(
					path,
					stringifyTaskListGroupValue(
						getTaskListPropertyValue(properties, this.subGroupPropertyId)
					)
				);
		}
		// Populate native group membership before constructing list-valued destinations.
		for (const item of items) {
			if (item.type === "primary-header") {
				for (const entry of item.groupEntries)
					if (entry.file?.path) this.taskGroupKeys.set(entry.file.path, item.groupKey);
			} else if (item.type === "task") this.taskGroupKeys.set(item.task.path, item.groupKey);
		}
		// Persist canonical YAML values, not Bases display objects or link labels.
		for (const [path, properties] of this.movementProperties) {
			const file = this.plugin.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				Object.assign(
					properties,
					this.plugin.app.metadataCache.getFileCache(file)?.frontmatter
				);
			}
		}
		this.movementDestinations.clear();
		for (const item of items) {
			const destination = this.createMovementDestination(
				item.groupKey,
				item.type === "primary-header" ? undefined : item.subGroupKey
			);
			this.movementDestinations.set(taskListDestinationKey(destination), destination);
		}
		const groupedPaths = new Map<string | null, string[]>();
		for (const item of items) {
			if (item.type !== "task") continue;
			this.taskGroupKeys.set(item.task.path, item.groupKey);
			const paths = groupedPaths.get(item.groupKey) || [];
			paths.push(item.task.path);
			groupedPaths.set(item.groupKey, paths);
		}
		this.setSortScopePaths(groupedPaths);
	}

	private updateDropSlotPreview(slot: TaskListInsertionSlot): void {
		const { element, position } = slot;
		if (element === this.currentDropSlotElement && position === this.currentDropSlotPosition) {
			return;
		}

		this.clearDropIndicators();
		element.classList.add(
			position === "before"
				? "task-list-view__drop-slot-before"
				: "task-list-view__drop-slot-after"
		);
		this.currentDropSlotElement = element;
		this.currentDropSlotPosition = position;
	}

	private updateResolvedInsertionSlot(clientY: number): boolean {
		const insertionSlot = this.resolveClosestInsertionSlot(clientY);
		if (!insertionSlot) return false;

		this.currentInsertionGroupKey = insertionSlot.groupKey;
		this.currentInsertionSegmentIndex = insertionSlot.segmentIndex;
		this.currentInsertionIndex = insertionSlot.insertionIndex;
		this.updateDropSlotPreview(insertionSlot);
		return true;
	}

	private flushPendingInsertionSlot(clientYFallback: number): boolean {
		if (this.dragOverRafId) {
			cancelAnimationFrame(this.dragOverRafId);
			this.dragOverRafId = 0;
		}

		this.pendingDragClientY = null;
		return this.updateResolvedInsertionSlot(clientYFallback);
	}

	private getVisibleDropCards(): HTMLElement[] {
		if (!this.itemsContainer) return [];

		return Array.from(
			this.itemsContainer.querySelectorAll<HTMLElement>(".task-card[data-task-path]")
		).filter((card) => {
			if (card.dataset.taskPath === this.draggedTaskPath) return false;
			const parentTaskCard = card.parentElement?.closest<HTMLElement>(
				".task-card[data-task-path]"
			);
			return !parentTaskCard;
		});
	}

	private captureDropBaseline(cards = this.getVisibleDropCards()): void {
		if (!this.itemsContainer) {
			this.dragBaselineCards = [];
			return;
		}

		const containerRect = this.itemsContainer.getBoundingClientRect();
		const scrollTop = this.itemsContainer.scrollTop;
		this.dragBaselineCards = cards
			.map((card): TaskListDropBaselineCard | null => {
				const path = card.dataset.taskPath;
				if (!path) return null;
				const rect = card.getBoundingClientRect();
				const top = rect.top - containerRect.top + scrollTop;
				return {
					path,
					groupKey:
						this.elementDestinations.get(card)?.groupKey ??
						this.taskGroupKeys.get(path) ??
						null,
					subGroupKey: this.elementDestinations.get(card)?.subGroupKey,
					card,
					top,
					bottom: top + rect.height,
					midpoint: top + rect.height / 2,
				};
			})
			.filter((entry): entry is TaskListDropBaselineCard => !!entry);
	}

	private getDropBaselineCards(): TaskListDropBaselineCard[] {
		const cards = this.getVisibleDropCards();
		const currentPaths = cards.map((card) => card.dataset.taskPath ?? "");
		const baselinePaths = this.dragBaselineCards.map((entry) => entry.path);
		const baselineIsCurrent =
			currentPaths.length === baselinePaths.length &&
			currentPaths.every((path, index) => path === baselinePaths[index]);

		if (!baselineIsCurrent) {
			this.captureDropBaseline(cards);
		}

		return this.dragBaselineCards;
	}

	private getContainerLocalY(clientY: number): number {
		if (!this.itemsContainer) return clientY;
		const containerRect = this.itemsContainer.getBoundingClientRect();
		return clientY - containerRect.top + this.itemsContainer.scrollTop;
	}

	private resolveClosestInsertionSlot(clientY: number): TaskListInsertionSlot | null {
		const segments = this.getDropSegments();
		const localY = this.getContainerLocalY(clientY);
		return resolveTaskListInsertionSlot(segments, localY);
	}

	/**
	 * Container-level drag event delegation.
	 * Handles dragenter/dragover/drop/dragleave on the itemsContainer so it
	 * works with both normal and virtual-scrolling rendering.
	 *
	 * IMPORTANT: Both dragenter and dragover must call e.preventDefault() to
	 * tell the browser this container accepts drops.  The call must happen
	 * unconditionally (once we know a drag is active) – if it's gated behind
	 * finding a card target, the browser denies the drop zone on frames where
	 * the cursor is between cards or over the dragged card itself.
	 */
	private setupContainerDragHandlers(): void {
		if (!this.itemsContainer) return;
		const doc = this.containerEl.ownerDocument;
		this.edgeScroll = new TaskMovementAutoScroll(this.itemsContainer, (x, y) => {
			this.updateTouchGhost(x, y);
			this.updateTaskMovementTarget(doc.elementFromPoint(x, y), y);
		});
		this.touchMovement = new TaskMovementTouch(this.itemsContainer, {
			start: (handle, x, y) => {
				const card = handle.closest<HTMLElement>(".task-card[data-task-path]");
				const task = card?.dataset.taskPath
					? this.taskInfoCache.get(card.dataset.taskPath)
					: null;
				if (!card || !task) return false;
				this.beginTaskMovement(
					card,
					task,
					this.elementDestinations.get(card)?.groupKey ?? null
				);
				this.touchGhost = createElementInDocument(doc, "div");
				this.touchGhost.className = "task-list-view__touch-ghost";
				this.touchGhost.setAttribute("aria-hidden", "true");
				this.touchGhost.textContent = task.title;
				this.rootElement?.appendChild(this.touchGhost);
				this.updateTouchGhost(x, y);
				return true;
			},
			update: (x, y) => {
				this.updateTouchGhost(x, y);
				this.updateTaskMovementTarget(doc.elementFromPoint(x, y), y);
				this.edgeScroll?.update(x, y);
			},
			commit: (x, y) => void this.finishTaskMovement(doc.elementFromPoint(x, y), y),
			cancel: () => this.cancelTaskMovement(false),
		});
		// No window blur handler: native drags always clean up on dragend, and touch
		// movement cancels itself on blur. Some platforms blur when a native drag starts.

		this.registerDomEvent(this.containerEl.ownerDocument, "keydown", (event: KeyboardEvent) => {
			if (event.key === "Escape" && this.draggedTaskPath) {
				event.preventDefault();
				this.cancelTaskMovement();
			}
		});

		// dragenter: required by the HTML5 DnD spec alongside dragover to
		// indicate this container is a valid drop zone.
		this.itemsContainer.addEventListener("dragenter", (e: DragEvent) => {
			if (!this.draggedTaskPath) return;
			e.preventDefault();
			// Do not let an older queued dragover overwrite a newly entered target.
			this.pendingDragTarget = e.target;
			this.pendingDragClientY = e.clientY;
			this.updateTaskMovementTarget(e.target, e.clientY);
			if (e.dataTransfer)
				e.dataTransfer.dropEffect = this.currentDropAllowed ? "move" : "none";
			this.edgeScroll?.update(e.clientX, e.clientY);
		});

		this.itemsContainer.addEventListener("dragover", (e: DragEvent) => {
			if (!this.draggedTaskPath) return;

			// Always accept – must be unconditional so the browser keeps
			// the drop zone active even when the cursor is between cards.
			e.preventDefault();
			// dropEffect is only honoured during dispatch, so use the last resolved target.
			if (e.dataTransfer)
				e.dataTransfer.dropEffect = this.currentDropAllowed ? "move" : "none";

			// Throttle visual updates via rAF
			this.pendingDragClientY = e.clientY;
			this.pendingDragTarget = e.target;
			this.edgeScroll?.update(e.clientX, e.clientY);
			if (!this.dragOverRafId) {
				this.dragOverRafId = (
					this.containerEl.ownerDocument.defaultView ?? window
				).requestAnimationFrame(() => {
					this.dragOverRafId = 0;
					const clientY = this.pendingDragClientY;
					this.pendingDragClientY = null;
					if (clientY === null) return;
					this.updateTaskMovementTarget(this.pendingDragTarget, clientY);
				});
			}
		});

		this.itemsContainer.addEventListener("dragleave", (e: DragEvent) => {
			// Only clear if leaving the container entirely (not moving between children)
			const related = e.relatedTarget as HTMLElement | null;
			if (!related || !this.itemsContainer?.contains(related)) {
				this.clearDropIndicators();
				this.clearMovementPreview();
				this.edgeScroll?.stop();
			}
		});

		this.itemsContainer.addEventListener("drop", (e: DragEvent) => {
			e.preventDefault();
			void this.finishTaskMovement(e.target, e.clientY);
		});
	}

	private async handleSortOrderDrop(
		draggedPath: string,
		targetPath: string,
		above: boolean,
		targetGroupKey: string | null,
		sourceGroupKey: string | null,
		targetVisiblePaths?: string[],
		destination?: TaskListDestination
	): Promise<void> {
		const groupByPropertyId = this.getGroupByPropertyId() ?? this.subGroupPropertyId;
		const reorderScopeKey = this.getReorderScopeQueueKey(targetGroupKey, groupByPropertyId);
		await this.dropQueue.enqueue(reorderScopeKey, async () => {
			const groupDropPlan = buildTaskListGroupDropPlan({
				groupByPropertyId,
				sourceGroupKey,
				targetGroupKey,
				lookupMappingKey: (propertyName) =>
					this.plugin.fieldMapper.lookupMappingKey(propertyName),
				isListTypeProperty: (propertyName) => this.isListTypeProperty(propertyName),
			});

			if (groupDropPlan.isFormulaGrouping && groupDropPlan.needsGroupUpdate) {
				new Notice(
					this.plugin.i18n.translate("views.taskList.errors.formulaGroupingReadOnly")
				);
				return;
			}

			// Compute sort_order first (read-only — no file writes yet)
			const sortOrderPlan = await prepareSortOrderUpdate(
				targetPath,
				above,
				targetGroupKey,
				destination ? null : groupDropPlan.cleanGroupBy,
				draggedPath,
				this.plugin,
				{
					taskInfoCache: this.taskInfoCache,
					visibleTaskPaths: this.filterMovementSortScope(
						targetVisiblePaths ?? this.getVisibleSortScopePaths(targetGroupKey),
						destination
					),
					candidateTaskPaths: this.filterMovementSortScope(
						this.getCandidateSortScopePaths(targetGroupKey),
						destination
					),
					sortDirection: getSortOrderDirection(
						this.dataAdapter,
						this.plugin.settings.fieldMapping.sortOrder
					),
				}
			);
			if (sortOrderPlan.sortOrder === null) return;

			const totalEditedNotes = sortOrderPlan.additionalWrites.length + 1;
			if (totalEditedNotes > this.LARGE_REORDER_WARNING_THRESHOLD) {
				const confirmed = await this.confirmLargeReorder(totalEditedNotes, targetGroupKey);
				if (!confirmed) return;
			}

			// Determine if we need to write anything
			const needsWrite = groupDropPlan.needsGroupUpdate || sortOrderPlan !== null;
			if (!needsWrite) {
				this.debouncedRefresh();
				return;
			}

			const file = this.plugin.app.vault.getAbstractFileByPath(draggedPath);
			if (!file || !(file instanceof TFile)) {
				this.debouncedRefresh();
				return;
			}

			const sortOrderField = this.plugin.settings.fieldMapping.sortOrder;

			await applySortOrderPlan(draggedPath, sortOrderPlan, this.plugin, {
				includeDragged: false,
			});

			// Single atomic write: group property + sort_order + derivative fields
			await processVaultFrontMatter(this.plugin.app, file, (fm) => {
				applyTaskListDropFrontmatterMutation({
					frontmatter: fm,
					plan: groupDropPlan,
					sortOrderField,
					sortOrder: sortOrderPlan.sortOrder,
					isRecurring: !!this.taskInfoCache.get(draggedPath)?.recurrence,
					dateModifiedField: this.plugin.fieldMapper.toUserField("dateModified"),
					coerceGroupKeyForFrontmatter: (property, groupKey) =>
						this.coerceGroupKeyForFrontmatter(property, groupKey),
					updateCompletedDateInFrontmatter: (frontmatter, status, isRecurring) =>
						this.plugin.taskService.updateCompletedDateInFrontmatter(
							frontmatter,
							status,
							isRecurring
						),
					getTimestamp: getCurrentTimestamp,
				});
			});

			// Fire post-write side effects for known TaskInfo property changes
			if (groupDropPlan.needsGroupUpdate && groupDropPlan.groupByTaskProp) {
				try {
					const originalTask =
						this.taskInfoCache.get(draggedPath) ??
						(await this.plugin.cacheManager.getTaskInfo(draggedPath));
					if (originalTask) {
						const updatedTask = buildTaskListDropSideEffectTask(originalTask, {
							plan: groupDropPlan,
							isCompletedStatus: (status) =>
								this.plugin.statusManager.isCompletedStatus(status),
							getTimestamp: getCurrentTimestamp,
							getCompletedDate: () => new Date().toISOString().split("T")[0],
							coerceGroupKeyForTask: (property, value) =>
								this.coerceGroupKeyForFrontmatter(property, value),
							getClearedTaskValue: (property) =>
								this.getClearedTaskValue(property, file),
						});
						if (updatedTask) {
							await this.plugin.taskService.applyPropertyChangeSideEffects(
								file,
								originalTask,
								updatedTask,
								groupDropPlan.groupByTaskProp as keyof TaskInfo,
								groupDropPlan.sourceGroupKey,
								groupDropPlan.normalizedTargetGroupKey
							);
						}
					}
				} catch (sideEffectError) {
					tasknotesLogger.warn(
						"[TaskNotes][TaskListView] Side-effect error after drop:",
						{
							category: "persistence",
							operation: "side-effect-drop",
							error: sideEffectError,
						}
					);
				}
			}

			const didOptimisticallyReorder = this.applyOptimisticSortOrderResult(
				draggedPath,
				targetPath,
				above,
				targetGroupKey,
				sourceGroupKey,
				sortOrderPlan
			);
			if (!didOptimisticallyReorder) {
				this.debouncedRefresh();
			}
		});
	}

	private async renderFlat(taskNotes: TaskInfo[]): Promise<void> {
		const visibleProperties = this.getVisibleProperties();
		this.setSortScopeCandidatePaths([[null, taskNotes.map((task) => task.path)]]);

		// Apply search filter
		const filteredTasks = this.applySearchFilter(taskNotes);
		this.setExpandedRelationshipTaskScope(filteredTasks);
		const renderTasks = this.getTopLevelRenderTasks(filteredTasks);
		this.setCurrentVisibleTaskPaths(renderTasks);

		// Show "no results" if search returned empty but we had tasks
		if (this.isSearchWithNoResults(filteredTasks, taskNotes.length)) {
			this.clearAllTaskElements();
			this.sortScopeTaskPaths.clear();
			this.sortScopeCandidateTaskPaths.clear();
			if (this.itemsContainer) {
				this.renderSearchNoResults(this.itemsContainer);
			}
			return;
		}

		// Note: taskNotes are already sorted by Bases according to sort configuration
		// No manual sorting needed - Bases provides pre-sorted data

		const targetDate = createUTCDateFromLocalCalendarDate(new Date());
		this.currentTargetDate = targetDate;

		const cardOptions = this.getCardOptions(targetDate);

		// Decide whether to use virtual scrolling based on filtered task count
		const shouldUseVirtualScrolling = renderTasks.length >= this.VIRTUAL_SCROLL_THRESHOLD;

		if (shouldUseVirtualScrolling && !this.useVirtualScrolling) {
			// Switch to virtual scrolling
			this.cleanupNonVirtualRendering();
			this.useVirtualScrolling = true;
		} else if (!shouldUseVirtualScrolling && this.useVirtualScrolling) {
			// Switch back to normal rendering
			this.destroyVirtualScroller();
			this.useVirtualScrolling = false;
		}

		if (this.useVirtualScrolling) {
			await this.renderFlatVirtual(renderTasks, visibleProperties, cardOptions);
		} else {
			await this.renderFlatNormal(renderTasks, visibleProperties, cardOptions);
		}
	}

	private async renderFlatVirtual(
		taskNotes: TaskInfo[],
		visibleProperties: string[] | undefined,
		cardOptions: TaskCardOptions
	): Promise<void> {
		if (!this.itemsContainer) return;
		this.taskGroupKeys.clear(); // No groups in flat mode
		this.setSortScopePaths([[null, taskNotes.map((task) => task.path)]]);

		if (!this.virtualScroller) {
			// Initialize virtual scroller with automatic height calculation
			this.resetVirtualScrollerIfCardRenderChanged(
				this.buildCardRenderSignature(visibleProperties, cardOptions)
			);
			this.virtualScroller = new VirtualScroller<TaskListVirtualItem>({
				container: this.itemsContainer,
				items: taskNotes,
				// itemHeight omitted - will be calculated automatically from sample
				overscan: 5,
				renderItem: (item: TaskListVirtualItem) => {
					if ("type" in item) {
						throw new Error("Unexpected grouped item in flat renderer");
					}
					const taskInfo = item;
					// Create card using lazy mode
					const card = createTaskCard(item, this.plugin, visibleProperties, cardOptions);

					// Attach drag handlers for sort_order reordering
					this.configureCardForManualReordering(card, taskInfo, null);

					// Cache task info for event handlers
					this.taskInfoCache.set(taskInfo.path, taskInfo);
					this.lastTaskSignatures.set(taskInfo.path, this.buildTaskSignature(taskInfo));

					return card;
				},
				getItemKey: (item) => {
					if ("type" in item) {
						return `grouped-${item.groupKey}`;
					}
					return item.path;
				},
			});

			// Force recalculation after DOM settles
			window.setTimeout(() => {
				this.virtualScroller?.recalculate();
			}, 0);
		} else {
			// Update existing virtual scroller with new items
			this.resetVirtualScrollerIfCardRenderChanged(
				this.buildCardRenderSignature(visibleProperties, cardOptions)
			);
			if (!this.virtualScroller) {
				await this.renderFlatVirtual(taskNotes, visibleProperties, cardOptions);
				return;
			}
			this.virtualScroller.updateItems(taskNotes);
		}

		this.lastVirtualItems = taskNotes;
		this.lastFlatPaths = taskNotes.map((task) => task.path);
		this.lastCardRenderSignature = this.buildCardRenderSignature(
			visibleProperties,
			cardOptions
		);
	}

	private async renderFlatNormal(
		taskNotes: TaskInfo[],
		visibleProperties: string[] | undefined,
		cardOptions: TaskCardOptions
	): Promise<void> {
		if (!this.itemsContainer) return;
		this.lastVirtualItems = [];
		this.taskGroupKeys.clear(); // No groups in flat mode
		this.setSortScopePaths([[null, taskNotes.map((task) => task.path)]]);

		const seenPaths = new Set<string>();
		const orderChanged = !this.arePathArraysEqual(taskNotes, this.lastFlatPaths);
		const cardRenderSignature = this.buildCardRenderSignature(visibleProperties, cardOptions);
		const cardRenderChanged = cardRenderSignature !== this.lastCardRenderSignature;

		if (orderChanged) {
			this.itemsContainer.empty();
			this.currentTaskElements.clear();
		}

		for (const taskInfo of taskNotes) {
			let cardEl = orderChanged ? null : this.currentTaskElements.get(taskInfo.path) || null;
			const signature = this.buildTaskSignature(taskInfo, visibleProperties);
			const previousSignature = this.lastTaskSignatures.get(taskInfo.path);
			const needsUpdate = cardRenderChanged || signature !== previousSignature || !cardEl;

			if (!cardEl || needsUpdate) {
				const newCard = createTaskCard(
					taskInfo,
					this.plugin,
					visibleProperties,
					cardOptions
				);
				if (cardEl && cardEl.isConnected) {
					cardEl.replaceWith(newCard);
				}
				cardEl = newCard;
			}

			if (!cardEl.isConnected) {
				this.itemsContainer.appendChild(cardEl);
			}

			if (needsUpdate) {
				this.configureCardForManualReordering(cardEl, taskInfo, null);
			}

			this.currentTaskElements.set(taskInfo.path, cardEl);
			this.taskInfoCache.set(taskInfo.path, taskInfo);
			this.lastTaskSignatures.set(taskInfo.path, signature);
			seenPaths.add(taskInfo.path);
		}

		if (!orderChanged && seenPaths.size !== this.currentTaskElements.size) {
			for (const [path, el] of this.currentTaskElements) {
				if (!seenPaths.has(path)) {
					el.remove();
					this.currentTaskElements.delete(path);

					// Clean up related state in the same pass
					const timeout = this.clickTimeouts.get(path);
					if (timeout) {
						window.clearTimeout(timeout);
						this.clickTimeouts.delete(path);
					}
					this.taskInfoCache.delete(path);
					this.lastTaskSignatures.delete(path);
				}
			}
		}

		this.lastFlatPaths = taskNotes.map((task) => task.path);
		this.lastCardRenderSignature = cardRenderSignature;
	}

	/**
	 * Render tasks grouped by sub-property (when no primary grouping is configured).
	 * This treats the sub-group property as primary grouping.
	 */
	private async renderGroupedBySubProperty(taskNotes: TaskInfo[]): Promise<void> {
		const visibleProperties = this.getVisibleProperties();

		// Apply search filter
		const filteredTasks = this.applySearchFilter(taskNotes);
		this.setExpandedRelationshipTaskScope(filteredTasks);
		const renderTasks = this.getTopLevelRenderTasks(filteredTasks);
		const candidateTasks = this.getTopLevelRenderTasks(taskNotes);
		this.setCurrentVisibleTaskPaths(renderTasks);

		// Show "no results" if search returned empty but we had tasks
		if (this.isSearchWithNoResults(filteredTasks, taskNotes.length)) {
			this.clearAllTaskElements();
			this.sortScopeTaskPaths.clear();
			this.sortScopeCandidateTaskPaths.clear();
			if (this.itemsContainer) {
				this.renderSearchNoResults(this.itemsContainer);
			}
			return;
		}

		const targetDate = createUTCDateFromLocalCalendarDate(new Date());
		this.currentTargetDate = targetDate;
		const cardOptions = this.getCardOptions(targetDate);

		// Group tasks by sub-property
		const pathToProps = this.getGroupingPathProperties();
		const groupedTasks = groupTasksByTaskListSubProperty(
			renderTasks,
			this.subGroupPropertyId!,
			pathToProps
		);
		const allGroupedTasks = groupTasksByTaskListSubProperty(
			candidateTasks,
			this.subGroupPropertyId!,
			pathToProps
		);
		this.setSortScopeCandidatePaths(buildTaskListSubPropertyScopePaths(allGroupedTasks));
		this.applyGroupingSnapshot(this.createSubPropertyHierarchySnapshot(groupedTasks));

		// Build flat items array (treat sub-groups as primary groups)
		const items = buildTaskListSubPropertyRenderItems(groupedTasks, this.collapsedGroups);

		// Decide whether to use virtual scrolling
		const shouldUseVirtualScrolling = items.length >= this.VIRTUAL_SCROLL_THRESHOLD;

		// Switch rendering mode if needed
		if (this.useVirtualScrolling && shouldUseVirtualScrolling && this.virtualScroller) {
			await this.renderGroupedVirtual(items, visibleProperties, cardOptions);
			this.lastFlatPaths = taskNotes.map((task) => task.path);
			return;
		}

		// Full render needed
		this.itemsContainer!.empty();
		this.currentTaskElements.clear();
		this.clearClickTimeouts();
		this.taskInfoCache.clear();
		this.lastTaskSignatures.clear();

		if (shouldUseVirtualScrolling && !this.useVirtualScrolling) {
			this.cleanupNonVirtualRendering();
			this.useVirtualScrolling = true;
		} else if (!shouldUseVirtualScrolling && this.useVirtualScrolling) {
			this.destroyVirtualScroller();
			this.useVirtualScrolling = false;
		}

		if (this.useVirtualScrolling) {
			await this.renderGroupedVirtual(items, visibleProperties, cardOptions);
		} else {
			await this.renderGroupedNormal(items, visibleProperties, cardOptions);
		}

		this.lastFlatPaths = taskNotes.map((task) => task.path);
	}

	private async renderGrouped(taskNotes: TaskInfo[]): Promise<void> {
		const visibleProperties = this.getVisibleProperties();
		const groups = this.dataAdapter.getGroupedData() as TaskListGroup[];

		// Apply search filter
		const filteredTasks = this.applySearchFilter(taskNotes);
		this.setExpandedRelationshipTaskScope(filteredTasks);
		const renderTasks = this.getTopLevelRenderTasks(filteredTasks);
		const candidateTasks = this.getTopLevelRenderTasks(taskNotes);
		this.setCurrentVisibleTaskPaths(renderTasks);

		// Show "no results" if search returned empty but we had tasks
		if (this.isSearchWithNoResults(filteredTasks, taskNotes.length)) {
			this.clearAllTaskElements();
			this.sortScopeTaskPaths.clear();
			this.sortScopeCandidateTaskPaths.clear();
			if (this.itemsContainer) {
				this.renderSearchNoResults(this.itemsContainer);
			}
			return;
		}

		const targetDate = createUTCDateFromLocalCalendarDate(new Date());
		this.currentTargetDate = targetDate;
		const cardOptions = this.getCardOptions(targetDate);
		this.applyGroupingSnapshot(this.createGroupedHierarchySnapshot(groups, renderTasks));

		// Build flattened list of items using shared method
		const pathToProps = this.subGroupPropertyId
			? this.getGroupingPathProperties()
			: new Map<string, Record<string, unknown>>();
		const items = buildTaskListGroupedRenderItems({
			groups,
			taskNotes: renderTasks,
			subGroupPropertyId: this.subGroupPropertyId,
			pathToProps,
			collapsedGroups: this.collapsedGroups,
			collapsedSubGroups: this.collapsedSubGroups,
			convertGroupKeyToString: (key) => this.dataAdapter.convertGroupKeyToString(key),
		});
		this.setSortScopeCandidatePaths(
			buildTaskListGroupedScopePaths(groups, candidateTasks, (key) =>
				this.dataAdapter.convertGroupKeyToString(key)
			)
		);

		// Use virtual scrolling if we have many items
		const shouldUseVirtualScrolling = items.length >= this.VIRTUAL_SCROLL_THRESHOLD;

		// If already using virtual scrolling and still need it, just update items
		if (this.useVirtualScrolling && shouldUseVirtualScrolling && this.virtualScroller) {
			await this.renderGroupedVirtual(items, visibleProperties, cardOptions);
			this.lastFlatPaths = taskNotes.map((task) => task.path);
			return;
		}

		// Otherwise, need to switch rendering mode or initial render
		this.itemsContainer!.empty();
		this.currentTaskElements.clear();
		this.clearClickTimeouts();
		this.taskInfoCache.clear();
		this.lastTaskSignatures.clear();

		if (shouldUseVirtualScrolling && !this.useVirtualScrolling) {
			this.cleanupNonVirtualRendering();
			this.useVirtualScrolling = true;
		} else if (!shouldUseVirtualScrolling && this.useVirtualScrolling) {
			this.destroyVirtualScroller();
			this.useVirtualScrolling = false;
		}

		if (this.useVirtualScrolling) {
			await this.renderGroupedVirtual(items, visibleProperties, cardOptions);
		} else {
			await this.renderGroupedNormal(items, visibleProperties, cardOptions);
		}

		this.lastFlatPaths = taskNotes.map((task) => task.path);
	}

	private async renderGroupedVirtual(
		items: TaskListRenderItem[],
		visibleProperties: string[] | undefined,
		cardOptions: TaskCardOptions
	): Promise<void> {
		// Populate group key lookup for cross-group drag detection
		this.syncGroupedDragMetadata(items);

		if (!this.virtualScroller) {
			this.virtualScroller = new VirtualScroller<TaskListVirtualItem>({
				container: this.itemsContainer!,
				items: items,
				// itemHeight omitted - automatically calculated from sample (headers + cards)
				overscan: 5,
				renderItem: (item) => {
					if (!("type" in item)) {
						throw new Error("Unexpected flat task item in grouped renderer");
					}
					if (item.type === "primary-header" || item.type === "sub-header") {
						return this.createGroupHeader(item);
					} else {
						const cardEl = createTaskCard(
							item.task,
							this.plugin,
							visibleProperties,
							cardOptions
						);
						// Attach drag handlers for sort_order reordering
						this.elementDestinations.set(
							cardEl,
							this.createMovementDestination(item.groupKey, item.subGroupKey)
						);
						this.configureCardForManualReordering(cardEl, item.task, item.groupKey);
						this.taskInfoCache.set(item.task.path, item.task);
						this.lastTaskSignatures.set(
							item.task.path,
							this.buildTaskSignature(item.task)
						);
						return cardEl;
					}
				},
				getItemKey: (item) => {
					if (!("type" in item)) {
						return item.path;
					}
					if (item.type === "primary-header") {
						return `primary-${item.groupKey}`;
					} else if (item.type === "sub-header") {
						return `sub-${item.groupKey}:${item.subGroupKey}`;
					} else {
						return item.task.path;
					}
				},
			});

			window.setTimeout(() => {
				this.virtualScroller?.recalculate();
			}, 0);
		} else {
			this.resetVirtualScrollerIfCardRenderChanged(
				this.buildCardRenderSignature(visibleProperties, cardOptions)
			);
			if (!this.virtualScroller) {
				await this.renderGroupedVirtual(items, visibleProperties, cardOptions);
				return;
			}
			this.virtualScroller.updateItems(items);
		}
		this.lastVirtualItems = items;
		this.lastCardRenderSignature = this.buildCardRenderSignature(
			visibleProperties,
			cardOptions
		);
	}

	private async renderGroupedNormal(
		items: TaskListRenderItem[],
		visibleProperties: string[] | undefined,
		cardOptions: TaskCardOptions
	): Promise<void> {
		this.lastVirtualItems = [];
		// Populate group key lookup for cross-group drag detection
		this.syncGroupedDragMetadata(items);

		for (const item of items) {
			if (item.type === "primary-header" || item.type === "sub-header") {
				const headerEl = this.createGroupHeader(item);
				this.itemsContainer!.appendChild(headerEl);
			} else {
				const cardEl = createTaskCard(
					item.task,
					this.plugin,
					visibleProperties,
					cardOptions
				);
				this.elementDestinations.set(
					cardEl,
					this.createMovementDestination(item.groupKey, item.subGroupKey)
				);
				this.configureCardForManualReordering(cardEl, item.task, item.groupKey);
				this.itemsContainer!.appendChild(cardEl);
				this.currentTaskElements.set(item.task.path, cardEl);
				this.taskInfoCache.set(item.task.path, item.task);
				this.lastTaskSignatures.set(item.task.path, this.buildTaskSignature(item.task));
			}
		}
		this.lastCardRenderSignature = this.buildCardRenderSignature(
			visibleProperties,
			cardOptions
		);
	}

	private createGroupHeader(headerItem: TaskListHeaderItem): HTMLElement {
		// Use correct document for pop-out window support
		const doc = this.containerEl.ownerDocument;

		const groupHeader = createElementInDocument(doc, "div");
		groupHeader.className = "task-section task-group";

		// Determine header level and set appropriate data attributes
		const isSubHeader = headerItem.type === "sub-header";
		const level = isSubHeader ? "sub" : "primary";
		groupHeader.dataset.level = level;
		this.elementDestinations.set(
			groupHeader,
			this.createMovementDestination(
				headerItem.groupKey,
				isSubHeader ? headerItem.subGroupKey : undefined
			)
		);
		const groupKey = isSubHeader
			? `${headerItem.groupKey}:${headerItem.subGroupKey}`
			: headerItem.groupKey;

		if (isSubHeader) {
			groupHeader.dataset.groupKey = groupKey;
			groupHeader.dataset.parentKey = headerItem.parentKey;
		} else {
			groupHeader.dataset.groupKey = groupKey;
		}

		// Apply collapsed state
		if (headerItem.isCollapsed) {
			groupHeader.classList.add("is-collapsed");
		}

		const headerElement = createElementInDocument(doc, "h3");
		headerElement.className = "task-group-header task-list-view__group-header";
		groupHeader.appendChild(headerElement);

		// Add toggle button
		const toggleBtn = createElementInDocument(doc, "button");
		toggleBtn.className = "task-group-toggle";
		toggleBtn.type = "button";
		toggleBtn.setAttribute("aria-label", "Toggle group");
		toggleBtn.setAttribute("aria-expanded", String(!headerItem.isCollapsed));
		toggleBtn.dataset.groupKey = groupKey;
		headerElement.appendChild(toggleBtn);

		// Add chevron icon
		setIcon(toggleBtn, "chevron-right");
		const svg = toggleBtn.querySelector("svg");
		if (svg) {
			svg.classList.add("chevron");
			svg.setAttribute("width", "16");
			svg.setAttribute("height", "16");
		}

		// Add group title
		const titleContainer = headerElement.createSpan({ cls: "task-group-title" });
		const displayTitle = isSubHeader ? headerItem.subGroupTitle : headerItem.groupTitle;
		this.renderGroupTitle(titleContainer, displayTitle);

		// Add count
		headerElement.createSpan({
			text: ` (${headerItem.taskCount})`,
			cls: "agenda-view__item-count",
		});

		return groupHeader;
	}

	/** Whether a task's grouping values differ from those its rendered destination reflects. */
	private groupingValuesChanged(path: string): boolean {
		const properties = [this.getGroupByPropertyId(), this.subGroupPropertyId].filter(
			(property): property is string =>
				!!property &&
				!property.startsWith("formula.") &&
				(!property.startsWith("file.") || property === "file.tags")
		);
		const rendered = this.movementProperties.get(path);
		const file = this.plugin.app.vault.getAbstractFileByPath(path);
		if (properties.length === 0 || !rendered || !(file instanceof TFile)) return false;
		const frontmatter = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
		return properties.some(
			(property) =>
				JSON.stringify(getTaskListPropertyValue(frontmatter, property) ?? null) !==
				JSON.stringify(getTaskListPropertyValue(rendered, property) ?? null)
		);
	}

	protected async handleTaskUpdate(task: TaskInfo): Promise<void> {
		// Update cache
		this.taskInfoCache.set(task.path, task);
		this.lastTaskSignatures.set(task.path, this.buildTaskSignature(task));

		// For virtual scrolling, just do a full refresh
		// Simple and reliable, performance is still good with virtual scrolling
		if (this.useVirtualScrolling) {
			this.debouncedRefresh();
		} else {
			// Normal mode - update the specific card
			const existingElement = this.currentTaskElements.get(task.path);
			if (this.groupingValuesChanged(task.path)) {
				// The card now belongs to another destination; only a full render can place it.
				this.debouncedRefresh();
			} else if (existingElement && existingElement.isConnected) {
				const visibleProperties = this.getVisibleProperties();
				const replacement = createTaskCard(
					task,
					this.plugin,
					visibleProperties,
					this.getCardOptions(this.currentTargetDate)
				);
				this.configureCardForManualReordering(
					replacement,
					task,
					this.taskGroupKeys.get(task.path) ?? null
				);
				const destination = this.elementDestinations.get(existingElement);
				if (destination) this.elementDestinations.set(replacement, destination);
				existingElement.replaceWith(replacement);
				replacement.classList.add("task-card--updated");
				// Use correct window for pop-out window support
				const win = this.containerEl.ownerDocument.defaultView || window;
				win.setTimeout(() => {
					replacement.classList.remove("task-card--updated");
				}, 1000);
				this.currentTaskElements.set(task.path, replacement);
			} else {
				this.debouncedRefresh();
			}
		}
	}

	private renderEmptyState(): void {
		// Use correct document for pop-out window support
		const doc = this.containerEl.ownerDocument;
		const emptyEl = createElementInDocument(doc, "div");
		emptyEl.className = "tn-bases-empty";
		emptyEl.classList.remove(
			"tn-static-color-var-color-accent-d2cad743",
			"tn-static-color-var-text-accent-65b47ee3",
			"tn-static-color-var-text-muted-5872de20",
			"tn-static-color-var-text-on-accent-f3e1679d",
			"tn-static-color-var-text-warning-783d5f03",
			"tn-static-color-var-tn-text-muted-a90fb6f3",
			"tn-static-color-white-0a43e56a",
			"tn-static-cursor-pointer-2723efcc",
			"tn-static-font-size-12px-65574819",
			"tn-static-font-weight-bold-0fe8c30d",
			"tn-static-font-weight-bold-e0b452bd",
			"tn-static-margin-2px-0-edce9b14",
			"tn-static-margin-8px-0-0-0-a2eb8382",
			"tn-static-padding-0-16px-16px-16px-f1aa998c",
			"tn-static-padding-0-41d7d7e2",
			"tn-static-padding-12px-43bef435",
			"tn-static-padding-16px-287f770e",
			"tn-static-padding-20px-769fed37",
			"tn-static-padding-20px-ebe8e48c",
			"tn-static-padding-2px-8px-c8eea84a",
			"tn-static-padding-2rem-42aa6d9c",
			"tn-static-text-align-center-91a87015"
		);
		emptyEl.classList.add("tn-static-padding-20px-7a035d95");
		emptyEl.textContent = "No tasknotes tasks found for this base.";
		this.itemsContainer!.appendChild(emptyEl);
	}

	renderError(error: Error): void {
		// Use correct document for pop-out window support
		const doc = this.containerEl.ownerDocument;
		const errorEl = createElementInDocument(doc, "div");
		errorEl.className = "tn-bases-error";
		errorEl.classList.remove(
			"tn-static-border-radius-4px-c290c56e",
			"tn-static-border-radius-6px-0dc8408c",
			"tn-static-color-var-color-accent-d2cad743",
			"tn-static-color-var-text-accent-65b47ee3",
			"tn-static-color-var-text-muted-5872de20",
			"tn-static-color-var-text-on-accent-f3e1679d",
			"tn-static-color-var-text-warning-783d5f03",
			"tn-static-color-var-tn-text-muted-a90fb6f3",
			"tn-static-color-white-0a43e56a",
			"tn-static-cursor-pointer-2723efcc",
			"tn-static-font-size-12px-65574819",
			"tn-static-font-weight-bold-0fe8c30d",
			"tn-static-font-weight-bold-e0b452bd",
			"tn-static-margin-0-11696618",
			"tn-static-margin-0-auto-266e9b04",
			"tn-static-margin-0-db0d5f36",
			"tn-static-margin-0-var-size-4-2-77f7dc08",
			"tn-static-margin-2px-0-edce9b14",
			"tn-static-margin-8px-0-0-0-a2eb8382",
			"tn-static-padding-0-16px-16px-16px-f1aa998c",
			"tn-static-padding-0-41d7d7e2",
			"tn-static-padding-12px-43bef435",
			"tn-static-padding-16px-287f770e",
			"tn-static-padding-20px-769fed37",
			"tn-static-padding-20px-7a035d95",
			"tn-static-padding-2px-8px-c8eea84a",
			"tn-static-padding-2rem-42aa6d9c"
		);
		errorEl.classList.add("tn-static-padding-20px-ebe8e48c");
		errorEl.textContent = `Error loading tasks: ${error.message || "Unknown error"}`;
		this.itemsContainer!.appendChild(errorEl);
	}

	/**
	 * Render group title using shared utility.
	 * Uses this.app from BasesView (with fallback to plugin.app for safety).
	 */
	private renderGroupTitle(container: HTMLElement, title: string): void {
		// Use this.app if available (set by Bases), otherwise fall back to plugin.app
		const app = this.app || this.plugin.app;

		const linkServices: LinkServices = {
			metadataCache: app.metadataCache,
			workspace: app.workspace,
		};

		renderGroupTitle(container, title, linkServices);
	}

	/**
	 * Component lifecycle: Called when component is unloaded.
	 * Override from Component base class.
	 */
	onunload(): void {
		// Component.register() calls will be automatically cleaned up (including search cleanup)
		// We just need to clean up view-specific state
		this.touchMovement?.destroy();
		this.cancelTaskMovement();
		this.unregisterContainerListeners();
		this.destroyVirtualScroller();

		this.currentTaskElements.clear();
		this.itemsContainer = null;
		this.lastRenderWasGrouped = false;
		this.clearClickTimeouts();
		this.taskInfoCache.clear();
		this.lastTaskSignatures.clear();
		this.lastFlatPaths = [];
		this.useVirtualScrolling = false;
		this.collapsedGroups.clear();
		this.collapsedSubGroups.clear();
		this.clearGroupingSnapshot();
		this.initializedPrimaryGroupKeys.clear();
		this.initializedSubGroupKeys.clear();
		this.taskGroupKeys.clear();
		this.sortScopeTaskPaths.clear();
	}

	/**
	 * Get ephemeral state to preserve across view reloads.
	 * Saves scroll position, collapsed groups, and collapsed sub-groups.
	 */
	getEphemeralState(): unknown {
		const baseState = super.getEphemeralState();
		const baseStateObject = isRecord(baseState) ? baseState : {};

		return {
			...baseStateObject,
			scrollTop: this.rootElement?.scrollTop || 0,
			itemsContainerScrollTop: this.itemsContainer?.scrollTop || 0,
			collapsedGroups: Array.from(this.collapsedGroups),
			collapsedSubGroups: Array.from(this.collapsedSubGroups),
		};
	}

	private hasInitializedCollapseState(): boolean {
		return this.initializedPrimaryGroupKeys.size > 0 || this.initializedSubGroupKeys.size > 0;
	}

	private restoreCollapsedStateFromEphemeral(state: TaskListEphemeralState): void {
		let restoredCollapsedState = false;

		// Restore collapsed groups immediately
		if (state.collapsedGroups && Array.isArray(state.collapsedGroups)) {
			const filtered = state.collapsedGroups.filter(
				(value): value is string => typeof value === "string"
			);
			this.collapsedGroups = new Set(filtered);
			restoredCollapsedState = restoredCollapsedState || filtered.length > 0;
		}

		// Restore collapsed sub-groups immediately
		if (state.collapsedSubGroups && Array.isArray(state.collapsedSubGroups)) {
			const filtered = state.collapsedSubGroups.filter(
				(value): value is string => typeof value === "string"
			);
			this.collapsedSubGroups = new Set(filtered);
			restoredCollapsedState = restoredCollapsedState || filtered.length > 0;
		}
		this.deferCollapseDefaultForNextSnapshot = restoredCollapsedState;
	}

	/**
	 * Restore ephemeral state after view reload. Collapse state is applied only before the
	 * view builds its first grouping snapshot, so a stale snapshot captured before a render
	 * cannot undo the collapse default that render seeded.
	 */
	setEphemeralState(state: unknown): void {
		if (!isTaskListEphemeralState(state)) return;
		super.setEphemeralState(state);

		if (!this.hasInitializedCollapseState()) {
			this.restoreCollapsedStateFromEphemeral(state);
		}

		// Restore scroll position after render completes
		if (typeof state.scrollTop === "number" && this.rootElement) {
			const scrollTop = state.scrollTop;
			// Use requestAnimationFrame to ensure DOM is ready
			window.requestAnimationFrame(() => {
				if (this.rootElement && this.rootElement.isConnected) {
					this.rootElement.scrollTop = scrollTop;
				}
			});
		}
		if (typeof state.itemsContainerScrollTop === "number") {
			const itemsContainerScrollTop = state.itemsContainerScrollTop;
			window.requestAnimationFrame(() => {
				if (this.itemsContainer && this.itemsContainer.isConnected) {
					this.itemsContainer.scrollTop = itemsContainerScrollTop;
					this.virtualScroller?.recalculate();
				}
			});
		}
	}

	private clearAllTaskElements(): void {
		if (this.useVirtualScrolling) {
			this.destroyVirtualScroller();
			this.useVirtualScrolling = false;
		}
		this.itemsContainer?.empty();
		this.currentTaskElements.forEach((el) => el.remove());
		this.currentTaskElements.clear();
		this.lastFlatPaths = [];
		this.lastTaskSignatures.clear();
		this.taskInfoCache.clear();
		this.clearClickTimeouts();
		this.taskGroupKeys.clear();
		this.sortScopeTaskPaths.clear();
		this.expandedRelationshipTaskPaths.clear();
		this.expandedRelationshipTaskOrder.clear();
	}

	private getCardOptions(targetDate: Date): TaskCardOptions {
		return this.buildTaskCardOptions({
			targetDate,
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

	private clearClickTimeouts(): void {
		for (const timeout of this.clickTimeouts.values()) {
			if (timeout) {
				window.clearTimeout(timeout);
			}
		}
		this.clickTimeouts.clear();
	}

	private registerContainerListeners(): void {
		if (!this.itemsContainer || this.containerListenersRegistered) return;

		// Register click listener for group header collapse/expand using Component API
		// This automatically cleans up on component unload
		this.registerDomEvent(this.itemsContainer, "click", this.handleItemClick);
		this.containerListenersRegistered = true;
	}

	private unregisterContainerListeners(): void {
		// No manual cleanup needed - Component.registerDomEvent handles it automatically
		this.containerListenersRegistered = false;
	}

	private getTaskContextFromEvent(event: Event): { task: TaskInfo; card: HTMLElement } | null {
		const target = event.target as HTMLElement | null;
		if (!target) return null;
		const card = target.closest<HTMLElement>(".task-card");
		if (!card) return null;
		const path = card.dataset.taskPath;
		if (!path) return null;
		const task = this.taskInfoCache.get(path);
		if (!task) return null;
		return { task, card };
	}

	private handleItemClick = async (event: MouseEvent) => {
		const target = event.target as HTMLElement;

		// ONLY handle group header clicks - task cards handle their own clicks
		const groupHeader = target.closest<HTMLElement>(".task-group-header");
		if (groupHeader) {
			const groupSection = groupHeader.closest<HTMLElement>(".task-group");
			const groupKey = groupSection?.dataset.groupKey;

			if (groupKey) {
				// Don't toggle if clicking on a link
				if (target.closest("a")) {
					return;
				}

				event.preventDefault();
				event.stopPropagation();
				await this.handleGroupToggle(groupKey);
				return;
			}
		}

		// Don't handle task card clicks here - they have their own handlers
		// This prevents double-firing when clicking on tasks
	};

	private isSubGroupKey(groupKey: string): boolean {
		return groupKey.includes(":");
	}

	private setSetEntry(set: Set<string>, key: string, collapsed: boolean): void {
		if (collapsed) {
			set.add(key);
			return;
		}

		set.delete(key);
	}

	private getCurrentSubGroupKeys(): string[] {
		const keys: string[] = [];
		for (const subGroupKeys of this.currentSubGroupKeysByParent.values()) {
			keys.push(...subGroupKeys);
		}
		return keys;
	}

	/**
	 * Set collapsed state for all subgroups within a specific primary group,
	 * without affecting the primary group itself.
	 */
	private async setSubGroupsCollapsed(groupKey: string, collapsed: boolean): Promise<void> {
		for (const subGroupKey of this.currentSubGroupKeysByParent.get(groupKey) || []) {
			this.setSetEntry(this.collapsedSubGroups, subGroupKey, collapsed);
		}

		if (this.lastRenderWasGrouped) {
			await this.refreshGroupedView();
		}
	}

	/**
	 * Set collapsed state for all primary groups,
	 * without affecting subgroups.
	 */
	private async setAllPrimaryGroupsCollapsed(collapsed: boolean): Promise<void> {
		for (const groupKey of this.currentPrimaryGroupKeys) {
			this.setSetEntry(this.collapsedGroups, groupKey, collapsed);
		}

		if (this.lastRenderWasGrouped) {
			await this.refreshGroupedView();
		}
	}

	/**
	 * Set collapsed state for all primary groups and all subgroups.
	 */
	private async setAllGroupsAndSubGroupsCollapsed(collapsed: boolean): Promise<void> {
		for (const groupKey of this.currentPrimaryGroupKeys) {
			this.setSetEntry(this.collapsedGroups, groupKey, collapsed);
		}
		for (const subGroupKey of this.getCurrentSubGroupKeys()) {
			this.setSetEntry(this.collapsedSubGroups, subGroupKey, collapsed);
		}

		if (this.lastRenderWasGrouped) {
			await this.refreshGroupedView();
		}
	}

	private async handleGroupToggle(groupKey: string): Promise<void> {
		if (this.isSubGroupKey(groupKey)) {
			this.setSetEntry(
				this.collapsedSubGroups,
				groupKey,
				!this.collapsedSubGroups.has(groupKey)
			);
		} else {
			this.setSetEntry(this.collapsedGroups, groupKey, !this.collapsedGroups.has(groupKey));
		}

		// Rebuild items and update virtual scroller without full re-render
		if (this.lastRenderWasGrouped) {
			await this.refreshGroupedView();
		}
	}

	private async refreshGroupedView(): Promise<void> {
		if (!this.data?.data) return;

		const dataItems = this.dataAdapter.extractDataItems();
		computeBasesFormulas(this.data, dataItems);
		const taskNotes = await identifyTaskNotesFromBasesData(dataItems, this.plugin);
		const filteredTasks = this.applySearchFilter(taskNotes);
		this.setExpandedRelationshipTaskScope(filteredTasks);
		const renderTasks = this.getTopLevelRenderTasks(filteredTasks);
		this.setCurrentVisibleTaskPaths(renderTasks);

		const pathToProps = this.subGroupPropertyId
			? this.getGroupingPathProperties(dataItems)
			: new Map<string, Record<string, unknown>>();
		let items: TaskListRenderItem[];

		if (
			!this.getGroupByPropertyId() &&
			!this.dataAdapter.isGrouped() &&
			this.subGroupPropertyId
		) {
			const groupedTasks = groupTasksByTaskListSubProperty(
				renderTasks,
				this.subGroupPropertyId,
				pathToProps
			);
			this.applyGroupingSnapshot(this.createSubPropertyHierarchySnapshot(groupedTasks));
			items = buildTaskListSubPropertyRenderItems(groupedTasks, this.collapsedGroups);
		} else {
			const groups = this.dataAdapter.getGroupedData() as TaskListGroup[];
			this.applyGroupingSnapshot(this.createGroupedHierarchySnapshot(groups, renderTasks));
			items = buildTaskListGroupedRenderItems({
				groups,
				taskNotes: renderTasks,
				subGroupPropertyId: this.subGroupPropertyId,
				pathToProps,
				collapsedGroups: this.collapsedGroups,
				collapsedSubGroups: this.collapsedSubGroups,
				convertGroupKeyToString: (key) => this.dataAdapter.convertGroupKeyToString(key),
			});
		}

		// Update virtual scroller with new items
		if (this.useVirtualScrolling && this.virtualScroller) {
			this.syncGroupedDragMetadata(items);
			this.virtualScroller.updateItems(items);
		} else {
			// If not using virtual scrolling, do full render
			await this.render();
		}
	}

	private handleItemContextMenu = async (event: MouseEvent) => {
		const context = this.getTaskContextFromEvent(event);
		if (!context) return;
		event.preventDefault();
		event.stopPropagation();

		// If multiple tasks are selected, show batch context menu
		const selectionService = this.plugin.taskSelectionService;
		if (selectionService && selectionService.getSelectionCount() > 1) {
			// Ensure the right-clicked task is in the selection
			if (!selectionService.isSelected(context.task.path)) {
				selectionService.addToSelection(context.task.path);
			}
			this.showBatchContextMenu(event);
			return;
		}

		await showTaskContextMenu(event, context.task.path, this.plugin, this.currentTargetDate);
	};

	private handleItemPointerOver = (event: PointerEvent) => {
		if ("pointerType" in event && event.pointerType !== "mouse") {
			return;
		}
		const context = this.getTaskContextFromEvent(event);
		if (!context) return;

		const related = event.relatedTarget as HTMLElement | null;
		if (related && context.card.contains(related)) {
			return;
		}

		const app = this.app || this.plugin.app;
		const file = app.vault.getAbstractFileByPath(context.task.path);
		if (file) {
			app.workspace.trigger("hover-link", {
				event: event as MouseEvent,
				source: "tasknotes-task-card",
				hoverParent: context.card,
				targetEl: context.card,
				linktext: context.task.path,
				sourcePath: context.task.path,
			});
		}
	};

	private async handleActionClick(
		action: string,
		task: TaskInfo,
		target: HTMLElement,
		event: MouseEvent
	): Promise<void> {
		switch (action) {
			case "toggle-status":
				await this.handleToggleStatus(task, event);
				return;
			case "priority-menu":
				this.showPriorityMenu(task, event);
				return;
			case "recurrence-menu":
				this.showRecurrenceMenu(task, event);
				return;
			case "reminder-menu":
				this.showReminderModal(task);
				return;
			case "task-context-menu":
				await showTaskContextMenu(
					event,
					task.path,
					this.plugin,
					this.getTaskActionDate(task)
				);
				return;
			case "edit-date":
				await this.openDateContextMenu(
					task,
					target.dataset.tnDateType as "due" | "scheduled" | undefined,
					event
				);
				return;
			case "toggle-subtasks":
				await this.toggleSubtasks(task, target);
				return;
			case "toggle-blocking-tasks":
				await this.toggleBlockingTasks(task, target);
				return;
			default:
				await this.handleCardClick(task, event);
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
			const message = error instanceof Error ? error.message : String(error);
			tasknotesLogger.error("[TaskNotes][TaskListView] Failed to toggle status", {
				category: "persistence",
				operation: "toggle-status",
				details: { taskPath: task.path },
				error: message,
			});
			new Notice(`Failed to toggle task status: ${message}`);
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

		return this.currentTargetDate;
	}

	private showPriorityMenu(task: TaskInfo, event: MouseEvent): void {
		const menu = new PriorityContextMenu({
			currentValue: task.priority,
			onSelect: (newPriority) => {
				void (async () => {
					try {
						await this.plugin.updateTaskProperty(task, "priority", newPriority);
					} catch (error) {
						tasknotesLogger.error(
							"[TaskNotes][TaskListView] Failed to update priority",
							{ category: "validation", operation: "update-priority", error: error }
						);
						new Notice("Failed to update priority");
					}
				})();
			},
			plugin: this.plugin,
		});
		menu.show(event);
	}

	private showRecurrenceMenu(task: TaskInfo, event: MouseEvent): void {
		const menu = new RecurrenceContextMenu({
			currentValue: typeof task.recurrence === "string" ? task.recurrence : undefined,
			currentAnchor: task.recurrence_anchor || "scheduled",
			scheduledDate: task.scheduled,
			onSelect: (newRecurrence: string | null, anchor?: "scheduled" | "completion") => {
				void (async () => {
					try {
						await this.plugin.updateTaskProperty(
							task,
							"recurrence",
							newRecurrence || undefined
						);
						if (anchor !== undefined) {
							await this.plugin.updateTaskProperty(task, "recurrence_anchor", anchor);
						}
					} catch (error) {
						tasknotesLogger.error(
							"[TaskNotes][TaskListView] Failed to update recurrence",
							{ category: "validation", operation: "update-recurrence", error: error }
						);
						new Notice("Failed to update recurrence");
					}
				})();
			},
			app: this.plugin.app,
			plugin: this.plugin,
		});
		menu.show(event);
	}

	private showReminderModal(task: TaskInfo): void {
		const modal = new ReminderModal(this.plugin.app, this.plugin, task, (reminders) => {
			void (async () => {
				try {
					await this.plugin.updateTaskProperty(
						task,
						"reminders",
						reminders.length > 0 ? reminders : undefined
					);
				} catch (error) {
					tasknotesLogger.error("[TaskNotes][TaskListView] Failed to update reminders", {
						category: "validation",
						operation: "update-reminders",
						error: error,
					});
					new Notice("Failed to update reminders");
				}
			})();
		});
		modal.open();
	}

	private async openDateContextMenu(
		task: TaskInfo,
		dateType: "due" | "scheduled" | undefined,
		event: MouseEvent
	): Promise<void> {
		if (!dateType) return;
		const currentValue = dateType === "due" ? task.due : task.scheduled;
		const menu = new DateContextMenu({
			currentValue: getDatePart(currentValue || ""),
			currentTime: getTimePart(currentValue || ""),
			onSelect: (dateValue, timeValue) => {
				void (async () => {
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
						const message = error instanceof Error ? error.message : String(error);
						tasknotesLogger.error("[TaskNotes][TaskListView] Failed to update date", {
							category: "validation",
							operation: "update-date",
							details: { taskPath: task.path, dateType },
							error: message,
						});
						new Notice(`Failed to update ${dateType} date: ${message}`);
					}
				})();
			},
			dateRole: dateType,
			plugin: this.plugin,
			app: this.app || this.plugin.app,
		});
		menu.show(event);
	}

	private async handleCardClick(task: TaskInfo, event: MouseEvent): Promise<void> {
		// Check if this is a selection click (shift/ctrl/cmd or in selection mode)
		if (this.handleSelectionClick(event, task.path)) {
			return;
		}

		if (this.plugin.settings.doubleClickAction === "none") {
			await this.executeSingleClickAction(task, event);
			return;
		}

		const existingTimeout = this.clickTimeouts.get(task.path);
		if (existingTimeout) {
			window.clearTimeout(existingTimeout);
			this.clickTimeouts.delete(task.path);
			await this.executeDoubleClickAction(task, event);
		} else {
			// Use correct window for pop-out window support
			const win = this.containerEl.ownerDocument.defaultView || window;
			const timeout = win.setTimeout(() => {
				void (async () => {
					this.clickTimeouts.delete(task.path);
					await this.executeSingleClickAction(task, event);
				})();
			}, 250);
			this.clickTimeouts.set(task.path, timeout);
		}
	}

	private async executeSingleClickAction(task: TaskInfo, event: MouseEvent): Promise<void> {
		if (event.ctrlKey || event.metaKey) {
			this.openTaskNote(task, true);
			return;
		}

		switch (this.plugin.settings.singleClickAction) {
			case "edit":
				await this.editTask(task);
				break;
			case "openNote":
				this.openTaskNote(task, false);
				break;
			default:
				break;
		}
	}

	private async executeDoubleClickAction(task: TaskInfo, event: MouseEvent): Promise<void> {
		switch (this.plugin.settings.doubleClickAction) {
			case "edit":
				await this.editTask(task);
				break;
			case "openNote":
				this.openTaskNote(task, false);
				break;
			default:
				break;
		}
	}

	private async editTask(task: TaskInfo): Promise<void> {
		await this.plugin.openTaskEditModal(task);
	}

	private openTaskNote(task: TaskInfo, newTab: boolean): void {
		const app = this.app || this.plugin.app;
		const file = app.vault.getAbstractFileByPath(task.path);
		if (file instanceof TFile) {
			if (newTab) {
				void app.workspace.openLinkText(task.path, "", true);
			} else {
				void app.workspace.getLeaf(false).openFile(file);
			}
		}
	}

	private async toggleSubtasks(task: TaskInfo, target: HTMLElement): Promise<void> {
		try {
			if (!this.plugin.expandedProjectsService) {
				tasknotesLogger.error(
					"[TaskNotes][TaskListView] ExpandedProjectsService not initialized",
					{ category: "stale-data", operation: "expandedprojectsservice-not-initialized" }
				);
				new Notice("Service not available. Please try reloading the plugin.");
				return;
			}

			const newExpanded = this.plugin.expandedProjectsService.toggle(
				task.path,
				this.plugin.settings?.expandSubtasksByDefault === true
			);
			target.classList.toggle("task-card__chevron--expanded", newExpanded);
			target.setAttribute(
				"aria-label",
				newExpanded ? "Collapse subtasks" : "Expand subtasks"
			);

			// Find the card element and toggle subtasks display
			const card = target.closest<HTMLElement>(".task-card");
			if (card) {
				const { toggleSubtasks } = await import("../ui/TaskCard");
				await toggleSubtasks(card, task, this.plugin, newExpanded);
			}
		} catch (error) {
			tasknotesLogger.error("[TaskNotes][TaskListView] Failed to toggle subtasks", {
				category: "persistence",
				operation: "toggle-subtasks",
				error: error,
			});
			new Notice("Failed to toggle subtasks");
		}
	}

	private async toggleBlockingTasks(task: TaskInfo, target: HTMLElement): Promise<void> {
		try {
			const expanded = target.classList.toggle("task-card__blocking-toggle--expanded");

			// Find the card element and toggle blocking tasks display
			const card = target.closest<HTMLElement>(".task-card");
			if (card) {
				const { toggleBlockingTasks } = await import("../ui/TaskCard");
				await toggleBlockingTasks(card, task, this.plugin, expanded);
			}
		} catch (error) {
			tasknotesLogger.error("[TaskNotes][TaskListView] Failed to toggle blocking tasks", {
				category: "persistence",
				operation: "toggle-blocking-tasks",
				error: error,
			});
			new Notice("Failed to toggle blocking tasks");
		}
	}

	private arePathArraysEqual(taskNotes: TaskInfo[], previousPaths: string[]): boolean {
		if (taskNotes.length !== previousPaths.length) return false;
		for (let i = 0; i < taskNotes.length; i++) {
			if (taskNotes[i].path !== previousPaths[i]) return false;
		}
		return true;
	}

	private cleanupNonVirtualRendering(): void {
		this.itemsContainer?.empty();
		this.currentTaskElements.clear();
		this.clearClickTimeouts();
	}

	private destroyVirtualScroller(): void {
		if (this.virtualScroller) {
			this.virtualScroller.destroy();
			this.virtualScroller = null;
		}
		this.lastVirtualItems = [];
	}

	private resetVirtualScrollerIfCardRenderChanged(cardRenderSignature: string): void {
		if (
			this.virtualScroller &&
			this.lastCardRenderSignature !== "" &&
			this.lastCardRenderSignature !== cardRenderSignature
		) {
			this.destroyVirtualScroller();
		}
	}

	private buildTaskSignature(task: TaskInfo, visibleProperties: string[] = []): string {
		// Snapshot task data, not just a hand-maintained subset: badges and controls
		// also depend on fields that may not be selected as visible properties.
		// Raw Bases entries are live objects (and can be circular); resolve only
		// displayed values through the same accessor used by task cards instead,
		// then normalize any Bases Values those accessors return.
		return JSON.stringify(
			normalizeTaskSignatureValue({
				task: { ...task, basesData: undefined },
				visibleValues: visibleProperties.map((property) =>
					getTaskCardPropertyValue(task, property, this.plugin)
				),
			})
		);
	}

	private buildCardRenderSignature(
		visibleProperties: string[] | undefined,
		cardOptions: TaskCardOptions
	): string {
		const propertyLabels = cardOptions.propertyLabels
			? Object.entries(cardOptions.propertyLabels).sort(([left], [right]) =>
					left.localeCompare(right)
				)
			: [];
		return JSON.stringify({
			visibleProperties: visibleProperties ?? null,
			propertyLabels,
			expandedRelationshipFilterMode: cardOptions.expandedRelationshipFilterMode ?? null,
			targetDate: cardOptions.targetDate?.toISOString().slice(0, 10) ?? null,
		});
	}
}

/**
 * Factory function for Bases registration.
 * Returns an actual TaskListView instance adapted to the BasesView factory type.
 */
export function buildTaskListViewFactory(plugin: TaskNotesPlugin): BasesViewFactory {
	return function (controller: unknown, containerEl: HTMLElement): BasesView {
		if (!containerEl) {
			tasknotesLogger.error("[TaskNotes][TaskListView] No containerEl provided", {
				category: "stale-data",
				operation: "no-containerel-provided",
			});
			throw new Error("TaskListView requires a containerEl");
		}

		// Create and return the view instance directly; Bases assigns runtime view fields.
		return new TaskListView(controller, containerEl, plugin) as unknown as BasesView;
	};
}

/* eslint-enable @typescript-eslint/no-non-null-assertion -- Re-enable after the legacy view implementation. */
