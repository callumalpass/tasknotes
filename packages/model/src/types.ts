export const TASKNOTES_SPEC_VERSION = "0.1.0-draft";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
	[key: string]: JsonValue;
}

export type RecurrenceAnchor = "scheduled" | "completion";

export type TaskDependencyRelType =
	| "FINISHTOSTART"
	| "FINISHTOFINISH"
	| "STARTTOSTART"
	| "STARTTOFINISH";

export interface TaskDependency {
	uid: string;
	reltype: TaskDependencyRelType;
	gap?: string;
}

export interface TimeEntry {
	startTime: string;
	endTime?: string;
	description?: string;
	duration?: number;
}

export interface Reminder {
	id: string;
	type: "absolute" | "relative";
	relatedTo?: "due" | "scheduled";
	offset?: string;
	absoluteTime?: string;
	description?: string;
}

export interface TaskInfo {
	id?: string;
	title: string;
	status: string;
	priority: string;
	due?: string;
	scheduled?: string;
	path: string;
	archived: boolean;
	tags?: string[];
	contexts?: string[];
	projects?: string[];
	recurrence?: string;
	recurrence_anchor?: RecurrenceAnchor;
	complete_instances?: string[];
	skipped_instances?: string[];
	completedDate?: string;
	timeEstimate?: number;
	timeEntries?: TimeEntry[];
	totalTrackedTime?: number;
	dateCreated?: string;
	dateModified?: string;
	icsEventId?: string[];
	googleCalendarEventId?: string;
	googleCalendarExceptionEventId?: string;
	googleCalendarExceptionOriginalScheduled?: string;
	googleCalendarMovedOriginalDates?: string[];
	reminders?: Reminder[];
	customProperties?: Record<string, unknown>;
	basesData?: unknown;
	blockedBy?: TaskDependency[];
	blocking?: string[];
	isBlocked?: boolean;
	isBlocking?: boolean;
	hasSubtasks?: boolean;
	details?: string;
	sortOrder?: string;
}

export interface TaskCreationData extends Partial<TaskInfo> {
	details?: string;
	parentNote?: string;
	creationContext?:
		| "inline-conversion"
		| "manual-creation"
		| "modal-inline-creation"
		| "api"
		| "import"
		| "ics-event";
	customFrontmatter?: Record<string, unknown>;
}

export type TaskUpdateInput = Partial<TaskInfo> & {
	details?: string;
	customFrontmatter?: Record<string, unknown>;
};

export interface FieldMapping {
	title: string;
	status: string;
	priority: string;
	due: string;
	scheduled: string;
	contexts: string;
	projects: string;
	timeEstimate: string;
	completedDate: string;
	dateCreated: string;
	dateModified: string;
	recurrence: string;
	recurrenceAnchor: string;
	archiveTag: string;
	timeEntries: string;
	completeInstances: string;
	skippedInstances: string;
	blockedBy: string;
	pomodoros: string;
	icsEventId: string;
	icsEventTag: string;
	googleCalendarEventId: string;
	googleCalendarExceptionEventId: string;
	googleCalendarExceptionOriginalScheduled: string;
	googleCalendarMovedOriginalDates: string;
	reminders: string;
	sortOrder: string;
}

export type FieldMappingKey = keyof FieldMapping;
export type FrontmatterPropertyName = string;

export interface StatusConfig {
	id: string;
	value: string;
	label: string;
	color: string;
	icon?: string;
	isCompleted: boolean;
	excludeFromCycle?: boolean;
	nextStatus?: string;
	order: number;
	autoArchive: boolean;
	autoArchiveDelay: number;
}

export interface PriorityConfig {
	id: string;
	value: string;
	label: string;
	color: string;
	icon?: string;
	weight: number;
}

export type UserMappedFieldType = "text" | "number" | "date" | "boolean" | "list";

export interface UserMappedField {
	id: string;
	displayName: string;
	key: string;
	type: UserMappedFieldType;
	defaultValue?: string | number | boolean | string[];
}

export type HideIdentifyingTagsMode = "all" | "exact-only";

export interface TaskIdentificationConfig {
	method: "tag" | "property";
	tag: string;
	propertyName: string;
	propertyValue: string;
	excludedFolders?: string | string[];
}

export interface TaskDefaults {
	status: string;
	priority: string;
	taskTag: string;
}

export interface TimeTrackingConfig {
	autoStopOnComplete: boolean;
	autoStopNotification: boolean;
	defaultSessionDescription: string;
}

export interface RecurrenceConfig {
	maintainDueDateOffset: boolean;
	resetCheckboxesOnRecurrence: boolean;
}

export interface TaskNotesModelConfig {
	fieldMapping: FieldMapping;
	statuses: StatusConfig[];
	priorities: PriorityConfig[];
	defaults: TaskDefaults;
	taskIdentification: TaskIdentificationConfig;
	storeTitleInFilename: boolean;
	userFields: UserMappedField[];
	recurrence: RecurrenceConfig;
	timeTracking: TimeTrackingConfig;
}

export interface TaskDocument {
	frontmatter: Record<string, unknown>;
	body: string;
	task: Partial<TaskInfo>;
	path?: string;
}

export type TaskValidationSeverity = "error" | "warning";

export interface TaskValidationIssue {
	code: string;
	message: string;
	severity: TaskValidationSeverity;
	path?: string[];
	field?: string;
}

export interface TaskValidationResult {
	valid: boolean;
	issues: TaskValidationIssue[];
}

export type TaskPatchOperation =
	| { op: "set"; field: string; value: unknown }
	| { op: "delete"; field: string };

export interface TaskOperationPlan<TTask extends Partial<TaskInfo> = TaskInfo> {
	kind: string;
	updatedTask: TTask;
	frontmatterPatch: TaskPatchOperation[];
	dateModified?: string;
	metadata?: Record<string, unknown>;
	issues?: TaskValidationIssue[];
}

export type FieldRole =
	| "title"
	| "status"
	| "priority"
	| "due"
	| "scheduled"
	| "completedDate"
	| "tags"
	| "contexts"
	| "projects"
	| "timeEstimate"
	| "dateCreated"
	| "dateModified"
	| "recurrence"
	| "recurrenceAnchor"
	| "completeInstances"
	| "skippedInstances"
	| "timeEntries"
	| "blockedBy"
	| "reminders";

export interface SpecFieldMapping {
	roleToField: Record<FieldRole, string>;
	fieldToRole: Record<string, FieldRole>;
	displayNameKey: string;
	completedStatuses: string[];
}

export type ConformanceEnvelope =
	| { ok: true; result: unknown }
	| { ok: false; error: string; error_details?: Record<string, unknown> };
