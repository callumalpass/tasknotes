jest.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => ({ StreamableHTTPServerTransport: jest.fn() }));
import { MCPService } from "../../../src/services/MCPService";
import { NaturalLanguageParser } from "../../../src/services/NaturalLanguageParser";
import { groupFilterTasks, type FilterTaskGroupingContext } from "../../../src/services/filter-service/filterTaskGrouping";
import { buildSettingsFromLoadedData } from "../../../src/settings/settingsPersistence";
import { observeTranslation } from "../../helpers/real-i18n";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";

afterEach(() => observeTranslation("en"));
it.each(["en", "de"])("preserves MCP missing-title creation and English group JSON keys in %s", async locale => {
  const translate = observeTranslation(locale);
  const settings = buildSettingsFromLoadedData(null).settings;
  const plugin = { settings } as TaskNotesPlugin;
  const context: FilterTaskGroupingContext = { userFields: [], isCompletedStatus: () => false, getPriorityWeight: () => 0, getStatusOrder: () => 0, getUserFieldRawValue: () => undefined, resolveProjectToAbsolutePath: value => value, translate: (descriptor, _fallback, values) => translate(descriptor, values), getLocale: () => locale };
  const tasks: TaskInfo[] = [{ title: "User title", path: "User.md", status: "open", priority: "normal", archived: false }];
  const createTask = jest.fn(async data => {
    // The task-service boundary must still receive the pre-port nonempty fallback.
    if (!data.title) throw new Error("Title is required");
    return { taskInfo: { ...data, path: "Untitled Task.md" } };
  });
  const service = new MCPService(plugin, { createTask } as never, { getGroupedTasksStrict: async () => groupFilterTasks(tasks, "completedDate", context) } as never, {} as never, {} as never, NaturalLanguageParser.fromPlugin(plugin), {} as never);
  const internal = service as any;
  const tools = new Map<string, (args: any) => Promise<any>>();
  internal.getToolRegistrar = () => (name: string, _config: unknown, callback: (args: any) => Promise<any>) => tools.set(name, callback);
  internal.registerTaskTools({});
  internal.registerFilterTools({});
  const created = await tools.get("tasknotes_create_task_from_text")!({ text: "!high" });
  expect(created.isError).not.toBe(true);
  const payload = JSON.parse(created.content[0].text);
  expect(payload.parsed.title).toBe("Untitled Task");
  expect(payload.task.title).toBe("Untitled Task");
  expect(payload.parsed).not.toHaveProperty("missingTitle");
  expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ title: "Untitled Task", priority: "high" }));
  const grouped = await tools.get("tasknotes_query_tasks")!({ conjunction: "and", children: [], groupKey: "completedDate" });
  expect(grouped.isError).not.toBe(true);
  const groups = JSON.parse(grouped.content[0].text);
  expect(groups).toHaveProperty("Not completed");
  expect(Object.keys(groups)).toEqual(["Not completed"]);
});
