import type { PriorityConfig, StatusConfig, TaskInfo } from "../types";
import { stringifyUnknown } from "../utils/stringUtils";
import { stripPropertyPrefix } from "./sortOrderUtils";

type BasesDisplayValue = {
	constructor?: { name?: string };
	isTruthy?: () => boolean;
	value?: unknown[];
	toString(): string;
};

export type KanbanFieldNames = {
	contextsField: string;
	projectsField: string;
	statusField: string;
	priorityField: string;
};

export type KanbanGroupedData = {
	key?: unknown;
	entries: readonly {
		file: {
			path: string;
		};
	}[];
};

export type KanbanTaskGroupingOptions = {
	taskNotes: readonly TaskInfo[];
	groupByPropertyId: string;
	pathToProps: ReadonlyMap<string, Record<string, unknown>>;
	explodeListColumns: boolean;
	groupedData: readonly KanbanGroupedData[];
	convertGroupKeyToString: (key: unknown) => string;
	isListTypeProperty: (propertyName: string) => boolean;
	getListPropertyValue: (task: TaskInfo, propertyName: string) => unknown;
	canonicalizeGroupKey: (groupKey: string, propertyId: string) => string;
	sortOrderValues?: ReadonlyMap<string, unknown>;
	statusConfigs: readonly StatusConfig[];
	priorityConfigs: readonly PriorityConfig[];
	isStatusGroupingProperty: (propertyId: string) => boolean;
	isPriorityGroupingProperty: (propertyId: string) => boolean;
	getStatusGroupKeyAliases: (statusConfig: StatusConfig) => ReadonlySet<string>;
	pinnedColumns: readonly string[];
};

export type KanbanSwimLaneKeyOptions = {
	task: TaskInfo;
	pathToProps: ReadonlyMap<string, Record<string, unknown>>;
	swimLanePropertyId: string | null;
	explodeListColumns: boolean;
	isListTypeProperty: (propertyName: string) => boolean;
	getListPropertyValue: (task: TaskInfo, propertyName: string) => unknown;
	canonicalizeGroupKey: (groupKey: string, propertyId: string) => string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function normalizeKanbanOrderValues(values: readonly unknown[]): string[] {
	const seen = new Set<string>();
	const normalized: string[] = [];

	for (const value of values) {
		const key = stringifyUnknown(value).trim();
		if (!key || seen.has(key)) {
			continue;
		}

		seen.add(key);
		normalized.push(key);
	}

	return normalized;
}

export function normalizeKanbanOrderConfig(value: unknown): Record<string, string[]> {
	if (value === null || value === undefined) {
		return {};
	}

	let parsed = value;
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) {
			return {};
		}

		try {
			parsed = JSON.parse(trimmed);
		} catch {
			return {};
		}
	}

	if (!isRecord(parsed)) {
		return {};
	}

	const result: Record<string, string[]> = {};
	for (const [propertyId, values] of Object.entries(parsed)) {
		if (!Array.isArray(values)) {
			continue;
		}

		const order = normalizeKanbanOrderValues(values);
		if (order.length > 0) {
			result[propertyId] = order;
		}
	}

	return result;
}

function normalizeWipLimitValue(value: unknown): number | null {
	const numericValue =
		typeof value === "number"
			? value
			: typeof value === "string" && value.trim()
				? Number(value)
				: Number.NaN;

	if (!Number.isFinite(numericValue) || numericValue <= 0) {
		return null;
	}

	return Math.floor(numericValue);
}

export function normalizeKanbanWipLimitsConfig(value: unknown): Record<string, number> {
	if (value === null || value === undefined) {
		return {};
	}

	let parsed = value;
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) {
			return {};
		}

		try {
			parsed = JSON.parse(trimmed);
		} catch {
			return {};
		}
	}

	if (!isRecord(parsed)) {
		return {};
	}

	const result: Record<string, number> = {};
	for (const [columnKey, rawLimit] of Object.entries(parsed)) {
		const normalizedKey = stringifyUnknown(columnKey).trim();
		const limit = normalizeWipLimitValue(rawLimit);
		if (normalizedKey && limit !== null) {
			result[normalizedKey] = limit;
		}
	}

	return result;
}

