import {
	resolveTaskNotesModelConfigFromMdbaseType,
	type TaskNotesMdbaseResources,
} from "@tasknotes/model/mdbase";
import { TASKNOTES_SPEC_VERSION as TASKNOTES_CONTRACT_VERSION } from "@tasknotes/model";
import YAML from "yaml";

import type { TaskNotesSettings, UserMappedField } from "../types/settings";

type UnknownRecord = Record<string, unknown>;
type DocumentPath = Array<string | number>;

export type ParsedMdbaseTaskType = {
	type: UnknownRecord;
	body: string;
};

export type CanonicalTypeValidationResult = { valid: true } | { valid: false; issues: string[] };

const MANAGED_OPTIONAL_PATHS: DocumentPath[] = [
	["x-tasknotes-generator", "omitted_collection_paths"],
	["x-tasknotes-generator", "legacy_compatibility"],
];

const MANAGED_REPLACE_PATHS: DocumentPath[] = [["match"]];

export function parseMdbaseTaskTypeDocument(markdown: string): ParsedMdbaseTaskType {
	const parts = splitFrontmatter(markdown);
	const document = YAML.parseDocument(parts.frontmatter);
	if (document.errors.length > 0) {
		throw new Error(document.errors.map((error) => error.message).join("; "));
	}
	const value = document.toJS() as unknown;
	if (!isRecord(value)) {
		throw new Error("The mdbase task type frontmatter must be an object.");
	}
	return { type: value, body: parts.body };
}

export function validateCanonicalTaskType(type: UnknownRecord): CanonicalTypeValidationResult {
	const issues: string[] = [];
	const implementation = taskNotesImplementation(type);
	const extension = asRecord(implementation?.binding);
	const schemaProperties = recordAt(type, ["schema", "value", "properties"]);
	const fieldRoles = asRecord(implementation?.fields);

	if (type.kind !== "mdbase.type") {
		issues.push("kind must be mdbase.type");
	}
	if (!implementation) {
		issues.push(
			`implements must contain tasknotes.task ${TASKNOTES_CONTRACT_VERSION}`
		);
	}
	if (!extension) {
		issues.push("the TaskNotes implementation binding must be an object");
	}
	if (!schemaProperties) {
		issues.push("schema.value.properties must be an object");
	}
	if (!fieldRoles || Object.keys(fieldRoles).length === 0) {
		issues.push("the TaskNotes implementation fields must map at least one contract field");
	} else if (schemaProperties) {
		for (const [role, field] of Object.entries(fieldRoles)) {
			if (typeof field !== "string" || !field.trim()) {
				issues.push(`field role ${role} must name a property`);
			} else if (!Object.prototype.hasOwnProperty.call(schemaProperties, field)) {
				issues.push(`field role ${role} refers to missing schema property ${field}`);
			}
		}
	}

	const status = asRecord(extension?.status);
	if (!status) {
		issues.push("the TaskNotes implementation binding.status must be an object");
	} else if (!Array.isArray(status.completed_values)) {
		issues.push("binding.status.completed_values must be an array");
	}

	validateTaskIdentification(type, issues);
	if (implementation) {
		validateVocabularyMirror(type, implementation, "status", issues);
		validateVocabularyMirror(type, implementation, "priority", issues);
	}

	const statusField = fieldRoles?.status;
	const advertisedStatusValues = stringArray(extension?.status, "values");
	const statusValues =
		advertisedStatusValues.length > 0 || typeof statusField !== "string"
			? advertisedStatusValues
			: stringArrayAt(type, ["schema", "value", "properties", statusField, "enum"]);
	const completedValues = stringArray(extension?.status, "completed_values");
	for (const value of completedValues) {
		if (!statusValues.includes(value)) {
			issues.push(`completed status ${value} is not present in status.values`);
		}
	}
	validateUniqueStrings(completedValues, "completed status", issues);

	const skippedValues = stringArray(extension?.status, "skipped_values");
	for (const value of skippedValues) {
		if (!statusValues.includes(value)) {
			issues.push(`skipped status ${value} is not present in status.values`);
		}
		if (completedValues.includes(value)) {
			issues.push(`status ${value} cannot be both completed and skipped`);
		}
	}
	validateUniqueStrings(skippedValues, "skipped status", issues);

	const defaultSkipped = asRecord(extension?.status)?.default_skipped;
	if (
		defaultSkipped !== undefined &&
		(typeof defaultSkipped !== "string" || !skippedValues.includes(defaultSkipped))
	) {
		issues.push("status.default_skipped must be present in status.skipped_values");
	}

	return issues.length > 0 ? { valid: false, issues } : { valid: true };
}

