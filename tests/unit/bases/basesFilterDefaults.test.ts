import { extractBasesFilterDefaults } from "../../../src/bases/basesFilterDefaults";
import type { TaskCreationFieldMapper } from "../../../src/bases/basesTaskCreation";
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

describe("Bases filter defaults", () => {
	it("extracts deterministic task defaults from Base filters", () => {
		const defaults = extractBasesFilterDefaults({
			config: {
				query: {
					filters: {
						conjunction: "and",
						filters: [
							{ rule: { text: 'file.hasTag("task")' } },
							{ rule: { text: 'file.hasTag("client")' } },
							{ rule: { text: 'note.state == "doing"' } },
							{ rule: { text: 'note.title == "Escaped \\"Title\\""' } },
							{ rule: { text: 'list(note.projectLinks).contains("[[Alpha]]")' } },
							{
								rule: {
									text: "list(note.projectLinks).contains(this.file.asLink())",
								},
							},
							{ rule: { text: 'task.areas.contains("work")' } },
						],
					},
				},
				filters: {
					rule: { text: 'note.effort == "8"' },
				},
			},
			fieldMapper: createFieldMapper({
				status: "state",
				projects: "projectLinks",
				contexts: "areas",
			}),
			taskTag: "task",
			userFields: [{ key: "effort" }],
			currentFileLink: "[[Current]]",
		});

		expect(defaults).toEqual({
			tags: ["client"],
			state: "doing",
			title: 'Escaped "Title"',
			projectLinks: ["[[Alpha]]", "[[Current]]"],
			areas: ["work"],
			effort: "8",
		});
	});

	it("ignores ambiguous OR filters and unknown properties", () => {
		const defaults = extractBasesFilterDefaults({
			config: {
				filters: {
					conjunction: "and",
					filters: [
						{
							conjunction: "or",
							filters: [
								{ rule: { text: 'note.status == "open"' } },
								{ rule: { text: 'note.status == "done"' } },
							],
						},
						{ rule: { text: 'note.unknown == "ignored"' } },
						{ rule: { text: 'note.due == "2026-05-20"' } },
						{ rule: { text: 'note.due == "2026-05-21"' } },
					],
				},
			},
			fieldMapper: createFieldMapper(),
			taskTag: "task",
		});

		expect(defaults).toEqual({
			due: "2026-05-20",
		});
	});

	it("skips this.file.asLink defaults when no current file link is available", () => {
		const defaults = extractBasesFilterDefaults({
			config: {
				filters: {
					rule: { text: "list(note.projects).contains(this.file.asLink())" },
				},
			},
			fieldMapper: createFieldMapper(),
			taskTag: "task",
			currentFileLink: null,
		});

		expect(defaults).toEqual({});
	});
});
