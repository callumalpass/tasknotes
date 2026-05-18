/* eslint-disable @typescript-eslint/no-non-null-assertion -- FullCalendar callbacks provide checked DOM references after mount. */
/**
 * Shared Calendar Core Logic
 *
 * This module contains shared calendar event generation logic used by both:
 * - AdvancedCalendarView (ItemView)
 * - TaskNotes Calendar Bases View (Bases integration)
 */

import { format } from "date-fns";
import TaskNotesPlugin from "../main";
import { TaskInfo, ICSEvent, TimeBlock, EVENT_DATA_CHANGED } from "../types";
import {
	hasTimeComponent,
	getDatePart,
	getTimePart,
	parseDateToLocal,
	formatDateForStorage,
	parseDateToUTC,
	getTodayLocal,
} from "../utils/dateUtils";
import {
	generateRecurringInstances,
	updateTimeblockInDailyNote,
	copyTimeblockToDailyNote,
	addDTSTARTToRecurrenceRuleWithDraggedTime,
} from "../utils/helpers";
import { Notice, TFile } from "obsidian";
import {
	getAllDailyNotes,
	getDailyNote,
	appHasDailyNotesPluginLoaded,
	createDailyNote,
} from "obsidian-daily-notes-interface";
import {
	TimeblockCreationModal,
	type TimeblockCreationResult,
} from "../modals/TimeblockCreationModal";
import { openTaskSelector } from "../modals/TaskSelectorWithCreateModal";
import { TimeblockInfoModal } from "../modals/TimeblockInfoModal";
import {
	colorWithAlpha,
	isCssVariableColor,
	normalizeThemeColor,
} from "../utils/themeColors";

const MIN_EXTERNAL_TIMED_EVENT_DURATION_MS = 1;

export interface CalendarEvent {
	id: string;
	title: string;
	start: string;
	end?: string;
	allDay: boolean;
	backgroundColor?: string;
	borderColor?: string;
	textColor?: string;
	editable?: boolean;
	extendedProps: {
		taskInfo?: TaskInfo;
		icsEvent?: ICSEvent;
		timeblock?: TimeBlock;
		eventType:
			| "scheduled"
			| "due"
			| "scheduledToDueSpan"
			| "timeEntry"
			| "recurring"
			| "ics"
			| "timeblock"
			| "property-based";
		filePath?: string; // For property-based events
		file?: unknown; // For property-based events
		basesEntry?: unknown; // For property-based events - full Bases entry with getValue()
		isCompleted?: boolean;
		isSkipped?: boolean;
		isRecurringInstance?: boolean;
		isNextScheduledOccurrence?: boolean;
		isPatternInstance?: boolean;
		instanceDate?: string;
		recurringTemplateTime?: string;
		subscriptionName?: string;
		isGoogleCalendar?: boolean; // For Google Calendar events
		isMicrosoftCalendar?: boolean; // For Microsoft Calendar events
		timeEntryIndex?: number;
		originalDate?: string; // For timeblock events - tracks original date for move operations
		relatedNoteCount?: number; // For calendar events linked to notes/tasks
	};
}

export interface ICSEventRenderOptions {
	relatedNoteCount?: number;
}

type CalendarEventLike = {
	start?: Date | null;
	end?: Date | null;
	allDay?: boolean;
	extendedProps?: Record<string, unknown> & Partial<CalendarEvent["extendedProps"]>;
};

type CalendarEventArgLike = {
	event?: CalendarEventLike;
	start?: Date;
	extendedProps?: Partial<CalendarEvent["extendedProps"]>;
};

type CalendarMutationInfo = {
	event: CalendarEventLike;
	revert: () => void;
};

type TimeblockCopyModifierEvent = Pick<MouseEvent, "altKey" | "ctrlKey" | "metaKey">;

type FrontmatterWithTimeblocks = {
	timeblocks?: unknown[];
};

type ObsidianMoment = import("moment").Moment;

type WindowWithMoment = Window & {
	moment(input?: string | Date): ObsidianMoment;
};

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function isTimeblockCopyModifierPressed(
	event: TimeblockCopyModifierEvent | undefined
): boolean {
	return Boolean(event?.ctrlKey || event?.metaKey || event?.altKey);
}

function getWindowMoment(input?: string | Date): ObsidianMoment {
	return (window as unknown as WindowWithMoment).moment(input);
}

export interface CalendarEventGenerationOptions {
	showScheduled?: boolean;
	showDue?: boolean;
	showScheduledToDueSpan?: boolean;
	showTimeEntries?: boolean;
	showRecurring?: boolean;
	showCompletedRecurringInstances?: boolean;
	showSkippedRecurringInstances?: boolean;
	showICSEvents?: boolean;
	showTimeblocks?: boolean;
	visibleStart?: Date;
	visibleEnd?: Date;
}

interface RecurringInstanceVisibilityOptions {
	showCompletedRecurringInstances?: boolean;
	showSkippedRecurringInstances?: boolean;
}

/**
 * Convert a configured color to a translucent calendar color.
 * Theme colors are returned as color-mix() values so Obsidian themes can control them.
 */
export function hexToRgba(hex: string, alpha: number): string {
	return colorWithAlpha(hex, alpha);
}

/**
 * Check if the app is in dark mode
 * Uses activeDocument to support pop-out windows
 */
export function isDarkMode(): boolean {
	return activeDocument.body.classList.contains("theme-dark");
}

/**
 * Get appropriate text color for event based on theme
 * Returns dark text for light mode, light text for dark mode
 */
export function getEventTextColor(useThemeColor = false): string {
	if (useThemeColor) {
		return isDarkMode() ? "#e8eaed" : "#202124"; // Light text in dark mode, dark text in light mode
	}
	// For non-themed events, return empty (use border color)
	return "";
}

/**
 * Check if a color string is a CSS variable
 */
export function isCssVariable(color: string): boolean {
	return isCssVariableColor(color);
}

/**
 * Generate tooltip text for a task event
 */
export function generateTaskTooltip(task: TaskInfo, plugin: TaskNotesPlugin): string {
	let tooltipText = task.title;

	if (task.projects && task.projects.length > 0) {
		tooltipText += `\nProject: ${task.projects[0]}`;
	}

	if (task.priority) {
		const priorityConfig = plugin.priorityManager.getPriorityConfig(task.priority);
		tooltipText += `\nPriority: ${priorityConfig?.label || task.priority}`;
	}

	if (task.status) {
		const statusConfig = plugin.statusManager.getStatusConfig(task.status);
		tooltipText += `\nStatus: ${statusConfig?.label || task.status}`;
	}

	if (task.timeEstimate) {
		const hours = Math.floor(task.timeEstimate / 60);
		const minutes = task.timeEstimate % 60;
		tooltipText += `\nEstimate: ${hours > 0 ? `${hours}h ` : ""}${minutes}m`;
	}

	return tooltipText;
}

/**
 * Apply recurring task styling to calendar event element
 */
