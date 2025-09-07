import { LanguageRegistry, NLPLanguageConfig } from './types';
import { enConfig } from './en';
import { esConfig } from './es';
import { frConfig } from './fr';
import { deConfig } from './de';
import { ruConfig } from './ru';
import { zhConfig } from './zh';
import { jaConfig } from './ja';
import { itConfig } from './it';
import { nlConfig } from './nl';
import { ptConfig } from './pt';
import { svConfig } from './sv';
import { ukConfig } from './uk';

/**
 * Registry of all available language configurations
 */
export const languageRegistry: LanguageRegistry = {
    en: enConfig,
    es: esConfig,
    fr: frConfig,
    de: deConfig,
    ru: ruConfig,
    zh: zhConfig,
    ja: jaConfig,
    it: itConfig,
    nl: nlConfig,
    pt: ptConfig,
    sv: svConfig,
    uk: ukConfig
};

/**
 * Get available languages as options for settings dropdown
 */
export function getAvailableLanguages(): Array<{ value: string; label: string }> {
    return Object.values(languageRegistry).map(config => ({
        value: config.code,
        label: config.name
    }));
}

/**
 * Get language configuration by code, fallback to English
 */
export function getLanguageConfig(languageCode: string): NLPLanguageConfig {
    return languageRegistry[languageCode] || languageRegistry['en'];
}

/**
 * Detect system language and return supported language code
 * Falls back to English if system language is not supported
 */
export function detectSystemLanguage(): string {
    // Try to detect from browser/system locale
    const systemLang = typeof navigator !== 'undefined' 
        ? navigator.language?.split('-')[0] 
        : 'en';
    
    // Return system language if supported, otherwise default to English
    return languageRegistry[systemLang] ? systemLang : 'en';
}

// Re-export types for convenience
export * from './types';