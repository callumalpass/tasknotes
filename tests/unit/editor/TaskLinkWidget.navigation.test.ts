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
			getAllStatuses: jest.fn(() => []),
			getStatusConfig: jest.fn((status: string) => ({ value: status, label: status, color: "#666666" })),
			getNextStatus: jest.fn(() => "done"),
		},
		priorityManager: {
			getPriorityConfig: jest.fn((priority: string) => ({ value: priority, label: priority, color: "#ff0000" })),
		},
		fieldMapper: {
			toUserField: jest.fn((field: string) => field), toInternalField: jest.fn((field: string) => field),
			getMapping: jest.fn(() => ({ status: "status" })),
			isPropertyForField: jest.fn((property: string, field: string) => property === field),
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

	it("groups sentence controls before the title without changing standalone composition", () => {
		const { task, plugin, render } = setup();
		plugin.settings.inlineVisibleProperties = ["status"];
		expect(render().querySelector(".task-card__inline-controls")).toBeNull();
		const sentence = new TaskLinkWidget(task, plugin, "[[Lecture]]", "Alias", undefined, undefined, true).toDOM({} as EditorView);
		const controls = sentence.querySelector(".task-card__inline-controls")!;
		expect(controls.querySelector(".task-card__status-dot")).not.toBeNull();
		expect(controls.querySelector(".task-card__context-menu")?.getAttribute("tabindex")).toBe("0");
		expect(controls.compareDocumentPosition(sentence.querySelector(".task-card__content")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it("preserves sentence control placement through Reading mode refresh", async () => {
		const { plugin, container } = setup();
		const paragraph = document.createElement("p");
		paragraph.append("Review ");
		const link = document.createElement("a");
		link.className = "internal-link";
		link.dataset.href = "Lecture";
		link.href = "Lecture";
		link.textContent = "Alias";
		paragraph.append(link, ", then share.");
		container.append(paragraph);
		const processor = new ReadingModeTaskLinkProcessor(plugin);
		const context = { sourcePath: "Links.md", getSectionInfo: () => ({ text: "Review [[Lecture|Alias]], then share.", lineStart: 0, lineEnd: 0 }) } as unknown as MarkdownPostProcessorContext;
		await processor.createPostProcessor()(container, context);
		await Promise.resolve();
		expect(container.querySelector(".tasknotes-inline-widget--sentence .task-card__inline-controls")).not.toBeNull();
		await (processor as any).refreshReadingModeWidgets();
		expect(container.querySelector(".tasknotes-inline-widget--sentence .task-card__inline-controls")).not.toBeNull();
		expect(paragraph.lastChild?.textContent).toBe(", then share.");
	});

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
