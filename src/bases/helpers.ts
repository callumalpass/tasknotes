import TaskNotesPlugin from "../main";
import { Reminder, TaskDependency, TaskInfo, TimeEntry } from "../types";
import { setIcon } from "obsidian";
import { calculateTotalTimeSpent } from "../utils/helpers";
import { format } from "date-fns";
import { convertInternalToUserProperties } from "../utils/propertyMapping";
import { DEFAULT_INTERNAL_VISIBLE_PROPERTIES } from "../settings/defaults";
import type { TaskCardOptions } from "../ui/TaskCard";
import { PropertyMappingService } from "./PropertyMappingService";
import { normalizeDependencyList } from "../utils/dependencyUtils";
import { stringifyUnknown, stringifyUnknownArray } from "../utils/stringUtils";

export interface BasesDataItem {
	key?: string;
	data?: unknown;
	file?: unknown;
	path?: string;
	properties?: Record<string, unknown>;
	frontmatter?: Record<string, unknown>;
	name?: string;
	basesData?: unknown; // Raw Bases data for formula computation
}

type BasesDisplayProperty = {
	getDisplayName?: () => string;
};

type BasesQueryLike = {
	properties?: Record<string, BasesDisplayProperty>;
	getViewConfig?: (key: string) => string[] | undefined;
};

type BasesConfigLike = {
	getOrder?: () => string[];
};

type BasesControllerLike = {
	query?: BasesQueryLike;
	config?: BasesConfigLike;
	getViewConfig?: () => {
		order?: string[];
		columns?: { order?: string[] };
	};
};

type BasesContainerLike = {
	controller?: BasesControllerLike;
	query?: BasesQueryLike;
	config?: BasesConfigLike;
	data?: {
		groupedData?: BasesGroupData[];
	};
};

type BasesGroupData = {
	key?: {
		date?: Date;
		data?: unknown;
	};
	entries?: Array<{
		file?: {
			path?: string;
		};
	}>;
};

function toStringArray(value: unknown): string[] | undefined {
	if (value === undefined || value === null) return undefined;
	return stringifyUnknownArray(value);
}

function toOptionalString(value: unknown): string | undefined {
	if (value === undefined || value === null) return undefined;
	return stringifyUnknown(value);
}

function toOptionalNumber(value: unknown): number | undefined {
	if (typeof value === "number") return value;
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		return Number.isNaN(parsed) ? undefined : parsed;
	}
	return undefined;
}

function toTimeEntries(value: unknown): TimeEntry[] | undefined {
	return Array.isArray(value) ? (value as TimeEntry[]) : undefined;
}

function toReminders(value: unknown): Reminder[] | undefined {
	return Array.isArray(value) ? (value as Reminder[]) : undefined;
}

function toDependencies(value: unknown): TaskDependency[] | undefined {
	return value === undefined ? undefined : normalizeDependencyList(value);
}

/**
 * Map Bases property IDs to TaskCard-compatible property names.
 *
 * DEPRECATED: This function delegates to PropertyMappingService for consistency.
 * New code should use PropertyMappingService.basesToTaskCardProperty() directly.
 *
 * Handles various Bases property naming conventions:
 * - Custom field mappings (frontmatter property names preserved)
 * - Dotted prefixes (task.*, note.*, file.*)
 * - Special transformations (timeEntries → totalTrackedTime, blockedBy → blocked)
 * - Formula properties (formula.NAME)
 *
 * @param propId - The property ID from Bases (e.g., "note.complete_instances", "task.due")
 * @param plugin - TaskNotes plugin instance for FieldMapper access
 * @returns TaskCard property ID suitable for rendering
 */
export function mapBasesPropertyToTaskCardProperty(
	propId: string,
	plugin?: TaskNotesPlugin
): string {
	// Delegate to PropertyMappingService if available (preferred path)
	if (plugin) {
		const mapper = new PropertyMappingService(plugin, plugin.fieldMapper);
		return mapper.basesToTaskCardProperty(propId);
	}

	// Fallback for when no plugin is available (shouldn't happen in practice)
	return applySpecialTransformations(propId);
}

/**
 * Apply special property transformations for TaskCard rendering.
 *
 * Transformations:
 * - timeEntries → totalTrackedTime (show computed total instead of raw array)
 * - blockedBy → blocked (show status pill instead of dependency list)
 * - file.tasks/formula.checklistProgress → checklistProgress
 * - All other properties pass through unchanged
 */
function applySpecialTransformations(propId: string): string {
	if (propId === "timeEntries") return "totalTrackedTime";
	if (propId === "blockedBy") return "blocked";
	if (propId === "file.tasks") return "checklistProgress";
	if (propId === "formula.checklistProgress") return "checklistProgress";
	return propId;
}

/**
 * Create TaskInfo object from a single Bases data item
 */