export function applyRecurringTaskStyling(
	element: HTMLElement,
	extendedProps: {
		isNextScheduledOccurrence?: boolean;
		isPatternInstance?: boolean;
		isRecurringInstance?: boolean;
		isCompleted?: boolean;
	}
): void {
	const {
		isNextScheduledOccurrence = false,
		isPatternInstance = false,
		isRecurringInstance = false,
		isCompleted = false,
	} = extendedProps;

	if (isNextScheduledOccurrence) {
		// Next scheduled occurrence: Normal task styling (solid border, full opacity)
		element.classList.remove("tn-static-border-style-dashed-12296c91");
		element.classList.add("tn-static-border-style-solid-11080b69");
		element.classList.add("tn-static-border-width-2px-a1222254");
		element.setAttribute("data-next-scheduled", "true");
		element.classList.add("fc-next-scheduled-event");

		// Apply dimmed appearance for completed instances
		if (isCompleted) {
			element.classList.remove(
				"tn-static-opacity-0-8d919cb5",
				"tn-static-opacity-1-c6e7979d"
			);
			element.classList.add("tn-static-opacity-0-6-d95b59ac");
		}
	} else if (isPatternInstance) {
		// Pattern occurrences: Recurring preview styling (dashed border, reduced opacity)
		element.classList.remove("tn-static-border-style-solid-11080b69");
		element.classList.add("tn-static-border-style-dashed-12296c91");
		element.classList.add("tn-static-border-width-2px-a1222254");
		element.style.opacity = isCompleted ? "0.4" : "0.7"; // Reduced opacity for pattern instances

		element.setAttribute("data-pattern-instance", "true");
		element.classList.add("fc-pattern-instance-event");
	} else if (isRecurringInstance) {
		// Legacy recurring instances (for backward compatibility)
		element.classList.remove("tn-static-border-style-solid-11080b69");
		element.classList.add("tn-static-border-style-dashed-12296c91");
		element.classList.add("tn-static-border-width-2px-a1222254");

		element.setAttribute("data-recurring", "true");
		element.classList.add("fc-recurring-event");

		// Apply dimmed appearance for completed instances
		if (isCompleted) {
			element.classList.remove(
				"tn-static-opacity-0-8d919cb5",
				"tn-static-opacity-1-c6e7979d"
			);
			element.classList.add("tn-static-opacity-0-6-d95b59ac");
		}
	}

	// Apply strikethrough styling for completed tasks
	if (isCompleted) {
		const titleElement = element.querySelector(".fc-event-title, .fc-event-title-container");
		if (titleElement) {
			(titleElement as HTMLElement).classList.remove(
				"tn-static-text-decoration-none-80d654f9"
			);
			(titleElement as HTMLElement).classList.add(
				"tn-static-text-decoration-line-through-7059a4e5"
			);
		} else {
			// Fallback: apply to the entire event element
			element.classList.remove("tn-static-text-decoration-none-80d654f9");
			element.classList.add("tn-static-text-decoration-line-through-7059a4e5");
		}
		element.classList.add("fc-completed-event");
	}
}

/**
 * Handle dropping a pattern instance (updates DTSTART in RRULE)
 */
export async function handlePatternInstanceDrop(
	taskInfo: TaskInfo,
	newStart: Date,
	allDay: boolean,
	plugin: TaskNotesPlugin
): Promise<void> {
	try {
		if (!taskInfo.recurrence || typeof taskInfo.recurrence !== "string") {
			throw new Error("Task does not have a valid RRULE string");
		}

		// Check if DTSTART already exists
		const currentDtstartMatch = taskInfo.recurrence.match(/DTSTART:(\d{8}(?:T\d{6}Z?)?)/);
		let updatedRRule: string;

		if (!currentDtstartMatch) {
			// No DTSTART exists - add it using the drag interaction
			const ruleWithDTSTART = addDTSTARTToRecurrenceRuleWithDraggedTime(
				taskInfo,
				newStart,
				allDay
			);
			if (!ruleWithDTSTART) {
				throw new Error("Failed to add DTSTART to recurrence rule");
			}
			updatedRRule = ruleWithDTSTART;
			new Notice(
				"Added time information to recurring pattern. All future instances now appear at this time."
			);
		} else {
			// DTSTART exists - update the time component
			const currentDtstart = currentDtstartMatch[1];
			let newDTSTART: string;

			if (allDay) {
				// For all-day, remove time component entirely (keep original date)
				newDTSTART = currentDtstart.slice(0, 8); // Keep YYYYMMDD only
			} else {
				// Update only the time component, preserve the original date
				const originalDate = currentDtstart.slice(0, 8); // YYYYMMDD
				const hours = String(newStart.getHours()).padStart(2, "0");
				const minutes = String(newStart.getMinutes()).padStart(2, "0");
				newDTSTART = `${originalDate}T${hours}${minutes}00Z`;
			}

			// Update DTSTART in RRULE string
			updatedRRule = taskInfo.recurrence.replace(/DTSTART:[^;]+/, `DTSTART:${newDTSTART}`);
			new Notice(
				"Updated recurring pattern time. All future instances now appear at this time."
			);
		}

		// Update the recurrence pattern
		await plugin.taskService.updateProperty(taskInfo, "recurrence", updatedRRule);

		// Note: Don't update scheduled date - it should remain independent
		// Only the pattern timing changes, not the next occurrence timing

		// The refresh will happen automatically via EVENT_TASK_UPDATED listener
	} catch (error) {
		console.error("Error updating pattern instance time:", error);
		throw error;
	}
}

/**
 * Handle dropping a recurring task event (next scheduled, pattern, or legacy)
 */
export async function handleRecurringTaskDrop(
	dropInfo: CalendarMutationInfo,
	taskInfo: TaskInfo,
	plugin: TaskNotesPlugin
): Promise<void> {
	const { isRecurringInstance, isNextScheduledOccurrence, isPatternInstance } =
		dropInfo.event.extendedProps ?? {};

	const newStart = dropInfo.event.start;
	if (!newStart) {
		dropInfo.revert();
		return;
	}
	const allDay = dropInfo.event.allDay ?? false;

	if (isNextScheduledOccurrence) {
		// Dragging Next Scheduled Occurrence: Updates only task.scheduled (manual reschedule)
		let newDateString: string;
		if (allDay) {
			newDateString = format(newStart, "yyyy-MM-dd");
		} else {
			newDateString = format(newStart, "yyyy-MM-dd'T'HH:mm");
		}

		// Update the scheduled field directly (manual reschedule of next occurrence)
		await plugin.taskService.updateProperty(taskInfo, "scheduled", newDateString);
		new Notice("Rescheduled next occurrence. This does not change the recurrence pattern.");
	} else if (isPatternInstance) {
		// Dragging Pattern Instances: Updates DTSTART in RRULE and recalculates task.scheduled
		await handlePatternInstanceDrop(taskInfo, newStart, allDay, plugin);
	} else if (isRecurringInstance) {
		// Legacy support: Handle old-style recurring instances (time changes only)
		const originalDate = getDatePart(taskInfo.scheduled!);
		let updatedScheduled: string;

		if (allDay) {
			updatedScheduled = originalDate;
			new Notice("Updated recurring task to all-day. This affects all future instances.");
		} else {
			const newTime = format(newStart, "HH:mm");
			updatedScheduled = `${originalDate}T${newTime}`;
			new Notice(
				`Updated recurring task time to ${newTime}. This affects all future instances.`
			);
		}

		await plugin.taskService.updateProperty(taskInfo, "scheduled", updatedScheduled);
	}
}

/**
 * Get target date for calendar event context menu
 * Uses the same UTC-anchored logic as AdvancedCalendarView
 */
export function getTargetDateForEvent(eventArg: unknown): Date {
	// Extract from eventArg.event if it's an event mount arg, or directly if it's the event
	const eventContainer = eventArg as CalendarEventArgLike;
	const event = eventContainer.event || eventContainer;
	const extendedProps = event.extendedProps || {};
	const { isRecurringInstance, isNextScheduledOccurrence, isPatternInstance, instanceDate } =
		extendedProps;

	// For recurring tasks, use UTC anchor for instance date (matches AdvancedCalendarView)
	if ((isRecurringInstance || isNextScheduledOccurrence || isPatternInstance) && instanceDate) {
		// For all recurring-related events, use UTC anchor for instance date
		return parseDateToUTC(instanceDate);
	}

	// For regular events, convert FullCalendar date to UTC anchor
	const eventDate = event.start;
	if (eventDate) {
		// Convert FullCalendar Date to date string preserving local date
		const dateStr = format(eventDate, "yyyy-MM-dd");
		return parseDateToUTC(dateStr);
	}

	// Fallback to today
	return getTodayLocal();
}

