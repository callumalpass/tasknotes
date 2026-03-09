/**
 * Shared sort-order utilities for drag-to-reorder.
 * Used by both KanbanView and TaskListView.
 */
import { LexoRank } from "lexorank";
import { TFile } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";

export interface SortOrderScopeFilter {
	property: string;
	value: string | null;
}

export interface SortOrderComputationOptions {
	scopeFilters?: SortOrderScopeFilter[];
	taskInfoCache?: Map<string, TaskInfo>;
	visibleTaskPaths?: string[];
	debugLog?: (msg: string, data?: Record<string, unknown>) => void;
}

export interface SortOrderWrite {
	path: string;
	sortOrder: string;
}

export interface SortOrderPlan {
	sortOrder: string | null;
	additionalWrites: SortOrderWrite[];
	reason: "midpoint" | "boundary" | "sparse-init";
}

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
 * Check whether the configured sort-order field is present in the view's sort configuration.
 */
export function isSortOrderInSortConfig(dataAdapter: any, sortOrderField: string): boolean {
	try {
		const sortConfig = dataAdapter.getSortConfig();
		if (!sortConfig) return false;

		const configs = Array.isArray(sortConfig) ? sortConfig : [sortConfig];
		return configs.some((s: any) => {
			if (!s || typeof s !== "object") return false;
			const candidate = s.property || s.column || s.field || s.id || s.name || "";
			const clean = String(candidate).replace(/^(note\.|file\.|task\.)/, "");
			return clean === sortOrderField;
		});
	} catch {
		return false;
	}
}

function tryParseLexoRank(value: string | undefined): LexoRank | null {
	if (typeof value !== "string" || value.length === 0) return null;
	try {
		return LexoRank.parse(value);
	} catch {
		return null;
	}
}

function hasValidLexoRank(task: TaskInfo): boolean {
	return tryParseLexoRank(task.sortOrder) !== null;
}

function frontmatterValueToGroupString(value: unknown): string {
	if (value === null || value === undefined || value === "") return "None";
	if (typeof value === "string") return value;
	if (typeof value === "boolean") return value ? "True" : "False";
	if (typeof value === "number") return String(value);
	return String(value);
}

function getFrontmatterGroupValues(value: unknown): string[] {
	if (value === null || value === undefined || value === "") return ["None"];
	if (Array.isArray(value)) {
		return value.length > 0
			? value.map((entry) => frontmatterValueToGroupString(entry))
			: ["None"];
	}
	return [frontmatterValueToGroupString(value)];
}

function matchesGroupValue(value: unknown, expected: string | null): boolean {
	if (expected === null) return true;
	return getFrontmatterGroupValues(value).includes(expected);
}

function buildVisibleOrderLookup(visibleTaskPaths?: string[]): Map<string, number> {
	const lookup = new Map<string, number>();
	if (!visibleTaskPaths) return lookup;
	visibleTaskPaths.forEach((path, index) => {
		lookup.set(path, index);
	});
	return lookup;
}

