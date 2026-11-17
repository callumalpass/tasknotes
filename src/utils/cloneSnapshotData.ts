/**
 * Deep-copy the plain data in a value for an undo snapshot. Never throws.
 *
 * Unlike structuredClone, values that are not plain data (functions, class
 * instances such as the Bases entry a view attaches to TaskInfo as
 * `basesData`, DOM nodes) are dropped rather than rejected. Dates are copied,
 * and a repeated or circular reference is copied once and shared.
 */
export function cloneSnapshotData<T>(value: T): T {
	return copy(value, new Map()) as T;
}

function isPlainObject(value: object): value is Record<string, unknown> {
	const prototype: unknown = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function copy(value: unknown, seen: Map<object, unknown>): unknown {
	try {
		return copyValue(value, seen);
	} catch {
		// A throwing getter or revoked Proxy is not snapshot data.
		return undefined;
	}
}

function copyValue(value: unknown, seen: Map<object, unknown>): unknown {
	if (value === null || typeof value !== "object") {
		return typeof value === "function" || typeof value === "symbol" ? undefined : value;
	}
	if (seen.has(value)) return seen.get(value);
	if (value instanceof Date) return new Date(value.getTime());
	if (Array.isArray(value)) {
		const result: unknown[] = [];
		seen.set(value, result);
		for (const item of value) result.push(copy(item, seen));
		return result;
	}
	if (!isPlainObject(value)) return undefined;
	const result: Record<string, unknown> = {};
	seen.set(value, result);
	for (const [key, item] of Object.entries(value)) {
		const copied = copy(item, seen);
		if (copied !== undefined || item === undefined) result[key] = copied;
	}
	return result;
}
