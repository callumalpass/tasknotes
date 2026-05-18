jest.mock("../../../src/ui/TaskCard", () => ({
	createTaskCard: jest.fn(() => {
		const card = document.createElement("div");
		card.className = "task-card";
		return card;
	}),
}));

import { Component } from "obsidian";
import { createTaskCard } from "../../../src/ui/TaskCard";
import {
	injectCanvasTaskCardWidgets,
	setupReadingModeHandlers,
} from "../../../src/editor/TaskCardNoteDecorations";

function createCanvasEmbed(): HTMLElement {
	const root = document.createElement("div");
	root.innerHTML = `
		<div class="canvas-node">
			<div class="canvas-node-content markdown-embed is-loaded">
				<div class="markdown-embed-content">
					<div class="markdown-preview-view markdown-rendered">
						<div class="markdown-preview-sizer markdown-preview-section">
							<div class="markdown-preview-pusher"></div>
							<div class="mod-header mod-ui">
								<div class="inline-title">Canvas task</div>
								<div class="metadata-container"></div>
							</div>
							<p>Body</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	`;
	return root;
}

function mountCanvasEditor(root: HTMLElement): void {
	const contentEl = root.querySelector(".canvas-node-content") as HTMLElement;
	contentEl.insertAdjacentHTML(
		"beforeend",
		`
			<div class="markdown-embed-content node-insert-event">
				<div class="markdown-source-view mod-cm6">
					<div class="cm-editor">
						<div class="cm-scroller">
							<div class="cm-content" contenteditable="true">Body</div>
						</div>
					</div>
				</div>
			</div>
		`
	);
}

function mountCanvasEditorWithTaskCard(root: HTMLElement): HTMLElement {
	mountCanvasEditor(root);
	const sourceView = root.querySelector(".markdown-source-view") as HTMLElement;
	const widget = document.createElement("div");
	widget.className = "tasknotes-task-card-note-widget";
	sourceView.appendChild(widget);
	return widget;
}

function hideCanvasPreview(root: HTMLElement): void {
	const previewContent = root.querySelector(".markdown-embed-content") as HTMLElement;
	previewContent.style.display = "none";
}

function createPluginMock(options: { isEditing?: boolean } = {}) {
	const root = createCanvasEmbed();
	const contentEl = root.querySelector(".canvas-node-content") as HTMLElement;
	const canvasNode = {
		filePath: "TaskNotes/Tasks/canvas-task.md",
		contentEl,
		isEditing: options.isEditing ?? false,
	};
	const canvasLeaves = [
		{
			view: {
				containerEl: root,
				canvas: {
					nodes: new Map([["task-node", canvasNode]]),
				},
			},
		},
	];

	return {
		root,
		settings: {
			showTaskCardInNote: true,
			defaultVisibleProperties: ["status", "priority"],
		},
		app: {
			workspace: {
				getLeavesOfType: jest.fn((type: string) =>
					type === "canvas" ? canvasLeaves : []
				),
				on: jest.fn(() => ({})),
				offref: jest.fn(),
			},
			metadataCache: {
				on: jest.fn(() => ({})),
				offref: jest.fn(),
			},
		},
		cacheManager: {
			getCachedTaskInfoSync: jest.fn(() => ({
				title: "Canvas task",
				path: "TaskNotes/Tasks/canvas-task.md",
				status: "open",
				priority: "normal",
			})),
		},
		fieldMapper: {
			getMapping: jest.fn(() => ({})),
			toUserField: jest.fn((field: string) => field),
		},
		emitter: {
			on: jest.fn(() => ({})),
			offref: jest.fn(),
		},
	} as any;
}

