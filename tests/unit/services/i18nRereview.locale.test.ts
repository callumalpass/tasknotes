import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { App, TFile } from "obsidian";
import { observeTranslation } from "../../helpers/real-i18n";
import { buildSettingsFromLoadedData } from "../../../src/settings/settingsPersistence";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";
import { NaturalLanguageParser } from "../../../src/services/NaturalLanguageParser";
import { createNLPCompletionSource } from "../../../src/editor/NLPCodeMirrorAutocomplete";
import { configLabel } from "../../../src/i18n/configLabels";
import { fieldLabel, fieldGroupLabel } from "../../../src/i18n/fieldLabels";
import { reminderDescriptionLabel, calendarNameLabel } from "../../../src/i18n/dataSeedLabels";
import { StatusManager } from "../../../src/services/StatusManager";
import { PriorityManager } from "../../../src/services/PriorityManager";
import { CalendarExportService } from "../../../src/services/CalendarExportService";
import { TaskCalendarSyncService } from "../../../src/services/TaskCalendarSyncService";
import { InstantTaskConvertService } from "../../../src/services/InstantTaskConvertService";
import { groupFilterTasks, sortFilterTaskGroups, filterTaskGroupLabel, type FilterTaskGroupingContext } from "../../../src/services/filter-service/filterTaskGrouping";
import { extractTaskInfo } from "../../../src/utils/helpers";
import { buildTaskInfoFromMappedTask } from "../../../src/utils/taskInfoAssembly";
import { applyTaskUpdateFrontmatterChange } from "../../../src/services/task-service/taskUpdatePlanning";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { buildTaskCreationDataFromCli } from "../../../src/services/buildTaskCreationDataFromCli";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";

const task = (overrides: Partial<TaskInfo> = {}): TaskInfo => ({ title: "User title", path: "Tasks/User.md", status: "open", priority: "high", archived: false, ...overrides });
afterEach(() => observeTranslation("en"));

