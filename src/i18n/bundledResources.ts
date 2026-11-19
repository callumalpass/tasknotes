import type { Messages } from "@lingui/core";
import { compiledMessages } from "./catalogue";
import type { TranslationResources } from "./types";
import en from "./locales/en/messages.json";
import fr from "./locales/fr/messages.json";
import de from "./locales/de/messages.json";
import es from "./locales/es/messages.json";
import it from "./locales/it/messages.json";
import ja from "./locales/ja/messages.json";
import ko from "./locales/ko/messages.json";
import pt from "./locales/pt/messages.json";
import ru from "./locales/ru/messages.json";
import zh from "./locales/zh/messages.json";

/**
 * Production builds ship each catalogue compressed. Decode and validate a locale
 * the first time it is read, so startup only pays for English and the active
 * language rather than every bundled catalogue.
 */
function lazyResources(catalogues: Record<string, { messages: unknown }>): TranslationResources {
	const resources: TranslationResources = {};
	for (const [locale, catalogue] of Object.entries(catalogues)) {
		Object.defineProperty(resources, locale, {
			enumerable: true,
			configurable: true,
			get(): Messages {
				const messages = compiledMessages(catalogue.messages);
				Object.defineProperty(resources, locale, { value: messages, enumerable: true });
				return messages;
			},
		});
	}
	return resources;
}

// Remote builds replace this module with synchronous English only.
export const translationResources: TranslationResources = lazyResources({ en, fr, de, es, it, ja, ko, pt, ru, zh });
