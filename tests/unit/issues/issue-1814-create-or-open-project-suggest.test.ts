import { TaskSelectorWithCreateModal } from "../../../src/modals/TaskSelectorWithCreateModal";
import { NLPSuggest } from "../../../src/modals/taskCreationSuggest";
import { MockObsidian } from "../../__mocks__/obsidian";
import type { App } from "obsidian";

jest.mock("obsidian");

const mockClose = jest.fn();

jest.mock("../../../src/modals/taskCreationSuggest", () => ({
	NLPSuggest: jest.fn().mockImplementation(() => ({
		close: mockClose,
	})),
}));

const createMockApp = (mockApp: unknown): App => mockApp as App;

describe("Issue #1814: Create or open task project autosuggest", () => {
	let mockApp: App;
	let mockPlugin: any;

	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
		MockObsidian.reset();

		mockApp = createMockApp(MockObsidian.createMockApp());
		mockPlugin = {
			app: mockApp,
			settings: {},
			i18n: {
				translate: jest.fn((key: string) => key),
			},
			statusManager: {
				isCompletedStatus: jest.fn(() => false),
				getStatusConfig: jest.fn(() => null),
			},
		};
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("attaches the NLP suggester to the selector input", () => {
		const modal = new TaskSelectorWithCreateModal(mockApp, mockPlugin, [], {
			onResult: jest.fn(),
		});

		modal.onOpen();

		expect(NLPSuggest).toHaveBeenCalledWith(mockApp, modal.inputEl, mockPlugin);

		modal.onClose();

		expect(mockClose).toHaveBeenCalledTimes(1);
	});
});