export function formatKanbanColumnCount(
	taskCount: number,
	wipLimit: number | null | undefined
): { text: string; isExceeded: boolean } {
	const normalizedLimit = normalizeWipLimitValue(wipLimit);
	if (normalizedLimit === null) {
		return {
			text: ` (${taskCount})`,
			isExceeded: false,
		};
	}

	return {
		text: ` (${taskCount}/${normalizedLimit})`,
		isExceeded: taskCount > normalizedLimit,
	};
}

export function normalizePinnedColumnConfig(value: unknown): string[] {
	if (value === null || value === undefined) {
		return [];
	}

	if (Array.isArray(value)) {
		return normalizeKanbanOrderValues(value);
	}

	if (typeof value !== "string") {
		return [];
	}

	const trimmed = value.trim();
	if (!trimmed) {
		return [];
	}

	if (trimmed.startsWith("[")) {
		try {
			const parsed = JSON.parse(trimmed) as unknown;
			if (Array.isArray(parsed)) {
				return normalizeKanbanOrderValues(parsed);
			}
		} catch {
			// Fall back to comma-separated parsing below.
		}
	}

	return normalizeKanbanOrderValues(trimmed.split(","));
}

export function addPinnedColumnGroups(
	groups: Map<string, TaskInfo[]>,
	pinnedColumns: readonly string[]
): void {
	for (const column of pinnedColumns) {
		if (!groups.has(column)) {
			groups.set(column, []);
		}
	}
}

export function orderColumnsWithPinnedColumns(
	actualKeys: string[],
	pinnedColumns: readonly string[]
): string[] {
	const pinnedSet = new Set(pinnedColumns);
	const actualKeySet = new Set(actualKeys);
	const pinned = pinnedColumns.filter((key) => actualKeySet.has(key));
	const unpinned = actualKeys.filter((key) => !pinnedSet.has(key)).sort();
	return [...pinned, ...unpinned];
}

export function shouldRenderKanbanColumn(
	hideEmptyColumns: boolean,
	groupKey: string,
	tasks: readonly TaskInfo[],
	pinnedColumns: readonly string[]
): boolean {
	return !hideEmptyColumns || tasks.length > 0 || pinnedColumns.includes(groupKey);
}

export function getKanbanPropertyValue(
	props: Record<string, unknown>,
	propertyId: string
): unknown {
	if (propertyId.startsWith("formula.")) {
		return props[propertyId] ?? null;
	}

	const cleanId = stripPropertyPrefix(propertyId);
	if (props[propertyId] !== undefined) return props[propertyId];
	if (props[cleanId] !== undefined) return props[cleanId];

	return null;
}

export function isKanbanListTypeProperty(
	propertyName: string,
	fields: Pick<KanbanFieldNames, "contextsField" | "projectsField">,
	isObsidianListProperty: (propertyName: string) => boolean
): boolean {
	if (isObsidianListProperty(propertyName)) {
		return true;
	}

	const knownListProperties = new Set([
		"contexts",
		fields.contextsField,
		"projects",
		fields.projectsField,
		"tags",
		"aliases",
	]);

	return knownListProperties.has(propertyName);
}

export function getKanbanListPropertyValue(
	task: TaskInfo,
	propertyName: string,
	pathToProps: ReadonlyMap<string, Record<string, unknown>>,
	fields: Pick<KanbanFieldNames, "contextsField" | "projectsField">
): unknown {
	if (propertyName === "contexts" || propertyName === fields.contextsField) {
		return task.contexts;
	}
	if (propertyName === "projects" || propertyName === fields.projectsField) {
		return task.projects;
	}
	if (propertyName === "tags") {
		return task.tags;
	}

	const props = pathToProps.get(task.path) || {};
	return props[propertyName];
}

export function isKanbanStatusGroupingProperty(propertyId: string | null, statusField: string): boolean {
	if (!propertyId) {
		return false;
	}

	return stripPropertyPrefix(propertyId) === statusField;
}

export function isKanbanPriorityGroupingProperty(
	propertyId: string | null,
	priorityField: string
): boolean {
	if (!propertyId) {
		return false;
	}

	return stripPropertyPrefix(propertyId) === priorityField;
}

