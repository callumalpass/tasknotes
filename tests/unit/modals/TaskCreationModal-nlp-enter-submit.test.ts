import type { App } from "obsidian";
import { autocompletion, type CompletionSource } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type {
	EmbeddableMarkdownEditor as EditorType,
	MarkdownEditorProps,
} from "../../../src/editor/EmbeddableMarkdownEditor";
import { TaskCreationModal } from "../../../src/modals/TaskCreationModal";
import { MockObsidian } from "../../helpers/obsidian-runtime";

const mockEditorInstances: Array<{ container: HTMLElement; options: MarkdownEditorProps }> = [];

jest.mock("../../../src/editor/EmbeddableMarkdownEditor", () => ({
	...jest.requireActual("../../../src/editor/EmbeddableMarkdownEditor"),
	EmbeddableMarkdownEditor: jest.fn().mockImplementation((_app, container, options) => {
		mockEditorInstances.push({ container, options });
		return {
			value: "",
			editor: { cm: { focus: jest.fn(), scrollDOM: { scrollTop: 0 } } },
			destroy: jest.fn(),
			setValue: jest.fn(),
		};
	}),
}));

jest.mock("../../../src/editor/NLPCodeMirrorAutocomplete", () => ({
	createNLPAutocomplete: jest.fn(() => []),
}));

jest.mock("../../../src/services/NaturalLanguageParser", () => ({
	NaturalLanguageParser: {
		fromPlugin: jest.fn(() => ({
			parseInput: jest.fn(() => ({ title: "Captured task" })),
			getPreviewData: jest.fn(() => []),
		})),
	},
}));

const { EmbeddableMarkdownEditor: RealEditor } = jest.requireActual(
	"../../../src/editor/EmbeddableMarkdownEditor"
) as { EmbeddableMarkdownEditor: typeof EditorType };
const MockedEditor = jest.requireMock("../../../src/editor/EmbeddableMarkdownEditor")
	.EmbeddableMarkdownEditor as jest.Mock;

function createPlugin(app: App, nlpEnterToSubmit: boolean): any {
	return {
		app,
		settings: {
			enableNaturalLanguageInput: true,
			customStatuses: [],
			customPriorities: [],
			nlpDefaultToScheduled: false,
			nlpEnterToSubmit,
			nlpLanguage: "en",
			nlpTriggers: undefined,
			userFields: [],
			calendarViewSettings: {},
		},
		i18n: { translate: (key: string) => key },
	};
}

function setup(nlpEnterToSubmit: boolean) {
	const app = MockObsidian.createMockApp() as unknown as App;
	const modal = new TaskCreationModal(app, createPlugin(app, nlpEnterToSubmit));
	const submit = jest.fn().mockResolvedValue(undefined);
	(modal as any).handleSubmitShortcut = submit;
	(modal as any).createNaturalLanguageInput(modal.contentEl);
	return { modal, options: mockEditorInstances[0]?.options, submit };
}

const views: EditorView[] = [];

/** A real CodeMirror view behind the editor's completion helpers, after typing text. */
async function typedEditor(source: CompletionSource, interactionDelay?: number) {
	const view = new EditorView({
		state: EditorState.create({ extensions: [autocompletion({ override: [source], interactionDelay })] }),
		parent: document.body,
	});
	views.push(view);
	view.dispatch({ changes: { from: 0, insert: "Buy milk" }, selection: { anchor: 8 }, userEvent: "input.type" });
	await new Promise((resolve) => setTimeout(resolve, 250));
	const editor = Object.create(RealEditor.prototype, { editor: { value: { cm: view } } }) as EditorType;
	return { view, editor };
}

describe("TaskCreationModal NLP input: Enter to submit", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockEditorInstances.length = 0;
	});

	afterEach(() => {
		views.splice(0).forEach((view) => view.destroy());
	});

	it("keeps Enter as a newline by default and Shift+Enter as a newline when enabled", () => {
		const disabled = setup(false);
		expect(disabled.options.onEnter?.({} as never, false, false)).toBe(false);
		mockEditorInstances.length = 0;
		const enabled = setup(true);
		expect(enabled.options.onEnter?.({} as never, false, true)).toBe(false);
		expect(disabled.submit).not.toHaveBeenCalled();
		expect(enabled.submit).not.toHaveBeenCalled();
	});

	it("saves on Enter right after typing while a completion query is still pending", async () => {
		const { options, submit } = setup(true);
		const { editor } = await typedEditor(() => new Promise(() => undefined));
		expect(options.onEnter?.(editor, false, false)).toBe(true);
		expect(submit).toHaveBeenCalledWith(false);
	});

	it("accepts a visible suggestion on Enter instead of saving", async () => {
		const { options, submit } = setup(true);
		const { view, editor } = await typedEditor(() => ({ from: 0, options: [{ label: "Buy milk @home" }] }));
		expect(options.onEnter?.(editor, false, false)).toBe(true);
		expect(view.state.doc.toString()).toBe("Buy milk @home");
		expect(submit).not.toHaveBeenCalled();
	});

	it("neither saves nor adds a newline when a just-opened suggestion cannot be accepted yet", async () => {
		const { options, submit } = setup(true);
		const { view, editor } = await typedEditor(() => ({ from: 0, options: [{ label: "Buy milk @home" }] }), 60000);
		expect(options.onEnter?.(editor, false, false)).toBe(true);
		expect(view.state.doc.toString()).toBe("Buy milk");
		expect(submit).not.toHaveBeenCalled();
	});

	it("does not save from the textarea fallback while Enter confirms IME composition", async () => {
		MockedEditor.mockImplementationOnce(() => {
			throw new Error("editor unavailable");
		});
		const { modal, submit } = setup(true);
		const textarea = (modal as any).nlInput as HTMLTextAreaElement;
		textarea.value = "買い物";
		textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true }));
		// WebKit order: compositionend, then the confirming Enter without isComposing
		textarea.dispatchEvent(new Event("compositionstart"));
		textarea.dispatchEvent(new Event("compositionend"));
		textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
		expect(submit).not.toHaveBeenCalled();
		await new Promise((resolve) => setTimeout(resolve, 0));
		textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
		expect(submit).toHaveBeenCalledWith(false);
	});
});
