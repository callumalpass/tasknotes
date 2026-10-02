/* eslint-disable @typescript-eslint/no-non-null-assertion -- Renderer utilities check created elements before attaching interactions. */
// Tag rendering utilities following TaskNotes coding standards
import { stringifyUnknown } from "../../utils/stringUtils";
import { renderTextWithLinks, type LinkServices } from "./linkRenderer";

export interface TagServices {
	onTagClick?: (tag: string, event: MouseEvent | KeyboardEvent) => void | Promise<void>;
	linkServices?: LinkServices;
}

/** Render a single tag string as an Obsidian-like tag element */
export function renderTag(container: HTMLElement, tag: string, services?: TagServices): void {
	if (!tag || typeof tag !== "string") return;

	const normalized = normalizeTag(tag);
	if (!normalized) return;

	const el = container.createEl("a", {
		cls: "tag",
		text: normalized,
		attr: {
			href: normalized,
			role: "button",
			tabindex: "0",
			"data-tn-click-exclude": "true",
		},
	});

	// Add click handler if provided
	if (services?.onTagClick) {
		el.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			void services.onTagClick!(normalized, e);
		});

		// Add keyboard support
		el.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				e.stopPropagation();
				void services.onTagClick!(normalized, e);
			}
		});
	}
}

/** Render a list or single tag value into a container */
export function renderTagsValue(
	container: HTMLElement,
	value: unknown,
	services?: TagServices
): void {
	if (typeof value === "string") {
		renderTag(container, value, services);
		return;
	}
	if (Array.isArray(value)) {
		const validTags = value
			.flat(2)
			.filter((t) => t !== null && t !== undefined && typeof t === "string");

		validTags.forEach((t, idx) => {
			if (idx > 0) container.appendChild(activeDocument.createTextNode(" "));
			renderTag(container, String(t), services);
		});
		return;
	}
	// Fallback: not a recognizable tag value
	if (value != null) container.appendChild(activeDocument.createTextNode(stringifyUnknown(value)));
}

/** Render contexts with @ prefix */
export function renderContextsValue(
	container: HTMLElement,
	value: unknown,
	services?: TagServices
): void {
	if (typeof value === "string") {
		renderContextItem(container, value, services);
		return;
	}
	if (Array.isArray(value)) {
		const validContexts = value
			.flat(2)
			.filter((c) => c !== null && c !== undefined && typeof c === "string");

		validContexts.forEach((context, idx) => {
			if (idx > 0) container.appendChild(activeDocument.createTextNode(", "));
			if (!renderContextItem(container, context, services)) {
				container.appendChild(activeDocument.createTextNode(String(context)));
			}
		});
		return;
	}
	// Fallback
	if (value != null) container.appendChild(activeDocument.createTextNode(stringifyUnknown(value)));
}

function renderContextItem(
	container: HTMLElement,
	value: string,
	services?: TagServices
): boolean {
	const linkText = stripContextPrefix(value);
	if (services?.linkServices && isLinkLikeContext(linkText)) {
		const colorClass = getContextColorClass(linkText);
		const el = container.createSpan({
			cls: `context-tag context-tag--link ${colorClass}`,
			attr: {
				"data-tn-click-exclude": "true",
			},
		});
		el.appendChild(activeDocument.createTextNode("@"));
		renderTextWithLinks(el, linkText, services.linkServices);
		return true;
	}

	const normalized = normalizeContext(value);
	if (!normalized) return false;

	const colorClass = getContextColorClass(normalized);
	const el = container.createSpan({
		cls: `context-tag ${colorClass}`,
		text: normalized,
		attr: {
			role: "button",
			tabindex: "0",
			"data-tn-click-exclude": "true",
		},
	});

	if (services?.onTagClick) {
		el.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			void services.onTagClick?.(normalized, e);
		});

		el.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				e.stopPropagation();
				void services.onTagClick?.(normalized, e);
			}
		});
	}

	return true;
}

