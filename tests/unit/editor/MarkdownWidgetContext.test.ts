import { describe, expect, it, jest } from "@jest/globals";
import { EditorView } from "@codemirror/view";
import {
	shouldSkipMarkdownWidgetEditor,
	shouldSkipMarkdownWidgetLeaf,
} from "../../../src/editor/MarkdownWidgetContext";

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
});
