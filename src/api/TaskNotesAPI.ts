import type TaskNotesPlugin from "../main";
import {
	NaturalLanguageParser,
	type ParsedTaskData,
} from "../services/NaturalLanguageParser";

export interface TaskNotesPublicAPI {
	parseNaturalLanguage(text: string): ParsedTaskData;
}

export class TaskNotesAPI implements TaskNotesPublicAPI {
	constructor(private plugin: TaskNotesPlugin) {}

	parseNaturalLanguage(text: string): ParsedTaskData {
		if (typeof text !== "string") {
			throw new TypeError("TaskNotes API parseNaturalLanguage expects a string");
		}

		return NaturalLanguageParser.fromPlugin(this.plugin).parseInput(text);
	}
}
