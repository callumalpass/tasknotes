import { EditorSelection, EditorState } from "@codemirror/state";
import { TFile } from "obsidian";
import { buildTaskLinkDecorations } from "../../../src/editor/TaskLinkOverlay";
import { TaskLinkWidget } from "../../../src/editor/TaskLinkWidget";
import { TaskLinkDetectionService } from "../../../src/services/TaskLinkDetectionService";
import { PluginFactory, TaskFactory } from "../../helpers/mock-factories";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";

jest.mock("../../../src/editor/TaskLinkWidget");

const MockTaskLinkWidget = TaskLinkWidget as jest.MockedClass<typeof TaskLinkWidget>;

describe("Issue #2072: heading task links keep the task name visible", () => {
	let plugin: TaskNotesPlugin;
	let task: TaskInfo;
	let activeWidgets: Map<string, TaskLinkWidget>;
	let displayTexts: Array<string | undefined>;

	beforeEach(() => {
		jest.clearAllMocks();
		displayTexts = [];

		task = TaskFactory.createTask({
			path: "Tasks/Buy groceries.md",
			title: "Buy groceries",
			status: "todo",
		});

		plugin = PluginFactory.createMockPlugin({
			settings: {
				enableTaskLinkOverlay: true,
			},
			app: {
				workspace: {
					getActiveViewOfType: jest.fn().mockReturnValue({
						file: {
							path: "Notes/Daily.md",
						},
					}),
				},
				metadataCache: {
					getFirstLinkpathDest: jest.fn().mockImplementation((linkPath: string) => {
						if (linkPath === "Buy groceries") {
							return { path: task.path };
						}
						return null;
					}),
				},
				vault: {
					getAbstractFileByPath: jest.fn().mockImplementation((path: string) => {
						if (path === task.path) {
							const file = new TFile(path);
							Object.defineProperty(file, "stat", {
								value: { mtime: 1 },
								configurable: true,
							});
							return file;
						}
						return null;
					}),
				},
			},
			cacheManager: {
				...PluginFactory.createMockPlugin().cacheManager,
				getCachedTaskInfoSync: jest.fn().mockImplementation((path: string) => {
					return path === task.path ? task : null;
				}),
				getTaskInfo: jest.fn().mockImplementation(async (path: string) => {
					return path === task.path ? task : null;
				}),
			},
		});

		activeWidgets = new Map();

		MockTaskLinkWidget.mockImplementation((taskInfo, mockPlugin, originalText, displayText) => {
			displayTexts.push(displayText);
			return {
				toDOM: jest.fn(),
				eq: jest.fn().mockReturnValue(false),
				taskInfo,
				plugin: mockPlugin,
				originalText,
				displayText,
			} as unknown as TaskLinkWidget;
		});
	});

	it("labels a no-alias heading wikilink with task title and heading", () => {
		const state = EditorState.create({
			doc: "link to heading: [[Buy groceries#sample heading]]",
			selection: EditorSelection.single(0),
		});

		const decorations = buildTaskLinkDecorations(state, plugin, activeWidgets);

		expect(decorations.size).toBe(1);
		expect(displayTexts).toEqual(["Buy groceries > sample heading"]);
	});

	it("continues to honor explicit aliases on heading wikilinks", () => {
		const state = EditorState.create({
			doc: "link to heading: [[Buy groceries#sample heading|shopping note]]",
			selection: EditorSelection.single(0),
		});

		const decorations = buildTaskLinkDecorations(state, plugin, activeWidgets);

		expect(decorations.size).toBe(1);
		expect(displayTexts).toEqual(["shopping note"]);
	});

	it("returns the same label through the async detection service", async () => {
		const service = new TaskLinkDetectionService(plugin);

		const result = await service.detectTaskLink(
			"[[Buy groceries#sample heading]]",
			"Notes/Daily.md"
		);

		expect(result).toMatchObject({
			isValidTaskLink: true,
			taskPath: task.path,
			displayText: "Buy groceries > sample heading",
		});
	});
});
