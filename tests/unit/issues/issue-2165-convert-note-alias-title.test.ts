import { FieldMapper } from "../../../src/core/FieldMapper";
import { applyTaskUpdateFrontmatterChange } from "../../../src/services/task-service/taskUpdatePlanning";
import { buildCurrentNoteConversionTaskInfo } from "../../../src/services/task-service/currentNoteConversion";
import {
	DEFAULT_FIELD_MAPPING,
	DEFAULT_TASK_CREATION_DEFAULTS,
} from "../../../src/settings/defaults";
import type { TaskInfo } from "../../../src/types";

describe("Issue #2165: convert current note with mapped alias title", () => {
	function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
		return {
			title: "My fancy Task Title",
			status: "open",
			priority: "normal",
			path: "Notes/source-note.md",
			archived: false,
			tags: [],
			...overrides,
		};
	}

	it("uses the configured aliases title field when converting a current note", () => {
		const fieldMapper = new FieldMapper({
			...DEFAULT_FIELD_MAPPING,
			title: "aliases",
		});

		const task = buildCurrentNoteConversionTaskInfo({
			path: "Notes/source-note.md",
			basename: "source-note",
			content: "---\naliases:\n  - My fancy Task Title\n---\n\nBody\n",
			frontmatter: {
				aliases: ["My fancy Task Title"],
			},
			settings: {
				defaultTaskStatus: "open",
				defaultTaskPriority: "normal",
				storeTitleInFilename: false,
				taskCreationDefaults: {
					...DEFAULT_TASK_CREATION_DEFAULTS,
					defaultScheduledDate: "none",
				},
			},
			fieldMapper,
			now: "2026-07-28T18:30:00Z",
		});

		expect(task.title).toBe("My fancy Task Title");
	});

	it("preserves an existing aliases list when the title is unchanged on save", () => {
		const fieldMapper = new FieldMapper({
			...DEFAULT_FIELD_MAPPING,
			title: "aliases",
		});
		const frontmatter: Record<string, unknown> = {
			aliases: ["My fancy Task Title", "Secondary Alias"],
		};

		applyTaskUpdateFrontmatterChange({
			frontmatter,
			originalTask: createTask(),
			updates: {
				dateModified: "2026-07-28T18:31:00Z",
			},
			recurrenceUpdates: {},
			dateModified: "2026-07-28T18:31:00Z",
			fieldMapper,
			taskIdentification: {
				method: "tag",
				tag: "task",
				propertyName: "",
				propertyValue: "",
			},
			storeTitleInFilename: false,
			updateCompletedDateInFrontmatter: jest.fn(),
		});

		expect(frontmatter.aliases).toEqual(["My fancy Task Title", "Secondary Alias"]);
		expect(frontmatter.dateModified).toBe("2026-07-28T18:31:00Z");
	});
});