export function getKanbanStatusGroupKeyAliases(
	statusConfig: StatusConfig,
	getDisplayName: (value: string) => string | null | undefined = () => null
): Set<string> {
	const aliases = new Set<string>();

	for (const rawValue of [statusConfig.value, statusConfig.label]) {
		const value = rawValue.trim();
		if (!value) continue;

		aliases.add(value);

		const displayName = getDisplayName(value);
		if (displayName) {
			aliases.add(displayName);
		}
	}

	return aliases;
}

export function findKanbanStatusConfigForGroupKey(
	groupKey: string,
	statuses: readonly StatusConfig[],
	normalizeStatusValue: (value: string) => string,
	getStatusGroupKeyAliases: (statusConfig: StatusConfig) => ReadonlySet<string>
): StatusConfig | undefined {
	const normalizedGroupKey = groupKey.trim();
	if (!normalizedGroupKey || normalizedGroupKey === "None") {
		return undefined;
	}

	const exactValue = statuses.find((status) => status.value === normalizedGroupKey);
	if (exactValue) return exactValue;

	const normalizedValue = normalizeStatusValue(normalizedGroupKey);
	const normalizedStatus = statuses.find((status) => status.value === normalizedValue);
	if (normalizedStatus) return normalizedStatus;

	const exactLabelMatches = statuses.filter((status) => status.label === normalizedGroupKey);
	if (exactLabelMatches.length === 1) return exactLabelMatches[0];

	const aliasMatches = statuses.filter((status) =>
		getStatusGroupKeyAliases(status).has(normalizedGroupKey)
	);
	return aliasMatches.length === 1 ? aliasMatches[0] : undefined;
}

export function canonicalizeKanbanConfiguredGroupKey(options: {
	groupKey: string;
	propertyId: string;
	fields: Pick<KanbanFieldNames, "statusField" | "priorityField">;
	statuses: readonly StatusConfig[];
	normalizeStatusValue: (value: string) => string;
	normalizePriorityValue: (value: string) => string;
	getStatusGroupKeyAliases: (statusConfig: StatusConfig) => ReadonlySet<string>;
}): string {
	if (options.groupKey.trim() === "None") {
		return options.groupKey;
	}

	if (isKanbanStatusGroupingProperty(options.propertyId, options.fields.statusField)) {
		return (
			findKanbanStatusConfigForGroupKey(
				options.groupKey,
				options.statuses,
				options.normalizeStatusValue,
				options.getStatusGroupKeyAliases
			)?.value ?? options.groupKey
		);
	}

	if (isKanbanPriorityGroupingProperty(options.propertyId, options.fields.priorityField)) {
		return options.normalizePriorityValue(options.groupKey);
	}

	return options.groupKey;
}

export function hasKanbanStatusGroup(
	groups: ReadonlyMap<string, readonly TaskInfo[]>,
	statusConfig: StatusConfig,
	getStatusGroupKeyAliases: (statusConfig: StatusConfig) => ReadonlySet<string>
): boolean {
	const aliases = getStatusGroupKeyAliases(statusConfig);
	for (const groupKey of groups.keys()) {
		if (aliases.has(groupKey.trim())) {
			return true;
		}
	}

	return false;
}

export function addEmptyKanbanStatusGroups(
	groups: Map<string, TaskInfo[]>,
	groupByPropertyId: string,
	statusConfigs: readonly StatusConfig[],
	isStatusGroupingProperty: (propertyId: string) => boolean,
	getStatusGroupKeyAliases: (statusConfig: StatusConfig) => ReadonlySet<string>
): void {
	if (!isStatusGroupingProperty(groupByPropertyId)) {
		return;
	}

	for (const statusConfig of statusConfigs) {
		if (!hasKanbanStatusGroup(groups, statusConfig, getStatusGroupKeyAliases)) {
			groups.set(statusConfig.value, []);
		}
	}
}

export function addEmptyKanbanPriorityGroups(
	groups: Map<string, TaskInfo[]>,
	groupByPropertyId: string,
	priorityConfigs: readonly PriorityConfig[],
	isPriorityGroupingProperty: (propertyId: string) => boolean
): void {
	if (!isPriorityGroupingProperty(groupByPropertyId)) {
		return;
	}

	for (const priorityConfig of priorityConfigs) {
		if (!groups.has(priorityConfig.value)) {
			groups.set(priorityConfig.value, []);
		}
	}
}

