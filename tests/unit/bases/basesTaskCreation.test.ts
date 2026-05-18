import {
	buildTaskCreationDataFromFrontmatter,
	type TaskCreationFieldMapper,
} from "../../../src/bases/basesTaskCreation";
import type { FieldMapping } from "../../../src/types";

const fieldMapping: FieldMapping = {
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

function createFieldMapper(overrides: Partial<FieldMapping> = {}): TaskCreationFieldMapper {
	const mapping = { ...fieldMapping, ...overrides };
	return {
		toUserField: (field) => mapping[field],
	};
}

describe("Bases task creation assembly", () => {
	it("maps TaskNotes frontmatter defaults into task creation values", () => {
		const taskData = buildTaskCreationDataFromFrontmatter(
			{
				title: "Research draft",
				status: "in-progress",
				priority: "high",
				due: "2026-05-20",
				scheduled: "2026-05-18T09:30",
				contexts: "writing",
				projects: ["[[Project Alpha]]"],
				tags: ["task", "archived"],
				timeEstimate: "45",
				recurrence: "FREQ=WEEKLY",
				completedDate: "2026-05-19",
				dateCreated: "2026-05-18T00:00:00Z",
				blockedBy: ["[[Blocker]]"],
			},
			createFieldMapper()
		);

		expect(taskData).toMatchObject({
			title: "Research draft",
			status: "in-progress",
			priority: "high",
			due: "2026-05-20",
			scheduled: "2026-05-18T09:30",
			contexts: ["writing"],
			projects: ["[[Project Alpha]]"],
			tags: ["task", "archived"],
			archived: true,
			timeEstimate: 45,
			recurrence: "FREQ=WEEKLY",
			completedDate: "2026-05-19",
			dateCreated: "2026-05-18T00:00:00Z",
			blockedBy: [{ uid: "Blocker", reltype: "FINISHTOSTART" }],
		});
		expect(taskData.customFrontmatter).toBeUndefined();
	});

	it("uses user field mappings and preserves custom frontmatter for Bases-created tasks", () => {
		const taskData = buildTaskCreationDataFromFrontmatter(
			{
				state: "done",
				"target-date": "2026-05-20",
				effort: 8,
				external: "kept",
			},
			createFieldMapper({
				status: "state",
				due: "target-date",
			}),
			[{ key: "effort" }]
		);

		expect(taskData).toEqual({
			status: "done",
			due: "2026-05-20",
			customFrontmatter: {
				effort: 8,
				external: "kept",
			},
		});
	});

	it("returns an empty creation payload when Bases provides no defaults", () => {
		expect(buildTaskCreationDataFromFrontmatter({}, createFieldMapper())).toEqual({});
	});
});
