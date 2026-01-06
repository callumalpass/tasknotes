/* eslint-disable no-console */
import TaskNotesPlugin from "../main";
import { TaskInfo } from "../types";
import { setIcon } from "obsidian";
import { calculateTotalTimeSpent } from "../utils/helpers";
import { format } from "date-fns";
import { convertInternalToUserProperties } from "../utils/propertyMapping";
import { DEFAULT_INTERNAL_VISIBLE_PROPERTIES } from "../settings/defaults";

export interface BasesDataItem {
	key?: string;
	data?: any;
	file?: { path?: string } | any;
	path?: string;
	properties?: Record<string, any>;
	frontmatter?: Record<string, any>;
	name?: string;
	basesData?: any; // Raw Bases data for formula computation
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
		// Import PropertyMappingService inline to avoid circular dependencies
		const { PropertyMappingService } = require("./PropertyMappingService");
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
 * - All other properties pass through unchanged
 */
function applySpecialTransformations(propId: string): string {
	if (propId === "timeEntries") return "totalTrackedTime";
	if (propId === "blockedBy") return "blocked";
	return propId;
}

/**
 * Create TaskInfo object from a single Bases data item
 */
function createTaskInfoFromProperties(
	props: Record<string, any>,
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
	]);

	const customProperties: Record<string, any> = {};
	Object.keys(props).forEach((key) => {
		if (!knownProperties.has(key)) {
			customProperties[key] = props[key];
		}
	});

	// Calculate total tracked time from time entries
	const totalTrackedTime = props.timeEntries
		? calculateTotalTimeSpent(props.timeEntries)
		: 0;

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
			props.title ||
			basesItem.name ||
			basesItem.path?.split("/").pop()?.replace(".md", "") ||
			"Untitled",
		status: props.status || "open",
		priority: props.priority || "normal",
		path: basesItem.path || "",
		archived: props.archived || false,
		due: props.due,
		scheduled: props.scheduled,
		contexts: Array.isArray(props.contexts)
			? props.contexts
			: props.contexts
				? [props.contexts]
				: undefined,
		projects: Array.isArray(props.projects)
			? props.projects
			: props.projects
				? [props.projects]
				: undefined,
		tags: Array.isArray(props.tags) ? props.tags : props.tags ? [props.tags] : undefined,
		timeEstimate: props.timeEstimate,
		completedDate: props.completedDate,
		recurrence: props.recurrence,
		dateCreated: props.dateCreated,
		dateModified: props.dateModified,
		timeEntries: props.timeEntries,
		totalTrackedTime: totalTrackedTime,
		reminders: props.reminders,
		icsEventId: props.icsEventId,
		complete_instances: props.complete_instances,
		skipped_instances: props.skipped_instances,
		blockedBy: props.blockedBy,
		blocking: blockingTasks.length > 0 ? blockingTasks : undefined,
		isBlocked: isBlocked,
		isBlocking: isBlocking,
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
		const fileProperties: Record<string, any> = {};
		Object.keys(props).forEach(key => {
			if (key.startsWith('file.')) {
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

export function getBasesVisibleProperties(basesContainer: any): BasesSelectedProperty[] {
	try {
		const controller = (basesContainer?.controller ?? basesContainer) as any;
		const query = (basesContainer?.query ?? controller?.query) as any;
		console.log("[TaskNotes][Bases] getBasesVisibleProperties - controller:", !!controller, "query:", !!query);

		if (!controller) {
			console.log("[TaskNotes][Bases] getBasesVisibleProperties - no controller, returning empty");
			return [];
		}

		// Build index from available properties
		const propsMap: Record<string, any> | undefined = query?.properties;
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
		const config = basesContainer?.config ?? controller?.config;
		if (config && typeof config.getOrder === "function") {
			try {
				order = config.getOrder();
				console.log("[TaskNotes][Bases] getBasesVisibleProperties - got order from config.getOrder():", order);
			} catch (e) {
				console.log("[TaskNotes][Bases] getBasesVisibleProperties - config.getOrder() failed:", e);
			}
		}

		// Fallback to internal API if public API didn't work
		if (!order || !Array.isArray(order) || order.length === 0) {
			const fullCfg = controller?.getViewConfig?.() ?? {};
			try {
				order =
					(query?.getViewConfig?.("order") as string[] | undefined) ??
					(fullCfg as any)?.order ??
					(fullCfg as any)?.columns?.order;
				if (order && Array.isArray(order) && order.length > 0) {
					console.log("[TaskNotes][Bases] getBasesVisibleProperties - got order from internal API:", order);
				}
			} catch (_) {
				order = (fullCfg as any)?.order ?? (fullCfg as any)?.columns?.order;
			}
		}

		if (!order || !Array.isArray(order) || order.length === 0) {
			console.log("[TaskNotes][Bases] getBasesVisibleProperties - no order found, returning empty. order:", order);
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
	} catch (e) {
		console.log("[TaskNotes][Bases] getBasesVisibleProperties failed:", e);
		return [];
	}
}

export async function renderTaskNotesInBasesView(
	container: HTMLElement,
	taskNotes: TaskInfo[],
	plugin: TaskNotesPlugin,
	basesContainer?: any,
	taskElementsMap?: Map<string, HTMLElement>,
	precomputedVisibleProperties?: string[]
): Promise<void> {
	console.log("[TaskNotes][Bases] renderTaskNotesInBasesView ENTRY - tasks:", taskNotes.length, "basesContainer:", !!basesContainer, "precomputed props:", precomputedVisibleProperties?.length);
	const { createTaskCard } = await import("../ui/TaskCard");

	// Use container's document for pop-out window support
	const doc = container.ownerDocument;
	const taskListEl = doc.createElement("div");
	taskListEl.className = "tn-bases-tasknotes-list";
	taskListEl.style.cssText = "display: flex; flex-direction: column; gap: 1px;";
	container.appendChild(taskListEl);

	// Get visible properties from Bases
	let visibleProperties: string[] | undefined = precomputedVisibleProperties;
	let cardOptions = {};

	// Only extract properties if not precomputed
	if (!visibleProperties && basesContainer) {
		console.log("[TaskNotes][Bases] basesContainer type:", typeof basesContainer, "keys:", basesContainer ? Object.keys(basesContainer).slice(0, 10) : []);
		const basesVisibleProperties = getBasesVisibleProperties(basesContainer);
		console.log("[TaskNotes][Bases] getBasesVisibleProperties returned:", basesVisibleProperties.length, "properties");

		if (basesVisibleProperties.length > 0) {
			// Extract just the property IDs for TaskCard
			visibleProperties = basesVisibleProperties.map((p) => p.id);
			console.log("[TaskNotes][Bases] Raw property IDs from Bases:", visibleProperties);

			// Map Bases property IDs to TaskCard-compatible property names
			const hasBlockedByRequested = basesVisibleProperties.some(p =>
				p.id === "blockedBy" || p.id === "note.blockedBy" || p.id === "task.blockedBy"
			);
			console.log("[TaskNotes][Bases] hasBlockedByRequested:", hasBlockedByRequested);

			visibleProperties = visibleProperties
				.map((propId) => {
					const mapped = mapBasesPropertyToTaskCardProperty(propId, plugin);
					if (propId !== mapped) {
						console.log(`[TaskNotes][Bases] Mapped ${propId} → ${mapped}`);
					}
					return mapped;
				})
				// Filter out computed dependency properties unless explicitly requested via blockedBy
				.filter((propId) => {
					if (propId === "blocked" || propId === "blocking") {
						const keep = hasBlockedByRequested;
						console.log(`[TaskNotes][Bases] Filtering ${propId}: ${keep ? "KEEP" : "REMOVE"}`);
						return keep;
					}
					return true;
				});
			console.log("[TaskNotes][Bases] Final visible properties:", visibleProperties);
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
		console.log("[TaskNotes][Bases] Using default properties (filtered):", visibleProperties);
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
	viewContext: any,
	pathToProps: Map<string, Record<string, any>>,
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

	if (basesVisibleProperties.length > 0) {
		visibleProperties = basesVisibleProperties.map((p) => p.id);
		console.log("[TaskNotes][Bases][Grouped] Raw property IDs from Bases:", visibleProperties);

		// Map Bases property IDs to TaskCard-compatible property names
		const hasBlockedByRequested = basesVisibleProperties.some(p =>
			p.id === "blockedBy" || p.id === "note.blockedBy" || p.id === "task.blockedBy"
		);
		console.log("[TaskNotes][Bases][Grouped] hasBlockedByRequested:", hasBlockedByRequested);

		visibleProperties = visibleProperties
			.map((propId) => {
				const mapped = mapBasesPropertyToTaskCardProperty(propId, plugin);
				if (propId !== mapped) {
					console.log(`[TaskNotes][Bases][Grouped] Mapped ${propId} → ${mapped}`);
				}
				return mapped;
			})
			// Filter out computed dependency properties unless explicitly requested via blockedBy
			.filter((propId) => {
				if (propId === "blocked" || propId === "blocking") {
					const keep = hasBlockedByRequested;
					console.log(`[TaskNotes][Bases][Grouped] Filtering ${propId}: ${keep ? "KEEP" : "REMOVE"}`);
					return keep;
				}
				return true;
			});
		console.log("[TaskNotes][Bases][Grouped] Final visible properties:", visibleProperties);
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
		console.log("[TaskNotes][Bases] Using default properties (filtered):", visibleProperties);
	}

	// Get groupedData from public API
	const groupedData = viewContext?.data?.groupedData;
	if (!Array.isArray(groupedData) || groupedData.length === 0) {
		// No groups, fall back to flat rendering (pass precomputed properties)
		await renderTaskNotesInBasesView(container, taskNotes, plugin, viewContext, taskElementsMap, visibleProperties);
		return;
	}

	// Check if this is actually ungrouped (single group with null/undefined/empty key)
	if (groupedData.length === 1) {
		const singleGroup = groupedData[0];
		const groupKey = singleGroup.key?.data;
		const groupKeyStr = String(groupKey);
		// If the key is null, undefined, empty string, or "Unknown", treat as ungrouped
		if (groupKey === null || groupKey === undefined || groupKey === "" || groupKeyStr === "null" || groupKeyStr === "undefined" || groupKeyStr === "Unknown") {
			// Render as flat list without group headers (pass precomputed properties)
			await renderTaskNotesInBasesView(container, taskNotes, plugin, viewContext, taskElementsMap, visibleProperties);
			return;
		}
	}

	// Use container's document for pop-out window support
	const doc = container.ownerDocument;

	// Create wrapper with proper class for CSS styling
	const listWrapper = doc.createElement("div");
	listWrapper.className = "tn-bases-tasknotes-list";
	container.appendChild(listWrapper);

	const cardOptions = {
		targetDate: new Date(),
	};

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
		let groupKey: any;

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
			groupName = String(groupKey);
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
				taskCardsContainer.style.display = "none";
			} else {
				taskCardsContainer.style.display = "";
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
	itemEl.style.cssText =
		"padding: 12px; margin: 8px 0; background: #fff; border: 1px solid #ddd; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);";

	const header = doc.createElement("div");
	header.style.cssText = "font-weight: bold; margin-bottom: 8px; color: #333;";
	header.textContent = `Item ${index + 1}`;
	itemEl.appendChild(header);

	if ((item as any).path) {
		const pathEl = doc.createElement("div");
		pathEl.style.cssText =
			"font-size: 12px; color: #666; margin-bottom: 6px; font-family: monospace;";
		pathEl.textContent = `Path: ${(item as any).path}`;
		itemEl.appendChild(pathEl);
	}

	const props = (item as any).properties;
	if (props && typeof props === "object") {
		const propsEl = doc.createElement("div");
		propsEl.style.cssText = "font-size: 12px; margin-top: 8px;";

		const propsHeader = doc.createElement("div");
		propsHeader.style.cssText = "font-weight: bold; margin-bottom: 4px; color: #555;";
		propsHeader.textContent = "Properties:";
		propsEl.appendChild(propsHeader);

		const propsList = doc.createElement("ul");
		propsList.style.cssText = "margin: 0; padding-left: 16px; list-style-type: disc;";

		Object.entries(props).forEach(([key, value]) => {
			const li = doc.createElement("li");
			li.style.cssText = "margin: 2px 0; color: #444;";
			li.textContent = `${key}: ${JSON.stringify(value)}`;
			propsList.appendChild(li);
		});

		propsEl.appendChild(propsList);
		itemEl.appendChild(propsEl);
	}

	const rawDataEl = doc.createElement("details");
	rawDataEl.style.cssText = "margin-top: 8px; font-size: 11px;";

	const summary = doc.createElement("summary");
	summary.style.cssText = "cursor: pointer; color: #666; font-weight: bold;";
	summary.textContent = "Raw Data Structure";
	rawDataEl.appendChild(summary);

	const pre = doc.createElement("pre");
	pre.style.cssText =
		"margin: 8px 0 0 0; padding: 8px; background: #f8f8f8; border-radius: 4px; overflow-x: auto; font-size: 10px;";
	pre.textContent = JSON.stringify(item, null, 2);
	rawDataEl.appendChild(pre);

	itemEl.appendChild(rawDataEl);
	container.appendChild(itemEl);
}