/**
 * Calculate all-day end date based on time estimate
 */
export function calculateAllDayEndDate(
	startDate: string,
	timeEstimate?: number
): string | undefined {
	if (!timeEstimate) return undefined;

	// For all-day events, add days based on time estimate (24 hours = 1 day)
	const days = Math.ceil(timeEstimate / (24 * 60));
	const start = parseDateToUTC(startDate);
	const end = new Date(
		Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + days)
	);
	return formatDateForStorage(end);
}

export function shiftTaskDatePreservingTime(dateValue: string, timeDiffMs: number): string {
	const oldDate = parseDateToLocal(dateValue);
	const shiftedDate = new Date(oldDate.getTime() + timeDiffMs);

	return hasTimeComponent(dateValue)
		? format(shiftedDate, "yyyy-MM-dd'T'HH:mm")
		: format(shiftedDate, "yyyy-MM-dd");
}

/**
 * Create scheduled event from task
 */
export function createScheduledEvent(
	task: TaskInfo,
	plugin: TaskNotesPlugin
): CalendarEvent | null {
	if (!task.scheduled) return null;

	const hasTime = hasTimeComponent(task.scheduled);
	const startDate = task.scheduled;

	let endDate: string | undefined;
	if (hasTime && task.timeEstimate) {
		const start = parseDateToLocal(startDate);
		const end = new Date(start.getTime() + task.timeEstimate * 60 * 1000);
		endDate = format(end, "yyyy-MM-dd'T'HH:mm");
	} else if (!hasTime) {
		endDate = calculateAllDayEndDate(startDate, task.timeEstimate);
	}

	const priorityConfig = plugin.priorityManager.getPriorityConfig(task.priority);
	const borderColor = normalizeThemeColor(priorityConfig?.color, "var(--color-accent)");
	const isCompleted = plugin.statusManager.isCompletedStatus(task.status);
	// Use theme-appropriate text color when border is a CSS variable
	const textColor = isCssVariable(borderColor) ? getEventTextColor(true) : borderColor;

	return {
		id: `scheduled-${task.path}`,
		title: task.title,
		start: startDate,
		end: endDate,
		allDay: !hasTime,
		backgroundColor: "transparent",
		borderColor: borderColor,
		textColor: textColor,
		editable: true,
		extendedProps: {
			taskInfo: task,
			eventType: "scheduled",
			isCompleted: isCompleted,
		},
	};
}

/**
 * Create due event from task
 */
export function createDueEvent(task: TaskInfo, plugin: TaskNotesPlugin): CalendarEvent | null {
	if (!task.due) return null;

	const hasTime = hasTimeComponent(task.due);
	const startDate = task.due;

	let endDate: string | undefined;
	if (hasTime) {
		const start = parseDateToLocal(startDate);
		const end = new Date(start.getTime() + 30 * 60 * 1000);
		endDate = format(end, "yyyy-MM-dd'T'HH:mm");
	}

	const priorityConfig = plugin.priorityManager.getPriorityConfig(task.priority);
	const borderColor = normalizeThemeColor(priorityConfig?.color, "var(--color-orange)");
	const fadedBackground = hexToRgba(borderColor, 0.15);
	const isCompleted = plugin.statusManager.isCompletedStatus(task.status);
	// Use theme-appropriate text color when border is a CSS variable
	const textColor = isCssVariable(borderColor) ? getEventTextColor(true) : borderColor;

	return {
		id: `due-${task.path}`,
		title: task.title,
		start: startDate,
		end: endDate,
		allDay: !hasTime,
		backgroundColor: fadedBackground,
		borderColor: borderColor,
		textColor: textColor,
		editable: true,
		extendedProps: {
			taskInfo: task,
			eventType: "due",
			isCompleted: isCompleted,
		},
	};
}

/**
 * Create a date-only spanning event from scheduled date to due date.
 * Shows the task as a multi-day bar from when work starts to when it's due.
 */
function createAllDayScheduledToDueSpanEvent(
	task: TaskInfo,
	plugin: TaskNotesPlugin
): CalendarEvent | null {
	if (!task.scheduled || !task.due) return null;

	// Parse dates to compare them
	const scheduledDate = parseDateToLocal(task.scheduled);
	const dueDate = parseDateToLocal(task.due);

	// Skip if due is before or same as scheduled (no span to show)
	if (dueDate <= scheduledDate) return null;

	// For FullCalendar, the end date for all-day events is exclusive,
	// so we need to add one day to include the due date
	const endDateExclusive = new Date(dueDate);
	endDateExclusive.setDate(endDateExclusive.getDate() + 1);

	const priorityConfig = plugin.priorityManager.getPriorityConfig(task.priority);
	const borderColor = normalizeThemeColor(priorityConfig?.color, "var(--color-accent)");
	const fadedBackground = hexToRgba(borderColor, 0.2);
	const isCompleted = plugin.statusManager.isCompletedStatus(task.status);
	const textColor = isCssVariable(borderColor) ? getEventTextColor(true) : borderColor;

	return {
		id: `span-${task.path}`,
		title: task.title,
		start: format(scheduledDate, "yyyy-MM-dd"),
		end: format(endDateExclusive, "yyyy-MM-dd"),
		allDay: true,
		backgroundColor: fadedBackground,
		borderColor: borderColor,
		textColor: textColor,
		editable: true, // Span events can be dragged to shift both scheduled and due dates
		extendedProps: {
			taskInfo: task,
			eventType: "scheduledToDueSpan",
			isCompleted: isCompleted,
		},
	};
}

function isCalendarEventInVisibleRange(
	event: CalendarEvent,
	visibleStart?: Date,
	visibleEnd?: Date
): boolean {
	if (!visibleStart || !visibleEnd) return true;

	const eventStart = parseDateToLocal(event.start);
	const eventEnd = event.end ? parseDateToLocal(event.end) : eventStart;

	return (
		eventStart.getTime() < visibleEnd.getTime() &&
		eventEnd.getTime() >= visibleStart.getTime()
	);
}

function createTimedScheduledToDueSpanEvents(
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	visibleStart?: Date,
	visibleEnd?: Date
): CalendarEvent[] {
	if (!task.scheduled || !task.due) return [];

	const scheduledDate = parseDateToLocal(task.scheduled);
	const dueDate = parseDateToLocal(task.due);
	if (dueDate <= scheduledDate) return [];

	const scheduledTime = getTimePart(task.scheduled);
	if (!scheduledTime) return [];

	const [hours, minutes] = scheduledTime.split(":").map(Number);
	const firstDate = parseDateToLocal(getDatePart(task.scheduled));
	const lastDate = parseDateToLocal(getDatePart(task.due));

	const priorityConfig = plugin.priorityManager.getPriorityConfig(task.priority);
	const borderColor = normalizeThemeColor(priorityConfig?.color, "var(--color-accent)");
	const fadedBackground = hexToRgba(borderColor, 0.2);
	const isCompleted = plugin.statusManager.isCompletedStatus(task.status);
	const textColor = isCssVariable(borderColor) ? getEventTextColor(true) : borderColor;

	const events: CalendarEvent[] = [];
	for (
		const day = new Date(firstDate);
		day.getTime() <= lastDate.getTime();
		day.setDate(day.getDate() + 1)
	) {
		const start = new Date(day);
		start.setHours(hours, minutes, 0, 0);

		let end: string | undefined;
		if (task.timeEstimate) {
			const endDate = new Date(start.getTime() + task.timeEstimate * 60 * 1000);
			end = format(endDate, "yyyy-MM-dd'T'HH:mm");
		}

		const instanceDate = format(day, "yyyy-MM-dd");
		const event: CalendarEvent = {
			id: `span-${task.path}-${instanceDate}`,
			title: task.title,
			start: format(start, "yyyy-MM-dd'T'HH:mm"),
			end,
			allDay: false,
			backgroundColor: fadedBackground,
			borderColor: borderColor,
			textColor: textColor,
			editable: true,
			extendedProps: {
				taskInfo: task,
				eventType: "scheduledToDueSpan",
				isCompleted: isCompleted,
			},
		};

		if (isCalendarEventInVisibleRange(event, visibleStart, visibleEnd)) {
			events.push(event);
		}
	}

	return events;
}

