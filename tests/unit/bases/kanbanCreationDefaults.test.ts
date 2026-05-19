import type { FieldMappingKey } from "../../../src/types";
import {
	applyKanbanCreationDefault,
	getKanbanCreatableFrontmatterProperty,
	isKanbanCreationListProperty,
	type KanbanCreationDefaultOptions,
} from "../../../src/bases/kanbanCreationDefaults";

const fieldMapping: Record<FieldMappingKey, string> = {
	title: "title",
	status: "status",
	priority: "priority",
	due: "due",
	scheduled: "scheduled",
	contexts: "contexts",
	projects: "projects",
	timeEstimate: "timeEstimate",
	completedDate: "completedDate",
	dateCreated: "dateCreated",
	dateModified: "dateModified",
	recurrence: "recurrence",
	recurrenceAnchor: "recurrence_anchor",
	archiveTag: "archived",
	timeEntries: "timeEntries",
	completeInstances: "complete_instances",
	skippedInstances: "skipped_instances",
	blockedBy: "blockedBy",
	pomodoros: "pomodoros",
	icsEventId: "icsEventId",
	icsEventTag: "icsEventTag",
	googleCalendarEventId: "googleCalendarEventId",
	reminders: "reminders",
	sortOrder: "sort_order",
};

const fieldMapper = {
	toUserField: (field: FieldMappingKey) => fieldMapping[field] ?? field,
};

const propertyMapper = {
	basesToUserProperty: (propertyId: string) => propertyId.replace(/^(task|note)\./, ""),
};

function applyDefault(
	overrides: Partial<KanbanCreationDefaultOptions> = {}
): Record<string, unknown> {
	const frontmatter = overrides.frontmatter ?? {};
	applyKanbanCreationDefault({
		frontmatter,
		propertyId: "task.status",
		groupKey: "done",
		propertyMapper,
		fieldMapper,
		userFields: [],
		isListTypeProperty: () => false,
		coerceGroupKeyForFrontmatter: (_property, groupKey) => groupKey,
		...overrides,
	});
	return frontmatter;
}

describe("kanbanCreationDefaults", () => {
	it("ignores empty, non-writable, and synthetic grouping properties", () => {
		const cases: Array<Partial<KanbanCreationDefaultOptions>> = [
			{ propertyId: null },
			{ propertyId: undefined },
			{ groupKey: null },
			{ groupKey: undefined },
			{ groupKey: "" },
			{ groupKey: "None" },
			{ propertyId: "file.name", groupKey: "Task File" },
			{ propertyId: "formula.overdue", groupKey: "true" },
			{ propertyId: "note.unknown", groupKey: "Research" },
		];

		for (const options of cases) {
			expect(applyDefault(options)).toEqual({});
		}
	});

	it("maps writable core scalar properties through the supplied coercion callback", () => {
		const coerceGroupKeyForFrontmatter = jest.fn((property: string, groupKey: string) =>
			property === "timeEstimate" ? Number(groupKey) : groupKey.toUpperCase()
		);

		const statusFrontmatter = applyDefault({
			propertyId: "task.status",
			groupKey: "in-progress",
			coerceGroupKeyForFrontmatter,
		});
		const estimateFrontmatter = applyDefault({
			propertyId: "task.timeEstimate",
			groupKey: "45",
			coerceGroupKeyForFrontmatter,
		});

		expect(statusFrontmatter).toEqual({ status: "IN-PROGRESS" });
		expect(estimateFrontmatter).toEqual({ timeEstimate: 45 });
		expect(coerceGroupKeyForFrontmatter).toHaveBeenCalledWith("status", "in-progress");
		expect(coerceGroupKeyForFrontmatter).toHaveBeenCalledWith("timeEstimate", "45");
	});

	it("appends core list properties without duplicating existing values", () => {
		expect(
			applyDefault({
				propertyId: "task.projects",
				groupKey: "[[Project Alpha]]",
				frontmatter: { projects: ["[[Existing]]"] },
			})
		).toEqual({ projects: ["[[Existing]]", "[[Project Alpha]]"] });

		const duplicateFrontmatter = { tags: "work" };
		applyDefault({
			propertyId: "tags",
			groupKey: "work",
			frontmatter: duplicateFrontmatter,
		});
		expect(duplicateFrontmatter).toEqual({ tags: "work" });
	});

	it("writes configured user fields and preserves list semantics for list user fields", () => {
		const scalar = applyDefault({
			propertyId: "note.workstream",
			groupKey: "Research",
			userFields: [{ key: "workstream", type: "text" }],
			coerceGroupKeyForFrontmatter: (_property, groupKey) => `${groupKey} Team`,
		});
		const list = applyDefault({
			propertyId: "note.reviewers",
			groupKey: "Ada",
			userFields: [{ key: "reviewers", type: "list" }],
			frontmatter: { reviewers: ["Grace"] },
		});

		expect(scalar).toEqual({ workstream: "Research Team" });
		expect(list).toEqual({ reviewers: ["Grace", "Ada"] });
	});

	it("uses Obsidian list-property detection after confirming a property is writable", () => {
		const coerceGroupKeyForFrontmatter = jest.fn((_property: string, groupKey: string) => groupKey);
		const frontmatter = applyDefault({
			propertyId: "note.team",
			groupKey: "Platform",
			userFields: [{ key: "team", type: "text" }],
			isListTypeProperty: (property) => property === "team",
			coerceGroupKeyForFrontmatter,
		});

		expect(frontmatter).toEqual({ team: ["Platform"] });
		expect(coerceGroupKeyForFrontmatter).not.toHaveBeenCalled();
	});

	it("exposes property eligibility and list classification for focused callers", () => {
		expect(
			getKanbanCreatableFrontmatterProperty({
				propertyId: "file.name",
				propertyMapper,
				fieldMapper,
			})
		).toBeNull();
		expect(
			getKanbanCreatableFrontmatterProperty({
				propertyId: "note.workstream",
				propertyMapper,
				fieldMapper,
				userFields: [{ key: "workstream" }],
			})
		).toBe("workstream");
		expect(
			isKanbanCreationListProperty({
				property: "blockedBy",
				fieldMapper,
				userFields: [],
				isListTypeProperty: () => false,
			})
		).toBe(true);
	});
});
