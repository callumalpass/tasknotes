import YAML, { isAlias, isSeq, visit } from "yaml";
import type { TaskNotesMdbaseResources } from "@tasknotes/model/mdbase";
import { localTaskDateSchema } from "../canonicalTaskNotesPack";
import { applyTaskExclusions } from "./collectionConfig";
import { requireFrontmatter } from "./frontmatter";

type ObjectValue = Record<string, unknown>;
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const object = (value: unknown): ObjectValue => value !== null && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : {};
const normalized = (value: unknown): unknown => Array.isArray(value) ? value.map(normalized) : value !== null && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, normalized(child)])) : value;
const implementation = (type: ObjectValue): ObjectValue | undefined =>
	Array.isArray(type.implements) ? type.implements.map(object).find((value) => value.contract === "tasknotes.task") : undefined;

const originalTaskDate = {
	anyOf: [
		{ type: "string", format: "date" },
		{ type: "string", format: "date-time" },
	],
};
const originalLegacyTaskDate = {
	anyOf: [{
		anyOf: [
			{ type: "string", format: "date" },
			{
				type: "string",
				pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})?$",
			},
		],
	}, { type: "null" }],
};

/** Add wall-clock dates to the two original generated field schemas. */
export function allowGeneratedLocalTaskDates(markdown: string, type: ObjectValue): string {
	const fields = object(implementation(type)?.fields);
	const managed = object(type["x-tasknotes-generator"]).managed_fields;
	if (!Array.isArray(managed)) return markdown;

	const basePath = ["schema", "value", "properties"];
	const properties = object(object(object(type.schema).value).properties);
	const affected = [...new Set([fields.due, fields.scheduled])].flatMap((field) => {
		if (typeof field !== "string" || !managed.includes(field)) return [];
		const schema = JSON.stringify(normalized(properties[field]));
		if (schema === JSON.stringify(normalized(originalTaskDate))) {
			return [{ field, nullable: false }];
		}
		if (schema === JSON.stringify(normalized(originalLegacyTaskDate))) {
			return [{ field, nullable: true }];
		}
		return [];
	});
	if (!affected.length) return markdown;

	const { frontmatter, body, prefix } = requireFrontmatter(markdown);
	const document = YAML.parseDocument(frontmatter);
	const originals = affected.map(({ field }) => document.getIn([...basePath, field], true));
	visit(document, {
		Alias(_key, alias) {
			const target = alias.resolve(document);
			const index = originals.indexOf(target);
			if (index !== -1) return document.createNode(properties[affected[index].field]);
		},
	});
	for (const { field, nullable } of affected) {
		const path = [...basePath, field];
		const node = document.getIn(path, true);
		// A YAML alias can point to a property outside the managed fields.
		// Give the affected property its own schema before adding a branch.
		if (isAlias(node)) document.setIn(path, copy(properties[field]));
		const alternatives = document.getIn(nullable ? [...path, "anyOf", 0, "anyOf"] : [...path, "anyOf"], true);
		if (isSeq(alternatives)) alternatives.add(document.createNode(localTaskDateSchema));
	}
	return `${prefix}---\n${document.toString({ lineWidth: 0 }).trimEnd()}\n---\n${body}`;
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

/** Structural contract lift: no settings round-trip and no rewriting existing policies other than removing those rc.6 moved. */
export function upgradeCanonicalDocument(markdown: string, resources: TaskNotesMdbaseResources): string {
	const parts = requireFrontmatter(markdown);
	const document = YAML.parseDocument(parts.frontmatter);
	if (document.errors.length) throw new Error("Invalid type frontmatter");
	const implementations = document.toJS().implements as ObjectValue[];
	const index = implementations.findIndex((value) => value.contract === "tasknotes.task");
	const desired = implementation(resources.type);
	if (!desired) throw new Error("Generated type has no TaskNotes implementation");
	document.setIn(["implements", index, "version"], desired.version);
	// tasknotes.task rc.6 keeps app behaviour in the settings record, which the
	// same metadata transaction writes; remove it from the binding in place.
	const binding = ["implements", index, "binding"];
	for (const path of [["nlp"], ["templating"], ["time_tracking"], ["archive", "move_on_archive"], ["archive", "folder"], ["recurrence", "reset_body_checkboxes"], ["links", "write_format"]]) {
		document.deleteIn([...binding, ...path]);
	}
	const definitions = object(object(object(implementations[index].binding).status)).definitions;
	if (Array.isArray(definitions)) {
		definitions.forEach((_definition, position) => {
			for (const key of ["next_status", "exclude_from_cycle", "auto_archive", "auto_archive_delay_minutes"]) {
				document.deleteIn([...binding, "status", "definitions", position, key]);
			}
		});
	}
	if (!object(implementations[index].fields).assignees && !document.hasIn(["schema", "value", "properties", "assignees"])) {
		document.setIn(["implements", index, "fields", "assignees"], "assignees");
		document.setIn(["schema", "value", "properties", "assignees"], copy(object(object(object(resources.type.schema).value).properties).assignees));
		document.setIn(["collection", "links", "assignees[]"], copy(object(object(resources.type.collection).links)["assignees[]"]));
	}
	return `---\n${document.toString({ lineWidth: 0 }).trimEnd()}\n---\n${parts.body}`;
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
	// Only the frontmatter-title requirement and generated completion rule are plugin-owned.
	const previousTitle = object(previous.fields).title;
	schema.required = [...new Set([...(schema.required as string[] ?? []), ...(previousSchema.required as string[] ?? []).filter((field) => field !== previousTitle)])];
	const generatedRules = Array.isArray(schema.allOf) ? schema.allOf : [];
	const customRules = (Array.isArray(previousSchema.allOf) ? previousSchema.allOf : []).filter((rule) => {
		const previousFields = object(previous.fields);
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
