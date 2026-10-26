import { flattenTranslations, validateTranslationMessage } from "./catalogue";
import {
	LANGUAGE_PACK_FORMAT,
	MAX_LANGUAGE_PACK_BYTES,
	type LanguagePackLoaderOptions,
} from "./languagePackTypes";

async function digest(bytes: Uint8Array): Promise<string> {
	const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer);
	return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Loads only pinned JSON data. No downloaded catalogue is executed as code. */
export class LanguagePackLoader {
	private readonly options: LanguagePackLoaderOptions;
	private readonly english: Record<string, string>;
	private readonly baseUrl: string;
	private readonly inFlight = new Map<string, Promise<Record<string, string>>>();

	constructor(options: LanguagePackLoaderOptions) {
		this.options = options;
		this.english = flattenTranslations(options.english);
		const { manifest } = options.config;
		if (
			manifest.format !== LANGUAGE_PACK_FORMAT ||
			manifest.product !== "tasknotes" ||
			!/^[a-f0-9]{64}$/.test(manifest.catalogueVersion) ||
			!/^[a-f0-9]{64}$/.test(manifest.sourceHash)
		) {
			throw new Error("Invalid language-pack manifest");
		}
		const url = new URL(options.config.baseUrl);
		const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
		if (
			(url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
			url.username ||
			url.password ||
			url.search ||
			url.hash
		) {
			throw new Error("Language-pack URL must use HTTPS (HTTP is allowed on localhost only)");
		}
		this.baseUrl = url.href.replace(/\/$/, "");
	}

	load(locale: string): Promise<Record<string, string>> {
		const existing = this.inFlight.get(locale);
		if (existing) return existing;
		const pending = this.loadPack(locale);
		this.inFlight.set(locale, pending);
		void pending.finally(() => this.inFlight.delete(locale)).catch(() => undefined);
		return pending;
	}

	private async validate(locale: string, bytes: Uint8Array): Promise<Record<string, string>> {
		const { manifest } = this.options.config;
		const descriptor = manifest.packs[locale];
		if (bytes.byteLength !== descriptor.bytes) throw new Error("Language-pack size mismatch");
		const hash = await (this.options.sha256 ?? digest)(bytes);
		if (hash !== descriptor.sha256) throw new Error("Language-pack integrity mismatch");
		const pack: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
		if (
			!isRecord(pack) ||
			pack.format !== LANGUAGE_PACK_FORMAT ||
			pack.locale !== locale ||
			pack.sourceHash !== manifest.sourceHash ||
			!isRecord(pack.messages)
		) {
			throw new Error("Language-pack compatibility mismatch");
		}
		const messages: Record<string, string> = Object.create(null);
		for (const [key, value] of Object.entries(pack.messages)) {
			if (
				!Object.prototype.hasOwnProperty.call(this.english, key) ||
				typeof value !== "string"
			) {
				throw new Error(`Invalid language-pack message: ${key}`);
			}
			validateTranslationMessage(key, this.english[key], value);
			messages[key] = value;
		}
		if (Object.keys(messages).length === 0) throw new Error("Empty language pack");
		return messages;
	}

	/** Racing the operation itself ensures late storage/transport results have no side effects here. */
	private async withDeadline<T>(
		operation: () => Promise<T>,
		milliseconds: number,
		message: string
	): Promise<T> {
		const scheduleTimeout =
			this.options.scheduleTimeout ??
			((callback, delay) => {
				const timer = window.setTimeout(callback, delay);
				return () => window.clearTimeout(timer);
			});
		let cancelTimeout: (() => void) | undefined;
		try {
			const timeout = new Promise<never>((_, reject) => {
				cancelTimeout = scheduleTimeout(() => reject(new Error(message)), milliseconds);
			});
			return await Promise.race([operation(), timeout]);
		} finally {
			cancelTimeout?.();
		}
	}

	private async loadPack(locale: string): Promise<Record<string, string>> {
		const { manifest } = this.options.config;
		const descriptor = Object.prototype.hasOwnProperty.call(manifest.packs, locale)
			? manifest.packs[locale]
			: undefined;
		if (
			!descriptor ||
			!/^[a-z]{2}(?:-[A-Za-z0-9]+)*$/.test(locale) ||
			descriptor.file !== `${locale}.json` ||
			!/^[a-f0-9]{64}$/.test(descriptor.sha256) ||
			!Number.isSafeInteger(descriptor.bytes) ||
			descriptor.bytes <= 0 ||
			descriptor.bytes > MAX_LANGUAGE_PACK_BYTES
		) {
			throw new Error(`Unsupported language pack: ${locale}`);
		}
		const key = `${manifest.catalogueVersion}/${descriptor.file}`;
		// Reuse identical packs across releases without accepting incompatible data.
		const cacheKey = `${descriptor.sha256}/${descriptor.file}`;
		try {
			const cached = await this.withDeadline(
				() => this.options.cache.read(cacheKey),
				this.options.cacheTimeoutMs ?? 1_000,
				"Language-pack cache read timed out"
			);
			if (cached !== null && cached.length <= MAX_LANGUAGE_PACK_BYTES) {
				return await this.validate(locale, new TextEncoder().encode(cached));
			}
		} catch {
			// Missing/corrupt/unreadable cache: try the pinned network artifact.
		}

		const bytes = await this.withDeadline(
			() => this.options.download(`${this.baseUrl}/${key}`),
			this.options.timeoutMs ?? 15_000,
			"Language-pack download timed out"
		);
		const messages = await this.validate(locale, bytes);
		try {
			await this.withDeadline(
				() =>
					this.options.cache.write(
						cacheKey,
						new TextDecoder("utf-8", { fatal: true }).decode(bytes)
					),
				this.options.cacheTimeoutMs ?? 1_000,
				"Language-pack cache write timed out"
			);
		} catch {
			// A failed/stalled cache must not discard a validated translation.
			// A late write can only persist these same content-addressed validated bytes.
		}
		return messages;
	}
}
