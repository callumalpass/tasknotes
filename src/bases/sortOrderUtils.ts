/**
 * Shared sort_order utilities for drag-to-reorder.
 * Used by both KanbanView and TaskListView.
 *
 * Design: pure functions with explicit dependency injection — no `this` references.
 */
import { TFile } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";

/**
 * Strip Bases property prefixes (note., file., formula., task.) from a property ID.
 */
export function stripPropertyPrefix(propertyId: string): string {
	const parts = propertyId.split(".");
	if (parts.length > 1 && ["note", "file", "formula", "task"].includes(parts[0])) {
		return parts.slice(1).join(".");
	}
	return propertyId;
}

/**
 * Check whether `sort_order` is present in the view's base sort configuration.
 * Drag-to-reorder should only activate when this returns true.
 */
export function isSortOrderInSortConfig(dataAdapter: any): boolean {
	try {
		const sortConfig = dataAdapter.getSortConfig();
		if (!sortConfig) return false;

		// Handle both array and single-object formats
		const configs = Array.isArray(sortConfig) ? sortConfig : [sortConfig];

		return configs.some((s: any) => {
			if (!s || typeof s !== "object") return false;
			// Check all possible keys the sort property might be under
			const candidate = s.property || s.column || s.field || s.id || s.name || "";
			const clean = String(candidate).replace(/^(note\.|file\.|task\.)/, "");
			return clean === "sort_order";
		});
	} catch (e) {
		return false;
	}
}

/**
 * Compute the default gap between sort_order values based on existing values.
 * Uses the median gap as the default spacing.
 */
function computeDefaultGap(columnTasks: TaskInfo[]): number {
	const values = columnTasks
		.map(t => t.sortOrder)
		.filter((v): v is number => v !== undefined && v < Number.MAX_SAFE_INTEGER)
		.sort((a, b) => a - b);
	if (values.length < 2) {
		return values.length === 1 && values[0] !== 0
			? Math.max(1, Math.floor(Math.abs(values[0]) / 10))
			: 1000;
	}
	const gaps: number[] = [];
	for (let i = 1; i < values.length; i++) gaps.push(values[i] - values[i - 1]);
	gaps.sort((a, b) => a - b);
	return Math.max(1, gaps[Math.floor(gaps.length / 2)]);
}

/**
 * Get all tasks matching a group, scanning the entire vault.
 *
 * @param groupKey   - The group value to match, or `null` for ungrouped (all tasks).
 * @param groupByProperty - The cleaned frontmatter property name for grouping (e.g. "priority"), or `null`.
 * @param plugin     - Plugin instance for vault/metadata access.
 * @param taskInfoCache - Optional cache of TaskInfo objects for reuse.
 * @returns Tasks sorted by sort_order ascending.
 */
export function getGroupTasks(
	groupKey: string | null,
	groupByProperty: string | null,
	plugin: TaskNotesPlugin,
	taskInfoCache?: Map<string, TaskInfo>
): TaskInfo[] {
	const allFiles = plugin.app.vault.getMarkdownFiles();
	const tasks: TaskInfo[] = [];

	for (const file of allFiles) {
		const fm = plugin.app.metadataCache.getFileCache(file)?.frontmatter;
		if (!fm) continue;

		// When groupKey is non-null, filter by groupByProperty matching groupKey
		if (groupKey !== null && groupByProperty) {
			const rawValue = fm[groupByProperty];
			if (rawValue === undefined || rawValue === null) continue;

			// Handle both scalar and array values (for list properties)
			const values = Array.isArray(rawValue) ? rawValue.map(String) : [String(rawValue)];
			if (!values.includes(groupKey)) continue;
		}
		// When groupKey is null, include ALL tasks (flat/ungrouped mode)

		// Read sort_order
		const sortOrder = fm["sort_order"] !== undefined
			? (typeof fm["sort_order"] === "number" ? fm["sort_order"] : Number(fm["sort_order"]))
			: undefined;

		// Use cached TaskInfo if available, otherwise create minimal object
		const cached = taskInfoCache?.get(file.path);
		if (cached) {
			cached.sortOrder = sortOrder;
			tasks.push(cached);
		} else {
			tasks.push({
				path: file.path,
				title: file.basename,
				status: fm["status"] || "open",
				priority: fm["priority"] || "",
				archived: fm["archived"] || false,
				sortOrder: sortOrder,
			} as TaskInfo);
		}
	}

	// Sort by sortOrder ascending (lower value = higher position)
	tasks.sort((a, b) => {
		const aHas = a.sortOrder !== undefined && a.sortOrder < Number.MAX_SAFE_INTEGER;
		const bHas = b.sortOrder !== undefined && b.sortOrder < Number.MAX_SAFE_INTEGER;
		if (aHas && bHas) return a.sortOrder! - b.sortOrder!;
		if (aHas && !bHas) return -1;
		if (!aHas && bHas) return 1;
		return 0;
	});

	return tasks;
}

/**
 * Renumber all tasks in the column/group and insert the dragged task at the target position.
 * Called when the midpoint algorithm finds no gap (collision).
 */
