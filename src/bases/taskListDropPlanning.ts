import type { FieldMapping, TaskInfo } from "../types";
import {
	applyGroupPropertyMutation,
	moveGroupListValue,
	normalizeGroupValue,
} from "./groupPropertyMutation";
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
	sourceValues?: readonly unknown[];
	targetValues?: readonly unknown[];
}

export interface BuildTaskListGroupDropPlanOptions {
	groupByPropertyId: string | null;
	sourceGroupKey: string | null;
	targetGroupKey: string | null;
	sourceValues?: readonly unknown[];
	targetValues?: readonly unknown[];
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
	coerceGroupKeyForFrontmatter: (property: string, groupKey: string) => string | number | boolean;
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
	coerceGroupKeyForTask?: (property: string, groupKey: string) => string | number | boolean;
	getClearedTaskValue?: (property: keyof FieldMapping) => unknown;
}

export function buildTaskListGroupDropPlan({
	groupByPropertyId,
	sourceGroupKey,
	targetGroupKey,
	sourceValues,
	targetValues,
	lookupMappingKey,
	isListTypeProperty,
}: BuildTaskListGroupDropPlanOptions): TaskListGroupDropPlan {
	const cleanGroupBy = groupByPropertyId ? stripPropertyPrefix(groupByPropertyId) : null;
	const isFormulaGrouping = !!groupByPropertyId?.startsWith("formula.");
	const normalizedTargetGroupKey = normalizeGroupValue(targetGroupKey);
	const normalizedSourceGroupKey = normalizeGroupValue(sourceGroupKey);
	const needsGroupUpdate =
		!!groupByPropertyId && normalizedTargetGroupKey !== normalizedSourceGroupKey;
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
		sourceGroupKey: normalizedSourceGroupKey,
		sourceValues,
		targetValues,
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
		applyGroupPropertyMutation({
			frontmatter,
			property: plan.frontmatterKey,
			sourceValue: plan.sourceGroupKey,
			targetValue: plan.normalizedTargetGroupKey,
			isList: plan.isListGrouping,
			sourceValues: plan.sourceValues,
			targetValues: plan.targetValues,
			coerceValue: coerceGroupKeyForFrontmatter,
		});

		if (plan.groupByTaskProp === "status") {
			updateCompletedDateInFrontmatter(
				frontmatter,
				plan.normalizedTargetGroupKey ?? "",
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
		coerceGroupKeyForTask,
		getClearedTaskValue,
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
		updatedRecord[taskProperty] = moveGroupListValue(
			originalRecord[taskProperty],
			plan.sourceGroupKey,
			plan.normalizedTargetGroupKey,
			plan.sourceValues,
			plan.targetValues
		);
	} else {
		updatedRecord[taskProperty] =
			plan.normalizedTargetGroupKey === null
				? getClearedTaskValue?.(taskProperty)
				: (coerceGroupKeyForTask?.(
						plan.frontmatterKey ?? taskProperty,
						plan.normalizedTargetGroupKey
					) ?? plan.normalizedTargetGroupKey);
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
