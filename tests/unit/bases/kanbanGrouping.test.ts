import {
	applyDefaultKanbanColumnOrder,
	applyKanbanColumnOrder,
	applyKanbanSwimLaneOrder,
	applyKanbanSwimLaneOrderToMap,
	buildKanbanTaskGroups,
	buildKanbanSwimlaneColumns,
	canonicalizeKanbanConfiguredGroupKey,
	compareKanbanSpecialColumnKeys,
	createEmptyKanbanSwimLaneColumns,
	findKanbanStatusConfigForGroupKey,
	formatKanbanColumnCount,
	getKanbanColumnTaskCounts,
	getVisibleKanbanSwimLaneColumnKeys,
	getConfiguredKanbanOrder,
	getKanbanListPropertyValue,
	getKanbanStatusGroupKeyAliases,
	getKanbanSwimLaneTaskCount,
	getKanbanPropertyValue,
	getKanbanSwimLaneKeys,
	keepPinnedKanbanColumnsFirst,
	isKanbanListTypeProperty,
	isKanbanPriorityGroupingProperty,
	isKanbanStatusGroupingProperty,
	normalizeKanbanOrderConfig,
	normalizeKanbanWipLimitsConfig,
	valueToKanbanGroupString,
	valueToKanbanListGroupKeys,
} from "../../../src/bases/kanbanGrouping";
import type { PriorityConfig, StatusConfig, TaskInfo } from "../../../src/types";

type TestTask = {
	path: string;
	swimlanes?: string[];
};

function task(path: string, swimlanes: string[] = ["None"]): TestTask {
	return { path, swimlanes };
}

function taskInfo(path: string, overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: path,
		path,
		status: "todo",
		priority: "normal",
		contexts: [],
		projects: [],
		tags: [],
		archived: false,
		...overrides,
	} as TaskInfo;
}

function status(value: string, label = value, order = 1): StatusConfig {
	return {
		id: value,
		value,
		label,
		color: "#ffffff",
		isCompleted: false,
		order,
		autoArchive: false,
		autoArchiveDelay: 0,
	};
}

function priority(value: string, weight = 1): PriorityConfig {
	return {
		id: value,
		value,
		label: value,
		color: "#ffffff",
		weight,
	};
}

