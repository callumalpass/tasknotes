export type TaskMovementUndoChange = {
	property: string;
	before: unknown;
	after: unknown;
	hadBefore: boolean;
	hadAfter: boolean;
};

/** Capture only fields written by this operation, never a whole-note replacement. */
export function buildTaskMovementUndo(
	before: Record<string, unknown>,
	after: Record<string, unknown>,
	dateModifiedProperty: string
): TaskMovementUndoChange[] {
	return [...new Set([...Object.keys(before), ...Object.keys(after)])]
		.filter((property) => property !== dateModifiedProperty)
		.filter(
			(property) =>
				Object.prototype.hasOwnProperty.call(before, property) !==
					Object.prototype.hasOwnProperty.call(after, property) ||
				JSON.stringify(before[property]) !== JSON.stringify(after[property])
		)
		.map((property) => ({
			property,
			before: structuredClone(before[property]),
			after: structuredClone(after[property]),
			hadBefore: Object.prototype.hasOwnProperty.call(before, property),
			hadAfter: Object.prototype.hasOwnProperty.call(after, property),
		}));
}

/** All-or-nothing: a subsequent edit to any moved field makes this undo unsafe. */
export function applyTaskMovementUndo(
	frontmatter: Record<string, unknown>,
	changes: readonly TaskMovementUndoChange[]
): boolean {
	if (
		changes.some(
			(change) =>
				Object.prototype.hasOwnProperty.call(frontmatter, change.property) !==
					change.hadAfter ||
				JSON.stringify(frontmatter[change.property]) !== JSON.stringify(change.after)
		)
	)
		return false;
	for (const change of changes) {
		if (change.hadBefore) frontmatter[change.property] = structuredClone(change.before);
		else delete frontmatter[change.property];
	}
	return true;
}
