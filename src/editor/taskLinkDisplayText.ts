function safeDecodeURIComponent(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

function stripMarkdownPathBrackets(value: string): string {
	const trimmed = value.trim();
	if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
		return trimmed.slice(1, -1).trim();
	}
	return trimmed;
}

function normalizePathLikeLabel(value: string | undefined): string {
	if (!value) return "";
	const decoded = safeDecodeURIComponent(stripMarkdownPathBrackets(value));
	const withoutSubpath = decoded.split(/[#!^]/)[0] ?? decoded;
	const withoutLeadingSlash = withoutSubpath.replace(/^\/+/, "");
	return withoutLeadingSlash.replace(/\.md$/i, "").trim();
}

function basename(value: string): string {
	const normalized = normalizePathLikeLabel(value);
	const parts = normalized.split("/").filter(Boolean);
	return parts[parts.length - 1] ?? normalized;
}

export function isImplicitTaskLinkDisplayText(
	displayText: string | undefined,
	taskPath: string | undefined,
	linkPath?: string
): boolean {
	const normalizedDisplay = normalizePathLikeLabel(displayText);
	if (!normalizedDisplay || !taskPath) return false;

	const normalizedTaskPath = normalizePathLikeLabel(taskPath);
	const normalizedLinkPath = normalizePathLikeLabel(linkPath);
	const candidates = new Set<string>([
		normalizedTaskPath,
		basename(normalizedTaskPath),
	]);

	if (normalizedLinkPath) {
		candidates.add(normalizedLinkPath);
		candidates.add(basename(normalizedLinkPath));
	}

	return candidates.has(normalizedDisplay);
}

export function resolveTaskLinkDisplayText(
	displayText: string | undefined,
	taskPath: string | undefined,
	linkPath?: string
): string | undefined {
	const normalizedDisplay = displayText?.trim();
	if (!normalizedDisplay) return undefined;
	if (isImplicitTaskLinkDisplayText(normalizedDisplay, taskPath, linkPath)) {
		return undefined;
	}
	return normalizedDisplay;
}
