import { msg } from "@lingui/core/macro";
import { configLabel } from "../../../src/i18n/configLabels";
import { observeTranslation } from "../../helpers/real-i18n";
import { settingsFixture, control, flattenSettings } from "../../helpers/native-settings";

const locales = ["en", "fr", "de", "es", "it", "ja", "ko", "pt", "ru", "zh"];

describe.each(locales)("native settings data boundaries in %s", locale => {
	it("keeps semantic single and multiple Bases groups distinct, including Russian 21", () => {
		const translate = observeTranslation(locale);
		const classifiers = [
			msg({ message: "{count, plural, =0 {No contexts} =1 {Single context} other {Multiple contexts}}", context: "generated Bases contexts count" }),
			msg({ message: "{count, plural, =0 {No projects} =1 {Single project} other {Multiple projects}}", context: "generated Bases projects count" }),
		];
		for (const descriptor of classifiers) {
			const show = (count: number) => translate(descriptor, { count });
			expect(show(0)).not.toBe(show(1));
			expect(show(1)).not.toBe(show(2));
			for (const count of [2, 5, 21]) expect(show(count)).toBe(show(2));
		}
	});

	it("localizes seed display labels without rewriting editable identifiers, icons or template paths", () => {
		const { plugin, tab } = settingsFixture();
		plugin.i18n.setLocale(locale);
		const settings = plugin.settings;
		settings.taskCreationDefaults.useBodyTemplate = true;
		settings.taskCreationDefaults.bodyTemplate = "Existing Vault/Task Template.md";
		settings.taskCreationDefaults.useOccurrenceBodyTemplate = true;
		settings.taskCreationDefaults.occurrenceBodyTemplate = "Existing Vault/Occurrence Template.md";
		settings.customStatuses[0].icon = "check-circle";
		settings.customPriorities[0].icon = "alert-circle";
		const before = JSON.stringify(settings);
		const definitions = tab.getSettingDefinitions();
		const names = flattenSettings(definitions).flatMap(item => "name" in item ? [item.name] : []);
		for (const [kind, values] of [["status", settings.customStatuses], ["priority", settings.customPriorities]] as const) {
			for (const value of values) {
				expect(tab.getControlValue(`${kind}.${value.id}.value`)).toBe(value.value);
				expect(tab.getControlValue(`${kind}.${value.id}.label`)).toBe(value.label);
				expect(tab.getControlValue(`${kind}.${value.id}.icon`)).toBe(value.icon ?? "");
				expect(names).toContain(configLabel(value));
			}
		}
		for (const [key, placeholder, value] of [
			["taskCreationDefaults.bodyTemplate", "Templates/Task Template.md", settings.taskCreationDefaults.bodyTemplate],
			["taskCreationDefaults.occurrenceBodyTemplate", "Templates/Occurrence Template.md", settings.taskCreationDefaults.occurrenceBodyTemplate],
		]) {
			expect(tab.getControlValue(key)).toBe(value);
			expect(control(definitions, key).control.placeholder).toBe(placeholder);
		}
		expect(JSON.stringify(settings)).toBe(before);
		expect(plugin.saveSettings).not.toHaveBeenCalled();
	});
});
