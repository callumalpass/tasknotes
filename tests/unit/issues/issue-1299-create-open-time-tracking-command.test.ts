import { createTaskNotesCommandDefinitions } from "../../../src/commands/taskNotesCommands";

describe("Issue #1299: create or open task with time tracking command", () => {
	it("registers a command that opens the task selector and starts tracking", async () => {
		const definitions = createTaskNotesCommandDefinitions({} as any);
		const command = definitions.find(
			(definition) => definition.id === "create-or-open-task-with-time-tracking"
		);
		const ctx = {
			openTaskSelectorWithCreateAndStartTracking: jest.fn(),
		};

		expect(command?.nameKey).toBe("commands.createOrOpenTaskWithTracking");

		await command?.callback?.(ctx as any);

		expect(ctx.openTaskSelectorWithCreateAndStartTracking).toHaveBeenCalledTimes(1);
	});
});
