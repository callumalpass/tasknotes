import { normalizePath } from "obsidian";
import YAML from "yaml";

import TaskNotesPlugin from "../main";
import { FieldMapping } from "../types";
import { UserMappedField } from "../types/settings";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Services/MdbaseSpecService" });

const DEFAULT_TYPES_FOLDER = "_types";
const MDBASE_V03_SPEC_VERSION = "0.3.0";

type SupportedSpecFamily = "v0.2" | "v0.3";

type MdbaseYamlConfig = {
	spec_version?: unknown;
	settings?: {
		types_folder?: unknown;
	};
	"x-legacy-v0.2"?: unknown;
};

type TypeGenerationOptions = {
	legacyCompatibility?: boolean;
};

type ExistingCollection = {
	exists: boolean;
	config: MdbaseYamlConfig | null;
};

/**
 * Service that generates mdbase collection and TaskNotes type definition files
 * (mdbase.yaml at the vault root and task.md in the configured types folder).
 *
 * New collections use v0.3. Existing v0.2 collections retain the legacy type
 * grammar until they are migrated explicitly. Files are regenerated when
 * settings change while the feature is enabled.
 * Files are NOT deleted when the feature is disabled.
 */
export class MdbaseSpecService {
	private plugin: TaskNotesPlugin;

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Called when settings change. Regenerates files if enabled.
	 */
	async onSettingsChanged(): Promise<void> {
		if (!this.plugin.settings.enableMdbaseSpec) {
			return;
		}
		await this.generate();
	}

	/**
	 * Generate both mdbase.yaml and the task type definition.
	 */
	async generate(): Promise<void> {
		try {
			const existingCollection = await this.readExistingCollection();
			const existingSpecFamily = getSpecFamily(existingCollection.config?.spec_version);

			if (existingCollection.exists && !existingSpecFamily) {
				tasknotesLogger.warn(
					"[TaskNotes][mdbase-spec] Refusing to overwrite the generated type for an unreadable or unsupported mdbase.yaml.",
					{
						category: "configuration",
						operation: "unsupported-mdbase-version",
						details: { specVersion: existingCollection.config?.spec_version },
					}
				);
				return;
			}

			const specFamily = existingSpecFamily ?? "v0.3";
			const specVersion =
				typeof existingCollection.config?.spec_version === "string"
					? existingCollection.config.spec_version
					: MDBASE_V03_SPEC_VERSION;
			const typesFolder =
				this.normalizeTypesFolder(existingCollection.config?.settings?.types_folder) ??
				DEFAULT_TYPES_FOLDER;
			const taskTypePath = `${typesFolder}/task.md`;

			await this.ensureFolderPath(typesFolder);

			const taskTypeDef = this.buildTaskTypeDef(specVersion, {
				legacyCompatibility:
					specFamily === "v0.3" && isRecord(existingCollection.config?.["x-legacy-v0.2"]),
			});
			await this.writeFile(taskTypePath, taskTypeDef);

			// Only create mdbase.yaml if it doesn't already exist so that
			// user customisations (extra excludes, description, etc.) are preserved.
			if (!existingCollection.exists) {
				const mdbaseYaml = this.buildMdbaseYaml(typesFolder);
				await this.writeFile("mdbase.yaml", mdbaseYaml);
			}

			tasknotesLogger.debug(
				`[TaskNotes][mdbase-spec] Generated ${specFamily} collection metadata and ${taskTypePath}`,
				{
					category: "configuration",
					operation: "generated-mdbase-yaml-and",
					details: { specVersion },
				}
			);
		} catch (error) {
			tasknotesLogger.error("[TaskNotes][mdbase-spec] Failed to generate files:", {
				category: "configuration",
				operation: "generate-files",
				error: error,
			});
		}
	}

	private async readExistingCollection(): Promise<ExistingCollection> {
		const vault = this.plugin.app.vault;
		const mdbaseExists = await vault.adapter.exists("mdbase.yaml");
		if (!mdbaseExists) {
			return { exists: false, config: null };
		}

		try {
			const content = await vault.adapter.read("mdbase.yaml");
			const parsed = YAML.parse(content) as unknown;
			if (!isRecord(parsed)) {
				return { exists: true, config: null };
			}
			return { exists: true, config: parsed };
		} catch (error) {
			tasknotesLogger.warn("[TaskNotes][mdbase-spec] Failed to read mdbase.yaml:", {
				category: "configuration",
				operation: "read-mdbase-yaml",
				error: error,
			});
			return { exists: true, config: null };
		}
	}

