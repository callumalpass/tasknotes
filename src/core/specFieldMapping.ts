import { basename } from "node:path";

export type FieldRole =
	| "title"
	| "status"
	| "priority"
	| "due"
	| "scheduled"
	| "completedDate"
	| "tags"
	| "contexts"
	| "projects"
	| "timeEstimate"
	| "dateCreated"
	| "dateModified"
	| "recurrence"
	| "recurrenceAnchor"
	| "completeInstances"
	| "skippedInstances"
	| "timeEntries";

const ALL_ROLES: FieldRole[] = [
	"title",
	"status",
	"priority",
	"due",
	"scheduled",
	"completedDate",
	"tags",
	"contexts",
	"projects",
	"timeEstimate",
	"dateCreated",
	"dateModified",
	"recurrence",
	"recurrenceAnchor",
	"completeInstances",
	"skippedInstances",
	"timeEntries",
];

export interface SpecFieldMapping {
	roleToField: Record<FieldRole, string>;
	fieldToRole: Record<string, FieldRole>;
	displayNameKey: string;
	completedStatuses: string[];
}

export function defaultFieldMapping(): SpecFieldMapping {
	const roleToField = {} as Record<FieldRole, string>;
	const fieldToRole = {} as Record<string, FieldRole>;

	for (const role of ALL_ROLES) {
		roleToField[role] = role;
		fieldToRole[role] = role;
	}

	return {
		roleToField,
		fieldToRole,
		displayNameKey: "title",
		completedStatuses: ["done", "cancelled"],
	};
}

export function buildFieldMapping(
	fields: Record<string, any>,
	displayNameKey?: string
): SpecFieldMapping {
	const roleToField = {} as Record<FieldRole, string>;
	const fieldToRole = {} as Record<string, FieldRole>;
	const rolesSet = new Set<string>(ALL_ROLES);

	for (const [fieldName, def] of Object.entries(fields)) {
		if (def && typeof def === "object" && typeof def.tn_role === "string") {
			const role = def.tn_role as FieldRole;
			if (!rolesSet.has(role)) continue;
			if (roleToField[role] !== undefined) {
				console.warn(`[mtn] Duplicate tn_role "${role}" on field "${fieldName}", ignoring.`);
				continue;
			}
			roleToField[role] = fieldName;
			fieldToRole[fieldName] = role;
		}
	}

	for (const role of ALL_ROLES) {
		if (roleToField[role] === undefined) {
			if (fields[role] !== undefined) {
				roleToField[role] = role;
				if (fieldToRole[role] === undefined) {
					fieldToRole[role] = role;
				}
			} else {
				roleToField[role] = role;
			}
		}
	}

	const completedStatuses = inferCompletedStatuses(fields, roleToField.status);

	return {
		roleToField,
		fieldToRole,
		displayNameKey:
			displayNameKey && typeof displayNameKey === "string" && displayNameKey.trim().length > 0
				? displayNameKey
				: roleToField.title,
		completedStatuses,
	};
}

function inferCompletedStatuses(fields: Record<string, any>, statusFieldName: string): string[] {
	const statusDef = fields[statusFieldName];
	if (!statusDef || typeof statusDef !== "object") {
		return ["done", "cancelled"];
	}

	if (Array.isArray(statusDef.tn_completed_values)) {
		const explicit = statusDef.tn_completed_values
			.filter((v: unknown): v is string => typeof v === "string")
			.map((v: string) => v.trim())
			.filter((v: string) => v.length > 0);
		if (explicit.length > 0) return explicit;
	}

	if (Array.isArray(statusDef.values)) {
		const inferred = statusDef.values
			.filter((v: unknown): v is string => typeof v === "string")
			.filter((v: string) => {
				const lower = v.toLowerCase();
				return lower.includes("done") || lower.includes("complete") || lower.includes("cancel");
			});
		if (inferred.length > 0) return inferred;
	}

	return ["done", "cancelled"];
}

export function isCompletedStatus(mapping: SpecFieldMapping, status: string | undefined): boolean {
	if (!status) return false;
	return mapping.completedStatuses.includes(status);
}

export function getDefaultCompletedStatus(mapping: SpecFieldMapping): string {
	return mapping.completedStatuses[0] || "done";
}

export function normalizeFrontmatter(
	raw: Record<string, unknown>,
	mapping: SpecFieldMapping
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(raw)) {
		const role = mapping.fieldToRole[key];
		result[role ?? key] = value;
	}
	return result;
}

export function denormalizeFrontmatter(
	roleData: Record<string, unknown>,
	mapping: SpecFieldMapping
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	const rolesSet = new Set<string>(ALL_ROLES);
	for (const [key, value] of Object.entries(roleData)) {
		if (rolesSet.has(key)) {
			result[mapping.roleToField[key as FieldRole]] = value;
		} else {
			result[key] = value;
		}
	}
	return result;
}

export function resolveField(mapping: SpecFieldMapping, role: FieldRole): string {
	return mapping.roleToField[role];
}

export function resolveDisplayTitle(
	frontmatter: Record<string, unknown>,
	mapping: SpecFieldMapping,
	taskPath?: string
): string | undefined {
	const candidates = [mapping.displayNameKey, "title"];
	const seen = new Set<string>();
	for (const key of candidates) {
		if (seen.has(key)) continue;
		seen.add(key);
		const value = frontmatter[key];
		if (typeof value === "string" && value.trim().length > 0) {
			return value;
		}
	}

	if (typeof taskPath === "string" && taskPath.trim().length > 0) {
		const fromPath = basename(taskPath, ".md").trim();
		if (fromPath.length > 0) {
			return fromPath;
		}
	}

	return undefined;
}
