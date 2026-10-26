import { msg } from "@lingui/core/macro";
import type { Messages } from "@lingui/core";
import { createI18nService } from "../../../src/i18n";
import { LanguagePackController } from "../../../src/i18n/LanguagePackController";
import type { LanguagePackLoader } from "../../../src/i18n/LanguagePackLoader";
import { compiledCatalogue } from "../../helpers/compiled-catalogue.mjs";
import { uiText } from "../../../src/i18n/runtime";

const save = msg({ message: "Save", context: "common.save" });
const missing = msg({ message: "English fallback", context: "pack fixture missing message" });
const pack = (text: string): Messages => compiledCatalogue({ [save.id]: text });
function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
	return { promise, resolve, reject };
}
function setup() {
	const i18n = createI18nService({
		resources: { en: compiledCatalogue({ [save.id]: "Save", [missing.id]: "English fallback" }) },
		availableLocales: ["en", "fr", "de"], getSystemLocale: () => "fr-FR",
	});
	const load = jest.fn<Promise<Messages>, [string]>();
	return { i18n, load, controller: new LanguagePackController(i18n, { load } as unknown as LanguagePackLoader) };
}

describe("LanguagePackController with actual compiled ICU", () => {
	it("advertises unloaded languages while keeping English immediately usable", () => {
		const { i18n } = setup();
		expect(i18n.getAvailableLocales()).toEqual(["en", "fr", "de"]);
		expect(i18n.getCurrentLocale()).toBe("en");
		expect(i18n.translate(save)).toBe("Save");
	});
	it("registers downloaded messages, activates the language, and retains English fallback", async () => {
		const { i18n, load, controller } = setup();
		load.mockResolvedValue(pack("Enregistrer"));
		await expect(controller.setLocale("fr")).resolves.toBe(true);
		expect(i18n.getCurrentLocale()).toBe("fr");
		expect(i18n.translate(save)).toBe("Enregistrer");
		expect(i18n.translate(missing)).toBe("English fallback");
		await controller.setLocale("en"); await controller.setLocale("fr");
		expect(load).toHaveBeenCalledTimes(1);
	});
	it("resolves system language and falls back for unsupported languages", async () => {
		const { i18n, load, controller } = setup();
		load.mockResolvedValue(pack("Enregistrer"));
		await controller.setLocale("system");
		expect(load).toHaveBeenCalledWith("fr");
		await controller.setLocale("unsupported");
		expect(i18n.getCurrentLocale()).toBe("en");
	});
	it("does not let a slow download override a newer English selection", async () => {
		const { i18n, load, controller } = setup(); const slow = deferred<Messages>();
		load.mockReturnValue(slow.promise); const first = controller.setLocale("fr");
		await controller.setLocale("en"); slow.resolve(pack("Enregistrer"));
		expect(await first).toBe(false); expect(i18n.getCurrentLocale()).toBe("en");
	});
	it("activates the latest of two remote selections regardless of completion order", async () => {
		const { i18n, load, controller } = setup(); const french = deferred<Messages>(), german = deferred<Messages>();
		load.mockImplementation(locale => locale === "fr" ? french.promise : german.promise);
		const first = controller.setLocale("fr"), second = controller.setLocale("de");
		german.resolve(pack("Speichern")); await second; french.resolve(pack("Enregistrer"));
		expect(await first).toBe(false); expect(i18n.getCurrentLocale()).toBe("de");
	});
	it("preserves the current language on failure and allows retry", async () => {
		const { i18n, load, controller } = setup(); load.mockRejectedValueOnce(new Error("offline"));
		await expect(controller.setLocale("fr")).rejects.toThrow("offline");
		expect(i18n.getCurrentLocale()).toBe("en"); load.mockResolvedValue(pack("Enregistrer"));
		await controller.setLocale("fr"); expect(i18n.getCurrentLocale()).toBe("fr");
	});
	it("ignores errors from superseded selections", async () => {
		const { controller, load } = setup(); const slow = deferred<Messages>();
		load.mockReturnValue(slow.promise); const first = controller.setLocale("fr");
		await controller.setLocale("en"); slow.reject(new Error("offline"));
		await expect(first).resolves.toBe(false);
	});
	it("does not activate or register a pack after plugin unload", async () => {
		const { controller, load, i18n } = setup(); const slow = deferred<Messages>();
		load.mockReturnValue(slow.promise); const first = controller.setLocale("fr"); controller.dispose();
		slow.resolve(pack("Enregistrer")); await expect(first).resolves.toBe(false);
		expect(i18n.getCurrentLocale()).toBe("en"); expect(i18n.hasLocale("fr")).toBe(false);
		await expect(controller.setLocale("en")).resolves.toBe(false);
	});
	it("invalidates cached lookups on registration without mutating shared resources", () => {
		const resources = { en: pack("Save"), fr: pack("Old") };
		const first = createI18nService({ resources, initialLocale: "fr" });
		const second = createI18nService({ resources, initialLocale: "fr" });
		expect(first.translate(save)).toBe("Old"); first.registerLocale("fr", pack("New"));
		expect(first.translate(save)).toBe("New"); expect(second.translate(save)).toBe("Old");
		expect(uiText(save)).toBe("Old"); // The second service still owns the display binding.
		expect(() => first.registerLocale("en", {})).toThrow("bundled default language");
	});
});
