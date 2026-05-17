import { parseFrontMatterTags } from "obsidian";

type TagCache = {
	tags?: Array<{ tag?: string }>;
	frontmatter?: Record<string, unknown> | null;
};

export function collectCacheTags(cache: TagCache | null | undefined): string[] {
	const tags = new Set<string>();

	for (const nativeTag of cache?.tags ?? []) {
		addTag(tags, nativeTag.tag);
	}

	const frontmatter = cache?.frontmatter ?? null;
	for (const tag of parseFrontMatterTags(frontmatter) ?? []) {
		addTag(tags, tag);
	}

	addTagValue(tags, frontmatter?.tags);
	addTagValue(tags, frontmatter?.tag);

	return Array.from(tags);
}

function addTagValue(tags: Set<string>, value: unknown): void {
	if (Array.isArray(value)) {
		for (const item of value) {
			addTagValue(tags, item);
		}
		return;
	}

	if (typeof value !== "string") {
		return;
	}

	for (const tag of value.split(/[,\s]+/)) {
		addTag(tags, tag);
	}
}

function addTag(tags: Set<string>, value: unknown): void {
	if (typeof value !== "string") {
		return;
	}

	const normalized = value.trim().replace(/^#/, "");
	if (normalized) {
		tags.add(normalized);
	}
}
