import type { LanguagePackBuildConfig } from "./languagePackTypes";

// Filled by esbuild only when TASKNOTES_LANGUAGE_PACK_BASE_URL is explicitly set.
// No endpoint or remote behaviour is enabled in ordinary development/releases.
export const languagePackConfig: LanguagePackBuildConfig | null = null;
