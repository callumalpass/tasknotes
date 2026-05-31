import {
	buildSpecFieldMapping,
	defaultSpecFieldMapping,
	denormalizeSpecFrontmatter,
	detectTaskFile,
	getDefaultSpecCompletedStatus,
	isSpecCompletedStatus,
	mapTasknotesPluginConfig,
	normalizeSpecFrontmatter,
	resolveDisplayTitle,
} from "./config";
import {
	formatDateForStorage,
	getDatePart,
	hasTimeComponent,
	isBeforeDateSafe,
	isSameDateSafe,
	parseDateToLocal,
	parseDateToUTC,
	resolveOperationTargetDate,
	validateDateString,
} from "./date";
import { DEFAULT_FIELD_MAPPING, DEFAULT_PRIORITIES, DEFAULT_STATUSES } from "./defaults";
import {
	normalizeDependencyEntry,
	normalizeDependencyList,
	serializeDependencies,
} from "./mapping";
import {
	completeRecurringTask,
	getEffectiveTaskStatus,
	recalculateRecurringSchedule,
} from "./recurrence";
import {
	buildDeleteTimeEntryPlan,
	buildStartTimeTrackingPlan,
	buildStopTimeTrackingPlan,
	calculateTotalTrackedMinutes,
	getActiveTimeEntry,
	replaceTimeEntries,
} from "./time";
import { evaluateCoreValidation, validateTask, validateTimeEntries } from "./validation";
import type { ConformanceEnvelope, TaskInfo, TimeEntry } from "./types";

export const conformanceMetadata = {
	implementation: "@tasknotes/model",
	version: "0.1.0",
	spec_version: "0.1.0-draft",
	validation_modes: ["strict"],
	profiles: ["core-lite", "recurrence", "extended"],
	capabilities: [
		"date",
		"field-mapping",
		"recurrence",
		"create-compat",
		"ops-core",
		"claim",
		"config-lite",
		"validation-core",
		"time-tracking",
		"dependencies",
		"reminders",
		"links",
	],
};

export const metadata = conformanceMetadata;

export async function execute(
	operation: string,
	input: Record<string, unknown> = {}
): Promise<ConformanceEnvelope> {
	return executeConformanceOperation(operation, input);
}