export function valueToKanbanGroupString(value: unknown): string {
	if (value === null || value === undefined) return "None";

	if (typeof value === "object" && value !== null && typeof value.toString === "function") {
		const basesValue = value as BasesDisplayValue;
		if (
			basesValue.constructor?.name === "NullValue" ||
			(basesValue.isTruthy && !basesValue.isTruthy())
		) {
			return "None";
		}

		if (basesValue.constructor?.name === "ListValue" || Array.isArray(basesValue.value)) {
			const arr = basesValue.value || [];
			if (arr.length === 0) return "None";
			return arr.map((entry) => valueToKanbanGroupString(entry)).join(", ");
		}

		const str = basesValue.toString();
		return str || "None";
	}

	if (typeof value === "string") return value || "None";
	if (typeof value === "number") return String(value);
	if (typeof value === "boolean") return value ? "True" : "False";
	if (Array.isArray(value)) {
		return value.length > 0
			? value.map((entry) => valueToKanbanGroupString(entry)).join(", ")
			: "None";
	}
	return stringifyUnknown(value) || "None";
}

export function valueToKanbanListGroupKeys(value: unknown): string[] {
	let values: unknown[];

	if (Array.isArray(value)) {
		values = value;
	} else if (value === null || value === undefined) {
		values = [];
	} else if (
		typeof value === "object" &&
		value !== null &&
		Array.isArray((value as BasesDisplayValue).value)
	) {
		values = (value as BasesDisplayValue).value || [];
	} else {
		values = [value];
	}

	const keys = values
		.map((item) => valueToKanbanGroupString(item))
		.filter((key) => key !== "None");
	return keys.length > 0 ? Array.from(new Set(keys)) : ["None"];
}

function sortKanbanGroupsByTaskOrder(
	groups: Map<string, TaskInfo[]>,
	taskOrder: ReadonlyMap<string, number>
): void {
	for (const tasks of groups.values()) {
		tasks.sort(
			(a, b) =>
				(taskOrder.get(a.path) ?? Number.MAX_SAFE_INTEGER) -
				(taskOrder.get(b.path) ?? Number.MAX_SAFE_INTEGER)
		);
	}
}

function sortKanbanGroupsBySortOrder(
	groups: Map<string, TaskInfo[]>,
	sortOrderValues: ReadonlyMap<string, unknown> | undefined
): void {
	if (!sortOrderValues) {
		return;
	}

	for (const tasks of groups.values()) {
		tasks.sort((a, b) => {
			const soA = sortOrderValues.get(a.path);
			const soB = sortOrderValues.get(b.path);
			if (soA != null && soB != null) {
				return stringifyUnknown(soA).localeCompare(stringifyUnknown(soB));
			}
			if (soA != null) return -1;
			if (soB != null) return 1;
			return 0;
		});
	}
}

function addKanbanTaskToGroup(
	groups: Map<string, TaskInfo[]>,
	groupKey: string,
	task: TaskInfo
): void {
	if (!groups.has(groupKey)) {
		groups.set(groupKey, []);
	}

	groups.get(groupKey)?.push(task);
}

export function getKanbanSwimLaneKeys(options: KanbanSwimLaneKeyOptions): string[] {
	if (!options.swimLanePropertyId) {
		return ["None"];
	}

	const cleanSwimlane = stripPropertyPrefix(options.swimLanePropertyId);
	if (options.explodeListColumns && options.isListTypeProperty(cleanSwimlane)) {
		const value = options.getListPropertyValue(options.task, cleanSwimlane);
		return valueToKanbanListGroupKeys(value);
	}

	const props = options.pathToProps.get(options.task.path) || {};
	const swimLaneKey = valueToKanbanGroupString(
		getKanbanPropertyValue(props, options.swimLanePropertyId)
	);
	return [options.canonicalizeGroupKey(swimLaneKey, options.swimLanePropertyId)];
}

