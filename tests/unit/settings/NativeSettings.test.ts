import { Platform } from "obsidian";
import { settingsFixture, flattenSettings, control, page } from "../../helpers/native-settings";

describe("Native settings navigation and search", () => {
	test("preserves every scalar binding inventoried from the v5 beta.3 settings", () => {
		const inventory: string[] = require("../../fixtures/native-settings-coverage.json");
		const { tab } = settingsFixture();
		const entries = flattenSettings(tab.getSettingDefinitions());
		const indexed = new Set(
			entries.flatMap((item) => [
				...("control" in item && item.control ? [item.control.key] : []),
				...("aliases" in item ? (item.aliases ?? []) : []),
			])
		);
		expect(inventory.filter((key) => !indexed.has(key))).toEqual([]);
	});
	test("exposes individual controls before rendering any page, without side effects", () => {
		const { plugin, tab } = settingsFixture();
		const before = JSON.stringify(plugin.settings);
		const definitions = tab.getSettingDefinitions();
		const entries = flattenSettings(definitions);
		expect(entries.filter((item) => "control" in item && item.control).length).toBeGreaterThan(
			200
		);
		expect(
			definitions.filter((item) => "type" in item && item.type === "page").length
		).toBeGreaterThanOrEqual(7);
		expect(entries.some((item) => "name" in item && item.name?.startsWith("settings."))).toBe(
			false
		);
		expect(JSON.stringify(plugin.settings)).toBe(before);
		expect(plugin.saveSettings).not.toHaveBeenCalled();
		expect(tab.containerEl.children).toHaveLength(0);
	});

	test("has stable, unique bindings across repeated indexing", () => {
		const { tab } = settingsFixture();
		const keys = () =>
			flattenSettings(tab.getSettingDefinitions()).flatMap((item) =>
				"control" in item && item.control ? [item.control.key] : []
			);
		const first = keys();
		expect(new Set(first).size).toBe(first.length);
		expect(keys()).toEqual(first);
	});

	test("keeps disabled feature options searchable and updates predicates without rebuilding", async () => {
		const { plugin, tab } = settingsFixture();
		plugin.settings.moveArchivedTasks = false;
		const definitions = tab.getSettingDefinitions();
		const archive = control(definitions, "archiveFolder");
		expect(archive.visible).toBeUndefined();
		expect(archive.searchable).toBeUndefined();
		expect((archive.control.disabled as () => boolean)()).toBe(true);
		await tab.setControlValue("moveArchivedTasks", true);
		expect((archive.control.disabled as () => boolean)()).toBe(false);
	});

	test("uses native folder/file suggesters and useful search aliases", () => {
		const { tab } = settingsFixture();
		const definitions = tab.getSettingDefinitions();
		expect(control(definitions, "tasksFolder").control.type).toBe("folder");
		expect(control(definitions, "taskCreationDefaults.bodyTemplate").control.type).toBe("file");
		expect(control(definitions, "commandFileMapping.open-tasks-view").control.type).toBe(
			"file"
		);
		expect(control(definitions, "tasksFolder").aliases).toContain("directory");
	});

	test("saves through the TaskNotes lifecycle, not PluginSettingTab.saveData", async () => {
		const { tab, plugin } = settingsFixture();
		tab.getSettingDefinitions();
		await tab.setControlValue("tasksFolder", "Projects/Tasks");
		expect(plugin.settings.tasksFolder).toBe("Projects/Tasks");
		expect(plugin.saveSettings).toHaveBeenCalled();
		expect(plugin.saveData).not.toHaveBeenCalled();
	});

	test("rejects invalid types, enums, and numeric bounds without changing settings", async () => {
		const { tab, plugin } = settingsFixture();
		tab.getSettingDefinitions();
		const before = plugin.settings.pomodoroWorkDuration;
		await expect(tab.setControlValue("pomodoroWorkDuration", -1)).rejects.toThrow();
		await expect(tab.setControlValue("pomodoroWorkDuration", "25")).rejects.toThrow();
		await expect(tab.setControlValue("taskIdentificationMethod", "invalid")).rejects.toThrow();
		expect(plugin.settings.pomodoroWorkDuration).toBe(before);
		expect(plugin.saveSettings).not.toHaveBeenCalled();
	});

	test("reports save failures rather than resolving as if persisted", async () => {
		const { tab, plugin } = settingsFixture();
		tab.getSettingDefinitions();
		(plugin.saveSettings as jest.Mock).mockRejectedValueOnce(new Error("Disk full"));
		await expect(tab.setControlValue("tasksFolder", "Changed")).rejects.toThrow("Disk full");
		await expect(tab.setControlValue("tasksFolder", "Retry")).resolves.toBeUndefined();
	});

	test("keeps secrets out of search definitions", () => {
		const { tab, plugin } = settingsFixture();
		plugin.settings.apiAuthToken = "SECRET-MUST-NOT-BE-INDEXED";
		const definitions = tab.getSettingDefinitions();
		expect(JSON.stringify(definitions)).not.toContain(plugin.settings.apiAuthToken);
		expect(
			flattenSettings(definitions).some(
				(item) => "name" in item && item.name === "Client secret"
			)
		).toBe(true);
	});

	test("hides desktop-only API configuration on mobile", () => {
		const { tab } = settingsFixture();
		const api = page(tab.getSettingDefinitions(), "HTTP API");
		const original = Platform.isMobile;
		try {
			Object.assign(Platform, { isMobile: true });
			expect((api.visible as () => boolean)()).toBe(false);
		} finally {
			Object.assign(Platform, { isMobile: original });
		}
	});
});
