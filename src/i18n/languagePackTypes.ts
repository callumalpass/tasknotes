import type { Messages } from "@lingui/core";

export const LANGUAGE_PACK_FORMAT = "tasknotes-lingui-v1";
export const MAX_LANGUAGE_PACK_BYTES = 1_000_000;

export interface LanguagePack {
	format: typeof LANGUAGE_PACK_FORMAT;
	locale: string;
	sourceHash: string;
	messages: Messages;
}

export interface LanguagePackDescriptor {
	file: string;
	sha256: string;
	bytes: number;
}

export interface LanguagePackManifest {
	format: typeof LANGUAGE_PACK_FORMAT;
	product: "tasknotes";
	catalogueVersion: string;
	sourceHash: string;
	packs: Record<string, LanguagePackDescriptor>;
}

export interface LanguagePackBuildConfig {
	baseUrl: string;
	manifest: LanguagePackManifest;
}

export interface LanguagePackCache {
	read(key: string): Promise<string | null>;
	write(key: string, contents: string): Promise<void>;
}

export interface LanguagePackLoaderOptions {
	config: LanguagePackBuildConfig;
	english: Messages;
	cache: LanguagePackCache;
	download(url: string): Promise<Uint8Array>;
	sha256?: (bytes: Uint8Array) => Promise<string>;
	timeoutMs?: number;
	cacheTimeoutMs?: number;
	scheduleTimeout?: (callback: () => void, milliseconds: number) => () => void;
}
