import { setupI18n, type MessageDescriptor } from "@lingui/core";
import { translationResources } from "../../src/i18n/bundledResources";
import { bindUIDisplay, uiText } from "../../src/i18n/runtime";
import concepts from "../../scripts/plugin-key-map.json";

// Pure Lingui core avoids coupling component tests' narrow Obsidian mocks to Events.
const english = setupI18n({ locale: "en", messages: { en: translationResources.en } });
type Arguments = [descriptor: MessageDescriptor, values?: Record<string, string | number>];

/** Assertions render actual compiled English ICU, never a keyed dictionary stub. */
export function englishText(...args: Arguments): string {
	return uiText(args[0], args[1], english);
}

/** Call-through observation of an isolated real Lingui instance and actual catalogues. */
export function observeTranslation(locale = "en") {
	if (!Object.hasOwn(translationResources, locale)) throw new Error(`Unknown test locale: ${locale}`);
	const instance = setupI18n({ locale, messages: { en: translationResources.en, [locale]: translationResources[locale] } });
	bindUIDisplay(instance);
	const boundary = { translate: (descriptor: MessageDescriptor, values?: Arguments[1]) => uiText(descriptor, values, instance) };
	const observer = jest.spyOn(boundary, "translate");
	return observer as typeof observer & typeof boundary.translate;
}

/** Generated migration metadata for legacy-concept assertions, not a runtime key API. */
export function conceptDescriptor(concept: string): MessageDescriptor {
	const inventory: Record<string, MessageDescriptor> = concepts;
	if (!Object.hasOwn(inventory, concept)) throw new Error(`Unknown test concept: ${concept}`);
	return inventory[concept];
}
