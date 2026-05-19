/**
 * Shared sort-order utilities for drag-to-reorder.
 * Used by both KanbanView and TaskListView.
 */
import { LexoRank as LexoRankValue } from "lexorank";
import { TFile } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { stringifyUnknown } from "../utils/stringUtils";

export interface SortOrderScopeFilter {
	property: string;
	value: string | null;
}

export interface SortOrderComputationOptions {
	scopeFilters?: SortOrderScopeFilter[];
	taskInfoCache?: Map<string, TaskInfo>;
	visibleTaskPaths?: string[];
	candidateTaskPaths?: string[];
}

export interface SortOrderWrite {
	path: string;
	sortOrder: string;
}

export interface SortOrderPlan {
	sortOrder: string | null;
	additionalWrites: SortOrderWrite[];
	reason: "midpoint" | "boundary" | "sparse-init" | "rebalance";
}

const REBALANCE_RANK_LENGTH_THRESHOLD = 32;
const BASES_SORT_COLLATOR = new Intl.Collator(undefined, {
	numeric: true,
	sensitivity: "base",
});
const ALPHA_RANK_PREFIX = "tn";
const ALPHA_RANK_WIDTH = 10;
const ALPHA_RANK_BASE = 26;
const ALPHA_RANK_MAX = Math.pow(ALPHA_RANK_BASE, ALPHA_RANK_WIDTH) - 1;
const ALPHA_RANK_PATTERN = /^tn[a-z]{10}$/;

type SortDirection = "asc" | "desc";
type SortConfigItem = {
	property?: unknown;
	column?: unknown;
	field?: unknown;
	id?: unknown;
	name?: unknown;
};
type SortConfigSource = {
	getSortConfig(): SortConfigItem | SortConfigItem[] | null | undefined;
};
type RankLike = {
	toString(): string;
	genPrev(): RankLike;
	genNext(): RankLike;
	between(other: RankLike): RankLike;
	isMax(): boolean;
};

class AlphaRank implements RankLike {
	constructor(private readonly value: number) {}

	toString(): string {
		return encodeAlphaRank(this.value);
	}

	genPrev(): RankLike {
		if (this.value <= 0) {
			throw new Error("Cannot generate rank before minimum alpha rank");
		}
		return new AlphaRank(this.value - 1);
	}

	genNext(): RankLike {
		if (this.value >= ALPHA_RANK_MAX) {
			throw new Error("Cannot generate rank after maximum alpha rank");
		}
		return new AlphaRank(this.value + 1);
	}

	between(other: RankLike): RankLike {
		const otherValue = decodeAlphaRank(other.toString());
		if (otherValue === null) {
			throw new Error("Cannot generate alpha midpoint against a non-alpha rank");
		}
		const lower = Math.min(this.value, otherValue);
		const upper = Math.max(this.value, otherValue);
		const midpoint = Math.floor((lower + upper) / 2);
		if (midpoint <= lower || midpoint >= upper) {
			throw new Error("No alpha rank gap available");
		}
		return new AlphaRank(midpoint);
	}

	isMax(): boolean {
		return this.value >= ALPHA_RANK_MAX;
	}
}

function encodeAlphaRank(value: number): string {
	let remaining = Math.max(0, Math.min(ALPHA_RANK_MAX, Math.floor(value)));
	const chars = Array<string>(ALPHA_RANK_WIDTH);
	for (let index = ALPHA_RANK_WIDTH - 1; index >= 0; index--) {
		chars[index] = String.fromCharCode(97 + (remaining % ALPHA_RANK_BASE));
		remaining = Math.floor(remaining / ALPHA_RANK_BASE);
	}
	return `${ALPHA_RANK_PREFIX}${chars.join("")}`;
}

