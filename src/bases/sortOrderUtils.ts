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
 * Increment a base-36 digit (0-9, a-z). Returns 'z' at ceiling.
 */
function nextBase36Char(ch: string): string {
	if (ch >= "0" && ch <= "8") return String.fromCharCode(ch.charCodeAt(0) + 1);
	if (ch === "9") return "a";
	if (ch >= "a" && ch <= "y") return String.fromCharCode(ch.charCodeAt(0) + 1);
	return "z";
}

/**
 * Decrement a base-36 digit (0-9, a-z). Returns '0' at floor.
 */
function prevBase36Char(ch: string): string {
	if (ch >= "1" && ch <= "9") return String.fromCharCode(ch.charCodeAt(0) - 1);
	if (ch === "a") return "9";
	if (ch >= "b" && ch <= "z") return String.fromCharCode(ch.charCodeAt(0) - 1);
	return "0";
}

/**
 * Generate a rank that sorts after `rank` in plain string comparison.
 *
 * For values whose integer part doesn't start with 'z', constructs an
 * upper bound (same digit count) and uses `between()` for the midpoint.
 *
 * For values starting with 'z' (near the ceiling of the range), or if
 * `between()` overflows, falls back to extending the decimal part with
 * 'i' (midpoint of base-36).  This is always safe because appending to
 * the decimal makes the string lexicographically greater without any
 * arithmetic that could wrap around.
 */
function safeGenNext(rank: LexoRank): LexoRank {
	const str = rank.toString();
	const pipeIdx = str.indexOf("|");
	const colonIdx = str.indexOf(":");
	const bucket = str.substring(0, pipeIdx);
	const value = str.substring(pipeIdx + 1, colonIdx);
	const decimal = str.substring(colonIdx + 1);
	const firstChar = value.charAt(0);

	if (firstChar !== "z") {
		const upperStr = bucket + "|" + nextBase36Char(firstChar) + value.slice(1) + ":";
		const result = rank.between(LexoRank.parse(upperStr));
		// Sanity check: result must actually be greater than rank.
		// LexoRank.between() can overflow for near-ceiling values.
		if (result.toString() > str) return result;
	}

	// Near ceiling or between() overflow: extend via the decimal part.
	// e.g. "0|z14hzz:" → "0|z14hzz:i"  (always > original)
	return LexoRank.parse(bucket + "|" + value + ":" + decimal + "i");
}

/**
 * Generate a rank that sorts before `rank` in plain string comparison.
 * Mirror of `safeGenNext` — decrements the first character to build a
 * lower bound and uses `between()`.
 */
function safeGenPrev(rank: LexoRank): LexoRank {
	const str = rank.toString();
	const pipeIdx = str.indexOf("|");
	const colonIdx = str.indexOf(":");
	const bucket = str.substring(0, pipeIdx);
	const value = str.substring(pipeIdx + 1, colonIdx);
	const firstChar = value.charAt(0);

	let lowerStr: string;
	if (firstChar === "0") {
		lowerStr = bucket + "|0:";
	} else {
		lowerStr = bucket + "|" + prevBase36Char(firstChar) + value.slice(1) + ":";
	}
	return LexoRank.parse(lowerStr).between(rank);
}

/**
 * Generate a LexoRank string near the end of the ranking space.
 * Used for cross-column drops where no specific position was targeted —
 * the task should appear at the bottom of the target column.
 */
