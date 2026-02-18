/**
 * Shared sort_order utilities for drag-to-reorder.
 * Used by both KanbanView and TaskListView.
 *
 * Design: pure functions with explicit dependency injection — no `this` references.
 * Uses LexoRank for string-based ordering that avoids integer midpoint collisions.
 */
import { LexoRank } from "lexorank";
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
export function isSortOrderInSortConfig(dataAdapter: any, sortOrderField: string): boolean {
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
			return clean === sortOrderField;
		});
	} catch (e) {
		return false;
	}
}

/**
 * Try to parse a string as a LexoRank. Returns null if parsing fails
 * (e.g. legacy numeric strings like "1500").
 */
function tryParseLexoRank(value: string): LexoRank | null {
	try {
		return LexoRank.parse(value);
	} catch {
		return null;
	}
}

/**
 * Ensure a task has a valid LexoRank. If it doesn't, assign one and persist it
 * to the task's frontmatter.
 *
 * **Side-effect:** When a neighbor task lacks a LexoRank (e.g. legacy numeric
 * value or missing field), this function writes the fallback rank into the
 * task's frontmatter so that subsequent operations see a consistent value.
 *
 * @param task          - The task to check/assign a rank to.
 * @param fallbackRank  - The LexoRank to assign if the task has no valid rank.
 * @param plugin        - Plugin instance for vault/file access.
 * @param sortOrderField - The frontmatter property name for sort order.
 * @returns The task's existing or newly assigned LexoRank.
 */
async function ensureRank(
	task: TaskInfo,
	fallbackRank: LexoRank,
	plugin: TaskNotesPlugin,
	sortOrderField: string
): Promise<LexoRank> {
	// If the task already has a valid LexoRank, return it
	if (task.sortOrder !== undefined) {
		const parsed = tryParseLexoRank(task.sortOrder);
		if (parsed) return parsed;
	}

	// Assign the fallback rank and persist it
	console.debug(
		`[TaskNotes] Auto-assigning LexoRank to "${task.title}" (${task.path}): ${fallbackRank.toString()}`
	);
	const rankStr = fallbackRank.toString();
	task.sortOrder = rankStr;

	const file = plugin.app.vault.getAbstractFileByPath(task.path);
	if (file && file instanceof TFile) {
		await plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			frontmatter[sortOrderField] = rankStr;
		});
	}

	return fallbackRank;
}

/**
 * Compute a LexoRank between two neighbor tasks, with try/catch protection
 * around the `between()` call. If `between()` throws (e.g. identical ranks),
 * falls back to `aboveRank.genNext()`.
 *
 * @param aboveTask     - The task immediately above the drop position.
 * @param belowTask     - The task immediately below the drop position.
 * @param aboveFallback - Fallback LexoRank for `aboveTask` if it has no rank.
 * @param plugin        - Plugin instance.
 * @param sortOrderField - The frontmatter property name for sort order.
 * @returns The computed LexoRank string for the dropped task.
 */
async function rankBetween(
	aboveTask: TaskInfo,
	belowTask: TaskInfo,
	aboveFallback: LexoRank,
	plugin: TaskNotesPlugin,
	sortOrderField: string
): Promise<string> {
	const aboveRank = await ensureRank(aboveTask, aboveFallback, plugin, sortOrderField);
	const belowRank = await ensureRank(
		belowTask, aboveRank.genNext().genNext(), plugin, sortOrderField
	);
	try {
		return aboveRank.between(belowRank).toString();
	} catch (e) {
		console.warn(
			"[TaskNotes] LexoRank.between() failed, falling back to genNext():",
			e
		);
		return aboveRank.genNext().toString();
	}
}

/**
 * Get all tasks matching a group (and optionally swimlane), scanning the entire vault.
 *
 * @param groupKey   - The group value to match, or `null` for ungrouped (all tasks).
 * @param groupByProperty - The cleaned frontmatter property name for grouping (e.g. "priority"), or `null`.
 * @param plugin     - Plugin instance for vault/metadata access.
 * @param taskInfoCache - Optional cache of TaskInfo objects for reuse.
 * @param swimlaneKey - The swimlane value to filter by, or `null`/`undefined` to skip swimlane filtering.
 * @param swimlaneProperty - The cleaned frontmatter property name for swimlanes, or `null`/`undefined`.
 * @param sortOrderField - The frontmatter property name for sort order. Defaults to plugin setting.
 * @returns Tasks sorted by sort_order ascending (lexicographic).
 */
