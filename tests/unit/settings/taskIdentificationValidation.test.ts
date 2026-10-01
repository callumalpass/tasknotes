import { TextComponent } from "obsidian";
import { renderGeneralTab } from "../../../src/settings/tabs/generalTab";
import { SettingsLifecycleService } from "../../../src/services/SettingsLifecycleService";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { hasCompletePropertyTaskIdentification, isTaskFrontmatter } from "../../../src/utils/taskIdentification";

function renderIdentification(name = "", value = "") {
	const container = document.createElement("div");
	const plugin = {
		app: { vault: { getConfig: () => false } },
		manifest: { version: "4.13.6" },
		settings: { ...DEFAULT_SETTINGS, commandFileMapping: { ...DEFAULT_SETTINGS.commandFileMapping }, taskIdentificationMethod: "property", taskPropertyName: name, taskPropertyValue: value },
		i18n: { translate: (key: string) => key, getAvailableLocales: () => [], getNativeLanguageName: (locale: string) => locale },
	};
	const save = jest.fn();
	renderGeneralTab(container, plugin as never, save);
	return {
		plugin, save, container,
		name: container.querySelector<HTMLInputElement>('input[placeholder="settings.general.taskIdentification.propertyNamePlaceholder"]')!,
		value: container.querySelector<HTMLInputElement>('input[placeholder="settings.general.taskIdentification.propertyValuePlaceholder"]')!,
		warning: container.querySelector<HTMLElement>("#tasknotes-property-identification-warning")!,
	};
}

async function enter(input: HTMLInputElement, value: string) {
	input.value = value;
	input.dispatchEvent(new Event("input", { bubbles: true }));
	await Promise.resolve();
}

describe("Property identification validation (#2363)", () => {
	beforeEach(() => {
		// The test TextComponent stores callbacks but does not wire native input events.
		jest.spyOn(TextComponent.prototype, "onChange").mockImplementation(function (callback) {
			this.inputEl.addEventListener("input", () => callback(this.inputEl.value));
			return this;
		});
	});

	it.each([["", ""], ["category", ""], ["", "task"], [" ", "task"]])("rejects incomplete settings without assuming defaults (%s, %s)", (name, value) => {
		const settings = { ...DEFAULT_SETTINGS, taskIdentificationMethod: "property" as const, taskPropertyName: name, taskPropertyValue: value };
		expect(hasCompletePropertyTaskIdentification(settings)).toBe(false);
		expect(isTaskFrontmatter({ category: "task", tags: ["task"] }, settings)).toBe(false);
	});

	it("shows a live accessible warning and does not save placeholder examples", async () => {
		const ui = renderIdentification();
		expect(ui.name.value).toBe("");
		expect(ui.value.value).toBe("");
		expect(ui.warning.closest("[hidden]")).toBeNull();
		expect(ui.warning.getAttribute("role")).toBe("status");
		expect(ui.name.getAttribute("aria-invalid")).toBe("true");
		expect(ui.name.getAttribute("aria-describedby")).toBe(ui.warning.id);
		await enter(ui.name, "category");
		expect(ui.name.getAttribute("aria-invalid")).toBe("false");
		expect(ui.warning.closest("[hidden]")).toBeNull();
		await enter(ui.value, "task");
		expect(ui.warning.closest("[hidden]")).not.toBeNull();
		expect(ui.value.getAttribute("aria-invalid")).toBe("false");
		expect(ui.save).toHaveBeenCalledTimes(2);
		expect(isTaskFrontmatter({ category: "task" }, ui.plugin.settings as never)).toBe(true);
		await enter(ui.value, "");
		expect(ui.warning.closest("[hidden]")).toBeNull();
	});

	it("preserves explicitly saved identification values", () => {
		const ui = renderIdentification("kind", "action");
		expect(ui.name.value).toBe("kind");
		expect(ui.value.value).toBe("action");
		expect(ui.warning.closest("[hidden]")).not.toBeNull();
		expect(ui.save).not.toHaveBeenCalled();
	});

	it.each([
		["taskIdentificationMethod", "property"],
		["taskPropertyName", "category"],
		["taskPropertyValue", "task"],
	] as const)("invalidates task indexes when %s changes", (key, value) => {
		const plugin = { settings: { ...DEFAULT_SETTINGS } };
		const lifecycle = new SettingsLifecycleService(plugin as never);
		lifecycle.captureCurrentSettings();
		(plugin.settings as any)[key] = value;
		expect((lifecycle as any).haveCacheSettingsChanged()).toBe(true);
	});
});