function createTaskInfoFromProperties(
	props: Record<string, unknown>,
	basesItem: BasesDataItem,
	plugin?: TaskNotesPlugin
): TaskInfo {
	const knownProperties = new Set([
		"title",
		"status",
		"priority",
		"archived",
		"due",
		"scheduled",
		"contexts",
		"projects",
		"tags",
		"timeEstimate",
		"completedDate",
		"recurrence",
		"dateCreated",
		"dateModified",
		"timeEntries",
		"reminders",
		"icsEventId",
		"complete_instances",
		"skipped_instances",
		"blockedBy",
		"blocking",
		"sortOrder",
		// Prevent double-nesting: when this function is called with a Partial<TaskInfo>
		// that already has customProperties populated (e.g. from mapFromFrontmatter),
		// we must not re-classify it as an unknown property.
		"customProperties",
	]);

	const customProperties: Record<string, unknown> = {};
	Object.keys(props).forEach((key) => {
		if (!knownProperties.has(key)) {
			customProperties[key] = props[key];
		}
	});

	const timeEntries = toTimeEntries(props.timeEntries);
	const totalTrackedTime = timeEntries ? calculateTotalTimeSpent(timeEntries) : 0;

	// Get dependency information from DependencyCache if plugin is available
	let isBlocked = false;
	let blockingTasks: string[] = [];
	let isBlocking = false;
	if (plugin?.dependencyCache && basesItem.path) {
		// Use DependencyCache for status-aware blocking check
		isBlocked = plugin.dependencyCache.isTaskBlocked(basesItem.path);
		blockingTasks = plugin.dependencyCache.getBlockedTaskPaths(basesItem.path);
		isBlocking = blockingTasks.length > 0;
	} else {
		// Fallback when plugin not available: use simple existence check
		isBlocked = Array.isArray(props.blockedBy) && props.blockedBy.length > 0;
	}

	return {
		title:
			toOptionalString(props.title) ||
			basesItem.name ||
			basesItem.path?.split("/").pop()?.replace(".md", "") ||
			"Untitled",
		status: toOptionalString(props.status) || plugin?.settings?.defaultTaskStatus || "open",
		priority: toOptionalString(props.priority) || "normal",
		path: basesItem.path || "",
		archived: props.archived === true,
		due: toOptionalString(props.due),
		scheduled: toOptionalString(props.scheduled),
		contexts: toStringArray(props.contexts),
		projects: toStringArray(props.projects),
		tags: toStringArray(props.tags),
		timeEstimate: toOptionalNumber(props.timeEstimate),
		completedDate: toOptionalString(props.completedDate),
		recurrence: toOptionalString(props.recurrence),
		dateCreated: toOptionalString(props.dateCreated),
		dateModified: toOptionalString(props.dateModified),
		timeEntries,
		totalTrackedTime: totalTrackedTime,
		reminders: toReminders(props.reminders),
		icsEventId: toStringArray(props.icsEventId),
		complete_instances: toStringArray(props.complete_instances),
		skipped_instances: toStringArray(props.skipped_instances),
		blockedBy: toDependencies(props.blockedBy),
		blocking: blockingTasks.length > 0 ? blockingTasks : undefined,
		isBlocked: isBlocked,
		isBlocking: isBlocking,
		sortOrder: toOptionalString(props.sortOrder),
		customProperties: Object.keys(customProperties).length > 0 ? customProperties : undefined,
		basesData: basesItem.basesData,
	};
}

export function createTaskInfoFromBasesData(
	basesItem: BasesDataItem,
	plugin?: TaskNotesPlugin
): TaskInfo | null {
	if (!basesItem?.path) return null;

	const props = basesItem.properties || basesItem.frontmatter || {};

	if (plugin?.fieldMapper) {
		const mappedTaskInfo = plugin.fieldMapper.mapFromFrontmatter(
			props,
			basesItem.path,
			plugin.settings.storeTitleInFilename
		);
		const taskInfo = createTaskInfoFromProperties(mappedTaskInfo, basesItem, plugin);

		// Preserve file.* properties from original props (they won't be in mappedTaskInfo)
		const fileProperties: Record<string, unknown> = {};
		Object.keys(props).forEach((key) => {
			if (key.startsWith("file.")) {
				fileProperties[key] = props[key];
			}
		});

		// Merge file properties with existing custom properties
		return {
			...taskInfo,
			customProperties: {
				...mappedTaskInfo.customProperties,
				...taskInfo.customProperties,
				...fileProperties,
			},
		};
	} else {
		return createTaskInfoFromProperties(props, basesItem, plugin);
	}
}

/**
 * Identify TaskNotes from Bases data by converting all items to TaskInfo
 */
