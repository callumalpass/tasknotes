import { Editor } from "obsidian";
import { ParsedTaskData } from "../utils/TasksPluginParser";

export interface TaskConversionOptions {
	parsedData?: ParsedTaskData;
	editor?: Editor;
	lineNumber?: number;
	selectionInfo?: {
		taskLine: string;
		details: string;
		startLine: number;
		endLine: number;
		originalContent: string[];
	};
	prefilledDetails?: string;
}
