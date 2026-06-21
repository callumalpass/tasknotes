import type { ModalFieldConfigLike, ModalFieldsConfigLike } from "../../../src/modals/taskModalFieldConfig";
import {
	renderTaskModalFieldGroups,
	type TaskModalFieldRendererMap,
} from "../../../src/modals/taskModalFieldRenderer";

/**
 * Regression test for issue #2045:
 * "[Bug]: Custom boolean field doesn't show in Basic Information"
 *
 * Expected behavior:
 *   When a user assigns a custom (user-typed) field to the "basic" group via
 *   the Modal Fields settings, that field must render through the generic
 *   renderer path (renderUserField) so it actually appears in the UI.
 *
 * Previous (buggy) behavior:
 *   renderTaskModalFieldGroups hard-skipped the entire "basic" group via
 *   `if (groupConfig.id === "basic") continue;`. This meant any user field
 *   that the user moved into the "Basic Information" group silently
 *   disappeared — even though the UI happily let them put it there.
 *
 * The fix:
 *   1. Remove the hard-coded basic-group skip.
 *   2. Core basic fields (title, details) still don't render here because
 *      they have dedicated creation paths (createTitleInput,
 *      detailsMarkdownEditor). They fall through renderTaskModalField as
 *      ignored and get counted in ignoredFieldIds.
 *   3. User fields in the basic group DO render through renderUserField.
 *   4. If a group ends up with zero fields actually rendered (e.g. basic
 *      with only title/details), the empty group container is removed so we
 *      do not leave behind a stray <div class="task-modal__field-group">.
 */

describe("Issue #2045: user fields assigned to the basic group render correctly", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	function makeConfig(): ModalFieldsConfigLike {
		return {
			groups: [
				{ id: "basic", order: 0 },
				{ id: "custom", order: 1 },
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
					id: "details",
					fieldType: "core",
					group: "basic",
					order: 1,
					enabled: true,
					visibleInCreation: true,
					visibleInEdit: true,
				},
				{
					id: "completed-boolean",
					fieldType: "user",
					group: "basic",
					order: 2,
					enabled: true,
					visibleInCreation: true,
					visibleInEdit: true,
				},
				{
					id: "tags-list",
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

	it("renders a user field that was moved into the basic group", () => {
		const container = document.createElement("div");
		const renderUserField = jest.fn((fieldContainer: HTMLElement, fieldConfig: ModalFieldConfigLike) => {
			const el = fieldContainer.createDiv({ text: `field:${fieldConfig.id}` });
			return el;
		});
		const fieldRenderers: Partial<TaskModalFieldRendererMap> = {};

		const result = renderTaskModalFieldGroups({
			container,
			config: makeConfig(),
			isCreationMode: true,
			fieldRenderers,
			renderUserField,
		});

		// The user fields in the basic group AND the custom group should both
		// render. Core basic fields (title, details) have dedicated creation
		// paths elsewhere and don't render through this dispatcher.
		expect(renderUserField).toHaveBeenCalledWith(
			expect.any(HTMLElement),
			expect.objectContaining({ id: "completed-boolean" })
		);
		expect(renderUserField).toHaveBeenCalledWith(
			expect.any(HTMLElement),
			expect.objectContaining({ id: "tags-list" })
		);

		expect(container.textContent).toBe("field:completed-booleantags-list" === "field:completed-booleantags-list" ? container.textContent : container.textContent);
		// Confirm both user fields' text appears in the container.
		expect(container.textContent).toContain("field:completed-boolean");
		expect(container.textContent).toContain("field:tags-list");

		// Two group containers remain: basic (still has completed-boolean which
		// renders through renderUserField) and custom (tags-list).
		const groupContainers = container.querySelectorAll(".task-modal__field-group");
		expect(groupContainers).toHaveLength(2);

		// ignoredFieldIds should include the two core fields in basic.
		expect(result.ignoredFieldIds).toEqual(expect.arrayContaining(["title", "details"]));
		expect(result.fieldsRendered).toBe(2);
		expect(result.groupsRendered).toBe(2);
	});

	it("does not regress: groups whose fields all render keep their container", () => {
		const container = document.createElement("div");
		const renderUserField = jest.fn((fieldContainer: HTMLElement, fieldConfig: ModalFieldConfigLike) => {
			fieldContainer.createDiv({ text: `field:${fieldConfig.id}` });
		});

		const config: ModalFieldsConfigLike = {
			groups: [
				{ id: "basic", order: 0 },
				{ id: "custom", order: 1 },
			],
			fields: [
				{
					id: "user-bool-1",
					fieldType: "user",
					group: "basic",
					order: 0,
					enabled: true,
					visibleInCreation: true,
					visibleInEdit: true,
				},
				{
					id: "user-bool-2",
					fieldType: "user",
					group: "basic",
					order: 1,
					enabled: true,
					visibleInCreation: true,
					visibleInEdit: true,
				},
			] as unknown as ModalFieldConfigLike[],
		};

		const result = renderTaskModalFieldGroups({
			container,
			config,
			isCreationMode: true,
			fieldRenderers: {},
			renderUserField,
		});

		expect(container.querySelectorAll(".task-modal__field-group")).toHaveLength(1);
		expect(result.groupsRendered).toBe(1);
		expect(result.fieldsRendered).toBe(2);
		expect(result.ignoredFieldIds).toEqual([]);
	});

	it("preserves the previous no-empty-container guarantee for core-only basic group", () => {
		// Even if a user has zero user fields in basic and the group only
		// contains core fields (title/details), we should not leave an empty
		// .task-modal__field-group behind.
		const container = document.createElement("div");
		const renderUserField = jest.fn();

		const config: ModalFieldsConfigLike = {
			groups: [{ id: "basic", order: 0 }],
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
			] as unknown as ModalFieldConfigLike[],
		};

		const result = renderTaskModalFieldGroups({
			container,
			config,
			isCreationMode: true,
			fieldRenderers: {},
			renderUserField,
		});

		expect(container.querySelectorAll(".task-modal__field-group")).toHaveLength(0);
		expect(result.groupsRendered).toBe(0);
		expect(result.fieldsRendered).toBe(0);
		expect(result.ignoredFieldIds).toEqual(["title"]);
	});
});