import { describe, expect, it, jest } from "@jest/globals";
import { BasesViewBase } from "../../../src/bases/BasesViewBase";
import { EVENT_TASK_DELETED, type TaskInfo } from "../../../src/types";
import { TaskFactory } from "../../helpers/mock-factories";

type EventHandler = (payload?: unknown) => void | Promise<void>;

function createEmitter() {
	const handlers = new Map<string, EventHandler>();
	return {
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
	type = "tasknotesDeleteRefreshTest";
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

	protected async handleTaskUpdate(_task: TaskInfo): Promise<void> {}

	startListening(): HTMLElement {
		const root = document.createElement("div");
		(this as any).rootElement = root;
		document.body.appendChild(root);
		this.setupTaskUpdateListener();
		return root;
	}
}

function createPlugin() {
	return {
		emitter: createEmitter(),
		fieldMapper: {
			toUserField: jest.fn((field: string) => field),
		},
		projectSubtasksService: {
			invalidateIndex: jest.fn(),
		},
		settings: {},
	};
}

describe("Issue #1423: project cards refresh when subtasks are deleted", () => {
	afterEach(() => {
		jest.useRealTimers();
		document.body.innerHTML = "";
	});

	it("refreshes Bases views when a deleted task had project references", async () => {
		jest.useFakeTimers();
		const plugin = createPlugin();
		const view = new TestBasesView(plugin);
		view.startListening();

		await plugin.emitter.trigger(EVENT_TASK_DELETED, {
			path: "TaskNotes/Child.md",
			deletedTask: TaskFactory.createTask({
				path: "TaskNotes/Child.md",
				projects: ["[[Parent]]"],
			}),
		});

		expect(plugin.projectSubtasksService.invalidateIndex).toHaveBeenCalled();
		expect(view.renderCount).toBe(0);

		jest.advanceTimersByTime(300);

		expect(view.renderCount).toBe(1);
	});

	it("refreshes Bases views when a raw file deletion cache shows project references", async () => {
		jest.useFakeTimers();
		const plugin = createPlugin();
		const view = new TestBasesView(plugin);
		view.startListening();

		await plugin.emitter.trigger("file-deleted", {
			path: "TaskNotes/Child.md",
			prevCache: {
				frontmatter: {
					projects: ["[[Parent]]"],
				},
			},
		});

		jest.advanceTimersByTime(300);

		expect(view.renderCount).toBe(1);
	});

	it("refreshes Bases views when a raw file deletion cache has a single project reference", async () => {
		jest.useFakeTimers();
		const plugin = createPlugin();
		const view = new TestBasesView(plugin);
		view.startListening();

		await plugin.emitter.trigger("file-deleted", {
			path: "TaskNotes/Child.md",
			prevCache: {
				frontmatter: {
					projects: "[[Parent]]",
				},
			},
		});

		jest.advanceTimersByTime(300);

		expect(view.renderCount).toBe(1);
	});

	it("refreshes when the deleted task is already rendered as a nested card", async () => {
		jest.useFakeTimers();
		const plugin = createPlugin();
		const view = new TestBasesView(plugin);
		const root = view.startListening();
		const nestedCard = document.createElement("div");
		nestedCard.className = "task-card";
		nestedCard.dataset.taskPath = "TaskNotes/Child.md";
		root.appendChild(nestedCard);

		await plugin.emitter.trigger("file-deleted", {
			path: "TaskNotes/Child.md",
			prevCache: {
				frontmatter: {},
			},
		});

		jest.advanceTimersByTime(300);

		expect(view.renderCount).toBe(1);
	});

	it("does not refresh every Bases view for unrelated file deletions", async () => {
		jest.useFakeTimers();
		const plugin = createPlugin();
		const view = new TestBasesView(plugin);
		view.startListening();

		await plugin.emitter.trigger("file-deleted", {
			path: "Notes/Plain note.md",
			prevCache: {
				frontmatter: {},
			},
		});

		jest.advanceTimersByTime(300);

		expect(view.renderCount).toBe(0);
	});
});
