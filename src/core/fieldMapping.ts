/* eslint-disable no-console */
import { FieldMapping, TaskInfo } from "../types";
import {
	normalizeDependencyEntry,
	normalizeDependencyList,
	serializeDependencies,
} from "../utils/dependencyUtils";
import { validateCompleteInstances } from "../utils/dateUtils";

export function toUserField(mapping: FieldMapping, internalName: keyof FieldMapping): string {
	return mapping[internalName];
}

export function normalizeTitleValue(val: unknown): string | undefined {
	if (typeof val === "string") return val;
	if (Array.isArray(val)) return val.map((v) => String(v)).join(", ");
	if (val === null || val === undefined) return undefined;
	if (typeof val === "object") return "";
	return String(val);
}

export function mapTaskFromFrontmatter(
	mapping: FieldMapping,
	frontmatter: Record<string, any> | undefined | null,
	filePath: string,
	storeTitleInFilename?: boolean
): Partial<TaskInfo> {
	if (!frontmatter) return {};

	const mapped: Partial<TaskInfo> = {
		path: filePath,
	};

	if (frontmatter[mapping.title] !== undefined) {
		const normalized = normalizeTitleValue(frontmatter[mapping.title]);
		if (normalized !== undefined) {
			mapped.title = normalized;
		}
	} else if (storeTitleInFilename) {
		const filename = filePath.split("/").pop()?.replace(".md", "");
		if (filename) {
			mapped.title = filename;
		}
	}

	if (frontmatter[mapping.status] !== undefined) {
		const statusValue = frontmatter[mapping.status];
		mapped.status = typeof statusValue === "boolean" ? (statusValue ? "true" : "false") : statusValue;
	}

	if (frontmatter[mapping.priority] !== undefined) {
		mapped.priority = frontmatter[mapping.priority];
	}

	if (frontmatter[mapping.due] !== undefined) {
		mapped.due = frontmatter[mapping.due];
	}

	if (frontmatter[mapping.scheduled] !== undefined) {
		mapped.scheduled = frontmatter[mapping.scheduled];
	}

	if (frontmatter[mapping.contexts] !== undefined) {
		const contexts = frontmatter[mapping.contexts];
		mapped.contexts = Array.isArray(contexts) ? contexts : [contexts];
	}

	if (frontmatter[mapping.projects] !== undefined) {
		const projects = frontmatter[mapping.projects];
		mapped.projects = Array.isArray(projects) ? projects : [projects];
	}

	if (frontmatter[mapping.timeEstimate] !== undefined) {
		mapped.timeEstimate = frontmatter[mapping.timeEstimate];
	}

	if (frontmatter[mapping.completedDate] !== undefined) {
		mapped.completedDate = frontmatter[mapping.completedDate];
	}

	if (frontmatter[mapping.recurrence] !== undefined) {
		mapped.recurrence = frontmatter[mapping.recurrence];
	}

	if (frontmatter[mapping.recurrenceAnchor] !== undefined) {
		const anchorValue = frontmatter[mapping.recurrenceAnchor];
		if (anchorValue === "scheduled" || anchorValue === "completion") {
			mapped.recurrence_anchor = anchorValue;
		} else {
			console.warn(`Invalid recurrence_anchor value: ${anchorValue}, defaulting to 'scheduled'`);
			mapped.recurrence_anchor = "scheduled";
		}
	}

	if (frontmatter[mapping.dateCreated] !== undefined) {
		mapped.dateCreated = frontmatter[mapping.dateCreated];
	}

	if (frontmatter[mapping.dateModified] !== undefined) {
		mapped.dateModified = frontmatter[mapping.dateModified];
	}

	if (frontmatter[mapping.timeEntries] !== undefined) {
		const timeEntriesValue = frontmatter[mapping.timeEntries];
		mapped.timeEntries = Array.isArray(timeEntriesValue) ? timeEntriesValue : [];
	}

	if (frontmatter[mapping.completeInstances] !== undefined) {
		mapped.complete_instances = validateCompleteInstances(frontmatter[mapping.completeInstances]);
	}

	if (frontmatter[mapping.skippedInstances] !== undefined) {
		mapped.skipped_instances = validateCompleteInstances(frontmatter[mapping.skippedInstances]);
	}

	if (mapping.blockedBy && frontmatter[mapping.blockedBy] !== undefined) {
		const dependencies = normalizeDependencyList(frontmatter[mapping.blockedBy]);
		if (dependencies) {
			mapped.blockedBy = dependencies;
		}
	}

	if (frontmatter[mapping.icsEventId] !== undefined) {
		const icsEventId = frontmatter[mapping.icsEventId];
		mapped.icsEventId = Array.isArray(icsEventId) ? icsEventId : [icsEventId];
	}

	if (frontmatter[mapping.googleCalendarEventId] !== undefined) {
		mapped.googleCalendarEventId = frontmatter[mapping.googleCalendarEventId];
	}

	if (frontmatter[mapping.reminders] !== undefined) {
		const reminders = frontmatter[mapping.reminders];
		if (Array.isArray(reminders)) {
			const filteredReminders = reminders.filter((r) => r != null);
			if (filteredReminders.length > 0) {
				mapped.reminders = filteredReminders;
			}
		} else if (reminders != null) {
			mapped.reminders = [reminders];
		}
	}

	if (frontmatter[mapping.sortOrder] !== undefined) {
		const val = frontmatter[mapping.sortOrder];
		mapped.sortOrder = typeof val === "string" ? val : String(val);
	}

	if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
		mapped.tags = frontmatter.tags;
		mapped.archived = frontmatter.tags.includes(mapping.archiveTag);
	}

	return mapped;
}

