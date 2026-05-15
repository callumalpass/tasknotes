/**
 * Regression coverage for Issue #1784: Pinned columns in Kanban Bases view.
 *
 * Pinned columns:
 *  - render before non-pinned columns when no manual drag order exists
 *  - survive `hideEmptyColumns=true` even when empty
 *  - act as valid drop targets for any property type (status, priority, tags)
 *
 * Pure-function mirrors of the parser, augmenter, ordering, and visibility
 * filter from `src/bases/KanbanView.ts`.
 */

import { describe, it, expect } from "@jest/globals";

/** Mirrors the `pinnedColumns` parser in `KanbanView.readViewOptions()`. */
function parsePinnedColumns(raw: unknown): string[] {
	const source: unknown[] = Array.isArray(raw)
		? raw
		: typeof raw === "string"
			? raw.split(",")
			: [];
	const seen = new Set<string>();
	const result: string[] = [];
	for (const value of source) {
		const str = String(value ?? "").trim();
		if (str.length === 0 || seen.has(str)) continue;
		seen.add(str);
		result.push(str);
	}
	return result;
}

/** Mirrors `KanbanView.augmentWithPinnedColumns()`. */
function augmentWithPinnedColumns<T>(groups: Map<string, T[]>, pinnedColumns: string[]): void {
	for (const key of pinnedColumns) {
		if (!groups.has(key)) {
			groups.set(key, []);
		}
	}
}

/** Mirrors `KanbanView.applyColumnOrder()`. */
function applyColumnOrder(
	savedOrder: string[] | undefined,
	pinnedColumns: string[],
	actualKeys: string[]
): string[] {
	if (!savedOrder || savedOrder.length === 0) {
		if (pinnedColumns.length === 0) {
			return [...actualKeys].sort();
		}
		const pinnedPresent = pinnedColumns.filter((k) => actualKeys.includes(k));
		const remaining = actualKeys.filter((k) => !pinnedColumns.includes(k)).sort();
		return [...pinnedPresent, ...remaining];
	}

	const ordered: string[] = [];
	const unsorted: string[] = [];
	for (const key of savedOrder) {
		if (actualKeys.includes(key)) {
			ordered.push(key);
		}
	}
	for (const key of actualKeys) {
		if (!savedOrder.includes(key)) {
			unsorted.push(key);
		}
	}
	return [...ordered, ...unsorted.sort()];
}

/** Mirrors the `renderFlat()` visibility filter. */
function filterVisibleColumns<T>(
	orderedKeys: string[],
	groups: Map<string, T[]>,
	hideEmptyColumns: boolean,
	pinnedColumns: string[]
): string[] {
	const result: string[] = [];
	for (const groupKey of orderedKeys) {
		const tasks = groups.get(groupKey) ?? [];
		if (hideEmptyColumns && tasks.length === 0 && !pinnedColumns.includes(groupKey)) {
			continue;
		}
		result.push(groupKey);
	}
	return result;
}

interface MockTask {
	path: string;
	status?: string;
	priority?: string;
	tags?: string[];
}

