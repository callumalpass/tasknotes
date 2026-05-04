export function parseSwimLaneOrderConfig(value: unknown): Record<string, string[]> {
	if (typeof value !== "string") return {};

	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		return {};
	}

	if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
		return {};
	}

	const result: Record<string, string[]> = {};
	for (const [key, val] of Object.entries(parsed)) {
		if (Array.isArray(val) && val.every((item) => typeof item === "string")) {
			result[key] = val;
		}
	}
	return result;
}

/**
 * Merge a reordered list of visible swimlane keys onto the previous saved order.
 * Used after a drag-to-reorder when filters/search may be hiding rows: the DOM
 * only reports visible-row order, so we anchor hidden keys at their previous
 * positions while the visible slots take the new order in sequence.
 */
export function mergeReorderedVisibleKeys(
	previousOrder: string[],
	reorderedVisibleKeys: string[]
): string[] {
	const visibleSet = new Set(reorderedVisibleKeys);
	const result: string[] = [];
	let visibleCursor = 0;
	for (const key of previousOrder) {
		if (visibleSet.has(key)) {
			// Visible slot — take the next key from the reordered list
			result.push(reorderedVisibleKeys[visibleCursor++]);
		} else {
			// Hidden — anchor in place
			result.push(key);
		}
	}
	// Any reordered keys not consumed (newly visible, not in previousOrder)
	// go at the end
	for (; visibleCursor < reorderedVisibleKeys.length; visibleCursor++) {
		result.push(reorderedVisibleKeys[visibleCursor]);
	}
	return result;
}

export function mergeUserSwimLaneOrder(
	savedOrder: string[],
	defaultOrderedKeys: string[]
): string[] {
	if (savedOrder.length === 0) return defaultOrderedKeys;

	const defaultSet = new Set(defaultOrderedKeys);
	const savedSet = new Set(savedOrder);

	const fromSaved = savedOrder.filter((key) => defaultSet.has(key));
	const newKeys = defaultOrderedKeys.filter((key) => !savedSet.has(key));

	return [...fromSaved, ...newKeys];
}
