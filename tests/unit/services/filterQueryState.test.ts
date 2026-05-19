import {
	applyQuickToggleCondition,
	createDefaultFilterQuery,
	normalizeFilterQuery,
} from "../../../src/services/filter-service/filterQueryState";
import type { FilterQuery } from "../../../src/types";

function idFactory(ids: string[]): () => string {
	let index = 0;
	return () => ids[index++] ?? `generated-${index}`;
}

describe("filterQueryState", () => {
	it("creates the default filter query shape", () => {
		expect(createDefaultFilterQuery(idFactory(["query-1"]))).toEqual({
			type: "group",
			id: "query-1",
			conjunction: "and",
			children: [],
			sortKey: "due",
			sortDirection: "asc",
			groupKey: "none",
		});
	});

	it("adds disabled quick-toggle conditions and removes stale root toggle conditions", () => {
		const query: FilterQuery = {
			type: "group",
			id: "root",
			conjunction: "and",
			children: [
				{
					type: "condition",
					id: "old",
					property: "archived",
					operator: "is-checked",
					value: null,
				},
				{
					type: "condition",
					id: "keep",
					property: "priority",
					operator: "is",
					value: "high",
				},
			],
		};

		const nextQuery = applyQuickToggleCondition(
			query,
			"showArchived",
			false,
			idFactory(["new"])
		);

		expect(nextQuery).not.toBe(query);
		expect(query.children).toHaveLength(2);
		expect(nextQuery.children).toEqual([
			query.children[1],
			{
				type: "condition",
				id: "new",
				property: "archived",
				operator: "is-not-checked",
				value: null,
			},
		]);
	});

	it("removes a quick-toggle condition when the toggle is enabled", () => {
		const query: FilterQuery = {
			type: "group",
			id: "root",
			conjunction: "and",
			children: [
				{
					type: "condition",
					id: "completed",
					property: "status.isCompleted",
					operator: "is-not-checked",
					value: null,
				},
			],
		};

		expect(
			applyQuickToggleCondition(query, "showCompleted", true, idFactory(["unused"]))
		).toEqual({
			...query,
			children: [],
		});
	});

	it("normalizes partial queries without discarding explicit children", () => {
		const children: FilterQuery["children"] = [
			{
				type: "condition",
				id: "title",
				property: "title",
				operator: "contains",
				value: "report",
			},
		];

		expect(
			normalizeFilterQuery(
				{
					id: "saved",
					children,
					sortKey: "priority",
					sortDirection: "desc",
				},
				idFactory(["default"])
			)
		).toEqual({
			type: "group",
			id: "saved",
			conjunction: "and",
			children,
			sortKey: "priority",
			sortDirection: "desc",
			groupKey: "none",
		});
	});
});
