import { SettingsLifecycleService } from "../../../src/services/SettingsLifecycleService";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { hasCompletePropertyTaskIdentification, isTaskFrontmatter } from "../../../src/utils/taskIdentification";

describe("Property identification validation (#2363)", () => {
	it.each([["", ""], ["category", ""], ["", "task"], [" ", "task"]])("rejects incomplete settings without assuming defaults (%s, %s)", (name, value) => {
		const settings = { ...DEFAULT_SETTINGS, taskIdentificationMethod: "property" as const, taskPropertyName: name, taskPropertyValue: value };
		expect(hasCompletePropertyTaskIdentification(settings)).toBe(false);
		expect(isTaskFrontmatter({ category: "task", tags: ["task"] }, settings)).toBe(false);
	});

	it.each([
		["taskIdentificationMethod", "property"],
		["taskPropertyName", "category"],
		["taskPropertyValue", "task"],
	] as const)("invalidates task indexes when %s changes", (key, value) => {
		const plugin = { settings: { ...DEFAULT_SETTINGS } };
		const lifecycle = new SettingsLifecycleService(plugin as never);
		lifecycle.captureCurrentSettings();
		(plugin.settings as any)[key] = value;
		expect((lifecycle as any).haveCacheSettingsChanged()).toBe(true);
	});
});
