import type {
	TaskTitleFormattingRule,
	TaskTitleFormattingSettings,
} from "../types/settings";
import { sanitizeForFilename } from "./filenameGenerator";

export interface TaskTitleFormatContext {
	rawLine?: string;
	parsedTitle?: string;
	sourcePath?: string;
	sourceFolder?: string;
	sourceBasename?: string;
	taskForgeList?: string;
	tags?: string[];
	priority?: string;
	status?: string;
}

export interface TaskTitleFormatResult {
	handles: Record<string, string>;
	canonicalTitle: string;
	filenameTitle: string;
	noteFolder: string;
	fullPath: string;
	warnings: string[];
}

const DEFAULT_MAX_LENGTH = 200;

const TASKFORGE_PRESET_RULES: TaskTitleFormattingRule[] = [
	{ handle: "canonicalTitle", op: "from", value: "{{parsedTitle}}" },
	{ handle: "canonicalTitle", op: "replace", pattern: "^\\s*(?:[-*+]|\\d+\\.)\\s+\\[[ xX]\\]\\s*", with: "", flags: "i" },
	{ handle: "canonicalTitle", op: "replace", pattern: "\\s*%%.*?%%", with: " ", flags: "g" },
	{ handle: "canonicalTitle", op: "replace", pattern: "\\[\\[[^\\]]+\\]\\]", with: " ", flags: "g" },
	{ handle: "canonicalTitle", op: "replace", pattern: "\\s+\\[[A-Za-z_][A-Za-z0-9_-]*::\\s+[^\\]]+\\]", with: " ", flags: "g" },
	{ handle: "canonicalTitle", op: "replace", pattern: "\\s+[⏰🎯⏳📅✅🛫➕]\\s+\\S+", with: " ", flags: "gu" },
	{ handle: "canonicalTitle", op: "replace", pattern: "(?:^|\\s)#[\\w/-]+", with: " ", flags: "g" },
	{ handle: "canonicalTitle", op: "replace", pattern: "^[\\s🔺⏫🔼🔽⏬]+", with: "", flags: "u" },
	{ handle: "canonicalTitle", op: "collapseWhitespace" },
	{ handle: "canonicalTitle", op: "trim" },
	{ handle: "filenameTitle", op: "from", value: "{{canonicalTitle}}" },
];

const DEFAULT_PRESET_RULES: TaskTitleFormattingRule[] = [
	{ handle: "canonicalTitle", op: "from", value: "{{parsedTitle}}" },
	{ handle: "canonicalTitle", op: "collapseWhitespace" },
	{ handle: "canonicalTitle", op: "trim" },
	{ handle: "filenameTitle", op: "from", value: "{{canonicalTitle}}" },
];

export function formatTaskTitle(
	context: TaskTitleFormatContext,
	settings?: Partial<TaskTitleFormattingSettings>
): TaskTitleFormatResult {
	const warnings: string[] = [];
	const maxLength = settings?.maxLength && settings.maxLength > 0
		? settings.maxLength
		: DEFAULT_MAX_LENGTH;
	const taskForgeList = context.taskForgeList || taskForgeListFromPath(context.sourcePath || "");
	const sourceFolder = context.sourceFolder || folderFromPath(context.sourcePath || "");
	const sourceBasename = context.sourceBasename || basenameFromPath(context.sourcePath || "");
	const taskNotesRoot = taskNotesRootFromSourceFolder(sourceFolder);
	const baseTitle = (context.parsedTitle || context.rawLine || "").trim();
	const handles: Record<string, string> = {
		rawLine: context.rawLine || "",
		parsedTitle: baseTitle,
		sourcePath: context.sourcePath || "",
		sourceFolder,
		sourceBasename,
		taskForgeList,
		taskNotesRoot,
		tags: (context.tags || []).join(" "),
		priority: context.priority || "",
		status: context.status || "",
		canonicalTitle: baseTitle,
		filenameTitle: "",
		noteFolder: "",
		fullPath: "",
	};

	if (settings?.enabled === false) {
		return finalizeHandles(handles, maxLength, warnings);
	}

	for (const rule of presetRules(settings?.preset)) {
		applyRule(rule, handles, warnings, maxLength);
	}
	if (!handles.noteFolder.trim() && taskForgeList && taskNotesRoot) {
		handles.noteFolder = `${taskNotesRoot}/${taskForgeList}`;
	}

	for (const rule of settings?.rules || []) {
		applyRule(rule, handles, warnings, maxLength);
	}

	if (!handles.canonicalTitle.trim()) {
		handles.canonicalTitle = baseTitle || "Untitled Task";
	}
	if (!handles.filenameTitle.trim()) {
		handles.filenameTitle = handles.canonicalTitle;
	}
	if (!handles.fullPath.trim() && handles.noteFolder.trim()) {
		handles.fullPath = `${handles.noteFolder}/${sanitizeForFilename(handles.filenameTitle)}.md`;
	}

	return finalizeHandles(handles, maxLength, warnings);
}

