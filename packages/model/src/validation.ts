import { getDatePart, validateDateString } from "./date";
import { isCompletedStatus } from "./config";
import { taskInfoSchema, timeEntrySchema } from "./schema";
import type {
	StatusConfig,
	TaskInfo,
	TaskValidationIssue,
	TaskValidationResult,
	TimeEntry,
} from "./types";

export function validateTask(task: Partial<TaskInfo>): TaskValidationResult {
	const issues: TaskValidationIssue[] = [];
	const parsed = taskInfoSchema.partial().safeParse(task);
	if (!parsed.success) {
		for (const issue of parsed.error.issues) {
			issues.push({
				code: "schema_invalid",
				message: issue.message,
				severity: "error",
				path: issue.path.map(String),
			});
		}
	}

	for (const field of ["due", "scheduled", "completedDate", "dateCreated", "dateModified"] as const) {
		const value = task[field];
		if (value !== undefined && typeof value === "string") {
			try {
				validateDateString(getDatePart(value));
			} catch {
				issues.push({
					code: "invalid_date",
					message: `${field} must contain a valid date`,
					severity: "error",
					field,
				});
			}
		}
	}

	if (task.complete_instances) {
		for (const date of task.complete_instances) {
			try {
				validateDateString(date);
			} catch {
				issues.push({
					code: "invalid_complete_instance",
					message: `Invalid completed recurrence instance "${date}"`,
					severity: "warning",
					field: "complete_instances",
				});
			}
		}
	}

	if (task.skipped_instances) {
		for (const date of task.skipped_instances) {
			try {
				validateDateString(date);
			} catch {
				issues.push({
					code: "invalid_skipped_instance",
					message: `Invalid skipped recurrence instance "${date}"`,
					severity: "warning",
					field: "skipped_instances",
				});
			}
		}
	}

	if (task.timeEntries) {
		issues.push(...validateTimeEntries(task.timeEntries).issues);
	}

	return {
		valid: !issues.some((issue) => issue.severity === "error"),
		issues,
	};
}

export function validateTimeEntries(entries: unknown): TaskValidationResult {
	const issues: TaskValidationIssue[] = [];
	if (!Array.isArray(entries)) {
		return {
			valid: false,
			issues: [
				{
					code: "time_entries_not_array",
					message: "timeEntries must be an array",
					severity: "error",
					field: "timeEntries",
				},
			],
		};
	}

	entries.forEach((entry, index) => {
		const parsed = timeEntrySchema.safeParse(entry);
		if (!parsed.success) {
			for (const issue of parsed.error.issues) {
				issues.push({
					code: "invalid_time_entry",
					message: issue.message,
					severity: "error",
					path: ["timeEntries", String(index), ...issue.path.map(String)],
				});
			}
			return;
		}
		validateTimeEntryOrder(parsed.data, index, issues);
	});

	const activeCount = (entries as TimeEntry[]).filter((entry) => entry && !entry.endTime).length;
	if (activeCount > 1) {
		issues.push({
			code: "multiple_active_time_entries",
			message: "Only one active time entry is allowed",
			severity: "warning",
			field: "timeEntries",
		});
	}

	return {
		valid: !issues.some((issue) => issue.severity === "error"),
		issues,
	};
}

export function evaluateCoreValidation(
	task: Partial<TaskInfo>,
	statuses: readonly StatusConfig[]
): TaskValidationResult {
	const result = validateTask(task);
	if (task.status && isCompletedStatus(task.status, statuses) && task.recurrence && task.completedDate) {
		result.issues.push({
			code: "recurring_task_completed_date",
			message: "Recurring task completion is tracked per instance, not with completedDate",
			severity: "warning",
			field: "completedDate",
		});
	}
	return {
		valid: !result.issues.some((issue) => issue.severity === "error"),
		issues: result.issues,
	};
}

function validateTimeEntryOrder(
	entry: TimeEntry,
	index: number,
	issues: TaskValidationIssue[]
): void {
	const start = new Date(entry.startTime);
	if (Number.isNaN(start.getTime())) {
		issues.push({
			code: "invalid_time_entry_start",
			message: "Time entry startTime must be a valid datetime",
			severity: "error",
			path: ["timeEntries", String(index), "startTime"],
		});
		return;
	}

	if (!entry.endTime) {
		return;
	}

	const end = new Date(entry.endTime);
	if (Number.isNaN(end.getTime())) {
		issues.push({
			code: "invalid_time_entry_end",
			message: "Time entry endTime must be a valid datetime",
			severity: "error",
			path: ["timeEntries", String(index), "endTime"],
		});
		return;
	}

	if (end < start) {
		issues.push({
			code: "time_entry_negative_duration",
			message: "Time entry endTime must not be before startTime",
			severity: "error",
			path: ["timeEntries", String(index), "endTime"],
		});
	}
}
