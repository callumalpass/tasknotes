/**
 * Issue #1652: API/MCP task creation should respect configured filename format
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1652
 */

import { PluginFactory } from "../../helpers/mock-factories";
import { TaskService } from "../../../src/services/TaskService";

function createTaskServiceWithZettelSettings(): TaskService {
	const basePlugin = PluginFactory.createMockPlugin();
	const plugin = PluginFactory.createMockPlugin({
		settings: {
			...basePlugin.settings,
			storeTitleInFilename: false,
			taskFilenameFormat: "zettel",
			customFilenameTemplate: "{{title}}",
			tasksFolder: "TaskNotes/Tasks",
		},
	});

	// Simulate no filename collisions so the generated base filename is used.
	plugin.app.vault.getAbstractFileByPath = jest.fn().mockReturnValue(null);
	plugin.app.workspace.getActiveFile = jest.fn().mockReturnValue(null);

	return new TaskService(plugin);
}

describe("Issue #1652: API/MCP filename format mismatch", () => {
	it("uses zettel filenames for POST /api/tasks payloads", async () => {
		const taskService = createTaskServiceWithZettelSettings();

		// Equivalent shape to HTTP API POST /api/tasks payload.
		const { file } = await taskService.createTask({
			title: "Test Task",
			status: "open",
			priority: "normal",
		});

		expect(file.path).toMatch(/^TaskNotes\/Tasks\/\d{6}[0-9a-z]+\.md$/i);
		expect(file.basename).toMatch(/^\d{6}[0-9a-z]+$/i);
		expect(file.basename).not.toBe("Test Task");
	});

	it("uses zettel filenames for tasknotes_create_task payloads", async () => {
		const taskService = createTaskServiceWithZettelSettings();

		// Equivalent shape to MCP tasknotes_create_task payload mapping.
		const { file } = await taskService.createTask({
			title: "MCP Task",
			path: "",
			archived: false,
			status: "open",
			priority: "normal",
			creationContext: "api",
		});

		expect(file.path).toMatch(/^TaskNotes\/Tasks\/\d{6}[0-9a-z]+\.md$/i);
		expect(file.basename).toMatch(/^\d{6}[0-9a-z]+$/i);
		expect(file.basename).not.toBe("MCP Task");
	});

	it("uses zettel filenames for /api/nlp/create payloads", async () => {
		const taskService = createTaskServiceWithZettelSettings();

		// Equivalent shape after NLP parse in SystemController.handleNLPCreate().
		const { file } = await taskService.createTask({
			title: "NLP parsed title",
			status: "open",
			priority: "normal",
			creationContext: "api",
		});

		expect(file.path).toMatch(/^TaskNotes\/Tasks\/\d{6}[0-9a-z]+\.md$/i);
		expect(file.basename).toMatch(/^\d{6}[0-9a-z]+$/i);
		expect(file.basename).not.toBe("NLP parsed title");
	});
});
