import type {
	FilterOperator,
	FilterOptions,
	PriorityConfig,
	PropertyDefinition,
	StatusConfig,
} from "../../types";
import type { TaskNotesSettings } from "../../types/settings";

type UserFieldDefinition = NonNullable<TaskNotesSettings["userFields"]>[number];

export interface BuildFilterOptionsInput {
	statuses: readonly StatusConfig[];
	priorities: readonly PriorityConfig[];
	contexts: readonly string[];
	projects: readonly string[];
	tags: readonly string[];
	taskPaths: Iterable<string>;
	rootFolderLabel: string;
	userFields?: readonly UserFieldDefinition[];
}

export function buildFilterOptions(input: BuildFilterOptionsInput): FilterOptions {
	return {
		statuses: input.statuses,
		priorities: input.priorities,
		contexts: input.contexts,
		projects: input.projects,
		tags: input.tags,
		folders: extractUniqueFoldersFromTaskPaths(input.taskPaths, input.rootFolderLabel),
		userProperties: buildUserPropertyDefinitions(input.userFields || []),
	};
}

export function extractUniqueFoldersFromTaskPaths(
	taskPaths: Iterable<string>,
	rootFolderLabel: string
): readonly string[] {
	const folderSet = new Set<string>();

	for (const taskPath of taskPaths) {
		const lastSlashIndex = taskPath.lastIndexOf("/");
		if (lastSlashIndex > 0) {
			folderSet.add(taskPath.substring(0, lastSlashIndex));
		} else if (lastSlashIndex === -1) {
			folderSet.add("");
		}
	}

	return Array.from(folderSet)
		.sort()
		.map((folder) => (folder === "" ? rootFolderLabel : folder));
}

export function buildUserPropertyDefinitions(
	fields: readonly UserFieldDefinition[]
): PropertyDefinition[] {
	const definitions: PropertyDefinition[] = [];
	for (const field of fields) {
		if (!field || !field.key || !field.displayName) continue;

		definitions.push({
			id: `user:${field.id || field.key}`,
			label: field.displayName,
			category: getUserFieldCategory(field.type),
			supportedOperators: getUserFieldSupportedOperators(field.type),
			valueInputType: getUserFieldValueInputType(field.type),
		});
	}
	return definitions;
}

function getUserFieldCategory(
	type: UserFieldDefinition["type"]
): PropertyDefinition["category"] {
	switch (type) {
		case "boolean":
			return "boolean";
		case "number":
			return "numeric";
		case "date":
			return "date";
		case "list":
		case "text":
		default:
			return "text";
	}
}

function getUserFieldValueInputType(
	type: UserFieldDefinition["type"]
): PropertyDefinition["valueInputType"] {
	switch (type) {
		case "number":
			return "number";
		case "date":
			return "date";
		case "boolean":
			return "none";
		case "list":
		case "text":
		default:
			return "text";
	}
}

function getUserFieldSupportedOperators(type: UserFieldDefinition["type"]): FilterOperator[] {
	switch (type) {
		case "number":
			return [
				"is",
				"is-not",
				"is-greater-than",
				"is-less-than",
				"is-greater-than-or-equal",
				"is-less-than-or-equal",
				"is-empty",
				"is-not-empty",
			];
		case "date":
			return [
				"is",
				"is-not",
				"is-before",
				"is-after",
				"is-on-or-before",
				"is-on-or-after",
				"is-empty",
				"is-not-empty",
			];
		case "boolean":
			return ["is-checked", "is-not-checked"];
		case "list":
			return ["contains", "does-not-contain", "is-empty", "is-not-empty"];
		case "text":
		default:
			return ["is", "is-not", "contains", "does-not-contain", "is-empty", "is-not-empty"];
	}
}
