import type { App } from "obsidian";
import type { FilterCondition, FilterGroup, TaskInfo } from "../../../src/types";
import {
	compareProjectWikilinks,
	evaluateFilterCondition,
	evaluateFilterNode,
	evaluateProjectsCondition,
	extractWikilinkPath,
	type FilterPredicateEvaluationContext,
} from "../../../src/services/filter-service/filterPredicateEvaluation";
import type { UserMappedField } from "../../../src/types/settings";

function task(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Task",
		path: "Tasks/task.md",
		status: "open",
		priority: "normal",
		archived: false,
		...overrides,
	};
}

function userField(overrides: Partial<UserMappedField>): UserMappedField {
	return {
		id: "field",
		key: "field",
		displayName: "Field",
		type: "text",
		...overrides,
	};
}

function context(
	overrides: Partial<FilterPredicateEvaluationContext> = {}
): FilterPredicateEvaluationContext {
	return {
		userFields: [],
		getUserFieldRawValue: () => undefined,
		getCompletedStatuses: () => ["done"],
		isCompletedStatus: (status) => status === "done",
		...overrides,
	};
}

function condition(overrides: Partial<FilterCondition>): FilterCondition {
	return {
		type: "condition",
		id: "condition",
		property: "title",
		operator: "contains",
		value: "Task",
		...overrides,
	};
}

describe("filter predicate evaluation", () => {
	it("evaluates recursive groups while ignoring incomplete conditions", () => {
		const query: FilterGroup = {
			type: "group",
			id: "root",
			conjunction: "and",
			children: [
				condition({ id: "incomplete", value: "" }),
				{
					type: "group",
					id: "nested",
					conjunction: "or",
					children: [
						condition({ id: "wrong-title", value: "No match" }),
						condition({
							id: "matching-status",
							property: "status",
							operator: "is",
							value: "open",
						}),
					],
				},
			],
		};

		expect(evaluateFilterNode(query, task(), context())).toBe(true);
	});

	it("uses substring matching across normalized user-list tokens", () => {
		const reviewers = userField({
			id: "reviewers",
			key: "reviewers",
			displayName: "Reviewers",
			type: "list",
		});
		const ctx = context({
			userFields: [reviewers],
			getUserFieldRawValue: () => "[[People/Ada Lovelace]], Bob",
		});

		expect(
			evaluateFilterCondition(
				condition({
					property: "user:reviewers",
					operator: "contains",
					value: "lace",
				}),
				task(),
				ctx
			)
		).toBe(true);

		expect(
			evaluateFilterCondition(
				condition({
					property: "user:reviewers",
					operator: "does-not-contain",
					value: "Charlie",
				}),
				task(),
				ctx
			)
		).toBe(true);
	});

	it("routes user date equality through date-aware comparison", () => {
		const review = userField({
			id: "review",
			key: "reviewDate",
			displayName: "Review date",
			type: "date",
		});
		const ctx = context({
			userFields: [review],
			getUserFieldRawValue: () => "2026-05-19T09:30",
		});

		expect(
			evaluateFilterCondition(
				condition({
					property: "user:review",
					operator: "is",
					value: "2026-05-19",
				}),
				task(),
				ctx
			)
		).toBe(true);
	});

	it("uses the project-subtasks service for hasSubtasks predicates", () => {
		const ctx = context({
			projectSubtasksService: {
				isTaskUsedAsProjectSync: (path) => path === "Tasks/project.md",
			},
		});

		expect(
			evaluateFilterCondition(
				condition({
					property: "hasSubtasks",
					operator: "is-checked",
					value: null,
				}),
				task({ path: "Tasks/project.md", hasSubtasks: false }),
				ctx
			)
		).toBe(true);
	});

	it("evaluates status.isCompleted against the requested recurring instance date", () => {
		const recurring = task({
			status: "open",
			recurrence: "FREQ=DAILY",
			complete_instances: ["2026-05-19"],
		});

		expect(
			evaluateFilterCondition(
				condition({
					property: "status.isCompleted",
					operator: "is-checked",
					value: null,
				}),
				recurring,
				context(),
				new Date("2026-05-19T12:00:00Z")
			)
		).toBe(true);

		expect(
			evaluateFilterCondition(
				condition({
					property: "status.isCompleted",
					operator: "is-checked",
					value: null,
				}),
				recurring,
				context(),
				new Date("2026-05-20T12:00:00Z")
			)
		).toBe(false);
	});

	it("matches project display names for contains and does-not-contain", () => {
		expect(
			evaluateProjectsCondition(["[[Projects/Foo]]"], "contains", "Foo")
		).toBe(true);

		expect(
			evaluateProjectsCondition(["[[Projects/Foo]]"], "does-not-contain", "Bar")
		).toBe(true);
	});

	it("can compare project wikilinks by resolved file path", () => {
		const app = {
			metadataCache: {
				getFirstLinkpathDest: jest.fn((linkPath: string) => {
					if (linkPath === "Projects/Canonical" || linkPath === "Canonical") {
						return {
							path: "Projects/Canonical.md",
							basename: "Canonical",
							name: "Canonical.md",
						};
					}
					return null;
				}),
			},
		} as unknown as App;

		expect(compareProjectWikilinks("[[Projects/Canonical]]", "[[Canonical]]", app)).toBe(true);
		expect(app.metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith(
			"Projects/Canonical",
			""
		);
	});

	it("preserves the existing wikilink-path extraction behavior", () => {
		expect(extractWikilinkPath("[[Projects/Foo|Alias]]")).toBe("Projects/Foo|Alias");
		expect(extractWikilinkPath("Plain Project")).toBe("Plain Project");
	});
});
