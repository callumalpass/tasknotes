import { observeTranslation as mockObserveTranslation, englishText as mockEnglishText, conceptDescriptor as mockConceptDescriptor } from "../../helpers/real-i18n";
import { msg } from "@lingui/core/macro";
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

		expect(command?.nameKey).toEqual(msg({ message: "Create or open task and start time tracking", context: "commands.createOrOpenTaskWithTracking" }));

		await command?.callback?.(ctx as any);

		expect(ctx.openTaskSelectorWithCreateAndStartTracking).toHaveBeenCalledTimes(1);
	});
});
