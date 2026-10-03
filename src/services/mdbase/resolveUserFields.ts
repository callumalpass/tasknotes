import type { UserMappedField } from "../../types/settings";
import { createI18nService } from "../../i18n";

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue => value !== null && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : {};

function legacyTextSchema(value: unknown): boolean {
	const schema = object(value);
	if (Array.isArray(schema.anyOf)) {
		const branches = schema.anyOf.filter((branch) => object(branch).type !== "null");
		return branches.length === 1 && legacyTextSchema(branches[0]);
	}
	return Array.isArray(schema.type) && schema.type.length === 3 && ["string", "number", "boolean"].every((kind) => (schema.type as unknown[]).includes(kind));
}

function schemaDefault(value: unknown): UserMappedField["defaultValue"] {
	const schema = object(value);
	const candidate = schema.default;
	if (typeof candidate === "string" || typeof candidate === "number" || typeof candidate === "boolean") return candidate;
	if (Array.isArray(candidate) && candidate.every((item) => typeof item === "string")) return [...candidate];
	if (Array.isArray(schema.anyOf)) {
		for (const branch of schema.anyOf) {
			const value = schemaDefault(branch);
			if (value !== undefined) return value;
		}
	}
	return undefined;
}

/** Compensate for the pinned model's legacy-text inference gap, without guessing unknown schemas. */
export function resolveRetainedUserFields(
	type: ObjectValue, existing: UserMappedField[], resolved: UserMappedField[], reservedFields: string[]
): UserMappedField[] {
	const properties = object(object(object(type.schema).value).properties);
	const generator = object(type["x-tasknotes-generator"]);
	const managed = new Set(Array.isArray(generator.managed_fields) ? generator.managed_fields : []);
	const reserved = new Set([...reservedFields, "id", "tags"]);
	const fields = new Map(resolved.map((field) => [field.key, field]));
	for (const [key, schema] of Object.entries(properties)) {
		if (reserved.has(key) || fields.has(key)) continue;
		const previous = existing.find((field) => field.key === key);
		if (legacyTextSchema(schema) && (previous?.type === "text" || (!previous && generator.legacy_compatibility === true))) {
			const defaultValue = schemaDefault(schema);
			fields.set(key, {
				id: previous?.id ?? key, displayName: previous?.displayName ?? key, key, type: "text",
				...(defaultValue !== undefined ? { defaultValue } : {}),
			});
		} else if (previous || managed.has(key)) {
			throw new Error(createI18nService().translate("collectionCheck.unresolvedUserField", { field: key }));
		}
	}
	// Follow schema order so generator/import/settings round-trips are stable.
	return Object.keys(properties).flatMap((key) => {
		const field = fields.get(key);
		return field ? [field] : [];
	});
}
