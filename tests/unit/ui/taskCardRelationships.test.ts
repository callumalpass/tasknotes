import { describe, expect, it, jest } from "@jest/globals";
import type { App } from "obsidian";
import type { TaskInfo } from "../../../src/types";
import {
	filterExpandedRelationshipTasks,
	getBlockedByTaskPaths,
	parseExpandedRelationshipFilterMode,
	sortExpandedRelationshipTasks,
} from "../../../src/ui/taskCardRelationships";

function createTask(path: string, title = path): TaskInfo {
	return {
		title,
		status: "open",
		priority: "normal",
		path,
		archived: false,
	};
}

function createApp(): App {
	return {
		metadataCache: {
			getFirstLinkpathDest: jest.fn(() => null),
		},
		vault: {
			getAbstractFileByPath: jest.fn(() => null),
		},
	} as unknown as App;
}

describe("TaskCard relationships", () => {
	it("normalizes expanded relationship filter mode values", () => {
		expect(parseExpandedRelationshipFilterMode("show all")).toBe("show-all");
		expect(parseExpandedRelationshipFilterMode("\"show_all\"")).toBe("show-all");
		expect(parseExpandedRelationshipFilterMode(1)).toBe("show-all");
		expect(parseExpandedRelationshipFilterMode("inherit")).toBe("inherit");
		expect(parseExpandedRelationshipFilterMode(0)).toBe("inherit");
		expect(parseExpandedRelationshipFilterMode("unexpected")).toBe("inherit");
	});

	it("filters inherited relationship tasks to the current view scope", () => {
		const first = createTask("Tasks/first.md");
		const second = createTask("Tasks/second.md");

		expect(
			filterExpandedRelationshipTasks([first, second], {
				expandedRelationshipTaskPaths: new Set([second.path]),
			})
		).toEqual([second]);

		expect(
			filterExpandedRelationshipTasks([first, second], {
				expandedRelationshipFilterMode: "show-all",
				expandedRelationshipTaskPaths: new Set([second.path]),
			})
		).toEqual([first, second]);
	});

	it("lets the live filter-mode resolver override stored relationship options", () => {
		const first = createTask("Tasks/first.md");
		const second = createTask("Tasks/second.md");

		expect(
			filterExpandedRelationshipTasks([first, second], {
				expandedRelationshipFilterMode: "inherit",
				resolveExpandedRelationshipFilterMode: () => "show-all",
				expandedRelationshipTaskPaths: new Set([second.path]),
			})
		).toEqual([first, second]);
	});

	it("sorts ranked relationship tasks by view order and delegates unranked tasks", () => {
		const alpha = createTask("Tasks/alpha.md", "Alpha");
		const beta = createTask("Tasks/beta.md", "Beta");
		const gamma = createTask("Tasks/gamma.md", "Gamma");
		const sortTasks = jest.fn((tasks: TaskInfo[]) =>
			[...tasks].sort((a, b) => a.title.localeCompare(b.title))
		);

		expect(
			sortExpandedRelationshipTasks(
				[gamma, beta, alpha],
				{
					expandedRelationshipTaskOrder: new Map([
						[beta.path, 0],
						[gamma.path, 1],
					]),
				},
				sortTasks
			)
		).toEqual([beta, gamma, alpha]);
		expect(sortTasks).toHaveBeenCalledWith([alpha]);
	});

	it("falls back to the supplied relationship sort when no view order exists", () => {
		const alpha = createTask("Tasks/alpha.md", "Alpha");
		const beta = createTask("Tasks/beta.md", "Beta");
		const sortTasks = jest.fn((tasks: TaskInfo[]) =>
			[...tasks].sort((a, b) => a.title.localeCompare(b.title))
		);

		expect(sortExpandedRelationshipTasks([beta, alpha], {}, sortTasks)).toEqual([alpha, beta]);
		expect(sortTasks).toHaveBeenCalledWith([beta, alpha]);
	});

	it("normalizes and deduplicates blocked-by dependency paths", () => {
		const app = createApp();
		const task = createTask("Tasks/dependent.md");
		task.blockedBy = [
			{ uid: "[[Tasks/blocker.md]]", reltype: "FINISHTOSTART" },
			"[[Tasks/blocker.md]]",
			{ uid: "", reltype: "FINISHTOSTART" },
		];

		expect(getBlockedByTaskPaths(task, app)).toEqual(["Tasks/blocker.md"]);
	});
});
