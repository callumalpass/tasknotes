/**
 * Unit tests for MdbaseSpecService
 *
 * Validates that generated mdbase.yaml and _types/task.md conform to
 * mdbase-spec v0.2.0 structural requirements.
 */

import { MdbaseSpecService } from "../../../src/services/MdbaseSpecService";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING, DEFAULT_STATUSES, DEFAULT_PRIORITIES } from "../../../src/settings/defaults";
import { FieldMapping } from "../../../src/types";

/** Extract the YAML frontmatter string (between --- delimiters) from markdown */
function extractFrontmatter(markdown: string): string {
	const match = markdown.match(/^---\n([\s\S]*?)\n---/);
	return match ? match[1] : "";
}

/** Extract the markdown body (after the closing ---) */
function extractBody(markdown: string): string {
	const match = markdown.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
	return match ? match[1] : "";
}

/** Parse a simple YAML key at root level (returns raw string value) */
function getYamlValue(yaml: string, key: string): string | undefined {
	const re = new RegExp(`^${key}:\\s*(.+)$`, "m");
	const match = yaml.match(re);
	return match ? match[1].trim() : undefined;
}

/** Get all lines under a YAML key that are indented (simple block) */
function getYamlBlock(yaml: string, key: string): string[] {
	const lines = yaml.split("\n");
	const startIdx = lines.findIndex((l) => l.match(new RegExp(`^${key}:`)));
	if (startIdx === -1) return [];
	const result: string[] = [];
	for (let i = startIdx + 1; i < lines.length; i++) {
		if (lines[i].match(/^\s+/)) {
			result.push(lines[i]);
		} else {
			break;
		}
	}
	return result;
}

/** Extract the inline object value for a field under `fields:` */
function getFieldDef(yaml: string, fieldName: string): string | undefined {
	const re = new RegExp(`^  ${fieldName}:\\s*(.+)$`, "m");
	const match = yaml.match(re);
	return match ? match[1].trim() : undefined;
}

function createMockPlugin(overrides: Record<string, any> = {}): any {
	const settings = {
		enableMdbaseSpec: true,
		tasksFolder: "TaskNotes/Tasks",
		fieldMapping: { ...DEFAULT_FIELD_MAPPING },
		customStatuses: [...DEFAULT_STATUSES],
		customPriorities: [...DEFAULT_PRIORITIES],
		defaultTaskStatus: "open",
		defaultTaskPriority: "normal",
		userFields: [],
		...overrides,
	};

	return {
		settings,
		fieldMapper: new FieldMapper(settings.fieldMapping),
		app: {
			vault: {
				adapter: {
					exists: jest.fn().mockResolvedValue(false),
					write: jest.fn().mockResolvedValue(undefined),
				},
				create: jest.fn().mockResolvedValue({}),
				createFolder: jest.fn().mockResolvedValue(undefined),
			},
		},
	};
}

