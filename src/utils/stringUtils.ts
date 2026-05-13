export function stringifyUnknown(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}

	if (
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean" ||
		typeof value === "bigint" ||
		typeof value === "symbol"
	) {
		return String(value);
	}

	if (value instanceof Date) {
		return value.toISOString();
	}

	if (Array.isArray(value)) {
		return value
			.map((item) => stringifyUnknown(item))
			.filter((item) => item.length > 0)
			.join(", ");
	}

	const toString = (value as { toString?: unknown }).toString;
	if (typeof toString === "function") {
		const result = toString.call(value);
		if (typeof result === "string" && result !== "[object Object]") {
			return result;
		}
	}

	try {
		const json = JSON.stringify(value);
		return typeof json === "string" ? json : "";
	} catch {
		return "";
	}
}

export function stringifyUnknownArray(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.map((item) => stringifyUnknown(item));
	}

	return [stringifyUnknown(value)];
}
