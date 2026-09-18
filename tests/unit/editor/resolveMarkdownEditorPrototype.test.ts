import type { App } from "obsidian";
import { TFile } from "obsidian";
import { resolveMarkdownEditorPrototype } from "../../../src/editor/resolveMarkdownEditorPrototype";

jest.mock("obsidian", () => ({
	TFile: class {
		path: string;
		extension: string;
		constructor(_vault?: unknown, path = "note.md") {
			this.path = path;
			this.extension = path.split(".").pop() ?? "";
		}
	},
}));

function fixture(active: TFile | null = null, files: TFile[] = []) {
	class EditorBase {}
	class EmbedEditor extends EditorBase {
		destroy = jest.fn();
	}
	const editor = new EmbedEditor();
	const widget = {
		editable: false,
		editMode: editor as EmbedEditor | undefined,
		showEditor: jest.fn(),
		unload: jest.fn(),
	};
	const factory = jest.fn(
		(_context: { app: App; containerEl: HTMLElement }, _file: TFile, _subpath: string) => widget
	);
	const vault = {
		getMarkdownFiles: jest.fn(() => files),
		create: jest.fn(),
		read: jest.fn(),
		modify: jest.fn(),
	};
	const app = {
		workspace: { getActiveFile: jest.fn(() => active) },
		vault,
		embedRegistry: { embedByExtension: { md: factory } },
	} as unknown as App;
	return { app, vault, factory, widget, editor, EditorBase };
}

describe("embedded Markdown editor prototype discovery", () => {
	test("uses an active Markdown note and destroys the unloaded temporary editor", () => {
		const active = new TFile();
		const { app, factory, widget, editor, EditorBase } = fixture(active);
		expect(resolveMarkdownEditorPrototype(app)).toBe(EditorBase);
		expect(factory.mock.calls[0][1]).toBe(active);
		expect(factory.mock.calls[0][0].containerEl.isConnected).toBe(false);
		expect(editor.destroy).toHaveBeenCalledTimes(1);
		expect(widget.unload).toHaveBeenCalledTimes(1);
		expect(editor.destroy.mock.invocationCallOrder[0]).toBeLessThan(
			widget.unload.mock.invocationCallOrder[0]
		);
	});

	test("works from non-file views such as release notes", () => {
		const note = new TFile();
		const { app, factory, EditorBase } = fixture(null, [note]);
		expect(resolveMarkdownEditorPrototype(app)).toBe(EditorBase);
		expect(factory.mock.calls[0][1]).toBe(note);
	});

	test("does not use an active non-Markdown file", () => {
		const pdf = Object.assign(new TFile(), { extension: "pdf" });
		const note = new TFile();
		const { app, factory } = fixture(pdf, [note]);
		resolveMarkdownEditorPrototype(app);
		expect(factory.mock.calls[0][1]).toBe(note);
	});

	test("works in an empty vault without creating, reading, or writing a note", () => {
		const { app, factory, vault, EditorBase } = fixture();
		expect(resolveMarkdownEditorPrototype(app)).toBe(EditorBase);
		const file = factory.mock.calls[0][1];
		expect(file).toBeInstanceOf(TFile);
		expect(file.extension).toBe("md");
		expect(vault.create).not.toHaveBeenCalled();
		expect(vault.read).not.toHaveBeenCalled();
		expect(vault.modify).not.toHaveBeenCalled();
	});

	test("cleans up a partially initialized editor when showEditor throws", () => {
		const { app, widget, editor } = fixture();
		widget.showEditor.mockImplementation(() => {
			throw new Error("Initialization failed");
		});
		expect(() => resolveMarkdownEditorPrototype(app)).toThrow("Initialization failed");
		expect(editor.destroy).toHaveBeenCalledTimes(1);
		expect(widget.unload).toHaveBeenCalledTimes(1);
	});

	test("unloads the widget when no edit mode is available", () => {
		const { app, widget } = fixture();
		widget.editMode = undefined;
		expect(() => resolveMarkdownEditorPrototype(app)).toThrow("edit mode was not initialized");
		expect(widget.unload).toHaveBeenCalledTimes(1);
	});
});