describe("MdbaseSpecService", () => {
	describe("buildMdbaseYaml", () => {
		it("should include spec_version 0.2.0", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const yaml = service.buildMdbaseYaml();

			expect(yaml).toContain('spec_version: "0.2.0"');
		});

		it("should include name and description", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const yaml = service.buildMdbaseYaml();

			expect(yaml).toContain('name: "TaskNotes"');
			expect(yaml).toContain('description: "Task collection managed by TaskNotes for Obsidian"');
		});

		it("should set types_folder to _types", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const yaml = service.buildMdbaseYaml();

			expect(yaml).toContain('types_folder: "_types"');
		});

		it("should set default_strict to false", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const yaml = service.buildMdbaseYaml();

			expect(yaml).toContain("default_strict: false");
		});

		it("should exclude the _types folder", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const yaml = service.buildMdbaseYaml();

			expect(yaml).toContain('- "_types"');
		});
	});

	describe("buildTaskTypeDef - frontmatter structure", () => {
		it("should have valid frontmatter delimiters", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const output = service.buildTaskTypeDef();

			expect(output).toMatch(/^---\n/);
			expect(output).toMatch(/\n---\n/);
		});

		it("should set name to task", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const fm = extractFrontmatter(service.buildTaskTypeDef());

			expect(getYamlValue(fm, "name")).toBe("task");
		});

		it("should set strict to false", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const fm = extractFrontmatter(service.buildTaskTypeDef());

			expect(getYamlValue(fm, "strict")).toBe("false");
		});

		it("should include description", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const fm = extractFrontmatter(service.buildTaskTypeDef());

			expect(fm).toContain("description:");
		});

		it("should set display_name_key to the mapped title field", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const fm = extractFrontmatter(service.buildTaskTypeDef());

			expect(getYamlValue(fm, "display_name_key")).toBe('"title"');
		});

		it("should use custom display_name_key when title field is remapped", () => {
			const service = new MdbaseSpecService(
				createMockPlugin({
					fieldMapping: { ...DEFAULT_FIELD_MAPPING, title: "name" },
				})
			);
			const fm = extractFrontmatter(service.buildTaskTypeDef());

			expect(getYamlValue(fm, "display_name_key")).toBe('"name"');
		});
	});

	describe("buildTaskTypeDef - match section", () => {
		it("should include path_glob with tasks folder", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const fm = extractFrontmatter(service.buildTaskTypeDef());

			expect(fm).toContain('path_glob: "TaskNotes/Tasks/**/*.md"');
		});

		it("should reflect custom tasks folder in path_glob", () => {
			const service = new MdbaseSpecService(
				createMockPlugin({ tasksFolder: "my/custom/tasks" })
			);
			const fm = extractFrontmatter(service.buildTaskTypeDef());

			expect(fm).toContain('path_glob: "my/custom/tasks/**/*.md"');
		});
	});

	describe("buildTaskTypeDef - core fields", () => {
		let fm: string;

		beforeEach(() => {
			const service = new MdbaseSpecService(createMockPlugin());
			fm = extractFrontmatter(service.buildTaskTypeDef());
		});

		it("should define title as required string", () => {
			const def = getFieldDef(fm, "title");
			expect(def).toContain("type: string");
			expect(def).toContain("required: true");
		});

		it("should define status as enum with default status values", () => {
			const def = getFieldDef(fm, "status");
			expect(def).toContain("type: enum");
			expect(def).toContain('"none"');
			expect(def).toContain('"open"');
			expect(def).toContain('"in-progress"');
			expect(def).toContain('"done"');
			expect(def).toContain('default: "open"');
		});

		it("should define priority as enum with default priority values", () => {
			const def = getFieldDef(fm, "priority");
			expect(def).toContain("type: enum");
			expect(def).toContain('"none"');
			expect(def).toContain('"low"');
			expect(def).toContain('"normal"');
			expect(def).toContain('"high"');
			expect(def).toContain('default: "normal"');
		});

		it("should define due as date", () => {
			const def = getFieldDef(fm, "due");
			expect(def).toContain("type: date");
		});

		it("should define scheduled as date", () => {
			const def = getFieldDef(fm, "scheduled");
			expect(def).toContain("type: date");
		});

		it("should define contexts as list of strings", () => {
			const def = getFieldDef(fm, "contexts");
			expect(def).toContain("type: list");
			expect(def).toContain("items: { type: string }");
		});

		it("should define projects as list of links", () => {
			const def = getFieldDef(fm, "projects");
			expect(def).toContain("type: list");
			expect(def).toContain("items: { type: link }");
		});

		it("should define timeEstimate as integer with min 0", () => {
			const def = getFieldDef(fm, "timeEstimate");
			expect(def).toContain("type: integer");
			expect(def).toContain("min: 0");
		});

		it("should define completedDate as date", () => {
			const def = getFieldDef(fm, "completedDate");
			expect(def).toContain("type: date");
		});

		it("should define dateCreated as datetime", () => {
			const def = getFieldDef(fm, "dateCreated");
			expect(def).toContain("type: datetime");
		});

		it("should define dateModified as datetime", () => {
			const def = getFieldDef(fm, "dateModified");
			expect(def).toContain("type: datetime");
		});

		it("should define recurrence as string", () => {
			const def = getFieldDef(fm, "recurrence");
			expect(def).toContain("type: string");
		});

		it("should define recurrence_anchor as enum", () => {
			const def = getFieldDef(fm, "recurrence_anchor");
			expect(def).toContain("type: enum");
			expect(def).toContain('"scheduled"');
			expect(def).toContain('"completion"');
			expect(def).toContain('default: "scheduled"');
		});

		it("should define tags as list of strings", () => {
			const def = getFieldDef(fm, "tags");
			expect(def).toContain("type: list");
			expect(def).toContain("items: { type: string }");
		});

		it("should define googleCalendarEventId as string", () => {
			const def = getFieldDef(fm, "googleCalendarEventId");
			expect(def).toContain("type: string");
		});
	});

	describe("buildTaskTypeDef - complex nested fields", () => {
		let fm: string;

		beforeEach(() => {
			const service = new MdbaseSpecService(createMockPlugin());
			fm = extractFrontmatter(service.buildTaskTypeDef());
		});

		it("should define timeEntries as list of objects", () => {
			const def = getFieldDef(fm, "timeEntries");
			expect(def).toContain("type: list");
			expect(def).toContain("type: object");
			expect(def).toContain("startTime:");
			expect(def).toContain("endTime:");
			expect(def).toContain("description:");
			expect(def).toContain("duration:");
		});

		it("should define reminders as list of objects", () => {
			const def = getFieldDef(fm, "reminders");
			expect(def).toContain("type: list");
			expect(def).toContain("type: object");
			expect(def).toContain("id:");
			expect(def).toContain("relatedTo:");
			expect(def).toContain("offset:");
		});

		it("should define blockedBy as list of objects", () => {
			const def = getFieldDef(fm, "blockedBy");
			expect(def).toContain("type: list");
			expect(def).toContain("type: object");
			expect(def).toContain("uid:");
			expect(def).toContain("reltype:");
			expect(def).toContain("gap:");
		});

		it("should define complete_instances as list of dates", () => {
			const def = getFieldDef(fm, "complete_instances");
			expect(def).toContain("type: list");
			expect(def).toContain("items: { type: date }");
		});

		it("should define skipped_instances as list of dates", () => {
			const def = getFieldDef(fm, "skipped_instances");
			expect(def).toContain("type: list");
			expect(def).toContain("items: { type: date }");
		});

		it("should define icsEventId as list of strings", () => {
			const def = getFieldDef(fm, "icsEventId");
			expect(def).toContain("type: list");
			expect(def).toContain("items: { type: string }");
		});
	});

	describe("buildTaskTypeDef - custom field mapping", () => {
		it("should use mapped field names for all core fields", () => {
			const customMapping: FieldMapping = {
				...DEFAULT_FIELD_MAPPING,
				status: "task_status",
				priority: "task_priority",
				due: "due_date",
				scheduled: "scheduled_date",
				contexts: "areas",
				projects: "related_projects",
			};

			const service = new MdbaseSpecService(
				createMockPlugin({ fieldMapping: customMapping })
			);
			const fm = extractFrontmatter(service.buildTaskTypeDef());

			expect(getFieldDef(fm, "task_status")).toContain("type: enum");
			expect(getFieldDef(fm, "task_priority")).toContain("type: enum");
			expect(getFieldDef(fm, "due_date")).toContain("type: date");
			expect(getFieldDef(fm, "scheduled_date")).toContain("type: date");
			expect(getFieldDef(fm, "areas")).toContain("type: list");
			expect(getFieldDef(fm, "related_projects")).toContain("type: list");

			// Original names should not appear as field definitions
			expect(getFieldDef(fm, "status")).toBeUndefined();
			expect(getFieldDef(fm, "priority")).toBeUndefined();
		});
	});

	describe("buildTaskTypeDef - custom statuses and priorities", () => {
		it("should include custom status values in enum", () => {
			const service = new MdbaseSpecService(
				createMockPlugin({
					customStatuses: [
						{ id: "todo", value: "todo", label: "Todo", color: "#ccc", isCompleted: false, order: 0, autoArchive: false, autoArchiveDelay: 5 },
						{ id: "doing", value: "doing", label: "Doing", color: "#00f", isCompleted: false, order: 1, autoArchive: false, autoArchiveDelay: 5 },
						{ id: "finished", value: "finished", label: "Finished", color: "#0a0", isCompleted: true, order: 2, autoArchive: false, autoArchiveDelay: 5 },
					],
					defaultTaskStatus: "todo",
				})
			);
			const fm = extractFrontmatter(service.buildTaskTypeDef());
			const def = getFieldDef(fm, "status");

			expect(def).toContain('"todo"');
			expect(def).toContain('"doing"');
			expect(def).toContain('"finished"');
			expect(def).toContain('default: "todo"');
			// Default statuses should not appear
			expect(def).not.toContain('"in-progress"');
		});

		it("should include custom priority values in enum", () => {
			const service = new MdbaseSpecService(
				createMockPlugin({
					customPriorities: [
						{ id: "p1", value: "critical", label: "Critical", color: "#f00", weight: 3 },
						{ id: "p2", value: "important", label: "Important", color: "#fa0", weight: 2 },
						{ id: "p3", value: "nice", label: "Nice to have", color: "#0a0", weight: 1 },
					],
					defaultTaskPriority: "important",
				})
			);
			const fm = extractFrontmatter(service.buildTaskTypeDef());
			const def = getFieldDef(fm, "priority");

			expect(def).toContain('"critical"');
			expect(def).toContain('"important"');
			expect(def).toContain('"nice"');
			expect(def).toContain('default: "important"');
		});
	});

	describe("buildTaskTypeDef - user-defined fields", () => {
		it("should include user fields with correct type mapping", () => {
			const service = new MdbaseSpecService(
				createMockPlugin({
					userFields: [
						{ id: "effort", displayName: "Effort", key: "effort", type: "number" },
						{ id: "notes", displayName: "Notes", key: "extra_notes", type: "text" },
						{ id: "reviewed", displayName: "Reviewed", key: "reviewed", type: "boolean" },
						{ id: "review_date", displayName: "Review Date", key: "review_date", type: "date" },
						{ id: "labels", displayName: "Labels", key: "labels", type: "list" },
					],
				})
			);
			const fm = extractFrontmatter(service.buildTaskTypeDef());

			expect(getFieldDef(fm, "effort")).toContain("type: number");
			expect(getFieldDef(fm, "extra_notes")).toContain("type: string");
			expect(getFieldDef(fm, "reviewed")).toContain("type: boolean");
			expect(getFieldDef(fm, "review_date")).toContain("type: date");
			const labelsDef = getFieldDef(fm, "labels");
			expect(labelsDef).toContain("type: list");
			expect(labelsDef).toContain("items: { type: string }");
		});

		it("should not include user fields section when none are defined", () => {
			const service = new MdbaseSpecService(
				createMockPlugin({ userFields: [] })
			);
			const fm = extractFrontmatter(service.buildTaskTypeDef());

			// Should still have core fields but no extra fields beyond the known set
			expect(getFieldDef(fm, "title")).toBeDefined();
			expect(getFieldDef(fm, "effort")).toBeUndefined();
		});
	});

	describe("buildTaskTypeDef - body content", () => {
		it("should include markdown body after frontmatter", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const body = extractBody(service.buildTaskTypeDef());

			expect(body).toContain("# Task");
			expect(body).toContain("TaskNotes");
			expect(body).toContain("mdbase-spec");
			expect(body).toContain("automatically generated");
		});
	});

	describe("buildTaskTypeDef - YAML string quoting", () => {
		it("should properly quote values containing special characters", () => {
			const service = new MdbaseSpecService(
				createMockPlugin({
					tasksFolder: 'tasks/my "special" folder',
				})
			);
			const fm = extractFrontmatter(service.buildTaskTypeDef());

			// The path_glob should have escaped quotes
			expect(fm).toContain('path_glob: "tasks/my \\"special\\" folder/**/*.md"');
		});
	});

	describe("generate", () => {
		it("should create _types folder if it does not exist", async () => {
			const plugin = createMockPlugin();
			plugin.app.vault.adapter.exists.mockResolvedValue(false);
			const service = new MdbaseSpecService(plugin);

			await service.generate();

			expect(plugin.app.vault.createFolder).toHaveBeenCalledWith("_types");
		});

		it("should not create _types folder if it already exists", async () => {
			const plugin = createMockPlugin();
			plugin.app.vault.adapter.exists.mockImplementation((path: string) =>
				Promise.resolve(path === "_types")
			);
			const service = new MdbaseSpecService(plugin);

			await service.generate();

			expect(plugin.app.vault.createFolder).not.toHaveBeenCalled();
		});

		it("should create new files when they do not exist", async () => {
			const plugin = createMockPlugin();
			plugin.app.vault.adapter.exists.mockResolvedValue(false);
			const service = new MdbaseSpecService(plugin);

			await service.generate();

			expect(plugin.app.vault.create).toHaveBeenCalledWith(
				"mdbase.yaml",
				expect.any(String)
			);
			expect(plugin.app.vault.create).toHaveBeenCalledWith(
				"_types/task.md",
				expect.any(String)
			);
		});

		it("should update existing files via adapter.write", async () => {
			const plugin = createMockPlugin();
			plugin.app.vault.adapter.exists.mockResolvedValue(true);
			const service = new MdbaseSpecService(plugin);

			await service.generate();

			expect(plugin.app.vault.adapter.write).toHaveBeenCalledWith(
				"mdbase.yaml",
				expect.any(String)
			);
			expect(plugin.app.vault.adapter.write).toHaveBeenCalledWith(
				"_types/task.md",
				expect.any(String)
			);
			expect(plugin.app.vault.create).not.toHaveBeenCalled();
		});
	});

	describe("onSettingsChanged", () => {
		it("should not generate files when enableMdbaseSpec is false", async () => {
			const plugin = createMockPlugin({ enableMdbaseSpec: false });
			const service = new MdbaseSpecService(plugin);

			await service.onSettingsChanged();

			expect(plugin.app.vault.adapter.exists).not.toHaveBeenCalled();
		});

		it("should generate files when enableMdbaseSpec is true", async () => {
			const plugin = createMockPlugin({ enableMdbaseSpec: true });
			plugin.app.vault.adapter.exists.mockResolvedValue(false);
			const service = new MdbaseSpecService(plugin);

			await service.onSettingsChanged();

			expect(plugin.app.vault.create).toHaveBeenCalled();
		});
	});
});
