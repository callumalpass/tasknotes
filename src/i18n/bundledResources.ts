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

// Remote builds replace this module with synchronous English only.
export const translationResources: TranslationResources = {
	en: compiledMessages(en.messages),
	fr: compiledMessages(fr.messages),
	de: compiledMessages(de.messages),
	es: compiledMessages(es.messages),
	it: compiledMessages(it.messages),
	ja: compiledMessages(ja.messages),
	ko: compiledMessages(ko.messages),
	pt: compiledMessages(pt.messages),
	ru: compiledMessages(ru.messages),
	zh: compiledMessages(zh.messages),
};
