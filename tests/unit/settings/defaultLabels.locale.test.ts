import { observeTranslation } from "../../helpers/real-i18n";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { buildSettingsFromLoadedData, buildSettingsDataForSave } from "../../../src/settings/settingsPersistence";
import { configLabel } from "../../../src/i18n/configLabels";
import { createDefaultFieldConfig } from "../../../src/utils/fieldConfigDefaults";

afterEach(() => observeTranslation("en"));

it.each(["it", "de", "ru"])("keeps writable English seeds, display translations and saved user labels separate in %s", locale => {
  const baseline = JSON.stringify(DEFAULT_SETTINGS);
  observeTranslation(locale);
  const { settings } = buildSettingsFromLoadedData(null);
  const status = settings.customStatuses.find(value => value.value === "open")!;
  const priority = settings.customPriorities.find(value => value.value === "high")!;
  expect(status.label).toBe("Open");
  expect(priority.label).toBe("High");
  expect(configLabel(status)).not.toBe("Open");
  expect(configLabel(priority)).not.toBe("High");
  expect(Object.getOwnPropertyDescriptor(status, "label")?.writable).toBe(true);
  status.label = "My status";
  priority.label = "My priority";
  settings.modalFieldsConfig.fields[0].displayName = "My field";
  settings.modalFieldsConfig.groups[0].displayName = "My group";
  const saved = JSON.parse(JSON.stringify(buildSettingsDataForSave({}, settings)));
  observeTranslation("en");
  const reloaded = buildSettingsFromLoadedData(saved).settings;
  expect(reloaded.customStatuses.find(value => value.value === "open")?.label).toBe("My status");
  expect(reloaded.customPriorities.find(value => value.value === "high")?.label).toBe("My priority");
  expect(configLabel(status)).toBe("My status");
  expect(configLabel(priority)).toBe("My priority");
  expect(reloaded.modalFieldsConfig.fields[0].displayName).toBe("My field");
  expect(reloaded.modalFieldsConfig.groups[0].displayName).toBe("My group");
  expect(JSON.stringify(DEFAULT_SETTINGS)).toBe(baseline);
  expect(createDefaultFieldConfig().fields[0].displayName).toBe("Title");
});

it("never retranslates already-customized or localized settings, or aliases another settings load", () => {
  const { settings } = buildSettingsFromLoadedData(null);
  settings.customStatuses[1].label = "Already localized label";
  const loaded = buildSettingsFromLoadedData({ customStatuses: settings.customStatuses }).settings;
  observeTranslation("ru");
  expect(configLabel(loaded.customStatuses[1])).toBe("Already localized label");
  loaded.customStatuses[1].label = "Another edit";
  expect(settings.customStatuses[1].label).toBe("Already localized label");
});
