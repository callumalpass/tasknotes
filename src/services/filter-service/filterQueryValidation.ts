import {
	FILTER_PROPERTIES,
	type FilterNode,
	type FilterQuery,
	type TaskGroupKey,
	type TaskSortKey,
} from "../../types";
import type { UserMappedField } from "../../types/settings";
import { FilterUtils, FilterValidationError } from "../../utils/FilterUtils";
import { buildUserPropertyDefinitions } from "./filterOptions";
import { resolveUserFieldProperty } from "./userFieldValues";

const SORT_KEYS: readonly TaskSortKey[] = [
	"due",
	"scheduled",
	"priority",
	"status",
	"title",
	"dateCreated",
	"completedDate",
	"tags",
];
const GROUP_KEYS: readonly TaskGroupKey[] = [
	"none",
	"priority",
	"context",
	"project",
	"due",
	"scheduled",
	"status",
	"tags",
	"completedDate",
];

/** Validate the entire external query before indexes or task-level short-circuiting. */
export function normalizeExternalFilterQuery(
	query: FilterQuery,
	userFields: readonly UserMappedField[] = []
): FilterQuery {
	if (!query || query.type !== "group") {
		throw new FilterValidationError("Query must be a filter group");
	}

	const normalizeNode = (node: FilterNode): FilterNode => {
		// Leave malformed nodes for the structural validator to report.
		if (!node || typeof node !== "object") return node;
		if (node.type === "condition" && typeof node.property === "string") {
			const field = resolveUserFieldProperty(userFields, node.property);
			return {
				...node,
				property: field ? `user:${field.id || field.key}` : node.property,
			};
		}
		if (node.type === "group" && Array.isArray(node.children)) {
			return { ...node, children: node.children.map(normalizeNode) };
		}
		return node;
	};

	const normalized = normalizeNode(query) as FilterQuery;
	FilterUtils.validateFilterNode(normalized, true, [
		...FILTER_PROPERTIES,
		...buildUserPropertyDefinitions(userFields),
	]);

	const normalizeKey = <T extends TaskSortKey | TaskGroupKey>(
		key: T | undefined,
		allowed: readonly T[],
		name: string
	): T | undefined => {
		if (key === undefined) return undefined;
		const field =
			typeof key === "string" ? resolveUserFieldProperty(userFields, key) : undefined;
		if (field) return `user:${field.id || field.key}` as T;
		if (allowed.includes(key)) return key;
		throw new FilterValidationError(`Unknown ${name}: ${String(key)}`, name, query.id);
	};

	normalized.sortKey = normalizeKey(query.sortKey, SORT_KEYS, "sortKey");
	normalized.groupKey = normalizeKey(query.groupKey, GROUP_KEYS, "groupKey");
	normalized.subgroupKey = normalizeKey(query.subgroupKey, GROUP_KEYS, "subgroupKey");
	if (query.sortDirection !== undefined && !["asc", "desc"].includes(query.sortDirection)) {
		throw new FilterValidationError(
			"sortDirection must be asc or desc",
			"sortDirection",
			query.id
		);
	}
	return normalized;
}
