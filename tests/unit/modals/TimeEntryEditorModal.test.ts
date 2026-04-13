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

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("saves description updates coming from the markdown editor", () => {
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

		expect(createTaskModalMarkdownEditorMock).toHaveBeenCalledTimes(1);
		const editorOptions = createTaskModalMarkdownEditorMock.mock.calls[0][2];

		editorOptions.onChange("Worked on #learning");
		(modal as any).save();

		expect(onSave).toHaveBeenCalledWith([
			expect.objectContaining({ description: "Worked on #learning" }),
		]);
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
			.mockReturnValueOnce(secondEditor)
			.mockReturnValueOnce(thirdEditor);

		const modal = new TimeEntryEditorModal(plugin.app as any, plugin as any, task, jest.fn());
		modal.onOpen();

		(modal as any).addNewEntry();

		expect(firstEditor.destroy).toHaveBeenCalledTimes(1);
		expect(createTaskModalMarkdownEditorMock).toHaveBeenCalledTimes(3);

		modal.onClose();

		expect(secondEditor.destroy).toHaveBeenCalledTimes(1);
		expect(thirdEditor.destroy).toHaveBeenCalledTimes(1);
	});
});