export function buildKanbanTaskGroups(options: KanbanTaskGroupingOptions): Map<string, TaskInfo[]> {
	const groups = new Map<string, TaskInfo[]>();
	const taskOrder = new Map(options.taskNotes.map((task, index) => [task.path, index]));
	const cleanGroupBy = stripPropertyPrefix(options.groupByPropertyId);
	const shouldExplode =
		options.explodeListColumns && options.isListTypeProperty(cleanGroupBy);

	if (shouldExplode) {
		for (const task of options.taskNotes) {
			const value = options.getListPropertyValue(task, cleanGroupBy);
			const columnKeys = valueToKanbanListGroupKeys(value);

			for (const columnKey of columnKeys) {
				addKanbanTaskToGroup(groups, columnKey, task);
			}
		}
	} else {
		const tasksByPath = new Map(options.taskNotes.map((task) => [task.path, task]));

		for (const group of options.groupedData) {
			const rawGroupKey = options.convertGroupKeyToString(group.key);
			const groupKey = options.canonicalizeGroupKey(rawGroupKey, options.groupByPropertyId);
			const groupTasks = groups.get(groupKey) || [];

			for (const entry of group.entries) {
				const task = tasksByPath.get(entry.file.path);
				if (task) groupTasks.push(task);
			}

			if (!groups.has(groupKey)) {
				groups.set(groupKey, groupTasks);
			}
		}
	}

	sortKanbanGroupsByTaskOrder(groups, taskOrder);
	sortKanbanGroupsBySortOrder(groups, options.sortOrderValues);

	addEmptyKanbanStatusGroups(
		groups,
		options.groupByPropertyId,
		options.statusConfigs,
		options.isStatusGroupingProperty,
		options.getStatusGroupKeyAliases
	);
	addEmptyKanbanPriorityGroups(
		groups,
		options.groupByPropertyId,
		options.priorityConfigs,
		options.isPriorityGroupingProperty
	);
	addPinnedColumnGroups(groups, options.pinnedColumns);

	return groups;
}

export function buildKanbanSwimlaneColumns<TTask>(
	tasksForSwimlanes: readonly TTask[],
	groups: ReadonlyMap<string, readonly TTask[]>,
	getSwimLaneKeys: (task: TTask) => readonly string[]
): Map<string, Map<string, TTask[]>> {
	const swimLaneValues = new Set<string>();

	for (const task of tasksForSwimlanes) {
		for (const swimLaneKey of getSwimLaneKeys(task)) {
			swimLaneValues.add(swimLaneKey);
		}
	}

	const swimLanes = new Map<string, Map<string, TTask[]>>();
	for (const swimLaneKey of swimLaneValues) {
		const swimLaneMap = new Map<string, TTask[]>();
		swimLanes.set(swimLaneKey, swimLaneMap);

		for (const [columnKey] of groups) {
			swimLaneMap.set(columnKey, []);
		}
	}

	for (const [columnKey, columnTasks] of groups) {
		for (const task of columnTasks) {
			for (const swimLaneKey of getSwimLaneKeys(task)) {
				const swimLane = swimLanes.get(swimLaneKey);
				if (!swimLane) continue;
				if (swimLane.has(columnKey)) {
					swimLane.get(columnKey)?.push(task);
				}
			}
		}
	}

	return swimLanes;
}

export function getKanbanColumnTaskCounts<TTask>(
	swimLanes: ReadonlyMap<string, ReadonlyMap<string, readonly TTask[]>>,
	columnKeys: readonly string[]
): Map<string, number> {
	const counts = new Map(columnKeys.map((columnKey) => [columnKey, 0]));

	for (const columns of swimLanes.values()) {
		for (const columnKey of columnKeys) {
			counts.set(
				columnKey,
				(counts.get(columnKey) ?? 0) + (columns.get(columnKey)?.length ?? 0)
			);
		}
	}

	return counts;
}

export function getVisibleKanbanSwimLaneColumnKeys<TTask>(
	columnKeys: readonly string[],
	swimLanes: ReadonlyMap<string, ReadonlyMap<string, readonly TTask[]>>,
	hideEmptyColumns: boolean,
	pinnedColumns: readonly string[]
): string[] {
	if (!hideEmptyColumns) {
		return [...columnKeys];
	}

	const counts = getKanbanColumnTaskCounts(swimLanes, columnKeys);
	return columnKeys.filter(
		(columnKey) => (counts.get(columnKey) ?? 0) > 0 || pinnedColumns.includes(columnKey)
	);
}

