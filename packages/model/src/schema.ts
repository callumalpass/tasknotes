import { z } from "zod";

export const taskDependencyRelTypeSchema = z.enum([
	"FINISHTOSTART",
	"FINISHTOFINISH",
	"STARTTOSTART",
	"STARTTOFINISH",
]);

export const taskDependencySchema = z.object({
	uid: z.string().min(1),
	reltype: taskDependencyRelTypeSchema,
	gap: z.string().optional(),
});

export const timeEntrySchema = z.object({
	startTime: z.string().min(1),
	endTime: z.string().min(1).optional(),
	description: z.string().optional(),
	duration: z.number().optional(),
});

export const reminderSchema = z.object({
	id: z.string().min(1),
	type: z.enum(["absolute", "relative"]),
	relatedTo: z.enum(["due", "scheduled"]).optional(),
	offset: z.string().optional(),
	absoluteTime: z.string().optional(),
	description: z.string().optional(),
});

export const statusConfigSchema = z.object({
	id: z.string().min(1),
	value: z.string().min(1),
	label: z.string().min(1),
	color: z.string().min(1),
	icon: z.string().optional(),
	isCompleted: z.boolean(),
	excludeFromCycle: z.boolean().optional(),
	nextStatus: z.string().optional(),
	order: z.number(),
	autoArchive: z.boolean(),
	autoArchiveDelay: z.number(),
});

export const priorityConfigSchema = z.object({
	id: z.string().min(1),
	value: z.string().min(1),
	label: z.string().min(1),
	color: z.string().min(1),
	icon: z.string().optional(),
	weight: z.number(),
});

export const taskInfoSchema = z.object({
	id: z.string().optional(),
	title: z.string(),
	status: z.string(),
	priority: z.string(),
	due: z.string().optional(),
	scheduled: z.string().optional(),
	path: z.string(),
	archived: z.boolean(),
	tags: z.array(z.string()).optional(),
	contexts: z.array(z.string()).optional(),
	projects: z.array(z.string()).optional(),
	recurrence: z.string().optional(),
	recurrence_anchor: z.enum(["scheduled", "completion"]).optional(),
	complete_instances: z.array(z.string()).optional(),
	skipped_instances: z.array(z.string()).optional(),
	completedDate: z.string().optional(),
	timeEstimate: z.number().optional(),
	timeEntries: z.array(timeEntrySchema).optional(),
	totalTrackedTime: z.number().optional(),
	dateCreated: z.string().optional(),
	dateModified: z.string().optional(),
	icsEventId: z.array(z.string()).optional(),
	googleCalendarEventId: z.string().optional(),
	googleCalendarExceptionEventId: z.string().optional(),
	googleCalendarExceptionOriginalScheduled: z.string().optional(),
	googleCalendarMovedOriginalDates: z.array(z.string()).optional(),
	reminders: z.array(reminderSchema).optional(),
	customProperties: z.record(z.unknown()).optional(),
	basesData: z.unknown().optional(),
	blockedBy: z.array(taskDependencySchema).optional(),
	blocking: z.array(z.string()).optional(),
	isBlocked: z.boolean().optional(),
	isBlocking: z.boolean().optional(),
	hasSubtasks: z.boolean().optional(),
	details: z.string().optional(),
	sortOrder: z.string().optional(),
});

export const taskDocumentSchema = z.object({
	frontmatter: z.record(z.unknown()),
	body: z.string(),
	task: taskInfoSchema.partial(),
	path: z.string().optional(),
});
