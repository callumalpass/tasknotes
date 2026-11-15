import { SettingsContext } from "../../../src/settings/native/SettingsContext";
import { propertyDefinitions } from "../../../src/settings/native/properties";
import { settingsFixture } from "../../helpers/native-settings";

it("updates native status workflow references and retains the next label binding", async () => {
	const { plugin } = settingsFixture();
	const [first, second] = plugin.settings.customStatuses;
	second.nextStatus = first.value;
	plugin.settings.defaultTaskStatus = first.value;
	const rebuild = jest.fn();
	const ctx = new SettingsContext(plugin, jest.fn(), rebuild);
	propertyDefinitions(ctx);
	await ctx.write("status." + first.id + ".value", "renamed-status");
	expect(second.nextStatus).toBe("renamed-status");
	expect(plugin.settings.defaultTaskStatus).toBe("renamed-status");
	await ctx.write("status." + first.id + ".label", "Saved label");
	expect(first.label).toBe("Saved label");
	expect(plugin.saveSettings).toHaveBeenCalled();
	expect(rebuild).toHaveBeenCalled();
});