export function compareKanbanSpecialColumnKeys(a: string, b: string): number {
	if (a === "None" && b !== "None") return 1;
	if (b === "None" && a !== "None") return -1;
	return a.localeCompare(b);
}

export function getConfiguredKanbanOrder(
	orders: Readonly<Record<string, readonly string[]>>,
	propertyId: string | null
): readonly string[] | undefined {
	if (!propertyId) {
		return undefined;
	}

	return orders[propertyId] ?? orders[stripPropertyPrefix(propertyId)];
}

export function keepPinnedKanbanColumnsFirst(
	actualKeys: readonly string[],
	pinnedColumns: readonly string[]
): string[] {
	const actualKeySet = new Set(actualKeys);
	const pinnedSet = new Set(pinnedColumns);
	const pinned = pinnedColumns.filter((key) => actualKeySet.has(key));
	const unpinned = actualKeys.filter((key) => !pinnedSet.has(key));
	return [...pinned, ...unpinned];
}

export function applyDefaultKanbanColumnOrder(options: {
	groupBy: string | null;
	actualKeys: readonly string[];
	pinnedColumns: readonly string[];
	isPriorityField: (propertyId: string | null) => boolean;
	isStatusField: (propertyId: string | null) => boolean;
	getPriorityWeight: (key: string) => number;
	findStatusConfig: (key: string) => { order: number } | undefined;
}): string[] {
	const orderedKeys = [...options.actualKeys];

	if (options.isPriorityField(options.groupBy)) {
		return keepPinnedKanbanColumnsFirst(
			orderedKeys.sort((a, b) => {
				const weightComparison =
					options.getPriorityWeight(b) - options.getPriorityWeight(a);
				return weightComparison || compareKanbanSpecialColumnKeys(a, b);
			}),
			options.pinnedColumns
		);
	}

	if (options.isStatusField(options.groupBy)) {
		return keepPinnedKanbanColumnsFirst(
			orderedKeys.sort((a, b) => {
				const statusA = options.findStatusConfig(a);
				const statusB = options.findStatusConfig(b);

				if (statusA && statusB) {
					const orderComparison = statusA.order - statusB.order;
					return orderComparison || a.localeCompare(b);
				}
				if (statusA) return -1;
				if (statusB) return 1;

				return compareKanbanSpecialColumnKeys(a, b);
			}),
			options.pinnedColumns
		);
	}

	return orderColumnsWithPinnedColumns([...options.actualKeys], options.pinnedColumns);
}

export function applyKanbanColumnOrder(options: {
	groupBy: string;
	actualKeys: readonly string[];
	columnOrders: Readonly<Record<string, readonly string[]>>;
	hideEmptyColumns: boolean;
	pinnedColumns: readonly string[];
	isPriorityField: (propertyId: string | null) => boolean;
	isStatusField: (propertyId: string | null) => boolean;
	getPriorityWeight: (key: string) => number;
	findStatusConfig: (key: string) => { order: number } | undefined;
}): string[] {
	const savedOrder = getConfiguredKanbanOrder(options.columnOrders, options.groupBy);

	if (!savedOrder || savedOrder.length === 0) {
		return applyDefaultKanbanColumnOrder(options);
	}

	const ordered: string[] = [];
	const unsorted: string[] = [];
	const actualKeySet = new Set(options.actualKeys);

	for (const key of savedOrder) {
		if (!options.hideEmptyColumns || actualKeySet.has(key)) {
			ordered.push(key);
		}
	}

	for (const key of options.actualKeys) {
		if (!savedOrder.includes(key)) {
			unsorted.push(key);
		}
	}

	return [
		...ordered,
		...applyDefaultKanbanColumnOrder({
			...options,
			actualKeys: unsorted,
		}),
	];
}

