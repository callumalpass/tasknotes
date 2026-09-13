import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import type { TaskInfo } from "../../../src/types";
import { applyTaskUpdateFrontmatterChange } from "../../../src/services/task-service/taskUpdatePlanning";

const longTitle = "Long task title ".repeat(30).trim();

function update(
	frontmatter: Record<string, unknown>,
	updates: Partial<TaskInfo>,
	titleField = "title",
	storeTitleInFilename = true
): void {
	const originalTask = {
		title: longTitle,
		path: "Tasks/task-fallback.md",
		status: "open",
		priority: "normal",
		archived: false,
		tags: ["task"],
	} as TaskInfo;
	applyTaskUpdateFrontmatterChange({
		frontmatter,
		originalTask,
		updates,
		recurrenceUpdates: {},
		dateModified: "2026-09-12T15:00:00Z",
		fieldMapper: new FieldMapper({ ...DEFAULT_SETTINGS.fieldMapping, title: titleField }),
		taskIdentification: { method: "tag", tag: "task", propertyName: "", propertyValue: "" },
		storeTitleInFilename,
		updateCompletedDateInFrontmatter: jest.fn(),
	});
}

describe("#2322 fallback title preservation", () => {
	it.each(["title", "task_name"])("preserves %s through metadata edits", (titleField) => {
		const frontmatter: Record<string, unknown> = { [titleField]: longTitle, tags: ["task"] };
		update(frontmatter, { tags: ["task", "new"] }, titleField);
		expect(frontmatter[titleField]).toBe(longTitle);
		expect(frontmatter.tags).toEqual(["task", "new"]);
		update(frontmatter, { priority: "high" }, titleField);
		expect(frontmatter[titleField]).toBe(longTitle);
		expect(frontmatter.priority).toBe("high");
	});

	it("preserves the title when an edit form resubmits the unchanged title", () => {
		const frontmatter = { title: longTitle };
		update(frontmatter, { title: longTitle, tags: ["task", "new"] });
		expect(frontmatter.title).toBe(longTitle);
	});

	it("preserves the actual disk title rather than replacing it from stale task data", () => {
		const frontmatter = { title: "Newer disk title" };
		update(frontmatter, { priority: "high" });
		expect(frontmatter.title).toBe("Newer disk title");
	});

	it("does not introduce a title property on filename-only tasks", () => {
		const frontmatter = { tags: ["task"] };
		update(frontmatter, { priority: "high" });
		expect(frontmatter).not.toHaveProperty("title");
	});

	it("retains existing title-change behavior in filename mode", () => {
		const frontmatter = { title: longTitle };
		update(frontmatter, { title: "Short new title" });
		expect(frontmatter).not.toHaveProperty("title");
	});

	it("continues writing changed titles in property mode", () => {
		const frontmatter = { title: longTitle };
		update(frontmatter, { title: "New title" }, "title", false);
		expect(frontmatter.title).toBe("New title");
	});
});