describe("Kanban grouping helpers", () => {
	it("normalizes saved column and swimlane order configs", () => {
		expect(
			normalizeKanbanOrderConfig(
				JSON.stringify({
					status: ["done", "todo", "done", ""],
					priority: "not-array",
				})
			)
		).toEqual({ status: ["done", "todo"] });
		expect(normalizeKanbanOrderConfig("not-json")).toEqual({});
	});

	it("normalizes WIP limits and column count labels", () => {
		expect(
			normalizeKanbanWipLimitsConfig({
				done: 3.8,
				todo: "2",
				ignored: 0,
				alsoIgnored: "not-a-number",
			})
		).toEqual({ done: 3, todo: 2 });

		expect(formatKanbanColumnCount(4, 3)).toEqual({
			text: " (4/3)",
			isExceeded: true,
		});
		expect(formatKanbanColumnCount(2, null)).toEqual({
			text: " (2)",
			isExceeded: false,
		});
	});

	it("converts Bases-style values to stable group strings and exploded list keys", () => {
		const listLike = {
			constructor: { name: "ListValue" },
			value: ["Research", "Review", "Research"],
			toString: () => "Research, Review",
		};

		expect(valueToKanbanGroupString(null)).toBe("None");
		expect(valueToKanbanGroupString(false)).toBe("False");
		expect(valueToKanbanGroupString(["A", "B"])).toBe("A,B");
		expect(valueToKanbanListGroupKeys(listLike)).toEqual(["Research", "Review"]);
		expect(valueToKanbanListGroupKeys([])).toEqual(["None"]);
	});

	it("reads grouped properties by exact key, stripped Bases key, or formula key", () => {
		expect(getKanbanPropertyValue({ "note.Status": "Todo" }, "note.Status")).toBe("Todo");
		expect(getKanbanPropertyValue({ Status: "Done" }, "note.Status")).toBe("Done");
		expect(getKanbanPropertyValue({ "formula.Score": 10 }, "formula.Score")).toBe(10);
		expect(getKanbanPropertyValue({ status: "Todo" }, "note.Status")).toBeNull();
	});

	it("identifies list properties and reads list values from TaskInfo before Bases props", () => {
		const item = taskInfo("one.md", {
			contexts: ["work"],
			projects: ["Projects/Alpha.md"],
			tags: ["task"],
		});
		const pathToProps = new Map<string, Record<string, unknown>>([
			["one.md", { custom: ["A"], ctx: ["ignored"] }],
		]);
		const fields = {
			contextsField: "ctx",
			projectsField: "proj",
		};

		expect(isKanbanListTypeProperty("ctx", fields, () => false)).toBe(true);
		expect(isKanbanListTypeProperty("custom", fields, (name) => name === "custom")).toBe(
			true
		);
		expect(getKanbanListPropertyValue(item, "ctx", pathToProps, fields)).toEqual(["work"]);
		expect(getKanbanListPropertyValue(item, "proj", pathToProps, fields)).toEqual([
			"Projects/Alpha.md",
		]);
		expect(getKanbanListPropertyValue(item, "custom", pathToProps, fields)).toEqual(["A"]);
	});

	it("canonicalizes configured status and priority group keys", () => {
		const statuses = [status("todo", "To Do"), status("done", "Done")];
		const aliases = (config: StatusConfig) => getKanbanStatusGroupKeyAliases(config);

		expect(isKanbanStatusGroupingProperty("task.status", "status")).toBe(true);
		expect(isKanbanPriorityGroupingProperty("file.priority", "priority")).toBe(true);
		expect(
			findKanbanStatusConfigForGroupKey("To Do", statuses, (value) => value, aliases)?.value
		).toBe("todo");
		expect(
			canonicalizeKanbanConfiguredGroupKey({
				groupKey: "To Do",
				propertyId: "task.status",
				fields: { statusField: "status", priorityField: "priority" },
				statuses,
				normalizeStatusValue: (value) => value,
				normalizePriorityValue: (value) => value.toLowerCase(),
				getStatusGroupKeyAliases: aliases,
			})
		).toBe("todo");
		expect(
			canonicalizeKanbanConfiguredGroupKey({
				groupKey: "HIGH",
				propertyId: "task.priority",
				fields: { statusField: "status", priorityField: "priority" },
				statuses,
				normalizeStatusValue: (value) => value,
				normalizePriorityValue: (value) => value.toLowerCase(),
				getStatusGroupKeyAliases: aliases,
			})
		).toBe("high");
	});

	it("builds exploded list groups, preserves source order, replays sort order, and adds empty configured groups", () => {
		const alpha = taskInfo("alpha.md", { contexts: ["work", "call"] });
		const beta = taskInfo("beta.md", { contexts: ["work"] });
		const gamma = taskInfo("gamma.md", { contexts: [] });
		const aliases = (config: StatusConfig) => getKanbanStatusGroupKeyAliases(config);

		const groups = buildKanbanTaskGroups({
			taskNotes: [alpha, beta, gamma],
			groupByPropertyId: "task.contexts",
			pathToProps: new Map(),
			explodeListColumns: true,
			groupedData: [],
			convertGroupKeyToString: String,
			isListTypeProperty: (propertyName) => propertyName === "contexts",
			getListPropertyValue: (sourceTask) => sourceTask.contexts,
			canonicalizeGroupKey: (groupKey) => groupKey,
			sortOrderValues: new Map([
				["alpha.md", "002"],
				["beta.md", "001"],
			]),
			statusConfigs: [status("todo"), status("done")],
			priorityConfigs: [priority("high")],
			isStatusGroupingProperty: () => false,
			isPriorityGroupingProperty: () => false,
			getStatusGroupKeyAliases: aliases,
			pinnedColumns: ["pinned"],
		});

		expect(groups.get("work")?.map((item) => item.path)).toEqual(["beta.md", "alpha.md"]);
		expect(groups.get("call")?.map((item) => item.path)).toEqual(["alpha.md"]);
		expect(groups.get("None")?.map((item) => item.path)).toEqual(["gamma.md"]);
		expect(groups.get("pinned")).toEqual([]);
		expect(groups.has("todo")).toBe(false);
		expect(groups.has("high")).toBe(false);
	});

	it("builds Bases groups, canonicalizes labels, and adds missing status or priority columns", () => {
		const todoTask = taskInfo("todo.md");
		const aliases = (config: StatusConfig) => getKanbanStatusGroupKeyAliases(config);
		const statuses = [status("todo", "To Do"), status("done", "Done")];

		const statusGroups = buildKanbanTaskGroups({
			taskNotes: [todoTask],
			groupByPropertyId: "task.status",
			pathToProps: new Map(),
			explodeListColumns: false,
			groupedData: [{ key: "To Do", entries: [{ file: { path: "todo.md" } }] }],
			convertGroupKeyToString: String,
			isListTypeProperty: () => false,
			getListPropertyValue: () => undefined,
			canonicalizeGroupKey: (groupKey, propertyId) =>
				canonicalizeKanbanConfiguredGroupKey({
					groupKey,
					propertyId,
					fields: { statusField: "status", priorityField: "priority" },
					statuses,
					normalizeStatusValue: (value) => value,
					normalizePriorityValue: (value) => value,
					getStatusGroupKeyAliases: aliases,
				}),
			statusConfigs: statuses,
			priorityConfigs: [],
			isStatusGroupingProperty: (propertyId) =>
				isKanbanStatusGroupingProperty(propertyId, "status"),
			isPriorityGroupingProperty: () => false,
			getStatusGroupKeyAliases: aliases,
			pinnedColumns: [],
		});

		expect(statusGroups.get("todo")?.map((item) => item.path)).toEqual(["todo.md"]);
		expect(statusGroups.get("done")).toEqual([]);

		const priorityGroups = buildKanbanTaskGroups({
			taskNotes: [],
			groupByPropertyId: "task.priority",
			pathToProps: new Map(),
			explodeListColumns: false,
			groupedData: [],
			convertGroupKeyToString: String,
			isListTypeProperty: () => false,
			getListPropertyValue: () => undefined,
			canonicalizeGroupKey: (groupKey) => groupKey,
			statusConfigs: [],
			priorityConfigs: [priority("high"), priority("low")],
			isStatusGroupingProperty: () => false,
			isPriorityGroupingProperty: (propertyId) =>
				isKanbanPriorityGroupingProperty(propertyId, "priority"),
			getStatusGroupKeyAliases: aliases,
			pinnedColumns: [],
		});

		expect([...priorityGroups.keys()]).toEqual(["high", "low"]);
	});

	it("derives swimlane keys from exploded lists or formula-backed properties", () => {
		const item = taskInfo("one.md", { projects: ["Alpha", "Beta"] });
		const pathToProps = new Map<string, Record<string, unknown>>([
			["one.md", { "formula.Score": 12 }],
		]);

		expect(
			getKanbanSwimLaneKeys({
				task: item,
				pathToProps,
				swimLanePropertyId: "task.projects",
				explodeListColumns: true,
				isListTypeProperty: (propertyName) => propertyName === "projects",
				getListPropertyValue: (sourceTask) => sourceTask.projects,
				canonicalizeGroupKey: (groupKey) => groupKey,
			})
		).toEqual(["Alpha", "Beta"]);
		expect(
			getKanbanSwimLaneKeys({
				task: item,
				pathToProps,
				swimLanePropertyId: "formula.Score",
				explodeListColumns: true,
				isListTypeProperty: () => false,
				getListPropertyValue: () => undefined,
				canonicalizeGroupKey: (groupKey) => `score-${groupKey}`,
			})
		).toEqual(["score-12"]);
	});

	it("distributes column groups into swimlanes without changing column assignments", () => {
		const todoA = task("todo-a.md", ["Research"]);
		const todoB = task("todo-b.md", ["Review", "Research"]);
		const done = task("done.md", ["None"]);
		const groups = new Map<string, TestTask[]>([
			["todo", [todoA, todoB]],
			["done", [done]],
			["blocked", []],
		]);

		const swimlanes = buildKanbanSwimlaneColumns(
			[todoA, todoB, done],
			groups,
			(item) => item.swimlanes ?? ["None"]
		);

		expect(
			swimlanes
				.get("Research")
				?.get("todo")
				?.map((item) => item.path)
		).toEqual(["todo-a.md", "todo-b.md"]);
		expect(
			swimlanes
				.get("Review")
				?.get("todo")
				?.map((item) => item.path)
		).toEqual(["todo-b.md"]);
		expect(
			swimlanes
				.get("None")
				?.get("done")
				?.map((item) => item.path)
		).toEqual(["done.md"]);
		expect(swimlanes.get("Research")?.get("blocked")).toEqual([]);
	});

	it("counts tasks per column across swimlanes", () => {
		const swimlanes = new Map<string, Map<string, TestTask[]>>([
			[
				"Research",
				new Map([
					["todo", [task("a.md")]],
					["done", []],
				]),
			],
			[
				"Review",
				new Map([
					["todo", [task("b.md"), task("c.md")]],
					["done", [task("d.md")]],
				]),
			],
		]);

		expect(getKanbanColumnTaskCounts(swimlanes, ["todo", "done", "blocked"])).toEqual(
			new Map([
				["todo", 3],
				["done", 1],
				["blocked", 0],
			])
		);
	});

	it("hides columns that are empty across all swimlanes when hideEmptyColumns is enabled", () => {
		const swimlanes = new Map<string, Map<string, TestTask[]>>([
			[
				"Research",
				new Map([
					["todo", [task("a.md")]],
					["done", []],
					["blocked", []],
				]),
			],
			[
				"Review",
				new Map([
					["todo", [task("b.md")]],
					["done", []],
					["blocked", []],
				]),
			],
		]);

		expect(
			getVisibleKanbanSwimLaneColumnKeys(
				["todo", "done", "blocked"],
				swimlanes,
				true,
				[]
			)
		).toEqual(["todo"]);
	});

	it("keeps empty pinned columns even when hideEmptyColumns is enabled", () => {
		const swimlanes = new Map<string, Map<string, TestTask[]>>([
			[
				"Research",
				new Map([
					["todo", [task("a.md")]],
					["done", []],
					["blocked", []],
				]),
			],
		]);

		expect(
			getVisibleKanbanSwimLaneColumnKeys(
				["todo", "done", "blocked"],
				swimlanes,
				true,
				["done"]
			)
		).toEqual(["todo", "done"]);
	});

	it("keeps all columns when hideEmptyColumns is disabled", () => {
		const swimlanes = new Map<string, Map<string, TestTask[]>>([
			[
				"Research",
				new Map([
					["todo", [task("a.md")]],
					["done", []],
					["blocked", []],
				]),
			],
		]);

		expect(
			getVisibleKanbanSwimLaneColumnKeys(
				["todo", "done", "blocked"],
				swimlanes,
				false,
				[]
			)
		).toEqual(["todo", "done", "blocked"]);
	});

	it("orders columns from saved order and appends default-ordered new columns", () => {
		const order = applyKanbanColumnOrder({
			groupBy: "task.status",
			actualKeys: ["review", "todo", "done", "None"],
			columnOrders: {
				status: ["done", "missing"],
			},
			hideEmptyColumns: true,
			pinnedColumns: ["review"],
			isPriorityField: () => false,
			isStatusField: (propertyId) => propertyId === "task.status",
			getPriorityWeight: () => 0,
			findStatusConfig: (key) =>
				({
					todo: { order: 1 },
					review: { order: 2 },
					done: { order: 3 },
				})[key],
		});

		expect(order).toEqual(["done", "review", "todo", "None"]);
	});

	it("orders default priority/status columns while keeping configured pins first", () => {
		expect(
			applyDefaultKanbanColumnOrder({
				groupBy: "task.priority",
				actualKeys: ["low", "high", "None", "medium"],
				pinnedColumns: ["medium"],
				isPriorityField: (propertyId) => propertyId === "task.priority",
				isStatusField: () => false,
				getPriorityWeight: (key) => ({ high: 3, medium: 2, low: 1 })[key] ?? 0,
				findStatusConfig: () => undefined,
			})
		).toEqual(["medium", "high", "low", "None"]);

		expect(
			applyDefaultKanbanColumnOrder({
				groupBy: "task.status",
				actualKeys: ["done", "unknown", "todo", "None"],
				pinnedColumns: [],
				isPriorityField: () => false,
				isStatusField: (propertyId) => propertyId === "task.status",
				getPriorityWeight: () => 0,
				findStatusConfig: (key) =>
					({
						todo: { order: 1 },
						done: { order: 2 },
					})[key],
			})
		).toEqual(["todo", "done", "unknown", "None"]);
	});

	it("orders swimlanes from saved order, defaults, and hidden-empty rules", () => {
		expect(
			applyKanbanSwimLaneOrder({
				swimLanePropertyId: "task.priority",
				actualKeys: ["low", "high"],
				swimLaneOrders: { priority: ["medium", "low"] },
				hideEmptySwimLanes: false,
				isPriorityField: (propertyId) => propertyId === "task.priority",
				isStatusField: () => false,
				getPriorityWeight: (key) => ({ high: 3, medium: 2, low: 1 })[key] ?? 0,
				getStatusOrder: () => 0,
			})
		).toEqual(["medium", "low", "high"]);

		expect(
			applyKanbanSwimLaneOrder({
				swimLanePropertyId: "task.priority",
				actualKeys: ["low", "high"],
				swimLaneOrders: { priority: ["medium", "low"] },
				hideEmptySwimLanes: true,
				isPriorityField: (propertyId) => propertyId === "task.priority",
				isStatusField: () => false,
				getPriorityWeight: (key) => ({ high: 3, medium: 2, low: 1 })[key] ?? 0,
				getStatusOrder: () => 0,
			})
		).toEqual(["low", "high"]);
	});

	it("orders swimlane maps and can synthesize saved empty lanes", () => {
		const todo = task("todo.md");
		const swimlanes = new Map<string, Map<string, TestTask[]>>([
			["low", new Map([["todo", [todo]]])],
			["high", new Map([["todo", []]])],
		]);

		const ordered = applyKanbanSwimLaneOrderToMap({
			swimLanePropertyId: "task.priority",
			swimLanes: swimlanes,
			columnKeys: ["todo", "done"],
			swimLaneOrders: { priority: ["medium", "low", "high"] },
			hideEmptySwimLanes: false,
			isPriorityField: (propertyId) => propertyId === "task.priority",
			isStatusField: () => false,
			getPriorityWeight: (key) => ({ high: 3, medium: 2, low: 1 })[key] ?? 0,
			getStatusOrder: () => 0,
		});

		expect([...ordered.keys()]).toEqual(["medium", "low", "high"]);
		expect(ordered.get("medium")).toEqual(
			new Map([
				["todo", []],
				["done", []],
			])
		);
		expect(ordered.get("low")?.get("todo")).toEqual([todo]);

		const hiddenEmpty = applyKanbanSwimLaneOrderToMap({
			swimLanePropertyId: "task.priority",
			swimLanes: swimlanes,
			columnKeys: ["todo", "done"],
			swimLaneOrders: { priority: ["medium", "low", "high"] },
			hideEmptySwimLanes: true,
			isPriorityField: (propertyId) => propertyId === "task.priority",
			isStatusField: () => false,
			getPriorityWeight: (key) => ({ high: 3, medium: 2, low: 1 })[key] ?? 0,
			getStatusOrder: () => 0,
		});

		expect([...hiddenEmpty.keys()]).toEqual(["low"]);
	});

	it("exposes small ordering helpers for view adapters", () => {
		expect(compareKanbanSpecialColumnKeys("None", "todo")).toBeGreaterThan(0);
		expect(getConfiguredKanbanOrder({ priority: ["high"] }, "task.priority")).toEqual([
			"high",
		]);
		expect(keepPinnedKanbanColumnsFirst(["low", "high", "medium"], ["medium"])).toEqual([
			"medium",
			"low",
			"high",
		]);
		expect(createEmptyKanbanSwimLaneColumns<TestTask>(["todo"])).toEqual(
			new Map([["todo", []]])
		);
		expect(getKanbanSwimLaneTaskCount(new Map([["todo", [task("a.md")]]]))).toBe(1);
	});
});
