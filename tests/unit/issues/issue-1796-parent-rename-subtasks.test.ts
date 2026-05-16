import { describe, expect, it, jest } from "@jest/globals";
import { TFile } from "obsidian";
import { BasesViewBase } from "../../../src/bases/BasesViewBase";
import { ExpandedProjectsService } from "../../../src/services/ExpandedProjectsService";
import { ProjectSubtasksService } from "../../../src/services/ProjectSubtasksService";
import { EVENT_TASK_UPDATED, TaskInfo } from "../../../src/types";
import { TaskFactory } from "../../helpers/mock-factories";

type EventHandler = (payload?: unknown) => void | Promise<void>;

function createEmitter() {
	const handlers = new Map<string, EventHandler>();
	return {
		handlers,
		on: jest.fn((event: string, handler: EventHandler) => {
			handlers.set(event, handler);
			return { event, handler };
		}),
		offref: jest.fn(),
		async trigger(event: string, payload?: unknown) {
			await handlers.get(event)?.(payload);
		},
	};
}

class TestBasesView extends BasesViewBase {
	type = "tasknotesRenameTest";
	handledTasks: TaskInfo[] = [];
	renderCount = 0;

	constructor(plugin: any) {
		super({}, document.createElement("div"), plugin);
	}

	register(fn: () => void): void {
		void fn;
	}

	render(): void {
		this.renderCount++;
	}

	renderError(): void {}

	protected async handleTaskUpdate(task: TaskInfo): Promise<void> {
		this.handledTasks.push(task);
	}

	startListeningFor(paths: string[]): void {
		(this as any).rootElement = document.createElement("div");
		document.body.appendChild((this as any).rootElement);
		for (const path of paths) {
			(this as any).relevantPathsCache.add(path);
		}
		this.setupTaskUpdateListener();
	}

	relevantPaths(): string[] {
		return Array.from((this as any).relevantPathsCache);
	}
}

describe("Issue #1796: parent rename keeps expanded subtasks current", () => {
	it("refreshes a Bases view when an already-visible task is renamed", async () => {
		jest.useFakeTimers();
		const emitter = createEmitter();
		const plugin = {
			emitter,
			fieldMapper: { toUserField: jest.fn((field: string) => field) },
			settings: {},
		};
		const view = new TestBasesView(plugin);
		const originalTask = TaskFactory.createTask({
			path: "TaskNotes/Old Parent.md",
			title: "Old Parent",
		});
		const updatedTask = TaskFactory.createTask({
			...originalTask,
			path: "TaskNotes/New Parent.md",
			title: "New Parent",
		});

		view.startListeningFor([originalTask.path]);
		await emitter.trigger(EVENT_TASK_UPDATED, {
			path: updatedTask.path,
			originalTask,
			updatedTask,
		});

		expect(view.handledTasks).toEqual([]);
		expect(view.relevantPaths()).toEqual([updatedTask.path]);

		jest.advanceTimersByTime(300);

		expect(view.renderCount).toBe(1);
		jest.useRealTimers();
		document.body.innerHTML = "";
	});

	it("invalidates the project index when TaskNotes sees file relationship changes", async () => {
		const childPath = "TaskNotes/Child.md";
		const oldParentPath = "TaskNotes/Old Parent.md";
		const newParentPath = "TaskNotes/New Parent.md";
		let parentPath = oldParentPath;
		let projectLink = "[[Old Parent]]";
		const cacheEmitter = createEmitter();
		const metadataCache = {
			resolvedLinks: {
				[childPath]: {
					[oldParentPath]: 1,
				},
			},
			getCache: jest.fn((path: string) =>
				path === childPath
					? {
							frontmatter: {
								tags: ["task"],
								projects: [projectLink],
							},
						}
					: null
			),
			getFirstLinkpathDest: jest.fn(() => new TFile(parentPath)),
		};
		const plugin = {
			cacheManager: {
				...cacheEmitter,
				isTaskFile: jest.fn(() => true),
			},
			fieldMapper: {
				toUserField: jest.fn(() => "projects"),
			},
			app: {
				metadataCache,
			},
		};
		const service = new ProjectSubtasksService(plugin as any);

		expect(service.isTaskUsedAsProjectSync(oldParentPath)).toBe(true);

		parentPath = newParentPath;
		projectLink = "[[New Parent]]";
		metadataCache.resolvedLinks = {
			[childPath]: {
				[newParentPath]: 1,
			},
		};
		expect(service.isTaskUsedAsProjectSync(newParentPath)).toBe(false);

		await cacheEmitter.trigger("file-renamed");

		expect(service.isTaskUsedAsProjectSync(newParentPath)).toBe(true);
		service.destroy();
		expect(plugin.cacheManager.offref).toHaveBeenCalledTimes(3);
	});

	it("moves expanded state from the old parent path to the renamed path", () => {
		const service = new ExpandedProjectsService({} as any);

		service.setExpanded("TaskNotes/Old Parent.md", true);
		service.renamePath("TaskNotes/Old Parent.md", "TaskNotes/New Parent.md");

		expect(service.isExpanded("TaskNotes/Old Parent.md")).toBe(false);
		expect(service.isExpanded("TaskNotes/New Parent.md")).toBe(true);
	});
});