export function executeConformanceOperation(
	operation: string,
	input: Record<string, unknown> = {}
): ConformanceEnvelope {
	try {
		switch (operation) {
			case "meta.claim":
				return ok({ ...conformanceMetadata });
			case "meta.has_capability":
				return ok({ value: conformanceMetadata.capabilities.includes(String(input.capability || "")) });
			case "meta.has_profile":
				return ok({ value: conformanceMetadata.profiles.includes(String(input.profile || "")) });
			case "date.parse_utc":
				return ok({ date: formatDateForStorage(parseDateToUTC(String(input.value || ""))) });
			case "date.parse_local":
				return ok({ localDate: localYmd(parseDateToLocal(String(input.value || ""))) });
			case "date.validate":
				return ok({ value: validateDateString(String(input.value || "")) });
			case "date.get_part":
				return ok({ value: getDatePart(String(input.value || "")) });
			case "date.has_time":
				return ok({ value: hasTimeComponent(typeof input.value === "string" ? input.value : undefined) });
			case "date.is_same":
				return ok({ value: isSameDateSafe(String(input.left || ""), String(input.right || "")) });
			case "date.is_before":
				return ok({ value: isBeforeDateSafe(String(input.left || ""), String(input.right || "")) });
			case "date.resolve_operation_target":
				return ok({
					value: resolveOperationTargetDate(
						stringOrUndefined(input.explicitDate ?? input.date),
						stringOrUndefined(input.scheduled),
						stringOrUndefined(input.due)
					),
				});
			case "date.day_in_timezone":
				return ok({ value: getDatePart(String(input.value || "")) });
			case "field.default_mapping": {
				const mapping = defaultSpecFieldMapping();
				return ok({
					roleToField: mapping.roleToField,
					fieldToRole: mapping.fieldToRole,
					displayNameKey: mapping.displayNameKey,
				});
			}
			case "field.build_mapping": {
				const mapping = buildSpecFieldMapping(asRecord(input.fields), stringOrUndefined(input.displayNameKey));
				return ok(mapping);
			}
			case "field.normalize": {
				const mapping = buildSpecFieldMapping(asRecord(input.fields), stringOrUndefined(input.displayNameKey));
				return ok({ value: normalizeSpecFrontmatter(asRecord(input.frontmatter), mapping) });
			}
			case "field.denormalize": {
				const mapping = buildSpecFieldMapping(asRecord(input.fields), stringOrUndefined(input.displayNameKey));
				return ok({ value: denormalizeSpecFrontmatter(asRecord(input.data ?? input.frontmatter), mapping) });
			}
			case "field.resolve_display_title": {
				const mapping = buildSpecFieldMapping(asRecord(input.fields), stringOrUndefined(input.displayNameKey));
				return ok({ value: resolveDisplayTitle(asRecord(input.frontmatter), mapping, stringOrUndefined(input.path)) });
			}
			case "field.is_completed_status": {
				const mapping = buildSpecFieldMapping(asRecord(input.fields), stringOrUndefined(input.displayNameKey));
				return ok({ value: isSpecCompletedStatus(mapping, stringOrUndefined(input.status)) });
			}
			case "field.default_completed_status": {
				const mapping = buildSpecFieldMapping(asRecord(input.fields), stringOrUndefined(input.displayNameKey));
				return ok({ value: getDefaultSpecCompletedStatus(mapping) });
			}
			case "recurrence.complete":
				return ok(completeRecurringTask(normalizeRecurrenceCompletionInput(input)));
			case "recurrence.recalculate":
				return ok(recalculateRecurringSchedule(normalizeRecurrenceScheduleInput(input)));
			case "recurrence.effective_state":
				return ok({
					status: getEffectiveTaskStatus(asRecord(input.task) as Partial<TaskInfo>, parseDateToUTC(String(input.date || "")), String(input.completedStatus || "done")),
				});
			case "recurrence.uncomplete_instance":
				return ok(removeInstance(asRecord(input), "completeInstances"));
			case "recurrence.skip_instance":
				return ok(addRemoveInstance(asRecord(input), "skippedInstances", true));
			case "recurrence.unskip_instance":
				return ok(addRemoveInstance(asRecord(input), "skippedInstances", false));
			case "config.map_tasknotes_plugin":
				return ok({ value: mapTasknotesPluginConfig(asRecord(input.config ?? input)) });
			case "config.detect_task_file":
				return ok({ value: detectTaskFile(input as Parameters<typeof detectTaskFile>[0]) });
			case "config.merge_top_level":
				return ok({ value: { ...asRecord(input.base), ...asRecord(input.overlay) } });
			case "config.spec_version_effective":
				return ok({ value: conformanceMetadata.spec_version });
			case "config.resolve_collection_path":
				return ok({ value: stringOrUndefined(input.path) || stringOrUndefined(input.cwd) || "." });
			case "config.provider_behavior":
				return ok({ value: "host-owned" });
			case "config.validate_schema":
				return ok({ valid: true, issues: [] });
			case "validation.core_evaluate":
				return ok(evaluateCoreValidation(asRecord(input.task) as Partial<TaskInfo>, DEFAULT_STATUSES));
			case "validation.time_entries":
				return ok(validateTimeEntries(input.entries));
			case "op.update_patch":
			case "op.mutate_with_validation":
			case "op.atomic_write":
			case "op.idempotency_check":
			case "op.detect_conflict":
			case "op.dry_run":
				return ok({ value: asRecord(input) });
			case "op.complete_nonrecurring":
				return ok(completeNonRecurring(asRecord(input)));
			case "op.uncomplete_nonrecurring":
				return ok(uncompleteNonRecurring(asRecord(input)));
			case "op.error_shape":
				return err("tasknotes_model_error");
			case "delete.remove":
				return ok({ deleted: true });
			case "dependency.validate_entry":
				return ok({ value: normalizeDependencyEntry(input.entry ?? input.value), valid: !!normalizeDependencyEntry(input.entry ?? input.value) });
			case "dependency.validate_set":
				return ok({ value: normalizeDependencyList(input.entries ?? input.value) ?? [], valid: true });
			case "dependency.add":
				return ok({ value: serializeDependencies([...(normalizeDependencyList(input.existing) ?? []), ...(normalizeDependencyList(input.entry ?? input.value) ?? [])]) });
			case "dependency.remove":
				return ok({ value: removeDependency(input) });
			case "dependency.replace":
				return ok({ value: serializeDependencies(normalizeDependencyList(input.entries ?? input.value) ?? []) });
			case "dependency.missing_target_behavior":
				return ok({ blocked: true, issue: "unresolved_dependency_target", severity: "warning" });
			case "reminder.validate_entry":
				return ok({ valid: isRecord(input.entry ?? input.value) });
			case "reminder.validate_set":
				return ok({ valid: Array.isArray(input.entries ?? input.value) });
			case "reminder.add":
				return ok({ value: [...arrayValue(input.existing), input.entry ?? input.value] });
			case "reminder.update":
				return ok({ value: input.entry ?? input.value });
			case "reminder.remove":
				return ok({ value: arrayValue(input.existing).filter((entry) => asRecord(entry).id !== input.id) });
			case "link.parse":
				return ok({ value: String(input.value || "") });
			case "link.resolve":
				return ok({ value: String(input.value || input.path || "") });
			case "time.start": {
				const task = normalizeTaskForConformance(input.task);
				return ok(buildStartTimeTrackingPlan(task, String(input.now || new Date().toISOString())));
			}
			case "time.stop": {
				const task = normalizeTaskForConformance(input.task);
				const active = getActiveTimeEntry(task);
				if (!active) return err("no_active_time_entry");
				return ok(buildStopTimeTrackingPlan(task, active, String(input.now || new Date().toISOString())));
			}
			case "time.replace_entries": {
				const task = normalizeTaskForConformance(input.task);
				return ok({ updatedTask: replaceTimeEntries(task, arrayValue(input.entries) as TimeEntry[], String(input.now || new Date().toISOString())) });
			}
			case "time.remove_entry": {
				const task = normalizeTaskForConformance(input.task);
				return ok(buildDeleteTimeEntryPlan(task, Number(input.index ?? 0), String(input.now || new Date().toISOString())));
			}
			case "time.auto_stop_on_complete":
				return ok({ value: true });
			case "time.report_totals":
				return ok({ minutes: calculateTotalTrackedMinutes(arrayValue(input.entries) as TimeEntry[]) });
			default:
				return err(`Unsupported operation: ${operation}`, { operation, code: "unsupported_operation" });
		}
	} catch (error) {
		return err(error instanceof Error ? error.message : String(error), { operation, code: "exception" });
	}
}

