import { EditorState } from "@codemirror/state";
import { TFile } from "obsidian";
import { buildTaskLinkDecorations, createTaskLinkViewPlugin } from "../../../src/editor/TaskLinkOverlay";
import { TaskLinkWidget } from "../../../src/editor/TaskLinkWidget";
import { isTaskFrontmatter } from "../../../src/utils/taskIdentification";
import { PluginFactory, TaskFactory } from "../../helpers/mock-factories";
import type { TaskInfo } from "../../../src/types";

jest.mock("../../../src/editor/TaskLinkWidget");
const MockWidget = TaskLinkWidget as jest.MockedClass<typeof TaskLinkWidget>;

describe("Discussion #2355: inline task identity and fallback data", () => {
	function setup() {
		const task = TaskFactory.createTask({ path: "Tasks/Lecture.md", title: "Lecture" });
		const file = new TFile(task.path);
		const plugin = PluginFactory.createMockPlugin({
			settings: { enableTaskLinkOverlay: true, taskIdentificationMethod: "tag", taskTag: "task" },
			emitter: { on: jest.fn(), offref: jest.fn() },
			app: {
				workspace: {},
				vault: { getAbstractFileByPath: jest.fn(() => file) },
				metadataCache: {
					getFirstLinkpathDest: jest.fn(() => file),
					getFileCache: jest.fn(() => ({ frontmatter: { tags: ["task"] } })),
				},
			},
			cacheManager: {
				getCachedTaskInfoSync: jest.fn(() => task),
				isValidFile: jest.fn(() => true),
			},
		});
		plugin.cacheManager.isTaskFile = (fm: unknown) => isTaskFrontmatter(fm, plugin.settings);
		const active = new Map<string, TaskLinkWidget>();
		const fallback = new Map<string, TaskInfo>();
		MockWidget.mockImplementation(() => ({ eq: () => false }) as TaskLinkWidget);
		const build = (doc = "Links: [[Lecture]] [[Lecture#Details]] [[Lecture#^block|Alias]]") =>
			buildTaskLinkDecorations(EditorState.create({ doc }), plugin, active, "Links.md", fallback);
		return { task, plugin, active, fallback, build };
	}

	it.each([
		["tag", { status: "open" }],
		["property", { isTask: false }],
		["property", {}],
		["tag", undefined],
	])("removes overlays when %s identity is removed", (method, frontmatter) => {
		const { plugin, fallback, active, build } = setup();
		plugin.settings.taskIdentificationMethod = method as "tag" | "property";
		plugin.settings.taskPropertyName = "isTask";
		plugin.settings.taskPropertyValue = "true";
		expect(build().size).toBe(3);
		(plugin.cacheManager.getCachedTaskInfoSync as jest.Mock).mockReturnValue(null);
		(plugin.app.metadataCache.getFileCache as jest.Mock).mockReturnValue({ frontmatter });
		expect(build().size).toBe(0);
		expect(fallback.size).toBe(0);
		expect(active.size).toBe(0);
		// A later metadata gap must not resurrect a known non-task.
		(plugin.app.metadataCache.getFileCache as jest.Mock).mockReturnValue(null);
		expect(build().size).toBe(0);
	});

	it.each([null, { frontmatter: { tags: ["task/lecture"] } }])(
		"preserves independent labels and targets during a transient miss (%j)", (metadata) => {
			const { plugin, build } = setup();
			expect(build().size).toBe(3);
			(plugin.cacheManager.getCachedTaskInfoSync as jest.Mock).mockReturnValue(null);
			(plugin.app.metadataCache.getFileCache as jest.Mock).mockReturnValue(metadata);
			MockWidget.mockClear();
			expect(build().size).toBe(3);
			expect(MockWidget.mock.calls.map(call => [call[2], call[3], call[5]])).toEqual([
				["[[Lecture]]", undefined, undefined],
				["[[Lecture#Details]]", "Lecture > Details", "#Details"],
				["[[Lecture#^block|Alias]]", "Alias", "#^block"],
			]);
		}
	);

	it.each(["deleted", "excluded"])("does not revive a %s file", reason => {
		const { plugin, build, fallback } = setup();
		build();
		(plugin.cacheManager.getCachedTaskInfoSync as jest.Mock).mockReturnValue(null);
		if (reason === "deleted") {
			(plugin.app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
		} else {
			(plugin.cacheManager.isValidFile as jest.Mock).mockReturnValue(false);
		}
		expect(build().size).toBe(0);
		expect(fallback.size).toBe(0);
	});

	it("passes decoded Markdown heading targets to the widget", () => {
		const { build } = setup();
		expect(build("Link: [Section](Lecture.md#Detailed%20notes)").size).toBe(1);
		expect(MockWidget.mock.calls.at(-1)?.[5]).toBe("#Detailed notes");
	});

	it("keeps fallback data and widget instances local to each editor view", () => {
		const { plugin } = setup();
		const extension = createTaskLinkViewPlugin(plugin);
		// Avoid needing an Obsidian editor field; exercise the actual ViewPlugin lifecycle.
		const view = { state: { field: () => false }, dispatch: jest.fn() };
		const first = extension.create(view as never) as unknown as {
			activeWidgets: Map<string, TaskLinkWidget>;
			lastKnownTasks: Map<string, TaskInfo>;
			destroy(): void;
		};
		const second = extension.create(view as never) as unknown as typeof first;
		expect(first.activeWidgets).not.toBe(second.activeWidgets);
		expect(first.lastKnownTasks).not.toBe(second.lastKnownTasks);
		first.destroy();
		second.destroy();
	});
});
