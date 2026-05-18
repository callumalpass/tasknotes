export type KanbanTaskDragSource = {
	taskPath: string;
	sourceElement: HTMLElement;
};

export type KanbanDropTarget = {
	taskPath: string;
	above: boolean;
};

export type KanbanDropTargetResolutionInput = {
	dropTarget: KanbanDropTarget | undefined;
	isCrossScope: boolean;
	targetInDropScope: boolean;
	fallbackDropTarget?: KanbanDropTarget;
};

export type KanbanTaskDropUpdatePlan = {
	path: string;
	sourceColumn: string | null | undefined;
	sourceSwimlane: string | null | undefined;
	needsGroupUpdate: boolean;
	needsSwimlaneUpdate: boolean;
	groupByFrontmatterKey: string;
	swimlaneFrontmatterKey?: string;
	groupByTaskProp: string | null;
	swimlaneTaskProp: string | null;
	changedTaskProp: string | null;
	oldPropValue: string | null | undefined;
	newPropValue: string | null;
	newGroupValue: string;
	newSwimLaneValue: string | null;
	isGroupByListProperty: boolean;
	isSwimlaneListProperty: boolean;
};

export type KanbanTaskDropUpdateInput = {
	path: string;
	sourceColumn: string | null | undefined;
	sourceSwimlane: string | null | undefined;
	newGroupValue: string;
	newSwimLaneValue: string | null;
	groupByPropertyId: string;
	swimLanePropertyId: string | null | undefined;
	groupByTaskProp: string | null;
	swimlaneTaskProp: string | null;
	isGroupByListProperty: boolean;
	isSwimlaneListProperty: boolean;
};

export type KanbanFrontmatterDropUpdateOptions = {
	coerceGroupValue: (frontmatterKey: string, groupKey: string) => string | number | boolean;
};

type FrontmatterRecord = Record<string, unknown>;

function getEventTargetElement(target: EventTarget | null): HTMLElement | null {
	const node = target as Node | null;
	if (!node || typeof node.nodeType !== "number") {
		return null;
	}

	return node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
}

export function resolveNestedTaskCardDragSource(
	target: EventTarget | null,
	cardWrapper: HTMLElement
): KanbanTaskDragSource | null {
	const targetEl = getEventTargetElement(target);
	if (!targetEl || !cardWrapper.contains(targetEl)) {
		return null;
	}

	const nestedTaskCard = targetEl.closest<HTMLElement>(
		".task-card__subtasks .task-card[data-task-path]"
	);
	if (!nestedTaskCard || !cardWrapper.contains(nestedTaskCard)) {
		return null;
	}

	const taskPath = nestedTaskCard.dataset.taskPath;
	if (!taskPath) {
		return null;
	}

	return {
		taskPath,
		sourceElement: nestedTaskCard,
	};
}

export function createKanbanDropTarget(
	taskPath: string | null | undefined,
	above: boolean
): KanbanDropTarget | undefined {
	return taskPath ? { taskPath, above } : undefined;
}

export function getKanbanDraggedPaths(
	draggedTaskPaths: readonly string[],
	draggedTaskPath: string
): string[] {
	return draggedTaskPaths.length > 0 ? [...draggedTaskPaths] : [draggedTaskPath];
}

export function resolveKanbanContainerDropTarget({
	dropTarget,
	isCrossScope,
	targetInDropScope,
	fallbackDropTarget,
}: KanbanDropTargetResolutionInput): KanbanDropTarget | undefined {
	if (dropTarget && isCrossScope && !targetInDropScope) {
		return undefined;
	}

	if (!dropTarget && !isCrossScope) {
		return fallbackDropTarget;
	}

	return dropTarget;
}

export function getKanbanFrontmatterKey(propertyId: string): string {
	return propertyId.replace(/^(note\.|file\.|task\.)/, "");
}

export function planKanbanTaskDropUpdate({
	path,
	sourceColumn,
	sourceSwimlane,
	newGroupValue,
	newSwimLaneValue,
	groupByPropertyId,
	swimLanePropertyId,
	groupByTaskProp,
	swimlaneTaskProp,
	isGroupByListProperty,
	isSwimlaneListProperty,
}: KanbanTaskDropUpdateInput): KanbanTaskDropUpdatePlan {
	const needsGroupUpdate = sourceColumn !== newGroupValue;
	const needsSwimlaneUpdate =
		newSwimLaneValue !== null && !!swimLanePropertyId && sourceSwimlane !== newSwimLaneValue;
	const changedTaskProp = needsGroupUpdate
		? groupByTaskProp
		: needsSwimlaneUpdate
			? swimlaneTaskProp
			: null;
	const oldPropValue = needsGroupUpdate ? sourceColumn : sourceSwimlane;
	const newPropValue = needsGroupUpdate ? newGroupValue : newSwimLaneValue;

	return {
		path,
		sourceColumn,
		sourceSwimlane,
		needsGroupUpdate,
		needsSwimlaneUpdate,
		groupByFrontmatterKey: getKanbanFrontmatterKey(groupByPropertyId),
		swimlaneFrontmatterKey: swimLanePropertyId
			? getKanbanFrontmatterKey(swimLanePropertyId)
			: undefined,
		groupByTaskProp,
		swimlaneTaskProp,
		changedTaskProp,
		oldPropValue,
		newPropValue,
		newGroupValue,
		newSwimLaneValue,
		isGroupByListProperty,
		isSwimlaneListProperty,
	};
}

export function kanbanDropPlanNeedsWrite(
	plan: KanbanTaskDropUpdatePlan,
	hasSortOrderPlan: boolean
): boolean {
	return plan.needsGroupUpdate || plan.needsSwimlaneUpdate || hasSortOrderPlan;
}

function normalizeListValue(value: unknown): unknown[] {
	if (Array.isArray(value)) {
		return value;
	}
	return value ? [value] : [];
}

function updateListDropValue(
	currentValue: unknown,
	sourceValue: string | null | undefined,
	targetValue: string
): unknown[] {
	const nextValue = normalizeListValue(currentValue).filter((value) => value !== sourceValue);
	if (!nextValue.includes(targetValue) && targetValue !== "None") {
		nextValue.push(targetValue);
	}
	return nextValue.length > 0 ? nextValue : [];
}

export function applyKanbanTaskDropFrontmatterPlan(
	frontmatter: FrontmatterRecord,
	plan: KanbanTaskDropUpdatePlan,
	options: KanbanFrontmatterDropUpdateOptions
): void {
	if (plan.needsGroupUpdate) {
		if (plan.isGroupByListProperty && plan.sourceColumn) {
			frontmatter[plan.groupByFrontmatterKey] = updateListDropValue(
				frontmatter[plan.groupByFrontmatterKey],
				plan.sourceColumn,
				plan.newGroupValue
			);
		} else {
			frontmatter[plan.groupByFrontmatterKey] = options.coerceGroupValue(
				plan.groupByFrontmatterKey,
				plan.newGroupValue
			);
		}
	}

	if (plan.needsSwimlaneUpdate && plan.swimlaneFrontmatterKey && plan.newSwimLaneValue !== null) {
		if (plan.isSwimlaneListProperty && plan.sourceSwimlane) {
			frontmatter[plan.swimlaneFrontmatterKey] = updateListDropValue(
				frontmatter[plan.swimlaneFrontmatterKey],
				plan.sourceSwimlane,
				plan.newSwimLaneValue
			);
		} else {
			frontmatter[plan.swimlaneFrontmatterKey] = options.coerceGroupValue(
				plan.swimlaneFrontmatterKey,
				plan.newSwimLaneValue
			);
		}
	}
}
