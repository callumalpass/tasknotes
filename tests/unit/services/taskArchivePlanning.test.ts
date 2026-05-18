import {
	applyTaskArchiveFrontmatterChange,
	buildTaskArchiveMovePlan,
	buildTaskArchiveState,
} from "../../../src/services/task-service/taskArchivePlanning";
import type { TaskInfo } from "../../../src/types";

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Archive me",
		status: "open",
		priority: "normal",
		path: "TaskNotes/Archive me.md",
		archived: false,
		tags: ["task"],
		...overrides,
	} as TaskInfo;
}

describe("taskArchivePlanning", () => {
	it("adds the archive tag and toggles archived state when archiving", () => {
		const plan = buildTaskArchiveState(
			createTask({ archived: false, tags: ["task"] }),
			"archived",
			"2026-05-19T06:45:00+10:00"
		);

		expect(plan.isCurrentlyArchived).toBe(false);
		expect(plan.operation).toBe("archiving");
		expect(plan.updatedTask).toEqual(
			expect.objectContaining({
				archived: true,
				tags: ["task", "archived"],
				dateModified: "2026-05-19T06:45:00+10:00",
			})
		);
	});

	it("removes the archive tag and toggles archived state when unarchiving", () => {
		const plan = buildTaskArchiveState(
			createTask({ archived: true, tags: ["task", "archived"] }),
			"archived",
			"2026-05-19T06:45:00+10:00"
		);

		expect(plan.isCurrentlyArchived).toBe(true);
		expect(plan.operation).toBe("unarchiving");
		expect(plan.updatedTask.archived).toBe(false);
		expect(plan.updatedTask.tags).toEqual(["task"]);
	});

	it("updates frontmatter tags and dateModified for archive changes", () => {
		const frontmatter: Record<string, unknown> = {
			tags: "task",
		};

		applyTaskArchiveFrontmatterChange({
			frontmatter,
			archiveTag: "archived",
			isCurrentlyArchived: false,
			dateModified: "2026-05-19T06:45:00+10:00",
			dateModifiedField: "dateModified",
		});

		expect(frontmatter.tags).toEqual(["task", "archived"]);
		expect(frontmatter.dateModified).toBe("2026-05-19T06:45:00+10:00");
	});

	it("removes empty tag frontmatter when unarchiving the last tag", () => {
		const frontmatter: Record<string, unknown> = {
			tags: ["archived"],
		};

		applyTaskArchiveFrontmatterChange({
			frontmatter,
			archiveTag: "archived",
			isCurrentlyArchived: true,
			dateModified: "2026-05-19T06:45:00+10:00",
			dateModifiedField: "dateModified",
		});

		expect(frontmatter).not.toHaveProperty("tags");
		expect(frontmatter.dateModified).toBe("2026-05-19T06:45:00+10:00");
	});

	it("builds archive and unarchive move plans from resolved folder templates", () => {
		const processFolderTemplate = jest.fn((template: string) => `${template}/resolved`);

		expect(
			buildTaskArchiveMovePlan({
				isCurrentlyArchived: false,
				moveArchivedTasks: true,
				archiveFolderTemplate: "Archive/{{year}}",
				tasksFolderTemplate: "Tasks",
				fileName: "Archive me.md",
				taskData: { title: "Archive me", status: "open" },
				processFolderTemplate,
			})
		).toEqual({
			operation: "archiving",
			destinationKind: "archive",
			destinationFolder: "Archive/{{year}}/resolved",
			newPath: "Archive/{{year}}/resolved/Archive me.md",
		});

		expect(
			buildTaskArchiveMovePlan({
				isCurrentlyArchived: true,
				moveArchivedTasks: true,
				archiveFolderTemplate: "Archive",
				tasksFolderTemplate: "Tasks/{{project}}",
				fileName: "Archive me.md",
				taskData: { title: "Archive me", projects: ["Project"] },
				processFolderTemplate,
			})
		).toEqual({
			operation: "unarchiving",
			destinationKind: "tasks",
			destinationFolder: "Tasks/{{project}}/resolved",
			newPath: "Tasks/{{project}}/resolved/Archive me.md",
		});
	});

	it("does not build move plans when moving is disabled or the relevant folder is blank", () => {
		const processFolderTemplate = jest.fn();

		expect(
			buildTaskArchiveMovePlan({
				isCurrentlyArchived: false,
				moveArchivedTasks: false,
				archiveFolderTemplate: "Archive",
				fileName: "Archive me.md",
				taskData: {},
				processFolderTemplate,
			})
		).toBeNull();

		expect(
			buildTaskArchiveMovePlan({
				isCurrentlyArchived: true,
				moveArchivedTasks: true,
				archiveFolderTemplate: "Archive",
				tasksFolderTemplate: " ",
				fileName: "Archive me.md",
				taskData: {},
				processFolderTemplate,
			})
		).toBeNull();
	});
});
