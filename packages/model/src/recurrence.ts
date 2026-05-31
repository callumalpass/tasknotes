import * as rrulePackage from "rrule";
import {
	createUTCDateForRRule,
	formatDateAsUTCString,
	formatDateForStorage,
	getDatePart,
	getTodayLocal,
	getTodayString,
	hasTimeComponent,
	parseDateToLocal,
	parseDateToUTC,
} from "./date";
import type { RecurrenceAnchor, TaskInfo } from "./types";

const rruleDefault = Reflect.get(rrulePackage, "default") as
	| typeof import("rrule")
	| undefined;
const RRule = ((rrulePackage as typeof import("rrule")).RRule ??
	rruleDefault?.RRule) as typeof import("rrule").RRule;
const MAX_FINITE_INSTANCE_COUNT = 10000;

type RRuleInstance = {
	between(start: Date, end: Date, inclusive?: boolean): Date[];
	after(date: Date, inclusive?: boolean): Date | null;
};

export interface RecurringTaskLike {
	title?: string;
	recurrence?: string;
	scheduled?: string;
	due?: string;
	dateCreated?: string;
	recurrence_anchor?: RecurrenceAnchor;
	complete_instances?: string[];
	skipped_instances?: string[];
	status?: string;
}

export interface RecurrenceCompletionInput {
	recurrence: string;
	recurrenceAnchor?: string;
	scheduled?: string;
	due?: string;
	dateCreated?: string;
	completionDate: string;
	completeInstances?: string[];
	skippedInstances?: string[];
}

export interface RecurrenceCompletionResult {
	updatedRecurrence: string;
	nextScheduled: string | null;
	nextDue: string | null;
	completeInstances: string[];
	skippedInstances: string[];
}

export interface RecurrenceScheduleInput {
	recurrence: string;
	recurrenceAnchor?: string;
	scheduled?: string;
	due?: string;
	dateCreated?: string;
	completeInstances?: string[];
	skippedInstances?: string[];
	referenceDate: string;
}

export interface RecurrenceScheduleResult {
	updatedRecurrence: string;
	nextScheduled: string | null;
	nextDue: string | null;
}

export interface RecurrenceDateContext {
	today?: string;
}

export function isDueByRRule(task: RecurringTaskLike, date: Date): boolean {
	if (!task.recurrence) return true;
	if (typeof task.recurrence !== "string") return true;

	try {
		const rule = createRRule(task);
		if (!rule) return false;
		const targetDateStart = createUTCDateForRRule(formatDateAsUTCString(date));
		const occurrences = rule.between(
			targetDateStart,
			new Date(targetDateStart.getTime() + 24 * 60 * 60 * 1000 - 1),
			true
		);
		return occurrences.length > 0;
	} catch {
		return true;
	}
}

export function getEffectiveTaskStatus(
	task: Pick<RecurringTaskLike, "recurrence" | "complete_instances" | "status">,
	date: Date,
	completedStatus = "done"
): string {
	if (!task.recurrence) {
		return task.status || "open";
	}
	const dateStr = formatDateForStorage(date);
	const completedDates = Array.isArray(task.complete_instances) ? task.complete_instances : [];
	return completedDates.includes(dateStr) ? completedStatus : task.status || "open";
}

export function shouldShowRecurringTaskOnDate(task: RecurringTaskLike, targetDate: Date): boolean {
	if (!task.recurrence) return true;
	return isDueByRRule(task, targetDate);
}

export function getRecurringTaskCompletionText(
	task: Pick<RecurringTaskLike, "recurrence" | "complete_instances">,
	targetDate: Date
): string {
	if (!task.recurrence) return "";
	const dateStr = formatDateForStorage(targetDate);
	const isCompleted = task.complete_instances?.includes(dateStr) || false;
	return isCompleted ? "Completed for this date" : "Not completed for this date";
}

export function shouldUseRecurringTaskUI(task: Pick<RecurringTaskLike, "recurrence">): boolean {
	return !!task.recurrence;
}

export function generateRecurringInstances(
	task: Pick<RecurringTaskLike, "title" | "recurrence" | "scheduled" | "dateCreated">,
	startDate: Date,
	endDate: Date
): Date[] {
	if (!task.recurrence || typeof task.recurrence !== "string") return [];

	try {
		const rule = createRRule(task);
		if (!rule) return [];
		const utcStartDate = new Date(
			Date.UTC(
				startDate.getUTCFullYear(),
				startDate.getUTCMonth(),
				startDate.getUTCDate(),
				0,
				0,
				0,
				0
			)
		);
		const utcEndDate = new Date(
			Date.UTC(
				endDate.getUTCFullYear(),
				endDate.getUTCMonth(),
				endDate.getUTCDate(),
				23,
				59,
				59,
				999
			)
		);
		return rule.between(utcStartDate, utcEndDate, true);
	} catch {
		const instances: Date[] = [];
		const current = new Date(startDate);
		while (current <= endDate) {
			if (isDueByRRule(task, current)) {
				instances.push(new Date(current));
			}
			current.setUTCDate(current.getUTCDate() + 1);
		}
		return instances;
	}
}

