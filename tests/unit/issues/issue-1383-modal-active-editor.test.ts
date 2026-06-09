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
	it("sets workspace.activeEditor with a file and Obsidian-style editor adapter on focus", () => {
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
		expect(activeEditor.editor.getValue()).toBe("Created on ");
		expect(activeEditor.editor.getDoc()).toBe(activeEditor.editor);
		expect(activeEditor.editor.listSelections()).toEqual([
			{ anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 0 } },
		]);
	});

	it("supports the editor methods Templater uses when appending into the modal", () => {
		const app = createApp();
		const container = document.createElement("div");
		const editor = new EmbeddableMarkdownEditor(app, container, {
			value: "Created on ",
		});

		editor.editor.cm.contentDOM.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
		const activeEditor = app.workspace.activeEditor.editor;

		activeEditor.setSelection({ line: 0, ch: 11 });
		activeEditor.getDoc().replaceSelection("17 May 2026");

		expect(activeEditor.getValue()).toBe("Created on 17 May 2026");
		expect(editor.value).toBe("Created on 17 May 2026");

		activeEditor.transaction({
			changes: [{ from: { line: 0, ch: 11 }, to: { line: 0, ch: 22 }, text: "18 May 2026" }],
			selections: [{ from: { line: 0, ch: 22 } }],
		});

		expect(activeEditor.getValue()).toBe("Created on 18 May 2026");
		expect(activeEditor.getCursor()).toEqual({ line: 0, ch: 22 });
	});

	it("supports Obsidian formatting shortcut editor methods", () => {
		const app = createApp();
		const container = document.createElement("div");
		const editor = new EmbeddableMarkdownEditor(app, container, {
			value: "Title\nfirst\nsecond",
		});

		editor.editor.cm.contentDOM.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
		const activeEditor = app.workspace.activeEditor.editor;
		const selectLines = (from: number, to: number) => {
			activeEditor.setSelection(
				{ line: from, ch: 0 },
				{ line: to, ch: activeEditor.getLine(to).length }
			);
		};

		activeEditor.setCursor({ line: 0, ch: 0 });
		activeEditor.setHeading(2);
		expect(activeEditor.getValue()).toBe("## Title\nfirst\nsecond");

		activeEditor.setHeading(0);
		expect(activeEditor.getValue()).toBe("Title\nfirst\nsecond");

		selectLines(1, 2);
		activeEditor.toggleBulletList();
		expect(activeEditor.getValue()).toBe("Title\n- first\n- second");

		selectLines(1, 2);
		activeEditor.toggleBulletList();
		expect(activeEditor.getValue()).toBe("Title\nfirst\nsecond");

		selectLines(1, 2);
		activeEditor.toggleNumberList();
		expect(activeEditor.getValue()).toBe("Title\n1. first\n2. second");

		selectLines(1, 2);
		activeEditor.toggleNumberList();
		expect(activeEditor.getValue()).toBe("Title\nfirst\nsecond");

		selectLines(1, 2);
		activeEditor.toggleCheckList();
		expect(activeEditor.getValue()).toBe("Title\n- [ ] first\n- [ ] second");

		selectLines(1, 2);
		activeEditor.toggleCheckListStatus();
		expect(activeEditor.getValue()).toBe("Title\n- [x] first\n- [x] second");
	});
});
