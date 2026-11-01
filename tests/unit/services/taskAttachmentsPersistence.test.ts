import { FieldMapper } from "../../../src/core/FieldMapper";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";
import { applyTaskUpdateFrontmatterChange } from "../../../src/services/task-service/taskUpdatePlanning";
import {
	createDefaultFieldConfig,
	initializeFieldConfig,
} from "../../../src/utils/fieldConfigDefaults";
import type { TaskInfo } from "../../../src/types";

// A remapped property name proves writes follow the field mapping setting.
const mapper = new FieldMapper({ ...DEFAULT_FIELD_MAPPING, attachments: "files" }, []);

function apply(frontmatter: Record<string, unknown>, updates: Partial<TaskInfo>): void {
	applyTaskUpdateFrontmatterChange({
		frontmatter,
		originalTask: {
			title: "Task",
			status: "open",
			priority: "normal",
			archived: false,
			path: "Tasks/task.md",
		},
		updates,
		recurrenceUpdates: {},
		dateModified: "2026-11-01T00:00:00Z",
		fieldMapper: mapper,
		taskIdentification: { method: "tag", tag: "task", propertyName: "", propertyValue: "" },
		storeTitleInFilename: false,
		updateCompletedDateInFrontmatter: () => {},
	});
}

describe("task attachment persistence", () => {
	it("writes attachment links to the mapped property and removes it when the list is emptied", () => {
		const frontmatter: Record<string, unknown> = { tags: ["task"] };

		apply(frontmatter, { attachments: ["[[Files/a.pdf]]", "[[Files/b.png]]"] });
		expect(frontmatter.files).toEqual(["[[Files/a.pdf]]", "[[Files/b.png]]"]);
		expect(frontmatter.attachments).toBeUndefined();

		apply(frontmatter, { attachments: [] });
		expect(frontmatter).not.toHaveProperty("files");
	});

	it("adds the attachments modal field to saved configs without disturbing user choices", () => {
		const saved = createDefaultFieldConfig();
		saved.fields = saved.fields.filter((field) => field.id !== "attachments");
		const subtasks = saved.fields.find((field) => field.id === "subtasks")!;
		subtasks.enabled = false;

		const migrated = initializeFieldConfig(saved);
		const attachments = migrated.fields.find((field) => field.id === "attachments");

		expect(attachments).toMatchObject({ group: "organization", enabled: true });
		expect(migrated.fields.find((field) => field.id === "subtasks")?.enabled).toBe(false);
		// Configs that already list the field are returned untouched.
		expect(initializeFieldConfig(migrated)).toBe(migrated);
	});
});