export function getFiniteRecurringInstanceCount(
	task: Pick<RecurringTaskLike, "title" | "recurrence" | "scheduled" | "dateCreated">
): number | null {
	if (!task.recurrence || typeof task.recurrence !== "string") return null;
	const countMatch = task.recurrence.match(/(?:^|;)COUNT=(\d+)(?:;|$)/);
	if (countMatch) {
		const count = Number.parseInt(countMatch[1], 10);
		return Number.isFinite(count) && count > 0 ? count : null;
	}
	if (!/(?:^|;)UNTIL=/.test(task.recurrence)) return null;

	try {
		const dtstart = getRRuleDtstart(task);
		const until = parseUntilFromRecurrence(task.recurrence);
		if (!dtstart || !until || until < dtstart) return null;
		const instances = generateRecurringInstances(task, dtstart, until);
		if (instances.length >= MAX_FINITE_INSTANCE_COUNT) return null;
		return instances.length > 0 ? instances.length : null;
	} catch {
		return null;
	}
}

export function getNextUncompletedOccurrence(
	task: RecurringTaskLike,
	context: RecurrenceDateContext = {}
): Date | null {
	if (!task.recurrence) return null;
	return (task.recurrence_anchor || "scheduled") === "completion"
		? getNextCompletionBasedOccurrence(task, context)
		: getNextScheduledBasedOccurrence(task, context);
}

export function updateToNextScheduledOccurrence(
	task: Pick<
		RecurringTaskLike,
		| "title"
		| "recurrence"
		| "scheduled"
		| "due"
		| "dateCreated"
		| "recurrence_anchor"
		| "complete_instances"
		| "skipped_instances"
	>,
	maintainDueOffset = true,
	context: RecurrenceDateContext = {}
): { scheduled: string | null; due: string | null } {
	const nextOccurrence = getNextUncompletedOccurrence(task, context);
	let nextScheduleStr: string | null = null;
	let nextDueStr: string | null = null;
	let nextDueDate: Date | null = null;

	if (nextOccurrence) {
		try {
			const originalScheduled = task.scheduled ? parseDateToUTC(task.scheduled) : null;
			const originalDue = task.due ? parseDateToUTC(task.due) : null;
			if (originalScheduled && originalDue) {
				const dueWouldBeBeforeNextSchedule =
					!maintainDueOffset && originalDue.getTime() < nextOccurrence.getTime();
				if (maintainDueOffset || dueWouldBeBeforeNextSchedule) {
					const offsetMs = originalDue.getTime() - originalScheduled.getTime();
					nextDueDate = new Date(nextOccurrence.getTime() + offsetMs);
				}
			}
		} catch {
			nextDueDate = null;
		}

		if (task.scheduled && task.scheduled.includes("T")) {
			nextScheduleStr = `${formatDateForStorage(nextOccurrence)}T${task.scheduled.split("T")[1]}`;
		} else {
			nextScheduleStr = formatDateForStorage(nextOccurrence);
		}

		if (nextDueDate && task.due && task.due.includes("T")) {
			nextDueStr = `${formatDateForStorage(nextDueDate)}T${task.due.split("T")[1]}`;
		} else if (nextDueDate) {
			nextDueStr = formatDateForStorage(nextDueDate);
		}
	}

	return { scheduled: nextScheduleStr, due: nextDueStr };
}

export function getRecurrenceDisplayText(recurrence: string): string {
	if (!recurrence) return "";
	try {
		if (!recurrence.includes("FREQ=")) {
			return "rrule";
		}
		const rruleString = recurrence.replace(/DTSTART:[^;]+;?/, "");
		return RRule.fromString(rruleString).toText();
	} catch {
		return "rrule";
	}
}

export function addDTSTARTToRecurrenceRule(
	task: Pick<RecurringTaskLike, "recurrence" | "scheduled" | "dateCreated">
): string | null {
	if (!task.recurrence || typeof task.recurrence !== "string") return null;
	if (task.recurrence.includes("DTSTART:")) return task.recurrence;
	const sourceDateString = task.scheduled || task.dateCreated;
	if (!sourceDateString) return null;
	return `DTSTART:${formatDtstartValue(sourceDateString)};${task.recurrence}`;
}

