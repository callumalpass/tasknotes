import {
	getMissingRequiredModalFields,
	type ModalFieldsConfigLike,
} from "../../../src/modals/taskModalFieldConfig";

const config: ModalFieldsConfigLike = {
	fields: [
		{ id: "title", enabled: true, visibleInCreation: true, visibleInEdit: true, required: true },
		{ id: "contexts", enabled: true, visibleInCreation: true, visibleInEdit: true, required: true },
		{ id: "tags", enabled: true, visibleInCreation: true, visibleInEdit: true },
		{ id: "projects", enabled: true, visibleInCreation: false, visibleInEdit: true, required: true },
		{ id: "time-estimate", enabled: false, visibleInCreation: true, visibleInEdit: true, required: true },
	],
};

const ids = (isCreationMode: boolean, isEmpty: (id: string) => boolean) =>
	getMissingRequiredModalFields(config, isCreationMode, (field) => isEmpty(field.id)).map(
		(field) => field.id
	);

describe("getMissingRequiredModalFields", () => {
	it("returns empty required fields shown in the modal, excluding title", () => {
		expect(ids(true, () => true)).toEqual(["contexts"]);
		expect(ids(false, () => true)).toEqual(["contexts", "projects"]);
	});

	it("ignores filled fields", () => {
		expect(ids(false, (id) => id !== "contexts")).toEqual(["projects"]);
		expect(ids(false, () => false)).toEqual([]);
	});

	it("returns nothing without config", () => {
		expect(getMissingRequiredModalFields(undefined, true, () => true)).toEqual([]);
	});
});
