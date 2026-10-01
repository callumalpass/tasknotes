import { TaskSelectorWithCreateModal } from "../../../src/modals/TaskSelectorWithCreateModal";
import { NLPSuggest } from "../../../src/modals/taskCreationSuggest";
import { MockObsidian } from "../../helpers/obsidian-runtime";
import type { App } from "obsidian";

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

	it("does not offer or perform task creation in a selection-only picker (#2326)", async () => {
		const onResult = jest.fn();
		const modal = new TaskSelectorWithCreateModal(mockApp, mockPlugin, [], { onResult, allowCreate: false });
		modal.onOpen();
		jest.runOnlyPendingTimers();
		expect(NLPSuggest).not.toHaveBeenCalled();
		expect(modal.modalEl.querySelector(".task-selector-create-footer")).toBeNull();
		modal.inputEl.value = "Should not be created";
		await (modal as any).createNewTask();
		expect(mockPlugin.taskService.createTask).not.toHaveBeenCalled();
		expect(onResult).not.toHaveBeenCalled();
		modal.onClose();
		jest.runOnlyPendingTimers();
		expect(onResult).toHaveBeenCalledWith({ type: "cancelled" });
	});

	it("can include archived tasks explicitly for active-tracker selection", () => {
		const archived = { path: "Tasks/Archived.md", title: "Archived", status: "open", archived: true } as any;
		const modal = new TaskSelectorWithCreateModal(mockApp, mockPlugin, [archived], { onResult: jest.fn(), allowCreate: false, includeArchived: true });
		expect(modal.getSuggestions("")).toEqual([archived]);
		const defaultModal = new TaskSelectorWithCreateModal(mockApp, mockPlugin, [archived], { onResult: jest.fn() });
		expect(defaultModal.getSuggestions("")).toEqual([]);
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
