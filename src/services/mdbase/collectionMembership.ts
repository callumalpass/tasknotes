import { effectiveMembershipKeys } from "./collectionConfig";
import { effectiveRecordExtensions } from "./recordExtensions";
import { assertFieldReference, fieldReferenceValue } from "./fieldReferences";

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue => value !== null && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : {};

/** Engine exclude-pattern semantics (not path_glob semantics). */
export function excludedByPattern(pattern: string, path: string): boolean {
	if (pattern.endsWith("/**")) {
		const prefix = pattern.slice(0, -3);
		return path === prefix || path.startsWith(`${prefix}/`);
	}
	if (pattern.startsWith("*.")) return path.endsWith(pattern.slice(1));
	const parts = pattern.split("*");
	if (parts.length === 2) return path.startsWith(parts[0]) && path.endsWith(parts[1]);
	return path === pattern || path.startsWith(`${pattern}/`);
}

export function globMatches(pattern: string, file: string): boolean {
	let regex = "";
	for (let index = 0; index < pattern.length; index++) {
		const char = pattern[index];
		if (char === "*" && pattern[index + 1] === "*") {
			index++;
			if (pattern[index + 1] === "/") { regex += "(?:.*/)?"; index++; }
			else regex += ".*";
		} else if (char === "*") regex += "[^/]*";
		else if (char === "?") regex += "[^/]";
		else regex += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}
	return new RegExp(`^${regex}$`).test(file);
}

/** Explicit membership is case-insensitive and suppresses ALL automatic matching. */
export function explicitTypeNames(record: ObjectValue, keys: string[]): string[] {
	return keys.flatMap((key) => {
		const value = record[key];
		if (typeof value === "string") return value ? [value.toLowerCase()] : [];
		return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.toLowerCase()) : [];
	});
}

function jsonEqual(left: unknown, right: unknown): boolean {
	if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => jsonEqual(value, right[index]));
	if (left !== null && right !== null && typeof left === "object" && typeof right === "object") {
		const a = object(left), b = object(right);
		return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((key) => Object.prototype.hasOwnProperty.call(b, key) && jsonEqual(a[key], b[key]));
	}
	return left === right;
}

function valuesEqual(left: unknown, right: unknown): boolean {
	if (jsonEqual(left, right)) return true;
	const numeric = (value: unknown) => typeof value === "number" ? value : typeof value === "string" && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) ? Number(value) : NaN;
	return Math.abs(numeric(left) - numeric(right)) < Number.EPSILON;
}

function strings(value: unknown, fallback: string[], name: string): string[] {
	if (value === undefined) return fallback;
	if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error(`Invalid collection ${name}; run mdbase validate`);
	return value as string[];
}

/** Shared lexical scope for checks and duplicate-reference inventory. Nested roots are fenced separately. */
export function collectionScope(config: unknown) {
	const settings = object(object(config).settings);
	if (settings.include_subfolders !== undefined && typeof settings.include_subfolders !== "boolean") throw new Error("Invalid include_subfolders; run mdbase validate");
	const folder = (key: string, fallback: string) => {
		const value = settings[key] ?? fallback;
		if (typeof value !== "string" || !value || value.startsWith("/") || value.split("/").includes("..")) throw new Error(`Invalid ${key}; run mdbase validate`);
		return value.replace(/\/$/, "");
	};
	const typesFolder = folder("types_folder", "_types");
	const reserved = [typesFolder, folder("contracts_folder", "_contracts"), folder("cache_folder", ".mdbase"), folder("migrations_folder", "_types/_migrations"), ".mdbase"];
	const excludes = strings(settings.exclude, [".git", "node_modules", ".mdbase"], "exclude");
	const extensions = new Set(effectiveRecordExtensions(settings));
	const keys = effectiveMembershipKeys(settings.explicit_type_keys);
	const contains = (path: string) => path !== "mdbase.yaml" && !(settings.include_subfolders === false && path.includes("/")) &&
		!reserved.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)) && !excludes.some((pattern) => excludedByPattern(pattern, path));
	return { typesFolder, keys, contains, isRecord: (path: string) => contains(path) && extensions.has(path.split(".").pop() ?? "") };
}

