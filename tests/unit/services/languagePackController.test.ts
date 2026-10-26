import { createI18nService } from "../../../src/i18n";
import { LanguagePackController } from "../../../src/i18n/LanguagePackController";
import type { LanguagePackLoader } from "../../../src/i18n/LanguagePackLoader";

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function setup() {
	const i18n = createI18nService({
		resources: { en: { common: { save: "Save", missing: "English fallback" } } },
		availableLocales: ["en", "fr", "de"],
		getSystemLocale: () => "fr-FR",
	});
	const load = jest.fn<Promise<Record<string, string>>, [string]>();
	const controller = new LanguagePackController(i18n, { load } as unknown as LanguagePackLoader);
	return { i18n, load, controller };
}

describe("LanguagePackController", () => {
	it("advertises unloaded languages while keeping English immediately usable", () => {
		const { i18n } = setup();
		expect(i18n.getAvailableLocales()).toEqual(["en", "fr", "de"]);
		expect(i18n.getCurrentLocale()).toBe("en");
		expect(i18n.translate("common.save")).toBe("Save");
	});

	it("registers downloaded messages, activates the language, and retains English fallback", async () => {
		const { i18n, load, controller } = setup();
		load.mockResolvedValue({ "common.save": "Enregistrer" });
		await expect(controller.setLocale("fr")).resolves.toBe(true);
		expect(i18n.getCurrentLocale()).toBe("fr");
		expect(i18n.translate("common.save")).toBe("Enregistrer");
		expect(i18n.translate("common.missing")).toBe("English fallback");
		await controller.setLocale("en");
		await controller.setLocale("fr");
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("resolves system language and falls back for unsupported languages", async () => {
		const { i18n, load, controller } = setup();
		load.mockResolvedValue({ "common.save": "Enregistrer" });
		await controller.setLocale("system");
		expect(load).toHaveBeenCalledWith("fr");
		await controller.setLocale("unsupported");
		expect(i18n.getCurrentLocale()).toBe("en");
	});

	it("does not let a slow download override a newer English selection", async () => {
		const { i18n, load, controller } = setup();
		const slow = deferred<Record<string, string>>();
		load.mockReturnValue(slow.promise);
		const first = controller.setLocale("fr");
		await controller.setLocale("en");
		slow.resolve({ "common.save": "Enregistrer" });
		expect(await first).toBe(false);
		expect(i18n.getCurrentLocale()).toBe("en");
	});

	it("activates the latest of two remote selections regardless of completion order", async () => {
		const { i18n, load, controller } = setup();
		const french = deferred<Record<string, string>>();
		const german = deferred<Record<string, string>>();
		load.mockImplementation((locale) => (locale === "fr" ? french.promise : german.promise));
		const first = controller.setLocale("fr");
		const second = controller.setLocale("de");
		german.resolve({ "common.save": "Speichern" });
		await second;
		french.resolve({ "common.save": "Enregistrer" });
		expect(await first).toBe(false);
		expect(i18n.getCurrentLocale()).toBe("de");
	});

	it("preserves the current language on failure and allows retry", async () => {
		const { i18n, load, controller } = setup();
		load.mockRejectedValueOnce(new Error("offline"));
		await expect(controller.setLocale("fr")).rejects.toThrow("offline");
		expect(i18n.getCurrentLocale()).toBe("en");
		load.mockResolvedValue({ "common.save": "Enregistrer" });
		await controller.setLocale("fr");
		expect(i18n.getCurrentLocale()).toBe("fr");
	});

	it("ignores errors from superseded selections", async () => {
		const { controller, load } = setup();
		const slow = deferred<Record<string, string>>();
		load.mockReturnValue(slow.promise);
		const first = controller.setLocale("fr");
		await controller.setLocale("en");
		slow.reject(new Error("offline"));
		await expect(first).resolves.toBe(false);
	});

	it("does not activate or register a pack after plugin unload", async () => {
		const { controller, load, i18n } = setup();
		const slow = deferred<Record<string, string>>();
		load.mockReturnValue(slow.promise);
		const first = controller.setLocale("fr");
		controller.dispose();
		slow.resolve({ "common.save": "Enregistrer" });
		await expect(first).resolves.toBe(false);
		expect(i18n.getCurrentLocale()).toBe("en");
		expect(i18n.hasLocale("fr")).toBe(false);
		await expect(controller.setLocale("en")).resolves.toBe(false);
	});

	it("invalidates cached lookups on registration without mutating shared resources", () => {
		const resources = { en: { common: { save: "Save" } }, fr: { common: { save: "Old" } } };
		const first = createI18nService({ resources, initialLocale: "fr" });
		const second = createI18nService({ resources, initialLocale: "fr" });
		expect(first.translate("common.save")).toBe("Old");
		first.registerLocale("fr", { "common.save": "New" });
		expect(first.translate("common.save")).toBe("New");
		expect(second.translate("common.save")).toBe("Old");
		expect(() => first.registerLocale("en", {})).toThrow("bundled default language");
	});
});
