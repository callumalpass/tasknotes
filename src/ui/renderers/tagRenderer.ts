/* eslint-disable @typescript-eslint/no-non-null-assertion */
// Tag rendering utilities following TaskNotes coding standards

export interface TagServices {
	onTagClick?: (tag: string, event: MouseEvent | KeyboardEvent) => void | Promise<void>;
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
		},
	});

	// Add click handler if provided
	if (services?.onTagClick) {
		el.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			services.onTagClick!(normalized, e as MouseEvent);
		});

		// Add keyboard support
		el.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				services.onTagClick!(normalized, e as any);
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
			if (idx > 0) container.appendChild(document.createTextNode(" "));
			renderTag(container, String(t), services);
		});
		return;
	}
	// Fallback: not a recognizable tag value
	if (value != null) container.appendChild(document.createTextNode(String(value)));
}

/** Render contexts with @ prefix */
export function renderContextsValue(
	container: HTMLElement,
	value: unknown,
	services?: TagServices
): void {
	if (typeof value === "string") {
		const normalized = normalizeContext(value);
		if (normalized) {
			const colorClass = getContextColorClass(normalized);
			const el = container.createEl("span", {
				cls: `context-tag ${colorClass}`,
				text: normalized,
				attr: {
					role: "button",
					tabindex: "0",
				},
			});

			if (services?.onTagClick) {
				el.addEventListener("click", (e) => {
					e.preventDefault();
					e.stopPropagation();
					services.onTagClick!(normalized, e as MouseEvent);
				});

				el.addEventListener("keydown", (e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						services.onTagClick!(normalized, e);
					}
				});
			}
		}
		return;
	}
	if (Array.isArray(value)) {
		const validContexts = value
			.flat(2)
			.filter((c) => c !== null && c !== undefined && typeof c === "string");

		validContexts.forEach((context, idx) => {
			if (idx > 0) container.appendChild(document.createTextNode(", "));

			// Render each context directly instead of recursively calling renderContextsValue
			const normalized = normalizeContext(context);

			if (normalized) {
				const colorClass = getContextColorClass(normalized);
				const el = container.createEl("span", {
					cls: `context-tag ${colorClass}`,
					text: normalized,
					attr: {
						role: "button",
						tabindex: "0",
					},
				});

				if (services?.onTagClick) {
					el.addEventListener("click", (e) => {
						e.preventDefault();
						e.stopPropagation();
						services.onTagClick!(normalized, e as MouseEvent);
					});

					el.addEventListener("keydown", (e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							services.onTagClick!(normalized, e);
						}
					});
				}
			} else {
				// If normalization fails, render as plain text
				container.appendChild(document.createTextNode(String(context)));
			}
		});
		return;
	}
	// Fallback
	if (value != null) container.appendChild(document.createTextNode(String(value)));
}

/**
 * Normalize arbitrary tag strings into #tag form
 * Enhanced to handle spaces and special characters including Unicode
 */
export function normalizeTag(raw: string): string | null {
	if (!raw || typeof raw !== "string") return null;
	const s = raw.trim();
	if (!s) return null;

	// Clean input: keep Unicode word chars, hyphens, and slashes for hierarchical tags
	// Use \p{L} (Unicode letters), \p{N} (Unicode numbers), and _ (underscore)
	const hasPrefix = s.startsWith("#");
	const cleaned = s.replace(/[^\p{L}\p{N}_#/-]/gu, "");

	if (hasPrefix) {
		return cleaned.length > 1 ? cleaned : null;
	}

	return cleaned ? `#${cleaned}` : null;
}/**
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

	// Clean input: keep Unicode word chars, hyphens, and slashes for hierarchical contexts
	// Use \p{L} (Unicode letters), \p{N} (Unicode numbers), and _ (underscore)
	const hasPrefix = s.startsWith("@");
	const cleaned = s.replace(/[^\p{L}\p{N}_@/-]/gu, "");

	if (hasPrefix) {
		return cleaned.length > 1 ? cleaned : null;
	}

	return cleaned ? `@${cleaned}` : null;
}
