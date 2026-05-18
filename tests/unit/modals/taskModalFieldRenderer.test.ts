import type { ModalFieldConfigLike, ModalFieldsConfigLike } from "../../../src/modals/taskModalFieldConfig";
import {
	renderTaskModalField,
	renderTaskModalFieldGroups,
	type TaskModalFieldRendererMap,
} from "../../../src/modals/taskModalFieldRenderer";

function createConfig(): ModalFieldsConfigLike {
	return {
		groups: [
			{ id: "basic", order: 0 },
			{ id: "metadata", order: 1 },
			{ id: "custom", order: 2 },
		],
		fields: [
			{
				id: "title",
				fieldType: "core",
				group: "basic",
				order: 0,
				enabled: true,
				visibleInCreation: true,
				visibleInEdit: true,
			},
			{
				id: "contexts",
				fieldType: "core",
				group: "metadata",
				order: 0,
				enabled: true,
				visibleInCreation: true,
				visibleInEdit: true,
			},
			{
				id: "unknown-core",
				fieldType: "core",
				group: "metadata",
				order: 1,
				enabled: true,
				visibleInCreation: true,
				visibleInEdit: true,
			},
			{
				id: "custom-rating",
				fieldType: "user",
				group: "custom",
				order: 0,
				enabled: true,
				visibleInCreation: true,
				visibleInEdit: true,
			},
		] as unknown as ModalFieldConfigLike[],
	};
}

describe("taskModalFieldRenderer", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	it("renders non-basic field groups through core and user renderers", () => {
		const container = document.createElement("div");
		const renderContexts = jest.fn((fieldContainer: HTMLElement) => {
			fieldContainer.createDiv({ text: "contexts" });
		});
		const renderUserField = jest.fn((fieldContainer: HTMLElement) => {
			fieldContainer.createDiv({ text: "user field" });
		});
		const fieldRenderers: Partial<TaskModalFieldRendererMap> = {
			contexts: renderContexts,
		};

		const result = renderTaskModalFieldGroups({
			container,
			config: createConfig(),
			isCreationMode: true,
			fieldRenderers,
			renderUserField,
		});

		const groupContainers = container.querySelectorAll(".task-modal__field-group");
		expect(groupContainers).toHaveLength(2);
		expect(container.textContent).toBe("contextsuser field");
		expect(renderContexts).toHaveBeenCalledWith(
			groupContainers[0],
			expect.objectContaining({ id: "contexts" })
		);
		expect(renderUserField).toHaveBeenCalledWith(
			groupContainers[1],
			expect.objectContaining({ id: "custom-rating" })
		);
		expect(result).toEqual({
			groupsRendered: 2,
			fieldsRendered: 2,
			ignoredFieldIds: ["unknown-core"],
		});
	});

	it("honors modal visibility filtering before rendering groups", () => {
		const container = document.createElement("div");
		const config = createConfig();
		const contextsField = config.fields?.find((field) => field.id === "contexts");
		if (contextsField) {
			contextsField.visibleInEdit = false;
		}
		const renderContexts = jest.fn();

		const result = renderTaskModalFieldGroups({
			container,
			config,
			isCreationMode: false,
			fieldRenderers: { contexts: renderContexts },
			renderUserField: jest.fn(),
		});

		expect(renderContexts).not.toHaveBeenCalled();
		expect(container.querySelectorAll(".task-modal__field-group")).toHaveLength(2);
		expect(result.fieldsRendered).toBe(1);
		expect(result.ignoredFieldIds).toEqual(["unknown-core"]);
	});

	it("renders a single core or user field through the matching renderer", () => {
		const container = document.createElement("div");
		const renderContexts = jest.fn();
		const renderUserField = jest.fn();

		expect(
			renderTaskModalField({
				container,
				fieldConfig: { id: "contexts" },
				fieldRenderers: { contexts: renderContexts },
				renderUserField,
			})
		).toBe(true);
		expect(renderContexts).toHaveBeenCalledWith(container, { id: "contexts" });

		expect(
			renderTaskModalField({
				container,
				fieldConfig: { id: "custom-rating", fieldType: "user" },
				fieldRenderers: {},
				renderUserField,
			})
		).toBe(true);
		expect(renderUserField).toHaveBeenCalledWith(container, {
			id: "custom-rating",
			fieldType: "user",
		});
	});

	it("ignores unknown non-user fields", () => {
		const rendered = renderTaskModalField({
			container: document.createElement("div"),
			fieldConfig: { id: "unknown-core", fieldType: "core" },
			fieldRenderers: {},
			renderUserField: jest.fn(),
		});

		expect(rendered).toBe(false);
	});
});
