import { createHash } from "node:crypto";
import { LanguagePackLoader } from "../../../src/i18n/LanguagePackLoader";
import {
	LANGUAGE_PACK_FORMAT,
	MAX_LANGUAGE_PACK_BYTES,
	type LanguagePack,
	type LanguagePackBuildConfig,
} from "../../../src/i18n/languagePackTypes";

const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const english = { common: { save: "Save", hello: "Hello {name}", missing: "English fallback" } };

function fixture(overrides: Partial<LanguagePack> = {}) {
	const pack = {
		format: LANGUAGE_PACK_FORMAT,
		locale: "fr",
		sourceHash: "a".repeat(64),
		messages: { "common.save": "Enregistrer", "common.hello": "Bonjour {name}" },
		...overrides,
	};
	const text = JSON.stringify(pack);
	const bytes = new TextEncoder().encode(text);
	const config: LanguagePackBuildConfig = {
		baseUrl: "https://languages.example.test/tasknotes/",
		manifest: {
			format: LANGUAGE_PACK_FORMAT,
			product: "tasknotes",
			catalogueVersion: "b".repeat(64),
			sourceHash: "a".repeat(64),
			packs: { fr: { file: "fr.json", sha256: hash(bytes), bytes: bytes.length } },
		},
	};
	const cache = {
		read: jest.fn(async (): Promise<string | null> => null),
		write: jest.fn(async () => undefined),
	};
	const download = jest.fn(async () => bytes);
	const loader = new LanguagePackLoader({
		config,
		english,
		cache,
		download,
		sha256: async (bytes) => hash(bytes),
	});
	return { loader, pack, config, text, bytes, cache, download };
}

