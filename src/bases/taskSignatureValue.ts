import { isBasesValue } from "../ui/taskCardPresentation";

function isPlainObject(value: object): value is Record<string, unknown> {
	const prototype = Object.getPrototypeOf(value) as unknown;
	return prototype === Object.prototype || prototype === null;
}

/**
 * Convert task data and resolved card values into a JSON-safe snapshot for
 * change detection. Bases Values (for example links from `file.backlinks`)
 * keep references to the Obsidian app, so they are compared by type and
 * display text instead of being traversed.
 */
export function normalizeTaskSignatureValue(
	value: unknown,
	seen = new WeakSet<object>()
): unknown {
	if (value === undefined || typeof value === "function" || typeof value === "symbol") {
		return null;
	}

	if (typeof value === "bigint") {
		return value.toString();
	}

	if (typeof value !== "object" || value === null) {
		return value;
	}

	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
	}

	if (isBasesValue(value)) {
		return { basesValue: value.constructor?.name ?? "Value", text: value.toString() };
	}

	if (seen.has(value)) {
		return "[Circular]";
	}
	seen.add(value);

	if (Array.isArray(value)) {
		return value.map((item) => normalizeTaskSignatureValue(item, seen));
	}

	if (!isPlainObject(value)) {
		// Live objects such as TFile: compare by identity-like fields only.
		const path = (value as { path?: unknown }).path;
		return {
			object: value.constructor?.name ?? "Object",
			path: typeof path === "string" ? path : null,
		};
	}

	return Object.keys(value)
		.sort()
		.reduce<Record<string, unknown>>((normalized, key) => {
			normalized[key] = normalizeTaskSignatureValue(value[key], seen);
			return normalized;
		}, {});
}
