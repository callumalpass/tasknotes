import type { App } from "obsidian";
import type {
	FilterCondition,
	FilterGroup,
	FilterOperator,
	FilterProperty,
	TaskInfo,
} from "../../types";
import type { UserMappedField } from "../../types/settings";
import {
	FilterUtils,
	type TaskPropertyValue,
} from "../../utils/FilterUtils";
import { getEffectiveTaskStatus } from "../../utils/helpers";
import { getProjectDisplayName } from "../../utils/linkUtils";
import {
	coerceUserFieldTaskValue,
	findUserFieldById,
} from "./userFieldValues";

export interface FilterPredicateProjectSubtasks {
	isTaskUsedAsProjectSync(path: string): boolean;
}

export interface FilterPredicateEvaluationContext {
	app?: App;
	userFields?: readonly UserMappedField[];
	projectSubtasksService?: FilterPredicateProjectSubtasks;
	getUserFieldRawValue(task: TaskInfo, fieldKey: string): unknown;
	getCompletedStatuses(): string[];
	isCompletedStatus(status: string): boolean;
}

export function evaluateFilterNode(
	node: FilterGroup | FilterCondition,
	task: TaskInfo,
	context: FilterPredicateEvaluationContext,
	targetDate?: Date
): boolean {
	if (node.type === "condition") {
		return evaluateFilterCondition(node, task, context, targetDate);
	} else if (node.type === "group") {
		return evaluateFilterGroup(node, task, context, targetDate);
	}
	return true;
}

export function evaluateFilterGroup(
	group: FilterGroup,
	task: TaskInfo,
	context: FilterPredicateEvaluationContext,
	targetDate?: Date
): boolean {
	if (group.children.length === 0) {
		return true;
	}

	const completeChildren = group.children.filter((child) => {
		if (child.type === "condition") {
			return FilterUtils.isFilterNodeComplete(child);
		}
		return true;
	});

	if (completeChildren.length === 0) {
		return true;
	}

	if (group.conjunction === "and") {
		return completeChildren.every((child) =>
			evaluateFilterNode(child, task, context, targetDate)
		);
	} else if (group.conjunction === "or") {
		return completeChildren.some((child) =>
			evaluateFilterNode(child, task, context, targetDate)
		);
	}

	return true;
}

export function evaluateFilterCondition(
	condition: FilterCondition,
	task: TaskInfo,
	context: FilterPredicateEvaluationContext,
	targetDate?: Date
): boolean {
	const { property, operator, value } = condition;

	if (typeof property === "string" && property.startsWith("user:")) {
		return evaluateUserFieldCondition(condition, task, context);
	}

	let taskValue: TaskPropertyValue = FilterUtils.getTaskPropertyValue(
		task,
		property
	);

	if (property === "hasSubtasks" && context.projectSubtasksService) {
		taskValue = context.projectSubtasksService.isTaskUsedAsProjectSync(task.path);
	}

	if (property === "status.isCompleted") {
		const effectiveStatus = getEffectiveTaskStatus(
			task,
			targetDate || new Date(),
			context.getCompletedStatuses()[0]
		);
		taskValue = context.isCompletedStatus(effectiveStatus);
	}

	if (
		property === "projects" &&
		(operator === "contains" || operator === "does-not-contain")
	) {
		return evaluateProjectsCondition(
			taskValue,
			operator,
			value,
			context.app
		);
	}

	return FilterUtils.applyOperator(
		taskValue,
		operator,
		value,
		condition.id,
		property
	);
}

function evaluateUserFieldCondition(
	condition: FilterCondition,
	task: TaskInfo,
	context: FilterPredicateEvaluationContext
): boolean {
	const { property, operator, value } = condition;
	const fieldId = property.slice(5);
	const field = findUserFieldById(context.userFields, fieldId);
	const taskValue: TaskPropertyValue = field
		? coerceUserFieldTaskValue(field, context.getUserFieldRawValue(task, field.key))
		: undefined;

	if (
		field?.type === "list" &&
		(operator === "contains" || operator === "does-not-contain")
	) {
		const haystack = Array.isArray(taskValue)
			? taskValue
			: taskValue != null
				? [String(taskValue)]
				: [];
		const needles = Array.isArray(value) ? value : [String(value ?? "")];
		const match = needles.some(
			(needle) =>
				typeof needle === "string" &&
				haystack.some(
					(candidate) =>
						typeof candidate === "string" &&
						candidate.toLowerCase().includes(needle.toLowerCase())
				)
		);
		return operator === "contains" ? match : !match;
	}

	const propertyForDate =
		field?.type === "date" ? ("due" as FilterProperty) : property;
	return FilterUtils.applyOperator(
		taskValue,
		operator,
		value,
		condition.id,
		propertyForDate
	);
}

export function evaluateProjectsCondition(
	taskValue: TaskPropertyValue,
	operator: FilterOperator,
	conditionValue: TaskPropertyValue,
	app?: App
): boolean {
	if (!Array.isArray(taskValue)) {
		return false;
	}

	if (typeof conditionValue !== "string") {
		return false;
	}

	const conditionProjectName = extractProjectName(conditionValue, app);
	if (!conditionProjectName) {
		return false;
	}

	const hasMatch = taskValue.some((taskProject) => {
		if (!taskProject || typeof taskProject !== "string") {
			return false;
		}

		const taskProjectName = extractProjectName(taskProject, app);
		if (!taskProjectName) {
			return false;
		}

		if (taskProjectName === conditionProjectName) {
			return true;
		}

		return compareProjectWikilinks(taskProject, conditionValue, app);
	});

	return operator === "contains" ? hasMatch : !hasMatch;
}

export function extractProjectName(projectValue: string, app?: App): string | null {
	if (!projectValue || typeof projectValue !== "string") {
		return null;
	}

	const displayName = getProjectDisplayName(projectValue, app);
	return displayName ? displayName : null;
}

export function compareProjectWikilinks(
	taskProject: string,
	conditionProject: string,
	app?: App
): boolean {
	if (!app) {
		return false;
	}

	const taskLinkPath = extractWikilinkPath(taskProject);
	const conditionLinkPath = extractWikilinkPath(conditionProject);

	if (!taskLinkPath || !conditionLinkPath) {
		return false;
	}

	const taskFile = app.metadataCache.getFirstLinkpathDest(taskLinkPath, "");
	const conditionFile = app.metadataCache.getFirstLinkpathDest(
		conditionLinkPath,
		""
	);

	if (taskFile && conditionFile) {
		return taskFile.path === conditionFile.path;
	}

	return false;
}

export function extractWikilinkPath(linkValue: string): string | null {
	if (!linkValue || typeof linkValue !== "string") {
		return null;
	}

	if (linkValue.startsWith("[[") && linkValue.endsWith("]]")) {
		return linkValue.slice(2, -2);
	}

	return linkValue;
}
