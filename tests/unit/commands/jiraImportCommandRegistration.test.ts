import { createTaskNotesCommandDefinitions } from "../../../src/commands/taskNotesCommands";
import type TaskNotesPlugin from "../../../src/main";

describe("Jira import command registration", () => {
	it("registers the translated Jira import command", () => {
		const commands = createTaskNotesCommandDefinitions({} as TaskNotesPlugin);

		expect(commands).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "import-jira-issue",
					nameKey: "commands.importJiraIssue",
				}),
			])
		);
	});
});