export function createScheduledToDueSpanEvents(
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	visibleStart?: Date,
	visibleEnd?: Date
): CalendarEvent[] {
	if (!task.scheduled || !task.due) return [];

	if (hasTimeComponent(task.scheduled)) {
		return createTimedScheduledToDueSpanEvents(task, plugin, visibleStart, visibleEnd);
	}

	const spanEvent = createAllDayScheduledToDueSpanEvent(task, plugin);
	if (!spanEvent || !isCalendarEventInVisibleRange(spanEvent, visibleStart, visibleEnd)) {
		return [];
	}

	return [spanEvent];
}

export function createScheduledToDueSpanEvent(
	task: TaskInfo,
	plugin: TaskNotesPlugin
): CalendarEvent | null {
	return createScheduledToDueSpanEvents(task, plugin)[0] ?? null;
}

/**
 * Create time entry events from task
 */
export function createTimeEntryEvents(task: TaskInfo, plugin: TaskNotesPlugin): CalendarEvent[] {
	if (!task.timeEntries) return [];

	const isCompleted = plugin.statusManager.isCompletedStatus(task.status);

	return task.timeEntries
		.filter((entry) => entry.endTime)
		.map((entry, index) => ({
			id: `timeentry-${task.path}-${index}`,
			title: task.title,
			start: entry.startTime,
			end: entry.endTime!,
			allDay: false,
			// Colors are handled by CSS via data-event-type="timeEntry"
			editable: true, // Allow drag and resize
			extendedProps: {
				taskInfo: task,
				eventType: "timeEntry" as const,
				isCompleted: isCompleted,
				timeEntryIndex: index,
			},
		}));
}

/**
 * Create ICS calendar event (supports ICS subscriptions, Google Calendar, and Microsoft Calendar)
 */
export function createICSEvent(
	icsEvent: ICSEvent,
	plugin: TaskNotesPlugin,
	options: ICSEventRenderOptions = {}
): CalendarEvent | null {
	try {
		// Check if this is a Google Calendar or Microsoft Calendar event
		const isGoogleCalendar = icsEvent.subscriptionId.startsWith("google-");
		const isMicrosoftCalendar = icsEvent.subscriptionId.startsWith("microsoft-");

		let backgroundColor: string;
		let borderColor: string;
		let textColor: string;
		let subscriptionName: string;

		if (isGoogleCalendar) {
			// Google Calendar event - use event's color if available
			borderColor = icsEvent.color || "#4285F4"; // Default to Google Blue if no color
			backgroundColor = hexToRgba(borderColor, 0.2);
			textColor = getEventTextColor(true); // Use theme-appropriate text color
			subscriptionName = "Google Calendar";
		} else if (isMicrosoftCalendar) {
			// Microsoft Calendar event - use event's color if available
			borderColor = icsEvent.color || "#0078D4"; // Default to Microsoft Blue if no color
			backgroundColor = hexToRgba(borderColor, 0.2);
			textColor = getEventTextColor(true); // Use theme-appropriate text color
			subscriptionName = "Microsoft Calendar";
		} else {
			// ICS subscription event - use subscription settings
			const subscription = plugin.icsSubscriptionService
				?.getSubscriptions()
				.find((sub) => sub.id === icsEvent.subscriptionId);

			if (!subscription || !subscription.enabled) {
				return null;
			}

			borderColor = normalizeThemeColor(subscription.color, "#3788d8");
			backgroundColor = hexToRgba(borderColor, 0.2);
			textColor = isCssVariable(borderColor) ? getEventTextColor(true) : borderColor;
			subscriptionName = subscription.name;
		}

		const { start, end } = normalizeExternalTimedEventRange(
			icsEvent.start,
			icsEvent.end,
			icsEvent.allDay
		);

		return {
			id: icsEvent.id,
			title: icsEvent.title,
			start,
			end,
			allDay: icsEvent.allDay,
			backgroundColor: backgroundColor,
			borderColor: borderColor,
			textColor: textColor,
			editable: isGoogleCalendar || isMicrosoftCalendar, // Google and Microsoft Calendar events are editable, ICS subscriptions are not
			extendedProps: {
				icsEvent: icsEvent,
				eventType: "ics",
				subscriptionName: subscriptionName,
				isGoogleCalendar: isGoogleCalendar,
				isMicrosoftCalendar: isMicrosoftCalendar,
				relatedNoteCount:
					options.relatedNoteCount && options.relatedNoteCount > 0
						? options.relatedNoteCount
						: undefined,
			},
		};
	} catch (error) {
		console.error("Error creating ICS event:", error);
		return null;
	}
}

/**
 * FullCalendar list views can render a timed external event under multiple day
 * headers when the provider supplies a true zero-duration range (end === start).
 * Clamp those point-in-time external events to a minimal positive duration
 * before handing them to FullCalendar, while preserving the raw provider event
 * unchanged in extendedProps for display and debugging.
 */
function normalizeExternalTimedEventRange(
	start: string,
	end: string | undefined,
	allDay: boolean
): { start: string; end?: string } {
	if (allDay || !end) {
		return { start, end };
	}

	const startDate = new Date(start);
	const endDate = new Date(end);

	if (
		Number.isNaN(startDate.getTime()) ||
		Number.isNaN(endDate.getTime()) ||
		endDate.getTime() !== startDate.getTime()
	) {
		return { start, end };
	}

	const normalizedEnd = new Date(endDate.getTime() + MIN_EXTERNAL_TIMED_EVENT_DURATION_MS);
	return {
		start,
		end: formatExternalTimedEventEnd(normalizedEnd, end),
	};
}

function formatExternalTimedEventEnd(date: Date, originalEnd: string): string {
	if (/Z$/i.test(originalEnd)) {
		return date.toISOString();
	}

	const offsetMatch = originalEnd.match(/([+-])(\d{2}):?(\d{2})$/);
	if (offsetMatch) {
		const [, sign, hours, minutes] = offsetMatch;
		const offsetMinutes = Number(hours) * 60 + Number(minutes);
		const offsetMs = offsetMinutes * 60 * 1000 * (sign === "+" ? 1 : -1);
		const shifted = new Date(date.getTime() + offsetMs);
		const pad = (value: number, length = 2) => String(value).padStart(length, "0");
		const datePart = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
		const timePart = `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}.${pad(shifted.getUTCMilliseconds(), 3)}`;
		return `${datePart}T${timePart}${sign}${hours}:${minutes}`;
	}

	return format(date, "yyyy-MM-dd'T'HH:mm:ss.SSS");
}

/**
 * Get recurring time from task recurrence rule
 */
