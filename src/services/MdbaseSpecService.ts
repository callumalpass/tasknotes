/* eslint-disable no-console */
import TaskNotesPlugin from "../main";
import { UserMappedField } from "../types/settings";

/**
 * Service that generates mdbase-spec v0.2.0 type definition files
 * (mdbase.yaml and _types/task.md) at the vault root.
 *
 * Files are regenerated when settings change while the feature is enabled.
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
	 * Generate both mdbase.yaml and _types/task.md at the vault root.
	 */
	async generate(): Promise<void> {
		try {
			const vault = this.plugin.app.vault;

			// Ensure _types folder exists
			const typesFolderExists = await vault.adapter.exists("_types");
			if (!typesFolderExists) {
				await vault.createFolder("_types");
			}

			const taskTypeDef = this.buildTaskTypeDef();
			await this.writeFile("_types/task.md", taskTypeDef);

			// Only create mdbase.yaml if it doesn't already exist so that
			// user customisations (extra excludes, description, etc.) are preserved.
			const mdbaseExists = await vault.adapter.exists("mdbase.yaml");
			if (!mdbaseExists) {
				const mdbaseYaml = this.buildMdbaseYaml();
				await this.writeFile("mdbase.yaml", mdbaseYaml);
			}

			console.debug("[TaskNotes][mdbase-spec] Generated mdbase.yaml and _types/task.md");
		} catch (error) {
			console.error("[TaskNotes][mdbase-spec] Failed to generate files:", error);
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
	buildMdbaseYaml(): string {
		return [
			'spec_version: "0.2.0"',
			'name: "TaskNotes"',
			'description: "Task collection managed by TaskNotes for Obsidian"',
			"settings:",
			'  types_folder: "_types"',
			"  default_strict: false",
			"  exclude:",
			'    - "_types"',
			"",
		].join("\n");
	}

	/**
	 * Build the _types/task.md content with YAML frontmatter.
	 */
	buildTaskTypeDef(): string {
		const settings = this.plugin.settings;
		const fm = this.plugin.fieldMapper;

		const lines: string[] = [];
		lines.push("---");
		lines.push("name: task");
		lines.push("description: A task managed by the TaskNotes plugin for Obsidian.");
		lines.push(`display_name_key: ${fm.toUserField("title")}`);
		lines.push("strict: false");
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
		this.addRoleField(lines, "dateCreated", { type: "datetime", required: true });
		this.addRoleField(lines, "dateModified", { type: "datetime" });
		this.addRoleField(lines, "recurrence", { type: "string" });
		this.addRoleField(lines, "recurrenceAnchor", {
			type: "enum",
			values: ["scheduled", "completion"],
			default: "scheduled",
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

		// User-defined fields
		if (settings.userFields && settings.userFields.length > 0) {
			for (const uf of settings.userFields) {
				this.addField(lines, uf.key, this.mapUserFieldType(uf));
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
		lines.push("It conforms to [mdbase-spec](https://github.com/callumalpass/mdbase-spec) v0.2.0,");
		lines.push("a specification for typed markdown collections.");
		lines.push("");
		lines.push("TaskNotes also adds a non-standard `tn_role` field annotation on schema");
		lines.push("fields. This maps each field to its TaskNotes semantic role so custom");
		lines.push("frontmatter field names can still be interpreted consistently.");
		lines.push("The status field also includes `tn_completed_values`, listing");
		lines.push("which status values count as completed.");
		lines.push("");
		lines.push("This file is automatically generated from TaskNotes settings and should not be");
		lines.push("edited manually. Changes to TaskNotes settings (statuses, priorities, field");
		lines.push("mappings, user fields) will cause this file to be regenerated.");
		lines.push("");

		return lines.join("\n");
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
		internalName: string,
		def: FieldDef,
		indent = 2,
	): void {
		const fieldName = this.plugin.fieldMapper.toUserField(internalName as any);
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
		if (def.values) {
			lines.push(`${pad}values: [${def.values.join(", ")}]`);
		}
		if (def.tn_completed_values && def.tn_completed_values.length > 0) {
			lines.push(`${pad}tn_completed_values: [${def.tn_completed_values.join(", ")}]`);
		}
		if (def.default !== undefined) {
			lines.push(`${pad}default: ${def.default}`);
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
}

/**
 * Internal type for field definitions used during YAML generation.
 */
interface FieldDef {
	type: string;
	required?: boolean;
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
