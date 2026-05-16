import { createTaskNotesCommandDefinitions } from "../../../src/commands/taskNotesCommands";

describe("Issue #1732: command palette task functions", () => {
	it("registers direct command-palette actions for current task workflows", async () => {
		const definitions = createTaskNotesCommandDefinitions({} as any);
		const editCurrentTask = definitions.find(
			(definition) => definition.id === "edit-current-task"
		);
		const addProject = definitions.find(
			(definition) => definition.id === "add-project-to-current-task"
		);
		const addSubtask = definitions.find(
			(definition) => definition.id === "add-subtask-to-current-note"
		);
		const ctx = {
			openTaskEditModalForCurrentTask: jest.fn(),
			addProjectToCurrentTask: jest.fn(),
			addSubtaskToCurrentNote: jest.fn(),
		};

		expect(editCurrentTask?.nameKey).toBe("commands.editCurrentTask");
		expect(addProject?.nameKey).toBe("commands.addProjectToCurrentTask");
		expect(addSubtask?.nameKey).toBe("commands.addSubtaskToCurrentNote");

		await editCurrentTask?.callback?.(ctx as any);
		await addProject?.callback?.(ctx as any);
		await addSubtask?.callback?.(ctx as any);

		expect(ctx.openTaskEditModalForCurrentTask).toHaveBeenCalledTimes(1);
		expect(ctx.addProjectToCurrentTask).toHaveBeenCalledTimes(1);
		expect(ctx.addSubtaskToCurrentNote).toHaveBeenCalledTimes(1);
	});
});
