/**
 * Unit tests for MdbaseSpecService
 *
 * Validates v0.3 generation and the retained v0.2 compatibility path.
 */

import { buildTaskNotesMdbaseResources } from "@tasknotes/model/mdbase";
import * as fs from "fs";
import { Notice, TFile } from "obsidian";
import * as path from "path";
import YAML from "yaml";
import { observeTranslation } from "../../helpers/real-i18n";

import { MDBASE_README } from "../../../src/services/mdbase/folders";
import { compileRecordSchema, validateTaskRecord } from "../../../src/services/mdbase/contractValidation";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { MdbaseSpecService } from "../../../src/services/MdbaseSpecService";
import { canonicalTaskNotesResources, TASKNOTES_MDBASE_TYPE_VERSION, TASKNOTES_TASK_CONTRACT_VERSION } from "../../../src/services/canonicalTaskNotesPack";
import { appSettingsFromPluginSettings } from "../../../src/services/mdbaseCanonicalConfig";
import {
	DEFAULT_FIELD_MAPPING,
	DEFAULT_NLP_TRIGGERS,
	DEFAULT_PRIORITIES,
	DEFAULT_STATUSES,
} from "../../../src/settings/defaults";
import { FieldMapping } from "../../../src/types";
import { combineDateAndTime } from "../../../src/utils/dateUtils";

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
			candidate.contract === "tasknotes.task" &&
			candidate.version === TASKNOTES_TASK_CONTRACT_VERSION
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
		i18n: { translate: observeTranslation() },
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

function installMemoryVault(
	plugin: any,
	entries: Record<string, string>,
	options: {
		failWrite?: (path: string, content: string) => boolean;
	} = {}
): Map<string, string> {
	const files = new Map(Object.entries(entries));
	const folders = new Set<string>();
	const addParents = (path: string) => {
		const parts = path.split("/").slice(0, -1);
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			folders.add(current);
		}
	};
	for (const path of files.keys()) addParents(path);

	plugin.app.vault.adapter.exists.mockImplementation((path: string) =>
		Promise.resolve(files.has(path) || folders.has(path))
	);
	plugin.app.vault.adapter.read.mockImplementation((path: string) => {
		const content = files.get(path);
		if (content === undefined) return Promise.reject(new Error(`Missing file: ${path}`));
		return Promise.resolve(content);
	});
	plugin.app.vault.adapter.write.mockImplementation((path: string, content: string) => {
		if (options.failWrite?.(path, content)) {
			return Promise.reject(new Error(`Injected write failure: ${path}`));
		}
		files.set(path, content);
		addParents(path);
		return Promise.resolve();
	});
	plugin.app.vault.adapter.rename = jest.fn().mockImplementation((from: string, to: string) => {
		const content = files.get(from);
		if (content === undefined) return Promise.reject(new Error(`Missing file: ${from}`));
		if (options.failWrite?.(to, content)) return Promise.reject(new Error(`Injected rename failure: ${to}`));
		files.set(to, content);
		files.delete(from);
		addParents(to);
		return Promise.resolve();
	});
	plugin.app.vault.adapter.remove = jest.fn().mockImplementation((path: string) => {
		files.delete(path);
		return Promise.resolve();
	});
	plugin.app.vault.adapter.list.mockImplementation((folder: string) => {
		const prefix = folder ? `${folder}/` : "";
		const listedFiles = [...files.keys()].filter((path) => {
			if (!path.startsWith(prefix)) return false;
			return !path.slice(prefix.length).includes("/");
		});
		const listedFolders = [...folders].filter((path) => {
			if (!path.startsWith(prefix) || path === folder) return false;
			return !path.slice(prefix.length).includes("/");
		});
		return Promise.resolve({ files: listedFiles, folders: listedFolders });
	});
	plugin.app.vault.getAbstractFileByPath = jest.fn().mockImplementation((path: string) =>
		files.has(path) ? new TFile(path) : null
	);
	plugin.app.vault.process = jest.fn().mockImplementation(
		(file: { path: string }, update: (content: string) => string) => {
			const current = files.get(file.path);
			if (current === undefined) return Promise.reject(new Error(`Missing file: ${file.path}`));
			let content: string;
			try {
				content = update(current);
			} catch (error) {
				return Promise.reject(error);
			}
			if (options.failWrite?.(file.path, content)) {
				return Promise.reject(new Error(`Injected process failure: ${file.path}`));
			}
			files.set(file.path, content);
			return Promise.resolve(content);
		}
	);
	plugin.app.vault.create.mockImplementation((path: string, content: string) => {
		if (files.has(path)) return Promise.reject(new Error(`File exists: ${path}`));
		if (options.failWrite?.(path, content)) {
			return Promise.reject(new Error(`Injected create failure: ${path}`));
		}
		files.set(path, content);
		addParents(path);
		return Promise.resolve({ path });
	});
	plugin.app.vault.createFolder.mockImplementation((path: string) => {
		folders.add(path);
		addParents(`${path}/child`);
		return Promise.resolve();
	});

	return files;
}

function v02Config(typesFolder = "_types"): string {
	return YAML.stringify({
		spec_version: "0.2.1",
		name: "TaskNotes",
		description: "Task collection managed by TaskNotes for Obsidian",
		settings: {
			types_folder: typesFolder,
			validation: "warn",
			explicit_type_keys: ["type", "types"],
		},
	});
}

