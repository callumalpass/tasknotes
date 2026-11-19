import { EmbeddableMarkdownEditor } from "../../../src/editor/EmbeddableMarkdownEditor";

function createApp(file: unknown = null): any {
	return {
		scope: {},
		keymap: {
			pushScope: jest.fn(),
			popScope: jest.fn(),
		},
		workspace: {
			activeEditor: null,
			getActiveFile: jest.fn(() => file),
		},
		vault: {
			getConfig: jest.fn(() => false),
		},
	};
}

describe("Issue #1383: modal markdown editors expose active editor API", () => {
	it("publishes the real editor and its file as workspace.activeEditor on focus", () => {
		const file = { path: "Tasks/test.md" };
		const app = createApp(file);
		const container = document.createElement("div");
		const editor = new EmbeddableMarkdownEditor(app, container, {
			value: "Created on ",
			file: file as any,
		});

		editor.editor.cm.contentDOM.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

		const activeEditor = app.workspace.activeEditor;
		expect(activeEditor.file).toBe(file);
		expect(activeEditor.getMode()).toBe("source");
		expect(activeEditor.editor).toBe(editor.editor);
	});
});
