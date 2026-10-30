import { normalizePath, type App, type PluginManifest } from "obsidian";
import { downloadLanguagePack } from "../api/languagePacks";
import type { I18nService } from "../i18n/I18nService";
import { LanguagePackController } from "../i18n/LanguagePackController";
import { LanguagePackLoader } from "../i18n/LanguagePackLoader";
import type { LanguagePackBuildConfig } from "../i18n/languagePackTypes";
import english from "../i18n/locales/en/messages.json";
import { compiledMessages } from "../i18n/catalogue";

export function createLanguagePackController(
	app: App,
	manifest: PluginManifest,
	i18n: I18nService,
	config: LanguagePackBuildConfig
): LanguagePackController {
	const adapter = app.vault.adapter;
	const pluginDirectory = manifest.dir ?? `${app.vault.configDir}/plugins/${manifest.id}`;
	const root = normalizePath(`${pluginDirectory}/language-packs`);
	const cachePath = (key: string) => normalizePath(`${root}/${key}`);
	const ensureDirectory = async (path: string): Promise<void> => {
		if (await adapter.exists(path)) return;
		try {
			await adapter.mkdir(path);
		} catch (error) {
			// Concurrent downloads may create the same cache directory.
			if (!(await adapter.exists(path))) throw error;
		}
	};
	const loader = new LanguagePackLoader({
		config,
		english: compiledMessages(english.messages),
		cache: {
			read: async (key) => {
				const path = cachePath(key);
				return (await adapter.exists(path)) ? adapter.read(path) : null;
			},
			write: async (key, contents) => {
				await ensureDirectory(root);
				await ensureDirectory(normalizePath(`${root}/${key.split("/")[0]}`));
				await adapter.write(cachePath(key), contents);
			},
		},
		download: downloadLanguagePack,
	});
	return new LanguagePackController(i18n, loader);
}
