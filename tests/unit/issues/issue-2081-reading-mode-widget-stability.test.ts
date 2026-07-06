jest.mock("../../../src/ui/TaskCard", () => ({
	createTaskCard: jest.fn((task) => {
		const card = document.createElement("div");
		card.className = "task-card";
		card.dataset.taskPath = task.path;
		return card;
	}),
}));

import { Component, MarkdownView, TFile } from "obsidian";
import { createTaskCard } from "../../../src/ui/TaskCard";
import { setupReadingModeHandlers as setupTaskCardReadingModeHandlers } from "../../../src/editor/TaskCardNoteDecorations";
import { setupReadingModeHandlers as setupRelationshipsReadingModeHandlers } from "../../../src/editor/RelationshipsDecorations";

type EventCallback = (...args: unknown[]) => void;

function createEventSource() {
	const handlers = new Map<string, EventCallback[]>();

	return {
		on: jest.fn((event: string, callback: EventCallback) => {
			const callbacks = handlers.get(event) ?? [];
			callbacks.push(callback);
			handlers.set(event, callbacks);
			return { event, callback };
		}),
		offref: jest.fn(),
		trigger: (event: string, ...args: unknown[]) => {
			for (const callback of handlers.get(event) ?? []) {
				callback(...args);
			}
		},
	};
}

function createPreviewDom(): HTMLElement {
	const containerEl = document.createElement("div");
	containerEl.innerHTML = `
		<div class="markdown-preview-view markdown-rendered">
			<div class="markdown-preview-sizer markdown-preview-section">
				<div class="markdown-preview-pusher"></div>
				<div class="mod-header mod-ui">
					<div class="inline-title">Task</div>
					<div class="metadata-container"></div>
				</div>
				<p>Body</p>
			</div>
		</div>
	`;
	document.body.appendChild(containerEl);
	return containerEl;
}

function createMarkdownLeaf(path = "Tasks/test.md") {
	const file = new TFile(path);
	const containerEl = createPreviewDom();
	const view = Object.assign(Object.create(MarkdownView.prototype), {
		containerEl,
		file,
		previewMode: {
			containerEl,
		},
		getMode: jest.fn(() => "preview"),
	}) as MarkdownView;

	return {
		containerEl,
		file,
		leaf: {
			parent: {},
			view,
		} as any,
		view,
	};
}

function createPluginMock(leaf: any) {
	const workspaceEvents = createEventSource();
	const metadataEvents = createEventSource();
	const emitterEvents = createEventSource();
	let metadata: { frontmatter?: Record<string, unknown> } | null = {
		frontmatter: { tags: ["task"] },
	};
	let task: any = {
		title: "Task",
		status: "open",
		priority: "normal",
		path: leaf.file.path,
	};

	return {
		workspaceEvents,
		metadataEvents,
		emitterEvents,
		setMetadata: (nextMetadata: { frontmatter?: Record<string, unknown> } | null) => {
			metadata = nextMetadata;
		},
		setTask: (nextTask: any) => {
			task = nextTask;
		},
		plugin: {
			settings: {
				showTaskCardInNote: true,
				showRelationships: true,
				defaultVisibleProperties: ["status", "priority"],
				relationshipsPosition: "top",
				commandFileMapping: {
					relationships: "TaskNotes/Views/Relationships.base",
				},
			},
			app: {
				workspace: {
					getLeavesOfType: jest.fn((type: string) =>
						type === "markdown" ? [leaf.leaf] : []
					),
					on: workspaceEvents.on,
					offref: workspaceEvents.offref,
				},
				metadataCache: {
					getFileCache: jest.fn(() => metadata),
					on: metadataEvents.on,
					offref: metadataEvents.offref,
				},
			},
			cacheManager: {
				getCachedTaskInfoSync: jest.fn(() => task),
				isTaskFile: jest.fn((frontmatter: Record<string, unknown> | undefined) =>
					Array.isArray(frontmatter?.tags)
						? frontmatter.tags.includes("task")
						: frontmatter?.type === "task"
				),
			},
			dependencyCache: {
				isFileUsedAsProject: jest.fn(() => false),
				on: jest.fn(() => ({})),
				offref: jest.fn(),
			},
			fieldMapper: {
				getMapping: jest.fn(() => ({})),
				toUserField: jest.fn((field: string) => field),
			},
			emitter: {
				on: emitterEvents.on,
				offref: emitterEvents.offref,
				trigger: emitterEvents.trigger,
			},
		} as any,
	};
}

async function flushMicrotasks(): Promise<void> {
	for (let i = 0; i < 5; i++) {
		await Promise.resolve();
	}
}

async function flushMutationObserver(): Promise<void> {
	await Promise.resolve();
	jest.advanceTimersByTime(20);
	await flushMicrotasks();
}