describe("LanguagePackLoader", () => {
	it("downloads a pinned pack, validates it, and caches the original JSON", async () => {
		const { loader, config, cache, download, text } = fixture();
		expect(await loader.load("fr")).toEqual({
			"common.save": "Enregistrer",
			"common.hello": "Bonjour {name}",
		});
		expect(download).toHaveBeenCalledWith(
			`https://languages.example.test/tasknotes/${config.manifest.catalogueVersion}/fr.json`
		);
		expect(cache.write).toHaveBeenCalledWith(
			`${config.manifest.packs.fr.sha256}/fr.json`,
			text
		);
	});

	it("uses a validated cache without any network request", async () => {
		const { loader, cache, download, text } = fixture();
		cache.read.mockResolvedValue(text);
		download.mockRejectedValue(new Error("offline"));
		expect((await loader.load("fr"))["common.save"]).toBe("Enregistrer");
		expect(download).not.toHaveBeenCalled();
	});

	it("recovers from corrupt or unreadable cache", async () => {
		const { loader, cache, download } = fixture();
		cache.read.mockResolvedValue("broken");
		await loader.load("fr");
		cache.read.mockRejectedValue(new Error("disk read failed"));
		await loader.load("fr");
		expect(download).toHaveBeenCalledTimes(2);
	});

	it("deduplicates concurrent requests", async () => {
		const { loader, download } = fixture();
		const first = loader.load("fr");
		expect(loader.load("fr")).toBe(first);
		await first;
		expect(download).toHaveBeenCalledTimes(1);
	});

	it("allows retry after a failed download and never caches failed data", async () => {
		const { loader, bytes, cache, download } = fixture();
		download.mockRejectedValueOnce(new Error("offline"));
		await expect(loader.load("fr")).rejects.toThrow("offline");
		expect(cache.write).not.toHaveBeenCalled();
		download.mockResolvedValue(bytes);
		await expect(loader.load("fr")).resolves.toHaveProperty(["common.save"]);
	});

	it("keeps a downloaded translation usable when cache writing fails", async () => {
		const { loader, cache } = fixture();
		cache.write.mockRejectedValue(new Error("disk full"));
		expect((await loader.load("fr"))["common.save"]).toBe("Enregistrer");
	});

	it("rejects truncated data before hashing or caching", async () => {
		const { loader, bytes, download, cache } = fixture();
		download.mockResolvedValue(bytes.slice(0, -1));
		await expect(loader.load("fr")).rejects.toThrow("size mismatch");
		expect(cache.write).not.toHaveBeenCalled();
	});

	it("rejects same-size tampering", async () => {
		const { loader, bytes, download, cache } = fixture();
		const corrupted = new Uint8Array(bytes);
		corrupted[corrupted.length - 2] ^= 1;
		download.mockResolvedValue(corrupted);
		await expect(loader.load("fr")).rejects.toThrow("integrity mismatch");
		expect(cache.write).not.toHaveBeenCalled();
	});

	it.each([
		{ locale: "de" },
		{ sourceHash: "c".repeat(64) },
		{ format: "other-format" },
		{ messages: [] },
	])(
		"rejects an incompatible payload even with a matching content hash: %j",
		async (overrides) => {
			const { loader, cache } = fixture(overrides as Partial<LanguagePack>);
			await expect(loader.load("fr")).rejects.toThrow("compatibility mismatch");
			expect(cache.write).not.toHaveBeenCalled();
		}
	);

	it.each([
		{ "common.hello": "Bonjour {nom}" },
		{ "unknown.key": "unknown" },
		{ "common.save": { nested: "value" } },
		JSON.parse('{"__proto__":"bad"}'),
	])("rejects unknown keys, non-strings, and changed placeholders: %j", async (messages) => {
		const { loader } = fixture({ messages } as Partial<LanguagePack>);
		await expect(loader.load("fr")).rejects.toThrow("Invalid language-pack message");
	});

	it("rejects empty packs", async () => {
		await expect(fixture({ messages: {} }).loader.load("fr")).rejects.toThrow(
			"Empty language pack"
		);
	});

	it("rejects unsupported locales and path traversal without cache or network access", async () => {
		const { loader, cache, download } = fixture();
		for (const locale of ["de", "../fr", "__proto__", "constructor"]) {
			await expect(loader.load(locale)).rejects.toThrow("Unsupported language pack");
		}
		expect(cache.read).not.toHaveBeenCalled();
		expect(download).not.toHaveBeenCalled();
	});

	it("rejects oversized manifest entries", async () => {
		const { config, cache, download } = fixture();
		config.manifest.packs.fr.bytes = MAX_LANGUAGE_PACK_BYTES + 1;
		const loader = new LanguagePackLoader({ config, english, cache, download });
		await expect(loader.load("fr")).rejects.toThrow("Unsupported language pack");
		expect(download).not.toHaveBeenCalled();
	});

	it.each([
		"http://languages.example.test",
		"https://user:password@languages.example.test",
		"https://languages.example.test?secret=1",
		"https://languages.example.test#fragment",
	])("rejects an unsafe base URL: %s", (baseUrl) => {
		const { config, cache, download } = fixture();
		expect(
			() =>
				new LanguagePackLoader({ config: { ...config, baseUrl }, english, cache, download })
		).toThrow("HTTPS");
	});

	it("supports localhost HTTP fixtures", () => {
		const { config, cache, download } = fixture();
		expect(
			() =>
				new LanguagePackLoader({
					config: { ...config, baseUrl: "http://127.0.0.1:8123/tasknotes" },
					english,
					cache,
					download,
				})
		).not.toThrow();
	});

	it("reuses unchanged packs offline after another catalogue changes", async () => {
		const { config, cache, download, text } = fixture();
		const key = `${config.manifest.packs.fr.sha256}/fr.json`;
		cache.read.mockImplementation(async (requested) => (requested === key ? text : null));
		download.mockRejectedValue(new Error("offline"));
		const upgraded = {
			...config,
			manifest: { ...config.manifest, catalogueVersion: "c".repeat(64) },
		};
		const loader = new LanguagePackLoader({
			config: upgraded,
			english,
			cache,
			download,
			sha256: async (bytes) => hash(bytes),
		});
		expect((await loader.load("fr"))["common.save"]).toBe("Enregistrer");
		expect(download).not.toHaveBeenCalled();
	});

	it("does not substitute old target bytes for a corrected pack during an offline upgrade", async () => {
		const old = fixture();
		const next = fixture({
			messages: { "common.save": "Sauvegarder", "common.hello": "Bonjour {name}" },
		});
		const cache = new Map([[`${old.config.manifest.packs.fr.sha256}/fr.json`, old.text]]);
		const loader = new LanguagePackLoader({
			config: next.config,
			english,
			sha256: async (bytes) => hash(bytes),
			cache: {
				read: async (key) => cache.get(key) ?? null,
				write: async (key, text) => {
					cache.set(key, text);
				},
			},
			download: async () => {
				throw new Error("offline");
			},
		});
		await expect(loader.load("fr")).rejects.toThrow("offline");
		expect([...cache.values()]).toEqual([old.text]);
	});

	it("rejects an old English-source snapshot and retains it for rollback", async () => {
		const old = fixture();
		const next = fixture({ sourceHash: "d".repeat(64) });
		next.config.manifest.sourceHash = "d".repeat(64);
		next.cache.read.mockResolvedValue(old.text);
		next.download.mockRejectedValue(new Error("offline"));
		const loader = new LanguagePackLoader({
			config: next.config,
			english,
			cache: next.cache,
			download: next.download,
			sha256: async (bytes) => hash(bytes),
		});
		await expect(loader.load("fr")).rejects.toThrow("offline");
		expect(next.cache.write).not.toHaveBeenCalled();
	});

	it("recovers after an interrupted download without poisoning its cache", async () => {
		const { loader, cache, download, bytes, text } = fixture();
		download.mockRejectedValueOnce(new Error("connection interrupted"));
		await expect(loader.load("fr")).rejects.toThrow("connection interrupted");
		expect(cache.write).not.toHaveBeenCalled();
		expect((await loader.load("fr"))["common.save"]).toBe("Enregistrer");
		expect(cache.write).toHaveBeenCalledWith(expect.any(String), text);
		expect(download).toHaveBeenCalledTimes(2);
		expect(bytes.length).toBeGreaterThan(0);
	});

	it("ignores a transport result that arrives after its deadline", async () => {
		const { config, cache, bytes } = fixture();
		let finish!: (bytes: Uint8Array) => void;
		let expire!: () => void;
		const cancel = jest.fn();
		const loader = new LanguagePackLoader({
			config,
			english,
			cache,
			sha256: async (bytes) => hash(bytes),
			download: () =>
				new Promise((resolve) => {
					finish = resolve;
				}),
			scheduleTimeout: (callback) => {
				expire = callback;
				return cancel;
			},
		});
		const pending = loader.load("fr");
		await Promise.resolve();
		expire();
		await expect(pending).rejects.toThrow("timed out");
		finish(bytes);
		await Promise.resolve();
		expect(cache.write).not.toHaveBeenCalled();
		expect(cancel).toHaveBeenCalledTimes(1);
	});

	it("times out and permits a subsequent retry", async () => {
		const { config, cache, bytes } = fixture();
		const download = jest
			.fn<Promise<Uint8Array>, [string]>()
			.mockImplementationOnce(() => new Promise(() => undefined))
			.mockResolvedValue(bytes);
		const loader = new LanguagePackLoader({
			config,
			english,
			cache,
			download,
			timeoutMs: 5,
			sha256: async (bytes) => hash(bytes),
		});
		await expect(loader.load("fr")).rejects.toThrow("timed out");
		await expect(loader.load("fr")).resolves.toHaveProperty(["common.save"]);
	});
});