/** Fence nested collections exactly as engine traversal does; errors must abort the check. */
export async function isCollectionRecord(adapter: { exists(path: string): Promise<boolean> }, path: string, scope: ReturnType<typeof collectionScope>): Promise<boolean> {
	if (!scope.isRecord(path)) return false;
	const parents = path.split("/").slice(0, -1);
	for (let index = 1; index <= parents.length; index++) {
		if (await adapter.exists(`${parents.slice(0, index).join("/")}/mdbase.yaml`)) return false;
	}
	return true;
}

/** Refuse unsupported predicate shapes before scanning, even when there are no records. */
export function assertSupportedMatch(value: unknown): void {
	if (value === undefined) return;
	const fail = () => { throw new Error("Unsupported match predicate; run mdbase validate; no repairs were made"); };
	if (value === null || typeof value !== "object" || Array.isArray(value)) return fail();
	const match = object(value);
	if (Object.keys(match).some((key) => !["where", "fields_present", "path_glob", "path_globs", "expr"].includes(key))) fail();
	if (match.where !== undefined) {
		if (match.where === null || typeof match.where !== "object" || Array.isArray(match.where)) fail();
		for (const [field, predicate] of Object.entries(object(match.where))) {
			assertFieldReference(field);
			if (predicate !== null && typeof predicate === "object" && !Array.isArray(predicate)) {
				if (Object.entries(object(predicate)).some(([key, expected]) => !["contains", "exists", "eq"].includes(key) || (key === "exists" && typeof expected !== "boolean"))) fail();
			}
		}
	}
	if (match.fields_present !== undefined) {
		if (!Array.isArray(match.fields_present) || match.fields_present.some((field) => typeof field !== "string")) fail();
		for (const field of match.fields_present as string[]) assertFieldReference(field);
	}
	for (const key of ["path_glob", "path_globs"]) {
		const glob = match[key];
		if (glob !== undefined && !(key === "path_glob" && typeof glob === "string") && (!Array.isArray(glob) || glob.some((item) => typeof item !== "string"))) fail();
	}
	if (match.expr !== undefined && (match.expr === null || typeof match.expr !== "object" || Array.isArray(match.expr) || Object.keys(object(match.expr)).some((key) => key !== "$expr") || typeof object(match.expr).$expr !== "string")) fail();
}

/** Supported match rules use engine field references; arbitrary CEL is refused by the caller. */
export function isTaskMember(record: ObjectValue, path: string, type: ObjectValue, keys: string[], matchExclusions: string[]): boolean {
	const explicit = explicitTypeNames(record, keys);
	if (explicit.length) return explicit.includes(String(type.name).toLowerCase());
	const match = object(type.match);
	if (!Object.keys(match).length) return false;
	const matches = Object.entries(object(match.where)).every(([field, value]) => {
		const actual = fieldReferenceValue(record, field);
		if (value === null || typeof value !== "object" || Array.isArray(value)) return actual !== undefined && valuesEqual(actual, value);
		// Engine operators within one field predicate are conjunctive too.
		return Object.entries(object(value)).every(([operator, expected]) => {
			if (operator === "contains") return Array.isArray(actual) && actual.some((item) => valuesEqual(item, expected));
			if (operator === "exists") return expected === (actual !== undefined && actual !== null);
			if (operator === "eq") return actual !== undefined && valuesEqual(actual, expected);
			return false;
		});
	});
	const present = !Array.isArray(match.fields_present) || match.fields_present.every((field) => {
		const value = fieldReferenceValue(record, field as string);
		return value !== undefined && value !== null;
	});
	const pathMatch = match.path_glob === undefined || (typeof match.path_glob === "string" ? globMatches(match.path_glob, path) : (match.path_glob as string[]).some((glob) => globMatches(glob, path)));
	const pathGlobsMatch = !Array.isArray(match.path_globs) || match.path_globs.some((glob) => typeof glob === "string" && globMatches(glob, path));
	return matches && present && pathMatch && pathGlobsMatch && !matchExclusions.some((folder) => path.startsWith(`${folder}/`));
}
