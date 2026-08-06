import { createTaskModalMarkdownEditor } from "../../../src/modals/taskModalEditorAdapter";
import {
	createTaskModalDetailsEditor,
	destroyTaskModalDetailsEditor,
	setTaskModalDetailsEditorValue,
} from "../../../src/modals/taskModalDetailsEditor";

jest.mock("../../../src/modals/taskModalEditorAdapter", () => ({
	createTaskModalMarkdownEditor: jest.fn(),
}));

describe("taskModalDetailsEditor", () => {
	const createTaskModalMarkdownEditorMock = createTaskModalMarkdownEditor as jest.MockedFunction<
		typeof createTaskModalMarkdownEditor
	>;

	beforeEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	it("creates the editor container and markdown editor options without a persisting label", () => {
		const app = {} as never;
		const parent = document.createElement("div");
		const editor = {
			destroy: jest.fn(),
			setValue: jest.fn(),
		} as never;
		const onChange = jest.fn();
		const onSubmit = jest.fn();
		const onEscape = jest.fn();
		const focusNextField = jest.fn();
		const focusPreviousField = jest.fn();
		const file = { path: "Tasks/example.md" } as never;
		createTaskModalMarkdownEditorMock.mockReturnValue(editor);

		const returnedEditor = createTaskModalDetailsEditor({
			app,
			parent,
			value: "Existing details",
			placeholder: "Add details",
			file,
			tabMovesFocus: true,
			onChange,
			onSubmit,
			onEscape,
			focusNextField,
			focusPreviousField,
		});

		const label = parent.querySelector<HTMLElement>(".detail-label");
		const container = parent.querySelector<HTMLElement>(
			".tn-task-modal__markdown-editor--details"
		);
		expect(returnedEditor).toBe(editor);
		expect(label).toBeNull();
		expect(container).not.toBeNull();
		expect(createTaskModalMarkdownEditorMock).toHaveBeenCalledWith(
			app,
			container,
			expect.objectContaining({
				value: "Existing details",
				placeholder: "Add details",
				cls: "details-editor",
				file,
			})
		);

		const editorOptions = createTaskModalMarkdownEditorMock.mock.calls[0][2];
		editorOptions.onChange("Updated details");
		editorOptions.onSubmit(true);
		editorOptions.onEscape();

		expect(onChange).toHaveBeenCalledWith("Updated details");
		expect(onSubmit).toHaveBeenCalledWith(true);
		expect(onEscape).toHaveBeenCalledTimes(1);
	});

	it("maps Tab behavior through the modal focus policy", () => {
		const parent = document.createElement("div");
		const focusNextField = jest.fn(() => true);
		const focusPreviousField = jest.fn(() => false);
		createTaskModalMarkdownEditorMock.mockReturnValue({ destroy: jest.fn() } as never);

		createTaskModalDetailsEditor({
			app: {} as never,
			parent,
			value: "",
			placeholder: "",
			tabMovesFocus: true,
			onChange: jest.fn(),
			onSubmit: jest.fn(),
			onEscape: jest.fn(),
			focusNextField,
			focusPreviousField,
		});

		const editorOptions = createTaskModalMarkdownEditorMock.mock.calls[0][2];

		expect(editorOptions.onTab(false)).toBe(true);
		expect(focusNextField).toHaveBeenCalledTimes(1);
		expect(editorOptions.onTab(true)).toBe(false);
		expect(focusPreviousField).toHaveBeenCalledTimes(1);
	});

	it("lets the editor keep Tab input when modal tab focus movement is disabled", () => {
		const parent = document.createElement("div");
		const focusNextField = jest.fn(() => true);
		const focusPreviousField = jest.fn(() => true);
		createTaskModalMarkdownEditorMock.mockReturnValue(null);

		createTaskModalDetailsEditor({
			app: {} as never,
			parent,
			value: "",
			placeholder: "",
			tabMovesFocus: false,
			onChange: jest.fn(),
			onSubmit: jest.fn(),
			onEscape: jest.fn(),
			focusNextField,
			focusPreviousField,
		});

		const editorOptions = createTaskModalMarkdownEditorMock.mock.calls[0][2];

		expect(editorOptions.onTab(false)).toBe(false);
		expect(editorOptions.onTab(true)).toBe(false);
		expect(focusNextField).not.toHaveBeenCalled();
		expect(focusPreviousField).not.toHaveBeenCalled();
	});

	it("updates and destroys details editors with null-safe helpers", () => {
		const editor = {
			destroy: jest.fn(),
			setValue: jest.fn(),
		} as never;

		setTaskModalDetailsEditorValue(editor, "Parsed details");
		setTaskModalDetailsEditorValue(null, "Ignored");
		destroyTaskModalDetailsEditor(editor);
		destroyTaskModalDetailsEditor(null);

		expect(editor.setValue).toHaveBeenCalledWith("Parsed details");
		expect(editor.destroy).toHaveBeenCalledTimes(1);
	});

	it("focuses the markdown editor when clicking the empty area of the details field", () => {
		const parent = document.createElement("div");
		const focus = jest.fn();
		createTaskModalMarkdownEditorMock.mockReturnValue({
			destroy: jest.fn(),
			editor: { cm: { focus } },
		} as never);

		createTaskModalDetailsEditor({
			app: {} as never,
			parent,
			value: "",
			placeholder: "Description",
			tabMovesFocus: false,
			onChange: jest.fn(),
			onSubmit: jest.fn(),
			onEscape: jest.fn(),
			focusNextField: jest.fn(),
			focusPreviousField: jest.fn(),
		});

		const container = parent.querySelector<HTMLElement>(
			".tn-task-modal__markdown-editor--details"
		);
		expect(container).not.toBeNull();

		container?.dispatchEvent(
			new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 })
		);

		expect(focus).toHaveBeenCalledTimes(1);
	});

	it("focuses the fallback textarea when clicking the empty area of the details field", () => {
		const parent = document.createElement("div");
		createTaskModalMarkdownEditorMock.mockImplementation((_app, container, options) => {
			const fallback = container.createEl("textarea", {
				cls: `${options.cls}-fallback`,
			});
			Object.defineProperty(fallback, "focus", {
				value: jest.fn(),
				configurable: true,
			});
			return null;
		});

		createTaskModalDetailsEditor({
			app: {} as never,
			parent,
			value: "",
			placeholder: "Description",
			tabMovesFocus: false,
			onChange: jest.fn(),
			onSubmit: jest.fn(),
			onEscape: jest.fn(),
			focusNextField: jest.fn(),
			focusPreviousField: jest.fn(),
		});

		const container = parent.querySelector<HTMLElement>(
			".tn-task-modal__markdown-editor--details"
		);
		const fallback = parent.querySelector<HTMLTextAreaElement>(".details-editor-fallback");
		expect(container).not.toBeNull();
		expect(fallback).not.toBeNull();

		container?.dispatchEvent(
			new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 })
		);

		expect(fallback?.focus).toHaveBeenCalledTimes(1);
	});
});
