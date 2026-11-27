import YAML, { isSeq, visit } from "yaml";
import type { TaskNotesMdbaseResources } from "@tasknotes/model/mdbase";
import { TASKNOTES_MDBASE_TYPE_VERSION, taskDateSchemas } from "../canonicalTaskNotesPack";
import { applyTaskExclusions } from "./collectionConfig";
import { requireFrontmatter } from "./frontmatter";

type ObjectValue = Record<string, unknown>;
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const object = (value: unknown): ObjectValue => value !== null && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : {};
const hasOwn = (value: ObjectValue, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);
const stringList = (value: unknown): string[] => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
const normalized = (value: unknown): unknown => Array.isArray(value) ? value.map(normalized) : value !== null && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, normalized(child)])) : value;
const implementation = (type: ObjectValue): ObjectValue | undefined =>
	Array.isArray(type.implements) ? type.implements.map(object).find((value) => value.contract === "tasknotes.task") : undefined;

const dateTime = { type: "string", format: "date-time" };
const legacyDateTime = {
	type: "string",
	pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})?$",
};
const intermediateLocalDateTime = {
	type: "string",
	pattern: "^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$",
};
const legacyTaskDateBranches = [{ type: "string", format: "date" }, legacyDateTime];
const nullable = (schema: ObjectValue): ObjectValue => ({ anyOf: [schema, { type: "null" }] });
const sameSchema = (left: unknown, right: unknown): boolean =>
	JSON.stringify(normalized(left)) === JSON.stringify(normalized(right));

/** Upgrade the field schemas emitted by earlier generators, keeping custom rules and legacy nulls. */
function upgradeGeneratedTaskDates(document: YAML.Document, type: ObjectValue): void {
	const fields = object(implementation(type)?.fields);
	const managed = object(type["x-tasknotes-generator"]).managed_fields;
	if (!Array.isArray(managed)) return;

	const basePath = ["schema", "value", "properties"];
	const properties = object(object(object(type.schema).value).properties);
	const replacements = new Map<string, ObjectValue>();
	for (const [role, schema] of Object.entries(taskDateSchemas)) {
		const field = fields[role];
		if (typeof field !== "string" || !managed.includes(field)) continue;

		const isTaskDate = role === "due" || role === "scheduled";
		const original = isTaskDate ? { anyOf: schema.anyOf.slice(0, 2) } : dateTime;
		const legacy = isTaskDate ? { anyOf: legacyTaskDateBranches } : legacyDateTime;
		const intermediate = { anyOf: [...schema.anyOf.slice(0, 2), intermediateLocalDateTime] };
		const prior = properties[field];
		if (sameSchema(prior, original) || (isTaskDate && sameSchema(prior, intermediate)) ||
			(role === "dateCreated" && sameSchema(prior, legacy))) {
			replacements.set(field, schema);
		} else if (sameSchema(prior, nullable(legacy)) ||
			(isTaskDate && sameSchema(prior, nullable({ anyOf: [...legacyTaskDateBranches, intermediateLocalDateTime] })))) {
			replacements.set(field, { anyOf: [...schema.anyOf, { type: "null" }] });
		}
	}
	if (!replacements.size) return;

	// References outside a replaced schema keep their previous value, including
	// references to anchors inside its branches.
	const replacedNodes = new Set<unknown>();
	for (const field of replacements.keys()) {
		const node = document.getIn([...basePath, field], true);
		if (YAML.isNode(node)) visit(node, { Node(_key, child) { replacedNodes.add(child); } });
	}
	visit(document, {
		Alias(_key, alias) {
			const target = alias.resolve(document);
			if (target && replacedNodes.has(target)) return document.createNode(target.toJS(document));
		},
	});
	for (const [field, schema] of replacements) {
		const path = [...basePath, field];
		const previous = document.getIn(path, true);
		const node = document.createNode(schema);
		if (YAML.isNode(previous)) {
			node.comment = previous.comment;
			node.commentBefore = previous.commentBefore;
			node.spaceBefore = previous.spaceBefore;
		}
		document.setIn(path, node);
	}
}

