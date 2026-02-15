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
	}
}
