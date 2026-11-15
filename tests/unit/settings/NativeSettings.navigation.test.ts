import type { SettingDefinitionItem, SettingDefinitionPage } from "obsidian";
import {
	makePageNamesUnique,
	preservePageNavigation,
} from "../../../src/settings/native/preservePageNavigation";
import { settingsFixture, control } from "../../helpers/native-settings";

const detail = (name: string, key: string): SettingDefinitionPage => ({
	type: "page",
	name,
	items: [{ name: "Name", control: { type: "text", key } }],
});

describe("Native mutable-page navigation", () => {
	test("rebinds open editors after an external settings reload, but not ordinary saves", async () => {
		const { plugin, tab } = settingsFixture();
		plugin.settings.userFields = [
			{ id: "id", key: "client", displayName: "Before", type: "text" },
		];
		tab.getSettingDefinitions();
		const previous = plugin.settings;
		const update = jest.spyOn(tab, "update").mockImplementation(() => {
			tab.getSettingDefinitions();
		});
		const listener = (plugin.emitter.on as jest.Mock).mock.calls.find(
			([event]) => event === "settings-changed"
		)[1];
		listener(plugin.settings);
		expect(update).not.toHaveBeenCalled();
		plugin.settings = structuredClone(previous);
		plugin.settings.userFields[0].displayName = "External edit";
		listener(plugin.settings);
		expect(update).toHaveBeenCalledTimes(1);
		expect(tab.getControlValue("userFields.id.displayName")).toBe("External edit");
		await tab.setControlValue("userFields.id.displayName", "Local edit");
		expect(plugin.settings.userFields[0].displayName).toBe("Local edit");
		expect(previous.userFields[0].displayName).toBe("Before");
	});
	test("disambiguates identical page names across groups, without changing stored values", () => {
		const first = detail("Same", "first"),
			second = detail("Same", "second"),
			literal = detail("Same (1)", "third");
		const definitions: SettingDefinitionItem[] = [
			{ type: "list", items: [first] },
			{ type: "group", items: [second, literal] },
		];
		makePageNamesUnique(definitions);
		expect([first.name, second.name, literal.name]).toEqual([
			"Same (2)",
			"Same (3)",
			"Same (1)",
		]);
		makePageNamesUnique(definitions);
		expect(first.name).toBe("Same (2)");
	});

	test("keeps a renamed entry open by matching its stable control keys", () => {
		const { app, tab } = settingsFixture();
		const titlebarEl = document.createElement("div");
		titlebarEl.innerHTML = '<div class="setting-page-title">Old name</div>';
		const page = { pagePath: ["Properties", "Old name"], title: "Old name", titlebarEl };
		Object.assign(app, { setting: { activeTab: tab, pageStack: [{ page }] } });
		const wrap = (name: string): SettingDefinitionItem[] => [
			{
				type: "page",
				name: "Properties",
				items: [detail(name, "userFields.id.displayName")],
			},
		];
		preservePageNavigation(app, tab, wrap("Old name"), wrap("New name"));
		expect(page.pagePath).toEqual(["Properties", "New name"]);
		expect(page.title).toBe("New name");
		expect(titlebarEl.textContent).toBe("New name");
	});

	test("does not guess when multiple pages have the same controls", () => {
		const { app, tab } = settingsFixture();
		const page = { pagePath: ["Before"], title: "Before" };
		Object.assign(app, { setting: { activeTab: tab, pageStack: [{ page }] } });
		preservePageNavigation(
			app,
			tab,
			[detail("Before", "id")],
			[detail("After", "id"), detail("Other", "id")]
		);
		expect(page.pagePath).toEqual(["Before"]);
	});

	test("same-name custom properties remain separately navigable", () => {
		const { plugin, tab } = settingsFixture();
		plugin.settings.userFields = [
			{ id: "a", key: "a", type: "text", displayName: "Same" },
			{ id: "b", key: "b", type: "text", displayName: "Same" },
		];
		const definitions = tab.getSettingDefinitions();
		expect(control(definitions, "userFields.a.displayName")).toBeDefined();
		expect(control(definitions, "userFields.b.displayName")).toBeDefined();
		const properties = definitions.find(
			(item) => "type" in item && item.type === "page" && item.name === "Properties"
		) as SettingDefinitionPage;
		const fields = properties.items?.find((item) => "type" in item && item.type === "list");
		expect(
			fields &&
				"items" in fields &&
				fields.items?.map((item) => ("name" in item ? item.name : ""))
		).toEqual(["Same (1)", "Same (2)"]);
		expect(plugin.settings.userFields.map((field) => field.displayName)).toEqual([
			"Same",
			"Same",
		]);
	});
});
