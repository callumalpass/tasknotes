import type { TaskCreationDefaults, UserMappedField } from "../../../src/types/settings";
import {
	buildTaskCreationFormState,
	type TaskCreationPrepopulatedValues,
} from "../../../src/modals/taskCreationFormState";

function defaults(overrides: Partial<TaskCreationDefaults> = {}): TaskCreationDefaults {
	return {
		defaultContexts: "",
		defaultTags: "",
		defaultProjects: "",
		useParentNoteForTaskCreation: false,
		useParentNoteAsProject: false,
		useParentHeaderAsProject: false,
		inheritParentTaskProperties: false,
		defaultTimeEstimate: 0,
		defaultRecurrence: "none",
		defaultDueDate: "none",
		defaultDueTime: "none",
		defaultScheduledDate: "none",
		defaultScheduledTime: "none",
		bodyTemplate: "",
		useBodyTemplate: false,
		occurrenceBodyTemplate: "",
		useOccurrenceBodyTemplate: false,
		defaultReminders: [],
		...overrides,
	};
}

function userField(overrides: Partial<UserMappedField>): UserMappedField {
	return {
		id: "field",
		displayName: "Field",
		key: "field",
		type: "text",
		...overrides,
	};
}

describe("taskCreationFormState", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date(2026, 4, 19, 12, 0, 0));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("builds modal form state from creation defaults", () => {
		const state = buildTaskCreationFormState({
			defaultPriority: "normal",
			defaultStatus: "open",
			taskTag: "task",
			taskCreationDefaults: defaults({
				defaultContexts: "home, desk",
				defaultTags: "planning, focus",
				defaultProjects: "[[Projects/A]], [[Projects/B]]",
				defaultDueDate: "today",
				defaultDueTime: "09:30",
				defaultScheduledDate: "tomorrow",
				defaultScheduledTime: "none",
				defaultTimeEstimate: 45,
				defaultRecurrence: "daily",
				defaultReminders: [
					{
						id: "default-relative",
						type: "relative",
						relatedTo: "due",
						offset: 30,
						unit: "minutes",
						direction: "before",
					},
				],
			}),
			userFields: [
				userField({ key: "reviewDate", type: "date", defaultValue: "next-week" }),
				userField({ key: "blocked", type: "boolean", defaultValue: true }),
			],
		});

		expect(state).toEqual(
			expect.objectContaining({
				title: "",
				dueDate: "2026-05-19T09:30",
				scheduledDate: "2026-05-20",
				priority: "normal",
				status: "open",
				contexts: "home, desk",
				tags: "planning, focus",
				projectStrings: ["[[Projects/A]]", "[[Projects/B]]"],
				timeEstimate: 45,
				recurrenceRule: "",
				recurrenceAnchor: "scheduled",
				userFields: {
					reviewDate: "2026-05-26",
					blocked: true,
				},
			})
		);
		expect(state.reminders).toHaveLength(1);
		expect(state.reminders[0]).toEqual(
			expect.objectContaining({
				type: "relative",
				relatedTo: "due",
				offset: "-PT30M",
			})
		);
	});

	it("lets pre-populated values override defaults while preserving custom frontmatter", () => {
		const prePopulatedValues: TaskCreationPrepopulatedValues = {
			title: "Pre-filled task",
			due: "2026-06-01",
			scheduled: "2026-05-31T14:00",
			priority: "high",
			status: "next",
			contexts: ["desk", "phone"],
			projects: ["", "[[Projects/Override]]", "Loose project"],
			tags: ["task", "#kept", "raw"],
			timeEstimate: 60,
			recurrence: "FREQ=WEEKLY",
			recurrence_anchor: "completion",
			customFrontmatter: {
				effort: 5,
				source: "capture",
			},
		};

		const state = buildTaskCreationFormState({
			defaultPriority: "normal",
			defaultStatus: "open",
			taskTag: "task",
			taskCreationDefaults: defaults({
				defaultTags: "default",
				defaultProjects: "[[Projects/Default]]",
				defaultDueDate: "today",
				defaultDueTime: "08:00",
				defaultTimeEstimate: 15,
			}),
			userFields: [userField({ key: "effort", type: "number", defaultValue: 1 })],
			prePopulatedValues,
		});

		expect(state).toEqual(
			expect.objectContaining({
				title: "Pre-filled task",
				dueDate: "2026-06-01",
				scheduledDate: "2026-05-31T14:00",
				priority: "high",
				status: "next",
				contexts: "desk, phone",
				tags: "kept, raw",
				projectStrings: ["[[Projects/Override]]", "Loose project"],
				timeEstimate: 60,
				recurrenceRule: "FREQ=WEEKLY",
				recurrenceAnchor: "completion",
				userFields: {
					effort: 5,
					source: "capture",
				},
			})
		);
	});

	it("skips empty defaults and unsupported date presets", () => {
		const state = buildTaskCreationFormState({
			defaultPriority: "normal",
			defaultStatus: "open",
			taskTag: "task",
			taskCreationDefaults: defaults({
				defaultTimeEstimate: -5,
			}),
			userFields: [
				userField({ key: "invalidDate", type: "date", defaultValue: "not-a-preset" }),
				userField({ key: "notes", type: "text", defaultValue: "" }),
			],
		});

		expect(state).toEqual(
			expect.objectContaining({
				dueDate: "",
				scheduledDate: "",
				projectStrings: [],
				timeEstimate: 0,
				reminders: [],
				userFields: {
					notes: "",
				},
			})
		);
	});
});
