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

describe("Issue #1297: Create or open task footer activation", () => {
	let mockApp: App;
	let mockPlugin: any;

	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
		MockObsidian.reset();

		mockApp = createMockApp(MockObsidian.createMockApp());
		mockPlugin = {
			app: mockApp,
			settings: {
				customStatuses: [],
				customPriorities: [],
				defaultTaskStatus: "open",
				defaultTaskPriority: "normal",
				nlpDefaultToScheduled: true,
				nlpLanguage: "en",
				nlpTriggers: { enabled: true, triggers: [] },
				userFields: [],
				calendarViewSettings: { locale: "en" },
			},
			i18n: {
				translate: jest.fn((key: string) => key),
			},
			statusManager: {
				isCompletedStatus: jest.fn(() => false),
				getStatusConfig: jest.fn(() => null),
			},
			taskService: {
				createTask: jest.fn().mockResolvedValue({
					taskInfo: {
						title: "Buy milk",
						status: "open",
						priority: "normal",
						path: "Tasks/Buy milk.md",
					},
				}),
			},
		};
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("creates the typed task when the footer is tapped", async () => {
		const onResult = jest.fn();
		const modal = new TaskSelectorWithCreateModal(mockApp, mockPlugin, [], {
			onResult,
		});

		modal.onOpen();
		jest.runOnlyPendingTimers();

		expect(NLPSuggest).toHaveBeenCalledWith(mockApp, modal.inputEl, mockPlugin);

		modal.inputEl.value = "Buy milk";
		modal.inputEl.dispatchEvent(new Event("input"));

		const footer = modal.modalEl.querySelector(".task-selector-create-footer") as HTMLElement;
		expect(footer).not.toBeNull();
		expect(footer.getAttribute("role")).toBe("button");
		expect(footer.tabIndex).toBe(0);

		footer.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		await Promise.resolve();

		expect(mockPlugin.taskService.createTask).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "Buy milk",
				status: "open",
				priority: "normal",
			})
		);
		expect(onResult).toHaveBeenCalledWith({
			type: "created",
			task: expect.objectContaining({ title: "Buy milk" }),
		});
		expect(mockClose).toHaveBeenCalledTimes(1);
	});
});
