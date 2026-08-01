/**
 * Unit tests for MdbaseSpecService
 *
 * Validates v0.3 generation and the retained v0.2 compatibility path.
 */

import { buildTaskNotesMdbaseResources } from "@tasknotes/model/mdbase";
import YAML from "yaml";

import { FieldMapper } from "../../../src/services/FieldMapper";
import { MdbaseSpecService } from "../../../src/services/MdbaseSpecService";
import {
	DEFAULT_FIELD_MAPPING,
	DEFAULT_NLP_TRIGGERS,
	DEFAULT_PRIORITIES,
	DEFAULT_STATUSES,
} from "../../../src/settings/defaults";
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

function parseFrontmatter(markdown: string): Record<string, unknown> {
	return YAML.parse(extractFrontmatter(markdown)) as Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("Expected an object");
	}
	return value as Record<string, unknown>;
}

function tasknotesImplementation(
	type: Record<string, unknown>
): Record<string, unknown> {
	const implementations = type.implements as Record<string, unknown>[];
	const implementation = implementations?.find(
		(candidate) =>
			candidate.contract === "tasknotes.task" && candidate.version === "0.3.0-rc.1"
	);
	if (!implementation) throw new Error("Expected a TaskNotes implementation");
	return implementation;
}

function tasknotesBinding(type: Record<string, unknown>): Record<string, unknown> {
	return asObject(tasknotesImplementation(type).binding);
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
		taskFilenameFormat: "zettel",
		storeTitleInFilename: true,
		customFilenameTemplate: "{title}",
		taskIdentificationMethod: "tag",
		taskTag: "task",
		taskPropertyName: "",
		taskPropertyValue: "",
		fieldMapping: { ...DEFAULT_FIELD_MAPPING },
		customStatuses: [...DEFAULT_STATUSES],
		customPriorities: [...DEFAULT_PRIORITIES],
		defaultTaskStatus: "open",
		defaultTaskPriority: "normal",
		nlpTriggers: {
			triggers: DEFAULT_NLP_TRIGGERS.triggers.map((trigger) => ({ ...trigger })),
		},
		moveArchivedTasks: false,
		archiveFolder: "TaskNotes/Archive",
		maintainDueDateOffsetInRecurring: false,
		resetCheckboxesOnRecurrence: false,
		useFrontmatterMarkdownLinks: false,
		autoStopTimeTrackingOnComplete: true,
		taskCreationDefaults: {
			bodyTemplate: "",
			useBodyTemplate: false,
			occurrenceBodyTemplate: "",
			useOccurrenceBodyTemplate: false,
		},
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
					read: jest.fn().mockResolvedValue('spec_version: "0.3.0"'),
					write: jest.fn().mockResolvedValue(undefined),
					list: jest.fn().mockResolvedValue({ files: [], folders: [] }),
				},
				on: jest.fn().mockReturnValue({}),
				create: jest.fn().mockResolvedValue({}),
				createFolder: jest.fn().mockResolvedValue(undefined),
			},
		},
		registerEvent: jest.fn(),
	};
}

