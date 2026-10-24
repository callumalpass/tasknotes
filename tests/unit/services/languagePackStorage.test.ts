import { msg } from "@lingui/core/macro";
import { createHash } from "node:crypto";
import { compiledCatalogue } from "../../helpers/compiled-catalogue.mjs";
const save = msg({ message: "Save", context: "common.save" });
import { createI18nService } from "../../../src/i18n";
import { LanguagePackLoader } from "../../../src/i18n/LanguagePackLoader";
import { LanguagePackController } from "../../../src/i18n/LanguagePackController";
import { LANGUAGE_PACK_FORMAT } from "../../../src/i18n/languagePackTypes";

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function fixture() {
	const english = compiledCatalogue({ [save.id]: "Save" });
	const sourceHash = "a".repeat(64);
	const bytes = new TextEncoder().encode(
		JSON.stringify({
			format: LANGUAGE_PACK_FORMAT,
			locale: "fr",
			sourceHash,
			messages: compiledCatalogue({ [save.id]: "Enregistrer" }),
		})
	);
	const hash = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
	const cache = {
		read: jest.fn<Promise<string | null>, [string]>().mockResolvedValue(null),
		write: jest.fn<Promise<void>, [string, string]>().mockResolvedValue(undefined),
	};
	const download = jest.fn<Promise<Uint8Array>, [string]>().mockResolvedValue(bytes);
	const loader = new LanguagePackLoader({
		english,
		cache,
		download,
		cacheTimeoutMs: 5,
		timeoutMs: 20,
		sha256: async (data) => hash(data),
		config: {
			baseUrl: "https://example.test/tasknotes",
			manifest: {
				format: LANGUAGE_PACK_FORMAT,
				product: "tasknotes",
				sourceHash,
				catalogueVersion: "b".repeat(64),
				packs: { fr: { file: "fr.json", sha256: hash(bytes), bytes: bytes.length } },
			},
		},
	});
	const i18n = createI18nService({ resources: { en: english }, availableLocales: ["en", "fr"] });
	return { loader, cache, download, i18n, controller: new LanguagePackController(i18n, loader) };
}

describe("bounded best-effort language-pack storage with the real controller", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	it("falls through a never-settling read, recovers after a failed download, and releases inFlight", async () => {
		const { cache, download, controller, loader, i18n } = fixture();
		cache.read.mockImplementation(() => new Promise(() => undefined));
		download.mockRejectedValueOnce(new Error("offline"));
		const first = controller.setLocale("fr");
		const failure = expect(first).rejects.toThrow("offline");
		await jest.advanceTimersByTimeAsync(5);
		await failure;
		expect(i18n.getCurrentLocale()).toBe("en");
		const retry = controller.setLocale("fr");
		await jest.advanceTimersByTimeAsync(5);
		await expect(retry).resolves.toBe(true);
		expect(i18n.translate(save)).toBe("Enregistrer");
		expect(download).toHaveBeenCalledTimes(2);
		cache.read.mockResolvedValue(null);
		await expect(loader.load("fr")).resolves.toHaveProperty([save.id]);
	});

	it("activates validated data despite a never-settling write and allows a later load", async () => {
		const { cache, controller, loader, i18n } = fixture();
		cache.write.mockImplementation(() => new Promise(() => undefined));
		const selection = controller.setLocale("fr");
		await jest.advanceTimersByTimeAsync(5);
		await expect(selection).resolves.toBe(true);
		expect(i18n.getCurrentLocale()).toBe("fr");
		cache.write.mockResolvedValue(undefined);
		await expect(loader.load("fr")).resolves.toHaveProperty([save.id]);
	});

	it("ignores a late read and handles a late write rejection without overriding a newer selection", async () => {
		const { cache, controller, i18n } = fixture();
		const read = deferred<string | null>();
		const write = deferred<void>();
		cache.read.mockReturnValue(read.promise);
		cache.write.mockReturnValue(write.promise);
		const selection = controller.setLocale("fr");
		await jest.advanceTimersByTimeAsync(10);
		await expect(selection).resolves.toBe(true);
		await controller.setLocale("en");
		read.resolve("corrupt late cache");
		write.reject(new Error("late disk failure"));
		await jest.advanceTimersByTimeAsync(50);
		expect(i18n.getCurrentLocale()).toBe("en");
		expect(i18n.translate(save)).toBe("Save");
		expect(cache.write).toHaveBeenCalledTimes(1);
	});
});
