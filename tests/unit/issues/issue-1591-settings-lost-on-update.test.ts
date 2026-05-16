import { describe, expect, it, jest, afterEach } from "@jest/globals";
import TaskNotesPlugin from "../../../src/main";

function createPlugin(options: { dataFileExists: boolean; version?: string }) {
	const app = {
		vault: {
			configDir: ".obsidian",
			adapter: {
				exists: jest.fn().mockResolvedValue(options.dataFileExists),
			},
		},
	} as any;

	const plugin = new TaskNotesPlugin(app);
	(plugin as any).manifest = {
		id: "tasknotes",
		dir: ".obsidian/plugins/tasknotes",
		version: options.version ?? "4.3.2",
	};
	(plugin as any).settingsLifecycleService = {
		saveSettings: jest.fn(() => plugin.saveSettingsDataOnly()),
	};
	plugin.saveData = jest.fn().mockResolvedValue(undefined);

	return plugin;
}

describe("issue #1591 settings reset on update", () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("does not persist defaults when an existing settings file temporarily reads as null", async () => {
		jest.spyOn(console, "error").mockImplementation(() => undefined);
		jest.spyOn(console, "warn").mockImplementation(() => undefined);

		const plugin = createPlugin({ dataFileExists: true });
		plugin.loadData = jest.fn().mockResolvedValue(null);

		await plugin.loadSettings();
		await plugin.checkForVersionUpdate();

		expect(plugin.loadData).toHaveBeenCalledTimes(4);
		expect(plugin.saveData).not.toHaveBeenCalled();
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining("Settings data file exists")
		);
		expect(console.warn).toHaveBeenCalledWith(
			expect.stringContaining("Skipping settings save")
		);
	});

	it("still writes lastSeenVersion for a new install with no settings file", async () => {
		const plugin = createPlugin({ dataFileExists: false, version: "4.3.2" });
		plugin.loadData = jest.fn().mockResolvedValue(null);

		await plugin.loadSettings();
		await plugin.checkForVersionUpdate();

		expect(plugin.saveData).toHaveBeenCalledTimes(1);
		expect(plugin.saveData).toHaveBeenCalledWith(
			expect.objectContaining({
				lastSeenVersion: "4.3.2",
			})
		);
	});
});
