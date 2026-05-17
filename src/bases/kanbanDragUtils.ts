export type KanbanTaskDragSource = {
	taskPath: string;
	sourceElement: HTMLElement;
};

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
