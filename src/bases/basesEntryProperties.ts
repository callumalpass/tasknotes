type BasesEntryFileLike = {
	name?: string;
	basename?: string;
	extension?: string;
	path?: string;
	stat?: {
		size?: number;
		ctime?: number;
		mtime?: number;
	};
};

export type BasesEntryPropertiesSource = {
	frontmatter?: Record<string, unknown>;
	properties?: Record<string, unknown>;
	file?: BasesEntryFileLike;
};

export function extractBasesEntryProperties(
	entry: BasesEntryPropertiesSource
): Record<string, unknown> {
	const frontmatter = entry.frontmatter || entry.properties || {};
	const result = { ...frontmatter };
	const file = entry.file;
	if (!file) {
		return result;
	}

	if (file.name !== undefined) result["file.name"] = file.name;
	if (file.basename !== undefined) result["file.basename"] = file.basename;
	if (file.extension !== undefined) result["file.extension"] = file.extension;
	if (file.path !== undefined) result["file.path"] = file.path;

	if (file.stat) {
		if (file.stat.size !== undefined) result["file.size"] = file.stat.size;
		if (file.stat.ctime !== undefined) result["file.ctime"] = file.stat.ctime;
		if (file.stat.mtime !== undefined) result["file.mtime"] = file.stat.mtime;
	}

	return result;
}