/**
 * Generate a rank that sorts after `rank` in plain string comparison.
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
		const nextFirst = firstChar >= "0" && firstChar <= "8"
			? String.fromCharCode(firstChar.charCodeAt(0) + 1)
			: firstChar === "9"
				? "a"
				: firstChar >= "a" && firstChar <= "y"
					? String.fromCharCode(firstChar.charCodeAt(0) + 1)
					: "z";
		const upperStr = `${bucket}|${nextFirst}${value.slice(1)}:`;
		const result = rank.between(LexoRank.parse(upperStr));
		if (result.toString() > str) return result;
	}

	return LexoRank.parse(`${bucket}|${value}:${decimal}i`);
}

/**
 * Generate a rank that sorts before `rank` in plain string comparison.
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
		lowerStr = `${bucket}|0:`;
	} else {
		const prevFirst = firstChar >= "1" && firstChar <= "9"
			? String.fromCharCode(firstChar.charCodeAt(0) - 1)
			: firstChar === "a"
				? "9"
				: firstChar >= "b" && firstChar <= "z"
					? String.fromCharCode(firstChar.charCodeAt(0) - 1)
					: "0";
		lowerStr = `${bucket}|${prevFirst}${value.slice(1)}:`;
	}

	return LexoRank.parse(lowerStr).between(rank);
}

function safeBetween(aboveRank: LexoRank, belowRank: LexoRank): string {
	const aboveStr = aboveRank.toString();
	const belowStr = belowRank.toString();

	try {
		const result = aboveRank.between(belowRank).toString();
		if (result > aboveStr && result < belowStr) {
			return result;
		}
	} catch {
		// Fall through to safer directional fallbacks.
	}

	const next = safeGenNext(aboveRank).toString();
	if (next > aboveStr && next < belowStr) return next;

	const prev = safeGenPrev(belowRank).toString();
	if (prev > aboveStr && prev < belowStr) return prev;

	return next;
}

function getNearestPreviousRank(tasks: TaskInfo[], startIndex: number): LexoRank | null {
	for (let i = startIndex - 1; i >= 0; i--) {
		const rank = tryParseLexoRank(tasks[i].sortOrder);
		if (rank) return rank;
	}
	return null;
}

function getContiguousVisibleSparseRun(
	columnTasks: TaskInfo[],
	targetTaskPath: string,
	visibleTaskPaths: string[] | undefined,
	draggedPath: string
): string[] | null {
	if (!visibleTaskPaths || visibleTaskPaths.length === 0) return null;

	const taskByPath = new Map(columnTasks.map((task) => [task.path, task]));
	const targetVisibleIndex = visibleTaskPaths.indexOf(targetTaskPath);
	if (targetVisibleIndex === -1) return null;

	const targetTask = taskByPath.get(targetTaskPath);
	if (!targetTask || hasValidLexoRank(targetTask)) return null;

	let start = targetVisibleIndex;
	while (start > 0) {
		const previousTask = taskByPath.get(visibleTaskPaths[start - 1]);
		if (!previousTask || hasValidLexoRank(previousTask) || previousTask.path === draggedPath) break;
		start--;
	}

	let end = targetVisibleIndex;
	while (end < visibleTaskPaths.length - 1) {
		const nextTask = taskByPath.get(visibleTaskPaths[end + 1]);
		if (!nextTask || hasValidLexoRank(nextTask) || nextTask.path === draggedPath) break;
		end++;
	}

	const runPaths = visibleTaskPaths
		.slice(start, end + 1)
		.filter((path) => path !== draggedPath)
		.filter((path) => {
			const task = taskByPath.get(path);
			return !!task && !hasValidLexoRank(task);
		});

	return runPaths.length > 0 ? runPaths : null;
}

function createSparsePlan(
	columnTasks: TaskInfo[],
	targetIndex: number,
	above: boolean,
	draggedPath: string,
	visibleTaskPaths?: string[]
): SortOrderPlan {
	const targetTask = columnTasks[targetIndex];
	const visibleRun = getContiguousVisibleSparseRun(
		columnTasks,
		targetTask.path,
		visibleTaskPaths,
		draggedPath
	);

	let runPaths = visibleRun;
	if (!runPaths) {
		let runStart = targetIndex;
		while (runStart > 0 && !hasValidLexoRank(columnTasks[runStart - 1])) {
			runStart--;
		}

		let runEnd = targetIndex;
		while (runEnd < columnTasks.length - 1 && !hasValidLexoRank(columnTasks[runEnd + 1])) {
			runEnd++;
		}

		runPaths = columnTasks
			.slice(runStart, runEnd + 1)
			.map((task) => task.path)
			.filter((path) => path !== draggedPath);
	}

	const firstRunIndex = runPaths.length > 0
		? columnTasks.findIndex((task) => task.path === runPaths[0])
		: targetIndex;
	const previousRank = getNearestPreviousRank(columnTasks, firstRunIndex >= 0 ? firstRunIndex : targetIndex);
	const targetRunIndex = runPaths.indexOf(targetTask.path);
	if (above && targetRunIndex === 0) {
		return {
			sortOrder: previousRank ? safeGenNext(previousRank).toString() : LexoRank.middle().toString(),
			additionalWrites: [],
			reason: "boundary",
		};
	}
	const insertAt = targetRunIndex === -1
		? (above ? 0 : runPaths.length)
		: (above ? targetRunIndex : targetRunIndex + 1);
	const orderedPaths: Array<string | null> = [...runPaths];
	orderedPaths.splice(insertAt, 0, null);

	const additionalWrites: SortOrderWrite[] = [];
	let draggedSortOrder: string | null = null;
	let currentRank = previousRank;

	for (const path of orderedPaths) {
		const nextRank = currentRank ? safeGenNext(currentRank) : LexoRank.middle();
		const nextRankString = nextRank.toString();
		if (path === null) {
			draggedSortOrder = nextRankString;
		} else {
			additionalWrites.push({ path, sortOrder: nextRankString });
		}
		currentRank = nextRank;
	}

	return {
		sortOrder: draggedSortOrder,
		additionalWrites,
		reason: "sparse-init",
	};
}

/**
 * Generate a LexoRank string near the end of the ranking space.
 * Used for cross-column drops where no specific position was targeted.
 */