function decodeAlphaRank(value: string): number | null {
	if (!ALPHA_RANK_PATTERN.test(value)) {
		return null;
	}

	let result = 0;
	for (const char of value.slice(ALPHA_RANK_PREFIX.length)) {
		result = result * ALPHA_RANK_BASE + (char.charCodeAt(0) - 97);
	}
	return result;
}

function createAlphaRankForDisplayIndex(
	index: number,
	total: number,
	direction: SortDirection
): string {
	const step = Math.max(1, Math.floor(ALPHA_RANK_MAX / (total + 1)));
	const ordinal = direction === "asc" ? index + 1 : total - index;
	return encodeAlphaRank(step * ordinal);
}

function compareRankStringsForBases(left: string, right: string): number {
	const collated = BASES_SORT_COLLATOR.compare(left, right);
	return collated !== 0 ? collated : left.localeCompare(right);
}

function compareDisplaySortStrings(
	left: string,
	right: string,
	direction: SortDirection
): number {
	return direction === "asc"
		? compareRankStringsForBases(left, right)
		: compareRankStringsForBases(right, left);
}

function isCandidateInDisplayPosition(
	candidate: string,
	previous: string | null,
	next: string | null,
	direction: SortDirection
): boolean {
	if (previous && compareDisplaySortStrings(previous, candidate, direction) >= 0) {
		return false;
	}
	if (next && compareDisplaySortStrings(candidate, next, direction) >= 0) {
		return false;
	}
	return true;
}

function parseRank(value: string): RankLike {
	return LexoRankValue.parse(value);
}

