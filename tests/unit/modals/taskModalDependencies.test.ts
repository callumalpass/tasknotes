import { TFile } from "obsidian";
import {
	addDependencyItem,
	getBlockedByDependencyCandidates,
	getBlockingDependencyCandidates,
	removeDependencyItemAtIndex,
	type DependencyItem,
} from "../../../src/modals/taskModalDependencies";
import type { TaskInfo } from "../../../src/types";

function task(path: string): TaskInfo {
	return {
		title: path,
		status: "open",
		priority: "normal",
		path,
		archived: false,
	};
}

function dependency(uid: string, path?: string): DependencyItem {
	return {
		dependency: { uid, reltype: "FINISHTOSTART" },
		name: path ?? uid,
		path,
	};
}

function createPlugin(paths: string[], useMarkdownLinks = false): any {
	const files = new Map(paths.map((path) => [path, new TFile(path)]));
	return {
		app: {
			vault: {
				getAbstractFileByPath: (path: string) => files.get(path) ?? null,
			},
			metadataCache: {
				fileToLinktext: (file: TFile) => file.path.replace(/\.md$/i, ""),
			},
			fileManager: {
				generateMarkdownLink: (file: TFile) => `[${file.basename}](${file.path})`,
			},
		},
		settings: { useFrontmatterMarkdownLinks: useMarkdownLinks },
	};
}

describe("taskModalDependencies state helpers", () => {
	it("adds dependency items without duplicating by uid or path", () => {
		const existing = [dependency("[[Tasks/one]]", "Tasks/one.md")];

		expect(addDependencyItem(existing, dependency("[[Tasks/one]]"))).toEqual(existing);
		expect(addDependencyItem(existing, dependency("[[Other]]", "Tasks/one.md"))).toEqual(
			existing
		);
		expect(addDependencyItem(existing, dependency("[[Tasks/two]]", "Tasks/two.md"))).toEqual([
			...existing,
			dependency("[[Tasks/two]]", "Tasks/two.md"),
		]);
	});

	it("removes dependency items by index", () => {
		const first = dependency("[[Tasks/one]]", "Tasks/one.md");
		const second = dependency("[[Tasks/two]]", "Tasks/two.md");

		expect(removeDependencyItemAtIndex([first, second], 0)).toEqual([second]);
		expect(removeDependencyItemAtIndex([first], 5)).toEqual([first]);
	});

	it("filters blocked-by candidates by current task and existing dependency uid", () => {
		const plugin = createPlugin([
			"Tasks/current.md",
			"Tasks/existing.md",
			"Tasks/available.md",
		]);
		const allTasks = [
			task("Tasks/current.md"),
			task("Tasks/existing.md"),
			task("Tasks/available.md"),
		];

		expect(
			getBlockedByDependencyCandidates({
				plugin,
				sourcePath: "Tasks/current.md",
				allTasks,
				existingItems: [dependency("[[Tasks/existing]]", "Tasks/existing.md")],
				currentPath: "Tasks/current.md",
			}).map((candidate) => candidate.path)
		).toEqual(["Tasks/available.md"]);
	});

	it("filters blocking candidates by current task, existing path, and existing uid", () => {
		const plugin = createPlugin([
			"Tasks/current.md",
			"Tasks/existing-path.md",
			"Tasks/existing-uid.md",
			"Tasks/available.md",
		]);
		const allTasks = [
			task("Tasks/current.md"),
			task("Tasks/existing-path.md"),
			task("Tasks/existing-uid.md"),
			task("Tasks/available.md"),
		];

		expect(
			getBlockingDependencyCandidates({
				plugin,
				sourcePath: "Tasks/current.md",
				allTasks,
				existingItems: [
					dependency("[[Different uid]]", "Tasks/existing-path.md"),
					dependency("[[Tasks/existing-uid]]"),
				],
				currentPath: "Tasks/current.md",
			}).map((candidate) => candidate.path)
		).toEqual(["Tasks/available.md"]);
	});
});