function presetRules(preset?: string): TaskTitleFormattingRule[] {
	switch (preset) {
		case "raw":
		case "custom":
			return [];
		case "default":
			return DEFAULT_PRESET_RULES;
		case "taskforge":
		default:
			return TASKFORGE_PRESET_RULES;
	}
}

function applyRule(
	rule: TaskTitleFormattingRule,
	handles: Record<string, string>,
	warnings: string[],
	defaultMaxLength: number
): void {
	if (rule.enabled === false || !rule.handle) {
		return;
	}

	const source = handles[rule.handle] || "";
	const target = rule.target || rule.handle;

	try {
		switch (rule.op) {
			case "from":
				handles[target] = expandTemplate(rule.value || "", handles);
				break;
			case "replace": {
				const pattern = new RegExp(rule.pattern || "", rule.flags || "g");
				handles[target] = source.replace(pattern, expandTemplate(rule.with || "", handles));
				break;
			}
			case "match": {
				const pattern = new RegExp(rule.pattern || "", rule.flags || "");
				const match = source.match(pattern);
				if (!match) {
					return;
				}
				if (match.groups) {
					for (const [key, value] of Object.entries(match.groups)) {
						handles[key] = value || "";
					}
				}
				if (rule.value || rule.target) {
					handles[target] = expandTemplate(rule.value || "{{" + rule.handle + "}}", handles);
				}
				break;
			}
			case "trim":
				handles[target] = source.trim().replace(/^[-\s]+|[-\s]+$/g, "");
				break;
			case "collapseWhitespace":
				handles[target] = source.replace(/\s+/g, " ");
				break;
			case "maxLength":
				handles[target] = source.substring(0, rule.length || defaultMaxLength).trim();
				break;
			case "sanitizeFilename":
				handles[target] = sanitizeForFilename(source);
				break;
		}
	} catch (error) {
		warnings.push(`Skipped ${rule.op} rule for ${rule.handle}: ${String(error)}`);
	}
}

function expandTemplate(template: string, handles: Record<string, string>): string {
	return template.replace(/\{\{\s*([^}|]+?)\s*(?:\|\s*([^}]+?)\s*)?\}\}/g, (_match, rawName, rawFilters) => {
		let value = handles[String(rawName).trim()] || "";
		const filters = String(rawFilters || "")
			.split("|")
			.map((filter) => filter.trim())
			.filter(Boolean);
		for (const filter of filters) {
			if (filter === "trim") {
				value = value.trim();
			} else if (filter === "collapseWhitespace") {
				value = value.replace(/\s+/g, " ");
			} else if (filter === "sanitizeFilename") {
				value = sanitizeForFilename(value);
			}
		}
		return value;
	});
}

function finalizeHandles(
	handles: Record<string, string>,
	maxLength: number,
	warnings: string[]
): TaskTitleFormatResult {
	const canonicalTitle = (handles.canonicalTitle || handles.parsedTitle || "Untitled Task")
		.substring(0, maxLength)
		.trim() || "Untitled Task";
	const filenameTitle = (handles.filenameTitle || canonicalTitle).substring(0, maxLength).trim();
	const noteFolder = normalizeFolder(handles.noteFolder || "");
	const fullPath = handles.fullPath || (noteFolder ? `${noteFolder}/${sanitizeForFilename(filenameTitle)}.md` : "");
	return {
		handles: {
			...handles,
			canonicalTitle,
			filenameTitle,
			noteFolder,
			fullPath,
		},
		canonicalTitle,
		filenameTitle,
		noteFolder,
		fullPath,
		warnings,
	};
}

function taskForgeListFromPath(path: string): string {
	const match = path.match(/(?:^|\/)TaskForge\/([^/]+)\.md$/);
	return match?.[1] || "";
}

function folderFromPath(path: string): string {
	const index = path.lastIndexOf("/");
	return index >= 0 ? path.substring(0, index) : "";
}

function basenameFromPath(path: string): string {
	const name = path.substring(path.lastIndexOf("/") + 1);
	return name.endsWith(".md") ? name.substring(0, name.length - 3) : name;
}

function normalizeFolder(folder: string): string {
	return folder.replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
}

function taskNotesRootFromSourceFolder(sourceFolder: string): string {
	if (!sourceFolder) {
		return "";
	}
	return sourceFolder.replace(/(^|\/)TaskForge$/, "$1TaskNotes");
}
