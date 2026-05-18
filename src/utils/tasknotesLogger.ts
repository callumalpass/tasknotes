export type TaskNotesLogCategory =
	| "validation"
	| "persistence"
	| "provider"
	| "configuration"
	| "stale-data"
	| "internal";

export interface TaskNotesLogMetadata {
	category?: TaskNotesLogCategory;
	operation?: string;
	details?: Record<string, unknown>;
	error?: unknown;
}

export interface TaskNotesLogger {
	debug(message: string, metadata?: TaskNotesLogMetadata): void;
	info(message: string, metadata?: TaskNotesLogMetadata): void;
	warn(message: string, metadata?: TaskNotesLogMetadata): void;
	error(message: string, metadata?: TaskNotesLogMetadata): void;
	child(tag: string | (() => string)): TaskNotesLogger;
}

type TaskNotesLoggerSink = Pick<Console, "debug" | "info" | "warn" | "error">;

export interface TaskNotesLoggerOptions {
	tag?: string | (() => string);
	isDebugEnabled?: () => boolean;
	sink?: TaskNotesLoggerSink;
}

const USER_SAFE_ERROR_MESSAGES: Record<TaskNotesLogCategory, string> = {
	validation: "TaskNotes could not use the provided data.",
	persistence: "TaskNotes could not save the change.",
	provider: "TaskNotes could not reach the external provider.",
	configuration: "TaskNotes needs a settings update before it can continue.",
	"stale-data": "TaskNotes needs fresh task data before it can continue.",
	internal: "TaskNotes ran into an unexpected internal error.",
};

function getTagValue(tag: string | (() => string) | undefined): string | null {
	const value = typeof tag === "function" ? tag() : tag;
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

function getLogMessage(tag: string | (() => string) | undefined, message: string, metadata: TaskNotesLogMetadata = {}): string {
	const parts = ["TaskNotes"];
	const tagValue = getTagValue(tag);
	if (tagValue) {
		parts.push(tagValue);
	}
	if (metadata.category) {
		parts.push(metadata.category);
	}
	if (metadata.operation) {
		parts.push(metadata.operation);
	}

	return `${parts.map((part) => `[${part}]`).join("")} ${message}`;
}

function emitLog(
	sink: TaskNotesLoggerSink,
	method: keyof TaskNotesLoggerSink,
	tag: string | (() => string) | undefined,
	message: string,
	metadata?: TaskNotesLogMetadata
): void {
	const args: unknown[] = [getLogMessage(tag, message, metadata)];
	if (metadata?.details) {
		args.push(metadata.details);
	}
	if (metadata?.error !== undefined) {
		args.push(metadata.error);
	}
	sink[method](...args);
}

export function createTaskNotesLogger(options: TaskNotesLoggerOptions = {}): TaskNotesLogger {
	const sink = options.sink ?? console;
	const isDebugEnabled = options.isDebugEnabled ?? (() => false);

	return {
		debug(message, metadata) {
			if (!isDebugEnabled()) {
				return;
			}
			emitLog(sink, "debug", options.tag, message, metadata);
		},
		info(message, metadata) {
			emitLog(sink, "info", options.tag, message, metadata);
		},
		warn(message, metadata) {
			emitLog(sink, "warn", options.tag, message, metadata);
		},
		error(message, metadata) {
			emitLog(sink, "error", options.tag, message, metadata);
		},
		child(tag) {
			const parentTag = options.tag;
			return createTaskNotesLogger({
				...options,
				tag: () => {
					const parent = getTagValue(parentTag);
					const child = getTagValue(tag);
					return [parent, child].filter(Boolean).join("/");
				},
			});
		},
	};
}

export function getUserSafeErrorMessage(
	category: TaskNotesLogCategory,
	action?: string
): string {
	const baseMessage = USER_SAFE_ERROR_MESSAGES[category];
	const normalizedAction = action?.trim();
	if (!normalizedAction) {
		return baseMessage;
	}
	return `${normalizedAction}. ${baseMessage}`;
}
