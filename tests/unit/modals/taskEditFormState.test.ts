import type { App } from "obsidian";
import {
	buildTaskEditFormState,
	buildTaskEditFormStateFromTask,
	getTaskEditUserFieldValues,
} from "../../../src/modals/taskEditFormState";
import type { TaskInfo } from "../../../src/types";
import type { UserMappedField } from "../../../src/types/settings";
import { MockObsidian } from "../../__mocks__/obsidian";

jest.mock("obsidian");

const createMockApp = (mockApp: unknown): App => mockApp as App;

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Edit task",
		status: "open",
		priority: "normal",
		path: "TaskNotes/Edit task.md",
		archived: false,
		contexts: [],
		projects: [],
		tags: [],
		...overrides,
	};
}

const reviewField: UserMappedField = {
	id: "review",
	displayName: "Review",
	key: "review",
	type: "text",
};

describe("taskEditFormState", () => {
	beforeEach(() => {
		MockObsidian.reset();
	});

	it("builds core edit form state and hides identifying tags in tag mode", () => {
		const reminder = { id: "reminder-1", type: "absolute" as const, date: "2026-05-19" };
		const task = createTask({
			title: "Tagged task",
			due: "2026-05-20",
			scheduled: "2026-05-19T09:00",
			priority: "high",
			status: "in-progress",
			contexts: ["office", "deep-work"],
			projects: ["[[Projects/Alpha]]"],
			tags: ["task", "task/project", "work"],
			timeEstimate: 45,
			recurrence: "DTSTART:20260519;FREQ=WEEKLY",
			recurrence_anchor: "completion",
			reminders: [reminder],
		});

		const state = buildTaskEditFormState({
			task,
			details: "Body\r\n",
			frontmatter: {},
			settings: {
				taskIdentificationMethod: "tag",
				taskTag: "task",
				hideIdentifyingTagsMode: "all",
			},
			normalizeDetails: (value) => value.replace(/\r\n/g, "\n").trimEnd(),
		});

		expect(state).toMatchObject({
			title: "Tagged task",
			dueDate: "2026-05-20",
			scheduledDate: "2026-05-19T09:00",
			priority: "high",
			status: "in-progress",
			contexts: "office, deep-work",
			projectValues: ["[[Projects/Alpha]]"],
			hasValidProjects: true,
			tags: "work",
			initialTags: "work",
			timeEstimate: 45,
			recurrenceRule: "DTSTART:20260519;FREQ=WEEKLY",
			recurrenceAnchor: "completion",
			details: "Body",
			originalDetails: "Body",
		});
		expect(state.reminders).toEqual([reminder]);
		expect(state.reminders).not.toBe(task.reminders);
	});

	it("keeps all tags visible when tasks are identified by property", () => {
		const task = createTask({ tags: ["task", "work"] });

		const state = buildTaskEditFormState({
			task,
			details: "",
			frontmatter: {},
			settings: {
				taskIdentificationMethod: "property",
				taskTag: "task",
			},
			normalizeDetails: (value) => value,
		});

		expect(state.tags).toBe("task, work");
		expect(state.initialTags).toBe("task, work");
	});

	it("loads only configured user field values from frontmatter", () => {
		expect(
			getTaskEditUserFieldValues(
				{
					review: "ready",
					unconfigured: "ignored",
				},
				[reviewField]
			)
		).toEqual({ review: "ready" });
	});

	it("reads frontmatter from Obsidian when building form state from a task", () => {
		const app = createMockApp(MockObsidian.createMockApp());
		MockObsidian.createTestFile("TaskNotes/Edit task.md", "---\nreview: old\n---\nBody");
		app.metadataCache.setCache("TaskNotes/Edit task.md", {
			frontmatter: { review: "old" },
		});

		const state = buildTaskEditFormStateFromTask({
			app,
			task: createTask({ path: "TaskNotes/Edit task.md" }),
			details: "Body",
			settings: {
				taskIdentificationMethod: "property",
				userFields: [reviewField],
			},
			normalizeDetails: (value) => value,
		});

		expect(state.userFields).toEqual({ review: "old" });
	});
});
