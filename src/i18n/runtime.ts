import { setupI18n, type I18n, type MessageDescriptor } from "@lingui/core";
import english from "./locales/en/messages.json";
import { compiledMessages } from "./catalogue";
import { errorMessages } from "./errorMessages";

// Obsidian owns one active plugin. Each service retains its isolated core instance;
// display helpers bind to the active plugin, with synchronous English before startup.
export let uiI18n = setupI18n({ locale: "en", messages: { en: compiledMessages(english.messages) } });

export function bindUIDisplay(instance: I18n): void {
	uiI18n = instance;
}

export function uiText(descriptor: MessageDescriptor, values?: Record<string, unknown>, instance = uiI18n): string {
	const parameters = { ...descriptor.values, ...values };
	for (const [key, value] of Object.entries(parameters)) {
		if (/error|message|guidance/i.test(key) && typeof value === "string") parameters[key] = displayError(value, 0, instance);
	}
	return instance._({ ...descriptor, values: parameters });
}

/** Localize only recognized plugin-owned diagnostics at a UI boundary, never user data or wire contracts. */
export function displayError(error: unknown, depth = 0, instance = uiI18n): string {
	const raw = error instanceof Error ? error.message : String(error);
	if (depth > 8) return raw;
	for (const { pattern, keys, dataValues, descriptor } of errorMessages) {
		const match = pattern.exec(raw);
		if (!match) continue;
		const values = Object.fromEntries(keys.map((key, index) => [key,
			/error|message|guidance/i.test(key) ? displayError(match[index + 1], depth + 1, instance) : match[index + 1]]));
		return instance._({ ...descriptor, values: { ...dataValues, ...values } });
	}
	return raw;
}

export function uiLocale(): string {
	return uiI18n.locale === "pt" ? "pt-BR" : uiI18n.locale === "zh" ? "zh-CN" : uiI18n.locale;
}
