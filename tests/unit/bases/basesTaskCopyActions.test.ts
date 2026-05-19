import {
	buildBasesTaskCopyActions,
	copyBasesCurrentViewTasks,
	resolveBasesTaskLinkText,
} from "../../../src/bases/basesTaskCopyActions";
import type { BasesDataItem } from "../../../src/bases/helpers";
import { TaskFactory } from "../../helpers/mock-factories";

describe("Bases task copy actions", () => {
	it("builds native result-menu actions for each task copy format", () => {
		const copyTasks = jest.fn();
		const actions = buildBasesTaskCopyActions(copyTasks);

		expect(actions.map((action) => [action.name, action.icon])).toEqual([
			["Copy task filenames", "lucide-file-text"],
			["Copy task links", "lucide-link"],
			["Copy task titles", "lucide-text"],
		]);

		actions[0].callback();
		actions[1].callback();
		actions[2].callback();

		expect(copyTasks).toHaveBeenNthCalledWith(1, "filenames");
		expect(copyTasks).toHaveBeenNthCalledWith(2, "markdown-links");
		expect(copyTasks).toHaveBeenNthCalledWith(3, "titles");
	});

	it("identifies, filters, formats, and writes current-view tasks", async () => {
		const visibleTask = TaskFactory.createTask({
			path: "TaskNotes/Visible.md",
			title: "Visible task",
		});
		const hiddenTask = TaskFactory.createTask({
			path: "TaskNotes/Hidden.md",
			title: "Hidden task",
		});
		const writeText = jest.fn().mockResolvedValue(undefined);

		const result = await copyBasesCurrentViewTasks({
			dataItems: [{ path: visibleTask.path } as BasesDataItem],
			format: "markdown-links",
			identifyTaskNotes: jest.fn().mockResolvedValue([visibleTask, hiddenTask]),
			filterTasks: (tasks) => tasks.filter((task) => task.path === visibleTask.path),
			resolveLinkText: (task) => `Link:${task.path}`,
			writeText,
		});

		expect(writeText).toHaveBeenCalledWith("[[Link:TaskNotes/Visible.md]]");
		expect(result).toEqual({
			status: "copied",
			count: 1,
		});
	});

	it("does not write to the clipboard when no tasks remain visible", async () => {
		const writeText = jest.fn().mockResolvedValue(undefined);

		await expect(
			copyBasesCurrentViewTasks({
				dataItems: [],
				format: "titles",
				identifyTaskNotes: jest.fn().mockResolvedValue([]),
				filterTasks: (tasks) => tasks,
				resolveLinkText: (task) => task.path,
				writeText,
			})
		).resolves.toEqual({ status: "empty" });
		expect(writeText).not.toHaveBeenCalled();
	});

	it("resolves markdown link text through Obsidian files and falls back to the path", () => {
		const file = { path: "TaskNotes/Visible.md" };
		const app = {
			vault: {
				getAbstractFileByPath: jest.fn((path: string) =>
					path === file.path ? file : null
				),
			},
			metadataCache: {
				fileToLinktext: jest.fn(() => "Visible"),
			},
		};

		expect(resolveBasesTaskLinkText(app as never, file.path)).toBe("TaskNotes/Visible.md");
		expect(resolveBasesTaskLinkText(app as never, "TaskNotes/Missing.md")).toBe(
			"TaskNotes/Missing.md"
		);
	});
});