export function applyCanonicalTaskTypeToSettings(
	settings: TaskNotesSettings,
	type: UnknownRecord
): void {
	const modelConfig = resolveTaskNotesModelConfigFromMdbaseType(
		type,
		buildTaskNotesModelConfig(settings)
	);
	const extension = asRecord(taskNotesImplementation(type)?.binding) ?? {};
	const title = asRecord(extension.title);
	const links = asRecord(extension.links);
	const archive = asRecord(extension.archive);
	const templating = asRecord(extension.templating);
	const collectionPath = recordAt(type, ["collection", "path"]);

	settings.fieldMapping = { ...modelConfig.fieldMapping };
	settings.customStatuses = modelConfig.statuses.map((status) => ({ ...status }));
	settings.customPriorities = modelConfig.priorities.map((priority) => ({ ...priority }));
	settings.defaultTaskStatus = modelConfig.defaults.status;
	settings.defaultTaskPriority = modelConfig.defaults.priority;
	settings.taskIdentificationMethod = modelConfig.taskIdentification.method;
	settings.taskTag = modelConfig.taskIdentification.tag || settings.taskTag;
	settings.taskPropertyName = modelConfig.taskIdentification.propertyName;
	settings.taskPropertyValue = modelConfig.taskIdentification.propertyValue;
	settings.storeTitleInFilename = modelConfig.storeTitleInFilename;
	settings.userFields = mergeResolvedUserFields(
		settings.userFields ?? [],
		modelConfig.userFields
	);
	settings.maintainDueDateOffsetInRecurring = modelConfig.recurrence.maintainDueDateOffset;
	settings.resetCheckboxesOnRecurrence = modelConfig.recurrence.resetCheckboxesOnRecurrence;
	settings.autoStopTimeTrackingOnComplete = modelConfig.timeTracking.autoStopOnComplete;
	settings.nlpTriggers = {
		triggers: (modelConfig.nlp?.triggers ?? []).map((trigger) => ({ ...trigger })),
	};

	if (collectionPath && typeof collectionPath.folder === "string") {
		settings.tasksFolder = collectionPath.folder;
	}

	const filenameFormat = title?.filename_format;
	if (isTaskFilenameFormat(filenameFormat)) {
		settings.taskFilenameFormat = filenameFormat;
	} else if (modelConfig.storeTitleInFilename) {
		settings.taskFilenameFormat = "title";
	}
	settings.customFilenameTemplate =
		typeof title?.custom_filename_template === "string"
			? title.custom_filename_template
			: settings.customFilenameTemplate;
	settings.useFrontmatterMarkdownLinks = links?.write_format === "markdown";
	settings.moveArchivedTasks = archive?.move_on_archive === true;
	settings.archiveFolder = typeof archive?.folder === "string" ? archive.folder : "";
	settings.taskCreationDefaults = {
		...settings.taskCreationDefaults,
		useBodyTemplate: templating?.enabled === true,
		bodyTemplate: typeof templating?.template_path === "string" ? templating.template_path : "",
		useOccurrenceBodyTemplate: templating?.occurrence_enabled === true,
		occurrenceBodyTemplate:
			typeof templating?.occurrence_template_path === "string"
				? templating.occurrence_template_path
				: "",
	};
}