export function updateDTSTARTInRecurrenceRule(recurrence: string, dateStr: string): string | null {
	if (!recurrence || typeof recurrence !== "string") return null;
	const dtstartValue = formatDtstartValue(dateStr);
	if (recurrence.includes("DTSTART:")) {
		return recurrence.replace(/DTSTART:[^;]+;?/, `DTSTART:${dtstartValue};`);
	}
	return `DTSTART:${dtstartValue};${recurrence}`;
}

export function addDTSTARTToRecurrenceRuleWithDraggedTime(
	task: Pick<RecurringTaskLike, "recurrence" | "scheduled" | "dateCreated">,
	draggedStart: Date,
	allDay: boolean
): string | null {
	if (!task.recurrence || typeof task.recurrence !== "string") return null;
	if (task.recurrence.includes("DTSTART:")) return task.recurrence;
	const sourceDateString = task.scheduled || task.dateCreated;
	if (!sourceDateString) return null;

	if (allDay) {
		const sourceDate = parseDateToUTC(sourceDateString);
		return `DTSTART:${formatDtstartDate(sourceDate)};${task.recurrence}`;
	}

	const sourceDate = parseDateToUTC(sourceDateString);
	const year = sourceDate.getUTCFullYear();
	const month = String(sourceDate.getUTCMonth() + 1).padStart(2, "0");
	const day = String(sourceDate.getUTCDate()).padStart(2, "0");
	const hours = String(draggedStart.getHours()).padStart(2, "0");
	const minutes = String(draggedStart.getMinutes()).padStart(2, "0");
	return `DTSTART:${year}${month}${day}T${hours}${minutes}00Z;${task.recurrence}`;
}

export function completeRecurringTask(
	input: RecurrenceCompletionInput
): RecurrenceCompletionResult {
	const completionDate = input.completionDate;
	const completeInstances = Array.isArray(input.completeInstances) ? [...input.completeInstances] : [];
	const skippedInstances = Array.isArray(input.skippedInstances) ? [...input.skippedInstances] : [];

	if (!completeInstances.includes(completionDate)) {
		completeInstances.push(completionDate);
	}
	const nextSkippedInstances = skippedInstances.filter((date) => date !== completionDate);

	const schedule = recalculateRecurringScheduleInternal({
		recurrence: input.recurrence,
		recurrenceAnchor: input.recurrenceAnchor,
		scheduled: input.scheduled,
		due: input.due,
		dateCreated: input.dateCreated,
		completeInstances,
		skippedInstances: nextSkippedInstances,
		referenceDate: completionDate,
		completionDateForAnchor: completionDate,
	});

	return {
		updatedRecurrence: schedule.updatedRecurrence,
		nextScheduled: schedule.nextScheduled,
		nextDue: schedule.nextDue,
		completeInstances,
		skippedInstances: nextSkippedInstances,
	};
}

export function recalculateRecurringSchedule(
	input: RecurrenceScheduleInput
): RecurrenceScheduleResult {
	return recalculateRecurringScheduleInternal(input);
}

export function getRecurringTaskActionDate(task: Pick<TaskInfo, "recurrence_anchor" | "scheduled">, date?: Date): Date {
	if (date) return date;
	if (task.recurrence_anchor !== "completion" && task.scheduled) {
		return parseDateToUTC(getDatePart(task.scheduled));
	}
	const todayLocal = getTodayLocal();
	return new Date(Date.UTC(todayLocal.getFullYear(), todayLocal.getMonth(), todayLocal.getDate()));
}

function createRRule(
	task: Pick<RecurringTaskLike, "recurrence" | "scheduled" | "dateCreated">
): RRuleInstance | null {
	if (!task.recurrence || typeof task.recurrence !== "string") return null;
	const dtstart = getRRuleDtstart(task);
	if (!dtstart) return null;
	const rruleString = task.recurrence.replace(/DTSTART:[^;]+;?/, "").replace(/^;/, "").trim();
	const rruleOptions = RRule.parseString(rruleString);
	rruleOptions.dtstart = dtstart;
	return new RRule(rruleOptions);
}

function getRRuleDtstart(
	task: Pick<RecurringTaskLike, "recurrence" | "scheduled" | "dateCreated">
): Date | null {
	if (!task.recurrence) return null;
	return (
		parseDtstartFromRecurrence(task.recurrence) ||
		(task.scheduled ? createUTCDateForRRule(task.scheduled) : null) ||
		(task.dateCreated ? createUTCDateForRRule(task.dateCreated) : null)
	);
}

