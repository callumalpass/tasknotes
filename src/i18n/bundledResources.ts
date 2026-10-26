import type { TranslationResources } from "./types";
import { en } from "./resources/en";
import { fr } from "./resources/fr";
import { ru } from "./resources/ru";
import { zh } from "./resources/zh";
import { de } from "./resources/de";
import { es } from "./resources/es";
import { ja } from "./resources/ja";
import { pt } from "./resources/pt";
import { ko } from "./resources/ko";

// Ordinary builds retain all locales. The opt-in language-pack build replaces
// this module with an English-only registry through an esbuild plugin.
export const translationResources = {
	en,
	fr,
	ru,
	zh,
	de,
	es,
	ja,
	pt,
	ko,
} satisfies TranslationResources;
