export interface ProjectEntry {
	basename: string;
	name: string; // with extension
	path: string;
	parent: string;
	title?: string;
	aliases?: string[];
	frontmatter?: Record<string, any>;
}

export interface ResolverDeps {
	getFrontmatter: (entry: ProjectEntry) => Record<string, any> | undefined;
}

export class ProjectMetadataResolver {
	constructor(private deps: ResolverDeps) {}

	/**
	 * Build metadata display rows from row configurations.
	 * Shared utility used by NLP autocomplete, ProjectSelectModal, etc.
	 */
	buildMetadataRows(
		rowConfigs: string[],
		fileData: ProjectEntry,
		parseDisplayFieldsRow: (row: string) => Array<{
			property: string;
			showName: boolean;
			displayName?: string;
		}>
	): string[] {
		const metadataRows: string[] = [];
		const maxRows = Math.min(rowConfigs.length, 3);

		for (let i = 0; i < maxRows; i++) {
			const row = rowConfigs[i];
			if (!row) continue;

			try {
				const tokens = parseDisplayFieldsRow(row);
				const parts: string[] = [];

				for (const token of tokens) {
					if (token.property.startsWith("literal:")) {
						const lit = token.property.slice(8);
						if (lit) parts.push(lit);
						continue;
					}

					const value = this.resolve(token.property, fileData);
					if (!value) continue;

					if (token.showName) {
						parts.push(`${token.displayName ?? token.property}: ${value}`);
					} else {
						parts.push(value);
					}
				}

				if (parts.length > 0) {
					metadataRows.push(parts.join(" "));
				}
			} catch (e) {
				if (process.env.NODE_ENV === "development") {
					console.debug("ProjectMetadataResolver: failed to parse row config:", row, e);
				}
			}
		}

		return metadataRows;
	}

	private stringifyFmValue(value: any): string {
		if (value == null) return "";
		if (Array.isArray(value)) {
			const parts = value.map((v) => this.stringifyFmValue(v)).filter(Boolean);
			return parts.join(", ");
		}
		const t = typeof value;
		if (t === "string") {
			const s = value as string;
			const trimmed = s.trim();
			// Wikilink: [[path#subpath|Alias]] or [[path|Alias]] or [[path]]
			const wl = trimmed.match(/^\[\[([^\]]+)\]\]$/);
			if (wl) {
				const inside = wl[1];
				// Split alias if present
				const parts = inside.split("|");
				if (parts.length > 1 && parts[1].trim()) {
					return parts[1].trim(); // alias wins
				}
				// No alias: take path before optional # and show basename without .md
				const pathPart = parts[0].split("#")[0].trim();
				const base = pathPart.split("/").pop() || pathPart;
				return base.replace(/\.md$/i, "");
			}
			// Markdown link: [text](url)
			const ml = trimmed.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
			if (ml) {
				return ml[1].trim();
			}
			return trimmed; // plain string
		}
		if (t === "number" || t === "boolean") return String(value);
		// Obsidian frontmatter links are objects with a path field
		if (t === "object") {
			const anyVal = value as any;
			if (typeof anyVal.path === "string") {
				const p = anyVal.path as string;
				const base = p.split("/").pop() || p;
				return base.replace(/\.md$/i, "");
			}
			// Unknown object types are not rendered
			return "";
		}
		return "";
	}

	resolve(property: string, entry: ProjectEntry): string {
		if (!property) return "";

		// File-scoped properties must be explicitly prefixed
		if (property.startsWith("file.")) {
			switch (property) {
				case "file.basename":
					return entry.basename || "";
				case "file.name":
					return entry.name || "";
				case "file.path":
					return entry.path || "";
				case "file.parent":
					return entry.parent || "";
				default:
					return "";
			}
		}

		// Convenience: title and aliases are commonly derived/transformed
		if (property === "title") {
			return entry.title || "";
		}
		if (property === "aliases") {
			const list = entry.aliases || [];
			return list.length ? list.join(", ") : "";
		}

		// Backward compatibility: explicit frontmatter prefix still supported
		let key = property;
		if (property.startsWith("frontmatter:")) {
			key = property.slice("frontmatter:".length);
		}

		// Default: any non-file.* token resolves from frontmatter
		const fm = this.deps.getFrontmatter(entry) || {};
		return this.stringifyFmValue(fm[key]);
	}
}
