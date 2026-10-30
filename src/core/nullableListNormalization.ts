// From @tasknotes/model ea97ac46: do not stringify nullable/blank list slots.
// Keep explicit strings (including "null"), numbers and booleans intact.
function normalizeStringValue(value: unknown): string | undefined {
	if (value === null || value === undefined) return undefined;
	if (typeof value === "string") return value.trim().length === 0 ? undefined : value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (Array.isArray(value))
		return value.length === 1 ? normalizeStringValue(value[0]) : undefined;
	return undefined;
}

export function normalizeStringArrayValue(value: unknown): string[] {
	const values = Array.isArray(value) ? value : [value];
	return values.map(normalizeStringValue).filter((entry): entry is string => entry !== undefined);
}
