
import { SettingsLifecycleService } from "../../../src/services/SettingsLifecycleService";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { generalDefinitions } from "../../../src/settings/native/general";
import { hasUsablePropertyTaskIdentification, isTaskFrontmatter } from "../../../src/utils/taskIdentification";
import { flattenSettings, settingsFixture } from "../../helpers/native-settings";


describe("Property identification validation (#2363)", () => {
	it.each([["", ""], ["", "task"], [" ", "task"]])("rejects settings without a property name, without assuming defaults (%s, %s)", (name, value) => {
		const settings = { ...DEFAULT_SETTINGS, taskIdentificationMethod: "property" as const, taskPropertyName: name, taskPropertyValue: value };
		expect(hasUsablePropertyTaskIdentification(settings)).toBe(false);
		expect(isTaskFrontmatter({ category: "task", tags: ["task"] }, settings)).toBe(false);
	});

	it("warns on the native settings page only while property identification is incomplete", () => {
		const { plugin, ctx } = settingsFixture();
		const warning = flattenSettings(generalDefinitions(ctx)).find(
			(item) => "render" in item && "visible" in item && item.name === ""
		) as { visible: () => boolean };

		plugin.settings.taskIdentificationMethod = "tag";
		plugin.settings.taskPropertyName = "";
		expect(warning.visible()).toBe(false);
		plugin.settings.taskIdentificationMethod = "property";
		expect(warning.visible()).toBe(true);
		plugin.settings.taskPropertyName = "category";
		expect(warning.visible()).toBe(false);
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
