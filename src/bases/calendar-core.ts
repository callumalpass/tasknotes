/**
 * Shared Calendar Core Logic
 *
 * This module contains shared calendar event generation logic used by both:
 * - AdvancedCalendarView (ItemView)
 * - TaskNotes Calendar Bases View (Bases integration)
 */

import { format } from "date-fns";
import TaskNotesPlugin from "../main";
import { TaskInfo, ICSEvent, TimeBlock } from "../types";
import {
	hasTimeComponent,
	getDatePart,
	getTimePart,
	parseDateToLocal,
	formatDateForStorage,
} from "../utils/dateUtils";
import { generateRecurringInstances } from "../utils/helpers";

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
		eventType: "scheduled" | "due" | "timeEntry" | "recurring" | "ics" | "timeblock";
		isCompleted?: boolean;
		isRecurringInstance?: boolean;
		isNextScheduledOccurrence?: boolean;
		isPatternInstance?: boolean;
		instanceDate?: string;
		recurringTemplateTime?: string;
		subscriptionName?: string;
		timeEntryIndex?: number;
	};
}

export interface CalendarEventGenerationOptions {
	showScheduled?: boolean;
	showDue?: boolean;
	showTimeEntries?: boolean;
	showRecurring?: boolean;
	showICSEvents?: boolean;
	showTimeblocks?: boolean;
	visibleStart?: Date;
	visibleEnd?: Date;
}

/**
 * Convert hex color to rgba with alpha
 */
export function hexToRgba(hex: string, alpha: number): string {
	hex = hex.replace("#", "");
	const r = parseInt(hex.substring(0, 2), 16);
	const g = parseInt(hex.substring(2, 4), 16);
	const b = parseInt(hex.substring(4, 6), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Calculate all-day end date based on time estimate
 */
export function calculateAllDayEndDate(startDate: string, timeEstimate?: number): string | undefined {
	if (!timeEstimate) return undefined;

	// For all-day events, add days based on time estimate (8 hours = 1 day)
	const days = Math.ceil(timeEstimate / (8 * 60));
	const start = new Date(startDate);
	const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
	return format(end, "yyyy-MM-dd");
}

/**
 * Create scheduled event from task
 */
export function createScheduledEvent(task: TaskInfo, plugin: TaskNotesPlugin): CalendarEvent | null {
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
	const borderColor = priorityConfig?.color || "var(--color-accent)";
	const isCompleted = plugin.statusManager.isCompletedStatus(task.status);

	return {
		id: `scheduled-${task.path}`,
		title: task.title,
		start: startDate,
		end: endDate,
		allDay: !hasTime,
		backgroundColor: "transparent",
		borderColor: borderColor,
		textColor: borderColor,
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
	const borderColor = priorityConfig?.color || "var(--color-orange)";
	const fadedBackground = hexToRgba(borderColor, 0.15);
	const isCompleted = plugin.statusManager.isCompletedStatus(task.status);

	return {
		id: `due-${task.path}`,
		title: `DUE: ${task.title}`,
		start: startDate,
		end: endDate,
		allDay: !hasTime,
		backgroundColor: fadedBackground,
		borderColor: borderColor,
		textColor: borderColor,
		editable: false,
		extendedProps: {
			taskInfo: task,
			eventType: "due",
			isCompleted: isCompleted,
		},
	};
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
			backgroundColor: "var(--color-base-50)",
			borderColor: "var(--color-base-40)",
			textColor: "var(--text-on-accent)",
			editable: false,
			extendedProps: {
				taskInfo: task,
				eventType: "timeEntry" as const,
				isCompleted: isCompleted,
				timeEntryIndex: index,
			},
		}));
}

/**
 * Create ICS calendar event
 */