export async function identifyTaskNotesFromBasesData(
	dataItems: BasesDataItem[],
	plugin?: TaskNotesPlugin,
	toTaskInfo?: (item: BasesDataItem, plugin?: TaskNotesPlugin) => TaskInfo | null
): Promise<TaskInfo[]> {
	const taskInfoConverter = toTaskInfo || createTaskInfoFromBasesData;
	const taskNotes: TaskInfo[] = [];
	for (const item of dataItems) {
		if (!item?.path) continue;
		try {
			const taskInfo = taskInfoConverter(item, plugin);
			if (taskInfo) taskNotes.push(taskInfo);
		} catch (error) {
			console.warn("[TaskNotes][BasesPOC] Error converting Bases item to TaskInfo:", error);
		}
	}
	return taskNotes;
}

/**
 * Render TaskNotes using TaskCard component into a container
 */
interface BasesSelectedProperty {
	id: string;
	displayName: string;
	visible: boolean;
}

function buildTaskCardPropertyLabels(
	basesVisibleProperties: BasesSelectedProperty[],
	plugin: TaskNotesPlugin
): NonNullable<TaskCardOptions["propertyLabels"]> {
	const labels: NonNullable<TaskCardOptions["propertyLabels"]> = {};

	for (const property of basesVisibleProperties) {
		const displayName = property.displayName?.trim();
		if (!displayName) {
			continue;
		}

		const taskCardPropertyId = mapBasesPropertyToTaskCardProperty(property.id, plugin);
		if (taskCardPropertyId) {
			labels[taskCardPropertyId] = displayName;
		}
	}

	return labels;
}

export function getBasesVisibleProperties(basesContainer: unknown): BasesSelectedProperty[] {
	try {
		const viewContext = basesContainer as BasesContainerLike | undefined;
		const controller = viewContext?.controller ?? (basesContainer as BasesControllerLike);
		const query = viewContext?.query ?? controller?.query;

		if (!controller) {
			return [];
		}

		// Build index from available properties
		const propsMap = query?.properties;
		const idIndex = new Map<string, string>();

		if (propsMap && typeof propsMap === "object") {
			for (const id of Object.keys(propsMap)) {
				idIndex.set(id, id);
				const last = id.includes(".") ? id.split(".").pop() || id : id;
				idIndex.set(last, id);
				const dn = propsMap[id]?.getDisplayName?.();
				if (typeof dn === "string" && dn.trim()) idIndex.set(dn.toLowerCase(), id);
			}
		}

		const normalizeToId = (token: string): string | undefined => {
			if (!token) return undefined;
			return idIndex.get(token) || idIndex.get(token.toLowerCase()) || token;
		};

		// Get visible properties from Bases order configuration
		// Priority: Public API (1.10.0+) first, then fallback to internal API
		let order: string[] | undefined;

		// Try public API first (viewContext.config.getOrder())
		const config = viewContext?.config ?? controller?.config;
		if (config && typeof config.getOrder === "function") {
			try {
				order = config.getOrder();
			} catch {
				// Fall back to internal config below.
			}
		}

		// Fallback to internal API if public API didn't work
		if (!order || !Array.isArray(order) || order.length === 0) {
			const fullCfg = controller?.getViewConfig?.() ?? {};
			try {
				order =
					query?.getViewConfig?.("order") ??
					fullCfg.order ??
					fullCfg.columns?.order;
			} catch {
				order = fullCfg.order ?? fullCfg.columns?.order;
			}
		}

		if (!order || !Array.isArray(order) || order.length === 0) {
			return [];
		}

		const orderedIds: string[] = order.map(normalizeToId).filter((id): id is string => !!id);

		return orderedIds.map((id) => {
			// Get display name from query properties
			const displayName = propsMap?.[id]?.getDisplayName?.() ?? id;

			return {
				id,
				displayName,
				visible: true,
			};
		});
	} catch {
		return [];
	}
}

