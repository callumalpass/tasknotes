import type { TaskInfo } from "../types";

export interface BasesSortEntry {
	id: string;
	direction: "ASC" | "DESC";
}

export interface BasesSortConfig {
	entries: BasesSortEntry[];
	// Retrieve comparable value for a given task and property id
	getValue: (taskPath: string, propId: string) => unknown;
}

function normalizeDirection(dir: any): "ASC" | "DESC" {
	const d = String(dir || "ASC").toUpperCase();
	return d === "DESC" ? "DESC" : "ASC";
}

/** Try to coerce value to a comparison-friendly primitive */
export function coerceForCompare(v: unknown): number | string {
	if (v == null) return "";
	if (Array.isArray(v)) return coerceForCompare(v[0]);
	if (typeof v === "number") return v;
	if (typeof v === "boolean") return v ? 1 : 0;
	const s = String(v).trim();
	// Try number
	const num = Number(s);
	if (!Number.isNaN(num) && s !== "") return num;
	// Try date
	const t = Date.parse(s);
	if (!Number.isNaN(t)) return t;
	return s.toLowerCase();
}

/** Build a normalization map from Bases query.properties */
function buildPropertyIdIndex(propsMap: Record<string, any> | undefined): Map<string, string> {
	const idIndex = new Map<string, string>();
	if (!propsMap) return idIndex;
	for (const id of Object.keys(propsMap)) {
		idIndex.set(id, id);
		const last = id.includes(".") ? id.split(".").pop()! : id;
		idIndex.set(last, id);
		const dn = propsMap[id]?.getDisplayName?.();
		if (typeof dn === "string" && dn.trim()) idIndex.set(dn.toLowerCase(), id);
	}
	return idIndex;
}

/**
 * Read Bases sort configuration and produce a comparator for TaskInfo[]
 * Supported sort tokens:
 *  - Built-ins: file.basename, file.path, title, due, scheduled, priority
 *  - Any property id from query.properties (note.*)
 */
export function getBasesSortComparator(
	basesContainer: any,
	pathToProps: Map<string, any>
): ((a: TaskInfo, b: TaskInfo) => number) | null {
	try {
		const controller = (basesContainer?.controller ?? basesContainer) as any;
		const query = (basesContainer?.query ?? controller?.query) as any;
		if (!controller) return null;

		const fullCfg = controller?.getViewConfig?.() ?? {};

		// Extract sort configuration (array of entries)
		let sort: any;
		try {
			sort = query?.getViewConfig?.("sort");
		} catch (_) {
			// Ignore errors accessing sort config
		}
		if (sort == null) sort = (fullCfg as any)?.sort;

		if (!Array.isArray(sort) || sort.length === 0) return null;

		const propsMap: Record<string, any> | undefined = query?.properties;
		const idIndex = buildPropertyIdIndex(propsMap);

		const normalizeToId = (token: string): string | undefined => {
			if (!token) return undefined;
			return idIndex.get(token) || idIndex.get(token.toLowerCase()) || token;
		};

		// Normalize entries
		const entries: BasesSortEntry[] = [];
		for (const entry of sort) {
			if (!entry) continue;
			const token =
				typeof entry === "string" ? entry : entry.property || entry.id || entry.key;
			if (!token) continue;
			const id = normalizeToId(String(token));
			if (!id) continue;
			const direction = normalizeDirection((entry as any)?.direction);
			entries.push({ id, direction });
		}
		if (entries.length === 0) return null;

		const getValue = (taskPath: string, propId: string): unknown => {
			// Built-ins
			if (propId === "file.basename") {
				const base = taskPath.split("/").pop() || "";
				return base.replace(/\.md$/i, "");
			}
			if (propId === "file.path") return taskPath;

			// task.* fields
			// Note: pathToProps covers note.*; we get task.* via the TaskInfo object in comparator below
			const props = pathToProps.get(taskPath) || {};
			if (Object.prototype.hasOwnProperty.call(props, propId)) return props[propId];
			const last = propId.includes(".") ? propId.split(".").pop()! : propId;
			if (Object.prototype.hasOwnProperty.call(props, last)) return props[last];
			return undefined;
		};

		const compare = (a: TaskInfo, b: TaskInfo): number => {
			for (const { id, direction } of entries) {
				let va: unknown;
				let vb: unknown;
				switch (id) {
					case "title":
						va = a.title;
						vb = b.title;
						break;
					case "due":
						va = a.due;
						vb = b.due;
						break;
					case "scheduled":
						va = a.scheduled;
						vb = b.scheduled;
						break;
					case "priority":
						va = a.priority;
						vb = b.priority;
						break;
					case "file.basename":
					case "file.path":
						va = getValue(a.path, id);
						vb = getValue(b.path, id);
						break;
					default:
						va = getValue(a.path, id);
						vb = getValue(b.path, id);
				}
				const ca = coerceForCompare(va);
				const cb = coerceForCompare(vb);
				let cmp = 0;
				if (typeof ca === "number" && typeof cb === "number") cmp = ca - cb;
				else if (typeof ca === "string" && typeof cb === "string")
					cmp = ca.localeCompare(cb);
				else cmp = String(ca).localeCompare(String(cb));
				if (cmp !== 0) return direction === "DESC" ? -cmp : cmp;
			}
			return 0;
		};

		(compare as any).__basesSortEntries = entries;
		return compare;
	} catch (e) {
		console.debug("[TaskNotes][Bases] getBasesSortComparator failed:", e);
		return null;
	}
}