	private normalizeTypesFolder(value: unknown): string | null {
		if (typeof value !== "string") {
			return null;
		}

		const trimmed = value.trim();
		if (!trimmed || trimmed.startsWith("/") || trimmed === "." || trimmed === "..") {
			return null;
		}

		const normalized = normalizePath(trimmed);
		if (
			!normalized ||
			normalized === "." ||
			normalized === ".." ||
			normalized.startsWith("../") ||
			normalized.includes("/../")
		) {
			return null;
		}

		return normalized;
	}

	private async ensureFolderPath(folderPath: string): Promise<void> {
		const vault = this.plugin.app.vault;
		const parts = folderPath.split("/").filter(Boolean);
		let currentPath = "";

		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			const folderExists = await vault.adapter.exists(currentPath);
			if (!folderExists) {
				await vault.createFolder(currentPath);
			}
		}
	}

	/**
	 * Write a file, creating it if it doesn't exist or updating if it does.
	 */
	private async writeFile(path: string, content: string): Promise<void> {
		const vault = this.plugin.app.vault;
		const fileExists = await vault.adapter.exists(path);

		if (fileExists) {
			await vault.adapter.write(path, content);
		} else {
			await vault.create(path, content);
		}
	}

	/**
	 * Build the mdbase.yaml content.
	 */
	buildMdbaseYaml(typesFolder = DEFAULT_TYPES_FOLDER): string {
		const normalizedTypesFolder =
			this.normalizeTypesFolder(typesFolder) ?? DEFAULT_TYPES_FOLDER;

		return [
			`spec_version: "${MDBASE_V03_SPEC_VERSION}"`,
			'name: "TaskNotes"',
			'description: "Task collection managed by TaskNotes for Obsidian"',
			"settings:",
			`  types_folder: ${yamlQuote(normalizedTypesFolder)}`,
			"  record_extensions: [md]",
			"  validation: warn",
			"  explicit_type_keys: [type, types]",
			"  id_field: id",
			"  exclude:",
			`    - ${yamlQuote(normalizedTypesFolder)}`,
			"",
		].join("\n");
	}

	/**
	 * Build the _types/task.md content for a supported collection version.
	 */
	buildTaskTypeDef(
		specVersion = MDBASE_V03_SPEC_VERSION,
		options: TypeGenerationOptions = {}
	): string {
		const family = getSpecFamily(specVersion);
		if (family === "v0.2") {
			return this.buildTaskTypeDefV02();
		}
		if (family === "v0.3") {
			return this.buildTaskTypeDefV03(options.legacyCompatibility === true);
		}
		throw new Error(`Unsupported mdbase spec version: ${specVersion}`);
	}

	/**
	 * Build the legacy v0.2 task type. Retained only for existing collections.
	 */
	private buildTaskTypeDefV02(): string {
		const settings = this.plugin.settings;
		const fm = this.plugin.fieldMapper;

		const lines: string[] = [];
		lines.push("---");
		lines.push("name: task");
		lines.push("description: A task managed by the TaskNotes plugin for Obsidian.");
		lines.push(`display_name_key: ${fm.toUserField("title")}`);
		lines.push("strict: false");
		lines.push(`path_pattern: ${yamlQuote(this.buildPathPattern())}`);
		lines.push("");

		// Match section
		lines.push("match:");
		this.addMatchRules(lines);
		lines.push("");

		// Fields section
		lines.push("fields:");

		// Core fields
		this.addRoleField(lines, "title", {
			type: "string",
			required: true,
			description: "Short summary of the task.",
		});

		this.addRoleField(lines, "status", {
			type: "enum",
			required: true,
			values: settings.customStatuses.map((s) => s.value),
			default: settings.defaultTaskStatus,
			tn_completed_values: settings.customStatuses
				.filter((s) => s.isCompleted)
				.map((s) => s.value),
		});

		this.addRoleField(lines, "priority", {
			type: "enum",
			values: settings.customPriorities.map((p) => p.value),
			default: settings.defaultTaskPriority,
		});

		this.addRoleField(lines, "due", { type: "date" });
		this.addRoleField(lines, "scheduled", { type: "date" });
		this.addRoleField(lines, "contexts", {
			type: "list",
			items: { type: "string" },
		});
		this.addRoleField(lines, "projects", {
			type: "list",
			items: { type: "link" },
			description: "Wikilinks to related project notes.",
		});
		this.addRoleField(lines, "timeEstimate", {
			type: "integer",
			min: 0,
			description: "Estimated time in minutes.",
		});
		this.addRoleField(lines, "completedDate", { type: "date" });
		this.addRoleField(lines, "dateCreated", {
			type: "datetime",
			required: true,
			generated: "now",
		});
		this.addRoleField(lines, "dateModified", {
			type: "datetime",
			generated: "now_on_write",
		});
		this.addRoleField(lines, "recurrence", { type: "string" });
		this.addRoleField(lines, "recurrenceAnchor", {
			type: "enum",
			values: ["scheduled", "completion"],
			default: "scheduled",
		});
		this.addRoleField(lines, "occurrenceMaterialization", {
			type: "enum",
			values: ["manual", "on_completion", "rolling"],
			default: "manual",
			description: "How occurrence task notes are materialized for a recurring parent task.",
		});
		this.addRoleField(lines, "occurrenceNextTrigger", {
			type: "enum",
			values: ["completion", "completion_or_skip"],
			default: "completion",
			description: "Which occurrence state changes should materialize the next occurrence.",
		});
		this.addRoleField(lines, "occurrenceTemplate", {
			type: "link",
			description: "Optional template note used when materializing occurrences.",
		});
		this.addRoleField(lines, "occurrencePastHorizon", {
			type: "string",
			description: "ISO 8601 duration controlling rolling materialization before today.",
		});
		this.addRoleField(lines, "occurrenceFutureHorizon", {
			type: "string",
			description: "ISO 8601 duration controlling rolling materialization after today.",
		});
		this.addRoleField(lines, "recurrenceParent", {
			type: "link",
			description: "Parent recurring task for a materialized occurrence note.",
		});
		this.addRoleField(lines, "occurrenceDate", {
			type: "date",
			description: "Target recurrence date for a materialized occurrence note.",
		});
		this.addField(lines, "tags", { type: "list", items: { type: "string" }, tn_role: "tags" });

		// Complex nested fields
		this.addRoleField(lines, "timeEntries", {
			type: "list",
			items: {
				type: "object",
				fields: {
					startTime: { type: "datetime" },
					endTime: { type: "datetime" },
					description: { type: "string" },
					duration: { type: "integer" },
				},
			},
		});

		this.addRoleField(lines, "reminders", {
			type: "list",
			items: {
				type: "object",
				fields: {
					id: { type: "string", required: true },
					type: { type: "enum", values: ["absolute", "relative"] },
					description: { type: "string" },
					relatedTo: {
						type: "enum",
						values: ["due", "scheduled"],
						description: "Field the reminder is relative to (e.g. 'due').",
					},
					offset: {
						type: "string",
						description: "ISO 8601 duration offset (e.g. '-PT1H').",
					},
					absoluteTime: { type: "datetime" },
				},
			},
			description: "Reminder objects with id, type, offset, etc.",
		});

		this.addRoleField(lines, "blockedBy", {
			type: "list",
			items: {
				type: "object",
				fields: {
					uid: { type: "link", required: true },
					reltype: { type: "string" },
					gap: { type: "string" },
				},
			},
		});

		this.addRoleField(lines, "completeInstances", {
			type: "list",
			items: { type: "date" },
		});
		this.addRoleField(lines, "skippedInstances", {
			type: "list",
			items: { type: "date" },
		});
		this.addRoleField(lines, "icsEventId", {
			type: "list",
			items: { type: "string" },
		});
		this.addRoleField(lines, "googleCalendarEventId", { type: "string" });
		this.addRoleField(lines, "googleCalendarExceptionEventId", { type: "string" });
		this.addRoleField(lines, "googleCalendarExceptionOriginalScheduled", { type: "date" });
		this.addRoleField(lines, "googleCalendarMovedOriginalDates", {
			type: "list",
			items: { type: "date" },
		});

		// User-defined fields
		if (settings.userFields && settings.userFields.length > 0) {
			for (const uf of settings.userFields) {
				this.addField(lines, uf.key, this.mapUserFieldType(uf));
			}
		}

		// Portable TaskNotes extension settings. These are optional contract
		// fields, so older mdbase consumers can safely ignore them.
		lines.push("");
		lines.push("x-tasknotes:");
		lines.push("  nlp:");
		const nlpTriggers = settings.nlpTriggers?.triggers ?? [];
		if (nlpTriggers.length === 0) {
			lines.push("    triggers: []");
		} else {
			lines.push("    triggers:");
			for (const trigger of nlpTriggers) {
				lines.push(`      - property_id: ${yamlQuote(trigger.propertyId)}`);
				lines.push(`        trigger: ${yamlQuote(trigger.trigger)}`);
				lines.push(`        enabled: ${trigger.enabled === true}`);
			}
		}

		lines.push("---");
		lines.push("");
		lines.push("# Task");
		lines.push("");
		lines.push("This type definition describes the data schema for tasks managed by");
		lines.push("[TaskNotes](https://github.com/callumalpass/tasknotes), an Obsidian plugin");
		lines.push("for note-based task management.");
		lines.push("");
		lines.push(
			"It conforms to [mdbase-spec](https://github.com/callumalpass/mdbase-spec) v0.2.0,"
		);
		lines.push("a specification for typed markdown collections.");
		lines.push("");
		lines.push("TaskNotes also adds a non-standard `tn_role` field annotation on schema");
		lines.push("fields. This maps each field to its TaskNotes semantic role so custom");
		lines.push("frontmatter field names can still be interpreted consistently.");
		lines.push("The status field also includes `tn_completed_values`, listing");
		lines.push("which status values count as completed.");
		lines.push("");
		lines.push(
			"This file is automatically generated from TaskNotes settings and should not be"
		);
		lines.push("edited manually. Changes to TaskNotes settings (statuses, priorities, field");
		lines.push("mappings, user fields) will cause this file to be regenerated.");
		lines.push("");

		return lines.join("\n");
	}

	/**
	 * Build the v0.3 JSON Schema wrapper from the same settings-backed field
	 * model as the legacy generator. The YAML round trip keeps the legacy path
	 * stable while the two formats coexist.
	 */
	private buildTaskTypeDefV03(legacyCompatibility: boolean): string {
		const legacy = parseGeneratedFrontmatter(this.buildTaskTypeDefV02());
		const legacyFields = isRecord(legacy.fields) ? legacy.fields : {};
		const properties: Record<string, unknown> = {};
		const required: string[] = [];
		const readDefaults: Record<string, unknown> = {};
		const links: Record<string, unknown> = {};
		const fieldRoles: Record<string, string> = {};
		const lifecycle: Record<string, unknown> = {};
		const omittedFieldPaths = new Set<string>();
		let completedValues: unknown[] = [];

		for (const [fieldName, value] of Object.entries(legacyFields)) {
			if (!isRecord(value)) {
				continue;
			}

			const role = typeof value.tn_role === "string" ? value.tn_role : undefined;
			properties[fieldName] = this.convertV02Field(
				fieldName,
				value,
				role,
				links,
				omittedFieldPaths,
				legacyCompatibility,
				value.required !== true
			);

			if (value.required === true) {
				required.push(fieldName);
			}
			if (Object.prototype.hasOwnProperty.call(value, "default")) {
				const defaultValue = cloneYamlValue(value.default);
				(properties[fieldName] as Record<string, unknown>).default = defaultValue;
				readDefaults[fieldName] = defaultValue;
			}
			if (role) {
				fieldRoles[role] = fieldName;
			}
			if (Array.isArray(value.tn_completed_values)) {
				completedValues = cloneYamlValue(value.tn_completed_values) as unknown[];
			}

			if (value.generated === "now") {
				addLifecycleValue(lifecycle, "on_create", fieldName, omittedFieldPaths);
			} else if (value.generated === "now_on_write") {
				addLifecycleValue(lifecycle, "on_create", fieldName, omittedFieldPaths);
				addLifecycleValue(lifecycle, "on_update", fieldName, omittedFieldPaths);
			}
		}

		const titleField = fieldRoles.title ?? this.plugin.fieldMapper.toUserField("title");
		const collection: Record<string, unknown> = {
			read_defaults: readDefaults,
			links,
			path: {
				runtime: "tasknotes",
				template: this.getFilenameTemplate(),
				folder: normalizeRuntimeFolder(this.plugin.settings.tasksFolder || ""),
				generated_by: "tasknotes.filename.create",
			},
		};

		if (isMdbaseFieldPath(titleField)) {
			collection.display = { name_field: titleField };
		} else {
			omittedFieldPaths.add(titleField);
		}

		const statusField = fieldRoles.status;
		const priorityField = fieldRoles.priority;
		const tasknotesExtension: Record<string, unknown> = {
			contract: "tasknotes.task",
			version: 1,
			field_roles: fieldRoles,
			status: {
				completed_values: completedValues,
				...(statusField && Object.prototype.hasOwnProperty.call(readDefaults, statusField)
					? { default: readDefaults[statusField] }
					: {}),
			},
			priority:
				priorityField && Object.prototype.hasOwnProperty.call(readDefaults, priorityField)
					? { default: readDefaults[priorityField] }
					: {},
			archive: {
				tags_field: fieldRoles.tags ?? "tags",
				archived_tag: this.plugin.fieldMapper.toUserField("archiveTag"),
			},
		};

		if (omittedFieldPaths.size > 0) {
			tasknotesExtension.generator = {
				omitted_collection_paths: [...omittedFieldPaths].sort(),
			};
		}
		if (legacyCompatibility) {
			const generator = isRecord(tasknotesExtension.generator)
				? tasknotesExtension.generator
				: {};
			generator.legacy_compatibility = true;
			tasknotesExtension.generator = generator;
		}

		const schema: Record<string, unknown> = {
			$schema: "https://json-schema.org/draft/2020-12/schema",
			type: "object",
			additionalProperties: true,
			properties,
		};
		if (required.length > 0) {
			schema.required = required;
		}

		const frontmatter: Record<string, unknown> = {
			kind: "mdbase.type",
			name: "task",
			version: 1,
			description: "A task managed by the TaskNotes plugin for Obsidian.",
			match: legacy.match,
			schema: {
				dialect: "json-schema-2020-12",
				value: schema,
			},
			collection,
			lifecycle,
			"x-tasknotes": tasknotesExtension,
			...(legacyCompatibility
				? { "x-legacy-v0.2": { coercion_compatible_schema: true } }
				: {}),
		};

		const renderedFrontmatter = YAML.stringify(frontmatter, { lineWidth: 0 }).trimEnd();
		return [
			"---",
			renderedFrontmatter,
			"---",
			"",
			"# Task",
			"",
			"This type definition is generated from TaskNotes settings for mdbase v0.3.",
			"Its JSON Schema describes persisted task frontmatter; collection and lifecycle",
			"metadata describe generic mdbase behavior; `x-tasknotes` records the optional",
			"TaskNotes task contract.",
			"",
			"This file is automatically generated and should not be edited manually.",
			"",
		].join("\n");
	}

	private convertV02Field(
		selector: string,
		definition: Record<string, unknown>,
		rootRole: string | undefined,
		links: Record<string, unknown>,
		omittedFieldPaths: Set<string>,
		legacyCompatibility: boolean,
		allowNull: boolean
	): Record<string, unknown> {
		const fieldType = definition.type;
		let schema: Record<string, unknown>;

		if (!legacyCompatibility && rootRole === "reminders" && fieldType === "list") {
			schema = buildReminderSchema();
		} else {
			switch (fieldType) {
				case "string":
					schema = legacyCompatibility
						? { type: ["string", "number", "boolean"] }
						: { type: "string" };
					break;
				case "integer":
					schema = legacyCompatibility
						? {
								anyOf: [
									{ type: "integer" },
									{ type: "number", multipleOf: 1 },
									{
										type: "string",
										pattern: "^-?(?:0|[1-9][0-9]*)(?:\\.0+)?$",
									},
								],
							}
						: { type: "integer" };
					break;
				case "number":
					schema = legacyCompatibility
						? {
								anyOf: [
									{ type: "number" },
									{
										type: "string",
										pattern:
											"^-?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?$",
									},
								],
							}
						: { type: "number" };
					break;
				case "boolean":
					schema = legacyCompatibility
						? {
								anyOf: [
									{ type: "boolean" },
									{ enum: ["true", "false", "yes", "no", "on", "off"] },
								],
							}
						: { type: "boolean" };
					break;
				case "date":
					schema = { type: "string", format: "date" };
					break;
				case "datetime":
					schema = legacyCompatibility
						? {
								type: "string",
								pattern:
									"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})?$",
							}
						: { type: "string", format: "date-time" };
					break;
				case "enum": {
					const values = Array.isArray(definition.values)
						? cloneYamlValue(definition.values)
						: [];
					schema = Array.isArray(values) && values.length > 0 ? { enum: values } : {};
					break;
				}
				case "link":
					schema = { type: "string" };
					if (isMdbaseFieldPath(selector)) {
						links[selector] = {
							target_type:
								rootRole === "recurrenceParent" ||
								(rootRole === "blockedBy" && selector.endsWith(".uid"))
									? "task"
									: "any",
							validate_exists: false,
						};
					} else {
						omittedFieldPaths.add(selector);
					}
					break;
				case "list": {
					const itemDefinition = isRecord(definition.items) ? definition.items : {};
					schema = {
						type: "array",
						items: this.convertV02Field(
							`${selector}[]`,
							itemDefinition,
							rootRole,
							links,
							omittedFieldPaths,
							legacyCompatibility,
							legacyCompatibility
						),
					};
					break;
				}
				case "object": {
					const childProperties: Record<string, unknown> = {};
					const childRequired: string[] = [];
					const fields = isRecord(definition.fields) ? definition.fields : {};
					for (const [childName, childValue] of Object.entries(fields)) {
						if (!isRecord(childValue)) {
							continue;
						}
						childProperties[childName] = this.convertV02Field(
							`${selector}.${childName}`,
							childValue,
							rootRole,
							links,
							omittedFieldPaths,
							legacyCompatibility,
							legacyCompatibility && childValue.required !== true
						);
						if (childValue.required === true) {
							childRequired.push(childName);
						}
					}
					schema = {
						type: "object",
						additionalProperties:
							legacyCompatibility || Object.keys(childProperties).length === 0,
						properties: childProperties,
					};
					if (childRequired.length > 0) {
						schema.required = childRequired;
					}
					break;
				}
				default:
					schema = {};
			}
		}

		if (rootRole === "title" && !selector.includes(".") && !selector.endsWith("[]")) {
			schema.minLength = 1;
		}
		if (typeof definition.min === "number") {
			if (fieldType === "string") {
				schema.minLength = definition.min;
			} else if (fieldType === "list") {
				schema.minItems = definition.min;
			} else {
				schema.minimum = definition.min;
			}
		}
		if (typeof definition.description === "string") {
			schema.description = definition.description;
		}
		if (legacyCompatibility && allowNull) {
			schema = { anyOf: [schema, { type: "null" }] };
		}

		return schema;
	}

	/**
	 * Add a field definition to the YAML lines array using multi-line format.
	 */
	private addField(lines: string[], name: string, def: FieldDef, indent = 2): void {
		const pad = " ".repeat(indent);
		lines.push(`${pad}${name}:`);
		this.writeFieldProps(lines, def, indent + 2);
	}

	/**
	 * Add a role-annotated field. Resolves the user-facing field name via
	 * FieldMapper and automatically sets `tn_role` so that mtn can discover
	 * which role each field plays regardless of its actual name.
	 */
	private addRoleField(
		lines: string[],
		internalName: keyof FieldMapping,
		def: FieldDef,
		indent = 2
	): void {
		const fieldName = this.plugin.fieldMapper.toUserField(internalName);
		this.addField(lines, fieldName, { ...def, tn_role: internalName }, indent);
	}

	/**
	 * Write field properties as indented YAML lines.
	 */
	private writeFieldProps(lines: string[], def: FieldDef, indent: number): void {
		const pad = " ".repeat(indent);
		lines.push(`${pad}type: ${def.type}`);

		if (def.required) {
			lines.push(`${pad}required: true`);
		}
		if (def.generated) {
			lines.push(`${pad}generated: ${def.generated}`);
		}
		if (def.values) {
			lines.push(`${pad}values: [${def.values.map(yamlQuote).join(", ")}]`);
		}
		if (def.tn_completed_values && def.tn_completed_values.length > 0) {
			lines.push(
				`${pad}tn_completed_values: [${def.tn_completed_values.map(yamlQuote).join(", ")}]`
			);
		}
		if (def.default !== undefined) {
			lines.push(`${pad}default: ${yamlQuote(def.default)}`);
		}
		if (def.min !== undefined) {
			lines.push(`${pad}min: ${def.min}`);
		}
		if (def.description) {
			lines.push(`${pad}description: ${yamlQuote(def.description)}`);
		}
		if (def.tn_role) {
			lines.push(`${pad}tn_role: ${def.tn_role}`);
		}
		if (def.items) {
			if (def.items.type === "object" && def.items.fields) {
				lines.push(`${pad}items:`);
				lines.push(`${pad}  type: object`);
				lines.push(`${pad}  fields:`);
				for (const [fieldName, fieldDef] of Object.entries(def.items.fields)) {
					this.addField(lines, fieldName, fieldDef, indent + 4);
				}
			} else {
				lines.push(`${pad}items:`);
				lines.push(`${pad}  type: ${def.items.type}`);
			}
		}
	}

	/**
	 * Map a user-defined field type to an mdbase-spec field definition.
	 */
	private mapUserFieldType(uf: UserMappedField): FieldDef {
		switch (uf.type) {
			case "text":
				return { type: "string" };
			case "number":
				return { type: "number" };
			case "date":
				return { type: "date" };
			case "boolean":
				return { type: "boolean" };
			case "list":
				return { type: "list", items: { type: "string" } };
			default:
				return { type: "string" };
		}
	}

	/**
	 * Add match rules based on task identification settings.
	 * Matching should be based on tag or frontmatter key/value, not folder location.
	 */
	private addMatchRules(lines: string[]): void {
		const settings = this.plugin.settings;

		if (settings.taskIdentificationMethod === "property") {
			const propertyName = settings.taskPropertyName?.trim();
			const propertyValue = settings.taskPropertyValue?.trim();

			// Fall back to tag matching when property mode is enabled without a key.
			if (!propertyName) {
				this.addTagMatchRule(lines);
				return;
			}

			lines.push("  where:");
			lines.push(`    ${yamlKey(propertyName)}:`);

			if (propertyValue) {
				lines.push(`      eq: ${yamlScalar(propertyValue)}`);
			} else {
				lines.push("      exists: true");
			}

			return;
		}

		this.addTagMatchRule(lines);
	}

	/**
	 * Match tasks by configured task tag.
	 */
	private addTagMatchRule(lines: string[]): void {
		const taskTag = this.plugin.settings.taskTag?.trim() || "task";
		lines.push("  where:");
		lines.push("    tags:");
		lines.push(`      contains: ${yamlQuote(taskTag)}`);
	}

	/**
	 * Build a best-effort mdbase path_pattern from TaskNotes folder + filename settings.
	 * TaskNotes supports richer templating than mdbase, so unknown variables are kept
	 * as placeholders and resolved by compatible clients when possible.
	 */
	private buildPathPattern(): string {
		const folderTemplate = this.toMdbaseTemplate(this.plugin.settings.tasksFolder || "");
		const filenameTemplate = this.getFilenameTemplate();
		const filenamePatternRaw =
			this.toMdbaseTemplate(filenameTemplate) ||
			`{${this.plugin.fieldMapper.toUserField("title")}}`;
		const filenamePattern = filenamePatternRaw.endsWith(".md")
			? filenamePatternRaw
			: `${filenamePatternRaw}.md`;

		if (!folderTemplate) {
			return filenamePattern;
		}
		return `${folderTemplate}/${filenamePattern}`;
	}

	private getFilenameTemplate(): string {
		const settings = this.plugin.settings;
		if (settings.storeTitleInFilename || settings.taskFilenameFormat === "title") {
			return "{{title}}";
		}

		switch (settings.taskFilenameFormat) {
			case "timestamp":
				return "{{timestamp}}";
			case "uuid":
				return "{{uuid}}";
			case "custom":
				return settings.customFilenameTemplate?.trim() || "{{title}}";
			case "zettel":
			default:
				return "{{zettel}}";
		}
	}

	private toMdbaseTemplate(template: string): string {
		const raw = (template || "").trim();
		if (!raw) return "";

		const variableMap = this.getPathVariableMap();
		const converted = raw.replace(/\{\{(\w+)\}\}|\{(\w+)\}/g, (_match, a, b) => {
			const key = String(a ?? b);
			const mapped = variableMap[key] || key;
			return `{${mapped}}`;
		});

		return converted
			.replace(/\\/g, "/")
			.replace(/\/+/g, "/")
			.replace(/^\/+|\/+$/g, "");
	}

	private getPathVariableMap(): Record<string, string> {
		const fm = this.plugin.fieldMapper;
		return {
			title: fm.toUserField("title"),
			priority: fm.toUserField("priority"),
			status: fm.toUserField("status"),
			dueDate: fm.toUserField("due"),
			scheduledDate: fm.toUserField("scheduled"),
			due: fm.toUserField("due"),
			scheduled: fm.toUserField("scheduled"),
		};
	}
}