export function generateEndRank(): string {
	const endRank = LexoRank.parse("0|zzzzzz:");
	return safeGenPrev(endRank).toString();
}

/**
 * Get all tasks matching a group, narrowed by optional extra scope filters.
 */
export function getGroupTasks(
	groupKey: string | null,
	groupByProperty: string | null,
	plugin: TaskNotesPlugin,
	options: SortOrderComputationOptions = {}
): TaskInfo[] {
	const sortOrderField = plugin.settings.fieldMapping.sortOrder;
	const visibleOrder = buildVisibleOrderLookup(options.visibleTaskPaths);
	const allFiles = plugin.app.vault.getMarkdownFiles();
	const tasks: TaskInfo[] = [];

	for (const file of allFiles) {
		const frontmatter = plugin.app.metadataCache.getFileCache(file)?.frontmatter;
		if (!frontmatter) continue;

		if (groupKey !== null && groupByProperty && !matchesGroupValue(frontmatter[groupByProperty], groupKey)) {
			continue;
		}

		if (options.scopeFilters?.some((filter) => !matchesGroupValue(frontmatter[filter.property], filter.value))) {
			continue;
		}

		const rawSortOrder = frontmatter[sortOrderField];
		const sortOrder = rawSortOrder !== undefined ? String(rawSortOrder) : undefined;
		const cached = options.taskInfoCache?.get(file.path);
		if (cached) {
			cached.sortOrder = sortOrder;
			tasks.push(cached);
			continue;
		}

		tasks.push({
			path: file.path,
			title: file.basename,
			status: frontmatter["status"] || "open",
			priority: frontmatter["priority"] || "",
			archived: frontmatter["archived"] || false,
			sortOrder,
		} as TaskInfo);
	}

	tasks.sort((a, b) => {
		const aRank = tryParseLexoRank(a.sortOrder);
		const bRank = tryParseLexoRank(b.sortOrder);
		if (aRank && bRank) {
			const diff = aRank.toString().localeCompare(bRank.toString());
			if (diff !== 0) return diff;
		}
		if (aRank && !bRank) return -1;
		if (!aRank && bRank) return 1;

		const aVisibleIndex = visibleOrder.get(a.path);
		const bVisibleIndex = visibleOrder.get(b.path);
		if (aVisibleIndex !== undefined && bVisibleIndex !== undefined) {
			return aVisibleIndex - bVisibleIndex;
		}
		if (aVisibleIndex !== undefined) return -1;
		if (bVisibleIndex !== undefined) return 1;
		return a.path.localeCompare(b.path);
	});

	return tasks;
}

