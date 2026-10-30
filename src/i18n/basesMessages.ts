import type { MessageDescriptor } from "@lingui/core";
import { uiI18n } from "./runtime";

/** Bases has no plugin/Intl callback at row evaluation time. Serialize the active
 * compiled ICU message into safe native expressions when creating the file.
 * Only caller-supplied expressions are executable; all catalogue text is quoted.
 * Current supported locales use Latin digits. Counts in these formulae are integers.
 */
export function basesMessage(
	descriptor: MessageDescriptor,
	expressions: Record<string, string>
): string {
	const message: unknown = uiI18n.messages[descriptor.id];
	const locale = uiI18n.locale.split("-")[0];
	const numberFormat = new Intl.NumberFormat(uiI18n.locales ?? locale);
	const grouping = numberFormat.formatToParts(1000000).find(part => part.type === "group")?.value;
	const threshold = numberFormat.formatToParts(1000).some(part => part.type === "group") ? 1000 : 10000;
	const formatNumber = (value: string): string => {
		const plain = `("" + ${value})`;
		return grouping ? `if(${value} >= ${threshold} || ${value} <= -${threshold}, ${plain}.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ${JSON.stringify(grouping)}), ${plain})` : plain;
	};
	const argument = (key: string): string => {
		if (!(key in expressions)) throw new Error(`Missing Bases message expression: ${key}`);
		return `(${expressions[key]})`;
	};
	function category(value: string, name: string, ordinal: boolean): string {
		const integer = `${value} % 1 == 0`;
		if (ordinal) {
			if (locale === "fr" && name === "one") return `${value} == 1`;
			if (locale === "it" && name === "many") return `(${value} == 8 || ${value} == 11 || ${value} == 80 || ${value} == 800)`;
			if (locale === "en") {
				const ending = { one: 1, two: 2, few: 3 }[name as "one" | "two" | "few"];
				if (ending)
					return `${integer} && ${value} % 10 == ${ending} && ${value} % 100 != ${ending + 10}`;
			}
			return "false";
		}
		if (["ja", "ko", "zh"].includes(locale)) return "false";
		if (locale === "ru") {
			if (name === "one") return `${integer} && ${value} % 10 == 1 && ${value} % 100 != 11`;
			if (name === "few")
				return `${integer} && ${value} % 10 >= 2 && ${value} % 10 <= 4 && (${value} % 100 < 12 || ${value} % 100 > 14)`;
			if (name === "many")
				return `${integer} && (${value} % 10 == 0 || ${value} % 10 >= 5 || (${value} % 100 >= 11 && ${value} % 100 <= 14))`;
		}
		if (["fr", "pt"].includes(locale) && name === "one") return `${value} >= 0 && ${value} < 2`;
		if (["fr", "pt", "es", "it"].includes(locale) && name === "many")
			return `${value} != 0 && ${value} % 1000000 == 0`;
		if (["en", "de", "es", "it"].includes(locale) && name === "one") return `${value} == 1`;
		return "false";
	}
	function render(tokens: unknown, pound?: string): string {
		if (!Array.isArray(tokens)) throw new Error("Expected compiled ICU for Bases");
		const parts = tokens.map((token: unknown): string => {
			if (typeof token === "string")
				return token === "#" && pound ? formatNumber(pound) : JSON.stringify(token);
			if (!Array.isArray(token) || typeof token[0] !== "string")
				throw new Error("Invalid Bases ICU token");
			const [key, kind, options] = token;
			const value = argument(key);
			if (!kind) return `("" + ${value})`;
			if (kind === "number") return formatNumber(value);
			if (
				!["plural", "selectordinal", "select"].includes(kind) ||
				!options ||
				typeof options !== "object"
			)
				throw new Error("Unsupported Bases ICU format");
			const arms = options as Record<string, unknown>;
			const count = typeof arms.offset === "number" ? `(${value} - ${arms.offset})` : value;
			let result = render(arms.other, kind === "select" ? pound : count);
			for (const [choice, body] of Object.entries(arms).reverse()) {
				if (choice === "other" || choice === "offset") continue;
				const condition =
					kind === "select"
						? `${value} == ${JSON.stringify(choice)}`
						: /^=?\d+$/.test(choice)
							? `${value} == ${Number(choice.replace("=", ""))}`
							: category(count, choice, kind === "selectordinal");
				result = `if(${condition}, ${render(body, kind === "select" ? pound : count)}, ${result})`;
			}
			return result;
		});
		return parts.length ? `(${parts.join(" + ")})` : '""';
	}
	return render(message);
}
