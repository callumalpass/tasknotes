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
	jest.useFakeTimers();
	try {
		await ctx.write("status." + first.id + ".value", "renamed-status");
		expect(second.nextStatus).toBe("renamed-status");
		expect(plugin.settings.defaultTaskStatus).toBe("renamed-status");
		await ctx.write("status." + first.id + ".label", "Saved label");
		expect(first.label).toBe("Saved label");
		expect(rebuild).toHaveBeenCalled();
		expect(plugin.saveSettings).not.toHaveBeenCalled();
		await jest.runOnlyPendingTimersAsync();
		expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
	} finally {
		jest.useRealTimers();
	}
});
