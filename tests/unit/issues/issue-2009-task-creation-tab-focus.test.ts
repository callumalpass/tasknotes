import type { App } from "obsidian";
import type { MarkdownEditorProps } from "../../../src/editor/EmbeddableMarkdownEditor";
import { TaskCreationModal } from "../../../src/modals/TaskCreationModal";
import { MockObsidian } from "../../helpers/obsidian-runtime";

const mockEditorInstances: Array<{ container: HTMLElement; options: MarkdownEditorProps }> = [];

jest.mock("../../../src/editor/EmbeddableMarkdownEditor", () => ({
	EmbeddableMarkdownEditor: jest.fn().mockImplementation((_app, container, options) => {
		mockEditorInstances.push({ container, options });
		return {
			value: "",
			editor: {
				cm: {
					contentDOM: document.createElement("div"),
					focus: jest.fn(),
					scrollDOM: { scrollTop: 0 },
				},
			},
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

function createPlugin(app: App): any {
	return {
		app,
		settings: {
			enableNaturalLanguageInput: true,
			customStatuses: [],
			customPriorities: [],
			nlpDefaultToScheduled: false,
			nlpLanguage: "en",
			nlpTriggers: undefined,
			userFields: [],
			calendarViewSettings: {},
		},
		i18n: {
			translate: (key: unknown) => String(key),
		},
	};
}

describe("Issue #2009: task creation NLP editor Tab focus", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
		mockEditorInstances.length = 0;
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("consumes Tab and Shift+Tab using CodeMirror's editor plus shift callback signature", () => {
		const app = MockObsidian.createMockApp() as unknown as App;
		const modal = new TaskCreationModal(app, createPlugin(app));
		const previousButton = document.createElement("button");
		const focusDetails = jest.fn();
		previousButton.focus = jest.fn();

		modal.contentEl.append(previousButton);
		modal.modalEl.append(modal.contentEl);
		(modal as any).isExpanded = true;
		(modal as any).detailsMarkdownEditor = { editor: { cm: { focus: focusDetails } } };
		(modal as any).createNaturalLanguageInput(modal.contentEl);

		mockEditorInstances[0].container.classList.add("tn-task-modal__markdown-editor--nlp");
		const editorOptions = mockEditorInstances[0].options;
		const editor = {} as never;

		expect(editorOptions.onTab?.(editor, false)).toBe(true);
		jest.advanceTimersByTime(50);
		expect(focusDetails).toHaveBeenCalledTimes(1);

		expect(editorOptions.onTab?.(editor, true)).toBe(true);
		jest.advanceTimersByTime(50);
		expect(previousButton.focus).toHaveBeenCalledTimes(1);
	});
});