/** Remove the legacy placeholder from the two link rules emitted by TaskNotes. */
export function removeGeneratedAnyLinkTargets(markdown: string, type: ObjectValue): string {
	const fields = object(implementation(type)?.fields);
	const generator = object(type["x-tasknotes-generator"]);
	if (!Array.isArray(generator.managed_fields)) return markdown;

	const links = object(object(type.collection).links);
	const selectors = [];
	if (typeof fields.projects === "string" && generator.managed_fields.includes(fields.projects)) {
		selectors.push(`${fields.projects}[]`);
	}
	if (typeof fields.occurrenceTemplate === "string" && generator.managed_fields.includes(fields.occurrenceTemplate)) {
		selectors.push(fields.occurrenceTemplate);
	}
	const affected = selectors.filter((selector) => {
		const rule = object(links[selector]);
		return rule.target_type === "any" && rule.validate_exists === false;
	});
	if (!affected.length) return markdown;

	const { frontmatter, body, prefix } = requireFrontmatter(markdown);
	const document = YAML.parseDocument(frontmatter);
	for (const selector of affected) {
		document.deleteIn(["collection", "links", selector, "target_type"]);
	}
	return `${prefix}---\n${document.toString({ lineWidth: 0 }).trimEnd()}\n---\n${body}`;
}

/** Drop undeclared entries left in schema.value.required after earlier property renames. */
export function removeStaleRequiredFields(markdown: string, type: ObjectValue): string {
	const managed = object(type["x-tasknotes-generator"]).managed_fields;
	if (!Array.isArray(managed)) return markdown;

	const schema = object(object(type.schema).value);
	if (!Array.isArray(schema.required) || !schema.required.length) return markdown;
	const properties = object(schema.properties);
	const isStale = (entry: unknown): boolean => typeof entry === "string" && !hasOwn(properties, entry);
	if (!schema.required.some(isStale)) return markdown;

	const { frontmatter, body, prefix } = requireFrontmatter(markdown);
	const document = YAML.parseDocument(frontmatter);
	const path = ["schema", "value", "required"];
	const requiredNode = document.getIn(path, true);
	visit(document, {
		Alias(_key, alias) {
			if (alias.resolve(document) === requiredNode) return document.createNode(copy(schema.required));
		},
	});
	const kept = schema.required.filter((entry) => !isStale(entry));
	if (isSeq(requiredNode) && requiredNode.items.length === schema.required.length) {
		for (let index = schema.required.length - 1; index >= 0; index--) {
			if (isStale(schema.required[index])) requiredNode.delete(index);
		}
		if (!requiredNode.items.length) document.deleteIn(path);
	} else if (kept.length) {
		document.setIn(path, document.createNode(kept));
	} else {
		document.deleteIn(path);
	}
	return `${prefix}---\n${document.toString({ lineWidth: 0 }).trimEnd()}\n---\n${body}`;
}

/** Upgrade the generated schema and contract in place, without a settings round-trip. */
export function upgradeCanonicalDocument(
	markdown: string,
	contractVersion: string,
	legacyResources?: TaskNotesMdbaseResources
): string {
	const parts = requireFrontmatter(markdown);
	const document = YAML.parseDocument(parts.frontmatter);
	if (document.errors.length) throw new Error("Invalid type frontmatter");
	const type = document.toJS() as ObjectValue;
	const implementations = type.implements as ObjectValue[];
	const index = implementations.findIndex((value) => value.contract === "tasknotes.task");
	if (index < 0) throw new Error("Type has no TaskNotes implementation");
	document.setIn(["implements", index, "version"], contractVersion);
	upgradeGeneratedTaskDates(document, type);
	if (Array.isArray(object(type["x-tasknotes-generator"]).managed_fields) &&
		(typeof type.version !== "number" || type.version < TASKNOTES_MDBASE_TYPE_VERSION)) {
		document.set("version", TASKNOTES_MDBASE_TYPE_VERSION);
	}
	if (legacyResources) upgradeLegacyBinding(document, implementations[index], index, legacyResources);
	return `${parts.prefix}---\n${document.toString({ lineWidth: 0 }).trimEnd()}\n---\n${parts.body}`;
}

