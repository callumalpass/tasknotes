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
	return { options: mockEditorInstances[0].options, submit };
}

describe("TaskCreationModal NLP input: Enter to submit", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockEditorInstances.length = 0;
	});

	it("inserts a newline on Enter by default", () => {
		const { options, submit } = setup(false);
		expect(options.onEnter?.({ isCompletionOpen: false } as never, false, false)).toBe(false);
		expect(submit).not.toHaveBeenCalled();
	});

	it("saves on Enter when enabled", () => {
		const { options, submit } = setup(true);
		expect(options.onEnter?.({ isCompletionOpen: false } as never, false, false)).toBe(true);
		expect(submit).toHaveBeenCalledWith(false);
	});

	it("keeps Shift+Enter as a newline when enabled", () => {
		const { options, submit } = setup(true);
		expect(options.onEnter?.({ isCompletionOpen: false } as never, false, true)).toBe(false);
		expect(submit).not.toHaveBeenCalled();
	});

	it("lets Enter accept an open autocomplete suggestion when enabled", () => {
		const { options, submit } = setup(true);
		expect(options.onEnter?.({ isCompletionOpen: true } as never, false, false)).toBe(false);
		expect(submit).not.toHaveBeenCalled();
	});
});
