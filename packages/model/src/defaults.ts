import type {
	FieldMapping,
	PriorityConfig,
	StatusConfig,
	TaskNotesModelConfig,
} from "./types";

export const DEFAULT_FIELD_MAPPING: FieldMapping = {
	title: "title",
	status: "status",
	priority: "priority",
	due: "due",
	scheduled: "scheduled",
	contexts: "contexts",
	projects: "projects",
	timeEstimate: "timeEstimate",
	completedDate: "completedDate",
	dateCreated: "dateCreated",
	dateModified: "dateModified",
	recurrence: "recurrence",
	recurrenceAnchor: "recurrence_anchor",
	archiveTag: "archived",
	timeEntries: "timeEntries",
	completeInstances: "complete_instances",
	skippedInstances: "skipped_instances",
	blockedBy: "blockedBy",
	pomodoros: "pomodoros",
	icsEventId: "icsEventId",
	icsEventTag: "ics_event",
	googleCalendarEventId: "googleCalendarEventId",
	googleCalendarExceptionEventId: "googleCalendarExceptionEventId",
	googleCalendarExceptionOriginalScheduled: "googleCalendarExceptionOriginalScheduled",
	googleCalendarMovedOriginalDates: "googleCalendarMovedOriginalDates",
	reminders: "reminders",
	sortOrder: "tasknotes_manual_order",
};

export const DEFAULT_STATUSES: StatusConfig[] = [
	{
		id: "none",
		value: "none",
		label: "None",
		color: "#cccccc",
		isCompleted: false,
		excludeFromCycle: false,
		order: 0,
		autoArchive: false,
		autoArchiveDelay: 5,
	},
	{
		id: "open",
		value: "open",
		label: "Open",
		color: "#808080",
		isCompleted: false,
		excludeFromCycle: false,
		order: 1,
		autoArchive: false,
		autoArchiveDelay: 5,
	},
	{
		id: "in-progress",
		value: "in-progress",
		label: "In progress",
		color: "#0066cc",
		isCompleted: false,
		excludeFromCycle: false,
		order: 2,
		autoArchive: false,
		autoArchiveDelay: 5,
	},
	{
		id: "done",
		value: "done",
		label: "Done",
		color: "#00aa00",
		isCompleted: true,
		excludeFromCycle: false,
		order: 3,
		autoArchive: false,
		autoArchiveDelay: 5,
	},
];

export const DEFAULT_PRIORITIES: PriorityConfig[] = [
	{
		id: "none",
		value: "none",
		label: "None",
		color: "#cccccc",
		weight: 0,
	},
	{
		id: "low",
		value: "low",
		label: "Low",
		color: "#00aa00",
		weight: 1,
	},
	{
		id: "normal",
		value: "normal",
		label: "Normal",
		color: "#ffaa00",
		weight: 2,
	},
	{
		id: "high",
		value: "high",
		label: "High",
		color: "#ff0000",
		weight: 3,
	},
];

export const DEFAULT_MODEL_CONFIG: TaskNotesModelConfig = {
	fieldMapping: DEFAULT_FIELD_MAPPING,
	statuses: DEFAULT_STATUSES,
	priorities: DEFAULT_PRIORITIES,
	defaults: {
		status: "open",
		priority: "normal",
		taskTag: "task",
	},
	taskIdentification: {
		method: "tag",
		tag: "task",
		propertyName: "isTask",
		propertyValue: "true",
	},
	storeTitleInFilename: false,
	userFields: [],
	recurrence: {
		maintainDueDateOffset: true,
		resetCheckboxesOnRecurrence: false,
	},
	timeTracking: {
		autoStopOnComplete: false,
		autoStopNotification: true,
		defaultSessionDescription: "Work session",
	},
};

export function cloneDefaultModelConfig(): TaskNotesModelConfig {
	return {
		...DEFAULT_MODEL_CONFIG,
		fieldMapping: { ...DEFAULT_MODEL_CONFIG.fieldMapping },
		statuses: DEFAULT_MODEL_CONFIG.statuses.map((status) => ({ ...status })),
		priorities: DEFAULT_MODEL_CONFIG.priorities.map((priority) => ({ ...priority })),
		defaults: { ...DEFAULT_MODEL_CONFIG.defaults },
		taskIdentification: { ...DEFAULT_MODEL_CONFIG.taskIdentification },
		userFields: DEFAULT_MODEL_CONFIG.userFields.map((field) => ({ ...field })),
		recurrence: { ...DEFAULT_MODEL_CONFIG.recurrence },
		timeTracking: { ...DEFAULT_MODEL_CONFIG.timeTracking },
	};
}