function parseDtstartFromRecurrence(recurrence: string): Date | null {
	const match = recurrence.match(/DTSTART:(\d{8}(?:T\d{6}Z?)?)/);
	if (!match) return null;
	return parseRRuleDateValue(match[1], false);
}

function parseUntilFromRecurrence(recurrence: string): Date | null {
	const match = recurrence.match(/(?:^|;)UNTIL=(\d{8}(?:T\d{6}Z?)?)(?:;|$)/);
	if (!match) return null;
	return parseRRuleDateValue(match[1], true);
}

function parseRRuleDateValue(value: string, endOfDayForDateOnly: boolean): Date {
	const year = Number(value.slice(0, 4));
	const month = Number(value.slice(4, 6)) - 1;
	const day = Number(value.slice(6, 8));
	if (value.length === 8) {
		return endOfDayForDateOnly
			? new Date(Date.UTC(year, month, day, 23, 59, 59, 999))
			: new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
	}
	const hour = Number(value.slice(9, 11)) || 0;
	const minute = Number(value.slice(11, 13)) || 0;
	const second = Number(value.slice(13, 15)) || 0;
	return new Date(Date.UTC(year, month, day, hour, minute, second, 0));
}

function parseIntervalFromRecurrence(recurrence: string): number {
	const match = recurrence.match(/INTERVAL=(\d+)/);
	return match ? Number.parseInt(match[1], 10) : 1;
}

function getLookAheadDays(recurrence: string): number {
	const interval = parseIntervalFromRecurrence(recurrence);
	if (recurrence.includes("FREQ=DAILY")) return Math.max(30, interval * 2);
	if (recurrence.includes("FREQ=WEEKLY")) return Math.max(90, interval * 7 * 2);
	if (recurrence.includes("FREQ=MONTHLY")) return Math.max(400, interval * 31 * 2);
	if (recurrence.includes("FREQ=YEARLY")) return Math.max(800, interval * 366 * 2);
	return 365;
}

function formatDtstartValue(dateStr: string): string {
	if (hasTimeComponent(dateStr)) {
		const dateTime = parseDateToLocal(dateStr);
		const year = dateTime.getFullYear();
		const month = String(dateTime.getMonth() + 1).padStart(2, "0");
		const day = String(dateTime.getDate()).padStart(2, "0");
		const hours = String(dateTime.getHours()).padStart(2, "0");
		const minutes = String(dateTime.getMinutes()).padStart(2, "0");
		const seconds = String(dateTime.getSeconds()).padStart(2, "0");
		return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
	}
	return formatDtstartDate(parseDateToUTC(dateStr));
}