describe.each(["en", "de", "ru"])("re-review data/display boundaries in %s", locale => {
  beforeEach(() => observeTranslation(locale));
  it("restores all fourteen field/group labels without mutating or relabelling customized data", () => {
    const config = buildSettingsFromLoadedData(null).settings.modalFieldsConfig;
    const before = JSON.stringify(config);
    const labels = [...config.groups.map(fieldGroupLabel), ...config.fields.map(fieldLabel)];
    expect(labels).toHaveLength(14);
    expect(labels.every(label => label.length > 0)).toBe(true);
    if (locale === "de") expect(labels).toEqual(["Grundlegende Informationen", "Metadaten", "Organisation", "Abhängigkeiten", "Benutzerdefinierte Felder", "Titel", "Details", "Kontexte", "Tags", "Zeitschätzung", "Projekte", "Unteraufgaben", "Blockiert durch", "Blockiert"]);
    for (const field of config.fields) {
      expect(fieldLabel({ ...field, displayName: "My label" })).toBe("My label");
      expect(fieldLabel({ ...field, fieldType: "user" })).toBe(field.displayName);
    }
    for (const group of config.groups) expect(fieldGroupLabel({ ...group, displayName: "My group" })).toBe("My group");
    expect(JSON.stringify(config)).toBe(before);
  });
  it("keeps new status/priority/reminder/calendar seeds English and localizes only unchanged displays", () => {
    const status = StatusManager.createDefaultStatus([]);
    const priority = PriorityManager.createDefaultPriority([]);
    expect(status.label).toBe("New status");
    expect(priority.label).toBe("New priority");
    if (locale !== "en") {
      expect(configLabel(status)).not.toBe(status.label);
      expect(configLabel(priority)).not.toBe(priority.label);
      expect(reminderDescriptionLabel("Reminder")).not.toBe("Reminder");
      expect(calendarNameLabel("New calendar")).not.toBe("New calendar");
    }
    expect(configLabel({ ...status, label: "My status" })).toBe("My status");
    expect(reminderDescriptionLabel("My reminder")).toBe("My reminder");
    expect(calendarNameLabel("My calendar")).toBe("My calendar");
    const settings = buildSettingsFromLoadedData(null).settings;
    const result = buildTaskCreationDataFromCli({ settings } as TaskNotesPlugin, { title: "Task", reminders: "due:-PT1H;at:2026-10-24T09:00" });
    expect(result.taskData.reminders?.map(reminder => reminder.description)).toEqual(["Reminder", "Reminder"]);
  });
  it("localizes NLP suggestions and accepts translated shortcuts without changing stored values", async () => {
    const settings = buildSettingsFromLoadedData(null).settings;
    settings.nlpTriggers.triggers = settings.nlpTriggers.triggers.map(trigger => trigger.propertyId === "status" ? { ...trigger, trigger: "/", enabled: true } : trigger.propertyId === "priority" ? { ...trigger, enabled: true } : trigger);
    const plugin = { settings } as TaskNotesPlugin;
    const parser = NaturalLanguageParser.fromPlugin(plugin);
    const status = settings.customStatuses.find(config => config.value === "open")!;
    const priority = settings.customPriorities.find(config => config.value === "high")!;
    const before = JSON.stringify(settings);
    for (const [text, value, label] of [[`/${configLabel(status)}`, "open", configLabel(status)], [`!${configLabel(priority)}`, "high", configLabel(priority)]]) {
      const state = EditorState.create({ doc: text });
      const result = await createNLPCompletionSource(plugin)(new CompletionContext(state, text.length, true));
      expect(result?.options).toEqual(expect.arrayContaining([expect.objectContaining({ label, apply: value + " " })]));
      const parsed = parser.parseInput("Task " + text);
      expect(parsed.title).toBe("Task");
      expect(value === "open" ? parsed.status : parsed.priority).toBe(value);
    }
    // A parser constructed before a language-pack switch must accept the new labels too.
    observeTranslation(locale === "de" ? "ru" : "de");
    expect(parser.parseInput(`Task /${configLabel(status)} !${configLabel(priority)}`)).toMatchObject({ title: "Task", status: "open", priority: "high" });
    expect(JSON.stringify(settings)).toBe(before);
  });
  it("keeps completed-date ordering and serialized HTTP/MCP group keys stable", () => {
    const translate = observeTranslation(locale);
    const context: FilterTaskGroupingContext = {
      userFields: [], isCompletedStatus: status => status === "done", getPriorityWeight: () => 0, getStatusOrder: () => 0,
      getUserFieldRawValue: () => undefined, resolveProjectToAbsolutePath: value => value,
      translate: (descriptor, _fallback, values) => translate(descriptor, values), getLocale: () => locale,
    };
    const tasks = [task({ path: "none.md" }), task({ path: "old.md", completedDate: "2026-10-20" }), task({ path: "bad.md", completedDate: "invalid" }), task({ path: "new.md", completedDate: "2026-10-23" })];
    const groups = groupFilterTasks(tasks, "completedDate", context);
    expect([...groups.keys()]).toEqual(["2026-10-23", "2026-10-20", "Invalid date", "Not completed"]);
    expect([...sortFilterTaskGroups(groups, "completedDate", context).keys()]).toEqual([...groups.keys()]);
    expect(Object.keys(JSON.parse(JSON.stringify(Object.fromEntries(groups))))).toEqual([...groups.keys()]);
    if (locale !== "en") expect(filterTaskGroupLabel("Not completed", "completedDate", context)).not.toBe("Not completed");
    expect([...groupFilterTasks([task()], "project", context).keys()]).toEqual(["No project"]);
    expect(filterTaskGroupLabel("Today", "project", context)).toBe("Today"); // user project, not a date label
  });
  it("uses the same missing-title display in cache and cache-miss builders and never saves it through an unrelated patch", () => {
    const app = new App();
    const frontmatter: Record<string, unknown> = { status: "open", tags: ["task"] };
    jest.spyOn(app.metadataCache, "getFileCache").mockReturnValue({ frontmatter });
    const mapper = new FieldMapper(DEFAULT_FIELD_MAPPING);
    const file = new TFile();
    file.path = "Tasks/User.md";
    const cached = buildTaskInfoFromMappedTask({ path: file.path, mappedTask: {}, defaultTaskStatus: "open", isBlocked: false, blockingTasks: [] });
    // Both fallback branches must handle a mapper yielding no usable title.
    const readMapping = jest.spyOn(FieldMapper.prototype, "mapFromFrontmatter").mockReturnValue({});
    try {
      for (const fieldMapper of [mapper, undefined]) expect(extractTaskInfo(app, "", file.path, file, fieldMapper, false)?.title).toBe(cached.title);
    } finally { readMapping.mockRestore(); }
    expect(cached.title).not.toBe("");
    applyTaskUpdateFrontmatterChange({ frontmatter, originalTask: cached, updates: { priority: "low" }, recurrenceUpdates: {}, dateModified: "2026-10-24T12:00:00Z", fieldMapper: mapper, taskIdentification: { method: "tag", tag: "task", propertyName: "", propertyValue: "" }, storeTitleInFilename: false, updateCompletedDateInFrontmatter: () => {} });
    expect(frontmatter).not.toHaveProperty("title");
    expect(frontmatter.priority).toBe("low");
  });
  it("restores the pre-port metadata-only instant-conversion fallback", () => {
    const settings = buildSettingsFromLoadedData(null).settings;
    const service = Object.assign(Object.create(InstantTaskConvertService.prototype), { plugin: { settings }, nlParser: NaturalLanguageParser.fromPlugin({ settings } as TaskNotesPlugin) });
    expect(service.tryNLPFallback("- [ ] !high", "")).toMatchObject({ title: "Untitled Task", priority: "high" });
    expect(service.tryNLPFallback("- [ ] User title !high", "")).toMatchObject({ title: "User title", priority: "high" });
    expect(service.tryNLPFallback("- [ ] ", "")).toBeNull();
  });
  it("exports the exact pre-port English ICS description, including the one-minute spelling", () => {
    const data = task({ projects: ["My project"], contexts: ["My context"], tags: ["My tag"], timeEstimate: 1 });
    const expected = ["Priority: high", "Status: open", "Projects: My project", "Tags: My tag", "Contexts: My context", "Estimated time: 1 minutes", "", "Exported from TaskNotes: Tasks/User.md"].join("\\n");
    expect(CalendarExportService.generateICSContent(data)).toContain("DESCRIPTION:" + expected);
  });
  it("keeps Google Calendar persisted metadata English and preserves custom configured labels", () => {
    const settings = buildSettingsFromLoadedData(null).settings;
    settings.googleCalendarExport.includeObsidianLink = false;
    settings.googleCalendarExport.eventTitleTemplate = "{{title}}";
    const statusManager = new StatusManager(settings.customStatuses);
    const priorityManager = new PriorityManager(settings.customPriorities);
    const service = Object.assign(Object.create(TaskCalendarSyncService.prototype), { plugin: { settings, statusManager, priorityManager } });
    expect(service.buildEventDescription(task({ timeEstimate: 90 }))).toBe("Priority: High\nStatus: Open\nTime Estimate: 1h 30m");
    expect(service.applyTitleTemplate(task({ title: "" }))).toBe("Untitled task");
    settings.customStatuses.find(config => config.value === "open")!.label = "My status";
    statusManager.updateStatuses(settings.customStatuses);
    expect(service.buildEventDescription(task())).toContain("Status: My status");
  });
});
