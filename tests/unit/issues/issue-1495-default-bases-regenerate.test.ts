import TaskNotesPlugin from "../../../src/main";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { App, TFile } from "../../__mocks__/obsidian";

jest.mock("obsidian");

function createPlugin(taskTag: string): TaskNotesPlugin {
	const plugin = new TaskNotesPlugin(new App() as never, {} as never);
	const commandFileMapping = Object.fromEntries(
		Object.keys(DEFAULT_SETTINGS.commandFileMapping).map((commandId) => [
			commandId,
			`TaskNotes/Views/issue-1495-${commandId}.base`,
		])
	) as typeof DEFAULT_SETTINGS.commandFileMapping;

	plugin.settings = {
		...DEFAULT_SETTINGS,
		taskIdentificationMethod: "tag",
		taskTag,
		commandFileMapping,
	};

	plugin.fieldMapper = {
		toUserField: jest.fn((key: keyof typeof DEFAULT_SETTINGS.fieldMapping) => {
			return DEFAULT_SETTINGS.fieldMapping[key] ?? key;
		}),
		getMapping: jest.fn(() => DEFAULT_SETTINGS.fieldMapping),
	} as never;

	return plugin;
}

async function readVaultFile(plugin: TaskNotesPlugin, path: string): Promise<string> {
	const file = plugin.app.vault.getAbstractFileByPath(path);
	expect(file).toBeInstanceOf(TFile);
	return plugin.app.vault.read(file as TFile);
}

describe("issue #1495 - default Bases files after changing task tag", () => {
	it("keeps existing Bases files by default but can overwrite them from current settings", async () => {
		const plugin = createPlugin("task");
		const tasksBasePath = plugin.settings.commandFileMapping["open-tasks-view"];

		await plugin.ensureBasesViewFiles();
		await expect(readVaultFile(plugin, tasksBasePath)).resolves.toContain(
			'file.hasTag("task")'
		);

		plugin.settings.taskTag = "todo";
		const skippedResult = await plugin.ensureBasesViewFiles();
		expect(skippedResult.updated).not.toContain(tasksBasePath);
		await expect(readVaultFile(plugin, tasksBasePath)).resolves.toContain(
			'file.hasTag("task")'
		);

		const updatedResult = await plugin.ensureBasesViewFiles({ overwriteExisting: true });
		expect(updatedResult.updated).toContain(tasksBasePath);
		const updatedContent = await readVaultFile(plugin, tasksBasePath);
		expect(updatedContent).toContain('file.hasTag("todo")');
		expect(updatedContent).not.toContain('file.hasTag("task")');
	});
});
