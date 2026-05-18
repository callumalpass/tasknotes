import { TaskInfo } from "../types";
import { extractBasesValue } from "./taskCardPresentation";

type BasesDataWithGetter = {
	getValue(propertyId: string): unknown;
};

type MetadataCacheLike = {
	getCache(path: string): { frontmatter?: Record<string, unknown> } | null | undefined;
};

type TaskCardFieldMapper = {
	lookupMappingKey(propertyId: string): string | null | undefined;
};

type TaskCardUserField = {
	id?: string;
	key?: string;
};

export interface TaskCardPropertyAccessContext {
	fieldMapper: TaskCardFieldMapper;
	settings: {
		userFields?: readonly TaskCardUserField[];
	};
	app: {
		metadataCache: MetadataCacheLike;
	};
}

function getBasesDataGetter(value: unknown): BasesDataWithGetter | null {
	if (
		value !== null &&
		typeof value === "object" &&
		typeof (value as { getValue?: unknown }).getValue === "function"
	) {
		return value as BasesDataWithGetter;
	}
	return null;
}

const PROPERTY_EXTRACTORS: Record<string, (task: TaskInfo) => unknown> = {
	due: (task) => task.due,
	scheduled: (task) => task.scheduled,
	projects: (task) => task.projects,
	contexts: (task) => task.contexts,
	tags: (task) => task.tags,
	blocked: (task) => task.isBlocked,
	blocking: (task) => task.isBlocking,
	blockedBy: (task) => task.blockedBy,
	blockingTasks: (task) => task.blocking,
	timeEstimate: (task) => task.timeEstimate,
	timeEntries: (task) => task.timeEntries,
	totalTrackedTime: (task) => task.totalTrackedTime,
	recurrence: (task) => task.recurrence,
	completedDate: (task) => task.completedDate,
	reminders: (task) => task.reminders,
	icsEventId: (task) => task.icsEventId,
	completeInstances: (task) => task.complete_instances,
	skippedInstances: (task) => task.skipped_instances,
	dateCreated: (task) => task.dateCreated,
	dateModified: (task) => task.dateModified,
	googleCalendarSync: (task) => task.path,
	checklistProgress: (task) => task.path,
};

function hasPropertyExtractor(propertyId: string): boolean {
	return Object.prototype.hasOwnProperty.call(PROPERTY_EXTRACTORS, propertyId);
}

function getPropertyExtractorValue(task: TaskInfo, propertyId: string): unknown {
	return PROPERTY_EXTRACTORS[propertyId](task);
}

export function getTaskCardPropertyValue(
	task: TaskInfo,
	propertyId: string,
	context: TaskCardPropertyAccessContext
): unknown {
	try {
		const mappingKey = context.fieldMapper.lookupMappingKey(propertyId);
		if (mappingKey && hasPropertyExtractor(mappingKey)) {
			return getPropertyExtractorValue(task, mappingKey);
		}

		if (hasPropertyExtractor(propertyId)) {
			return getPropertyExtractorValue(task, propertyId);
		}

		if (propertyId.startsWith("user:")) {
			return getUserPropertyValue(task, propertyId, context);
		}

		if (task.customProperties && propertyId in task.customProperties) {
			return extractBasesValue(task.customProperties[propertyId]);
		}

		if (task.customProperties) {
			const filePropertyId = `file.${propertyId}`;
			if (filePropertyId in task.customProperties) {
				return extractBasesValue(task.customProperties[filePropertyId]);
			}
		}

		if (propertyId.startsWith("file.")) {
			const basesData = getBasesDataGetter(task.basesData);
			if (basesData) {
				try {
					const value = basesData.getValue(propertyId);
					if (value !== null && value !== undefined) {
						return extractBasesValue(value);
					}
				} catch {
					// Bases property missing.
				}
			}
		}

		if (propertyId.startsWith("formula.")) {
			try {
				const basesData = getBasesDataGetter(task.basesData);
				if (!basesData) {
					return "";
				}

				const value = basesData.getValue(propertyId);
				if (value === null || value === undefined) {
					return "";
				}

				const extracted = extractBasesValue(value);
				return extracted !== "" ? extracted : "";
			} catch (error) {
				console.debug(`[TaskNotes] Error computing formula ${propertyId}:`, error);
				return "[Formula Error]";
			}
		}

		const basesData = getBasesDataGetter(task.basesData);
		if (basesData) {
			try {
				const notePropertyId = `note.${propertyId}`;
				const value = basesData.getValue(notePropertyId);
				if (value !== null && value !== undefined) {
					return extractBasesValue(value);
				}
			} catch {
				// Property doesn't exist in Bases.
			}
		}

		if (task.path) {
			const value = getFrontmatterValue(task.path, propertyId, context);
			if (value !== undefined) {
				return value;
			}
		}

		return null;
	} catch (error) {
		console.warn(`TaskCard: Error getting property ${propertyId}:`, error);
		return null;
	}
}

function getUserPropertyValue(
	task: TaskInfo,
	propertyId: string,
	context: TaskCardPropertyAccessContext
): unknown {
	const fieldId = propertyId.slice(5);
	const userField = context.settings.userFields?.find((field) => field.id === fieldId);
	if (!userField?.key) {
		return null;
	}

	let value = (task as unknown as Record<string, unknown>)[userField.key];
	if (value === undefined) {
		value = getFrontmatterValue(task.path, userField.key, context);
	}

	return value;
}

function getFrontmatterValue(
	taskPath: string,
	key: string,
	context: TaskCardPropertyAccessContext
): unknown {
	try {
		const fileMetadata = context.app.metadataCache.getCache(taskPath);
		if (!fileMetadata?.frontmatter) {
			return undefined;
		}

		return fileMetadata.frontmatter[key];
	} catch (error) {
		console.warn(`TaskCard: Error accessing frontmatter for ${taskPath}:`, error);
		return undefined;
	}
}