export function buildTaskNotesModelConfig(settings: TaskNotesSettings) {
	return {
		fieldMapping: { ...settings.fieldMapping },
		statuses: settings.customStatuses.map((status) => ({ ...status })),
		priorities: settings.customPriorities.map((priority) => ({ ...priority })),
		defaults: {
			status: settings.defaultTaskStatus,
			priority: settings.defaultTaskPriority,
			taskTag: settings.taskTag || "task",
		},
		taskIdentification: {
			method: settings.taskIdentificationMethod,
			tag: settings.taskTag || "task",
			propertyName: settings.taskPropertyName || "",
			propertyValue: settings.taskPropertyValue || "",
			excludedFolders: settings.excludedFolders || "",
		},
		storeTitleInFilename: settings.storeTitleInFilename,
		userFields: (settings.userFields ?? []).map(({ autosuggestFilter: _filter, ...field }) => ({
			...field,
		})),
		recurrence: {
			maintainDueDateOffset: settings.maintainDueDateOffsetInRecurring === true,
			resetCheckboxesOnRecurrence: settings.resetCheckboxesOnRecurrence === true,
		},
		occurrences: {
			defaultMaterialization: "manual" as const,
			defaultNextTrigger: "completion" as const,
		},
		timeTracking: {
			autoStopOnComplete: settings.autoStopTimeTrackingOnComplete === true,
			autoStopNotification: false,
			defaultSessionDescription: "Work session",
		},
		nlp: {
			triggers: (settings.nlpTriggers?.triggers ?? []).map((trigger) => ({ ...trigger })),
		},
	};
}

export function portableSettingsFingerprint(settings: TaskNotesSettings): string {
	const creationDefaults = settings.taskCreationDefaults;
	return JSON.stringify({
		tasksFolder: settings.tasksFolder,
		moveArchivedTasks: settings.moveArchivedTasks,
		archiveFolder: settings.archiveFolder,
		taskTag: settings.taskTag,
		taskIdentificationMethod: settings.taskIdentificationMethod,
		taskPropertyName: settings.taskPropertyName,
		taskPropertyValue: settings.taskPropertyValue,
		defaultTaskPriority: settings.defaultTaskPriority,
		defaultTaskStatus: settings.defaultTaskStatus,
		taskFilenameFormat: settings.taskFilenameFormat,
		storeTitleInFilename: settings.storeTitleInFilename,
		customFilenameTemplate: settings.customFilenameTemplate,
		fieldMapping: settings.fieldMapping,
		customStatuses: settings.customStatuses,
		customPriorities: settings.customPriorities,
		userFields: (settings.userFields ?? []).map((field) => ({
			key: field.key,
			type: field.type,
			defaultValue: field.defaultValue,
		})),
		autoStopTimeTrackingOnComplete: settings.autoStopTimeTrackingOnComplete,
		maintainDueDateOffsetInRecurring: settings.maintainDueDateOffsetInRecurring,
		resetCheckboxesOnRecurrence: settings.resetCheckboxesOnRecurrence,
		nlpTriggers: settings.nlpTriggers?.triggers ?? [],
		useFrontmatterMarkdownLinks: settings.useFrontmatterMarkdownLinks,
		templating: {
			useBodyTemplate: creationDefaults.useBodyTemplate,
			bodyTemplate: creationDefaults.bodyTemplate,
			useOccurrenceBodyTemplate: creationDefaults.useOccurrenceBodyTemplate,
			occurrenceBodyTemplate: creationDefaults.occurrenceBodyTemplate,
		},
	});
}

