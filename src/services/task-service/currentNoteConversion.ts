import type { TaskInfo } from "../../types";
import type { TaskCreationDefaults, TaskNotesSettings } from "../../types/settings";
import { getCurrentTimestamp } from "../../utils/dateUtils";
import { calculateDefaultDateTime } from "../../utils/helpers";
import { stringifyUnknownArray } from "../../utils/stringUtils";
import { generateUuidV4 } from "../../utils/uuid";

type CurrentNoteConversionSettings = Pick<
	TaskNotesSettings,
	"defaultTaskStatus" | "defaultTaskPriority" | "taskCreationDefaults"
> &
	Partial<Pick<TaskNotesSettings, "storeTitleInFilename">>;

export interface CurrentNoteConversionFieldMapper {
	mapFromFrontmatter(
		frontmatter: Record<string, unknown>,
		filePath: string,
		storeTitleInFilename?: boolean
	): Partial<TaskInfo>;
}

export interface CurrentNoteConversionAdapters {
	calculateDefaultDateTime?: typeof calculateDefaultDateTime;
	generateUuid?: typeof generateUuidV4;
}

export interface CurrentNoteConversionInput {
	path: string;
	basename: string;
	content: string;
	frontmatter?: Record<string, unknown>;
	settings: CurrentNoteConversionSettings;
	fieldMapper?: CurrentNoteConversionFieldMapper;
	now?: string;
	adapters?: CurrentNoteConversionAdapters;
}

export function buildCurrentNoteConversionTaskInfo({
	path,
	basename,
	content,
	frontmatter = {},
	settings,
	fieldMapper,
	now = getCurrentTimestamp(),
	adapters = {},
}: CurrentNoteConversionInput): TaskInfo {
	const mappedFrontmatter = fieldMapper?.mapFromFrontmatter(
		frontmatter,
		path,
		settings.storeTitleInFilename
	);
	const frontmatterScheduled = mappedFrontmatter
		? frontmatterString(mappedFrontmatter.scheduled)
		: frontmatterString(frontmatter.scheduled);
	const scheduled =
		frontmatterScheduled ??
		resolveCurrentNoteDefaultScheduled(
			settings.taskCreationDefaults,
			adapters.calculateDefaultDateTime ?? calculateDefaultDateTime
		);

	return {
		id: (adapters.generateUuid ?? generateUuidV4)(),
		path,
		title:
			(mappedFrontmatter
				? frontmatterString(mappedFrontmatter.title)
				: frontmatterString(frontmatter.title)) || basename,
		status:
			(mappedFrontmatter
				? frontmatterString(mappedFrontmatter.status)
				: frontmatterString(frontmatter.status)) ?? settings.defaultTaskStatus,
		priority:
			(mappedFrontmatter
				? frontmatterString(mappedFrontmatter.priority)
				: frontmatterString(frontmatter.priority)) ?? settings.defaultTaskPriority,
		archived: false,
		due: mappedFrontmatter
			? frontmatterString(mappedFrontmatter.due)
			: frontmatterString(frontmatter.due),
		scheduled,
		contexts: mappedFrontmatter
			? frontmatterStringArray(mappedFrontmatter.contexts)
			: frontmatterStringArray(frontmatter.contexts),
		projects: mappedFrontmatter
			? frontmatterStringArray(mappedFrontmatter.projects)
			: frontmatterStringArray(frontmatter.projects),
		tags:
			(mappedFrontmatter
				? frontmatterStringArray(mappedFrontmatter.tags)
				: frontmatterStringArray(frontmatter.tags)) ?? [],
		timeEstimate: mappedFrontmatter
			? frontmatterNumber(mappedFrontmatter.timeEstimate)
			: frontmatterNumber(frontmatter.timeEstimate),
		recurrence: mappedFrontmatter
			? frontmatterString(mappedFrontmatter.recurrence)
			: frontmatterString(frontmatter.recurrence),
		dateCreated:
			(mappedFrontmatter
				? frontmatterString(mappedFrontmatter.dateCreated)
				: frontmatterString(frontmatter.dateCreated)) || now,
		dateModified: now,
		details: extractMarkdownBodyAfterFrontmatter(content),
	};
}

function resolveCurrentNoteDefaultScheduled(
	defaults: TaskCreationDefaults,
	resolveDefaultDateTime: typeof calculateDefaultDateTime
): string | undefined {
	if (defaults.defaultScheduledDate === "none") {
		return undefined;
	}

	return (
		resolveDefaultDateTime(
			defaults.defaultScheduledDate,
			defaults.defaultScheduledTime
		) || undefined
	);
}

export function extractMarkdownBodyAfterFrontmatter(content: string): string {
	const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n*/);
	if (frontmatterMatch) {
		return content.slice(frontmatterMatch[0].length).trim();
	}

	return content.trim();
}

function frontmatterString(value: unknown): string | undefined {
	if (value === null || value === undefined) return undefined;
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return undefined;
}

function frontmatterStringArray(value: unknown): string[] | undefined {
	if (value === null || value === undefined) return undefined;
	return stringifyUnknownArray(value);
}

function frontmatterNumber(value: unknown): number | undefined {
	if (typeof value === "number") return value;
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		return Number.isNaN(parsed) ? undefined : parsed;
	}
	return undefined;
}