export function getRecurringTime(task: TaskInfo): string {
	if (task.recurrence && typeof task.recurrence === "string") {
		const dtstartMatch = task.recurrence.match(/DTSTART:(\d{8}(?:T\d{6}Z?)?)/);
		if (dtstartMatch && dtstartMatch[1].includes("T")) {
			const timeStr = dtstartMatch[1].split("T")[1];
			if (timeStr.length >= 4) {
				const hours = timeStr.slice(0, 2);
				const minutes = timeStr.slice(2, 4);
				return `${hours}:${minutes}`;
			}
		}
	}

	if (task.scheduled) {
		const timePart = getTimePart(task.scheduled);
		if (timePart) return timePart;
	}

	return "09:00";
}

/**
 * Create next scheduled occurrence event for recurring task
 */
export function createNextScheduledEvent(
	task: TaskInfo,
	eventStart: string,
	instanceDate: string,
	templateTime: string,
	plugin: TaskNotesPlugin
): CalendarEvent | null {
	const hasTime = hasTimeComponent(eventStart);

	let endDate: string | undefined;
	if (hasTime && task.timeEstimate) {
		const start = parseDateToLocal(eventStart);
		const end = new Date(start.getTime() + task.timeEstimate * 60 * 1000);
		endDate = format(end, "yyyy-MM-dd'T'HH:mm");
	} else if (!hasTime) {
		endDate = calculateAllDayEndDate(eventStart, task.timeEstimate);
	}

	const priorityConfig = plugin.priorityManager.getPriorityConfig(task.priority);
	const borderColor = normalizeThemeColor(priorityConfig?.color, "var(--color-accent)");
	const isInstanceCompleted = task.complete_instances?.includes(instanceDate) || false;
	const isInstanceSkipped = task.skipped_instances?.includes(instanceDate) || false;
	// Use theme-appropriate text color when border is a CSS variable
	const textColor = isCssVariable(borderColor) ? getEventTextColor(true) : borderColor;

	// Determine background color based on instance state
	let backgroundColor = "transparent";
	if (isInstanceCompleted) {
		backgroundColor = "rgba(0,0,0,0.3)";
	} else if (isInstanceSkipped) {
		backgroundColor = "rgba(128,128,128,0.2)"; // Gray for skipped
	}

	return {
		id: `next-scheduled-${task.path}-${instanceDate}`,
		title: task.title,
		start: eventStart,
		end: endDate,
		allDay: !hasTime,
		backgroundColor: backgroundColor,
		borderColor: borderColor,
		textColor: textColor,
		editable: true,
		extendedProps: {
			taskInfo: task,
			eventType: "scheduled",
			isCompleted: isInstanceCompleted,
			isSkipped: isInstanceSkipped,
			isNextScheduledOccurrence: true,
			instanceDate: instanceDate,
			recurringTemplateTime: templateTime,
		},
	};
}

/**
 * Create recurring pattern instance event
 */
export function createRecurringEvent(
	task: TaskInfo,
	eventStart: string,
	instanceDate: string,
	templateTime: string,
	plugin: TaskNotesPlugin
): CalendarEvent | null {
	const hasTime = hasTimeComponent(eventStart);

	let endDate: string | undefined;
	if (hasTime && task.timeEstimate) {
		const start = parseDateToLocal(eventStart);
		const end = new Date(start.getTime() + task.timeEstimate * 60 * 1000);
		endDate = format(end, "yyyy-MM-dd'T'HH:mm");
	} else if (!hasTime) {
		endDate = calculateAllDayEndDate(eventStart, task.timeEstimate);
	}

	const priorityConfig = plugin.priorityManager.getPriorityConfig(task.priority);
	const borderColor = normalizeThemeColor(priorityConfig?.color, "var(--color-accent)");
	const isInstanceCompleted = task.complete_instances?.includes(instanceDate) || false;
	const isInstanceSkipped = task.skipped_instances?.includes(instanceDate) || false;

	const fadedBorderColor = hexToRgba(borderColor, 0.5);
	// Use theme-appropriate text color when border is a CSS variable (can't be faded)
	const textColor = isCssVariable(borderColor) ? getEventTextColor(true) : fadedBorderColor;

	// Determine background color based on instance state
	let backgroundColor = "transparent";
	if (isInstanceCompleted) {
		backgroundColor = "rgba(0,0,0,0.2)";
	} else if (isInstanceSkipped) {
		backgroundColor = "rgba(128,128,128,0.15)"; // Lighter gray for skipped pattern instances
	}

	return {
		id: `recurring-${task.path}-${instanceDate}`,
		title: task.title,
		start: eventStart,
		end: endDate,
		allDay: !hasTime,
		backgroundColor: backgroundColor,
		borderColor: fadedBorderColor,
		textColor: textColor,
		editable: true,
		extendedProps: {
			taskInfo: task,
			eventType: "recurring",
			isCompleted: isInstanceCompleted,
			isSkipped: isInstanceSkipped,
			isPatternInstance: true,
			instanceDate: instanceDate,
			recurringTemplateTime: templateTime,
		},
	};
}

/**
 * Generate recurring task instances for calendar display
 */
export function generateRecurringTaskInstances(
	task: TaskInfo,
	startDate: Date,
	endDate: Date,
	plugin: TaskNotesPlugin,
	options: RecurringInstanceVisibilityOptions = {}
): CalendarEvent[] {
	if (!task.recurrence || !task.scheduled) {
		return [];
	}

	const {
		showCompletedRecurringInstances = true,
		showSkippedRecurringInstances = true,
	} = options;
	const instances: CalendarEvent[] = [];
	const hasOriginalTime = hasTimeComponent(task.scheduled);
	const templateTime = getRecurringTime(task);
	const nextScheduledDate = getDatePart(task.scheduled);

	// 1. Create next scheduled occurrence event
	const scheduledTime = hasOriginalTime ? getTimePart(task.scheduled) : null;
	const scheduledEventStart = scheduledTime
		? `${nextScheduledDate}T${scheduledTime}`
		: nextScheduledDate;
	const nextScheduledEvent = createNextScheduledEvent(
		task,
		scheduledEventStart,
		nextScheduledDate,
		scheduledTime || "09:00",
		plugin
	);
	if (
		nextScheduledEvent &&
		shouldShowRecurringInstance(
			task,
			nextScheduledDate,
			showCompletedRecurringInstances,
			showSkippedRecurringInstances
		)
	) {
		instances.push(nextScheduledEvent);
	}

	// 2. Generate pattern instances from recurrence rule
	// For yearly recurring tasks, extend the look-ahead period to ensure we find occurrences
	// even when viewing short calendar ranges (weekly, 3-day, day views)
	let adjustedEndDate = endDate;
	if (typeof task.recurrence === "string" && task.recurrence.includes("FREQ=YEARLY")) {
		// For yearly tasks, look ahead ~2.2 years to ensure we find at least one occurrence
		const lookAheadDays = 800;
		adjustedEndDate = new Date(startDate.getTime() + lookAheadDays * 24 * 60 * 60 * 1000);
	}
	const recurringDates = generateRecurringInstances(task, startDate, adjustedEndDate);

	// Filter instances to only show those within the original visible date range
	// Compare by date only (not time) since FullCalendar boundaries are at midnight local time
	// but RRule generates occurrences at the task's scheduled time in UTC (issue #1582)
	const endDateOnly = formatDateForStorage(endDate);
	for (const date of recurringDates) {
		const instanceDate = formatDateForStorage(date);

		// Skip instances outside the original visible range (for yearly tasks with extended look-ahead)
		// Compare dates as strings (YYYY-MM-DD) to avoid timezone/time issues
		if (instanceDate > endDateOnly) {
			continue;
		}

		// Skip if conflicts with next scheduled occurrence
		if (instanceDate === nextScheduledDate) {
			continue;
		}

		if (
			!shouldShowRecurringInstance(
				task,
				instanceDate,
				showCompletedRecurringInstances,
				showSkippedRecurringInstances
			)
		) {
			continue;
		}

		const eventStart = hasOriginalTime ? `${instanceDate}T${templateTime}` : instanceDate;
		const event = createRecurringEvent(task, eventStart, instanceDate, templateTime, plugin);
		if (event) instances.push(event);
	}

	return instances;
}

