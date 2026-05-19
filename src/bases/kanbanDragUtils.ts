import type { TaskInfo } from "../types";
import { clearStaticStyleClasses } from "../utils/staticStyleClasses";

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

export type KanbanDropTargetFromContainerInput = {
	cardsContainer: HTMLElement;
	draggedTaskPaths: readonly string[];
	currentInsertionIndex: number;
	clientY?: number;
};

export type KanbanOptimisticReorderInput = {
	draggedPaths: readonly string[];
	dropTarget: KanbanDropTarget | undefined;
	targetContainer?: HTMLElement | null;
	currentTaskElements: ReadonlyMap<string, HTMLElement>;
	removeEmptyCellHint?: (container: HTMLElement) => void;
	log?: (message: string, data?: Record<string, unknown>) => void;
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

export type KanbanStatusDerivativePlan = {
	statusValue: string;
	isRecurring: boolean;
	dateModifiedField: string;
	dateModifiedValue: string;
};

export type KanbanStatusDerivativePlanInput = {
	plan: KanbanTaskDropUpdatePlan;
	task: Pick<TaskInfo, "recurrence"> | null | undefined;
	dateModifiedField: string;
	dateModifiedValue: string;
};

export type KanbanDropSideEffectPlan = {
	changedTaskProp: keyof TaskInfo;
	oldPropValue: string | null | undefined;
	newPropValue: string | null;
	updatedTask: TaskInfo;
};

export type KanbanDropSideEffectPlanInput = {
	plan: KanbanTaskDropUpdatePlan;
	originalTask: TaskInfo | null | undefined;
	dateModifiedValue: string;
	isCompletedStatus: (status: string) => boolean;
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

export function getKanbanCardDropTargetFromClientY(
	cardWrapper: HTMLElement,
	taskPath: string,
	clientY: number
): KanbanDropTarget {
	const rect = cardWrapper.getBoundingClientRect();
	return {
		taskPath,
		above: clientY < rect.top + rect.height / 2,
	};
}

export function reconstructKanbanDropTargetFromContainer({
	cardsContainer,
	draggedTaskPaths,
	currentInsertionIndex,
	clientY,
}: KanbanDropTargetFromContainerInput): KanbanDropTarget | undefined {
	const visibleCards = Array.from(
		cardsContainer.querySelectorAll<HTMLElement>(".kanban-view__card-wrapper")
	).filter((el) => {
		const taskPath = el.dataset.taskPath;
		return !!taskPath && !draggedTaskPaths.includes(taskPath);
	});

	if (visibleCards.length === 0) return undefined;

	if (clientY !== undefined && Number.isFinite(clientY)) {
		const targetIndex = visibleCards.findIndex((card) => {
			const rect = card.getBoundingClientRect();
			return clientY < rect.top + rect.height / 2;
		});

		if (targetIndex === -1) {
			const lastCard = visibleCards[visibleCards.length - 1];
			return {
				taskPath: lastCard.dataset.taskPath as string,
				above: false,
			};
		}

		return { taskPath: visibleCards[targetIndex].dataset.taskPath as string, above: true };
	}

	const idx =
		currentInsertionIndex >= 0
			? Math.min(currentInsertionIndex, visibleCards.length)
			: visibleCards.length;

	if (idx === 0) {
		return { taskPath: visibleCards[0].dataset.taskPath as string, above: true };
	}

	return { taskPath: visibleCards[idx - 1].dataset.taskPath as string, above: false };
}

export function performKanbanOptimisticReorder({
	draggedPaths,
	dropTarget,
	targetContainer,
	currentTaskElements,
	removeEmptyCellHint,
	log,
}: KanbanOptimisticReorderInput): boolean {
	if (draggedPaths.length === 0) {
		log?.("OPTIMISTIC-REORDER: bail — no dragged paths");
		return false;
	}

	const resolveDraggedElements = (): HTMLElement[] | null => {
		const draggedElements: HTMLElement[] = [];
		for (const path of draggedPaths) {
			const draggedEl = currentTaskElements.get(path);
			if (!draggedEl) {
				log?.("OPTIMISTIC-REORDER: bail — element not in currentTaskElements", {
					path: path.split("/").pop(),
				});
				return null;
			}
			draggedElements.push(draggedEl);
		}
		return draggedElements;
	};

	if (!dropTarget) {
		if (!targetContainer) {
			log?.("OPTIMISTIC-REORDER: bail — no dropTarget AND no targetContainer");
			return false;
		}

		const draggedElements = resolveDraggedElements();
		if (!draggedElements) return false;

		removeEmptyCellHint?.(targetContainer);
		log?.("OPTIMISTIC-REORDER: cross-column append path", {
			paths: draggedPaths.map((p) => p.split("/").pop()),
			containerChildCount: targetContainer.childElementCount,
			containerClass: targetContainer.className,
		});

		for (const draggedEl of draggedElements) {
			const oldParent = draggedEl.parentElement;
			log?.("OPTIMISTIC-REORDER: moving element", {
				path: draggedEl.dataset.taskPath?.split("/").pop(),
				oldParentClass: oldParent?.className,
				oldParentChildCount: oldParent?.childElementCount,
				sameContainer: oldParent === targetContainer,
				elCurrentStyles: draggedEl.style.cssText.slice(0, 120),
			});
			clearStaticStyleClasses(draggedEl);
			draggedEl.classList.remove("kanban-view__card--dragging");
			targetContainer.appendChild(draggedEl);
		}

		log?.("OPTIMISTIC-REORDER: cross-column append SUCCESS", {
			containerChildCount: targetContainer.childElementCount,
		});
		return true;
	}

	log?.("OPTIMISTIC-REORDER: drop-on-card path", {
		paths: draggedPaths.map((p) => p.split("/").pop()),
		targetCard: dropTarget.taskPath.split("/").pop(),
		above: dropTarget.above,
		hasContainer: !!targetContainer,
	});

	const targetEl = currentTaskElements.get(dropTarget.taskPath);
	if (!targetEl) {
		log?.("OPTIMISTIC-REORDER: bail — target element not in currentTaskElements", {
			target: dropTarget.taskPath.split("/").pop(),
		});
		return false;
	}

	const container = targetContainer || targetEl.parentElement;
	if (!container) {
		log?.("OPTIMISTIC-REORDER: bail — no container resolved");
		return false;
	}

	if (!container.contains(targetEl)) {
		log?.("OPTIMISTIC-REORDER: bail — targetEl not in container", {
			containerClass: container.className,
			targetElParentClass: targetEl.parentElement?.className,
		});
		return false;
	}

	const draggedElements = resolveDraggedElements();
	if (!draggedElements) return false;

	removeEmptyCellHint?.(container);

	for (const draggedEl of draggedElements) {
		clearStaticStyleClasses(draggedEl);
		draggedEl.classList.remove("kanban-view__card--dragging");

		if (dropTarget.above) {
			container.insertBefore(draggedEl, targetEl);
		} else {
			container.insertBefore(draggedEl, targetEl.nextSibling);
		}
	}

	log?.("OPTIMISTIC-REORDER: drop-on-card SUCCESS");
	return true;
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

export function planKanbanStatusDerivativeUpdate({
	plan,
	task,
	dateModifiedField,
	dateModifiedValue,
}: KanbanStatusDerivativePlanInput): KanbanStatusDerivativePlan | null {
	const statusValue =
		plan.needsGroupUpdate && plan.groupByTaskProp === "status"
			? plan.newGroupValue
			: plan.needsSwimlaneUpdate &&
				  plan.swimlaneTaskProp === "status" &&
				  plan.newSwimLaneValue !== null
				? plan.newSwimLaneValue
				: null;

	if (statusValue === null) {
		return null;
	}

	return {
		statusValue,
		isRecurring: !!task?.recurrence,
		dateModifiedField,
		dateModifiedValue,
	};
}

export function planKanbanDropSideEffect({
	plan,
	originalTask,
	dateModifiedValue,
	isCompletedStatus,
}: KanbanDropSideEffectPlanInput): KanbanDropSideEffectPlan | null {
	if (!plan.changedTaskProp || !originalTask) {
		return null;
	}

	const changedTaskProp = plan.changedTaskProp as keyof TaskInfo;
	const updatedTask: TaskInfo = {
		...originalTask,
		[changedTaskProp]: plan.newPropValue,
		dateModified: dateModifiedValue,
	};

	if (changedTaskProp === "status" && !originalTask.recurrence) {
		updatedTask.completedDate =
			typeof plan.newPropValue === "string" && isCompletedStatus(plan.newPropValue)
				? new Date().toISOString().split("T")[0]
				: undefined;
	}

	return {
		changedTaskProp,
		oldPropValue: plan.oldPropValue,
		newPropValue: plan.newPropValue,
		updatedTask,
	};
}
