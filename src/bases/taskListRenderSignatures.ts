import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import type { TaskCardOptions } from "../ui/TaskCard";
import { getTaskCardPropertyValue } from "../ui/taskCardPropertyAccess";
import { normalizeTaskSignatureValue } from "./taskSignatureValue";

export function buildTaskListTaskSignature(
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	visibleProperties: string[] = []
): string {
	// Snapshot task data, not just a hand-maintained subset: badges and controls
	// also depend on fields that may not be selected as visible properties.
	// Raw Bases entries are live objects (and can be circular); resolve only
	// displayed values through the same accessor used by task cards instead,
	// then normalize any Bases Values those accessors return.
	return JSON.stringify(
		normalizeTaskSignatureValue({
			task: { ...task, basesData: undefined },
			visibleValues: visibleProperties.map((property) =>
				getTaskCardPropertyValue(task, property, plugin)
			),
		})
	);
}

export function buildTaskListCardRenderSignature(
	visibleProperties: string[] | undefined,
	cardOptions: TaskCardOptions,
	includeRelationshipOrder = false
): string {
	const propertyLabels = cardOptions.propertyLabels
		? Object.entries(cardOptions.propertyLabels).sort(([left], [right]) =>
				left.localeCompare(right)
			)
		: [];
	return JSON.stringify({
		visibleProperties: visibleProperties ?? null,
		propertyLabels,
		expandedRelationshipFilterMode: cardOptions.expandedRelationshipFilterMode ?? null,
		// Only non-virtual cards are reused across updates. Snapshot the live map
		// to refresh hidden children's order without resetting virtual scroll.
		expandedRelationshipTaskOrder:
			includeRelationshipOrder && cardOptions.expandedRelationshipTaskOrder
				? [...cardOptions.expandedRelationshipTaskOrder]
				: null,
		targetDate: cardOptions.targetDate?.toISOString().slice(0, 10) ?? null,
	});
}