export function createICSEvent(icsEvent: ICSEvent, plugin: TaskNotesPlugin): CalendarEvent | null {
	try {
		const subscription = plugin.icsSubscriptionService
			?.getSubscriptions()
			.find((sub) => sub.id === icsEvent.subscriptionId);

		if (!subscription || !subscription.enabled) {
			return null;
		}

		const backgroundColor = hexToRgba(subscription.color, 0.2);
		const borderColor = subscription.color;

		return {
			id: icsEvent.id,
			title: icsEvent.title,
			start: icsEvent.start,
			end: icsEvent.end,
			allDay: icsEvent.allDay,
			backgroundColor: backgroundColor,
			borderColor: borderColor,
			textColor: borderColor,
			editable: false,
			extendedProps: {
				icsEvent: icsEvent,
				eventType: "ics",
				subscriptionName: subscription.name,
			},
		};
	} catch (error) {
		console.error("Error creating ICS event:", error);
		return null;
	}
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
	const borderColor = priorityConfig?.color || "var(--color-accent)";
	const isInstanceCompleted = task.complete_instances?.includes(instanceDate) || false;
	const backgroundColor = isInstanceCompleted ? "rgba(0,0,0,0.3)" : "transparent";

	return {
		id: `next-scheduled-${task.path}-${instanceDate}`,
		title: task.title,
		start: eventStart,
		end: endDate,
		allDay: !hasTime,
		backgroundColor: backgroundColor,
		borderColor: borderColor,
		textColor: borderColor,
		editable: true,
		extendedProps: {
			taskInfo: task,
			eventType: "scheduled",
			isCompleted: isInstanceCompleted,
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
	const borderColor = priorityConfig?.color || "var(--color-accent)";
	const isInstanceCompleted = task.complete_instances?.includes(instanceDate) || false;

	const fadedBorderColor = hexToRgba(borderColor, 0.5);
	const backgroundColor = isInstanceCompleted ? "rgba(0,0,0,0.2)" : "transparent";

	return {
		id: `recurring-${task.path}-${instanceDate}`,
		title: task.title,
		start: eventStart,
		end: endDate,
		allDay: !hasTime,
		backgroundColor: backgroundColor,
		borderColor: fadedBorderColor,
		textColor: fadedBorderColor,
		editable: true,
		extendedProps: {
			taskInfo: task,
			eventType: "recurring",
			isCompleted: isInstanceCompleted,
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
	plugin: TaskNotesPlugin
): CalendarEvent[] {
	if (!task.recurrence || !task.scheduled) {
		return [];
	}

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
	if (nextScheduledEvent) {
		instances.push(nextScheduledEvent);
	}

	// 2. Generate pattern instances from recurrence rule
	const recurringDates = generateRecurringInstances(task, startDate, endDate);

	for (const date of recurringDates) {
		const instanceDate = formatDateForStorage(date);

		// Skip if conflicts with next scheduled occurrence
		if (instanceDate === nextScheduledDate) {
			continue;
		}

		const eventStart = hasOriginalTime ? `${instanceDate}T${templateTime}` : instanceDate;
		const event = createRecurringEvent(task, eventStart, instanceDate, templateTime, plugin);
		if (event) instances.push(event);
	}

	return instances;
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
		showTimeEntries = true,
		showRecurring = true,
		showICSEvents = true,
		showTimeblocks = false,
		visibleStart,
		visibleEnd,
	} = options;

	const events: CalendarEvent[] = [];

	for (const task of tasks) {
		// Handle recurring tasks
		if (task.recurrence) {
			if (!task.scheduled) continue;

			if (showRecurring && visibleStart && visibleEnd) {
				const recurringEvents = generateRecurringTaskInstances(
					task,
					visibleStart,
					visibleEnd,
					plugin
				);
				events.push(...recurringEvents);
			}
		} else {
			// Handle non-recurring tasks
			const hasScheduled = !!task.scheduled;
			const hasDue = !!task.due;

			if (!hasScheduled && !hasDue) continue;

			if (showScheduled && hasScheduled) {
				const scheduledEvent = createScheduledEvent(task, plugin);
				if (scheduledEvent) events.push(scheduledEvent);
			}

			if (showDue && hasDue) {
				const dueEvent = createDueEvent(task, plugin);
				if (dueEvent) events.push(dueEvent);
			}
		}

		// Add time entry events
		if (showTimeEntries && task.timeEntries) {
			const timeEvents = createTimeEntryEvents(task, plugin);
			events.push(...timeEvents);
		}
	}

	// Add ICS events
	if (showICSEvents && plugin.icsSubscriptionService) {
		const icsEvents = plugin.icsSubscriptionService.getAllEvents();
		for (const icsEvent of icsEvents) {
			const calendarEvent = createICSEvent(icsEvent, plugin);
			if (calendarEvent) {
				events.push(calendarEvent);
			}
		}
	}

	return events;
}
