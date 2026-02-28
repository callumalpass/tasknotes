/**
 * Issue #1652: API/MCP task creation ignores filename format setting (Zettelkasten)
 *
 * Reported behavior:
 * - `storeTitleInFilename = false`
 * - `taskFilenameFormat = "zettel"`
 * - UI task creation uses zettel filenames (expected)
 * - API/MCP/NLP task creation uses title filenames (unexpected)
 *
 * This file documents the reported reproduction as skipped tests so CI is unaffected.
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
	it.skip("reproduces issue #1652: POST /api/tasks uses title filename instead of zettel", async () => {
		const taskService = createTaskServiceWithZettelSettings();

		// Equivalent shape to HTTP API POST /api/tasks payload.
		const { file } = await taskService.createTask({
			title: "Test Task",
			status: "open",
			priority: "normal",
		});

		// Reported bug behavior: file basename is the title.
		expect(file.basename).toBe("Test Task");

		// Expected behavior after fix:
		// expect(file.basename).toMatch(/^\\d{6}[0-9a-z]+$/i);
	});

	it.skip("reproduces issue #1652: tasknotes_create_task uses title filename instead of zettel", async () => {
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

		// Reported bug behavior: file basename is the title.
		expect(file.basename).toBe("MCP Task");

		// Expected behavior after fix:
		// expect(file.basename).toMatch(/^\\d{6}[0-9a-z]+$/i);
	});

	it.skip("reproduces issue #1652: /api/nlp/create uses title filename instead of zettel", async () => {
		const taskService = createTaskServiceWithZettelSettings();

		// Equivalent shape after NLP parse in SystemController.handleNLPCreate().
		const { file } = await taskService.createTask({
			title: "NLP parsed title",
			status: "open",
			priority: "normal",
			creationContext: "api",
		});

		// Reported bug behavior: file basename is the title.
		expect(file.basename).toBe("NLP parsed title");

		// Expected behavior after fix:
		// expect(file.basename).toMatch(/^\\d{6}[0-9a-z]+$/i);
	});
});

