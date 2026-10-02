import { renderUserFieldsSection } from "../../../src/settings/tabs/taskProperties/userFieldsCard";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { buildSettingsDataForSave, buildSettingsFromLoadedData } from "../../../src/settings/settingsPersistence";
import { NaturalLanguageParser } from "../../../src/services/NaturalLanguageParser";

const field = { id: "reference", key: "reference", displayName: "Reference", type: "list" as const };
const settings = () => ({ ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), userFields: [{ ...field }] });

describe("capture custom field keys", () => {
	it("migrates surrounding whitespace and persists the migration without mutating loaded data", () => {
		const data = settings();
		data.userFields[0].key = " reference ";
		const result = buildSettingsFromLoadedData(data);
		expect(result.settings.userFields?.[0].key).toBe("reference");
		expect(result.shouldPersistMigratedSettings).toBe(true);
		expect(data.userFields[0].key).toBe(" reference ");
	});
	it("normalizes keys at the save boundary", () => {
		const data = settings();
		data.userFields[0].key = " reference ";
		const saved = buildSettingsDataForSave(null, data);
		expect((saved.userFields as typeof data.userFields)[0].key).toBe("reference");
	});
	it("trims settings edits before saving, rejects empty/colliding keys and recovers", () => {
		const plugin = { settings: settings() };
		plugin.settings.userFields.push({ ...field, id: "other", key: "other" });
		const container = document.createElement("div");
		const save = jest.fn();
		renderUserFieldsSection(container, plugin as never, save, ((key: string) => key) as never);
		const input = container.querySelector<HTMLInputElement>('input[placeholder="settings.taskProperties.customUserFields.placeholders.propertyKey"]')!;
		const update = (value: string) => {
			input.value = value;
			input.dispatchEvent(new Event("input", { bubbles: true }));
		};
		update("  changed  ");
		expect(plugin.settings.userFields[0].key).toBe("changed");
		expect(save).toHaveBeenCalledTimes(1);
		for (const invalid of ["   ", " OTHER ", " title ", "tags"]) {
			update(invalid);
			expect(plugin.settings.userFields[0].key).toBe("changed");
			expect(input.validity.valid).toBe(false);
			expect(input.getAttribute("aria-invalid")).toBe("true");
			expect(save).toHaveBeenCalledTimes(1);
		}
		update("  recovered  ");
		expect(plugin.settings.userFields[0].key).toBe("recovered");
		expect(input.validity.valid).toBe(true);
		expect(save).toHaveBeenCalledTimes(2);
	});
});

describe("linked field adapter ownership", () => {
	const parser = () => new NaturalLanguageParser([], [], true, "en", {
		triggers: [{ propertyId: "reference", trigger: "/", enabled: true }],
	}, [field]);
	it("does not append wikilinks already returned by core", () => {
		const coreResult = { title: "Review", tags: [], contexts: [], projects: [], userFields: { reference: ["plain", "[[Reference]]", "[[Second]]"] } };
		const result = (parser() as any).extractLinkedUserFields("Review /[[Reference]] /[[Second]]", coreResult);
		expect(result.userFields.reference).toEqual(["plain", "[[Reference]]", "[[Second]]"]);
	});
	it("keeps distinct values and only adds missing links", () => {
		const coreResult = { title: "Review /[[Second]]", tags: [], contexts: [], projects: [], userFields: { reference: ["plain", "[[Reference]]"] } };
		const result = (parser() as any).extractLinkedUserFields("Review /[[Reference]] /[[Second]]", coreResult);
		expect(result.userFields.reference).toEqual(["plain", "[[Reference]]", "[[Second]]"]);
		expect(result.title).toBe("Review");
	});
	it("works with the installed core version", () => {
		expect(parser().parseInput("Review /plain /[[Reference]] /[[Second]]").userFields?.reference).toEqual(["plain", "[[Reference]]", "[[Second]]"]);
	});
});
