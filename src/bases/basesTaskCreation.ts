import type { FieldMapping, FieldMappingKey, TaskInfo } from "../types";
import type { UserMappedField } from "../types/settings";
import { normalizeDependencyList } from "../utils/dependencyUtils";
import { stringifyUnknown } from "../utils/stringUtils";

export type BasesCreateFileFrontmatter = Record<string, unknown>;

export type TaskCreationPrepopulatedValues = Partial<TaskInfo> & {
	customFrontmatter?: Record<string, unknown>;
};

export type TaskCreationFieldMapper = {
	toUserField(field: FieldMappingKey): string;
};

const CORE_TASK_FIELDS = [
	"title",
	"status",
	"priority",
	"due",
	"scheduled",
	"contexts",
	"projects",
	"timeEstimate",
	"recurrence",
	"completedDate",
	"dateCreated",
	"blockedBy",
] as const satisfies readonly FieldMappingKey[];

function toStringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.map(String) : [String(value)];
}

function getFrontmatterValue(
	frontmatter: BasesCreateFileFrontmatter,
	fieldMapper: TaskCreationFieldMapper,
	field: FieldMappingKey
): unknown {
	return frontmatter[fieldMapper.toUserField(field)];
}

function toTaskCreationString(value: unknown): string {
	return stringifyUnknown(value);
}

function buildMappedKeySet(
	fieldMapper: TaskCreationFieldMapper,
	userFields: readonly Pick<UserMappedField, "key">[]
): Set<string> {
	return new Set([
		...CORE_TASK_FIELDS.map((field) => fieldMapper.toUserField(field)),
		fieldMapper.toUserField("archiveTag"),
		"tags",
		...userFields.map((field) => field.key),
	]);
}

export function buildTaskCreationDataFromFrontmatter(
	frontmatter: BasesCreateFileFrontmatter,
	fieldMapper: TaskCreationFieldMapper,
	userFields: readonly Pick<UserMappedField, "key">[] = []
): TaskCreationPrepopulatedValues {
	const prePopulatedValues: Partial<TaskInfo> = {};
	const customFrontmatter: Record<string, unknown> = {};

	const title = getFrontmatterValue(frontmatter, fieldMapper, "title");
	if (title !== undefined) {
		prePopulatedValues.title = toTaskCreationString(title);
	}

	const status = getFrontmatterValue(frontmatter, fieldMapper, "status");
	if (status !== undefined) {
		prePopulatedValues.status = toTaskCreationString(status);
	}

	const priority = getFrontmatterValue(frontmatter, fieldMapper, "priority");
	if (priority !== undefined) {
		prePopulatedValues.priority = toTaskCreationString(priority);
	}

	const due = getFrontmatterValue(frontmatter, fieldMapper, "due");
	if (due !== undefined) {
		prePopulatedValues.due = toTaskCreationString(due);
	}

	const scheduled = getFrontmatterValue(frontmatter, fieldMapper, "scheduled");
	if (scheduled !== undefined) {
		prePopulatedValues.scheduled = toTaskCreationString(scheduled);
	}

	const contexts = getFrontmatterValue(frontmatter, fieldMapper, "contexts");
	if (contexts !== undefined) {
		prePopulatedValues.contexts = toStringArray(contexts);
	}

	const projects = getFrontmatterValue(frontmatter, fieldMapper, "projects");
	if (projects !== undefined) {
		prePopulatedValues.projects = toStringArray(projects);
	}

	if (frontmatter.tags !== undefined) {
		prePopulatedValues.tags = toStringArray(frontmatter.tags);
	}

	if (Array.isArray(frontmatter.tags)) {
		prePopulatedValues.archived = frontmatter.tags.includes(
			fieldMapper.toUserField("archiveTag")
		);
	}

	const timeEstimate = getFrontmatterValue(frontmatter, fieldMapper, "timeEstimate");
	if (timeEstimate !== undefined) {
		prePopulatedValues.timeEstimate = Number(timeEstimate);
	}

	const recurrence = getFrontmatterValue(frontmatter, fieldMapper, "recurrence");
	if (recurrence !== undefined) {
		prePopulatedValues.recurrence = toTaskCreationString(recurrence);
	}

	const completedDate = getFrontmatterValue(frontmatter, fieldMapper, "completedDate");
	if (completedDate !== undefined) {
		prePopulatedValues.completedDate = toTaskCreationString(completedDate);
	}

	const dateCreated = getFrontmatterValue(frontmatter, fieldMapper, "dateCreated");
	if (dateCreated !== undefined) {
		prePopulatedValues.dateCreated = toTaskCreationString(dateCreated);
	}

	const blockedBy = getFrontmatterValue(frontmatter, fieldMapper, "blockedBy");
	if (blockedBy !== undefined) {
		prePopulatedValues.blockedBy = normalizeDependencyList(blockedBy);
	}

	for (const userField of userFields) {
		if (frontmatter[userField.key] !== undefined) {
			customFrontmatter[userField.key] = frontmatter[userField.key];
		}
	}

	const mappedKeys = buildMappedKeySet(fieldMapper, userFields);
	for (const [key, value] of Object.entries(frontmatter)) {
		if (!mappedKeys.has(key)) {
			customFrontmatter[key] = value;
		}
	}

	const taskCreationData: TaskCreationPrepopulatedValues = { ...prePopulatedValues };
	if (Object.keys(customFrontmatter).length > 0) {
		taskCreationData.customFrontmatter = customFrontmatter;
	}

	return taskCreationData;
}

export type TaskCreationFieldMapping = Pick<
	FieldMapping,
	(typeof CORE_TASK_FIELDS)[number] | "archiveTag"
>;
