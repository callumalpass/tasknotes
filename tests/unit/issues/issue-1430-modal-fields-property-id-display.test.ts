import { settingsFixture, page } from "../../helpers/native-settings";
import { initializeFieldConfig } from "../../../src/utils/fieldConfigDefaults";

describe("Issue #1430: form fields display property keys, not internal custom IDs", () => {
	it.each(["propID", ""])("shows a custom key or clear fallback (%s)", key => {
		const { plugin, tab } = settingsFixture();
		plugin.settings.userFields = [{ id: "field_1735011234", displayName: "My custom field", key, type: "text" }];
		plugin.settings.modalFieldsConfig = initializeFieldConfig(undefined, plugin.settings.userFields);
		const form = page(tab.getSettingDefinitions(), "Form fields");
		const field = page(form.items!, "My custom field");
		expect(field.desc).toBe(key || "No key set");
		expect(field.desc).not.toContain("field_1735011234");
	});
	it("keeps stable IDs on core form fields", () => {
		const { tab } = settingsFixture();
		expect(page(page(tab.getSettingDefinitions(), "Form fields").items!, "Title").desc).toBe("ID: title");
	});
});