export function mergeCanonicalTaskTypeDocument(
	existingMarkdown: string,
	generated: TaskNotesMdbaseResources
): string {
	const existingParts = splitFrontmatter(existingMarkdown);
	const generatedParts = splitFrontmatter(generated.typeDocument);
	const document = YAML.parseDocument(existingParts.frontmatter);
	if (document.errors.length > 0) {
		throw new Error(document.errors.map((error) => error.message).join("; "));
	}
	const existingValue = document.toJS() as unknown;
	if (!isRecord(existingValue)) {
		throw new Error("The existing mdbase type frontmatter must be an object.");
	}

	const desired = generated.type;
	const existingImplementations = Array.isArray(existingValue.implements)
		? existingValue.implements.filter(isRecord)
		: [];
	const desiredImplementation = taskNotesImplementation(desired);
	if (!desiredImplementation) {
		throw new Error("The generated mdbase type has no TaskNotes implementation.");
	}
	const mergedImplementations = existingImplementations.filter(
		(implementation) => implementation.contract !== "tasknotes.task"
	);
	mergedImplementations.push(cloneValue(desiredImplementation) as UnknownRecord);
	document.setIn(["implements"], mergedImplementations);

	deleteStaleManagedFields(document, existingValue, desired);
	for (const path of MANAGED_OPTIONAL_PATHS) {
		if (!hasPath(desired, path)) {
			document.deleteIn(path);
		}
	}
	for (const path of MANAGED_REPLACE_PATHS) {
		if (hasPath(desired, path)) {
			document.setIn(path, document.createNode(cloneValue(valueAt(desired, path))));
		} else {
			document.deleteIn(path);
		}
	}
	const desiredWithoutImplementations = cloneValue(desired) as UnknownRecord;
	delete desiredWithoutImplementations.implements;
	syncDocumentValue(document, [], desiredWithoutImplementations);

	const body = isLegacyGeneratedBody(existingParts.body)
		? generatedParts.body
		: existingParts.body;
	return `---\n${document.toString({ lineWidth: 0 }).trimEnd()}\n---\n${body}`;
}

function validateTaskIdentification(type: UnknownRecord, issues: string[]): void {
	const where = recordAt(type, ["match", "where"]);
	if (!where) {
		issues.push("match.where must contain one TaskNotes identification rule");
		return;
	}
	const entries = Object.entries(where);
	if (entries.length !== 1) {
		issues.push("match.where must contain exactly one TaskNotes identification rule");
		return;
	}

	const [field, rawPredicate] = entries[0];
	const predicate = asRecord(rawPredicate);
	if (!predicate) {
		issues.push(`match.where.${field} must be an object`);
		return;
	}
	const validTagRule =
		field === "tags" &&
		typeof predicate.contains === "string" &&
		predicate.contains.trim().length > 0;
	const validPropertyRule =
		predicate.exists === true ||
		(typeof predicate.eq === "string" && predicate.eq.length > 0) ||
		typeof predicate.eq === "number" ||
		typeof predicate.eq === "boolean";
	if (!validTagRule && !validPropertyRule) {
		issues.push(`match.where.${field} is not a supported TaskNotes identification rule`);
	}
}

function validateVocabularyMirror(
	type: UnknownRecord,
	implementation: UnknownRecord,
	role: "status" | "priority",
	issues: string[]
): void {
	const fieldName = asRecord(implementation.fields)?.[role];
	const policy = asRecord(asRecord(implementation.binding)?.[role]);
	const extensionValues = stringArray(policy, "values");
	if (typeof fieldName !== "string" || extensionValues.length === 0) return;
	const schemaValues = stringArrayAt(type, ["schema", "value", "properties", fieldName, "enum"]);
	if (schemaValues.length > 0 && !sameStrings(extensionValues, schemaValues)) {
		issues.push(`${role}.values contradicts schema enum for ${fieldName}`);
	}

	const extensionDefault = policy?.default;
	const schemaDefault = valueAt(type, ["schema", "value", "properties", fieldName, "default"]);
	const collectionDefault = valueAt(type, ["collection", "read_defaults", fieldName]);
	if (
		extensionDefault !== undefined &&
		schemaDefault !== undefined &&
		extensionDefault !== schemaDefault
	) {
		issues.push(`${role}.default contradicts the schema default for ${fieldName}`);
	}
	if (
		extensionDefault !== undefined &&
		collectionDefault !== undefined &&
		extensionDefault !== collectionDefault
	) {
		issues.push(`${role}.default contradicts collection.read_defaults for ${fieldName}`);
	}
}

function validateUniqueStrings(values: string[], label: string, issues: string[]): void {
	if (new Set(values).size !== values.length) {
		issues.push(`${label} values must be unique`);
	}
}

