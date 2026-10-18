/** Shared metadata semantics for moving between List groups and Kanban cells. */
export function normalizeGroupValue(value: string | null | undefined): string | null {
	return value === undefined || value === "None" ? null : value;
}

export function isWritableGroupingProperty(
	propertyId: string,
	mappedProperty?: string | null
): boolean {
	return (
		mappedProperty !== "dateModified" &&
		mappedProperty !== "sortOrder" &&
		!propertyId.startsWith("formula.") &&
		(!propertyId.startsWith("file.") || propertyId === "file.tags")
	);
}

/** The members a task currently holds for a list-valued property. */
export function getListMembers(value: unknown): unknown[] {
	if (Array.isArray(value)) return [...value];
	return value === null || value === undefined || value === "" ? [] : [value];
}

/**
 * The list members a move replaces: those the user saw when acting. Members added by
 * another edit before the write lands are left in place. Without a rendered snapshot,
 * the current value is the best available record of what was shown.
 */
export function getMovedListMembers(
	shown: Record<string, unknown> | undefined,
	key: string,
	currentValue: unknown
): unknown[] {
	return getListMembers(shown ? shown[key] : currentValue);
}

/** Replace only the membership represented by the source, preserving unrelated values. */
export function moveGroupListValue(
	currentValue: unknown,
	sourceValue: string | null | undefined,
	targetValue: string | null | undefined,
	sourceValues?: readonly unknown[],
	targetValues?: readonly unknown[]
): unknown[] {
	const currentValues = getListMembers(currentValue);
	const source = normalizeGroupValue(sourceValue);
	const target = normalizeGroupValue(targetValue);
	const removedValues: readonly unknown[] = sourceValues ?? (source === null ? [] : [source]);
	const addedValues: readonly unknown[] = targetValues ?? (target === null ? [] : [target]);
	const nextValues = currentValues.filter((value) => !removedValues.includes(value));
	for (const value of addedValues) {
		if (!nextValues.includes(value)) nextValues.push(value);
	}
	return nextValues;
}

export function applyGroupPropertyMutation(options: {
	frontmatter: Record<string, unknown>;
	property: string;
	sourceValue: string | null | undefined;
	targetValue: string | null | undefined;
	isList: boolean;
	preserveEmptyList?: boolean;
	sourceValues?: readonly unknown[];
	targetValues?: readonly unknown[];
	coerceValue: (property: string, value: string) => string | number | boolean;
}): void {
	const target = normalizeGroupValue(options.targetValue);
	if (options.isList) {
		const values = moveGroupListValue(
			options.frontmatter[options.property],
			options.sourceValue,
			target,
			options.sourceValues,
			options.targetValues
		);
		if (values.length > 0 || options.preserveEmptyList)
			options.frontmatter[options.property] = values;
		else delete options.frontmatter[options.property];
	} else if (target === null) {
		delete options.frontmatter[options.property];
	} else {
		options.frontmatter[options.property] = options.coerceValue(options.property, target);
	}
}
