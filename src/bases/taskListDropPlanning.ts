import type { FieldMapping, TaskInfo } from "../types";
import { stringifyUnknown } from "../utils/stringUtils";
import { stripPropertyPrefix } from "./sortOrderUtils";

export interface TaskListGroupDropPlan {
	groupByPropertyId: string | null;
	cleanGroupBy: string | null;
	frontmatterKey: string | null;
	groupByTaskProp: keyof FieldMapping | null;
	isFormulaGrouping: boolean;
	isListGrouping: boolean;
	needsGroupUpdate: boolean;
	normalizedTargetGroupKey: string | null;
	sourceGroupKey: string | null;
}

export interface BuildTaskListGroupDropPlanOptions {
	groupByPropertyId: string | null;
	sourceGroupKey: string | null;
	targetGroupKey: string | null;
	lookupMappingKey: (frontmatterPropertyName: string) => keyof FieldMapping | null;
	isListTypeProperty: (propertyName: string) => boolean;
}

export interface ApplyTaskListDropFrontmatterMutationOptions {
	frontmatter: Record<string, unknown>;
	plan: TaskListGroupDropPlan;
	sortOrderField: string;
	sortOrder: string | null;
	isRecurring: boolean;
	dateModifiedField: string;
	coerceGroupKeyForFrontmatter: (
		property: string,
		groupKey: string
	) => string | number | boolean;
	updateCompletedDateInFrontmatter: (
		frontmatter: Record<string, unknown>,
		status: string,
		isRecurring: boolean
	) => void;
	getTimestamp: () => string;
}

export interface BuildTaskListDropSideEffectTaskOptions {
	plan: TaskListGroupDropPlan;
	isCompletedStatus: (status: string) => boolean;
	getTimestamp: () => string;
	getCompletedDate: () => string;
}

export function buildTaskListGroupDropPlan({
	groupByPropertyId,
	sourceGroupKey,
	targetGroupKey,
	lookupMappingKey,
	isListTypeProperty,
}: BuildTaskListGroupDropPlanOptions): TaskListGroupDropPlan {
	const cleanGroupBy = groupByPropertyId ? stripPropertyPrefix(groupByPropertyId) : null;
	const isFormulaGrouping = !!groupByPropertyId?.startsWith("formula.");
	const normalizedTargetGroupKey = targetGroupKey === "None" ? null : targetGroupKey;
	const needsGroupUpdate =
		!!groupByPropertyId && normalizedTargetGroupKey !== sourceGroupKey;
	const groupByTaskProp = cleanGroupBy ? lookupMappingKey(cleanGroupBy) : null;
	const isListGrouping = !!cleanGroupBy && isListTypeProperty(cleanGroupBy);
	const frontmatterKey = groupByPropertyId
		? groupByPropertyId.replace(/^(note\.|file\.|task\.)/, "")
		: null;

	return {
		groupByPropertyId,
		cleanGroupBy,
		frontmatterKey,
		groupByTaskProp,
		isFormulaGrouping,
		isListGrouping,
		needsGroupUpdate,
		normalizedTargetGroupKey,
		sourceGroupKey,
	};
}

export function applyTaskListDropFrontmatterMutation({
	frontmatter,
	plan,
	sortOrderField,
	sortOrder,
	isRecurring,
	dateModifiedField,
	coerceGroupKeyForFrontmatter,
	updateCompletedDateInFrontmatter,
	getTimestamp,
}: ApplyTaskListDropFrontmatterMutationOptions): void {
	if (plan.needsGroupUpdate && plan.frontmatterKey) {
		if (plan.isListGrouping) {
			const currentValue = frontmatter[plan.frontmatterKey];
			const currentValues = Array.isArray(currentValue)
				? currentValue
				: currentValue
					? [currentValue]
					: [];
			const newValue = currentValues.filter((value) => value !== plan.sourceGroupKey);
			if (
				plan.normalizedTargetGroupKey !== null &&
				!newValue.includes(plan.normalizedTargetGroupKey)
			) {
				newValue.push(plan.normalizedTargetGroupKey);
			}
			if (newValue.length > 0) {
				frontmatter[plan.frontmatterKey] = newValue;
			} else {
				delete frontmatter[plan.frontmatterKey];
			}
		} else if (plan.normalizedTargetGroupKey === null) {
			delete frontmatter[plan.frontmatterKey];
		} else {
			frontmatter[plan.frontmatterKey] = coerceGroupKeyForFrontmatter(
				plan.frontmatterKey,
				plan.normalizedTargetGroupKey
			);
		}

		if (plan.groupByTaskProp === "status" && plan.normalizedTargetGroupKey !== null) {
			updateCompletedDateInFrontmatter(
				frontmatter,
				plan.normalizedTargetGroupKey,
				isRecurring
			);
			frontmatter[dateModifiedField] = getTimestamp();
		}
	}

	if (sortOrder !== null) {
		frontmatter[sortOrderField] = sortOrder;
	}
}

export function buildTaskListDropSideEffectTask(
	originalTask: TaskInfo,
	{
		plan,
		isCompletedStatus,
		getTimestamp,
		getCompletedDate,
	}: BuildTaskListDropSideEffectTaskOptions
): TaskInfo | null {
	if (!plan.needsGroupUpdate || !plan.groupByTaskProp) {
		return null;
	}

	const updatedTask = { ...originalTask };
	const originalRecord = originalTask as unknown as Record<string, unknown>;
	const updatedRecord = updatedTask as unknown as Record<string, unknown>;
	const taskProperty = plan.groupByTaskProp;

	if (plan.isListGrouping) {
		const originalValue = originalRecord[taskProperty];
		const currentValues = Array.isArray(originalValue)
			? [...originalValue]
			: originalValue
				? [stringifyUnknown(originalValue)]
				: [];
		const nextValues = currentValues.filter((value) => value !== plan.sourceGroupKey);
		if (
			plan.normalizedTargetGroupKey !== null &&
			!nextValues.includes(plan.normalizedTargetGroupKey)
		) {
			nextValues.push(plan.normalizedTargetGroupKey);
		}
		updatedRecord[taskProperty] = nextValues;
	} else {
		updatedRecord[taskProperty] = plan.normalizedTargetGroupKey;
	}

	updatedTask.dateModified = getTimestamp();

	if (taskProperty === "status" && !originalTask.recurrence) {
		if (
			plan.normalizedTargetGroupKey !== null &&
			isCompletedStatus(plan.normalizedTargetGroupKey)
		) {
			updatedTask.completedDate = getCompletedDate();
		} else {
			updatedTask.completedDate = undefined;
		}
	}

	return updatedTask;
}
