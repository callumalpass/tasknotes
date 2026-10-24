import { observeTranslation } from "../../helpers/real-i18n";
import { NaturalLanguageParser } from "../../../src/services/NaturalLanguageParser";
import { buildTaskCreationDataFromCli } from "../../../src/services/buildTaskCreationDataFromCli";
import { buildSettingsFromLoadedData } from "../../../src/settings/settingsPersistence";
import type TaskNotesPlugin from "../../../src/main";

afterEach(() => observeTranslation("en"));
it.each(["en", "de", "ru"])("rejects trigger-only input without creating a translated sentinel in %s", locale => {
  observeTranslation(locale);
  const settings = buildSettingsFromLoadedData(null).settings;
  settings.nlpTriggers = { ...settings.nlpTriggers, triggers: [
    ...settings.nlpTriggers.triggers.filter(trigger => trigger.propertyId !== "status"),
    { propertyId: "status", trigger: "/", enabled: true },
  ] };
  const plugin = { settings } as TaskNotesPlugin;
  const parser = NaturalLanguageParser.fromPlugin(plugin);
  for (const text of ["", "/open", "!high"]) {
    expect(parser.parseInput(text).title).toBe("");
    if (text) expect(() => buildTaskCreationDataFromCli(plugin, { text })).toThrow("Could not derive a task title");
  }
  expect(parser.parseInput("Actual title /open").title).toBe("Actual title");
  expect(parser.parseInput("Actual title !high").title).toBe("Actual title");
});
