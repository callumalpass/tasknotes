import {
	applyTaskListDropFrontmatterMutation,
	buildTaskListDropSideEffectTask,
	buildTaskListGroupDropPlan,
} from "../../../src/bases/taskListDropPlanning";
import type { FieldMapping, TaskInfo } from "../../../src/types";

const lookupMappingKey = (property: string): keyof FieldMapping | null => {
	const mappings: Partial<Record<string, keyof FieldMapping>> = {
		status: "status",
		contexts: "contexts",
		priority: "priority",
	};
	return mappings[property] ?? null;
};

const isListTypeProperty = (property: string): boolean =>
	["contexts", "projects", "tags"].includes(property);

const createTask = (overrides: Partial<TaskInfo> = {}): TaskInfo => ({
	title: "Task",
	status: "todo",
	priority: "normal",
	path: "tasks/task.md",
	archived: false,
	...overrides,
});

describe("taskListDropPlanning", () => {
	it("marks formula grouping as read-only while preserving the stripped property for sorting", () => {
		const plan = buildTaskListGroupDropPlan({
			groupByPropertyId: "formula.score",
			sourceGroupKey: "low",
			targetGroupKey: "high",
			lookupMappingKey,
			isListTypeProperty,
		});

		expect(plan.isFormulaGrouping).toBe(true);
		expect(plan.cleanGroupBy).toBe("score");
		expect(plan.needsGroupUpdate).toBe(true);
		expect(plan.groupByTaskProp).toBeNull();
	});

	it("moves list-valued group frontmatter and writes the new sort order", () => {
		const plan = buildTaskListGroupDropPlan({
			groupByPropertyId: "note.contexts",
			sourceGroupKey: "work",
			targetGroupKey: "deep-work",
			lookupMappingKey,
			isListTypeProperty,
		});
		const frontmatter: Record<string, unknown> = {
			contexts: ["work", "home"],
		};

		applyTaskListDropFrontmatterMutation({
			frontmatter,
			plan,
			sortOrderField: "sort_order",
			sortOrder: "tnbbbbbbbbbb",
			isRecurring: false,
			dateModifiedField: "dateModified",
			coerceGroupKeyForFrontmatter: (_property, groupKey) => groupKey,
			updateCompletedDateInFrontmatter: jest.fn(),
			getTimestamp: () => "2026-05-19T09:40:00+10:00",
		});

		expect(frontmatter).toEqual({
			contexts: ["home", "deep-work"],
			sort_order: "tnbbbbbbbbbb",
		});
	});

	it("removes list-valued group frontmatter when moving to None leaves no values", () => {
		const plan = buildTaskListGroupDropPlan({
			groupByPropertyId: "contexts",
			sourceGroupKey: "work",
			targetGroupKey: "None",
			lookupMappingKey,
			isListTypeProperty,
		});
		const frontmatter: Record<string, unknown> = {
			contexts: ["work"],
		};

		applyTaskListDropFrontmatterMutation({
			frontmatter,
			plan,
			sortOrderField: "sort_order",
			sortOrder: null,
			isRecurring: false,
			dateModifiedField: "dateModified",
			coerceGroupKeyForFrontmatter: (_property, groupKey) => groupKey,
			updateCompletedDateInFrontmatter: jest.fn(),
			getTimestamp: () => "2026-05-19T09:40:00+10:00",
		});

		expect(frontmatter).toEqual({});
	});

	it("coerces scalar group frontmatter and applies status derivative fields", () => {
		const plan = buildTaskListGroupDropPlan({
			groupByPropertyId: "task.status",
			sourceGroupKey: "todo",
			targetGroupKey: "done",
			lookupMappingKey,
			isListTypeProperty,
		});
		const frontmatter: Record<string, unknown> = {};
		const updateCompletedDateInFrontmatter = jest.fn((fm, status, isRecurring) => {
			fm.completed = { status, isRecurring };
		});

		applyTaskListDropFrontmatterMutation({
			frontmatter,
			plan,
			sortOrderField: "sort_order",
			sortOrder: "tncccccccccc",
			isRecurring: true,
			dateModifiedField: "updated",
			coerceGroupKeyForFrontmatter: (_property, groupKey) => groupKey.toUpperCase(),
			updateCompletedDateInFrontmatter,
			getTimestamp: () => "2026-05-19T09:41:00+10:00",
		});

		expect(frontmatter).toEqual({
			status: "DONE",
			completed: { status: "done", isRecurring: true },
			updated: "2026-05-19T09:41:00+10:00",
			sort_order: "tncccccccccc",
		});
	});

	it("builds side-effect task snapshots for scalar status moves", () => {
		const plan = buildTaskListGroupDropPlan({
			groupByPropertyId: "status",
			sourceGroupKey: "todo",
			targetGroupKey: "done",
			lookupMappingKey,
			isListTypeProperty,
		});

		const updatedTask = buildTaskListDropSideEffectTask(createTask(), {
			plan,
			isCompletedStatus: (status) => status === "done",
			getTimestamp: () => "2026-05-19T09:42:00+10:00",
			getCompletedDate: () => "2026-05-19",
		});

		expect(updatedTask).toMatchObject({
			status: "done",
			dateModified: "2026-05-19T09:42:00+10:00",
			completedDate: "2026-05-19",
		});
	});

	it("builds side-effect task snapshots for list-valued group moves", () => {
		const plan = buildTaskListGroupDropPlan({
			groupByPropertyId: "contexts",
			sourceGroupKey: "work",
			targetGroupKey: "focus",
			lookupMappingKey,
			isListTypeProperty,
		});

		const updatedTask = buildTaskListDropSideEffectTask(
			createTask({ contexts: ["work", "home"] }),
			{
				plan,
				isCompletedStatus: () => false,
				getTimestamp: () => "2026-05-19T09:43:00+10:00",
				getCompletedDate: () => "2026-05-19",
			}
		);

		expect(updatedTask).toMatchObject({
			contexts: ["home", "focus"],
			dateModified: "2026-05-19T09:43:00+10:00",
		});
	});
});