function shouldShowRecurringInstance(
	task: TaskInfo,
	instanceDate: string,
	showCompletedRecurringInstances: boolean,
	showSkippedRecurringInstances: boolean
): boolean {
	if (!showCompletedRecurringInstances && task.complete_instances?.includes(instanceDate)) {
		return false;
	}

	if (!showSkippedRecurringInstances && task.skipped_instances?.includes(instanceDate)) {
		return false;
	}

	return true;
}

/**
 * Create timeblock calendar event
 */
export function createTimeblockEvent(
	timeblock: TimeBlock,
	date: string,
	defaultColor = "#6366f1"
): CalendarEvent {
	const startDateTime = `${date}T${timeblock.startTime}:00`;
	const endDateTime = `${date}T${timeblock.endTime}:00`;

	const backgroundColor = normalizeThemeColor(timeblock.color || defaultColor, "#6366f1");
	const borderColor = backgroundColor;

	return {
		id: `timeblock-${timeblock.id}`,
		title: timeblock.title,
		start: startDateTime,
		end: endDateTime,
		allDay: false,
		backgroundColor: backgroundColor,
		borderColor: borderColor,
		textColor: "var(--text-on-accent)",
		editable: true,
		extendedProps: {
			eventType: "timeblock",
			timeblock: timeblock,
			originalDate: date, // Store original date for tracking moves
		},
	};
}

/**
 * Validate and extract timeblocks from cached frontmatter
 */
function extractTimeblocksFromCache(frontmatter: unknown, path: string): TimeBlock[] {
	const frontmatterData = frontmatter as FrontmatterWithTimeblocks | null | undefined;
	if (!frontmatterData?.timeblocks || !Array.isArray(frontmatterData.timeblocks)) {
		return [];
	}

	const validTimeblocks: TimeBlock[] = [];
	for (const tb of frontmatterData.timeblocks) {
		const timeblock = tb as Partial<TimeBlock> | null;
		// Basic validation - must have id, startTime, endTime
		if (
			timeblock &&
			typeof timeblock.id === "string" &&
			typeof timeblock.startTime === "string" &&
			typeof timeblock.endTime === "string"
		) {
			validTimeblocks.push(timeblock as TimeBlock);
		}
	}
	return validTimeblocks;
}

/**
 * Generate timeblock events from daily notes for a date range
 * Uses metadataCache for performance - no file reads required
 */
// Cache for daily notes to avoid repeated getAllDailyNotes() calls
let _dailyNotesCache: Record<string, TFile> | null = null;
let _dailyNotesCacheTime = 0;
const DAILY_NOTES_CACHE_TTL = 5000; // 5 seconds

export async function generateTimeblockEvents(
	plugin: TaskNotesPlugin,
	startDate: Date,
	endDate: Date
): Promise<CalendarEvent[]> {
	try {
		// Use cached daily notes if available and fresh
		const now = Date.now();
		if (!_dailyNotesCache || now - _dailyNotesCacheTime > DAILY_NOTES_CACHE_TTL) {
			_dailyNotesCache = getAllDailyNotes();
			_dailyNotesCacheTime = now;
		}
		const allDailyNotes = _dailyNotesCache;

		const events: CalendarEvent[] = [];

		// Iterate through date range using cached metadata (no file reads)
		for (
			let currentUTC = new Date(startDate);
			currentUTC <= endDate;
			currentUTC.setUTCDate(currentUTC.getUTCDate() + 1)
		) {
			const dateString = formatDateForStorage(currentUTC);
			const currentDate = new Date(`${dateString}T12:00:00`);
			const dailyNote = getDailyNote(getWindowMoment(currentDate), allDailyNotes);

			if (dailyNote) {
				// Use metadataCache instead of reading file
				const cache = plugin.app.metadataCache.getFileCache(dailyNote);
				if (cache?.frontmatter) {
					const timeblocks = extractTimeblocksFromCache(
						cache.frontmatter,
						dailyNote.path
					);
					for (const timeblock of timeblocks) {
						events.push(
							createTimeblockEvent(
								timeblock,
								dateString,
								plugin.settings.calendarViewSettings.defaultTimeblockColor
							)
						);
					}
				}
			}
		}

		return events;
	} catch (error) {
		console.error("Error getting timeblock events:", error);
		return [];
	}
}

/**
 * Check if a date string falls within the visible range
 * Returns true if no range is specified (show all) or if date is within range
 * Returns true for invalid dates (let FullCalendar handle them)
 */
function isDateInVisibleRange(
	dateString: string,
	visibleStart?: Date,
	visibleEnd?: Date,
	timeEstimate?: number
): boolean {
	if (!visibleStart || !visibleEnd) return true;

	try {
		const date = parseDateToLocal(dateString);
		const dateTime = date.getTime();

		// Handle invalid dates - include them (let FullCalendar filter)
		if (isNaN(dateTime)) return true;

		// For events with time estimates, calculate end time
		let eventEndTime = dateTime;
		if (timeEstimate) {
			eventEndTime = dateTime + timeEstimate * 60 * 1000;
		}

		// Event is visible if it overlaps with visible range
		// Event starts before visible end AND event ends after visible start
		return dateTime < visibleEnd.getTime() && eventEndTime >= visibleStart.getTime();
	} catch {
		// If date parsing fails, include the event (let FullCalendar handle it)
		return true;
	}
}

/**
 * Generate calendar events from tasks
 */
