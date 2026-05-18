import { TAbstractFile, TFile } from "obsidian";
import {
	addTaskModalSubtaskFile,
	getTaskModalSubtaskCandidates,
	hasTaskModalSubtaskFile,
	removeTaskModalSubtaskFile,
	renderTaskModalSubtasksList,
} from "../../../src/modals/taskModalSubtasks";
import type { TaskInfo } from "../../../src/types";

function file(path: string): TAbstractFile {
	return new TAbstractFile(path);
}

function markdownFile(path: string): TFile {
	return new TFile(path);
}

function task(path: string): Pick<TaskInfo, "path" | "title"> {
	return { path, title: path };
}

function taskInfo(path: string): TaskInfo {
	return {
		title: path,
		status: "open",
		priority: "normal",
		path,
		archived: false,
	};
}

function createApp(files: Record<string, TFile> = {}): any {
	return {
		metadataCache: {
			fileToLinktext: (targetFile: TFile) => targetFile.path.replace(/\.md$/i, ""),
			getFirstLinkpathDest: (linkPath: string) =>
				files[linkPath] ?? files[`${linkPath}.md`] ?? null,
			getCache: () => ({}),
		},
		workspace: {
			getLeaf: () => ({ openFile: jest.fn() }),
			openLinkText: jest.fn(),
			trigger: jest.fn(),
		},
		fileManager: {
			generateMarkdownLink: (targetFile: TFile) => `[${targetFile.basename}](${targetFile.path})`,
		},
	};
}

describe("taskModalSubtasks", () => {
	it("filters out the current task and already selected subtasks", () => {
		const tasks = [
			task("Tasks/current.md"),
			task("Tasks/selected.md"),
			task("Tasks/available.md"),
		];

		expect(
			getTaskModalSubtaskCandidates(tasks, [file("Tasks/selected.md")], "Tasks/current.md")
		).toEqual([task("Tasks/available.md")]);
	});

	it("keeps all unselected tasks when there is no current task path", () => {
		const tasks = [task("Tasks/one.md"), task("Tasks/two.md")];

		expect(getTaskModalSubtaskCandidates(tasks, [], undefined)).toEqual(tasks);
	});

	it("adds subtask files without duplicates", () => {
		const selected = [file("Tasks/one.md")];
		const duplicate = file("Tasks/one.md");
		const next = file("Tasks/two.md");

		expect(addTaskModalSubtaskFile(selected, duplicate)).toEqual(selected);
		expect(addTaskModalSubtaskFile(selected, next)).toEqual([...selected, next]);
	});

	it("removes subtask files by path", () => {
		const first = file("Tasks/one.md");
		const second = file("Tasks/two.md");

		expect(removeTaskModalSubtaskFile([first, second], file("Tasks/one.md"))).toEqual([
			second,
		]);
		expect(removeTaskModalSubtaskFile([first], file("Tasks/missing.md"))).toEqual([first]);
	});

	it("detects selected subtask files by path", () => {
		expect(hasTaskModalSubtaskFile([file("Tasks/one.md")], file("Tasks/one.md"))).toBe(
			true
		);
		expect(hasTaskModalSubtaskFile([file("Tasks/one.md")], file("Tasks/two.md"))).toBe(
			false
		);
	});

	it("renders cached subtask cards with remove controls", async () => {
		const childFile = markdownFile("Tasks/child.md");
		const childTask = taskInfo(childFile.path);
		const container = document.createElement("div");
		const taskCard = document.createElement("div");
		taskCard.className = "task-card";
		taskCard.textContent = "Child card";
		const createTaskCard = jest.fn(() => taskCard);
		const onRemove = jest.fn();

		await renderTaskModalSubtasksList({
			app: createApp({ "Tasks/child": childFile }),
			listEl: container,
			files: [childFile],
			sourcePath: "Tasks/current.md",
			getCachedTaskInfo: async () => childTask,
			createTaskCard,
			translate: (key) => `translated:${key}`,
			onRemove,
		});

		expect(container.querySelectorAll(".task-project-item--task-card")).toHaveLength(1);
		expect(container.querySelector(".task-project-card-host .task-card")?.textContent).toBe(
			"Child card"
		);
		expect(createTaskCard).toHaveBeenCalledWith(childTask);

		container.querySelector<HTMLButtonElement>(".task-project-remove")?.click();
		expect(onRemove).toHaveBeenCalledWith(childFile);
	});

	it("renders uncached subtasks as links without the project prefix", async () => {
		const childFile = markdownFile("Tasks/uncached-child.md");
		const container = document.createElement("div");
		const createTaskCard = jest.fn();

		await renderTaskModalSubtasksList({
			app: createApp({ "Tasks/uncached-child": childFile }),
			listEl: container,
			files: [childFile],
			sourcePath: "Tasks/current.md",
			getCachedTaskInfo: async () => null,
			createTaskCard,
			translate: (key) => key,
			onRemove: jest.fn(),
		});

		expect(createTaskCard).not.toHaveBeenCalled();
		expect(container.querySelector(".task-card__project-link")?.textContent).toBe(
			"uncached-child.md"
		);
		expect(container.querySelector(".task-project-path")?.textContent).toBe(
			"Tasks/uncached-child.md"
		);
		expect(container.textContent).not.toContain("+uncached-child");
	});
});
