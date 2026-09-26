import type { EditorView } from "@codemirror/view";
import { TFile, type MarkdownPostProcessorContext } from "obsidian";
import { TaskLinkWidget } from "../../../src/editor/TaskLinkWidget";
import { ReadingModeTaskLinkProcessor } from "../../../src/editor/ReadingModeTaskLinkProcessor";
import { PluginFactory, TaskFactory } from "../../helpers/mock-factories";

function setup() {
	const task = TaskFactory.createTask({ path: "Tasks/Lecture.md", title: "Lecture" });
	const file = new TFile(task.path);
	const container = document.createElement("div");
	const openFile = jest.fn();
	const plugin = PluginFactory.createMockPlugin({
		registerEvent: jest.fn(), register: jest.fn(),
		settings: {
			enableTaskLinkOverlay: true, inlineVisibleProperties: [],
			singleClickAction: "openNote", doubleClickAction: "none",
			showExpandableSubtasks: false, calendarViewSettings: { timeFormat: "12" },
		},
		app: {
			vault: { getAbstractFileByPath: jest.fn(() => file) },
			metadataCache: { getFirstLinkpathDest: jest.fn((path: string) => path === "Lecture" ? file : null) },
			workspace: {
				openLinkText: jest.fn(), getLeaf: jest.fn(() => ({ openFile })),
				getLeavesOfType: jest.fn(() => [{ view: {
					getMode: () => "preview", previewMode: { containerEl: container },
				} }]),
			},
		},
		cacheManager: { getCachedTaskInfoSync: jest.fn(() => task) },
		statusManager: {
			isCompletedStatus: jest.fn(() => false),
			getStatusConfig: jest.fn((status: string) => ({ value: status, label: status, color: "#666666" })),
			getNextStatus: jest.fn(() => "done"),
		},
		priorityManager: {
			getPriorityConfig: jest.fn((priority: string) => ({ value: priority, label: priority, color: "#ff0000" })),
		},
		fieldMapper: {
			toUserField: jest.fn((field: string) => field), toInternalField: jest.fn((field: string) => field),
		},
		projectSubtasksService: { isTaskUsedAsProjectSync: jest.fn(() => false) },
		openTaskEditModal: jest.fn(),
		i18n: { translate: jest.fn((key: string) => key) },
	});
	const widget = (subpath?: string) => new TaskLinkWidget(task, plugin, "[[Lecture]]", "Alias", undefined, subpath);
	const title = (element: HTMLElement) => element.querySelector<HTMLElement>(".task-card__title-text")!;
	const render = (subpath?: string) => widget(subpath).toDOM({ dispatch: jest.fn() } as unknown as EditorView);
	return { task, plugin, widget, title, render, container, openFile };
}

describe("Discussion #2355: inline heading and block navigation", () => {
	afterEach(() => jest.useRealTimers());

	it.each(["#Details", "#^block"])("retains %s for all open-note gestures", subpath => {
		const { plugin, render, title } = setup();
		const element = title(render(subpath));
		for (const options of [{}, { ctrlKey: true }, { metaKey: true }]) {
			element.dispatchEvent(new MouseEvent("click", { bubbles: true, ...options }));
			expect(plugin.app.workspace.openLinkText).toHaveBeenLastCalledWith(
				"Tasks/Lecture.md" + subpath, "", !!(options.ctrlKey || options.metaKey)
			);
		}
		element.dispatchEvent(new MouseEvent("auxclick", { bubbles: true, button: 1 }));
		expect(plugin.app.workspace.openLinkText).toHaveBeenLastCalledWith("Tasks/Lecture.md" + subpath, "", true);
	});

	it("preserves the target for the configured double-click open action", () => {
		jest.useFakeTimers();
		const { plugin, render, title } = setup();
		plugin.settings.singleClickAction = "edit";
		plugin.settings.doubleClickAction = "openNote";
		const element = title(render("#Details"));
		element.click();
		element.click();
		expect(plugin.app.workspace.openLinkText).toHaveBeenCalledWith("Tasks/Lecture.md#Details", "", false);
		expect(plugin.openTaskEditModal).not.toHaveBeenCalled();
	});

	it("leaves edit actions and plain task-card navigation unchanged", () => {
		const { task, plugin, render, title, openFile } = setup();
		plugin.settings.singleClickAction = "edit";
		title(render("#Details")).click();
		expect(plugin.openTaskEditModal).toHaveBeenCalledWith(task);
		expect(plugin.app.workspace.openLinkText).not.toHaveBeenCalled();
		plugin.settings.singleClickAction = "openNote";
		title(render()).click();
		expect(openFile).toHaveBeenCalled();
	});

	it("replaces widgets when only the navigation target changes", () => {
		const { widget } = setup();
		expect(widget("#One").eq(widget("#Two"))).toBe(false);
		expect(widget("#One").eq(widget("#One"))).toBe(true);
	});

	it.each(["#Details", "#^block"])("retains %s through Reading mode rendering and refresh", async subpath => {
		const { plugin, container, title } = setup();
		const link = document.createElement("a");
		link.className = "internal-link";
		link.href = "Lecture" + subpath;
		link.dataset.href = "Lecture" + subpath;
		link.textContent = "Alias";
		container.appendChild(link);
		const processor = new ReadingModeTaskLinkProcessor(plugin);
		const context = {
			sourcePath: "Links.md",
			getSectionInfo: () => ({ text: `[[Lecture${subpath}|Alias]]`, lineStart: 0, lineEnd: 0 }),
		} as unknown as MarkdownPostProcessorContext;
		await processor.createPostProcessor()(container, context);
		await Promise.resolve();
		expect(plugin.app.metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith("Lecture", "Links.md");
		title(container).click();
		expect(plugin.app.workspace.openLinkText).toHaveBeenLastCalledWith("Tasks/Lecture.md" + subpath, "", false);
		processor.refreshReadingModeWidgets();
		title(container).click();
		expect(plugin.app.workspace.openLinkText).toHaveBeenCalledTimes(2);
		expect(plugin.app.workspace.openLinkText).toHaveBeenLastCalledWith("Tasks/Lecture.md" + subpath, "", false);
		(plugin.cacheManager.getCachedTaskInfoSync as jest.Mock).mockReturnValue(null);
		processor.refreshReadingModeWidgets();
		const restored = container.querySelector("a.internal-link");
		expect(restored?.getAttribute("data-href")).toBe("Lecture" + subpath);
		expect(restored?.textContent).toBe("Alias");
	});
});
