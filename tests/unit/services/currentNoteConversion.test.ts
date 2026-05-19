import {
	buildCurrentNoteConversionTaskInfo,
	extractMarkdownBodyAfterFrontmatter,
} from "../../../src/services/task-service/currentNoteConversion";

const settings = {
	defaultTaskStatus: "none",
	defaultTaskPriority: "high",
};

describe("current note conversion planning", () => {
	it("builds task info from frontmatter, defaults, and markdown body", () => {
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
		});

		expect(task).toMatchObject({
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

	it("extracts the body after frontmatter and preserves notes without frontmatter", () => {
		expect(
			extractMarkdownBodyAfterFrontmatter("---\ntitle: Note\n---\n\nBody\n")
		).toBe("Body");
		expect(extractMarkdownBodyAfterFrontmatter("\nPlain note\n")).toBe("Plain note");
	});
});
