import {
	buildFilterOptions,
	buildUserPropertyDefinitions,
	extractUniqueFoldersFromTaskPaths,
} from "../../../src/services/filter-service/filterOptions";
import type { PriorityConfig, StatusConfig } from "../../../src/types";
import type { TaskNotesSettings } from "../../../src/types/settings";

function createStatus(value: string): StatusConfig {
	return {
		id: value,
		value,
		label: value,
		color: "#ffffff",
		isCompleted: false,
		order: 0,
		autoArchive: false,
		autoArchiveDelay: 0,
	};
}

function createPriority(value: string): PriorityConfig {
	return {
		id: value,
		value,
		label: value,
		color: "#ffffff",
		weight: 0,
	};
}

describe("filterOptions", () => {
	it("extracts sorted unique task folders and labels root-level tasks", () => {
		expect(
			extractUniqueFoldersFromTaskPaths(
				[
					"Tasks/Inbox/a.md",
					"Tasks/Inbox/b.md",
					"Projects/Alpha/c.md",
					"root-task.md",
				],
				"(Root)"
			)
		).toEqual(["(Root)", "Projects/Alpha", "Tasks/Inbox"]);
	});

	it("builds dynamic user property definitions by user-field type", () => {
		const fields: TaskNotesSettings["userFields"] = [
			{ id: "effort", key: "effort", displayName: "Effort", type: "number" },
			{ id: "review", key: "review", displayName: "Review", type: "date" },
			{ id: "flag", key: "flag", displayName: "Flag", type: "boolean" },
			{ id: "labels", key: "labels", displayName: "Labels", type: "list" },
			{ id: "note", key: "note", displayName: "Note", type: "text" },
			{ id: "skip", key: "", displayName: "Skip", type: "text" } as never,
		];

		const definitions = buildUserPropertyDefinitions(fields);

		expect(definitions).toEqual([
			expect.objectContaining({
				id: "user:effort",
				label: "Effort",
				category: "numeric",
				valueInputType: "number",
				supportedOperators: expect.arrayContaining(["is-greater-than", "is-empty"]),
			}),
			expect.objectContaining({
				id: "user:review",
				category: "date",
				valueInputType: "date",
				supportedOperators: expect.arrayContaining(["is-before", "is-on-or-after"]),
			}),
			expect.objectContaining({
				id: "user:flag",
				category: "boolean",
				valueInputType: "none",
				supportedOperators: ["is-checked", "is-not-checked"],
			}),
			expect.objectContaining({
				id: "user:labels",
				category: "text",
				valueInputType: "text",
				supportedOperators: ["contains", "does-not-contain", "is-empty", "is-not-empty"],
			}),
			expect.objectContaining({
				id: "user:note",
				category: "text",
				valueInputType: "text",
				supportedOperators: [
					"is",
					"is-not",
					"contains",
					"does-not-contain",
					"is-empty",
					"is-not-empty",
				],
			}),
		]);
	});

	it("builds filter options from injected sources", () => {
		const options = buildFilterOptions({
			statuses: [createStatus("open")],
			priorities: [createPriority("high")],
			contexts: ["home"],
			projects: ["Project A"],
			tags: ["task"],
			taskPaths: ["Tasks/a.md", "b.md"],
			rootFolderLabel: "(Root)",
			userFields: [
				{ id: "effort", key: "effort", displayName: "Effort", type: "number" },
			],
		});

		expect(options.statuses.map((status) => status.value)).toEqual(["open"]);
		expect(options.priorities.map((priority) => priority.value)).toEqual(["high"]);
		expect(options.contexts).toEqual(["home"]);
		expect(options.projects).toEqual(["Project A"]);
		expect(options.tags).toEqual(["task"]);
		expect(options.folders).toEqual(["(Root)", "Tasks"]);
		expect(options.userProperties).toEqual([
			expect.objectContaining({ id: "user:effort", label: "Effort" }),
		]);
	});
});
