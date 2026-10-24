import { uiText } from "../i18n/runtime";
import { msg } from "@lingui/core/macro";
/* eslint-disable @typescript-eslint/no-non-null-assertion -- Group tree traversal checks parent nodes before dereferencing. */
import { TaskGroupKey, TaskInfo } from "../types";
import type { UserMappedField } from "../types/settings";

function valueToGroupString(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "string") return value.trim();
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return "";
}

/**
 * Pure service that computes hierarchical grouping
 * Returns Map<primaryGroup, Map<subgroup, TaskInfo[]>>
 */
export class HierarchicalGroupingService {
	constructor(
		private resolveUserFieldValues?: (task: TaskInfo, fieldIdOrKey: string) => string[]
	) {}

	group(
		tasks: TaskInfo[],
		primaryKey: TaskGroupKey,
			subgroupKey: TaskGroupKey,
			sortDirection: "asc" | "desc" = "asc",
			userFields: UserMappedField[] = []
	): Map<string, Map<string, TaskInfo[]>> {
		const hierarchical = new Map<string, Map<string, TaskInfo[]>>();
		const missingLabels = new Set<string>();
		const missing = (label: string): string => { missingLabels.add(label); return label; };

		const getValues = (task: TaskInfo, key: TaskGroupKey): string[] => {
			if (!key || key === "none") return ["all"];

				const normalizeArray = (arr: unknown[]): string[] => {
					const cleaned = arr.map(valueToGroupString).filter((s) => s !== "");
					return cleaned.length ? cleaned : [];
				};

			if (key.startsWith("user:")) {
				const fieldIdOrKey = key.slice("user:".length);
				const fieldLabel = userFields.find((field) => (field.id || field.key) === fieldIdOrKey)?.displayName || fieldIdOrKey;
				if (this.resolveUserFieldValues) {
					const resolved = this.resolveUserFieldValues(task, fieldIdOrKey) || [];
					const cleaned = normalizeArray(resolved);
					return cleaned.length ? cleaned : [missing(uiText(msg({ message: "No {fieldIdOrKey}", context: "services/HierarchicalGroupingService: HierarchicalGroupingService.group.getValues display" }), { fieldIdOrKey: fieldLabel }))];
					}
					// Fallback to customProperties if resolver not provided
					const value = task.customProperties?.[fieldIdOrKey];
					if (Array.isArray(value)) {
						const cleaned = normalizeArray(value);
						return cleaned.length ? cleaned : [missing(uiText(msg({ message: "No {fieldIdOrKey}", context: "services/HierarchicalGroupingService: HierarchicalGroupingService.group.getValues display" }), { fieldIdOrKey: fieldLabel }))];
					}
					const str = valueToGroupString(value);
				return str !== "" ? [str] : [missing(uiText(msg({ message: "No {fieldIdOrKey}", context: "services/HierarchicalGroupingService: HierarchicalGroupingService.group.getValues display" }), { fieldIdOrKey: fieldLabel }))];
			}

			switch (key) {
				case "status": {
					const v = (task.status ?? "").trim() || missing(uiText(msg({ message: "No Status", context: "services/HierarchicalGroupingService: HierarchicalGroupingService.group.getValues display" })));
					return [v];
				}
				case "priority": {
					const v = (task.priority ?? "").trim() || missing(uiText(msg({ message: "No Priority", context: "services/HierarchicalGroupingService: HierarchicalGroupingService.group.getValues display" })));
					return [v];
				}
				case "context": {
					const arr = normalizeArray(task.contexts ?? []);
					return arr.length ? arr : [missing(uiText(msg({ message: "No Context", context: "services/HierarchicalGroupingService: HierarchicalGroupingService.group.getValues display" })))];
				}
				case "project": {
					const arr = normalizeArray(task.projects ?? []).map((s) => {
						const m = s.match(/^\[\[([^|\]]+)(?:\|([^\]]+))?\]\]$/);
						if (m) {
							const target = m[1] || "";
							const alias = m[2];
							const base = alias || target.split("#")[0].split("/").pop() || target;
							return base || s;
						}
						return s;
					});
					// Deduplicate
					const uniq: string[] = [];
					const seen = new Set<string>();
					for (const v of arr) {
						if (!seen.has(v)) {
							seen.add(v);
							uniq.push(v);
						}
					}
					return uniq.length ? uniq : [missing(uiText(msg({ message: "No Project", context: "services/HierarchicalGroupingService: HierarchicalGroupingService.group.getValues display" })))];
				}
				case "tags": {
					const arr = normalizeArray(task.tags ?? []);
					return arr.length ? arr : [missing(uiText(msg({ message: "No Tag", context: "services/HierarchicalGroupingService: HierarchicalGroupingService.group.getValues display" })))];
				}
				case "due": {
					const d = (task.due ?? "").trim();
					return d ? [d.split("T")[0]] : [missing(uiText(msg({ message: "No Due Date", context: "services/HierarchicalGroupingService: HierarchicalGroupingService.group.getValues display" })))];
				}
				case "scheduled": {
					const s = (task.scheduled ?? "").trim();
					return s ? [s.split("T")[0]] : [missing(uiText(msg({ message: "No Scheduled Date", context: "services/HierarchicalGroupingService: HierarchicalGroupingService.group.getValues display" })))];
				}
					default: {
						// Fallback to a direct property if present
						const anyTask = task as unknown as Record<string, unknown>;
						const v = anyTask[key];
						if (Array.isArray(v)) {
							const arr = normalizeArray(v);
							return arr.length ? arr : [missing(uiText(msg({ message: "No {key}", context: "services/HierarchicalGroupingService: HierarchicalGroupingService.group.getValues display" }), { key: key }))];
						}
						const str = valueToGroupString(v);
					return str !== "" ? [str] : [missing(uiText(msg({ message: "No {key}", context: "services/HierarchicalGroupingService: HierarchicalGroupingService.group.getValues display" }), { key: key }))];
				}
			}
		};

		for (const task of tasks) {
			const primaries = getValues(task, primaryKey);
			const subs = getValues(task, subgroupKey);

			for (const p of primaries) {
				if (!hierarchical.has(p)) hierarchical.set(p, new Map());
				const subMap = hierarchical.get(p)!;
				for (const s of subs) {
					if (!subMap.has(s)) subMap.set(s, []);
					subMap.get(s)!.push(task);
				}
			}
		}

		// Sort subgroups within each primary group
		const sortedHierarchical = new Map<string, Map<string, TaskInfo[]>>();
		for (const [primaryName, subgroups] of hierarchical) {
			const sortedSubgroups = this.sortSubgroups(
				subgroups,
				subgroupKey,
				sortDirection,
				userFields,
				missingLabels
			);
			sortedHierarchical.set(primaryName, sortedSubgroups);
		}

		return sortedHierarchical;
	}

	/**
	 * Sort subgroups consistently with AgendaView logic
	 */
	private sortSubgroups(
		subgroups: Map<string, TaskInfo[]>,
		subgroupKey: TaskGroupKey,
		sortDirection: "asc" | "desc",
		userFields: UserMappedField[],
		missingLabels: ReadonlySet<string>
	): Map<string, TaskInfo[]> {
		const keys = Array.from(subgroups.keys());
		const sortedKeys = this.sortSubgroupKeys(keys, subgroupKey, sortDirection, userFields, missingLabels);

		const sorted = new Map<string, TaskInfo[]>();
		for (const key of sortedKeys) {
			sorted.set(key, subgroups.get(key)!);
		}
		return sorted;
	}

	/**
	 * Sort subgroup keys with "No <field>" positioning and type-aware sorting
	 */
		private sortSubgroupKeys(
			keys: string[],
			subgroupKey: TaskGroupKey,
			sortDirection: "asc" | "desc",
			userFields: UserMappedField[],
			missingLabels: ReadonlySet<string>
		): string[] {
		const isMissing = (key: string) => missingLabels.has(key);

		// Handle dynamic user fields with type-aware sorting
			if (typeof subgroupKey === "string" && subgroupKey.startsWith("user:")) {
				const fieldId = subgroupKey.slice(5);
				const field = userFields.find((f) => (f.id || f.key) === fieldId);

			const ascCompare = (a: string, b: string) => {
				if (isMissing(a) && !isMissing(b)) return -1;
				if (!isMissing(a) && isMissing(b)) return 1;
				if (field?.type === "number") {
					const na = parseFloat(a),
						nb = parseFloat(b);
					const va = isNaN(na) ? Number.POSITIVE_INFINITY : na;
					const vb = isNaN(nb) ? Number.POSITIVE_INFINITY : nb;
					if (va !== vb) return va - vb;
				} else if (field?.type === "boolean") {
					const va = a === "true" ? 0 : a === "false" ? 1 : 2;
					const vb = b === "true" ? 0 : b === "false" ? 1 : 2;
					if (va !== vb) return va - vb;
				} else if (field?.type === "date") {
					const ta = Date.parse(a);
					const tb = Date.parse(b);
					const va = isNaN(ta) ? Number.POSITIVE_INFINITY : ta;
					const vb = isNaN(tb) ? Number.POSITIVE_INFINITY : tb;
					if (va !== vb) return va - vb;
				}
				return a.localeCompare(b);
			};

			const sortedUser = keys.slice().sort(ascCompare);
			return sortDirection === "desc" ? sortedUser.reverse() : sortedUser;
		}

		// Default alphabetical with missing-first for asc
		const asc = keys.slice().sort((a, b) => {
			if (isMissing(a) && !isMissing(b)) return -1;
			if (!isMissing(a) && isMissing(b)) return 1;
			return a.localeCompare(b);
		});
		return sortDirection === "desc" ? asc.reverse() : asc;
	}
}

/* eslint-enable @typescript-eslint/no-non-null-assertion -- Re-enable after the grouping service implementation. */