async function renumberAndInsert(
	columnTasks: TaskInfo[],
	targetIndex: number,
	above: boolean,
	plugin: TaskNotesPlugin
): Promise<number> {
	// Collect existing sort_order values to determine the range
	const values = columnTasks
		.map(t => t.sortOrder)
		.filter((v): v is number => v !== undefined && v < Number.MAX_SAFE_INTEGER)
		.sort((a, b) => a - b);

	const rangeMin = values.length >= 1 ? values[0] : 0;
	const rangeMax = values.length >= 2
		? values[values.length - 1]
		: rangeMin + (columnTasks.length + 2) * 1000;

	const totalSlots = columnTasks.length + 1; // +1 for the dragged task
	const step = Math.max(1, Math.floor((rangeMax - rangeMin) / (totalSlots + 1)));

	// Build the new order: insert a placeholder for the dragged task
	const insertAt = above ? targetIndex : targetIndex + 1;
	const orderedPaths: (string | null)[] = columnTasks.map(t => t.path);
	// Insert null as placeholder for the dragged task
	orderedPaths.splice(insertAt, 0, null);

	let draggedSortOrder = 0;
	const writes: Array<{ path: string; order: number }> = [];

	for (let i = 0; i < orderedPaths.length; i++) {
		const newOrder = rangeMin + (i + 1) * step;
		const p = orderedPaths[i];
		if (p === null) {
			// This is the dragged task's new position
			draggedSortOrder = newOrder;
		} else {
			writes.push({ path: p, order: newOrder });
		}
	}

	// Write new sort_orders to all other tasks in the column
	for (const w of writes) {
		const file = plugin.app.vault.getAbstractFileByPath(w.path);
		if (file && file instanceof TFile) {
			await plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
				frontmatter["sort_order"] = w.order;
			});
		}
	}

	return draggedSortOrder;
}

/**
 * Compute the new sort_order value for a task being dropped at a target position.
 *
 * Uses a midpoint insertion algorithm: `floor((neighbor_above + neighbor_below) / 2)`.
 * Falls back to full renumbering if no gap exists between neighbors.
 *
 * @param targetTaskPath  - Path of the task being dropped on.
 * @param above           - Whether to drop above (true) or below (false) the target.
 * @param groupKey        - Group value (column key), or `null` for flat/ungrouped lists.
 * @param groupByProperty - Cleaned frontmatter property name for grouping, or `null`.
 * @param draggedPath     - Path of the task being dragged.
 * @param plugin          - Plugin instance.
 * @param taskInfoCache   - Optional cache for TaskInfo reuse.
 * @returns The computed sort_order, or `null` if computation fails.
 */
export async function computeSortOrder(
	targetTaskPath: string,
	above: boolean,
	groupKey: string | null,
	groupByProperty: string | null,
	draggedPath: string,
	plugin: TaskNotesPlugin,
	taskInfoCache?: Map<string, TaskInfo>
): Promise<number | null> {
	// Get group tasks, filtering out the task being dragged
	const columnTasks = getGroupTasks(groupKey, groupByProperty, plugin, taskInfoCache)
		.filter(t => t.path !== draggedPath);
	if (!columnTasks || columnTasks.length === 0) return 0;

	const targetIndex = columnTasks.findIndex(t => t.path === targetTaskPath);
	if (targetIndex === -1) return null;

	const defaultGap = computeDefaultGap(columnTasks);
	const MAX_ORDER = Number.MAX_SAFE_INTEGER;

	const getOrder = (task: TaskInfo): number =>
		task.sortOrder ?? MAX_ORDER;

	let lo: number;
	let hi: number;

	if (above) {
		hi = getOrder(columnTasks[targetIndex]);
		lo = targetIndex === 0 ? hi - defaultGap : getOrder(columnTasks[targetIndex - 1]);
		// Top of column with no sorted tasks
		if (hi >= MAX_ORDER && targetIndex === 0) return 0;
		// Top of column
		if (targetIndex === 0) return hi - defaultGap;
	} else {
		lo = getOrder(columnTasks[targetIndex]);
		hi = targetIndex === columnTasks.length - 1
			? lo + defaultGap * 2
			: getOrder(columnTasks[targetIndex + 1]);
		// Bottom of column with no sorted tasks
		if (lo >= MAX_ORDER && targetIndex === columnTasks.length - 1) return 0;
		// Bottom of column
		if (targetIndex === columnTasks.length - 1) return lo + defaultGap;
	}

	// Handle unsorted neighbors (MAX_ORDER)
	if (lo >= MAX_ORDER) lo = hi - defaultGap;
	if (hi >= MAX_ORDER) hi = lo + defaultGap;

	// Normal case: there's a gap between neighbors
	const mid = Math.floor((lo + hi) / 2);
	if (mid !== lo && mid !== hi) return mid;

	// Collision: neighbors are equal or adjacent integers — renumber the column
	return await renumberAndInsert(columnTasks, targetIndex, above, plugin);
}