function getSpecFamily(specVersion: unknown): SupportedSpecFamily | null {
	if (typeof specVersion !== "string") {
		return null;
	}
	if (/^0\.2\.\d+(?:[-+].*)?$/.test(specVersion)) {
		return "v0.2";
	}
	if (/^0\.3\.\d+(?:[-+].*)?$/.test(specVersion)) {
		return "v0.3";
	}
	return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseGeneratedFrontmatter(markdown: string): Record<string, unknown> {
	const match = markdown.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
	if (!match) {
		throw new Error("Generated TaskNotes type is missing YAML frontmatter");
	}
	const parsed = YAML.parse(match[1]) as unknown;
	if (!isRecord(parsed)) {
		throw new Error("Generated TaskNotes type frontmatter is not an object");
	}
	return parsed;
}

function cloneYamlValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(cloneYamlValue);
	}
	if (isRecord(value)) {
		return Object.fromEntries(
			Object.entries(value).map(([key, child]) => [key, cloneYamlValue(child)])
		);
	}
	return value;
}

function isMdbaseFieldPath(value: string): boolean {
	return /^[A-Za-z_][A-Za-z0-9_:-]*(?:\[\])?(?:\.[A-Za-z_][A-Za-z0-9_:-]*(?:\[\])?)*$/.test(
		value
	);
}