export function getGroupTasks(
	groupKey: string | null,
	groupByProperty: string | null,
	plugin: TaskNotesPlugin,
	taskInfoCache?: Map<string, TaskInfo>,
	swimlaneKey?: string | null,
	swimlaneProperty?: string | null,
	sortOrderField?: string
): TaskInfo[] {
	const soField = sortOrderField ?? plugin.settings.fieldMapping.sortOrder;
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

		// Swimlane filter: when both swimlaneKey and swimlaneProperty are provided,
		// only include tasks whose swimlane property matches swimlaneKey
		if (swimlaneKey !== undefined && swimlaneKey !== null && swimlaneProperty) {
			const rawSwim = fm[swimlaneProperty];
			if (rawSwim === undefined || rawSwim === null) continue;

			const swimValues = Array.isArray(rawSwim) ? rawSwim.map(String) : [String(rawSwim)];
			if (!swimValues.includes(swimlaneKey)) continue;
		}

		// Read sort_order as string
		const rawSortOrder = fm[soField];
		const sortOrder = rawSortOrder !== undefined
			? String(rawSortOrder)
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

	// Sort by sortOrder ascending (lexicographic for LexoRank strings)
	// Unranked tasks (undefined sortOrder) sort to end
	tasks.sort((a, b) => {
		const aHas = a.sortOrder !== undefined;
		const bHas = b.sortOrder !== undefined;
		if (aHas && bHas) return a.sortOrder!.localeCompare(b.sortOrder!);
		if (aHas && !bHas) return -1;
		if (!aHas && bHas) return 1;
		return 0;
	});

	return tasks;
}

/**
 * Compute the new sort_order LexoRank string for a task being dropped at a target position.
 *
 * Uses LexoRank for string-based ordering:
 * - Empty column → `LexoRank.middle()`
 * - Drop above first task → `firstRank.genPrev()`
 * - Drop below last task → `lastRank.genNext()`
 * - Between two tasks → `rankBetween()` (with try/catch protection)
 * - Unranked/legacy neighbors get a rank assigned on the fly via `ensureRank()`
 *
 * @param targetTaskPath  - Path of the task being dropped on.
 * @param above           - Whether to drop above (true) or below (false) the target.
 * @param groupKey        - Group value (column key), or `null` for flat/ungrouped lists.
 * @param groupByProperty - Cleaned frontmatter property name for grouping, or `null`.
 * @param draggedPath     - Path of the task being dragged.
 * @param plugin          - Plugin instance.
 * @param taskInfoCache   - Optional cache for TaskInfo reuse.
 * @param swimlaneKey     - Swimlane value to scope to, or `null`/`undefined`.
 * @param swimlaneProperty - Cleaned frontmatter property name for swimlanes, or `null`/`undefined`.
 * @returns The computed sort_order string, or `null` if computation fails.
 */
export async function computeSortOrder(
	targetTaskPath: string,
	above: boolean,
	groupKey: string | null,
	groupByProperty: string | null,
	draggedPath: string,
	plugin: TaskNotesPlugin,
	taskInfoCache?: Map<string, TaskInfo>,
	swimlaneKey?: string | null,
	swimlaneProperty?: string | null
): Promise<string | null> {
	const sortOrderField = plugin.settings.fieldMapping.sortOrder;

	// Get group tasks (with swimlane filtering), excluding the task being dragged
	const columnTasks = getGroupTasks(
		groupKey, groupByProperty, plugin, taskInfoCache,
		swimlaneKey, swimlaneProperty, sortOrderField
	).filter(t => t.path !== draggedPath);

	if (!columnTasks || columnTasks.length === 0) {
		return LexoRank.middle().toString();
	}

	const targetIndex = columnTasks.findIndex(t => t.path === targetTaskPath);
	if (targetIndex === -1) return null;

	if (above) {
		if (targetIndex === 0) {
			// Drop above first task
			const firstRank = await ensureRank(
				columnTasks[0], LexoRank.middle(), plugin, sortOrderField
			);
			return firstRank.genPrev().toString();
		}
		// Between two tasks
		return rankBetween(
			columnTasks[targetIndex - 1],
			columnTasks[targetIndex],
			LexoRank.middle(),
			plugin,
			sortOrderField
		);
	} else {
		if (targetIndex === columnTasks.length - 1) {
			// Drop below last task
			const lastRank = await ensureRank(
				columnTasks[columnTasks.length - 1], LexoRank.middle(), plugin, sortOrderField
			);
			return lastRank.genNext().toString();
		}
		// Between two tasks
		return rankBetween(
			columnTasks[targetIndex],
			columnTasks[targetIndex + 1],
			LexoRank.middle(),
			plugin,
			sortOrderField
		);
	}
}