function upgradeLegacyBinding(
	document: YAML.Document,
	previous: ObjectValue,
	index: number,
	resources: TaskNotesMdbaseResources
): void {
	// tasknotes.task rc.6 keeps app behaviour in the settings record, which the
	// same metadata transaction writes; remove it from the binding in place.
	const binding = ["implements", index, "binding"];
	for (const path of [["nlp"], ["templating"], ["time_tracking"], ["archive", "move_on_archive"], ["archive", "folder"], ["recurrence", "reset_body_checkboxes"], ["links", "write_format"]]) {
		document.deleteIn([...binding, ...path]);
	}
	const definitions = object(object(object(previous.binding).status)).definitions;
	if (Array.isArray(definitions)) {
		definitions.forEach((_definition, position) => {
			for (const key of ["next_status", "exclude_from_cycle", "auto_archive", "auto_archive_delay_minutes"]) {
				document.deleteIn([...binding, "status", "definitions", position, key]);
			}
		});
	}
	if (!object(previous.fields).assignees && !document.hasIn(["schema", "value", "properties", "assignees"])) {
		document.setIn(["implements", index, "fields", "assignees"], "assignees");
		document.setIn(["schema", "value", "properties", "assignees"], copy(object(object(object(resources.type.schema).value).properties).assignees));
		document.setIn(["collection", "links", "assignees[]"], copy(object(object(resources.type.collection).links)["assignees[]"]));
	}
}