function middleRank(): RankLike {
	return new AlphaRank(Math.floor(ALPHA_RANK_MAX / 2));
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
export function isSortOrderInSortConfig(dataAdapter: SortConfigSource, sortOrderField: string): boolean {
	try {
		const sortConfig = dataAdapter.getSortConfig();
		if (!sortConfig) return false;

		const configs = Array.isArray(sortConfig) ? sortConfig : [sortConfig];
		return configs.some((s) => {
			if (!s || typeof s !== "object") return false;
			const candidate = s.property || s.column || s.field || s.id || s.name || "";
			const clean = stringifyUnknown(candidate).replace(/^(note\.|file\.|task\.)/, "");
			return clean === sortOrderField;
		});
	} catch {
		return false;
	}
}

function tryParseSortRank(value: string | undefined): RankLike | null {
	if (typeof value !== "string" || value.length === 0) return null;
	const alphaRankValue = decodeAlphaRank(value);
	if (alphaRankValue !== null) return new AlphaRank(alphaRankValue);
	try {
		return parseRank(value);
	} catch {
		return null;
	}
}

function hasValidSortRank(task: TaskInfo): boolean {
	return tryParseSortRank(task.sortOrder) !== null;
}

function shouldRebalanceRank(rank: RankLike | null): boolean {
	if (!rank) return false;
	return rank.isMax() || rank.toString().length > REBALANCE_RANK_LENGTH_THRESHOLD;
}

function frontmatterValueToGroupString(value: unknown): string {
	if (value === null || value === undefined || value === "") return "None";
	if (typeof value === "string") return value;
	if (typeof value === "boolean") return value ? "True" : "False";
	if (typeof value === "number") return String(value);
	return stringifyUnknown(value) || "None";
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

function getVisibleOrderedTasks(
	columnTasks: TaskInfo[],
	visibleTaskPaths: string[] | undefined,
	draggedPath: string
): TaskInfo[] {
	if (!visibleTaskPaths || visibleTaskPaths.length === 0) {
		return columnTasks.filter((task) => task.path !== draggedPath);
	}

	const taskByPath = new Map(columnTasks.map((task) => [task.path, task]));
	const orderedVisibleTasks = visibleTaskPaths
		.filter((path) => path !== draggedPath)
		.map((path) => taskByPath.get(path))
		.filter((task): task is TaskInfo => !!task);

	return orderedVisibleTasks.length > 0
		? orderedVisibleTasks
		: columnTasks.filter((task) => task.path !== draggedPath);
}

function inferSortDirection(tasks: TaskInfo[]): SortDirection {
	for (let index = 1; index < tasks.length; index++) {
		const previousRank = tryParseSortRank(tasks[index - 1].sortOrder);
		const currentRank = tryParseSortRank(tasks[index].sortOrder);
		if (!previousRank || !currentRank) continue;

		const comparison = compareRankStringsForBases(previousRank.toString(), currentRank.toString());
		if (comparison < 0) return "asc";
		if (comparison > 0) return "desc";
	}

	return "asc";
}

function compareInDisplayOrder(left: RankLike, right: RankLike, direction: SortDirection): number {
	return direction === "asc"
		? compareRankStringsForBases(left.toString(), right.toString())
		: compareRankStringsForBases(right.toString(), left.toString());
}

function rankBeforeInDisplay(targetRank: RankLike, direction: SortDirection): RankLike {
	return direction === "asc" ? safeGenPrev(targetRank) : safeGenNext(targetRank);
}

function rankAfterInDisplay(targetRank: RankLike, direction: SortDirection): RankLike {
	return direction === "asc" ? safeGenNext(targetRank) : safeGenPrev(targetRank);
}

function betweenInDisplayOrder(
	leftRank: RankLike,
	rightRank: RankLike,
	direction: SortDirection
): string {
	return direction === "asc"
		? safeBetween(leftRank, rightRank)
		: safeBetween(rightRank, leftRank);
}

function safeGenNext(rank: RankLike): RankLike {
	const str = rank.toString();
	try {
		const result = rank.genNext();
		if (result.toString() > str) return result;
	} catch {
		// Fall through to conservative fallback logic.
	}

	const alphaRankValue = decodeAlphaRank(str);
	if (alphaRankValue !== null) {
		return new AlphaRank(ALPHA_RANK_MAX);
	}

	const pipeIdx = str.indexOf("|");
	const colonIdx = str.indexOf(":");
	const bucket = str.substring(0, pipeIdx);
	const value = str.substring(pipeIdx + 1, colonIdx);
	const decimal = str.substring(colonIdx + 1);
	const firstChar = value.charAt(0);

	if (firstChar !== "z") {
		const nextFirst =
			firstChar >= "0" && firstChar <= "8"
				? String.fromCharCode(firstChar.charCodeAt(0) + 1)
				: firstChar === "9"
					? "a"
					: firstChar >= "a" && firstChar <= "y"
						? String.fromCharCode(firstChar.charCodeAt(0) + 1)
						: "z";
		const upperStr = `${bucket}|${nextFirst}${value.slice(1)}:`;
		const result = rank.between(parseRank(upperStr));
		if (result.toString() > str) return result;
	}

	return parseRank(`${bucket}|${value}:${decimal}i`);
}

function safeGenPrev(rank: RankLike): RankLike {
	const str = rank.toString();
	try {
		const result = rank.genPrev();
		if (result.toString() < str) return result;
	} catch {
		// Fall through to conservative fallback logic.
	}

	const alphaRankValue = decodeAlphaRank(str);
	if (alphaRankValue !== null) {
		return new AlphaRank(0);
	}

	const pipeIdx = str.indexOf("|");
	const colonIdx = str.indexOf(":");
	const bucket = str.substring(0, pipeIdx);
	const value = str.substring(pipeIdx + 1, colonIdx);
	const firstChar = value.charAt(0);

	let lowerStr: string;
	if (firstChar === "0") {
		lowerStr = `${bucket}|0:`;
	} else {
		const prevFirst =
			firstChar >= "1" && firstChar <= "9"
				? String.fromCharCode(firstChar.charCodeAt(0) - 1)
				: firstChar === "a"
					? "9"
					: firstChar >= "b" && firstChar <= "z"
						? String.fromCharCode(firstChar.charCodeAt(0) - 1)
						: "0";
		lowerStr = `${bucket}|${prevFirst}${value.slice(1)}:`;
	}

	return parseRank(lowerStr).between(rank);
}

function safeBetween(aboveRank: RankLike, belowRank: RankLike): string {
	const aboveStr = aboveRank.toString();
	const belowStr = belowRank.toString();

	try {
		const result = aboveRank.between(belowRank).toString();
		if (
			compareRankStringsForBases(result, aboveStr) > 0 &&
			compareRankStringsForBases(result, belowStr) < 0
		) {
			return result;
		}
	} catch {
		// Fall through to safer directional fallbacks.
	}

	const next = safeGenNext(aboveRank).toString();
	if (
		compareRankStringsForBases(next, aboveStr) > 0 &&
		compareRankStringsForBases(next, belowStr) < 0
	)
		return next;

	const prev = safeGenPrev(belowRank).toString();
	if (
		compareRankStringsForBases(prev, aboveStr) > 0 &&
		compareRankStringsForBases(prev, belowStr) < 0
	)
		return prev;

	return next;
}

function createRebalancePlan(
	columnTasks: TaskInfo[],
	targetIndex: number,
	above: boolean,
	direction: SortDirection
): SortOrderPlan {
	const insertAt = above ? targetIndex : targetIndex + 1;
	const orderedPaths: Array<string | null> = columnTasks.map((task) => task.path);
	orderedPaths.splice(insertAt, 0, null);

	const additionalWrites: SortOrderWrite[] = [];
	let draggedSortOrder: string | null = null;

	for (let index = 0; index < orderedPaths.length; index++) {
		const rankString = createAlphaRankForDisplayIndex(
			index,
			orderedPaths.length,
			direction
		);
		const path = orderedPaths[index];
		if (path === null) {
			draggedSortOrder = rankString;
		} else {
			additionalWrites.push({ path, sortOrder: rankString });
		}
	}

	return {
		sortOrder: draggedSortOrder,
		additionalWrites,
		reason: "rebalance",
	};
}

export function generateEndRank(): string {
	return encodeAlphaRank(ALPHA_RANK_MAX - 1);
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
	const candidateTaskPathSet = options.candidateTaskPaths
		? new Set(options.candidateTaskPaths)
		: null;
	const allFiles = plugin.app.vault.getMarkdownFiles();
	const tasks: TaskInfo[] = [];

	for (const file of allFiles) {
		if (candidateTaskPathSet && !candidateTaskPathSet.has(file.path)) {
			continue;
		}

		const frontmatter = plugin.app.metadataCache.getFileCache(file)?.frontmatter;
		if (!frontmatter) continue;

		if (
			groupKey !== null &&
			groupByProperty &&
			!matchesGroupValue(frontmatter[groupByProperty], groupKey)
		) {
			continue;
		}

		if (
			options.scopeFilters?.some(
				(filter) => !matchesGroupValue(frontmatter[filter.property], filter.value)
			)
		) {
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
		});
	}

	tasks.sort((a, b) => {
		const aRank = tryParseSortRank(a.sortOrder);
		const bRank = tryParseSortRank(b.sortOrder);
		if (aRank && bRank) {
			const diff = compareRankStringsForBases(aRank.toString(), bRank.toString());
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

async function writeSortOrder(
	path: string,
	sortOrder: string,
	plugin: TaskNotesPlugin
): Promise<void> {
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
	const columnTasks = getGroupTasks(groupKey, groupByProperty, plugin, options).filter(
		(task) => task.path !== draggedPath
	);
	const orderedTasks = getVisibleOrderedTasks(columnTasks, options.visibleTaskPaths, draggedPath);
	const sortDirection = inferSortDirection(orderedTasks);

	if (columnTasks.length === 0) {
		return {
			sortOrder: middleRank().toString(),
			additionalWrites: [],
			reason: "boundary",
		};
	}

	const targetIndex = orderedTasks.findIndex((task) => task.path === targetTaskPath);
	if (targetIndex === -1) {
		const lastRankedTask = [...orderedTasks].reverse().find((task) => hasValidSortRank(task));
		const lastRank = lastRankedTask ? tryParseSortRank(lastRankedTask.sortOrder) : null;
		if (lastRank && !shouldRebalanceRank(lastRank)) {
			const sortOrder = rankAfterInDisplay(lastRank, sortDirection).toString();
			if (isCandidateInDisplayPosition(sortOrder, lastRank.toString(), null, sortDirection)) {
				return {
					sortOrder,
					additionalWrites: [],
					reason: "boundary",
				};
			}
		}

		if (orderedTasks.length > 0) {
			return createRebalancePlan(orderedTasks, orderedTasks.length - 1, false, sortDirection);
		}

		return {
			sortOrder: middleRank().toString(),
			additionalWrites: [],
			reason: "boundary",
		};
	}

	const targetTask = orderedTasks[targetIndex];
	const previousTask = targetIndex > 0 ? orderedTasks[targetIndex - 1] : null;
	const nextTask = targetIndex < orderedTasks.length - 1 ? orderedTasks[targetIndex + 1] : null;
	const targetRank = tryParseSortRank(targetTask.sortOrder);
	const previousRank = previousTask ? tryParseSortRank(previousTask.sortOrder) : null;
	const nextRank = nextTask ? tryParseSortRank(nextTask.sortOrder) : null;

	if (!targetRank) {
		return createRebalancePlan(orderedTasks, targetIndex, above, sortDirection);
	}

	const previousBoundaryInvalid = previousRank
		? compareInDisplayOrder(previousRank, targetRank, sortDirection) >= 0
		: false;
	const nextBoundaryInvalid = nextRank
		? compareInDisplayOrder(targetRank, nextRank, sortDirection) >= 0
		: false;

	if ((above && previousBoundaryInvalid) || (!above && nextBoundaryInvalid)) {
		return createRebalancePlan(orderedTasks, targetIndex, above, sortDirection);
	}

	if (
		shouldRebalanceRank(previousRank) ||
		shouldRebalanceRank(targetRank) ||
		shouldRebalanceRank(nextRank)
	) {
		return createRebalancePlan(orderedTasks, targetIndex, above, sortDirection);
	}

	if (above) {
		const sortOrder =
			targetIndex === 0
				? rankBeforeInDisplay(targetRank, sortDirection).toString()
				: previousRank
					? betweenInDisplayOrder(previousRank, targetRank, sortDirection)
					: rankBeforeInDisplay(targetRank, sortDirection).toString();
		if (
			!isCandidateInDisplayPosition(
				sortOrder,
				previousRank?.toString() ?? null,
				targetRank.toString(),
				sortDirection
			)
		) {
			return createRebalancePlan(orderedTasks, targetIndex, above, sortDirection);
		}
		return {
			sortOrder,
			additionalWrites: [],
			reason: targetIndex === 0 ? "boundary" : "midpoint",
		};
	}

	if (!nextTask || !nextRank) {
		const sortOrder = rankAfterInDisplay(targetRank, sortDirection).toString();
		if (!isCandidateInDisplayPosition(sortOrder, targetRank.toString(), null, sortDirection)) {
			return createRebalancePlan(orderedTasks, targetIndex, above, sortDirection);
		}
		return {
			sortOrder,
			additionalWrites: [],
			reason: "boundary",
		};
	}

	const sortOrder = betweenInDisplayOrder(targetRank, nextRank, sortDirection);
	if (
		!isCandidateInDisplayPosition(
			sortOrder,
			targetRank.toString(),
			nextRank.toString(),
			sortDirection
		)
	) {
		return createRebalancePlan(orderedTasks, targetIndex, above, sortDirection);
	}

	return {
		sortOrder,
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
