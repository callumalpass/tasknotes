/**
 * Frozen, read-only renderers extracted from shipped v4 MdbaseSpecService writers.
 * Each entry is the first tag with that distinct writer fingerprint (including
 * 4.3.1, whose integration was first wired in 4.3.2). Shared methods are deduplicated;
 * the output, including the old unquoted-enum bug, is intentionally unchanged.
 * Never use these writers to persist metadata. See historical-renderers.md.
 */
import { FieldMapper } from "../FieldMapper";
import type { FieldMapping } from "../../types";
import type { TaskNotesSettings, UserMappedField } from "../../types/settings";

class HistoricalTaskTypeRenderer {
	readonly plugin: { settings: TaskNotesSettings; fieldMapper: FieldMapper };
	constructor(settings: TaskNotesSettings) {
		this.plugin = { settings, fieldMapper: new FieldMapper(settings.fieldMapping) };
	}
	buildTaskTypeDef(): string {
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

	addField(lines: string[], name: string, def: FieldDef, indent = 2): void {
		const pad = " ".repeat(indent);
		lines.push(`${pad}${name}:`);
		this.writeFieldProps(lines, def, indent + 2);
	}

	addRoleField(
		lines: string[],
		internalName: keyof FieldMapping,
		def: FieldDef,
		indent = 2
	): void {
		const fieldName = this.plugin.fieldMapper.toUserField(internalName);
		this.addField(lines, fieldName, { ...def, tn_role: internalName }, indent);
	}

	writeFieldProps(lines: string[], def: FieldDef, indent: number): void {
		const pad = " ".repeat(indent);
		lines.push(`${pad}type: ${def.type}`);

		if (def.required) {
			lines.push(`${pad}required: true`);
		}
		if (def.generated) {
			lines.push(`${pad}generated: ${def.generated}`);
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

	mapUserFieldType(uf: UserMappedField): FieldDef {
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

	addMatchRules(lines: string[]): void {
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

	addTagMatchRule(lines: string[]): void {
		const taskTag = this.plugin.settings.taskTag?.trim() || "task";
		lines.push("  where:");
		lines.push("    tags:");
		lines.push(`      contains: ${yamlQuote(taskTag)}`);
	}

	buildPathPattern(): string {
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

	getFilenameTemplate(): string {
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

	toMdbaseTemplate(template: string): string {
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

	getPathVariableMap(): Record<string, string> {
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

	fieldDefToInlineYaml(def: FieldDef): string {
		const parts: string[] = [];
		parts.push(`type: ${def.type}`);

		if (def.required) {
			parts.push("required: true");
		}
		if (def.values) {
			parts.push(`values: [${def.values.map(yamlQuote).join(", ")}]`);
		}
		if (def.default !== undefined) {
			parts.push(`default: ${yamlQuote(def.default)}`);
		}
		if (def.min !== undefined) {
			parts.push(`min: ${def.min}`);
		}
		if (def.items) {
			if (def.items.type === "object" && def.items.fields) {
				parts.push(
					`items: { type: object, fields: { ${this.buildNestedFields(def.items.fields)} } }`
				);
			} else {
				parts.push(`items: { type: ${def.items.type} }`);
			}
		}

		return `{ ${parts.join(", ")} }`;
	}

	buildNestedFields(fields: Record<string, FieldDef>): string {
		return Object.entries(fields)
			.map(([name, def]) => `${name}: { type: ${def.type} }`)
			.join(", ");
	}
}

function historical1(this: HistoricalTaskTypeRenderer): string {
	const settings = this.plugin.settings;
	const fm = this.plugin.fieldMapper;

	const lines: string[] = [];
	lines.push("---");
	lines.push("name: task");
	lines.push('description: "A task managed by the TaskNotes plugin for Obsidian"');
	lines.push(`display_name_key: ${yamlQuote(fm.toUserField("title"))}`);
	lines.push("strict: false");
	lines.push("");

	// Match section
	lines.push("match:");
	lines.push(`  path_glob: ${yamlQuote(settings.tasksFolder + "/**/*.md")}`);
	lines.push("");

	// Fields section
	lines.push("fields:");

	// Core fields
	this.addField(lines, fm.toUserField("title"), { type: "string", required: true });

	this.addField(lines, fm.toUserField("status"), {
		type: "enum",
		values: settings.customStatuses.map((s) => s.value),
		default: settings.defaultTaskStatus,
	});

	this.addField(lines, fm.toUserField("priority"), {
		type: "enum",
		values: settings.customPriorities.map((p) => p.value),
		default: settings.defaultTaskPriority,
	});

	this.addField(lines, fm.toUserField("due"), { type: "date" });
	this.addField(lines, fm.toUserField("scheduled"), { type: "date" });
	this.addField(lines, fm.toUserField("contexts"), {
		type: "list",
		items: { type: "string" },
	});
	this.addField(lines, fm.toUserField("projects"), {
		type: "list",
		items: { type: "link" },
	});
	this.addField(lines, fm.toUserField("timeEstimate"), { type: "integer", min: 0 });
	this.addField(lines, fm.toUserField("completedDate"), { type: "date" });
	this.addField(lines, fm.toUserField("dateCreated"), { type: "datetime" });
	this.addField(lines, fm.toUserField("dateModified"), { type: "datetime" });
	this.addField(lines, fm.toUserField("recurrence"), { type: "string" });
	this.addField(lines, fm.toUserField("recurrenceAnchor"), {
		type: "enum",
		values: ["scheduled", "completion"],
		default: "scheduled",
	});
	this.addField(lines, "tags", { type: "list", items: { type: "string" } });

	// Complex nested fields
	this.addField(lines, fm.toUserField("timeEntries"), {
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

	this.addField(lines, fm.toUserField("reminders"), {
		type: "list",
		items: {
			type: "object",
			fields: {
				id: { type: "string" },
				type: { type: "string" },
				relatedTo: { type: "string" },
				offset: { type: "integer" },
				absoluteTime: { type: "string" },
				description: { type: "string" },
			},
		},
	});

	this.addField(lines, fm.toUserField("blockedBy"), {
		type: "list",
		items: {
			type: "object",
			fields: {
				uid: { type: "string" },
				reltype: { type: "string" },
				gap: { type: "string" },
			},
		},
	});

	this.addField(lines, fm.toUserField("completeInstances"), {
		type: "list",
		items: { type: "date" },
	});
	this.addField(lines, fm.toUserField("skippedInstances"), {
		type: "list",
		items: { type: "date" },
	});
	this.addField(lines, fm.toUserField("icsEventId"), {
		type: "list",
		items: { type: "string" },
	});
	this.addField(lines, fm.toUserField("googleCalendarEventId"), { type: "string" });

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
	lines.push("This file is automatically generated from TaskNotes settings and should not be");
	lines.push("edited manually. Changes to TaskNotes settings (statuses, priorities, field");
	lines.push("mappings, user fields) will cause this file to be regenerated.");
	lines.push("");

	return lines.join("\n");
}

function historical2(
	this: HistoricalTaskTypeRenderer,
	lines: string[],
	name: string,
	def: FieldDef
): void {
	const inline = this.fieldDefToInlineYaml(def);
	lines.push(`  ${name}: ${inline}`);
}

function historical3(this: HistoricalTaskTypeRenderer): string {
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
	lines.push(`  path_glob: ${yamlQuote(settings.tasksFolder + "/**/*.md")}`);
	lines.push("");

	// Fields section
	lines.push("fields:");

	// Core fields
	this.addField(lines, fm.toUserField("title"), {
		type: "string",
		required: true,
		description: "Short summary of the task.",
	});

	this.addField(lines, fm.toUserField("status"), {
		type: "enum",
		required: true,
		values: settings.customStatuses.map((s) => s.value),
		default: settings.defaultTaskStatus,
	});

	this.addField(lines, fm.toUserField("priority"), {
		type: "enum",
		values: settings.customPriorities.map((p) => p.value),
		default: settings.defaultTaskPriority,
	});

	this.addField(lines, fm.toUserField("due"), { type: "date" });
	this.addField(lines, fm.toUserField("scheduled"), { type: "date" });
	this.addField(lines, fm.toUserField("contexts"), {
		type: "list",
		items: { type: "string" },
	});
	this.addField(lines, fm.toUserField("projects"), {
		type: "list",
		items: { type: "link" },
		description: "Wikilinks to related project notes.",
	});
	this.addField(lines, fm.toUserField("timeEstimate"), {
		type: "integer",
		min: 0,
		description: "Estimated time in minutes.",
	});
	this.addField(lines, fm.toUserField("completedDate"), { type: "date" });
	this.addField(lines, fm.toUserField("dateCreated"), { type: "datetime", required: true });
	this.addField(lines, fm.toUserField("dateModified"), { type: "datetime" });
	this.addField(lines, fm.toUserField("recurrence"), { type: "string" });
	this.addField(lines, fm.toUserField("recurrenceAnchor"), {
		type: "enum",
		values: ["scheduled", "completion"],
		default: "scheduled",
	});
	this.addField(lines, "tags", { type: "list", items: { type: "string" } });

	// Complex nested fields
	this.addField(lines, fm.toUserField("timeEntries"), {
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

	this.addField(lines, fm.toUserField("reminders"), {
		type: "list",
		items: {
			type: "object",
			fields: {
				id: { type: "string", required: true },
				type: { type: "string" },
				description: { type: "string" },
				relatedTo: {
					type: "string",
					description: "Field the reminder is relative to (e.g. 'due').",
				},
				offset: {
					type: "string",
					description: "ISO 8601 duration offset (e.g. '-PT1H').",
				},
				absoluteTime: { type: "string" },
			},
		},
		description: "Reminder objects with id, type, offset, etc.",
	});

	this.addField(lines, fm.toUserField("blockedBy"), {
		type: "list",
		items: {
			type: "object",
			fields: {
				uid: { type: "string", required: true },
				reltype: { type: "string" },
				gap: { type: "string" },
			},
		},
	});

	this.addField(lines, fm.toUserField("completeInstances"), {
		type: "list",
		items: { type: "date" },
	});
	this.addField(lines, fm.toUserField("skippedInstances"), {
		type: "list",
		items: { type: "date" },
	});
	this.addField(lines, fm.toUserField("icsEventId"), {
		type: "list",
		items: { type: "string" },
	});
	this.addField(lines, fm.toUserField("googleCalendarEventId"), { type: "string" });

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
	lines.push("This file is automatically generated from TaskNotes settings and should not be");
	lines.push("edited manually. Changes to TaskNotes settings (statuses, priorities, field");
	lines.push("mappings, user fields) will cause this file to be regenerated.");
	lines.push("");

	return lines.join("\n");
}

function historical4(
	this: HistoricalTaskTypeRenderer,
	lines: string[],
	def: FieldDef,
	indent: number
): void {
	const pad = " ".repeat(indent);
	lines.push(`${pad}type: ${def.type}`);

	if (def.required) {
		lines.push(`${pad}required: true`);
	}
	if (def.values) {
		lines.push(`${pad}values: [${def.values.join(", ")}]`);
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

function historical5(this: HistoricalTaskTypeRenderer): string {
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
	lines.push(`  path_glob: ${yamlQuote(settings.tasksFolder + "/**/*.md")}`);
	lines.push("");

	// Fields section
	lines.push("fields:");

	// Core fields
	this.addField(lines, fm.toUserField("title"), {
		type: "string",
		required: true,
		description: "Short summary of the task.",
	});

	this.addField(lines, fm.toUserField("status"), {
		type: "enum",
		required: true,
		values: settings.customStatuses.map((s) => s.value),
		default: settings.defaultTaskStatus,
	});

	this.addField(lines, fm.toUserField("priority"), {
		type: "enum",
		values: settings.customPriorities.map((p) => p.value),
		default: settings.defaultTaskPriority,
	});

	this.addField(lines, fm.toUserField("due"), { type: "date" });
	this.addField(lines, fm.toUserField("scheduled"), { type: "date" });
	this.addField(lines, fm.toUserField("contexts"), {
		type: "list",
		items: { type: "string" },
	});
	this.addField(lines, fm.toUserField("projects"), {
		type: "list",
		items: { type: "link" },
		description: "Wikilinks to related project notes.",
	});
	this.addField(lines, fm.toUserField("timeEstimate"), {
		type: "integer",
		min: 0,
		description: "Estimated time in minutes.",
	});
	this.addField(lines, fm.toUserField("completedDate"), { type: "date" });
	this.addField(lines, fm.toUserField("dateCreated"), { type: "datetime", required: true });
	this.addField(lines, fm.toUserField("dateModified"), { type: "datetime" });
	this.addField(lines, fm.toUserField("recurrence"), { type: "string" });
	this.addField(lines, fm.toUserField("recurrenceAnchor"), {
		type: "enum",
		values: ["scheduled", "completion"],
		default: "scheduled",
	});
	this.addField(lines, "tags", { type: "list", items: { type: "string" } });

	// Complex nested fields
	this.addField(lines, fm.toUserField("timeEntries"), {
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

	this.addField(lines, fm.toUserField("reminders"), {
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

	this.addField(lines, fm.toUserField("blockedBy"), {
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

	this.addField(lines, fm.toUserField("completeInstances"), {
		type: "list",
		items: { type: "date" },
	});
	this.addField(lines, fm.toUserField("skippedInstances"), {
		type: "list",
		items: { type: "date" },
	});
	this.addField(lines, fm.toUserField("icsEventId"), {
		type: "list",
		items: { type: "string" },
	});
	this.addField(lines, fm.toUserField("googleCalendarEventId"), { type: "string" });

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
	lines.push("This file is automatically generated from TaskNotes settings and should not be");
	lines.push("edited manually. Changes to TaskNotes settings (statuses, priorities, field");
	lines.push("mappings, user fields) will cause this file to be regenerated.");
	lines.push("");

	return lines.join("\n");
}

function historical6(this: HistoricalTaskTypeRenderer): string {
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

function historical7(
	this: HistoricalTaskTypeRenderer,
	lines: string[],
	internalName: string,
	def: FieldDef,
	indent = 2
): void {
	const fieldName = this.plugin.fieldMapper.toUserField(internalName as keyof FieldMapping);
	this.addField(lines, fieldName, { ...def, tn_role: internalName }, indent);
}

function historical8(
	this: HistoricalTaskTypeRenderer,
	lines: string[],
	def: FieldDef,
	indent: number
): void {
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

function historical9(this: HistoricalTaskTypeRenderer): string {
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

function historical10(this: HistoricalTaskTypeRenderer): string {
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

function historical11(this: HistoricalTaskTypeRenderer): string {
	const settings = this.plugin.settings;
	if (settings.storeTitleInFilename || settings.taskFilenameFormat === "title") {
		return "{{title}}";
	}

	switch (settings.taskFilenameFormat) {
		case "timestamp":
			return "{{timestamp}}";
		case "custom":
			return settings.customFilenameTemplate?.trim() || "{{title}}";
		case "zettel":
		default:
			return "{{zettel}}";
	}
}

function historical12(
	this: HistoricalTaskTypeRenderer,
	lines: string[],
	internalName: keyof FieldMapping,
	def: FieldDef,
	indent = 2
): void {
	const fieldName = this.plugin.fieldMapper.toUserField(internalName);
	this.addField(lines, fieldName, { ...def, tn_role: internalName }, indent);
}

function historical13(this: HistoricalTaskTypeRenderer): string {
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

function historical14(this: HistoricalTaskTypeRenderer): string {
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

function historical15(this: HistoricalTaskTypeRenderer): string {
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

function yamlQuote(value: string): string {
	const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
	return `"${escaped}"`;
}

function yamlKey(value: string): string {
	return yamlQuote(value);
}

function yamlScalar(value: string): string {
	const lower = value.toLowerCase();
	if (lower === "true" || lower === "false") {
		return lower;
	}
	return yamlQuote(value);
}

const writers = [
	{ version: "4.3.1", methods: { buildTaskTypeDef: historical1, addField: historical2 } },
	{ version: "4.3.2", methods: { buildTaskTypeDef: historical3, writeFieldProps: historical4 } },
	{ version: "4.3.3", methods: { buildTaskTypeDef: historical5, writeFieldProps: historical4 } },
	{
		version: "4.4.0",
		methods: {
			buildTaskTypeDef: historical6,
			addRoleField: historical7,
			writeFieldProps: historical8,
		},
	},
	{
		version: "4.5.0",
		methods: {
			buildTaskTypeDef: historical9,
			addRoleField: historical7,
			buildPathPattern: historical10,
			getFilenameTemplate: historical11,
		},
	},
	{
		version: "4.6.0",
		methods: {
			buildTaskTypeDef: historical9,
			addRoleField: historical7,
			buildPathPattern: historical10,
			getFilenameTemplate: historical11,
		},
	},
	{
		version: "4.7.0",
		methods: {
			buildTaskTypeDef: historical9,
			addRoleField: historical12,
			buildPathPattern: historical10,
			getFilenameTemplate: historical11,
		},
	},
	{ version: "4.8.0", methods: { buildTaskTypeDef: historical13 } },
	{ version: "4.9.1", methods: { buildTaskTypeDef: historical14 } },
	{ version: "4.10.0", methods: { buildTaskTypeDef: historical15 } },
	{ version: "4.12.0", methods: {} },
];

export function* renderHistoricalTaskTypes(
	settings: TaskNotesSettings
): Generator<{ version: string; document: string }> {
	for (const writer of writers) {
		const renderer = new HistoricalTaskTypeRenderer(settings);
		Object.assign(renderer, writer.methods);
		yield { version: writer.version, document: renderer.buildTaskTypeDef() };
	}
}
