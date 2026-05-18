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
		if (groupConfig.id === "basic") {
			continue;
		}

		const groupContainer = options.container.createDiv({ cls: "task-modal__field-group" });
		result.groupsRendered += 1;

		for (const field of groupConfig.fields) {
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
