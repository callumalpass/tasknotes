export type { FieldRole, SpecFieldMapping } from "@tasknotes/model";
export {
	buildSpecFieldMapping as buildFieldMapping,
	defaultSpecFieldMapping as defaultFieldMapping,
	denormalizeSpecFrontmatter as denormalizeFrontmatter,
	getDefaultSpecCompletedStatus as getDefaultCompletedStatus,
	isSpecCompletedStatus as isCompletedStatus,
	normalizeSpecFrontmatter as normalizeFrontmatter,
	resolveDisplayTitle,
} from "@tasknotes/model/config";

import type { FieldRole, SpecFieldMapping } from "@tasknotes/model";

export function resolveField(mapping: SpecFieldMapping, role: FieldRole): string {
	return mapping.roleToField[role];
}
