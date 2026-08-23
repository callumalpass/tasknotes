import { TimeEntryEditorModal } from "../../../src/modals/TimeEntryEditorModal";
import { createTaskModalMarkdownEditor } from "../../../src/modals/taskModalEditorAdapter";
import { PluginFactory, TaskFactory, TimeEntryFactory } from "../../helpers/mock-factories";

jest.mock("../../../src/modals/taskModalEditorAdapter", () => ({
	createTaskModalMarkdownEditor: jest.fn(),
}));

describe("TimeEntryEditorModal", () => {
	const createTaskModalMarkdownEditorMock = createTaskModalMarkdownEditor as jest.MockedFunction<
		typeof createTaskModalMarkdownEditor
	>;

	function focusFirstDescriptionEditor(modal: TimeEntryEditorModal) {
		const textarea = modal.contentEl.querySelector<HTMLTextAreaElement>(
			".time-entry-editor-modal__description-editor-fallback"
		);
		expect(textarea).not.toBeNull();

		textarea?.dispatchEvent(new Event("focus"));
		expect(createTaskModalMarkdownEditorMock).toHaveBeenCalled();

		return createTaskModalMarkdownEditorMock.mock.calls[
			createTaskModalMarkdownEditorMock.mock.calls.length - 1
		][2];
	}

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("saves description updates from the lightweight description field", () => {
		const plugin = PluginFactory.createMockPlugin();
		const task = TaskFactory.createTask({
			timeEntries: [TimeEntryFactory.createEntry({ description: "Initial work" })],
		});
		const onSave = jest.fn();

		const modal = new TimeEntryEditorModal(plugin.app as any, plugin as any, task, onSave);
		modal.onOpen();

		const textarea = modal.contentEl.querySelector<HTMLTextAreaElement>(
			".time-entry-editor-modal__description-editor-fallback"
		);
		expect(textarea).not.toBeNull();
		expect(createTaskModalMarkdownEditorMock).not.toHaveBeenCalled();

		if (textarea) {
			textarea.value = "Worked on #learning";
			textarea.dispatchEvent(new Event("input"));
		}
		(modal as any).save();

		expect(onSave).toHaveBeenCalledWith([
			expect.objectContaining({ description: "Worked on #learning" }),
		]);
	});

	it("saves description updates coming from the lazily hydrated markdown editor", () => {
		const plugin = PluginFactory.createMockPlugin();
		const task = TaskFactory.createTask({
			timeEntries: [TimeEntryFactory.createEntry({ description: "Initial work" })],
		});
		const onSave = jest.fn();

		createTaskModalMarkdownEditorMock.mockReturnValue({
			destroy: jest.fn(),
		} as any);

		const modal = new TimeEntryEditorModal(plugin.app as any, plugin as any, task, onSave);
		modal.onOpen();

		expect(createTaskModalMarkdownEditorMock).not.toHaveBeenCalled();
		const editorOptions = focusFirstDescriptionEditor(modal);
		expect(createTaskModalMarkdownEditorMock).toHaveBeenCalledTimes(1);

		editorOptions.onChange("Worked on #learning");
		(modal as any).save();

		expect(onSave).toHaveBeenCalledWith([
			expect.objectContaining({ description: "Worked on #learning" }),
		]);
	});

	it("closes the modal when Escape is pressed inside the markdown editor", () => {
		const plugin = PluginFactory.createMockPlugin();
		const task = TaskFactory.createTask({
			timeEntries: [TimeEntryFactory.createEntry()],
		});

		createTaskModalMarkdownEditorMock.mockReturnValue({
			destroy: jest.fn(),
		} as any);

		const modal = new TimeEntryEditorModal(plugin.app as any, plugin as any, task, jest.fn());
		const closeSpy = jest.spyOn(modal, "close").mockImplementation(jest.fn());
		modal.onOpen();

		const editorOptions = focusFirstDescriptionEditor(modal);
		editorOptions.onEscape();

		expect(closeSpy).toHaveBeenCalledTimes(1);
	});

	it("destroys markdown editors before rerendering and when closing", () => {
		const plugin = PluginFactory.createMockPlugin();
		const task = TaskFactory.createTask({
			timeEntries: [TimeEntryFactory.createEntry()],
		});

		const firstEditor = { destroy: jest.fn() } as any;
		const secondEditor = { destroy: jest.fn() } as any;
		const thirdEditor = { destroy: jest.fn() } as any;

		createTaskModalMarkdownEditorMock
			.mockReturnValueOnce(firstEditor)
			.mockReturnValueOnce(secondEditor);

		const modal = new TimeEntryEditorModal(plugin.app as any, plugin as any, task, jest.fn());
		modal.onOpen();
		focusFirstDescriptionEditor(modal);

		(modal as any).addNewEntry();

		expect(firstEditor.destroy).toHaveBeenCalledTimes(1);
		expect(createTaskModalMarkdownEditorMock).toHaveBeenCalledTimes(1);

		focusFirstDescriptionEditor(modal);

		modal.onClose();

		expect(secondEditor.destroy).toHaveBeenCalledTimes(1);
		expect(createTaskModalMarkdownEditorMock).toHaveBeenCalledTimes(2);
	});
});