function addLifecycleValue(
	lifecycle: Record<string, unknown>,
	event: "on_create" | "on_update",
	fieldName: string,
	omittedFieldPaths: Set<string>
): void {
	if (!isMdbaseFieldPath(fieldName)) {
		omittedFieldPaths.add(fieldName);
		return;
	}

	const action = isRecord(lifecycle[event]) ? lifecycle[event] : {};
	const set = isRecord(action.set) ? action.set : {};
	set[fieldName] = { now: true };
	action.set = set;
	lifecycle[event] = action;
}

function normalizeRuntimeFolder(value: string): string {
	return value
		.trim()
		.replace(/\\/g, "/")
		.replace(/\/{2,}/g, "/")
		.replace(/^\/+|\/+$/g, "");
}

function buildReminderSchema(): Record<string, unknown> {
	return {
		type: "array",
		items: {
			oneOf: [
				{
					type: "object",
					required: ["id", "type", "absoluteTime"],
					additionalProperties: false,
					properties: {
						id: { type: "string" },
						type: { const: "absolute" },
						description: { type: "string" },
						absoluteTime: { type: "string", format: "date-time" },
					},
				},
				{
					type: "object",
					required: ["id", "type", "relatedTo", "offset"],
					additionalProperties: false,
					properties: {
						id: { type: "string" },
						type: { const: "relative" },
						description: { type: "string" },
						relatedTo: { enum: ["due", "scheduled"] },
						offset: { type: "string" },
					},
				},
			],
		},
	};
}

/**
 * Internal type for field definitions used during YAML generation.
 */
interface FieldDef {
	type: string;
	required?: boolean;
	generated?: string;
	values?: string[];
	tn_completed_values?: string[];
	default?: string;
	min?: number;
	description?: string;
	tn_role?: string;
	items?: {
		type: string;
		fields?: Record<string, FieldDef>;
	};
}

/**
 * Quote a string value for YAML output. Always double-quotes to handle
 * special characters safely.
 */
function yamlQuote(value: string): string {
	const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
	return `"${escaped}"`;
}

/**
 * Quote a YAML key to safely handle special characters.
 */
function yamlKey(value: string): string {
	return yamlQuote(value);
}

/**
 * Format scalar values for YAML, coercing boolean-like strings to booleans.
 */
function yamlScalar(value: string): string {
	const lower = value.toLowerCase();
	if (lower === "true" || lower === "false") {
		return lower;
	}
	return yamlQuote(value);
}
