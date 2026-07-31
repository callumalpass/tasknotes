import {
	getOrderedModalGroups,
	type ModalFieldConfigLike,
	type ModalFieldsConfigLike,
} from "./taskModalFieldConfig";

export type TaskModalFieldRenderer = (
	container: HTMLElement,
	fieldConfig: ModalFieldConfigLike
) => void;

export type TaskModalFieldRendererMap = Record<string, TaskModalFieldRenderer>;

export interface RenderTaskModalFieldOptions {
	container: HTMLElement;
	fieldConfig: ModalFieldConfigLike;
	fieldRenderers: Partial<TaskModalFieldRendererMap>;
	renderUserField: TaskModalFieldRenderer;
}

export interface RenderTaskModalFieldGroupsOptions {
	container: HTMLElement;
	config: ModalFieldsConfigLike;
	isCreationMode: boolean;
	fieldRenderers: Partial<TaskModalFieldRendererMap>;
	renderUserField: TaskModalFieldRenderer;
}

export interface RenderTaskModalFieldGroupsResult {
	groupsRendered: number;
	fieldsRendered: number;
	ignoredFieldIds: string[];
}

const BASIC_MODAL_LAYOUT_FIELD_IDS = new Set(["title", "details"]);

export function renderTaskModalField(options: RenderTaskModalFieldOptions): boolean {
	const { container, fieldConfig, fieldRenderers, renderUserField } = options;
	const renderer = fieldRenderers[fieldConfig.id];

	if (renderer) {
		renderer(container, fieldConfig);
		return true;
	}

	if (fieldConfig.fieldType === "user") {
		renderUserField(container, fieldConfig);
		return true;
	}

	return false;
}

export function renderTaskModalFieldGroups(
	options: RenderTaskModalFieldGroupsOptions
): RenderTaskModalFieldGroupsResult {
	const groupsToRender = getOrderedModalGroups(options.config, options.isCreationMode);
	const result: RenderTaskModalFieldGroupsResult = {
		groupsRendered: 0,
		fieldsRendered: 0,
		ignoredFieldIds: [],
	};

	for (const groupConfig of groupsToRender) {
		const fields =
			groupConfig.id === "basic"
				? groupConfig.fields.filter((field) => !BASIC_MODAL_LAYOUT_FIELD_IDS.has(field.id))
				: groupConfig.fields;

		if (fields.length === 0) {
			continue;
		}

		const groupContainer = options.container.createDiv({ cls: "task-modal__field-group" });
		result.groupsRendered += 1;

		for (const field of fields) {
			const rendered = renderTaskModalField({
				container: groupContainer,
				fieldConfig: field,
				fieldRenderers: options.fieldRenderers,
				renderUserField: options.renderUserField,
			});

			if (rendered) {
				result.fieldsRendered += 1;
			} else {
				result.ignoredFieldIds.push(field.id);
			}
		}
	}

	return result;
}
