import { App, TFile } from "obsidian";
import { buildSubtaskCreationPrePopulatedValues } from "../../../src/services/taskRelationshipActions";
import type { TaskInfo } from "../../../src/types";
import { MockObsidian } from "../../helpers/obsidian-runtime";

const createMockApp = (mockApp: unknown): App => mockApp as App;

function createParentTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Parent Task",
		status: "open",
		path: "Tasks/Parent Task.md",
		archived: false,
		tags: [],
		contexts: [],
		projects: [],
		...overrides,
	};
}

function createPlugin(settings: Record<string, unknown> = {}) {
	return {
		app: createMockApp(MockObsidian.createMockApp()),
		settings: {
			taskTag: "task",
			taskIdentificationMethod: "tag",
			useFrontmatterMarkdownLinks: false,
			taskCreationDefaults: {
				inheritParentTaskProperties: false,
			},
			...settings,
		},
	};
}

describe("issue #1912 Create subtask should use parent basename, not full path", () => {
	beforeEach(() => {
		MockObsidian.reset();
	});

	it("populates the project link with [[basename]] instead of [[Folder/basename]]", () => {
		const parentFile = new TFile("Tasks/Parent Task.md");
		const values = buildSubtaskCreationPrePopulatedValues(
			createPlugin() as never,
			createParentTask(),
			parentFile
		);

		// The parent link in projects must match what the "Add as subtask" action
		// produces (which uses generateLink + fileToLinktext, i.e. basename when unique).
		// Before the fix the link was the full path: "[[Tasks/Parent Task]]".
		expect(values.projects).toEqual(["[[Parent Task]]"]);
	});

	it("works the same way for parents in nested folders", () => {
		const parentFile = new TFile("Work/Projects/Big Project.md");
		const values = buildSubtaskCreationPrePopulatedValues(
			createPlugin() as never,
			createParentTask({
				path: "Work/Projects/Big Project.md",
				title: "Big Project",
			}),
			parentFile
		);

		expect(values.projects).toEqual(["[[Big Project]]"]);
	});

	it("uses markdown link format when useFrontmatterMarkdownLinks is enabled", () => {
		const parentFile = new TFile("Tasks/Parent Task.md");
		const values = buildSubtaskCreationPrePopulatedValues(
			createPlugin({ useFrontmatterMarkdownLinks: true }) as never,
			createParentTask(),
			parentFile
		);

		// Markdown link variant should still resolve via Obsidian's link generator
		// and produce a usable link rather than a raw-path wikilink.
		expect(values.projects).toHaveLength(1);
		expect(values.projects?.[0]).toMatch(/Parent Task/);
		expect(values.projects?.[0]).not.toMatch(/^\[\[Tasks\//);
	});
});
