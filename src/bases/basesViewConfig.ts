export type BasesViewConfigReader = {
	get(key: string): unknown;
};

/**
 * Bases stores custom settings directly on each view. Older TaskNotes generators
 * and examples nested them under `config` or `options`; keep those files readable
 * without rewriting them. Direct settings win, followed by config, then options.
 */
export function readBasesViewConfigValue(
	config: BasesViewConfigReader | undefined,
	key: string
): unknown {
	if (!config || typeof config.get !== "function") {
		return undefined;
	}

	const directValue = config.get(key);
	if (directValue !== null && directValue !== undefined) {
		return directValue;
	}

	for (const wrapper of ["config", "options"]) {
		const nested = config.get(wrapper);
		if (
			typeof nested !== "object" ||
			nested === null ||
			Array.isArray(nested) ||
			!Object.prototype.hasOwnProperty.call(nested, key)
		) {
			continue;
		}

		const value = (nested as Record<string, unknown>)[key];
		if (value !== null && value !== undefined) {
			return value;
		}
	}

	return undefined;
}

/** Apply the same property-ID normalization as BasesViewConfig.getAsPropertyId. */
export function readBasesViewPropertyId(
	config: BasesViewConfigReader | undefined,
	key: string
): string | null {
	const value = readBasesViewConfigValue(config, key);
	if (typeof value !== "string" || !value) {
		return null;
	}
	if (value.startsWith("note.") || value.startsWith("file.") || value.startsWith("formula.")) {
		return value;
	}
	return value === "file" ? "file.file" : `note.${value}`;
}
