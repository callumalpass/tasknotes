import type { App } from "obsidian";
import { TaskCreationModal } from "../../../src/modals/TaskCreationModal";
import { MockObsidian } from "../../__mocks__/obsidian";

jest.mock("obsidian");

jest.mock("../../../src/services/NaturalLanguageParser", () => ({
	NaturalLanguageParser: {
		fromPlugin: jest.fn(() => ({
			parseInput: jest.fn(),
			getPreviewData: jest.fn(() => []),
		})),
	},
}));

function createPlugin(enableNaturalLanguageInput = true): any {
	return {
		app: MockObsidian.createMockApp(),
		settings: {
			enableNaturalLanguageInput,
			customStatuses: [],
			customPriorities: [],
			nlpDefaultToScheduled: false,
			nlpLanguage: "en",
			nlpTriggers: undefined,
			userFields: [],
			calendarViewSettings: {},
		},
		i18n: {
			translate: (key: string) => key,
		},
	};
}

describe("Issue #1353: mobile create modal autofocus", () => {
	let app: App;

	beforeEach(() => {
		jest.useFakeTimers();
		document.body.classList.remove("is-mobile");
		app = MockObsidian.createMockApp() as unknown as App;
	});

	afterEach(() => {
		jest.useRealTimers();
		document.body.classList.remove("is-mobile");
	});

	it("focuses the NLP editor instead of the hidden detailed title field", () => {
		const modal = new TaskCreationModal(app, createPlugin(true));
		const focus = jest.fn();
		const scrollDOM = { scrollTop: 42 };

		(modal as any).nlMarkdownEditor = {
			editor: {
				cm: {
					focus,
					scrollDOM,
				},
			},
		};

		(modal as any).focusTitleInput();
		jest.advanceTimersByTime(100);

		expect(focus).toHaveBeenCalledTimes(1);
		expect(scrollDOM.scrollTop).toBe(0);
	});

	it("uses a longer initial focus delay on mobile so the keyboard can open after layout", () => {
		document.body.classList.add("is-mobile");
		const modal = new TaskCreationModal(app, createPlugin(true));
		const focus = jest.fn();
		const scrollDOM = { scrollTop: 42 };

		(modal as any).nlMarkdownEditor = {
			editor: {
				cm: {
					focus,
					scrollDOM,
				},
			},
		};

		(modal as any).focusTitleInput();
		jest.advanceTimersByTime(349);

		expect(focus).not.toHaveBeenCalled();

		jest.advanceTimersByTime(1);

		expect(focus).toHaveBeenCalledTimes(1);
		expect(scrollDOM.scrollTop).toBe(0);
	});

	it("falls back to the NLP textarea when the markdown editor is unavailable", () => {
		document.body.classList.add("is-mobile");
		const modal = new TaskCreationModal(app, createPlugin(true));
		const textarea = document.createElement("textarea");
		textarea.focus = jest.fn();
		textarea.select = jest.fn();

		(modal as any).nlMarkdownEditor = null;
		(modal as any).nlInput = textarea;

		(modal as any).focusTitleInput();
		jest.advanceTimersByTime(350);

		expect(textarea.focus).toHaveBeenCalledWith({ preventScroll: true });
		expect(textarea.select).toHaveBeenCalledTimes(1);
	});
});