describe("Issue #1784: Kanban pinned columns", () => {
	describe("parsePinnedColumns", () => {
		it("passes through a string array deduped", () => {
			expect(parsePinnedColumns(["backlog", "in-progress", "done"])).toEqual([
				"backlog",
				"in-progress",
				"done",
			]);
		});

		it("parses a comma-separated string into a trimmed array", () => {
			expect(parsePinnedColumns("backlog, in-progress ,done")).toEqual([
				"backlog",
				"in-progress",
				"done",
			]);
		});

		it("returns [] for undefined, null, numbers, and other non-array/non-string", () => {
			expect(parsePinnedColumns(undefined)).toEqual([]);
			expect(parsePinnedColumns(null)).toEqual([]);
			expect(parsePinnedColumns(42)).toEqual([]);
			expect(parsePinnedColumns({ a: 1 })).toEqual([]);
			expect(parsePinnedColumns(true)).toEqual([]);
		});

		it("drops empty and whitespace-only entries", () => {
			expect(parsePinnedColumns(["", "  ", "done", "\t"])).toEqual(["done"]);
			expect(parsePinnedColumns(", ,done, ,")).toEqual(["done"]);
		});

		it("removes duplicates preserving first-seen order", () => {
			expect(
				parsePinnedColumns(["done", "backlog", "done", "in-progress", "backlog"])
			).toEqual(["done", "backlog", "in-progress"]);
		});

		it("coerces non-string entries to string then trims", () => {
			expect(parsePinnedColumns([1, 2, "  3  ", null, undefined, "done"])).toEqual([
				"1",
				"2",
				"3",
				"done",
			]);
		});
	});

	describe("augmentWithPinnedColumns", () => {
		it("inserts an empty bucket for a pinned key missing from groups", () => {
			const groups = new Map<string, MockTask[]>();
			augmentWithPinnedColumns(groups, ["backlog"]);
			expect(groups.has("backlog")).toBe(true);
			expect(groups.get("backlog")).toEqual([]);
		});

		it("does not overwrite an existing populated bucket", () => {
			const existing: MockTask[] = [{ path: "a.md", status: "done" }];
			const groups = new Map<string, MockTask[]>([["done", existing]]);
			augmentWithPinnedColumns(groups, ["done"]);
			expect(groups.get("done")).toBe(existing);
			expect(groups.get("done")).toHaveLength(1);
		});

		it("iterates pinnedColumns regardless of groupBy property", () => {
			const groups = new Map<string, MockTask[]>([
				["high", [{ path: "a.md", priority: "high" }]],
			]);
			augmentWithPinnedColumns(groups, ["urgent", "low"]);
			expect([...groups.keys()].sort()).toEqual(["high", "low", "urgent"]);
			expect(groups.get("urgent")).toEqual([]);
			expect(groups.get("low")).toEqual([]);
		});
	});

	describe("applyColumnOrder (no saved order)", () => {
		it("falls back to alphabetical when pinnedColumns is empty", () => {
			expect(applyColumnOrder(undefined, [], ["c", "a", "b"])).toEqual(["a", "b", "c"]);
			expect(applyColumnOrder([], [], ["c", "a", "b"])).toEqual(["a", "b", "c"]);
		});

		it("renders pinned-first in array order, remaining alphabetical", () => {
			const result = applyColumnOrder(
				undefined,
				["backlog", "in-progress", "done"],
				["done", "backlog", "in-progress", "archived", "review"]
			);
			expect(result).toEqual(["backlog", "in-progress", "done", "archived", "review"]);
		});

		it("omits pinned keys not present in actualKeys (no phantom rendering)", () => {
			const result = applyColumnOrder(
				undefined,
				["backlog", "never-used", "done"],
				["done", "backlog", "review"]
			);
			expect(result).toEqual(["backlog", "done", "review"]);
			expect(result).not.toContain("never-used");
		});
	});

	describe("applyColumnOrder (saved order set)", () => {
		it("uses the saved drag order over pinnedColumns array order", () => {
			const result = applyColumnOrder(
				["done", "backlog", "in-progress"],
				["backlog", "in-progress", "done"],
				["backlog", "in-progress", "done"]
			);
			expect(result).toEqual(["done", "backlog", "in-progress"]);
		});

		it("appends new pinned keys not in saved order alphabetically", () => {
			const result = applyColumnOrder(
				["done", "backlog"],
				["backlog", "in-progress", "review"],
				["backlog", "done", "in-progress", "review"]
			);
			expect(result).toEqual(["done", "backlog", "in-progress", "review"]);
		});
	});

	describe("filterVisibleColumns", () => {
		const groups = new Map<string, MockTask[]>([
			["backlog", []],
			["in-progress", [{ path: "a.md" }]],
			["done", []],
			["review", [{ path: "b.md" }]],
		]);

		it("hides empty non-pinned columns when hideEmptyColumns is true", () => {
			const visible = filterVisibleColumns(
				["backlog", "in-progress", "done", "review"],
				groups,
				true,
				[]
			);
			expect(visible).toEqual(["in-progress", "review"]);
		});

		it("keeps empty pinned columns when hideEmptyColumns is true", () => {
			const visible = filterVisibleColumns(
				["backlog", "in-progress", "done", "review"],
				groups,
				true,
				["backlog", "done"]
			);
			expect(visible).toEqual(["backlog", "in-progress", "done", "review"]);
		});

		it("keeps non-empty columns regardless of pinned status", () => {
			const visible = filterVisibleColumns(["in-progress", "review"], groups, true, []);
			expect(visible).toEqual(["in-progress", "review"]);
		});

		it("keeps every column when hideEmptyColumns is false", () => {
			const visible = filterVisibleColumns(
				["backlog", "in-progress", "done", "review"],
				groups,
				false,
				[]
			);
			expect(visible).toEqual(["backlog", "in-progress", "done", "review"]);
		});
	});

	describe("Integration: parser + augmenter + ordering + filter", () => {
		function pipeline(
			rawPinned: unknown,
			groupedTasks: Map<string, MockTask[]>,
			savedOrder: string[] | undefined,
			hideEmptyColumns: boolean
		): string[] {
			const pinnedColumns = parsePinnedColumns(rawPinned);
			augmentWithPinnedColumns(groupedTasks, pinnedColumns);
			const ordered = applyColumnOrder(
				savedOrder,
				pinnedColumns,
				Array.from(groupedTasks.keys())
			);
			return filterVisibleColumns(ordered, groupedTasks, hideEmptyColumns, pinnedColumns);
		}

		it("groupBy=status: pinned trio, only done populated, hides others alphabetical", () => {
			const groups = new Map<string, MockTask[]>([
				["done", [{ path: "a.md", status: "done" }]],
				["archived", []],
			]);
			const visible = pipeline("backlog, in-progress, done", groups, undefined, true);
			expect(visible).toEqual(["backlog", "in-progress", "done"]);
		});

		it("groupBy=status: extra non-pinned non-empty column appears after pinned, alphabetical", () => {
			const groups = new Map<string, MockTask[]>([
				["done", [{ path: "a.md" }]],
				["review", [{ path: "b.md" }]],
			]);
			const visible = pipeline(["backlog", "in-progress", "done"], groups, undefined, true);
			expect(visible).toEqual(["backlog", "in-progress", "done", "review"]);
		});

		it("groupBy=priority: same shape works (property-agnostic)", () => {
			const groups = new Map<string, MockTask[]>([
				["high", [{ path: "a.md", priority: "high" }]],
			]);
			const visible = pipeline(["low", "normal", "high"], groups, undefined, true);
			expect(visible).toEqual(["low", "normal", "high"]);
		});

		it("groupBy=tags: same shape works (property-agnostic)", () => {
			const groups = new Map<string, MockTask[]>([
				["urgent", [{ path: "a.md", tags: ["urgent"] }]],
				["stale", []],
			]);
			const visible = pipeline(["waiting", "urgent"], groups, undefined, true);
			expect(visible).toEqual(["waiting", "urgent"]);
		});

		it("unknown pinned key (no matching tasks) renders as empty pinned column", () => {
			const groups = new Map<string, MockTask[]>([["done", [{ path: "a.md" }]]]);
			const visible = pipeline("totally-made-up, done", groups, undefined, true);
			expect(visible).toEqual(["totally-made-up", "done"]);
			expect(groups.get("totally-made-up")).toEqual([]);
		});
	});
});