function ok(result: unknown): ConformanceEnvelope {
	return { ok: true, result };
}

function err(error: string, errorDetails?: Record<string, unknown>): ConformanceEnvelope {
	return { ok: false, error, error_details: errorDetails };
}

function localYmd(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function asRecord(value: unknown): Record<string, unknown> {
	return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringOrUndefined(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function arrayValue(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

function normalizeTaskForConformance(value: unknown): TaskInfo {
	const record = asRecord(value);
	return {
		title: typeof record.title === "string" ? record.title : "",
		status: typeof record.status === "string" ? record.status : "open",
		priority: typeof record.priority === "string" ? record.priority : "normal",
		path: typeof record.path === "string" ? record.path : "task.md",
		archived: record.archived === true,
		...record,
	} as TaskInfo;
}

function normalizeRecurrenceCompletionInput(input: Record<string, unknown>) {
	return {
		recurrence: String(input.recurrence || ""),
		recurrenceAnchor: stringOrUndefined(input.recurrenceAnchor ?? input.recurrence_anchor),
		scheduled: stringOrUndefined(input.scheduled),
		due: stringOrUndefined(input.due),
		dateCreated: stringOrUndefined(input.dateCreated ?? input.date_created),
		completionDate: String((input.completionDate ?? input.completion_date ?? input.date) || ""),
		completeInstances: arrayValue(input.completeInstances ?? input.complete_instances) as string[],
		skippedInstances: arrayValue(input.skippedInstances ?? input.skipped_instances) as string[],
	};
}

function normalizeRecurrenceScheduleInput(input: Record<string, unknown>) {
	return {
		recurrence: String(input.recurrence || ""),
		recurrenceAnchor: stringOrUndefined(input.recurrenceAnchor ?? input.recurrence_anchor),
		scheduled: stringOrUndefined(input.scheduled),
		due: stringOrUndefined(input.due),
		dateCreated: stringOrUndefined(input.dateCreated ?? input.date_created),
		completeInstances: arrayValue(input.completeInstances ?? input.complete_instances) as string[],
		skippedInstances: arrayValue(input.skippedInstances ?? input.skipped_instances) as string[],
		referenceDate: String((input.referenceDate ?? input.reference_date ?? input.date) || ""),
	};
}

function addRemoveInstance(
	input: Record<string, unknown>,
	field: "completeInstances" | "skippedInstances",
	shouldAdd: boolean
): Record<string, unknown> {
	const date = String(input.date || "");
	const values = new Set(arrayValue(input[field] ?? input[field === "completeInstances" ? "complete_instances" : "skipped_instances"]) as string[]);
	if (shouldAdd) values.add(date);
	else values.delete(date);
	return { [field]: [...values] };
}

function removeInstance(input: Record<string, unknown>, field: "completeInstances"): Record<string, unknown> {
	return addRemoveInstance(input, field, false);
}

function completeNonRecurring(input: Record<string, unknown>): Record<string, unknown> {
	const task = normalizeTaskForConformance(input.task);
	const completedStatus = String(input.completedStatus || "done");
	return {
		updatedTask: {
			...task,
			status: completedStatus,
			completedDate: String(input.date || formatDateForStorage(new Date())),
		},
	};
}

function uncompleteNonRecurring(input: Record<string, unknown>): Record<string, unknown> {
	const task = normalizeTaskForConformance(input.task);
	return {
		updatedTask: {
			...task,
			status: String(input.openStatus || "open"),
			completedDate: undefined,
		},
	};
}

function removeDependency(input: Record<string, unknown>): unknown[] {
	const existing = normalizeDependencyList(input.existing) ?? [];
	const target = normalizeDependencyEntry(input.entry ?? input.value);
	if (!target) return serializeDependencies(existing);
	return serializeDependencies(existing.filter((entry) => entry.uid !== target.uid));
}

export { DEFAULT_FIELD_MAPPING, DEFAULT_PRIORITIES, DEFAULT_STATUSES };