export async function renderTaskNotesInBasesView(
	container: HTMLElement,
	taskNotes: TaskInfo[],
	plugin: TaskNotesPlugin,
	basesContainer?: unknown,
	taskElementsMap?: Map<string, HTMLElement>,
	precomputedVisibleProperties?: string[],
	precomputedCardOptions?: Partial<TaskCardOptions>
): Promise<void> {
	const { createTaskCard } = await import("../ui/TaskCard");

	// Use container's document for pop-out window support
	const doc = container.ownerDocument;
	const taskListEl = doc.createElement("div");
	taskListEl.className = "tn-bases-tasknotes-list";
	taskListEl.classList.remove(
		"tn-static-display-block-2a1b75c9",
		"tn-static-display-flex-4d51fc62",
		"tn-static-display-flex-75816cae",
		"tn-static-display-inline-block-60e32dcb",
		"tn-static-display-inline-cccfa456",
		"tn-static-display-inline-flex-f984c520",
		"tn-static-display-none-6b99de8b",
		"tn-static-flex-direction-column-06c8b5ed",
		"tn-static-gap-0-5rem-ce2fca4d",
		"tn-static-gap-10px-f3d7ce77",
		"tn-static-gap-12px-ed7b3d87",
		"tn-static-gap-6px-f0abc1db",
		"tn-static-gap-8px-33fcd4c3",
		"tn-static-min-height-800px-997b4c8c"
	);
	taskListEl.classList.add("tn-static-display-flex-8bb39979");
	container.appendChild(taskListEl);

	// Get visible properties from Bases
	let visibleProperties: string[] | undefined = precomputedVisibleProperties;
	let cardOptions: Partial<TaskCardOptions> = precomputedCardOptions || {};

	// Only extract properties if not precomputed
	if (!visibleProperties && basesContainer) {
		const basesVisibleProperties = getBasesVisibleProperties(basesContainer);

		if (basesVisibleProperties.length > 0) {
			cardOptions = {
				...cardOptions,
				propertyLabels: buildTaskCardPropertyLabels(basesVisibleProperties, plugin),
			};

			// Extract just the property IDs for TaskCard
			visibleProperties = basesVisibleProperties.map((p) => p.id);

			// Map Bases property IDs to TaskCard-compatible property names
			const hasBlockedByRequested = basesVisibleProperties.some(
				(p) =>
					p.id === "blockedBy" || p.id === "note.blockedBy" || p.id === "task.blockedBy"
			);

			visibleProperties = visibleProperties
				.map((propId) => {
					const mapped = mapBasesPropertyToTaskCardProperty(propId, plugin);
					return mapped;
				})
				// Filter out computed dependency properties unless explicitly requested via blockedBy
				.filter((propId) => {
					if (propId === "blocked" || propId === "blocking") {
						const keep = hasBlockedByRequested;
						return keep;
					}
					return true;
				});
		}
	}

	// Use plugin default properties if no Bases properties available
	if (!visibleProperties || visibleProperties.length === 0) {
		const internalDefaults = plugin.settings.defaultVisibleProperties || [
			...DEFAULT_INTERNAL_VISIBLE_PROPERTIES,
			"tags",
		];
		// Convert internal field names to user-configured property names
		visibleProperties = convertInternalToUserProperties(internalDefaults, plugin);

		// Filter out blocked/blocking from defaults since they're computed properties
		// that should only show when explicitly requested via blockedBy
		visibleProperties = visibleProperties.filter((p) => p !== "blocked" && p !== "blocking");
	}

	for (const taskInfo of taskNotes) {
		try {
			// Pass current date as targetDate for proper recurring task completion styling
			const cardOptionsWithDate = {
				...cardOptions,
				targetDate: new Date(),
			};
			const taskCard = createTaskCard(
				taskInfo,
				plugin,
				visibleProperties,
				cardOptionsWithDate
			);
			taskListEl.appendChild(taskCard);

			// Track task elements for selective updates
			if (taskElementsMap && taskInfo.path) {
				taskElementsMap.set(taskInfo.path, taskCard);
			}
		} catch (error) {
			console.warn("[TaskNotes][BasesPOC] Error creating task card:", error);
		}
	}
}

/**
 * Render grouped TaskNotes in Bases list view
 * Uses grouped data from Bases API (public API 1.10.0+)
 */