describe("MdbaseSpecService", () => {
	describe("write-capable collection upgrades", () => {
		it.each([undefined, [], ["record_kind"], ["type", "types"]])(
			"preserves effective existing membership: %j", async (keys) => {
				const plugin = createMockPlugin();
				const service = new MdbaseSpecService(plugin);
				const config = asObject(YAML.parse(v02Config()));
				asObject(config.settings).explicit_type_keys = keys;
				const literature = "---\ntype: article-journal\ntitle: Preserve me\n---\n";
				const files = installMemoryVault(plugin, {
					"mdbase.yaml": YAML.stringify(config),
					"_types/task.md": service.buildTaskTypeDef("0.2.1"),
					"paper.md": literature,
				});
				await service.initialize();
				const migrated = asObject(YAML.parse(files.get("mdbase.yaml")!));
				expect(migrated.spec_version).toBe("0.3.0");
				expect(asObject(migrated.settings).explicit_type_keys).toEqual(keys ?? ["type", "types"]);
				expect(files.get("paper.md")).toBe(literature);
				const snapshot = new Map(files);
				await new MdbaseSpecService(plugin).initialize();
				expect(files).toEqual(snapshot);
			}
		);

		it.each(["tasknotes-task", "custom-task", "nested-task"])("targets its own chosen type identity: %s", (name) => {
			const service = new MdbaseSpecService(createMockPlugin());
			const resources = (service as unknown as {
				buildCanonicalMdbaseResources(folder: string, legacy: boolean, typeName: string): { typeDocument: string };
			}).buildCanonicalMdbaseResources("_types", false, name);
			const document = YAML.parse(resources.typeDocument.split("---")[1]);
			expect(document.collection.links.recurrence_parent.target_type).toBe(name);
			expect(document.collection.links["blockedBy[].uid"].target_type).toBe(name);
		});

		it("recognizes v4 plain enum scalars rather than requiring v5 quotation bytes", async () => {
			const plugin = createMockPlugin();
			const service = new MdbaseSpecService(plugin);
			const legacy = service.buildTaskTypeDef("0.2.0").replace(/"(none|open|in-progress|done|low|normal|high|scheduled|completion|manual|on_completion|rolling|completion_or_skip|absolute|relative|due)"/g, "$1");
			const files = installMemoryVault(plugin, {
				"mdbase.yaml": v02Config(),
				"_types/task.md": legacy,
			});
			await service.initialize();
			expect(files.get("mdbase.yaml")).toContain("0.3.0");
			expect(files.get("_types/task.md")).toContain("kind: mdbase.type");
			expect([...files.entries()].some(([path, value]) => path.endsWith("task.md.bak") && value === legacy)).toBe(true);
		});

		it("installs missing pack resources for an existing v0.3 provider", async () => {
			const plugin = createMockPlugin();
			const service = new MdbaseSpecService(plugin);
			const files = installMemoryVault(plugin, {
				"mdbase.yaml": 'spec_version: "0.3.0"\nsettings:\n  explicit_type_keys: []\n',
				"_types/task.md": service.buildTaskTypeDef("0.3.0"),
			});
			await service.initialize();
			expect(asObject(asObject(YAML.parse(files.get("mdbase.yaml")!)).settings).explicit_type_keys).toEqual([]);
			expect(files.get("_contracts/tasknotes.task/0.3.0-rc.7.md")).toContain("contract_type: record");
			// The schemas are tasknotes.task type-pack resources: an app installs them.
			expect(files.has("_schemas/tasknotes/tasknotes-task.schema.json")).toBe(false);
			expect(files.has("_schemas/tasknotes/tasknotes-task-binding.schema.json")).toBe(false);
			const snapshot = new Map(files);
			await new MdbaseSpecService(plugin).initialize();
			expect(files).toEqual(snapshot);
		});

		it("updates schema files an earlier TaskNotes wrote but never creates or overwrites others", async () => {
			const legacy = JSON.parse(
				fs.readFileSync(path.join(__dirname, "../../fixtures/mdbase-upgrades/beta0-default.json"), "utf8")
			).files as Record<string, string>;
			const taskSchema = "_schemas/tasknotes/tasknotes-task.schema.json";
			const bindingSchema = "_schemas/tasknotes/tasknotes-task-binding.schema.json";
			const plugin = createMockPlugin();
			const service = new MdbaseSpecService(plugin);
			const files = installMemoryVault(plugin, {
				"mdbase.yaml": 'spec_version: "0.3.0"\nsettings:\n  explicit_type_keys: []\n',
				"_types/task.md": service.buildTaskTypeDef("0.3.0"),
				[taskSchema]: legacy[taskSchema],
			});
			await service.initialize();
			const current = canonicalTaskNotesResources.find(
				({ source }) => source === `schemas/tasknotes.task/${TASKNOTES_TASK_CONTRACT_VERSION}.schema.json`
			)?.document;
			expect(current).toBeDefined();
			expect(legacy[taskSchema]).not.toBe(current);
			expect(files.get(taskSchema)).toBe(current);
			expect(files.has(bindingSchema)).toBe(false);

			const custom = '{"title":"Edited"}\n';
			files.set(bindingSchema, custom);
			await new MdbaseSpecService(plugin).initialize();
			expect(files.get(taskSchema)).toBe(current);
			expect(files.get(bindingSchema)).toBe(custom);
		});

		it("preserves foreign support resources without creating partial support files", async () => {
			const plugin = createMockPlugin();
			const files = installMemoryVault(plugin, {
				"_mdbase/contracts/tasknotes.task.md": "User-maintained contract\n",
			});
			await new MdbaseSpecService(plugin).initialize();
			expect(files.get("_mdbase/contracts/tasknotes.task.md")).toBe("User-maintained contract\n");
			expect(files.has("mdbase.yaml")).toBe(false);
			expect(files.has("_mdbase/_schemas/tasknotes/tasknotes-task.schema.json")).toBe(false);
		});

		it("does not bypass a refused migration on settings save or manual generation", async () => {
			const plugin = createMockPlugin();
			const service = new MdbaseSpecService(plugin);
			const files = installMemoryVault(plugin, {
				"mdbase.yaml": v02Config(),
				"_types/task.md": service.buildTaskTypeDef("0.2.1") + "\nUser-owned content\n",
			});
			const before = new Map(files);
			await service.initialize();
			await service.onSettingsChanged();
			await service.generate();
			expect(files).toEqual(before);
		});
	});


  it("generates byte-identical English schemas/data across all UI languages", () => {
    const service = new MdbaseSpecService(createMockPlugin());
    observeTranslation("en");
    const expected = [service.buildMdbaseYaml(), service.buildTaskTypeDef()];
    for (const locale of ["de", "es", "fr", "it", "ja", "ko", "pt", "ru", "zh", "en"]) {
      observeTranslation(locale);
      const actual = [service.buildMdbaseYaml(), service.buildTaskTypeDef()];
      expect(actual).toEqual(expected);
      expect(YAML.parse(actual[0]).description).toBe("Task collection managed by TaskNotes for Obsidian");
      expect(YAML.parse(extractFrontmatter(actual[1])).description).toBe("A task managed by TaskNotes.");
    }
  });
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

		it("should explicitly set the new metadata folders", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const config = asObject(YAML.parse(service.buildMdbaseYaml()));

			expect(asObject(config.settings).types_folder).toBe("_mdbase/types");
			expect(asObject(config.settings).contracts_folder).toBe("_mdbase/contracts");
		});

		it("should use warning validation and Markdown records", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const settings = asObject(asObject(YAML.parse(service.buildMdbaseYaml())).settings);

			expect(settings.record_extensions).toEqual(["md", "base"]);
			expect(settings.validation).toBe("warn");
			expect(settings.explicit_type_keys).toEqual(["mdbase_type"]);
			expect(settings.id_field).toBe("id");
		});

		it("should exclude the configured types folder", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const settings = asObject(asObject(YAML.parse(service.buildMdbaseYaml())).settings);

			expect(settings.exclude).toEqual(["_mdbase/types"]);
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
			// rc.6: capture triggers are app settings, kept in the settings record.
			expect(tasknotesBinding(canonicalFrontmatter).nlp).toBeUndefined();
			expect(appSettingsFromPluginSettings(service["plugin"].settings).nlp_triggers).toEqual(triggers);
		});

		it("exports an empty trigger list when capture triggers are unavailable", () => {
			const service = new MdbaseSpecService(createMockPlugin({ nlpTriggers: undefined }));
			const legacyFrontmatter = YAML.parse(
				extractFrontmatter(service.buildTaskTypeDef("0.2.0"))
			);
			const canonicalFrontmatter = parseFrontmatter(service.buildTaskTypeDef());

			expect(legacyFrontmatter["x-tasknotes"].nlp.triggers).toEqual([]);
			expect(tasknotesBinding(canonicalFrontmatter).nlp).toBeUndefined();
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
		it.each([false, true])("validates TaskNotes-written times (legacy layout: %s)", (legacyCompatibility) => {
			const service = new MdbaseSpecService(createMockPlugin());
			const type = parseFrontmatter(service.buildTaskTypeDef("0.3.0", { legacyCompatibility }));
			const validate = compileRecordSchema(asObject(type.schema).value);
			const base = { status: "open", dateCreated: "2026-11-20T10:00:00Z" };
			const timed = combineDateAndTime("2026-11-30", "16:00");
			expect(timed).toBe("2026-11-30T16:00");
			expect(validate({ ...base, scheduled: timed, due: timed })).toBe(true);
			expect(validate({ ...base, scheduled: "2026-11-30", due: "2026-11-30T16:00:00+11:00" })).toBe(true);
			expect(validate({ ...base, scheduled: "2026-11-30T16:00:00", due: "2026-11-30T16:00:59" })).toBe(true);
			expect(validate({ ...base, scheduled: "2026-11-30T25:00" })).toBe(false);
		});

		it("emits a JSON Schema type wrapper by default", () => {
			const service = new MdbaseSpecService(createMockPlugin());
			const frontmatter = parseFrontmatter(service.buildTaskTypeDef());
			const schemaWrapper = asObject(frontmatter.schema);
			const schema = asObject(schemaWrapper.value);
			const properties = asObject(schema.properties);

			expect(frontmatter.kind).toBe("mdbase.type");
			expect(frontmatter.name).toBe("task");
			expect(frontmatter.version).toBe(TASKNOTES_MDBASE_TYPE_VERSION);
			expect(schemaWrapper.dialect).toBe("json-schema-2020-12");
			expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
			expect(schema.additionalProperties).toBe(true);
			expect(schema.required).toEqual(["status", "dateCreated"]);
			for (const name of ["due", "scheduled", "dateCreated", "dateModified"]) {
				const formats = name === "due" || name === "scheduled"
					? ["date", "date-time", "local-date-time"]
					: ["date-time", "local-date-time"];
				expect(properties[name]).toEqual({ anyOf: formats.map((format) => ({ type: "string", format })) });
			}
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
				"assignees[]": { validate_exists: false },
				"attachments[]": { validate_exists: false },
				"projects[]": { validate_exists: false },
				occurrence_template: { validate_exists: false },
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
			expect(links["related_projects[]"]).toEqual({ validate_exists: false });
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
					"attachments",
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
				},
				occurrences: {
					identity_roles: ["recurrenceParent", "occurrenceDate"],
					default_materialization: "manual",
					default_next_trigger: "completion",
				},
				links: {
					accepted_formats: ["wikilink", "markdown"],
				},
				archive: {
					archived_tag: "filed-away",
				},
			});
			// rc.6: app behaviour is not part of the binding; it goes to the settings record.
			for (const moved of ["time_tracking", "templating", "nlp"]) expect(extension[moved]).toBeUndefined();
			expect(asObject(extension.recurrence).reset_body_checkboxes).toBeUndefined();
			expect(asObject(extension.links).write_format).toBeUndefined();
			expect(asObject(extension.archive).move_on_archive).toBeUndefined();
			expect(appSettingsFromPluginSettings(service["plugin"].settings)).toMatchObject({
				reset_body_checkboxes_on_recurrence: true,
				link_write_format: "markdown",
				move_on_archive: true,
				archive_folder: "Archive/Tasks",
				auto_stop_time_tracking_on_complete: false,
				template_enabled: true,
				template_path: "Templates/Task.md",
				occurrence_template_enabled: true,
				occurrence_template_path: "Templates/Occurrence.md",
				status_behavior: expect.objectContaining({
					done: expect.objectContaining({ auto_archive: true, auto_archive_delay_minutes: 15 }),
					cancelled: expect.objectContaining({ exclude_from_cycle: true }),
				}),
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
					}),
					expect.objectContaining({
						value: "cancelled",
						is_skipped: true,
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

	describe("local-date-time validation", () => {
		const validateLocalTime = compileRecordSchema({ type: "string", format: "local-date-time" });
		it.each([
			"2026-11-27T08:00", "2024-02-29T23:59:59.00123", "2000-02-29T00:00:00",
		])("accepts %s in both schema validators", (value) => {
			expect(validateLocalTime(value)).toBe(true);
			expect(validateTaskRecord({ status: "open", due: value, scheduled: value, dateCreated: value, dateModified: value })).toBe(true);
		});

		it.each([
			"2026-02-30T08:00", "2026-02-29T08:00", "1900-02-29T08:00", "2026-11-31T08:00",
			"2026-00-10T08:00", "2026-11-00T08:00", "2026-11-27T24:00", "2026-11-27T08:60",
			"2026-11-27T08:00:60", "2026-11-27T08:00.5", "2026-11-27T08:00:00.",
			"2026-11-27T08:00:00.１", "2026-11-27t08:00", "2026-11-27 08:00",
			"2026-11-27T08:00Z", "2026-11-27T08:00:00+11:00", "2026-11-27T08:00\n",
		])("rejects %s as a local date-time", (value) => {
			expect(validateLocalTime(value)).toBe(false);
		});
	});

	describe("collection time zone", () => {
		const config = [
			"spec_version: 0.3.0",
			"settings:",
			"  # Keep this setting and comment",
			"  record_extensions: [md, base]",
			"x-obsidian:",
			"  bases:",
			'    include: ["TaskNotes/Views/**/*.base"]',
			"x-other: preserve",
			"",
		].join("\n");
		it.each(["", "local", "+05:00", "Fake/Zone"])("omits an invalid detected zone (%s)", (timeZone) => {
			const resolved = Intl.DateTimeFormat().resolvedOptions();
			jest.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({ ...resolved, timeZone });
			const service = new MdbaseSpecService(createMockPlugin());
			expect(YAML.parse(service.buildMdbaseYaml()).settings.timezone).toBeUndefined();
		});

		it.each(["use", "dismiss", "concurrent"])("handles the %s action once, only writing on consent", async (action) => {
			const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
			const plugin = createMockPlugin();
			let offerResolved = false;
			plugin.app.loadLocalStorage = jest.fn(() => offerResolved);
			plugin.app.saveLocalStorage = jest.fn(() => { offerResolved = true; });
			const files = installMemoryVault(plugin, { "mdbase.yaml": config });
			const containerEl = document.createElement("div");
			const hide = jest.fn();
			const notice = jest.mocked(Notice);
			notice.mockClear();
			notice.mockImplementationOnce((message?: string | DocumentFragment) => {
				if (message) containerEl.append(message);
				return { hide, containerEl } as unknown as Notice;
			});
			const service = new MdbaseSpecService(plugin);

			await service.initialize();
			await service.onSettingsChanged();
			expect(files.get("mdbase.yaml")).toBe(config);
			expect(notice).toHaveBeenCalledTimes(1);
			const [useZone, dismiss] = containerEl.querySelectorAll("button");
			expect(useZone.textContent).toBe(`Use ${zone}`);
			expect(containerEl.textContent).toContain("Times without an offset will be read in that zone.");
			if (action === "concurrent") {
				files.set("mdbase.yaml", config.replace("  record_extensions", "  timezone: Pacific/Auckland\n  record_extensions"));
			}
			(action === "dismiss" ? dismiss : useZone).click();
			await service.onSettingsChanged();
			expect(hide).toHaveBeenCalledTimes(1);
			expect(offerResolved).toBe(true);
			const after = files.get("mdbase.yaml")!;
			if (action === "dismiss") expect(after).toBe(config);
			else expect(YAML.parse(after).settings.timezone).toBe(action === "use" ? zone : "Pacific/Auckland");
			expect(after).toContain("  # Keep this setting and comment");
			expect(after).toContain("x-other: preserve");
			await new MdbaseSpecService(plugin).initialize();
			expect(notice).toHaveBeenCalledTimes(1);
		});

		it("preserves a configured time zone without showing an offer", async () => {
			const plugin = createMockPlugin();
			const original = config.replace("  record_extensions", "  timezone: Asia/Tokyo\n  record_extensions");
			const files = installMemoryVault(plugin, { "mdbase.yaml": original });
			jest.mocked(Notice).mockClear();
			await new MdbaseSpecService(plugin).initialize();
			expect(Notice).not.toHaveBeenCalled();
			expect(files.get("mdbase.yaml")).toBe(original);
		});
	});

	describe("generate", () => {
		it.each([
			{ legacyCompatibility: false, post2706: false },
			{ legacyCompatibility: false, post2706: true },
			{ legacyCompatibility: true, post2706: false },
			{ legacyCompatibility: true, post2706: true },
		])("upgrades mapped dates and preserves custom rules and aliases (legacy: $legacyCompatibility, post-2706: $post2706)", async ({ legacyCompatibility, post2706 }) => {
			const plugin = createMockPlugin();
			const resources = buildTaskNotesMdbaseResources({
				legacyCompatibility,
				modelConfig: { fieldMapping: { due: "deadline", scheduled: "planned", dateCreated: "created", dateModified: "modified" } },
			});
			const type = parseFrontmatter(resources.typeDocument);
			const properties = asObject(asObject(asObject(type.schema).value).properties);
			const originalDue = asObject(properties.deadline);
			const originalAlternatives = originalDue.anyOf as unknown[];
			const branches = legacyCompatibility ? asObject(originalAlternatives[0]).anyOf as unknown[] : originalAlternatives;
			if (post2706) branches.push({
				type: "string",
				pattern: "^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$",
			});
			properties.custom_date = originalDue;
			properties.custom_date_branch = originalAlternatives[0];
			properties.planned = { ...asObject(properties.planned), description: "Collection's own rule" };
			const markdown = `---\n${YAML.stringify(type)}---\nCustom body\n`;
			const path = "_mdbase/types/task.md";
			const files = installMemoryVault(plugin, { "mdbase.yaml": resources.configDocument, [path]: markdown });
			await new MdbaseSpecService(plugin).initialize();

			const migrated = files.get(path)!;
			const current = parseFrontmatter(migrated);
			const adjusted = asObject(asObject(asObject(current.schema).value).properties);
			expect(compileRecordSchema(adjusted.deadline)("2026-11-30T16:00")).toBe(true);
			expect(adjusted.planned).toEqual(properties.planned);
			expect(adjusted.custom_date).toEqual(originalDue);
			expect(adjusted.custom_date_branch).toEqual(originalAlternatives[0]);
			for (const name of ["deadline", "created", "modified"]) {
				const formats = name === "deadline" ? ["date", "date-time", "local-date-time"] : ["date-time", "local-date-time"];
				const anyOf: object[] = formats.map((format) => ({ type: "string", format }));
				if (legacyCompatibility && name !== "created") anyOf.push({ type: "null" });
				expect(adjusted[name]).toEqual({ anyOf });
			}
			expect(tasknotesImplementation(current).fields).toMatchObject({ due: "deadline", dateCreated: "created" });
			expect(current.version).toBe(6);
			expect(extractBody(migrated)).toBe("Custom body\n");
			await new MdbaseSpecService(plugin).initialize();
			expect(files.get(path)).toBe(migrated);
		});

		it("updates schema.value.required cleanly across one and two successive core property renames while keeping custom required properties", async () => {
			const plugin = createMockPlugin();
			const files = installMemoryVault(plugin, {});
			const service = new MdbaseSpecService(plugin);
			await service.initialize();

			// Add a hand-authored custom required property to the generated type.
			const typePath = "_mdbase/types/task.md";
			const initial = parseFrontmatter(files.get(typePath)!);
			const initialSchema = asObject(asObject(initial.schema).value);
			asObject(initialSchema.properties).client_meta = {
				type: "object",
				properties: { code: { type: "string" } },
			};
			initialSchema.required = [...(initialSchema.required as string[]), "client_meta"];
			files.set(typePath, `---\n${YAML.stringify(initial)}---\nCustom body\n`);

			// Re-initialize so TaskNotes adopts the hand-edited type.
			const synced = new MdbaseSpecService(plugin);
			await synced.initialize();

			// First rename: dateCreated -> created.
			plugin.settings.fieldMapping.dateCreated = "created";
			await synced.onSettingsChanged();
			const afterFirst = parseFrontmatter(files.get(typePath)!);
			const firstSchema = asObject(asObject(afterFirst.schema).value);
			expect(firstSchema.required).toEqual(["status", "created", "client_meta"]);
			expect(asObject(firstSchema.properties)).not.toHaveProperty("dateCreated");

			// Second rename: created -> createdOn.
			plugin.settings.fieldMapping.dateCreated = "createdOn";
			await synced.onSettingsChanged();
			const afterSecond = parseFrontmatter(files.get(typePath)!);
			const secondSchema = asObject(asObject(afterSecond.schema).value);
			expect(secondSchema.required).toEqual(["status", "createdOn", "client_meta"]);
			expect(asObject(secondSchema.properties)).not.toHaveProperty("dateCreated");
			expect(asObject(secondSchema.properties)).not.toHaveProperty("created");
			expect(
				compileRecordSchema(secondSchema)({
					status: "open",
					createdOn: "2026-11-27T10:00:00Z",
					client_meta: { code: "A1" },
				})
			).toBe(true);
			expect(
				compileRecordSchema(secondSchema)({
					status: "open",
					createdOn: "2026-11-27T10:00:00Z",
				})
			).toBe(false);
		});

		it("repairs an already-polluted required list on sync without user action while keeping custom required properties", async () => {
			const plugin = createMockPlugin();
			const resources = buildTaskNotesMdbaseResources({
				modelConfig: { fieldMapping: { dateCreated: "createdOn" } },
			});
			const polluted = parseFrontmatter(resources.typeDocument);
			const schema = asObject(asObject(polluted.schema).value);
			asObject(schema.properties).owner = {
				type: "object",
				properties: { handle: { type: "string" } },
			};
			schema.required = ["dateCreated", "status", "created", "createdOn", "owner"];
			const markdown = `---\n${YAML.stringify(polluted)}---\nCustom body\n`;
			const typePath = "_mdbase/types/task.md";
			const files = installMemoryVault(plugin, {
				"mdbase.yaml": resources.configDocument,
				[typePath]: markdown,
			});

			await new MdbaseSpecService(plugin).initialize();

			const repairedMarkdown = files.get(typePath)!;
			const repaired = parseFrontmatter(repairedMarkdown);
			const repairedSchema = asObject(asObject(repaired.schema).value);
			expect(repairedSchema.required).toEqual(["status", "createdOn", "owner"]);
			expect(extractBody(repairedMarkdown)).toBe("Custom body\n");
			expect(
				compileRecordSchema(repairedSchema)({
					status: "open",
					createdOn: "2026-11-27T10:00:00Z",
					owner: { handle: "team" },
				})
			).toBe(true);

			// Subsequent sync is idempotent.
			await new MdbaseSpecService(plugin).initialize();
			expect(files.get(typePath)).toBe(repairedMarkdown);
		});

		it("sets up a v4 vault with no config in the new layout using canonical support bytes", async () => {
			const plugin = createMockPlugin();
			const files = installMemoryVault(plugin, {});
			await new MdbaseSpecService(plugin).initialize();
			expect(YAML.parse(files.get("mdbase.yaml")!).settings).toMatchObject({
				types_folder: "_mdbase/types", contracts_folder: "_mdbase/contracts",
				timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			});
			expect(files.get("_mdbase/README.md")).toBe(MDBASE_README);
			const pack = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../vendor/mdbase-contracts/tasknotes.task-0.3.0-rc.23.json"), "utf8"));
			let compared = 0;
			for (const resource of pack.resources) {
				const entry = pack.manifest.resources.find((entry: { source: string }) => entry.source === resource.source);
				if (!entry) continue;
				const resolved = entry.target.replace(/^_types\//, "_mdbase/types/")
					.replace(/^_contracts\//, "_mdbase/contracts/")
					.replace(/^(schemas|_schemas)\//, "_mdbase/$1/");
				if (files.has(resolved) && entry.mode === "managed") {
					expect(files.get(resolved)).toBe(resource.document);
					compared++;
				}
			}
			expect(compared).toBe(7);
			expect(files.has("schemas/mdbase.app-settings/1.0.0.schema.json")).toBe(false);
		});

		it("preserves an existing README during new setup", async () => {
			const plugin = createMockPlugin();
			const files = installMemoryVault(plugin, { "_mdbase/README.md": "My README\n" });
			await new MdbaseSpecService(plugin).initialize();
			expect(files.get("_mdbase/README.md")).toBe("My README\n");
		});

		it.each([{}, { types_folder: "Custom/types", contracts_folder: "Custom/contracts" }])(
			"retains an existing layout and creates no README: %j", async (settings) => {
				const plugin = createMockPlugin();
				const original = YAML.stringify({ spec_version: "0.3.0", settings: { ...settings, record_extensions: ["md", "base"] }, "x-obsidian": { bases: { include: ["TaskNotes/Views/**/*.base"] } } });
				const files = installMemoryVault(plugin, { "mdbase.yaml": original });
				await new MdbaseSpecService(plugin).initialize();
				expect(files.get("mdbase.yaml")).toBe(original);
				expect(files.has("_mdbase/README.md")).toBe(false);
				expect(files.has(`${settings.types_folder ?? "_types"}/task.md`)).toBe(true);
				expect(files.has(`${settings.contracts_folder ?? "_contracts"}/tasknotes.task/0.3.0-rc.7.md`)).toBe(true);
			});

		it("should create _mdbase/types folder if it does not exist", async () => {
			const plugin = createMockPlugin();
			plugin.app.vault.adapter.exists.mockResolvedValue(false);
			const service = new MdbaseSpecService(plugin);

			await service.generate();

			expect(plugin.app.vault.createFolder).toHaveBeenCalledWith("_mdbase/types");
		});

		it("should not create _mdbase/types folder if it already exists", async () => {
			const plugin = createMockPlugin();
			plugin.app.vault.adapter.exists.mockImplementation((path: string) =>
				Promise.resolve(path === "_mdbase/types")
			);
			const service = new MdbaseSpecService(plugin);

			await service.generate();

			expect(plugin.app.vault.createFolder).not.toHaveBeenCalledWith("_mdbase/types");
		});

		it("should use the types_folder from an existing mdbase.yaml", async () => {
			const plugin = createMockPlugin();
			const files = installMemoryVault(plugin, {
				"mdbase.yaml": YAML.stringify({ spec_version: "0.3.0", settings: { types_folder: "System/_types" } }),
			});
			const service = new MdbaseSpecService(plugin);

			await service.generate();

			expect(plugin.app.vault.createFolder).toHaveBeenCalledWith("System");
			expect(plugin.app.vault.createFolder).toHaveBeenCalledWith("System/_types");
			expect(files.get("System/_types/task.md")).toContain("contract: tasknotes.task");
			expect(plugin.app.vault.create).not.toHaveBeenCalledWith(
				"mdbase.yaml",
				expect.any(String)
			);
		});

		it("should fall back to _types when mdbase.yaml has an unsafe types_folder", async () => {
			const plugin = createMockPlugin();
			const files = installMemoryVault(plugin, {
				"mdbase.yaml": YAML.stringify({ spec_version: "0.3.0", settings: { types_folder: "../outside" } }),
			});
			const service = new MdbaseSpecService(plugin);

			await service.generate();

			expect(plugin.app.vault.createFolder).toHaveBeenCalledWith("_types");
			expect(files.get("_types/task.md")).toContain("contract: tasknotes.task");
			expect(files.get("_contracts/tasknotes.task/0.3.0-rc.7.md")).toContain("kind: mdbase.contract");
			expect([...files.keys()].some((path) => path.startsWith("_schemas/"))).toBe(false);
		});

		it("should create new files when they do not exist", async () => {
			const plugin = createMockPlugin();
			const files = installMemoryVault(plugin, {});
			const service = new MdbaseSpecService(plugin);

			await service.generate();

			expect(parseFrontmatter(files.get("_mdbase/types/task.md")!).kind).toBe("mdbase.type");
			expect(asObject(YAML.parse(files.get("mdbase.yaml")!)).spec_version).toBe("0.3.0");
			expect(plugin.app.vault.adapter.rename).toHaveBeenCalled();
		});

		it("uses the configured contracts folder for the canonical contract", async () => {
			const plugin = createMockPlugin();
			const files = installMemoryVault(plugin, {
				"mdbase.yaml": YAML.stringify({ spec_version: "0.3.0", settings: { types_folder: "_types", contracts_folder: "System/contracts" } }),
			});
			const service = new MdbaseSpecService(plugin);

			await service.generate();

			expect(files.get("System/contracts/tasknotes.task/0.3.0-rc.7.md")).toContain("id: tasknotes.task");
		});

		it("does not overwrite unrecognized v0.2 metadata during generation", async () => {
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
			expect(typeWrite).toBeUndefined();
			expect(plugin.app.vault.adapter.write).not.toHaveBeenCalled();
		});

		it("should regenerate v0.3 types for an existing v0.3 collection", async () => {
			const plugin = createMockPlugin();
			const files = installMemoryVault(plugin, {
				"mdbase.yaml": 'spec_version: "0.3.0"',
				"_types/task.md": buildTaskNotesMdbaseResources().typeDocument,
			});
			const service = new MdbaseSpecService(plugin);

			await service.generate();

			const typeWrite = plugin.app.vault.adapter.write.mock.calls.find(
				([path]: [string]) => path === "_types/task.md"
			);
			expect(typeWrite).toBeUndefined(); // Adopt existing canonical settings rather than regenerate them.
			expect(files.get("mdbase.yaml")).toContain("record_extensions");
			expect(YAML.parse(files.get("mdbase.yaml")!).settings.explicit_type_keys).toBeUndefined();
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
			expect(typeWrite).toBeUndefined();
			const frontmatter = parseFrontmatter(await plugin.app.vault.adapter.read("_types/task.md"));
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

			expect(plugin.app.vault.adapter.write.mock.calls.some(
				([path]: [string]) => path === "_types/task.md"
			)).toBe(false);
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
			const files = installMemoryVault(plugin, {});
			const service = new MdbaseSpecService(plugin);

			await service.onSettingsChanged();

			expect(files.has("_mdbase/types/task.md")).toBe(true);
			expect(files.has("mdbase.yaml")).toBe(true);
		});

		it("does not treat its own first setup writes as outside edits", async () => {
			const plugin = createMockPlugin({ enableMdbaseSpec: true });
			const files = installMemoryVault(plugin, {});
			const service = new MdbaseSpecService(plugin);
			const unguardedWrites: string[] = [];
			const write = plugin.app.vault.adapter.write.getMockImplementation();
			plugin.app.vault.adapter.write.mockImplementation((path: string, content: string) => {
				if (!(service as any).writeInProgress) unguardedWrites.push(path);
				return write(path, content);
			});

			await service.onSettingsChanged();

			expect(files.has("mdbase.yaml")).toBe(true);
			expect(unguardedWrites).toEqual([]);
		});
	});

	describe("canonical v0.3 configuration", () => {
		it("preserves an external edit made between the compared snapshot and the atomic write", async () => {
			const plugin = createMockPlugin();
			const service = new MdbaseSpecService(plugin);
			const path = "_types/task.md";
			const original = service.buildTaskTypeDef();
			const files = installMemoryVault(plugin, { [path]: original });
			const move = plugin.app.vault.adapter.rename.getMockImplementation();
			plugin.app.vault.adapter.rename.mockImplementation((from: string, to: string) => {
				if (from === path && to.startsWith(".tasknotes/migrations/metadata-swaps/")) files.set(path, original + "\nExternal body edit\n");
				return move(from, to);
			});
			const reconcile = jest.spyOn(service as any, "requestReconciliation").mockImplementation(() => {});
			const resources = (service as any).buildCanonicalMdbaseResources("_types", false, "task", "_contracts");
			await expect((service as any).writeCanonicalType(path, resources, true, original)).rejects.toThrow("Concurrent metadata change");
			expect(files.get(path)).toBe(original + "\nExternal body edit\n");
			expect(reconcile).toHaveBeenCalledTimes(1);
		});

		it("aborts rather than using a non-atomic adapter write for an unindexed canonical file", async () => {
			const plugin = createMockPlugin();
			const service = new MdbaseSpecService(plugin);
			const path = "_types/task.md";
			const original = service.buildTaskTypeDef();
			const files = installMemoryVault(plugin, { [path]: original });
			plugin.app.vault.adapter.rename = undefined; // No adapter-level atomic replacement.
			plugin.app.vault.getAbstractFileByPath.mockReturnValue(null);
			jest.spyOn(service as any, "requestReconciliation").mockImplementation(() => {});
			const resources = (service as any).buildCanonicalMdbaseResources("_types", false, "task", "_contracts");
			await expect((service as any).writeCanonicalType(path, resources, true, original)).rejects.toThrow("move unavailable");
			expect(files.get(path)).toBe(original);
			expect(plugin.app.vault.adapter.write).not.toHaveBeenCalled();
		});

		it("serializes canonical writers, including recovery after a failed write", async () => {
			const plugin = createMockPlugin();
			const service = new MdbaseSpecService(plugin);
			let release!: () => void;
			const gate = new Promise<void>((resolve) => { release = resolve; });
			const write = jest.spyOn(service as any, "writeCanonicalTypeSnapshot")
				.mockImplementationOnce(async () => { await gate; throw new Error("conflict"); })
				.mockResolvedValueOnce(true);
			const first = (service as any).writeCanonicalType("_types/task.md", {}, true);
			const second = (service as any).writeCanonicalType("_types/task.md", {}, true);
			await Promise.resolve();
			await Promise.resolve();
			expect(write).toHaveBeenCalledTimes(1);
			release();
			await expect(first).rejects.toThrow("conflict");
			await expect(second).resolves.toBe(true);
			expect(write).toHaveBeenCalledTimes(2);
		});
		it("keeps an invalid canonical type unchanged until repair is chosen, then creates a backup", async () => {
			const plugin = createMockPlugin();
			const invalidType = "---\nkind: mdbase.type\nname: task\nimplements: [\n---\n";
			const files = installMemoryVault(plugin, {
				"mdbase.yaml": 'spec_version: "0.3.0"\nsettings:\n  types_folder: _types\n',
				"_types/task.md": invalidType,
			});
			plugin.emitter = { trigger: jest.fn() };
			const service = new MdbaseSpecService(plugin);
			const conflict = jest.spyOn(service as any, "askConflict");
			conflict.mockResolvedValueOnce("type");

			await service.initialize();

			expect(files.get("_types/task.md")).toBe(invalidType);
			expect(
				[...files.keys()].filter((path) => path.includes(".tasknotes-backup-"))
			).toEqual([]);

			conflict.mockResolvedValueOnce("settings");
			await service.onSettingsChanged();

			const backups = [...files.entries()].filter(([path]) =>
				path.startsWith("_types/task.md.tasknotes-backup-")
			);
			expect(backups).toHaveLength(1);
			expect(backups[0]?.[1]).toBe(invalidType);
			expect(files.get("_types/task.md")).toContain("contract: tasknotes.task");
			expect(plugin.emitter.trigger).toHaveBeenCalledWith(
				"user-notice",
				expect.objectContaining({ message: expect.stringContaining("backed up") })
			);
		});

		it.each([
			["type", "External/Tasks"],
			["settings", "Local/Tasks"],
		] as const)(
			"resolves concurrent canonical changes using the chosen %s source",
			async (choice, expectedTasksFolder) => {
				const plugin = createMockPlugin({ tasksFolder: "Initial/Tasks" });
				const service = new MdbaseSpecService(plugin);
				const initial = service.buildTaskTypeDef();
				const external = new MdbaseSpecService(
					createMockPlugin({ tasksFolder: "External/Tasks" })
				).buildTaskTypeDef();
				const files = installMemoryVault(plugin, {
					"mdbase.yaml": 'spec_version: "0.3.0"\nsettings:\n  types_folder: _types\n',
					"_types/task.md": initial,
				});
				await service.initialize();
				plugin.app.vault.adapter.write.mockClear();
				files.set("_types/task.md", external);
				plugin.settings.tasksFolder = "Local/Tasks";
				jest.spyOn(service as any, "askConflict").mockResolvedValue(choice);

				await service.onSettingsChanged();

				expect(plugin.settings.tasksFolder).toBe(expectedTasksFolder);
				if (choice === "type") {
					expect(plugin.app.vault.adapter.write).not.toHaveBeenCalledWith(
						"_types/task.md",
						expect.any(String)
					);
					expect(files.get("_types/task.md")).toBe(external);
				} else {
					expect(files.get("_types/task.md")).toContain("folder: Local/Tasks");
				}
			}
		);

		it("leaves canonical files untouched when the integration is disabled", async () => {
			const plugin = createMockPlugin();
			const resources = buildTaskNotesMdbaseResources();
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
			plugin.app.vault.adapter.exists.mockClear();
			plugin.app.vault.adapter.write.mockClear();
			plugin.app.vault.create.mockClear();
			plugin.app.vault.createFolder.mockClear();
			plugin.settings.enableMdbaseSpec = false;

			await service.onSettingsChanged();

			expect(plugin.app.vault.adapter.exists).not.toHaveBeenCalled();
			expect(plugin.app.vault.adapter.write).not.toHaveBeenCalled();
			expect(plugin.app.vault.create).not.toHaveBeenCalled();
			expect(plugin.app.vault.createFolder).not.toHaveBeenCalled();
		});

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
			const files = installMemoryVault(plugin, {
				"mdbase.yaml": 'spec_version: "0.3.0"\nsettings:\n  types_folder: _types\n',
				"_types/task.md": resources.typeDocument,
			});
			const service = new MdbaseSpecService(plugin);

			await service.initialize();

			expect(plugin.settings.tasksFolder).toBe("Canonical/Tasks");
			expect(plugin.settings.fieldMapping.status).toBe("state");
			expect(plugin.settings.defaultTaskStatus).toBe("queued");
			expect(
				plugin.settings.customStatuses.map((status: { value: string }) => status.value)
			).toEqual(["queued", "done"]);
			expect(files.get("mdbase.yaml")).toContain("record_extensions");
			expect(YAML.parse(files.get("mdbase.yaml")!).settings.explicit_type_keys).toBeUndefined();
			expect(plugin.registerEvent).toHaveBeenCalledTimes(4);
		});

		it("adopts an existing canonical type before creating missing collection metadata", async () => {
			const plugin = createMockPlugin();
			const existing = new MdbaseSpecService(
				createMockPlugin({ tasksFolder: "Existing/Tasks" })
			).buildTaskTypeDef();
			const files = installMemoryVault(plugin, { "_mdbase/types/task.md": existing });
			const service = new MdbaseSpecService(plugin);

			await service.initialize();

			expect(plugin.settings.tasksFolder).toBe("Existing/Tasks");
			expect(files.get("_mdbase/types/task.md")).toBe(existing);
			expect(files.get("mdbase.yaml")).toContain("spec_version: 0.3.0");
			expect(plugin.app.vault.create).not.toHaveBeenCalledWith(
				"_mdbase/types/task.md",
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
			const files = installMemoryVault(plugin, {
				"mdbase.yaml": 'spec_version: "0.3.0"',
				"_types/task.md": unrelatedType,
			});
			const service = new MdbaseSpecService(plugin);

			await service.initialize();

			expect(plugin.app.vault.adapter.write).not.toHaveBeenCalledWith(
				"_types/task.md",
				expect.any(String)
			);
			expect(files.get("_types/task.md")).toBe(unrelatedType);
			expect(files.get("_types/tasknotes-task.md")).toContain("name: tasknotes-task");
		});

		it("discovers a custom TaskNotes type and writes settings back to that file", async () => {
			const plugin = createMockPlugin();
			const typePath = "System/_types/work-item.md";
			const resources = buildTaskNotesMdbaseResources({
				typeName: "work-item",
				typesFolder: "System/_types",
			});
			const files = installMemoryVault(plugin, {
				"mdbase.yaml": 'spec_version: "0.3.0"\nsettings:\n  types_folder: System/_types\n',
				[typePath]: resources.typeDocument,
			});
			const service = new MdbaseSpecService(plugin);
			await service.initialize();
			plugin.settings.maintainDueDateOffsetInRecurring = false;

			await service.onSettingsChanged();

			expect(plugin.app.vault.adapter.rename).toHaveBeenCalledWith(expect.any(String), typePath);
			expect(files.get(typePath)).toContain("maintain_due_date_offset: false");
		});

		it("restores a canonical type that is deleted while the integration is enabled", async () => {
			const plugin = createMockPlugin();
			const resources = buildTaskNotesMdbaseResources();
			const files = installMemoryVault(plugin, {
				"mdbase.yaml": 'spec_version: "0.3.0"\nsettings:\n  types_folder: _types\n',
				"_types/task.md": resources.typeDocument,
			});
			plugin.emitter = { trigger: jest.fn() };
			const service = new MdbaseSpecService(plugin);
			await service.initialize();
			files.delete("_types/task.md");

			await (service as any).reconcileCanonicalType();

			expect(files.get("_types/task.md")).toContain("contract: tasknotes.task");
			expect(plugin.emitter.trigger).toHaveBeenCalledWith(
				"user-notice",
				expect.objectContaining({
					message: expect.stringContaining("restored the missing canonical type"),
				})
			);
		});

		it.each([undefined, "System/contracts"])("restores a deleted mdbase.yaml without changing its contracts folder (%s)", async (contractsFolder) => {
			const plugin = createMockPlugin();
			const resources = buildTaskNotesMdbaseResources({
				typesFolder: "System/_types",
				contractsFolder,
			});
			const files = installMemoryVault(plugin, {
				"mdbase.yaml": YAML.stringify({ spec_version: "0.3.0", settings: { types_folder: "System/_types", ...(contractsFolder ? { contracts_folder: contractsFolder } : {}) } }),
				"System/_types/task.md": resources.typeDocument,
			});
			plugin.emitter = { trigger: jest.fn() };
			const service = new MdbaseSpecService(plugin);
			await service.initialize();
			files.delete("mdbase.yaml");

			await (service as any).reconcileCanonicalType();

			expect(files.get("mdbase.yaml")).toContain("types_folder: System/_types");
			expect(YAML.parse(files.get("mdbase.yaml")!).settings.contracts_folder).toBe(contractsFolder ?? "_contracts");
			expect(files.has("_mdbase/README.md")).toBe(false);
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

	describe("automatic TaskNotes v0.2 metadata migration", () => {
		it("replaces generated v0.2 metadata with a legacy-compatible canonical type without touching tasks", async () => {
			const plugin = createMockPlugin({
				fieldMapping: { ...DEFAULT_FIELD_MAPPING, status: "state" },
				customStatuses: [
					{ ...DEFAULT_STATUSES[0], id: "queued", value: "queued", label: "Queued" },
					{ ...DEFAULT_STATUSES[3], id: "finished", value: "finished", label: "Finished" },
				],
				defaultTaskStatus: "queued",
				userFields: [
					{
						id: "effort",
						key: "effort",
						displayName: "Effort",
						type: "number",
					},
				],
			});
			plugin.emitter = { trigger: jest.fn() };
			const service = new MdbaseSpecService(plugin);
			const oldType = service.buildTaskTypeDef("0.2.1");
			const taskPath = "TaskNotes/Tasks/existing.md";
			const taskContent = "---\ntitle: Existing\nstate: queued\ntags: [task]\n---\nBody\n";
			const files = installMemoryVault(plugin, {
				"mdbase.yaml": v02Config(),
				"_types/task.md": oldType,
				[taskPath]: taskContent,
			});

			await service.initialize();

			const config = asObject(YAML.parse(files.get("mdbase.yaml") ?? ""));
			const type = parseFrontmatter(files.get("_types/task.md") ?? "");
			const implementation = tasknotesImplementation(type);
			expect(config.spec_version).toBe("0.3.0");
			expect(asObject(config["x-legacy-v0.2"]).tasknotes_metadata_migration).toEqual(
				expect.objectContaining({
					source_spec_version: "0.2.1",
					source_type_path: "_types/task.md",
					coercion_compatible_schema: true,
				})
			);
			expect(type.kind).toBe("mdbase.type");
			expect(asObject(type["x-legacy-v0.2"]).coercion_compatible_schema).toBe(true);
			expect(asObject(implementation.fields).status).toBe("state");
			expect(files.get(taskPath)).toBe(taskContent);
			expect(
				plugin.app.vault.adapter.write.mock.calls.some(([path]: [string]) => path === taskPath)
			).toBe(false);
			expect(
				plugin.app.vault.create.mock.calls.some(([path]: [string]) => path === taskPath)
			).toBe(false);
			expect([...files.keys()]).toContain("_contracts/tasknotes.task/0.3.0-rc.7.md");
			expect([...files.keys()].some((path) => path.startsWith("_schemas/"))).toBe(false);
			const backupConfig = [...files.entries()].find(([path]) =>
				path.endsWith("/mdbase.yaml.bak")
			);
			const backupType = [...files.entries()].find(([path]) => path.endsWith("/task.md.bak"));
			expect(backupConfig?.[1]).toBe(v02Config());
			expect(backupType?.[1]).toBe(oldType);
			expect(plugin.emitter.trigger).toHaveBeenCalledWith(
				"user-notice",
				expect.objectContaining({ message: expect.stringContaining("Task files were not changed") })
			);
		});

		it("preserves custom collection settings and migrates a custom types folder", async () => {
			const plugin = createMockPlugin();
			const service = new MdbaseSpecService(plugin);
			const config = asObject(YAML.parse(v02Config("System/Types")));
			config["x-team"] = { owner: "Gabrielle" };
			asObject(config.settings).custom_setting = "keep-me";
			asObject(config.settings).record_extensions = ["md", "markdown"];
			const files = installMemoryVault(plugin, {
				"mdbase.yaml": YAML.stringify(config),
				"System/Types/task.md": service.buildTaskTypeDef("0.2.1"),
			});

			await service.initialize();

			const migrated = asObject(YAML.parse(files.get("mdbase.yaml") ?? ""));
			expect(migrated["x-team"]).toEqual({ owner: "Gabrielle" });
			expect(asObject(migrated.settings)).toMatchObject({
				types_folder: "System/Types",
				contracts_folder: "_contracts",
				custom_setting: "keep-me",
				record_extensions: ["md", "markdown", "base"],
			});
			expect(parseFrontmatter(files.get("System/Types/task.md") ?? "").kind).toBe(
				"mdbase.type"
			);
		});

		it("leaves a v0.2 collection unchanged when another active type is present", async () => {
			const plugin = createMockPlugin();
			plugin.emitter = { trigger: jest.fn() };
			const service = new MdbaseSpecService(plugin);
			const oldConfig = v02Config();
			const oldType = service.buildTaskTypeDef("0.2.1");
			const otherType = "---\nname: note\nfields: {}\n---\n";
			const files = installMemoryVault(plugin, {
				"mdbase.yaml": oldConfig,
				"_types/task.md": oldType,
				"_types/nested/note.md": otherType,
			});

			await service.initialize();

			expect(files.get("mdbase.yaml")).toBe(oldConfig);
			expect(files.get("_types/task.md")).toBe(oldType);
			expect(plugin.app.vault.adapter.write).not.toHaveBeenCalled();
			expect(plugin.app.vault.create).not.toHaveBeenCalled();
			expect(plugin.emitter.trigger).toHaveBeenCalledWith(
				"user-notice",
				expect.objectContaining({ message: expect.stringContaining("preserved _types/task.md") })
			);
		});

		it("refuses a hand-maintained v0.2 task type", async () => {
			const plugin = createMockPlugin();
			const oldConfig = v02Config();
			const customType = [
				"---",
				"name: task",
				"fields:",
				"  title: { type: string, tn_role: title }",
				"  status: { type: string, tn_role: status, tn_completed_values: [done] }",
				"  priority: { type: string, tn_role: priority }",
				"---",
				"Hand maintained.",
			].join("\n");
			const files = installMemoryVault(plugin, {
				"mdbase.yaml": oldConfig,
				"_types/task.md": customType,
			});

			await new MdbaseSpecService(plugin).initialize();

			expect(files.get("mdbase.yaml")).toBe(oldConfig);
			expect(files.get("_types/task.md")).toBe(customType);
			expect(plugin.app.vault.adapter.write).not.toHaveBeenCalled();
		});

		it("refuses a generated v0.2 type after a user customizes it", async () => {
			const plugin = createMockPlugin();
			const service = new MdbaseSpecService(plugin);
			const oldConfig = v02Config();
			const customizedType = `${service.buildTaskTypeDef("0.2.1")}\n# User-owned extension\n`;
			const files = installMemoryVault(plugin, {
				"mdbase.yaml": oldConfig,
				"_types/task.md": customizedType,
			});

			await service.initialize();

			expect(files.get("mdbase.yaml")).toBe(oldConfig);
			expect(files.get("_types/task.md")).toBe(customizedType);
			expect(plugin.app.vault.adapter.write).not.toHaveBeenCalled();
			expect(plugin.app.vault.create).not.toHaveBeenCalled();
		});

		it("restores the exact v0.2 files and removes the files it created after a failed commit", async () => {
			const plugin = createMockPlugin();
			plugin.emitter = { trigger: jest.fn() };
			const service = new MdbaseSpecService(plugin);
			const oldConfig = v02Config();
			const oldType = service.buildTaskTypeDef("0.2.1");
			const taskPath = "TaskNotes/Tasks/existing.md";
			const taskContent = "---\ntitle: Existing\nstatus: open\ntags: [task]\n---\n";
			let failed = false;
			const files = installMemoryVault(
				plugin,
				{
					"mdbase.yaml": oldConfig,
					"_types/task.md": oldType,
					[taskPath]: taskContent,
				},
				{
					failWrite: (path, content) => {
						if (!failed && path === "mdbase.yaml" && content.includes("spec_version: 0.3.0")) {
							failed = true;
							return true;
						}
						return false;
					},
				}
			);

			await service.initialize();

			expect(files.get("mdbase.yaml")).toBe(oldConfig);
			expect(files.get("_types/task.md")).toBe(oldType);
			expect(files.get(taskPath)).toBe(taskContent);
			// Everything the migration created is removed; only the backups remain.
			expect([...files.keys()].filter((path) => !path.startsWith(".tasknotes/")).sort()).toEqual(
				["_types/task.md", "mdbase.yaml", taskPath].sort()
			);
			expect([...files.keys()].some((path) => path.endsWith("/manifest.json"))).toBe(true);
			expect(plugin.emitter.trigger).toHaveBeenCalledWith(
				"user-notice",
				expect.objectContaining({ message: expect.stringContaining("restored the v0.2 files") })
			);
		});

		it("keeps a file the migration created when it was edited before the rollback", async () => {
			const plugin = createMockPlugin();
			const service = new MdbaseSpecService(plugin);
			const oldType = service.buildTaskTypeDef("0.2.1");
			const edited = "---\napp: dev.tasknotes\nscope: collection\narchive_folder: Mine\n---\n";
			let files: Map<string, string>;
			files = installMemoryVault(
				plugin,
				{ "mdbase.yaml": v02Config(), "_types/task.md": oldType },
				{
					failWrite: (path, content) => {
						if (path === "mdbase.yaml" && content.includes("spec_version: 0.3.0")) {
							files.set("_settings/dev.tasknotes.md", edited);
							return true;
						}
						return false;
					},
				}
			);

			await service.initialize();

			expect(files.get("_settings/dev.tasknotes.md")).toBe(edited);
		});

		it("recovers an interrupted rollback, removing abandoned staging files, and completes the migration", async () => {
			const plugin = createMockPlugin();
			const service = new MdbaseSpecService(plugin);
			const oldConfig = v02Config();
			const oldType = service.buildTaskTypeDef("0.2.1");
			let failCommit = true;
			let failRollback = true;
			const files = installMemoryVault(
				plugin,
				{
					"mdbase.yaml": oldConfig,
					"_types/task.md": oldType,
				},
				{
					failWrite: (path, content) => {
						if (failCommit && path === "mdbase.yaml" && content.includes("spec_version: 0.3.0")) {
							failCommit = false;
							return true;
						}
						return failRollback && path === "_types/task.md" && content === oldType;
					},
				}
			);

			await service.initialize();
			expect(files.has(".tasknotes/migrations/mdbase-v0.2-pending.json")).toBe(true);
			expect(parseFrontmatter(files.get("_types/task.md") ?? "").kind).toBe("mdbase.type");

			// A write killed while staging leaves its temporary file behind.
			const stage = "_contracts/tasknotes.task/0.3.0-rc.7.md.tasknotes-stage-1-1-abc-def";
			files.set(stage, "{}");
			failRollback = false;
			await new MdbaseSpecService(plugin).initialize();

			expect(files.has(stage)).toBe(false);
			expect(files.has(".tasknotes/migrations/mdbase-v0.2-pending.json")).toBe(false);
			expect(asObject(YAML.parse(files.get("mdbase.yaml") ?? "")).spec_version).toBe("0.3.0");
			expect(files.has("_contracts/tasknotes.task/0.3.0-rc.7.md")).toBe(true);
		});

		it("does not overwrite a concurrent type edit while rolling back", async () => {
			const plugin = createMockPlugin();
			const service = new MdbaseSpecService(plugin);
			const oldType = service.buildTaskTypeDef("0.2.1");
			const concurrentType = `${oldType}\n# Concurrent edit\n`;
			let files: Map<string, string>;
			files = installMemoryVault(
				plugin,
				{
					"mdbase.yaml": v02Config(),
					"_types/task.md": oldType,
				},
				{
					failWrite: (path, content) => {
						if (path === "mdbase.yaml" && content.includes("spec_version: 0.3.0")) {
							files.set("_types/task.md", concurrentType);
							return true;
						}
						return false;
					},
				}
			);

			await service.initialize();

			expect(files.get("_types/task.md")).toBe(concurrentType);
			expect(files.has(".tasknotes/migrations/mdbase-v0.2-pending.json")).toBe(true);
		});

		it("does not overwrite a type edited after migration preflight", async () => {
			const plugin = createMockPlugin();
			const service = new MdbaseSpecService(plugin);
			const oldType = service.buildTaskTypeDef("0.2.1");
			const concurrentType = `${oldType}\n# Edited during migration\n`;
			let files: Map<string, string>;
			files = installMemoryVault(
				plugin,
				{
					"mdbase.yaml": v02Config(),
					"_types/task.md": oldType,
				},
				{
					failWrite: (path) => {
						if (path === "_contracts/tasknotes.task/0.3.0-rc.7.md") {
							files.set("_types/task.md", concurrentType);
						}
						return false;
					},
				}
			);

			await service.initialize();

			expect(files.get("_types/task.md")).toBe(concurrentType);
			expect(asObject(YAML.parse(files.get("mdbase.yaml") ?? "")).spec_version).toBe("0.2.1");
			expect(files.has(".tasknotes/migrations/mdbase-v0.2-pending.json")).toBe(true);
		});

		it("rejects a pending migration record that names unrelated vault files", async () => {
			const plugin = createMockPlugin();
			const service = new MdbaseSpecService(plugin);
			const oldType = service.buildTaskTypeDef("0.2.1");
			let failCommit = true;
			let failRollback = true;
			const files = installMemoryVault(
				plugin,
				{
					"mdbase.yaml": v02Config(),
					"_types/task.md": oldType,
				},
				{
					failWrite: (path, content) => {
						if (failCommit && path === "mdbase.yaml" && content.includes("spec_version: 0.3.0")) {
							failCommit = false;
							return true;
						}
						return failRollback && path === "_types/task.md" && content === oldType;
					},
				}
			);
			await service.initialize();
			failRollback = false;

			const pendingPath = ".tasknotes/migrations/mdbase-v0.2-pending.json";
			const journal = JSON.parse(files.get(pendingPath) ?? "{}") as {
				snapshots: Array<{ path: string; content: string | null }>;
				intendedWrites: Array<{ path: string; content: string | null }>;
			};
			journal.snapshots.push({ path: "Important.md", content: "before" });
			journal.intendedWrites.push({ path: "Important.md", content: "after" });
			files.set(pendingPath, `${JSON.stringify(journal)}\n`);
			files.set("Important.md", "after");

			await new MdbaseSpecService(plugin).initialize();

			expect(files.get("Important.md")).toBe("after");
			expect(files.has(pendingPath)).toBe(true);
		});

		it("uses a distinct backup folder when the timestamp already exists", async () => {
			jest.useFakeTimers();
			jest.setSystemTime(new Date("2026-08-24T12:34:56.789Z"));
			try {
				const plugin = createMockPlugin();
				const service = new MdbaseSpecService(plugin);
				const existingFolder =
					".tasknotes/migrations/mdbase-v0.2-2026-08-24T12-34-56-789Z";
				const files = installMemoryVault(plugin, {
					"mdbase.yaml": v02Config(),
					"_types/task.md": service.buildTaskTypeDef("0.2.1"),
					[`${existingFolder}/manifest.json`]: "existing",
				});

				await service.initialize();

				expect(files.get(`${existingFolder}/manifest.json`)).toBe("existing");
				expect(files.has(`${existingFolder}-2/manifest.json`)).toBe(true);
			} finally {
				jest.useRealTimers();
			}
		});

		it("is idempotent after the first successful migration", async () => {
			const plugin = createMockPlugin();
			const firstService = new MdbaseSpecService(plugin);
			installMemoryVault(plugin, {
				"mdbase.yaml": v02Config(),
				"_types/task.md": firstService.buildTaskTypeDef("0.2.1"),
			});

			await firstService.initialize();
			plugin.app.vault.adapter.write.mockClear();
			plugin.app.vault.create.mockClear();
			await new MdbaseSpecService(plugin).initialize();

			expect(plugin.app.vault.adapter.write).not.toHaveBeenCalled();
			expect(plugin.app.vault.create).not.toHaveBeenCalled();
		});

		it("exposes calm notice and structured recovery state when rollback is blocked by a concurrent edit", async () => {
			const plugin = createMockPlugin();
			const notices: string[] = [];
			plugin.emitter = {
				trigger: jest.fn((event: string, payload?: { message?: string }) => {
					if (event === "user-notice" && payload?.message) notices.push(payload.message);
				}),
			};
			const service = new MdbaseSpecService(plugin);
			const oldType = service.buildTaskTypeDef("0.2.1");
			const concurrentType = `${oldType}\n# Concurrent edit\n`;
			let files: Map<string, string>;
			files = installMemoryVault(
				plugin,
				{
					"mdbase.yaml": v02Config(),
					"_types/task.md": oldType,
				},
				{
					failWrite: (path, content) => {
						if (path === "mdbase.yaml" && content.includes("spec_version: 0.3.0")) {
							files.set("_types/task.md", concurrentType);
							return true;
						}
						return false;
					},
				}
			);

			await service.initialize();
			const pendingPath = ".tasknotes/migrations/mdbase-v0.2-pending.json";
			expect(files.has(pendingPath)).toBe(true);
			const journal = JSON.parse(files.get(pendingPath) ?? "{}") as { backupFolder: string };

			notices.length = 0;
			const restarted = new MdbaseSpecService(plugin);
			await restarted.initialize();

			expect(files.get("_types/task.md")).toBe(concurrentType);
			expect(files.has(`${journal.backupFolder}/manifest.json`)).toBe(true);
			expect(restarted.getPendingV02MigrationRecovery()).toEqual(
				expect.objectContaining({
					pendingPath,
					backupFolder: journal.backupFolder,
					blockedPaths: ["_types/task.md"],
					reason: "concurrent-change",
					canRestoreBackup: true,
				})
			);
			expect(notices).toHaveLength(1);
			expect(notices[0]).toContain("_types/task.md");
			expect(notices[0]).toContain("Settings → TaskNotes → TaskNotes App");
			expect(notices[0]).not.toContain("Error:");
			expect(notices[0]).not.toContain(pendingPath);

			// Saving settings while blocked preserves the edited file and does not spam duplicate notices.
			await restarted.onSettingsChanged();
			expect(files.get("_types/task.md")).toBe(concurrentType);
			expect(notices).toHaveLength(1);
		});

		it("keeps current valid v0.3 files, preserves backups, and resumes canonical sync when explicitly confirmed", async () => {
			const plugin = createMockPlugin();
			plugin.saveSettingsDataOnly = jest.fn().mockResolvedValue(undefined);
			plugin.settingsLifecycleService = {
				onCanonicalSettingsChanged: jest.fn().mockResolvedValue(undefined),
			};
			const service = new MdbaseSpecService(plugin);
			const oldType = service.buildTaskTypeDef("0.2.1");
			let files: Map<string, string>;
			files = installMemoryVault(
				plugin,
				{
					"mdbase.yaml": v02Config(),
					"_types/task.md": oldType,
				},
				{
					failWrite: (path, content) => {
						if (path === "mdbase.yaml" && content.includes("spec_version: 0.3.0")) {
							files.set("_types/task.md", `${oldType}\n# Temporary edit\n`);
							return true;
						}
						return false;
					},
				}
			);

			await service.initialize();
			const pendingPath = ".tasknotes/migrations/mdbase-v0.2-pending.json";
			const journal = JSON.parse(files.get(pendingPath) ?? "{}") as {
				backupFolder: string;
				intendedWrites: Array<{ path: string; content: string | null }>;
			};
			const validV03Config = journal.intendedWrites.find((w) => w.path === "mdbase.yaml")?.content ?? "";
			const validV03Type = `${journal.intendedWrites.find((w) => w.path === "_types/task.md")?.content ?? ""}\n# User v0.3 note\n`;
			files.set("mdbase.yaml", validV03Config);
			files.set("_types/task.md", validV03Type);

			const restarted = new MdbaseSpecService(plugin);
			await restarted.initialize();
			expect(restarted.getPendingV02MigrationRecovery()?.blockedPaths).toEqual(["_types/task.md"]);

			const result = await restarted.keepCurrentFilesAndResumeV02Migration();

			expect(result).toEqual({
				action: "keep-current",
				synced: true,
				backupFolder: journal.backupFolder,
			});
			expect(files.has(pendingPath)).toBe(false);
			expect(files.has(`${journal.backupFolder}/manifest.json`)).toBe(true);
			expect(files.has(`${journal.backupFolder}/task.md.bak`)).toBe(true);
			expect(files.get("_types/task.md")).toBe(validV03Type);
			expect(restarted.getPendingV02MigrationRecovery()).toBeNull();
			expect(plugin.saveSettingsDataOnly).toHaveBeenCalled();
			expect(plugin.settingsLifecycleService.onCanonicalSettingsChanged).toHaveBeenCalled();

			// Subsequent restarts work normally without errors.
			await new MdbaseSpecService(plugin).initialize();
			expect(files.get("_types/task.md")).toBe(validV03Type);
		});

		it("keeps current files without overwriting when mdbase.yaml is still v0.2", async () => {
			const plugin = createMockPlugin();
			const service = new MdbaseSpecService(plugin);
			const oldType = service.buildTaskTypeDef("0.2.1");
			const editedType = `${oldType}\n# Kept v0.2 edit\n`;
			let files: Map<string, string>;
			files = installMemoryVault(
				plugin,
				{
					"mdbase.yaml": v02Config(),
					"_types/task.md": oldType,
				},
				{
					failWrite: (path, content) => {
						if (path === "mdbase.yaml" && content.includes("spec_version: 0.3.0")) {
							files.set("_types/task.md", editedType);
							return true;
						}
						return false;
					},
				}
			);

			await service.initialize();
			const pendingPath = ".tasknotes/migrations/mdbase-v0.2-pending.json";
			const journal = JSON.parse(files.get(pendingPath) ?? "{}") as { backupFolder: string };

			const restarted = new MdbaseSpecService(plugin);
			await restarted.initialize();
			const result = await restarted.keepCurrentFilesAndResumeV02Migration();

			expect(result).toEqual({
				action: "keep-current",
				synced: false,
				backupFolder: journal.backupFolder,
			});
			expect(files.has(pendingPath)).toBe(false);
			expect(files.get("_types/task.md")).toBe(editedType);
			expect(asObject(YAML.parse(files.get("mdbase.yaml") ?? "")).spec_version).toBe("0.2.1");
			expect(files.has(`${journal.backupFolder}/manifest.json`)).toBe(true);
			expect(restarted.getPendingV02MigrationRecovery()).toBeNull();
		});

		it("restores verified v0.2 backup files and keeps the backup folder when explicitly confirmed", async () => {
			const plugin = createMockPlugin();
			const service = new MdbaseSpecService(plugin);
			const oldConfig = v02Config();
			const oldType = service.buildTaskTypeDef("0.2.1");
			const concurrentType = `${oldType}\n# Concurrent edit to discard\n`;
			let files: Map<string, string>;
			files = installMemoryVault(
				plugin,
				{
					"mdbase.yaml": oldConfig,
					"_types/task.md": oldType,
				},
				{
					failWrite: (path, content) => {
						if (path === "mdbase.yaml" && content.includes("spec_version: 0.3.0")) {
							files.set("_types/task.md", concurrentType);
							return true;
						}
						return false;
					},
				}
			);

			await service.initialize();
			const pendingPath = ".tasknotes/migrations/mdbase-v0.2-pending.json";
			const journal = JSON.parse(files.get(pendingPath) ?? "{}") as { backupFolder: string };

			const restarted = new MdbaseSpecService(plugin);
			await restarted.initialize();
			expect(restarted.getPendingV02MigrationRecovery()?.canRestoreBackup).toBe(true);

			const result = await restarted.restoreV02MigrationBackup();

			expect(result).toEqual({
				action: "restore-backup",
				synced: false,
				backupFolder: journal.backupFolder,
			});
			expect(files.has(pendingPath)).toBe(false);
			expect(files.get("mdbase.yaml")).toBe(oldConfig);
			expect(files.get("_types/task.md")).toBe(oldType);
			expect(files.has("_contracts/tasknotes.task/0.3.0-rc.7.md")).toBe(false);
			expect(files.has(`${journal.backupFolder}/manifest.json`)).toBe(true);
			expect(files.has(`${journal.backupFolder}/task.md.bak`)).toBe(true);
			expect(restarted.getPendingV02MigrationRecovery()).toBeNull();
		});

		it("refuses backup restore when the pending journal is unsafe or backups mismatch", async () => {
			const plugin = createMockPlugin();
			const service = new MdbaseSpecService(plugin);
			const oldType = service.buildTaskTypeDef("0.2.1");
			let failCommit = true;
			let failRollback = true;
			const files = installMemoryVault(
				plugin,
				{
					"mdbase.yaml": v02Config(),
					"_types/task.md": oldType,
				},
				{
					failWrite: (path, content) => {
						if (failCommit && path === "mdbase.yaml" && content.includes("spec_version: 0.3.0")) {
							failCommit = false;
							return true;
						}
						return failRollback && path === "_types/task.md" && content === oldType;
					},
				}
			);
			await service.initialize();
			failRollback = false;

			const pendingPath = ".tasknotes/migrations/mdbase-v0.2-pending.json";
			const journal = JSON.parse(files.get(pendingPath) ?? "{}") as {
				backupFolder: string;
				snapshots: Array<{ path: string; content: string | null }>;
				intendedWrites: Array<{ path: string; content: string | null }>;
			};
			// Tamper backup copy so verification fails.
			files.set(`${journal.backupFolder}/task.md.bak`, "corrupted backup");

			const restarted = new MdbaseSpecService(plugin);
			await restarted.initialize();

			expect(restarted.getPendingV02MigrationRecovery()).toEqual(
				expect.objectContaining({
					backupFolder: journal.backupFolder,
					reason: "backup-mismatch",
					canRestoreBackup: false,
				})
			);
			await expect(restarted.restoreV02MigrationBackup()).rejects.toThrow();
			expect(files.has(pendingPath)).toBe(true);

			// User can still clear the pending record without deleting the backup folder.
			const cleared = await restarted.keepCurrentFilesAndResumeV02Migration();
			expect(cleared.action).toBe("keep-current");
			expect(files.has(pendingPath)).toBe(false);
			expect(files.has(`${journal.backupFolder}/manifest.json`)).toBe(true);
		});
	});
});
