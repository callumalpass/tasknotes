import { SettingsLifecycleService } from "../../../src/services/SettingsLifecycleService";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";

describe("identification settings cache snapshots", () => {
	it.each([
		["taskIdentificationMethod", "property"],
		["taskPropertyName", "category"],
		["taskPropertyValue", "action"],
	] as const)("invalidates indexes when %s changes", (key, value) => {
		const plugin = { settings: { ...DEFAULT_SETTINGS } };
		const lifecycle = new SettingsLifecycleService(plugin as never);
		lifecycle.captureCurrentSettings();
		plugin.settings[key] = value as never;
		expect((lifecycle as any).haveCacheSettingsChanged()).toBe(true);
		lifecycle.captureCurrentSettings();
		expect((lifecycle as any).haveCacheSettingsChanged()).toBe(false);
	});
});
