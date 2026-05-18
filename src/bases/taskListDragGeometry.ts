export type TaskListDropBaselineCard = {
	path: string;
	groupKey: string | null;
	card: HTMLElement;
	top: number;
	bottom: number;
	midpoint: number;
};

export type TaskListDropSegment = {
	groupKey: string | null;
	cards: TaskListDropBaselineCard[];
};

export type TaskListInsertionSlot = {
	groupKey: string | null;
	segmentIndex: number;
	insertionIndex: number;
	element: HTMLElement;
	position: "before" | "after";
};

export function getTaskListDropSegments(
	cards: readonly TaskListDropBaselineCard[]
): TaskListDropSegment[] {
	if (cards.length === 0) return [];

	const segments: TaskListDropSegment[] = [];
	for (const card of cards) {
		const previousSegment = segments[segments.length - 1];
		if (!previousSegment || previousSegment.groupKey !== card.groupKey) {
			segments.push({
				groupKey: card.groupKey,
				cards: [card],
			});
			continue;
		}
		previousSegment.cards.push(card);
	}

	return segments;
}

export function reconstructTaskListDropTarget(
	segments: readonly TaskListDropSegment[],
	segmentIndex: number,
	insertionIndex: number
): { taskPath: string; above: boolean } | null {
	const segment = segments[segmentIndex];
	if (!segment || segment.cards.length === 0) return null;

	const clampedIndex = Math.max(0, Math.min(insertionIndex, segment.cards.length));
	if (clampedIndex === 0) {
		return {
			taskPath: segment.cards[0].path,
			above: true,
		};
	}

	return {
		taskPath: segment.cards[clampedIndex - 1].path,
		above: false,
	};
}

export function resolveTaskListInsertionSlot(
	segments: readonly TaskListDropSegment[],
	localY: number
): TaskListInsertionSlot | null {
	if (segments.length === 0) return null;

	let selectedSegmentIndex = segments.length - 1;

	for (let index = 0; index < segments.length; index++) {
		const currentSegment = segments[index];
		const previousSegment = index > 0 ? segments[index - 1] : null;
		const nextSegment = index < segments.length - 1 ? segments[index + 1] : null;
		const firstCard = currentSegment.cards[0];
		const lastCard = currentSegment.cards[currentSegment.cards.length - 1];
		const lowerBoundary = previousSegment
			? (previousSegment.cards[previousSegment.cards.length - 1].bottom + firstCard.top) /
				2
			: Number.NEGATIVE_INFINITY;
		const upperBoundary = nextSegment
			? (lastCard.bottom + nextSegment.cards[0].top) / 2
			: Number.POSITIVE_INFINITY;

		if (localY < upperBoundary || index === segments.length - 1) {
			if (localY >= lowerBoundary || index === 0) {
				selectedSegmentIndex = index;
				break;
			}
		}
	}

	const selectedSegment = segments[selectedSegmentIndex];
	const cardsInSegment = selectedSegment.cards;
	const targetIndex = cardsInSegment.findIndex((card) => localY < card.midpoint);
	if (targetIndex === -1) {
		const lastCard = cardsInSegment[cardsInSegment.length - 1];
		return {
			groupKey: selectedSegment.groupKey,
			segmentIndex: selectedSegmentIndex,
			insertionIndex: cardsInSegment.length,
			element: lastCard.card,
			position: "after",
		};
	}

	return {
		groupKey: selectedSegment.groupKey,
		segmentIndex: selectedSegmentIndex,
		insertionIndex: targetIndex,
		element: cardsInSegment[targetIndex].card,
		position: "before",
	};
}
