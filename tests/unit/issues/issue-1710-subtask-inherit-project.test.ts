import { App, TFile } from "obsidian";
import { buildSubtaskCreationPrePopulatedValues } from "../../../src/services/taskRelationshipActions";
import type { TaskInfo } from "../../../src/types";
import { MockObsidian } from "../../__mocks__/obsidian";

jest.mock("obsidian");

const createMockApp = (mockApp: unknown): App => mockApp as App;

function createParentTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Build login page",
		status: "open",
		priority: "normal",
		path: "Tasks/Build login page.md",
		archived: false,
		projects: ["[[Projects/YGPT Dashboard]]"],
		tags: [],
		...overrides,
	};
}

function createPlugin(settings: Record<string, unknown> = {}) {
	return {
		app: createMockApp(MockObsidian.createMockApp()),
		settings: {
			taskTag: "task",
			taskIdentificationMethod: "property",
			useFrontmatterMarkdownLinks: false,
			...settings,
		},
	};
}

describe("issue #1710 subtask project inheritance", () => {
	beforeEach(() => {
		MockObsidian.reset();
	});

	it("prefills a new subtask with the parent task's projects and parent link", () => {
		const parentFile = new TFile("Tasks/Build login page.md");
		const values = buildSubtaskCreationPrePopulatedValues(
			createPlugin() as never,
			createParentTask(),
			parentFile
		);

		expect(values.projects).toEqual(["[[Projects/YGPT Dashboard]]", "[[Build login page]]"]);
	});

	it("keeps the parent link when the parent task has no projects", () => {
		const parentFile = new TFile("Tasks/Build login page.md");
		const values = buildSubtaskCreationPrePopulatedValues(
			createPlugin() as never,
			createParentTask({ projects: [] }),
			parentFile
		);

		expect(values.projects).toEqual(["[[Build login page]]"]);
	});

	it("does not duplicate the parent link if it is already one of the parent projects", () => {
		const parentFile = new TFile("Tasks/Build login page.md");
		const values = buildSubtaskCreationPrePopulatedValues(
			createPlugin() as never,
			createParentTask({
				projects: ["[[Projects/YGPT Dashboard]]", "[[Build login page]]"],
			}),
			parentFile
		);

		expect(values.projects).toEqual(["[[Projects/YGPT Dashboard]]", "[[Build login page]]"]);
	});
});
