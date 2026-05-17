import type TaskNotesPlugin from "../main";
import { StatusConfig, PriorityConfig } from "../types";
import { NLPTriggersConfig, UserMappedField } from "../types/settings";
import {
	NaturalLanguageParserCore,
	ParsedTaskData,
} from "tasknotes-nlp-core";

export type { ParsedTaskData };

/**
 * TaskNotes adapter around shared NLP core.
 * Keeps plugin-facing API stable while core logic lives in a reusable package.
 */
export class NaturalLanguageParser extends NaturalLanguageParserCore {
	private readonly taskNotesNlpTriggers?: NLPTriggersConfig;
	private readonly taskNotesUserFields: UserMappedField[];

	static fromPlugin(plugin: TaskNotesPlugin): NaturalLanguageParser {
		const s = plugin.settings;
		return new NaturalLanguageParser(
			s.customStatuses,
			s.customPriorities,
			s.nlpDefaultToScheduled,
			s.nlpLanguage,
			s.nlpTriggers,
			s.userFields
		);
	}

	constructor(
		statusConfigs: StatusConfig[] = [],
		priorityConfigs: PriorityConfig[] = [],
		defaultToScheduled = true,
		languageCode = "en",
		nlpTriggers?: NLPTriggersConfig,
		userFields?: UserMappedField[]
	) {
		super(
			statusConfigs,
			priorityConfigs,
			defaultToScheduled,
			languageCode,
			nlpTriggers,
			userFields
		);
		this.taskNotesNlpTriggers = nlpTriggers;
		this.taskNotesUserFields = userFields || [];
	}

	parseInput(input: string): ParsedTaskData {
		const protectedInput = this.protectNlpLiterals(input);
		const parsed = super.parseInput(protectedInput.text);
		const withLinkedFields = this.extractLinkedUserFields(protectedInput.text, parsed);
		this.restoreProtectedLiterals(withLinkedFields, protectedInput.literals);
		return this.normalizeUserFieldValues(withLinkedFields);
	}

	private protectNlpLiterals(input: string): { text: string; literals: string[] } {
		const quoted = this.protectQuotedLiterals(input);
		return this.protectEscapedLiterals(quoted.text, quoted.literals);
	}

	private protectQuotedLiterals(input: string): { text: string; literals: string[] } {
		const literals: string[] = [];
		let text = "";
		let index = 0;

		while (index < input.length) {
			const char = input[index];
			if (!this.isQuoteDelimiter(char) || !this.isEligibleQuoteStart(input, index)) {
				text += char;
				index += 1;
				continue;
			}

			const endIndex = this.findClosingQuote(input, index + 1, char);
			if (endIndex === -1 || !this.isEligibleQuoteEnd(input, endIndex)) {
				text += char;
				index += 1;
				continue;
			}

			const literal = input.slice(index + 1, endIndex);
			if (literal.trim().length === 0) {
				text += char;
				index += 1;
				continue;
			}

			const placeholder = `__TASKNOTES_LITERAL_${literals.length}__`;
			literals.push(literal);
			text += placeholder;
			index = endIndex + 1;
		}

		return { text, literals };
	}

	private protectEscapedLiterals(
		input: string,
		literals: string[]
	): { text: string; literals: string[] } {
		let text = "";
		let index = 0;

		while (index < input.length) {
			if (input[index] !== "\\") {
				text += input[index];
				index += 1;
				continue;
			}

			const literalStart = index + 1;
			if (
				literalStart >= input.length ||
				!this.shouldProtectEscapedLiteral(input, index, literalStart)
			) {
				text += input[index];
				index += 1;
				continue;
			}

			let literalEnd = literalStart;
			while (literalEnd < input.length && !/\s/u.test(input[literalEnd])) {
				literalEnd += 1;
			}

			const literal = input.slice(literalStart, literalEnd);
			const placeholder = `__TASKNOTES_LITERAL_${literals.length}__`;
			literals.push(literal);
			text += placeholder;
			index = literalEnd;
		}

		return { text, literals };
	}

	private restoreProtectedLiterals(parsed: ParsedTaskData, literals: string[]): void {
		if (literals.length === 0) return;

		parsed.title = this.restoreProtectedLiteralsInText(parsed.title, literals)
			.replace(/\s+/g, " ")
			.trim();
		if (parsed.details) {
			parsed.details = this.restoreProtectedLiteralsInText(parsed.details, literals);
		}
	}