export function generateEndRank(): string {
	const endRank = LexoRank.parse("0|zzzzzz:");
	return safeGenPrev(endRank).toString();
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
	const belowFallback = safeGenNext(safeGenNext(aboveRank));
	const belowRank = await ensureRank(
		belowTask, belowFallback, plugin, sortOrderField
	);
	try {
		const result = aboveRank.between(belowRank).toString();
		const aboveStr = aboveRank.toString();
		const belowStr = belowRank.toString();
		// Sanity check: result must be strictly between the two ranks.
		// LexoRank.between() can overflow for near-ceiling values.
		if (result > aboveStr && result < belowStr) {
			return result;
		}
		console.warn(
			`[TaskNotes] LexoRank.between() produced out-of-range result: ` +
			`${result} (expected between ${aboveStr} and ${belowStr}), ` +
			`falling back to safeGenNext()`
		);
		return safeGenNext(aboveRank).toString();
	} catch (e) {
		console.warn(
			"[TaskNotes] LexoRank.between() failed, falling back to safeGenNext():",
			e
		);
		return safeGenNext(aboveRank).toString();
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
 * - Tasks without a valid LexoRank sort_order are excluded from neighbor lookup
 *
 * @param targetTaskPath  - Path of the task being dropped on.
 * @param above           - Whether to drop above (true) or below (false) the target.
 * @param groupKey        - Group value (column key), or `null` for flat/ungrouped lists.
 * @param groupByProperty - Cleaned frontmatter property name for grouping, or `null`.
 * @param draggedPath     - Path of the task being dragged.
 * @param plugin          - Plugin instance.
 * @param taskInfoCache   - Optional cache for TaskInfo reuse.
 * @param debugLog        - Optional debug logging callback.
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
	debugLog?: (msg: string, data?: Record<string, unknown>) => void
): Promise<string | null> {
	const sortOrderField = plugin.settings.fieldMapping.sortOrder;
	const _log = debugLog || (() => {});

	// Always scan the full vault for ALL tasks in this column — not just
	// the tasks visible in the current view.  This prevents invisible tasks
	// (hidden by view filters or swimlane grouping) from being "leapfrogged"
	// when the user reorders within a filtered view.
	//
	// Also exclude tasks with non-LexoRank sort_orders (e.g. legacy numeric
	// timestamps).  These can't participate in LexoRank.between() and would
	// corrupt the neighbor lookup if they end up adjacent to the target.
	const columnTasks = getGroupTasks(
		groupKey, groupByProperty, plugin, taskInfoCache,
		undefined, undefined, sortOrderField
	).filter(t => {
		if (t.path === draggedPath) return false;
		// Exclude tasks without a sort_order or with a non-LexoRank sort_order.
		// Tasks without a defined LexoRank can't meaningfully participate in
		// neighbor lookup — using them causes ensureRank() to write fallback
		// ranks to unrelated files and LexoRank.between() to produce garbage
		// for boundary values.
		if (t.sortOrder === undefined) return false;
		if (!tryParseLexoRank(t.sortOrder)) return false;
		return true;
	});

	_log("COMPUTE-SORT-ORDER", {
		columnTaskCount: columnTasks.length,
		columnTasks: columnTasks.map(t => ({
			file: t.path.split("/").pop(),
			sortOrder: t.sortOrder,
		})),
		targetFile: targetTaskPath.split("/").pop(),
		draggedFile: draggedPath.split("/").pop(),
		above,
		groupKey,
		groupByProperty,
	});

	if (!columnTasks || columnTasks.length === 0) {
		_log("COMPUTE-SORT-ORDER: empty column, returning middle");
		return LexoRank.middle().toString();
	}

	const targetIndex = columnTasks.findIndex(t => t.path === targetTaskPath);



	if (targetIndex === -1) {
		_log("COMPUTE-SORT-ORDER: target not found — appending to end of column", {
			targetFile: targetTaskPath.split("/").pop(),
			allPaths: columnTasks.map(t => t.path.split("/").pop()),
		});
		// Target not in column (e.g. cross-column drop with stale target, or empty target).
		// Append after the last task in the column.
		const lastTask = columnTasks[columnTasks.length - 1];
		const lastRank = await ensureRank(lastTask, LexoRank.middle(), plugin, sortOrderField);
		const result = safeGenNext(lastRank).toString();
		_log("COMPUTE-SORT-ORDER: appended after last", { lastFile: lastTask.path.split("/").pop(), lastRank: lastRank.toString(), result });
		return result;
	}

	_log("COMPUTE-SORT-ORDER: target found", {
		targetIndex,
		totalTasks: columnTasks.length,
		position: above
			? (targetIndex === 0 ? "ABOVE-FIRST" : "BETWEEN")
			: (targetIndex === columnTasks.length - 1 ? "BELOW-LAST" : "BETWEEN"),
		neighborAbove: targetIndex > 0 ? { file: columnTasks[targetIndex - 1].path.split("/").pop(), so: columnTasks[targetIndex - 1].sortOrder } : null,
		target: { file: columnTasks[targetIndex].path.split("/").pop(), so: columnTasks[targetIndex].sortOrder },
		neighborBelow: targetIndex < columnTasks.length - 1 ? { file: columnTasks[targetIndex + 1].path.split("/").pop(), so: columnTasks[targetIndex + 1].sortOrder } : null,
	});

	if (above) {
		if (targetIndex === 0) {
			// Drop above first task
			const firstRank = await ensureRank(
				columnTasks[0], LexoRank.middle(), plugin, sortOrderField
			);
			const result = safeGenPrev(firstRank).toString();
			_log("COMPUTE-SORT-ORDER: above first → safeGenPrev", { firstRank: firstRank.toString(), result });
			return result;
		}
		// Between two tasks
		const result = await rankBetween(
			columnTasks[targetIndex - 1],
			columnTasks[targetIndex],
			LexoRank.middle(),
			plugin,
			sortOrderField
		);
		_log("COMPUTE-SORT-ORDER: between (above)", { result });
		return result;
	} else {
		if (targetIndex === columnTasks.length - 1) {
			// Drop below last task
			const lastRank = await ensureRank(
				columnTasks[columnTasks.length - 1], LexoRank.middle(), plugin, sortOrderField
			);
			const result = safeGenNext(lastRank).toString();
			_log("COMPUTE-SORT-ORDER: below last → safeGenNext", { lastRank: lastRank.toString(), result });
			return result;
		}
		// Between two tasks
		const result = await rankBetween(
			columnTasks[targetIndex],
			columnTasks[targetIndex + 1],
			LexoRank.middle(),
			plugin,
			sortOrderField
		);
		_log("COMPUTE-SORT-ORDER: between (below)", { result });
		return result;
	}
}

/**
 * Per-task promise queue that serializes async drop operations on the same file.
 *
 * When a user rapidly drags the same task twice (e.g. column A → B → A), the
 * second `handleTaskDrop` must wait for the first to fully complete before
 * running — otherwise their interleaved `processFrontMatter` writes cause the
 * task to end up at the wrong position.
 *
 * Different task paths are processed in parallel (they write to different files).
 */
export class DropOperationQueue {
	private queues = new Map<string, Promise<void>>();

	async enqueue(taskPath: string, operation: () => Promise<void>): Promise<void> {
		const prev = this.queues.get(taskPath) ?? Promise.resolve();
		const next = prev.then(operation, operation);
		this.queues.set(taskPath, next);
		try {
			await next;
		} finally {
			if (this.queues.get(taskPath) === next) {
				this.queues.delete(taskPath);
			}
		}
	}
}
