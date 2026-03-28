export interface ModalFieldConfigLike {
	id: string;
	fieldType?: string;
	enabled?: boolean;
	visibleInCreation?: boolean;
	visibleInEdit?: boolean;
	order?: number;
}

export interface ModalFieldGroupConfigLike {
	id: string;
	order: number;
}

export interface ModalFieldsConfigLike {
	fields?: ModalFieldConfigLike[];
	groups?: ModalFieldGroupConfigLike[];
}

export function shouldShowFieldForModal(
	fieldId: string,
	config: ModalFieldsConfigLike | undefined,
	isCreationMode: boolean
): boolean {
	if (!config?.fields) {
		return true;
	}

	const field = config.fields.find((candidate) => candidate.id === fieldId);
	if (!field) {
		return true;
	}

	const isVisible = isCreationMode ? field.visibleInCreation : field.visibleInEdit;
	return !!field.enabled && !!isVisible;
}

export function getOrderedModalGroups(
	config: ModalFieldsConfigLike,
	isCreationMode: boolean
): Array<{ id: string; fields: ModalFieldConfigLike[] }> {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { getFieldsByGroup } = require("../utils/fieldConfigDefaults");
	const fieldGroups = getFieldsByGroup(config, isCreationMode) as Map<string, ModalFieldConfigLike[]>;
	const groups = [...(config.groups || [])].sort((a, b) => a.order - b.order);

	return groups
		.map((groupConfig) => ({
			id: groupConfig.id,
			fields: fieldGroups.get(groupConfig.id) || [],
		}))
		.filter((group) => group.fields.length > 0);
}