	private restoreProtectedLiteralsInText(text: string, literals: string[]): string {
		let restored = text;
		literals.forEach((literal, index) => {
			restored = restored.replace(`__TASKNOTES_LITERAL_${index}__`, literal);
		});
		return restored;
	}

	private isQuoteDelimiter(char: string): boolean {
		return char === "\"" || char === "'" || char === "`";
	}

	private isEligibleQuoteStart(input: string, index: number): boolean {
		const char = input[index];
		if (char !== "'") return true;

		const previous = index > 0 ? input[index - 1] : "";
		return !this.isLiteralBoundaryWordCharacter(previous);
	}

	private isEligibleQuoteEnd(input: string, index: number): boolean {
		const char = input[index];
		if (char !== "'") return true;

		const next = index + 1 < input.length ? input[index + 1] : "";
		return !this.isLiteralBoundaryWordCharacter(next);
	}

	private findClosingQuote(input: string, startIndex: number, delimiter: string): number {
		for (let index = startIndex; index < input.length; index += 1) {
			if (input[index] !== delimiter) continue;

			const previous = index > 0 ? input[index - 1] : "";
			if (previous === "\\") continue;

			return index;
		}

		return -1;
	}

	private isLiteralBoundaryWordCharacter(char: string): boolean {
		return /[\p{L}\p{N}_]/u.test(char);
	}

	private shouldProtectEscapedLiteral(
		input: string,
		escapeIndex: number,
		literalStart: number
	): boolean {
		if (this.startsWithEscapableTrigger(input, literalStart)) {
			return true;
		}

		const previous = escapeIndex > 0 ? input[escapeIndex - 1] : "";
		if (previous && !/\s/u.test(previous)) {
			return false;
		}

		return /[\p{L}\p{N}]/u.test(input[literalStart]);
	}

	private startsWithEscapableTrigger(input: string, index: number): boolean {
		const triggers = this.getEscapableTriggers();
		return triggers.some((trigger) => input.startsWith(trigger, index));
	}

	private getEscapableTriggers(): string[] {
		const configured = this.taskNotesNlpTriggers?.triggers
			.filter((trigger) => trigger.enabled && trigger.trigger.length > 0)
			.map((trigger) => trigger.trigger);

		if (configured && configured.length > 0) {
			return configured;
		}

		return ["#", "@", "+", "*", "!"];
	}

	private normalizeUserFieldValues(parsed: ParsedTaskData): ParsedTaskData {
		if (!parsed.userFields) {
			return parsed;
		}

		const userFields = parsed.userFields as Record<string, unknown>;

		for (const userField of this.taskNotesUserFields) {
			if (userField.type !== "boolean") continue;

			const value = userFields[userField.id];
			if (typeof value !== "string") continue;

			const normalized = value.trim().toLowerCase();
			if (normalized === "true") {
				userFields[userField.id] = true;
			} else if (normalized === "false") {
				userFields[userField.id] = false;
			}
		}

		return parsed;
	}

	private extractLinkedUserFields(input: string, parsed: ParsedTaskData): ParsedTaskData {
		const triggers = this.taskNotesNlpTriggers?.triggers || [];
		if (triggers.length === 0 || this.taskNotesUserFields.length === 0) {
			return parsed;
		}

		let title = parsed.title;

		for (const triggerDef of triggers) {
			if (!triggerDef.enabled) continue;

			const userField = this.taskNotesUserFields.find(
				(field) => field.id === triggerDef.propertyId
			);
			if (!userField) continue;

			const escapedTrigger = this.escapeRegexLiteral(triggerDef.trigger);
			const pattern = new RegExp(
				`${escapedTrigger}(\\[\\[[^\\]]+\\]\\]|\\[[^\\]]+\\]\\([^\\)]+\\))`,
				"gu"
			);
			const matches = Array.from(input.matchAll(pattern));
			if (matches.length === 0) continue;

			const values = matches
				.map((match) => match[1])
				.filter((value): value is string => typeof value === "string" && value.length > 0);
			if (values.length === 0) continue;

			if (!parsed.userFields) {
				parsed.userFields = {};
			}

			if (userField.type === "list") {
				const existing = parsed.userFields[userField.id];
				const existingValues = Array.isArray(existing)
					? existing
					: typeof existing === "string"
						? [existing]
						: [];
				parsed.userFields[userField.id] = [...existingValues, ...values];
			} else {
				parsed.userFields[userField.id] = values[values.length - 1];
			}

			title = title.replace(pattern, "").replace(/\s+/g, " ").trim();
		}

		parsed.title = title;
		return parsed;
	}

	private escapeRegexLiteral(value: string): string {
		return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}
}