function deleteStaleManagedFields(
	document: YAML.Document,
	existing: UnknownRecord,
	desired: UnknownRecord
): void {
	const previous = stringArrayAt(existing, [
		"x-tasknotes-generator",
		"managed_fields",
	]);
	const next = new Set(
		stringArrayAt(desired, ["x-tasknotes-generator", "managed_fields"])
	);
	const stale = previous.filter((field) => !next.has(field));
	if (stale.length === 0) return;

	const links = recordAt(existing, ["collection", "links"]) ?? {};
	for (const field of stale) {
		document.deleteIn(["schema", "value", "properties", field]);
		document.deleteIn(["collection", "read_defaults", field]);
		document.deleteIn(["lifecycle", "on_create", "set", field]);
		document.deleteIn(["lifecycle", "on_update", "set", field]);
		for (const linkPath of Object.keys(links)) {
			if (
				linkPath === field ||
				linkPath.startsWith(`${field}.`) ||
				linkPath.startsWith(`${field}[`)
			) {
				document.deleteIn(["collection", "links", linkPath]);
			}
		}
	}
}

function syncDocumentValue(document: YAML.Document, path: DocumentPath, value: unknown): void {
	if (isRecord(value)) {
		for (const [key, child] of Object.entries(value)) {
			syncDocumentValue(document, [...path, key], child);
		}
		return;
	}
	if (path.length > 0) {
		document.setIn(path, cloneValue(value));
	}
}

function splitFrontmatter(markdown: string): { frontmatter: string; body: string } {
	const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
	if (!match) {
		throw new Error("The mdbase task type must contain YAML frontmatter.");
	}
	return {
		frontmatter: match[1],
		body: markdown.slice(match[0].length),
	};
}

function isLegacyGeneratedBody(body: string): boolean {
	return (
		body.includes("automatically generated") && body.includes("should not be edited manually")
	);
}

function mergeResolvedUserFields(
	existing: UserMappedField[],
	resolved: Array<{
		id: string;
		displayName: string;
		key: string;
		type: UserMappedField["type"];
		defaultValue?: UserMappedField["defaultValue"];
	}>
): UserMappedField[] {
	return resolved.map((field) => {
		const previous = existing.find((candidate) => candidate.key === field.key);
		return {
			...field,
			id: previous?.id ?? field.id,
			displayName: previous?.displayName ?? field.displayName,
			...(previous?.autosuggestFilter
				? { autosuggestFilter: previous.autosuggestFilter }
				: {}),
		};
	});
}

function isTaskFilenameFormat(value: unknown): value is TaskNotesSettings["taskFilenameFormat"] {
	return (
		value === "title" ||
		value === "zettel" ||
		value === "timestamp" ||
		value === "uuid" ||
		value === "custom"
	);
}

function sameStrings(left: string[], right: string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

function taskNotesImplementation(type: UnknownRecord): UnknownRecord | null {
	if (!Array.isArray(type.implements)) return null;
	return (
		type.implements.find(
			(value) =>
				isRecord(value) &&
				value.contract === "tasknotes.task" &&
				value.version === TASKNOTES_CONTRACT_VERSION
		) ?? null
	);
}

function stringArray(value: unknown, key: string): string[] {
	return isRecord(value) && Array.isArray(value[key])
		? value[key].filter((entry): entry is string => typeof entry === "string")
		: [];
}

function stringArrayAt(value: unknown, path: DocumentPath): string[] {
	const candidate = valueAt(value, path);
	return Array.isArray(candidate)
		? candidate.filter((entry): entry is string => typeof entry === "string")
		: [];
}

function recordAt(value: unknown, path: DocumentPath): UnknownRecord | null {
	return asRecord(valueAt(value, path));
}

function valueAt(value: unknown, path: DocumentPath): unknown {
	let current = value;
	for (const segment of path) {
		if (!isRecord(current) && !Array.isArray(current)) return undefined;
		current = current[segment as never];
	}
	return current;
}

function hasPath(value: unknown, path: DocumentPath): boolean {
	return valueAt(value, path) !== undefined;
}

function asRecord(value: unknown): UnknownRecord | null {
	return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is UnknownRecord {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(cloneValue);
	if (isRecord(value)) {
		return Object.fromEntries(
			Object.entries(value).map(([key, child]) => [key, cloneValue(child)])
		);
	}
	return value;
}