function formatDtstartDate(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${year}${month}${day}`;
}

function getNextScheduledBasedOccurrence(
	task: RecurringTaskLike,
	context: RecurrenceDateContext
): Date | null {
	if (!task.recurrence) return null;
	const today = parseDateToUTC(context.today || getTodayString());
	const lookAheadDays = getLookAheadDays(task.recurrence);
	let startDate = today;
	const dtstart = parseDtstartFromRecurrence(task.recurrence);
	if (dtstart && dtstart < today) {
		startDate = dtstart;
	}
	const endDate = new Date(today.getTime() + lookAheadDays * 24 * 60 * 60 * 1000);
	const occurrences = generateRecurringInstances(task, startDate, endDate);
	const processedInstances = new Set([...(task.complete_instances || []), ...(task.skipped_instances || [])]);
	for (const occurrence of occurrences) {
		const occurrenceStr = formatDateForStorage(occurrence);
		if (!processedInstances.has(occurrenceStr) && occurrence >= today) {
			return occurrence;
		}
	}
	return null;
}

function getNextCompletionBasedOccurrence(
	task: RecurringTaskLike,
	context: RecurrenceDateContext
): Date | null {
	if (!task.recurrence || typeof task.recurrence !== "string") return null;
	const today = parseDateToUTC(context.today || getTodayString());
	const lookAheadDays = getLookAheadDays(task.recurrence);
	const dtstartDate = parseDtstartFromRecurrence(task.recurrence);
	const startDate = dtstartDate || today;
	const endDate = new Date(startDate.getTime() + lookAheadDays * 24 * 60 * 60 * 1000);
	const occurrences = generateRecurringInstances(task, startDate, endDate);
	const skippedInstances = new Set(task.skipped_instances || []);
	const dtstartTime = dtstartDate ? dtstartDate.getTime() : 0;
	for (const occurrence of occurrences) {
		const occurrenceStr = formatDateForStorage(occurrence);
		if (occurrence.getTime() > dtstartTime && occurrence >= today && !skippedInstances.has(occurrenceStr)) {
			return occurrence;
		}
	}
	return null;
}

interface RecurrenceScheduleInternalInput extends RecurrenceScheduleInput {
	completionDateForAnchor?: string;
}

function recalculateRecurringScheduleInternal(
	input: RecurrenceScheduleInternalInput
): RecurrenceScheduleResult {
	const anchor = input.recurrenceAnchor === "completion" ? "completion" : "scheduled";
	const sourceDate = input.scheduled || input.dateCreated || input.referenceDate;
	let updatedRecurrence = input.recurrence;

	if (anchor === "completion") {
		updatedRecurrence =
			updateDTSTARTInRecurrenceRule(
				updatedRecurrence,
				input.completionDateForAnchor || input.referenceDate
			) || updatedRecurrence;
	} else {
		updatedRecurrence =
			addDTSTARTToRecurrenceRule({ recurrence: updatedRecurrence, scheduled: sourceDate }) ||
			updatedRecurrence;
	}

	const referenceDate =
		(anchor === "scheduled" ? parseDateString(input.scheduled) : null) ||
		parseDateString(input.referenceDate);
	if (!referenceDate) {
		return { updatedRecurrence, nextScheduled: null, nextDue: null };
	}

	const completionDay = parseDateString(input.referenceDate);
	const completeInstances = Array.isArray(input.completeInstances) ? input.completeInstances : [];
	const skippedInstances = Array.isArray(input.skippedInstances) ? input.skippedInstances : [];
	const processedDates = new Set([
		...completeInstances,
		...skippedInstances,
		formatDateForStorage(referenceDate),
	]);
	let nextOccurrence = getNextOccurrenceDate(updatedRecurrence, sourceDate, referenceDate, true);

	if (completionDay) {
		let guard = 0;
		while (nextOccurrence && nextOccurrence.getTime() < completionDay.getTime() && guard < 1000) {
			nextOccurrence = getNextOccurrenceDate(updatedRecurrence, sourceDate, nextOccurrence, false);
			guard++;
		}
	}

	let processedGuard = 0;
	while (nextOccurrence && processedGuard < 1000) {
		const dateStr = formatDateForStorage(nextOccurrence);
		if (!processedDates.has(dateStr)) break;
		nextOccurrence = getNextOccurrenceDate(updatedRecurrence, sourceDate, nextOccurrence, false);
		processedGuard++;
	}

	if (!nextOccurrence) {
		return { updatedRecurrence, nextScheduled: null, nextDue: null };
	}

	return {
		updatedRecurrence,
		nextScheduled: formatLikeExisting(input.scheduled, nextOccurrence),
		nextDue: computeNextDue(input, nextOccurrence),
	};
}

function getNextOccurrenceDate(
	recurrence: string,
	sourceDate: string,
	afterDate: Date,
	inclusive: boolean
): Date | null {
	const rule = buildRRuleFromRecurrence(recurrence, sourceDate);
	return rule ? rule.after(afterDate, inclusive) : null;
}

function buildRRuleFromRecurrence(recurrence: string, sourceDate: string): RRuleInstance | null {
	try {
		const rruleString = recurrence.replace(/DTSTART:[^;]+;?/, "").replace(/^;/, "").trim();
		if (!rruleString.includes("FREQ=")) return null;
		const options = RRule.parseString(rruleString);
		const dtstart = parseDtstartFromRecurrence(recurrence) || parseDateString(sourceDate);
		if (dtstart) options.dtstart = dtstart;
		return new RRule(options);
	} catch {
		return null;
	}
}

function computeNextDue(
	input: { due?: string; scheduled?: string },
	nextScheduledDate: Date
): string | null {
	if (!input.due || !input.scheduled) return null;
	const originalDue = parseDateString(input.due);
	const originalScheduled = parseDateString(input.scheduled);
	if (!originalDue || !originalScheduled) return null;
	const offsetMs = originalDue.getTime() - originalScheduled.getTime();
	return formatLikeExisting(input.due, new Date(nextScheduledDate.getTime() + offsetMs));
}

function parseDateString(dateStr: string | undefined): Date | null {
	if (!dateStr) return null;
	try {
		return parseDateToUTC(dateStr);
	} catch {
		return null;
	}
}

function formatLikeExisting(existingValue: string | undefined, date: Date): string {
	const datePart = formatDateForStorage(date);
	if (existingValue && existingValue.includes("T")) {
		return `${datePart}T${existingValue.split("T")[1]}`;
	}
	return datePart;
}
