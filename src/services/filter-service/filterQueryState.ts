import type { FilterCondition, FilterQuery } from "../../types";

export type FilterQueryIdFactory = () => string;
export type QuickFilterToggle = "showCompleted" | "showArchived" | "showRecurrent";

type QuickToggleConditionDefinition = Pick<
	FilterCondition,
	"property" | "operator" | "value"
>;

const QUICK_TOGGLE_CONDITIONS: Record<
	QuickFilterToggle,
	QuickToggleConditionDefinition
> = {
	showCompleted: {
		property: "status.isCompleted",
		operator: "is-not-checked",
		value: null,
	},
	showArchived: {
		property: "archived",
		operator: "is-not-checked",
		value: null,
	},
	showRecurrent: {
		property: "recurrence",
		operator: "is-empty",
		value: null,
	},
};

export function createDefaultFilterQuery(generateId: FilterQueryIdFactory): FilterQuery {
	return {
		type: "group",
		id: generateId(),
		conjunction: "and",
		children: [],
		sortKey: "due",
		sortDirection: "asc",
		groupKey: "none",
	};
}

export function applyQuickToggleCondition(
	query: FilterQuery,
	toggle: QuickFilterToggle,
	enabled: boolean,
	generateId: FilterQueryIdFactory
): FilterQuery {
	const nextQuery = cloneFilterQuery(query);
	removeQuickToggleCondition(nextQuery, toggle);

	if (!enabled) {
		const definition = QUICK_TOGGLE_CONDITIONS[toggle];
		nextQuery.children.push({
			type: "condition",
			id: generateId(),
			...definition,
		});
	}

	return nextQuery;
}

export function normalizeFilterQuery(
	query: Partial<FilterQuery>,
	generateId: FilterQueryIdFactory
): FilterQuery {
	const defaultQuery = createDefaultFilterQuery(generateId);

	return {
		...defaultQuery,
		...query,
		type: "group",
		id: query.id || defaultQuery.id,
		conjunction: query.conjunction || defaultQuery.conjunction,
		children: query.children || defaultQuery.children,
		sortKey: query.sortKey || defaultQuery.sortKey,
		sortDirection: query.sortDirection || defaultQuery.sortDirection,
		groupKey: query.groupKey || defaultQuery.groupKey,
	};
}

function removeQuickToggleCondition(query: FilterQuery, toggle: QuickFilterToggle): void {
	const propertyToRemove = QUICK_TOGGLE_CONDITIONS[toggle].property;
	query.children = query.children.filter((child) => {
		if (child.type === "condition") {
			return child.property !== propertyToRemove;
		}
		return true;
	});
}

function cloneFilterQuery(query: FilterQuery): FilterQuery {
	return JSON.parse(JSON.stringify(query)) as FilterQuery;
}
