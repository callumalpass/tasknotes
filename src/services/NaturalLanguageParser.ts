import type TaskNotesPlugin from "../main";
import { StatusConfig, PriorityConfig } from "../types";
import { NLPTriggersConfig, UserMappedField } from "../types/settings";
import {
	NaturalLanguageParserCore,
	type NaturalLanguageParserOptions,
	type ParsedTaskData,
} from "tasknotes-nlp-core";

export type { ParsedTaskData };

function getBrowserLocale(): string | undefined {
	return typeof navigator !== "undefined" && navigator.language ? navigator.language : undefined;
}

function getDateLocaleFromPlugin(plugin: TaskNotesPlugin): string {
	const calendarLocale = plugin.settings.calendarViewSettings?.locale?.trim();
	if (calendarLocale) {
		return calendarLocale;
	}

	return getBrowserLocale() || plugin.settings.nlpLanguage || "en";
}

/**
 * TaskNotes adapter around shared NLP core.
 * Keeps plugin-facing API stable while core logic lives in a reusable package.
 */
export class NaturalLanguageParser extends NaturalLanguageParserCore {
	private readonly taskNotesNlpTriggers?: NLPTriggersConfig;
	private readonly taskNotesUserFields: UserMappedField[];
	private readonly taskNotesPriorityConfigs: PriorityConfig[];

	static fromPlugin(plugin: TaskNotesPlugin): NaturalLanguageParser {
		const s = plugin.settings;
		return new NaturalLanguageParser(
			s.customStatuses,
			s.customPriorities,
			s.nlpDefaultToScheduled,
			s.nlpLanguage,
			s.nlpTriggers,
			s.userFields,
			{ dateLocale: getDateLocaleFromPlugin(plugin) }
		);
	}

	constructor(
		statusConfigs: StatusConfig[] = [],
		priorityConfigs: PriorityConfig[] = [],
		defaultToScheduled = true,
		languageCode = "en",
		nlpTriggers?: NLPTriggersConfig,
		userFields?: UserMappedField[],
		options?: NaturalLanguageParserOptions
	) {
		super(
			statusConfigs,
			priorityConfigs,
			defaultToScheduled,
			languageCode,
			nlpTriggers,
			userFields,
			options
		);
		this.taskNotesNlpTriggers = nlpTriggers;
		this.taskNotesUserFields = userFields || [];
		this.taskNotesPriorityConfigs = priorityConfigs;
	}

	parseInput(input: string): ParsedTaskData {
		const parsed = super.parseInput(input);
		const withPriorityShortcutResidueRemoved = this.removePriorityShortcutResidue(input, parsed);
		const withLinkedFields = this.extractLinkedUserFields(input, withPriorityShortcutResidueRemoved);
		return this.normalizeUserFieldValues(withLinkedFields);
	}

	private removePriorityShortcutResidue(input: string, parsed: ParsedTaskData): ParsedTaskData {
		if (!parsed.priority || this.taskNotesPriorityConfigs.length === 0) {
			return parsed;
		}

		const priorityConfig = this.taskNotesPriorityConfigs.find(
			(config) => config.value === parsed.priority
		);
		if (!priorityConfig) {
			return parsed;
		}

		const trigger = this.getPriorityTrigger();
		const tokenCandidates = [priorityConfig.value, priorityConfig.label]
			.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
			.flatMap((value) => (trigger ? [`${trigger}${value}`, value] : [value]));
		const matchCandidates = [priorityConfig.label, priorityConfig.value].filter(
			(value): value is string => typeof value === "string" && value.trim().length > 0
		);
		const residues = new Set<string>();

		for (const token of tokenCandidates) {
			if (!this.containsToken(input, token)) continue;

			for (const matchCandidate of matchCandidates) {
				const residue = this.removeFirstCaseInsensitive(token, matchCandidate);
				if (!residue || residue === token) continue;

				residues.add(residue);
			}
		}

		let title = parsed.title;
		for (const residue of Array.from(residues).sort((a, b) => b.length - a.length)) {
			title = this.removeTokenFragment(title, residue);
		}

		parsed.title = title || "Untitled Task";
		return parsed;
	}

	private getPriorityTrigger(): string {
		const priorityTrigger = this.taskNotesNlpTriggers?.triggers.find(
			(trigger) => trigger.propertyId === "priority"
		);
		return priorityTrigger?.trigger || "";
	}

	private containsToken(text: string, token: string): boolean {
		const escaped = this.escapeRegexLiteral(token);
		return new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, "iu").test(text);
	}

	private removeTokenFragment(text: string, fragment: string): string {
		const escaped = this.escapeRegexLiteral(fragment);
		return text
			.replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, "giu"), "$1")
			.replace(/\s+/g, " ")
			.trim();
	}

	private removeFirstCaseInsensitive(text: string, value: string): string | null {
		const index = text.toLowerCase().indexOf(value.toLowerCase());
		if (index === -1) {
			return null;
		}

		return `${text.slice(0, index)}${text.slice(index + value.length)}`;
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