export async function renderGroupedTasksInBasesView(
	container: HTMLElement,
	taskNotes: TaskInfo[],
	plugin: TaskNotesPlugin,
	viewContext: unknown,
	pathToProps: Map<string, Record<string, unknown>>,
	taskElementsMap?: Map<string, HTMLElement>
): Promise<void> {
	const { createTaskCard } = await import("../ui/TaskCard");

	// Clear container and tracking map
	container.innerHTML = "";
	if (taskElementsMap) {
		taskElementsMap.clear();
	}

	// Get visible properties from Bases FIRST (needed for both grouped and ungrouped rendering)
	const basesVisibleProperties = getBasesVisibleProperties(viewContext);
	let visibleProperties: string[] | undefined;
	let cardOptions: Partial<TaskCardOptions> = {
		targetDate: new Date(),
	};

	if (basesVisibleProperties.length > 0) {
		cardOptions = {
			...cardOptions,
			propertyLabels: buildTaskCardPropertyLabels(basesVisibleProperties, plugin),
		};

		visibleProperties = basesVisibleProperties.map((p) => p.id);

		// Map Bases property IDs to TaskCard-compatible property names
		const hasBlockedByRequested = basesVisibleProperties.some(
			(p) => p.id === "blockedBy" || p.id === "note.blockedBy" || p.id === "task.blockedBy"
		);

		visibleProperties = visibleProperties
			.map((propId) => {
				const mapped = mapBasesPropertyToTaskCardProperty(propId, plugin);
				return mapped;
			})
			// Filter out computed dependency properties unless explicitly requested via blockedBy
			.filter((propId) => {
				if (propId === "blocked" || propId === "blocking") {
					const keep = hasBlockedByRequested;
					return keep;
				}
				return true;
			});
	}

	// Use plugin default properties if no Bases properties available
	if (!visibleProperties || visibleProperties.length === 0) {
		const internalDefaults = plugin.settings.defaultVisibleProperties || [
			...DEFAULT_INTERNAL_VISIBLE_PROPERTIES,
			"tags",
		];
		// Convert internal field names to user-configured property names
		visibleProperties = convertInternalToUserProperties(internalDefaults, plugin);

		// Filter out blocked/blocking from defaults since they're computed properties
		// that should only show when explicitly requested via blockedBy
		visibleProperties = visibleProperties.filter((p) => p !== "blocked" && p !== "blocking");
	}

	// Get groupedData from public API
	const groupedData = (viewContext as BasesContainerLike | undefined)?.data?.groupedData;
	if (!Array.isArray(groupedData) || groupedData.length === 0) {
		// No groups, fall back to flat rendering (pass precomputed properties)
		await renderTaskNotesInBasesView(
			container,
			taskNotes,
			plugin,
			viewContext,
			taskElementsMap,
			visibleProperties,
			cardOptions
		);
		return;
	}

	// Check if this is actually ungrouped (single group with null/undefined/empty key)
	if (groupedData.length === 1) {
		const singleGroup = groupedData[0];
		const groupKey = singleGroup.key?.data;
		const groupKeyStr = String(groupKey);
		// If the key is null, undefined, empty string, or "Unknown", treat as ungrouped
		if (
			groupKey === null ||
			groupKey === undefined ||
			groupKey === "" ||
			groupKeyStr === "null" ||
			groupKeyStr === "undefined" ||
			groupKeyStr === "Unknown"
		) {
			// Render as flat list without group headers (pass precomputed properties)
			await renderTaskNotesInBasesView(
				container,
				taskNotes,
				plugin,
				viewContext,
				taskElementsMap,
				visibleProperties,
				cardOptions
			);
			return;
		}
	}

	// Use container's document for pop-out window support
	const doc = container.ownerDocument;

	// Create wrapper with proper class for CSS styling
	const listWrapper = doc.createElement("div");
	listWrapper.className = "tn-bases-tasknotes-list";
	container.appendChild(listWrapper);

	// Create a map from file path to TaskInfo for quick lookup
	const tasksByPath = new Map<string, TaskInfo>();
	taskNotes.forEach((task) => {
		if (task.path) {
			tasksByPath.set(task.path, task);
		}
	});

	// Render each group
	for (const group of groupedData) {
		// Extract value from Bases Value object
		// Bases returns different structures: { date: Date } for date properties, { data: value } for others
		const keyObj = group.key;
		let groupKey: unknown;

		// Try to extract the actual value from the Bases Value object
		if (keyObj?.date instanceof Date) {
			// Date property - use the date field
			groupKey = keyObj.date;
		} else if (keyObj?.data !== undefined) {
			// Other properties - use the data field
			groupKey = keyObj.data;
		} else {
			// Fallback for unknown structures
			groupKey = keyObj || "Unknown";
		}

		// Format group name properly - handle Date objects for date-based grouping
		let groupName: string;
		if (groupKey instanceof Date) {
			// Format dates as YYYY-MM-DD for consistency with TaskNotes date handling
			// Note: Bases returns local Date objects, but we format to YYYY-MM-DD which represents
			// the calendar date the user sees. This is intentional - group headers should show
			// the date as the user perceives it (e.g., "2025-06-10" for June 10th in their timezone)
			groupName = format(groupKey, "yyyy-MM-dd");
		} else if (groupKey === null || groupKey === undefined || groupKey === "") {
			groupName = "None";
		} else {
			groupName = stringifyUnknown(groupKey) || "None";
		}
		const groupEntries = group.entries || [];

		if (groupEntries.length === 0) continue;

		// Create group section
		const groupSection = doc.createElement("div");
		groupSection.className = "task-section task-group";
		groupSection.setAttribute("data-group", groupName);
		listWrapper.appendChild(groupSection);

		// Create group header
		const headerElement = doc.createElement("h3");
		headerElement.className = "task-group-header task-list-view__group-header";
		groupSection.appendChild(headerElement);

		// Add toggle button (chevron)
		const toggleBtn = doc.createElement("button");
		toggleBtn.className = "task-group-toggle";
		toggleBtn.type = "button";
		toggleBtn.setAttribute("aria-label", "Toggle group");
		toggleBtn.setAttribute("aria-expanded", "true");
		headerElement.appendChild(toggleBtn);

		// Add chevron icon
		setIcon(toggleBtn, "chevron-right");

		const svg = toggleBtn.querySelector("svg");
		if (svg) {
			svg.classList.add("chevron");
			svg.setAttribute("width", "16");
			svg.setAttribute("height", "16");
		}

		// Format group name and add count
		const displayName = groupName === "null" || groupName === "undefined" ? "None" : groupName;
		headerElement.createSpan({ text: displayName });

		// Add count
		headerElement.createSpan({
			text: ` (${groupEntries.length})`,
			cls: "agenda-view__item-count",
		});

		// Create task cards container BEFORE adding click handler
		const taskCardsContainer = doc.createElement("div");
		taskCardsContainer.className = "tasks-container task-cards";
		groupSection.appendChild(taskCardsContainer);

		// Add click handler for toggle
		headerElement.addEventListener("click", (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			// Don't toggle if clicking on a link
			if (target.closest("a")) return;

			e.preventDefault();
			e.stopPropagation();

			const isCollapsed = groupSection.classList.toggle("is-collapsed");
			toggleBtn.setAttribute("aria-expanded", String(!isCollapsed));

			// Toggle task cards visibility
			if (isCollapsed) {
				taskCardsContainer.classList.remove(
					"tn-static-display-block-2a1b75c9",
					"tn-static-display-flex-4d51fc62",
					"tn-static-display-flex-75816cae",
					"tn-static-display-flex-8bb39979",
					"tn-static-display-inline-block-60e32dcb",
					"tn-static-display-inline-cccfa456",
					"tn-static-display-inline-flex-f984c520",
					"tn-static-min-height-800px-997b4c8c"
				);
				taskCardsContainer.classList.add("tn-static-display-none-6b99de8b");
			} else {
				taskCardsContainer.classList.remove(
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
				taskCardsContainer.style.removeProperty("display");
			}
		});

		// Collect TaskInfo for this group
		const groupTasks: TaskInfo[] = [];
		for (const entry of groupEntries) {
			const filePath = entry.file?.path;
			if (filePath) {
				const task = tasksByPath.get(filePath);
				if (task) {
					groupTasks.push(task);
				}
			}
		}

		// Note: groupTasks preserve order from Bases grouped data
		// No manual sorting needed - Bases provides pre-sorted data within groups

		// Render tasks in this group
		for (const task of groupTasks) {
			try {
				const taskCard = createTaskCard(task, plugin, visibleProperties, cardOptions);
				taskCardsContainer.appendChild(taskCard);

				// Track task elements for selective updates
				if (taskElementsMap && task.path) {
					taskElementsMap.set(task.path, taskCard);
				}
			} catch (error) {
				console.warn("[TaskNotes][Bases] Error creating task card:", error);
			}
		}
	}
}

/**
 * Render a raw Bases data item for debugging/inspection
 */
export function renderBasesDataItem(
	container: HTMLElement,
	item: BasesDataItem,
	index: number
): void {
	// Use container's document for pop-out window support
	const doc = container.ownerDocument;
	const itemEl = doc.createElement("div");
	itemEl.className = "tn-bases-data-item";
	itemEl.classList.remove(
		"tn-static-border-1px-solid-var-background-mo-b65b5121",
		"tn-static-border-none-2eda1daa",
		"tn-static-border-radius-4px-c290c56e",
		"tn-static-border-radius-6px-0dc8408c",
		"tn-static-margin-0-11696618",
		"tn-static-margin-0-auto-266e9b04",
		"tn-static-margin-0-db0d5f36",
		"tn-static-margin-0-var-size-4-2-77f7dc08",
		"tn-static-margin-2px-0-edce9b14",
		"tn-static-margin-8px-0-0-0-a2eb8382",
		"tn-static-padding-0-16px-16px-16px-f1aa998c",
		"tn-static-padding-0-41d7d7e2",
		"tn-static-padding-16px-287f770e",
		"tn-static-padding-20px-769fed37",
		"tn-static-padding-20px-7a035d95",
		"tn-static-padding-20px-ebe8e48c",
		"tn-static-padding-2px-8px-c8eea84a",
		"tn-static-padding-2rem-42aa6d9c"
	);
	itemEl.classList.add("tn-static-padding-12px-43bef435");

	const header = doc.createElement("div");
	header.classList.remove(
		"tn-static-color-var-color-accent-d2cad743",
		"tn-static-color-var-text-accent-65b47ee3",
		"tn-static-color-var-text-muted-5872de20",
		"tn-static-color-var-text-on-accent-f3e1679d",
		"tn-static-color-var-text-warning-783d5f03",
		"tn-static-color-var-tn-text-muted-a90fb6f3",
		"tn-static-color-white-0a43e56a",
		"tn-static-cursor-pointer-2723efcc",
		"tn-static-font-size-12px-65574819",
		"tn-static-font-weight-500-02a2d333",
		"tn-static-font-weight-600-eed0f8fb",
		"tn-static-font-weight-bold-0fe8c30d",
		"tn-static-margin-2px-0-edce9b14",
		"tn-static-margin-bottom-0-75rem-c05a3c6e",
		"tn-static-margin-bottom-20px-49f14f8f",
		"tn-static-margin-bottom-8px-fdf33f23",
		"tn-static-padding-20px-7a035d95",
		"tn-static-padding-20px-ebe8e48c"
	);
	header.classList.add("tn-static-font-weight-bold-e0b452bd");
	header.textContent = `Item ${index + 1}`;
	itemEl.appendChild(header);

	if (item.path) {
		const pathEl = doc.createElement("div");
		pathEl.classList.remove(
			"tn-static-color-var-color-accent-d2cad743",
			"tn-static-color-var-text-accent-65b47ee3",
			"tn-static-color-var-text-muted-5872de20",
			"tn-static-color-var-text-on-accent-f3e1679d",
			"tn-static-color-var-text-warning-783d5f03",
			"tn-static-color-var-tn-text-muted-a90fb6f3",
			"tn-static-color-white-0a43e56a",
			"tn-static-cursor-pointer-2723efcc",
			"tn-static-font-size-0-75em-948e16e5",
			"tn-static-font-size-0-8em-19dc7c13",
			"tn-static-font-size-0-9em-65025e95",
			"tn-static-font-size-1-2em-3a352995",
			"tn-static-font-size-12px-b0cc7e05",
			"tn-static-font-size-var-tn-font-size-sm-0274a31d",
			"tn-static-font-weight-bold-0fe8c30d",
			"tn-static-font-weight-bold-e0b452bd",
			"tn-static-margin-2px-0-edce9b14",
			"tn-static-margin-8px-0-0-0-a2eb8382",
			"tn-static-margin-bottom-0-75rem-c05a3c6e",
			"tn-static-margin-bottom-20px-49f14f8f",
			"tn-static-margin-bottom-8px-fdf33f23",
			"tn-static-margin-top-8px-f4f01e68",
			"tn-static-padding-20px-7a035d95",
			"tn-static-padding-20px-ebe8e48c"
		);
		pathEl.classList.add("tn-static-font-size-12px-65574819");
		pathEl.textContent = `Path: ${item.path}`;
		itemEl.appendChild(pathEl);
	}

	const props = item.properties;
	if (props && typeof props === "object") {
		const propsEl = doc.createElement("div");
		propsEl.classList.remove(
			"tn-static-font-size-0-75em-948e16e5",
			"tn-static-font-size-0-8em-19dc7c13",
			"tn-static-font-size-0-9em-65025e95",
			"tn-static-font-size-1-2em-3a352995",
			"tn-static-font-size-12px-65574819",
			"tn-static-font-size-var-tn-font-size-sm-0274a31d",
			"tn-static-margin-8px-0-0-0-a2eb8382",
			"tn-static-margin-top-0-5rem-3dc98b5e",
			"tn-static-margin-top-0-d462248a",
			"tn-static-margin-top-12px-91e0f558",
			"tn-static-margin-top-16px-1b0f4999",
			"tn-static-margin-top-1rem-2239d6d5",
			"tn-static-margin-top-20px-a26bda7d",
			"tn-static-margin-top-30px-2fbbbcd4",
			"tn-static-margin-top-4px-96ad6099",
			"tn-static-margin-top-8px-8a77e5a3",
			"tn-static-margin-top-8px-f4f01e68"
		);
		propsEl.classList.add("tn-static-font-size-12px-b0cc7e05");

		const propsHeader = doc.createElement("div");
		propsHeader.classList.remove(
			"tn-static-color-var-color-accent-d2cad743",
			"tn-static-color-var-text-accent-65b47ee3",
			"tn-static-color-var-text-muted-5872de20",
			"tn-static-color-var-text-on-accent-f3e1679d",
			"tn-static-color-var-text-warning-783d5f03",
			"tn-static-color-var-tn-text-muted-a90fb6f3",
			"tn-static-color-white-0a43e56a",
			"tn-static-cursor-pointer-2723efcc",
			"tn-static-font-size-12px-65574819",
			"tn-static-font-weight-500-02a2d333",
			"tn-static-font-weight-600-eed0f8fb",
			"tn-static-font-weight-bold-e0b452bd",
			"tn-static-margin-2px-0-edce9b14",
			"tn-static-margin-bottom-0-75rem-c05a3c6e",
			"tn-static-margin-bottom-20px-49f14f8f",
			"tn-static-margin-bottom-8px-fdf33f23",
			"tn-static-padding-20px-7a035d95",
			"tn-static-padding-20px-ebe8e48c"
		);
		propsHeader.classList.add("tn-static-font-weight-bold-0fe8c30d");
		propsHeader.textContent = "Properties:";
		propsEl.appendChild(propsHeader);

		const propsList = doc.createElement("ul");
		propsList.classList.remove(
			"tn-static-margin-0-11696618",
			"tn-static-margin-0-auto-266e9b04",
			"tn-static-margin-0-var-size-4-2-77f7dc08",
			"tn-static-margin-2px-0-edce9b14",
			"tn-static-margin-8px-0-0-0-a2eb8382",
			"tn-static-padding-12px-43bef435",
			"tn-static-padding-20px-ebe8e48c"
		);
		propsList.classList.add("tn-static-margin-0-db0d5f36");

		Object.entries(props).forEach(([key, value]) => {
			const li = doc.createElement("li");
			li.classList.remove(
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
				"tn-static-margin-8px-0-0-0-a2eb8382",
				"tn-static-padding-12px-43bef435",
				"tn-static-padding-20px-7a035d95",
				"tn-static-padding-20px-ebe8e48c"
			);
			li.classList.add("tn-static-margin-2px-0-edce9b14");
			li.textContent = `${key}: ${JSON.stringify(value)}`;
			propsList.appendChild(li);
		});

		propsEl.appendChild(propsList);
		itemEl.appendChild(propsEl);
	}

	const rawDataEl = doc.createElement("details");
	rawDataEl.classList.remove(
		"tn-static-font-size-0-75em-948e16e5",
		"tn-static-font-size-0-8em-19dc7c13",
		"tn-static-font-size-0-9em-65025e95",
		"tn-static-font-size-1-2em-3a352995",
		"tn-static-font-size-12px-65574819",
		"tn-static-font-size-12px-b0cc7e05",
		"tn-static-font-size-var-tn-font-size-sm-0274a31d",
		"tn-static-margin-8px-0-0-0-a2eb8382",
		"tn-static-margin-top-0-5rem-3dc98b5e",
		"tn-static-margin-top-0-d462248a",
		"tn-static-margin-top-12px-91e0f558",
		"tn-static-margin-top-16px-1b0f4999",
		"tn-static-margin-top-1rem-2239d6d5",
		"tn-static-margin-top-20px-a26bda7d",
		"tn-static-margin-top-30px-2fbbbcd4",
		"tn-static-margin-top-4px-96ad6099",
		"tn-static-margin-top-8px-8a77e5a3"
	);
	rawDataEl.classList.add("tn-static-margin-top-8px-f4f01e68");

	const summary = doc.createElement("summary");
	summary.classList.remove(
		"tn-static-color-var-color-accent-d2cad743",
		"tn-static-color-var-text-accent-65b47ee3",
		"tn-static-color-var-text-muted-5872de20",
		"tn-static-color-var-text-on-accent-f3e1679d",
		"tn-static-color-var-text-warning-783d5f03",
		"tn-static-color-var-tn-text-muted-a90fb6f3",
		"tn-static-color-white-0a43e56a",
		"tn-static-cursor-grab-dad79857",
		"tn-static-cursor-pointer-3b6a3a65",
		"tn-static-font-size-12px-65574819",
		"tn-static-font-weight-500-02a2d333",
		"tn-static-font-weight-600-eed0f8fb",
		"tn-static-font-weight-bold-0fe8c30d",
		"tn-static-font-weight-bold-e0b452bd",
		"tn-static-margin-2px-0-edce9b14",
		"tn-static-padding-20px-7a035d95",
		"tn-static-padding-20px-ebe8e48c"
	);
	summary.classList.add("tn-static-cursor-pointer-2723efcc");
	summary.textContent = "Raw data structure";
	rawDataEl.appendChild(summary);

	const pre = doc.createElement("pre");
	pre.classList.remove(
		"tn-static-border-radius-4px-c290c56e",
		"tn-static-border-radius-6px-0dc8408c",
		"tn-static-font-size-0-75em-948e16e5",
		"tn-static-font-size-0-8em-19dc7c13",
		"tn-static-font-size-0-9em-65025e95",
		"tn-static-font-size-1-2em-3a352995",
		"tn-static-font-size-12px-65574819",
		"tn-static-font-size-12px-b0cc7e05",
		"tn-static-font-size-var-tn-font-size-sm-0274a31d",
		"tn-static-margin-0-11696618",
		"tn-static-margin-0-auto-266e9b04",
		"tn-static-margin-0-db0d5f36",
		"tn-static-margin-0-var-size-4-2-77f7dc08",
		"tn-static-margin-2px-0-edce9b14",
		"tn-static-margin-top-8px-f4f01e68",
		"tn-static-padding-0-16px-16px-16px-f1aa998c",
		"tn-static-padding-0-41d7d7e2",
		"tn-static-padding-12px-43bef435",
		"tn-static-padding-16px-287f770e",
		"tn-static-padding-20px-769fed37",
		"tn-static-padding-20px-7a035d95",
		"tn-static-padding-20px-ebe8e48c",
		"tn-static-padding-2px-8px-c8eea84a",
		"tn-static-padding-2rem-42aa6d9c"
	);
	pre.classList.add("tn-static-margin-8px-0-0-0-a2eb8382");
	pre.textContent = JSON.stringify(item, null, 2);
	rawDataEl.appendChild(pre);

	itemEl.appendChild(rawDataEl);
	container.appendChild(itemEl);
}
