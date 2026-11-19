import { settingsFixture } from "../../helpers/native-settings";

describe("native NLP trigger normalization", () => {
	test("saves and displays a trigger without surrounding whitespace", async () => {
		const { plugin, tab } = settingsFixture();
		tab.getSettingDefinitions();
		await tab.setControlValue("nlp.projects.trigger", " + ");
		expect(plugin.settings.nlpTriggers.triggers.find((trigger) => trigger.propertyId === "projects")?.trigger).toBe("+");
		expect(tab.getControlValue("nlp.projects.trigger")).toBe("+");
		expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
	});

	test("validates the trimmed length before saving", async () => {
		const { plugin, tab } = settingsFixture();
		tab.getSettingDefinitions();
		await tab.setControlValue("nlp.projects.trigger", "  abcdefghij  ");
		expect(plugin.settings.nlpTriggers.triggers.find((trigger) => trigger.propertyId === "projects")?.trigger).toBe("abcdefghij");
	});

	test("rejects whitespace-only and overlong triggers without changing settings", async () => {
		const { plugin, tab } = settingsFixture();
		tab.getSettingDefinitions();
		await expect(tab.setControlValue("nlp.projects.trigger", "   ")).rejects.toThrow("Trigger cannot be empty");
		await expect(tab.setControlValue("nlp.projects.trigger", "  abcdefghijk  ")).rejects.toThrow("Trigger is too long");
		expect(plugin.settings.nlpTriggers.triggers.find((trigger) => trigger.propertyId === "projects")?.trigger).toBe("+");
		expect(plugin.saveSettings).not.toHaveBeenCalled();
	});
});
