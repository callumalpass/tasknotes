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

/**
 * Extract the multi-line block for a field under `fields:`.
 * Returns all lines belonging to that field definition (from the field name
 * line up to the next sibling field or end of fields section).
 */
function getFieldBlock(yaml: string, fieldName: string): string | undefined {
	const lines = yaml.split("\n");
	// Find the field line at exactly 2-space indent under fields:
	const fieldRe = new RegExp(`^  ${fieldName}:`);
	const startIdx = lines.findIndex((l) => fieldRe.test(l));
	if (startIdx === -1) return undefined;

	const result: string[] = [lines[startIdx]];
	for (let i = startIdx + 1; i < lines.length; i++) {
		const line = lines[i];
		// Stop at next sibling field (2-space indent, non-empty) or section boundary
		if (line.match(/^  \S/) || line.match(/^[a-z]/)) break;
		// Include deeper-indented lines and blank lines within the block
		if (line.match(/^\s{4,}/) || line === "") {
			result.push(line);
		} else {
			break;
		}
	}
	return result.join("\n");
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

			expect(getYamlValue(fm, "display_name_key")).toBe("title");
		});

		it("should use custom display_name_key when title field is remapped", () => {
			const service = new MdbaseSpecService(
				createMockPlugin({
					fieldMapping: { ...DEFAULT_FIELD_MAPPING, title: "name" },
				})
			);
			const fm = extractFrontmatter(service.buildTaskTypeDef());

			expect(getYamlValue(fm, "display_name_key")).toBe("name");
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

	describe("buildTaskTypeDef - core fields (multi-line format)", () => {
		let fm: string;

		beforeEach(() => {
			const service = new MdbaseSpecService(createMockPlugin());
			fm = extractFrontmatter(service.buildTaskTypeDef());
		});

		it("should define title as required string with description", () => {
			const block = getFieldBlock(fm, "title");
			expect(block).toContain("type: string");
			expect(block).toContain("required: true");
			expect(block).toContain("description:");
		});

		it("should define status as enum with values on separate lines", () => {
			const block = getFieldBlock(fm, "status");
			expect(block).toContain("type: enum");
			expect(block).toContain("required: true");
			expect(block).toContain("values: [none, open, in-progress, done]");
			expect(block).toContain("default: open");
		});

		it("should define priority as enum with values", () => {
			const block = getFieldBlock(fm, "priority");
			expect(block).toContain("type: enum");
			expect(block).toContain("values: [none, low, normal, high]");
			expect(block).toContain("default: normal");
		});

		it("should define due as date", () => {
			const block = getFieldBlock(fm, "due");
			expect(block).toContain("type: date");
		});

		it("should define scheduled as date", () => {
			const block = getFieldBlock(fm, "scheduled");
			expect(block).toContain("type: date");
		});

		it("should define contexts as list of strings", () => {
			const block = getFieldBlock(fm, "contexts");
			expect(block).toContain("type: list");
			expect(block).toContain("items:");
			expect(block).toContain("type: string");
		});

		it("should define projects as list of links with description", () => {
			const block = getFieldBlock(fm, "projects");
			expect(block).toContain("type: list");
			expect(block).toContain("items:");
			expect(block).toContain("type: link");
			expect(block).toContain("description:");
		});

		it("should define timeEstimate as integer with min 0", () => {
			const block = getFieldBlock(fm, "timeEstimate");
			expect(block).toContain("type: integer");
			expect(block).toContain("min: 0");
		});

		it("should define completedDate as date", () => {
			const block = getFieldBlock(fm, "completedDate");
			expect(block).toContain("type: date");
		});

		it("should define dateCreated as datetime and required", () => {
			const block = getFieldBlock(fm, "dateCreated");
			expect(block).toContain("type: datetime");
			expect(block).toContain("required: true");
		});

		it("should define dateModified as datetime", () => {
			const block = getFieldBlock(fm, "dateModified");
			expect(block).toContain("type: datetime");
		});

		it("should define recurrence as string", () => {
			const block = getFieldBlock(fm, "recurrence");
			expect(block).toContain("type: string");
		});

		it("should define recurrence_anchor as enum", () => {
			const block = getFieldBlock(fm, "recurrence_anchor");
			expect(block).toContain("type: enum");
			expect(block).toContain("values: [scheduled, completion]");
			expect(block).toContain("default: scheduled");
		});

		it("should define tags as list of strings", () => {
			const block = getFieldBlock(fm, "tags");
			expect(block).toContain("type: list");
			expect(block).toContain("items:");
			expect(block).toContain("type: string");
		});

		it("should define googleCalendarEventId as string", () => {
			const block = getFieldBlock(fm, "googleCalendarEventId");
			expect(block).toContain("type: string");
		});
	});

	describe("buildTaskTypeDef - complex nested fields", () => {
		let fm: string;

		beforeEach(() => {
			const service = new MdbaseSpecService(createMockPlugin());
			fm = extractFrontmatter(service.buildTaskTypeDef());
		});

		it("should define timeEntries as list of objects with nested fields", () => {
			const block = getFieldBlock(fm, "timeEntries");
			expect(block).toContain("type: list");
			expect(block).toContain("type: object");
			expect(block).toContain("fields:");
			expect(block).toContain("startTime:");
			expect(block).toContain("endTime:");
			expect(block).toContain("description:");
			expect(block).toContain("duration:");
		});

		it("should define reminders as list of objects with description", () => {
			const block = getFieldBlock(fm, "reminders");
			expect(block).toContain("type: list");
			expect(block).toContain("type: object");
			expect(block).toContain("fields:");
			expect(block).toContain("id:");
			expect(block).toContain("relatedTo:");
			expect(block).toContain("offset:");
			expect(block).toContain('description: "Reminder objects');
		});

		it("should define blockedBy as list of objects", () => {
			const block = getFieldBlock(fm, "blockedBy");
			expect(block).toContain("type: list");
			expect(block).toContain("type: object");
			expect(block).toContain("fields:");
			expect(block).toContain("uid:");
			expect(block).toContain("reltype:");
			expect(block).toContain("gap:");
		});

		it("should define complete_instances as list of dates", () => {
			const block = getFieldBlock(fm, "complete_instances");
			expect(block).toContain("type: list");
			expect(block).toContain("items:");
			expect(block).toContain("type: date");
		});

		it("should define skipped_instances as list of dates", () => {
			const block = getFieldBlock(fm, "skipped_instances");
			expect(block).toContain("type: list");
			expect(block).toContain("items:");
			expect(block).toContain("type: date");
		});

		it("should define icsEventId as list of strings", () => {
			const block = getFieldBlock(fm, "icsEventId");
			expect(block).toContain("type: list");
			expect(block).toContain("items:");
			expect(block).toContain("type: string");
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

			expect(getFieldBlock(fm, "task_status")).toContain("type: enum");
			expect(getFieldBlock(fm, "task_priority")).toContain("type: enum");
			expect(getFieldBlock(fm, "due_date")).toContain("type: date");
			expect(getFieldBlock(fm, "scheduled_date")).toContain("type: date");
			expect(getFieldBlock(fm, "areas")).toContain("type: list");
			expect(getFieldBlock(fm, "related_projects")).toContain("type: list");

			// Original names should not appear as field definitions
			expect(getFieldBlock(fm, "status")).toBeUndefined();
			expect(getFieldBlock(fm, "priority")).toBeUndefined();
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
			const block = getFieldBlock(fm, "status");

			expect(block).toContain("todo");
			expect(block).toContain("doing");
			expect(block).toContain("finished");
			expect(block).toContain("default: todo");
			// Default statuses should not appear
			expect(block).not.toContain("in-progress");
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
			const block = getFieldBlock(fm, "priority");

			expect(block).toContain("critical");
			expect(block).toContain("important");
			expect(block).toContain("nice");
			expect(block).toContain("default: important");
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

			expect(getFieldBlock(fm, "effort")).toContain("type: number");
			expect(getFieldBlock(fm, "extra_notes")).toContain("type: string");
			expect(getFieldBlock(fm, "reviewed")).toContain("type: boolean");
			expect(getFieldBlock(fm, "review_date")).toContain("type: date");
			const labelsBlock = getFieldBlock(fm, "labels");
			expect(labelsBlock).toContain("type: list");
			expect(labelsBlock).toContain("items:");
			expect(labelsBlock).toContain("type: string");
		});

		it("should not include user fields section when none are defined", () => {
			const service = new MdbaseSpecService(
				createMockPlugin({ userFields: [] })
			);
			const fm = extractFrontmatter(service.buildTaskTypeDef());

			// Should still have core fields but no extra fields beyond the known set
			expect(getFieldBlock(fm, "title")).toBeDefined();
			expect(getFieldBlock(fm, "effort")).toBeUndefined();
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

	describe("buildTaskTypeDef - multi-line YAML format", () => {
		it("should output fields in multi-line format, not inline", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const fm = extractFrontmatter(service.buildTaskTypeDef());

			// Should NOT contain inline object notation for field definitions
			expect(fm).not.toMatch(/^  \w+: \{/m);
		});

		it("should indent field properties under the field name", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const fm = extractFrontmatter(service.buildTaskTypeDef());

			// title field should have properties on subsequent indented lines
			expect(fm).toMatch(/^  title:\n    type: string\n    required: true/m);
		});

		it("should nest object items with proper indentation", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const fm = extractFrontmatter(service.buildTaskTypeDef());

			// reminders should have deeply nested structure
			const block = getFieldBlock(fm, "reminders");
			expect(block).toMatch(/items:\n\s+type: object\n\s+fields:/);
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
