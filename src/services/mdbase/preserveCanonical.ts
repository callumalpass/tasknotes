import YAML from "yaml";
import type { TaskNotesMdbaseResources } from "@tasknotes/model/mdbase";
import { applyTaskExclusions } from "./collectionConfig";

type ObjectValue = Record<string, unknown>;
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const object = (value: unknown): ObjectValue => value !== null && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : {};
const normalized = (value: unknown): unknown => Array.isArray(value) ? value.map(normalized) : value !== null && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, normalized(child)])) : value;
const implementation = (type: ObjectValue): ObjectValue | undefined =>
	Array.isArray(type.implements) ? type.implements.map(object).find((value) => value.contract === "tasknotes.task") : undefined;

/** Structural contract lift: no settings round-trip and no rewriting existing policies. */
export function upgradeCanonicalDocument(markdown: string, resources: TaskNotesMdbaseResources): string {
	const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
	if (!match) throw new Error("Missing type frontmatter");
	const document = YAML.parseDocument(match[1]);
	if (document.errors.length) throw new Error("Invalid type frontmatter");
	const implementations = document.toJS().implements as ObjectValue[];
	const index = implementations.findIndex((value) => value.contract === "tasknotes.task");
	const desired = implementation(resources.type);
	if (!desired) throw new Error("Generated type has no TaskNotes implementation");
	document.setIn(["implements", index, "version"], desired.version);
	if (!object(implementations[index].fields).assignees && !document.hasIn(["schema", "value", "properties", "assignees"])) {
		document.setIn(["implements", index, "fields", "assignees"], "assignees");
		document.setIn(["schema", "value", "properties", "assignees"], copy(object(object(object(resources.type.schema).value).properties).assignees));
		document.setIn(["collection", "links", "assignees[]"], copy(object(object(resources.type.collection).links)["assignees[]"]));
	}
	return `---\n${document.toString({ lineWidth: 0 }).trimEnd()}\n---\n${markdown.slice(match[0].length)}`;
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
	// Stable IDs are not a plugin field-mapping setting. Keep its schema and lifecycle.
	const idField = object(previous.fields).id;
	const collection = object(desired.collection);
	if (object(existing.collection).unique !== undefined) collection.unique = copy(object(existing.collection).unique);
	else delete collection.unique;
	if (typeof idField === "string") {
		fields.id = idField;
		const createSet = object(object(object(desired.lifecycle).on_create).set);
		delete createSet.id;
		const previousSet = object(object(object(existing.lifecycle).on_create).set);
		if (previousSet[idField]) createSet[idField] = copy(previousSet[idField]);
		if (idField !== "id") {
			delete object(object(object(desired.schema).value).properties).id;
			const generator = object(desired["x-tasknotes-generator"]);
			generator.managed_fields = [...(generator.managed_fields as string[]).filter((field) => field !== "id"), idField];
		}
	}
	if (idField === undefined) {
		delete fields.id;
		const properties = object(object(object(desired.schema).value).properties);
		const previousId = object(object(object(existing.schema).value).properties).id;
		if (previousId !== undefined) properties.id = copy(previousId);
		else delete properties.id;
		const set = object(object(object(desired.lifecycle).on_create).set);
		const previousIdGenerator = object(object(object(existing.lifecycle).on_create).set).id;
		if (previousIdGenerator !== undefined) set.id = copy(previousIdGenerator);
		else delete set.id;
	}
	if (object(previous.fields).tags === undefined) delete fields.tags;
	// Do not replace custom constraints with model defaults on retained properties.
	const properties = object(object(object(desired.schema).value).properties);
	const previousProperties = object(object(object(existing.schema).value).properties);
	for (const [field, definition] of Object.entries(properties)) {
		const prior = previousProperties[field];
		if (prior && typeof prior === "object") {
			const merged = { ...object(definition), ...object(prior) };
			for (const key of ["type", "enum", "default"]) {
				if (object(definition)[key] !== undefined) merged[key] = object(definition)[key];
			}
			properties[field] = merged;
		}
	}
	const desiredFolders = object(desired["x-tasknotes-generator"]).excluded_folders;
	const reconciled = YAML.parse(applyTaskExclusions(`---\n${YAML.stringify(existing)}---\n`, Array.isArray(desiredFolders) ? desiredFolders.join(",") : "").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "") as ObjectValue;
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