export function mapTaskToFrontmatter(
	mapping: FieldMapping,
	taskData: Partial<TaskInfo>,
	taskTag?: string,
	storeTitleInFilename?: boolean
): Record<string, any> {
	const frontmatter: Record<string, any> = {};

	if (taskData.title !== undefined) {
		frontmatter[mapping.title] = taskData.title;
	}

	if (taskData.status !== undefined) {
		const lower = taskData.status.toLowerCase();
		const coercedValue =
			lower === "true" || lower === "false" ? lower === "true" : taskData.status;
		frontmatter[mapping.status] = coercedValue;
	}

	if (taskData.priority !== undefined) {
		frontmatter[mapping.priority] = taskData.priority;
	}

	if (taskData.due !== undefined) {
		frontmatter[mapping.due] = taskData.due;
	}

	if (taskData.scheduled !== undefined) {
		frontmatter[mapping.scheduled] = taskData.scheduled;
	}

	if (
		taskData.contexts !== undefined &&
		(!Array.isArray(taskData.contexts) || taskData.contexts.length > 0)
	) {
		frontmatter[mapping.contexts] = taskData.contexts;
	}

	if (
		taskData.projects !== undefined &&
		(!Array.isArray(taskData.projects) || taskData.projects.length > 0)
	) {
		frontmatter[mapping.projects] = taskData.projects;
	}

	if (taskData.timeEstimate !== undefined) {
		frontmatter[mapping.timeEstimate] = taskData.timeEstimate;
	}

	if (taskData.completedDate !== undefined) {
		frontmatter[mapping.completedDate] = taskData.completedDate;
	}

	if (taskData.recurrence !== undefined) {
		frontmatter[mapping.recurrence] = taskData.recurrence;
	}

	if (taskData.recurrence_anchor !== undefined) {
		frontmatter[mapping.recurrenceAnchor] = taskData.recurrence_anchor;
	}

	if (taskData.dateCreated !== undefined) {
		frontmatter[mapping.dateCreated] = taskData.dateCreated;
	}

	if (taskData.dateModified !== undefined) {
		frontmatter[mapping.dateModified] = taskData.dateModified;
	}

	if (taskData.sortOrder !== undefined) {
		frontmatter[mapping.sortOrder] = taskData.sortOrder;
	}

	if (taskData.timeEntries !== undefined) {
		frontmatter[mapping.timeEntries] = taskData.timeEntries;
	}

	if (taskData.complete_instances !== undefined) {
		frontmatter[mapping.completeInstances] = taskData.complete_instances;
	}

	if (taskData.skipped_instances !== undefined && taskData.skipped_instances.length > 0) {
		frontmatter[mapping.skippedInstances] = taskData.skipped_instances;
	}

	if (taskData.blockedBy !== undefined) {
		if (Array.isArray(taskData.blockedBy)) {
			const normalized = taskData.blockedBy
				.map((item) => normalizeDependencyEntry(item))
				.filter((item): item is NonNullable<ReturnType<typeof normalizeDependencyEntry>> => !!item);
			if (normalized.length > 0) {
				frontmatter[mapping.blockedBy] = serializeDependencies(normalized);
			}
		} else {
			frontmatter[mapping.blockedBy] = taskData.blockedBy;
		}
	}

	if (taskData.icsEventId !== undefined && taskData.icsEventId.length > 0) {
		frontmatter[mapping.icsEventId] = taskData.icsEventId;
	}

	if (taskData.reminders !== undefined && taskData.reminders.length > 0) {
		frontmatter[mapping.reminders] = taskData.reminders;
	}

	let tags = taskData.tags ? [...taskData.tags] : [];

	if (taskTag && !tags.includes(taskTag)) {
		tags.push(taskTag);
	}

	if (taskData.archived === true && !tags.includes(mapping.archiveTag)) {
		tags.push(mapping.archiveTag);
	} else if (taskData.archived === false) {
		tags = tags.filter((tag) => tag !== mapping.archiveTag);
	}

	if (tags.length > 0) {
		frontmatter.tags = tags;
	}

	void storeTitleInFilename;

	return frontmatter;
}

export function lookupMappingKey(
	mapping: FieldMapping,
	frontmatterPropertyName: string
): keyof FieldMapping | null {
	for (const [mappingKey, propertyName] of Object.entries(mapping)) {
		if (propertyName === frontmatterPropertyName) {
			return mappingKey as keyof FieldMapping;
		}
	}
	return null;
}

export function isRecognizedProperty(mapping: FieldMapping, frontmatterPropertyName: string): boolean {
	return lookupMappingKey(mapping, frontmatterPropertyName) !== null;
}

export function isPropertyForField(
	mapping: FieldMapping,
	propertyName: string,
	internalField: keyof FieldMapping
): boolean {
	return mapping[internalField] === propertyName;
}

export function toUserFields(
	mapping: FieldMapping,
	internalFields: (keyof FieldMapping)[]
): string[] {
	return internalFields.map((field) => mapping[field]);
}

export function validateFieldMapping(mapping: FieldMapping): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	const fields = Object.keys(mapping) as (keyof FieldMapping)[];
	for (const field of fields) {
		if (!mapping[field] || mapping[field].trim() === "") {
			errors.push(`Field "${field}" cannot be empty`);
		}
	}

	const values = Object.values(mapping);
	const uniqueValues = new Set(values);
	if (values.length !== uniqueValues.size) {
		errors.push("Field mappings must have unique property names");
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}