/** Restrict generated settings updates to options actually exposed by the plugin. */
export function preserveUnownedCanonicalSettings(existing: ObjectValue, generated: ObjectValue): ObjectValue {
	const desired = copy(generated);
	const previous = implementation(existing);
	const next = implementation(desired);
	if (!next) throw new Error("Generated type has no TaskNotes implementation");
	if (!previous) return desired;
	const owned: Record<string, string[]> = {
		title: ["storage", "filename_format", "custom_filename_template"],
		status: ["values", "default", "completed_values", "skipped_values", "default_skipped", "definitions"],
		priority: ["values", "default", "definitions"],
		recurrence: ["maintain_due_date_offset", "reset_body_checkboxes"],
		links: ["write_format"],
		archive: ["move_on_archive", "folder"],
		time_tracking: ["auto_stop_on_complete"],
		templating: ["enabled", "template_path", "occurrence_enabled", "occurrence_template_path"],
		nlp: ["triggers"],
	};
	const binding = copy(object(previous.binding));
	for (const [policy, keys] of Object.entries(owned)) {
		const policyValue = object(binding[policy]);
		const generatedPolicy = object(object(next.binding)[policy]);
		for (const key of keys) {
			if (generatedPolicy[key] !== undefined) policyValue[key] = copy(generatedPolicy[key]);
			else delete policyValue[key];
		}
		if (Object.keys(policyValue).length) binding[policy] = policyValue;
		else delete binding[policy];
	}
	const fields = { ...object(previous.fields), ...object(next.fields) };
	Object.assign(next, { ...previous, version: next.version, fields, binding });
	// The ID property follows the field mapping. A type that never had a stable
	// ID keeps none, and an existing ID generator is kept (under the new name
	// when the mapping renames the property).
	const previousIdField = object(previous.fields).id;
	const idField = object(next.fields).id;
	const collection = object(desired.collection);
	const existingUnique = object(existing.collection).unique;
	if (existingUnique !== undefined) {
		const unique = copy(existingUnique);
		if (Array.isArray(unique) && typeof previousIdField === "string" && typeof idField === "string") {
			for (const rule of unique.map(object)) if (rule.field === previousIdField) rule.field = idField;
		}
		collection.unique = unique;
	} else delete collection.unique;
	const createSet = object(object(object(desired.lifecycle).on_create).set);
	const previousSet = object(object(object(existing.lifecycle).on_create).set);
	const properties = object(object(object(desired.schema).value).properties);
	if (typeof previousIdField === "string" && typeof idField === "string") {
		fields.id = idField;
		delete createSet[idField];
		if (previousSet[previousIdField] !== undefined) createSet[idField] = copy(previousSet[previousIdField]);
		if (idField !== previousIdField) {
			const previousIdProperty = object(object(object(existing.schema).value).properties)[previousIdField];
			if (previousIdProperty !== undefined) properties[idField] = copy(previousIdProperty);
		}
	} else if (previousIdField === undefined) {
		delete fields.id;
		if (typeof idField === "string") {
			const previousId = object(object(object(existing.schema).value).properties)[idField];
			if (previousId !== undefined) properties[idField] = copy(previousId);
			else delete properties[idField];
			if (previousSet[idField] !== undefined) createSet[idField] = copy(previousSet[idField]);
			else delete createSet[idField];
		}
	}
	if (object(previous.fields).tags === undefined) delete fields.tags;
	// Do not replace custom constraints with model defaults on retained properties.
	const previousProperties = object(object(object(existing.schema).value).properties);
	for (const [field, definition] of Object.entries(properties)) {
		const prior = previousProperties[field];
		if (prior && typeof prior === "object") {
			const merged = { ...object(definition), ...object(prior) };
			// A custom field's name is a plugin setting, stored as the property's title.
			for (const key of ["type", "enum", "default", "title"]) {
				if (object(definition)[key] !== undefined) merged[key] = object(definition)[key];
			}
			properties[field] = merged;
		}
	}
	const desiredFolders = object(desired["x-tasknotes-generator"]).excluded_folders;
	const reconciled = YAML.parse(requireFrontmatter(applyTaskExclusions(`---\n${YAML.stringify(existing)}---\n`, Array.isArray(desiredFolders) ? desiredFolders.join(",") : "")).frontmatter) as ObjectValue;
	desired.match = { ...object(reconciled.match), where: object(desired.match).where };
	const reconciledGenerator = object(reconciled["x-tasknotes-generator"]);
	const generator = object(desired["x-tasknotes-generator"]);
	for (const key of ["excluded_folders", "exclusion_expression"]) {
		if (reconciledGenerator[key] !== undefined) generator[key] = reconciledGenerator[key];
		else delete generator[key];
	}
	const schema = object(object(desired.schema).value);
	const previousSchema = object(object(existing.schema).value);
	const previousFields = object(previous.fields);
	const nextFields = object(next.fields);
	const previousManagedRaw = object(existing["x-tasknotes-generator"]).managed_fields;
	const hasPreviousManaged = Array.isArray(previousManagedRaw);
	const previousManaged = new Set(stringList(previousManagedRaw));
	const nextManaged = new Set(stringList(object(desired["x-tasknotes-generator"]).managed_fields));
	const previousRoleFields = new Set(Object.values(previousFields).filter((value): value is string => typeof value === "string"));
	const nextRoleFields = new Set(Object.values(nextFields).filter((value): value is string => typeof value === "string"));
	// Plugin-owned requirements (frontmatter title, status, dateCreated) follow their current mapped names.
	const pluginOwnedRequired = new Set(
		[previousFields.title, previousFields.status, previousFields.dateCreated]
			.filter((value): value is string => typeof value === "string")
	);
	const retainedRequired = stringList(previousSchema.required).filter((field) => {
		if (pluginOwnedRequired.has(field)) return false;
		if (previousManaged.has(field) && !nextManaged.has(field)) return false;
		if (previousRoleFields.has(field) && !nextRoleFields.has(field)) return false;
		if (hasPreviousManaged && !hasOwn(previousProperties, field)) return false;
		return true;
	});
	const nextRequired = [...new Set([...stringList(schema.required), ...retainedRequired])];
	if (nextRequired.length) schema.required = nextRequired;
	else delete schema.required;
	const generatedRules = Array.isArray(schema.allOf) ? schema.allOf : [];
	const customRules = (Array.isArray(previousSchema.allOf) ? previousSchema.allOf : []).filter((rule) => {
		const generatedCompletionRule = {
			if: {
				required: [previousFields.status],
				properties: { [String(previousFields.status)]: { enum: object(object(previous.binding).status).completed_values } },
				not: { required: [previousFields.recurrence] },
			},
			then: { required: [previousFields.completedDate] },
		};
		return JSON.stringify(normalized(rule)) !== JSON.stringify(normalized(generatedCompletionRule));
	});
	if (generatedRules.length || customRules.length) schema.allOf = [...generatedRules, ...customRules];
	return desired;
}