describe("Issue #2081: reading mode note widgets stay mounted", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		document.body.innerHTML = "";
		const componentPrototype = Component.prototype as unknown as {
			load: jest.Mock;
			unload: jest.Mock;
		};
		componentPrototype.load = jest.fn();
		componentPrototype.unload = jest.fn();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("refreshes a task card when file-open reuses the current leaf", async () => {
		const leaf = createMarkdownLeaf();
		const pluginMock = createPluginMock(leaf);
		const cleanup = setupTaskCardReadingModeHandlers(pluginMock.plugin);

		try {
			await flushMicrotasks();
			const newFile = new TFile("Tasks/next.md");
			leaf.view.file = newFile;
			pluginMock.setTask({
				title: "Next task",
				status: "open",
				priority: "normal",
				path: newFile.path,
			});

			pluginMock.workspaceEvents.trigger("file-open", newFile);

			expect(
				leaf.containerEl.querySelector(
					`.tasknotes-task-card-note-widget[data-task-path="${newFile.path}"]`
				)
			).not.toBeNull();
		} finally {
			cleanup();
		}
	});

	it("re-injects a task card removed by Obsidian reading-mode DOM updates", async () => {
		jest.useFakeTimers();
		const leaf = createMarkdownLeaf();
		const pluginMock = createPluginMock(leaf);
		const cleanup = setupTaskCardReadingModeHandlers(pluginMock.plugin);

		try {
			const widget = leaf.containerEl.querySelector(".tasknotes-task-card-note-widget");
			expect(widget).not.toBeNull();

			widget?.remove();
			await flushMutationObserver();

			expect(
				leaf.containerEl.querySelector(".tasknotes-task-card-note-widget")
			).not.toBeNull();
			expect(createTaskCard).toHaveBeenCalledTimes(2);
		} finally {
			cleanup();
		}
	});

	it("refreshes visible reading-mode task cards immediately on metadata changes", async () => {
		const leaf = createMarkdownLeaf();
		const pluginMock = createPluginMock(leaf);
		const cleanup = setupTaskCardReadingModeHandlers(pluginMock.plugin);

		try {
			await flushMicrotasks();
			(createTaskCard as jest.Mock).mockClear();
			pluginMock.setTask({
				title: "Updated task",
				status: "done",
				priority: "normal",
				path: leaf.file.path,
			});

			pluginMock.metadataEvents.trigger("changed", leaf.file);

			expect(createTaskCard).toHaveBeenCalledTimes(1);
			expect(createTaskCard).toHaveBeenCalledWith(
				expect.objectContaining({ title: "Updated task", status: "done" }),
				pluginMock.plugin,
				expect.any(Array)
			);
		} finally {
			cleanup();
		}
	});

	it("keeps an existing task card during a same-file transient cache miss", async () => {
		const leaf = createMarkdownLeaf();
		const pluginMock = createPluginMock(leaf);
		const cleanup = setupTaskCardReadingModeHandlers(pluginMock.plugin);

		try {
			await flushMicrotasks();
			expect(
				leaf.containerEl.querySelector(".tasknotes-task-card-note-widget")
			).not.toBeNull();
			pluginMock.setTask(null);
			pluginMock.setMetadata(null);

			pluginMock.metadataEvents.trigger("changed", leaf.file);

			expect(
				leaf.containerEl.querySelector(".tasknotes-task-card-note-widget")
			).not.toBeNull();
		} finally {
			cleanup();
		}
	});

	it("removes a stale task card when metadata confirms the file is not a task", async () => {
		const leaf = createMarkdownLeaf();
		const pluginMock = createPluginMock(leaf);
		const cleanup = setupTaskCardReadingModeHandlers(pluginMock.plugin);

		try {
			await flushMicrotasks();
			expect(
				leaf.containerEl.querySelector(".tasknotes-task-card-note-widget")
			).not.toBeNull();
			pluginMock.setTask(null);
			pluginMock.setMetadata({ frontmatter: { tags: ["note"] } });

			pluginMock.metadataEvents.trigger("changed", leaf.file);

			expect(leaf.containerEl.querySelector(".tasknotes-task-card-note-widget")).toBeNull();
		} finally {
			cleanup();
		}
	});

	it("re-injects a relationships widget removed by Obsidian reading-mode DOM updates", async () => {
		jest.useFakeTimers();
		const leaf = createMarkdownLeaf();
		const pluginMock = createPluginMock(leaf);
		const cleanup = setupRelationshipsReadingModeHandlers(pluginMock.plugin);

		try {
			jest.runOnlyPendingTimers();
			await flushMicrotasks();
			const widget = leaf.containerEl.querySelector(".tasknotes-relationships-widget");
			expect(widget).not.toBeNull();

			widget?.remove();
			await flushMutationObserver();

			expect(
				leaf.containerEl.querySelector(".tasknotes-relationships-widget")
			).not.toBeNull();
		} finally {
			cleanup();
		}
	});
});
