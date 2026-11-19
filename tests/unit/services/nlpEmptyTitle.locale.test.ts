import { observeTranslation } from "../../helpers/real-i18n";
import { NaturalLanguageParser, hasMissingNlpTitle } from "../../../src/services/NaturalLanguageParser";
import { buildTaskCreationDataFromCli } from "../../../src/services/buildTaskCreationDataFromCli";
import { buildSettingsFromLoadedData } from "../../../src/settings/settingsPersistence";
import type TaskNotesPlugin from "../../../src/main";

afterEach(() => observeTranslation("en"));
it.each(["en", "it", "de", "ru"])("preserves the pre-port programmatic fallback and rejects only interactive/CLI missing titles in %s", locale => {
  observeTranslation(locale);
  const settings = buildSettingsFromLoadedData(null).settings;
  settings.nlpTriggers = { ...settings.nlpTriggers, triggers: [
    ...settings.nlpTriggers.triggers.filter(trigger => trigger.propertyId !== "status"),
    { propertyId: "status", trigger: "/", enabled: true },
  ] };
  const plugin = { settings } as TaskNotesPlugin;
  const parser = NaturalLanguageParser.fromPlugin(plugin);
  for (const text of ["", "/open", "!high"]) {
    const parsed = parser.parseInput(text);
    expect(parsed.title).toBe("Untitled Task");
    expect(hasMissingNlpTitle(parsed)).toBe(true);
    expect(Object.keys(parsed)).not.toContain("missingTitle");
    expect(JSON.stringify(parsed)).not.toContain("empty-nlp-title");
    expect(parser.parseInputForModal(text).title).toBe("");
    if (text) expect(() => buildTaskCreationDataFromCli(plugin, { text })).toThrow("Could not derive a task title");
  }
  expect(parser.parseInputForModal("Actual title /open").title).toBe("Actual title");
  expect(parser.parseInput("Actual title /open").title).toBe("Actual title");
  expect(hasMissingNlpTitle(parser.parseInput("Actual title /open"))).toBe(false);
  expect(buildTaskCreationDataFromCli(plugin, { text: "/open", title: "Explicit title" }).taskData.title).toBe("Explicit title");
  expect(parser.parseInput("Actual title !high").title).toBe("Actual title");
});