export async function generateCalendarEvents(
	tasks: TaskInfo[],
	plugin: TaskNotesPlugin,
	options: CalendarEventGenerationOptions = {}
): Promise<CalendarEvent[]> {
	const {
		showScheduled = true,
		showDue = true,
		showScheduledToDueSpan = false,
		showTimeEntries = true,
		showRecurring = true,
		showCompletedRecurringInstances = true,
		showSkippedRecurringInstances = true,
		showICSEvents = true,
		showTimeblocks = false,
		visibleStart,
		visibleEnd,
	} = options;

	const events: CalendarEvent[] = [];

	const addStandaloneDateEvents = (
		task: TaskInfo,
		includeScheduled: boolean,
		allowScheduledToDueSpan: boolean
	): void => {
		let showedSpan = false;
		if (
			allowScheduledToDueSpan &&
			showScheduledToDueSpan &&
			task.scheduled &&
			task.due
		) {
			const spanEvents = createScheduledToDueSpanEvents(
				task,
				plugin,
				visibleStart,
				visibleEnd
			);
			if (spanEvents.length > 0) {
				events.push(...spanEvents);
				showedSpan = true;
			}
		}

		if (showedSpan) {
			return;
		}

		if (includeScheduled && task.scheduled) {
			if (isDateInVisibleRange(task.scheduled, visibleStart, visibleEnd, task.timeEstimate)) {
				const scheduledEvent = createScheduledEvent(task, plugin);
				if (scheduledEvent) events.push(scheduledEvent);
			}
		}

		if (showDue && task.due) {
			if (isDateInVisibleRange(task.due, visibleStart, visibleEnd)) {
				const dueEvent = createDueEvent(task, plugin);
				if (dueEvent) events.push(dueEvent);
			}
		}
	};

	for (const task of tasks) {
		try {
			// Handle recurring tasks
			if (task.recurrence) {
				let includeStandaloneScheduled = showScheduled;
				let allowScheduledToDueSpan = true;

				if (showRecurring && visibleStart && visibleEnd) {
					if (task.scheduled) {
						const recurringEvents = generateRecurringTaskInstances(
							task,
							visibleStart,
							visibleEnd,
							plugin,
							{
								showCompletedRecurringInstances,
								showSkippedRecurringInstances,
							}
						);
						events.push(...recurringEvents);
						includeStandaloneScheduled = false;
						allowScheduledToDueSpan = false;
					}
				}

				addStandaloneDateEvents(task, includeStandaloneScheduled, allowScheduledToDueSpan);
			} else {
				// Handle non-recurring tasks with date range filtering
				addStandaloneDateEvents(task, showScheduled, true);
			}

			// Add time entry events with date range filtering
			if (showTimeEntries && task.timeEntries) {
				const timeEvents = createTimeEntryEvents(task, plugin);
				// Filter time entries by visible range
				for (const event of timeEvents) {
					if (isDateInVisibleRange(event.start, visibleStart, visibleEnd)) {
						events.push(event);
					}
				}
			}
		} catch (error) {
			// Log error but continue processing other tasks
			// This prevents a single task with invalid dates from breaking the entire calendar
			console.warn(
				`[TaskNotes][Calendar] Error processing task "${task.title}" (${task.path}):`,
				error
			);
		}
	}

	// Add ICS events with date range filtering
	if (showICSEvents && plugin.icsSubscriptionService) {
		const icsEvents = plugin.icsSubscriptionService.getAllEvents();
		for (const icsEvent of icsEvents) {
			if (isDateInVisibleRange(icsEvent.start, visibleStart, visibleEnd)) {
				const calendarEvent = createICSEvent(icsEvent, plugin);
				if (calendarEvent) {
					events.push(calendarEvent);
				}
			}
		}
	}

	// Add timeblock events
	if (showTimeblocks && visibleStart && visibleEnd) {
		const timeblockEvents = await generateTimeblockEvents(plugin, visibleStart, visibleEnd);
		events.push(...timeblockEvents);
	}

	return events;
}

/**
 * Handle timeblock creation (drag selection with context menu)
 */
export async function handleTimeblockCreation(
	start: Date,
	end: Date,
	allDay: boolean,
	plugin: TaskNotesPlugin,
	onCreated?: (result: TimeblockCreationResult) => void | Promise<void>
): Promise<void> {
	// Don't create timeblocks for all-day selections
	if (allDay) {
		new Notice(
			"Timeblocks must have specific times. Please select a time range in week or day view."
		);
		return;
	}

	const date = format(start, "yyyy-MM-dd");
	const startTime = format(start, "HH:mm");
	const endTime = format(end, "HH:mm");

	const modal = new TimeblockCreationModal(plugin.app, plugin, {
		date,
		startTime,
		endTime,
		onCreated,
	});

	modal.open();
}

/**
 * Handle time entry creation (Alt+drag to create time entry)
 */
export async function handleTimeEntryCreation(
	start: Date,
	end: Date,
	allDay: boolean,
	plugin: TaskNotesPlugin
): Promise<void> {
	// Don't create time entries for all-day selections
	if (allDay) {
		new Notice(plugin.i18n.translate("modals.timeEntry.mustHaveSpecificTime"));
		return;
	}

	try {
		// Get all tasks
		const allTasks = await plugin.cacheManager.getAllTasks();
		const unarchivedTasks = allTasks.filter((task) => !task.archived);

		if (unarchivedTasks.length === 0) {
			new Notice(plugin.i18n.translate("modals.timeEntry.noTasksAvailable"));
			return;
		}

		// Open task selector modal
		openTaskSelector(plugin, unarchivedTasks, (selectedTask: TaskInfo) => {
			void (async () => {
				if (selectedTask) {
					try {
						// Calculate duration
						const durationMinutes = Math.round(
							(end.getTime() - start.getTime()) / 60000
						);

						// Create new time entry
						const newEntry = {
							startTime: start.toISOString(),
							endTime: end.toISOString(),
							description: "",
						};

						// Add to task's time entries
						const updatedTimeEntries = [
							...(selectedTask.timeEntries || []),
							newEntry,
						].map((entry) => {
							const sanitizedEntry: Record<string, unknown> = { ...entry };
							delete sanitizedEntry.duration;
							return sanitizedEntry as typeof entry;
						});

						// Save to file
						await plugin.taskService.updateTask(selectedTask, {
							timeEntries: updatedTimeEntries,
						});

						// Note: updateTask in TaskService already triggers EVENT_TASK_UPDATED internally
						// We just need to trigger EVENT_DATA_CHANGED
						plugin.emitter.trigger(EVENT_DATA_CHANGED);

						new Notice(
							plugin.i18n.translate("modals.timeEntry.created", {
								taskTitle: selectedTask.title,
								duration: durationMinutes.toString(),
							})
						);
					} catch (error) {
						console.error("Error creating time entry:", error);
						new Notice(plugin.i18n.translate("modals.timeEntry.createFailed"));
					}
				}
			})();
		});
	} catch (error) {
		console.error("Error opening task selector for time entry:", error);
		new Notice(plugin.i18n.translate("modals.timeEntry.createFailed"));
	}
}

/**
 * Handle timeblock drop (move to new date/time)
 */
export async function handleTimeblockDrop(
	dropInfo: CalendarMutationInfo,
	timeblock: TimeBlock,
	originalDate: string,
	plugin: TaskNotesPlugin,
	copyRequested = false
): Promise<void> {
	try {
		const newStart = dropInfo.event.start;
		const newEnd = dropInfo.event.end;
		if (!newStart || !newEnd) {
			dropInfo.revert();
			return;
		}

		// Calculate new date and times
		const newDate = format(newStart, "yyyy-MM-dd");
		const newStartTime = format(newStart, "HH:mm");
		const newEndTime = format(newEnd, "HH:mm");

		if (copyRequested) {
			await copyTimeblockToDailyNote(
				plugin.app,
				newDate,
				timeblock,
				newStartTime,
				newEndTime
			);
			dropInfo.revert();
			plugin.emitter.trigger(EVENT_DATA_CHANGED);
			new Notice("Timeblock duplicated successfully");
			return;
		}

		// Update timeblock in daily notes
		await updateTimeblockInDailyNote(
			plugin.app,
			timeblock.id,
			originalDate,
			newDate,
			newStartTime,
			newEndTime
		);

		new Notice("Timeblock moved successfully");
	} catch (error: unknown) {
		console.error("Error moving timeblock:", error);
		new Notice(`Failed to move timeblock: ${getErrorMessage(error)}`);
		dropInfo.revert();
	}
}

/**
 * Handle timeblock resize (change duration)
 */
export async function handleTimeblockResize(
	resizeInfo: CalendarMutationInfo,
	timeblock: TimeBlock,
	originalDate: string,
	plugin: TaskNotesPlugin
): Promise<void> {
	try {
		const start = resizeInfo.event.start;
		const end = resizeInfo.event.end;

		if (!start || !end) {
			resizeInfo.revert();
			return;
		}

		// Calculate new times
		const newStartTime = format(start, "HH:mm");
		const newEndTime = format(end, "HH:mm");

		// Update timeblock in daily note (same date, just time change)
		await updateTimeblockInDailyNote(
			plugin.app,
			timeblock.id,
			originalDate,
			originalDate, // Same date
			newStartTime,
			newEndTime
		);

		new Notice("Timeblock duration updated");
	} catch (error: unknown) {
		console.error("Error resizing timeblock:", error);
		new Notice(`Failed to resize timeblock: ${getErrorMessage(error)}`);
		resizeInfo.revert();
	}
}

