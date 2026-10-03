type Settings = Record<string, unknown>;

/** Engine precedence: record_extensions overrides legacy extensions; Markdown is always included. */
export function effectiveRecordExtensions(settings: Settings): string[] {
	const list = (key: string): string[] | undefined => {
		const value = settings[key];
		if (value === undefined || value === null) return undefined;
		if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
			throw new Error(`Invalid settings.${key}; run mdbase validate; existing collection settings were preserved.`);
		}
		return value as string[];
	};
	// The engine validates legacy values even when the newer setting overrides them.
	const current = list("record_extensions");
	const legacy = list("extensions");
	return ["md", ...(current ?? legacy ?? []).map((extension) => extension.replace(/^\./, "")).filter((extension) => extension !== "md")];
}
