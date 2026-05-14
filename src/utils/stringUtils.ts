export function stringifyUnknown(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}

	if (typeof value === "string") {
		return value;
	}

	if (typeof value === "number") {
		return Number.prototype.toString.call(value);
	}

	if (typeof value === "bigint") {
		return BigInt.prototype.toString.call(value);
	}

	if (typeof value === "boolean") {
		return value ? "true" : "false";
	}

	if (typeof value === "symbol") {
		return value.description ?? "";
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
