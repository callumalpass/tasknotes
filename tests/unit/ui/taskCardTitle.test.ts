import { TFile } from "obsidian";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";
import {
	createTaskCardTitle,
	getTaskCardTitleText,
	renderTaskCardTitleText,
	syncTaskCardTitleCompletion,
	updateTaskCardTitle,
} from "../../../src/ui/taskCardTitle";

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Task",
		status: "open",
		priority: "normal",
		path: "Tasks/task.md",
		archived: false,
		...overrides,
	};
}

function createPlugin(): TaskNotesPlugin {
	return {
		app: {
			metadataCache: {
				getFirstLinkpathDest: jest.fn(),
			},
			workspace: {
				trigger: jest.fn(),
				openLinkText: jest.fn(),
				getLeaf: jest.fn(() => ({
					openFile: jest.fn(),
				})),
			},
		},
	} as unknown as TaskNotesPlugin;
}

describe("taskCardTitle", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	it("resolves display text before task title, falling back for blank overrides", () => {
		const task = createTask({ title: "Stored title" });

		expect(getTaskCardTitleText(task, "Alias title")).toBe("Alias title");
		expect(getTaskCardTitleText(task, "  ")).toBe("Stored title");
		expect(getTaskCardTitleText(createTask({ title: null as unknown as string }))).toBe("");
	});

	it("renders wikilinks in task titles with the task path as source context", () => {
		const plugin = createPlugin();
		const linkedFile = new TFile("Projects/Lidl.md");
		(plugin.app.metadataCache.getFirstLinkpathDest as jest.Mock).mockReturnValue(linkedFile);
		const container = document.createElement("span");
		const task = createTask({
			title: "Buy milk from [[Lidl]]",
			path: "Tasks/buy-milk.md",
		});

		renderTaskCardTitleText(container, task, plugin);

		const link = container.querySelector<HTMLAnchorElement>("a.internal-link");
		expect(container.textContent).toBe("Buy milk from Lidl");
		expect(link?.textContent).toBe("Lidl");
		expect(link?.getAttribute("data-href")).toBe("Lidl");

		link?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
		expect(plugin.app.metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith(
			"Lidl",
			task.path
		);
	});

	it("creates title DOM using the requested layout and completion state", () => {
		const plugin = createPlugin();
		const contentContainer = document.createElement("div");
		const task = createTask({ title: "Done task" });

		const { titleEl, titleTextEl } = createTaskCardTitle({
			contentContainer,
			layout: "inline",
			task,
			plugin,
			isCompleted: true,
		});

		expect(titleEl.tagName).toBe("SPAN");
		expect(titleTextEl.textContent).toBe("Done task");
		expect(titleEl.classList.contains("completed")).toBe(true);
		expect(titleTextEl.classList.contains("completed")).toBe(true);
	});

	it("updates title text and toggles completion classes in place", () => {
		const plugin = createPlugin();
		const card = document.createElement("div");
		const contentContainer = card.createDiv({ cls: "task-card__content" });
		createTaskCardTitle({
			contentContainer,
			layout: "default",
			task: createTask({ title: "Old title" }),
			plugin,
			isCompleted: false,
		});

		updateTaskCardTitle({
			card,
			task: createTask({ title: "New title" }),
			plugin,
			displayText: "Displayed title",
			isCompleted: true,
		});

		const titleEl = card.querySelector<HTMLElement>(".task-card__title");
		const titleTextEl = card.querySelector<HTMLElement>(".task-card__title-text");
		expect(titleTextEl?.textContent).toBe("Displayed title");
		expect(titleEl?.classList.contains("completed")).toBe(true);
		expect(titleTextEl?.classList.contains("completed")).toBe(true);

		syncTaskCardTitleCompletion(card, false);
		expect(titleEl?.classList.contains("completed")).toBe(false);
		expect(titleTextEl?.classList.contains("completed")).toBe(false);
	});

	it("handles missing title elements when syncing completion", () => {
		const card = document.createElement("div");

		expect(() => syncTaskCardTitleCompletion(card, true)).not.toThrow();
	});
});
