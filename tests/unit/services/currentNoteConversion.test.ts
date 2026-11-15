import {
	buildCurrentNoteConversionTaskInfo,
	extractMarkdownBodyAfterFrontmatter,
} from "../../../src/services/task-service/currentNoteConversion";
import { DEFAULT_TASK_CREATION_DEFAULTS } from "../../../src/settings/defaults";
import type { TaskNotesSettings } from "../../../src/types/settings";

type CurrentNoteTestSettings = Pick<
	TaskNotesSettings,
	"defaultTaskStatus" | "defaultTaskPriority" | "taskCreationDefaults"
>;

const settings: CurrentNoteTestSettings = {
	defaultTaskStatus: "none",
	defaultTaskPriority: "high",
	taskCreationDefaults: {
		...DEFAULT_TASK_CREATION_DEFAULTS,
		defaultScheduledDate: "none",
	},
};

function settingsWithScheduledDefault(
	overrides: Partial<TaskNotesSettings["taskCreationDefaults"]>
): CurrentNoteTestSettings {
	return {
		...settings,
		taskCreationDefaults: {
			...settings.taskCreationDefaults,
			...overrides,
		},
	};
}

describe("current note conversion planning", () => {
	it("builds task info from frontmatter, defaults, and markdown body", () => {
		const generateUuid = jest.fn(() => "converted-note-id");
		const task = buildCurrentNoteConversionTaskInfo({
			path: "Notes/plain.md",
			basename: "plain",
			content: "---\ntitle: Frontmatter title\n---\n\nExisting note body\n",
			frontmatter: {
				title: "Frontmatter title",
				status: undefined,
				priority: "medium",
				due: "2026-05-20",
				scheduled: 20260519,
				contexts: ["work", 42],
				projects: "[[Project]]",
				tags: ["task", true],
				timeEstimate: "45",
				recurrence: "FREQ=DAILY",
				dateCreated: "2026-05-18T10:00:00+10:00",
			},
			settings,
			now: "2026-05-19T09:20:00+10:00",
			adapters: { generateUuid },
		});

		expect(task).toMatchObject({
			id: "converted-note-id",
			path: "Notes/plain.md",
			title: "Frontmatter title",
			status: "none",
			priority: "medium",
			archived: false,
			due: "2026-05-20",
			scheduled: "20260519",
			contexts: ["work", "42"],
			projects: ["[[Project]]"],
			tags: ["task", "true"],
			timeEstimate: 45,
			recurrence: "FREQ=DAILY",
			dateCreated: "2026-05-18T10:00:00+10:00",
			dateModified: "2026-05-19T09:20:00+10:00",
			details: "Existing note body",
		});
		expect(generateUuid).toHaveBeenCalledTimes(1);
	});

	it("falls back to basename and default priority/status without losing empty strings", () => {
		const task = buildCurrentNoteConversionTaskInfo({
			path: "Notes/empty-status.md",
			basename: "empty-status",
			content: "Body",
			frontmatter: {
				title: "",
				status: "",
				priority: "",
				dateCreated: "",
				timeEstimate: "not a number",
			},
			settings,
			now: "2026-05-19T09:20:00+10:00",
		});

		expect(task.title).toBe("empty-status");
		expect(task.status).toBe("");
		expect(task.priority).toBe("");
		expect(task.dateCreated).toBe("2026-05-19T09:20:00+10:00");
		expect(task.timeEstimate).toBeUndefined();
	});

	it("applies the configured scheduled default when the note has no scheduled frontmatter", () => {
		const calculateDefaultDateTime = jest.fn(() => "2026-06-30T09:30");

		const task = buildCurrentNoteConversionTaskInfo({
			path: "Notes/plain.md",
			basename: "plain",
			content: "Body",
			frontmatter: {},
			settings: settingsWithScheduledDefault({
				defaultScheduledDate: "tomorrow",
				defaultScheduledTime: "09:30",
			}),
			now: "2026-06-29T09:20:00+10:00",
			adapters: { calculateDefaultDateTime },
		});

		expect(calculateDefaultDateTime).toHaveBeenCalledWith("tomorrow", "09:30");
		expect(task.scheduled).toBe("2026-06-30T09:30");
	});

	it("preserves existing scheduled frontmatter instead of applying the configured default", () => {
		const calculateDefaultDateTime = jest.fn(() => "2026-06-30");

		const task = buildCurrentNoteConversionTaskInfo({
			path: "Notes/already-scheduled.md",
			basename: "already-scheduled",
			content: "Body",
			frontmatter: { scheduled: "2026-07-05" },
			settings: settingsWithScheduledDefault({
				defaultScheduledDate: "tomorrow",
			}),
			now: "2026-06-29T09:20:00+10:00",
			adapters: { calculateDefaultDateTime },
		});

		expect(calculateDefaultDateTime).not.toHaveBeenCalled();
		expect(task.scheduled).toBe("2026-07-05");
	});

	it("leaves converted notes unscheduled when the scheduled default is none", () => {
		const calculateDefaultDateTime = jest.fn(() => "2026-06-30");

		const task = buildCurrentNoteConversionTaskInfo({
			path: "Notes/unscheduled.md",
			basename: "unscheduled",
			content: "Body",
			frontmatter: {},
			settings: settingsWithScheduledDefault({
				defaultScheduledDate: "none",
			}),
			now: "2026-06-29T09:20:00+10:00",
			adapters: { calculateDefaultDateTime },
		});

		expect(calculateDefaultDateTime).not.toHaveBeenCalled();
		expect(task.scheduled).toBeUndefined();
	});

	it("extracts the body after frontmatter and preserves notes without frontmatter", () => {
		expect(
			extractMarkdownBodyAfterFrontmatter("---\ntitle: Note\n---\n\nBody\n")
		).toBe("Body");
		expect(extractMarkdownBodyAfterFrontmatter("\nPlain note\n")).toBe("Plain note");
	});
});
