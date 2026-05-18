import { TFile } from "obsidian";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";
import {
	cleanupTaskCardExpansions,
	toggleBlockedByTasksExpansion,
	toggleBlockingTasksExpansion,
	toggleSubtasksExpansion,
	type TaskCardRelationshipExpansionContext,
} from "../../../src/ui/taskCardRelationshipExpansion";

jest.mock("obsidian");

function createTask(path: string, title = path): TaskInfo {
	return {
		title,
		status: "open",
		priority: "normal",
		path,
		archived: false,
	};
}

function createCard(path: string): HTMLElement {
	const card = document.createElement("div");
	card.className = "task-card";
	card.dataset.taskPath = path;
	(card as HTMLElement & { _taskPath?: string })._taskPath = path;
	return card;
}

function createRenderedCard(task: TaskInfo): HTMLElement {
	const card = createCard(task.path);
	card.textContent = task.title;
	return card;
}

function createPlugin(): TaskNotesPlugin {
	return {
		settings: {},
		app: {
			vault: {
				getAbstractFileByPath: jest.fn((path: string) => new TFile(path)),
			},
			metadataCache: {
				getFirstLinkpathDest: jest.fn(() => null),
			},
		},
		i18n: {
			translate: jest.fn((key: string) => {
				const translations: Record<string, string> = {
					"contextMenus.task.subtasks.loading": "Loading subtasks...",
					"contextMenus.task.subtasks.noSubtasks": "No subtasks found",
					"contextMenus.task.subtasks.loadFailed": "Failed to load subtasks",
					"ui.taskCard.loadingDependencies": "Loading dependencies...",
					"ui.taskCard.blockingEmpty": "No blocked tasks",
					"ui.taskCard.blockingLoadError": "Failed to load dependencies",
					"ui.taskCard.blockedBadge": "Blocked",
				};
				return translations[key] ?? key;
			}),
		},
		projectSubtasksService: {
			getTasksLinkedToProject: jest.fn(),
			sortTasks: jest.fn((tasks: TaskInfo[]) =>
				[...tasks].sort((a, b) => a.title.localeCompare(b.title))
			),
		},
		cacheManager: {
			getTaskInfo: jest.fn(),
		},
	} as unknown as TaskNotesPlugin;
}

function createContext(
	plugin: TaskNotesPlugin,
	options = {},
	renderTaskCard = jest.fn(createRenderedCard)
): TaskCardRelationshipExpansionContext {
	return {
		plugin,
		getRelationshipOptions: jest.fn(() => options),
		renderTaskCard,
	};
}

describe("taskCardRelationshipExpansion", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	it("renders filtered and ordered subtasks while skipping circular project chains", async () => {
		const plugin = createPlugin();
		const parent = createTask("Tasks/parent.md", "Parent");
		const alpha = createTask("Tasks/alpha.md", "Alpha");
		const beta = createTask("Tasks/beta.md", "Beta");
		(plugin.projectSubtasksService.getTasksLinkedToProject as jest.Mock).mockResolvedValue([
			parent,
			alpha,
			beta,
		]);
		const relationshipOptions = {
			expandedRelationshipTaskOrder: new Map([[beta.path, 0]]),
		};
		const renderTaskCard = jest.fn(createRenderedCard);
		const card = createCard(parent.path);

		await toggleSubtasksExpansion(
			createContext(plugin, relationshipOptions, renderTaskCard),
			card,
			parent,
			true
		);

		const rendered = Array.from(
			card.querySelectorAll<HTMLElement>(".task-card__subtasks > .task-card")
		);
		expect(rendered.map((subtaskCard) => subtaskCard.dataset.taskPath)).toEqual([
			beta.path,
			alpha.path,
		]);
		expect(rendered.every((subtaskCard) => subtaskCard.classList.contains("task-card--subtask"))).toBe(
			true
		);
		expect(renderTaskCard).toHaveBeenCalledWith(beta, relationshipOptions);
		expect(plugin.projectSubtasksService.sortTasks).toHaveBeenCalledWith([parent, alpha]);
	});

	it("renders blocking dependencies through the injected card renderer and removes them on collapse", async () => {
		const plugin = createPlugin();
		const dependent = createTask("Tasks/dependent.md", "Dependent");
		const hidden = createTask("Tasks/hidden.md", "Hidden");
		(plugin.cacheManager.getTaskInfo as jest.Mock).mockImplementation(async (path: string) => {
			if (path === dependent.path) return dependent;
			if (path === hidden.path) return hidden;
			return null;
		});
		const task = createTask("Tasks/blocker.md", "Blocker");
		task.blocking = [dependent.path, hidden.path];
		const card = createCard(task.path);
		card.classList.add("task-card--nested-interactive-hover");
		const parentDblClick = jest.fn();
		card.addEventListener("dblclick", parentDblClick);

		await toggleBlockingTasksExpansion(
			createContext(plugin, {
				expandedRelationshipTaskPaths: new Set([dependent.path]),
			}),
			card,
			task,
			true
		);

		const container = card.querySelector<HTMLElement>(".task-card__blocking");
		expect(container).not.toBeNull();
		expect(
			Array.from(container?.querySelectorAll<HTMLElement>(":scope > .task-card") ?? []).map(
				(dependencyCard) => dependencyCard.dataset.taskPath
			)
		).toEqual([dependent.path]);

		container?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
		expect(parentDblClick).not.toHaveBeenCalled();

		await toggleBlockingTasksExpansion(createContext(plugin), card, task, false);
		expect(card.querySelector(".task-card__blocking")).toBeNull();
		expect(card.classList.contains("task-card--nested-interactive-hover")).toBe(false);
	});

	it("renders blocked-by dependencies from normalized dependency entries", async () => {
		const plugin = createPlugin();
		const blocker = createTask("Tasks/blocker.md", "Blocking prerequisite");
		(plugin.cacheManager.getTaskInfo as jest.Mock).mockImplementation(async (path: string) =>
			path === blocker.path ? blocker : null
		);
		const task = createTask("Tasks/blocked.md", "Blocked");
		task.blockedBy = [{ uid: "Tasks/blocker.md", reltype: "FINISHTOSTART" }];
		const card = createCard(task.path);

		await toggleBlockedByTasksExpansion(createContext(plugin), card, task, true);

		const rendered = Array.from(
			card.querySelectorAll<HTMLElement>(".task-card__blocked-by > .task-card")
		);
		expect(rendered.map((blockerCard) => blockerCard.dataset.taskPath)).toEqual([blocker.path]);
		expect(rendered[0]?.classList.contains("task-card--dependency")).toBe(true);
	});

	it("cleans up stored relationship containers", async () => {
		const plugin = createPlugin();
		const child = createTask("Tasks/child.md", "Child");
		(plugin.projectSubtasksService.getTasksLinkedToProject as jest.Mock).mockResolvedValue([
			child,
		]);
		const task = createTask("Tasks/parent.md", "Parent");
		const card = createCard(task.path);

		await toggleSubtasksExpansion(createContext(plugin), card, task, true);

		expect(card.querySelector(".task-card__subtasks")).not.toBeNull();
		cleanupTaskCardExpansions(card);
		expect(card.querySelector(".task-card__subtasks")).toBeNull();
	});
});
