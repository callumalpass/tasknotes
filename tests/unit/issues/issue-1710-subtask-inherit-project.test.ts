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
			taskCreationDefaults: {
				inheritParentTaskProperties: false,
			},
			...settings,
		},
	};
}

describe("issue #1710 subtask project inheritance", () => {
	beforeEach(() => {
		MockObsidian.reset();
	});

	it("prefills a new subtask with only the parent link when inheritance is disabled", () => {
		const parentFile = new TFile("Tasks/Build login page.md");
		const values = buildSubtaskCreationPrePopulatedValues(
			createPlugin() as never,
			createParentTask(),
			parentFile
		);

		expect(values.projects).toEqual(["[[Tasks/Build login page]]"]);
		expect(values.contexts).toBeUndefined();
		expect(values.priority).toBeUndefined();
		expect(values.tags).toBeUndefined();
	});

	it("prefills a new subtask with the parent task's projects and parent link when inheritance is enabled", () => {
		const parentFile = new TFile("Tasks/Build login page.md");
		const values = buildSubtaskCreationPrePopulatedValues(
			createPlugin({
				taskCreationDefaults: {
					inheritParentTaskProperties: true,
				},
			}) as never,
			createParentTask(),
			parentFile
		);

		expect(values.projects).toEqual([
			"[[Projects/YGPT Dashboard]]",
			"[[Tasks/Build login page]]",
		]);
	});

	it("keeps the parent link when the parent task has no projects", () => {
		const parentFile = new TFile("Tasks/Build login page.md");
		const values = buildSubtaskCreationPrePopulatedValues(
			createPlugin() as never,
			createParentTask({ projects: [] }),
			parentFile
		);

		expect(values.projects).toEqual(["[[Tasks/Build login page]]"]);
	});

	it("does not duplicate the parent link if it is already one of the parent projects", () => {
		const parentFile = new TFile("Tasks/Build login page.md");
		const values = buildSubtaskCreationPrePopulatedValues(
			createPlugin({
				taskCreationDefaults: {
					inheritParentTaskProperties: true,
				},
			}) as never,
			createParentTask({
				projects: ["[[Projects/YGPT Dashboard]]", "[[Tasks/Build login page]]"],
			}),
			parentFile
		);

		expect(values.projects).toEqual([
			"[[Projects/YGPT Dashboard]]",
			"[[Tasks/Build login page]]",
		]);
	});

	it("resolves inherited project links against the parent task before prefill", () => {
		const parentFile = new TFile("Tasks/Build login page.md");
		const plugin = createPlugin({
			taskCreationDefaults: {
				inheritParentTaskProperties: true,
			},
		}) as never;
		const resolvedProject = new TFile("Areas/YGPT Dashboard.md");
		(plugin as any).app.metadataCache.getFirstLinkpathDest = jest
			.fn()
			.mockReturnValue(resolvedProject);

		const values = buildSubtaskCreationPrePopulatedValues(
			plugin,
			createParentTask({
				projects: ["[[YGPT Dashboard]]"],
			}),
			parentFile
		);

		expect((plugin as any).app.metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith(
			"YGPT Dashboard",
			"Tasks/Build login page.md"
		);
		expect(values.projects).toEqual([
			"[[Areas/YGPT Dashboard]]",
			"[[Tasks/Build login page]]",
		]);
	});
});
