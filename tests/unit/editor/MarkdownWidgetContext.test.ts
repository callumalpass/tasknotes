import { describe, expect, it, jest } from "@jest/globals";
import { EditorView } from "@codemirror/view";
import {
	shouldSkipMarkdownWidgetEditor,
	shouldSkipMarkdownWidgetLeaf,
} from "../../../src/editor/MarkdownWidgetContext";
import { createTaskNotesLogger } from "../../../src/utils/tasknotesLogger";

function createMockView(options: {
	dom?: HTMLElement;
	leaf?: { parent?: unknown };
	containerEl?: HTMLElement;
}): EditorView {
	return {
		dom: options.dom ?? document.createElement("div"),
		state: {
			field: jest.fn(() => ({
				file: { path: "tasks/task.md" },
				leaf: options.leaf,
				containerEl: options.containerEl,
			})),
		},
	} as unknown as EditorView;
}

function createSink() {
	return {
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	};
}

describe("MarkdownWidgetContext", () => {
	it("skips detached editor leaves used by embedded inline editors", () => {
		const view = createMockView({
			leaf: { parent: null },
		});

		expect(shouldSkipMarkdownWidgetEditor(view)).toBe(true);
	});

	it("does not treat missing mock leaf parent data as detached", () => {
		const view = createMockView({
			leaf: {},
		});

		expect(shouldSkipMarkdownWidgetEditor(view)).toBe(false);
	});

	it("skips editors mounted inside markdown embeds", () => {
		const embed = document.createElement("div");
		embed.className = "internal-embed markdown-embed";
		const editor = document.createElement("div");
		embed.appendChild(editor);

		const view = createMockView({
			dom: editor,
			leaf: { parent: {} },
		});

		expect(shouldSkipMarkdownWidgetEditor(view)).toBe(true);
	});

	it("does not skip editors mounted inside canvas file nodes", () => {
		const nodeContent = document.createElement("div");
		nodeContent.className = "canvas-node-content markdown-embed";
		const editor = document.createElement("div");
		nodeContent.appendChild(editor);

		const view = createMockView({
			dom: editor,
			leaf: { parent: {} },
		});

		expect(shouldSkipMarkdownWidgetEditor(view)).toBe(false);
	});

	it("skips Block Link Plus inline edit roots", () => {
		const root = document.createElement("div");
		root.className = "blp-inline-edit-root";
		const editor = document.createElement("div");
		root.appendChild(editor);

		const view = createMockView({
			dom: editor,
			leaf: { parent: {} },
		});

		expect(shouldSkipMarkdownWidgetEditor(view)).toBe(true);
	});

	it("skips detached reading-mode leaves", () => {
		const leaf = {
			parent: undefined,
			view: { containerEl: document.createElement("div") },
		};

		expect(shouldSkipMarkdownWidgetLeaf(leaf as any)).toBe(true);
	});

	it("routes editor context failures through debug-gated diagnostics", () => {
		const sink = createSink();
		const error = new Error("editor field unavailable");
		const view = {
			dom: document.createElement("div"),
			state: {
				field: jest.fn(() => {
					throw error;
				}),
			},
		} as unknown as EditorView;
		let debugEnabled = false;
		const logger = createTaskNotesLogger({
			tag: "MarkdownWidgetContext",
			isDebugEnabled: () => debugEnabled,
			sink,
		});

		expect(shouldSkipMarkdownWidgetEditor(view, logger)).toBe(false);
		expect(sink.debug).not.toHaveBeenCalled();

		debugEnabled = true;
		expect(shouldSkipMarkdownWidgetEditor(view, logger)).toBe(false);
		expect(sink.debug).toHaveBeenCalledWith(
			"[TaskNotes][MarkdownWidgetContext][provider][check-editor-context] Error checking markdown widget editor context",
			error
		);
	});
});
