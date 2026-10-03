type Segment = { key: string; each: boolean };

/** Engine field references: dotted paths/[] selectors or RFC 6901 pointers, not JS expressions. */
function segments(reference: string): Segment[] {
	if (/^(?:\/(?:[^~/]|~[01])*)+$/.test(reference)) {
		return reference.slice(1).split("/").map((key) => ({ key: key.replace(/~1/g, "/").replace(/~0/g, "~"), each: false }));
	}
	if (!/^[A-Za-z_][A-Za-z0-9_:-]*(\[\])?(\.[A-Za-z_][A-Za-z0-9_:-]*(\[\])?)*$/.test(reference)) {
		throw new Error(`Unsupported field reference ${reference}; run mdbase validate; no repairs were made`);
	}
	return reference.split(".").map((key) => ({ key: key.replace(/\[\]$/, ""), each: key.endsWith("[]") }));
}

export function assertFieldReference(reference: string): void {
	segments(reference);
}

/** Matching uses the FIRST resolved value, including null, just like the engine's get_value. */
export function fieldReferenceValue(source: unknown, reference: string): unknown {
	let current: unknown[] = [source];
	for (const segment of segments(reference)) {
		const next: unknown[] = [];
		for (const value of current) {
			let selected: unknown;
			if (Array.isArray(value)) {
				if (reference.startsWith("/") && /^(0|[1-9][0-9]*)$/.test(segment.key)) selected = value[Number(segment.key)];
			} else if (value !== null && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, segment.key)) {
				selected = (value as Record<string, unknown>)[segment.key];
			}
			if (segment.each) { if (Array.isArray(selected)) next.push(...selected); }
			else if (selected !== undefined) next.push(selected);
		}
		current = next;
	}
	return current[0];
}