/**
 * Show timeblock info modal
 */
export async function showTimeblockInfoModal(
	timeblock: TimeBlock,
	eventDate: Date,
	originalDate: string | undefined,
	plugin: TaskNotesPlugin,
	onChange?: () => void
): Promise<void> {
	const modal = new TimeblockInfoModal(
		plugin.app,
		plugin,
		timeblock,
		eventDate,
		originalDate,
		onChange
	);
	modal.open();
}

/**
 * Apply timeblock event styling
 */
export function applyTimeblockStyling(element: HTMLElement, timeblock: TimeBlock): void {
	// Add data attributes for timeblocks
	element.setAttribute("data-timeblock-id", timeblock.id || "");

	// Add visual styling for timeblocks
	element.classList.remove("tn-static-border-style-dashed-12296c91");
	element.classList.add("tn-static-border-style-solid-11080b69");
	element.classList.add("tn-static-border-width-2px-a1222254");
	element.classList.add("fc-timeblock-event");
}

/**
 * Generate timeblock tooltip text
 */
export function generateTimeblockTooltip(timeblock: TimeBlock): string {
	const attachmentCount = timeblock.attachments?.length || 0;
	return `${timeblock.title || "Timeblock"}${timeblock.description ? ` - ${timeblock.description}` : ""}${attachmentCount > 0 ? ` (${attachmentCount} attachment${attachmentCount > 1 ? "s" : ""})` : ""}`;
}

/**
 * Add hover preview functionality to a task event element
 */
export function addTaskHoverPreview(
	element: HTMLElement,
	taskInfo: TaskInfo,
	plugin: TaskNotesPlugin,
	source = "tasknotes-calendar"
): void {
	element.addEventListener("mouseover", (event: MouseEvent) => {
		const file = plugin.app.vault.getAbstractFileByPath(taskInfo.path);
		if (file) {
			plugin.app.workspace.trigger("hover-link", {
				event,
				source,
				hoverParent: element,
				targetEl: element,
				linktext: taskInfo.path,
				sourcePath: taskInfo.path,
			});
		}
	});
}

export interface DateTitleClickOptions {
	createIfMissing?: boolean;
}

/**
 * Handle clicking on a date title to open/create daily note
 */
export async function handleDateTitleClick(
	date: Date,
	plugin: TaskNotesPlugin,
	options: DateTitleClickOptions = {}
): Promise<void> {
	try {
		const { createIfMissing = true } = options;

		// Check if Daily Notes plugin is enabled
		if (!appHasDailyNotesPluginLoaded()) {
			new Notice(
				"Daily notes core plugin is not enabled. Please enable it in settings > core plugins."
			);
			return;
		}

		// Convert date to moment for the API
		const moment = getWindowMoment(date);

		// Get all daily notes to check if one exists for this date
		const allDailyNotes = getAllDailyNotes();
		let dailyNote = getDailyNote(moment, allDailyNotes);

		if (!dailyNote) {
			if (!createIfMissing) {
				new Notice(
					plugin.i18n.translate("views.basesCalendar.notices.noDailyNoteForDate")
				);
				return;
			}

			// Daily note doesn't exist, create it
			try {
				dailyNote = await createDailyNote(moment);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				console.error("Failed to create daily note:", error);
				new Notice(`Failed to create daily note: ${errorMessage}`);
				return;
			}
		}

		// Open the daily note
		if (dailyNote) {
			await plugin.app.workspace.getLeaf(false).openFile(dailyNote);
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error("Failed to navigate to daily note:", error);
		new Notice(`Failed to navigate to daily note: ${errorMessage}`);
	}
}

type DateTitleClickHandler = (date: Date, plugin: TaskNotesPlugin) => Promise<void> | void;

/**
 * FullCalendar does not always decorate the single-day time grid header as a
 * nav link, because clicking it would normally navigate to the same view/date.
 * TaskNotes uses date-header clicks for daily-note navigation, so wire that
 * header explicitly while leaving the built-in navLink behavior alone elsewhere.
 */
export function attachDailyNoteHeaderLink(
	headerCell: HTMLElement,
	date: Date,
	viewType: string,
	plugin: TaskNotesPlugin,
	handleClick: DateTitleClickHandler = handleDateTitleClick
): void {
	if (viewType !== "timeGridDay") {
		return;
	}

	const linkEl =
		headerCell.querySelector<HTMLElement>(".fc-col-header-cell-cushion") || headerCell;
	const title = `Go to ${format(date, "d MMMM yyyy")}`;

	linkEl.setAttribute("data-navlink", "");
	linkEl.setAttribute("title", title);
	linkEl.setAttribute("aria-label", title);
	linkEl.classList.add("tasknotes-calendar-daily-note-link");
	linkEl.dataset.tasknotesDailyNoteDate = date.toISOString();

	if (linkEl.matches("a") && !linkEl.getAttribute("href")) {
		linkEl.setAttribute("href", "#");
	}

	if (linkEl.dataset.tasknotesDailyNoteLinkAttached === "true") {
		return;
	}

	linkEl.dataset.tasknotesDailyNoteLinkAttached = "true";
	linkEl.addEventListener("click", (event) => {
		event.preventDefault();
		event.stopPropagation();
		const target = event.currentTarget as HTMLElement | null;
		const targetDate = target?.dataset.tasknotesDailyNoteDate
			? new Date(target.dataset.tasknotesDailyNoteDate)
			: date;
		void handleClick(targetDate, plugin);
	});
}

/**
 * Calculate pre-populated values for task creation from calendar date selection
 *
 * This shared logic is used by both AdvancedCalendarView and Bases calendar view
 * to consistently handle multi-day selections, timed selections, and single clicks.
 *
 * @param start - Selection start date
 * @param end - Selection end date
 * @param allDay - Whether this is an all-day selection
 * @param slotDurationMinutes - Calendar slot duration in minutes (for detecting drags vs clicks)
 * @returns Pre-populated values object with scheduled date and optional timeEstimate
 */
export function calculateTaskCreationValues(
	start: Date,
	end: Date,
	allDay: boolean,
	slotDurationMinutes: number
): { scheduled: string; timeEstimate?: number } {
	// Pre-populate with selected date/time
	const scheduledDate = allDay
		? format(start, "yyyy-MM-dd")
		: format(start, "yyyy-MM-dd'T'HH:mm");

	const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));

	// Determine if this was a drag (intentional time selection) or just a click
	// If duration is greater than slot duration, it's an intentional drag
	const isDragOperation = !allDay && durationMinutes > slotDurationMinutes;

	const prePopulatedValues: { scheduled: string; timeEstimate?: number } = {
		scheduled: scheduledDate,
	};

	// Only override time estimate if it's an intentional drag operation
	if (allDay) {
		// For all-day events, calculate duration in days if multi-day selection
		const dayDurationMillis = 24 * 60 * 60 * 1000; // milliseconds in a day
		const daysDuration = Math.round((end.getTime() - start.getTime()) / dayDurationMillis);

		if (daysDuration > 1) {
			// Multi-day selection: set time estimate based on days
			const minutesPerDay = 60 * 24;
			prePopulatedValues.timeEstimate = daysDuration * minutesPerDay;
		}
		// For single-day all-day events, let TaskCreationModal use the default setting
	} else if (isDragOperation) {
		// User dragged to select a specific duration, use that
		prePopulatedValues.timeEstimate = durationMinutes;
	}
	// For clicks (not drags), don't set timeEstimate to let default setting apply

	return prePopulatedValues;
}