export function applyDefaultKanbanSwimLaneOrder(options: {
	swimLanePropertyId: string | null;
	actualKeys: readonly string[];
	isPriorityField: (propertyId: string | null) => boolean;
	isStatusField: (propertyId: string | null) => boolean;
	getPriorityWeight: (key: string) => number;
	getStatusOrder: (key: string) => number;
}): string[] {
	const orderedKeys = [...options.actualKeys];

	if (options.isPriorityField(options.swimLanePropertyId)) {
		return orderedKeys.sort((a, b) => {
			const weightComparison = options.getPriorityWeight(b) - options.getPriorityWeight(a);
			return weightComparison || a.localeCompare(b);
		});
	}

	if (options.isStatusField(options.swimLanePropertyId)) {
		return orderedKeys.sort((a, b) => {
			const orderComparison = options.getStatusOrder(a) - options.getStatusOrder(b);
			return orderComparison || a.localeCompare(b);
		});
	}

	return orderedKeys.sort();
}

export function applyKanbanSwimLaneOrder(options: {
	swimLanePropertyId: string | null;
	actualKeys: readonly string[];
	swimLaneOrders: Readonly<Record<string, readonly string[]>>;
	hideEmptySwimLanes: boolean;
	isPriorityField: (propertyId: string | null) => boolean;
	isStatusField: (propertyId: string | null) => boolean;
	getPriorityWeight: (key: string) => number;
	getStatusOrder: (key: string) => number;
}): string[] {
	const savedOrder = getConfiguredKanbanOrder(
		options.swimLaneOrders,
		options.swimLanePropertyId
	);

	if (!savedOrder || savedOrder.length === 0) {
		return applyDefaultKanbanSwimLaneOrder(options);
	}

	const actualKeySet = new Set(options.actualKeys);
	const ordered = savedOrder.filter(
		(key) => actualKeySet.has(key) || !options.hideEmptySwimLanes
	);
	const unordered = applyDefaultKanbanSwimLaneOrder({
		...options,
		actualKeys: options.actualKeys.filter((key) => !savedOrder.includes(key)),
	});

	return [...ordered, ...unordered];
}

export function createEmptyKanbanSwimLaneColumns<TTask>(
	columnKeys: readonly string[]
): Map<string, TTask[]> {
	return new Map(columnKeys.map((columnKey) => [columnKey, []]));
}

export function getKanbanSwimLaneTaskCount<TTask>(
	columns: ReadonlyMap<string, readonly TTask[]>
): number {
	return Array.from(columns.values()).reduce((sum, tasks) => sum + tasks.length, 0);
}

export function applyKanbanSwimLaneOrderToMap<TTask>(options: {
	swimLanePropertyId: string | null;
	swimLanes: ReadonlyMap<string, ReadonlyMap<string, readonly TTask[]>>;
	columnKeys: readonly string[];
	swimLaneOrders: Readonly<Record<string, readonly string[]>>;
	hideEmptySwimLanes: boolean;
	isPriorityField: (propertyId: string | null) => boolean;
	isStatusField: (propertyId: string | null) => boolean;
	getPriorityWeight: (key: string) => number;
	getStatusOrder: (key: string) => number;
}): Map<string, Map<string, TTask[]>> {
	const orderedKeys = applyKanbanSwimLaneOrder({
		swimLanePropertyId: options.swimLanePropertyId,
		actualKeys: Array.from(options.swimLanes.keys()),
		swimLaneOrders: options.swimLaneOrders,
		hideEmptySwimLanes: options.hideEmptySwimLanes,
		isPriorityField: options.isPriorityField,
		isStatusField: options.isStatusField,
		getPriorityWeight: options.getPriorityWeight,
		getStatusOrder: options.getStatusOrder,
	});
	const orderedSwimLanes = new Map<string, Map<string, TTask[]>>();

	for (const swimLaneKey of orderedKeys) {
		const columns =
			options.swimLanes.get(swimLaneKey) ??
			createEmptyKanbanSwimLaneColumns(options.columnKeys);
		if (options.hideEmptySwimLanes && getKanbanSwimLaneTaskCount(columns) === 0) {
			continue;
		}

		orderedSwimLanes.set(
			swimLaneKey,
			columns instanceof Map
				? (columns as Map<string, TTask[]>)
				: new Map(
						Array.from(columns.entries()).map(([columnKey, tasks]) => [
							columnKey,
							[...tasks],
						])
					)
		);
	}

	return orderedSwimLanes;
}
