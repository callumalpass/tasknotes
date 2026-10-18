import { planTaskListMovement, taskListDestinationKey } from "../../../src/bases/taskListMovement";
import {
	applyGroupPropertyMutation,
	getListMembers,
	getMovedListMembers,
	moveGroupListValue,
} from "../../../src/bases/groupPropertyMutation";
import type { FieldMapping } from "../../../src/types";

const defaults = {
	groupByPropertyId: "note.status",
	subGroupPropertyId: "note.priority",
	source: { groupKey: "open", subGroupKey: "high" },
	target: { groupKey: "open", subGroupKey: "low" },
	canReorder: false,
	isHeader: false,
	lookupMappingKey: (property: string): keyof FieldMapping | null =>
		["status", "priority", "contexts"].includes(property)
			? (property as keyof FieldMapping)
			: null,
	isListTypeProperty: (property: string) => ["contexts", "projects", "tags"].includes(property),
};

describe("List movement intentions", () => {
	it("moves between subgroups without manual sorting", () => {
		const plan = planTaskListMovement(defaults);
		expect(plan.kind).toBe("move");
		expect(plan.changes.map((change) => change.frontmatterKey)).toEqual(["priority"]);
	});

	it("changes both destination properties, even when manual sorting is enabled", () => {
		const plan = planTaskListMovement({
			...defaults,
			canReorder: true,
			target: { groupKey: "done", subGroupKey: "low" },
		});
		expect(plan.kind).toBe("move");
		expect(plan.changes.map((change) => change.frontmatterKey)).toEqual(["status", "priority"]);
	});

	it("does not guess a subgroup when dropping on a primary header", () => {
		const plan = planTaskListMovement({
			...defaults,
			isHeader: true,
			target: { groupKey: "done" },
		});
		expect(plan.changes.map((change) => change.frontmatterKey)).toEqual(["status"]);
	});

	it("makes same-group drops a no-op under non-manual sorting", () => {
		expect(planTaskListMovement({ ...defaults, target: defaults.source }).kind).toBe("none");
	});

	it("only reorders within an unchanged destination, not on a header", () => {
		expect(
			planTaskListMovement({ ...defaults, canReorder: true, target: defaults.source }).kind
		).toBe("reorder");
		expect(
			planTaskListMovement({
				...defaults,
				canReorder: true,
				isHeader: true,
				target: defaults.source,
			}).kind
		).toBe("none");
	});

	it("treats subgroup-only views as single-dimensional movement", () => {
		const plan = planTaskListMovement({
			...defaults,
			groupByPropertyId: null,
			source: { groupKey: "high" },
			target: { groupKey: "low" },
		});
		expect(plan.kind).toBe("move");
		expect(plan.changes.map((change) => change.frontmatterKey)).toEqual(["priority"]);
	});

	it("allows editable subgroup changes inside an unchanged formula group", () => {
		expect(
			planTaskListMovement({ ...defaults, groupByPropertyId: "formula.bucket" }).kind
		).toBe("move");
	});

	it("blocks the entire move if either changed dimension is read-only", () => {
		const plan = planTaskListMovement({
			...defaults,
			groupByPropertyId: "formula.bucket",
			target: { groupKey: "done", subGroupKey: "low" },
		});
		expect(plan.kind).toBe("blocked");
		expect(plan.readOnlyProperties).toEqual(["formula.bucket"]);
		expect(planTaskListMovement({ ...defaults, subGroupPropertyId: "file.folder" }).kind).toBe(
			"blocked"
		);
	});

	it("does not confuse empty groups with a changed value", () => {
		const plan = planTaskListMovement({
			...defaults,
			source: { groupKey: "None" },
			target: { groupKey: null },
			subGroupPropertyId: null,
		});
		expect(plan.kind).toBe("none");
	});

	it.each(["dateModified", "sortOrder"] as const)("does not assign TaskNotes-managed %s as a grouping value", property => {
		const plan = planTaskListMovement({
			groupByPropertyId: `note.${property}`, subGroupPropertyId: null,
			source: { groupKey: "before" }, target: { groupKey: "after" }, canReorder: false, isHeader: true,
			lookupMappingKey: () => property, isListTypeProperty: () => false,
		});
		expect(plan.kind).toBe("blocked");
	});

	it("distinguishes primary headers from clearing a subgroup", () => {
		expect(taskListDestinationKey({ groupKey: "open" })).not.toBe(taskListDestinationKey({ groupKey: "open", subGroupKey: null }));
	});

	it("does not derive destinations by splitting titles or composite keys", () => {
		expect(taskListDestinationKey({ groupKey: "work:home", subGroupKey: "low" })).not.toBe(
			taskListDestinationKey({ groupKey: "work", subGroupKey: "home:low" })
		);
	});
});