async function writeSortOrder(path: string, sortOrder: string, plugin: TaskNotesPlugin): Promise<void> {
	const file = plugin.app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) return;

	const sortOrderField = plugin.settings.fieldMapping.sortOrder;
	await plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
		frontmatter[sortOrderField] = sortOrder;
	});
}

/**
 * Prepare a sort-order update plan without writing any files yet.
 */
export async function prepareSortOrderUpdate(
	targetTaskPath: string,
	above: boolean,
	groupKey: string | null,
	groupByProperty: string | null,
	draggedPath: string,
	plugin: TaskNotesPlugin,
	options: SortOrderComputationOptions = {}
): Promise<SortOrderPlan> {
	const _log = options.debugLog || (() => {});
	const columnTasks = getGroupTasks(groupKey, groupByProperty, plugin, options)
		.filter((task) => task.path !== draggedPath);

	_log("PREPARE-SORT-ORDER", {
		columnTaskCount: columnTasks.length,
		targetFile: targetTaskPath.split("/").pop(),
		draggedFile: draggedPath.split("/").pop(),
		above,
		groupKey,
		groupByProperty,
		scopeFilters: options.scopeFilters,
	});

	if (columnTasks.length === 0) {
		return {
			sortOrder: LexoRank.middle().toString(),
			additionalWrites: [],
			reason: "boundary",
		};
	}

	const targetIndex = columnTasks.findIndex((task) => task.path === targetTaskPath);
	if (targetIndex === -1) {
		const lastRankedTask = [...columnTasks].reverse().find((task) => hasValidLexoRank(task));
		return {
			sortOrder: lastRankedTask
				? safeGenNext(tryParseLexoRank(lastRankedTask.sortOrder)!).toString()
				: LexoRank.middle().toString(),
			additionalWrites: [],
			reason: "boundary",
		};
	}

	const targetTask = columnTasks[targetIndex];
	const previousTask = targetIndex > 0 ? columnTasks[targetIndex - 1] : null;
	const nextTask = targetIndex < columnTasks.length - 1 ? columnTasks[targetIndex + 1] : null;
	const targetRank = tryParseLexoRank(targetTask.sortOrder);
	const previousRank = previousTask ? tryParseLexoRank(previousTask.sortOrder) : null;
	const nextRank = nextTask ? tryParseLexoRank(nextTask.sortOrder) : null;

	if (!targetRank) {
		return createSparsePlan(columnTasks, targetIndex, above, draggedPath, options.visibleTaskPaths);
	}

	if (above) {
		return {
			sortOrder: targetIndex === 0
				? safeGenPrev(targetRank).toString()
				: previousRank
					? safeBetween(previousRank, targetRank)
					: safeGenPrev(targetRank).toString(),
			additionalWrites: [],
			reason: targetIndex === 0 ? "boundary" : "midpoint",
		};
	}

	if (!nextTask || !nextRank) {
		return {
			sortOrder: safeGenNext(targetRank).toString(),
			additionalWrites: [],
			reason: "boundary",
		};
	}

	return {
		sortOrder: safeBetween(targetRank, nextRank),
		additionalWrites: [],
		reason: "midpoint",
	};
}

/**
 * Apply a previously prepared sort-order plan using the configured mapping.
 */
export async function applySortOrderPlan(
	draggedPath: string,
	plan: SortOrderPlan,
	plugin: TaskNotesPlugin,
	options: { includeDragged?: boolean } = {}
): Promise<void> {
	if (!plan.sortOrder) return;

	for (const write of plan.additionalWrites) {
		await writeSortOrder(write.path, write.sortOrder, plugin);
	}

	if (options.includeDragged !== false) {
		await writeSortOrder(draggedPath, plan.sortOrder, plugin);
	}
}

/**
 * Per-task promise queue that serializes async drop operations on the same file.
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