function stripContextPrefix(value: string): string {
	const trimmed = value.trim();
	if (!trimmed.startsWith("@")) return trimmed;
	return trimmed.slice(1).trim();
}

function isLinkLikeContext(value: string): boolean {
	return (
		/\[\[[^[\]]+\]\]/.test(value) ||
		/\[[^\]]+\]\([^)]+\)/.test(value) ||
		/<https?:\/\/[^\s>]+>/i.test(value) ||
		/https?:\/\/[^\s<>()]+[^\s<>().,;:!?]/i.test(value)
	);
}

const DISPLAY_LABEL_UNICODE_CHARACTER =
	/\p{L}|\p{N}|\p{M}|\p{Emoji_Presentation}|\p{Extended_Pictographic}|\p{Emoji_Modifier}/u;

function cleanDisplayLabel(value: string, prefix: "#" | "@"): string {
	// Keep punctuation and invisible tag characters only inside complete emoji sequences.
	const characters = value.match(/[#*0-9]\uFE0F?\u20E3|\u{1F3F4}[\u{E0030}-\u{E0039}\u{E0061}-\u{E007A}]+\u{E007F}|[\s\S]/gu) ?? [];
	return characters
		.filter(
			(character) =>
				Array.from(character).length > 1 ||
				DISPLAY_LABEL_UNICODE_CHARACTER.test(character) ||
				character === "\u200D" ||
				character === "\uFE0F" ||
				character === " " ||
				character === "_" ||
				character === "/" ||
				character === "-" ||
				character === prefix
		)
		.join("");
}

/**
 * Normalize arbitrary tag strings into #tag form
 * Enhanced to handle spaces and special characters including Unicode
 */
export function normalizeTag(raw: string): string | null {
	if (!raw || typeof raw !== "string") return null;
	const s = raw.trim();
	if (!s) return null;

	// Keep readable Unicode labels, including spaces and complete emoji sequences,
	// while still removing punctuation and control characters from card display.
	const hasPrefix = s.startsWith("#");
	const cleaned = cleanDisplayLabel(s, "#");

	if (hasPrefix) {
		return cleaned.length > 1 ? cleaned : null;
	}

	return cleaned ? `#${cleaned}` : null;
} /**
 * Generate a simple hash from a string for consistent color mapping.
 * Uses djb2 algorithm for good distribution with short strings.
 */
function simpleHash(str: string): number {
	let hash = 5381;
	for (let i = 0; i < str.length; i++) {
		hash = (hash * 33) ^ str.charCodeAt(i);
	}
	return hash >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Generate a CSS class for context coloring based on the context name.
 * Returns a BEM modifier class like "context-tag--color-0" through "context-tag--color-19" (20 colors).
 * The same context name will always produce the same color class.
 */
export function getContextColorClass(contextName: string): string {
	if (!contextName || typeof contextName !== "string") {
		return "context-tag--color-0";
	}

	// Remove the @ prefix if present, normalize to lowercase for consistent hashing
	const name = contextName.replace(/^@/, "").toLowerCase();
	if (!name) {
		return "context-tag--color-0";
	}

	const hash = simpleHash(name);
	const colorIndex = hash % 20; // 20 distinct color classes
	return `context-tag--color-${colorIndex}`;
}

/**
 * Normalize context strings into @context form
 * Enhanced to handle spaces and special characters including Unicode
 */
export function normalizeContext(raw: string): string | null {
	if (!raw || typeof raw !== "string") return null;

	const s = raw.trim();
	if (!s) return null;

	// Keep readable Unicode labels, including spaces and complete emoji sequences,
	// while still removing punctuation and control characters from card display.
	const hasPrefix = s.startsWith("@");
	const cleaned = cleanDisplayLabel(s, "@");

	if (hasPrefix) {
		return cleaned.length > 1 ? cleaned : null;
	}

	return cleaned ? `@${cleaned}` : null;
}

/* eslint-enable @typescript-eslint/no-non-null-assertion -- Re-enable after the tag renderer implementation. */
