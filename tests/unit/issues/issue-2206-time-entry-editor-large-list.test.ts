import { TimeEntryEditorModal } from "../../../src/modals/TimeEntryEditorModal";
import { createTaskModalMarkdownEditor } from "../../../src/modals/taskModalEditorAdapter";
import { PluginFactory, TaskFactory, TimeEntryFactory } from "../../helpers/mock-factories";

jest.mock("../../../src/modals/taskModalEditorAdapter", () => ({
	createTaskModalMarkdownEditor: jest.fn(),
}));

describe("Issue #2206: time entry editor large list", () => {
	const createTaskModalMarkdownEditorMock = createTaskModalMarkdownEditor as jest.MockedFunction<
		typeof createTaskModalMarkdownEditor
	>;

	beforeEach(() => {
		jest.clearAllMocks();
		createTaskModalMarkdownEditorMock.mockReturnValue({
			destroy: jest.fn(),
		} as any);
	});

	it("does not eagerly construct one markdown editor per existing time entry on open", () => {
		const plugin = PluginFactory.createMockPlugin();
		const task = TaskFactory.createTask({
			timeEntries: TimeEntryFactory.createEntries(50),
		});

		const modal = new TimeEntryEditorModal(plugin.app as any, plugin as any, task, jest.fn());
		modal.onOpen();

		expect(createTaskModalMarkdownEditorMock).not.toHaveBeenCalled();
		expect(modal.contentEl.querySelectorAll(".time-entry-editor-modal__entry")).toHaveLength(50);
		expect(
			modal.contentEl.querySelectorAll(".time-entry-editor-modal__description-editor-fallback")
		).toHaveLength(50);
	});
});
