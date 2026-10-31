/** Obsidian may expose empty values as an icon-only placeholder, not NullValue. */
export function isBasesEmptyPlaceholderValue(value: unknown): boolean {
	if (value === null || typeof value !== "object") return false;
	const object = value as Record<string, unknown>;
	return object.icon === "lucide-file-question"
		&& object.data === undefined && object.display === undefined && object.label === undefined
		&& !(object.date instanceof Date) && !object.file && !Array.isArray(object.value)
		&& typeof object.get !== "function" && typeof object.at !== "function"
		&& typeof object.length !== "function" && typeof object.toISOString !== "function";
}
