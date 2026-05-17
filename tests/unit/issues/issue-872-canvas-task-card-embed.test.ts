jest.mock("../../../src/ui/TaskCard", () => ({
	createTaskCard: jest.fn(() => {
		const card = document.createElement("div");
		card.className = "task-card";
		return card;
	}),
}));

import { Component } from "obsidian";
import { createTaskCard } from "../../../src/ui/TaskCard";
import { injectCanvasTaskCardWidgets } from "../../../src/editor/TaskCardNoteDecorations";

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

	it("leaves non-canvas reading-mode renders to the existing leaf injector", () => {
		const plugin = createPluginMock();
		plugin.app.workspace.getLeavesOfType.mockReturnValue([]);

		injectCanvasTaskCardWidgets(plugin);

		expect(plugin.root.querySelector(".tasknotes-task-card-note-widget")).toBeNull();
		expect(createTaskCard).not.toHaveBeenCalled();
	});
});
