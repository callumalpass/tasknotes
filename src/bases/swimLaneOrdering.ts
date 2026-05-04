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