describe("unresolved list destinations", () => {
	const listMove = {
		...defaults,
		groupByPropertyId: "note.contexts",
		subGroupPropertyId: null,
		source: { groupKey: "work" },
	};

	it("blocks a populated list group whose members record no values", () => {
		const plan = planTaskListMovement({
			...listMove,
			target: { groupKey: "#inline", groupValuesUnresolved: true },
		});
		expect(plan.kind).toBe("blocked");
		expect(plan.unresolvedProperties).toEqual(["note.contexts"]);
		expect(plan.readOnlyProperties).toEqual([]);
	});

	it("still allows clearing a list or targeting resolved values", () => {
		expect(
			planTaskListMovement({
				...listMove,
				target: { groupKey: "None", groupValuesUnresolved: false },
			}).kind
		).toBe("move");
		expect(
			planTaskListMovement({
				...listMove,
				target: { groupKey: "home", groupValues: ["home"], groupValuesUnresolved: true },
			}).kind
		).toBe("move");
	});

	it("ignores the unresolved flag for scalar properties", () => {
		const plan = planTaskListMovement({
			...defaults,
			target: { groupKey: "open", subGroupKey: "low", subGroupValuesUnresolved: true },
		});
		expect(plan.kind).toBe("move");
	});
});

describe("shared List/Kanban group mutation", () => {
	it("preserves unrelated memberships and avoids duplicates", () => {
		expect(moveGroupListValue(["work", "home", "focus"], "work", "focus")).toEqual([
			"home",
			"focus",
		]);
	});

	it("removes the source when moving into an empty destination", () => {
		expect(moveGroupListValue(["work", "home"], "work", "None")).toEqual(["home"]);
	});

	it("uses actual list values, not a comma-separated display title", () => {
		expect(
			moveGroupListValue(
				["work", "call", "other"],
				"work, call",
				"home, focus",
				["work", "call"],
				["home", "focus"]
			)
		).toEqual(["other", "home", "focus"]);
	});

	it("matches numeric list members by value rather than their joined label", () => {
		expect(moveGroupListValue([12, 13], "12, 13", "20", [12, 13], [20])).toEqual([20]);
	});

	it("replaces the task's whole current list when given its own members", () => {
		const current = ["[[A|Alias]]", "[[B]]"];
		expect(
			moveGroupListValue(current, "A, B", "C", getListMembers(current), ["[[C]]"])
		).toEqual(["[[C]]"]);
	});

	it("keeps a value added by another edit while the task was being moved", () => {
		const frontmatter: Record<string, unknown> = { projects: ["[[A]]", "[[Added meanwhile]]"] };
		applyGroupPropertyMutation({
			frontmatter,
			property: "projects",
			sourceValue: "A",
			targetValue: "C",
			isList: true,
			sourceValues: getMovedListMembers(
				{ projects: ["[[A]]"] },
				"projects",
				frontmatter.projects
			),
			targetValues: ["[[C]]"],
			coerceValue: (_property, value) => value,
		});
		expect(frontmatter.projects).toEqual(["[[Added meanwhile]]", "[[C]]"]);
	});

	it("normalizes scalar and empty list values to members", () => {
		expect(getListMembers("work")).toEqual(["work"]);
		expect(getListMembers("")).toEqual([]);
		expect(getListMembers(null)).toEqual([]);
		expect(getListMembers(0)).toEqual([0]);
	});

	it("does not discard false or zero values as empty", () => {
		expect(moveGroupListValue(false, "other", "next")).toEqual([false, "next"]);
		expect(moveGroupListValue(0, "other", "next")).toEqual([0, "next"]);
	});

	it("clears scalar properties rather than persisting the empty-group display label", () => {
		const frontmatter = { priority: "high" };
		applyGroupPropertyMutation({
			frontmatter,
			property: "priority",
			sourceValue: "high",
			targetValue: "None",
			isList: false,
			coerceValue: (_property, value) => value,
		});
		expect(frontmatter).toEqual({});
	});

	it("preserves typed numeric and checkbox values", () => {
		const frontmatter: Record<string, unknown> = {};
		applyGroupPropertyMutation({
			frontmatter,
			property: "effort",
			sourceValue: null,
			targetValue: "0",
			isList: false,
			coerceValue: (_property, value) => Number(value),
		});
		applyGroupPropertyMutation({
			frontmatter,
			property: "reviewed",
			sourceValue: null,
			targetValue: "False",
			isList: false,
			coerceValue: () => false,
		});
		expect(frontmatter).toEqual({ effort: 0, reviewed: false });
	});
});