describe("Issue #872: task cards in canvas markdown embeds", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		const componentPrototype = Component.prototype as unknown as {
			load: jest.Mock;
			unload: jest.Mock;
		};
		componentPrototype.load = jest.fn();
		componentPrototype.unload = jest.fn();
	});

	it("injects the note-level task card into a canvas file node at render time", () => {
		const plugin = createPluginMock();

		injectCanvasTaskCardWidgets(plugin);

		const widget = plugin.root.querySelector(".tasknotes-task-card-note-widget");
		expect(widget).not.toBeNull();
		expect(widget?.querySelector(".task-card")).not.toBeNull();
		expect(plugin.cacheManager.getCachedTaskInfoSync).toHaveBeenCalledWith(
			"TaskNotes/Tasks/canvas-task.md"
		);
		expect(createTaskCard).toHaveBeenCalledTimes(1);
	});

	it("does not inject duplicate task cards when multiple sections are processed", () => {
		const plugin = createPluginMock();

		injectCanvasTaskCardWidgets(plugin);
		injectCanvasTaskCardWidgets(plugin);

		expect(plugin.root.querySelectorAll(".tasknotes-task-card-note-widget")).toHaveLength(1);
		expect(createTaskCard).toHaveBeenCalledTimes(1);
	});

	it("moves the task card outside the hidden preview when the canvas node is editing", () => {
		const plugin = createPluginMock({ isEditing: true });

		injectCanvasTaskCardWidgets(plugin);

		const widget = plugin.root.querySelector(".tasknotes-task-card-note-widget");
		expect(widget?.parentElement).toBe(plugin.root.querySelector(".canvas-node-content"));
		expect(widget?.closest(".markdown-preview-sizer")).toBeNull();
		expect(createTaskCard).toHaveBeenCalledTimes(1);
	});

	it("replaces a preview widget when the canvas node enters editing mode", () => {
		const plugin = createPluginMock();
		const node = Array.from(
			plugin.app.workspace.getLeavesOfType("canvas")[0].view.canvas.nodes.values()
		)[0] as { isEditing: boolean };

		injectCanvasTaskCardWidgets(plugin);
		node.isEditing = true;
		injectCanvasTaskCardWidgets(plugin);

		const widgets = plugin.root.querySelectorAll(".tasknotes-task-card-note-widget");
		expect(widgets).toHaveLength(1);
		expect(widgets[0].parentElement).toBe(plugin.root.querySelector(".canvas-node-content"));
		expect(createTaskCard).toHaveBeenCalledTimes(2);
	});

	it("keeps the card visible when the canvas editor mounts before isEditing updates", () => {
		const plugin = createPluginMock({ isEditing: false });

		injectCanvasTaskCardWidgets(plugin);
		mountCanvasEditor(plugin.root);
		injectCanvasTaskCardWidgets(plugin, { force: true });

		const widgets = plugin.root.querySelectorAll(".tasknotes-task-card-note-widget");
		expect(widgets).toHaveLength(1);
		expect(widgets[0].parentElement).toBe(plugin.root.querySelector(".canvas-node-content"));
		expect(widgets[0].closest(".markdown-preview-sizer")).toBeNull();
		expect(createTaskCard).toHaveBeenCalledTimes(2);
	});

	it("does not replace a task card owned by the active canvas source editor", () => {
		const plugin = createPluginMock({ isEditing: false });
		const editorWidget = mountCanvasEditorWithTaskCard(plugin.root);

		injectCanvasTaskCardWidgets(plugin, { force: true });

		const widgets = plugin.root.querySelectorAll(".tasknotes-task-card-note-widget");
		expect(widgets).toHaveLength(1);
		expect(widgets[0]).toBe(editorWidget);
		expect(widgets[0].closest(".markdown-source-view")).not.toBeNull();
		expect(createTaskCard).not.toHaveBeenCalled();
	});

	it("keeps the card visible when Canvas hides the preview before isEditing updates", () => {
		const plugin = createPluginMock({ isEditing: false });

		injectCanvasTaskCardWidgets(plugin);
		hideCanvasPreview(plugin.root);
		injectCanvasTaskCardWidgets(plugin, { force: true });

		const widgets = plugin.root.querySelectorAll(".tasknotes-task-card-note-widget");
		expect(widgets).toHaveLength(1);
		expect(widgets[0].parentElement).toBe(plugin.root.querySelector(".canvas-node-content"));
		expect(widgets[0].closest(".markdown-preview-sizer")).toBeNull();
		expect(createTaskCard).toHaveBeenCalledTimes(2);
	});

	it("refreshes the card after a Canvas node click enters editing mode", () => {
		jest.useFakeTimers();
		let cleanup: (() => void) | undefined;

		try {
			const plugin = createPluginMock({ isEditing: false });
			const node = Array.from(
				plugin.app.workspace.getLeavesOfType("canvas")[0].view.canvas.nodes.values()
			)[0] as { isEditing: boolean };

			cleanup = setupReadingModeHandlers(plugin);
			jest.runOnlyPendingTimers();

			const initialWidget = plugin.root.querySelector(".tasknotes-task-card-note-widget");
			expect(initialWidget?.closest(".markdown-preview-sizer")).not.toBeNull();

			node.isEditing = true;
			plugin.root.dispatchEvent(new Event("pointerdown", { bubbles: true }));
			jest.runOnlyPendingTimers();

			const widgets = plugin.root.querySelectorAll(".tasknotes-task-card-note-widget");
			expect(widgets).toHaveLength(1);
			expect(widgets[0].parentElement).toBe(plugin.root.querySelector(".canvas-node-content"));
			expect(widgets[0].closest(".markdown-preview-sizer")).toBeNull();
			expect(createTaskCard).toHaveBeenCalledTimes(2);
		} finally {
			cleanup?.();
			jest.useRealTimers();
		}
	});

	it("leaves non-canvas reading-mode renders to the existing leaf injector", () => {
		const plugin = createPluginMock();
		plugin.app.workspace.getLeavesOfType.mockReturnValue([]);

		injectCanvasTaskCardWidgets(plugin);

		expect(plugin.root.querySelector(".tasknotes-task-card-note-widget")).toBeNull();
		expect(createTaskCard).not.toHaveBeenCalled();
	});
});
