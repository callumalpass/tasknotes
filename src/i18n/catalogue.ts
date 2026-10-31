import type { Messages } from "@lingui/core";

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Compiled ICU is bounded JSON data, never functions or arbitrary executable source. */
function isMessage(value: unknown, depth = 0): boolean {
	if (depth > 16 || !Array.isArray(value) || value.length > 10_000) return false;
	return value.every((token: unknown) => {
		if (typeof token === "string") return true;
		if (!Array.isArray(token) || token.length < 1 || token.length > 3 || typeof token[0] !== "string") return false;
		if (token.length === 1) return true;
		const type: unknown = token[1];
		if (!["plural", "selectordinal", "select", "number", "date", "time"].includes(String(type))) return false;
		if (["plural", "selectordinal", "select"].includes(String(type))) {
			const choices: unknown = token[2];
			return isRecord(choices) && Object.prototype.hasOwnProperty.call(choices, "other") &&
				Object.entries(choices).every(([key, arm]) => key === "offset"
					? typeof arm === "number" && Number.isSafeInteger(arm) && arm >= 0
					: isMessage(arm, depth + 1));
		}
		const format: unknown = token[2];
		return token.length === 2 || format === null || typeof format === "string" ||
			(isRecord(format) && Object.values(format).every((item) => typeof item === "string" || typeof item === "boolean" || typeof item === "number"));
	});
}

export function isCompiledMessages(value: unknown): value is Messages {
	return isRecord(value) && Object.keys(value).length > 0 && Object.values(value).every((message) => isMessage(message));
}

export function compiledMessages(value: unknown): Messages {
	if (!isCompiledMessages(value)) throw new Error("Invalid compiled language catalogue");
	return value;
}

function argumentsOf(value: unknown, result = new Set<string>()): Set<string> {
	if (!Array.isArray(value)) return result;
	for (const token of value) {
		if (!Array.isArray(token)) continue;
		result.add(`${String(token[0])}:${String(token[1] ?? "argument")}`);
		if (isRecord(token[2])) for (const arm of Object.values(token[2])) argumentsOf(arm, result);
	}
	return result;
}

/** Build-time checks also validate ICU cases; the runtime pins those exact compiled bytes. */
export function validateTranslationMessage(key: string, source: unknown, translated: unknown): void {
	if (!isMessage(source) || !isMessage(translated)) throw new Error(`Invalid language-pack message: ${key}`);
	const expected = [...argumentsOf(source)].sort();
	const actual = [...argumentsOf(translated)].sort();
	if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error(`Invalid language-pack arguments: ${key}`);
}
