import { Setting, type SettingDefinition } from "obsidian";
import { flattenSettings, settingsFixture, settle } from "../../helpers/native-settings";
import { tasknotesAppDefinitions } from "../../../src/settings/native/tasknotesApp";

describe("TaskNotes App sync setup", () => {
	test("offers independent desktop and Obsidian plugin install buttons", () => {
		const { ctx } = settingsFixture();
		const definitions = tasknotesAppDefinitions(ctx);
		const option = flattenSettings(definitions.items!).find(
			(item) => "name" in item && item.name === "2. Choose a sync option"
		) as SettingDefinition;
		const setting = new Setting(document.createElement("div"));
		const open = jest.spyOn(window, "open").mockReturnValue(null);

		expect(option.desc).toContain("you only need one of them");
		expect(option.action).toBeUndefined();
		option.render!(setting);
		const buttons = setting.controlEl.querySelectorAll("button");
		expect(Array.from(buttons, (button) => button.textContent)).toEqual([
			"Desktop app",
			"Obsidian plugin",
		]);
		buttons[0].click();
		expect(open).toHaveBeenNthCalledWith(1, "https://mdbase.dev/downloads/", "_blank");
		buttons[1].click();
		expect(open).toHaveBeenNthCalledWith(2, "obsidian://show-plugin?id=mdbase-sync", "_blank");
		expect(open).toHaveBeenCalledTimes(2);
	});

	test.each([false, true])("does not infer plugin sync state from desktop state %s", async (added) => {
		const { ctx, plugin } = settingsFixture();
		plugin.settings.enableMdbaseSpec = true;
		const exists = jest.spyOn(plugin.app.vault.adapter, "exists").mockResolvedValue(added);
		const definitions = tasknotesAppDefinitions(ctx);
		const status = flattenSettings(definitions.items!).find(
			(item) => "name" in item && item.name === "This vault" && "render" in item
		) as SettingDefinition;
		const setting = new Setting(document.createElement("div"));

		status.render!(setting);
		await settle();
		expect(exists).toHaveBeenCalledWith(".mdbase/state");
		expect(setting.descEl.textContent).toBe(
			added
				? "Added to mdbase Connect on a computer. Open TaskNotes App and sign in with the same account."
				: "Use either sync option below."
		);
		expect(setting.descEl.textContent).not.toContain("Not added");
	});

	test("keeps vault setup instructions for both sync options", () => {
		const { ctx } = settingsFixture();
		const definitions = tasknotesAppDefinitions(ctx);
		const addVault = flattenSettings(definitions.items!).find(
			(item) => "name" in item && item.name === "3. Add this vault"
		) as SettingDefinition;
		expect(addVault.desc).toBe(
			"Desktop app: add this vault’s folder and turn on sync. Obsidian plugin: follow the setup steps in the plugin to sync this vault."
		);
	});
});
