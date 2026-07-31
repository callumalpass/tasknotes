import { App, TFile } from "obsidian";
import { buildSubtaskCreationPrePopulatedValues } from "../../../src/services/taskRelationshipActions";
import type { TaskInfo } from "../../../src/types";
import { MockObsidian } from "../../helpers/obsidian-runtime";

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

		expect(values.projects).toEqual(["[[Build login page]]"]);
		expect(values.contexts).toBeUndefined();
		expect(values.priority).toBeUndefined();
		expect(values.tags).toBeUndefined();
	});

	it("uses Obsidian link text for the parent project link", () => {
		const parentFile = new TFile("Tasks/Product Code Implementation.md");
		const plugin = createPlugin() as never;
		(plugin as any).app.metadataCache.fileToLinktext = jest
			.fn()
			.mockReturnValue("Product Code Implementation");

		const values = buildSubtaskCreationPrePopulatedValues(
			plugin,
			createParentTask({
				title: "Product Code Implementation",
				path: "Tasks/Product Code Implementation.md",
			}),
			parentFile
		);

		expect((plugin as any).app.metadataCache.fileToLinktext).toHaveBeenCalledWith(
			parentFile,
			"Tasks/Product Code Implementation.md",
			true
		);
		expect(values.projects).toEqual(["[[Product Code Implementation]]"]);
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
			"[[Build login page]]",
		]);
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
			createPlugin({
				taskCreationDefaults: {
					inheritParentTaskProperties: true,
				},
			}) as never,
			createParentTask({
				projects: ["[[Projects/YGPT Dashboard]]", "[[Build login page]]"],
			}),
			parentFile
		);

		expect(values.projects).toEqual([
			"[[Projects/YGPT Dashboard]]",
			"[[Build login page]]",
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
			"[[YGPT Dashboard]]",
			"[[Build login page]]",
		]);
	});
});
