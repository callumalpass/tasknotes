import { settingsFixture, control } from "../../helpers/native-settings";

describe("issue #1804 inline task folder setting", () => {
	it.each([false, true])("keeps the inline-created task folder available with instant conversion %s", async enabled => {
		const { plugin, tab } = settingsFixture();
		plugin.settings.enableInstantTaskConvert = enabled;
		plugin.settings.inlineTaskConvertFolder = "{{currentNotePath}}";
		const field = control(tab.getSettingDefinitions(), "inlineTaskConvertFolder");
		expect(field.visible).toBeUndefined(); expect(field.control.disabled).toBeUndefined();
		expect(tab.getControlValue("inlineTaskConvertFolder")).toBe("{{currentNotePath}}");
		await tab.setControlValue("inlineTaskConvertFolder", "Tasks/{{currentNoteTitle}}");
		expect(plugin.settings.inlineTaskConvertFolder).toBe("Tasks/{{currentNoteTitle}}");
	});
});
