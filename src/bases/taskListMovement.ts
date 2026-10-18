import type {
	BuildTaskListGroupDropPlanOptions,
	TaskListGroupDropPlan,
} from "./taskListDropPlanning";
import { buildTaskListGroupDropPlan } from "./taskListDropPlanning";
import { isWritableGroupingProperty } from "./groupPropertyMutation";

/** Values, not display titles or colon-delimited composite keys, identify a destination. */
export type TaskListDestination = {
	groupKey: string | null;
	subGroupKey?: string | null;
	groupValues?: readonly unknown[];
	subGroupValues?: readonly unknown[];
	/** A populated list group whose members have no recorded property value (e.g. inline tags). */
	groupValuesUnresolved?: boolean;
	subGroupValuesUnresolved?: boolean;
};

export type TaskListMovementPlan = {
	kind: "move" | "reorder" | "none" | "blocked";
	changes: TaskListGroupDropPlan[];
	readOnlyProperties: string[];
	/** List properties whose destination values cannot be determined without guessing. */
	unresolvedProperties: string[];
};

export function taskListDestinationKey(destination: TaskListDestination): string {
	return JSON.stringify([
		destination.groupKey,
		destination.subGroupKey !== undefined,
		destination.subGroupKey ?? null,
	]);
}

export function planTaskListMovement(options: {
	groupByPropertyId: string | null;
	subGroupPropertyId: string | null;
	source: TaskListDestination;
	target: TaskListDestination;
	canReorder: boolean;
	isHeader: boolean;
	lookupMappingKey: BuildTaskListGroupDropPlanOptions["lookupMappingKey"];
	isListTypeProperty: BuildTaskListGroupDropPlanOptions["isListTypeProperty"];
}): TaskListMovementPlan {
	const changes: TaskListGroupDropPlan[] = [];
	const unresolvedProperties: string[] = [];
	const addChange = (
		property: string | null,
		source: string | null,
		target: string | null,
		sourceValues?: readonly unknown[],
		targetValues?: readonly unknown[],
		targetUnresolved?: boolean
	) => {
		const plan = buildTaskListGroupDropPlan({
			groupByPropertyId: property,
			sourceGroupKey: source,
			targetGroupKey: target,
			sourceValues,
			targetValues,
			lookupMappingKey: options.lookupMappingKey,
			isListTypeProperty: options.isListTypeProperty,
		});
		if (
			plan.needsGroupUpdate &&
			!changes.some((change) => change.frontmatterKey === plan.frontmatterKey)
		) {
			changes.push(plan);
			if (
				targetUnresolved &&
				plan.isListGrouping &&
				plan.normalizedTargetGroupKey !== null &&
				!targetValues
			)
				unresolvedProperties.push(plan.groupByPropertyId ?? "");
		}
	};
	// Without native primary grouping, the List's subGroup option becomes its sole group.
	addChange(
		options.groupByPropertyId ?? options.subGroupPropertyId,
		options.source.groupKey,
		options.target.groupKey,
		options.source.groupValues,
		options.target.groupValues,
		options.target.groupValuesUnresolved
	);
	// A primary header changes only that property. It never guesses a child subgroup.
	if (options.groupByPropertyId && options.target.subGroupKey !== undefined) {
		addChange(
			options.subGroupPropertyId,
			options.source.subGroupKey ?? null,
			options.target.subGroupKey,
			options.source.subGroupValues,
			options.target.subGroupValues,
			options.target.subGroupValuesUnresolved
		);
	}
	const readOnlyProperties = changes
		.filter(
			(change) =>
				!isWritableGroupingProperty(change.groupByPropertyId ?? "", change.groupByTaskProp)
		)
		.map((change) => change.groupByPropertyId ?? "");
	return {
		kind:
			readOnlyProperties.length > 0 || unresolvedProperties.length > 0
				? "blocked"
				: changes.length > 0
					? "move"
					: options.canReorder && !options.isHeader
						? "reorder"
						: "none",
		changes,
		readOnlyProperties,
		unresolvedProperties,
	};
}
