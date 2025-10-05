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
		eventType: "scheduled" | "due" | "timeEntry" | "recurring" | "ics" | "timeblock" | "property-based";
		filePath?: string; // For property-based events
		file?: any; // For property-based events
		isCompleted?: boolean;
		isRecurringInstance?: boolean;
		isNextScheduledOccurrence?: boolean;
		isPatternInstance?: boolean;
		instanceDate?: string;
		recurringTemplateTime?: string;
		subscriptionName?: string;
		timeEntryIndex?: number;
		originalDate?: string; // For timeblock events - tracks original date for move operations
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
		element.style.borderStyle = "solid";
		element.style.borderWidth = "2px";
		element.setAttribute("data-next-scheduled", "true");
		element.classList.add("fc-next-scheduled-event");

		// Apply dimmed appearance for completed instances
		if (isCompleted) {
			element.style.opacity = "0.6";
		}
	} else if (isPatternInstance) {
		// Pattern occurrences: Recurring preview styling (dashed border, reduced opacity)
		element.style.borderStyle = "dashed";
		element.style.borderWidth = "2px";
		element.style.opacity = isCompleted ? "0.4" : "0.7"; // Reduced opacity for pattern instances

		element.setAttribute("data-pattern-instance", "true");
		element.classList.add("fc-pattern-instance-event");
	} else if (isRecurringInstance) {
		// Legacy recurring instances (for backward compatibility)
		element.style.borderStyle = "dashed";
		element.style.borderWidth = "2px";

		element.setAttribute("data-recurring", "true");
		element.classList.add("fc-recurring-event");

		// Apply dimmed appearance for completed instances
		if (isCompleted) {
			element.style.opacity = "0.6";
		}
	}

	// Apply strikethrough styling for completed tasks
	if (isCompleted) {
		const titleElement = element.querySelector(".fc-event-title, .fc-event-title-container");
		if (titleElement) {
			(titleElement as HTMLElement).style.textDecoration = "line-through";
		} else {
			// Fallback: apply to the entire event element
			element.style.textDecoration = "line-through";
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
	const { Notice } = await import("obsidian");
	const { addDTSTARTToRecurrenceRuleWithDraggedTime } = await import("../utils/helpers");
	const { format } = await import("date-fns");

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
	dropInfo: any,
	taskInfo: TaskInfo,
	plugin: TaskNotesPlugin
): Promise<void> {
	const { Notice } = await import("obsidian");
	const { format } = await import("date-fns");
	const { getDatePart } = await import("../utils/dateUtils");

	const {
		isRecurringInstance,
		isNextScheduledOccurrence,
		isPatternInstance,
	} = dropInfo.event.extendedProps;

	const newStart = dropInfo.event.start;
	const allDay = dropInfo.event.allDay;

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
export function getTargetDateForEvent(eventArg: any): Date {
	const { format } = require("date-fns");
	const { parseDateToUTC, getTodayLocal } = require("../utils/dateUtils");

	// Extract from eventArg.event if it's an event mount arg, or directly if it's the event
	const event = eventArg.event || eventArg;
	const extendedProps = event.extendedProps || {};
	const {
		isRecurringInstance,
		isNextScheduledOccurrence,
		isPatternInstance,
		instanceDate,
	} = extendedProps;

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
			textColor: "var(--color-base-40)",
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
 * Create timeblock calendar event
 */
export function createTimeblockEvent(timeblock: TimeBlock, date: string): CalendarEvent {
	const startDateTime = `${date}T${timeblock.startTime}:00`;
	const endDateTime = `${date}T${timeblock.endTime}:00`;

	const backgroundColor = timeblock.color || "#6366f1";
	const borderColor = timeblock.color || "#4f46e5";

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
 * Generate timeblock events from daily notes for a date range
 */
export async function generateTimeblockEvents(
	plugin: TaskNotesPlugin,
	startDate: Date,
	endDate: Date
): Promise<CalendarEvent[]> {
	const events: CalendarEvent[] = [];

	try {
		// Lazy import daily notes plugin
		const { getAllDailyNotes, getDailyNote } = require("obsidian-daily-notes-interface");
		const { extractTimeblocksFromNote } = require("../utils/helpers");
		const { formatDateForStorage } = require("../utils/dateUtils");

		const allDailyNotes = getAllDailyNotes();

		// Iterate through date range
		for (
			let currentUTC = new Date(startDate);
			currentUTC <= endDate;
			currentUTC.setUTCDate(currentUTC.getUTCDate() + 1)
		) {
			const dateString = formatDateForStorage(currentUTC);
			const currentDate = new Date(`${dateString}T12:00:00`);
			const moment = (window as any).moment(currentDate);
			const dailyNote = getDailyNote(moment, allDailyNotes);

			if (dailyNote) {
				try {
					const content = await plugin.app.vault.read(dailyNote);
					const timeblocks = extractTimeblocksFromNote(content, dailyNote.path);

					for (const timeblock of timeblocks) {
						const calendarEvent = createTimeblockEvent(timeblock, dateString);
						events.push(calendarEvent);
					}
				} catch (error) {
					console.error(`Error reading daily note ${dailyNote.path}:`, error);
				}
			}
		}
	} catch (error) {
		console.error("Error getting timeblock events:", error);
	}

	return events;
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

	// Add timeblock events
	if (showTimeblocks && visibleStart && visibleEnd) {
		const timeblockEvents = await generateTimeblockEvents(plugin, visibleStart, visibleEnd);
		events.push(...timeblockEvents);
	}

	return events;
}

/**
 * Handle timeblock creation (Shift + drag selection)
 */
export async function handleTimeblockCreation(
	start: Date,
	end: Date,
	allDay: boolean,
	plugin: TaskNotesPlugin
): Promise<void> {
	const { Notice } = require("obsidian");
	const { TimeblockCreationModal } = require("../modals/TimeblockCreationModal");
	const { format } = require("date-fns");

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
	});

	modal.open();
}

/**
 * Handle timeblock drop (move to new date/time)
 */
export async function handleTimeblockDrop(
	dropInfo: any,
	timeblock: TimeBlock,
	originalDate: string,
	plugin: TaskNotesPlugin
): Promise<void> {
	const { Notice } = require("obsidian");
	const { format } = require("date-fns");
	const { updateTimeblockInDailyNote } = require("../utils/helpers");

	try {
		const newStart = dropInfo.event.start;
		const newEnd = dropInfo.event.end;

		// Calculate new date and times
		const newDate = format(newStart, "yyyy-MM-dd");
		const newStartTime = format(newStart, "HH:mm");
		const newEndTime = format(newEnd, "HH:mm");

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
	} catch (error: any) {
		console.error("Error moving timeblock:", error);
		new Notice(`Failed to move timeblock: ${error.message}`);
		dropInfo.revert();
	}
}

/**
 * Handle timeblock resize (change duration)
 */
export async function handleTimeblockResize(
	resizeInfo: any,
	timeblock: TimeBlock,
	originalDate: string,
	plugin: TaskNotesPlugin
): Promise<void> {
	const { Notice } = require("obsidian");
	const { format } = require("date-fns");
	const { updateTimeblockInDailyNote } = require("../utils/helpers");

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
	} catch (error: any) {
		console.error("Error resizing timeblock:", error);
		new Notice(`Failed to resize timeblock: ${error.message}`);
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
	plugin: TaskNotesPlugin
): Promise<void> {
	const { TimeblockInfoModal } = require("../modals/TimeblockInfoModal");

	const modal = new TimeblockInfoModal(
		plugin.app,
		plugin,
		timeblock,
		eventDate,
		originalDate
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
	element.style.borderStyle = "solid";
	element.style.borderWidth = "2px";
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
	source: string = "tasknotes-calendar"
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

/**
 * Handle clicking on a date title to open/create daily note
 */
export async function handleDateTitleClick(date: Date, plugin: TaskNotesPlugin): Promise<void> {
	const { Notice } = require("obsidian");
	const {
		appHasDailyNotesPluginLoaded,
		getAllDailyNotes,
		getDailyNote,
		createDailyNote,
	} = require("obsidian-daily-notes-interface");

	try {
		// Check if Daily Notes plugin is enabled
		if (!appHasDailyNotesPluginLoaded()) {
			new Notice(
				"Daily Notes core plugin is not enabled. Please enable it in Settings > Core plugins."
			);
			return;
		}

		// Convert date to moment for the API
		const moment = (window as any).moment(date);

		// Get all daily notes to check if one exists for this date
		const allDailyNotes = getAllDailyNotes();
		let dailyNote = getDailyNote(moment, allDailyNotes);

		if (!dailyNote) {
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
