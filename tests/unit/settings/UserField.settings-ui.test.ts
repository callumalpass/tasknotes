import { settingsFixture, control, list, settle } from "../../helpers/native-settings";
import { showConfirmationModal } from "../../../src/modals/ConfirmationModal";
import { reorder } from "../../../src/settings/native/properties";

jest.mock("../../../src/modals/ConfirmationModal", () => ({ showConfirmationModal: jest.fn().mockResolvedValue(true) }));

describe("Native property editors", () => {
	beforeEach(() => { (showConfirmationModal as jest.Mock).mockResolvedValue(true); });

	test("adding a property adds a valid unique key and matching form field", async () => {
		const { plugin, tab } = settingsFixture();
		const definitions = tab.getSettingDefinitions();
		list(definitions, "Custom user fields").addItem!.action(document.createElement("button"));
		await settle();
		const field = plugin.settings.userFields!.at(-1)!;
		expect(field.key).toBeTruthy();
		expect(plugin.settings.modalFieldsConfig?.fields.find(item => item.id === field.id)).toMatchObject({ visibleInCreation: true, visibleInEdit: true, enabled: true });
	});

	test("custom properties disclose native typed defaults, triggers, and suggestion filters", async () => {
		const { plugin, tab } = settingsFixture();
		plugin.settings.userFields = [{ id: "effort", key: "effort", displayName: "Effort", type: "number", defaultValue: 2 }];
		const definitions = tab.getSettingDefinitions();
		const field = list(definitions, "Custom user fields").items![0];
		expect(field).toMatchObject({ type: "page", name: "Effort" });
		expect(control(definitions, "userFields.effort.defaultValue")).toBeDefined();
		expect(control(definitions, "nlp.effort.trigger")).toBeDefined();
		expect(control(definitions, "userFields.effort.requiredTags")).toBeDefined();
		await tab.setControlValue("userFields.effort.defaultValue", "0");
		expect(plugin.settings.userFields[0].defaultValue).toBe(0);
		await expect(tab.setControlValue("userFields.effort.defaultValue", "abc")).rejects.toThrow();
		await tab.setControlValue("userFields.effort.defaultValue", "");
		expect(plugin.settings.userFields[0].defaultValue).toBeUndefined();
	});

	test("changing type clears incompatible defaults but keeps the field ID", async () => {
		const { plugin, tab } = settingsFixture();
		plugin.settings.userFields = [{ id: "effort", key: "effort", displayName: "Effort", type: "text", defaultValue: "hello" }];
		tab.getSettingDefinitions();
		await tab.setControlValue("userFields.effort.type", "boolean");
		expect(plugin.settings.userFields[0]).toMatchObject({ id: "effort", type: "boolean", defaultValue: false });
		expect(control(tab.getSettingDefinitions(), "userFields.effort.defaultValue").control.type).toBe("toggle");
	});

	test("rejects blank and conflicting property keys", async () => {
		const { tab, plugin } = settingsFixture();
		plugin.settings.userFields = [{ id: "effort", key: "effort", displayName: "Effort", type: "text" }];
		tab.getSettingDefinitions();
		await expect(tab.setControlValue("userFields.effort.key", "")).rejects.toThrow();
		await expect(tab.setControlValue("userFields.effort.key", plugin.settings.fieldMapping.status)).rejects.toThrow();
		await expect(tab.setControlValue("fieldMapping.due", "tags")).rejects.toThrow();
		expect(plugin.settings.userFields[0].key).toBe("effort");
	});

	test("deleting a property removes form and trigger references only after confirmation", async () => {
		const { tab, plugin } = settingsFixture();
		list(tab.getSettingDefinitions(), "Custom user fields").addItem!.action(document.createElement("button")); await settle();
		const field = plugin.settings.userFields!.at(-1)!;
		plugin.settings.nlpTriggers.triggers.push({ propertyId: field.id, enabled: true, trigger: "effort:" });
		const values = list(tab.getSettingDefinitions(), "Custom user fields");
		(showConfirmationModal as jest.Mock).mockResolvedValueOnce(false);
		values.onDelete!(plugin.settings.userFields!.length-1); await settle();
		expect(plugin.settings.userFields).toContain(field);
		values.onDelete!(plugin.settings.userFields!.length-1); await settle();
		expect(plugin.settings.userFields).not.toContain(field);
		expect(plugin.settings.modalFieldsConfig?.fields.some(item => item.id === field.id)).toBe(false);
		expect(plugin.settings.nlpTriggers.triggers.some(item => item.propertyId === field.id)).toBe(false);
	});

	test("renaming a status updates default and cycle references, not task files", async () => {
		const { plugin, tab } = settingsFixture();
		const status = plugin.settings.customStatuses[0]; const next = plugin.settings.customStatuses[1];
		plugin.settings.defaultTaskStatus = status.value; next.nextStatus = status.value;
		tab.getSettingDefinitions(); await tab.setControlValue(`status.${status.id}.value`, "renamed");
		expect(plugin.settings.defaultTaskStatus).toBe("renamed"); expect(next.nextStatus).toBe("renamed");
		await expect(tab.setControlValue(`status.${status.id}.value`, next.value)).rejects.toThrow();
	});

	test("reorders immutably in both directions and ignores invalid indices", () => {
		const original = ["a", "b", "c"];
		expect(reorder(original, 0, 2)).toEqual(["b", "c", "a"]);
		expect(reorder(original, 2, 0)).toEqual(["c", "a", "b"]);
		expect(reorder(original, -1, 2)).toEqual(original);
		expect(original).toEqual(["a", "b", "c"]);
	});
});
