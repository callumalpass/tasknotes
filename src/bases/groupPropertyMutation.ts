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

/** Replace only the membership represented by the source, preserving unrelated values. */
export function moveGroupListValue(
	currentValue: unknown,
	sourceValue: string | null | undefined,
	targetValue: string | null | undefined,
	sourceValues?: readonly string[],
	targetValues?: readonly string[]
): unknown[] {
	const currentValues = Array.isArray(currentValue)
		? currentValue
		: currentValue === null || currentValue === undefined || currentValue === ""
			? []
			: [currentValue];
	const source = normalizeGroupValue(sourceValue);
	const target = normalizeGroupValue(targetValue);
	const removedValues = sourceValues ?? (source === null ? [] : [source]);
	const addedValues = targetValues ?? (target === null ? [] : [target]);
	const nextValues = currentValues.filter((value) => !removedValues.includes(value as string));
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
	sourceValues?: readonly string[];
	targetValues?: readonly string[];
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
