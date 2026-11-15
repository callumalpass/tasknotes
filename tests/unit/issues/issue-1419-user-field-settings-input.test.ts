import { settingsFixture } from "../../helpers/native-settings";
import { initializeFieldConfig } from "../../../src/utils/fieldConfigDefaults";

describe("Issue #1419: custom property settings persist edits", () => {
	it("saves display names, keys, and form labels through native control changes", async () => {
		const { plugin, tab } = settingsFixture();
		plugin.settings.userFields = [{ id: "field_1419", displayName: "", key: "", type: "text" }];
		plugin.settings.modalFieldsConfig = initializeFieldConfig(undefined, plugin.settings.userFields);
		tab.getSettingDefinitions();
		await tab.setControlValue("userFields.field_1419.displayName", "CEU Credits");
		await tab.setControlValue("userFields.field_1419.key", "ceu_credits");
		expect(plugin.settings.userFields[0]).toMatchObject({ displayName: "CEU Credits", key: "ceu_credits" });
		expect(plugin.settings.modalFieldsConfig.fields.find(field => field.id === "field_1419")?.displayName).toBe("CEU Credits");
		expect(plugin.saveSettings).toHaveBeenCalledTimes(2);
	});
	it("preserves text, list, and fractional numeric defaults", async () => {
		const { plugin, tab } = settingsFixture();
		plugin.settings.userFields = [{ id: "text_field", displayName: "Text", key: "text", type: "text" }, { id: "list_field", displayName: "List", key: "list", type: "list" }, { id: "number_field", displayName: "Number", key: "number", type: "number" }];
		tab.getSettingDefinitions();
		await tab.setControlValue("userFields.text_field.defaultValue", "review");
		await tab.setControlValue("userFields.list_field.defaultValue", "alpha, beta");
		await tab.setControlValue("userFields.number_field.defaultValue", "7.5");
		expect(plugin.settings.userFields.map(field => field.defaultValue)).toEqual(["review", ["alpha", "beta"], 7.5]);
		expect(plugin.saveSettings).toHaveBeenCalledTimes(3);
	});
});
