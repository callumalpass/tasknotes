import type TaskNotesPlugin from "../main";
import { StatusConfig, PriorityConfig } from "../types";
import { NLPTriggersConfig, UserMappedField } from "../types/settings";
import {
	NaturalLanguageParserCore as ImportedNaturalLanguageParserCore,
	ParsedTaskData,
} from "tasknotes-nlp-core";

export type { ParsedTaskData };

type ParserCoreInstance = InstanceType<typeof ImportedNaturalLanguageParserCore>;
type ParserCoreOptions = {
	dateLocale?: string;
	dateOrder?: "day-first" | "month-first";
};

const NaturalLanguageParserCore = ImportedNaturalLanguageParserCore as unknown as new (
	statusConfigs?: StatusConfig[],
	priorityConfigs?: PriorityConfig[],
	defaultToScheduled?: boolean,
	languageCode?: string,
	nlpTriggers?: NLPTriggersConfig,
	userFields?: UserMappedField[],
	options?: ParserCoreOptions
) => ParserCoreInstance;

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
		options?: ParserCoreOptions
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
	}

	parseInput(input: string): ParsedTaskData {
		const parsed = super.parseInput(input);
		const withLinkedFields = this.extractLinkedUserFields(input, parsed);
		return this.normalizeUserFieldValues(withLinkedFields);
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
