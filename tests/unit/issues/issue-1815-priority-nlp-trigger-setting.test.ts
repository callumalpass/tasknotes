import { settingsFixture, control } from "../../helpers/native-settings";

describe("Issue #1815: Priority NLP trigger character setting", () => {
	it("shows and saves the priority trigger even when priority NLP is disabled", async () => {
		const { plugin, tab } = settingsFixture();
		const field = control(tab.getSettingDefinitions(), "nlp.priority.trigger");
		expect(field.control.disabled).toBeUndefined();
		expect(tab.getControlValue("nlp.priority.trigger")).toBe("!");
		await tab.setControlValue("nlp.priority.trigger", "!!");
		expect(plugin.settings.nlpTriggers.triggers.find(trigger => trigger.propertyId === "priority")).toMatchObject({ propertyId: "priority", trigger: "!!", enabled: false });
		expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
	});
});
