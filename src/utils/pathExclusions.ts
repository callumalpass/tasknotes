function normalizeVaultPath(path: string): string {
	return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

export function parseExcludedFolders(
	excludedFolders: string | string[] | null | undefined
): string[] {
	const folders = Array.isArray(excludedFolders)
		? excludedFolders
		: typeof excludedFolders === "string"
			? excludedFolders.split(",")
			: [];

	return Array.from(
		new Set(
			folders
				.map((folder) => normalizeVaultPath(folder.trim()))
				.filter((folder) => folder.length > 0)
		)
	);
}

export function isPathInExcludedFolder(path: string, excludedFolders: readonly string[]): boolean {
	const normalizedPath = normalizeVaultPath(path);
	return excludedFolders.some(
		(folder) => normalizedPath === folder || normalizedPath.startsWith(`${folder}/`)
	);
}
