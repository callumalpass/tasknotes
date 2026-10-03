import fs from "fs";
import path from "path";
import YAML from "yaml";
import type TaskNotesPlugin from "../../../src/main";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { initializeCoreServices } from "../../../src/bootstrap/pluginBootstrap";
import { parseMdbaseTaskTypeDocument } from "../../../src/services/mdbaseCanonicalConfig";
import { recognitionVault } from "../../helpers/mdbaseRecognitionVault";

// Runtime services unrelated to collection migration are inert. The REAL
// initializeCoreServices, FieldMapper, settings import and MdbaseSpecService run.
jest.mock("../../../src/api/TaskNotesAPI");
jest.mock("../../../src/utils/TaskManager", () => ({
	TaskManager: jest.fn().mockImplementation(() => ({
		on: jest.fn(), trigger: jest.fn(), setDependencyCache: jest.fn(),
	})),
}));
jest.mock("../../../src/utils/DependencyCache");
jest.mock("../../../src/services/TaskService");
jest.mock("../../../src/services/FilterService");
jest.mock("../../../src/services/TaskStatsService");
jest.mock("../../../src/services/ViewStateManager");
jest.mock("../../../src/services/ProjectSubtasksService");
jest.mock("../../../src/services/ExpandedProjectsService");
jest.mock("../../../src/services/AutoArchiveService");
jest.mock("../../../src/services/TaskSelectionService");
jest.mock("../../../src/utils/DragDropManager");
jest.mock("../../../src/ui/StatusBarService");
jest.mock("../../../src/ui/NotificationService");
jest.mock("../../../src/services/ViewPerformanceService");
jest.mock("../../../src/services/BasesFilterConverter");
jest.mock("../../../src/services/ICSSubscriptionService");
jest.mock("../../../src/services/ICSNoteService");

it.each(["v4-custom", "beta0-custom"])("runs real bootstrap for %s without a pre-injected FieldMapper", async (name) => {
	const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, `../../fixtures/mdbase-upgrades/${name}.json`), "utf8"));
	const memory = recognitionVault(fixture.files);
	const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
	settings.enableMdbaseSpec = true;
	if (name.startsWith("v4")) {
		settings.fieldMapping.due = "deadline";
		settings.customStatuses.push({ id: "cancelled", value: "cancelled", label: "Cancelled", color: "#808080", order: 4, isCompleted: false, isSkipped: true, excludeFromCycle: true, autoArchive: false, autoArchiveDelay: 5 });
		settings.userFields = [{ id: "effort", displayName: "Effort", key: "effort", type: "number" }];
		settings.taskFilenameFormat = "zettel";
		settings.storeTitleInFilename = false;
	}
	const plugin = { settings, app: { vault: memory.vault }, registerEvent: jest.fn() } as unknown as TaskNotesPlugin;
	expect(plugin.fieldMapper).toBeUndefined();
	await initializeCoreServices(plugin);
	expect(YAML.parse(memory.files.get("mdbase.yaml")!).spec_version).toBe("0.3.0");
	expect(plugin.fieldMapper.toUserField("due")).toBe("deadline");
	expect(plugin.settings.fieldMapping.due).toBe("deadline");
	expect(parseMdbaseTaskTypeDocument(memory.files.get("_types/task.md")!).type.implements).toEqual(expect.arrayContaining([expect.objectContaining({ contract: "tasknotes.task", version: "0.3.0-rc.5" })]));
	expect(plugin.emitter.trigger).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ message: expect.stringContaining("could not initialize") }));
	for (const file of ["TaskNotes/Tasks/open.md", "TaskNotes/Tasks/cancelled.md", "paper.md"]) {
		expect(memory.files.get(file)).toBe(fixture.files[file]);
	}
});

it("MATRIX-R03: real historical bootstrap retains all five user fields before rebuilding FieldMapper", async () => {
	const root = path.join(__dirname, "../../fixtures/mdbase-upgrades/scope-userfields");
	const entries: Record<string, string> = {};
	const walk = (folder: string, prefix = "") => {
		for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
			if (entry.isDirectory()) walk(path.join(folder, entry.name), `${prefix}${entry.name}/`);
			else if (entry.name !== "README.md" && entry.name !== "settings.json") entries[prefix + entry.name] = fs.readFileSync(path.join(folder, entry.name), "utf8");
		}
	};
	walk(root);
	const settings = JSON.parse(fs.readFileSync(path.join(root, "settings.json"), "utf8"));
	const fields = settings.userFields.map(({ filterDisplay: _unsupported, ...field }: any) => field);
	settings.enableMdbaseSpec = true;
	const memory = recognitionVault(entries);
	const plugin = { settings, app: { vault: memory.vault }, registerEvent: jest.fn() } as unknown as TaskNotesPlugin;
	expect(plugin.fieldMapper).toBeUndefined();
	await initializeCoreServices(plugin);
	expect(plugin.settings.userFields).toEqual(fields);
	plugin.settings.customPriorities[0].label = "Unrelated settings change";
	await plugin.mdbaseSpecService.onSettingsChanged();
	const type: any = parseMdbaseTaskTypeDocument(memory.files.get("_types/task.md")!).type;
	for (const field of fields) expect(type.schema.value.properties[field.key]).toBeDefined();
	expect(plugin.emitter.trigger).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ message: expect.stringContaining("could not initialize") }));
	for (const [file, content] of Object.entries(entries)) if (!file.startsWith("_") && file.endsWith(".md")) expect(memory.files.get(file)).toBe(content);
});