describe("MdbaseSpecService", () => {
	describe("buildMdbaseYaml", () => {
		it("should create a v0.3 collection", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const yaml = service.buildMdbaseYaml();
			const config = asObject(YAML.parse(yaml));

			expect(config.spec_version).toBe("0.3.0");
		});

		it("should include name and description", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const config = asObject(YAML.parse(service.buildMdbaseYaml()));

			expect(config).toMatchObject({
				name: "TaskNotes",
				description: "Task collection managed by TaskNotes for Obsidian",
			});
		});

		it("should set types_folder to _types", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const config = asObject(YAML.parse(service.buildMdbaseYaml()));

			expect(asObject(config.settings).types_folder).toBe("_types");
		});

		it("should use warning validation and Markdown records", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const settings = asObject(asObject(YAML.parse(service.buildMdbaseYaml())).settings);

			expect(settings.record_extensions).toEqual(["md"]);
			expect(settings.validation).toBe("warn");
			expect(settings.explicit_type_keys).toEqual(["type", "types"]);
			expect(settings.id_field).toBe("id");
		});

		it("should exclude the _types folder", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const settings = asObject(asObject(YAML.parse(service.buildMdbaseYaml())).settings);

			expect(settings.exclude).toEqual(["_types"]);
		});

		it("should include a custom types folder when provided", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const settings = asObject(
				asObject(YAML.parse(service.buildMdbaseYaml("System/_types"))).settings
			);

			expect(settings.types_folder).toBe("System/_types");
			expect(settings.exclude).toEqual(["System/_types"]);
		});
	});

	describe("buildTaskTypeDef - frontmatter structure", () => {
		it("should have valid frontmatter delimiters", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const output = service.buildTaskTypeDef("0.2.0");

			expect(output).toMatch(/^---\n/);
			expect(output).toMatch(/\n---\n/);
		});

		it("should set name to task", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));

			expect(getYamlValue(fm, "name")).toBe("task");
		});

		it("should set strict to false", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));

			expect(getYamlValue(fm, "strict")).toBe("false");
		});

		it("should include description", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));

			expect(fm).toContain("description:");
		});

		it("should include path_pattern", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));

			expect(getYamlValue(fm, "path_pattern")).toBe('"TaskNotes/Tasks/{title}.md"');
		});

		it("should set display_name_key to the mapped title field", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));

			expect(getYamlValue(fm, "display_name_key")).toBe("title");
		});

		it("should use custom display_name_key when title field is remapped", () => {
			const service = new MdbaseSpecService(
				createMockPlugin({
					fieldMapping: { ...DEFAULT_FIELD_MAPPING, title: "name" },
				})
			);
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));

			expect(getYamlValue(fm, "display_name_key")).toBe("name");
		});
	});

	describe("buildTaskTypeDef - path_pattern generation", () => {
		it("should use title filename when storeTitleInFilename is true", () => {
			const service = new MdbaseSpecService(
				createMockPlugin({
					tasksFolder: "Tasks",
					storeTitleInFilename: true,
					taskFilenameFormat: "zettel",
				})
			);
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));
			expect(getYamlValue(fm, "path_pattern")).toBe('"Tasks/{title}.md"');
		});

		it("should use zettel filename when configured", () => {
			const service = new MdbaseSpecService(
				createMockPlugin({
					tasksFolder: "Tasks",
					storeTitleInFilename: false,
					taskFilenameFormat: "zettel",
				})
			);
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));
			expect(getYamlValue(fm, "path_pattern")).toBe('"Tasks/{zettel}.md"');
		});

		it("should use timestamp filename when configured", () => {
			const service = new MdbaseSpecService(
				createMockPlugin({
					tasksFolder: "Tasks",
					storeTitleInFilename: false,
					taskFilenameFormat: "timestamp",
				})
			);
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));
			expect(getYamlValue(fm, "path_pattern")).toBe('"Tasks/{timestamp}.md"');
		});

		it("should use uuid filename when configured", () => {
			const service = new MdbaseSpecService(
				createMockPlugin({
					tasksFolder: "Tasks",
					storeTitleInFilename: false,
					taskFilenameFormat: "uuid",
				})
			);
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));
			expect(getYamlValue(fm, "path_pattern")).toBe('"Tasks/{uuid}.md"');
		});

		it("should map known custom template variables to mapped fields", () => {
			const service = new MdbaseSpecService(
				createMockPlugin({
					tasksFolder: "Calendar/{{year}}/{{month}}",
					storeTitleInFilename: false,
					taskFilenameFormat: "custom",
					customFilenameTemplate: "{{priority}}-{{title}}-{{titleKebab}}",
					fieldMapping: {
						...DEFAULT_FIELD_MAPPING,
						title: "name",
						priority: "importance",
					},
				})
			);
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));
			expect(getYamlValue(fm, "path_pattern")).toBe(
				'"Calendar/{year}/{month}/{importance}-{name}-{titleKebab}.md"'
			);
		});
	});

	describe("buildTaskTypeDef - match section", () => {
		it("should match by tag when task identification method is tag", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));

			expect(fm).toContain("match:");
			expect(fm).toContain("  where:");
			expect(fm).toContain("    tags:");
			expect(fm).toContain('      contains: "task"');
		});

		it("should match by custom tag when configured", () => {
			const service = new MdbaseSpecService(createMockPlugin({ taskTag: "my-task-tag" }));
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));

			expect(fm).toContain('contains: "my-task-tag"');
		});

		it("should match by property equality when property identification has value", () => {
			const service = new MdbaseSpecService(
				createMockPlugin({
					taskIdentificationMethod: "property",
					taskPropertyName: "kind",
					taskPropertyValue: "task",
				})
			);
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));

			expect(fm).toContain("  where:");
			expect(fm).toContain('    "kind":');
			expect(fm).toContain('      eq: "task"');
		});

		it("should coerce boolean-like property values in match rule", () => {
			const service = new MdbaseSpecService(
				createMockPlugin({
					taskIdentificationMethod: "property",
					taskPropertyName: "isTask",
					taskPropertyValue: "true",
				})
			);
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));

			expect(fm).toContain('    "isTask":');
			expect(fm).toContain("      eq: true");
		});

		it("should match by property existence when property value is empty", () => {
			const service = new MdbaseSpecService(
				createMockPlugin({
					taskIdentificationMethod: "property",
					taskPropertyName: "isTask",
					taskPropertyValue: "",
				})
			);
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));

			expect(fm).toContain('    "isTask":');
			expect(fm).toContain("      exists: true");
		});

		it("should fall back to tag matching when property method has no property name", () => {
			const service = new MdbaseSpecService(
				createMockPlugin({
					taskIdentificationMethod: "property",
					taskPropertyName: "",
					taskTag: "fallback-task",
				})
			);
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));

			expect(fm).toContain("    tags:");
			expect(fm).toContain('      contains: "fallback-task"');
		});
	});

	describe("buildTaskTypeDef - core fields (multi-line format)", () => {
		let fm: string;

		beforeEach(() => {
			const service = new MdbaseSpecService(createMockPlugin());
			fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));
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
			expect(block).toContain('values: ["none", "open", "in-progress", "done"]');
			expect(block).toContain('default: "open"');
		});

		it("should define priority as enum with values", () => {
			const block = getFieldBlock(fm, "priority");
			expect(block).toContain("type: enum");
			expect(block).toContain('values: ["none", "low", "normal", "high"]');
			expect(block).toContain('default: "normal"');
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
			expect(block).toContain("generated: now");
		});

		it("should define dateModified as datetime", () => {
			const block = getFieldBlock(fm, "dateModified");
			expect(block).toContain("type: datetime");
			expect(block).toContain("generated: now_on_write");
		});

		it("should define recurrence as string", () => {
			const block = getFieldBlock(fm, "recurrence");
			expect(block).toContain("type: string");
		});

		it("should define recurrence_anchor as enum", () => {
			const block = getFieldBlock(fm, "recurrence_anchor");
			expect(block).toContain("type: enum");
			expect(block).toContain('values: ["scheduled", "completion"]');
			expect(block).toContain('default: "scheduled"');
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
			fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));
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
			expect(block).toContain('values: ["absolute", "relative"]');
			expect(block).toContain("relatedTo:");
			expect(block).toContain('values: ["due", "scheduled"]');
			expect(block).toContain("offset:");
			expect(block).toContain("absoluteTime:");
			expect(block).toContain("type: datetime");
			expect(block).toContain('description: "Reminder objects');
		});

		it("should define blockedBy as list of objects", () => {
			const block = getFieldBlock(fm, "blockedBy");
			expect(block).toContain("type: list");
			expect(block).toContain("type: object");
			expect(block).toContain("fields:");
			expect(block).toContain("uid:");
			expect(block).toContain("type: link");
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
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));

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
						{
							id: "todo",
							value: "todo",
							label: "Todo",
							color: "#ccc",
							isCompleted: false,
							order: 0,
							autoArchive: false,
							autoArchiveDelay: 5,
						},
						{
							id: "doing",
							value: "doing",
							label: "Doing",
							color: "#00f",
							isCompleted: false,
							order: 1,
							autoArchive: false,
							autoArchiveDelay: 5,
						},
						{
							id: "finished",
							value: "finished",
							label: "Finished",
							color: "#0a0",
							isCompleted: true,
							order: 2,
							autoArchive: false,
							autoArchiveDelay: 5,
						},
					],
					defaultTaskStatus: "todo",
				})
			);
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));
			const block = getFieldBlock(fm, "status");

			expect(block).toContain("todo");
			expect(block).toContain("doing");
			expect(block).toContain("finished");
			expect(block).toContain('default: "todo"');
			// Default statuses should not appear
			expect(block).not.toContain("in-progress");
		});

		it("should include custom priority values in enum", () => {
			const service = new MdbaseSpecService(
				createMockPlugin({
					customPriorities: [
						{
							id: "p1",
							value: "critical",
							label: "Critical",
							color: "#f00",
							weight: 3,
						},
						{
							id: "p2",
							value: "important",
							label: "Important",
							color: "#fa0",
							weight: 2,
						},
						{
							id: "p3",
							value: "nice",
							label: "Nice to have",
							color: "#0a0",
							weight: 1,
						},
					],
					defaultTaskPriority: "important",
				})
			);
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));
			const block = getFieldBlock(fm, "priority");

			expect(block).toContain("critical");
			expect(block).toContain("important");
			expect(block).toContain("nice");
			expect(block).toContain('default: "important"');
		});
	});

	describe("buildTaskTypeDef - user-defined fields", () => {
		it("should include user fields with correct type mapping", () => {
			const service = new MdbaseSpecService(
				createMockPlugin({
					userFields: [
						{ id: "effort", displayName: "Effort", key: "effort", type: "number" },
						{ id: "notes", displayName: "Notes", key: "extra_notes", type: "text" },
						{
							id: "reviewed",
							displayName: "Reviewed",
							key: "reviewed",
							type: "boolean",
						},
						{
							id: "review_date",
							displayName: "Review Date",
							key: "review_date",
							type: "date",
						},
						{ id: "labels", displayName: "Labels", key: "labels", type: "list" },
					],
				})
			);
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));

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
			const service = new MdbaseSpecService(createMockPlugin({ userFields: [] }));
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));

			// Should still have core fields but no extra fields beyond the known set
			expect(getFieldBlock(fm, "title")).toBeDefined();
			expect(getFieldBlock(fm, "effort")).toBeUndefined();
		});
	});

	describe("buildTaskTypeDef - portable capture settings", () => {
		it("exports configured NLP triggers by stable property id", () => {
			const triggers = [
				{ property_id: "tags", trigger: "##", enabled: true },
				{ property_id: "priority", trigger: "!", enabled: false },
				{ property_id: "energy", trigger: "~", enabled: true },
			];
			const service = new MdbaseSpecService(
				createMockPlugin({
					nlpTriggers: {
						triggers: [
							{ propertyId: "tags", trigger: "##", enabled: true },
							{ propertyId: "priority", trigger: "!", enabled: false },
							{ propertyId: "energy", trigger: "~", enabled: true },
						],
					},
				})
			);
			const legacyFrontmatter = YAML.parse(
				extractFrontmatter(service.buildTaskTypeDef("0.2.0"))
			);
			const canonicalFrontmatter = parseFrontmatter(service.buildTaskTypeDef());

			expect(legacyFrontmatter["x-tasknotes"].nlp).toEqual({ triggers });
			expect(tasknotesBinding(canonicalFrontmatter).nlp).toEqual({ triggers });
		});

		it("exports an empty trigger list when capture triggers are unavailable", () => {
			const service = new MdbaseSpecService(createMockPlugin({ nlpTriggers: undefined }));
			const legacyFrontmatter = YAML.parse(
				extractFrontmatter(service.buildTaskTypeDef("0.2.0"))
			);
			const canonicalFrontmatter = parseFrontmatter(service.buildTaskTypeDef());

			expect(legacyFrontmatter["x-tasknotes"].nlp.triggers).toEqual([]);
			expect(tasknotesBinding(canonicalFrontmatter).nlp).toEqual({ triggers: [] });
		});
	});

	describe("buildTaskTypeDef - body content", () => {
		it("should include markdown body after frontmatter", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const body = extractBody(service.buildTaskTypeDef("0.2.0"));

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
					taskIdentificationMethod: "property",
					taskPropertyName: 'task "kind"',
					taskPropertyValue: 'my "special" task',
				})
			);
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));

			expect(fm).toContain('    "task \\"kind\\"":');
			expect(fm).toContain('      eq: "my \\"special\\" task"');
		});
	});

	describe("buildTaskTypeDef - multi-line YAML format", () => {
		it("should output fields in multi-line format, not inline", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));

			// Should NOT contain inline object notation for field definitions
			expect(fm).not.toMatch(/^  \w+: \{/m);
		});

		it("should indent field properties under the field name", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));

			// title field should have properties on subsequent indented lines
			expect(fm).toMatch(/^  title:\n    type: string\n    required: true/m);
		});

		it("should nest object items with proper indentation", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const fm = extractFrontmatter(service.buildTaskTypeDef("0.2.0"));

			// reminders should have deeply nested structure
			const block = getFieldBlock(fm, "reminders");
			expect(block).toMatch(/items:\n\s+type: object\n\s+fields:/);
		});
	});

	describe("buildTaskTypeDef - v0.3", () => {
		it("emits a JSON Schema type wrapper by default", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const frontmatter = parseFrontmatter(service.buildTaskTypeDef());
			const schemaWrapper = asObject(frontmatter.schema);
			const schema = asObject(schemaWrapper.value);
			const properties = asObject(schema.properties);

			expect(frontmatter.kind).toBe("mdbase.type");
			expect(frontmatter.name).toBe("task");
			expect(frontmatter.version).toBe(1);
			expect(schemaWrapper.dialect).toBe("json-schema-2020-12");
			expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
			expect(schema.additionalProperties).toBe(true);
			expect(schema.required).toEqual(["status", "dateCreated"]);
			expect(asObject(properties.due)).toMatchObject({ type: "string", format: "date" });
			expect(asObject(properties.dateModified)).toMatchObject({
				type: "string",
				format: "date-time",
			});
		});

		it("requires the mapped title only when frontmatter owns the title", () => {
			const filenameTitle = parseFrontmatter(
				new MdbaseSpecService(
					createMockPlugin({
						storeTitleInFilename: true,
						fieldMapping: { ...DEFAULT_FIELD_MAPPING, title: "summary" },
					})
				).buildTaskTypeDef()
			);
			const frontmatterTitle = parseFrontmatter(
				new MdbaseSpecService(
					createMockPlugin({
						storeTitleInFilename: false,
						fieldMapping: { ...DEFAULT_FIELD_MAPPING, title: "summary" },
					})
				).buildTaskTypeDef()
			);

			expect(asObject(asObject(filenameTitle.schema).value).required).not.toContain(
				"summary"
			);
			expect(asObject(asObject(frontmatterTitle.schema).value).required).toContain("summary");
		});

		it("moves defaults, links, lifecycle behavior, and roles to v0.3 metadata", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const frontmatter = parseFrontmatter(service.buildTaskTypeDef());
			const collection = asObject(frontmatter.collection);
			const lifecycle = asObject(frontmatter.lifecycle);
			const onCreate = asObject(lifecycle.on_create);
			const onUpdate = asObject(lifecycle.on_update);
			const taskImplementation = tasknotesImplementation(frontmatter);
			const extension = tasknotesBinding(frontmatter);

			expect(collection.read_defaults).toEqual({
				status: "open",
				priority: "normal",
				recurrence_anchor: "scheduled",
				occurrence_materialization: "manual",
				occurrence_next_trigger: "completion",
			});
			expect(collection.links).toEqual({
				"projects[]": { target_type: "any", validate_exists: false },
				occurrence_template: { target_type: "any", validate_exists: false },
				recurrence_parent: { target_type: "task", validate_exists: false },
				"blockedBy[].uid": { target_type: "task", validate_exists: false },
			});
			expect(asObject(onCreate.set)).toEqual({
				id: { uuid: true },
				dateCreated: { now: true },
				dateModified: { now: true },
			});
			expect(asObject(onUpdate.set)).toEqual({ dateModified: { now: true } });
			expect(extension).toMatchObject({
				status: { default: "open" },
				priority: { default: "normal" },
				archive: { archived_tag: "archived" },
			});
			expect(asObject(taskImplementation.fields)).toMatchObject({
				title: "title",
				status: "status",
				blockedBy: "blockedBy",
			});
		});

		it("uses a discriminated JSON Schema union for reminders", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const frontmatter = parseFrontmatter(service.buildTaskTypeDef());
			const schema = asObject(asObject(frontmatter.schema).value);
			const reminders = asObject(asObject(schema.properties).reminders);
			const items = asObject(reminders.items);

			expect(reminders.type).toBe("array");
			expect(items.oneOf).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ required: ["id", "type", "absoluteTime"] }),
					expect.objectContaining({ required: ["id", "type", "relatedTo", "offset"] }),
				])
			);
		});

		it("preserves custom mappings in schema and TaskNotes role metadata", () => {
			const service = new MdbaseSpecService(
				createMockPlugin({
					fieldMapping: {
						...DEFAULT_FIELD_MAPPING,
						title: "summary",
						status: "task_status",
						projects: "related_projects",
					},
				})
			);
			const frontmatter = parseFrontmatter(service.buildTaskTypeDef());
			const schema = asObject(asObject(frontmatter.schema).value);
			const collection = asObject(frontmatter.collection);
			const taskImplementation = tasknotesImplementation(frontmatter);
			const links = asObject(collection.links);

			expect(asObject(schema.properties)).toHaveProperty("summary");
			expect(collection.display).toEqual({ name_field: "summary" });
			expect(links["related_projects[]"]).toEqual({
				target_type: "any",
				validate_exists: false,
			});
			expect(asObject(taskImplementation.fields)).toMatchObject({
				title: "summary",
				status: "task_status",
				projects: "related_projects",
			});
		});

		it("embeds a portable snapshot of TaskNotes domain settings", () => {
			const service = new MdbaseSpecService(
				createMockPlugin({
					fieldMapping: {
						...DEFAULT_FIELD_MAPPING,
						title: "summary",
						status: "state",
						priority: "importance",
						archiveTag: "filed-away",
					},
					storeTitleInFilename: false,
					taskFilenameFormat: "custom",
					customFilenameTemplate: "{{priority}}-{{title}}",
					customStatuses: [
						{
							id: "todo",
							value: "todo",
							label: "To do",
							color: "#888888",
							icon: "circle",
							isCompleted: false,
							isSkipped: false,
							excludeFromCycle: false,
							nextStatus: "done",
							order: 1,
							autoArchive: false,
							autoArchiveDelay: 5,
						},
						{
							id: "done",
							value: "done",
							label: "Done",
							color: "#00aa00",
							isCompleted: true,
							isSkipped: false,
							excludeFromCycle: false,
							order: 2,
							autoArchive: true,
							autoArchiveDelay: 15,
						},
						{
							id: "cancelled",
							value: "cancelled",
							label: "Cancelled",
							color: "#aa0000",
							isCompleted: false,
							isSkipped: true,
							excludeFromCycle: true,
							order: 3,
							autoArchive: false,
							autoArchiveDelay: 5,
						},
					],
					defaultTaskStatus: "todo",
					customPriorities: [
						{
							id: "routine",
							value: "routine",
							label: "Routine",
							color: "#777777",
							weight: 1,
						},
						{
							id: "critical",
							value: "critical",
							label: "Critical",
							color: "#ff0000",
							icon: "flame",
							weight: 5,
						},
					],
					defaultTaskPriority: "routine",
					moveArchivedTasks: true,
					archiveFolder: "Archive/Tasks",
					maintainDueDateOffsetInRecurring: true,
					resetCheckboxesOnRecurrence: true,
					useFrontmatterMarkdownLinks: true,
					autoStopTimeTrackingOnComplete: false,
					taskCreationDefaults: {
						bodyTemplate: "Templates/Task.md",
						useBodyTemplate: true,
						occurrenceBodyTemplate: "Templates/Occurrence.md",
						useOccurrenceBodyTemplate: true,
					},
				})
			);
			const frontmatter = parseFrontmatter(service.buildTaskTypeDef());
			const collection = asObject(frontmatter.collection);
			const taskImplementation = tasknotesImplementation(frontmatter);
			const extension = tasknotesBinding(frontmatter);

			expect(extension).toMatchObject({
				profiles: [
					"core-lite",
					"recurrence",
					"templating",
					"materialized-occurrences",
					"extended",
				],
				capabilities: [
					"dependencies",
					"reminders",
					"links",
					"time-tracking",
					"materialized-occurrences",
					"archive",
					"templating",
				],
				title: {
					storage: "frontmatter",
					filename_format: "custom",
					custom_filename_template: "{{priority}}-{{title}}",
				},
				status: {
					default: "todo",
					completed_values: ["done"],
					skipped_values: ["cancelled"],
					default_skipped: "cancelled",
				},
				priority: { default: "routine" },
				recurrence: {
					syntax: "tasknotes",
					maintain_due_date_offset: true,
					reset_body_checkboxes: true,
				},
				occurrences: {
					identity_roles: ["recurrenceParent", "occurrenceDate"],
					default_materialization: "manual",
					default_next_trigger: "completion",
				},
				links: {
					accepted_formats: ["wikilink", "markdown"],
					write_format: "markdown",
				},
				archive: {
					archived_tag: "filed-away",
					move_on_archive: true,
					folder: "Archive/Tasks",
				},
				time_tracking: { auto_stop_on_complete: false },
				templating: {
					enabled: true,
					template_path: "Templates/Task.md",
					occurrence_enabled: true,
					occurrence_template_path: "Templates/Occurrence.md",
				},
			});
			expect(asObject(taskImplementation.fields)).toMatchObject({
				title: "summary",
				status: "state",
				priority: "importance",
			});
			expect(asObject(collection.read_defaults)).toMatchObject({
				state: "todo",
				importance: "routine",
			});

			const statusDefinitions = asObject(extension.status).definitions as unknown[];
			expect(statusDefinitions).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						value: "done",
						is_completed: true,
						auto_archive: true,
						auto_archive_delay_minutes: 15,
					}),
					expect.objectContaining({
						value: "cancelled",
						is_skipped: true,
						exclude_from_cycle: true,
					}),
				])
			);
			const priorityDefinitions = asObject(extension.priority).definitions as unknown[];
			expect(priorityDefinitions).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ value: "critical", weight: 5, icon: "flame" }),
				])
			);
		});

		it("quotes configured enum strings before converting them", () => {
			const service = new MdbaseSpecService(
				createMockPlugin({
					customStatuses: [
						{
							id: "boolean-like",
							value: "true",
							label: "True",
							color: "#000",
							isCompleted: false,
							order: 0,
							autoArchive: false,
							autoArchiveDelay: 0,
						},
						{
							id: "null-like",
							value: "null",
							label: "Null",
							color: "#111",
							isCompleted: true,
							order: 1,
							autoArchive: false,
							autoArchiveDelay: 0,
						},
					],
					defaultTaskStatus: "true",
				})
			);
			const frontmatter = parseFrontmatter(service.buildTaskTypeDef());
			const schema = asObject(asObject(frontmatter.schema).value);
			const status = asObject(asObject(schema.properties).status);

			expect(status.enum).toEqual(["true", "null"]);
			expect(status.default).toBe("true");
		});

		it("records collection paths that cannot be represented by v0.3", () => {
			const service = new MdbaseSpecService(
				createMockPlugin({
					fieldMapping: {
						...DEFAULT_FIELD_MAPPING,
						title: "task title",
						projects: "related projects",
					},
				})
			);
			const frontmatter = parseFrontmatter(service.buildTaskTypeDef());
			const collection = asObject(frontmatter.collection);
			const generator = asObject(frontmatter["x-tasknotes-generator"]);

			expect(collection.display).toBeUndefined();
			expect(asObject(collection.links)).not.toHaveProperty("related projects[]");
			expect(generator.omitted_collection_paths).toEqual(
				expect.arrayContaining(["task title", "related projects[]"])
			);
		});

		it("rejects unsupported versions", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			expect(() => service.buildTaskTypeDef("1.0.0")).toThrow(
				"Unsupported mdbase spec version"
			);
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

			expect(plugin.app.vault.createFolder).not.toHaveBeenCalledWith("_types");
		});

		it("should use the types_folder from an existing mdbase.yaml", async () => {
			const plugin = createMockPlugin();
			plugin.app.vault.adapter.exists.mockImplementation((path: string) =>
				Promise.resolve(path === "mdbase.yaml")
			);
			plugin.app.vault.adapter.read.mockResolvedValue(
				JSON.stringify({
					spec_version: "0.3.0",
					settings: { types_folder: "System/_types" },
				})
			);
			const service = new MdbaseSpecService(plugin);

			await service.generate();

			expect(plugin.app.vault.createFolder).toHaveBeenCalledWith("System");
			expect(plugin.app.vault.createFolder).toHaveBeenCalledWith("System/_types");
			expect(plugin.app.vault.create).toHaveBeenCalledWith(
				"System/_types/task.md",
				expect.any(String)
			);
			expect(plugin.app.vault.create).not.toHaveBeenCalledWith(
				"mdbase.yaml",
				expect.any(String)
			);
		});

		it("should fall back to _types when mdbase.yaml has an unsafe types_folder", async () => {
			const plugin = createMockPlugin();
			plugin.app.vault.adapter.exists.mockImplementation((path: string) =>
				Promise.resolve(path === "mdbase.yaml")
			);
			plugin.app.vault.adapter.read.mockResolvedValue(
				JSON.stringify({
					spec_version: "0.3.0",
					settings: { types_folder: "../outside" },
				})
			);
			const service = new MdbaseSpecService(plugin);

			await service.generate();

			expect(plugin.app.vault.createFolder).toHaveBeenCalledWith("_types");
			expect(plugin.app.vault.create).toHaveBeenCalledWith(
				"_types/task.md",
				expect.any(String)
			);
			expect(plugin.app.vault.create).toHaveBeenCalledWith(
				"_contracts/tasknotes.task.md",
				expect.stringContaining("kind: mdbase.contract")
			);
			expect(plugin.app.vault.create).toHaveBeenCalledWith(
				"_schemas/tasknotes/tasknotes-task.schema.json",
				expect.stringContaining('"$schema"')
			);
			expect(plugin.app.vault.create).toHaveBeenCalledWith(
				"_schemas/tasknotes/tasknotes-task-binding.schema.json",
				expect.stringContaining('"profiles"')
			);
		});

		it("should create new files when they do not exist", async () => {
			const plugin = createMockPlugin();
			plugin.app.vault.adapter.exists.mockResolvedValue(false);
			const service = new MdbaseSpecService(plugin);

			await service.generate();

			expect(plugin.app.vault.create).toHaveBeenCalledWith("mdbase.yaml", expect.any(String));
			expect(plugin.app.vault.create).toHaveBeenCalledWith(
				"_types/task.md",
				expect.any(String)
			);
			const typeCall = plugin.app.vault.create.mock.calls.find(
				([path]: [string]) => path === "_types/task.md"
			);
			const configCall = plugin.app.vault.create.mock.calls.find(
				([path]: [string]) => path === "mdbase.yaml"
			);
			expect(parseFrontmatter(typeCall?.[1] as string).kind).toBe("mdbase.type");
			expect(asObject(YAML.parse(configCall?.[1] as string)).spec_version).toBe("0.3.0");
		});

		it("uses the configured contracts folder for the canonical contract", async () => {
			const plugin = createMockPlugin();
			plugin.app.vault.adapter.exists.mockImplementation((path: string) =>
				Promise.resolve(path === "mdbase.yaml")
			);
			plugin.app.vault.adapter.read.mockResolvedValue(
				YAML.stringify({
					spec_version: "0.3.0",
					settings: {
						types_folder: "_types",
						contracts_folder: "System/contracts",
					},
				})
			);
			const service = new MdbaseSpecService(plugin);

			await service.generate();

			expect(plugin.app.vault.create).toHaveBeenCalledWith(
				"System/contracts/tasknotes.task.md",
				expect.stringContaining("id: tasknotes.task")
			);
		});

		it("should retain the v0.2 type grammar for an existing v0.2 collection", async () => {
			const plugin = createMockPlugin();
			plugin.app.vault.adapter.exists.mockResolvedValue(true);
			plugin.app.vault.adapter.read.mockResolvedValue(
				'spec_version: "0.2.1"\nsettings:\n  types_folder: "_types"\n'
			);
			const service = new MdbaseSpecService(plugin);

			await service.generate();

			const typeWrite = plugin.app.vault.adapter.write.mock.calls.find(
				([path]: [string]) => path === "_types/task.md"
			);
			const frontmatter = parseFrontmatter(typeWrite?.[1] as string);
			expect(frontmatter.name).toBe("task");
			expect(frontmatter.fields).toBeDefined();
			expect(frontmatter.kind).toBeUndefined();
			expect(frontmatter.schema).toBeUndefined();
		});

		it("should regenerate v0.3 types for an existing v0.3 collection", async () => {
			const plugin = createMockPlugin();
			plugin.app.vault.adapter.exists.mockResolvedValue(true);
			plugin.app.vault.adapter.read.mockImplementation((path: string) =>
				Promise.resolve(
					path === "mdbase.yaml"
						? 'spec_version: "0.3.0"'
						: buildTaskNotesMdbaseResources().typeDocument
				)
			);
			const service = new MdbaseSpecService(plugin);

			await service.generate();

			const typeWrite = plugin.app.vault.adapter.write.mock.calls.find(
				([path]: [string]) => path === "_types/task.md"
			);
			expect(parseFrontmatter(typeWrite?.[1] as string).kind).toBe("mdbase.type");
		});

		it("should preserve v0.2 value compatibility after a metadata migration", async () => {
			const plugin = createMockPlugin();
			plugin.app.vault.adapter.exists.mockResolvedValue(true);
			plugin.app.vault.adapter.read.mockImplementation((path: string) =>
				Promise.resolve(
					path === "mdbase.yaml"
						? YAML.stringify({
								spec_version: "0.3.0",
								settings: { types_folder: "_types" },
								"x-legacy-v0.2": { settings: { write_defaults: true } },
							})
						: buildTaskNotesMdbaseResources({
								legacyCompatibility: true,
							}).typeDocument
				)
			);
			const service = new MdbaseSpecService(plugin);

			await service.generate();

			const typeWrite = plugin.app.vault.adapter.write.mock.calls.find(
				([path]: [string]) => path === "_types/task.md"
			);
			const frontmatter = parseFrontmatter(typeWrite?.[1] as string);
			const schema = asObject(asObject(frontmatter.schema).value);
			const properties = asObject(schema.properties);
			expect(asObject(properties.title).type).toEqual(["string", "number", "boolean"]);
			expect(asObject(properties.priority).anyOf).toEqual(
				expect.arrayContaining([expect.objectContaining({ type: "null" })])
			);
			expect(asObject(properties.dateCreated).pattern).toContain("[+-]");
			expect(asObject(frontmatter["x-legacy-v0.2"]).coercion_compatible_schema).toBe(true);
			expect(
				asObject(frontmatter["x-tasknotes-generator"]).legacy_compatibility
			).toBe(true);
		});

		it("should not touch generated files for an unsupported collection version", async () => {
			const plugin = createMockPlugin();
			plugin.app.vault.adapter.exists.mockResolvedValue(true);
			plugin.app.vault.adapter.read.mockResolvedValue('spec_version: "0.4.0"');
			const service = new MdbaseSpecService(plugin);

			await service.generate();

			expect(plugin.app.vault.adapter.write).not.toHaveBeenCalled();
			expect(plugin.app.vault.create).not.toHaveBeenCalled();
			expect(plugin.app.vault.createFolder).not.toHaveBeenCalled();
		});

		it("should not touch generated files when mdbase.yaml is unreadable", async () => {
			const plugin = createMockPlugin();
			plugin.app.vault.adapter.exists.mockResolvedValue(true);
			plugin.app.vault.adapter.read.mockRejectedValue(new Error("read failed"));
			const service = new MdbaseSpecService(plugin);

			await service.generate();

			expect(plugin.app.vault.adapter.write).not.toHaveBeenCalled();
			expect(plugin.app.vault.create).not.toHaveBeenCalled();
		});

		it("should update _types/task.md via adapter.write when it exists", async () => {
			const plugin = createMockPlugin();
			plugin.app.vault.adapter.exists.mockResolvedValue(true);
			plugin.app.vault.adapter.read.mockImplementation((path: string) =>
				Promise.resolve(
					path === "mdbase.yaml"
						? 'spec_version: "0.3.0"'
						: buildTaskNotesMdbaseResources().typeDocument
				)
			);
			const service = new MdbaseSpecService(plugin);

			await service.generate();

			expect(plugin.app.vault.adapter.write).toHaveBeenCalledWith(
				"_types/task.md",
				expect.any(String)
			);
			expect(plugin.app.vault.create).not.toHaveBeenCalled();
		});

		it("should not overwrite mdbase.yaml when it already exists", async () => {
			const plugin = createMockPlugin();
			plugin.app.vault.adapter.exists.mockResolvedValue(true);
			const service = new MdbaseSpecService(plugin);

			await service.generate();

			expect(plugin.app.vault.adapter.write).not.toHaveBeenCalledWith(
				"mdbase.yaml",
				expect.any(String)
			);
			expect(plugin.app.vault.create).not.toHaveBeenCalledWith(
				"mdbase.yaml",
				expect.any(String)
			);
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

	describe("canonical v0.3 configuration", () => {
		it("loads the task type into effective settings before runtime initialization", async () => {
			const plugin = createMockPlugin();
			const resources = buildTaskNotesMdbaseResources({
				tasksFolder: "Canonical/Tasks",
				modelConfig: {
					fieldMapping: { status: "state" },
					statuses: [
						{
							id: "queued",
							value: "queued",
							label: "Queued",
							color: "#777777",
							isCompleted: false,
							order: 0,
							autoArchive: false,
							autoArchiveDelay: 5,
						},
						{
							id: "done",
							value: "done",
							label: "Done",
							color: "#00aa00",
							isCompleted: true,
							order: 1,
							autoArchive: false,
							autoArchiveDelay: 5,
						},
					],
					defaults: { status: "queued" },
				},
			});
			plugin.app.vault.adapter.exists.mockImplementation((path: string) =>
				Promise.resolve(
					path === "mdbase.yaml" || path === "_types" || path === "_types/task.md"
				)
			);
			plugin.app.vault.adapter.read.mockImplementation((path: string) =>
				Promise.resolve(
					path === "mdbase.yaml"
						? 'spec_version: "0.3.0"\nsettings:\n  types_folder: _types\n'
						: resources.typeDocument
				)
			);
			const service = new MdbaseSpecService(plugin);

			await service.initialize();

			expect(plugin.settings.tasksFolder).toBe("Canonical/Tasks");
			expect(plugin.settings.fieldMapping.status).toBe("state");
			expect(plugin.settings.defaultTaskStatus).toBe("queued");
			expect(
				plugin.settings.customStatuses.map((status: { value: string }) => status.value)
			).toEqual(["queued", "done"]);
			expect(plugin.app.vault.adapter.write).not.toHaveBeenCalled();
			expect(plugin.registerEvent).toHaveBeenCalledTimes(4);
		});

		it("adopts an existing canonical type before creating missing collection metadata", async () => {
			const plugin = createMockPlugin();
			const resources = buildTaskNotesMdbaseResources({
				tasksFolder: "Existing/Tasks",
			});
			plugin.app.vault.adapter.exists.mockImplementation((path: string) =>
				Promise.resolve(path === "_types" || path === "_types/task.md")
			);
			plugin.app.vault.adapter.read.mockResolvedValue(resources.typeDocument);
			const service = new MdbaseSpecService(plugin);

			await service.initialize();

			expect(plugin.settings.tasksFolder).toBe("Existing/Tasks");
			expect(plugin.app.vault.adapter.write).not.toHaveBeenCalled();
			expect(plugin.app.vault.create).toHaveBeenCalledWith("mdbase.yaml", expect.any(String));
			expect(plugin.app.vault.create).not.toHaveBeenCalledWith(
				"_types/task.md",
				expect.any(String)
			);
		});

		it("does not overwrite a non-TaskNotes task type when creating the canonical contract", async () => {
			const plugin = createMockPlugin();
			const unrelatedType = [
				"---",
				"kind: mdbase.type",
				"name: task",
				"version: 1",
				"schema:",
				"  dialect: json-schema-2020-12",
				"  value:",
				"    type: object",
				"    properties: {}",
				"---",
				"",
			].join("\n");
			plugin.app.vault.adapter.exists.mockImplementation((path: string) =>
				Promise.resolve(
					path === "mdbase.yaml" || path === "_types" || path === "_types/task.md"
				)
			);
			plugin.app.vault.adapter.list.mockResolvedValue({
				files: ["_types/task.md"],
				folders: [],
			});
			plugin.app.vault.adapter.read.mockImplementation((path: string) =>
				Promise.resolve(path === "mdbase.yaml" ? 'spec_version: "0.3.0"' : unrelatedType)
			);
			const service = new MdbaseSpecService(plugin);

			await service.initialize();

			expect(plugin.app.vault.adapter.write).not.toHaveBeenCalledWith(
				"_types/task.md",
				expect.any(String)
			);
			expect(plugin.app.vault.create).toHaveBeenCalledWith(
				"_types/tasknotes-task.md",
				expect.stringContaining("name: tasknotes-task")
			);
		});

		it("discovers a custom TaskNotes type and writes settings back to that file", async () => {
			const plugin = createMockPlugin();
			const typePath = "System/_types/work-item.md";
			const resources = buildTaskNotesMdbaseResources({
				typeName: "work-item",
				typesFolder: "System/_types",
			});
			plugin.app.vault.adapter.exists.mockImplementation((path: string) =>
				Promise.resolve(
					path === "mdbase.yaml" ||
						path === "System" ||
						path === "System/_types" ||
						path === typePath
				)
			);
			plugin.app.vault.adapter.list.mockResolvedValue({
				files: [typePath],
				folders: [],
			});
			plugin.app.vault.adapter.read.mockImplementation((path: string) =>
				Promise.resolve(
					path === "mdbase.yaml"
						? 'spec_version: "0.3.0"\nsettings:\n  types_folder: System/_types\n'
						: resources.typeDocument
				)
			);
			const service = new MdbaseSpecService(plugin);
			await service.initialize();
			plugin.settings.maintainDueDateOffsetInRecurring = false;

			await service.onSettingsChanged();

			expect(plugin.app.vault.adapter.write).toHaveBeenCalledWith(
				typePath,
				expect.stringContaining("maintain_due_date_offset: false")
			);
		});

		it("restores a canonical type that is deleted while the integration is enabled", async () => {
			const plugin = createMockPlugin();
			const resources = buildTaskNotesMdbaseResources();
			const files = new Map<string, string>([
				["mdbase.yaml", 'spec_version: "0.3.0"\nsettings:\n  types_folder: _types\n'],
				["_types/task.md", resources.typeDocument],
			]);
			plugin.emitter = { trigger: jest.fn() };
			plugin.app.vault.adapter.exists.mockImplementation((path: string) =>
				Promise.resolve(path === "_types" || files.has(path))
			);
			plugin.app.vault.adapter.list.mockImplementation(() =>
				Promise.resolve({
					files: [...files.keys()].filter((path) => path.startsWith("_types/")),
					folders: [],
				})
			);
			plugin.app.vault.adapter.read.mockImplementation((path: string) =>
				Promise.resolve(files.get(path) ?? "")
			);
			plugin.app.vault.create.mockImplementation((path: string, content: string) => {
				files.set(path, content);
				return Promise.resolve({});
			});
			const service = new MdbaseSpecService(plugin);
			await service.initialize();
			files.delete("_types/task.md");

			await (service as any).reconcileCanonicalType();

			expect(plugin.app.vault.create).toHaveBeenCalledWith(
				"_types/task.md",
				expect.stringContaining("contract: tasknotes.task")
			);
			expect(plugin.emitter.trigger).toHaveBeenCalledWith(
				"user-notice",
				expect.objectContaining({
					message: expect.stringContaining("restored the missing canonical type"),
				})
			);
		});

		it("restores a deleted mdbase.yaml without requiring a portable settings change", async () => {
			const plugin = createMockPlugin();
			const resources = buildTaskNotesMdbaseResources({
				typesFolder: "System/_types",
			});
			const files = new Map<string, string>([
				[
					"mdbase.yaml",
					'spec_version: "0.3.0"\nsettings:\n  types_folder: System/_types\n',
				],
				["System/_types/task.md", resources.typeDocument],
			]);
			plugin.emitter = { trigger: jest.fn() };
			plugin.app.vault.adapter.exists.mockImplementation((path: string) =>
				Promise.resolve(path === "System" || path === "System/_types" || files.has(path))
			);
			plugin.app.vault.adapter.list.mockImplementation(() =>
				Promise.resolve({
					files: [...files.keys()].filter((path) => path.startsWith("System/_types/")),
					folders: [],
				})
			);
			plugin.app.vault.adapter.read.mockImplementation((path: string) =>
				Promise.resolve(files.get(path) ?? "")
			);
			plugin.app.vault.create.mockImplementation((path: string, content: string) => {
				files.set(path, content);
				return Promise.resolve({});
			});
			const service = new MdbaseSpecService(plugin);
			await service.initialize();
			files.delete("mdbase.yaml");

			await (service as any).reconcileCanonicalType();

			expect(plugin.app.vault.create).toHaveBeenCalledWith(
				"mdbase.yaml",
				expect.stringContaining("types_folder: System/_types")
			);
			expect(plugin.app.vault.create).not.toHaveBeenCalledWith(
				"_types/task.md",
				expect.any(String)
			);
			expect(plugin.emitter.trigger).toHaveBeenCalledWith(
				"user-notice",
				expect.objectContaining({
					message: expect.stringContaining("restored the missing canonical mdbase.yaml"),
				})
			);
		});
	});
});
