export interface BasesGroupByConfig {
	normalizedId: string;
	displayName: string;
	getGroupValues: (taskPath: string) => string[];
}

function isNonEmpty(value: unknown): boolean {
	if (value === null || value === undefined) return false;
	if (typeof value === "string") return value.trim().length > 0;
	if (Array.isArray(value)) return value.length > 0;
	return true;
}

function toStringTokens(value: unknown): string[] {
	if (!isNonEmpty(value)) return ["none"];
	if (Array.isArray(value)) {
		const out: string[] = [];
		for (const v of value) {
			if (!isNonEmpty(v)) continue;
			out.push(String(v));
		}
		return out.length ? out : ["none"];
	}
	return [String(value)];
}

/**
 * Read Bases view groupBy config and normalize it against query.properties
 * Returns a config object or null if groupBy is absent.
 *
 * Uses public API (1.10.0+) when available via config.get() and config.getAsPropertyId()
 */
export function getBasesGroupByConfig(
	basesContainer: any,
	pathToProps: Map<string, any>
): BasesGroupByConfig | null {
	try {
		const controller = (basesContainer?.controller ?? basesContainer) as any;
		const query = (basesContainer?.query ?? controller?.query) as any;
		if (!controller) return null;

		// Try public API first (1.10.0+) - config.get() or config.getAsPropertyId()
		let groupBy: any;
		if (basesContainer?.config) {
			try {
				// Try getAsPropertyId first for type-safe property access
				if (typeof basesContainer.config.getAsPropertyId === "function") {
					groupBy = basesContainer.config.getAsPropertyId("groupBy");
				}
				// Fall back to generic get
				if (groupBy == null && typeof basesContainer.config.get === "function") {
					groupBy = basesContainer.config.get("groupBy");
				}
			} catch (_) {
				// ignore
			}
		}

		// Fallback to internal API for older versions
		if (groupBy == null) {
			const fullCfg = controller?.getViewConfig?.() ?? {};
			try {
				groupBy = query?.getViewConfig?.("groupBy");
			} catch (_) {
				// ignore
			}
			if (groupBy == null) groupBy = (fullCfg as any)?.groupBy;
		}

		if (!groupBy) return null; // No grouping configured

		// Accept string or first element from array-like inputs
		const token = Array.isArray(groupBy) ? groupBy[0] : groupBy;
		if (!token || typeof token !== "string") return null;

		// Build property id index from query.properties
		const propsMap: Record<string, any> | undefined = query?.properties;
		const idIndex = new Map<string, string>();
		if (propsMap && typeof propsMap === "object") {
			for (const id of Object.keys(propsMap)) {
				idIndex.set(id, id);
				const last = id.includes(".") ? id.split(".").pop() || id : id;
				idIndex.set(last, id);
				const dn = propsMap[id]?.getDisplayName?.();
				if (typeof dn === "string" && dn.trim()) idIndex.set(dn.toLowerCase(), id);
			}
		}

		const normalizeToId = (t: string): string | undefined => {
			if (!t) return undefined;
			return idIndex.get(t) || idIndex.get(t.toLowerCase()) || t;
		};

		const normalizedId = normalizeToId(token);
		if (!normalizedId) return null;

		// Try public API for display name (1.10.0+)
		let displayName: string = normalizedId;
		if (basesContainer?.config && typeof basesContainer.config.getDisplayName === "function") {
			try {
				const dn = basesContainer.config.getDisplayName(normalizedId);
				if (typeof dn === "string" && dn.trim()) displayName = dn;
			} catch (_) {
				// Fall back to internal API
			}
		}
		// Fallback to internal API
		if (displayName === normalizedId) {
			displayName = propsMap?.[normalizedId]?.getDisplayName?.() ?? normalizedId;
		}

		const getGroupValues = (taskPath: string): string[] => {
			const props = pathToProps.get(taskPath) || {};
			const v = props[normalizedId];
			if (isNonEmpty(v)) return toStringTokens(v);
			const last = normalizedId.includes(".") ? normalizedId.split(".").pop() || normalizedId : normalizedId;
			return toStringTokens(props[last]);
		};

		return { normalizedId, displayName, getGroupValues };
	} catch (e) {
		console.debug("[TaskNotes][Bases] getBasesGroupByConfig failed:", e);
		return null;
	}
}
